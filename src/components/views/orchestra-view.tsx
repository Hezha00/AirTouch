"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Music, Hand, Volume2, Activity,
  Play, Pause, Lock, Zap, RotateCcw, Sliders, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useHandTracking, type HandState, type Landmark, type GestureType,
} from "@/lib/gesture/use-hand-tracking";
import {
  MusicEngine, type LayerName, SCALES, PROGRESSIONS,
} from "@/lib/gesture/music-engine";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const LAYERS: { id: LayerName; label: string; color: string }[] = [
  { id: "strings", label: "Strings", color: "text-primary" },
  { id: "piano",   label: "Piano",   color: "text-chart-2" },
  { id: "bass",    label: "Bass",    color: "text-chart-3" },
  { id: "drums",   label: "Drums",   color: "text-chart-5" },
  { id: "lead",    label: "Lead",    color: "text-chart-4" },
];

const DYN_LABELS = ["pp", "p", "mp", "mf", "f", "ff"];

/* discretize a 0..1 value into N zones, returns zone index 0..N-1 */
function zone(v: number, n: number) {
  return Math.max(0, Math.min(n - 1, Math.floor(v * n)));
}

export function OrchestraView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MusicEngine | null>(null);
  const lockedRef = useRef(false);
  const prevRightGestureRef = useRef<GestureType>("idle");
  const prevLeftGestureRef = useRef<GestureType>("idle");
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightGesture, setRightGesture] = useState<GestureType>("idle");
  const [leftGesture, setLeftGesture] = useState<GestureType>("idle");
  const [rightPresent, setRightPresent] = useState(false);
  const [leftPresent, setLeftPresent] = useState(false);
  const [tempo, setTempo] = useState(90);
  const [dynamicLevel, setDynamicLevel] = useState(3);
  const [chordName, setChordName] = useState("I");
  const [scaleIdx, setScaleIdx] = useState(0);
  const [progIdx, setProgIdx] = useState(0);
  const [melodyNote, setMelodyNote] = useState("C5");
  const [melodyDegree, setMelodyDegree] = useState(0);
  const [melodyOn, setMelodyOn] = useState(true);
  const [locked, setLocked] = useState(false);
  const [activeLayers, setActiveLayers] = useState<LayerName[]>(["strings", "piano", "bass", "drums", "lead"]);
  const [layerVols, setLayerVols] = useState<Record<LayerName, number>>({
    strings: 0.5, piano: 0.6, bass: 0.7, drums: 0.7, lead: 0.55,
  });
  const [reverbAmt, setReverbAmt] = useState(0.3);
  const [swingAmt, setSwingAmt] = useState(0);
  const [octave, setOctave] = useState(0);
  const [showMix, setShowMix] = useState(false);
  const [rightX, setRightX] = useState(0.5);
  const [leftX, setLeftX] = useState(0.5);
  const [leftY, setLeftY] = useState(0.5);
  const [rightY, setRightY] = useState(0.5);

  /* -------------------------------------------------------------- */
  /*  Per-frame: draw skeletons + drive engine from TWO hands        */
  /* -------------------------------------------------------------- */
  const onHands = useCallback((hands: HandState[], lms: (Landmark[] | null)[]) => {
    const canvas = canvasRef.current;
    const video = videoElRef.current;
    const eng = engineRef.current;

    // identify right & left hands
    let right: HandState | null = null;
    let left: HandState | null = null;
    let rightLm: Landmark[] | null = null;
    let leftLm: Landmark[] | null = null;
    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      if (!h.present) continue;
      if (h.handedness === "Right" && !right) { right = h; rightLm = lms[i]; }
      else if (h.handedness === "Left" && !left) { left = h; leftLm = lms[i]; }
      else if (!right) { right = h; rightLm = lms[i]; }
      else if (!left) { left = h; leftLm = lms[i]; }
    }

    setRightPresent(!!right?.present);
    setLeftPresent(!!left?.present);

    // draw skeletons
    if (canvas && video) {
      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawHand = (lm: Landmark[] | null, color: string) => {
        if (!lm) return;
        const w = canvas!.width, hh = canvas!.height;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lm[a].x * w, lm[a].y * hh);
          ctx.lineTo(lm[b].x * w, lm[b].y * hh);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,210,80,0.95)";
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * hh, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      drawHand(rightLm, "rgba(0,255,140,0.9)");
      drawHand(leftLm, "rgba(255,120,80,0.9)");
    }

    if (!eng) return;

    /* ---- RIGHT HAND: tempo + melody ---- */
    if (right) {
      setRightGesture(right.gesture);
      setRightX(right.x);
      setRightY(right.y);
      // Y -> tempo (top = fast). 50..180
      const bpm = 50 + (1 - right.y) * 130;
      eng.setTempo(bpm);
      setTempo(Math.round(bpm));
      // X -> melody degree (7 zones)
      const n = SCALES[scaleIdx].intervals.length;
      const deg = zone(right.x, n * 2);
      eng.setMelodyDegree(deg);
      setMelodyDegree(deg);

      // gesture edges
      const g = right.gesture;
      const prev = prevRightGestureRef.current;
      if (g !== prev) {
        if (g === "fist") { eng.setMelodyEnabled(false); setMelodyOn(false); }
        if (g === "open") { eng.setMelodyEnabled(true); setMelodyOn(true); }
        if (g === "point") {
          // accent: re-trigger melody note now
          eng.setMelodyEnabled(true); setMelodyOn(true);
        }
        prevRightGestureRef.current = g;
      }
    } else {
      setRightGesture("idle");
    }

    /* ---- LEFT HAND: dynamics + progression ---- */
    if (left) {
      setLeftGesture(left.gesture);
      setLeftX(left.x);
      setLeftY(left.y);
      // Y -> dynamic level (6 zones, top = ff)
      const dl = 5 - zone(left.y, 6);
      eng.setDynamicLevel(dl);
      setDynamicLevel(dl);
      // X -> progression (4 zones)
      const pi = zone(left.x, PROGRESSIONS.length);
      if (pi !== progIdx) {
        eng.setProgression(pi);
        setProgIdx(pi);
      }

      // gesture edges
      const g = left.gesture;
      const prev = prevLeftGestureRef.current;
      if (g !== prev) {
        if (g === "open") {
          // full ensemble
          (["strings", "piano", "bass", "drums", "lead"] as LayerName[]).forEach((l) => {
            eng.setLayerVolume(l, layerVols[l] || 0.6);
          });
          setActiveLayers((Object.keys(layerVols) as LayerName[]).filter((l) => (layerVols[l] || 0) > 0.01));
        }
        if (g === "fist") {
          // strip to strings only
          (["piano", "bass", "drums", "lead"] as LayerName[]).forEach((l) => eng.setLayerVolume(l, 0));
          eng.setLayerVolume("strings", layerVols.strings || 0.6);
          setActiveLayers(["strings"]);
        }
        if (g === "pinch") {
          lockedRef.current = !lockedRef.current;
          eng.setLocked(lockedRef.current);
          setLocked(lockedRef.current);
        }
        prevLeftGestureRef.current = g;
      }
    } else {
      setLeftGesture("idle");
    }

    // sync display state from engine
    if (eng.state) {
      setChordName(eng.state.currentChordName);
      setMelodyNote(eng.state.melodyNote);
      setActiveLayers([...eng.state.activeLayers]);
    }
  }, [scaleIdx, progIdx, layerVols]);

  const tracking = useHandTracking({ onHands, numHands: 2, smoothing: 0.45 });
  useEffect(() => {
    videoElRef.current = tracking.videoRef.current;
  });

  /* -------------------------------------------------------------- */
  /*  Start / stop                                                  */
  /* -------------------------------------------------------------- */
  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!engineRef.current) {
        engineRef.current = new MusicEngine();
        await engineRef.current.init();
      }
      // apply current UI state
      engineRef.current.setScale(scaleIdx);
      engineRef.current.setProgression(progIdx);
      engineRef.current.setReverb(reverbAmt);
      engineRef.current.setSwing(swingAmt);
      engineRef.current.setOctave(octave);
      engineRef.current.setDynamicLevel(dynamicLevel);
      (Object.keys(layerVols) as LayerName[]).forEach((l) => engineRef.current!.setLayerVolume(l, layerVols[l]));
      engineRef.current.start();
      await tracking.start();
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    tracking.stop();
    setRunning(false);
    engineRef.current?.stop();
    setRightGesture("idle");
    setLeftGesture("idle");
    setRightPresent(false);
    setLeftPresent(false);
  };

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* ---- UI handlers ---- */
  const onScale = (i: number) => { setScaleIdx(i); engineRef.current?.setScale(i); };
  const onProg = (i: number) => { setProgIdx(i); engineRef.current?.setProgression(i); };
  const onLayerVol = (l: LayerName, v: number) => {
    setLayerVols((s) => ({ ...s, [l]: v }));
    engineRef.current?.setLayerVolume(l, v);
  };
  const onReverb = (v: number) => { setReverbAmt(v); engineRef.current?.setReverb(v); };
  const onSwing = (v: number) => { setSwingAmt(v); engineRef.current?.setSwing(v); };
  const onOctave = (v: number) => { setOctave(v); engineRef.current?.setOctave(v); };
  const onDrop = () => engineRef.current?.triggerDrop();
  const onPanic = () => {
    engineRef.current?.stop();
    setTimeout(() => engineRef.current?.start(), 100);
  };

  const intensity = dynamicLevel / 5;

  return (
    <div className="relative min-h-screen pt-20 pb-12">
      {/* ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, oklch(0.7 0.2 305 / ${0.15 + intensity * 0.25}), transparent)` }}
          animate={{ scale: 1 + intensity * 0.3 }}
          transition={{ duration: 0.4 }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, oklch(0.72 0.19 155 / ${0.1 + intensity * 0.2}), transparent)` }}
          animate={{ scale: 1 + intensity * 0.3 }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-chart-4 mb-4">
            <Music className="h-3.5 w-3.5" /> Two-handed conducting · Generative · Tone.js
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            AI Conducting <span className="text-gradient">Orchestra</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Conduct a live, procedurally-generated cinematic score with <span className="text-primary">both hands</span>.
            Right hand sets tempo &amp; melody; left hand sets dynamics &amp; harmony. Every note is synthesized in real time.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          {/* ---- camera + overlays ---- */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden glass-strong aspect-video bg-black">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 grid-bg">
                  <div className="relative">
                    <div className="absolute inset-0 bg-chart-4/30 blur-2xl rounded-full animate-pulse-glow" />
                    <Music className="relative h-16 w-16 text-chart-4/70" />
                  </div>
                  <p className="text-muted-foreground text-sm max-w-xs text-center">
                    {loading ? "Loading model + audio engine…" : "Click start to begin conducting"}
                  </p>
                  {loading && <Loader2 className="h-5 w-5 animate-spin text-chart-4" />}
                </div>
              )}

              <AnimatePresence>
                {running && (
                  <>
                    {/* right hand badge */}
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong">
                      <span className={cn("h-2 w-2 rounded-full", rightPresent ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                      <span className="text-xs font-medium">R: <span className="capitalize text-primary">{rightGesture}</span></span>
                    </motion.div>
                    {/* left hand badge */}
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong">
                      <span className={cn("h-2 w-2 rounded-full", leftPresent ? "bg-chart-3 animate-pulse" : "bg-muted-foreground")} />
                      <span className="text-xs font-medium">L: <span className="capitalize text-chart-3">{leftGesture}</span></span>
                    </motion.div>
                    {/* chord + melody */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-3 left-3 flex gap-2">
                      <div className="px-3 py-1.5 rounded-lg glass-strong text-center">
                        <div className="text-[9px] text-muted-foreground uppercase">Chord</div>
                        <div className="text-lg font-bold text-chart-3 leading-none">{chordName}</div>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg glass-strong text-center">
                        <div className="text-[9px] text-muted-foreground uppercase">Melody</div>
                        <div className="text-lg font-bold text-chart-4 leading-none">{melodyNote}</div>
                      </div>
                    </motion.div>
                    {locked && (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong">
                        <Lock className="h-3.5 w-3.5 text-chart-3" />
                        <span className="text-xs">Locked</span>
                      </motion.div>
                    )}
                  </>
                )}
              </AnimatePresence>

              {error && (
                <div className="absolute bottom-3 left-3 right-3 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">{error}</div>
              )}
            </div>

            {/* start/stop + drop + panic */}
            <div className="grid grid-cols-3 gap-3">
              {!running ? (
                <button onClick={start} disabled={loading} className="col-span-3 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium hover:brightness-110 transition-all hover:glow-cyan disabled:opacity-50 text-white" style={{ backgroundColor: "oklch(0.62 0.22 305)" }}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                  {loading ? "Loading…" : "Start Conducting"}
                </button>
              ) : (
                <>
                  <button onClick={stop} className="col-span-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                    <Pause className="h-5 w-5" /> Stop
                  </button>
                  <button onClick={onDrop} className="col-span-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-chart-4 text-white font-medium hover:brightness-110 transition-all" style={{ backgroundColor: "oklch(0.62 0.22 305)" }}>
                    <Zap className="h-5 w-5" /> Drop
                  </button>
                  <button onClick={onPanic} className="col-span-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                    <RotateCcw className="h-5 w-5" /> Reset
                  </button>
                </>
              )}
            </div>

            {/* hand role guide */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl glass p-4">
                <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Right Hand ✋</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>↕ <span className="text-foreground">Height</span> → Tempo (50–180)</li>
                  <li>↔ <span className="text-foreground">X position</span> → Melody note</li>
                  <li>✊ <span className="text-foreground">Fist</span> → Mute melody</li>
                  <li>🖐 <span className="text-foreground">Open</span> → Melody on</li>
                </ul>
              </div>
              <div className="rounded-xl glass p-4">
                <div className="text-xs font-medium text-chart-3 uppercase tracking-wider mb-2">Left Hand ✋</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>↕ <span className="text-foreground">Height</span> → Dynamics (pp–ff)</li>
                  <li>↔ <span className="text-foreground">X position</span> → Progression</li>
                  <li>✊ <span className="text-foreground">Fist</span> → Strings only</li>
                  <li>🤏 <span className="text-foreground">Pinch</span> → Lock chord</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ---- control panel ---- */}
          <div className="flex flex-col gap-4">
            {/* tempo + dynamic */}
            <div className="rounded-2xl glass-strong p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Tempo</span>
                <span className="text-2xl font-bold text-primary tabular-nums">{tempo}<span className="text-sm text-muted-foreground ml-1">BPM</span></span>
              </div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-4">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-300" style={{ width: `${((tempo - 50) / 130) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Dynamics</span>
                <span className="text-sm font-bold text-chart-4">{DYN_LABELS[dynamicLevel]}</span>
              </div>
              <div className="flex items-end gap-1 h-10">
                {DYN_LABELS.map((d, i) => (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn("w-full rounded-sm transition-all", i <= dynamicLevel ? "bg-chart-4" : "bg-white/5")} style={{ height: `${20 + i * 12}%` }} />
                    <span className={cn("text-[9px]", i === dynamicLevel ? "text-chart-4 font-bold" : "text-muted-foreground")}>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* scale + progression pickers */}
            <div className="rounded-2xl glass-strong p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Harmony</div>
              <div className="mb-3">
                <div className="text-[10px] text-muted-foreground mb-1.5">Scale</div>
                <div className="flex flex-wrap gap-1.5">
                  {SCALES.map((s, i) => (
                    <button key={s.name} onClick={() => onScale(i)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", scaleIdx === i ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}>{s.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1.5">Progression</div>
                <div className="flex flex-wrap gap-1.5">
                  {PROGRESSIONS.map((p, i) => (
                    <button key={p.name} onClick={() => onProg(i)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", progIdx === i ? "bg-chart-3 text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}>{p.name}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* mixer toggle */}
            <button onClick={() => setShowMix(!showMix)} className="flex items-center justify-between rounded-2xl glass-strong p-4 hover:bg-white/5 transition-colors">
              <span className="text-sm font-medium flex items-center gap-2"><Sliders className="h-4 w-4 text-primary" /> Mixer &amp; FX</span>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showMix && "rotate-90")} />
            </button>
            <AnimatePresence>
              {showMix && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="rounded-2xl glass-strong p-5 space-y-4">
                    {LAYERS.map((l) => (
                      <div key={l.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-medium", l.color)}>{l.label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(layerVols[l.id] * 100)}</span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.01} value={layerVols[l.id]}
                          onChange={(e) => onLayerVol(l.id, parseFloat(e.target.value))}
                          className="w-full accent-primary h-1.5"
                        />
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border/40 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-chart-4">Reverb</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(reverbAmt * 100)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={reverbAmt} onChange={(e) => onReverb(parseFloat(e.target.value))} className="w-full accent-chart-4 h-1.5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-chart-2">Swing</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(swingAmt * 100)}</span>
                        </div>
                        <input type="range" min={0} max={0.6} step={0.01} value={swingAmt} onChange={(e) => onSwing(parseFloat(e.target.value))} className="w-full accent-chart-2 h-1.5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-chart-3">Octave</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{octave > 0 ? `+${octave}` : octave}</span>
                        </div>
                        <input type="range" min={-2} max={2} step={1} value={octave} onChange={(e) => onOctave(parseInt(e.target.value))} className="w-full accent-chart-3 h-1.5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* layer status */}
            <div className="rounded-2xl glass p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Active layers</div>
              <div className="grid grid-cols-5 gap-1.5">
                {LAYERS.map((l) => {
                  const on = activeLayers.includes(l.id);
                  return (
                    <div key={l.id} className={cn("rounded-lg p-2 text-center border transition-all", on ? "border-primary/40 bg-primary/5" : "border-white/10 opacity-40")}>
                      <div className={cn("text-[10px] font-medium", l.color)}>{l.label}</div>
                      <div className={cn("h-1 w-1 rounded-full mx-auto mt-1", on ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* position readouts */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <PosCard label="R · Y → Tempo" value={`${tempo}`} unit="BPM" color="text-primary" pct={rightY} />
          <PosCard label="R · X → Melody" value={`${melodyDegree}`} unit="deg" color="text-chart-4" pct={rightX} />
          <PosCard label="L · Y → Dynamic" value={DYN_LABELS[dynamicLevel]} unit="" color="text-chart-3" pct={leftY} />
          <PosCard label="L · X → Progression" value={PROGRESSIONS[progIdx].name} unit="" color="text-chart-2" pct={leftX} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Audio is synthesized live with Tone.js — no pre-recorded tracks. Camera + audio run entirely on your device. Use both hands for full control.
        </p>
      </div>
    </div>
  );
}

function PosCard({ label, value, unit, color, pct }: { label: string; value: string; unit: string; color: string; pct: number }) {
  return (
    <div className="rounded-xl glass p-3">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", color)}>{value}<span className="text-xs text-muted-foreground ml-1">{unit}</span></div>
      <div className="mt-1.5 h-1 rounded-full bg-black/40 overflow-hidden">
        <div className={cn("h-full rounded-full", color.replace("text-", "bg-"))} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
