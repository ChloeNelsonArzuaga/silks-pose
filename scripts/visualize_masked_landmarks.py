

#!/usr/bin/env python3
"""
Visualize masked landmarks together with the silk mask.

Usage:
    python scripts/visualize_masked_landmarks.py preprocessed_silk/landmarks_masked.json data/raw_videos/test.mov data/visualized/test_masked

If landmarks_masked.json doesn't exist, pass the original landmarks.json instead.
This script will try to read hsv_settings.json in repo root to recreate the silk mask overlay.
"""
import sys
import json
from pathlib import Path
import cv2
import numpy as np

# a compact set of pose connections (MediaPipe-ish indices)
POSE_CONNECTIONS = [
    (11,12),(11,13),(13,15),(12,14),(14,16),
    (11,23),(12,24),(23,24),
    (23,25),(24,26),(25,27),(26,28),
    (15,17),(16,18),(17,19),(18,20)
]


# This script overlays pose landmarks and silk mask on video frames for visual inspection.
# It loads HSV settings, generates masks, and draws occluded joints differently.
# Useful for debugging silk occlusion and landmark filtering.
def load_hsv_settings(path=Path("hsv_settings.json")):
    if path.exists():
        j = json.load(open(path))
        lower = np.array(j.get("lower",[8,150,150]), dtype=np.uint8)
        upper = np.array(j.get("upper",[18,255,255]), dtype=np.uint8)
        return lower, upper
    # sensible fallback
    return np.array([8,150,150], np.uint8), np.array([18,255,255], np.uint8)

def make_mask_for_frame(frame, lower, upper, kernel_close=(7,7), kernel_open=(5,5)):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, lower, upper)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones(kernel_close, np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones(kernel_open, np.uint8))
    return m.astype(bool)

def draw_mask_overlay(frame, mask, color_fill=(0,255,0), contour_color=(255,0,0)):
     # Load HSV color thresholds from settings file or use defaults.
    dark = (frame * 0.35).astype(np.uint8)
    highlight = frame.copy()
    highlight[mask] = color_fill
    combined = dark.copy()
    combined[mask] = highlight[mask]
    # contours
    contours, _ = cv2.findContours(mask.astype(np.uint8)*255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(combined, contours, -1, contour_color, 2)
    return combined

     # Generate silk mask for a frame using HSV thresholds and morphological operations.
def draw_landmarks(frame, landmarks, visibilities=None, draw_connections=True,
                   point_color=(0,200,255), occluded_color=(50,50,50),
                   vis_thresh=0.1):
    h,w = frame.shape[:2]
    # draw connections first (only if both endpoints visible)
    if draw_connections:
        for a,b in POSE_CONNECTIONS:
            if a < len(landmarks) and b < len(landmarks):
     # Draw silk mask overlay and contours on a video frame.
                la = landmarks[a]
                lb = landmarks[b]
                if la is None or lb is None:
                    continue
                # visibility check
                va = visibilities[a] if visibilities is not None and a < len(visibilities) else 1.0
                vb = visibilities[b] if visibilities is not None and b < len(visibilities) else 1.0
                if va < vis_thresh or vb < vis_thresh:
                    continue
                xa,ya = int(la[0]*w), int(la[1]*h)
                xb,yb = int(lb[0]*w), int(lb[1]*h)
                cv2.line(frame, (xa,ya), (xb,yb), point_color, 2)
    # draw points
    for i, lm in enumerate(landmarks):
     # Draw pose landmarks and connections, coloring occluded joints differently.
        if lm is None:
            continue
        x,y = int(lm[0]*w), int(lm[1]*h)
        v = visibilities[i] if visibilities is not None and i < len(visibilities) else 1.0
        if v < vis_thresh:
            cv2.circle(frame, (x,y), 5, occluded_color, -1)
        else:
            cv2.circle(frame, (x,y), 5, point_color, -1)
            cv2.circle(frame, (x,y), 6, (0,0,0), 1)

def read_landmark_file(path):
    data = json.load(open(path, 'r'))
    return data

def main(landmark_json_path, video_path, out_prefix):
    landmark_json_path = Path(landmark_json_path)
    video_path = Path(video_path)
    out_prefix = Path(out_prefix)
    out_dir = out_prefix.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    # load landmarks (masked if present)
    data = read_landmark_file(str(landmark_json_path))
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("Error: cannot open video", video_path)
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    lower, upper = load_hsv_settings()
    print("Using HSV lower,upper:", lower.tolist(), upper.tolist())

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_video = str(out_prefix) + "_annotated_masked.mp4"
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
            # landmarks may have None entries (masked). convert to list of [x,y,z] or None
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

        # make mask for this frame
        mask = make_mask_for_frame(frame, lower, upper)
        # draw overlay but keep landmarks readable
        annotated = draw_mask_overlay(frame.copy(), mask, color_fill=(0,200,0), contour_color=(255,0,0))
        # draw landmarks on top
        if lms:
            draw_landmarks(annotated, lms, visibilities=vis, vis_thresh=0.15)

        # overlay info text
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
    if len(sys.argv) < 4:
        print("Usage: python scripts/visualize_masked_landmarks.py landmarks_masked.json input_video.mov out_prefix")
    else:
        main(sys.argv[1], sys.argv[2], sys.argv[3])