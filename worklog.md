# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **9 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra, piano + drumkit) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added a 9th tool — **Air Drumkit** (6-pad gesture drum kit with synthesized sounds, record/playback) — bringing the hub from 8 to 9 tools. Nav expanded to 10 tabs.

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Ten views**: `home`, `cursor`, `canvas`, `whiteboard`, `orchestra`, `piano`, `drumkit`, `presenter`, `sign`, `lab`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 9 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra; the Piano view uses its own `Tone.PolySynth` + `Tone.Reverb`; the Drumkit view uses individual Tone.js synths per pad.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `whiteboard` | `orchestra` | `piano` | `drumkit` | `presenter` | `sign` | `lab`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks. Throttled state updates (~12fps).
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales (C Major, A Minor, D Dorian, C Pentatonic), 4 progressions, discrete dynamics (pp→ff), melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (10 tabs).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground (drag card, toggle switch, drawing canvas, click counter).
- `src/components/views/air-canvas-view.tsx` — full-screen gesture drawing studio (localStorage-persisted color + brush size + canvas resize handler).
- `src/components/views/whiteboard-view.tsx` — multi-page gesture whiteboard (pen/rect/circle/line/arrow/text/eraser, 6 colors, fill toggle, undo, PNG export, mouse + gesture drawing).
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI (localStorage-persisted scale/progression/volumes/reverb/swing/octave).
- `src/components/views/piano-view.tsx` — gesture piano (1.5-octave keyboard, 4 instruments, sustain pedal, record/playback).
- `src/components/views/drumkit-view.tsx` — **NEW** 6-pad gesture drum kit (kick/snare/hihat/tom1/tom2/cymbal, record/playback, volume).
- `src/components/views/presenter-view.tsx` — gesture-controlled slide deck (pinch/fist/open/point, full-screen, pointer + laser).
- `src/components/views/sign-trainer-view.tsx` — ASL alphabet trainer (20 letters, browse + practice + timed quiz with Easy/Medium/Hard difficulty).
- `src/components/views/hand-lab-view.tsx` — 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Air Drumkit** (`drumkit-view.tsx`) — a 9th tool:
   - **6 drum pads** in a 3×2 grid: Kick (MembraneSynth), Snare (NoiseSynth), Hi-Hat (MetalSynth), Tom Hi (MembraneSynth), Tom Lo (MembraneSynth), Cymbal (MetalSynth) — all synthesized live with Tone.js.
   - Move your hand over a pad and **pinch to hit it** — velocity scales with hand speed.
   - Pads flash with a colored ripple animation on hit; color-coded per pad.
   - **Mouse-clickable pads** for testing without a camera.
   - **Volume** slider, **record & playback** (records pad hits with timestamps, replays the beat), hits counter.
   - Camera thumbnail with skeleton overlay + pinch highlight; sidebar with volume, pad legend, gesture guide, hit counter.
2. **Home page updated** — hero now showcases all 9 tools in a `lg:grid-cols-3` grid (clean 3×3). Nav expanded to 10 tabs (Hub/Cursor/Canvas/Whiteboard/Orchestra/Piano/Drumkit/Presenter/Sign/Hand Lab).
3. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 10 views render; drumkit shows 6 pads + recording bar + sidebar; home shows 9 tool cards in a clean 3×3 grid.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: drumkit (heading + camera thumbnail + 3×2 pad grid with Kick/Snare/Hi-Hat/Tom Hi/Tom Lo/Cymbal + recording bar + sidebar with volume/legend/guide/counter) all render correctly.
- All 10 views navigate correctly.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
2. **Add a 10th tool** — e.g. "Gesture Gamepad" (map gestures to game inputs), "Hand Poses Gallery" (custom gesture recorder + binder), or "Air Theremin" (pitch + volume from hand position).
3. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
4. **Presenter: custom deck upload** — let users load their own slide images / Markdown instead of the built-in sample deck.
5. **Sign Trainer: J and S letters** — add motion-based detection for J (swipe) and S (thumb-across-fist) to complete the full 26-letter alphabet.
6. **Whiteboard: selection/move tool + redo + keyboard shortcuts** — Ctrl+Z / Ctrl+Y, and a select tool to move existing shapes.
7. **Drumkit: beat sequencer** — add a step-sequencer grid for programming drum patterns gesture-free.
