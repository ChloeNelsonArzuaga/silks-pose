
#!/usr/bin/env python3
"""
Extract MediaPipe Pose Landmarks (MediaPipe 0.10.x Tasks API)

Usage:
python scripts/extract_landmarks.py input_video.mov output_landmarks.json
"""

# This script extracts pose landmarks from a video using MediaPipe's Pose Landmarker.
# It downloads the model if not present, processes each frame, and saves results to a JSON file.

import sys
import json
import cv2
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# MediaPipe pose model URL
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
MODEL_PATH = "pose_landmarker.task"


def download_model():
    """Download the MediaPipe pose model if not already present locally."""
    try:
        open(MODEL_PATH, "rb")
    except FileNotFoundError:
        print("Downloading pose model...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Model downloaded.")


def extract(video_path, output_path):
    """
    Extract pose landmarks from a video and save to output_path as JSON.
    video_path: path to input video file
    output_path: path to output JSON file
    """
    download_model()

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
    frame_idx = 0
    results_list = []

    # Process each frame in the video
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=frame
        )

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

    cap.release()
    detector.close()

    with open(output_path, "w") as f:
        json.dump(results_list, f)

    print(f"Saved landmarks to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/extract_landmarks.py input_video.mov output.json")
    else:
        extract(sys.argv[1], sys.argv[2])