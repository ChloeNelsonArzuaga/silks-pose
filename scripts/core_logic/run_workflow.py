#!/usr/bin/env python3
"""
Automated workflow script to run the full pose detection pipeline with comparison visualizations.

Usage:
    python scripts/core_logic/run_workflow.py input_video.mov output_prefix

This script will:
1. Extract pose landmarks from the video
2. Preprocess landmarks
3. Perform silk postprocessing and filtering
4. Generate visualization for unfiltered landmarks
5. Generate visualization for filtered landmarks
"""
import sys
import subprocess
from pathlib import Path

def run_command(cmd, description):
    """Run a command and report status."""
    print(f"\n{'='*60}")
    print(f"[STEP] {description}")
    print(f"{'='*60}")
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent.parent)
    if result.returncode != 0:
        print(f"[ERROR] {description} failed with exit code {result.returncode}")
        sys.exit(1)
    print(f"[SUCCESS] {description} completed")

def main(video_path, output_prefix):
    video_path = Path(video_path)
    output_prefix = Path(output_prefix)
    
    if not video_path.exists():
        print(f"[ERROR] Video file not found: {video_path}")
        sys.exit(1)
    
    # Define output paths
    landmarks_json = Path("data/landmarks") / f"{output_prefix.name}_landmarks.json"
    landmarks_json.parent.mkdir(parents=True, exist_ok=True)
    
    preprocessed_dir = Path("preprocessed") / output_prefix.name
    preprocessed_dir.mkdir(parents=True, exist_ok=True)
    
    silk_dir = Path("preprocessed_silk") / output_prefix.name
    silk_dir.mkdir(parents=True, exist_ok=True)
    
    visualized_dir = Path("data/visualized") / output_prefix.name
    visualized_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Extract landmarks
    run_command(
        ["python", "scripts/core_logic/extract_landmarks.py", str(video_path), str(landmarks_json)],
        "Extract pose landmarks from video"
    )
    
    # Step 2: Preprocess landmarks
    run_command(
        ["python", "scripts/core_logic/preprocess.py", str(landmarks_json), str(video_path), str(preprocessed_dir)],
        "Preprocess landmarks (body frame, yaw, yaw rate)"
    )
    
    # Step 3: Silk postprocessing and filtering
    run_command(
        ["python", "scripts/core_logic/silk_process.py", str(landmarks_json), str(video_path), str(silk_dir), "--filter"],
        "Postprocess and filter silk-occluded landmarks"
    )
    
    # Step 4: Visualize unfiltered landmarks
    unfiltered_vis = visualized_dir / "unfiltered"
    run_command(
        ["python", "scripts/core_logic/visualize.py", str(landmarks_json), str(video_path), str(unfiltered_vis), "--mask"],
        "Generate unfiltered visualization (with silk mask overlay)"
    )
    
    # Step 5: Visualize filtered landmarks
    filtered_landmarks = silk_dir / "landmarks_masked.json"
    filtered_vis = visualized_dir / "filtered"
    run_command(
        ["python", "scripts/core_logic/visualize.py", str(filtered_landmarks), str(video_path), str(filtered_vis), "--mask", "--masked"],
        "Generate filtered visualization (with occlusion-aware coloring)"
    )
    
    print(f"\n{'='*60}")
    print("[COMPLETE] Full workflow finished!")
    print(f"{'='*60}")
    print(f"\nOutputs generated in: data/visualized/{output_prefix.name}/")
    print(f"  - unfiltered/ : Original landmarks with silk mask overlay")
    print(f"  - filtered/   : Filtered landmarks with occlusion-aware coloring")
    print(f"\nPreprocessed data:")
    print(f"  - {preprocessed_dir}")
    print(f"  - {silk_dir}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/core_logic/run_workflow.py input_video.mov output_prefix")
        print("Example: python scripts/core_logic/run_workflow.py data/raw_videos/test.mov test")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
