#!/usr/bin/env python3
"""
Clean all generated pipeline outputs, leaving raw inputs intact.

Usage:
    python3 utils/clean.py
"""
import shutil
from pathlib import Path

GENERATED_DIRS = [
    "data/landmarks",
    "data/preprocessed",
    "data/preprocessed_silk",
    "data/output",
]

ROOT = Path(__file__).parent.parent

def clean():
    for d in GENERATED_DIRS:
        path = ROOT / d
        if path.exists():
            shutil.rmtree(path)
            print(f"Deleted {d}/")
        else:
            print(f"Skipped {d}/ (not found)")
    print("\nDone. Raw videos and config untouched.")

if __name__ == "__main__":
    confirm = input("Delete all generated outputs? [y/N] ")
    if confirm.lower() == "y":
        clean()
    else:
        print("Aborted.")
