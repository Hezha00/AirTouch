"""
cursor_controller.py
====================
Smart, anti-jitter cursor control.

* Tracks the tip of the index finger (MediaPipe landmark 8).
* Smooths coordinates with an Exponential Moving Average (EMA).
* Maps the active bounding box (centre of the camera frame) to the full
  primary monitor resolution via ``numpy.interp``.
"""

from __future__ import annotations

import numpy as np
import pyautogui

from config import Config


class CursorController:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.screen_w, self.screen_h = pyautogui.size()

        # EMA state
        self._sx: float | None = None
        self._sy: float | None = None

        # Pre-compute the active bounding box in normalised coords.
        self.box = (
            cfg.BOX_X_MARGIN,            # x1
            cfg.BOX_Y_MARGIN,            # y1
            1.0 - cfg.BOX_X_MARGIN,      # x2
            1.0 - cfg.BOX_Y_MARGIN,      # y2
        )

    # ------------------------------------------------------------------ #
    #  Core update
    # ------------------------------------------------------------------ #
    def update(self, nx: float, ny: float) -> tuple[float, float]:
        """
        Feed a raw normalised index-tip position; return the smoothed
        screen-space (x, y) target.

        The target is clamped to a safe inner rectangle
        ``[margin, screen - margin]`` so the gesture-driven cursor can
        never land on a screen corner and accidentally trigger
        PyAutoGUI's fail-safe abort.
        """
        x1, y1, x2, y2 = self.box
        m = self.cfg.SCREEN_MARGIN

        # Map the active box onto the SAFE inner rectangle of the screen.
        tx = float(np.interp(nx, [x1, x2], [m, self.screen_w - m]))
        ty = float(np.interp(ny, [y1, y2], [m, self.screen_h - m]))

        # Clamp to the safe rectangle (in case nx/ny fall outside the box).
        lo_x, hi_x = float(m), float(self.screen_w - m)
        lo_y, hi_y = float(m), float(self.screen_h - m)
        tx = max(lo_x, min(hi_x, tx))
        ty = max(lo_y, min(hi_y, ty))

        a = self.cfg.EMA_ALPHA
        if self._sx is None:
            self._sx, self._sy = tx, ty
        else:
            self._sx = a * tx + (1.0 - a) * self._sx
            self._sy = a * ty + (1.0 - a) * self._sy

        # Final defensive clamp on the smoothed value too.
        self._sx = max(lo_x, min(hi_x, self._sx))
        self._sy = max(lo_y, min(hi_y, self._sy))

        return self._sx, self._sy

    def reset(self) -> None:
        """Clear the EMA memory (e.g. when the hand is lost)."""
        self._sx = None
        self._sy = None

    def move_to(self, x: float, y: float) -> None:
        """Physically move the OS cursor."""
        pyautogui.moveTo(int(x), int(y))

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #
    @property
    def screen_size(self) -> tuple[int, int]:
        return self.screen_w, self.screen_h
