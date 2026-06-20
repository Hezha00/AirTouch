# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **6 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added a 6th tool — **Air Presenter** (gesture-controlled slide deck) — and **localStorage persistence** to the Orchestra view (scale, progression, layer volumes, reverb/swing/octave). Brings the hub from 5 to 6 tools.

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Seven views**: `home`, `cursor`, `canvas`, `orchestra`, `piano`, `presenter`, `lab`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 6 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra; the Piano view uses its own `Tone.PolySynth` + `Tone.Reverb`.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `orchestra` | `piano` | `presenter` | `lab`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks.
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales (C Major, A Minor, D Dorian, C Pentatonic), 4 progressions, discrete dynamics (pp→ff), melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (7 tabs).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground (drag card, toggle switch, drawing canvas, click counter).
- `src/components/views/air-canvas-view.tsx` — full-screen gesture drawing studio (localStorage-persisted color + brush size + canvas resize handler).
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI (now with localStorage-persisted scale/progression/volumes/reverb/swing/octave).
- `src/components/views/piano-view.tsx` — gesture piano (1.5-octave keyboard, 4 instruments, record/playback).
- `src/components/views/presenter-view.tsx` — **NEW** gesture-controlled slide deck (pinch/fist/open/point, full-screen, pointer + laser).
- `src/components/views/hand-lab-view.tsx` — 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Air Presenter** (`presenter-view.tsx`) — a 6th tool:
   - 7-slide sample deck (gesture-control themed) with gradient backgrounds, animated transitions (framer-motion `AnimatePresence` with directional slide).
   - **Pinch** → next slide; **Fist** → previous slide; **Open palm** → glowing pointer that follows your palm; **Point** → precise red laser dot.
   - **Full-screen kiosk mode** via the Fullscreen API — the stage requests fullscreen for real presentations.
   - Clickable fallbacks: left/right nav arrows on the stage, a thumbnail strip below, and progress dots.
   - Camera thumbnail (top-right) with skeleton overlay + live gesture badge; sidebar with gesture map, pointer-mode indicator, slide counter, tips.
   - Direction-aware slide animation (slides enter from the right when advancing, from the left when going back).
2. **Orchestra localStorage persistence** — scale, progression, layer volumes, reverb, swing, and octave now load from / save to `localStorage` (`orch:scale`, `orch:prog`, `orch:vols`, `orch:reverb`, `orch:swing`, `orch:octave`), so a conductor's setup survives reloads.
3. **Home page updated** — hero now showcases all 6 tools in a clean `lg:grid-cols-3` × 2-row grid (no orphan gap). Nav expanded to 7 tabs (Hub/Cursor/Canvas/Orchestra/Piano/Presenter/Hand Lab).
4. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 7 views render with no JS errors; presenter shows slide stage + thumbnails + sidebar; home shows 6 tool cards in a clean 3×2 grid.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: home (6 tool cards, clean 3×2 grid), presenter (slide stage with "Gesture Control" slide 1/7, nav arrows, progress dots, thumbnails, sidebar) all render correctly.
- Console: no runtime JS errors after clean reload.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
2. **Add a 7th tool** — e.g. "Sign Language Alphabet" trainer, "Gesture Gamepad" (map gestures to game inputs), or "Air Whiteboard" (collaborative).
3. **Performance throttling** — only update React state when values change by a threshold to cut re-renders.
4. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
5. **Piano: sustain pedal gesture** — add an open-hand = sustain pedal mapping, and a visual "now playing" note trail.
6. **Presenter: custom deck upload** — let users load their own slide images / Markdown instead of the built-in sample deck.
