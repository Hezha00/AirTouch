"""
volume_control.py
=================
Proximity-based Windows system volume control.

Primary backend : pycaw  (fine-grained, 0..100% absolute control)
Fallback backend: pyautogui media keys (volumeup / volumedown)

The module degrades gracefully: if pycaw / comtypes are unavailable or the
OS is not Windows, volume commands fall back to coarse media-key presses.
"""

from __future__ import annotations

import platform
import time

import pyautogui

from config import Config


# --------------------------------------------------------------------------- #
#  Try to initialise the high-resolution Windows audio backend.
# --------------------------------------------------------------------------- #
_PycawBackend = None
_PYCAW_OK = False

if platform.system() == "Windows":
    try:
        from ctypes import cast, POINTER

        from comtypes import CLSCTX_ALL
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

        _devices = AudioUtilities.GetSpeakers()
        _interface = _devices.Activate(
            IAudioEndpointVolume._iid_, CLSCTX_ALL, None
        )
        _PycawBackend = cast(_interface, POINTER(IAudioEndpointVolume))
        _PYCAW_OK = True
    except Exception as _err:  # pragma: no cover - environment dependent
        print(f"[volume] pycaw unavailable, falling back to media keys ({_err})")
        _PYCAW_OK = False


class VolumeController:
    """Maps a 0..1 level to the system master volume."""

    def __init__(self) -> None:
        self.available: bool = _PYCAW_OK
        # Simulated level used by the media-key fallback.
        self._sim_level: float = self.current_level()
        self._last_press: float = 0.0

    # ------------------------------------------------------------------ #
    #  Read / write
    # ------------------------------------------------------------------ #
    def current_level(self) -> float:
        """Return the current master volume as a 0..1 float."""
        if _PYCAW_OK and _PycawBackend is not None:
            try:
                return float(_PycawBackend.GetMasterVolumeLevelScalar())
            except Exception:
                return 0.5
        return self._sim_level

    def set_level(self, level: float) -> None:
        """Set the master volume to ``level`` (clamped to 0..1)."""
        level = max(0.0, min(1.0, level))

        if _PYCAW_OK and _PycawBackend is not None:
            try:
                _PycawBackend.SetMasterVolumeLevelScalar(level, None)
                self._sim_level = level
                return
            except Exception:
                pass

        # ---- media-key fallback --------------------------------------- #
        self._media_key_fallback(level)

    # ------------------------------------------------------------------ #
    #  Fallback: nudge the OS volume with volumeup / volumedown presses.
    #  Windows treats each press as ~2% so we issue a batch of presses.
    # ------------------------------------------------------------------ #
    def _media_key_fallback(self, target: float) -> None:
        now = time.time()
        if now - self._last_press < 0.05:
            return
        self._last_press = now

        diff = target - self._sim_level
        step = 0.02  # ~one media-key press
        n = int(abs(diff) / step)
        n = max(1, min(n, 10))
        if diff > 0:
            for _ in range(n):
                pyautogui.press("volumeup")
            self._sim_level = min(1.0, self._sim_level + n * step)
        elif diff < 0:
            for _ in range(n):
                pyautogui.press("volumedown")
            self._sim_level = max(0.0, self._sim_level - n * step)

    # ------------------------------------------------------------------ #
    #  Convenience used by the UI to render a volume bar.
    # ------------------------------------------------------------------ #
    def status_label(self) -> str:
        if _PYCAW_OK:
            return "pycaw (fine-grained)"
        return "media-keys (coarse fallback)"
