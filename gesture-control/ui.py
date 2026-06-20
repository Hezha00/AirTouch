"""
ui.py
=====
All OpenCV drawing: hand skeleton, status HUD, the fixed-size help
overlay, and the ASCII guide printed to the terminal on startup.

Updated for the full two-handed gesture set.
"""

from __future__ import annotations

import cv2
import numpy as np

from config import Config
from hand_gestures import (
    G_IDLE, G_MOVE, G_LCLICK, G_RCLICK, G_SCROLL, G_DRAG,
    G_VOL_UP, G_VOL_DOWN, G_VOLUME,
    G_START, G_TASKMGR, G_BROWSER,
    G_NONE, G_SHOW_DESKTOP, G_LOCK, G_MAXIMIZE, G_MINIMIZE,
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
    G_LCLICK:      (0, 200, 255),
    G_RCLICK:      (0, 120, 255),
    G_SCROLL:      (255, 200, 0),
    G_DRAG:        (0, 80, 255),
    G_VOL_UP:      (200, 0, 255),
    G_VOL_DOWN:    (140, 0, 200),
    G_VOLUME:      (200, 0, 255),
    G_START:       (255, 180, 80),
    G_TASKMGR:     (0, 120, 255),
    G_BROWSER:     (255, 255, 0),
    G_NONE:        (120, 120, 120),
    G_SHOW_DESKTOP:(255, 0, 200),
    G_LOCK:        (0, 0, 255),
    G_MAXIMIZE:    (0, 255, 255),
    G_MINIMIZE:    (180, 255, 0),
}


# --------------------------------------------------------------------------- #
#  Terminal guide
# --------------------------------------------------------------------------- #
def print_guide() -> None:
    guide = r"""
==============================================================================
||       G E S T U R E   C O N T R O L   -   T W O   H A N D S             ||
==============================================================================

  Control your Windows PC with your webcam using BOTH hands.
  The camera feed is mirrored, so left/right feel natural.

  =====================   RIGHT HAND   ===================================
    Gesture                              Action
  -------------------------------------------------------------------
    INDEX finger only                    Move mouse cursor
    Pinch THUMB + INDEX                  Left click
    Pinch THUMB + INDEX + MIDDLE         Right click
    INDEX + MIDDLE extended, move hand   Scroll up / down
    CLOSED FIST (move while held)        Mouse drag (hold left button)
    OPEN PALM pushed toward camera       Volume UP
    OPEN PALM pulled away from camera    Volume DOWN
  -------------------------------------------------------------------

  =====================   LEFT HAND   ====================================
    Gesture                              Action
  -------------------------------------------------------------------
    OPEN PALM                            Start menu (Win key)
    FIST                                  Task Manager (Ctrl+Shift+Esc)
    INDEX + MIDDLE  "V" shape            Open default browser
  -------------------------------------------------------------------

  =====================   BOTH HANDS   ===================================
    Gesture                              Action
  -------------------------------------------------------------------
    BOTH open palms (held)               Show desktop (Win+D)
    BOTH fists                            Lock PC (Win+L)
    BOTH open palms, move APART           Maximize window (Win+Up)
    BOTH open palms, move TOGETHER        Minimize window (Win+Down)
  -------------------------------------------------------------------

  CONTROLS
  --------
    H  ......... toggle on-screen help overlay
    Q / ESC .... quit the application
    Mouse to a screen corner ... PyAutoGUI failsafe abort

  TIPS
  ----
    * Each click / system command fires ONCE per gesture (with a short
      cooldown) so holds do not spam actions.
    * Combos override single-hand actions when both hands match.
    * The window is resizable; drag its edges to resize.

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


def draw_hand_label(frame: np.ndarray, lm, label: str,
                    gesture: str, cfg: Config) -> None:
    """Draw a small '<Hand>: <Gesture>' pill near the wrist."""
    h, w = frame.shape[:2]
    if not isinstance(lm, (list, tuple)) or not lm:
        return
    wx, wy = lm[0]
    px, py = int(wx * w), int(wy * h)
    text = f"{label}: {gesture}"
    color = GESTURE_COLORS.get(gesture, cfg.STATUS_FG)
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    bx, by = px - 4, py + 8
    cv2.rectangle(frame, (bx, by), (bx + tw + 8, by + th + 6), (0, 0, 0), -1)
    cv2.rectangle(frame, (bx, by), (bx + tw + 8, by + th + 6), color, 1)
    cv2.putText(frame, text, (bx + 4, by + th + 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)


def draw_pinch_meter(frame, cx, cy, ratio, threshold, cfg):
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
    right_gesture: str,
    left_gesture: str,
    combo: str,
    cursor: tuple[int, int] | None,
    fps: float,
) -> None:
    lines = [
        f"Combo : {combo}",
        f"Right : {right_gesture}",
        f"Left  : {left_gesture}",
        f"Cursor: {cursor[0]:>4d}, {cursor[1]:>4d}" if cursor else "Cursor:  --,  --",
        f"FPS   : {fps:5.1f}",
    ]

    pad = 8
    line_h = 22
    box_w = 320
    box_h = pad * 2 + line_h * len(lines)

    ccolor = GESTURE_COLORS.get(combo, cfg.STATUS_FG)
    rcolor = GESTURE_COLORS.get(right_gesture, cfg.STATUS_FG)
    lcolor = GESTURE_COLORS.get(left_gesture, cfg.STATUS_FG)

    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + box_w, 10 + box_h), cfg.STATUS_BG, -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.rectangle(frame, (10, 10), (10 + box_w, 10 + box_h), cfg.ACCENT, 1)

    for i, txt in enumerate(lines):
        y = 10 + pad + (i + 1) * line_h - 6
        if i == 0:
            c = ccolor
        elif i == 1:
            c = rcolor
        elif i == 2:
            c = lcolor
        else:
            c = cfg.STATUS_FG
        cv2.putText(frame, txt, (22, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Volume direction indicator (bottom-centre)
# --------------------------------------------------------------------------- #
def draw_volume_indicator(frame: np.ndarray, direction: int) -> None:
    """Show 'VOLUME UP ^' / 'VOLUME DOWN v' while in volume mode."""
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
    cv2.rectangle(frame, (x - 8, y - th - 6), (x + tw + 8, y + 6),
                  (0, 0, 0), -1)
    cv2.putText(frame, text, (x, y),
                cv2.FONT_HERSHEY_DUPLEX, 0.7, color, 1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Fixed-size help overlay
# --------------------------------------------------------------------------- #
_HELP_SECTIONS = [
    ("RIGHT HAND", [
        ("INDEX finger only",            "Move cursor"),
        ("Pinch THUMB + INDEX",          "Left click"),
        ("Pinch THUMB+INDEX+MIDDLE",     "Right click"),
        ("INDEX + MIDDLE, move hand",    "Scroll up / down"),
        ("CLOSED FIST (move while held)","Mouse drag"),
        ("OPEN PALM push toward cam",    "Volume UP"),
        ("OPEN PALM pull away",          "Volume DOWN"),
    ]),
    ("LEFT HAND", [
        ("OPEN PALM",                    "Start menu (Win)"),
        ("FIST",                         "Task Manager"),
        ("INDEX + MIDDLE  'V'",          "Open browser"),
    ]),
    ("BOTH HANDS", [
        ("BOTH open palms (held)",       "Show desktop (Win+D)"),
        ("BOTH fists",                   "Lock PC (Win+L)"),
        ("BOTH palms move APART",        "Maximize (Win+Up)"),
        ("BOTH palms move TOGETHER",     "Minimize (Win+Down)"),
    ]),
    ("KEYS", [
        ("H",                            "Toggle this help"),
        ("Q  /  ESC",                    "Quit"),
        ("Mouse -> corner",              "Failsafe abort"),
    ]),
]


def draw_help_overlay(frame: np.ndarray, cfg: Config) -> None:
    """Dim the feed and draw a FIXED-size help panel in the centre."""
    h, w = frame.shape[:2]
    pw, ph = cfg.HELP_PANEL_W, cfg.HELP_PANEL_H
    # clamp to frame just in case the frame is smaller than the panel
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
        dim, "GESTURE  GUIDE", (px + 24, py + 38),
        cv2.FONT_HERSHEY_DUPLEX, 0.8, cfg.ACCENT, 1, cv2.LINE_AA,
    )
    cv2.line(dim, (px + 24, py + 50), (px + pw - 24, py + 50), (90, 90, 90), 1)

    # 4. sections (fixed layout)
    y = py + 78
    for section_title, rows in _HELP_SECTIONS:
        cv2.putText(
            dim, section_title, (px + 28, y),
            cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA,
        )
        y += 24
        for gesture, action in rows:
            cv2.putText(
                dim, gesture, (px + 40, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, (220, 220, 220), 1, cv2.LINE_AA,
            )
            cv2.putText(
                dim, "->", (px + 360, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, (140, 140, 140), 1, cv2.LINE_AA,
            )
            cv2.putText(
                dim, action, (px + 390, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, cfg.ACCENT, 1, cv2.LINE_AA,
            )
            y += 22
        y += 8

    cv2.putText(
        dim, "Press H to close  |  Q / ESC to quit",
        (px + 28, py + ph - 20),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1, cv2.LINE_AA,
    )

    frame[:, :] = dim
