"""
hand_gestures.py
================
Right-hand-only hand-landmark analysis + a level-triggered gesture engine.

Gestures (priority, highest first):
  1. VOLUME         open palm (all 5 extended)        -> volume push/pull
  2. VIRTUAL_KB     closed fist (all fingers folded)  -> toggle on-screen kbd
  3. RIGHT_CLICK    thumb + middle pinch
                    (index finger held extended -- cursor FROZEN during
                     this gesture so index tracking does not move the mouse)
  4. LEFT_CLICK     thumb + index pinch                -> mouse-button-like
                    (hold the pinch => left button stays down; release => up;
                     double-tap the pinch => double click, etc.)
  5. MOVE           index finger only                  -> move cursor
  6. IDLE           anything else

There are NO cooldowns.  Clicks are level-triggered (true mouse-button
behaviour): the OS button is held down for as long as the pinch is held,
and lifted when it is released.  A quick pinch+release is a single click,
two quick pinch+release cycles are a double click, etc.

All distances are computed in MediaPipe's normalised space and divided by
the hand "reference size" (wrist -> middle-finger MCP) so that thresholds
stay correct at any depth.
"""

from __future__ import annotations

import math
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

# ---- gesture identifiers -------------------------------------------------- #
G_IDLE = "Idle"
G_MOVE = "Move"
G_LEFT_CLICK = "Left Click"        # pinch held = button down
G_RIGHT_CLICK = "Right Click"
G_VOLUME = "Volume"               # open palm (push/pull handled separately)
G_VIRTUAL_KB = "Virtual Keyboard" # closed fist


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

    The thumb is "extended" if it protrudes laterally from the palm OR
    points upward (thumbs-up).
    """
    states: list[bool] = []
    palm_cx = (lm.x(INDEX_MCP) + lm.x(MIDDLE_MCP)
               + lm.x(RING_MCP) + lm.x(PINKY_MCP)) / 4.0
    palm_cy = (lm.y(INDEX_MCP) + lm.y(MIDDLE_MCP)
               + lm.y(RING_MCP) + lm.y(PINKY_MCP)) / 4.0

    tip_from_palm = abs(lm.x(THUMB_TIP) - palm_cx) + abs(lm.y(THUMB_TIP) - palm_cy)
    ip_from_palm = abs(lm.x(THUMB_IP) - palm_cx) + abs(lm.y(THUMB_IP) - palm_cy)
    lateral_ext = tip_from_palm > ip_from_palm * 1.1
    upward_ext = lm.y(THUMB_TIP) < lm.y(THUMB_IP) - 0.03
    states.append(lateral_ext or upward_ext)

    for tip, pip in _FINGER_PAIRS:
        states.append(lm.y(tip) < lm.y(pip))
    return states


def is_open_palm(lm: Landmarks) -> bool:
    return all(finger_states(lm))


def is_fist(lm: Landmarks) -> bool:
    st = finger_states(lm)
    # all four fingers folded; thumb may stick out sideways on a real fist
    return (not st[1] and not st[2] and not st[3] and not st[4] and not st[0])


# --------------------------------------------------------------------------- #
#  Per-frame result
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class GestureResult:
    name: str = G_IDLE

    # raw cursor target (normalised index-tip coords), used for MOVE
    cursor_target: tuple[float, float] | None = None

    # level-triggered button states (True => button should be DOWN now)
    left_down: bool = False
    right_down: bool = False
    # edge events for this frame (transitions), consumed by main.py
    left_pressed: bool = False       # pinch just closed  (button-down event)
    left_released: bool = False      # pinch just opened  (button-up event)
    right_pressed: bool = False      # right pinch just closed -> single click
    virtual_kb_toggled: bool = False # fist just formed -> toggle keyboard

    # volume: +1 push forward (up), -1 pull back (down), 0 none this frame
    volume_dir: int = 0

    # raw signals for the UI (pinch meters, palm size)
    pinch_di: float = 1.0       # thumb-index ratio
    pinch_dm: float = 1.0       # thumb-middle ratio
    palm_size: float = 0.0


# --------------------------------------------------------------------------- #
#  The engine
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class GestureEngine:
    cfg: Config

    # level-triggered button states (persisted across frames)
    _left_held: bool = False
    _right_held: bool = False

    # virtual-keyboard toggle (edge on fist formation)
    _fist_held: bool = False

    # volume push/pull size history
    _size_history: deque = field(default_factory=lambda: deque(maxlen=Config.VOL_SIZE_HISTORY))

    # ------------------------------------------------------------------ #
    def reset(self) -> None:
        """Clear transient state (call when the hand disappears)."""
        self._size_history.clear()
        # NOTE: do NOT silently clear _left_held here -- main.py is
        # responsible for releasing the OS button + resetting these when
        # the hand is lost, via reset_buttons().

    def reset_buttons(self) -> None:
        """Force both button states to 'up' (call when hand is lost)."""
        self._left_held = False
        self._right_held = False
        self._fist_held = False

    # ------------------------------------------------------------------ #
    def detect(self, lm: Landmarks) -> GestureResult:
        res = GestureResult()
        st = finger_states(lm)
        thumb, index, middle, ring, pinky = st
        ref = lm.reference_size
        res.palm_size = ref

        # normalised pinch ratios (depth-invariant)
        di = lm.dist(THUMB_TIP, INDEX_TIP) / ref
        dm = lm.dist(THUMB_TIP, MIDDLE_TIP) / ref
        res.pinch_di = di
        res.pinch_dm = dm

        # index tip is the cursor driver (for MOVE)
        res.cursor_target = (lm.x(INDEX_TIP), lm.y(INDEX_TIP))

        # hysteresis on each pinch to prevent button flutter
        th = self.cfg.PINCH_THRESHOLD
        rel = self.cfg.PINCH_RELEASE

        # ---- 1. VOLUME : open palm ------------------------------------- #
        if thumb and index and middle and ring and pinky:
            res.volume_dir = self._volume_direction(ref)
            res.name = G_VOLUME
            # while in volume mode, make sure no button is held
            self._release_any_button(res)
            return res
        # leaving volume -> clear size history so a re-entry is clean
        self._size_history.clear()

        # ---- 2. VIRTUAL KEYBOARD : closed fist (edge toggle) ----------- #
        if is_fist(lm):
            res.name = G_VIRTUAL_KB
            if not self._fist_held:
                self._fist_held = True
                res.virtual_kb_toggled = True
            self._release_any_button(res)
            return res
        # fist released
        self._fist_held = False

        # ---- 3. RIGHT CLICK : thumb + middle pinch --------------------- #
        # Per the user's spec: when right-clicking, the INDEX finger is
        # held EXTENDED and the THUMB pinches the MIDDLE finger.  When the
        # thumb pinches the middle, it often ends up near the index too,
        # so we disambiguate by requiring the middle pinch to be TIGHTER
        # than the index pinch (dm < di), not by requiring di to be large.
        # The cursor is FROZEN during this gesture (main.py skips the
        # cursor update when gesture == G_RIGHT_CLICK) so the extended
        # index finger does not drift the pointer.
        if index and dm < th and dm < di:
            res.name = G_RIGHT_CLICK
            if not self._right_held:
                self._right_held = True
                res.right_pressed = True
            # release any left button while right-clicking
            if self._left_held:
                self._left_held = False
                res.left_released = True
            return res
        # right pinch released (hysteresis)
        if self._right_held and dm > rel:
            self._right_held = False

        # ---- 4. LEFT CLICK : thumb + index pinch (mouse-like hold) ----- #
        # Level-triggered: pinch held => left button DOWN; release => UP.
        # A quick pinch+release = one click; two quick cycles = double click.
        # Require the index pinch to be tighter than the middle pinch
        # (di <= dm) so this does not collide with the right-click.
        if di < th and di <= dm:
            res.name = G_LEFT_CLICK
            if not self._left_held:
                self._left_held = True
                res.left_pressed = True
            return res
        # left pinch released (hysteresis)
        if self._left_held and di > rel:
            self._left_held = False
            res.left_released = True

        # ---- 5. MOVE : index only -------------------------------------- #
        if index and not middle and not ring and not pinky:
            res.name = G_MOVE
            res.left_down = self._left_held    # carry button state for HUD
            return res

        # ---- 6. IDLE --------------------------------------------------- #
        res.name = G_IDLE
        res.left_down = self._left_held
        return res

    # ------------------------------------------------------------------ #
    def _release_any_button(self, res: GestureResult) -> None:
        """Drop any held buttons (used when entering volume / fist modes)."""
        if self._left_held:
            self._left_held = False
            res.left_released = True
        if self._right_held:
            self._right_held = False

    # ------------------------------------------------------------------ #
    #  Volume push / pull
    # ------------------------------------------------------------------ #
    def _volume_direction(self, ref: float) -> int:
        """+1 if hand growing (push forward), -1 if shrinking (pull back)."""
        self._size_history.append(ref)
        if len(self._size_history) < self.cfg.VOL_SIZE_HISTORY:
            return 0
        delta = self._size_history[-1] - self._size_history[0]
        if delta > self.cfg.VOL_SIZE_DELTA:
            self._size_history.clear()
            return 1
        if delta < -self.cfg.VOL_SIZE_DELTA:
            self._size_history.clear()
            return -1
        return 0
