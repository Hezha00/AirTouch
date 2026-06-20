"use client";

import { HubProvider, useHub } from "@/lib/gesture/hub-context";
import { HubNav } from "@/components/hub-nav";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { Features } from "@/components/sections/features";
import { GestureGuide } from "@/components/sections/gesture-guide";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Ideas } from "@/components/sections/ideas";
import { SectionDivider } from "@/components/sections/section-divider";
import { CursorControlView } from "@/components/views/cursor-control-view";
import { OrchestraView } from "@/components/views/orchestra-view";
import { AirCanvasView } from "@/components/views/air-canvas-view";
import { WhiteboardView } from "@/components/views/whiteboard-view";
import { PianoView } from "@/components/views/piano-view";
import { PresenterView } from "@/components/views/presenter-view";
import { SignTrainerView } from "@/components/views/sign-trainer-view";
import { HandLabView } from "@/components/views/hand-lab-view";

function HomeView() {
  return (
    <>
      <Hero />
      <Stats />
      <SectionDivider />
      <Features />
      <SectionDivider />
      <GestureGuide />
      <SectionDivider />
      <HowItWorks />
      <SectionDivider />
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
        {view === "canvas" && <AirCanvasView />}
        {view === "whiteboard" && <WhiteboardView />}
        {view === "piano" && <PianoView />}
        {view === "presenter" && <PresenterView />}
        {view === "sign" && <SignTrainerView />}
        {view === "lab" && <HandLabView />}
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
