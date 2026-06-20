"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ViewName = "home" | "cursor" | "canvas" | "orchestra" | "piano" | "lab";

type HubCtx = {
  view: ViewName;
  go: (v: ViewName) => void;
};

const Ctx = createContext<HubCtx>({ view: "home", go: () => {} });

export function HubProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewName>("home");
  const go = useCallback((v: ViewName) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);
  return <Ctx.Provider value={{ view, go }}>{children}</Ctx.Provider>;
}

export function useHub() {
  return useContext(Ctx);
}
