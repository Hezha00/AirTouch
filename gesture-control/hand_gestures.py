"""
hand_gestures.py
================
Two-handed hand-landmark analysis + gesture state machine.

Gestures are split by hand:

RIGHT HAND
----------
  * MOVE      : index finger extended, others folded       -> move cursor
  * VOLUME    : open palm (all 5 extended)                  -> proximity volume
  * SCROLL    : index + middle extended AND their tips are
                touching; wrist moves up/down              -> scroll up/down

LEFT HAND
---------
  * LCLICK    : index tip + thumb tip pinch                -> left  click
  * RCLICK    : thumbs up (only thumb extended, pointing up) -> right click
  * WIN_TAB   : fist (all fingers folded)                  -> Win+Tab (task view)

Idle / none-of-the-above yields IDLE for that hand.

All distances are computed in MediaPipe's normalised space and divided by
the hand "reference size" (wrist -> middle-finger MCP) so that thresholds
stay correct no matter how close or far the hand is from the camera.
"""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from config import Config

# --------------------------------------------------------------------------- #
#  MediaPipe landmark indices
# --------------------------------------------------------------------------- #
WRIST = 0
THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP = 1, 2, 3, 4
INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP = 5, 6, 7, 8
MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP = 9, 10, 11, 12
RING_MCP, RING_PIP, RING_DIP, RING_TIP = 13, 14, 15, 16
PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP = 17, 18, 19, 20

_FINGER_PAIRS = (
    (INDEX_TIP, INDEX_PIP),
    (MIDDLE_TIP, MIDDLE_PIP),
    (RING_TIP, RING_PIP),
    (PINKY_TIP, PINKY_PIP),
)

# Gesture identifiers.
G_IDLE = "Idle"
# right-hand
G_MOVE = "Move"
G_VOLUME = "Volume"
G_SCROLL = "Scroll"
# left-hand
G_LCLICK = "Left Click"
G_RCLICK = "Right Click"
G_WINTAB = "Win+Tab"


# --------------------------------------------------------------------------- #
#  Landmarks helper
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class Landmarks:
    pts: list[tuple[float, float]]   # 21 (x, y) tuples in 0..1 space

    def x(self, idx: int) -> float:
        return self.pts[idx][0]

    def y(self, idx: int) -> float:
        return self.pts[idx][1]

    def dist(self, a: int, b: int) -> float:
        ax, ay = self.pts[a]
        bx, by = self.pts[b]
        return math.hypot(ax - bx, ay - by)

    @property
    def reference_size(self) -> float:
        return self.dist(WRIST, MIDDLE_MCP) or 1e-6


# --------------------------------------------------------------------------- #
#  Finger-state helpers
# --------------------------------------------------------------------------- #
def finger_states(lm: Landmarks) -> list[bool]:
    """
    Return [thumb, index, middle, ring, pinky] booleans (True == extended).

    The thumb is the tricky one: it protrudes LATERALLY when the hand is
    held flat (open palm), but points UPWARD for a "thumbs up".  We
    therefore consider the thumb extended if EITHER:
      * its tip is further from the palm centre than its IP joint
        (lateral extension), OR
      * its tip is clearly above the IP joint in the y-axis
        (upward extension, i.e. thumbs up).
    """
    states: list[bool] = []

    palm_cx = (lm.x(INDEX_MCP) + lm.x(MIDDLE_MCP) + lm.x(RING_MCP) + lm.x(PINKY_MCP)) / 4.0
    palm_cy = (lm.y(INDEX_MCP) + lm.y(MIDDLE_MCP) + lm.y(RING_MCP) + lm.y(PINKY_MCP)) / 4.0

    tip_from_palm = abs(lm.x(THUMB_TIP) - palm_cx) + abs(lm.y(THUMB_TIP) - palm_cy)
    ip_from_palm = abs(lm.x(THUMB_IP) - palm_cx) + abs(lm.y(THUMB_IP) - palm_cy)
    lateral_ext = tip_from_palm > ip_from_palm * 1.1
    upward_ext = lm.y(THUMB_TIP) < lm.y(THUMB_IP) - 0.03
    thumb_ext = lateral_ext or upward_ext
    states.append(thumb_ext)

    # ---- four fingers (y-based) --------------------------------------- #
    for tip, pip in _FINGER_PAIRS:
        states.append(lm.y(tip) < lm.y(pip))

    return states


# --------------------------------------------------------------------------- #
#  Per-hand result
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class HandResult:
    handedness: str = "Unknown"        # "Left" | "Right"
    name: str = G_IDLE                 # detected gesture for this hand
    cursor_target: tuple[float, float] | None = None
    scroll_delta: float = 0.0
    volume_level: float | None = None
    pinch_ratio_l: float = 1.0
    thumb_up_score: float = 0.0


# --------------------------------------------------------------------------- #
#  Two-hand gesture engine
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class TwoHandGestureEngine:
    cfg: Config
    _last_click: float = 0.0
    _last_wintab: float = 0.0
    _scroll_history: deque = field(default_factory=lambda: deque(maxlen=Config.SCROLL_HISTORY))
    _vol_smooth: float | None = None

    # ------------------------------------------------------------------ #
    def reset(self) -> None:
        """Clear transient state (call when a hand disappears)."""
        self._scroll_history.clear()
        self._vol_smooth = None

    def reset_click_cooldown(self) -> None:
        self._last_click = 0.0

    # ------------------------------------------------------------------ #
    def detect(self, lm: Landmarks, handedness: str) -> HandResult:
        """Detect the gesture for ONE hand given its landmarks + label."""
        if handedness == "Right":
            return self._detect_right(lm)
        if handedness == "Left":
            return self._detect_left(lm)
        # Unknown handedness -> don't trigger anything.
        return HandResult(handedness=handedness, name=G_IDLE)

    # ================================================================== #
    #  RIGHT HAND
    # ================================================================== #
    def _detect_right(self, lm: Landmarks) -> HandResult:
        res = HandResult(handedness="Right")
        states = finger_states(lm)
        thumb, index, middle, ring, pinky = states
        ref = lm.reference_size

        # cursor target is always the index tip (used by MOVE).
        res.cursor_target = (lm.x(INDEX_TIP), lm.y(INDEX_TIP))

        # ---- 1. VOLUME : open palm (all 5 extended) --------------------- #
        if thumb and index and middle and ring and pinky:
            res.name = G_VOLUME
            res.volume_level = self._proximity_volume(ref)
            self._scroll_history.clear()
            return res

        # ---- 2. SCROLL : index+middle extended, tips touching ---------- #
        if index and middle and not ring and not pinky:
            tip_dist = lm.dist(INDEX_TIP, MIDDLE_TIP) / ref
            if tip_dist < self.cfg.SCROLL_PINCH_THRESHOLD:
                res.name = G_SCROLL
                res.scroll_delta = self._scroll_delta(lm.y(MIDDLE_MCP))
                return res

        # not in scroll mode -> clear scroll history
        self._scroll_history.clear()

        # ---- 3. MOVE : index only -------------------------------------- #
        if index and not middle and not ring and not pinky:
            res.name = G_MOVE
            return res

        # ---- 4. IDLE ---------------------------------------------------- #
        res.name = G_IDLE
        return res

    # ================================================================== #
    #  LEFT HAND
    # ================================================================== #
    def _detect_left(self, lm: Landmarks) -> HandResult:
        res = HandResult(handedness="Left")
        states = finger_states(lm)
        thumb, index, middle, ring, pinky = states
        ref = lm.reference_size

        # Normalised pinch ratio for left click.
        res.pinch_ratio_l = lm.dist(INDEX_TIP, THUMB_TIP) / ref

        # ---- 1. WIN+TAB : fist (all fingers folded) -------------------- #
        # Allow the thumb to be either folded or sticking out sideways --
        # a natural fist often leaves the thumb alongside the fingers.
        if not index and not middle and not ring and not pinky and not thumb:
            if self._debounced(self._last_wintab, self.cfg.WIN_TAB_COOLDOWN):
                res.name = G_WINTAB
                self._last_wintab = time.time()
            else:
                res.name = G_IDLE
            return res

        # ---- 2. RCLICK : thumbs up ------------------------------------- #
        # Only the thumb is extended AND the thumb tip is clearly above
        # (smaller y) the thumb IP/MCP AND above all other fingertips.
        if thumb and not index and not middle and not ring and not pinky:
            thumb_up_ok = (
                lm.y(THUMB_TIP) < lm.y(THUMB_IP)
                and lm.y(THUMB_TIP) < lm.y(THUMB_MCP)
                and lm.y(THUMB_TIP) < lm.y(INDEX_TIP)
                and lm.y(THUMB_TIP) < lm.y(MIDDLE_TIP)
                and lm.y(THUMB_TIP) < lm.y(RING_TIP)
                and lm.y(THUMB_TIP) < lm.y(PINKY_TIP)
            )
            if thumb_up_ok:
                res.name = G_RCLICK
                return res

        # ---- 3. LCLICK : index + thumb pinch (index extended) ---------- #
        # Require the index to be extended so a folded finger near the
        # thumb does not fire accidentally.
        if index and res.pinch_ratio_l < self.cfg.PINCH_THRESHOLD:
            if self._debounced(self._last_click, self.cfg.CLICK_COOLDOWN):
                res.name = G_LCLICK
                self._last_click = time.time()
            else:
                res.name = G_IDLE
            return res

        # ---- 4. IDLE ---------------------------------------------------- #
        res.name = G_IDLE
        return res

    # ------------------------------------------------------------------ #
    #  Shared helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _debounced(last: float, cooldown: float) -> bool:
        return (time.time() - last) >= cooldown

    def _scroll_delta(self, ny: float) -> float:
        self._scroll_history.append(ny)
        if len(self._scroll_history) < self.cfg.SCROLL_HISTORY:
            return 0.0
        delta = self._scroll_history[-1] - self._scroll_history[0]
        if abs(delta) < self.cfg.SCROLL_THRESHOLD:
            return 0.0
        self._scroll_history.clear()
        return delta

    def _proximity_volume(self, ref: float) -> float:
        raw = float(np.interp(
            ref,
            [self.cfg.VOL_MIN_DIST, self.cfg.VOL_MAX_DIST],
            [0.0, 1.0],
        ))
        raw = max(0.0, min(1.0, raw))
        if self._vol_smooth is None:
            self._vol_smooth = raw
        else:
            a = self.cfg.VOL_EMA_ALPHA
            self._vol_smooth = a * raw + (1.0 - a) * self._vol_smooth
        return self._vol_smooth
