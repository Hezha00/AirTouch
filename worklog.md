# AirTouch Gesture Hub — Worklog

## Current project status

AirTouch is a **browser-based gesture-recognition hub** with **8 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and (for the orchestra, piano + drumkit) live Tone.js audio synthesis. Supports **English + Persian (Farsi)** with RTL layout. No backend, no cloud, no install for end users.

**Creator**: Hezha Khaledi / هیژا خالدی (Telegram: @Hezha_kh00, Instagram: @Hezha_khaledi, Email: hezhakh4@gmail.com)

**This phase**: Added **Persian/English language switch** with full RTL support, **removed the Presenter tool** completely, **removed all local-run hints** (GitHub clone, pip install, source code links, open-source references), added **creator + contact info** to the footer, added a subtle **english-arcade.ir advertisement** card. Nav reduced from 10 to 9 tabs (Presenter removed).

## Architecture

- **Single route** (`/`) with client-side view switching via React Context (`HubProvider` / `useHub`).
- **Nine views**: `home`, `cursor`, `canvas`, `whiteboard`, `orchestra`, `piano`, `drumkit`, `sign`, `lab`.
- **Bilingual** (EN/FA) via `I18nProvider` with RTL support — a globe button in the nav toggles languages.
- A shared, reusable hand-tracking hook (`useHandTracking`) powers all 8 tools — supports 1 or 2 hands, EMA smoothing, handedness correction, gesture classification.
- A standalone `MusicEngine` class (Tone.js) drives the orchestra; the Piano view uses its own `Tone.PolySynth` + `Tone.Reverb`; the Drumkit view uses individual Tone.js synths per pad.

### Key files
- `src/app/page.tsx` — client component; `HubProvider` → `AppShell` renders the active view.
- `src/lib/gesture/hub-context.tsx` — view state (`home` | `cursor` | `canvas` | `whiteboard` | `orchestra` | `piano` | `drumkit` | `sign` | `lab`).
- `src/lib/gesture/i18n-context.tsx` — **NEW** bilingual (EN/FA) translation context with RTL support.
- `src/lib/gesture/use-hand-tracking.ts` — shared hook: loads MediaPipe HandLandmarker, rAF loop, EMA-smooths x/y/velocity, classifies gestures (open/fist/pinch/point/idle), supports `numHands: 1|2`, exposes `{ videoRef, running, loading, error, hand, hands, start, stop }` + `onFrame` / `onHands` callbacks. Throttled state updates (~12fps).
- `src/lib/gesture/music-engine.ts` — Tone.js engine: 5 layers (strings/piano/bass/drums/lead), 4 scales, 4 progressions, discrete dynamics, melody lead synth, swing, octave shift, reverb+delay, drop trigger.
- `src/components/hub-nav.tsx` — top nav with animated pill tool-switcher (9 tabs) + language switch button (🌐 EN/FA).
- `src/components/views/cursor-control-view.tsx` — interactive cursor playground.
- `src/components/views/air-canvas-view.tsx` — full-screen gesture drawing studio.
- `src/components/views/whiteboard-view.tsx` — multi-page gesture whiteboard (7 tools, fill toggle, undo, PNG export).
- `src/components/views/orchestra-view.tsx` — two-handed conducting UI (localStorage-persisted).
- `src/components/views/piano-view.tsx` — gesture piano (4 instruments, sustain pedal, record/playback).
- `src/components/views/drumkit-view.tsx` — 6-pad gesture drum kit (record/playback, volume).
- `src/components/views/sign-trainer-view.tsx` — ASL alphabet trainer (20 letters, browse + practice + timed quiz Easy/Med/Hard).
- `src/components/views/hand-lab-view.tsx` — 21-landmark visualizer.
- `src/components/sections/*` — home marketing sections (hero, stats, features, gesture-guide, how-it-works, ideas).
- `src/components/site-footer.tsx` — footer with creator (Hezha Khaledi / هیژا خالدی), contact info (Telegram/Instagram/Email), english-arcade.ir ad.

## Completed this phase

1. **Persian/English language switch** (`i18n-context.tsx`):
   - New `I18nProvider` with full EN/FA translation strings for nav, hero, tool cards, stats, footer, arcade ad.
   - Globe button (🌐) in the nav toggles between English and Persian.
   - When Persian is active, the entire page switches to `dir="rtl"` for proper right-to-left layout.
   - All nav labels, hero text, tool card titles/descriptions, stats labels, and footer text are translated.
2. **Presenter tool removed** — deleted `presenter-view.tsx`, removed from hub-context, hub-nav, hero tool cards, and page.tsx. Nav reduced from 10 to 9 tabs.
3. **All local-run hints removed** — deleted `setup.tsx` (the "Get started / 60 seconds" section with git clone + pip install), removed GitHub icon and "Source code" link from footer, removed "open-source" and "MIT License" references, removed "Github" and "Download" icons from hero imports. The footer now describes the hub as "A webcam-powered gesture control hub" with no mention of being open-source or downloadable.
4. **Creator + contact info added to footer** — "Creator: Hezha Khaledi / هیژا خالدی" section with Telegram (@Hezha_kh00), Instagram (@Hezha_khaledi), and email (hezhakh4@gmail.com) — all as clickable links. The copyright line includes "Hezha Khaledi".
5. **english-arcade.ir advertisement** — a subtle card in the footer: "Learning English? Check out English Arcade — a fun, game-based platform for mastering English." with a link to english-arcade.ir. Translated to Persian when FA mode is active.
6. **Verified** — ESLint clean, page returns 200, agent-browser confirms: 9 nav tabs (no Presenter), language switch works (EN→FA shows Persian text + RTL), creator info present in both EN and FA, contact links work, arcade ad present, no local-run hints remain, all 9 views navigate correctly.

## Verification results

- `bun run lint` → clean (no errors/warnings).
- Dev server: `GET / 200`, no compile errors.
- agent-browser visual QA: English mode (hero "Control your PC with bare hands", 8 tool cards, footer with creator + contact + arcade ad, no Presenter, no clone/pip/source-code references); Persian mode (hero "کامپیوتر خود را با دست خالی کنترل کنید", nav labels in Persian, RTL layout, creator name "هیژا خالدی" visible, footer translated).
- All 9 views navigate correctly in both languages.

## Unresolved issues / risks

- **Camera access requires a real user gesture + webcam** — cannot be fully exercised in agent-browser (headless, no camera). The MediaPipe model loads and all UI renders; the live hand-tracking loop only activates when a real user clicks Start and grants permission.
- **Tone.js audio context** — must start inside a user gesture (`Tone.start()`); handled in the orchestra `start` handler.
- **`@mediapipe/tasks-vision`** loads the model + WASM from a CDN (~7MB) on first Start; cached thereafter. Could be bundled locally for offline use.
- **Performance** — the views call `setState` every frame for live readouts; could throttle to reduce React re-renders if profiling shows issues on low-end devices.

## Priority recommendations for next phase

1. **Translate tool view internals** — the tool views (Cursor, Canvas, Whiteboard, Orchestra, Piano, Drumkit, Sign, Lab) still have English-only headings/descriptions/buttons. Extend i18n to cover these.
2. **Bundle MediaPipe locally** — move the `.task` model + WASM into `/public` so tools work offline and load faster.
3. **Tablet (768px) fine-tune** — the views stack at `lg` (1024px); a dedicated tablet pass could keep camera + sidebar side-by-side a bit longer with tighter spacing.
4. **Sign Trainer: J and S letters** — add motion-based detection for J (swipe) and S (thumb-across-fist) to complete the full 26-letter alphabet.
5. **Whiteboard: selection/move tool + redo + keyboard shortcuts** — Ctrl+Z / Ctrl+Y, and a select tool to move existing shapes.
6. **Drumkit: beat sequencer** — add a step-sequencer grid for programming drum patterns gesture-free.
