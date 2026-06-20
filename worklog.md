# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **4 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added two new tools — **Air Canvas** (gesture drawing studio) and **Hand Lab** (21-landmark visualizer with 3D projection) — bringing the hub from 2 tools to 4. Polished the home page to showcase all 4 tools in a 2×2 grid.

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Five views**: `home`, `cursor`, `canvas`, `orchestra`, `lab`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 4 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `orchestra` | `lab`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks.
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales (C Major, A Minor, D Dorian, C Pentatonic), 4 progressions, discrete dynamics (pp→ff), melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (5 tabs).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground (drag card, toggle switch, drawing canvas, click counter).
- `src/components/views/air-canvas-view.tsx` — **NEW** full-screen gesture drawing studio.
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI.
- `src/components/views/hand-lab-view.tsx` — **NEW** 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Air Canvas** (`air-canvas-view.tsx`) — a full gesture painting studio:
   - Point with index finger to paint; pinch to lift the brush; open hand = eraser; fist = clear canvas.
   - 8-color palette, adjustable brush size (2–40px), Paint/Erase mode toggle.
   - Undo (last stroke), Clear all, Save PNG (composites on dark bg for export).
   - Live cursor follower with mode-colored glow; stroke counter; camera thumbnail with skeleton overlay.
   - Stroke-based rendering (strokes stored as point arrays, redrawn on undo/clear).
2. **Hand Lab** (`hand-lab-view.tsx`) — educational/developer landmark visualizer:
   - Depth-shaded 2D skeleton on the camera feed (joint size + connection opacity scale with z).
   - Rotating 3D projection canvas (Y-axis rotation using landmark z, auto-rotate toggle).
   - Per-finger extension bars (Thumb/Index/Middle/Ring/Pinky, 0–100%).
   - Live FPS counter, gesture readout, palm-size metric.
   - Full 21-landmark name list (Wrist → Pinky tip).
3. **Home page updated** — hero now showcases all 4 tools in a 2×2 card grid; CTAs updated to "Launch Cursor Control" + "Try Air Canvas"; nav expanded to 5 tabs.
4. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 5 views render correctly with no JS errors.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA: all 5 views (home, cursor, canvas, orchestra, lab) render with all expected elements, no overlaps or broken layout.
- Console: only HMR info logs + Tone.js banner; no runtime errors after clean reload.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Air Canvas draw canvas** is sized to its container on mount; if the window is resized mid-session the canvas may need a resize handler (currently sized once on `running` change).
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Mobile/responsive pass** — the tool views are desktop-first; test + tune at phone widths (camera + sidebar grids should stack, nav should scroll/wrap).
2. **Persist user prefs** — Air Canvas color/size, Orchestra layer volumes/scale/progression, etc. in `localStorage`.
3. **Air Canvas resize handler** — re-size the draw canvas on window resize and re-redraw strokes.
4. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
5. **Add a 5th tool** — e.g. "Gesture Piano" (tap virtual keys in the air with pinches), "Air Presenter" (slide navigation + laser pointer), or "Sign Language Alphabet" trainer.
6. **Performance throttling** — only update React state when values change by a threshold to cut re-renders.
