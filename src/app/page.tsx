"use client";

import { HubProvider, useHub } from "@/lib/gesture/hub-context";
import { HubNav } from "@/components/hub-nav";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { Features } from "@/components/sections/features";
import { GestureGuide } from "@/components/sections/gesture-guide";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Setup } from "@/components/sections/setup";
import { Ideas } from "@/components/sections/ideas";
import { CursorControlView } from "@/components/views/cursor-control-view";
import { OrchestraView } from "@/components/views/orchestra-view";

function HomeView() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <GestureGuide />
      <HowItWorks />
      <Setup />
      <Ideas />
    </>
  );
}

function AppShell() {
  const { view } = useHub();
  return (
    <div className="relative min-h-screen flex flex-col">
      <HubNav />
      <main className="flex-1">
        {view === "home" && <HomeView />}
        {view === "cursor" && <CursorControlView />}
        {view === "orchestra" && <OrchestraView />}
      </main>
      {view === "home" && <SiteFooter />}
    </div>
  );
}

export default function Home() {
  return (
    <HubProvider>
      <AppShell />
    </HubProvider>
  );
}
