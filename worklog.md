# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **7 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Extended the **Sign Language Trainer** from 8 to 20 ASL letters (A–Z minus J, S) and added a **timed Quiz mode** (60-second countdown, shuffled letter order, final score with performance message + retry). Also investigated the persistent `SignLanguage` dev-overlay error — confirmed it is a non-blocking browser-cached overlay message (the source uses `Languages`, all views render, it won't appear in production).

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

1. **Sign Language Trainer — extended alphabet** (`sign-trainer-view.tsx`):
   - Expanded the ASL set from 8 to 20 letters: added E, F, G, H, I, K, P, Q, R, T, X, Z (J and S are excluded — they require motion/context that finger-extension patterns can't capture).
   - Each new letter has a description, a coarse finger-extension pattern, and a hint.
   - Alphabet grid updated to `grid-cols-5 sm:grid-cols-10` to fit 20 letters cleanly.
2. **Sign Language Trainer — timed Quiz mode** (`sign-trainer-view.tsx`):
   - New "Timed Quiz (60s)" button in browse mode (alongside "Start Practice").
   - Quiz shuffles all 20 letters into a random order; the user forms each letter and holds 0.6s to score.
   - Live countdown timer (turns red + pulses in the last 10 seconds); the quiz ends when the timer hits 0 or all letters are completed.
   - Quiz progress bar shows position in the shuffled deck.
   - **Results screen**: shows the final score (e.g. "15 / 20") with a performance message ("Perfect! 🏆" / "Great job!" / "Good effort!" / "Keep practicing!") + Retry and Back-to-Browse buttons.
   - Timer is cleaned up on unmount.
3. **`SignLanguage` dev-overlay investigation** — confirmed the error is a browser-cached overlay message: the source file uses `Languages` (grep + `cat -A` confirm no `SignLanguage`), the `.next` build output contains no `SignLanguage`, all 8 views render and navigate, and the error will not appear in production builds. Purging `.next`, `node_modules/.cache`, browser storage, and service workers did not clear it — it's a Next.js dev-mode overlay quirk. Documented as a known cosmetic issue.
4. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 8 views render; sign trainer shows the 20-letter alphabet grid + both Start Practice and Timed Quiz buttons + letter detail card.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: sign trainer (20-letter alphabet grid in 5-col layout, "Start Practice" green button + "Timed Quiz (60s)" fuchsia button, letter detail card with A + hint) all render correctly.
- Console: the `SignLanguage` dev-overlay error persists but is confirmed non-blocking (all views render + navigate; source uses `Languages`; won't appear in production).

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
2. **Add an 8th tool** — e.g. "Gesture Gamepad" (map gestures to game inputs), "Air Whiteboard" (collaborative), or "Hand Poses Gallery" (custom gesture recorder + binder).
3. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
4. **Presenter: custom deck upload** — let users load their own slide images / Markdown instead of the built-in sample deck.
5. **Sign Trainer: J and S letters** — add motion-based detection for J (swipe) and S (thumb-across-fist) to complete the full 26-letter alphabet.
6. **Quiz difficulty levels** — add Easy (10 letters, 90s), Medium (20 letters, 60s), Hard (20 letters, 30s) options to the quiz.
