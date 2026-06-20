"use client";

import { motion } from "framer-motion";
import { Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";

function CodeBlock({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl bg-black/50 border border-border/50 overflow-hidden group">
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto scrollbar-thin">
        {lines.map((l, i) => (
          <div key={i}>
            {l.startsWith("#") ? (
              <span className="text-muted-foreground/60">{l}</span>
            ) : l.startsWith("$") ? (
              <span><span className="text-primary">$</span><span className="text-foreground"> {l.slice(2)}</span></span>
            ) : (
              <span className="text-foreground/90">{l}</span>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Setup() {
  return (
    <section id="setup" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">Get started</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Up and running in <span className="text-gradient">60 seconds</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Clone the repo, install the dependencies, and launch. Works on any
            Windows PC with a webcam and Python 3.10+.
          </p>
        </motion.div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
              <h3 className="font-semibold">Clone the repository</h3>
            </div>
            <CodeBlock lines={[
              "$ git clone https://github.com/yourname/airtouch.git",
              "$ cd airtouch/gesture-control",
            ]} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
              <h3 className="font-semibold">Install dependencies</h3>
            </div>
            <CodeBlock lines={[
              "# create a virtual environment (recommended)",
              "$ python -m venv venv",
              "$ venv\\Scripts\\activate     # Windows",
              "$ source venv/bin/activate    # macOS / Linux",
              "",
              "# install the stack",
              "$ pip install -r requirements.txt",
            ]} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
              <h3 className="font-semibold">Launch AirTouch</h3>
            </div>
            <CodeBlock lines={[
              "$ python main.py",
              "",
              "# the camera window opens, hand tracking starts immediately.",
              "# press H for the on-screen guide, Q or ESC to quit.",
            ]} />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="mt-10 rounded-2xl glass p-6 flex items-start gap-4"
        >
          <div className="flex-shrink-0 p-2.5 rounded-xl bg-chart-3/10">
            <Terminal className="h-5 w-5 text-chart-3" />
          </div>
          <div>
            <h4 className="font-semibold mb-1">Requirements</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Python 3.10 or 3.11 (MediaPipe has limited 3.12+ wheel support),
              a webcam, and Windows 10/11 for full system control. The app
              gracefully degrades if <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5">pycaw</code> is
              missing — volume falls back to media-key presses.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
