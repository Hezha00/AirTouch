"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hand, Home, MousePointer2, Music, Palette, Fingerprint, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHub, type ViewName } from "@/lib/gesture/hub-context";

const TOOLS: { id: ViewName; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Hub", icon: Home },
  { id: "cursor", label: "Cursor", icon: MousePointer2 },
  { id: "canvas", label: "Canvas", icon: Palette },
  { id: "orchestra", label: "Orchestra", icon: Music },
  { id: "lab", label: "Hand Lab", icon: Fingerprint },
];

export function HubNav() {
  const { view, go } = useHub();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
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
        <div className="flex h-16 items-center justify-between gap-4">
          <button onClick={() => go("home")} className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 blur-md rounded-lg group-hover:bg-primary/60 transition-colors" />
              <Hand className="relative h-6 w-6 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline">
              Air<span className="text-gradient">Touch</span>
            </span>
            <span className="text-xs text-muted-foreground ml-1 hidden md:inline">/ Gesture Hub</span>
          </button>

          {/* tool switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl glass">
            {TOOLS.map((t) => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="hub-pill"
                      className="absolute inset-0 rounded-lg bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <t.icon className="relative h-4 w-4" />
                  <span className="relative hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          {view !== "home" && (
            <button
              onClick={() => go("home")}
              className="hidden md:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to hub
            </button>
          )}
        </div>
      </nav>
    </motion.header>
  );
}
