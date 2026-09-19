"use client";

import { motion } from "framer-motion";
import {
  Gamepad2, Presentation, Accessibility, Wand2,
  MonitorSmartphone, Mic, Keyboard, Lightbulb,
} from "lucide-react";

const IDEAS = [
  {
    icon: Accessibility,
    title: "Accessibility first",
    desc: "AirTouch is a lifeline for users with motor impairments who struggle with a physical mouse. Package it as a always-on system tray app with profile switching.",
    tag: "High impact",
  },
  {
    icon: Gamepad2,
    title: "Gesture gaming",
    desc: "Map gestures to game inputs — swipe to cast spells, pinch to shoot, open palm to block. Build a lightweight virtual-gamepad layer on top of the engine.",
    tag: "Fun",
  },
  {
    icon: Presentation,
    title: "Presentation pilot",
    desc: "A kiosk mode for lecturers: pinch to advance slides, open palm to show a laser pointer, swipe to go back. No clicker hardware needed.",
    tag: "Productivity",
  },
  {
    icon: Wand2,
    title: "Custom macro studio",
    desc: "A visual editor where users record their own gestures and bind them to any keystroke, app launch, or PowerShell script. Share profiles as JSON.",
    tag: "Power user",
  },
  {
    icon: Keyboard,
    title: "Air keyboard",
    desc: "Project a virtual QWERTY onto the camera view; tap keys by pinching over them. Fingertip-to-key distance does the hit-testing.",
    tag: "Ambitious",
  },
  {
    icon: MonitorSmartphone,
    title: "Phone-as-camera",
    desc: "Stream your phone's camera to the Python backend over WebSocket, so a laptop without a webcam can still use AirTouch.",
    tag: "Hardware",
  },
  {
    icon: Mic,
    title: "Voice + gesture fusion",
    desc: "Combine AirTouch with a speech engine: say 'scroll' while swiping, or 'click there' while pointing. Multimodal commands are far more expressive.",
    tag: "Research",
  },
  {
    icon: Lightbulb,
    title: "Smart-home air remote",
    desc: "Pinch to dim the lights, rotate your wrist to change the thermostat. Bridge AirTouch to Home Assistant or MQTT.",
    tag: "IoT",
  },
];

export function Ideas() {
  return (
    <section id="ideas" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 grid-bg grid-bg-fade opacity-30" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">Where to take it next</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Make it <span className="text-gradient">your own</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            AirTouch's engine is a solid foundation. Here are eight directions to
            expand it into something useful, fun, or genuinely life-changing.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {IDEAS.map((idea, i) => (
            <motion.div
              key={idea.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.08 }}
              className="group relative rounded-2xl glass p-5 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-primary/10 transition-colors">
                  <idea.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                  {idea.tag}
                </span>
              </div>
              <h3 className="font-semibold mb-2 text-base">{idea.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{idea.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
