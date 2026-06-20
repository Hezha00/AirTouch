# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **8 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added an 8th tool — **Air Whiteboard** (multi-page gesture whiteboard with shapes, arrows, PNG export) — and added **quiz difficulty levels** (Easy/Medium/Hard) to the Sign Language Trainer. Brings the hub from 7 to 8 tools.

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Nine views**: `home`, `cursor`, `canvas`, `whiteboard`, `orchestra`, `piano`, `presenter`, `sign`, `lab`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 8 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra; the Piano view uses its own `Tone.PolySynth` + `Tone.Reverb`.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `whiteboard` | `orchestra` | `piano` | `presenter` | `sign` | `lab`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks. Throttled state updates (~12fps).
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales (C Major, A Minor, D Dorian, C Pentatonic), 4 progressions, discrete dynamics (pp→ff), melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (9 tabs).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground (drag card, toggle switch, drawing canvas, click counter).
- `src/components/views/air-canvas-view.tsx` — full-screen gesture drawing studio (localStorage-persisted color + brush size + canvas resize handler).
- `src/components/views/whiteboard-view.tsx` — **NEW** multi-page gesture whiteboard (pen/rect/circle/line/arrow/eraser, 6 colors, PNG export, mouse + gesture drawing).
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI (localStorage-persisted scale/progression/volumes/reverb/swing/octave).
- `src/components/views/piano-view.tsx` — gesture piano (1.5-octave keyboard, 4 instruments, sustain pedal, record/playback).
- `src/components/views/presenter-view.tsx` — gesture-controlled slide deck (pinch/fist/open/point, full-screen, pointer + laser).
- `src/components/views/sign-trainer-view.tsx` — ASL alphabet trainer (20 letters, browse + practice + timed quiz with Easy/Medium/Hard difficulty).
- `src/components/views/hand-lab-view.tsx` — 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Air Whiteboard** (`whiteboard-view.tsx`) — an 8th tool:
   - **Multi-page whiteboard** with pen, rectangle, circle, line, arrow, and eraser tools.
   - Pinch to draw, open hand to lift, fist to clear the current page.
   - Shape tools keep a start point + current point for live preview while drawing.
   - Arrow tool draws a line + arrowhead.
   - 6 colors, adjustable size (2–20px), page navigation (prev/next/new page), PNG export per page.
   - Mouse drawing fallback (no camera needed to test).
   - Camera thumbnail with skeleton overlay + live gesture badge; sidebar with tools, colors, size, page actions, gesture guide, shape counter.
2. **Sign Trainer quiz difficulty levels** (`sign-trainer-view.tsx`):
   - Replaced the single "Timed Quiz (60s)" button with three difficulty buttons: **Easy** (10 letters, 90s), **Medium** (20 letters, 60s), **Hard** (20 letters, 30s).
   - Each difficulty shuffles a random subset of letters and sets the countdown accordingly.
   - Retry button defaults to Medium difficulty.
3. **Home page updated** — hero now showcases all 8 tools in a `lg:grid-cols-3 xl:grid-cols-4` grid (clean 4×2 wrap at desktop). Nav expanded to 9 tabs (Hub/Cursor/Canvas/Whiteboard/Orchestra/Piano/Presenter/Sign/Hand Lab).
4. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 9 views render; whiteboard shows tools + colors + page nav + canvas; sign trainer shows Easy/Med/Hard difficulty buttons.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: whiteboard (heading + camera thumbnail + large canvas + page indicator + tools sidebar with Pen/Rect/Circle/Line/Arrow/Eraser + colors + size + page actions + gesture guide + counter) all render correctly; sign trainer shows Easy/Med/Hard difficulty buttons.
- All 9 views navigate correctly.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
2. **Add a 9th tool** — e.g. "Gesture Gamepad" (map gestures to game inputs), "Hand Poses Gallery" (custom gesture recorder + binder), or "Air Drumkit".
3. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
4. **Presenter: custom deck upload** — let users load their own slide images / Markdown instead of the built-in sample deck.
5. **Sign Trainer: J and S letters** — add motion-based detection for J (swipe) and S (thumb-across-fist) to complete the full 26-letter alphabet.
6. **Whiteboard: text tool + undo** — implement the text tool (tap to place, type via keyboard) and an undo button.
7. **Whiteboard: shape fill** — add a fill toggle for rect/circle (filled vs outlined).
