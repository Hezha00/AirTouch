"use client";

import { motion } from "framer-motion";
import { Fingerprint, Zap, Layers, CloudOff } from "lucide-react";

const STATS = [
  { icon: Fingerprint, value: "21", label: "hand landmarks tracked", color: "text-primary" },
  { icon: Zap, value: "~10ms", label: "per-frame inference", color: "text-chart-2" },
  { icon: Layers, value: "8", label: "interactive tools", color: "text-chart-4" },
  { icon: CloudOff, value: "0", label: "cloud dependencies", color: "text-chart-3" },
];

export function Stats() {
  return (
    <section className="relative py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group relative text-center rounded-2xl glass py-6 px-4 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <s.icon className={`h-5 w-5 mx-auto mb-2 ${s.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <div className="text-3xl sm:text-4xl font-bold text-gradient tabular-nums">
                  {s.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {s.label}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
