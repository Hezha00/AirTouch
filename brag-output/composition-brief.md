# Hyperframes Composition Brief: AirTouch

## Objective
Create a short hype-reel ad for AirTouch — a browser-based gesture-control hub with 8 tools driven by real-time MediaPipe hand tracking. The video sells "control your PC with bare hands" as a superpower. Goal: get viewers to open the site and try it.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20.5s (see storyboard; scene durations sum exactly)

## Source Material
- Project root: `/run/media/hezha/local 2/website/done/AirTouch/`
- Primary files read: `README.md`, `package.json`, `src/components/sections/hero.tsx`, `stats.tsx`, `features.tsx`, `gesture-guide.tsx`, `how-it-works.tsx`, `live-demo.tsx`, `ideas.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Product name: AirTouch
- Tagline / strongest claim: "Control your PC with bare hands" (hero headline)
- Key UI or visual moment to recreate: the neon 21-point hand skeleton overlay from the LiveDemo (emerald skeleton lines, cyan/amber joint dots, thumb-to-index click detection) over the dark cyber grid background; the 6-pad drumkit; 1.5-octave white/orange piano keys; two-hand orchestra; stat cards (21 / ~10ms / 8 / 0).
- Copy that must appear verbatim:
  - "Control your PC with bare hands"
  - "21 hand landmarks tracked / ~10ms per-frame inference / 8 interactive tools / 0 cloud dependencies"
  - "A hub for webcam-powered gesture tools · MediaPipe · Tone.js" (reference only)
  - Tool names: Cursor Control, Air Canvas, Air Whiteboard, AI Conducting Orchestra, Gesture Piano, Air Drumkit, Sign Language Trainer, Hand Lab

## Creative Direction
- Tone preset: `chaotic`
- Creative direction: "overproduced mobile-game ad / hype reel for a gesture superpower"
- Interpretation: 6-8 rapid scenes, some under 2s. ALL CAPS heavy type, slightly oversized, occasional tilt on accent words. Hard cuts and scale-zoom entrances (1.15 → 1.0). Fast-in then hold — every line stays readable (short label ~0.8s settled). Music's beat grid drives the cut rhythm.
- Angle: real tech sold with false-premium ad energy. Every scene is one school of gesture doing something absurd — conducting generative music with two hands, pinching air drums, painting with a fingertip. The product doing the thing, live.
- Hook: black screen, emerald 21-point hand skeleton slams in from the right; giant type "TOUCHING MICE IS OVER."
- Outro / punchline: full-screen AIRTOUCH logo slam, tagline "CONTROL YOUR PC WITH BARE HANDS.", URL chip, scan-line fade to black.
- Avoid:
  - Generic SaaS language ("streamline", "workflow", "elevate")
  - Abstract filler — every scene shows the product's own UI/tool
  - Busy text — max ~4 short reads per scene, held long enough
  - Waveform/equalizer/audio-visualizer graphics

## Visual Identity
- Background: `oklch(0.08 0.005 240)` near-black cyber navy
- Text: `oklch(0.96 0.005 240)` near-white
- Accent (primary): `oklch(0.72 0.19 155)` emerald — the site's brand color
- Secondary: cyan `oklch(0.70 0.15 195)`, amber `oklch(0.78 0.18 85)`, fuchsia `oklch(0.62 0.22 305)`, rose `oklch(0.65 0.20 15)`
- Muted text: `oklch(0.65 0.01 240)`
- Glass surfaces: `oklch(0.12 0.008 240 / 0.85)` with `1px oklch(1 0 0 / 0.08)` border
- Gradient headline treatment: linear-gradient `emerald → cyan → amber` (site `.text-gradient`)
- Display font: Geist (site font stack) — heavy weight for display type; mono (`Geist Mono`) for metrics/stats
- Background treatment: site `grid-bg` (48px grid, `oklch(1 0 0 / 0.03)` lines) with radial fade mask; body radial glows from emerald/cyan
- Visual references: 21-landmark skeleton drawing (emerald lines, amber joints, cyan fingertip ring — match `drawSkeleton` stroke colors), glass tool cards, stat cards, drumkit pad grid, piano keys

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. HOOK — 2.3s — t:0.00–2.30 — skeleton slams in; "TOUCHING MICE IS OVER." in 2 chunks
2. REVEAL — 3.0s — t:2.30–5.30 — fingertip drives cursor, thumb-tuck C L I C K, "AIRTOUCH" brand slam + chip
3. DRUMKIT — 2.6s — t:5.30–7.90 — 6 pads; two pinch hits (KICK / SNARE)
4. GESTURE PIANO — 2.6s — t:7.90–10.50 — key strip; two pinch-notes, neon trail; "GESTURE PIANO"
5. ORCHESTRA — 2.9s — t:10.50–13.40 — two hands + fuchsia beam; "GENERATIVE MUSIC." + "CONDUCTED BY YOU."
6. RAPID FIRE — 2.2s — t:13.40–15.60 — canvas swish "PAINT IN AIR." / hand signing "LEARN ASL."
7. STAT SLAM — 2.6s — t:15.60–18.20 — 4 stat cards one per beat: 8 / 21 / ~10ms / 0
8. CTA OUTRO — 2.3s — t:18.20–20.50 — AIRTOUCH logo, tagline, URL chip, fade to black

## Audio
- Audio role: dense rhythmic hype layer
- Audio arc: loud from 0 — percussive hand-played moments — one swell at orchestra — cascade at stats — hard bell stop at 20.5
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
- Music treatment: full from 0s, hot throughout; volume ~0.30-0.38; end at the hard logo stop (~20.5), no lingering fade tail
- Music cue guidance: bundled preset — `assets/music/cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json` (+ `.md`) copied alongside the track. Beat grid from ~0.27s (~0.55s spacing at 109.96 BPM) drives fast cuts and the stat-card cascade. Strong cues cluster late: 18.01/18.55/20.19/20.74s — target the logo slam near 20.19-20.74 if it stays within the 20.5s window, else land it naturally. These are optional timing hints; readability and story are primary.
- Audio-reactive treatment: subtle-to-expressive; use RMS/bass to breathe grid dots, the skeleton's glow, and the logo halo. No waveform/equalizer visuals, no strobing, no beat-pulsing text.
- Audio-coupled moments:
  - Scene 1 skeleton slam — whoosh + hard impact, beat-locked headline chunks
  - Scene 2 cursor move/click + brand slam — simulated interaction (click on thumb-tuck)
  - Scene 3 two pad hits — per-pinch drum-impact SFX synced to pad flash (simulated interaction)
  - Scene 4 two pinch-notes — short synth blips aligned to beat grid (simulated interaction)
  - Scene 5 beam + two lines — swell + two consecutive-beat text landings (beat reveal)
  - Scene 6 canvas swish + sign chime — whoosh + one chime, on beats
  - Scene 7 four stat cards — card-shove on every beat of a 4-beat window (card sequence, beat-grid)
  - Scene 8 logo — impact bell on logo slam (logo payoff)
- SFX selection guidance: chaotic tone — punchy impact per gesture, card-shove for stats, mouseclick for the simulated click, whoosh for entrances, impact bell for the logo. Glue SFX to the exact frame they annotate. Density is high by design (chaotic), but never clip; keep SFX audible at 0.55-0.85 with music at 0.30-0.38.
- SFX analysis guidance: pass `skills/brag/assets/sfx/sfx-analysis.md` along with the composition task. Prefer `impactPunch_medium/heavy`, `impactSoft_medium_*`, `ui/mouseclick1`, `casino/card-shove-*`, `casino/card-fan-*`, `impact/impactBell_heavy_000`, `casino/dice-throw-*` — low/medium HF risk for the repeated pinch-hits.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, and volume from the implemented animation.
- Audio files: copy the chosen music + cue preset into `brag-output/composition/assets/` (music + cues). Copy selected SFX into `brag-output/composition/assets/sfx/` after choosing files.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (the 21-point skeleton with the exact site draw colors, stat cards with verbatim values, tool names).
- Keep all text readable in the final render (short labels hold ≥0.8s settled; headline sentences ~0.3s/word).
- Keep the video within 15-25 seconds (target 20.5s).
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Major reveals may move toward strong cues within ±0.15s; smaller entrances may align to beats within ±0.10s. Use 1-3 strong cue locks max (recommend: skeleton slam, orchestra beam, logo).
- Stat cards and the two beats of Scene 6 should snap to consecutive beat-grid points where helpful; mark `// beat-grid` lines. Ensure the stat numerals are big/instant and labels tiny so a ~0.55s cadence reads clean — otherwise space them every other beat and hold.
- Use SFX to support motion: whoosh + impact on skeleton slam, mouseclick on the click, punch per drum, blip per note, card-shove per stat, impact bell on logo.
- Honor the music treatment: hard stop at the logo, no tail.
- Consider the Hyperframes audio-reactive workflow: extract per-frame RMS/frequency data and wire it subtly to the grid dots' opacity, the skeleton glow, and the logo halo.
- Use local assets for audio. All asset paths relative to `composition/`.
- Run `hyperframes check` before render — it is brag's single gate. Fix every error including WCAG contrast failures.