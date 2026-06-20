"""
config.py
=========
Central configuration for the Gesture Control application.

A focused, right-hand-only gesture set with NO cooldowns and NO combos:

  * INDEX finger only                      -> move mouse cursor
  * THUMB tip to INDEX-MCP (tuck thumb to  -> left button down/up (mouse-like:
    palm side), only when thumb + index       hold to drag, double-tap to
    are extended                              double-click, etc.)
  * THUMB + MIDDLE pinch (index extended)  -> right click (cursor FROZEN
                                              during the click so index
                                              tracking does not move the mouse)
  * OPEN PALM push toward camera           -> volume UP (fast)
  * OPEN PALM pull away from camera        -> volume DOWN (fast)

Distances are expressed in MediaPipe's normalised coordinate space
(0.0 -> 1.0) unless stated otherwise.
"""

from __future__ import annotations


class Config:
    # ------------------------------------------------------------------ #
    # Camera  --  high resolution for a crisp window
    # ------------------------------------------------------------------ #
    CAMERA_INDEX: int = 0
    CAM_WIDTH: int = 1280
    CAM_HEIGHT: int = 720
    CAM_FPS: int = 30

    # ------------------------------------------------------------------ #
    # MediaPipe Hands  --  ONE hand only (the right)
    # ------------------------------------------------------------------ #
    MAX_NUM_HANDS: int = 1
    MIN_DETECTION_CONFIDENCE: float = 0.7
    MIN_TRACKING_CONFIDENCE: float = 0.7

    # ------------------------------------------------------------------ #
    # Cursor smoothing (Exponential Moving Average)
    # ------------------------------------------------------------------ #
    EMA_ALPHA: float = 0.35

    # Active bounding box (centre of frame that maps to the whole screen).
    BOX_X_MARGIN: float = 0.30
    BOX_Y_MARGIN: float = 0.30

    # Safety margin (px) so the gesture cursor never hits a screen corner
    # and trips PyAutoGUI's fail-safe.
    SCREEN_MARGIN: int = 20

    # Re-assert the OpenCV window as topmost every N frames.
    TOPMOST_REFRESH_FRAMES: int = 60

    # ------------------------------------------------------------------ #
    # LEFT CLICK  --  thumb tip tucks to the index-MCP (palm side)
    # ------------------------------------------------------------------ #
    # The click fires when the thumb tip (landmark 4) gets close to the
    # index finger's MCP joint (landmark 5, the knuckle at the palm side).
    # Distance is normalised by the hand reference size (wrist -> middle
    # MCP) so it is depth-invariant.  Hysteresis prevents button flutter.
    LEFT_TAP_THRESHOLD: float = 0.22   # "tucked" while below this ratio
    LEFT_TAP_RELEASE: float = 0.30     # only "released" once above this

    # ------------------------------------------------------------------ #
    # RIGHT CLICK  --  thumb + middle pinch (index extended)
    # ------------------------------------------------------------------ #
    PINCH_THRESHOLD: float = 0.40      # pinch fires below this ratio
    PINCH_RELEASE: float = 0.55        # only "released" once above this

    # ------------------------------------------------------------------ #
    # Volume push / pull  (RIGHT HAND open palm)  --  FAST
    # ------------------------------------------------------------------ #
    # Track the hand reference size over a window of frames; pushing the
    # hand toward the camera makes it grow, pulling away makes it shrink.
    # Each nudge fires VOL_NUDGE_PRESSES media-key presses so the volume
    # changes quickly.
    VOL_SIZE_HISTORY: int = 6          # shorter window -> faster response
    VOL_SIZE_DELTA: float = 0.015      # smaller change triggers a nudge
    VOL_NUDGE_PRESSES: int = 2         # media-key presses per nudge
    VOL_STEP: float = 0.06             # display-level step per nudge (cosmetic)

    # ------------------------------------------------------------------ #
    # Visuals
    # ------------------------------------------------------------------ #
    WINDOW_NAME: str = "Gesture Control  |  H: help  Q: quit"
    LANDMARK_COLOR: tuple = (255, 200, 0)      # amber (BGR)
    CONNECTION_COLOR: tuple = (0, 255, 200)    # cyan   (BGR)
    BOX_COLOR: tuple = (90, 90, 90)            # subtle grey (BGR)
    STATUS_BG: tuple = (30, 30, 30)
    STATUS_FG: tuple = (255, 255, 255)
    ACCENT: tuple = (0, 255, 140)              # green accent (BGR)
    HAND_COLOR: tuple = (0, 255, 140)          # green skeleton

    # Fixed-size help overlay (frame-pixels).  Constant regardless of the
    # (resizable) window size so the guide always looks the same.
    HELP_PANEL_W: int = 640
    HELP_PANEL_H: int = 420

    # ------------------------------------------------------------------ #
    # Safety
    # ------------------------------------------------------------------ #
    FAILSAFE: bool = True          # pyautogui corner-abort
    PYAUTOGUI_PAUSE: float = 0.0   # no artificial delay between actions
