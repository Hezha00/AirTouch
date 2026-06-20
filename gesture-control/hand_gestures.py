"""
hand_gestures.py
================
Hand-landmark analysis + a small, deterministic gesture state machine.

Gesture priority (highest first)
--------------------------------
1. VOLUME   - open palm (all 5 fingers extended)        -> proximity volume
2. LCLICK   - index-tip / thumb-tip pinch (strict dist) -> left  click (debounced)
3. RCLICK   - middle-tip / thumb-tip pinch              -> right click (debounced)
4. SCROLL   - index + middle extended, ring + pinky down-> vertical scroll
5. MOVE     - index extended, others folded             -> move cursor
6. IDLE     - anything else

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

# Four "foldable" fingers as (tip, pip) pairs (y smaller == extended).
_FINGER_PAIRS = (
    (INDEX_TIP, INDEX_PIP),
    (MIDDLE_TIP, MIDDLE_PIP),
    (RING_TIP, RING_PIP),
    (PINKY_TIP, PINKY_PIP),
)

# Gesture identifiers exposed to the UI.
G_IDLE = "Idle"
G_MOVE = "Move"
G_LCLICK = "Left Click"
G_RCLICK = "Right Click"
G_SCROLL = "Scroll"
G_VOLUME = "Volume"


@dataclass(slots=True)
class Landmarks:
    """Normalised landmark coordinates for one hand."""

    pts: list[tuple[float, float]]      # 21 (x, y) tuples in 0..1 space

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
        """Wrist -> middle-finger MCP, used to normalise all distances."""
        return self.dist(WRIST, MIDDLE_MCP) or 1e-6


# --------------------------------------------------------------------------- #
#  Finger-state helpers
# --------------------------------------------------------------------------- #
def finger_states(lm: Landmarks) -> list[bool]:
    """
    Return [thumb, index, middle, ring, pinky] booleans (True == extended).

    The thumb is detected in a handedness-agnostic way: it is considered
    extended when its tip lies further from the palm centre than its IP
    joint, on the side the thumb naturally points to.
    """
    states: list[bool] = []

    # ---- thumb -------------------------------------------------------- #
    palm_cx = (lm.x(INDEX_MCP) + lm.x(MIDDLE_MCP) + lm.x(RING_MCP) + lm.x(PINKY_MCP)) / 4.0
    if lm.x(THUMB_TIP) < palm_cx:
        thumb_ext = lm.x(THUMB_TIP) < lm.x(THUMB_IP)
    else:
        thumb_ext = lm.x(THUMB_TIP) > lm.x(THUMB_IP)
    states.append(thumb_ext)

    # ---- four fingers (y-based, image coords: smaller y == higher) ---- #
    for tip, pip in _FINGER_PAIRS:
        states.append(lm.y(tip) < lm.y(pip))

    return states


# --------------------------------------------------------------------------- #
#  Gesture state machine
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class GestureResult:
    name: str = G_IDLE
    cursor_target: tuple[float, float] | None = None   # raw index-tip (nx, ny)
    scroll_delta: float = 0.0
    volume_level: float | None = None                  # 0..1 when in volume mode
    pinch_ratio_l: float = 1.0
    pinch_ratio_r: float = 1.0


@dataclass(slots=True)
class GestureEngine:
    cfg: Config
    _last_click: float = 0.0
    _scroll_history: deque = field(default_factory=lambda: deque(maxlen=Config.SCROLL_HISTORY))
    _vol_smooth: float | None = None

    # ------------------------------------------------------------------ #
    def reset(self) -> None:
        self._scroll_history.clear()
        self._vol_smooth = None

    # ------------------------------------------------------------------ #
    def detect(self, lm: Landmarks) -> GestureResult:
        res = GestureResult()
        states = finger_states(lm)
        thumb, index, middle, ring, pinky = states

        ref = lm.reference_size

        # Normalised pinch ratios (depth-invariant).
        res.pinch_ratio_l = lm.dist(INDEX_TIP, THUMB_TIP) / ref
        res.pinch_ratio_r = lm.dist(MIDDLE_TIP, THUMB_TIP) / ref

        # Index-finger tip is always the raw cursor target (used by MOVE).
        res.cursor_target = (lm.x(INDEX_TIP), lm.y(INDEX_TIP))

        # ---- 1. VOLUME : open palm (all 5 extended) --------------------- #
        if thumb and index and middle and ring and pinky:
            res.name = G_VOLUME
            res.volume_level = self._proximity_volume(lm, ref)
            return res

        # ---- 2. LEFT CLICK : index extended + index/thumb pinch -------- #
        # Gating on the index being extended prevents a folded finger
        # (which naturally drifts near the thumb) from firing a click.
        if index and res.pinch_ratio_l < self.cfg.PINCH_THRESHOLD:
            if self._debounced_click():
                res.name = G_LCLICK
            else:
                # inside the click cooldown -> freeze the cursor so the
                # click lands exactly where the user intended.
                res.name = G_IDLE
            return res

        # ---- 3. RIGHT CLICK : middle extended (index folded) + pinch --- #
        # Requiring the index to be folded cleanly separates this gesture
        # from SCROLL (where both index and middle are extended).
        if middle and not index and res.pinch_ratio_r < self.cfg.PINCH_THRESHOLD:
            if self._debounced_click():
                res.name = G_RCLICK
            else:
                res.name = G_IDLE
            return res

        # ---- 4. SCROLL : index + middle up, ring + pinky down ---------- #
        if index and middle and not ring and not pinky:
            res.name = G_SCROLL
            res.scroll_delta = self._scroll_delta(lm.y(MIDDLE_MCP))
            return res

        # ---- 5. MOVE : index only -------------------------------------- #
        if index and not middle and not ring and not pinky:
            res.name = G_MOVE
            # scrolling bookkeeping should not leak into move mode
            self._scroll_history.clear()
            return res

        # ---- 6. IDLE ---------------------------------------------------- #
        res.name = G_IDLE
        self._scroll_history.clear()
        return res

    # ------------------------------------------------------------------ #
    #  Click debounce
    # ------------------------------------------------------------------ #
    def _debounced_click(self) -> bool:
        now = time.time()
        if now - self._last_click >= self.cfg.CLICK_COOLDOWN:
            self._last_click = now
            return True
        return False

    # ------------------------------------------------------------------ #
    #  Scroll: vertical delta of the middle-MCP over the last N frames.
    # ------------------------------------------------------------------ #
    def _scroll_delta(self, ny: float) -> float:
        self._scroll_history.append(ny)
        if len(self._scroll_history) < self.cfg.SCROLL_HISTORY:
            return 0.0
        delta = self._scroll_history[-1] - self._scroll_history[0]
        # Only report a "tick" when the accumulated movement is meaningful.
        if abs(delta) < self.cfg.SCROLL_THRESHOLD:
            return 0.0
        # Consume the history so a single gesture motion = a single tick.
        self._scroll_history.clear()
        return delta

    # ------------------------------------------------------------------ #
    #  Volume: map hand reference size -> 0..1, EMA-smoothed + deadband.
    # ------------------------------------------------------------------ #
    def _proximity_volume(self, lm: Landmarks, ref: float) -> float:
        raw = float(
            np.interp(
                ref,
                [self.cfg.VOL_MIN_DIST, self.cfg.VOL_MAX_DIST],
                [0.0, 1.0],
            )
        )
        raw = max(0.0, min(1.0, raw))

        if self._vol_smooth is None:
            self._vol_smooth = raw
        else:
            a = self.cfg.VOL_EMA_ALPHA
            self._vol_smooth = a * raw + (1.0 - a) * self._vol_smooth

        # Deadband: ignore microscopic changes to stop the volume bar
        # from fluttering while the hand is held still.
        return self._vol_smooth
