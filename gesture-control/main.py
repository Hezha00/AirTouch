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
    TwoHandEngine, Landmarks,
    G_IDLE, G_MOVE, G_LCLICK, G_RCLICK, G_SCROLL, G_DRAG,
    G_VOL_UP, G_VOL_DOWN, G_VOLUME,
    G_START, G_TASKMGR, G_BROWSER,
    G_NONE, G_SHOW_DESKTOP, G_LOCK, G_MAXIMIZE, G_MINIMIZE,
    E_LEFT_CLICK, E_RIGHT_CLICK, E_VOL_UP, E_VOL_DOWN,
    E_START, E_TASKMGR, E_BROWSER,
    E_SHOW_DESKTOP, E_LOCK, E_MAXIMIZE, E_MINIMIZE,
)
from hand_tracker import create_hand_tracker
from ui import (
    print_guide, draw_bounding_box, draw_landmarks, draw_status,
    draw_volume_indicator, draw_help_overlay, draw_pinch_meter, draw_hand_label,
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
#  System-command helpers
# --------------------------------------------------------------------------- #
def open_default_browser() -> None:
    """Open the system's default web browser to its home page."""
    import webbrowser
    try:
        webbrowser.open("https://www.google.com")
    except Exception as e:
        print(f"[warn] could not open browser: {e}")


# --------------------------------------------------------------------------- #
#  Main loop
# --------------------------------------------------------------------------- #
def run(cfg: Config) -> None:
    configure_pyautogui(cfg)

    cursor = CursorController(cfg)
    engine = TwoHandEngine(cfg=cfg)

    print(f"[init] screen resolution : {cursor.screen_w} x {cursor.screen_h}")
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

    # ---- create a RESIZABLE OpenCV window & pin it on top -------------- #
    cv2.namedWindow(cfg.WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(cfg.WINDOW_NAME, cfg.CAM_WIDTH, cfg.CAM_HEIGHT)
    # allow free aspect-ratio resizing
    try:
        cv2.setWindowProperty(cfg.WINDOW_NAME,
                              cv2.WND_PROP_ASPECT_RATIO, 0)
    except Exception:
        pass
    make_window_topmost(cfg.WINDOW_NAME)

    print("[init] press H for help, Q / ESC to quit.")
    print("[init] window is resizable and pinned on top.  Move mouse to a "
          "screen corner to abort (failsafe).\n")

    help_on = False
    prev_t = time.time()
    fps = 0.0
    last_cursor: tuple[int, int] | None = None
    frame_ts = 0
    frame_count = 0
    failsafe_triggered = False

    # drag state machine (right-hand fist)
    dragging = False
    # display volume level (0..1) for the on-screen indicator
    vol_display: float = 0.5
    vol_indicator_dir = 0   # +1/-1/0 shown this frame

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

            right_gesture = G_IDLE
            left_gesture = G_IDLE
            combo_name = G_NONE
            vol_indicator_dir = 0
            right_present = False
            left_present = False
            right_lm = None
            left_lm = None
            right_pts = None
            left_pts = None

            if tracker is not None:
                frame_ts = int(time.time() * 1000)
                hands = tracker.process(frame, frame_ts)

                for hand in hands:
                    norm_pts = hand["landmarks"]
                    handedness = hand["handedness"]
                    if handedness == "Right":
                        right_present = True
                        right_lm = Landmarks(pts=norm_pts)
                        right_pts = norm_pts
                    elif handedness == "Left":
                        left_present = True
                        left_lm = Landmarks(pts=norm_pts)
                        left_pts = norm_pts

                # ---- run the two-hand engine -------------------------------- #
                res = engine.detect(right_lm, left_lm)
                right_gesture = res.right_name
                left_gesture = res.left_name
                combo_name = res.combo_name

                # ---- execute actions (guarded against failsafe) ----------- #
                try:
                    # COMBO overrides everything
                    if res.combo_event is not None:
                        # release any active drag before a system action
                        if dragging:
                            pyautogui.mouseUp(button="left")
                            dragging = False
                        ev = res.combo_event
                        if ev == E_LOCK:
                            pyautogui.hotkey("win", "l")
                        elif ev == E_SHOW_DESKTOP:
                            pyautogui.hotkey("win", "d")
                        elif ev == E_MAXIMIZE:
                            pyautogui.hotkey("win", "up")
                        elif ev == E_MINIMIZE:
                            pyautogui.hotkey("win", "down")
                    else:
                        # ---- RIGHT HAND continuous + drag ---- #
                        if right_present:
                            # drag state machine
                            if right_gesture == G_DRAG:
                                if not dragging:
                                    pyautogui.mouseDown(button="left")
                                    dragging = True
                                # move cursor to palm centre while dragging
                                if res.cursor_target is not None:
                                    sx, sy = cursor.update(*res.cursor_target)
                                    cursor.move_to(sx, sy)
                                    last_cursor = (int(sx), int(sy))
                            else:
                                if dragging:
                                    pyautogui.mouseUp(button="left")
                                    dragging = False
                                # normal move
                                if right_gesture == G_MOVE and res.cursor_target is not None:
                                    sx, sy = cursor.update(*res.cursor_target)
                                    cursor.move_to(sx, sy)
                                    last_cursor = (int(sx), int(sy))
                                # scroll
                                if right_gesture == G_SCROLL and res.scroll_delta != 0.0:
                                    ticks = cfg.SCROLL_TICKS
                                    pyautogui.scroll(-ticks if res.scroll_delta > 0 else ticks)
                                # volume direction
                                if right_gesture in (G_VOL_UP, G_VOL_DOWN, G_VOLUME):
                                    if res.volume_dir > 0:
                                        pyautogui.press("volumeup")
                                        vol_display = min(1.0, vol_display + cfg.VOL_STEP)
                                        vol_indicator_dir = 1
                                    elif res.volume_dir < 0:
                                        pyautogui.press("volumedown")
                                        vol_display = max(0.0, vol_display - cfg.VOL_STEP)
                                        vol_indicator_dir = -1
                                    else:
                                        vol_indicator_dir = 0
                                # edge click
                                if res.right_click_event == E_LEFT_CLICK:
                                    pyautogui.click(button="left")
                                elif res.right_click_event == E_RIGHT_CLICK:
                                    pyautogui.click(button="right")
                        else:
                            # right hand gone -> release drag + reset cursor
                            if dragging:
                                pyautogui.mouseUp(button="left")
                                dragging = False
                            cursor.reset()
                            engine.reset_transient()

                        # ---- LEFT HAND single system events ---- #
                        if left_present:
                            ev = res.left_system_event
                            if ev == E_START:
                                pyautogui.press("win")
                            elif ev == E_TASKMGR:
                                pyautogui.hotkey("ctrl", "shift", "esc")
                            elif ev == E_BROWSER:
                                open_default_browser()
                        else:
                            # left hand gone -> reset its edge memory
                            engine._prev_left_name = G_IDLE
                except pyautogui.FailSafeException:
                    failsafe_triggered = True

                # ---- draw both skeletons ---- #
                if right_pts is not None:
                    draw_landmarks(frame, right_pts, cfg,
                                   color=cfg.RIGHT_HAND_COLOR)
                    draw_hand_label(frame, right_pts, "R",
                                    right_gesture, cfg)
                    # pinch meter on the index tip (right-hand clicks)
                    if right_lm is not None:
                        h, w = frame.shape[:2]
                        ix, iy = int(right_lm.x(8) * w), int(right_lm.y(8) * h)
                        draw_pinch_meter(frame, ix, iy,
                                         res.pinch_di,
                                         cfg.PINCH_THRESHOLD, cfg)
                if left_pts is not None:
                    draw_landmarks(frame, left_pts, cfg,
                                   color=cfg.LEFT_HAND_COLOR)
                    draw_hand_label(frame, left_pts, "L",
                                    left_gesture, cfg)
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
            draw_status(frame, cfg, right_gesture, left_gesture,
                        combo_name, last_cursor, fps)
            if right_gesture in (G_VOL_UP, G_VOL_DOWN, G_VOLUME):
                draw_volume_indicator(frame, vol_indicator_dir)

            # 5. help overlay (drawn last so it sits on top, FIXED size)
            if help_on:
                draw_help_overlay(frame, cfg)

            # 6. show + keys
            cv2.imshow(cfg.WINDOW_NAME, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:  # Q or ESC
                break
            if key == ord("h"):
                help_on = not help_on

            # 7. periodically re-assert topmost
            frame_count += 1
            if frame_count % cfg.TOPMOST_REFRESH_FRAMES == 0:
                make_window_topmost(cfg.WINDOW_NAME)
    except KeyboardInterrupt:
        pass
    finally:
        # always release the mouse button if a drag was in progress
        if dragging:
            try:
                pyautogui.mouseUp(button="left")
            except Exception:
                pass
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
