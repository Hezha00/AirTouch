# 🖐️ AirTouch — Gesture Control Hub

A browser-based gesture-recognition hub with **8 interactive tools**, all running entirely client-side with real MediaPipe hand tracking and Tone.js audio synthesis. No backend, no cloud, no install for end users.

**Creator:** Hezha Khaledi / هیژا خالدی
- Telegram: [@Hezha_kh00](https://t.me/Hezha_kh00)
- Instagram: [@Hezha_khaledi](https://instagram.com/Hezha_khaledi)
- Email: hezhakh4@gmail.com

---

## 🛠️ Tools

| Tool | Description |
|---|---|
| **Cursor Control** | A touchless mouse — move the cursor with your index finger, click by tucking your thumb |
| **Air Canvas** | Full-screen gesture painting studio — point to paint, pinch to lift, open hand to erase |
| **Air Whiteboard** | Multi-page whiteboard with pen, shapes, arrows, text, fill toggle, undo, PNG export |
| **AI Conducting Orchestra** | Two-handed generative music — right hand sets tempo & melody, left hand sets dynamics & harmony |
| **Gesture Piano** | 1.5-octave keyboard played by pinching over keys — 4 instruments, sustain pedal, record/playback |
| **Air Drumkit** | 6-pad drum kit (kick/snare/hihat/toms/cymbal) — pinch to hit, record & playback beats |
| **Sign Language Trainer** | Learn 20 ASL letters with live finger-pattern matching, practice + timed quiz (Easy/Med/Hard) |
| **Hand Lab** | Real-time 21-landmark visualizer with depth-shaded skeleton, 3D projection, finger extension bars |

---

## 📥 Download & Run Locally

### Prerequisites

- **Node.js 18+** (or [Bun](https://bun.sh) 1.0+)
- A webcam (for the gesture tools)
- A modern browser (Chrome, Edge, Firefox, Safari)

### Option A: Using npm

```bash
# 1. Download/extract the project, then:
cd airtouch

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev

# 4. Open http://localhost:3000 in your browser
```

### Option B: Using Bun (faster)

```bash
cd airtouch
bun install
bun run dev
```

### Production build

```bash
npm run build
npm run start
# → opens on http://localhost:3000
```

---

## 🌐 Deploy to a Real Website

### Deploy to Vercel (easiest, free tier)

1. Create an account at [vercel.com](https://vercel.com)
2. Push this project to a GitHub/GitLab/Bitbucket repo
3. Go to Vercel → "Add New Project" → import your repo
4. Vercel auto-detects Next.js — just click "Deploy"
5. Your site goes live at `https://your-project.vercel.app`

### Deploy to Netlify

1. Push to a Git repo
2. Go to [netlify.com](https://netlify.com) → "Add new site" → import repo
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Add the Next.js plugin (Netlify auto-detects it)

### Deploy to any VPS / hosting

```bash
# On your server:
git clone <your-repo-url> airtouch
cd airtouch
npm install
npm run build
npm run start

# The site runs on port 3000.
# Use nginx/Caddy to proxy port 80/443 to 3000.
```

### Deploy with Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t airtouch .
docker run -p 3000:3000 airtouch
```

---

## 🎯 How to Use

1. Open the site in your browser
2. Click any tool in the nav bar (Cursor, Canvas, Whiteboard, Orchestra, Piano, Drumkit, Sign, Hand Lab)
3. Click **Start** and allow camera access
4. The MediaPipe hand-tracking model loads (~7MB, cached after first load)
5. Follow the on-screen gesture guide for each tool

### Common Gestures

| Gesture | Action |
|---|---|
| ☝️ Point with index finger | Move cursor / draw / select |
| 🤏 Pinch (thumb + index) | Click / play note / hit drum / draw |
| 🖐 Open palm | Erase / sustain pedal / lift brush |
| ✊ Fist | Clear canvas / mute / previous |

---

## 🧱 Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Hand Tracking:** MediaPipe Tasks Vision (Google)
- **Audio:** Tone.js
- **Animations:** Framer Motion
- **Icons:** Lucide React

---

## 📁 Project Structure

```
airtouch/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main page (view switcher)
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles + theme
│   ├── components/
│   │   ├── hub-nav.tsx       # Top navigation with tool switcher
│   │   ├── site-footer.tsx   # Footer (creator, contact, ads)
│   │   ├── sections/         # Home page sections (hero, stats, etc.)
│   │   └── views/            # The 8 tool views
│   │       ├── cursor-control-view.tsx
│   │       ├── air-canvas-view.tsx
│   │       ├── whiteboard-view.tsx
│   │       ├── orchestra-view.tsx
│   │       ├── piano-view.tsx
│   │       ├── drumkit-view.tsx
│   │       ├── sign-trainer-view.tsx
│   │       └── hand-lab-view.tsx
│   └── lib/
│       ├── gesture/
│       │   ├── hub-context.tsx       # View state management
│       │   ├── use-hand-tracking.ts  # Shared MediaPipe hook
│       │   └── music-engine.ts       # Tone.js orchestra engine
│       └── utils.ts
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## ⚠️ Notes

- The MediaPipe model (~7MB) loads from a CDN on first use, then is cached by the browser
- All processing happens client-side — no video data leaves the user's device
- A webcam is required for the gesture tools (mouse fallback available in Canvas, Whiteboard, Piano, Drumkit)
- Audio tools (Orchestra, Piano, Drumkit) require a user gesture (clicking Start) to initialize the Web Audio API
