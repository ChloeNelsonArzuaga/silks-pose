"""
Shared utility functions for landmark processing, mask generation, and visualization.
"""
import json
from pathlib import Path
import cv2
import numpy as np

def load_landmarks_json(path):
    with open(path, 'r') as f:
        return json.load(f)

def load_hsv_settings(path=Path("config/hsv_settings.json")):
    if path.exists():
        j = json.load(open(path))
        lower = np.array(j.get("lower", [8, 150, 150]), dtype=np.uint8)
        upper = np.array(j.get("upper", [18, 255, 255]), dtype=np.uint8)
        return lower, upper
    return np.array([8, 150, 150], np.uint8), np.array([18, 255, 255], np.uint8)

def make_mask_for_frame(frame, lower, upper, kernel_close=(7,7), kernel_open=(5,5)):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, lower, upper)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones(kernel_close, np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones(kernel_open, np.uint8))
    return m.astype(bool)

def draw_mask_overlay(frame, mask, color_fill=(0,255,0), contour_color=(255,0,0)):
    dark = (frame * 0.35).astype(np.uint8)
    highlight = frame.copy()
    highlight[mask] = color_fill
    combined = dark.copy()
    combined[mask] = highlight[mask]
    contours, _ = cv2.findContours(mask.astype(np.uint8)*255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(combined, contours, -1, contour_color, 2)
    return combined

def draw_landmarks(frame, landmarks, visibilities=None, draw_connections=True,
                   point_color=(0,200,255), occluded_color=(50,50,50),
                   vis_thresh=0.1, pose_connections=None):
    h, w = frame.shape[:2]
    if draw_connections and pose_connections:
        for a, b in pose_connections:
            if a < len(landmarks) and b < len(landmarks):
                la = landmarks[a]
                lb = landmarks[b]
                if la is None or lb is None:
                    continue
                va = visibilities[a] if visibilities is not None and a < len(visibilities) else 1.0
                vb = visibilities[b] if visibilities is not None and b < len(visibilities) else 1.0
                if va < vis_thresh or vb < vis_thresh:
                    continue
                xa, ya = int(la[0]*w), int(la[1]*h)
                xb, yb = int(lb[0]*w), int(lb[1]*h)
                cv2.line(frame, (xa, ya), (xb, yb), point_color, 2)
    for i, lm in enumerate(landmarks):
        if lm is None:
            continue
        x, y = int(lm[0]*w), int(lm[1]*h)
        v = visibilities[i] if visibilities is not None and i < len(visibilities) else 1.0
        if v < vis_thresh:
            cv2.circle(frame, (x, y), 5, occluded_color, -1)
        else:
            cv2.circle(frame, (x, y), 5, point_color, -1)
            cv2.circle(frame, (x, y), 6, (0,0,0), 1)
