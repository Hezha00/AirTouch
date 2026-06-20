"""
config.py
=========
Central configuration for the Gesture Control application.

A focused, right-hand-only gesture set with NO cooldowns and NO combos:

  * INDEX finger only               -> move mouse cursor
  * THUMB + INDEX pinch (holdable)  -> left button down/up (mouse-like)
  * THUMB + MIDDLE pinch            -> right click  (index finger extended;
                                        cursor FROZEN during the click so
                                        finger tracking does not move it)
  * CLOSED FIST                     -> toggle the Windows virtual keyboard
  * OPEN PALM push toward camera    -> volume UP
  * OPEN PALM pull away from camera -> volume DOWN

Distances are expressed in MediaPipe's normalised coordinate space
(0.0 -> 1.0) unless stated otherwise.
"""

from __future__ import annotations


class Config:
    # ------------------------------------------------------------------ #
    # Camera
    # ------------------------------------------------------------------ #
    CAMERA_INDEX: int = 0
    CAM_WIDTH: int = 640
    CAM_HEIGHT: int = 480
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
    # Lower alpha => smoother but more laggy.
    # Higher alpha => snappier but more jittery.
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
    # Pinch detection  (no cooldowns -- level-triggered, mouse-like)
    # ------------------------------------------------------------------ #
    # Distances normalised by hand reference size (wrist -> middle MCP),
    # so thresholds are depth-invariant.
    PINCH_THRESHOLD: float = 0.40        # "pinching" while below this ratio
    PINCH_RELEASE: float = 0.55          # only "released" once above this
                                         # (hysteresis to prevent flutter)

    # ------------------------------------------------------------------ #
    # Volume push / pull  (RIGHT HAND open palm)
    # ------------------------------------------------------------------ #
    # Track the hand reference size over a window of frames; pushing the
    # hand toward the camera makes it grow, pulling away makes it shrink.
    VOL_SIZE_HISTORY: int = 8
    VOL_SIZE_DELTA: float = 0.030        # size change needed to nudge volume
    VOL_STEP: float = 0.04               # display-level step per nudge (0..1)

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
    HELP_PANEL_W: int = 520
    HELP_PANEL_H: int = 360

    # ------------------------------------------------------------------ #
    # Safety
    # ------------------------------------------------------------------ #
    FAILSAFE: bool = True          # pyautogui corner-abort
    PYAUTOGUI_PAUSE: float = 0.0   # no artificial delay between actions
