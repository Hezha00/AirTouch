"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Music, Play, Square, Trash2,
  Hand, Volume2, Drum, Sparkles, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHandTracking, type HandState, type Landmark } from "@/lib/gesture/use-hand-tracking";
import * as Tone from "tone";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

type DrumPad = {
  id: string;
  label: string;
  color: string;
  // Tone.js synth setup
  create: () => Tone.ToneAudioNode;
  trigger: (node: Tone.ToneAudioNode, vel: number) => void;
};

const PADS: DrumPad[] = [
  {
    id: "kick", label: "Kick", color: "#ff3366",
    create: () => new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -4 }),
    trigger: (n, v) => (n as Tone.MembraneSynth).triggerAttackRelease("C1", "8n", undefined, v),
  },
  {
    id: "snare", label: "Snare", color: "#ffaa00",
    create: () => new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -8 }),
    trigger: (n, v) => (n as Tone.NoiseSynth).triggerAttackRelease("8n", undefined, v),
  },
  {
    id: "hihat", label: "Hi-Hat", color: "#00d4ff",
    create: () => new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, volume: -18 }),
    trigger: (n, v) => (n as Tone.MetalSynth).triggerAttackRelease("C5", "32n", undefined, v),
  },
  {
    id: "tom1", label: "Tom Hi", color: "#00ff8c",
    create: () => new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -6 }),
    trigger: (n, v) => (n as Tone.MembraneSynth).triggerAttackRelease("G2", "8n", undefined, v),
  },
  {
    id: "tom2", label: "Tom Lo", color: "#aa66ff",
    create: () => new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -6 }),
    trigger: (n, v) => (n as Tone.MembraneSynth).triggerAttackRelease("C2", "8n", undefined, v),
  },
  {
    id: "cymbal", label: "Cymbal", color: "#ffffff",
    create: () => new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 1, release: 0.5 }, harmonicity: 3.1, modulationIndex: 20, resonance: 6000, octaves: 2, volume: -16 }),
    trigger: (n, v) => (n as Tone.MetalSynth).triggerAttackRelease("C4", "2n", undefined, v),
  },
];

function isPinch(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / ref < 0.4;
}

export function DrumkitView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const padAreaRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const synthsRef = useRef<Record<string, Tone.ToneAudioNode | null>>({});
  const masterGainRef = useRef<Tone.Gain | null>(null);
  const prevPinchRef = useRef(false);
  const recordingRef = useRef<{ pad: string; time: number; on: boolean }[]>([]);
  const isRecordingRef = useRef(false);
  const recordStartRef = useRef(0);
  const playbackRef = useRef(false);
  const lastHitPadRef = useRef<string | null>(null);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState("idle");
  const [volume, setVolume] = useState(0.7);
  const [hitPad, setHitPad] = useState<string | null>(null);
  const [hitCount, setHitCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredPad, setHoveredPad] = useState<string | null>(null);

  const initAudio = useCallback(async () => {
    if (masterGainRef.current) return;
    await Tone.start();
    const gain = new Tone.Gain(volume).toDestination();
    masterGainRef.current = gain;
    for (const pad of PADS) {
      const synth = pad.create();
      synth.connect(gain);
      synthsRef.current[pad.id] = synth;
    }
  }, [volume]);

  const triggerPad = useCallback((padId: string, vel = 0.8) => {
    const pad = PADS.find((p) => p.id === padId);
    const node = synthsRef.current[padId];
    if (!pad || !node) return;
    pad.trigger(node, vel);
    setHitPad(padId);
    setHitCount((c) => c + 1);
    setTimeout(() => setHitPad((h) => (h === padId ? null : h)), 120);
    if (isRecordingRef.current) {
      recordingRef.current.push({ pad: padId, time: performance.now() - recordStartRef.current, on: true });
    }
  }, []);

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
        const pinch = isPinch(lm);
        ctx.strokeStyle = pinch ? "#00ff8c" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lm[8].x * w, lm[8].y * hh, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const pa = padAreaRef.current;
    const cur = cursorRef.current;
    if (!pa || !cur) return;

    if (h.present && lm) {
      const rect = pa.getBoundingClientRect();
      const cx = rect.left + h.x * rect.width;
      const cy = rect.top + h.y * rect.height;
      cur.style.left = `${cx}px`;
      cur.style.top = `${cy}px`;
      cur.style.opacity = "1";

      const pinch = isPinch(lm);
      setGesture(pinch ? "pinch (hit)" : "move");

      // hit-test which pad the cursor is over
      const relX = h.x;
      const relY = h.y;
      // 3 cols x 2 rows
      const col = Math.min(2, Math.floor(relX * 3));
      const row = Math.min(1, Math.floor(relY * 2));
      const padIdx = row * 3 + col;
      const overPad = PADS[padIdx]?.id || null;
      setHoveredPad(overPad);

      // pinch edge -> hit the pad
      if (pinch && !prevPinchRef.current) {
        if (overPad && overPad !== lastHitPadRef.current) {
          triggerPad(overPad, 0.7 + h.velocity * 0.3);
          lastHitPadRef.current = overPad;
        }
      }
      if (!pinch && prevPinchRef.current) {
        lastHitPadRef.current = null;
      }
      prevPinchRef.current = pinch;
    } else {
      if (cur) cur.style.opacity = "0";
      setGesture("idle");
      setHoveredPad(null);
      prevPinchRef.current = false;
      lastHitPadRef.current = null;
    }
  }, [triggerPad]);

  const tracking = useHandTracking({ onFrame, smoothing: 0.5 });
  useEffect(() => { videoRef.current = tracking.videoRef.current; });

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      await initAudio();
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
    setGesture("idle");
    setHoveredPad(null);
  };

  useEffect(() => {
    return () => {
      Object.values(synthsRef.current).forEach((s) => s?.dispose());
      masterGainRef.current?.dispose();
    };
  }, []);

  const onVolume = (v: number) => {
    setVolume(v);
    if (masterGainRef.current) masterGainRef.current.gain.rampTo(v, 0.1);
  };

  // click pad with mouse
  const clickPad = (padId: string) => {
    if (!synthsRef.current[padId]) return;
    triggerPad(padId);
  };

  // recording
  const toggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      isRecordingRef.current = false;
      if (recordingRef.current.length > 0) setHasRecording(true);
    } else {
      recordingRef.current = [];
      recordStartRef.current = performance.now();
      isRecordingRef.current = true;
      setIsRecording(true);
      setHasRecording(false);
    }
  };

  const playRecording = async () => {
    if (recordingRef.current.length === 0) return;
    setIsPlaying(true);
    playbackRef.current = true;
    const startT = performance.now();
    for (const ev of recordingRef.current) {
      const delay = ev.time - (performance.now() - startT);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (!playbackRef.current) break;
      if (ev.on) triggerPad(ev.pad, 0.8);
    }
    playbackRef.current = false;
    setIsPlaying(false);
  };

  const stopPlayback = () => {
    playbackRef.current = false;
    setIsPlaying(false);
  };

  const clearRecording = () => {
    recordingRef.current = [];
    setHasRecording(false);
  };

  return (
    <div className="relative min-h-screen pt-16 sm:pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Air <span className="text-gradient">Drumkit</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Play a 6-pad drum kit in the air. Move your hand over a pad and pinch to hit it. Record and playback your beats.
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

        <div className="grid lg:grid-cols-[1fr_260px] gap-4">
          {/* ---- main area ---- */}
          <div className="flex flex-col gap-3">
            {/* camera thumbnail */}
            <div className="relative rounded-xl overflow-hidden glass-strong aspect-video bg-black h-32 sm:h-40">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center grid-bg">
                  <Drum className="h-8 w-8 text-primary/40" />
                </div>
              )}
              {running && (
                <div className="absolute top-2 left-2 flex items-center gap-2 px-2.5 py-1 rounded-lg glass-strong">
                  <span className={cn("h-1.5 w-1.5 rounded-full", gesture.includes("pinch") ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                  <span className="text-xs font-medium">{gesture}</span>
                </div>
              )}
              {error && <div className="absolute bottom-2 left-2 right-2 px-3 py-2 rounded-lg bg-destructive/20 border border-destructive/40 text-xs text-destructive">{error}</div>}
            </div>

            {/* drum pad grid */}
            <div ref={padAreaRef} className="relative grid grid-cols-3 gap-3 rounded-2xl glass-strong p-4" style={{ minHeight: "340px" }}>
              {PADS.map((pad) => {
                const isHit = hitPad === pad.id;
                const isHovered = hoveredPad === pad.id;
                return (
                  <button
                    key={pad.id}
                    onClick={() => clickPad(pad.id)}
                    className={cn(
                      "relative rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-100 overflow-hidden",
                      isHit ? "scale-95" : "hover:scale-[1.02]",
                    )}
                    style={{
                      borderColor: isHit || isHovered ? pad.color : "rgba(255,255,255,0.1)",
                      backgroundColor: isHit ? pad.color + "40" : isHovered ? pad.color + "15" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    {/* hit flash */}
                    <AnimatePresence>
                      {isHit && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0.6 }}
                          animate={{ scale: 2, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute inset-0 rounded-2xl"
                          style={{ backgroundColor: pad.color }}
                        />
                      )}
                    </AnimatePresence>
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <div
                        className="h-12 w-12 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: pad.color, backgroundColor: pad.color + "20" }}
                      >
                        <Circle className="h-6 w-6" style={{ color: pad.color }} fill={isHit ? pad.color : "transparent"} />
                      </div>
                      <span className="text-sm font-bold" style={{ color: isHit || isHovered ? pad.color : "rgba(255,255,255,0.7)" }}>{pad.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* recording bar */}
            <div className="rounded-xl glass-strong p-3 flex items-center gap-3 flex-wrap">
              {!isRecording ? (
                <button onClick={toggleRecord} disabled={!running} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/20 text-destructive text-sm font-medium hover:bg-destructive/30 transition-colors disabled:opacity-40">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Record
                </button>
              ) : (
                <button onClick={toggleRecord} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium animate-pulse">
                  <Square className="h-3.5 w-3.5" /> Stop
                </button>
              )}
              {!isPlaying ? (
                <button onClick={playRecording} disabled={!hasRecording} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-40">
                  <Play className="h-3.5 w-3.5" /> Play
                </button>
              ) : (
                <button onClick={stopPlayback} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                  <Square className="h-3.5 w-3.5" /> Stop
                </button>
              )}
              <button onClick={clearRecording} disabled={!hasRecording} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-muted-foreground text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                {isRecording && <span className="text-destructive animate-pulse">● REC</span>}
                {hasRecording && <span>{recordingRef.current.length} hits</span>}
              </div>
            </div>
          </div>

          {/* ---- sidebar ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {/* volume */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Volume</span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">{Math.round(volume * 100)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(parseFloat(e.target.value))} className="w-full accent-primary h-1.5" />
            </div>

            {/* pad legend */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><Drum className="h-3.5 w-3.5" /> Pads</div>
              <div className="space-y-2">
                {PADS.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-foreground">{p.label}</span>
                    <span className="ml-auto text-muted-foreground">{p.id}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* gesture guide */}
            <div className="rounded-xl glass p-3 text-xs space-y-1.5 col-span-2 lg:col-span-1">
              <p className="font-medium flex items-center gap-1.5 text-muted-foreground"><Hand className="h-3.5 w-3.5 text-primary" /> How to play</p>
              <div className="text-muted-foreground space-y-0.5">
                <p>✋ Move hand over a pad</p>
                <p>🤏 Pinch to hit the pad</p>
                <p>🖱️ Or click pads with mouse</p>
              </div>
            </div>

            {/* stats */}
            <div className="rounded-xl glass p-3 text-center col-span-2 lg:col-span-1">
              <div className="text-2xl font-bold text-primary tabular-nums">{hitCount}</div>
              <div className="text-xs text-muted-foreground">hits</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Sparkles className="inline h-3 w-3 text-primary mr-1" />
          Six synthesized drum sounds — kick, snare, hi-hat, two toms, and a cymbal. All generated live with Tone.js.
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
