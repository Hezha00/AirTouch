"""
ui.py
=====
All OpenCV drawing: hand skeleton, status HUD, the fixed-size help
overlay, and the ASCII guide printed to the terminal on startup.

Focused right-hand-only gesture set.
"""

from __future__ import annotations

import cv2
import numpy as np

from config import Config
from hand_gestures import (
    G_IDLE, G_MOVE, G_LEFT_CLICK, G_RIGHT_CLICK, G_VOLUME, G_VIRTUAL_KB,
)

# MediaPipe hand skeleton.
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]

GESTURE_COLORS = {
    G_IDLE:        (120, 120, 120),
    G_MOVE:        (0, 255, 140),
    G_LEFT_CLICK:  (0, 200, 255),
    G_RIGHT_CLICK: (0, 120, 255),
    G_VOLUME:      (200, 0, 255),
    G_VIRTUAL_KB:  (255, 80, 255),
}


# --------------------------------------------------------------------------- #
#  Terminal guide
# --------------------------------------------------------------------------- #
def print_guide() -> None:
    guide = r"""
==============================================================================
||       G E S T U R E   C O N T R O L   -   R I G H T   H A N D            ||
==============================================================================

  Control your Windows PC with your webcam using ONE hand (the right).
  The camera feed is mirrored, so left/right feel natural.

  =====================   RIGHT HAND   ===================================
    Gesture                              Action
  -------------------------------------------------------------------
    INDEX finger only                    Move the mouse cursor
    Pinch THUMB + INDEX  (holdable)      Left mouse button:
                                           hold pinch  = button DOWN
                                           release     = button UP
                                           quick tap   = single click
                                           double tap  = double click
    Pinch THUMB + MIDDLE                 Right click (keep INDEX extended;
                                          cursor is FROZEN during the click
                                          so the mouse does not move)
    CLOSED FIST                          Toggle the Windows virtual keyboard
    OPEN PALM pushed toward camera       Volume UP
    OPEN PALM pulled away from camera    Volume DOWN
  -------------------------------------------------------------------

  CONTROLS
  --------
    H  ......... toggle on-screen help overlay
    Q / ESC .... quit the application
    Mouse to a screen corner ... PyAutoGUI failsafe abort

  TIPS
  ----
    * There are NO cooldowns -- actions respond instantly.
    * The left click behaves exactly like a physical mouse button:
      pinch-and-hold to drag, double-tap the pinch to double-click.
    * During a right-click (thumb+middle pinch) the cursor is frozen so
      your extended index finger does not drift the pointer.
    * Good, even lighting dramatically improves tracking.
    * Keep your hand ~40-60 cm from the camera.

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
    """Draw the 21-point skeleton.  ``lm`` is a list of 21 (x, y) tuples."""
    h, w = frame.shape[:2]
    conn_color = color or cfg.CONNECTION_COLOR
    joint_color = cfg.LANDMARK_COLOR

    if isinstance(lm, (list, tuple)) and len(lm) > 0 and isinstance(lm[0], (list, tuple)):
        norm_pts = [(float(p[0]), float(p[1])) for p in lm]
    elif hasattr(lm, "landmark"):
        norm_pts = [(p.x, p.y) for p in lm.landmark]
    else:
        return

    pts = [(int(x * w), int(y * h)) for x, y in norm_pts]

    for a, b in HAND_CONNECTIONS:
        if a < len(pts) and b < len(pts):
            cv2.line(frame, pts[a], pts[b], conn_color, 2, cv2.LINE_AA)
    for px, py in pts:
        cv2.circle(frame, (px, py), 4, joint_color, -1, cv2.LINE_AA)
    if len(pts) > 8:
        ix, iy = pts[8]
        cv2.circle(frame, (ix, iy), 9, cfg.ACCENT, 2, cv2.LINE_AA)


def draw_hand_label(frame: np.ndarray, lm, gesture: str, cfg: Config) -> None:
    """Draw a small 'R: <Gesture>' pill near the wrist."""
    h, w = frame.shape[:2]
    if not isinstance(lm, (list, tuple)) or not lm:
        return
    wx, wy = lm[0]
    px, py = int(wx * w), int(wy * h)
    text = f"R: {gesture}"
    color = GESTURE_COLORS.get(gesture, cfg.STATUS_FG)
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    bx, by = px - 4, py + 8
    cv2.rectangle(frame, (bx, by), (bx + tw + 8, by + th + 6), (0, 0, 0), -1)
    cv2.rectangle(frame, (bx, by), (bx + tw + 8, by + th + 6), color, 1)
    cv2.putText(frame, text, (bx + 4, by + th + 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)


def draw_pinch_meter(frame, cx, cy, ratio, threshold, cfg, label=""):
    """Tiny vertical bar showing how close a pinch is to triggering."""
    h, w = 30, 6
    x0, y0 = cx + 14, cy - h
    cv2.rectangle(frame, (x0, y0), (x0 + w, y0 + h), (60, 60, 60), -1)
    fill = max(0.0, min(1.0, 1.0 - (ratio / (threshold * 2.0))))
    fh = int(h * fill)
    color = (0, 0, 255) if ratio < threshold else (0, 200, 255)
    cv2.rectangle(frame, (x0, y0 + h - fh), (x0 + w, y0 + h), color, -1)
    if label:
        cv2.putText(frame, label, (x0 - 2, y0 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Status HUD (top-left)
# --------------------------------------------------------------------------- #
def draw_status(
    frame: np.ndarray,
    cfg: Config,
    gesture: str,
    cursor: tuple[int, int] | None,
    fps: float,
    left_held: bool,
) -> None:
    lines = [
        f"Gesture: {gesture}",
        f"Cursor : {cursor[0]:>4d}, {cursor[1]:>4d}" if cursor else "Cursor :  --,  --",
        f"LeftBtn: {'DOWN' if left_held else 'up'}",
        f"FPS    : {fps:5.1f}",
    ]

    pad = 8
    line_h = 22
    box_w = 300
    box_h = pad * 2 + line_h * len(lines)

    gcolor = GESTURE_COLORS.get(gesture, cfg.STATUS_FG)

    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + box_w, 10 + box_h), cfg.STATUS_BG, -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.rectangle(frame, (10, 10), (10 + box_w, 10 + box_h), cfg.ACCENT, 1)

    for i, txt in enumerate(lines):
        y = 10 + pad + (i + 1) * line_h - 6
        c = gcolor if i == 0 else cfg.STATUS_FG
        cv2.putText(frame, txt, (22, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Volume direction indicator (bottom-centre)
# --------------------------------------------------------------------------- #
def draw_volume_indicator(frame: np.ndarray, direction: int) -> None:
    h, w = frame.shape[:2]
    if direction > 0:
        text = "VOLUME  UP   ^"
        color = (200, 0, 255)
    elif direction < 0:
        text = "VOLUME DOWN  v"
        color = (140, 0, 200)
    else:
        text = "VOLUME  MODE"
        color = (200, 0, 255)
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_DUPLEX, 0.7, 1)
    x = (w - tw) // 2
    y = h - 30
    cv2.rectangle(frame, (x - 8, y - th - 6), (x + tw + 8, y + 6), (0, 0, 0), -1)
    cv2.putText(frame, text, (x, y),
                cv2.FONT_HERSHEY_DUPLEX, 0.7, color, 1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Fixed-size help overlay
# --------------------------------------------------------------------------- #
_HELP_ROWS = [
    ("INDEX finger only",            "Move cursor"),
    ("Pinch THUMB + INDEX (hold)",   "Left button down/up (mouse-like)"),
    ("Pinch THUMB + MIDDLE",         "Right click (cursor frozen)"),
    ("CLOSED FIST",                  "Toggle virtual keyboard"),
    ("OPEN PALM push toward cam",    "Volume UP"),
    ("OPEN PALM pull away",          "Volume DOWN"),
    ("H",                            "Toggle this help"),
    ("Q  /  ESC",                    "Quit"),
    ("Mouse -> corner",              "Failsafe abort"),
]


def draw_help_overlay(frame: np.ndarray, cfg: Config) -> None:
    """Dim the feed and draw a FIXED-size help panel in the centre."""
    h, w = frame.shape[:2]
    pw, ph = cfg.HELP_PANEL_W, cfg.HELP_PANEL_H
    pw = min(pw, w - 20)
    ph = min(ph, h - 20)
    px = (w - pw) // 2
    py = (h - ph) // 2

    # 1. dim the whole feed
    dim = (frame * 0.45).astype(np.uint8)

    # 2. panel background (fixed size)
    overlay = dim.copy()
    cv2.rectangle(overlay, (px, py), (px + pw, py + ph), (24, 24, 28), -1)
    cv2.addWeighted(overlay, 0.88, dim, 0.12, 0, dim)
    cv2.rectangle(dim, (px, py), (px + pw, py + ph), cfg.ACCENT, 2)

    # 3. title
    cv2.putText(
        dim, "GESTURE  GUIDE", (px + 24, py + 40),
        cv2.FONT_HERSHEY_DUPLEX, 0.8, cfg.ACCENT, 1, cv2.LINE_AA,
    )
    cv2.line(dim, (px + 24, py + 52), (px + pw - 24, py + 52), (90, 90, 90), 1)

    # 4. rows
    y = py + 84
    for gesture, action in _HELP_ROWS:
        cv2.putText(
            dim, gesture, (px + 32, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA,
        )
        cv2.putText(
            dim, "->", (px + 300, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (140, 140, 140), 1, cv2.LINE_AA,
        )
        cv2.putText(
            dim, action, (px + 330, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, cfg.ACCENT, 1, cv2.LINE_AA,
        )
        y += 28

    cv2.putText(
        dim, "Press H to close  |  Q / ESC to quit",
        (px + 28, py + ph - 20),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1, cv2.LINE_AA,
    )

    frame[:, :] = dim
