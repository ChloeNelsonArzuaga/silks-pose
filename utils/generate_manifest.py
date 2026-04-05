#!/usr/bin/env python3
"""
Generate a JSON manifest of videos in data/raw_videos/ for the web app.
Preserves existing metadata (labels, tags, split) for videos already in the manifest.

Usage:
    python3 utils/generate_manifest.py
"""
import json
from pathlib import Path

VIDEO_DIR = Path(__file__).parent.parent / "data" / "raw_videos"
OUT_PATH = Path(__file__).parent.parent / "app" / "videos.json"
EXTENSIONS = {".mov", ".mp4", ".avi", ".webm"}

def generate():
    if not VIDEO_DIR.exists():
        print(f"Video directory not found: {VIDEO_DIR}")
        return

    # Load existing manifest so we preserve labels/tags/split
    existing = {}
    if OUT_PATH.exists():
        for v in json.loads(OUT_PATH.read_text()):
            existing[v["id"]] = v

    videos = []
    for f in sorted(VIDEO_DIR.iterdir()):
        if f.suffix.lower() in EXTENSIONS and not f.name.startswith('.'):
            vid_id = f.stem
            entry = existing.get(vid_id, {})
            videos.append({
                "id": vid_id,
                "filename": f.name,
                "path": f"data/raw_videos/{f.name}",
                "split": entry.get("split", "unassigned"),
                "tags": entry.get("tags", []),
                "labels": entry.get("labels", []),
            })

    OUT_PATH.write_text(json.dumps(videos, indent=2))
    print(f"Wrote {len(videos)} video(s) to {OUT_PATH}")

if __name__ == "__main__":
    generate()
