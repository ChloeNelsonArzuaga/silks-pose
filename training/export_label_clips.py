#!/usr/bin/env python3
"""
Export short annotated video clips for each labeled cats cradle segment.

For each label matching TARGET_MOVE, seeks to startFrame, reads through
endFrame, draws the pose skeleton, and saves a clip to data/output/label_clips/.

Usage:
    python3 training/export_label_clips.py                  # cats cradle only
    python3 training/export_label_clips.py --move "angel"   # any other move
    python3 training/export_label_clips.py --all-moves      # every labeled move
"""
import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from utils.utils import draw_landmarks

EXPORTS_PATH = ROOT / "data" / "exports" / "all_labels.json"
LANDMARKS_DIR = ROOT / "data" / "landmarks"
VIDEO_DIR = ROOT / "data" / "raw_videos"
OUT_DIR = ROOT / "data" / "output" / "label_clips"

VALID_SPLITS = {"labeled", "train", "test"}
DEFAULT_MOVE = "cats cradle"

BG_WARMUP_FRAMES = 120
BG_DARKEN = 0.25        # background brightness multiplier (0=black, 1=unchanged)
BG_DILATE_PX = 30       # expand foreground mask to fill gaps around performer

POSE_CONNECTIONS = [
    (11,12),(11,13),(13,15),(12,14),(14,16),
    (11,23),(12,24),(23,24),
    (23,25),(24,26),(25,27),(26,28),
    (15,17),(16,18),(17,19),(18,20),
]


def normalize_move(name):
    return name.strip().lower()


def build_bg_subtractor(video_path, warmup_frames):
    cap = cv2.VideoCapture(str(video_path))
    subtractor = cv2.createBackgroundSubtractorMOG2(
        history=warmup_frames, varThreshold=40, detectShadows=False
    )
    for _ in range(warmup_frames):
        ret, frame = cap.read()
        if not ret:
            break
        subtractor.apply(frame, learningRate=0.05)
    cap.release()
    return subtractor


def darken_background(frame, subtractor, dilate_px, darken):
    fg_mask = subtractor.apply(frame, learningRate=0.005)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px, dilate_px))
    fg_mask = cv2.dilate(fg_mask, kernel, iterations=2)

    fg_mask_3 = fg_mask[:, :, np.newaxis] / 255.0
    darkened = (frame * darken).astype(np.uint8)
    return (frame * fg_mask_3 + darkened * (1 - fg_mask_3)).astype(np.uint8)


def export_clip(video_path, landmarks_json_path, start_time, end_time, start_frame, out_path, move_name):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"    [ERROR] Cannot open video: {video_path}")
        return False

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Build background model from the start of the video
    subtractor = build_bg_subtractor(video_path, BG_WARMUP_FRAMES)

    # Seek by timestamp (ms) — more reliable than frame index for .MOV files
    cap.set(cv2.CAP_PROP_POS_MSEC, start_time * 1000)
    n_frames = max(1, round((end_time - start_time) * fps))

    # Load raw landmarks (camera-frame coords for drawing on video)
    with open(landmarks_json_path) as f:
        raw_landmarks = json.load(f)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (w, h))

    for i in range(n_frames):
        ret, frame = cap.read()
        if not ret:
            break

        # Use start_frame + i for landmark lookup (landmark JSON is frame-indexed)
        frame_idx = start_frame + i
        rec = raw_landmarks[frame_idx] if frame_idx < len(raw_landmarks) else None

        lms, vis = None, None
        if rec and rec.get("landmarks"):
            lms, vis = [], []
            for j in rec["landmarks"]:
                if j is None or (isinstance(j, list) and j[0] is None):
                    lms.append(None)
                    vis.append(0.0)
                else:
                    x, y, z, v = j
                    lms.append([float(x), float(y), float(z)])
                    vis.append(float(v))

        annotated = frame.copy()
        if lms:
            draw_landmarks(
                annotated, lms, visibilities=vis, vis_thresh=0.1,
                pose_connections=POSE_CONNECTIONS,
                point_color=(0, 200, 255), occluded_color=(50, 50, 50),
            )

        # Label overlay
        cv2.putText(annotated, move_name, (8, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 220, 100), 2, cv2.LINE_AA)
        cv2.putText(annotated, f"frame {frame_idx}  ({i+1}/{n_frames})", (8, 62),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)

        writer.write(annotated)

    cap.release()
    writer.release()
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--move", default=DEFAULT_MOVE, help="Move name to export clips for")
    parser.add_argument("--all-moves", action="store_true", help="Export clips for every labeled move")
    parser.add_argument("--video", default=None, help="Only export clips for this video filename (e.g. IMG_0250.MOV)")
    args = parser.parse_args()

    if not EXPORTS_PATH.exists():
        print(f"[ERROR] Labels file not found: {EXPORTS_PATH}")
        sys.exit(1)

    data = json.loads(EXPORTS_PATH.read_text())
    videos = [v for v in data if v.get("split") in VALID_SPLITS]

    total = ok = skipped = failed = 0

    for v in videos:
        vid_id = v["id"]
        filename = v["filename"]
        video_path = VIDEO_DIR / filename
        landmarks_path = LANDMARKS_DIR / f"{vid_id}_landmarks.json"

        if args.video and args.video.lower() not in filename.lower():
            continue
        if not video_path.exists():
            continue
        if not landmarks_path.exists():
            continue

        for idx, lbl in enumerate(v.get("labels", [])):
            move = lbl.get("label", "").strip()
            if not args.all_moves and normalize_move(move) != normalize_move(args.move):
                continue

            total += 1
            start_frame = int(lbl.get("startFrame", 0))
            start_time = float(lbl.get("startTime", 0.0))
            end_time = float(lbl.get("endTime", start_time))

            safe_move = move.replace(" ", "_").replace("/", "-")
            out_filename = f"{vid_id[:8]}_{idx:02d}_{safe_move}.mp4"
            out_path = OUT_DIR / out_filename

            print(f"  Exporting: {filename}  {start_time:.1f}s–{end_time:.1f}s  → {out_filename}")

            success = export_clip(video_path, landmarks_path, start_time, end_time, start_frame, out_path, move)
            if success:
                ok += 1
            else:
                failed += 1

    print(f"\nDone.  exported={ok}  failed={failed}  (total labeled segments matched={total})")
    if ok:
        print(f"Clips saved to: {OUT_DIR}")


if __name__ == "__main__":
    main()
