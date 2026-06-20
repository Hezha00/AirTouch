"""
config.py
=========
Central configuration for the two-handed Gesture Control application.

Every "magic number" lives here so the app can be tuned without digging
through the control logic.  Distances are expressed in MediaPipe's
normalised coordinate space (0.0 -> 1.0) unless stated otherwise.
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
    # MediaPipe Hands  --  TWO hands (left + right)
    # ------------------------------------------------------------------ #
    MAX_NUM_HANDS: int = 2
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
    # Pinch / click detection  (RIGHT HAND)
    # ------------------------------------------------------------------ #
    # Distances normalised by hand reference size (wrist -> middle MCP).
    PINCH_THRESHOLD: float = 0.40        # pinch fires below this ratio
    PINCH_ARM_THRESHOLD: float = 0.65    # re-arm only after releasing this far
    CLICK_COOLDOWN: float = 0.30         # seconds between clicks

    # ------------------------------------------------------------------ #
    # Scroll  (RIGHT HAND: index + middle extended, move hand vertically)
    # ------------------------------------------------------------------ #
    SCROLL_HISTORY: int = 6
    SCROLL_THRESHOLD: float = 0.045
    SCROLL_TICKS: int = 3

    # ------------------------------------------------------------------ #
    # Volume push / pull  (RIGHT HAND open palm)
    # ------------------------------------------------------------------ #
    # We track the hand reference size over a window of frames; pushing the
    # hand toward the camera makes it grow, pulling away makes it shrink.
    VOL_SIZE_HISTORY: int = 8
    VOL_SIZE_DELTA: float = 0.030        # size change needed to nudge volume
    VOLUME_COOLDOWN: float = 0.22        # seconds between volume nudges
    VOL_STEP: float = 0.04               # display-level step per nudge (0..1)

    # ------------------------------------------------------------------ #
    # Two-hand combo thresholds
    # ------------------------------------------------------------------ #
    PALM_DIST_HISTORY: int = 6
    PALM_MOTION_DELTA: float = 0.060     # inter-palm distance change for max/min
    SYSTEM_COOLDOWN: float = 1.20        # seconds between discrete system cmds

    # ------------------------------------------------------------------ #
    # Visuals
    # ------------------------------------------------------------------ #
    WINDOW_NAME: str = "Gesture Control  |  H: help  Q: quit"
    LANDMARK_COLOR: tuple = (255, 200, 0)
    CONNECTION_COLOR: tuple = (0, 255, 200)
    BOX_COLOR: tuple = (90, 90, 90)
    STATUS_BG: tuple = (30, 30, 30)
    STATUS_FG: tuple = (255, 255, 255)
    ACCENT: tuple = (0, 255, 140)
    RIGHT_HAND_COLOR: tuple = (0, 255, 140)    # green
    LEFT_HAND_COLOR: tuple = (255, 180, 80)    # orange

    # Fixed-size help overlay (frame-pixels).  Constant regardless of the
    # (resizable) window size so the guide always looks the same.
    HELP_PANEL_W: int = 580
    HELP_PANEL_H: int = 460

    # ------------------------------------------------------------------ #
    # Safety
    # ------------------------------------------------------------------ #
    FAILSAFE: bool = True
    PYAUTOGUI_PAUSE: float = 0.0
