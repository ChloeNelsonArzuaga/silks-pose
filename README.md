# Silks Pose Project

This repository contains scripts and data for pose landmark extraction, filtering, preprocessing, and visualization in silk aerial videos using MediaPipe and OpenCV.

## File Summaries

### scripts/
- **extract_landmarks.py**: Extracts pose landmarks from a video using MediaPipe's Pose Landmarker. Downloads the model if needed, processes each frame, and saves results to a JSON file.
- **hsv_tuner.py**: Interactive tool for tuning HSV color thresholds for silk masking. Loads a video, allows frame selection, and lets you adjust HSV sliders. Saves settings to `hsv_settings.json`.
- **preprocess.py**: Preprocesses MediaPipe pose landmarks from JSON files. Computes body-frame positions, yaw, and yaw rate for each frame. Outputs are saved for downstream analysis and modeling.
- **silk_filter.py**: Flags pose landmarks likely occluded by silk using spatial, temporal, and color-based heuristics. Outputs filtered landmarks and stats for training.
- **silk_postprocess.py**: Performs postprocessing to identify pose joints occluded by silk. Computes silk masks, minimum distances, and flags occluded landmarks. Outputs diagnostic overlays and masked landmark files.
- **test_env.py**: Checks that all required libraries (OpenCV, MediaPipe, Torch, NumPy) are installed and prints their versions. Use to verify your Python environment.
- **visualize_landmarks.py**: Overlays pose landmarks on video frames and saves the annotated video. Draws connections and keypoints, using visibility to adjust brightness. Useful for visual inspection of pose detection results.
- **visualize_masked_landmarks.py**: Overlays pose landmarks and silk mask on video frames for visual inspection. Loads HSV settings, generates masks, and draws occluded joints differently. Useful for debugging silk occlusion and landmark filtering.

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
1. Extract landmarks from video.
2. Tune HSV mask for silk.
3. Preprocess landmarks.
4. Filter silk-occluded joints.
5. Visualize results.

## Requirements
See `requirements.txt` for dependencies.

## License
[Specify your license here]
