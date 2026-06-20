"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Brush, Eraser, Trash2, Download,
  Undo2, Hand, Palette, Minus, Plus, Sparkles,
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

const COLORS = [
  "#00ff8c", "#00d4ff", "#ffaa00", "#ff00aa",
  "#ff3366", "#aa66ff", "#ffffff", "#ffeb3b",
];

// detect "pinch" (index + thumb tips close) for lift/lower of brush
function isPinch(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / ref < 0.4;
}

function isOpenPalm(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const ext = [4, 8, 12, 16, 20].map((i) => lm[i].y < lm[i - 2].y);
  return ext.every(Boolean);
}

function isFist(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const fold = [8, 12, 16, 20].map((i) => lm[i].y > lm[i - 2].y);
  return fold.every(Boolean);
}

type Stroke = { color: string; size: number; points: { x: number; y: number }[]; erase: boolean };

export function AirCanvasView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const prevFistRef = useRef(false);
  const colorRef = useRef("#00ff8c");
  const sizeRef = useRef(6);
  const eraserRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState("idle");
  const [color, setColor] = useState("#00ff8c");
  const [size, setSize] = useState(6);
  const [eraser, setEraser] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);

  /* redraw all strokes onto the draw canvas */
  const redraw = useCallback(() => {
    const dc = drawRef.current;
    if (!dc) return;
    const ctx = dc.getContext("2d")!;
    ctx.clearRect(0, 0, dc.width, dc.height);
    for (const s of strokesRef.current) {
      if (s.points.length < 1) continue;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (s.erase) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      }
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const onFrame = useCallback((h: HandState, lm: Landmark[] | null) => {
    // draw hand skeleton on the overlay
    const oc = overlayRef.current;
    const video = videoRef.current;
    if (oc && video) {
      const ctx = oc.getContext("2d")!;
      oc.width = video.videoWidth || 640;
      oc.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, oc.width, oc.height);
      if (lm) {
        const w = oc.width, hh = oc.height;
        ctx.strokeStyle = "rgba(0,255,200,0.6)";
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
          ctx.arc(p.x * w, p.y * hh, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // virtual cursor + drawing on the big canvas
    const cont = containerRef.current;
    const cur = cursorRef.current;
    const dc = drawRef.current;
    if (!cont || !cur || !dc) return;

    if (h.present && lm) {
      // map hand to container rect (centre box)
      const rect = cont.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (h.x - 0.15) / 0.7));
      const py = Math.max(0, Math.min(1, (h.y - 0.15) / 0.7));
      const cx = rect.left + px * rect.width;
      const cy = rect.top + py * rect.height;
      cur.style.left = `${cx}px`;
      cur.style.top = `${cy}px`;
      cur.style.opacity = "1";

      const pinch = isPinch(lm);
      const open = isOpenPalm(lm);
      const fist = isFist(lm);

      // gesture state
      if (fist) {
        setGesture("fist (clear)");
        if (!prevFistRef.current) {
          // clear canvas on fist
          strokesRef.current = [];
          currentStrokeRef.current = null;
          lastPtRef.current = null;
          setDrawing(false);
          setStrokeCount(0);
          redraw();
        }
        prevFistRef.current = true;
      } else {
        prevFistRef.current = false;
        if (open) {
          setGesture("open (eraser)");
          setEraser(true);
          eraserRef.current = true;
          // start an erase stroke if not already
          if (!currentStrokeRef.current || !currentStrokeRef.current.erase) {
            currentStrokeRef.current = { color: "#000", size: sizeRef.current * 3, points: [], erase: true };
            strokesRef.current.push(currentStrokeRef.current);
            lastPtRef.current = null;
            setDrawing(true);
          }
        } else if (pinch) {
          setGesture("pinch (lift)");
          // end current stroke
          if (currentStrokeRef.current) {
            currentStrokeRef.current = null;
            lastPtRef.current = null;
            setDrawing(false);
          }
        } else {
          setGesture("point (paint)");
          setEraser(false);
          eraserRef.current = false;
          // start a paint stroke if not already
          if (!currentStrokeRef.current || currentStrokeRef.current.erase) {
            currentStrokeRef.current = { color: colorRef.current, size: sizeRef.current, points: [], erase: false };
            strokesRef.current.push(currentStrokeRef.current);
            lastPtRef.current = null;
            setDrawing(true);
          }
        }

        // add point to current stroke
        if (currentStrokeRef.current) {
          const drect = dc.getBoundingClientRect();
          const lx = cx - drect.left;
          const ly = cy - drect.top;
          // constrain to canvas
          if (lx >= 0 && lx <= drect.width && ly >= 0 && ly <= drect.height) {
            if (lastPtRef.current) {
              currentStrokeRef.current.points.push({ x: lx, y: ly });
              // draw incrementally
              const ctx = dc.getContext("2d")!;
              ctx.lineJoin = "round";
              ctx.lineCap = "round";
              if (currentStrokeRef.current.erase) {
                ctx.globalCompositeOperation = "destination-out";
                ctx.strokeStyle = "rgba(0,0,0,1)";
              } else {
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = currentStrokeRef.current.color;
              }
              ctx.lineWidth = currentStrokeRef.current.size;
              ctx.beginPath();
              ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
              ctx.lineTo(lx, ly);
              ctx.stroke();
              ctx.globalCompositeOperation = "source-over";
            }
            lastPtRef.current = { x: lx, y: ly };
          }
        }
      }

      // cursor color reflects mode
      cur.style.borderColor = eraserRef.current ? "#ff3366" : colorRef.current;
    } else {
      if (cur) cur.style.opacity = "0";
      setGesture("idle");
      if (currentStrokeRef.current) {
        currentStrokeRef.current = null;
        lastPtRef.current = null;
        setDrawing(false);
      }
    }
  }, [redraw]);

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
  const stop = () => { tracking.stop(); setRunning(false); setGesture("idle"); };

  // size the draw canvas to its container
  useEffect(() => {
    const dc = drawRef.current;
    if (dc) {
      dc.width = dc.clientWidth;
      dc.height = dc.clientHeight;
    }
  }, [running]);

  const undo = () => {
    if (strokesRef.current.length > 0) {
      strokesRef.current.pop();
      currentStrokeRef.current = null;
      lastPtRef.current = null;
      setStrokeCount(strokesRef.current.length);
      redraw();
    }
  };
  const clearAll = () => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    lastPtRef.current = null;
    setStrokeCount(0);
    redraw();
  };
  const download = () => {
    const dc = drawRef.current;
    if (!dc) return;
    // composite on a dark background for export
    const tmp = document.createElement("canvas");
    tmp.width = dc.width; tmp.height = dc.height;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = "#0a0a0f";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(dc, 0, 0);
    const a = document.createElement("a");
    a.href = tmp.toDataURL("image/png");
    a.download = "airtouch-canvas.png";
    a.click();
  };

  // keep strokeCount synced
  useEffect(() => { setStrokeCount(strokesRef.current.length); });

  return (
    <div className="relative min-h-screen pt-16 sm:pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Air <span className="text-gradient">Canvas</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Paint in the air with your index finger. Pinch to lift the brush, open your hand to erase, make a fist to clear.
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

        <div className="grid lg:grid-cols-[1fr_240px] gap-4">
          {/* ---- main canvas area ---- */}
          <div className="flex flex-col gap-3">
            {/* camera thumbnail + gesture badge */}
            <div className="relative rounded-xl overflow-hidden glass-strong aspect-video bg-black h-44 sm:h-52">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center grid-bg">
                  <Camera className="h-10 w-10 text-primary/50" />
                </div>
              )}
              {running && (
                <div className="absolute top-2 left-2 flex items-center gap-2 px-2.5 py-1 rounded-lg glass-strong">
                  <span className={cn("h-1.5 w-1.5 rounded-full", drawing ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                  <span className="text-xs font-medium">{gesture}</span>
                </div>
              )}
              {error && <div className="absolute bottom-2 left-2 right-2 px-3 py-2 rounded-lg bg-destructive/20 border border-destructive/40 text-xs text-destructive">{error}</div>}
            </div>

            {/* the big drawing canvas */}
            <div ref={containerRef} className="relative rounded-2xl overflow-hidden glass-strong bg-[#0a0a0f] grid-bg" style={{ minHeight: "calc(100vh - 440px)" }}>
              <canvas ref={drawRef} className="absolute inset-0 w-full h-full" />
              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse-glow" />
                    <Palette className="relative h-12 w-12 text-primary/60" />
                  </div>
                  <p className="text-muted-foreground text-sm">Start the camera to begin painting in the air</p>
                </div>
              )}
              {/* drawing indicator */}
              <AnimatePresence>
                {drawing && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-strong">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs">{eraser ? "Erasing" : "Painting"}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ---- tools sidebar ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {/* colors */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Color
              </div>
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); colorRef.current = c; setEraser(false); eraserRef.current = false; }}
                    className={cn("aspect-square rounded-lg border-2 transition-all", color === c && !eraser ? "scale-110 border-white" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg border border-white/20" style={{ backgroundColor: color }} />
                <span className="text-xs font-mono text-muted-foreground">{color}</span>
              </div>
            </div>

            {/* brush size */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Brush className="h-3.5 w-3.5" /> Brush size
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setSize((s) => Math.max(2, s - 2)); sizeRef.current = Math.max(2, size - 2); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1 flex items-center justify-center">
                  <div className="rounded-full bg-primary transition-all" style={{ width: size, height: size }} />
                </div>
                <button onClick={() => { setSize((s) => Math.min(40, s + 2)); sizeRef.current = Math.min(40, size + 2); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-center text-xs text-muted-foreground mt-1 tabular-nums">{size}px</div>
            </div>

            {/* mode */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Mode</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setEraser(false); eraserRef.current = false; }} className={cn("flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-colors", !eraser ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}>
                  <Brush className="h-4 w-4" /> Paint
                </button>
                <button onClick={() => { setEraser(true); eraserRef.current = true; }} className={cn("flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-colors", eraser ? "bg-chart-5 text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}>
                  <Eraser className="h-4 w-4" /> Erase
                </button>
              </div>
            </div>

            {/* actions */}
            <div className="rounded-xl glass-strong p-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Actions</div>
              <button onClick={undo} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors">
                <Undo2 className="h-4 w-4" /> Undo
              </button>
              <button onClick={clearAll} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm hover:bg-destructive/30 transition-colors">
                <Trash2 className="h-4 w-4" /> Clear
              </button>
              <button onClick={download} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm hover:bg-primary/25 transition-colors">
                <Download className="h-4 w-4" /> Save PNG
              </button>
            </div>

            {/* gesture guide */}
            <div className="rounded-xl glass p-3 text-xs space-y-1.5">
              <p className="font-medium flex items-center gap-1.5 text-muted-foreground"><Hand className="h-3.5 w-3.5 text-primary" /> Gestures</p>
              <div className="text-muted-foreground space-y-0.5">
                <p>☝️ Point → Paint</p>
                <p>🤏 Pinch → Lift brush</p>
                <p>🖐 Open → Erase</p>
                <p>✊ Fist → Clear all</p>
              </div>
            </div>

            {/* stats */}
            <div className="rounded-xl glass p-3 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums">{strokeCount}</div>
              <div className="text-xs text-muted-foreground">strokes</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Sparkles className="inline h-3 w-3 text-primary mr-1" />
          Everything runs locally — your camera feed and artwork never leave your device.
        </p>
      </div>

      {/* the floating cursor */}
      <div ref={cursorRef} className="fixed pointer-events-none z-40 opacity-0 transition-opacity" style={{ left: 0, top: 0 }}>
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 -m-2 rounded-full blur-md" style={{ backgroundColor: (eraser ? "#ff3366" : color) + "60" }} />
          <div className="relative h-6 w-6 rounded-full border-2" style={{ borderColor: eraser ? "#ff3366" : color, backgroundColor: (eraser ? "#ff3366" : color) + "30" }} />
        </div>
      </div>
    </div>
  );
}
