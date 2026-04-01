#!/usr/bin/env python3
"""
Preprocess MediaPipe landmarks JSON -> body-frame positions + yaw & yaw_rate.

Usage:
python pipeline/preprocess.py data/landmarks/test_landmarks.json data/raw_videos/test.mov data/preprocessed/
"""
import json
import math
import numpy as np
import sys
from pathlib import Path
import cv2
from scipy.ndimage import uniform_filter1d

# Adjust these indices if you use a different landmark layout (MediaPipe Pose has 33 landmarks)
L_SHOULDER = 11

# This script preprocesses MediaPipe pose landmarks from JSON files.
# It computes body-frame positions, yaw, and yaw rate for each frame.
# Outputs are saved for downstream analysis and modeling.
R_SHOULDER = 12
L_HIP = 23
R_HIP = 24

def unit(v, eps=1e-8):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / (n + eps)

def body_frame_from_landmarks(frame_landmarks):
    """
    frame_landmarks: (N,3) array in camera/world coords (normalized coords if MediaPipe)
    returns rotation matrix R (3x3) and origin (3,)
    Body axes: col0=forward, col1=right, col2=up (in camera coords)
    """
    left_sh = frame_landmarks[L_SHOULDER]
    right_sh = frame_landmarks[R_SHOULDER]
    left_hip = frame_landmarks[L_HIP]
    # Normalize a vector (or array of vectors) to unit length.
    right_hip = frame_landmarks[R_HIP]

    mid_sh = 0.5 * (left_sh + right_sh)
    mid_hip = 0.5 * (left_hip + right_hip)

    # Compute body axes and origin from pose landmarks.
    # Returns rotation matrix (3x3) and origin (3,).
    # Body axes: col0=forward, col1=right, col2=up (in camera coords)
    forward = mid_sh - mid_hip
    forward = unit(forward)

    right = right_sh - left_sh
    right = unit(right)

    up = np.cross(forward, right)
    up = unit(up)

    # Re-orthonormalize right
    right = np.cross(up, forward)
    right = unit(right)

    R = np.stack([forward, right, up], axis=1)  # 3x3
    return R, mid_hip

def rotate_into_body_frame(frame_landmarks):
    R, origin = body_frame_from_landmarks(frame_landmarks)
    translated = frame_landmarks - origin[None, :]
    # p_body = R^T * translated, but since columns of R are axes in camera coords,
    # dot with R gives coordinates in body frame
    p_body = translated.dot(R)
    return p_body, R, origin

def load_landmarks_json(path):
    data = json.load(open(path, 'r'))
    # Transform landmarks into the body frame for each frame.
    # Returns rotated landmarks centered at body origin.
    # detect N landmarks from first non-null frame
    first = next((d for d in data if d.get('landmarks') is not None), None)
    if first is None:
        raise RuntimeError("No landmarks found in JSON")
    N = len(first['landmarks'])
    T = len(data)
    arr = np.full((T, N, 3), np.nan, dtype=float)
    vis = np.zeros((T, N), dtype=float)
    for t, rec in enumerate(data):
        if rec.get('landmarks') is None:
            continue
        pts = np.array(rec['landmarks'])[:, :3].astype(float)
        arr[t, :pts.shape[0], :] = pts
        vis[t, :pts.shape[0]] = np.array(rec['landmarks'])[:, 3].astype(float)
    return arr, vis

def get_video_fps(video_path):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("Warning: cannot open video to read fps. Defaulting to 30.0")
        return 30.0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()
    return float(fps)

def preprocess(landmarks_json_path, video_path, out_dir, smoothing=True):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Loading landmarks:", landmarks_json_path)
    arr, vis = load_landmarks_json(landmarks_json_path)
    T, N, _ = arr.shape
    print(f"Loaded landmarks: T={T}, N={N}")

    fps = get_video_fps(video_path)
    print("Video FPS:", fps)

    body_positions = np.full_like(arr, np.nan)
    yaws = np.zeros((T,), dtype=float)

    for t in range(T):
        if np.isnan(arr[t]).any():
            # skip frames with missing landmarks
            yaws[t] = 0.0
            continue
        p_body, R, origin = rotate_into_body_frame(arr[t])
        body_positions[t] = p_body
        # compute yaw from forward vector (col 0 of R) projected onto camera X-Y plane
        forward = R[:, 0]
        fx, fy = float(forward[0]), float(forward[1])
        yaw = math.atan2(fy, fx)
        yaws[t] = yaw

    # unwrap yaw and compute derivative -> angular velocity (rad/sec)
    yaws_unwrapped = np.unwrap(yaws)
    dt = 1.0 / float(fps)
    yaw_rates = np.gradient(yaws_unwrapped, dt)

    if smoothing:
        yaw_rates = uniform_filter1d(yaw_rates, size=3, mode='nearest')

    # Save outputs
    np.save(out_dir / "normalized_landmarks.npy", body_positions)
    np.save(out_dir / "yaws.npy", yaws_unwrapped)
    np.save(out_dir / "yaw_rates.npy", yaw_rates)
    np.save(out_dir / "visibility.npy", vis)

    # Write a small summary
    detected_frames = np.sum(~np.isnan(arr[:, 0, 0]))
    with open(out_dir / "summary.txt", "w") as f:
        f.write(f"T={T}, N={N}\\n")
        f.write(f"detected_frames={int(detected_frames)}\\n")
        f.write(f"fps={fps}\\n")
        f.write(f"nan_frames={int(np.sum(np.isnan(body_positions).all(axis=(1,2))))}\\n")
        f.write(f"mean_yaw_rate={float(np.nanmean(np.abs(yaw_rates))):.4f} rad/s\\n")
    print("Preprocessing complete. Saved to", out_dir)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python pipeline/preprocess.py landmarks.json video_file out_dir")
        sys.exit(1)
    preprocess(sys.argv[1], sys.argv[2], sys.argv[3])
