# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **7 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra + piano) live Tone.js audio synthesis. No backend, no cloud, no install for end users.

The Python desktop app still lives in `/gesture-control/` as the downloadable backend.

**This phase**: Added a **sustain pedal gesture** to the Piano (open hand = toggle sustain + visual note trail), **performance throttling** to the shared hand-tracking hook (reduces React re-renders from ~30-60/sec to ~12/sec), and **polished the home page** (improved stats section with icons + updated "7 tools" count, animated section dividers).

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

1. **Piano sustain pedal gesture** (`piano-view.tsx`):
   - Open palm toggles sustain ON/OFF (edge-triggered, so you can close your hand after toggling).
   - When sustain is ON, releasing a pinch does NOT release the notes — they keep ringing until sustain is turned OFF.
   - When sustain turns OFF, all held notes release immediately.
   - New **sustain + note trail bar** below the keyboard: shows the sustain ON/OFF indicator, "Open palm = toggle" hint, and a live "Recent" trail of the last 8 played notes (animated badges that fade out after 3 seconds).
   - Updated the "How to play" sidebar to mention the sustain gesture.
2. **Performance throttling** (`use-hand-tracking.ts`):
   - The `onFrame`/`onHands` callbacks still fire every frame (for smooth canvas drawing via refs).
   - But `setHands` (the React state update) is now throttled: only fires when the gesture changes, the position moves >1% of the frame, or every 80ms (~12fps) — whichever comes first.
   - Reduces React re-renders from ~30-60/sec to ~12/sec, improving performance on lower-end devices.
3. **Home page styling polish**:
   - **Stats section** (`stats.tsx`): each stat card now has an icon (Fingerprint/Zap/Layers/CloudOff), a hover glow, and the count was updated from "4 core gestures" to "7 interactive tools".
   - **Section dividers** (`section-divider.tsx`): a new reusable component with an animated gradient line that scales in on scroll, placed between each home section (Stats → Features → Gestures → How It Works → Ideas) for better visual flow.
4. **Verified** — ESLint clean, page returns 200, agent-browser confirms all 8 views render; piano shows the new sustain bar + note trail; home shows the improved stats with icons and "7" count.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA at 1440×900: piano (sustain bar with "Sustain OFF" indicator + "Recent: —" trail + "Open palm = sustain pedal" in How to play), home (stats row with icons + values 21/~10ms/7/0) all render correctly.
- Console: the persistent `SignLanguage` dev-overlay error is confirmed non-blocking — the source code uses `Languages` (grep finds no `SignLanguage`), all 8 views render and navigate, and the error will not appear in production builds.

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
5. **Sign Trainer: more letters + quiz mode** — extend the ASL set beyond 8 letters, add a timed quiz with a final score.
6. **Investigate the `SignLanguage` dev-overlay** — the persistent Next.js dev error overlay (about an icon name that no longer exists in the code) is non-blocking but cosmetically undesirable for developers; a full `node_modules` reinstall or Next.js version bump may clear it.
