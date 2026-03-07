#!/usr/bin/env python3
"""
Unified visualization script for pose landmarks and silk mask overlays.

Usage:
    python scripts/visualize.py landmarks.json input_video.mov out_prefix [--mask] [--masked]

Options:
    --mask      Overlay silk mask on frames
    --masked    Use occlusion-aware landmark coloring (for masked landmarks)

Examples:
    python scripts/visualize.py data/landmarks/test_landmarks.json data/raw_videos/test.mov data/visualized/test
    python scripts/visualize.py preprocessed_silk/landmarks_masked.json data/raw_videos/test.mov data/visualized/test_masked --mask --masked
"""
import sys
import json
from pathlib import Path
import cv2
import numpy as np
from utils import load_landmarks_json, load_hsv_settings, make_mask_for_frame, draw_mask_overlay, draw_landmarks

POSE_CONNECTIONS = [
    (11,12),(11,13),(13,15),(12,14),(14,16),
    (11,23),(12,24),(23,24),
    (23,25),(24,26),(25,27),(26,28),
    (15,17),(16,18),(17,19),(18,20)
]

def main(landmarks_json_path, video_path, out_prefix, overlay_mask=False, masked_landmarks=False):
    landmark_json_path = Path(landmarks_json_path)
    video_path = Path(video_path)
    out_prefix = Path(out_prefix)
    out_dir = out_prefix.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    data = load_landmarks_json(str(landmark_json_path))
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("Error: cannot open video", video_path)
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    lower, upper = load_hsv_settings()
    if overlay_mask:
        print("Using HSV lower,upper:", lower.tolist(), upper.tolist())

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_video = str(out_prefix) + "_annotated.mp4"
    writer = cv2.VideoWriter(out_video, fourcc, fps, (w,h))

    t = 0
    thumbnails_saved = 0
    total = len(data)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        rec = data[t] if t < total else None
        lms = None
        vis = None
        if rec and rec.get("landmarks"):
            lms_raw = rec.get("landmarks")
            lms = []
            vis = []
            for j in lms_raw:
                if j is None or (isinstance(j, list) and j[0] is None):
                    lms.append(None)
                    vis.append(0.0)
                else:
                    x,y,z,v = j
                    lms.append([float(x), float(y), float(z)])
                    vis.append(float(v))
        else:
            lms = None
            vis = None

        annotated = frame.copy()
        if overlay_mask:
            mask = make_mask_for_frame(frame, lower, upper)
            annotated = draw_mask_overlay(annotated, mask, color_fill=(0,200,0), contour_color=(255,0,0))

        if lms:
            draw_landmarks(annotated, lms, visibilities=vis, vis_thresh=0.15 if masked_landmarks else 0.1,
                           pose_connections=POSE_CONNECTIONS,
                           point_color=(0,200,255), occluded_color=(50,50,50))

        det_text = "detected" if (lms and any(x is not None for x in lms)) else "no-detect"
        cv2.putText(annotated, f"frame {t} / {total} - {det_text}", (8, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2, cv2.LINE_AA)

        writer.write(annotated)

        if thumbnails_saved < 6 and t % max(1, int(fps/2)) == 0:
            thumb_path = str(out_prefix) + f"_frame_{t:05d}.jpg"
            cv2.imwrite(thumb_path, annotated)
            thumbnails_saved += 1

        t += 1
        if t >= total:
            break

    cap.release()
    writer.release()
    print("Saved annotated video to:", out_video)
    print("Saved thumbnails:", thumbnails_saved)

if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 3:
        print("Usage: python scripts/visualize.py landmarks.json input_video.mov out_prefix [--mask] [--masked]")
        sys.exit(1)
    overlay_mask = '--mask' in args
    masked_landmarks = '--masked' in args
    # Remove flags from args
    args = [a for a in args if not a.startswith('--')]
    main(args[0], args[1], args[2], overlay_mask=overlay_mask, masked_landmarks=masked_landmarks)
