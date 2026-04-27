#!/usr/bin/env python3
"""
Batch extract landmarks + preprocess for all labeled/train/test videos.

Reads data/exports/all_labels.json, finds videos in data/raw_videos/,
runs extract_landmarks.py and preprocess.py for each one.

Usage:
    python3 training/batch_extract.py                  # process all pending
    python3 training/batch_extract.py --force          # reprocess even if outputs exist
    python3 training/batch_extract.py --dry-run        # show what would run without doing it
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("[INFO] Installing tqdm for progress bars...")
    subprocess.run([sys.executable, "-m", "pip", "install", "tqdm", "-q"])
    from tqdm import tqdm

ROOT = Path(__file__).parent.parent
EXPORTS_PATH = ROOT / "data" / "exports" / "all_labels.json"
VIDEO_DIR = ROOT / "data" / "raw_videos"
LANDMARKS_DIR = ROOT / "data" / "landmarks"
PREPROCESSED_DIR = ROOT / "data" / "preprocessed"
VALID_SPLITS = {"labeled", "train", "test"}


def run(cmd, description, dry_run=False):
    print(f"     {description}...", end="", flush=True)
    if dry_run:
        print(f"  [dry-run]")
        print(f"       {' '.join(str(c) for c in cmd)}")
        return True
    t0 = time.time()
    result = subprocess.run([str(c) for c in cmd], cwd=ROOT, capture_output=True, text=True)
    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f"  [FAILED] ({elapsed:.1f}s)")
        if result.stderr:
            print(result.stderr[-500:])  # last 500 chars of stderr
        return False
    print(f"  done ({elapsed:.1f}s)")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Reprocess even if outputs already exist")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run without executing")
    parser.add_argument("--bg-subtract", action="store_true", help="Use background subtraction to isolate performer before landmark extraction")
    args = parser.parse_args()

    if not EXPORTS_PATH.exists():
        print(f"[ERROR] Labels file not found: {EXPORTS_PATH}")
        sys.exit(1)

    data = json.loads(EXPORTS_PATH.read_text())
    videos = [v for v in data if v.get("split") in VALID_SPLITS]

    if not videos:
        print("No videos found with split: labeled, train, or test")
        sys.exit(0)

    print(f"Found {len(videos)} video(s) to process\n")

    ok = skipped = failed = 0
    total_start = time.time()

    bar = tqdm(videos, unit="video", ncols=80, bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]")

    for v in bar:
        vid_id = v["id"]
        filename = v["filename"]
        video_path = VIDEO_DIR / filename

        landmarks_out = LANDMARKS_DIR / f"{vid_id}_landmarks.json"
        preprocessed_out = PREPROCESSED_DIR / vid_id

        already_done = landmarks_out.exists() and (preprocessed_out / "normalized_landmarks.npy").exists()

        short_name = filename[:40] + "..." if len(filename) > 43 else filename
        bar.set_description(short_name)

        if already_done and not args.force:
            tqdm.write(f"  [skip] {filename}  (already extracted)")
            skipped += 1
            continue

        if not video_path.exists():
            tqdm.write(f"  [skip] {filename}  (video not found in data/raw_videos/)")
            skipped += 1
            continue

        tqdm.write(f"\n  Processing: {filename}  (split={v['split']})")

        LANDMARKS_DIR.mkdir(parents=True, exist_ok=True)
        preprocessed_out.mkdir(parents=True, exist_ok=True)

        # Step 1: Extract landmarks
        extract_cmd = ["python3", "pipeline/extract_landmarks.py", video_path, landmarks_out]
        if args.bg_subtract:
            extract_cmd.append("--bg-subtract")
        ok1 = run(
            extract_cmd,
            "Extract landmarks" + (" (bg subtraction)" if args.bg_subtract else ""),
            dry_run=args.dry_run,
        )
        if not ok1:
            tqdm.write(f"  [FAILED] extract_landmarks — {filename}")
            failed += 1
            continue

        # Step 2: Preprocess (body-frame normalization, yaw)
        ok2 = run(
            ["python3", "pipeline/preprocess.py", landmarks_out, video_path, preprocessed_out],
            "Preprocess",
            dry_run=args.dry_run,
        )
        if not ok2:
            tqdm.write(f"  [FAILED] preprocess — {filename}")
            failed += 1
            continue

        ok += 1

    total_elapsed = time.time() - total_start
    print(f"\n{'='*65}")
    print(f"Done in {total_elapsed/60:.1f} min  —  processed={ok}  skipped={skipped}  failed={failed}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
