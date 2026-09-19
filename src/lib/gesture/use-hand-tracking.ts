"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                             */
/* ------------------------------------------------------------------ */
export type Landmark = { x: number; y: number; z: number };

export type GestureType = "open" | "fist" | "pinch" | "point" | "idle";

export type HandState = {
  x: number;          // 0..1, mirrored so it feels natural
  y: number;          // 0..1
  velocity: number;   // 0..1 normalised speed (kept for legacy use, but
  // downstream code should prefer position/gesture)
  gesture: GestureType;
  present: boolean;
  handedness: "Left" | "Right" | "Unknown";
};

export type LandmarkerHandle = {
  detectForVideo: (v: HTMLVideoElement, t: number) => {
    landmarks: Landmark[][];
    handedness: { categoryName: string }[][];
  };
};

const DEFAULT_HAND: HandState = {
  x: 0.5, y: 0.5, velocity: 0, gesture: "idle", present: false, handedness: "Unknown",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                           */
/* ------------------------------------------------------------------ */
function dist(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function refSize(lm: Landmark[]) {
  return dist(lm[0], lm[9]) || 1e-6;
}

function fingerStates(lm: Landmark[]): boolean[] {
  const palmCx = (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4;
  const palmCy = (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4;
  const tipFrom = Math.abs(lm[4].x - palmCx) + Math.abs(lm[4].y - palmCy);
  const ipFrom = Math.abs(lm[3].x - palmCx) + Math.abs(lm[3].y - palmCy);
  const lateral = tipFrom > ipFrom * 1.1;
  const upward = lm[4].y < lm[3].y - 0.03;
  return [lateral || upward, lm[8].y < lm[6].y, lm[12].y < lm[10].y, lm[16].y < lm[14].y, lm[20].y < lm[18].y];
}

function classifyGesture(lm: Landmark[]): GestureType {
  const st = fingerStates(lm);
  const [thumb, index, middle, ring, pinky] = st;
  const ref = refSize(lm);
  const di = dist(lm[4], lm[8]) / ref;
  if (di < 0.4 && !middle && !ring && !pinky && thumb) return "pinch";
  if (thumb && index && middle && ring && pinky) return "open";
  if (index && !middle && !ring && !pinky) return "point";
  if (!index && !middle && !ring && !pinky) return "fist";
  return "idle";
}

/* ------------------------------------------------------------------ */
/* Hook                                                              */
/* ------------------------------------------------------------------ */
export function useHandTracking(opts?: {
  smoothing?: number;        // EMA alpha for x,y (default 0.4)
  velSmoothing?: number;     // EMA alpha for velocity (default 0.5)
  numHands?: number;         // 1 (default) or 2
  onFrame?: (h: HandState, lm: Landmark[] | null) => void;       // primary hand
  onHands?: (hands: HandState[], lms: (Landmark[] | null)[]) => void; // all hands
}) {
  const smoothing = opts?.smoothing ?? 0.4;
  const velSmoothing = opts?.velSmoothing ?? 0.5;
  const numHands = opts?.numHands ?? 1;
  const onFrameRef = useRef(opts?.onFrame);
  const onHandsRef = useRef(opts?.onHands);
  onFrameRef.current = opts?.onFrame;
  onHandsRef.current = opts?.onHands;

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<LandmarkerHandle | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  // per-hand EMA state (keyed by hand index in detection order)
  const emaRefs = useRef<({ x: number; y: number; v: number } | null)[]>([null, null]);
  const prevPosRefs = useRef<({ x: number; y: number; t: number } | null)[]>([null, null]);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hands, setHands] = useState<HandState[]>([]);

  // throttling: only update React state when values change meaningfully
  // (the onFrame/onHands callbacks still fire every frame for smooth canvas drawing)
  const lastStateUpdateRef = useRef(0);
  const lastGestureRef = useRef<string>("");
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const STATE_UPDATE_INTERVAL = 80; // ms — ~12fps for state updates

  const loadLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
    );
    const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    landmarkerRef.current = landmarker as unknown as LandmarkerHandle;
    return landmarkerRef.current;
  }, [numHands]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const detected = result.landmarks || [];
      const handednesses = result.handedness || [];

      const outHands: HandState[] = [];
      const outLms: (Landmark[] | null)[] = [];

      for (let i = 0; i < numHands; i++) {
        const lm = detected[i];
        if (!lm) {
          emaRefs.current[i] = null;
          prevPosRefs.current[i] = null;
          outHands.push({ ...DEFAULT_HAND });
          outLms.push(null);
          continue;
        }
        const px = (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4;
        const py = (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4;
        const mx = 1 - px;
        const my = py;

        const now = performance.now();
        let instVel = 0;

        // Fix: Capture reference inside a stable constant so TypeScript narrows the null check
        const prevPos = prevPosRefs.current[i];
        if (prevPos) {
          const dt = (now - prevPos.t) / 1000;
          if (dt > 0) {
            const dx = mx - prevPos.x;
            const dy = my - prevPos.y;
            instVel = Math.min(1, Math.hypot(dx, dy) / dt / 1.5);
          }
        }
        prevPosRefs.current[i] = { x: mx, y: my, t: now };

        if (!emaRefs.current[i]) {
          emaRefs.current[i] = { x: mx, y: my, v: instVel };
        } else {
          emaRefs.current[i]!.x = smoothing * mx + (1 - smoothing) * emaRefs.current[i]!.x;
          emaRefs.current[i]!.y = smoothing * my + (1 - smoothing) * emaRefs.current[i]!.y;
          emaRefs.current[i]!.v = velSmoothing * instVel + (1 - velSmoothing) * emaRefs.current[i]!.v;
        }

        const mlm = lm.map((p) => ({ ...p, x: 1 - p.x }));
        const gesture = classifyGesture(mlm);

        // handedness: MediaPipe sees the mirrored feed, so invert
        let h: "Left" | "Right" | "Unknown" = "Unknown";
        try {
          const raw = handednesses[i]?.[0]?.categoryName;
          if (raw === "Left") h = "Right";
          else if (raw === "Right") h = "Left";
        } catch { /* ignore */ }

        outHands.push({
          x: emaRefs.current[i]!.x,
          y: emaRefs.current[i]!.y,
          velocity: emaRefs.current[i]!.v,
          gesture,
          present: true,
          handedness: h,
        });
        outLms.push(mlm);
      }

      // throttled state update — only re-render React when gesture changes
      // or position moves >1% or every 80ms, whichever comes first
      const now = performance.now();
      const primary = outHands.find((h) => h.present);
      const gestureChanged = primary && primary.gesture !== lastGestureRef.current;
      const posChanged = primary && (Math.abs(primary.x - lastPosRef.current.x) > 0.01 || Math.abs(primary.y - lastPosRef.current.y) > 0.01);
      const timeUp = now - lastStateUpdateRef.current >= STATE_UPDATE_INTERVAL;
      if (gestureChanged || posChanged || timeUp || !primary) {
        setHands(outHands);
        lastStateUpdateRef.current = now;
        if (primary) {
          lastGestureRef.current = primary.gesture;
          lastPosRef.current = { x: primary.x, y: primary.y };
        }
      }
      onHandsRef.current?.(outHands, outLms);
      // primary hand callback (first present hand, else outHands[0])
      const primaryIdx = outHands.findIndex((h) => h.present);
      const pidx = primaryIdx >= 0 ? primaryIdx : 0;
      onFrameRef.current?.(outHands[pidx], outLms[pidx]);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [smoothing, velSmoothing, numHands]);

  const start = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not access the webcam.");
    } finally {
      setLoading(false);
    }
  }, [loadLandmarker, loop]);

  const stop = useCallback(() => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    emaRefs.current = [null, null];
    prevPosRefs.current = [null, null];
    setHands([]);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // convenience: primary hand (first present, or hands[0])
  const hand: HandState = hands.find((h) => h.present) || hands[0] || DEFAULT_HAND;

  return { videoRef, running, loading, error, hand, hands, start, stop };
}