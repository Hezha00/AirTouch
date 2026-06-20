"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, ChevronLeft, ChevronRight,
  Hand, Monitor, Maximize, Minimize, Sparkles, Presentation,
  Circle, Square,
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

// a sample slide deck (gesture-control themed)
const SLIDES = [
  {
    title: "Gesture Control",
    subtitle: "The future of human-computer interaction",
    body: "Use your hands to navigate this presentation. No clicker, no keyboard — just gestures.",
    bg: "from-emerald-500/20 via-transparent to-cyan-500/20",
    accent: "text-primary",
  },
  {
    title: "How it works",
    subtitle: "MediaPipe + your webcam",
    body: "21 hand landmarks are tracked in real time at 30+ FPS, entirely in your browser. No data leaves your device.",
    bg: "from-cyan-500/20 via-transparent to-blue-500/20",
    accent: "text-chart-2",
  },
  {
    title: "Pinch → Next",
    subtitle: "A natural advance gesture",
    body: "Pinch your thumb and index finger together to advance to the next slide. Quick and precise.",
    bg: "from-fuchsia-500/20 via-transparent to-purple-500/20",
    accent: "text-chart-4",
  },
  {
    title: "Fist → Previous",
    subtitle: "Go back anytime",
    body: "Make a fist to return to the previous slide. No need to hunt for the arrow key.",
    bg: "from-orange-500/20 via-transparent to-red-500/20",
    accent: "text-chart-3",
  },
  {
    title: "Open Palm → Pointer",
    subtitle: "Highlight what matters",
    body: "Open your hand to summon a glowing pointer that follows your palm. Point at charts, diagrams, or code.",
    bg: "from-amber-500/20 via-transparent to-yellow-500/20",
    accent: "text-chart-5",
  },
  {
    title: "Point → Laser",
    subtitle: "A focused beam",
    body: "Point with your index finger to draw a precise laser dot on the slide. Perfect for emphasis.",
    bg: "from-emerald-500/20 via-transparent to-teal-500/20",
    accent: "text-primary",
  },
  {
    title: "That's it",
    subtitle: "Conduct your next talk with your hands",
    body: "Exit this tool with the Hub button, or go full-screen first for the real presentation experience.",
    bg: "from-primary/20 via-transparent to-chart-2/20",
    accent: "text-primary",
  },
];

function fingerStates(lm: Landmark[]): boolean[] {
  const palmCx = (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4;
  const palmCy = (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4;
  const tipFrom = Math.abs(lm[4].x - palmCx) + Math.abs(lm[4].y - palmCy);
  const ipFrom = Math.abs(lm[3].x - palmCx) + Math.abs(lm[3].y - palmCy);
  const lateral = tipFrom > ipFrom * 1.1;
  const upward = lm[4].y < lm[3].y - 0.03;
  return [lateral || upward, lm[8].y < lm[6].y, lm[12].y < lm[10].y, lm[16].y < lm[14].y, lm[20].y < lm[18].y];
}

function isPinch(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / ref < 0.4;
}
function isOpen(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  return fingerStates(lm).every(Boolean);
}
function isFist(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  return fingerStates(lm).slice(1).every((x) => !x);
}
function isPoint(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const st = fingerStates(lm);
  return st[1] && !st[2] && !st[3] && !st[4];
}

export function PresenterView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const prevGestureRef = useRef<string>("idle");

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [gesture, setGesture] = useState("idle");
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [pointerMode, setPointerMode] = useState<"off" | "pointer" | "laser">("off");
  const [fullscreen, setFullscreen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const slideIdxRef = useRef(0);
  slideIdxRef.current = slideIdx;

  const onFrame = useCallback((h: HandState, lm: Landmark[] | null) => {
    // draw skeleton
    const oc = overlayRef.current;
    const video = videoRef.current;
    if (oc && video) {
      const ctx = oc.getContext("2d")!;
      oc.width = video.videoWidth || 640;
      oc.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, oc.width, oc.height);
      if (lm) {
        const w = oc.width, hh = oc.height;
        ctx.strokeStyle = "rgba(0,255,200,0.7)";
        ctx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lm[a].x * w, lm[a].y * hh);
          ctx.lineTo(lm[b].x * w, lm[b].y * hh);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,210,80,0.9)";
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * hh, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const stage = stageRef.current;
    if (!stage) return;

    if (h.present && lm) {
      // map hand to stage rect
      const rect = stage.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (h.x - 0.15) / 0.7));
      const py = Math.max(0, Math.min(1, (h.y - 0.15) / 0.7));
      const sx = rect.left + px * rect.width;
      const sy = rect.top + py * rect.height;

      const pinch = isPinch(lm);
      const open = isOpen(lm);
      const fist = isFist(lm);
      const point = isPoint(lm);

      // gesture detection
      let g = "idle";
      if (pinch) g = "pinch";
      else if (fist) g = "fist";
      else if (open) g = "open";
      else if (point) g = "point";
      setGesture(g);

      // pointer / laser
      if (open) {
        setPointerMode("pointer");
        setPointer({ x: sx - rect.left, y: sy - rect.top });
        setLaser(null);
      } else if (point) {
        setPointerMode("laser");
        setLaser({ x: sx - rect.left, y: sy - rect.top });
        setPointer(null);
      } else {
        setPointerMode("off");
        setPointer(null);
        setLaser(null);
      }

      // gesture edges (navigate on transition INTO pinch/fist)
      const prev = prevGestureRef.current;
      if (g !== prev) {
        if (g === "pinch" && prev !== "pinch") {
          setDirection(1);
          setSlideIdx((i) => Math.min(SLIDES.length - 1, i + 1));
        }
        if (g === "fist" && prev !== "fist") {
          setDirection(-1);
          setSlideIdx((i) => Math.max(0, i - 1));
        }
        prevGestureRef.current = g;
      }

      // floating cursor (laser/pointer indicator)
      const cur = cursorRef.current;
      if (cur) {
        cur.style.left = `${sx}px`;
        cur.style.top = `${sy}px`;
        cur.style.opacity = "1";
        cur.style.borderColor = point ? "#ff3366" : open ? "#00ff8c" : "rgba(255,255,255,0.4)";
      }
    } else {
      setGesture("idle");
      setPointerMode("off");
      setPointer(null);
      setLaser(null);
      const cur = cursorRef.current;
      if (cur) cur.style.opacity = "0";
      prevGestureRef.current = "idle";
    }
  }, []);

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
  const stop = () => { tracking.stop(); setRunning(false); setGesture("idle"); setPointer(null); setLaser(null); };

  useEffect(() => {
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  const toggleFullscreen = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!document.fullscreenElement) {
      await stage.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  const slide = SLIDES[slideIdx];

  return (
    <div className="relative min-h-screen pt-16 sm:pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Air <span className="text-gradient">Presenter</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Present slides with your hands. Pinch to advance, fist to go back, open palm for a pointer, point for a laser.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFullscreen} className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              {fullscreen ? "Exit" : "Full-screen"}
            </button>
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

        <div className="grid lg:grid-cols-[1fr_260px] gap-4">
          {/* ---- stage ---- */}
          <div className="flex flex-col gap-3">
            <div
              ref={stageRef}
              className={cn(
                "relative rounded-2xl overflow-hidden glass-strong bg-black flex items-center justify-center",
                fullscreen ? "h-screen rounded-none" : "aspect-video"
              )}
            >
              {/* camera thumbnail (top-right when running) */}
              {running && (
                <div className="absolute top-3 right-3 z-20 w-40 sm:w-48 aspect-video rounded-lg overflow-hidden glass-strong border border-white/10">
                  <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
                  <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60">
                    <span className={cn("h-1.5 w-1.5 rounded-full", gesture !== "idle" ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                    <span className="text-[10px] font-medium capitalize">{gesture}</span>
                  </div>
                </div>
              )}

              {/* slide */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={slideIdx}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={cn("absolute inset-0 bg-gradient-to-br flex flex-col items-center justify-center text-center p-8 sm:p-16", slide.bg)}
                >
                  <div className="relative z-10 max-w-2xl">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cn("text-xs font-mono uppercase tracking-widest mb-3", slide.accent)}>
                      Slide {slideIdx + 1} / {SLIDES.length}
                    </motion.div>
                    <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-4xl sm:text-6xl font-bold tracking-tight mb-3">
                      {slide.title}
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className={cn("text-lg sm:text-xl font-medium mb-6", slide.accent)}>
                      {slide.subtitle}
                    </motion.p>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
                      {slide.body}
                    </motion.p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* pointer (open palm) — glowing circle */}
              {pointer && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute pointer-events-none z-10"
                  style={{ left: pointer.x, top: pointer.y }}
                >
                  <div className="relative -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute inset-0 -m-6 rounded-full bg-primary/30 blur-xl" />
                    <div className="relative h-6 w-6 rounded-full border-2 border-primary bg-primary/20" />
                  </div>
                </motion.div>
              )}

              {/* laser (point) — precise dot */}
              {laser && (
                <div className="absolute pointer-events-none z-10" style={{ left: laser.x, top: laser.y }}>
                  <div className="relative -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute inset-0 -m-3 rounded-full bg-red-500/40 blur-md" />
                    <div className="relative h-3 w-3 rounded-full bg-red-500" />
                  </div>
                </div>
              )}

              {/* slide nav arrows (clickable fallback) */}
              <button
                onClick={() => { setDirection(-1); setSlideIdx((i) => Math.max(0, i - 1)); }}
                disabled={slideIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-lg glass-strong disabled:opacity-30 hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => { setDirection(1); setSlideIdx((i) => Math.min(SLIDES.length - 1, i + 1)); }}
                disabled={slideIdx === SLIDES.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-lg glass-strong disabled:opacity-30 hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* progress dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setDirection(i > slideIdx ? 1 : -1); setSlideIdx(i); }}
                    className={cn("h-1.5 rounded-full transition-all", i === slideIdx ? "w-6 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/50")}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>

              {!running && (
                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/40">
                  <div className="text-center">
                    <Presentation className="h-12 w-12 text-primary/60 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Click Start to begin presenting with gestures</p>
                  </div>
                </div>
              )}

              {error && <div className="absolute bottom-3 left-3 right-3 z-30 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">{error}</div>}
            </div>

            {/* slide thumbnails */}
            <div className="rounded-xl glass-strong p-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
              {SLIDES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > slideIdx ? 1 : -1); setSlideIdx(i); }}
                  className={cn(
                    "flex-shrink-0 w-24 h-14 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all",
                    i === slideIdx ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/[0.02] text-muted-foreground hover:text-foreground"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* ---- sidebar ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {/* gesture map */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Hand className="h-3.5 w-3.5" /> Gestures
              </div>
              <div className="space-y-2">
                {[
                  { icon: "🤏", g: "Pinch", a: "Next slide", active: gesture === "pinch" },
                  { icon: "✊", g: "Fist", a: "Previous slide", active: gesture === "fist" },
                  { icon: "🖐", g: "Open palm", a: "Pointer", active: gesture === "open" },
                  { icon: "☝️", g: "Point", a: "Laser", active: gesture === "point" },
                ].map((m) => (
                  <div key={m.g} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors", m.active ? "bg-primary/15" : "bg-white/[0.02]")}>
                    <span className="text-lg">{m.icon}</span>
                    <div className="flex-1">
                      <div className={cn("text-xs font-medium", m.active ? "text-primary" : "text-foreground")}>{m.g}</div>
                      <div className="text-[10px] text-muted-foreground">{m.a}</div>
                    </div>
                    {m.active && <Circle className="h-2 w-2 fill-primary text-primary animate-pulse" />}
                  </div>
                ))}
              </div>
            </div>

            {/* pointer mode indicator */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pointer</div>
              <div className={cn("text-sm font-bold", pointerMode === "off" ? "text-muted-foreground" : pointerMode === "laser" ? "text-red-500" : "text-primary")}>
                {pointerMode === "off" ? "Off" : pointerMode === "laser" ? "Laser ●" : "Pointer ◉"}
              </div>
            </div>

            {/* slide counter */}
            <div className="rounded-xl glass-strong p-4 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums">{slideIdx + 1}<span className="text-sm text-muted-foreground">/{SLIDES.length}</span></div>
              <div className="text-xs text-muted-foreground">slide</div>
            </div>

            {/* tips */}
            <div className="rounded-xl glass p-3 text-xs space-y-1.5 col-span-2 lg:col-span-1">
              <p className="font-medium flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> Tips</p>
              <div className="text-muted-foreground space-y-0.5">
                <p>• Go full-screen for the real experience</p>
                <p>• Use arrows or thumbnails as a fallback</p>
                <p>• Hold open palm to keep the pointer</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Monitor className="inline h-3 w-3 text-primary mr-1" />
          A kiosk-mode presentation tool for lecturers — no clicker hardware needed.
        </p>
      </div>

      {/* floating cursor */}
      <div ref={cursorRef} className="fixed pointer-events-none z-40 opacity-0 transition-opacity" style={{ left: 0, top: 0 }}>
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full border-2" />
        </div>
      </div>
    </div>
  );
}
