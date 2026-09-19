"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Hand, MousePointer2,
  Volume2, Volume1, VolumeX, SquareMousePointer, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  MediaPipe types (loaded dynamically in the browser)                */
/* ------------------------------------------------------------------ */
type Landmark = { x: number; y: number; z: number };
type HandResult = {
  landmarks: Landmark[][];
  handedness: { categoryName: string }[][];
};

/* ------------------------------------------------------------------ */
/*  Constants — mirror the Python config so the browser demo matches   */
/* ------------------------------------------------------------------ */
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PINCH_THRESHOLD = 0.4;
const PINCH_RELEASE = 0.55;
const LEFT_TAP_THRESHOLD = 0.22;
const LEFT_TAP_RELEASE = 0.3;
const EMA_ALPHA = 0.35;

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
  const thumb = lateral || upward;
  const index = lm[8].y < lm[6].y;
  const middle = lm[12].y < lm[10].y;
  const ring = lm[16].y < lm[14].y;
  const pinky = lm[20].y < lm[18].y;
  return [thumb, index, middle, ring, pinky];
}

type Gesture = "Idle" | "Move" | "Left Click" | "Right Click" | "Volume";

function interp(v: number, lo: number, hi: number, outLo: number, outHi: number) {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return outLo + t * (outHi - outLo);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function LiveDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => HandResult } | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const leftHeldRef = useRef(false);
  const rightHeldRef = useRef(false);
  const sizeHistRef = useRef<number[]>([]);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture>("Idle");
  const [cursorPct, setCursorPct] = useState<{ x: number; y: number } | null>(null);
  const [leftHeld, setLeftHeld] = useState(false);
  const [volLevel, setVolLevel] = useState(0.5);

  /* -------------------------------------------------------------- */
  /*  Load the MediaPipe HandLandmarker model (lazy, on first run)  */
  /* -------------------------------------------------------------- */
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
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });
    landmarkerRef.current = landmarker as unknown as { detectForVideo: (v: HTMLVideoElement, t: number) => HandResult };
    return landmarkerRef.current;
  }, []);

  /* -------------------------------------------------------------- */
  /*  Detection (pure, uses refs)                                   */
  /* -------------------------------------------------------------- */
  const detectGesture = useCallback((lm: Landmark[]): {
    name: Gesture;
    leftHeld: boolean;
    volDir?: number;
  } => {
    const st = fingerStates(lm);
    const [thumb, index, middle, ring, pinky] = st;
    const ref = refSize(lm);
    const tap = dist(lm[4], lm[5]) / ref;
    const dm = dist(lm[4], lm[12]) / ref;

    if (thumb && index && middle && ring && pinky) {
      sizeHistRef.current.push(ref);
      if (sizeHistRef.current.length > 6) sizeHistRef.current.shift();
      if (sizeHistRef.current.length >= 6) {
        const delta = sizeHistRef.current[sizeHistRef.current.length - 1] - sizeHistRef.current[0];
        if (Math.abs(delta) > 0.015) {
          sizeHistRef.current = [];
          return { name: "Volume", leftHeld: false, volDir: delta > 0 ? 1 : -1 };
        }
      }
      return { name: "Volume", leftHeld: false };
    }
    sizeHistRef.current = [];

    if (index && dm < PINCH_THRESHOLD && dm < tap) {
      if (!rightHeldRef.current) rightHeldRef.current = true;
      if (leftHeldRef.current) leftHeldRef.current = false;
      return { name: "Right Click", leftHeld: false };
    }
    if (rightHeldRef.current && dm > PINCH_RELEASE) rightHeldRef.current = false;

    if (index && !middle && !ring && !pinky) {
      if (tap < LEFT_TAP_THRESHOLD) {
        leftHeldRef.current = true;
        return { name: "Left Click", leftHeld: true };
      }
      if (leftHeldRef.current && tap > LEFT_TAP_RELEASE) {
        leftHeldRef.current = false;
      }
    }

    if (index && !middle && !ring && !pinky) {
      return { name: "Move", leftHeld: leftHeldRef.current };
    }

    return { name: "Idle", leftHeld: leftHeldRef.current };
  }, []);

  /* -------------------------------------------------------------- */
  /*  Draw skeleton on canvas                                       */
  /* -------------------------------------------------------------- */
  const drawSkeleton = useCallback((
    ctx: CanvasRenderingContext2D,
    lm: Landmark[],
    w: number,
    h: number
  ) => {
    ctx.strokeStyle = "rgba(0, 255, 200, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 200, 0, 0.95)";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(0, 255, 140, 1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lm[8].x * w, lm[8].y * h, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lm[5].x * w, lm[5].y * h, 7, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  /* -------------------------------------------------------------- */
  /*  Main loop                                                      */
  /* -------------------------------------------------------------- */
  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const ctx = canvas.getContext("2d")!;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const hands = result.landmarks || [];
      if (hands.length > 0) {
        const lm = hands[0];
        const mlm = lm.map((p) => ({ ...p, x: 1 - p.x }));
        drawSkeleton(ctx, mlm, canvas.width, canvas.height);

        const g = detectGesture(mlm);
        setGesture(g.name);
        setLeftHeld(g.leftHeld);

        if (g.name === "Move" || g.name === "Left Click") {
          const tx = interp(mlm[8].x, 0.3, 0.7, 0, 1);
          const ty = interp(mlm[8].y, 0.3, 0.7, 0, 1);
          if (!cursorRef.current) {
            cursorRef.current = { x: tx, y: ty };
          } else {
            cursorRef.current = {
              x: EMA_ALPHA * tx + (1 - EMA_ALPHA) * cursorRef.current.x,
              y: EMA_ALPHA * ty + (1 - EMA_ALPHA) * cursorRef.current.y,
            };
          }
          setCursorPct({ ...cursorRef.current });
        }

        if (g.name === "Volume" && g.volDir !== undefined && g.volDir !== 0) {
          setVolLevel((v) => Math.max(0, Math.min(1, v + g.volDir! * 0.04)));
        }
      } else {
        setGesture("Idle");
        setLeftHeld(false);
        leftHeldRef.current = false;
        rightHeldRef.current = false;
        sizeHistRef.current = [];
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [detectGesture, drawSkeleton]);

  /* -------------------------------------------------------------- */
  /*  Start / stop                                                   */
  /* -------------------------------------------------------------- */
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
    setGesture("Idle");
    setCursorPct(null);
    setLeftHeld(false);
    leftHeldRef.current = false;
    rightHeldRef.current = false;
    sizeHistRef.current = [];
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

  /* -------------------------------------------------------------- */
  /*  Render                                                         */
  /* -------------------------------------------------------------- */
  return (
    <section id="demo" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Runs entirely in your browser — no install needed
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Try it <span className="text-gradient">right now</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Allow camera access and raise your hand. The same MediaPipe model
            that powers the desktop app runs here, drawing all 21 landmarks and
            detecting gestures in real time.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
          {/* camera / canvas */}
          <div className="relative rounded-2xl overflow-hidden glass-strong aspect-video bg-black">
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 grid-bg">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse-glow" />
                  <Camera className="relative h-16 w-16 text-primary/70" />
                </div>
                <p className="text-muted-foreground text-sm max-w-xs text-center">
                  {loading ? "Loading the hand-tracking model…" : "Click start and allow camera access to begin"}
                </p>
                {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </div>
            )}

            <AnimatePresence>
              {running && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong"
                >
                  <span className={cn("h-2 w-2 rounded-full", gesture === "Idle" ? "bg-muted-foreground" : "bg-primary animate-pulse")} />
                  <span className="text-sm font-medium">{gesture}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="absolute bottom-4 left-4 right-4 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* side panel */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl glass-strong p-4 flex-1 min-h-[200px]">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <MousePointer2 className="h-3.5 w-3.5" /> Virtual cursor (your index finger)
              </p>
              <div className="relative w-full h-[calc(100%-2rem)] rounded-xl bg-black/40 grid-bg overflow-hidden">
                {cursorPct ? (
                  <div className="absolute" style={{ left: `${cursorPct.x * 100}%`, top: `${cursorPct.y * 100}%` }}>
                    <div className={cn("relative -translate-x-1/2 -translate-y-1/2", leftHeld && "scale-90")}>
                      {leftHeld && <div className="absolute inset-0 -m-4 bg-primary/20 rounded-full blur-md" />}
                      <MousePointer2 className={cn("relative h-6 w-6 transition-transform", leftHeld ? "text-primary fill-primary/40" : "text-primary")} />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    Move your index finger to control the cursor
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl glass-strong p-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                {volLevel === 0 ? <VolumeX className="h-3.5 w-3.5" /> : volLevel < 0.5 ? <Volume1 className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                Volume (open palm — push / pull)
              </p>
              <div className="h-3 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-150" style={{ width: `${volLevel * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-right tabular-nums">{Math.round(volLevel * 100)}%</p>
            </div>

            <div className="flex gap-3">
              {!running ? (
                <button onClick={start} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-emerald disabled:opacity-50">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {loading ? "Loading…" : "Start Camera"}
                </button>
              ) : (
                <button onClick={stop} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                  <CameraOff className="h-5 w-5" /> Stop
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass text-muted-foreground">
                <span className="text-primary"><Hand className="h-3.5 w-3.5" /></span> Index → Move
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass text-muted-foreground">
                <span className="text-primary"><SquareMousePointer className="h-3.5 w-3.5" /></span> Thumb→palm → Click
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your camera feed never leaves your device — all processing happens locally in the browser.
        </p>
      </div>
    </section>
  );
}
