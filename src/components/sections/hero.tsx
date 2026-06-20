"use client";

import { motion } from "framer-motion";
import {
  Hand, MousePointerClick, Volume2, Github, Download, ChevronRight,
  Music, Sparkles, ArrowRight, Palette, Fingerprint, Piano as PianoIcon,
} from "lucide-react";
import { useHub } from "@/lib/gesture/hub-context";
import { cn } from "@/lib/utils";

const TOOLS = [
  {
    id: "cursor" as const,
    icon: MousePointerClick,
    title: "Cursor Control",
    tagline: "A touchless mouse, in your browser",
    desc: "Move a virtual cursor with your index finger, click by tucking your thumb, drag cards, toggle switches, and paint on a canvas — all with hand gestures. Fully interactive playground.",
    color: "text-primary",
    glow: "from-emerald-500/30",
  },
  {
    id: "canvas" as const,
    icon: Palette,
    title: "Air Canvas",
    tagline: "Paint in the air with your finger",
    desc: "A full-screen gesture drawing studio. Point to paint, pinch to lift the brush, open your hand to erase, make a fist to clear. Eight colors, adjustable brush, undo, and PNG export.",
    color: "text-chart-2",
    glow: "from-cyan-500/30",
  },
  {
    id: "orchestra" as const,
    icon: Music,
    title: "AI Conducting Orchestra",
    tagline: "Conduct generative music with both hands",
    desc: "A real-time procedural music engine powered by Tone.js. Right hand sets tempo & melody; left hand sets dynamics & harmony. Four scales, four progressions, five layers, drop button. No recordings.",
    color: "text-chart-4",
    glow: "from-fuchsia-500/30",
  },
  {
    id: "piano" as const,
    icon: PianoIcon,
    title: "Gesture Piano",
    tagline: "Play a virtual piano in the air",
    desc: "A 1.5-octave keyboard you play by pinching over the keys. Four instruments (piano/synth/bell/pluck), volume, octave shift, C-major scale highlighting, and record + playback.",
    color: "text-chart-1",
    glow: "from-orange-500/30",
  },
  {
    id: "lab" as const,
    icon: Fingerprint,
    title: "Hand Lab",
    tagline: "Inspect all 21 landmarks in real time",
    desc: "An educational + developer visualizer: depth-shaded 2D skeleton, a rotating 3D projection, per-finger extension angles, and live FPS. See exactly what MediaPipe sees.",
    color: "text-chart-3",
    glow: "from-amber-500/30",
  },
];

export function Hero() {
  const { go } = useHub();
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 grid-bg grid-bg-fade" />
      <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
      <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-chart-2/20 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-80 w-[40rem] rounded-full bg-chart-3/10 blur-3xl animate-blob" style={{ animationDelay: "8s" }} />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-muted-foreground mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          A hub for webcam-powered gesture tools · MediaPipe · Tone.js
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95]"
        >
          Control your PC
          <br />
          with <span className="text-gradient">bare hands</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          A growing collection of browser-based tools that turn any webcam into
          a gesture interface — control a cursor, conduct an orchestra, and more.
          No install, no accounts, everything runs locally.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={() => go("cursor")}
            className="group flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-emerald"
          >
            <Hand className="h-5 w-5" />
            Launch Cursor Control
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => go("canvas")}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all"
          >
            <Palette className="h-5 w-5 text-chart-2" />
            Try Air Canvas
          </button>
        </motion.div>

        {/* tools showcase */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto"
        >
          {TOOLS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={cn(
                "group relative text-left rounded-2xl glass-strong p-6 overflow-hidden hover:-translate-y-1 transition-all duration-300",
                i === 4 && "lg:col-span-3"
              )}
            >
              <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${t.glow} to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl glass">
                    <t.icon className={`h-6 w-6 ${t.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t.title}</h3>
                    <p className={`text-xs ${t.color}`}>{t.tagline}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            </button>
          ))}
        </motion.div>

        {/* mini feature cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          {["21-point tracking", "~10ms inference", "Real-time audio", "No cloud", "Open source"].map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              {f}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
