"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, MousePointer2, Hand,
  Square, Circle, Triangle, Trash2, Sparkles,
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

// left-click via thumb tip -> index MCP (same as the Python app)
function leftClickSignal(lm: Landmark[] | null): { active: boolean; ratio: number } {
  if (!lm) return { active: false, ratio: 1 };
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  const d = Math.hypot(lm[4].x - lm[5].x, lm[4].y - lm[5].y) / ref;
  return { active: d < 0.22, ratio: d };
}

export function CursorControlView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playgroundRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const leftHeldRef = useRef(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastDrawPtRef = useRef<{ x: number; y: number } | null>(null);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState("idle");
  const [leftHeld, setLeftHeld] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [switchOn, setSwitchOn] = useState(false);
  const [cardPos, setCardPos] = useState({ x: 50, y: 50 });
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"brush" | "circle" | "square">("brush");
  const [color, setColor] = useState("#00ff8c");

  // attach the hand-tracking hook with a frame callback
  const onFrame = useCallback((h: HandState, lm: Landmark[] | null) => {
    setGesture(h.gesture);
    // draw skeleton
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lm) {
        const w = canvas.width, hh = canvas.height;
        ctx.strokeStyle = "rgba(0,255,200,0.9)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lm[a].x * w, lm[a].y * hh);
          ctx.lineTo(lm[b].x * w, lm[b].y * hh);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,200,0,0.95)";
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * hh, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // update virtual cursor position over the playground
    const pg = playgroundRef.current;
    const cur = cursorRef.current;
    if (pg && cur && h.present) {
      const rect = pg.getBoundingClientRect();
      // map hand 0..1 to playground rect, using the centre box like the python app
      const px = Math.max(0, Math.min(1, (h.x - 0.2) / 0.6));
      const py = Math.max(0, Math.min(1, (h.y - 0.2) / 0.6));
      const cx = rect.left + px * rect.width;
      const cy = rect.top + py * rect.height;
      cur.style.left = `${cx}px`;
      cur.style.top = `${cy}px`;
      cur.style.opacity = "1";

      // left-click state (thumb -> index MCP)
      const click = leftClickSignal(lm);
      const newLeft = click.active;
      if (newLeft && !leftHeldRef.current) {
        leftHeldRef.current = true;
        setLeftHeld(true);
        setClickCount((c) => c + 1);
        // check if cursor is over the draggable card -> begin drag
        const card = pg.querySelector<HTMLDivElement>("[data-drag-card]");
        if (card) {
          const cr = card.getBoundingClientRect();
          if (cx >= cr.left && cx <= cr.right && cy >= cr.top && cy <= cr.bottom) {
            dragOffsetRef.current = { x: cx - cr.left, y: cy - cr.top };
          }
        }
        // toggle the switch if cursor over it
        const sw = pg.querySelector<HTMLButtonElement>("[data-switch]");
        if (sw) {
          const sr = sw.getBoundingClientRect();
          if (cx >= sr.left && cx <= sr.right && cy >= sr.top && cy <= sr.bottom) {
            setSwitchOn((s) => !s);
          }
        }
        // drawing canvas: start stroke
        const dc = drawCanvasRef.current;
        if (dc) {
          const dr = dc.getBoundingClientRect();
          if (cx >= dr.left && cx <= dr.right && cy >= dr.top && cy <= dr.bottom) {
            drawingRef.current = true;
            lastDrawPtRef.current = { x: cx - dr.left, y: cy - dr.top };
            const dctx = dc.getContext("2d")!;
            if (tool === "brush") {
              dctx.beginPath();
              dctx.moveTo(lastDrawPtRef.current.x, lastDrawPtRef.current.y);
            }
          }
        }
      } else if (!newLeft && leftHeldRef.current) {
        leftHeldRef.current = false;
        setLeftHeld(false);
        dragOffsetRef.current = null;
        drawingRef.current = false;
        lastDrawPtRef.current = null;
      }

      // dragging the card
      if (leftHeldRef.current && dragOffsetRef.current) {
        const card = pg.querySelector<HTMLDivElement>("[data-drag-card]");
        if (card) {
          const cr = pg.getBoundingClientRect();
          const nx = cx - cr.left - dragOffsetRef.current.x;
          const ny = cy - cr.top - dragOffsetRef.current.y;
          setCardPos({ x: nx, y: ny });
        }
      }

      // drawing
      if (leftHeldRef.current && drawingRef.current) {
        const dc = drawCanvasRef.current;
        if (dc) {
          const dr = dc.getBoundingClientRect();
          const dctx = dc.getContext("2d")!;
          const x = cx - dr.left;
          const y = cy - dr.top;
          dctx.strokeStyle = color;
          dctx.fillStyle = color;
          dctx.lineWidth = 4;
          dctx.lineCap = "round";
          if (tool === "brush") {
            dctx.lineTo(x, y);
            dctx.stroke();
          } else if (tool === "circle") {
            dctx.beginPath();
            dctx.arc(x, y, 14, 0, Math.PI * 2);
            dctx.fill();
          } else if (tool === "square") {
            dctx.fillRect(x - 14, y - 14, 28, 28);
          }
          lastDrawPtRef.current = { x, y };
        }
      }
    } else if (cur) {
      cur.style.opacity = "0";
    }
  }, [tool, color]);

  // We use the hook directly but need to wire videoRef to the hook's videoRef.
  // The hook owns its own videoRef, so we render its <video> via a forwarded ref.
  const tracking = useHandTracking({ onFrame });
  // sync the local videoRef with the hook's videoRef
  useEffect(() => {
    videoRef.current = tracking.videoRef.current;
  });

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
  const stop = () => {
    tracking.stop();
    setRunning(false);
  };

  // init draw canvas size
  useEffect(() => {
    const dc = drawCanvasRef.current;
    if (dc) {
      dc.width = dc.clientWidth;
      dc.height = dc.clientHeight;
    }
  }, []);

  const clearCanvas = () => {
    const dc = drawCanvasRef.current;
    if (dc) {
      dc.getContext("2d")!.clearRect(0, 0, dc.width, dc.height);
    }
  };

  return (
    <div className="relative min-h-screen pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Cursor <span className="text-gradient">Control</span>
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            A touchless mouse you control with your hand. Point with your index
            finger to move, tuck your thumb to the base of your index finger to
            click. Drag the card, flip the switch, and paint on the canvas.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
          {/* ---- camera + status ---- */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden glass-strong aspect-video bg-black">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 grid-bg">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse-glow" />
                    <Camera className="relative h-16 w-16 text-primary/70" />
                  </div>
                  <p className="text-muted-foreground text-sm max-w-xs text-center">
                    {loading ? "Loading the hand-tracking model…" : "Click start and allow camera access"}
                  </p>
                  {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              )}

              <AnimatePresence>
                {running && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong">
                    <span className={cn("h-2 w-2 rounded-full", gesture === "idle" ? "bg-muted-foreground" : "bg-primary animate-pulse")} />
                    <span className="text-sm font-medium capitalize">{gesture}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="absolute bottom-3 left-3 right-3 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">{error}</div>
              )}
            </div>

            {/* controls + stats */}
            <div className="grid grid-cols-2 gap-3">
              {!running ? (
                <button onClick={start} disabled={loading} className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-emerald disabled:opacity-50">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {loading ? "Loading…" : "Start Camera"}
                </button>
              ) : (
                <button onClick={stop} className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                  <CameraOff className="h-5 w-5" /> Stop
                </button>
              )}
              <div className="rounded-xl glass p-3 text-center">
                <div className="text-2xl font-bold text-primary tabular-nums">{clickCount}</div>
                <div className="text-xs text-muted-foreground">clicks</div>
              </div>
              <div className="rounded-xl glass p-3 text-center">
                <div className={cn("text-2xl font-bold tabular-nums", leftHeld ? "text-primary" : "text-muted-foreground")}>{leftHeld ? "DOWN" : "up"}</div>
                <div className="text-xs text-muted-foreground">left button</div>
              </div>
            </div>

            {/* gesture hint */}
            <div className="rounded-xl glass p-4 text-sm space-y-2">
              <p className="font-medium flex items-center gap-2"><Hand className="h-4 w-4 text-primary" /> How to use</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Point with your <span className="text-foreground">index finger</span> to move the cursor</li>
                <li>• <span className="text-foreground">Tuck your thumb</span> to the base of your index finger to click</li>
                <li>• Hold the tuck and move to <span className="text-foreground">drag</span> the card or <span className="text-foreground">paint</span></li>
              </ul>
            </div>
          </div>

          {/* ---- interactive playground ---- */}
          <div className="flex flex-col gap-4">
            <div ref={playgroundRef} className="relative rounded-2xl glass-strong p-6 min-h-[500px] overflow-hidden grid-bg">
              {/* draggable card */}
              <motion.div
                data-drag-card
                animate={{ x: cardPos.x, y: cardPos.y }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute top-0 left-0 w-40 h-28 rounded-xl bg-gradient-to-br from-primary/20 to-chart-2/20 border border-primary/40 p-3 cursor-grab select-none"
                style={{ x: 0, y: 0 }}
              >
                <div className="text-xs text-muted-foreground mb-1">Drag me</div>
                <div className="font-bold text-sm">Card</div>
                <div className="text-[10px] text-muted-foreground mt-1">tuck + hold + move</div>
              </motion.div>

              {/* toggle switch */}
              <div className="absolute top-6 right-6 flex flex-col items-center gap-2">
                <button
                  data-switch
                  className={cn("relative w-14 h-8 rounded-full transition-colors", switchOn ? "bg-primary" : "bg-white/10")}
                >
                  <motion.div
                    className="absolute top-1 h-6 w-6 rounded-full bg-white shadow"
                    animate={{ left: switchOn ? 28 : 4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
                <span className="text-xs text-muted-foreground">{switchOn ? "ON" : "OFF"}</span>
              </div>

              {/* click counter button */}
              <div className="absolute bottom-6 right-6">
                <button
                  data-click-btn
                  onClick={() => setClickCount((c) => c + 1)}
                  className="px-4 py-2 rounded-lg bg-chart-2/20 border border-chart-2/40 text-sm font-medium hover:bg-chart-2/30 transition-colors"
                >
                  Click me
                </button>
              </div>

              {/* drawing canvas */}
              <canvas
                ref={drawCanvasRef}
                className="absolute bottom-6 left-6 w-64 h-40 rounded-xl bg-black/40 border border-white/10"
              />
            </div>

            {/* drawing tools */}
            <div className="rounded-xl glass p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">Draw:</span>
              {([
                { id: "brush" as const, icon: Hand, label: "Brush" },
                { id: "circle" as const, icon: Circle, label: "Circle" },
                { id: "square" as const, icon: Square, label: "Square" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", tool === t.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-2">
                {["#00ff8c", "#00d4ff", "#ffaa00", "#ff00aa"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn("h-6 w-6 rounded-full border-2 transition-transform", color === c ? "scale-110 border-white" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button onClick={clearCanvas} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* the virtual cursor (fixed, follows hand) */}
        <div ref={cursorRef} className="fixed pointer-events-none z-40 opacity-0 transition-opacity" style={{ left: 0, top: 0 }}>
          <div className={cn("relative -translate-x-1/2 -translate-y-1/2 transition-transform", leftHeld && "scale-90")}>
            {leftHeld && <div className="absolute inset-0 -m-4 bg-primary/30 rounded-full blur-md" />}
            <MousePointer2 className={cn("relative h-7 w-7 drop-shadow-lg", leftHeld ? "text-primary fill-primary/50" : "text-primary")} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Sparkles className="inline h-3 w-3 text-primary mr-1" />
          Your camera feed never leaves your device — all processing happens locally in the browser.
        </p>
      </div>
    </div>
  );
}
