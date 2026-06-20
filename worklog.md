# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **7 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added a 7th tool — **Sign Language Trainer** (ASL alphabet with live finger-pattern matching + practice mode) — bringing the hub from 6 to 7 tools.

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Eight views**: `home`, `cursor`, `canvas`, `orchestra`, `piano`, `presenter`, `sign`, `lab`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 7 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra; the Piano view uses its own `Tone.PolySynth` + `Tone.Reverb`.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `orchestra` | `piano` | `presenter` | `sign` | `lab`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks.
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales (C Major, A Minor, D Dorian, C Pentatonic), 4 progressions, discrete dynamics (pp→ff), melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (8 tabs).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground (drag card, toggle switch, drawing canvas, click counter).
- `src/components/views/air-canvas-view.tsx` — full-screen gesture drawing studio (localStorage-persisted color + brush size + canvas resize handler).
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI (localStorage-persisted scale/progression/volumes/reverb/swing/octave).
- `src/components/views/piano-view.tsx` — gesture piano (1.5-octave keyboard, 4 instruments, record/playback).
- `src/components/views/presenter-view.tsx` — gesture-controlled slide deck (pinch/fist/open/point, full-screen, pointer + laser).
- `src/components/views/sign-trainer-view.tsx` — **NEW** ASL alphabet trainer (finger-pattern matching, browse + practice modes, score).
- `src/components/views/hand-lab-view.tsx` — 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Sign Language Trainer** (`sign-trainer-view.tsx`) — a 7th tool:
   - 8-letter ASL reference (A, B, C, D, L, V, W, Y) — each with a coarse finger-extension pattern, description, and hint.
   - **Browse mode**: click any letter tile to see its detail card (big letter + name + description + hint) and a finger-pattern visualizer showing target vs your live hand, per-finger, with check/X feedback.
   - **Practice mode**: the trainer walks through the alphabet; form each letter with your hand and hold the correct shape for 0.8s to advance. Live similarity meter (0–100%), big "Form the letter" overlay on the camera, score + attempts counter, progress bar, and a "Correct!" success banner.
   - Skeleton overlay turns green when the pattern matches (≥80% similarity).
2. **Home page updated** — hero now showcases all 7 tools in a `lg:grid-cols-3 xl:grid-cols-4` grid (clean 4+3 wrap at desktop). Nav expanded to 8 tabs (Hub/Cursor/Canvas/Orchestra/Piano/Presenter/Sign/Hand Lab).
3. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 8 views render; sign trainer shows alphabet grid + detail card + finger-pattern visualizer + practice controls; home shows 7 tool cards in a clean 4+3 grid.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: home (7 tool cards, clean 4+3 grid), sign trainer (camera + ASL alphabet grid + detail card + finger pattern + mode controls) all render correctly.
- Console: a stale Next.js HMR error overlay about a `SignLanguage` icon name that no longer exists in the code (the file uses `Languages`); this is a dev-only cache artifact and does not affect runtime — all views render and navigate correctly.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
2. **Add an 8th tool** — e.g. "Gesture Gamepad" (map gestures to game inputs), "Air Whiteboard" (collaborative), or "Hand Poses Gallery" (custom gesture recorder + binder).
3. **Performance throttling** — only update React state when values change by a threshold to cut re-renders.
4. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
5. **Piano: sustain pedal gesture** — add an open-hand = sustain pedal mapping, and a visual "now playing" note trail.
6. **Presenter: custom deck upload** — let users load their own slide images / Markdown instead of the built-in sample deck.
7. **Sign Trainer: more letters + quiz mode** — extend the ASL set beyond 8 letters, add a timed quiz with a final score.
