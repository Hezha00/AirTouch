# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **5 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added a 5th tool — **Gesture Piano** — bringing the hub from 4 to 5 tools. Also added **localStorage persistence** to Air Canvas (color + brush size) and a **canvas resize handler** (priorities #1 and #2 from the previous worklog).

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Six views**: `home`, `cursor`, `canvas`, `orchestra`, `piano`, `lab`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 5 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra; the Piano view uses its own `Tone.PolySynth` + `Tone.Reverb`.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `orchestra` | `piano` | `lab`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks.
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales (C Major, A Minor, D Dorian, C Pentatonic), 4 progressions, discrete dynamics (pp→ff), melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (6 tabs).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground (drag card, toggle switch, drawing canvas, click counter).
- `src/components/views/air-canvas-view.tsx` — full-screen gesture drawing studio (now with localStorage-persisted color + brush size + canvas resize handler).
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI.
- `src/components/views/piano-view.tsx` — **NEW** gesture piano (1.5-octave keyboard, 4 instruments, record/playback).
- `src/components/views/hand-lab-view.tsx` — 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Gesture Piano** (`piano-view.tsx`) — a 5th tool:
   - 1.5-octave virtual keyboard (C4–F5) with properly-positioned black keys.
   - Move your hand over the keys; **pinch** to strike a note; hold pinch for sustained notes / chords.
   - 4 instruments (Piano/Synth/Bell/Pluck) — switches the `Tone.PolySynth` oscillator type live.
   - Volume slider, octave shift (−2..+2), C-major scale highlighting (dims out-of-scale keys).
   - **Record & playback** — records note-on/note-off events with timestamps; play button replays the performance; clear button wipes it.
   - Mouse-clickable keys (so users can test sounds without a camera).
   - Live cursor follower with green glow; notes-played counter; camera thumbnail with skeleton overlay + pinch highlight.
2. **localStorage persistence** (Air Canvas) — color and brush size now load from / save to `localStorage` (`aircanvas:color`, `aircanvas:size`), so user prefs survive page reloads.
3. **Air Canvas resize handler** — added a `window.resize` listener that re-sizes the draw canvas and redraws all strokes, so mid-session window resizes no longer crop the artwork.
4. **Home page updated** — hero now showcases all 5 tools in a `lg:grid-cols-3` grid; the 5th card (Hand Lab) spans full width (`lg:col-span-3`) to avoid an orphan gap. Nav expanded to 6 tabs (Hub/Cursor/Canvas/Orchestra/Piano/Hand Lab).
5. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 6 views render with no JS errors; piano view shows keyboard + sidebar + recording bar; home shows 5 tool cards cleanly.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: home (5 tool cards, 3-col grid with full-width 5th card), piano (keyboard + 4 instruments + recording bar + sidebar) all render correctly.
- Console: only HMR info logs + Tone.js banner; no runtime errors after clean reload.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Persist Orchestra prefs** — extend localStorage persistence to the Orchestra view (scale, progression, layer volumes, reverb/swing/octave).
2. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
3. **Add a 6th tool** — e.g. "Air Presenter" (slide navigation + laser pointer), "Sign Language Alphabet" trainer, or "Gesture Gamepad" (map gestures to game inputs).
4. **Performance throttling** — only update React state when values change by a threshold to cut re-renders.
5. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
6. **Piano: sustain pedal gesture** — add an open-hand = sustain pedal mapping, and a visual "now playing" note trail.
