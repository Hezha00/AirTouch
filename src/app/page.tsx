import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { LiveDemo } from "@/components/sections/live-demo";
import { Features } from "@/components/sections/features";
import { GestureGuide } from "@/components/sections/gesture-guide";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Setup } from "@/components/sections/setup";
import { Ideas } from "@/components/sections/ideas";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Stats />
        <LiveDemo />
        <Features />
        <GestureGuide />
        <HowItWorks />
        <Setup />
        <Ideas />
      </main>
      <SiteFooter />
    </div>
  );
}
