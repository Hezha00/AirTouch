"use client";

import { motion } from "framer-motion";
import { Camera, Cpu, MousePointer2, Monitor } from "lucide-react";

const STEPS = [
  {
    icon: Camera,
    step: "01",
    title: "Capture",
    desc: "OpenCV grabs each frame from your webcam and flips it horizontally for a natural selfie view.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Detect",
    desc: "MediaPipe's HandLandmarker infers all 21 hand joints in ~10 ms per frame on a laptop CPU.",
  },
  {
    icon: MousePointer2,
    step: "03",
    title: "Map & smooth",
    desc: "The index fingertip is mapped through a centre bounding box to the screen, then EMA-smoothed.",
  },
  {
    icon: Monitor,
    step: "04",
    title: "Act",
    desc: "A level-triggered state machine fires mouseDown / mouseUp / scroll / volume through PyAutoGUI.",
  },
];

const TECH = [
  { name: "Python 3.10+", role: "Runtime" },
  { name: "OpenCV", role: "Camera + UI" },
  { name: "MediaPipe", role: "Hand tracking" },
  { name: "PyAutoGUI", role: "System control" },
  { name: "NumPy", role: "Math + smoothing" },
  { name: "pycaw", role: "Windows volume" },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">Under the hood</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            From pixels to <span className="text-gradient">pointer</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Four stages, one process, zero external services. The entire pipeline
            runs on your machine in a single Python process.
          </p>
        </motion.div>

        {/* pipeline */}
        <div className="relative grid md:grid-cols-4 gap-6 mb-20">
          {/* connecting line */}
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {STEPS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative text-center"
            >
              <div className="relative inline-flex mb-5">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <div className="relative p-4 rounded-2xl glass-strong">
                  <s.icon className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="text-xs font-mono text-primary/60 mb-1">{s.step}</div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* tech stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="rounded-2xl glass p-8"
        >
          <h3 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
            Built with
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {TECH.map((t) => (
              <div key={t.name} className="text-center group">
                <div className="font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.role}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
