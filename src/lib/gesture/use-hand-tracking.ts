"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type Landmark = { x: number; y: number; z: number };

export type GestureType = "open" | "fist" | "pinch" | "point" | "idle";

export type HandState = {
  x: number;          // 0..1, mirrored so it feels natural
  y: number;          // 0..1
  velocity: number;   // 0..1 normalised speed
  gesture: GestureType;
  present: boolean;
};

export type LandmarkerHandle = {
  detectForVideo: (v: HTMLVideoElement, t: number) => {
    landmarks: Landmark[][];
    handedness: { categoryName: string }[][];
  };
};

const DEFAULT_HAND: HandState = {
  x: 0.5, y: 0.5, velocity: 0, gesture: "idle", present: false,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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
  // pinch: thumb tip close to index tip
  const di = dist(lm[4], lm[8]) / ref;
  if (di < 0.4 && !middle && !ring && !pinky && thumb) return "pinch";
  // open hand
  if (thumb && index && middle && ring && pinky) return "open";
  // point: index only
  if (index && !middle && !ring && !pinky) return "point";
  // fist: all folded
  if (!index && !middle && !ring && !pinky) return "fist";
  return "idle";
}

/* ------------------------------------------------------------------ */
/*  Hook                                                                */
/* ------------------------------------------------------------------ */
export function useHandTracking(opts?: {
  smoothing?: number;        // EMA alpha for x,y (default 0.4)
  velSmoothing?: number;     // EMA alpha for velocity (default 0.5)
  onFrame?: (h: HandState, lm: Landmark[] | null) => void;
}) {
  const smoothing = opts?.smoothing ?? 0.4;
  const velSmoothing = opts?.velSmoothing ?? 0.5;
  const onFrameRef = useRef(opts?.onFrame);
  onFrameRef.current = opts?.onFrame;

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<LandmarkerHandle | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const emaRef = useRef<{ x: number; y: number; v: number } | null>(null);
  const prevPosRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hand, setHand] = useState<HandState>(DEFAULT_HAND);

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
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    landmarkerRef.current = landmarker as unknown as LandmarkerHandle;
    return landmarkerRef.current;
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const hands = result.landmarks || [];

      if (hands.length > 0) {
        const lm = hands[0];
        // use palm center (avg of MCPs) for stable position
        const px = (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4;
        const py = (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4;
        // mirror x for natural feel
        const mx = 1 - px;
        const my = py;

        // velocity (normalised per second)
        const now = performance.now();
        let instVel = 0;
        if (prevPosRef.current) {
          const dt = (now - prevPosRef.current.t) / 1000;
          if (dt > 0) {
            const dx = mx - prevPosRef.current.x;
            const dy = my - prevPosRef.current.y;
            instVel = Math.min(1, Math.hypot(dx, dy) / dt / 1.5);
          }
        }
        prevPosRef.current = { x: mx, y: my, t: now };

        // EMA smoothing
        if (!emaRef.current) {
          emaRef.current = { x: mx, y: my, v: instVel };
        } else {
          emaRef.current.x = smoothing * mx + (1 - smoothing) * emaRef.current.x;
          emaRef.current.y = smoothing * my + (1 - smoothing) * emaRef.current.y;
          emaRef.current.v = velSmoothing * instVel + (1 - velSmoothing) * emaRef.current.v;
        }

        // gesture is computed on the mirrored landmarks for consistency
        const mlm = lm.map((p) => ({ ...p, x: 1 - p.x }));
        const gesture = classifyGesture(mlm);

        const hs: HandState = {
          x: emaRef.current.x,
          y: emaRef.current.y,
          velocity: emaRef.current.v,
          gesture,
          present: true,
        };
        setHand(hs);
        onFrameRef.current?.(hs, mlm);
      } else {
        prevPosRef.current = null;
        emaRef.current = null;
        const hs: HandState = { ...DEFAULT_HAND };
        setHand(hs);
        onFrameRef.current?.(hs, null);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [smoothing, velSmoothing]);

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
    emaRef.current = null;
    prevPosRef.current = null;
    setHand(DEFAULT_HAND);
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

  return { videoRef, running, loading, error, hand, start, stop };
}
