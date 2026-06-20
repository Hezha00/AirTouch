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
import importlib
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
#  Robust MediaPipe loader
# --------------------------------------------------------------------------- #
#  Newer MediaPipe builds (and some wheels on Python 3.11/3.12) do NOT
#  auto-populate `mp.solutions` when you `import mediapipe`.  We therefore
#  force-import the submodules explicitly and return the Hands class.
# --------------------------------------------------------------------------- #
def load_mediapipe_hands():
    """
    Return the MediaPipe ``Hands`` solution class in a version-robust way.

    Tries several import strategies and, on failure, reports EVERY error
    (not just the last one) plus a full environment diagnostic so the real
    cause is visible.
    """
    import sys as _sys
    import mediapipe as mp

    errors: list[str] = []

    # Strategy 1: mediapipe.solutions.hands
    try:
        importlib.import_module("mediapipe.solutions")
        hands_mod = importlib.import_module("mediapipe.solutions.hands")
        if hasattr(hands_mod, "Hands"):
            return hands_mod.Hands, getattr(hands_mod, "HAND_CONNECTIONS", None)
        errors.append("mediapipe.solutions.hands imported but has no 'Hands'")
    except Exception as e:
        import traceback
        errors.append(
            f"mediapipe.solutions.hands -> {type(e).__name__}: {e}\n"
            + traceback.format_exc().strip()
        )

    # Strategy 2: mediapipe.python.solutions.hands
    try:
        hands_mod = importlib.import_module("mediapipe.python.solutions.hands")
        if hasattr(hands_mod, "Hands"):
            return hands_mod.Hands, getattr(hands_mod, "HAND_CONNECTIONS", None)
        errors.append("mediapipe.python.solutions.hands imported but has no 'Hands'")
    except Exception as e:
        errors.append(
            f"mediapipe.python.solutions.hands -> {type(e).__name__}: {e}"
        )

    # ---- environment diagnostic ---------------------------------------- #
    diag: list[str] = []
    diag.append(f"Python   : {_sys.version.split()[0]}  ({_sys.executable})")
    diag.append(f"mediapipe: {getattr(mp, '__version__', 'unknown')}  "
                f"({getattr(mp, '__file__', '?')})")
    diag.append("mp attrs : "
                + str([a for a in dir(mp) if not a.startswith("_")]))
    try:
        import google.protobuf
        diag.append(f"protobuf : {google.protobuf.__version__}")
    except Exception as e:
        diag.append(f"protobuf : <unavailable: {e}>")
    try:
        import numpy
        diag.append(f"numpy    : {numpy.__version__}")
    except Exception:
        diag.append("numpy    : <unavailable>")
    try:
        import cv2
        diag.append(f"opencv   : {cv2.__version__}")
    except Exception:
        diag.append("opencv   : <unavailable>")

    raise RuntimeError(
        "Could not load MediaPipe Hands solution.\n"
        "---- attempted strategies ----\n"
        + "\n\n".join(f"[{i+1}] {e}" for i, e in enumerate(errors))
        + "\n\n---- environment ----\n"
        + "\n".join(diag)
        + "\n\n---- most likely fixes ----\n"
        "  A) Protobuf conflict (most common): "
        "pip install 'protobuf<4'   (mediapipe needs protobuf 3.20.x)\n"
        "  B) Force pure-python protobuf: set "
        "PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python\n"
        "  C) Pin a known-good mediapipe: "
        "pip install 'mediapipe==0.10.14'\n"
        "  D) Use Python 3.10 or 3.11 (mediapipe has limited 3.12+ support)\n"
        "  Run 'python diagnose.py' for a full report."
    )


# --------------------------------------------------------------------------- #
#  Open camera
# --------------------------------------------------------------------------- #
def open_camera(cfg: Config) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(cfg.CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.CAM_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, cfg.CAM_FPS)
    if not cap.isOpened():
        # Fallback: try without CAP_DSHOW (some setups dislike it).
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

    # ---- try to load MediaPipe Hands ------------------------------------ #
    hands = None
    mp_error: str | None = None
    try:
        HandsCls, _connections = load_mediapipe_hands()
        hands = HandsCls(
            static_image_mode=False,
            max_num_hands=cfg.MAX_NUM_HANDS,
            min_detection_confidence=cfg.MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=cfg.MIN_TRACKING_CONFIDENCE,
        )
        print("[init] MediaPipe Hands loaded successfully.")
    except Exception as e:
        mp_error = str(e)
        print("[warn] MediaPipe Hands could not be loaded:")
        print("       " + mp_error)
        print("[warn] The camera window will still open (hand tracking disabled).")

    print("[init] press H for help, Q / ESC to quit.\n")

    help_on = False
    prev_t = time.time()
    fps = 0.0
    last_cursor: tuple[int, int] | None = None
    active_volume_pct: float | None = None

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                # Show a placeholder frame so the window never disappears.
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

            if hands is not None:
                # 2. MediaPipe expects RGB
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                results = hands.process(rgb)
                rgb.flags.writeable = True

                if results.multi_hand_landmarks:
                    hand_lm = results.multi_hand_landmarks[0]
                    lm = Landmarks(pts=[(p.x, p.y) for p in hand_lm.landmark])

                    res = engine.detect(lm)
                    gesture = res.name
                    pinch_l, pinch_r = res.pinch_ratio_l, res.pinch_ratio_r

                    # ---- act on the gesture --------------------------- #
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

                    # ---- visual skeleton + pinch meters --------------- #
                    draw_landmarks(frame, hand_lm, cfg)
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
                # MediaPipe unavailable -> just show the live feed + warning.
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
    except KeyboardInterrupt:
        pass
    finally:
        if hands is not None:
            try:
                hands.close()
            except Exception:
                pass
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
