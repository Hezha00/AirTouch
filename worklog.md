# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **4 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Completed the **mobile/responsive pass** (the #1 priority from the previous worklog). The hub nav, all 4 tool views, and the home hero now render cleanly from 390px (iPhone) up to 1440px+ desktop with no horizontal overflow, proper stacking, and tappable targets.

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

1. **Hub nav responsive** (`hub-nav.tsx`) — the 5-tab pill switcher is now horizontally scrollable on mobile with compact icon-only buttons (labels appear `sm:inline`), `flex-shrink-0` on each tab so they don't squish, `aria-label` for accessibility, smaller padding/text on mobile (`px-2 text-xs` → `sm:px-3 text-sm`), and the nav height drops to `h-14` on mobile. Added `overflow-x-auto scrollbar-thin` so off-screen tabs scroll. The "Back to hub" button now only shows `lg:flex` (was `md:flex`) to avoid crowding.
2. **All 4 tool views** — patched `pt-20` → `pt-16 sm:pt-20` across cursor-control, air-canvas, orchestra, hand-lab views to clear the shorter mobile nav.
3. **Air Canvas sidebar** — changed the tools sidebar from `flex flex-col` to `grid grid-cols-2 lg:grid-cols-1` so on mobile the color/brush/mode/actions/gesture/stats cards arrange in a compact 2-column grid instead of one very tall column.
4. **Home hero typography** — `text-5xl` → `text-4xl sm:text-7xl lg:text-8xl` so the title fits 390px without overflow.
5. **Verified** — ESLint clean, page returns 200, agent-browser confirms: mobile home (390×844) nav fits + hero readable + CTAs stack; mobile canvas sidebar in 2-col grid; mobile orchestra + lab stack correctly; desktop (1440×900) unaffected with no regression.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 390×844 (iPhone): home, canvas, orchestra, lab all render with no horizontal overflow, proper stacking, tappable targets.
- agent-browser visual QA at 1440×900 (desktop): home renders identically to before — no regression from the responsive changes.
- Console: only HMR info logs + Tone.js banner; no runtime errors after clean reload.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Air Canvas draw canvas** is sized to its container on mount; if the window is resized mid-session the canvas may need a resize handler (currently sized once on `running` change).
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Persist user prefs** — Air Canvas color/size, Orchestra layer volumes/scale/progression, etc. in `localStorage`.
2. **Air Canvas resize handler** — re-size the draw canvas on window resize and re-redraw strokes (currently sized once on `running` change).
3. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
4. **Add a 5th tool** — e.g. "Gesture Piano" (tap virtual keys in the air with pinches), "Air Presenter" (slide navigation + laser pointer), or "Sign Language Alphabet" trainer.
5. **Performance throttling** — only update React state when values change by a threshold to cut re-renders.
6. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
