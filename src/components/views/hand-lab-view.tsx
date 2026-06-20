"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Hand, Activity, Maximize2, RotateCw,
  Fingerprint, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHandTracking, type HandState, type Landmark } from "@/lib/gesture/use-hand-tracking";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const LM_NAMES = [
  "Wrist", "Thumb CMC", "Thumb MCP", "Thumb IP", "Thumb tip",
  "Index MCP", "Index PIP", "Index DIP", "Index tip",
  "Middle MCP", "Middle PIP", "Middle DIP", "Middle tip",
  "Ring MCP", "Ring PIP", "Ring DIP", "Ring tip",
  "Pinky MCP", "Pinky PIP", "Pinky DIP", "Pinky tip",
];

const FINGER_NAMES = ["Thumb", "Index", "Middle", "Ring", "Pinky"];

function fingerAngles(lm: Landmark[]): number[] {
  // approximate extension angle per finger (0=closed, 1=fully extended)
  // using y-distance of tip vs PIP relative to hand size
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  const tips = [4, 8, 12, 16, 20];
  const pips = [3, 6, 10, 14, 18];
  const mcps = [2, 5, 9, 13, 17];
  return tips.map((t, i) => {
    const tipDist = Math.hypot(lm[t].x - lm[mcps[i]].x, lm[t].y - lm[mcps[i]].y) / ref;
    const pipDist = Math.hypot(lm[pips[i]].x - lm[mcps[i]].x, lm[pips[i]].y - lm[mcps[i]].y) / ref;
    return Math.max(0, Math.min(1, (tipDist - 0.15) / 0.5));
  });
}

export function HandLabView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const fpsRef = useRef({ last: performance.now(), frames: 0, fps: 0 });

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState("idle");
  const [angles, setAngles] = useState<number[]>([0, 0, 0, 0, 0]);
  const [palmSize, setPalmSize] = useState(0);
  const [fps, setFps] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [present, setPresent] = useState(false);

  const onFrame = useCallback((h: HandState, lm: Landmark[] | null) => {
    // FPS
    const fr = fpsRef.current;
    fr.frames++;
    const now = performance.now();
    if (now - fr.last >= 500) {
      fr.fps = Math.round((fr.frames * 1000) / (now - fr.last));
      fr.last = now;
      fr.frames = 0;
      setFps(fr.fps);
    }

    setGesture(h.gesture);
    setPresent(h.present);

    // draw 2D skeleton on the camera canvas
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lm) {
        const w = canvas.width, hh = canvas.height;
        // connections with depth-based color
        for (const [a, b] of HAND_CONNECTIONS) {
          const za = lm[a].z;
          const zb = lm[b].z;
          const avgZ = (za + zb) / 2;
          const alpha = 0.4 + Math.max(0, Math.min(0.6, -avgZ * 5));
          ctx.strokeStyle = `rgba(0,255,200,${alpha})`;
          ctx.lineWidth = 2 + Math.max(0, -avgZ * 8);
          ctx.beginPath();
          ctx.moveTo(lm[a].x * w, lm[a].y * hh);
          ctx.lineTo(lm[b].x * w, lm[b].y * hh);
          ctx.stroke();
        }
        // joints with depth-based size
        for (let i = 0; i < lm.length; i++) {
          const p = lm[i];
          const r = 3 + Math.max(0, -p.z * 12);
          ctx.fillStyle = i === 0 ? "#ff3366" : (i === 8 ? "#00ff8c" : "#ffaa00");
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * hh, r, 0, Math.PI * 2);
          ctx.fill();
          // label on tips
          if (i === 4 || i === 8 || i === 12 || i === 16 || i === 20) {
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.font = "10px monospace";
            ctx.fillText(LM_NAMES[i], p.x * w + 8, p.y * hh + 4);
          }
        }
      }
    }

    // draw 3D-ish projection on the second canvas
    const three = threeRef.current;
    if (three && lm) {
      const ctx = three.getContext("2d")!;
      const w = three.width, hh = three.height;
      ctx.clearRect(0, 0, w, hh);
      // background grid
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(0, (i / 8) * hh); ctx.lineTo(w, (i / 8) * hh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo((i / 8) * w, 0); ctx.lineTo((i / 8) * w, hh); ctx.stroke();
      }
      if (autoRotate) rotRef.current += 0.015;
      const rot = rotRef.current;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const cx = w / 2, cy = hh / 2;
      const scale = Math.min(w, hh) * 0.8;
      // project each point with a fake 3D rotation around Y axis using z
      const proj = lm.map((p) => {
        // center + normalise
        const x = (p.x - 0.5);
        const y = (p.y - 0.5);
        const z = p.z * 2; // exaggerate depth
        // rotate around Y
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;
        return {
          sx: cx + rx * scale,
          sy: cy + y * scale,
          depth: rz,
        };
      });
      // connections
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = proj[a], pb = proj[b];
        const avgD = (pa.depth + pb.depth) / 2;
        const alpha = 0.3 + Math.max(0, Math.min(0.7, avgD + 0.5));
        ctx.strokeStyle = `rgba(0,255,200,${alpha})`;
        ctx.lineWidth = 1 + Math.max(0, avgD + 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
      // points
      for (let i = 0; i < proj.length; i++) {
        const p = proj[i];
        const r = 2 + Math.max(0, p.depth + 0.5) * 6;
        ctx.fillStyle = i === 0 ? "#ff3366" : (i === 8 ? "#00ff8c" : "#ffaa00");
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (lm) {
      const a = fingerAngles(lm);
      setAngles(a);
      setPalmSize(Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y));
    }
  }, [autoRotate]);

  const tracking = useHandTracking({ onFrame, smoothing: 0.5 });
  useEffect(() => { videoRef.current = tracking.videoRef.current; });

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      await tracking.start();
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera error");
    } finally {
      setLoading(false);
    }
  };
  const stop = () => { tracking.stop(); setRunning(false); setGesture("idle"); setPresent(false); };

  // size the 3D canvas
  useEffect(() => {
    const three = threeRef.current;
    if (three) { three.width = three.clientWidth; three.height = three.clientHeight; }
  }, [running]);

  return (
    <div className="relative min-h-screen pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Hand <span className="text-gradient">Lab</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              A real-time visualizer of all 21 MediaPipe hand landmarks, with depth-aware skeleton, a 3D rotation view, and per-finger extension angles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!running ? (
              <button onClick={start} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-emerald disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {loading ? "Loading…" : "Start"}
              </button>
            ) : (
              <button onClick={stop} className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                <CameraOff className="h-4 w-4" /> Stop
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* ---- 2D camera view ---- */}
          <div className="flex flex-col gap-3">
            <div className="relative rounded-2xl overflow-hidden glass-strong aspect-video bg-black">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center grid-bg">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse-glow" />
                    <Hand className="relative h-12 w-12 text-primary/60" />
                  </div>
                </div>
              )}
              {running && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong">
                  <Fingerprint className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">21-point · depth-shaded</span>
                </div>
              )}
              {error && <div className="absolute bottom-3 left-3 right-3 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">{error}</div>}
            </div>

            {/* landmark list */}
            <div className="rounded-xl glass-strong p-4 max-h-44 overflow-y-auto scrollbar-thin">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Fingerprint className="h-3.5 w-3.5" /> Landmarks
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono">
                {LM_NAMES.map((n, i) => (
                  <div key={i} className={cn("flex justify-between", present ? "text-muted-foreground" : "text-muted-foreground/40")}>
                    <span>{i.toString().padStart(2, "0")} {n}</span>
                    <span className="text-primary/60">●</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---- 3D view + metrics ---- */}
          <div className="flex flex-col gap-3">
            <div className="relative rounded-2xl overflow-hidden glass-strong aspect-video bg-[#060608]">
              <canvas ref={threeRef} className="absolute inset-0 w-full h-full" />
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong">
                <Maximize2 className="h-3.5 w-3.5 text-chart-2" />
                <span className="text-xs font-medium">3D projection</span>
              </div>
              <button
                onClick={() => setAutoRotate((r) => !r)}
                className={cn("absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-xs font-medium transition-colors", autoRotate ? "text-primary" : "text-muted-foreground")}
              >
                <RotateCw className={cn("h-3.5 w-3.5", autoRotate && "animate-spin")} style={{ animationDuration: "3s" }} />
                {autoRotate ? "Rotating" : "Paused"}
              </button>
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Maximize2 className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* finger extension bars */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Finger extension
              </div>
              <div className="space-y-2.5">
                {FINGER_NAMES.map((name, i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs w-14 text-muted-foreground">{name}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-black/40 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: i === 0 ? "#ff3366" : i === 1 ? "#00ff8c" : i === 2 ? "#00d4ff" : i === 3 ? "#ffaa00" : "#aa66ff" }}
                        animate={{ width: `${angles[i] * 100}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right tabular-nums text-muted-foreground">{Math.round(angles[i] * 100)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Zap} label="FPS" value={fps.toString()} color="text-primary" />
              <StatCard icon={Hand} label="Gesture" value={gesture} color="text-chart-2" />
              <StatCard icon={Activity} label="Palm size" value={palmSize.toFixed(3)} color="text-chart-3" />
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          The Hand Lab is an educational + developer tool — inspect exactly what MediaPipe sees, with depth shading on the 2D view and a rotating 3D projection.
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Zap; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl glass p-3 text-center">
      <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />
      <div className={cn("text-base font-bold tabular-nums truncate", color)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
