"""
hand_gestures.py
================
Right-hand-only hand-landmark analysis + a level-triggered gesture engine.

Gestures (priority, highest first):
  1. VOLUME         open palm (all 5 extended)        -> volume push/pull
  2. RIGHT_CLICK    thumb + middle pinch
                    (index finger held extended -- cursor FROZEN during
                     this gesture so index tracking does not move the mouse)
  3. LEFT_CLICK     thumb tip tucks to the index-MCP (the knuckle at the
                    palm side of the index finger).  Only recognised when
                    the thumb + index are extended and middle/ring/pinky
                    are folded.  Level-triggered (mouse-button-like):
                    hold the tuck => left button stays DOWN and the cursor
                    keeps following the index tip (so you can DRAG);
                    release the tuck => button UP; quick tuck+release =
                    single click; two quick cycles = double click.
  4. MOVE           index finger only                  -> move cursor
  5. IDLE           anything else

There are NO cooldowns.  All distances are computed in MediaPipe's
normalised space and divided by the hand "reference size" (wrist ->
middle-finger MCP) so that thresholds stay correct at any depth.
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
G_LEFT_CLICK = "Left Click"        # thumb tucked to index-MCP = button down
G_RIGHT_CLICK = "Right Click"
G_VOLUME = "Volume"               # open palm (push/pull handled separately)


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


# --------------------------------------------------------------------------- #
#  Per-frame result
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class GestureResult:
    name: str = G_IDLE

    # raw cursor target (normalised index-tip coords), used for MOVE and
    # LEFT_CLICK (so the cursor keeps following the index tip while the
    # left button is held -> enables dragging).
    cursor_target: tuple[float, float] | None = None

    # edge events for this frame (transitions), consumed by main.py
    left_pressed: bool = False       # thumb just tucked  (button-down event)
    left_released: bool = False      # thumb just opened (button-up event)
    right_pressed: bool = False      # right pinch just closed -> single click

    # volume: +1 push forward (up), -1 pull back (down), 0 none this frame
    volume_dir: int = 0
    # how many media-key presses main.py should fire this frame (fast vol)
    volume_presses: int = 0

    # raw signals for the UI (pinch meters, palm size)
    tap_ratio: float = 1.0       # thumb-tip -> index-MCP ratio (left click)
    pinch_dm: float = 1.0        # thumb-middle ratio (right click)
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

    # volume push/pull size history
    _size_history: deque = field(default_factory=lambda: deque(maxlen=Config.VOL_SIZE_HISTORY))

    # ------------------------------------------------------------------ #
    def reset(self) -> None:
        """Clear transient state (call when the hand disappears)."""
        self._size_history.clear()

    def reset_buttons(self) -> None:
        """Force both button states to 'up' (call when hand is lost)."""
        self._left_held = False
        self._right_held = False

    # ------------------------------------------------------------------ #
    def detect(self, lm: Landmarks) -> GestureResult:
        res = GestureResult()
        st = finger_states(lm)
        thumb, index, middle, ring, pinky = st
        ref = lm.reference_size
        res.palm_size = ref

        # normalised signals (depth-invariant)
        # LEFT click signal: thumb tip -> index MCP (the palm-side knuckle)
        tap = lm.dist(THUMB_TIP, INDEX_MCP) / ref
        # RIGHT click signal: thumb tip -> middle tip
        dm = lm.dist(THUMB_TIP, MIDDLE_TIP) / ref
        res.tap_ratio = tap
        res.pinch_dm = dm

        # index tip is the cursor driver (for MOVE and LEFT_CLICK drag)
        res.cursor_target = (lm.x(INDEX_TIP), lm.y(INDEX_TIP))

        # ---- 1. VOLUME : open palm ------------------------------------- #
        if thumb and index and middle and ring and pinky:
            res.volume_dir, res.volume_presses = self._volume_direction(ref)
            res.name = G_VOLUME
            # while in volume mode, make sure no button is held
            self._release_any_button(res)
            return res
        # leaving volume -> clear size history so a re-entry is clean
        self._size_history.clear()

        # ---- 2. RIGHT CLICK : thumb + middle pinch (index extended) ---- #
        # Cursor is FROZEN during this gesture (main.py skips the cursor
        # update) so the extended index finger does not drift the pointer.
        if index and dm < self.cfg.PINCH_THRESHOLD and dm < tap:
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
        if self._right_held and dm > self.cfg.PINCH_RELEASE:
            self._right_held = False

        # ---- 3. LEFT CLICK : thumb tip tucks to index-MCP ------------- #
        # Pose gate: thumb + index extended, middle/ring/pinky folded.
        # The click fires when the thumb tip is close to the index MCP.
        # Level-triggered + the cursor KEEPS following the index tip while
        # the button is held (handled in main.py) -> enables dragging.
        # NOTE: when the thumb tucks to the palm, the thumb-extension check
        # above may flip to False, so we re-check thumb extension using the
        # *pre-tuck* geometry is not reliable.  Instead we accept the tuck
        # itself as the trigger and only require index extended + the three
        # other fingers folded.
        if index and not middle and not ring and not pinky:
            if tap < self.cfg.LEFT_TAP_THRESHOLD:
                res.name = G_LEFT_CLICK
                if not self._left_held:
                    self._left_held = True
                    res.left_pressed = True
                return res
            # tuck released (hysteresis)
            if self._left_held and tap > self.cfg.LEFT_TAP_RELEASE:
                self._left_held = False
                res.left_released = True

        # ---- 4. MOVE : index only (thumb not tucked) ------------------- #
        if index and not middle and not ring and not pinky:
            res.name = G_MOVE
            return res

        # ---- 5. IDLE --------------------------------------------------- #
        res.name = G_IDLE
        return res

    # ------------------------------------------------------------------ #
    def _release_any_button(self, res: GestureResult) -> None:
        """Drop any held buttons (used when entering volume mode)."""
        if self._left_held:
            self._left_held = False
            res.left_released = True
        if self._right_held:
            self._right_held = False

    # ------------------------------------------------------------------ #
    #  Volume push / pull  (FAST: fires multiple presses per nudge)
    # ------------------------------------------------------------------ #
    def _volume_direction(self, ref: float) -> tuple[int, int]:
        """
        Return (direction, n_presses).
          direction   +1 push forward (up), -1 pull back (down), 0 none
          n_presses   how many media-key presses to fire this frame
        """
        self._size_history.append(ref)
        if len(self._size_history) < self.cfg.VOL_SIZE_HISTORY:
            return 0, 0
        delta = self._size_history[-1] - self._size_history[0]
        if delta > self.cfg.VOL_SIZE_DELTA:
            self._size_history.clear()
            return 1, self.cfg.VOL_NUDGE_PRESSES
        if delta < -self.cfg.VOL_SIZE_DELTA:
            self._size_history.clear()
            return -1, self.cfg.VOL_NUDGE_PRESSES
        return 0, 0
