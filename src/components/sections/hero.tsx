"use client";

import { motion } from "framer-motion";
import { Hand, MousePointerClick, Volume2, Github, Download, ChevronRight } from "lucide-react";

export function Hero() {
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* animated background blobs */}
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
          Open-source · MediaPipe · Python + OpenCV
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95]"
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
          AirTouch turns any webcam into a touchless mouse. Move the cursor,
          click, drag, scroll, and adjust volume — all with hand gestures
          recognized by computer vision. No special hardware, no wearables.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#demo"
            className="group flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium hover:brightness-110 transition-all hover:glow-emerald"
          >
            <Hand className="h-5 w-5" />
            Try the live demo
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#setup"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl glass text-foreground font-medium hover:bg-white/10 transition-all"
          >
            <Download className="h-5 w-5" />
            Download &amp; setup
          </a>
        </motion.div>

        {/* floating gesture preview cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid grid-cols-3 gap-3 sm:gap-6 max-w-2xl mx-auto"
        >
          {[
            { icon: MousePointerClick, label: "Click & Drag", color: "text-chart-2", delay: "0s" },
            { icon: Volume2, label: "Volume", color: "text-chart-4", delay: "1s" },
            { icon: Hand, label: "21-point tracking", color: "text-primary", delay: "2s" },
          ].map((item) => (
            <div
              key={item.label}
              className="glass rounded-xl p-4 sm:p-5 flex flex-col items-center gap-2 animate-float"
              style={{ animationDelay: item.delay }}
            >
              <item.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${item.color}`} />
              <span className="text-xs sm:text-sm text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
