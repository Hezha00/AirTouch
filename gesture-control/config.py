"""
config.py
=========
Central configuration for the Gesture Control application.

Every "magic number" lives here so the app can be tuned without digging
through the control logic.  Distances are expressed in MediaPipe's
normalised coordinate space (0.0 -> 1.0) unless stated otherwise.
"""

from __future__ import annotations


class Config:
    # ------------------------------------------------------------------ #
    # Camera
    # ------------------------------------------------------------------ #
    CAMERA_INDEX: int = 0           # 0 = default webcam
    CAM_WIDTH: int = 640
    CAM_HEIGHT: int = 480
    CAM_FPS: int = 30

    # ------------------------------------------------------------------ #
    # MediaPipe Hands
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
    # Expressed as the margin fraction kept inactive on each side.
    BOX_X_MARGIN: float = 0.30      # 30% margin left & right
    BOX_Y_MARGIN: float = 0.30      # 30% margin top & bottom

    # Safety margin (pixels) kept clear around the screen edges so the
    # gesture-driven cursor can NEVER reach a corner and accidentally
    # trigger PyAutoGUI's fail-safe abort.  The fail-safe itself stays
    # enabled so the user can still abort by physically pushing the mouse
    # into a corner.
    SCREEN_MARGIN: int = 20

    # Re-assert the OpenCV window as topmost every N frames (some window
    # managers drop the topmost flag after focus changes).
    TOPMOST_REFRESH_FRAMES: int = 60

    # ------------------------------------------------------------------ #
    # Click / pinch detection
    # ------------------------------------------------------------------ #
    # Distances are normalised by the hand reference size
    # (wrist -> middle-finger MCP), so the threshold is depth-invariant.
    PINCH_THRESHOLD: float = 0.40   # strict: pinch fires below this ratio
    CLICK_COOLDOWN: float = 0.45    # seconds between consecutive clicks

    # ------------------------------------------------------------------ #
    # Scroll
    # ------------------------------------------------------------------ #
    SCROLL_HISTORY: int = 6         # frames used to measure vertical delta
    SCROLL_THRESHOLD: float = 0.045 # normalised delta-y to trigger a scroll
    SCROLL_TICKS: int = 3           # pyautogui.scroll() units per trigger

    # ------------------------------------------------------------------ #
    # Volume (Z-axis / proximity) control
    # ------------------------------------------------------------------ #
    # Hand reference size (wrist -> middle MCP) mapped to 0..100% volume.
    VOL_MIN_DIST: float = 0.12      # hand far  -> 0%
    VOL_MAX_DIST: float = 0.32      # hand near -> 100%
    VOL_EMA_ALPHA: float = 0.20     # smoothing for the proximity signal
    VOL_DEADBAND: float = 0.015     # ignore tiny changes (anti-flutter)

    # ------------------------------------------------------------------ #
    # Visuals
    # ------------------------------------------------------------------ #
    WINDOW_NAME: str = "Gesture Control  |  press H: help  Q: quit"
    LANDMARK_COLOR: tuple = (255, 200, 0)      # amber (BGR)
    CONNECTION_COLOR: tuple = (0, 255, 200)    # cyan   (BGR)
    BOX_COLOR: tuple = (90, 90, 90)            # subtle grey (BGR)
    STATUS_BG: tuple = (30, 30, 30)
    STATUS_FG: tuple = (255, 255, 255)
    ACCENT: tuple = (0, 255, 140)              # green accent (BGR)

    # ------------------------------------------------------------------ #
    # Safety
    # ------------------------------------------------------------------ #
    FAILSAFE: bool = True          # pyautogui corner-abort
    PYAUTOGUI_PAUSE: float = 0.0   # no artificial delay between actions
