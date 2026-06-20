"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, Music, Play, Square, Trash2,
  Hand, Volume2, Piano as PianoIcon, Sparkles, ChevronRight,
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

// 1.5 octaves of notes (C4 to G5), with black-key positions
type Key = { note: string; isBlack: boolean; label: string };
const KEYS: Key[] = [
  { note: "C4", isBlack: false, label: "C" },
  { note: "C#4", isBlack: true, label: "" },
  { note: "D4", isBlack: false, label: "D" },
  { note: "D#4", isBlack: true, label: "" },
  { note: "E4", isBlack: false, label: "E" },
  { note: "F4", isBlack: false, label: "F" },
  { note: "F#4", isBlack: true, label: "" },
  { note: "G4", isBlack: false, label: "G" },
  { note: "G#4", isBlack: true, label: "" },
  { note: "A4", isBlack: false, label: "A" },
  { note: "A#4", isBlack: true, label: "" },
  { note: "B4", isBlack: false, label: "B" },
  { note: "C5", isBlack: false, label: "C" },
  { note: "C#5", isBlack: true, label: "" },
  { note: "D5", isBlack: false, label: "D" },
  { note: "D#5", isBlack: true, label: "" },
  { note: "E5", isBlack: false, label: "E" },
  { note: "F5", isBlack: false, label: "F" },
];

// scale highlighting (C major)
const C_MAJOR = new Set(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"]);

const INSTRUMENTS = [
  { id: "piano", label: "Piano", osc: "triangle" as const },
  { id: "synth", label: "Synth", osc: "sawtooth" as const },
  { id: "bell", label: "Bell", osc: "sine" as const },
  { id: "pluck", label: "Pluck", osc: "square" as const },
];

function isPinch(lm: Landmark[] | null): boolean {
  if (!lm) return false;
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-6;
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / ref < 0.4;
}

export function PianoView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const activeNotesRef = useRef<Set<string>>(new Set());
  const prevPinchRef = useRef(false);
  const recordingRef = useRef<{ note: string; time: number; on: boolean }[]>([]);
  const isRecordingRef = useRef(false);
  const recordStartRef = useRef(0);
  const playbackRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState("idle");
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [instrument, setInstrument] = useState("piano");
  const [volume, setVolume] = useState(0.6);
  const [showScale, setShowScale] = useState(true);
  const [octave, setOctave] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [noteCount, setNoteCount] = useState(0);

  // init audio
  const initAudio = useCallback(async () => {
    if (synthRef.current) return;
    await Tone.start();
    reverbRef.current = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).toDestination();
    const gain = new Tone.Gain(volume).connect(reverbRef.current);
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: INSTRUMENTS[0].osc },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 1.2 },
      volume: -8,
    }).connect(gain);
  }, [volume]);

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
        // highlight pinch
        const pinch = isPinch(lm);
        ctx.strokeStyle = pinch ? "#00ff8c" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lm[8].x * w, lm[8].y * hh, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // virtual cursor + key hit-testing
    const kb = keyboardRef.current;
    const cur = cursorRef.current;
    if (!kb || !cur) return;

    if (h.present && lm) {
      const rect = kb.getBoundingClientRect();
      // map hand x to keyboard width (full width)
      const px = h.x;
      const py = h.y;
      const cx = rect.left + px * rect.width;
      const cy = rect.top + py * rect.height;
      cur.style.left = `${cx}px`;
      cur.style.top = `${cy}px`;
      cur.style.opacity = "1";

      const pinch = isPinch(lm);
      setGesture(pinch ? "pinch (play)" : "open (move)");

      // hit-test which key the cursor is over
      const overKey = (() => {
        if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return null;
        // map x to key index
        const relX = (cx - rect.left) / rect.width;
        // white keys: 11 across (C4,D4,E4,F4,G4,A4,B4,C5,D5,E5,F5)
        const whiteNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"];
        const whiteIdx = Math.min(10, Math.floor(relX * 11));
        // check if in upper portion (black keys)
        const relY = (cy - rect.top) / rect.height;
        if (relY < 0.55) {
          // black key zone — check approximate positions
          const blackPositions: { idx: number; note: string }[] = [
            { idx: 0, note: "C#4" }, { idx: 1, note: "D#4" }, { idx: 3, note: "F#4" },
            { idx: 4, note: "G#4" }, { idx: 5, note: "A#4" }, { idx: 7, note: "C#5" },
            { idx: 8, note: "D#5" },
          ];
          // each white key is ~9.09% wide; black keys sit between certain whites
          const blackX = relX * 11;
          for (const b of blackPositions) {
            if (Math.abs(blackX - (b.idx + 0.5)) < 0.35) return b.note;
          }
        }
        return whiteNotes[whiteIdx];
      })();

      setHoveredKey(overKey);

      // pinch edge -> play/stop notes
      if (pinch && !prevPinchRef.current) {
        // pinch started — play the hovered key
        if (overKey && synthRef.current && !activeNotesRef.current.has(overKey)) {
          synthRef.current.triggerAttack(overKey);
          activeNotesRef.current.add(overKey);
          setActiveNotes(new Set(activeNotesRef.current));
          setNoteCount((n) => n + 1);
          if (isRecordingRef.current) {
            recordingRef.current.push({ note: overKey, time: performance.now() - recordStartRef.current, on: true });
          }
        }
      } else if (!pinch && prevPinchRef.current) {
        // pinch released — release all active notes
        if (synthRef.current && activeNotesRef.current.size > 0) {
          synthRef.current.releaseAll();
          if (isRecordingRef.current) {
            for (const n of activeNotesRef.current) {
              recordingRef.current.push({ note: n, time: performance.now() - recordStartRef.current, on: false });
            }
          }
          activeNotesRef.current.clear();
          setActiveNotes(new Set());
        }
      }
      prevPinchRef.current = pinch;
    } else {
      if (cur) cur.style.opacity = "0";
      setGesture("idle");
      setHoveredKey(null);
      // release on hand loss
      if (activeNotesRef.current.size > 0 && synthRef.current) {
        synthRef.current.releaseAll();
        activeNotesRef.current.clear();
        setActiveNotes(new Set());
      }
    }
  }, []);

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
    if (synthRef.current) synthRef.current.releaseAll();
    activeNotesRef.current.clear();
    setActiveNotes(new Set());
  };

  useEffect(() => {
    return () => {
      synthRef.current?.dispose();
      reverbRef.current?.dispose();
    };
  }, []);

  // instrument change
  const onInstrument = (id: string) => {
    setInstrument(id);
    if (synthRef.current) {
      const inst = INSTRUMENTS.find((i) => i.id === id)!;
      synthRef.current.set({ oscillator: { type: inst.osc } });
    }
  };

  // volume change
  const onVolume = (v: number) => {
    setVolume(v);
    if (synthRef.current) {
      synthRef.current.volume.rampTo(-20 + v * 18, 0.1);
    }
  };

  // click a key with mouse (for testing without camera)
  const clickKey = (note: string) => {
    if (!synthRef.current) return;
    synthRef.current.triggerAttackRelease(note, "8n");
    setNoteCount((n) => n + 1);
    setActiveNotes((s) => { const n = new Set(s); n.add(note); return n; });
    setTimeout(() => setActiveNotes((s) => { const n = new Set(s); n.delete(note); return n; }), 300);
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
    if (recordingRef.current.length === 0 || !synthRef.current) return;
    setIsPlaying(true);
    playbackRef.current = true;
    const startT = performance.now();
    for (const ev of recordingRef.current) {
      const delay = ev.time - (performance.now() - startT);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (!playbackRef.current) break;
      if (ev.on) synthRef.current.triggerAttack(ev.note);
      else synthRef.current.triggerRelease(ev.note);
    }
    synthRef.current.releaseAll();
    playbackRef.current = false;
    setIsPlaying(false);
  };

  const stopPlayback = () => {
    playbackRef.current = false;
    setIsPlaying(false);
    synthRef.current?.releaseAll();
  };

  const clearRecording = () => {
    recordingRef.current = [];
    setHasRecording(false);
  };

  // adjust notes by octave
  const shiftNote = (note: string, oct: number) => {
    const m = note.match(/^([A-G]#?)(\d)$/);
    if (!m) return note;
    return m[1] + (parseInt(m[2]) + oct);
  };

  return (
    <div className="relative min-h-screen pt-16 sm:pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Gesture <span className="text-gradient">Piano</span>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Play a virtual piano in the air. Move your hand over the keys, pinch to strike. Multi-note chords, 4 instruments, record &amp; playback.
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

        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          {/* ---- main area ---- */}
          <div className="flex flex-col gap-3">
            {/* camera */}
            <div className="relative rounded-xl overflow-hidden glass-strong aspect-video bg-black h-40 sm:h-48">
              <video ref={tracking.videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center grid-bg">
                  <PianoIcon className="h-10 w-10 text-primary/50" />
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

            {/* the keyboard */}
            <div className="relative">
              <div
                ref={keyboardRef}
                className="relative h-48 sm:h-56 rounded-xl overflow-hidden glass-strong select-none"
              >
                {/* white keys */}
                <div className="absolute inset-0 flex">
                  {KEYS.filter((k) => !k.isBlack).map((k) => {
                    const note = shiftNote(k.note, octave);
                    const active = activeNotes.has(note);
                    const hovered = hoveredKey === note;
                    const inScale = !showScale || C_MAJOR.has(note);
                    return (
                      <button
                        key={k.note}
                        onMouseDown={() => clickKey(note)}
                        className={cn(
                          "relative flex-1 border-r border-black/30 flex items-end justify-center pb-3 transition-colors",
                          active ? "bg-primary" : hovered ? "bg-primary/20" : "bg-white/90 hover:bg-white",
                          !inScale && "opacity-40"
                        )}
                      >
                        <span className={cn("text-xs font-mono", active ? "text-primary-foreground" : "text-black/50")}>{k.label}{note.slice(-1)}</span>
                      </button>
                    );
                  })}
                </div>
                {/* black keys */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {KEYS.filter((k) => !k.isBlack).map((k, i) => {
                    const whiteCount = KEYS.filter((x) => !x.isBlack).length;
                    const w = 100 / whiteCount;
                    // find black key that sits after this white key
                    const idx = KEYS.indexOf(k);
                    const nextBlack = KEYS[idx + 1];
                    if (!nextBlack || !nextBlack.isBlack) return null;
                    const note = shiftNote(nextBlack.note, octave);
                    const active = activeNotes.has(note);
                    const hovered = hoveredKey === note;
                    const inScale = !showScale || C_MAJOR.has(note);
                    return (
                      <div
                        key={nextBlack.note}
                        className={cn(
                          "absolute h-[58%] rounded-b-md border border-black/50 transition-colors",
                          active ? "bg-primary" : hovered ? "bg-primary/40" : "bg-black/90",
                          !inScale && "opacity-30"
                        )}
                        style={{ left: `${(i + 1) * w - w * 0.18}%`, width: `${w * 0.36}%`, top: 0 }}
                      />
                    );
                  })}
                </div>
              </div>
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
                {hasRecording && <span>{recordingRef.current.length} events</span>}
              </div>
            </div>
          </div>

          {/* ---- sidebar ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {/* instrument */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PianoIcon className="h-3.5 w-3.5" /> Instrument
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INSTRUMENTS.map((i) => (
                  <button key={i.id} onClick={() => onInstrument(i.id)} className={cn("px-3 py-2 rounded-lg text-xs font-medium transition-colors", instrument === i.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground")}>
                    {i.label}
                  </button>
                ))}
              </div>
            </div>

            {/* volume */}
            <div className="rounded-xl glass-strong p-4 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Volume</span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">{Math.round(volume * 100)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(parseFloat(e.target.value))} className="w-full accent-primary h-1.5" />
            </div>

            {/* octave */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Octave</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setOctave((o) => Math.max(-2, o - 1))} className="px-3 py-1.5 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors">−</button>
                <span className="flex-1 text-center text-sm font-mono tabular-nums">{octave > 0 ? `+${octave}` : octave}</span>
                <button onClick={() => setOctave((o) => Math.min(2, o + 1))} className="px-3 py-1.5 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors">+</button>
              </div>
            </div>

            {/* scale highlight */}
            <div className="rounded-xl glass-strong p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">C Major guide</div>
              <button onClick={() => setShowScale((s) => !s)} className={cn("w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors", showScale ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground")}>
                {showScale ? "ON" : "OFF"}
              </button>
            </div>

            {/* gesture guide */}
            <div className="rounded-xl glass p-3 text-xs space-y-1.5 col-span-2 lg:col-span-1">
              <p className="font-medium flex items-center gap-1.5 text-muted-foreground"><Hand className="h-3.5 w-3.5 text-primary" /> How to play</p>
              <div className="text-muted-foreground space-y-0.5">
                <p>✋ Move hand over keys</p>
                <p>🤏 Pinch to strike a note</p>
                <p>✊ Hold pinch for chords</p>
              </div>
            </div>

            {/* stats */}
            <div className="rounded-xl glass p-3 text-center col-span-2 lg:col-span-1">
              <div className="text-2xl font-bold text-primary tabular-nums">{noteCount}</div>
              <div className="text-xs text-muted-foreground">notes played</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Sparkles className="inline h-3 w-3 text-primary mr-1" />
          Audio synthesized live with Tone.js. Click keys with your mouse too — no camera required to test the sounds.
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
