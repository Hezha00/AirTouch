"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Music, Hand, Volume2, Activity,
  Play, Pause, Zap, Lock, Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHandTracking, type HandState, type Landmark, type GestureType } from "@/lib/gesture/use-hand-tracking";
import { MusicEngine, type LayerName } from "@/lib/gesture/music-engine";

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
  { id: "piano", label: "Piano", color: "text-chart-2" },
  { id: "bass", label: "Bass", color: "text-chart-3" },
  { id: "drums", label: "Drums", color: "text-chart-5" },
];

export function OrchestraView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MusicEngine | null>(null);
  const lockedRef = useRef(false);
  const soloRef = useRef<LayerName | null>(null);
  const prevGestureRef = useRef<GestureType>("idle");

  const [running, setRunning] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState<GestureType>("idle");
  const [tempo, setTempo] = useState(90);
  const [intensity, setIntensity] = useState(0.4);
  const [chordName, setChordName] = useState("C");
  const [activeLayers, setActiveLayers] = useState<LayerName[]>(["strings", "piano", "bass", "drums"]);
  const [locked, setLocked] = useState(false);
  const [solo, setSolo] = useState<LayerName | null>(null);
  const [mixLabel, setMixLabel] = useState("Piano");

  /* -------------------------------------------------------------- */
  /*  Per-frame: update music engine from hand state                */
  /*  (videoRef is read via a ref to break the hook <-> callback     */
  /*   circular dependency)                                          */
  /* -------------------------------------------------------------- */
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const onFrame = useCallback((h: HandState, lm: Landmark[] | null) => {
    setGesture(h.gesture);
    const eng = engineRef.current;

    // draw skeleton
    const canvas = canvasRef.current;
    const video = videoElRef.current;
    if (canvas && video) {
      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lm) {
        const w = canvas.width, hh = canvas.height;
        ctx.strokeStyle = "rgba(0,255,200,0.85)";
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
      }
    }

    if (!eng || !h.present) return;

    // Y -> tempo (top = fast, bottom = slow). 0..1 -> 180..60
    const bpm = 60 + (1 - h.y) * 120;
    eng.setTempo(bpm);
    setTempo(Math.round(bpm));

    // velocity -> intensity
    eng.setIntensity(h.velocity);
    setIntensity(h.velocity);

    // X -> mix
    eng.setMix(h.x);
    setMixLabel(h.x < 0.4 ? "Strings" : h.x > 0.6 ? "Pads/Choir" : "Piano");

    // gesture edges
    const g = h.gesture;
    const prev = prevGestureRef.current;
    if (g !== prev) {
      // FIST -> mute drums
      if (g === "fist" && prev !== "fist") {
        eng.setLayer("drums", false);
      }
      if (g !== "fist" && prev === "fist") {
        eng.setLayer("drums", true);
      }
      // OPEN HAND -> ensure all layers on
      if (g === "open" && prev !== "open") {
        (["strings", "piano", "bass", "drums"] as LayerName[]).forEach((l) => eng.setLayer(l, true));
        eng.solo(null);
        setSolo(null);
      }
      // PINCH -> toggle lock
      if (g === "pinch" && prev !== "pinch") {
        lockedRef.current = !lockedRef.current;
        eng.setLocked(lockedRef.current);
        setLocked(lockedRef.current);
      }
      // POINT -> solo piano
      if (g === "point" && prev !== "point") {
        soloRef.current = "piano";
        eng.solo("piano");
        setSolo("piano");
      }
      if (g !== "point" && prev === "point") {
        soloRef.current = null;
        eng.solo(null);
        setSolo(null);
      }
      prevGestureRef.current = g;
    }

    // sync active layers + chord into state (throttled by react batching)
    if (eng.state) {
      setActiveLayers([...eng.state.activeLayers]);
      setChordName(eng.state.currentChordName);
    }
  }, []);

  const tracking = useHandTracking({ onFrame, smoothing: 0.45 });

  // keep videoElRef in sync with the hook's video element
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
      // init audio engine first (requires user gesture)
      if (!engineRef.current) {
        engineRef.current = new MusicEngine();
        await engineRef.current.init();
      }
      engineRef.current.start();
      setAudioStarted(true);

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
    setAudioStarted(false);
    setGesture("idle");
  };

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* -------------------------------------------------------------- */
  /*  Render                                                        */
  /* -------------------------------------------------------------- */
  return (
    <div className="relative min-h-screen pt-20 pb-12">
      {/* ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, oklch(0.7 0.2 305 / ${0.15 + intensity * 0.25}), transparent)` }}
          animate={{ scale: 1 + intensity * 0.3 }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, oklch(0.72 0.19 155 / ${0.1 + intensity * 0.2}), transparent)` }}
          animate={{ scale: 1 + intensity * 0.3 }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-chart-4 mb-4">
            <Music className="h-3.5 w-3.5" /> Generative · Tone.js · No recordings
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            AI Conducting <span className="text-gradient">Orchestra</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Conduct a live, procedurally-generated cinematic score with your hands.
            Every note is synthesized in real time — your movement shapes the tempo,
            intensity, mix, and structure.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          {/* ---- camera + overlay ---- */}
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

            {/* live HUD overlays */}
            <AnimatePresence>
              {running && (
                <>
                  {/* gesture badge */}
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-strong">
                    <span className={cn("h-2 w-2 rounded-full", gesture === "idle" ? "bg-muted-foreground" : "bg-chart-4 animate-pulse")} />
                    <span className="text-sm font-medium capitalize">{gesture}</span>
                  </motion.div>

                  {/* chord display */}
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-3 right-3 px-4 py-2 rounded-lg glass-strong text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Chord</div>
                    <div className="text-2xl font-bold text-chart-3 tabular-nums leading-none">{chordName}</div>
                  </motion.div>

                  {/* locked indicator */}
                  {locked && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong">
                      <Lock className="h-3.5 w-3.5 text-chart-3" />
                      <span className="text-xs">Progression locked</span>
                    </motion.div>
                  )}

                  {/* solo indicator */}
                  {solo && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs capitalize">{solo} solo</span>
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>

            {error && (
              <div className="absolute bottom-3 left-3 right-3 px-4 py-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive">{error}</div>
            )}
          </div>

          {/* ---- side panel ---- */}
          <div className="flex flex-col gap-4">
            {/* tempo + intensity */}
            <div className="rounded-2xl glass-strong p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Tempo
                </span>
                <span className="text-2xl font-bold text-primary tabular-nums">{tempo}<span className="text-sm text-muted-foreground ml-1">BPM</span></span>
              </div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-4">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-200" style={{ width: `${((tempo - 60) / 120) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Intensity
                </span>
                <span className="text-sm font-bold text-chart-4 tabular-nums">{Math.round(intensity * 100)}%</span>
              </div>
              {/* energy meter */}
              <div className="flex items-end gap-1 h-12">
                {Array.from({ length: 16 }).map((_, i) => {
                  const active = (i / 16) < intensity;
                  return (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-sm"
                      animate={{
                        height: active ? `${20 + Math.sin(i + Date.now() / 200) * 15 + intensity * 30}%` : "20%",
                        backgroundColor: active ? (i > 12 ? "oklch(0.65 0.22 25)" : i > 8 ? "oklch(0.78 0.18 85)" : "oklch(0.72 0.19 155)") : "oklch(0.3 0 0)",
                      }}
                      transition={{ duration: 0.1 }}
                    />
                  );
                })}
              </div>
            </div>

            {/* layers */}
            <div className="rounded-2xl glass-strong p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" /> Layers
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LAYERS.map((l) => {
                  const on = activeLayers.includes(l.id);
                  const isSolo = solo === l.id;
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        "relative rounded-xl p-3 border transition-all",
                        on ? "border-primary/40 bg-primary/5" : "border-white/10 bg-white/[0.02] opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-medium", l.color)}>{l.label}</span>
                        {isSolo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">SOLO</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                        <span className="text-[10px] text-muted-foreground">{on ? "active" : "muted"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* mix indicator */}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Mix focus:</span>
                <span className="font-medium text-chart-2">{mixLabel}</span>
              </div>
            </div>

            {/* gesture map */}
            <div className="rounded-2xl glass p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Hand className="h-3.5 w-3.5" /> Gesture map
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <MapItem g="Open" a="All layers on" active={gesture === "open"} />
                <MapItem g="Fist" a="Mute drums" active={gesture === "fist"} />
                <MapItem g="Pinch" a="Lock progression" active={gesture === "pinch"} />
                <MapItem g="Point" a="Solo piano" active={gesture === "point"} />
              </div>
            </div>

            {/* start/stop */}
            {!running ? (
              <button onClick={start} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-chart-4 text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-cyan disabled:opacity-50" style={{ backgroundColor: "oklch(0.62 0.22 305)" }}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                {loading ? "Loading…" : "Start Conducting"}
              </button>
            ) : (
              <button onClick={stop} className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all">
                <Pause className="h-5 w-5" /> Stop
              </button>
            )}
          </div>
        </div>

        {/* instructions */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: "↕", title: "Hand height", desc: "Up = faster tempo, down = slower" },
            { icon: "↔", title: "Hand X", desc: "Left = strings, right = pads" },
            { icon: "⚡", title: "Movement speed", desc: "Calm = soft, fast = epic" },
            { icon: "✋", title: "Gestures", desc: "Open/Fist/Pinch/Point" },
          ].map((c) => (
            <div key={c.title} className="rounded-xl glass p-4">
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-sm font-medium">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Audio is synthesized live with Tone.js — there are no pre-recorded tracks. Camera + audio run entirely on your device.
        </p>
      </div>
    </div>
  );
}

function MapItem({ g, a, active }: { g: string; a: string; active: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors", active ? "bg-primary/15" : "bg-white/[0.02]")}>
      <span className={cn("font-mono font-bold", active ? "text-primary" : "text-muted-foreground")}>{g}</span>
      <span className="text-muted-foreground">{a}</span>
    </div>
  );
}
