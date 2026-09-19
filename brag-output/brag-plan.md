# Brag Plan: AirTouch

## What is this app?
AirTouch is a browser-based gesture-control hub — 8 interactive tools (cursor control, air canvas, whiteboard, conducting orchestra, gesture piano, air drumkit, sign-language trainer, hand lab) driven entirely by real-time MediaPipe hand tracking. No backend, no cloud, no install.

## The angle
A hype-reel ad for the "control your PC with bare hands" fantasy. The joke that isn't a joke: this is real, it's live in the browser right now, and it makes mice feel obsolete. Every scene is a school of gesture (point, pinch, open palm) doing something absurd — conducting music with two hands, playing drums by pinching air, painting with a fingertip. Fast cuts, big neon type, metric slams. This is an ad, not a demo — the goal is "gimme the URL."

## Hook (first 2-3 seconds)
Black screen. A single glowing emerald 21-point hand skeleton slams in from the right, snapping into a scan-line grid. Giant type punches in: **TOUCHING MICE IS OVER.** Cut hard on a beat.

## Key moments (the middle)
- The skeleton's fingertip drives an on-screen cursor; a thumb-tuck C L I C K. (Cursor Control)
- A hand swings over a drumkit; a pinch lands on the kick pad — rim flash + drum hit.
- A hand flies over white piano keys; pinches fire two notes with a neon trail.
- Two hands hang in space, wrapped in fuchsia glow — "GENERATIVE MUSIC. WAIT. *CONDUCTED BY YOU*." Sound swells.
- Rapid-fire: a paint swish across a canvas, then an A-B-C sign gesture flash.
- Stat slam: **8 TOOLS / 21 LANDMARKS / ~10ms / 0 CLOUD** — cards knock in one per beat.

## Outro / punchline
Full-screen **AIRTOUCH** logo slam over the grid, tagline **CONTROL YOUR PC WITH BARE HANDS**, then a small URL strip. Scan-line fade out. "Open your webcam. Click one tool. Go."

## User flow worth showing
Entry → key action → result, per tool:
- **Cursor Control:** hand → fingertip starts gliding a cursor → thumb-tuck clicks a card.
- **Air Drumkit:** hand → pinch over a pad → pad flashes + sound.
- **Gesture Piano:** hand → pinch over keys → notes fly.
- **AI Orchestra:** two hands → generative music blooms.
Each highlight scene shows a mini "hand-does-thing" beat. The user flow is the video.

## Tone
- Preset: `chaotic`
- Creative direction: "overproduced mobile-game ad / hype reel for a gesture superpower"
- Interpretation: 6-8 rapid scenes, some under 2s. ALL CAPS heavy type, slightly oversized, occasional tilt on accent words. Hard cuts and zoom in from scale 1.15. Fast-in, then HOLD so every line stays readable. Music drives the cut rhythm.

## Format: landscape — 1920x1080
## Duration: 22.3s

## Visual identity (from the project)
- Background: `oklch(0.08 0.005 240)` — near-black cyber navy
- Accent primary: `oklch(0.72 0.19 155)` — emerald
- Secondary accents: `oklch(0.70 0.15 195)` cyan, `oklch(0.78 0.18 85)` amber, `oklch(0.62 0.22 305)` fuchsia, `oklch(0.65 0.20 15)` rose
- Text: `oklch(0.96 0.005 240)` — near-white
- Muted text: `oklch(0.65 0.01 240)`
- Display font: Geist (site's font stack); heavy weight for display, mono for metrics
- Strongest visual element: the neon 21-point hand skeleton overlay (emerald lines, cyan/amber joints) from the live demo — grid background, glass cards, gradient text (`emerald → cyan → amber`)

## Share copy (draft)
Mice are over. AirTouch is 8 gesture tools that run in your browser — play drums in the air, conduct generative music, paint with your fingertip. No install. Just your webcam.

## Audio direction
- Role: dense rhythmic hype layer
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (compact, punchy, ~110 BPM)
- Music treatment: start full from 0s, hot throughout, brief dip at 15.8s stat-lock then swell into the logo; no fade at the end (hard logo stop)
- Music cue guidance: bundled preset exists — `assets/music/cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json` (+ .md). Beat grid runs from ~0.27s (fast cuts snap to it). Strong cues cluster late in window (15.82/18.55/20.19s) — target the 20.19s area for the logo slam if it stays useful, otherwise natural timing. Beat-grid windows for the 4 stat cards and 2 rapid-fire highlights.
- Audio-reactive treatment: subtle-to-expressive; use RMS/bass to breathe the grid dots, the skeleton's glow, and the logo halo. No waveform/equalizer visuals, no strobing.
- SFX posture: dense, motion-matched. Pinch = punchy impact; card stats = card-shove; logo = impactBell.
- Audio-coupled moments: skeleton slam (whoosh + hard impact), cursor C L I C K (mouse click), drum hits (per pad), piano notes (per pinch, synths), stat cards (one per beat), logo slam (impact bell).
- Restraint rule: never cut a gain on top of the music so loud it whites out; keep SFX glued to the exact frame they annotate; no sustained shimmer/ring.

## Storyboard

### Scene 1 — HOOK — 2.9s (0.00–2.90)
Black, faint scan-line grid. An emerald 21-point hand skeleton slams in from the right edge and settles center. Tile-size word "OVER." lands last, big.
Sequential/interaction: yes — skeleton first, then headline hits in 2 chunks: "TOUCHING MICE" then "IS OVER."; the last word lands on the hardest beat.
Text reads: "TOUCHING MICE IS OVER."
Audio intent: instant loud attack, slam energy.
Audio-coupled idea: skeleton whoosh-in + hard impact on the first word; beat-locked headline.
Music: vol-10, from build-in.
Transition mood: hard cut → Scene 2

### Scene 2 — REVEAL — 3.0s (2.90–5.90)
Zoom-pan into a browser-like glass panel. The skeleton's fingertip glides a virtual cursor across the panel; a thumb-tuck C L I C K hits a "tool card." The card flips, brand name slams: "AIRTOUCH."
Sequential/interaction: yes — simulated cursor move, then click, then brand slam.
Text reads: "AIRTOUCH" + sub-chip "8 GESTURE TOOLS · YOUR WEBCAM".
Audio intent: mischievous fun → payoff.
Audio-coupled idea: cursor move tick, click sound on the thumb-tuck, impact on the brand slam. (interaction)
Transition mood: zoom cut → Scene 3

### Scene 3 — DRUMKIT — 2.6s (5.90–8.50)
A 6-pad drumkit rows in. A hand descends, hovers, PINCH on the kick pad — pad flashes rose, "KICK" slams in. Second pinch on snare — "SNARE."
Sequential/interaction: yes — two pinches, two pad hits arriving one after another on beats.
Text reads: "KICK" then "SNARE" (short labels, ~0.8s settled each).
Audio intent: percussive, hands-on, loud.
Audio-coupled idea: each pinch = drum-impact SFX synced to pad flash; beat-locked hits. (simulated interaction)
Transition mood: hard cut → Scene 4

### Scene 4 — PIANO — 2.6s (8.50–11.10)
White/orange key strip slides in. A hand flies across and pinches twice — two notes with a neon trail; note dots pop on a mini staff. Label: "GESTURE PIANO."
Sequential/interaction: yes — two pinch-notes (keys glow) echoing the previous scene's rhythm.
Text reads: "GESTURE PIANO" + single note ticks.
Audio intent: bouncy, melodic, lighter after the drums.
Audio-coupled idea: short synth blips per pinch aligned to the music's beat grid; key glow.
Transition mood: zoom cut → Scene 5

### Scene 5 — ORCHESTRA — 3.0s (11.10–14.10)
Pulls back to a wide stage. Two hands enter from left and right, wrapped in fuchsia glow, connected by an energy beam. "GENERATIVE MUSIC." pops, then smaller second line "CONDUCTED BY YOU." The glow blooms as the bed swells.
Sequential/interaction: yes — hands enter, beam forms, two lines pop in sequence.
Text reads: "GENERATIVE MUSIC." (2 words, hold) then "CONDUCTED BY YOU." (tail hold).
Audio intent: the biggest musical swell in the video.
Audio-coupled idea: swell on the beam; both text lines land on consecutive beats. (beat reveal)
Transition mood: crossfade-swipe → Scene 6

### Scene 6 — RAPID FIRE — 2.4s (14.10–16.50)
Two half-panels, hard cuts inside (chaotic): left, a fingertip paint swish across full-screen canvas, cyan trail, "PAINT IN AIR."; cut — right, a hand signing, "LEARN ASL." Tag chips shoot out.
Sequential/interaction: yes — two micro-beats back to back, both fast.
Text reads: "PAINT IN AIR." / "LEARN ASL." (short labels each ~0.8s settled — total 1.6s across 2.2s window: tight, fast-in + hold, no overlap).
Audio intent: quick-fire double punch.
Audio-coupled idea: canvas swish (whoosh), one sign chime; both on beats.
Transition mood: hard cut → Scene 7

### Scene 7 — STATS — 2.6s (16.50–19.10)
Four stat cards knock in one per beat from bottom with mono numerals: "8" / "21" / "~10ms" / "0". Cards carry small labels: "TOOLS" / "LANDMARKS" / "INFERENCE" / "CLOUD".
Sequential/interaction: yes — 4 cards, one per beat (~0.55s apart). Numerals are big and short, labels tiny.
Text reads: numbers + one-word labels, hold full set after.
Audio intent: cascade, confidence.
Audio-coupled idea: card-shove per beat on the grid — every card on a consecutive beat. (card sequence, beat-grid)
Transition mood: slam → Scene 8

### Scene 8 — OUTRO — 3.2s (19.10–22.30)
Logotype AIRTOUCH slams center over the grid, halo blooms. Tagline line 2 "CONTROL YOUR PC WITH BARE HANDS." URL chip "airtouch.com" (no dots needed — use a clean URL mound) fades in. Scan-line fade to black by 20.5.
Sequential/interaction: yes — logo → tagline → URL chip, staged on the late strong cues.
Text reads: "AIRTOUCH" / "CONTROL YOUR PC WITH BARE HANDS." (hold ~1.6s) / URL.
Audio intent: final hard hit, then silence.
Audio-coupled idea: impact bell on logo + the 20.19s strong cue if it holds the cut. (logo payoff)
Transition mood: fade to black (end)

**Scene durations sum:** 2.9 + 3.0 + 2.6 + 2.6 + 3.0 + 2.4 + 2.6 + 3.2 = **22.3s** ✓

**Music mood for this video:** punchy, aggressive, hype-reel; beat grid drives the cuts.
**Audio summary:** A dense percussive bed from frame one, hand-played cymbal-like SFX glued to every pinch/pad/key/stat, one swell at the orchestra reveal, and a hard impact bell on the logo before silence.