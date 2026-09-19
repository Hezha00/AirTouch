"use client";

import { motion } from "framer-motion";
import { Hand, MousePointer2, SquareMousePointer, Volume2, Move } from "lucide-react";

const GESTURES = [
  {
    icon: Move,
    title: "Move cursor",
    pose: "Index finger only",
    desc: "Point with your index finger. The fingertip drives the cursor; an EMA filter smooths out jitter.",
    accent: "from-emerald-500/20 to-emerald-500/0",
    iconColor: "text-primary",
  },
  {
    icon: MousePointer2,
    title: "Left click / drag",
    pose: "Thumb tip → index knuckle",
    desc: "Tuck your thumb to the base of your index finger. Hold to keep the button down and drag; release to click. Double-tap = double-click.",
    accent: "from-cyan-500/20 to-cyan-500/0",
    iconColor: "text-chart-2",
  },
  {
    icon: SquareMousePointer,
    title: "Right click",
    pose: "Thumb + middle pinch",
    desc: "Pinch your thumb and middle fingertips together while keeping the index extended. The cursor freezes during the click so it lands exactly where you aimed.",
    accent: "from-orange-500/20 to-orange-500/0",
    iconColor: "text-chart-3",
  },
  {
    icon: Volume2,
    title: "Volume up / down",
    pose: "Open palm — push / pull",
    desc: "Open your hand fully, then push it toward the camera to raise the volume or pull it back to lower. Each nudge fires multiple key presses for fast changes.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/0",
    iconColor: "text-chart-4",
  },
];

export function GestureGuide() {
  return (
    <section id="gestures" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 grid-bg grid-bg-fade opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">The gesture set</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Four gestures. <span className="text-gradient">Full control.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            A deliberately minimal vocabulary so every action is unmistakable.
            No combos to memorise, no cooldowns to fight.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5">
          {GESTURES.map((g, i) => (
            <motion.div
              key={g.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative rounded-2xl glass-strong p-6 sm:p-8 overflow-hidden hover:-translate-y-1 transition-transform duration-300"
            >
              <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${g.accent} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />

              <div className="relative flex items-start gap-5">
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/5 blur-xl rounded-2xl" />
                    <div className="relative p-4 rounded-2xl glass">
                      <g.icon className={`h-8 w-8 ${g.iconColor}`} />
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-bold text-xl">{g.title}</h3>
                  </div>
                  <p className={`text-sm font-medium ${g.iconColor} mb-2`}>{g.pose}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Hand className="h-4 w-4 text-primary" />
          The camera feed is mirrored, so left and right feel natural — just like a selfie.
        </motion.div>
      </div>
    </section>
  );
}
