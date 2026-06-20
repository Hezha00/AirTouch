"use client";

import { motion } from "framer-motion";
import {
  MousePointerClick, Volume2, Activity, Zap, Shield, Eye,
  Crosshair, Layers, Cpu,
} from "lucide-react";

const FEATURES = [
  {
    icon: Crosshair,
    title: "Anti-jitter EMA smoothing",
    desc: "An exponential moving average filters out hand tremors and frame-drop stutter, so the cursor glides fluidly instead of vibrating.",
    color: "text-primary",
  },
  {
    icon: MousePointerClick,
    title: "True mouse-button clicks",
    desc: "Tuck your thumb to press, release to lift. Hold to drag, double-tap to double-click — it behaves exactly like a physical button.",
    color: "text-chart-2",
  },
  {
    icon: Volume2,
    title: "Proximity volume control",
    desc: "Open palm and push toward the camera to raise volume, pull back to lower. Depth is inferred from hand-size changes — no extra sensors.",
    color: "text-chart-4",
  },
  {
    icon: Eye,
    title: "21-point hand skeleton",
    desc: "Every joint is tracked and rendered live. The index-fingertip drives the cursor; the thumb-to-index-MCP distance drives clicks.",
    color: "text-chart-3",
  },
  {
    icon: Activity,
    title: "Depth-invariant thresholds",
    desc: "All pinch distances are normalised by the wrist-to-MCP reference size, so thresholds stay correct no matter how close or far your hand is.",
    color: "text-chart-1",
  },
  {
    icon: Zap,
    title: "Zero cooldowns",
    desc: "Actions respond the instant your hand forms a gesture. No artificial delays — just real-time, level-triggered control.",
    color: "text-chart-5",
  },
  {
    icon: Cpu,
    title: "Single-process & lightweight",
    desc: "One Python process, one MediaPipe model, one OpenCV window. Runs comfortably on a laptop CPU with the XNNPACK delegate.",
    color: "text-primary",
  },
  {
    icon: Layers,
    title: "Active bounding box",
    desc: "Only the centre of the camera frame maps to the screen, so you never have to stretch your arm to reach the display edges.",
    color: "text-chart-2",
  },
  {
    icon: Shield,
    title: "Failsafe & private",
    desc: "PyAutoGUI's corner-abort is always one move away, and every frame stays on your machine — nothing is uploaded anywhere.",
    color: "text-chart-4",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">Why AirTouch</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Engineered for <span className="text-gradient">precision</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every detail — from depth normalisation to hysteresis bands — is tuned
            so the cursor feels like an extension of your hand, not a novelty toy.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group relative rounded-2xl glass p-6 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="inline-flex p-2.5 rounded-xl bg-white/5 mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
