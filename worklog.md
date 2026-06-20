# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch has evolved from a single-page marketing site for a Python gesture-control app into a **browser-based gesture-recognition hub** with multiple interactive tools. The site now runs entirely client-side, with real MediaPipe hand tracking and (for the orchestra) live Tone.js audio synthesis.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend, but the website is now the primary experience.

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- Three views: `home`, `cursor`, `orchestra`.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers both interactive tools.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra.

### Key files
- `src/app/page.tsx` — client component, wraps everything in `HubProvider`, renders `AppShell`.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `orchestra`).
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, runs rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), exposes `{ videoRef, running, loading, error, hand, start, stop }` + an `onFrame` callback.
- `src/lib/gesture/music-engine.ts` — Tone.js engine: strings (pad), piano (stabs), bass (mono), drums (kick/snare/hihat), C-major chord progressions (C→Am→F→G and F→G→Am→C), per-layer gain control, reverb, tempo ramping, intensity→reverb mapping, lock/freeze, solo.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (framer-motion `layoutId`).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground.
- `src/components/views/orchestra-view.tsx` — conducting UI.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, setup, ideas).
- `src/components/site-footer.tsx`.

## Completed this phase

1. **Hub restructure** — replaced the marketing `SiteNav` with a `HubNav` that switches between tools via an animated pill. Home now leads with two prominent tool-launch cards.
2. **Shared `useHandTracking` hook** — both tools use the same smoothed `HandState { x, y, velocity, gesture, present }`. EMA on x/y (α=0.4) and velocity (α=0.5). Gesture classifier: pinch (thumb-index tip), open (all 5), point (index only), fist (all folded).
3. **Cursor Control view (interactive playground)** — the user *actually* controls a virtual cursor: point to move (index finger), tuck thumb to index-MCP to click. The playground has a draggable card (tuck+hold+move to drag), a toggle switch (tuck over it to flip), a "Click me" button, and a drawing canvas with brush/circle/square tools + 4 colors + clear. A live cursor element follows the hand across the whole viewport. Click counter + left-button state HUD.
4. **AI Conducting Orchestra** — full Tone.js generative engine:
   - 4 instrument layers (strings/piano/bass/drums), each with enable/disable + gain.
   - 2 chord progressions in C major, advancing every 2 bars.
   - Hand Y → tempo (60–180 BPM, ramped).
   - Hand X → mix (left=strings, center=piano, right=pads).
   - Velocity → intensity (drives reverb wet + drum velocities).
   - Open hand → all layers on; Fist → mute drums; Pinch → toggle progression lock; Point → solo piano.
   - UI: camera + skeleton overlay, live tempo display, animated energy meter (16 bars), layer status grid, gesture map, chord display, lock/solo badges, 4 instruction cards.
5. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 3 views + all 8 home sections render correctly with no console errors.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The model loads and UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the `start` handler. On some browsers the first chord may take ~1 bar to stabilise.
- **`framer-motion` `whileInView`** sections start at opacity 0; full-page screenshots that don't trigger scroll will show "voids" — this is expected, not a bug.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.

## Priority recommendations for next phase

1. **Add a third tool** — e.g. an "Air Canvas" drawing studio (full-screen paint with gesture-selected colors) or a "Gesture Piano" (tap virtual keys in the air). The `useHandTracking` hook + view-switch pattern make this cheap to add.
2. **Mobile/responsive pass** — the cursor playground and orchestra are desktop-first; test + tune the layouts at phone widths (the camera + side-panel grids should stack).
3. **Persist user prefs** — drawing color/tool, orchestra layer defaults, etc. in `localStorage`.
4. **Performance** — the orchestra runs `setHand`/`setActiveLayers` every frame; consider throttling state updates (e.g. only when values change by a threshold) to reduce React re-renders.
5. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so the tools work offline and load faster.
