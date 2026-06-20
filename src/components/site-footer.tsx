"use client";

import { Hand, Github, Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative mt-auto border-t border-border/50 glass-strong">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Hand className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">
                Air<span className="text-gradient">Touch</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              An open-source, webcam-powered gesture controller for Windows.
              Built with MediaPipe, OpenCV, and a lot of fine-tuning.
            </p>
          </div>

          {/* links */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#demo" className="text-muted-foreground hover:text-primary transition-colors">Live demo</a></li>
              <li><a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Features</a></li>
              <li><a href="#gestures" className="text-muted-foreground hover:text-primary transition-colors">Gestures</a></li>
              <li><a href="#setup" className="text-muted-foreground hover:text-primary transition-colors">Setup</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Project</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#ideas" className="text-muted-foreground hover:text-primary transition-colors">Expansion ideas</a></li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5">
                  <Github className="h-3.5 w-3.5" /> Source code
                </a>
              </li>
              <li><a href="#how" className="text-muted-foreground hover:text-primary transition-colors">How it works</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AirTouch. Open-source under the MIT License.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Built with <Heart className="h-3 w-3 text-primary fill-primary" /> and computer vision
          </p>
        </div>
      </div>
    </footer>
  );
}
