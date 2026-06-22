"""
hand_tracker.py
===============
A single ``HandTracker`` interface that works with BOTH MediaPipe APIs:

  * **Tasks API** (new, used by mediapipe >= 0.10.35 builds where
    ``mediapipe.solutions`` has been removed)  -> ``mediapipe.tasks.vision``
  * **Legacy solutions API** (older builds)    -> ``mediapipe.solutions.hands``

Why this exists
---------------
Recent mediapipe wheels ship WITHOUT the legacy ``solutions`` namespace.
Their public surface is just ``['Image', 'ImageFormat', 'tasks']``.  On
those builds the only way to track hands is the Tasks API, which needs:

  1. A downloaded ``.task`` model file (hand_landmarker.task).
  2. ``HandLandmarker.create_from_options()`` + ``detect()``.

This module hides both behind one ``HandTracker.process(frame_bgr)``
call that returns a list of dicts, each with:
    {
      "landmarks": [(x, y), ...],   # 21 normalised points
      "handedness": "Left" | "Right" # CORRECTED for the mirrored feed
    }
so the rest of the app does not care which API is active.

A note on handedness
--------------------
The camera feed is flipped horizontally (selfie view) so the user's
movements feel natural.  MediaPipe runs on that flipped frame, so the
label it returns is the mirror image of reality: when the user raises
their RIGHT hand, MediaPipe (looking at the flipped image) reports
"Left".  We invert the label here so downstream code sees the user's
true hand.
"""

from __future__ import annotations

import os
import sys
import urllib.request
from typing import Optional

import cv2
import numpy as np

from config import Config

# Official Google-hosted hand landmarker model (Tasks API).
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_FILENAME = "hand_landmarker.task"


# --------------------------------------------------------------------------- #
#  Model download helper (Tasks API only)
# --------------------------------------------------------------------------- #
def _model_path(cfg: Config) -> str:
    """Return the local path to the .task model, downloading it if needed."""
    # Keep the model next to this file so it is easy to find / delete.
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, MODEL_FILENAME)

    if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
        return path

    print(f"[init] downloading MediaPipe hand landmarker model to:\n       {path}")
    try:
        # Stream the download so we can show progress.
        req = urllib.request.Request(MODEL_URL, headers={"User-Agent": "gesture-control/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(path, "wb") as out:
            total = int(resp.headers.get("Content-Length", 0))
            done = 0
            chunk = 64 * 1024
            while True:
                data = resp.read(chunk)
                if not data:
                    break
                out.write(data)
                done += len(data)
                if total:
                    pct = 100.0 * done / total
                    sys.stdout.write(f"\r       {done/1e6:5.1f} / {total/1e6:5.1f} MB  ({pct:4.1f}%)")
                    sys.stdout.flush()
            sys.stdout.write("\n")
        print("[init] model downloaded successfully.")
    except Exception as e:
        # Clean up a partial file so we retry cleanly next time.
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
        raise RuntimeError(f"Failed to download hand landmarker model: {e}") from e

    return path


def _correct_handedness(label: str) -> str:
    """
    Invert MediaPipe's handedness label because we feed it a mirrored
    (selfie) frame.  When the user raises their RIGHT hand, MediaPipe
    sees it on the left side of the flipped image and reports "Left".
    """
    if label == "Left":
        return "Right"
    if label == "Right":
        return "Left"
    return label


# --------------------------------------------------------------------------- #
#  Tasks-API implementation
# --------------------------------------------------------------------------- #
class _TasksHandTracker:
    """Hand tracker backed by ``mediapipe.tasks.vision.HandLandmarker``."""

    def __init__(self, cfg: Config) -> None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision

        self._mp = mp
        self._vision = mp_vision

        model_path = _model_path(cfg)

        base_opts = mp_python.BaseOptions(model_asset_path=model_path)
        hand_opts = mp_vision.HandLandmarkerOptions(
            base_options=base_opts,
            running_mode=mp_vision.RunningMode.VIDEO,
            num_hands=cfg.MAX_NUM_HANDS,
            min_hand_detection_confidence=cfg.MIN_DETECTION_CONFIDENCE,
            min_hand_presence_confidence=cfg.MIN_TRACKING_CONFIDENCE,
            min_tracking_confidence=cfg.MIN_TRACKING_CONFIDENCE,
        )
        self._landmarker = mp_vision.HandLandmarker.create_from_options(hand_opts)

    def process(self, frame_bgr: np.ndarray, timestamp_ms: int):
        """
        Run detection on a BGR frame.

        Returns a list of dicts:
            [{ "landmarks": [(x,y),...], "handedness": "Left"|"Right" }, ...]
        """
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = self._mp.Image(
            image_format=self._mp.ImageFormat.SRGB, data=rgb
        )
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)
        hands = []
        if result.hand_landmarks:
            for i, hl in enumerate(result.hand_landmarks):
                lms = [(lm.x, lm.y) for lm in hl]
                # result.handedness[i] is a list of Category objects.
                raw = "Unknown"
                try:
                    raw = result.handedness[i][0].category_name
                except Exception:
                    raw = "Unknown"
                hands.append({
                    "landmarks": lms,
                    "handedness": _correct_handedness(raw),
                })
        return hands

    def close(self) -> None:
        try:
            self._landmarker.close()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
#  Legacy solutions-API implementation
# --------------------------------------------------------------------------- #
class _LegacyHandTracker:
    """Hand tracker backed by ``mediapipe.solutions.hands.Hands``."""

    def __init__(self, cfg: Config) -> None:
        import importlib
        hands_mod = importlib.import_module("mediapipe.solutions.hands")
        self._Hands = hands_mod.Hands
        self._hands = self._Hands(
            static_image_mode=False,
            max_num_hands=cfg.MAX_NUM_HANDS,
            min_detection_confidence=cfg.MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=cfg.MIN_TRACKING_CONFIDENCE,
        )

    def process(self, frame_bgr: np.ndarray, timestamp_ms: int):
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self._hands.process(rgb)
        rgb.flags.writeable = True
        hands = []
        if results.multi_hand_landmarks:
            for i, hl in enumerate(results.multi_hand_landmarks):
                lms = [(lm.x, lm.y) for lm in hl.landmark]
                raw = "Unknown"
                try:
                    raw = results.multi_handedness[i].classification[0].label
                except Exception:
                    raw = "Unknown"
                hands.append({
                    "landmarks": lms,
                    "handedness": _correct_handedness(raw),
                })
        return hands

    def close(self) -> None:
        try:
            self._hands.close()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
#  Public factory
# --------------------------------------------------------------------------- #
def create_hand_tracker(cfg: Config) -> Optional[object]:
    """
    Create the best available HandTracker for this mediapipe install.

    Returns ``None`` (and prints a helpful message) if neither API works.
    """
    import mediapipe as mp
    version = getattr(mp, "__version__", "unknown")
    public_attrs = [a for a in dir(mp) if not a.startswith("_")]

    # ---- 1. Try the Tasks API (new builds) ------------------------------ #
    if "tasks" in public_attrs:
        try:
            tracker = _TasksHandTracker(cfg)
            print(f"[init] hand tracker: MediaPipe Tasks API (mediapipe {version}).")
            return tracker
        except Exception as e:
            print(f"[warn] Tasks API init failed: {e}")

    # ---- 2. Try the legacy solutions API (older builds) ----------------- #
    try:
        import importlib
        hands_mod = importlib.import_module("mediapipe.solutions.hands")
        if hasattr(hands_mod, "Hands"):
            tracker = _LegacyHandTracker(cfg)
            print(f"[init] hand tracker: legacy solutions API (mediapipe {version}).")
            return tracker
    except Exception as e:
        print(f"[warn] legacy solutions API unavailable: {e}")

    # ---- 3. Nothing worked --------------------------------------------- #
    print("[error] No working MediaPipe hand-tracking API found.")
    print(f"        mediapipe version : {version}")
    print(f"        public attributes : {public_attrs}")
    print("        The camera window will still open, but hand tracking is disabled.")
    print("        Fix: pip install --upgrade mediapipe")
    return None
