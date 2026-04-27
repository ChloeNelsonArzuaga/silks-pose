#!/usr/bin/env python3
"""
Extract MediaPipe Pose Landmarks (MediaPipe 0.10.x Tasks API)

Usage:
    python pipeline/extract_landmarks.py input_video.mov output_landmarks.json
    python pipeline/extract_landmarks.py input_video.mov output_landmarks.json --bg-subtract
"""

import sys
import json
import cv2
import urllib.request
import numpy as np
import mediapipe as mp
from pathlib import Path
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
MODEL_PATH = "models/pose_landmarker.task"

# Background subtractor settings
BG_WARMUP_FRAMES = 120   # frames used to learn the static background
BG_LEARN_RATE = 0.005    # very slow — prevents performer from being absorbed into bg
BG_DILATE_PX = 80        # pixels to expand the foreground mask (fills gaps around performer)


def download_model():
    try:
        open(MODEL_PATH, "rb")
    except FileNotFoundError:
        print("Downloading pose model...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Model downloaded.")


def build_bg_subtractor(video_path, warmup_frames):
    """Warm up a MOG2 subtractor on the first N frames to learn the static background."""
    cap = cv2.VideoCapture(video_path)
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


def get_fg_mask(frame, subtractor, dilate_px):
    """Compute foreground mask for a frame."""
    fg_mask = subtractor.apply(frame, learningRate=BG_LEARN_RATE)

    # Erode first to kill small blobs (flickering lights, noise)
    small_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (10, 10))
    fg_mask = cv2.erode(fg_mask, small_kernel, iterations=2)

    # Then dilate to fill gaps around the performer
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px, dilate_px))
    fg_mask = cv2.dilate(fg_mask, kernel, iterations=2)
    return fg_mask


def apply_fg_mask(frame, fg_mask):
    """Zero out background pixels in frame."""
    masked = frame.copy()
    masked[fg_mask == 0] = 0
    return masked


def fg_score(pose, fg_mask, h, w):
    """Count how many joints from this pose land in foreground pixels."""
    score = 0
    for lm in pose:
        px = max(0, min(w - 1, int(lm.x * w)))
        py = max(0, min(h - 1, int(lm.y * h)))
        if fg_mask[py, px] > 0:
            score += 1
    return score


def extract(video_path, output_path, bg_subtract=False, debug_frames=False):
    download_model()

    if bg_subtract:
        print("  Building background model...")
        subtractor = build_bg_subtractor(video_path, BG_WARMUP_FRAMES)

    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1
    )

    detector = vision.PoseLandmarker.create_from_options(options)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Cannot open video {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or None
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_idx = 0
    results_list = []

    progress = tqdm(total=total_frames, unit="frame", ncols=80, leave=False) if tqdm else None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        fg_mask = None
        masked_frame = frame

        # Save a few masked frames for debugging
        if debug_frames and frame_idx % 500 == 0:
            debug_dir = Path(output_path).parent / "debug_masked"
            debug_dir.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(debug_dir / f"frame_{frame_idx:05d}_masked.jpg"), masked_frame)
            if fg_mask is not None:
                cv2.imwrite(str(debug_dir / f"frame_{frame_idx:05d}_mask.jpg"), fg_mask)

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=masked_frame)

        timestamp_ms = int((frame_idx / fps) * 1000)
        result = detector.detect_for_video(mp_image, timestamp_ms)

        entry = {"frame": frame_idx, "landmarks": None}

        if result.pose_landmarks:
            landmarks = []
            for lm in result.pose_landmarks[0]:
                landmarks.append([
                    float(lm.x),
                    float(lm.y),
                    float(lm.z),
                    float(lm.visibility)
                ])
            entry["landmarks"] = landmarks

        results_list.append(entry)
        frame_idx += 1
        if progress:
            progress.update(1)

    if progress:
        progress.close()
    cap.release()
    detector.close()

    with open(output_path, "w") as f:
        json.dump(results_list, f)

    print(f"Saved landmarks to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pipeline/extract_landmarks.py input_video.mov output.json [--bg-subtract]")
    else:
        bg = "--bg-subtract" in sys.argv
        debug = "--debug" in sys.argv
        extract(sys.argv[1], sys.argv[2], bg_subtract=bg, debug_frames=debug)
