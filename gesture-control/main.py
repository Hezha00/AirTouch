"""
main.py
=======
Entry point for the Gesture Control desktop application.

Run:
    python main.py
    python main.py --camera 0

Keys:
    H       toggle on-screen help overlay
    Q / ESC quit
"""

from __future__ import annotations

import argparse
import ctypes
import sys
import time

import cv2
import numpy as np
import pyautogui

from config import Config
from cursor_controller import CursorController
from hand_gestures import (
    GestureEngine, Landmarks,
    G_IDLE, G_MOVE, G_LCLICK, G_RCLICK, G_SCROLL, G_VOLUME,
)
from hand_tracker import create_hand_tracker
from ui import (
    print_guide, draw_bounding_box, draw_landmarks, draw_status,
    draw_volume_bar, draw_help_overlay, draw_pinch_meter,
)
from volume_control import VolumeController


# --------------------------------------------------------------------------- #
#  PyAutoGUI safety / responsiveness
# --------------------------------------------------------------------------- #
def configure_pyautogui(cfg: Config) -> None:
    pyautogui.FAILSAFE = cfg.FAILSAFE
    pyautogui.PAUSE = cfg.PYAUTOGUI_PAUSE
    try:
        pyautogui.MINIMUM_DURATION = 0
        pyautogui.MINIMUM_SLEEP = 0
    except AttributeError:
        pass


# --------------------------------------------------------------------------- #
#  Keep the OpenCV window on top of everything
# --------------------------------------------------------------------------- #
#  We try two strategies:
#    1. cv2.WND_PROP_TOPMOST  (OpenCV >= 4.5 on Windows)
#    2. Win32 SetWindowPos    (fallback via ctypes)
#  The flag is re-asserted periodically because some window managers drop
#  it after the user alt-tabs or clicks another window.
# --------------------------------------------------------------------------- #
_WND_PROP_TOPMOST = getattr(cv2, "WND_PROP_TOPMOST", None)
_HWND_NONE = -1
_win32_loaded = False
_user32 = None
try:
    if sys.platform == "win32":
        _user32 = ctypes.WinDLL("user32")
        _win32_loaded = True
except Exception:
    _win32_loaded = False

# Win32 constants
_SWP_NOMOVE = 0x0002
_SWP_NOSIZE = 0x0001
_HWND_TOPMOST = -1
_HWND_NOTOPMOST = -2
_SWP_SHOWWINDOW = 0x0040


def _cv_hwnd(window_name: str):
    """Best-effort retrieval of the OpenCV window's native handle."""
    try:
        return cv2.getWindowProperty(window_name, 0)  # arbitrary prop probe
    except Exception:
        return None


def make_window_topmost(window_name: str) -> None:
    """Pin the named OpenCV window above all others."""
    # Strategy 1: OpenCV native property.
    if _WND_PROP_TOPMOST is not None:
        try:
            cv2.setWindowProperty(window_name, _WND_PROP_TOPMOST, 1)
            return
        except Exception:
            pass
    # Strategy 2: Win32 SetWindowPos via ctypes (Windows only).
    if _win32_loaded and _user32 is not None:
        try:
            # Find the window by its exact title.
            hwnd = _user32.FindWindowW(None, window_name)
            if hwnd:
                _user32.SetWindowPos(
                    hwnd, _HWND_TOPMOST, 0, 0, 0, 0,
                    _SWP_NOMOVE | _SWP_NOSIZE | _SWP_SHOWWINDOW,
                )
        except Exception:
            pass


# --------------------------------------------------------------------------- #
#  Open camera (tries CAP_DSHOW first on Windows, then generic backend)
# --------------------------------------------------------------------------- #
def open_camera(cfg: Config) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(cfg.CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.CAM_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, cfg.CAM_FPS)
    if not cap.isOpened():
        cap = cv2.VideoCapture(cfg.CAMERA_INDEX)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.CAM_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.CAM_HEIGHT)
    return cap


# --------------------------------------------------------------------------- #
#  Helper: draw a centred banner message on the frame
# --------------------------------------------------------------------------- #
def draw_banner(frame: np.ndarray, text: str, sub: str = "",
                color=(0, 0, 255)) -> None:
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h // 2 - 60), (w, h // 2 + 60), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    cv2.rectangle(frame, (0, h // 2 - 60), (w, h // 2 + 60), color, 1)

    cv2.putText(frame, text, (w // 2 - 4 * len(text), h // 2 - 10),
                cv2.FONT_HERSHEY_DUPLEX, 0.8, color, 1, cv2.LINE_AA)
    if sub:
        cv2.putText(frame, sub, (w // 2 - 4 * len(sub), h // 2 + 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220),
                    1, cv2.LINE_AA)


# --------------------------------------------------------------------------- #
#  Main loop
# --------------------------------------------------------------------------- #
def run(cfg: Config) -> None:
    configure_pyautogui(cfg)

    cursor = CursorController(cfg)
    engine = GestureEngine(cfg=cfg)
    volume = VolumeController()

    print(f"[init] screen resolution : {cursor.screen_w} x {cursor.screen_h}")
    print(f"[init] volume backend    : {volume.status_label()}")
    print(f"[init] camera            : index {cfg.CAMERA_INDEX}, "
          f"{cfg.CAM_WIDTH}x{cfg.CAM_HEIGHT}@{cfg.CAM_FPS}fps")

    # ---- open camera FIRST so a window always appears ------------------- #
    cap = open_camera(cfg)
    if not cap.isOpened():
        print("[error] could not open the webcam. "
              "Check the camera index or that it is not in use.")
        sys.exit(1)
    print("[init] camera opened.")

    # ---- create hand tracker (Tasks API or legacy solutions API) -------- #
    tracker = create_hand_tracker(cfg)

    # ---- create the OpenCV window up front & pin it on top ------------- #
    cv2.namedWindow(cfg.WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(cfg.WINDOW_NAME, cfg.CAM_WIDTH, cfg.CAM_HEIGHT)
    make_window_topmost(cfg.WINDOW_NAME)

    print("[init] press H for help, Q / ESC to quit.")
    print("[init] window is pinned on top.  Move mouse to a screen corner "
          "to abort (failsafe).\n")

    help_on = False
    prev_t = time.time()
    fps = 0.0
    last_cursor: tuple[int, int] | None = None
    active_volume_pct: float | None = None
    # Monotonic timestamp for the Tasks API (detect_for_video needs ms).
    frame_ts = 0
    frame_count = 0
    failsafe_triggered = False

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                frame = np.zeros((cfg.CAM_HEIGHT, cfg.CAM_WIDTH, 3), dtype=np.uint8)
                draw_banner(frame, "NO CAMERA FRAME",
                            "check that the webcam is connected")
                cv2.imshow(cfg.WINDOW_NAME, frame)
                if (cv2.waitKey(30) & 0xFF) in (ord("q"), 27):
                    break
                continue

            # 1. mirror for a natural "selfie" feel
            frame = cv2.flip(frame, 1)

            gesture = G_IDLE
            pinch_l = pinch_r = 1.0

            if tracker is not None:
                # 2. run hand detection (API-agnostic).
                frame_ts = int(time.time() * 1000)
                hands = tracker.process(frame, frame_ts)

                if hands:
                    # Use the first (strongest) hand.
                    norm_pts = hands[0]
                    lm = Landmarks(pts=norm_pts)

                    res = engine.detect(lm)
                    gesture = res.name
                    pinch_l, pinch_r = res.pinch_ratio_l, res.pinch_ratio_r

                    # ---- act on the gesture --------------------------- #
                    #  All pyautogui calls are guarded: a FailSafeException
                    #  means the user deliberately shoved the mouse into a
                    #  screen corner to abort, so we exit the loop cleanly
                    #  instead of dumping a traceback.
                    try:
                        if res.cursor_target is not None:
                            if gesture == G_MOVE:
                                sx, sy = cursor.update(*res.cursor_target)
                                cursor.move_to(sx, sy)
                                last_cursor = (int(sx), int(sy))
                            elif gesture in (G_LCLICK, G_RCLICK):
                                cursor.update(*res.cursor_target)

                        if gesture == G_LCLICK:
                            pyautogui.click(button="left")
                        elif gesture == G_RCLICK:
                            pyautogui.click(button="right")
                        elif gesture == G_SCROLL and res.scroll_delta != 0.0:
                            ticks = cfg.SCROLL_TICKS
                            pyautogui.scroll(-ticks if res.scroll_delta > 0 else ticks)
                        elif gesture == G_VOLUME and res.volume_level is not None:
                            volume.set_level(res.volume_level)
                            active_volume_pct = res.volume_level * 100.0
                        else:
                            if gesture != G_VOLUME:
                                active_volume_pct = None
                    except pyautogui.FailSafeException:
                        failsafe_triggered = True
                        break

                    # ---- visual skeleton + pinch meters --------------- #
                    draw_landmarks(frame, norm_pts, cfg)
                    h, w = frame.shape[:2]
                    ix, iy = int(lm.x(8) * w), int(lm.y(8) * h)
                    draw_pinch_meter(frame, ix, iy, pinch_l,
                                     cfg.PINCH_THRESHOLD, cfg)
                    mx, my = int(lm.x(12) * w), int(lm.y(12) * h)
                    draw_pinch_meter(frame, mx, my, pinch_r,
                                     cfg.PINCH_THRESHOLD, cfg)
                else:
                    engine.reset()
                    cursor.reset()
                    active_volume_pct = None
            else:
                # Hand tracking unavailable -> still show the live feed.
                draw_banner(
                    frame,
                    "HAND TRACKING DISABLED",
                    "MediaPipe failed to load - see terminal",
                    color=(0, 140, 255),
                )

            # 3. FPS (EMA-smoothed)
            now = time.time()
            inst = 1.0 / max(1e-6, now - prev_t)
            fps = 0.9 * fps + 0.1 * inst
            prev_t = now

            # 4. HUD
            if last_cursor is None:
                px, py = pyautogui.position()
                last_cursor = (px, py)
            draw_bounding_box(frame, cfg)
            draw_status(
                frame, cfg, gesture, last_cursor, fps,
                active_volume_pct, volume.status_label(),
            )
            if active_volume_pct is not None:
                draw_volume_bar(frame, active_volume_pct / 100.0)

            # 5. help overlay (drawn last so it sits on top)
            if help_on:
                draw_help_overlay(frame, cfg)

            # 6. show + keys
            cv2.imshow(cfg.WINDOW_NAME, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:  # Q or ESC
                break
            if key == ord("h"):
                help_on = not help_on

            # 7. periodically re-assert topmost (some WMs drop the flag)
            frame_count += 1
            if frame_count % cfg.TOPMOST_REFRESH_FRAMES == 0:
                make_window_topmost(cfg.WINDOW_NAME)
    except KeyboardInterrupt:
        pass
    finally:
        if tracker is not None:
            try:
                tracker.close()
            except Exception:
                pass
        cap.release()
        cv2.destroyAllWindows()
        if failsafe_triggered:
            print("\n[exit] FAIL-SAFE triggered: mouse hit a screen corner. "
                  "Aborted cleanly.")
        print("\n[exit] gesture control stopped. bye!")


# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description="Hand-gesture PC controller")
    parser.add_argument("--camera", type=int, default=Config.CAMERA_INDEX,
                        help="webcam index (default: 0)")
    args = parser.parse_args()

    cfg = Config()
    cfg.CAMERA_INDEX = args.camera

    print_guide()
    run(cfg)


if __name__ == "__main__":
    main()
