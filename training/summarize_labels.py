#!/usr/bin/env python3
"""
Summarize labeled data from all_labels.json.

Reads data/exports/all_labels.json, filters to videos with split in
{labeled, train, test}, and outputs training/label_summary.csv with:
  move_name, num_videos, num_frames, video_names

Usage:
    python3 training/summarize_labels.py [path/to/all_labels.json]
"""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

EXPORTS_PATH = Path(__file__).parent.parent / "data" / "exports" / "all_labels.json"
OUT_PATH = Path(__file__).parent / "label_summary.csv"
VALID_SPLITS = {"labeled", "train", "test"}


def summarize(labels_path: Path):
    data = json.loads(labels_path.read_text())

    # move -> {videos: set, frames: int}
    stats = defaultdict(lambda: {"videos": set(), "frames": 0})

    for video in data:
        if video.get("split") not in VALID_SPLITS:
            continue
        filename = video.get("filename", video.get("id", "unknown"))
        for lbl in video.get("labels", []):
            move = lbl.get("label", "").strip()
            if not move:
                continue
            start = lbl.get("startFrame", 0)
            end = lbl.get("endFrame", 0)
            frame_count = max(0, end - start + 1)
            stats[move]["videos"].add(filename)
            stats[move]["frames"] += frame_count

    if not stats:
        print("No labeled data found for splits: labeled, train, test")
        return

    rows = sorted(
        [
            {
                "move_name": move,
                "num_videos": len(s["videos"]),
                "num_frames": s["frames"],
                "video_names": "; ".join(sorted(s["videos"])),
            }
            for move, s in stats.items()
        ],
        key=lambda r: (-r["num_frames"], r["move_name"]),
    )

    with open(OUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["move_name", "num_videos", "num_frames", "video_names"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} moves to {OUT_PATH}\n")
    print(f"{'Move':<30} {'Videos':>8} {'Frames':>10}")
    print("-" * 52)
    for r in rows:
        print(f"{r['move_name']:<30} {r['num_videos']:>8} {r['num_frames']:>10}")


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else EXPORTS_PATH
    if not path.exists():
        print(f"[ERROR] File not found: {path}")
        sys.exit(1)
    summarize(path)
