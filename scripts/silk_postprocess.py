

#!/usr/bin/env python3
"""
Silk-aware postprocessing.

Usage:
  python scripts/silk_postprocess.py data/landmarks/test_landmarks.json data/raw_videos/test.mov preprocessed_silk/

Outputs (in out_dir):
 - silk_min_distance.npy  (T, N)  normalized min distance [0..1]
 - silk_in_mask.npy       (T, N)  boolean: joint lies on silk mask
 - landmarks_masked.json  (optional) same format as input but with 'landmarks' set to None or reduced visibility for occluded joints
 - optionally: saves a few overlay thumbnails out_dir/overlay_*.jpg for checking masks
"""
import sys, json, math, os
from pathlib import Path
import numpy as np
import cv2

# This script performs postprocessing to identify pose joints occluded by silk.
# It computes silk masks, minimum distances, and flags occluded landmarks for downstream filtering.
# Outputs include diagnostic overlays and masked landmark files.

# --- HSV settings (auto-load from hsv_settings.json if present) ---
import json
from pathlib import Path

# default tuned safe values (will be overridden if hsv_settings.json exists)
_DEFAULT_HSV_LOWER = [5, 120, 120]
_DEFAULT_HSV_UPPER = [20, 255, 255]

# morphological kernel sizes (smaller by default for conservative masks)
KERNEL_CLOSE = (7, 7)
KERNEL_OPEN = (5, 5)

# pixel distance threshold (normalized) to treat as "in contact"
CONTACT_THRESHOLD_NORM = 0.035  # ~3.5% of image diagonal; tune if needed

# Try to load hsv settings written by hsv_tuner.py (hsv_settings.json)
HVS_JSON_PATH = Path("hsv_settings.json")
if HVS_JSON_PATH.exists():
    try:
        with open(HVS_JSON_PATH, "r") as _f:
            _j = json.load(_f)
        # Expect {"lower":[H,S,V], "upper":[H,S,V]}
        lower_list = _j.get("lower", _DEFAULT_HSV_LOWER)
        upper_list = _j.get("upper", _DEFAULT_HSV_UPPER)
        DEFAULT_HSV_LOWER = np.array([int(lower_list[0]), int(lower_list[1]), int(lower_list[2])], dtype=np.uint8)
        DEFAULT_HSV_UPPER = np.array([int(upper_list[0]), int(upper_list[1]), int(upper_list[2])], dtype=np.uint8)
        print(f"Loaded HSV settings from {HVS_JSON_PATH}: lower={DEFAULT_HSV_LOWER.tolist()} upper={DEFAULT_HSV_UPPER.tolist()}")
    except Exception as e:
        print("Failed to load hsv_settings.json; using defaults. Error:", e)
        DEFAULT_HSV_LOWER = np.array(_DEFAULT_HSV_LOWER, dtype=np.uint8)
        DEFAULT_HSV_UPPER = np.array(_DEFAULT_HSV_UPPER, dtype=np.uint8)
else:
    DEFAULT_HSV_LOWER = np.array(_DEFAULT_HSV_LOWER, dtype=np.uint8)
    DEFAULT_HSV_UPPER = np.array(_DEFAULT_HSV_UPPER, dtype=np.uint8)
    print(f"No hsv_settings.json found — using defaults lower={DEFAULT_HSV_LOWER.tolist()} upper={DEFAULT_HSV_UPPER.tolist()}")

def estimate_silk_mask_from_frame(frame_bgr, lower=DEFAULT_HSV_LOWER, upper=DEFAULT_HSV_UPPER):
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, lower, upper)
    # morphological cleanup
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones(KERNEL_CLOSE, np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones(KERNEL_OPEN, np.uint8))
    return mask.astype(bool)
    # Estimate silk mask from a BGR frame using HSV color thresholds.

def compute_min_distance_normalized(joint_xy, mask):
    # joint_xy in normalized coords (x,y). mask is (H,W) boolean
    H, W = mask.shape
    if H == 0 or W == 0:
        return 1.0
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return 1.0
    xs = xs.astype(float) / float(W)
    ys = ys.astype(float) / float(H)
    jx, jy = float(joint_xy[0]), float(joint_xy[1])
    d2 = (xs - jx)**2 + (ys - jy)**2
    md = math.sqrt(float(d2.min()))
    return md  # normalized by image size

def load_landmarks_json(path):
    data = json.load(open(path, 'r'))
    return data

def save_mask_overlay_frame(frame_bgr, mask_bool, outpath):
    overlay = frame_bgr.copy()
    # red-ish overlay where silk is
    red = np.zeros_like(frame_bgr)
    red[:,:,2] = 255
    alpha = 0.5
    overlay[mask_bool] = cv2.addWeighted(frame_bgr[mask_bool], 1-alpha, red[mask_bool], alpha, 0)
    cv2.imwrite(str(outpath), overlay)

def run(landmarks_json_path, video_path, out_dir,
        hsv_lower=DEFAULT_HSV_LOWER, hsv_upper=DEFAULT_HSV_UPPER,
        save_masks=False, mask_save_limit=10, occlude_strategy='set_nan'):
    """
    occlude_strategy: 'set_nan' -> set occluded joint coords to None in output json
                     'reduce_vis' -> multiply visibility by 0.2 for joints in silk
                     'leave' -> do not change landmarks (only compute distances)
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = load_landmarks_json(landmarks_json_path)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video {video_path}")

    T = len(data)
    # find N (landmark count)
    first = next((d for d in data if d.get('landmarks') is not None), None)
    if first is None:
        raise RuntimeError("No landmarks present in JSON")
    N = len(first['landmarks'])

    silk_min_dist = np.ones((T, N), dtype=float)
    silk_in_mask = np.zeros((T, N), dtype=bool)

    saved_masks = 0
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx >= T:
            break

        rec = data[frame_idx]
        lms = rec.get('landmarks')  # list of [x,y,z,vis] or None

        mask = estimate_silk_mask_from_frame(frame, lower=hsv_lower, upper=hsv_upper)

        if save_masks and saved_masks < mask_save_limit:
            save_mask_overlay_frame(frame, mask, out_dir / f"overlay_{frame_idx:04d}.jpg")
            saved_masks += 1

        if lms is None:
            # keep defaults: silk_min_dist=1 and silk_in_mask False
            frame_idx += 1
            continue

        # prepare list of normalized (x,y)
        joint_xy = [(float(x), float(y)) for x,y,z,v in lms]

        for i, (x,y) in enumerate(joint_xy):
            # if NaNs or 0/0, skip gracefully
            if x is None:
                silk_min_dist[frame_idx, i] = 1.0
                silk_in_mask[frame_idx, i] = False
                continue
            # compute min distance normalized
            md = compute_min_distance_normalized((x,y), mask)
            silk_min_dist[frame_idx, i] = md
            silk_in_mask[frame_idx, i] = (md <= CONTACT_THRESHOLD_NORM)

            # optionally modify visibility or coords in data
            if silk_in_mask[frame_idx, i]:
                if occlude_strategy == 'set_nan':
                    # set the landmarks entry to None so downstream treats as missing
                    # we keep structure but set x,y,z to null
                    data[frame_idx]['landmarks'][i] = [None, None, None, 0.0]
                elif occlude_strategy == 'reduce_vis':
                    # reduce visibility
                    old = data[frame_idx]['landmarks'][i]
                    data[frame_idx]['landmarks'][i][3] = float(old[3]) * 0.2
                # 'leave' -> do nothing

        frame_idx += 1

    cap.release()

    # Save features
    np.save(out_dir / "silk_min_distance.npy", silk_min_dist)
    np.save(out_dir / "silk_in_mask.npy", silk_in_mask.astype(np.uint8))
    if occlude_strategy in ('set_nan','reduce_vis'):
        # write updated json with occluded joints adjusted
        with open(out_dir / "landmarks_masked.json", "w") as f:
            json.dump(data, f)
    if save_masks:
        # optionally save full masks array - big if T large; saved as uint8
        # To keep memory low, we saved only overlay thumbnails earlier
        pass

    # Save quick diagnostics
    total_contacts = int(silk_in_mask.sum())
    with open(out_dir / "diagnostics.txt", "w") as f:
        f.write(f"T={T}, N={N}\n")
        f.write(f"total_contacts={total_contacts}\n")
        f.write(f"contact_threshold_norm={CONTACT_THRESHOLD_NORM}\n")
        f.write("Note: 'landmarks_masked.json' will have occluded joints set to [None,None,None,0.0] if occlude_strategy='set_nan'\n")

    print("Done. Saved silk features to", out_dir)
    print("Total contacts (joint frames inside silk):", total_contacts)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python scripts/silk_postprocess.py landmarks.json input_video.mov out_dir")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2], sys.argv[3])