"use client";

import { motion } from "framer-motion";
import {
  Hand, ChevronRight, Sparkles, ArrowRight,
  Palette, Fingerprint, Piano as PianoIcon, Languages, FileText, Drum, Music, MousePointerClick,
} from "lucide-react";
import { useHub } from "@/lib/gesture/hub-context";
import { useI18n } from "@/lib/gesture/i18n-context";
import { cn } from "@/lib/utils";

const TOOLS = [
  { id: "cursor" as const, icon: MousePointerClick, titleKey: "tool.cursor.title", tagKey: "tool.cursor.tag", descKey: "tool.cursor.desc", color: "text-primary", glow: "from-emerald-500/30" },
  { id: "canvas" as const, icon: Palette, titleKey: "tool.canvas.title", tagKey: "tool.canvas.tag", descKey: "tool.canvas.desc", color: "text-chart-2", glow: "from-cyan-500/30" },
  { id: "whiteboard" as const, icon: FileText, titleKey: "tool.whiteboard.title", tagKey: "tool.whiteboard.tag", descKey: "tool.whiteboard.desc", color: "text-chart-3", glow: "from-amber-500/30" },
  { id: "orchestra" as const, icon: Music, titleKey: "tool.orchestra.title", tagKey: "tool.orchestra.tag", descKey: "tool.orchestra.desc", color: "text-chart-4", glow: "from-fuchsia-500/30" },
  { id: "piano" as const, icon: PianoIcon, titleKey: "tool.piano.title", tagKey: "tool.piano.tag", descKey: "tool.piano.desc", color: "text-chart-1", glow: "from-orange-500/30" },
  { id: "drumkit" as const, icon: Drum, titleKey: "tool.drumkit.title", tagKey: "tool.drumkit.tag", descKey: "tool.drumkit.desc", color: "text-chart-5", glow: "from-rose-500/30" },
  { id: "sign" as const, icon: Languages, titleKey: "tool.sign.title", tagKey: "tool.sign.tag", descKey: "tool.sign.desc", color: "text-chart-5", glow: "from-violet-500/30" },
  { id: "lab" as const, icon: Fingerprint, titleKey: "tool.lab.title", tagKey: "tool.lab.tag", descKey: "tool.lab.desc", color: "text-chart-2", glow: "from-teal-500/30" },
];

export function Hero() {
  const { go } = useHub();
  const { t } = useI18n();
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
          {t("hero.badge")}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95]"
        >
          {t("hero.title1")}
          <br />
          <span className="text-gradient">{t("hero.title2")}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          {t("hero.desc")}
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
            {t("hero.cta1")}
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => go("canvas")}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all"
          >
            <Palette className="h-5 w-5 text-chart-2" />
            {t("hero.cta2")}
          </button>
        </motion.div>

        {/* tools showcase */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto"
        >
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => go(tool.id)}
              className="group relative text-left rounded-2xl glass-strong p-6 overflow-hidden hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${tool.glow} to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl glass">
                    <tool.icon className={`h-6 w-6 ${tool.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t(tool.titleKey)}</h3>
                    <p className={`text-xs ${tool.color}`}>{t(tool.tagKey)}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(tool.descKey)}</p>
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
          {["21-point tracking", "~10ms inference", "Real-time audio", "No cloud", "Hezha Khaledi"].map((f) => (
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
