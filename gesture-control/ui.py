"""
ui.py
=====
All OpenCV drawing: hand skeleton, status HUD, the toggleable help
overlay, and the ASCII guide printed to the terminal on startup.
"""

from __future__ import annotations

import cv2
import numpy as np

from config import Config
from hand_gestures import (
    G_IDLE, G_MOVE, G_LCLICK, G_RCLICK, G_SCROLL, G_VOLUME,
)

# MediaPipe hand skeleton (frozenset pairs of landmark indices).
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),            # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),            # index
    (5, 9), (9, 10), (10, 11), (11, 12),       # middle
    (9, 13), (13, 14), (14, 15), (15, 16),     # ring
    (13, 17), (17, 18), (18, 19), (19, 20),    # pinky
    (0, 17),                                   # palm base
]

# Gesture -> accent colour (BGR).
GESTURE_COLORS = {
    G_IDLE:   (120, 120, 120),
    G_MOVE:   (0, 255, 140),
    G_LCLICK: (0, 200, 255),
    G_RCLICK: (0, 120, 255),
    G_SCROLL: (255, 200, 0),
    G_VOLUME: (200, 0, 255),
}


# --------------------------------------------------------------------------- #
#  Terminal guide
# --------------------------------------------------------------------------- #
def print_guide() -> None:
    guide = r"""
==============================================================================
||                                                                          ||
||        G E S T U R E   C O N T R O L   -   P C   v i a   H a n d        ||
||                                                                          ||
==============================================================================

  Control your Windows PC with your webcam.  Keep one hand in frame and
  the active bounding box (the rectangle drawn on the feed).

  +------------------------------------------------------------------------+
  |  GESTURE                        |  ACTION                              |
  +---------------------------------+--------------------------------------+
  |  Point with INDEX finger only   |  Move the mouse cursor               |
  |  (other fingers folded)         |                                      |
  +---------------------------------+--------------------------------------+
  |  PINCH Index tip + Thumb tip    |  Left  click  (debounced)            |
  +---------------------------------+--------------------------------------+
  |  PINCH Middle tip + Thumb tip   |  Right click  (debounced)            |
  +---------------------------------+--------------------------------------+
  |  INDEX + MIDDLE extended, then  |  Scroll  (move hand up = up,         |
  |  move hand up / down            |   move hand down = down)             |
  +---------------------------------+--------------------------------------+
  |  OPEN PALM (all 5 fingers out)  |  VOLUME mode:  push hand toward the  |
  |                                 |  camera = louder, pull away = softer |
  +---------------------------------+--------------------------------------+

  CONTROLS
  --------
    H  ......... toggle on-screen help overlay
    Q / ESC .... quit the application
    Mouse to a screen corner ... PyAutoGUI failsafe abort

  TIPS
  ----
    * Good, even lighting dramatically improves tracking.
    * Keep your hand ~40-60 cm from the camera.
    * Only ONE hand is tracked at a time (left or right).
    * The cursor only moves while you are in MOVE pose, so pinching to
      click will not drag the pointer around.

==============================================================================
"""
    print(guide)


# --------------------------------------------------------------------------- #
#  Drawing primitives
# --------------------------------------------------------------------------- #
def draw_bounding_box(frame: np.ndarray, cfg: Config) -> None:
    h, w = frame.shape[:2]
    x1 = int(cfg.BOX_X_MARGIN * w)
    y1 = int(cfg.BOX_Y_MARGIN * h)
    x2 = int((1.0 - cfg.BOX_X_MARGIN) * w)
    y2 = int((1.0 - cfg.BOX_Y_MARGIN) * h)
    cv2.rectangle(frame, (x1, y1), (x2, y2), cfg.BOX_COLOR, 1)


def draw_landmarks(frame: np.ndarray, lm, cfg: Config) -> None:
    """
    Draw the 21-point skeleton.

    ``lm`` may be EITHER:
      * a list of 21 (x, y) tuples in normalised 0..1 coords, OR
      * a legacy MediaPipe ``landmark`` object exposing ``.landmark[i].x/.y``.
    """
    h, w = frame.shape[:2]

    # Normalise both forms to a list of (x, y) normalised tuples.
    if isinstance(lm, (list, tuple)) and len(lm) > 0 and isinstance(lm[0], (list, tuple)):
        norm_pts = [(float(p[0]), float(p[1])) for p in lm]
    elif hasattr(lm, "landmark"):
        norm_pts = [(p.x, p.y) for p in lm.landmark]
    else:
        return

    pts = [(int(x * w), int(y * h)) for x, y in norm_pts]

    # connections
    for a, b in HAND_CONNECTIONS:
        if a < len(pts) and b < len(pts):
            cv2.line(frame, pts[a], pts[b], cfg.CONNECTION_COLOR, 2, cv2.LINE_AA)

    # joints
    for px, py in pts:
        cv2.circle(frame, (px, py), 4, cfg.LANDMARK_COLOR, -1, cv2.LINE_AA)

    # highlight the index tip (landmark 8) -- the cursor driver
    if len(pts) > 8:
        ix, iy = pts[8]
        cv2.circle(frame, (ix, iy), 9, cfg.ACCENT, 2, cv2.LINE_AA)


def draw_pinch_meter(frame, cx, cy, ratio, threshold, cfg):
    """Tiny vertical bar showing how close a pinch is to triggering."""
    h, w = 30, 6
    x0, y0 = cx + 14, cy - h
    cv2.rectangle(frame, (x0, y0), (x0 + w, y0 + h), (60, 60, 60), -1)
    fill = max(0.0, min(1.0, 1.0 - (ratio / (threshold * 2.0))))
    fh = int(h * fill)
    color = (0, 0, 255) if ratio < threshold else (0, 200, 255)
    cv2.rectangle(frame, (x0, y0 + h - fh), (x0 + w, y0 + h), color, -1)


# --------------------------------------------------------------------------- #
#  Status HUD (top-left)
# --------------------------------------------------------------------------- #
def draw_status(
    frame: np.ndarray,
    cfg: Config,
    gesture: str,
    cursor: tuple[int, int] | None,
    fps: float,
    volume_pct: float | None,
    vol_backend: str,
) -> None:
    color = GESTURE_COLORS.get(gesture, cfg.STATUS_FG)

    lines = [
        f"Gesture : {gesture}",
        f"Cursor  : {cursor[0]:>4d}, {cursor[1]:>4d}" if cursor else "Cursor  :  --,  --",
        f"FPS     : {fps:5.1f}",
    ]
    if volume_pct is not None:
        lines.append(f"Volume  : {volume_pct:5.1f}%  [{vol_backend}]")

    pad = 8
    line_h = 22
    box_w = 320
    box_h = pad * 2 + line_h * len(lines)

    # translucent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + box_w, 10 + box_h), cfg.STATUS_BG, -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.rectangle(frame, (10, 10), (10 + box_w, 10 + box_h), color, 1)

    for i, txt in enumerate(lines):
        y = 10 + pad + (i + 1) * line_h - 6
        c = color if i == 0 else cfg.STATUS_FG
        cv2.putText(frame, txt, (22, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Volume bar (bottom-centre) while in VOLUME mode
# --------------------------------------------------------------------------- #
def draw_volume_bar(frame: np.ndarray, level: float) -> None:
    h, w = frame.shape[:2]
    bw, bh = 260, 16
    x = (w - bw) // 2
    y = h - 50
    cv2.rectangle(frame, (x, y), (x + bw, y + bh), (50, 50, 50), -1)
    fw = int(bw * max(0.0, min(1.0, level)))
    cv2.rectangle(frame, (x, y), (x + fw, y + bh), (200, 0, 255), -1)
    cv2.rectangle(frame, (x, y), (x + bw, y + bh), (220, 220, 220), 1)
    cv2.putText(
        frame, f"VOLUME  {int(level * 100):3d}%", (x, y - 8),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (235, 235, 235), 1, cv2.LINE_AA,
    )


# --------------------------------------------------------------------------- #
#  Toggleable help overlay
# --------------------------------------------------------------------------- #
_HELP_ROWS = [
    ("INDEX finger only",          "Move cursor"),
    ("Pinch INDEX + THUMB",        "Left click"),
    ("Pinch MIDDLE + THUMB",       "Right click"),
    ("INDEX + MIDDLE (move up/dn)","Scroll up / down"),
    ("OPEN PALM (push/pull)",      "Volume louder / softer"),
    ("H",                           "Toggle this help"),
    ("Q  /  ESC",                   "Quit"),
]


def draw_help_overlay(frame: np.ndarray, cfg: Config) -> None:
    h, w = frame.shape[:2]

    # 1. dim the whole feed
    dim = (frame * 0.45).astype(np.uint8)

    # 2. panel
    pw, ph = min(560, w - 40), 360
    px = (w - pw) // 2
    py = (h - ph) // 2

    overlay = dim.copy()
    cv2.rectangle(overlay, (px, py), (px + pw, py + ph), (24, 24, 28), -1)
    cv2.addWeighted(overlay, 0.85, dim, 0.15, 0, dim)
    cv2.rectangle(dim, (px, py), (px + pw, py + ph), cfg.ACCENT, 2)

    # 3. title
    cv2.putText(
        dim, "GESTURE  GUIDE", (px + 24, py + 44),
        cv2.FONT_HERSHEY_DUPLEX, 0.9, cfg.ACCENT, 1, cv2.LINE_AA,
    )
    cv2.line(dim, (px + 24, py + 58), (px + pw - 24, py + 58), (90, 90, 90), 1)

    # 4. rows
    y = py + 92
    for gesture, action in _HELP_ROWS:
        cv2.putText(
            dim, gesture, (px + 28, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA,
        )
        cv2.putText(
            dim, "->", (px + 330, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (140, 140, 140), 1, cv2.LINE_AA,
        )
        cv2.putText(
            dim, action, (px + 370, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, cfg.ACCENT, 1, cv2.LINE_AA,
        )
        y += 34

    cv2.putText(
        dim, "Press H to close  |  Q / ESC to quit",
        (px + 28, py + ph - 24),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1, cv2.LINE_AA,
    )

    frame[:, :] = dim
