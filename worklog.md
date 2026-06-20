# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **8 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Enhanced the **Air Whiteboard** with an undo button, a text tool (type + place), and a shape-fill toggle (filled vs outlined for rect/circle). These complete the whiteboard's core feature set (priorities #6 and #7 from the previous worklog).

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

1. **Whiteboard undo button** (`whiteboard-view.tsx`):
   - New "Undo" button in the Actions section — pops the last shape off the current page and redraws.
   - Works with both gesture and mouse drawing.
2. **Whiteboard text tool** (`whiteboard-view.tsx`):
   - New "Text" tool added to the tools grid (7 tools now: Pen/Rect/Circle/Line/Arrow/Text/Eraser).
   - When the Text tool is selected, a "Text content" input appears in the sidebar — type your text, then click/pinch on the canvas to place it.
   - Text is rendered in the selected color at `size * 6`px font size.
   - Works with both mouse click and gesture pinch.
3. **Whiteboard shape fill toggle** (`whiteboard-view.tsx`):
   - New "Shape fill" section with an "OUTLINED" / "FILLED" toggle button.
   - When FILLED, rectangles and circles are drawn filled instead of outlined.
   - Fill state is stored per-shape, so toggling after drawing doesn't affect existing shapes.
4. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 9 views render; whiteboard shows 7 tools + Undo button + OUTLINED toggle + Text input when Text tool selected.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: whiteboard (7 tools including Text, Actions section with Undo/New/Clear/Save, Shape fill OUTLINED toggle, page indicator, colors palette) all render correctly.
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
6. **Whiteboard: selection/move tool** — add a select tool to pick up existing shapes and move them.
7. **Whiteboard: redo + keyboard shortcuts** — add a redo button and Ctrl+Z / Ctrl+Y keyboard shortcuts.
