"""
hand_gestures.py
================
Two-handed hand-landmark analysis + gesture state machine.

------------------------------------------------------------------------------
RIGHT HAND
------------------------------------------------------------------------------
  priority  gesture                  trigger
  ------    ------                   -------
   1        VOLUME (up/down)         open palm (all 5 extended); push the
                                     hand toward the camera => volume up,
                                     pull it back => volume down
   2        DRAG                     closed fist (all fingers folded)
   3        RIGHT CLICK              thumb + index + middle tips all close
   4        LEFT CLICK               thumb + index tips close (middle away)
   5        SCROLL                   index + middle extended (ring+pinky
                                     folded); move hand vertically
   6        MOVE                     index only
   7        IDLE                     anything else

------------------------------------------------------------------------------
LEFT HAND  (single-hand)
------------------------------------------------------------------------------
   1        START MENU               open palm (all 5 extended)
   2        TASK MANAGER             closed fist
   3        BROWSER                  index + middle "V" (ring + pinky folded)
   4        IDLE                     anything else

------------------------------------------------------------------------------
TWO-HAND COMBOS  (override single-hand actions when active)
------------------------------------------------------------------------------
   1        LOCK PC                  both fists
   2        SHOW DESKTOP             both open palms, held stable
   3        MAXIMIZE WINDOW          both open palms, moving apart
   4        MINIMIZE WINDOW          both open palms, moving together

All distances are computed in MediaPipe's normalised space and divided by
the hand "reference size" (wrist -> middle-finger MCP) so thresholds stay
correct at any depth.

Edge-triggered events (clicks, system commands) fire ONCE per gesture
entry and are gated by per-action cooldowns.  Continuous actions (move,
drag, scroll, volume) are level-triggered.
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

# ---- gesture identifiers -------------------------------------------------- #
# right-hand
G_IDLE = "Idle"
G_MOVE = "Move"
G_LCLICK = "Left Click"
G_RCLICK = "Right Click"
G_SCROLL = "Scroll"
G_DRAG = "Drag"
G_VOL_UP = "Volume Up"
G_VOL_DOWN = "Volume Down"
G_VOLUME = "Volume"          # open palm, stable (no nudge this frame)
# left-hand single
G_START = "Start Menu"
G_TASKMGR = "Task Manager"
G_BROWSER = "Browser"
# two-hand combo
G_NONE = "None"
G_SHOW_DESKTOP = "Show Desktop"
G_LOCK = "Lock PC"
G_MAXIMIZE = "Maximize"
G_MINIMIZE = "Minimize"

# edge-triggered event tokens (returned to main.py for execution)
E_LEFT_CLICK = "left_click"
E_RIGHT_CLICK = "right_click"
E_VOL_UP = "vol_up"
E_VOL_DOWN = "vol_down"
E_START = "start"
E_TASKMGR = "taskmgr"
E_BROWSER = "browser"
E_SHOW_DESKTOP = "show_desktop"
E_LOCK = "lock"
E_MAXIMIZE = "maximize"
E_MINIMIZE = "minimize"


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

    @property
    def palm_center(self) -> tuple[float, float]:
        cx = (self.x(INDEX_MCP) + self.x(MIDDLE_MCP)
              + self.x(RING_MCP) + self.x(PINKY_MCP)) / 4.0
        cy = (self.y(INDEX_MCP) + self.y(MIDDLE_MCP)
              + self.y(RING_MCP) + self.y(PINKY_MCP)) / 4.0
        return (cx, cy)


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
#  Result
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class TwoHandResult:
    right_name: str = G_IDLE
    left_name: str = G_IDLE
    combo_name: str = G_NONE

    # right-hand continuous signals
    cursor_target: tuple[float, float] | None = None  # for move OR drag
    scroll_delta: float = 0.0
    volume_dir: int = 0            # +1 up, -1 down, 0 none

    # edge-triggered events (main.py executes these)
    right_click_event: str | None = None     # E_LEFT_CLICK | E_RIGHT_CLICK | None
    left_system_event: str | None = None     # E_START | E_TASKMGR | E_BROWSER | None
    combo_event: str | None = None           # E_SHOW_DESKTOP | E_LOCK | E_MAXIMIZE | E_MINIMIZE | None

    # raw signals for UI
    pinch_di: float = 1.0       # thumb-index ratio
    pinch_dm: float = 1.0       # thumb-middle ratio
    palm_size: float = 0.0
    palm_distance: float | None = None  # distance between the two palms


# --------------------------------------------------------------------------- #
#  Two-hand gesture engine
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class TwoHandEngine:
    cfg: Config

    # click edge-trigger arming (right hand)
    _click_armed: bool = True
    _last_click_t: float = 0.0

    # volume push/pull
    _size_history: deque = field(default_factory=lambda: deque(maxlen=Config.VOL_SIZE_HISTORY))
    _last_vol_t: float = 0.0

    # scroll
    _scroll_history: deque = field(default_factory=lambda: deque(maxlen=Config.SCROLL_HISTORY))

    # left-hand single system events (edge + cooldown)
    _last_left_t: float = 0.0
    _prev_left_name: str = G_IDLE

    # two-hand combos
    _palm_dist_history: deque = field(default_factory=lambda: deque(maxlen=Config.PALM_DIST_HISTORY))
    _last_combo_t: float = 0.0
    _both_open_prev: bool = False
    _both_fist_prev: bool = False
    _show_desktop_fired: bool = False

    # ------------------------------------------------------------------ #
    def reset_transient(self) -> None:
        """Clear frame-to-frame histories (call when a hand disappears)."""
        self._size_history.clear()
        self._scroll_history.clear()
        self._palm_dist_history.clear()
        self._show_desktop_fired = False
        self._both_open_prev = False
        self._both_fist_prev = False

    # ------------------------------------------------------------------ #
    def detect(self,
               right_lm: Landmarks | None,
               left_lm: Landmarks | None) -> TwoHandResult:
        res = TwoHandResult()

        # ---- per-hand gesture names + raw signals ----------------------- #
        right_name = self._detect_right(right_lm, res) if right_lm else G_IDLE
        left_name = self._detect_left(left_lm, res) if left_lm else G_IDLE
        res.right_name = right_name
        res.left_name = left_name

        # ---- two-hand combo (highest priority) -------------------------- #
        combo_event = self._detect_combo(right_lm, left_lm, right_name,
                                         left_name, res)
        res.combo_event = combo_event
        if combo_event is not None:
            res.combo_name = {
                E_LOCK: G_LOCK,
                E_SHOW_DESKTOP: G_SHOW_DESKTOP,
                E_MAXIMIZE: G_MAXIMIZE,
                E_MINIMIZE: G_MINIMIZE,
            }.get(combo_event, G_NONE)
            # combo active -> suppress single-hand edge events this frame
            res.right_click_event = None
            res.left_system_event = None
            return res

        # ---- single-hand edge events (only when no combo) --------------- #
        # right-hand click edge
        if right_lm is not None:
            res.right_click_event = self._right_click_event(right_lm, right_name)
        # left-hand system edge
        if left_lm is not None:
            res.left_system_event = self._left_system_event(left_name)

        return res

    # ================================================================== #
    #  RIGHT HAND  --  classify only (no side effects here)
    # ================================================================== #
    def _detect_right(self, lm: Landmarks, res: TwoHandResult) -> str:
        st = finger_states(lm)
        thumb, index, middle, ring, pinky = st
        ref = lm.reference_size
        res.palm_size = ref

        di = lm.dist(THUMB_TIP, INDEX_TIP) / ref
        dm = lm.dist(THUMB_TIP, MIDDLE_TIP) / ref
        res.pinch_di = di
        res.pinch_dm = dm

        # cursor target: index tip for MOVE, palm center for DRAG
        res.cursor_target = lm.palm_center

        # 1. VOLUME : open palm
        if thumb and index and middle and ring and pinky:
            res.volume_dir = self._volume_direction(ref)
            self._scroll_history.clear()
            if res.volume_dir > 0:
                return G_VOL_UP
            if res.volume_dir < 0:
                return G_VOL_DOWN
            return G_VOLUME

        # not volume -> clear size history so a later volume entry is clean
        self._size_history.clear()

        # 2. DRAG : closed fist
        if is_fist(lm):
            self._scroll_history.clear()
            return G_DRAG

        # 3. RIGHT CLICK : thumb + index + middle tips all close
        if di < self.cfg.PINCH_THRESHOLD and dm < self.cfg.PINCH_THRESHOLD:
            self._scroll_history.clear()
            return G_RCLICK

        # 4. LEFT CLICK : thumb + index close, middle away
        if index and di < self.cfg.PINCH_THRESHOLD and dm >= self.cfg.PINCH_THRESHOLD:
            self._scroll_history.clear()
            return G_LCLICK

        # 5. SCROLL : index + middle extended, ring + pinky folded
        if index and middle and not ring and not pinky:
            res.scroll_delta = self._scroll_delta(lm.y(MIDDLE_MCP))
            return G_SCROLL

        # not scroll -> clear scroll history
        self._scroll_history.clear()

        # 6. MOVE : index only
        if index and not middle and not ring and not pinky:
            return G_MOVE

        return G_IDLE

    # ------------------------------------------------------------------ #
    def _right_click_event(self, lm: Landmarks, name: str) -> str | None:
        """Edge-trigger: fire one click per pinch entry."""
        di = lm.dist(THUMB_TIP, INDEX_TIP) / lm.reference_size
        armed_thresh = self.cfg.PINCH_ARM_THRESHOLD

        # re-arm when the pinch is clearly released
        if di > armed_thresh:
            self._click_armed = True

        if name in (G_LCLICK, G_RCLICK) and self._click_armed:
            if (time.time() - self._last_click_t) >= self.cfg.CLICK_COOLDOWN:
                self._click_armed = False
                self._last_click_t = time.time()
                return E_LEFT_CLICK if name == G_LCLICK else E_RIGHT_CLICK
        return None

    # ================================================================== #
    #  LEFT HAND  --  single-hand classification
    # ================================================================== #
    def _detect_left(self, lm: Landmarks, res: TwoHandResult) -> str:
        st = finger_states(lm)
        thumb, index, middle, ring, pinky = st

        # 1. START MENU : open palm
        if thumb and index and middle and ring and pinky:
            return G_START

        # 2. TASK MANAGER : fist
        if is_fist(lm):
            return G_TASKMGR

        # 3. BROWSER : index + middle V (ring + pinky folded)
        if index and middle and not ring and not pinky:
            return G_BROWSER

        return G_IDLE

    # ------------------------------------------------------------------ #
    def _left_system_event(self, name: str) -> str | None:
        """Edge-trigger on entering a left-hand gesture + cooldown."""
        if name == self._prev_left_name:
            # held -> no repeat (edge only)
            return None
        self._prev_left_name = name
        if name == G_IDLE:
            return None
        if (time.time() - self._last_left_t) >= self.cfg.SYSTEM_COOLDOWN:
            self._last_left_t = time.time()
            return {
                G_START: E_START,
                G_TASKMGR: E_TASKMGR,
                G_BROWSER: E_BROWSER,
            }.get(name)
        return None

    # ================================================================== #
    #  TWO-HAND COMBOS
    # ================================================================== #
    def _detect_combo(self,
                      right_lm: Landmarks | None,
                      left_lm: Landmarks | None,
                      right_name: str,
                      left_name: str,
                      res: TwoHandResult) -> str | None:
        if right_lm is None or left_lm is None:
            self._both_open_prev = False
            self._both_fist_prev = False
            self._show_desktop_fired = False
            self._palm_dist_history.clear()
            return None

        res.palm_distance = math.dist(right_lm.palm_center, left_lm.palm_center)
        self._palm_dist_history.append(res.palm_distance)

        right_fist = (right_name == G_DRAG)
        left_fist = (left_name == G_TASKMGR)
        right_open = (right_name in (G_VOLUME, G_VOL_UP, G_VOL_DOWN))
        left_open = (left_name == G_START)

        # ---- 1. both fists -> LOCK (edge) ------------------------------- #
        if right_fist and left_fist:
            if not self._both_fist_prev:
                self._both_fist_prev = True
                if (time.time() - self._last_combo_t) >= self.cfg.SYSTEM_COOLDOWN:
                    self._last_combo_t = time.time()
                    return E_LOCK
            return None
        self._both_fist_prev = False

        # ---- 2. both open palms -> maximize / minimize / show desktop --- #
        if right_open and left_open:
            if len(self._palm_dist_history) >= self.cfg.PALM_DIST_HISTORY:
                delta = self._palm_dist_history[-1] - self._palm_dist_history[0]
                if delta > self.cfg.PALM_MOTION_DELTA:
                    # palms moving apart -> maximize (cooldown-gated)
                    self._show_desktop_fired = True   # suppress show-desktop until released
                    if (time.time() - self._last_combo_t) >= self.cfg.SYSTEM_COOLDOWN:
                        self._last_combo_t = time.time()
                        self._palm_dist_history.clear()
                        return E_MAXIMIZE
                elif delta < -self.cfg.PALM_MOTION_DELTA:
                    # palms moving together -> minimize (cooldown-gated)
                    self._show_desktop_fired = True
                    if (time.time() - self._last_combo_t) >= self.cfg.SYSTEM_COOLDOWN:
                        self._last_combo_t = time.time()
                        self._palm_dist_history.clear()
                        return E_MINIMIZE
                else:
                    # stable -> show desktop, fires ONCE per both-open entry
                    if (not self._show_desktop_fired
                            and (time.time() - self._last_combo_t) >= self.cfg.SYSTEM_COOLDOWN):
                        self._show_desktop_fired = True
                        self._last_combo_t = time.time()
                        return E_SHOW_DESKTOP
            return None

        # neither combo pose -> re-arm everything
        self._both_open_prev = False
        self._show_desktop_fired = False
        self._palm_dist_history.clear()
        return None

    # ================================================================== #
    #  Continuous-signal helpers
    # ================================================================== #
    def _volume_direction(self, ref: float) -> int:
        """+1 if hand growing (push forward), -1 if shrinking (pull back)."""
        self._size_history.append(ref)
        if len(self._size_history) < self.cfg.VOL_SIZE_HISTORY:
            return 0
        delta = self._size_history[-1] - self._size_history[0]
        now = time.time()
        if delta > self.cfg.VOL_SIZE_DELTA and (now - self._last_vol_t) >= self.cfg.VOLUME_COOLDOWN:
            self._last_vol_t = now
            self._size_history.clear()
            return 1
        if delta < -self.cfg.VOL_SIZE_DELTA and (now - self._last_vol_t) >= self.cfg.VOLUME_COOLDOWN:
            self._last_vol_t = now
            self._size_history.clear()
            return -1
        return 0

    def _scroll_delta(self, ny: float) -> float:
        self._scroll_history.append(ny)
        if len(self._scroll_history) < self.cfg.SCROLL_HISTORY:
            return 0.0
        delta = self._scroll_history[-1] - self._scroll_history[0]
        if abs(delta) < self.cfg.SCROLL_THRESHOLD:
            return 0.0
        self._scroll_history.clear()
        return delta
