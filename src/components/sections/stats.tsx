"use client";

import { motion } from "framer-motion";

const STATS = [
  { value: "21", label: "hand landmarks tracked" },
  { value: "~10ms", label: "per-frame inference" },
  { value: "4", label: "core gestures" },
  { value: "0", label: "cloud dependencies" },
];

export function Stats() {
  return (
    <section className="relative py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center rounded-2xl glass py-6"
            >
              <div className="text-3xl sm:text-4xl font-bold text-gradient tabular-nums">
                {s.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
