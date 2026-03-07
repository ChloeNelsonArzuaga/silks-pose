# Silks Pose Project

This repository contains scripts and data for pose landmark extraction, filtering, preprocessing, and visualization in silk aerial videos using MediaPipe and OpenCV.

## File Summaries

### scripts/core_logic/
Main workflow scripts:
- **extract_landmarks.py**: Extracts pose landmarks from a video using MediaPipe's Pose Landmarker. Downloads the model if needed, processes each frame, and saves results to a JSON file.
- **preprocess.py**: Preprocesses MediaPipe pose landmarks from JSON files. Computes body-frame positions, yaw, and yaw rate for each frame. Outputs are saved for downstream analysis and modeling.
- **silk_process.py**: Unified postprocessing and filtering for silk occlusion. Computes silk masks, minimum distances, flags occluded landmarks, and outputs diagnostic overlays and masked landmark files.
- **visualize.py**: Unified visualization script for pose landmarks and silk mask overlays. Supports occlusion-aware coloring and mask overlays.

### scripts/utility_testing/
Support, utility, and testing scripts:
- **utils.py**: Shared utility functions for landmark loading, mask generation, and drawing.
- **hsv_tuner.py**: Interactive tool for tuning HSV color thresholds for silk masking. Loads a video, allows frame selection, and lets you adjust HSV sliders. Saves settings to `hsv_settings.json`.
- **test_env.py**: Checks that all required libraries (OpenCV, MediaPipe, Torch, NumPy) are installed and prints their versions. Use to verify your Python environment.
### data/
- **landmarks/**: Contains JSON files with extracted pose landmarks.
- **raw_videos/**: Original input videos.
- **processed/**: Processed video and landmark data.
- **visualized/**: Output videos and images with visualized landmarks.

### preprocessed/
- Contains numpy arrays and summary files for normalized landmarks, visibility, yaw rates, and yaws.

### preprocessed_silk*, preprocessed_filtered/
- Contains diagnostic files, masked landmarks, and silk occlusion data for further analysis and training.

### models/
- Directory for model files and related assets.

### notebooks/
- Jupyter notebooks for exploration and analysis.

## Usage
See each script's header for usage instructions. Typical workflow:
1. Extract landmarks from video (`core_logic/extract_landmarks.py`).
2. Tune HSV mask for silk (`utility_testing/hsv_tuner.py`).
3. Preprocess landmarks (`core_logic/preprocess.py`).
4. Silk postprocessing/filtering (`core_logic/silk_process.py`).
5. Visualize results (`core_logic/visualize.py`).

## Requirements
See `requirements.txt` for dependencies.

## License
[Specify your license here]
