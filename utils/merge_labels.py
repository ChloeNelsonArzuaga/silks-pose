#!/usr/bin/env python3
"""
Merge an exported labels JSON file back into the videos.json manifest.

Usage:
    python3 utils/merge_labels.py path/to/exported_labels.json [path/to/another.json ...]

The exported file should have the structure produced by the browser Export button:
{
  "id": "video_name",
  "filename": "video_name.mov",
  "split": "train",
  "tags": ["good take", "dark"],
  "labels": [{ "startTime": 0.0, "endTime": 3.1, ... }]
}
"""
import json
import sys
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent / "app" / "videos.json"

def merge(export_paths):
    if not MANIFEST_PATH.exists():
        print(f"[ERROR] Manifest not found at {MANIFEST_PATH}")
        print("Run: python3 utils/generate_manifest.py")
        sys.exit(1)

    manifest = json.loads(MANIFEST_PATH.read_text())
    index = {v["id"]: v for v in manifest}

    for path in export_paths:
        path = Path(path)
        if not path.exists():
            print(f"[SKIP] File not found: {path}")
            continue

        data = json.loads(path.read_text())

        # Support single export or list of exports
        entries = data if isinstance(data, list) else [data]

        for entry in entries:
            vid_id = entry.get("id")
            if not vid_id:
                print(f"[SKIP] No 'id' field in {path.name}")
                continue

            if vid_id not in index:
                print(f"[SKIP] '{vid_id}' not found in manifest — run generate_manifest.py first")
                continue

            v = index[vid_id]
            if "split" in entry:
                v["split"] = entry["split"]
            if "tags" in entry:
                v["tags"] = entry["tags"]
            if "labels" in entry:
                v["labels"] = entry["labels"]

            print(f"[OK] Merged '{vid_id}': split={v['split']}, tags={v['tags']}, labels={len(v['labels'])}")

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    print(f"\nSaved updated manifest to {MANIFEST_PATH}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 utils/merge_labels.py exported_labels.json [more.json ...]")
        sys.exit(1)
    merge(sys.argv[1:])
