"""
ui.py
=====
All OpenCV drawing: hand skeleton, status HUD, the toggleable help
overlay, and the ASCII guide printed to the terminal on startup.

Updated for the two-handed gesture set.
"""

from __future__ import annotations

import cv2
import numpy as np

from config import Config
from hand_gestures import (
    G_IDLE, G_MOVE, G_LCLICK, G_RCLICK, G_SCROLL, G_VOLUME, G_WINTAB,
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
    G_WINTAB: (255, 80, 255),
}


# --------------------------------------------------------------------------- #
#  Terminal guide
# --------------------------------------------------------------------------- #
def print_guide() -> None:
    guide = r"""
==============================================================================
||                                                                          ||
||     G E S T U R E   C O N T R O L   -   T W O   H A N D S   M O D E     ||
||                                                                          ||
==============================================================================

  Control your Windows PC with your webcam using BOTH hands.
  The camera feed is mirrored, so left/right feel natural.

  =====================   RIGHT HAND   ===================================
    Gesture                              Action
  -------------------------------------------------------------------
    INDEX finger only (others folded)    Move the mouse cursor
    OPEN PALM  (all 5 fingers out)       VOLUME: push hand toward camera
                                         = louder, pull away = softer
    INDEX + MIDDLE extended & TIPS       SCROLL: move wrist UP = up,
    TOUCHING, then move wrist up/down     move wrist DOWN = down
  -------------------------------------------------------------------

  =====================   LEFT HAND    ===================================
    Gesture                              Action
  -------------------------------------------------------------------
    Pinch INDEX tip + THUMB tip          Left  click  (debounced)
    THUMBS UP (only thumb up, pointing   Right click  (debounced)
    up, other fingers folded)
    FIST  (all fingers folded)           Win + Tab  (Task View)
  -------------------------------------------------------------------

  CONTROLS
  --------
    H  ......... toggle on-screen help overlay
    Q / ESC .... quit the application
    Mouse to a screen corner ... PyAutoGUI failsafe abort

  TIPS
  ----
    * Good, even lighting dramatically improves tracking.
    * Keep your hands ~40-60 cm from the camera.
    * TWO hands are tracked at once (left + right).
    * Raise only ONE hand if the other is not needed; the app handles
      a missing hand gracefully.
    * The cursor only moves while the RIGHT hand is in MOVE pose.

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


def draw_landmarks(frame: np.ndarray, lm, cfg: Config,
                   color: tuple | None = None) -> None:
    """
    Draw the 21-point skeleton.

    ``lm`` may be EITHER:
      * a list of 21 (x, y) tuples in normalised 0..1 coords, OR
      * a legacy MediaPipe ``landmark`` object exposing ``.landmark[i].x/.y``.

    ``color`` overrides the connection/joint colour (used to tint left vs
    right hands).  Defaults to ``cfg.CONNECTION_COLOR``.
    """
    h, w = frame.shape[:2]
    conn_color = color or cfg.CONNECTION_COLOR
    joint_color = cfg.LANDMARK_COLOR

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
            cv2.line(frame, pts[a], pts[b], conn_color, 2, cv2.LINE_AA)

    # joints
    for px, py in pts:
        cv2.circle(frame, (px, py), 4, joint_color, -1, cv2.LINE_AA)

    # highlight the index tip (landmark 8) -- the cursor driver
    if len(pts) > 8:
        ix, iy = pts[8]
        cv2.circle(frame, (ix, iy), 9, cfg.ACCENT, 2, cv2.LINE_AA)


def draw_hand_label(frame: np.ndarray, lm, label: str,
                    gesture: str, cfg: Config) -> None:
    """Draw a small label near the wrist: '<Hand> : <Gesture>'."""
    h, w = frame.shape[:2]
    norm_pts = lm if isinstance(lm, (list, tuple)) else []
    if not norm_pts:
        return
    wx, wy = norm_pts[0]
    px, py = int(wx * w), int(wy * h)
    text = f"{label}: {gesture}"
    color = GESTURE_COLORS.get(gesture, cfg.STATUS_FG)
    # background pill
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    bx, by = px - 4, py + 8
    cv2.rectangle(frame, (bx, by), (bx + tw + 8, by + th + 6),
                  (0, 0, 0), -1)
    cv2.rectangle(frame, (bx, by), (bx + tw + 8, by + th + 6),
                  color, 1)
    cv2.putText(frame, text, (bx + 4, by + th + 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)


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
#  Status HUD (top-left) -- now shows BOTH hands
# --------------------------------------------------------------------------- #
def draw_status(
    frame: np.ndarray,
    cfg: Config,
    right_gesture: str,
    left_gesture: str,
    cursor: tuple[int, int] | None,
    fps: float,
    volume_pct: float | None,
    vol_backend: str,
) -> None:
    lines = [
        f"Right : {right_gesture}",
        f"Left  : {left_gesture}",
        f"Cursor: {cursor[0]:>4d}, {cursor[1]:>4d}" if cursor else "Cursor:  --,  --",
        f"FPS   : {fps:5.1f}",
    ]
    if volume_pct is not None:
        lines.append(f"Volume: {volume_pct:5.1f}%  [{vol_backend}]")

    pad = 8
    line_h = 22
    box_w = 320
    box_h = pad * 2 + line_h * len(lines)

    rcolor = GESTURE_COLORS.get(right_gesture, cfg.STATUS_FG)
    lcolor = GESTURE_COLORS.get(left_gesture, cfg.STATUS_FG)

    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + box_w, 10 + box_h), cfg.STATUS_BG, -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.rectangle(frame, (10, 10), (10 + box_w, 10 + box_h), cfg.ACCENT, 1)

    for i, txt in enumerate(lines):
        y = 10 + pad + (i + 1) * line_h - 6
        if i == 0:
            c = rcolor
        elif i == 1:
            c = lcolor
        else:
            c = cfg.STATUS_FG
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
_HELP_SECTIONS = [
    ("RIGHT HAND", [
        ("INDEX finger only",           "Move cursor"),
        ("OPEN PALM (push / pull)",     "Volume louder / softer"),
        ("INDEX+MIDDLE tips touch,",    "Scroll (wrist up=up,"),
        ("  move wrist up / down",       "  wrist down=down)"),
    ]),
    ("LEFT HAND", [
        ("Pinch INDEX + THUMB",         "Left click"),
        ("THUMBS UP",                   "Right click"),
        ("FIST (all folded)",           "Win + Tab"),
    ]),
    ("KEYS", [
        ("H",                            "Toggle this help"),
        ("Q  /  ESC",                    "Quit"),
        ("Mouse -> corner",             "Failsafe abort"),
    ]),
]


def draw_help_overlay(frame: np.ndarray, cfg: Config) -> None:
    h, w = frame.shape[:2]

    # 1. dim the whole feed
    dim = (frame * 0.45).astype(np.uint8)

    # 2. panel
    pw = min(620, w - 40)
    ph = 440
    px = (w - pw) // 2
    py = (h - ph) // 2

    overlay = dim.copy()
    cv2.rectangle(overlay, (px, py), (px + pw, py + ph), (24, 24, 28), -1)
    cv2.addWeighted(overlay, 0.85, dim, 0.15, 0, dim)
    cv2.rectangle(dim, (px, py), (px + pw, py + ph), cfg.ACCENT, 2)

    # 3. title
    cv2.putText(
        dim, "GESTURE  GUIDE  (two-hand mode)", (px + 24, py + 44),
        cv2.FONT_HERSHEY_DUPLEX, 0.8, cfg.ACCENT, 1, cv2.LINE_AA,
    )
    cv2.line(dim, (px + 24, py + 58), (px + pw - 24, py + 58), (90, 90, 90), 1)

    # 4. sections
    y = py + 90
    for section_title, rows in _HELP_SECTIONS:
        cv2.putText(
            dim, section_title, (px + 28, y),
            cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA,
        )
        y += 28
        for gesture, action in rows:
            cv2.putText(
                dim, gesture, (px + 40, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA,
            )
            cv2.putText(
                dim, "->", (px + 350, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (140, 140, 140), 1, cv2.LINE_AA,
            )
            cv2.putText(
                dim, action, (px + 385, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, cfg.ACCENT, 1, cv2.LINE_AA,
            )
            y += 24
        y += 10

    cv2.putText(
        dim, "Press H to close  |  Q / ESC to quit",
        (px + 28, py + ph - 24),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1, cv2.LINE_AA,
    )

    frame[:, :] = dim
