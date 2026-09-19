"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hand, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#demo", label: "Live Demo" },
  { href: "#features", label: "Features" },
  { href: "#gestures", label: "Gestures" },
  { href: "#how", label: "How It Works" },
  { href: "#setup", label: "Setup" },
  { href: "#ideas", label: "Expand" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "glass-strong border-b border-border/50" : "bg-transparent"
      )}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 blur-md rounded-lg group-hover:bg-primary/60 transition-colors" />
              <Hand className="relative h-6 w-6 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Air<span className="text-gradient">Touch</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="#setup"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all hover:glow-emerald"
            >
              Get Started
            </a>
          </div>

          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="md:hidden pb-4 flex flex-col gap-1"
          >
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#setup"
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground text-center"
            >
              Get Started
            </a>
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
}
