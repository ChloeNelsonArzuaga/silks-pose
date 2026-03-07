

#!/usr/bin/env python3
"""
Visualize MediaPipe landmarks on video frames and save an annotated video.

Usage:
    python scripts/visualize_landmarks.py landmarks.json input_video.mov out_prefix

Example:
    python scripts/visualize_landmarks.py data/landmarks/test_landmarks.json data/raw_videos/test.mov data/visualized/test

This will produce:
 - data/visualized/test_annotated.mp4
 - a few thumbnail frames data/visualized/test_frame_00001.jpg ...
"""
import sys
import json
from pathlib import Path
import cv2
import numpy as np

# Minimal list of pairs for drawing connections (MediaPipe Pose 33-landmark indices)
POSE_CONNECTIONS = [
    (11,12),(11,13),(13,15),(12,14),(14,16),  # shoulders -> arms
    (11,23),(12,24),(23,24),                   # shoulders -> hips

# This script overlays pose landmarks on video frames and saves the annotated video.
# It draws connections and keypoints, using visibility to adjust brightness.
# Useful for visual inspection of pose detection results.
    (23,25),(24,26),(25,27),(26,28),           # hips -> legs
    (15,17),(16,18),(17,19),(18,20)            # arms (elbows->wrists->hands)
    # This is a reduced subset; add more if you want full skeleton
]

def draw_landmarks_on_frame(frame, landmarks, visibility, color=(0,255,0), radius=4, alpha=0.9):
    """Draw landmarks (normalized coords) on frame (BGR). landmarks: list of [x,y,z] """
    h, w = frame.shape[:2]
    overlay = frame.copy()
    # draw connections
    for a,b in POSE_CONNECTIONS:
        if a < len(landmarks) and b < len(landmarks):
            xa, ya = landmarks[a][0]*w, landmarks[a][1]*h
            xb, yb = landmarks[b][0]*w, landmarks[b][1]*h
            # skip lines if either point is out of range
            if 0 <= xa < w and 0 <= ya < h and 0 <= xb < w and 0 <= yb < h:
                cv2.line(overlay, (int(xa),int(ya)), (int(xb),int(yb)), color, 2)

    # Draw pose landmarks and connections on a video frame.
    # landmarks: list of [x,y,z] normalized coordinates
    # visibility: list of visibility scores for each landmark
    # color: BGR color for keypoints and lines
    # radius: circle radius for keypoints
    # alpha: blending factor for overlay
    # draw keypoints with visibility controlling brightness
    for i, lm in enumerate(landmarks):
        if lm is None:
            continue
        x, y = int(lm[0]*w), int(lm[1]*h)
        vis = visibility[i] if visibility is not None and i < len(visibility) else 1.0
        if 0 <= x < w and 0 <= y < h:
            col = (int(color[0]*vis), int(color[1]*vis), int(color[2]*vis))
            cv2.circle(overlay, (x,y), radius, col, -1)
            # optional small outline
            cv2.circle(overlay, (x,y), radius, (0,0,0), 1)

    # blend overlay
    cv2.addWeighted(overlay, alpha, frame, 1-alpha, 0, frame)
    return frame

def main(landmarks_json_path, video_path, out_prefix):
    landmarks_json_path = Path(landmarks_json_path)
    video_path = Path(video_path)
    out_prefix = Path(out_prefix)
    out_dir = out_prefix.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    # load landmarks
    with open(landmarks_json_path, 'r') as f:
        data = json.load(f)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("Error: cannot open video:", video_path)
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_video_path = str(out_prefix) + "_annotated.mp4"
    writer = cv2.VideoWriter(out_video_path, fourcc, fps, (w,h))

    thumbnails_saved = 0
    t = 0
    total = len(data)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if t < total:
            rec = data[t]
            lms = rec.get("landmarks")
            if lms:
                # lms: list of [x,y,z,visibility]
                landmarks = [[float(x), float(y), float(z)] for x,y,z,_ in lms]
                visibility = [float(v) for *_, v in lms]  # requires Python3.8 unpacking; fallback below
            else:
                landmarks = None
                visibility = None
        else:
            landmarks = None
            visibility = None

        # draw
        if landmarks:
            frame = draw_landmarks_on_frame(frame, landmarks, visibility, color=(0,200,255), radius=4, alpha=0.9)

        # overlay text (frame idx / detection status)
        det_text = "detected" if landmarks else "no-detect"
        cv2.putText(frame, f"frame {t} / {total} - {det_text}", (8, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2, cv2.LINE_AA)

        writer.write(frame)

        # save a few thumbnails early for quick inspection
        if thumbnails_saved < 5 and t % max(1, int(fps/2)) == 0:
            thumb_path = str(out_prefix) + f"_frame_{t:05d}.jpg"
            cv2.imwrite(thumb_path, frame)
            thumbnails_saved += 1

        t += 1

    cap.release()
    writer.release()
    print("Annotated video saved to:", out_video_path)
    print("Saved thumbnails:", thumbnails_saved)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python scripts/visualize_landmarks.py landmarks.json input_video.mov out_prefix")
    else:
        main(sys.argv[1], sys.argv[2], sys.argv[3])