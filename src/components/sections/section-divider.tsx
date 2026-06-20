"use client";

import { motion } from "framer-motion";

/** A subtle animated gradient divider used between home sections. */
export function SectionDivider() {
  return (
    <div className="relative mx-auto max-w-5xl px-4 py-2">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent origin-center"
      />
    </div>
  );
}
