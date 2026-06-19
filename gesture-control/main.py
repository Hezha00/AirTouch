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
import sys
import time

import cv2
import mediapipe as mp
import numpy as np
import pyautogui

from config import Config
from cursor_controller import CursorController
from hand_gestures import (
    GestureEngine, Landmarks,
    G_IDLE, G_MOVE, G_LCLICK, G_RCLICK, G_SCROLL, G_VOLUME,
)
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
    # Hide PyAutoGUI's own delay so the cursor feels instant.
    try:
        pyautogui.MINIMUM_DURATION = 0
        pyautogui.MINIMUM_SLEEP = 0
    except AttributeError:
        pass


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
    print("[init] press H for help, Q / ESC to quit.\n")

    cap = cv2.VideoCapture(cfg.CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.CAM_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, cfg.CAM_FPS)

    if not cap.isOpened():
        print("[error] could not open the webcam. "
              "Check the camera index or that it is not in use.")
        sys.exit(1)

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=cfg.MAX_NUM_HANDS,
        min_detection_confidence=cfg.MIN_DETECTION_CONFIDENCE,
        min_tracking_confidence=cfg.MIN_TRACKING_CONFIDENCE,
    )

    help_on = False
    prev_t = time.time()
    fps = 0.0
    last_cursor: tuple[int, int] | None = None
    active_volume_pct: float | None = None

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[warn] empty frame grabbed, retrying...")
                continue

            # 1. mirror for a natural "selfie" feel
            frame = cv2.flip(frame, 1)

            # 2. MediaPipe expects RGB
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            results = hands.process(rgb)
            rgb.flags.writeable = True

            gesture = G_IDLE
            cursor_pos: tuple[int, int] | None = None
            pinch_l = pinch_r = 1.0

            if results.multi_hand_landmarks:
                hand_lm = results.multi_hand_landmarks[0]
                lm = Landmarks(pts=[(p.x, p.y) for p in hand_lm.landmark])

                res = engine.detect(lm)
                gesture = res.name
                pinch_l, pinch_r = res.pinch_ratio_l, res.pinch_ratio_r

                # ---- act on the gesture ------------------------------- #
                if res.cursor_target is not None:
                    if gesture == G_MOVE:
                        sx, sy = cursor.update(*res.cursor_target)
                        cursor.move_to(sx, sy)
                        last_cursor = (int(sx), int(sy))
                    # Keep the EMA target fresh even outside MOVE so the
                    # cursor doesn't snap when re-entering MOVE mode, but
                    # do NOT physically move it.
                    elif gesture in (G_LCLICK, G_RCLICK):
                        cursor.update(*res.cursor_target)

                if gesture == G_LCLICK:
                    pyautogui.click(button="left")
                elif gesture == G_RCLICK:
                    pyautogui.click(button="right")
                elif gesture == G_SCROLL and res.scroll_delta != 0.0:
                    # hand up (delta<0) -> scroll up (+), hand down -> down (-)
                    ticks = cfg.SCROLL_TICKS
                    pyautogui.scroll(-ticks if res.scroll_delta > 0 else ticks)
                elif gesture == G_VOLUME and res.volume_level is not None:
                    volume.set_level(res.volume_level)
                    active_volume_pct = res.volume_level * 100.0
                else:
                    if gesture != G_VOLUME:
                        active_volume_pct = None

                # ---- visual skeleton + pinch meters ------------------- #
                draw_landmarks(frame, hand_lm, cfg)
                h, w = frame.shape[:2]
                ix, iy = int(lm.x(8) * w), int(lm.y(8) * h)
                draw_pinch_meter(frame, ix, iy, pinch_l, cfg.PINCH_THRESHOLD, cfg)
                mx, my = int(lm.x(12) * w), int(lm.y(12) * h)
                draw_pinch_meter(frame, mx, my, pinch_r, cfg.PINCH_THRESHOLD, cfg)
            else:
                # hand lost -> reset transient state
                engine.reset()
                cursor.reset()
                active_volume_pct = None

            # 3. FPS (EMA-smoothed)
            now = time.time()
            inst = 1.0 / max(1e-6, now - prev_t)
            fps = 0.9 * fps + 0.1 * inst
            prev_t = now

            # 4. HUD
            if last_cursor is None:
                # fall back to the real cursor if we never moved it
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
    except KeyboardInterrupt:
        pass
    finally:
        hands.close()
        cap.release()
        cv2.destroyAllWindows()
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
