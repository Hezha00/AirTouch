# 🖐️ Gesture Control — Hand-Gesture PC Controller (Windows)

A lightweight, single-process Python desktop application that lets you
control your Windows PC with hand gestures using a regular webcam.

* **Camera / UI** — `opencv-python`
* **Hand tracking** — `mediapipe` (21 landmarks, 1 hand)
* **System control** — `pyautogui`
* **Math / smoothing** — `numpy`
* **Volume** — `pycaw` (fine-grained) with a `pyautogui` media-key fallback

---

## ✨ Features

| Gesture | Action |
|---|---|
| ☝️ Index finger only (others folded) | Move the mouse cursor (EMA-smoothed, anti-jitter) |
| 🤏 Pinch **Index** tip + **Thumb** tip | **Left click** (debounced) |
| 🤏 Pinch **Middle** tip + **Thumb** tip | **Right click** (debounced) |
| ✌️ Index + Middle extended, move hand up/down | **Scroll** up / down |
| ✋ Open palm (all 5 fingers) | **Volume mode** — push hand toward camera = louder, pull away = softer |

Extras:
- Horizontally mirrored feed (natural "selfie" feel).
- Live 21-point hand skeleton overlay.
- Top-left HUD: detected gesture, cursor coords, FPS, live volume %.
- Active **bounding box** in the centre of the frame so you never have to
  stretch your arm to the screen edges.
- Pinch proximity meters next to the finger tips.
- Toggleable **on-screen help overlay** (`H`).
- Beautifully formatted **ASCII guide** printed to the terminal on startup.
- Depth-invariant pinch thresholds (normalised by hand reference size).
- **PyAutoGUI failsafe** (move mouse to a screen corner to abort) + `Q`/`ESC`
  to quit.

---

## 🛠️ Setup (Windows)

### 1. Python
Install **Python 3.10 or 3.11** (MediaPipe wheels are not yet published for
3.12+ on all platforms). Check with:

```bash
python --version
```

### 2. Install dependencies

From the `gesture-control` folder:

```bash
pip install -r requirements.txt
```

…or install the core stack manually:

```bash
pip install opencv-python mediapipe pyautogui numpy
pip install pycaw comtypes      # Windows volume (recommended)
```

> `pycaw` / `comtypes` are Windows-only. If they are missing, the app
> automatically falls back to coarse `volumeup` / `volumedown` media-key
> presses.

### 3. Run

```bash
python main.py
```

Use a different webcam:

```bash
python main.py --camera 1
```

---

## 🎮 Controls

| Key | Action |
|---|---|
| `H` | Toggle the on-screen help overlay |
| `Q` or `ESC` | Quit the application |
| Move mouse to a screen corner | PyAutoGUI **failsafe abort** |

---

## ⚙️ Tuning

All thresholds live in **`config.py`**. The most useful knobs:

| Constant | Meaning |
|---|---|
| `EMA_ALPHA` | Cursor smoothing (lower = smoother/laggier, higher = snappier) |
| `BOX_X_MARGIN` / `BOX_Y_MARGIN` | Size of the active cursor region |
| `PINCH_THRESHOLD` | How close a pinch must be (normalised, depth-invariant) |
| `CLICK_COOLDOWN` | Min seconds between clicks |
| `SCROLL_THRESHOLD` / `SCROLL_TICKS` | Scroll sensitivity |
| `VOL_MIN_DIST` / `VOL_MAX_DIST` | Hand-distance range mapped to 0–100% volume |

---

## 🧠 How it works (short version)

1. Each frame is mirrored and fed to MediaPipe Hands (`max_num_hands=1`,
   confidences `0.7`).
2. The **index-finger tip** (landmark 8) drives the cursor.
3. Raw tip coordinates are mapped from the active bounding box to the
   monitor resolution with `numpy.interp`, then smoothed with an
   **Exponential Moving Average** to kill jitter.
4. A small **state machine** resolves the current gesture with a strict
   priority: `Volume > Left-pinch > Right-pinch > Scroll > Move > Idle`.
5. Pinch distances are **normalised by the hand reference size**
   (wrist → middle-MCP) so they work at any distance from the camera.
6. In **Volume mode**, that same reference size is interpreted as hand
   proximity and mapped (with EMA + deadband) to the Windows master volume.

---

## 🩺 Troubleshooting

- **Black window / "could not open the webcam"** — close other apps that
  use the camera (Zoom, Teams, browser tabs) or try `--camera 1`.
- **Cursor drifts / vibrates** — lower `EMA_ALPHA` (e.g. `0.25`) and improve
  lighting.
- **Clicks fire too easily** — lower `PINCH_THRESHOLD` to `0.35`, or raise
  `CLICK_COOLDOWN`.
- **Volume doesn't change** — install `pycaw` + `comtypes`; the media-key
  fallback is coarse on purpose.
- **Lost control** — slam the mouse to any screen corner (PyAutoGUI
  failsafe) or press `Q`/`ESC`.

---

## 📁 Project layout

```
gesture-control/
├── main.py                # entry point + main loop
├── config.py              # all tunable constants
├── hand_gestures.py       # finger states + gesture state machine
├── cursor_controller.py   # EMA smoothing + np.interp mapping
├── volume_control.py      # pycaw / media-key volume backend
├── ui.py                  # skeleton, HUD, help overlay, ASCII guide
├── requirements.txt
└── README.md
```

Enjoy hands-free computing! 🚀
