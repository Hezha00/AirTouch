"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Hand, Trash2, Download, Undo2,
  Square, Circle, Minus, ArrowRight, Type, Pen, Eraser,
  ChevronLeft, ChevronRight, Plus, Sparkles, FileText,
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

const COLORS = ["#00ff8c", "#00d4ff", "#ffaa00", "#ff3366", "#aa66ff", "#ffffff"];

type Tool = "pen" | "rect" | "circle" | "line" | "arrow" | "eraser" | "text";
type Shape = {
  tool: Tool;
  color: string;
  size: number;
  points: { x: number; y: number; label?: string }[];
  fill?: boolean;
};

function isPinch(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / ref < 0.4;
}
function isFist(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  return [8, 12, 16, 20].every((i) => lm[i].y > lm[i - 2].y) && [4].every((i) => lm[i].y > lm[i - 2].y);
}
function isOpen(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  return [4, 8, 12, 16, 20].every((i) => lm[i].y < lm[i - 2].y);
}

export function WhiteboardView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const pagesRef = useRef<Shape[][]>([[]]);
  const pageNumRef = useRef(0);
  const currentShapeRef = useRef<Shape | null>(null);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const prevFistRef = useRef(false);
  const toolRef = useRef<Tool>("pen");
  const colorRef = useRef("#00ff8c");
  const sizeRef = useRef(4);
  const drawingRef = useRef(false);
  const startPtRef = useRef<{ x: number; y: number } | null>(null);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState("idle");
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#00ff8c");
  const [size, setSize] = useState(4);
  const [pageNum, setPageNum] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [shapeCount, setShapeCount] = useState(0);
  const [fill, setFill] = useState(false);
  const [textValue, setTextValue] = useState("Text");
  const fillRef = useRef(false);
  const textRef = useRef("Text");

  /* redraw current page */
  const redraw = useCallback(() => {
    const bc = boardRef.current;
    if (!bc) return;
    const ctx = bc.getContext("2d")!;
    ctx.clearRect(0, 0, bc.width, bc.height);
    const shapes = pagesRef.current[pageNumRef.current] || [];
    for (const s of shapes) {
      drawShape(ctx, s);
    }
  }, []);

  function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (s.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = s.size * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
    if (s.tool === "pen" || s.tool === "eraser") {
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    } else if (s.tool === "rect") {
      const [a, b] = [s.points[0], s.points[s.points.length - 1]];
      if (s.fill) ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      else ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (s.tool === "circle") {
      const [a, b] = [s.points[0], s.points[s.points.length - 1]];
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      if (s.fill) ctx.fill();
      else ctx.stroke();
    } else if (s.tool === "line") {
      const [a, b] = [s.points[0], s.points[s.points.length - 1]];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (s.tool === "arrow") {
      const [a, b] = [s.points[0], s.points[s.points.length - 1]];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // arrowhead
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const len = 14;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - len * Math.cos(angle - Math.PI / 6), b.y - len * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - len * Math.cos(angle + Math.PI / 6), b.y - len * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (s.tool === "text") {
      ctx.font = `${s.size * 6}px monospace`;
      ctx.fillText(s.points[0]?.label || "Text", s.points[0].x, s.points[0].y);
    }
    ctx.globalCompositeOperation = "source-over";
  }

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
        ctx.strokeStyle = "rgba(0,255,200,0.6)";
        ctx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lm[a].x * w, lm[a].y * hh);
          ctx.lineTo(lm[b].x * w, lm[b].y * hh);
          ctx.stroke();
        }
      }
    }

    const cont = containerRef.current;
    const cur = cursorRef.current;
    const bc = boardRef.current;
    if (!cont || !cur || !bc) return;

    if (h.present && lm) {
      const rect = cont.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (h.x - 0.1) / 0.8));
      const py = Math.max(0, Math.min(1, (h.y - 0.1) / 0.8));
      const cx = rect.left + px * rect.width;
      const cy = rect.top + py * rect.height;
      cur.style.left = `${cx}px`;
      cur.style.top = `${cy}px`;
      cur.style.opacity = "1";

      const pinch = isPinch(lm);
      const fist = isFist(lm);
      const open = isOpen(lm);

      // fist = clear page
      if (fist && !prevFistRef.current) {
        pagesRef.current[pageNumRef.current] = [];
        currentShapeRef.current = null;
        drawingRef.current = false;
        setShapeCount(0);
        redraw();
      }
      prevFistRef.current = fist;

      if (fist) {
        setGesture("fist (clear)");
      } else if (open) {
        setGesture("open (move)");
        // end any active shape
        if (currentShapeRef.current) {
          currentShapeRef.current = null;
          drawingRef.current = false;
          startPtRef.current = null;
        }
      } else if (pinch) {
        setGesture("pinch (draw)");
        const drect = bc.getBoundingClientRect();
        const lx = cx - drect.left;
        const ly = cy - drect.top;
        if (lx >= 0 && lx <= drect.width && ly >= 0 && ly <= drect.height) {
          if (!drawingRef.current) {
            // start new shape
            if (toolRef.current === "text") {
              // text tool: place text immediately
              const textShape: Shape = { tool: "text", color: colorRef.current, size: sizeRef.current, points: [{ x: lx, y: ly, label: textRef.current }] };
              pagesRef.current[pageNumRef.current].push(textShape);
              setShapeCount(pagesRef.current[pageNumRef.current].length);
              redraw();
            } else {
              currentShapeRef.current = { tool: toolRef.current, color: colorRef.current, size: sizeRef.current, points: [{ x: lx, y: ly }], fill: fillRef.current };
              pagesRef.current[pageNumRef.current].push(currentShapeRef.current);
              drawingRef.current = true;
              startPtRef.current = { x: lx, y: ly };
              lastPtRef.current = { x: lx, y: ly };
            }
          } else {
            // continue shape
            if (currentShapeRef.current) {
              if (currentShapeRef.current.tool === "pen" || currentShapeRef.current.tool === "eraser") {
                currentShapeRef.current.points.push({ x: lx, y: ly });
              } else {
                // shape tools: only keep start + current
                currentShapeRef.current.points = [startPtRef.current!, { x: lx, y: ly }];
              }
            }
            lastPtRef.current = { x: lx, y: ly };
          }
          redraw();
        }
      } else {
        setGesture("idle");
        if (currentShapeRef.current) {
          currentShapeRef.current = null;
          drawingRef.current = false;
          startPtRef.current = null;
          setShapeCount(pagesRef.current[pageNumRef.current].length);
        }
      }
    } else {
      if (cur) cur.style.opacity = "0";
      setGesture("idle");
      if (currentShapeRef.current) {
        currentShapeRef.current = null;
        drawingRef.current = false;
        startPtRef.current = null;
        setShapeCount(pagesRef.current[pageNumRef.current].length);
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

  // size board
  useEffect(() => {
    const bc = boardRef.current;
    if (bc) { bc.width = bc.clientWidth; bc.height = bc.clientHeight; redraw(); }
  }, [running]);

  // keep refs in sync
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { fillRef.current = fill; }, [fill]);
  useEffect(() => { textRef.current = textValue; }, [textValue]);

  const undo = () => {
    const page = pagesRef.current[pageNumRef.current];
    if (page.length > 0) {
      page.pop();
      setShapeCount(page.length);
      redraw();
    }
  };
  const clearPage = () => {
    pagesRef.current[pageNumRef.current] = [];
    setShapeCount(0);
    redraw();
  };
  const newPage = () => {
    pagesRef.current.push([]);
    pageNumRef.current = pagesRef.current.length - 1;
    setPageNum(pageNumRef.current);
    setPageCount(pagesRef.current.length);
    redraw();
  };
  const goPage = (delta: number) => {
    const next = Math.max(0, Math.min(pagesRef.current.length - 1, pageNumRef.current + delta));
    pageNumRef.current = next;
    setPageNum(next);
    redraw();
  };
  const download = () => {
    const bc = boardRef.current;
    if (!bc) return;
    const tmp = document.createElement("canvas");
    tmp.width = bc.width; tmp.height = bc.height;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = "#0a0a0f";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(bc, 0, 0);
    const a = document.createElement("a");
    a.href = tmp.toDataURL("image/png");
    a.download = `airtouch-whiteboard-p${pageNum + 1}.png`;
    a.click();
  };

  // mouse drawing for no-camera testing
  const mouseDown = (e: React.MouseEvent) => {
    const bc = boardRef.current;
    if (!bc) return;
    const rect = bc.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    if (tool === "text") {
      const textShape: Shape = { tool: "text", color, size, points: [{ x: lx, y: ly, label: textValue }] };
      pagesRef.current[pageNumRef.current].push(textShape);
      setShapeCount(pagesRef.current[pageNumRef.current].length);
      redraw();
      return;
    }
    currentShapeRef.current = { tool, color, size, points: [{ x: lx, y: ly }], fill };
    pagesRef.current[pageNumRef.current].push(currentShapeRef.current);
    drawingRef.current = true;
    startPtRef.current = { x: lx, y: ly };
  };
  const mouseMove = (e: React.MouseEvent) => {
    if (!drawingRef.current || !currentShapeRef.current) return;
    const bc = boardRef.current;
    if (!bc) return;
    const rect = bc.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    if (currentShapeRef.current.tool === "pen" || currentShapeRef.current.tool === "eraser") {
      currentShapeRef.current.points.push({ x: lx, y: ly });
    } else {
      currentShapeRef.current.points = [startPtRef.current!, { x: lx, y: ly }];
    }
    redraw();
  };
  const mouseUp = () => {
    if (currentShapeRef.current) {
      currentShapeRef.current = null;
      drawingRef.current = false;
      startPtRef.current = null;
      setShapeCount(pagesRef.current[pageNumRef.current].length);
    }
  };

  const TOOLS: { id: Tool; icon: typeof Pen; label: string }[] = [
    { id: "pen", icon: Pen, label: "Pen" },
    { id: "rect", icon: Square, label: "Rect" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "arrow", icon: ArrowRight, label: "Arrow" },
    { id: "text", icon: Type, label: "Text" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ];

  return (
    <div className="relative min-h-screen pt-16 sm:pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Air <span className="text-gradient">Whiteboard</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              A multi-page gesture whiteboard. Draw with pen, shapes, arrows. Pinch to draw, open hand to lift, fist to clear the page.
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
          {/* ---- main area ---- */}
          <div className="flex flex-col gap-3">
            {/* camera thumbnail */}
            <div className="relative rounded-xl overflow-hidden glass-strong aspect-video bg-black h-32 sm:h-40">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center grid-bg">
                  <FileText className="h-8 w-8 text-primary/40" />
                </div>
              )}
              {running && (
                <div className="absolute top-2 left-2 flex items-center gap-2 px-2.5 py-1 rounded-lg glass-strong">
                  <span className={cn("h-1.5 w-1.5 rounded-full", gesture.includes("draw") ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                  <span className="text-xs font-medium">{gesture}</span>
                </div>
              )}
              {error && <div className="absolute bottom-2 left-2 right-2 px-3 py-2 rounded-lg bg-destructive/20 border border-destructive/40 text-xs text-destructive">{error}</div>}
            </div>

            {/* the whiteboard */}
            <div ref={containerRef} className="relative rounded-2xl overflow-hidden glass-strong bg-[#0a0a0f] grid-bg" style={{ minHeight: "calc(100vh - 380px)" }}>
              <canvas
                ref={boardRef}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                onMouseDown={mouseDown}
                onMouseMove={mouseMove}
                onMouseUp={mouseUp}
                onMouseLeave={mouseUp}
              />
              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse-glow" />
                    <FileText className="relative h-12 w-12 text-primary/60" />
                  </div>
                  <p className="text-muted-foreground text-sm">Start the camera to draw with gestures, or use your mouse</p>
                </div>
              )}
              {/* page indicator */}
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong text-xs">
                <button onClick={() => goPage(-1)} disabled={pageNum === 0} className="p-0.5 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <span className="font-mono tabular-nums">{pageNum + 1} / {pageCount}</span>
                <button onClick={() => goPage(1)} disabled={pageNum === pageCount - 1} className="p-0.5 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          {/* ---- sidebar ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {/* tools */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Tools</div>
              <div className="grid grid-cols-3 gap-2">
                {TOOLS.map((t) => (
                  <button key={t.id} onClick={() => setTool(t.id)} className={cn("flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-colors", tool === t.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}>
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* colors */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Color</div>
              <div className="grid grid-cols-3 gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className={cn("aspect-square rounded-lg border-2 transition-all", color === c ? "scale-110 border-white" : "border-transparent")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {/* size */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Size</div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSize((s) => Math.max(2, s - 2))} className="px-2 py-1 rounded bg-white/5 text-sm hover:bg-white/10">−</button>
                <div className="flex-1 flex justify-center">
                  <div className="rounded-full bg-primary" style={{ width: size, height: size }} />
                </div>
                <button onClick={() => setSize((s) => Math.min(20, s + 2))} className="px-2 py-1 rounded bg-white/5 text-sm hover:bg-white/10">+</button>
              </div>
              <div className="text-center text-xs text-muted-foreground mt-1 tabular-nums">{size}px</div>
            </div>

            {/* page actions */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Actions</div>
              <button onClick={undo} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors">
                <Undo2 className="h-4 w-4" /> Undo
              </button>
              <button onClick={newPage} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors">
                <Plus className="h-4 w-4" /> New page
              </button>
              <button onClick={clearPage} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm hover:bg-destructive/30 transition-colors">
                <Trash2 className="h-4 w-4" /> Clear page
              </button>
              <button onClick={download} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm hover:bg-primary/25 transition-colors">
                <Download className="h-4 w-4" /> Save PNG
              </button>
            </div>

            {/* fill toggle + text input */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Shape fill</div>
                <button onClick={() => setFill((f) => !f)} className={cn("w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors", fill ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground")}>
                  {fill ? "FILLED" : "OUTLINED"}
                </button>
              </div>
              {tool === "text" && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Text content</div>
                  <input
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="Type here..."
                  />
                </div>
              )}
            </div>

            {/* gesture guide */}
            <div className="rounded-xl glass p-3 text-xs space-y-1.5 col-span-2 lg:col-span-1">
              <p className="font-medium flex items-center gap-1.5 text-muted-foreground"><Hand className="h-3.5 w-3.5 text-primary" /> Gestures</p>
              <div className="text-muted-foreground space-y-0.5">
                <p>🤏 Pinch → Draw</p>
                <p>🖐 Open → Lift</p>
                <p>✊ Fist → Clear page</p>
              </div>
            </div>

            {/* stats */}
            <div className="rounded-xl glass p-3 text-center col-span-2 lg:col-span-1">
              <div className="text-2xl font-bold text-primary tabular-nums">{shapeCount}</div>
              <div className="text-xs text-muted-foreground">shapes on page</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Sparkles className="inline h-3 w-3 text-primary mr-1" />
          A structured whiteboard with shapes, arrows, multi-page support, and PNG export — all gesture-controlled.
        </p>
      </div>

      {/* floating cursor */}
      <div ref={cursorRef} className="fixed pointer-events-none z-40 opacity-0 transition-opacity" style={{ left: 0, top: 0 }}>
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 -m-2 rounded-full bg-primary/40 blur-md" />
          <div className="relative h-5 w-5 rounded-full border-2 border-primary bg-primary/30" />
        </div>
      </div>
    </div>
  );
}
