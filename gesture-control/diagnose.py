"""
diagnose.py
===========
Standalone environment + MediaPipe diagnostic.

Run:
    python diagnose.py

It prints a full report of your Python, mediapipe, opencv, numpy and
protobuf versions, then attempts every known way to load the MediaPipe
Hands solution and shows the EXACT error for each attempt.

Paste the full output back if you need help.
"""

from __future__ import annotations

import importlib
import sys
import traceback


def section(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def main() -> None:
    section("1. PYTHON")
    print(f"version   : {sys.version}")
    print(f"executable: {sys.executable}")
    print(f"platform  : {sys.platform}")

    section("2. CORE PACKAGES")
    for name in ("numpy", "cv2", "google.protobuf", "mediapipe"):
        try:
            m = importlib.import_module(name)
            ver = getattr(m, "__version__",
                          getattr(m, "VERSION", "<no __version__>"))
            print(f"  {name:18s} {ver:12s}  ({getattr(m, '__file__', '?')})")
        except Exception as e:
            print(f"  {name:18s} FAILED -> {type(e).__name__}: {e}")

    section("3. MEDIAPIPE INTROSPECTION")
    try:
        import mediapipe as mp
        print(f"mediapipe.__version__ = {getattr(mp, '__version__', '?')}")
        print(f"mediapipe.__file__    = {getattr(mp, '__file__', '?')}")
        print(f"mediapipe.__path__    = {getattr(mp, '__path__', '?')}")
        attrs = [a for a in dir(mp) if not a.startswith("_")]
        print(f"public attributes     : {attrs}")
        print(f"has 'solutions' attr? : {hasattr(mp, 'solutions')}")
    except Exception as e:
        print(f"import mediapipe failed: {type(e).__name__}: {e}")
        traceback.print_exc()

    section("4. MEDIAPIPE HANDS LOAD ATTEMPTS")
    attempts = [
        ("import mediapipe.solutions.hands",
         lambda: importlib.import_module("mediapipe.solutions.hands")),
        ("import mediapipe.python.solutions.hands",
         lambda: importlib.import_module("mediapipe.python.solutions.hands")),
        ("from mediapipe.solutions.hands import Hands",
         lambda: importlib.import_module(
             "mediapipe.solutions.hands").Hands),
    ]
    for label, fn in attempts:
        print(f"\n>>> {label}")
        try:
            obj = fn()
            print(f"    OK -> {obj}")
        except Exception as e:
            print(f"    FAILED -> {type(e).__name__}: {e}")
            traceback.print_exc()

    section("5. PROTOBUF COMPATIBILITY CHECK")
    try:
        import google.protobuf
        from google.protobuf import descriptor_pb2  # noqa: F401
        print(f"protobuf version: {google.protobuf.__version__}")
        print("descriptor_pb2 imported OK")
        impl = google.protobuf.__version__
        major = int(impl.split(".")[0])
        if major >= 4:
            print("WARNING: protobuf >= 4 is known to break mediapipe.solutions.")
            print("         Fix: pip install 'protobuf<4'")
        else:
            print("protobuf major < 4 (OK for mediapipe).")
    except Exception as e:
        print(f"protobuf check failed: {type(e).__name__}: {e}")
        traceback.print_exc()

    section("6. RECOMMENDED FIXES (in order)")
    print("""
  A) Protobuf conflict (THE most common cause):
       pip install "protobuf<4"
     then re-run: python main.py

  B) If A fails, force pure-python protobuf at runtime:
     Windows (PowerShell):
       $env:PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION="python"; python main.py
     Windows (cmd):
       set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python && python main.py

  C) Pin a known-good mediapipe version:
       pip install "mediapipe==0.10.14"

  D) If you are on Python 3.12+, mediapipe support is limited.
     Create a clean venv on Python 3.10 or 3.11:
       py -3.11 -m venv venv311
       venv311\\Scripts\\activate
       pip install opencv-python mediapipe pyautogui numpy pycaw comtypes
       python main.py
""")


if __name__ == "__main__":
    main()
