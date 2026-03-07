#!/usr/bin/env python3
"""
Unified silk postprocessing and filtering script.

Usage:
  python scripts/silk_process.py landmarks.json video.mov out_dir [--filter]

Options:
  --filter    Apply filtering heuristics after postprocessing (flags unreliable joints)

Outputs:
 - silk_min_distance.npy  (T, N)  normalized min distance [0..1]
 - silk_in_mask.npy       (T, N)  boolean: joint lies on silk mask
 - landmarks_masked.json  (optional) occlusion-aware landmarks
 - landmarks_for_training.json (optional, if --filter)
 - diagnostics.txt
"""
import sys, json, math
from pathlib import Path
import numpy as np
import cv2
from utils import load_landmarks_json, load_hsv_settings, make_mask_for_frame

CONTACT_THRESHOLD_NORM = 0.035
NEIGHBORS = {
    15: [13], 16: [14], 13: [11,15], 14: [12,16],
    11: [13,23], 12: [14,24],
    23: [11,25], 24: [12,26],
    25: [23,27], 26: [24,28],
    27: [25], 28: [26]
}

def compute_min_distance_normalized(joint_xy, mask):
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
    return md

def run_postprocess(landmarks_json_path, video_path, out_dir, filter=False):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    data = load_landmarks_json(landmarks_json_path)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video {video_path}")
    T = len(data)
    first = next((d for d in data if d.get('landmarks') is not None), None)
    if first is None:
        raise RuntimeError("No landmarks present in JSON")
    N = len(first['landmarks'])
    silk_min_dist = np.ones((T, N), dtype=float)
    silk_in_mask = np.zeros((T, N), dtype=bool)
    lower, upper = load_hsv_settings()
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret or frame_idx >= T:
            break
        rec = data[frame_idx]
        lms = rec.get('landmarks')
        mask = make_mask_for_frame(frame, lower, upper)
        if lms is None:
            frame_idx += 1
            continue
        joint_xy = [(float(x), float(y)) if x is not None else (None, None) for x,y,z,v in lms]
        for i, (x, y) in enumerate(joint_xy):
            if x is None:
                silk_min_dist[frame_idx, i] = 1.0
                silk_in_mask[frame_idx, i] = False
                continue
            md = compute_min_distance_normalized((x, y), mask)
            silk_min_dist[frame_idx, i] = md
            silk_in_mask[frame_idx, i] = (md <= CONTACT_THRESHOLD_NORM)
            if silk_in_mask[frame_idx, i]:
                # set occluded
                data[frame_idx]['landmarks'][i] = [None, None, None, 0.0]
        frame_idx += 1
    cap.release()
    np.save(out_dir / "silk_min_distance.npy", silk_min_dist)
    np.save(out_dir / "silk_in_mask.npy", silk_in_mask.astype(np.uint8))
    with open(out_dir / "landmarks_masked.json", "w") as f:
        json.dump(data, f)
    with open(out_dir / "diagnostics.txt", "w") as f:
        f.write(f"T={T}, N={N}\n")
        f.write(f"total_contacts={int(silk_in_mask.sum())}\n")
        f.write(f"contact_threshold_norm={CONTACT_THRESHOLD_NORM}\n")
        f.write("Note: 'landmarks_masked.json' has occluded joints set to [None,None,None,0.0]\n")
    print("Done. Saved silk features to", out_dir)
    print("Total contacts (joint frames inside silk):", int(silk_in_mask.sum()))
    if filter:
        run_filter(data, silk_min_dist, out_dir)

def run_filter(data, silk_min_dist, out_dir):
    T, N = silk_min_dist.shape
    silk_flag = np.zeros((T, N), dtype=np.uint8)
    for t, rec in enumerate(data):
        lms = rec.get("landmarks")
        if lms is None:
            continue
        pts = []
        for lm in lms:
            if lm is None or lm[0] is None:
                pts.append(None)
            else:
                pts.append((float(lm[0]), float(lm[1])))
        for i, p in enumerate(pts):
            if p is None:
                continue
            on_silk = silk_min_dist[t, i] <= CONTACT_THRESHOLD_NORM
            neighs = NEIGHBORS.get(i, [])
            neighbor_inconsistent = False
            if neighs:
                neigh_pts = [pts[n] for n in neighs if pts[n] is not None]
                if neigh_pts:
                    expx = sum(q[0] for q in neigh_pts)/len(neigh_pts)
                    expy = sum(q[1] for q in neigh_pts)/len(neigh_pts)
                    d_norm = math.hypot(p[0]-expx, p[1]-expy)
                    limb_scale = np.mean([math.hypot(q[0]-expx, q[1]-expy) for q in neigh_pts]) if len(neigh_pts)>0 else 0.0
                    if limb_scale > 0:
                        neighbor_inconsistent = (d_norm > 0.6 * limb_scale)
            mark = on_silk and neighbor_inconsistent
            if mark:
                silk_flag[t, i] = 1
    filtered = []
    for t, rec in enumerate(data):
        newrec = dict(rec)
        lms = rec.get("landmarks")
        if lms is None:
            filtered.append(newrec)
            continue
        new_lms = []
        for i, lm in enumerate(lms):
            if i < silk_flag.shape[1] and silk_flag[t, i] == 1:
                new_lms.append([None, None, None, 0.0])
            else:
                new_lms.append(lm)
        newrec['landmarks'] = new_lms
        filtered.append(newrec)
    outpath = Path(out_dir) / "landmarks_for_training.json"
    json.dump(filtered, open(outpath, "w"))
    stats = {
        "total_flags": int(silk_flag.sum()),
        "frames_with_flags": int((silk_flag.sum(axis=1)>0).sum())
    }
    open(Path(out_dir)/"filter_stats.txt","w").write(json.dumps(stats, indent=2))
    print("Wrote filtered landmarks to", outpath)
    print("Stats:", stats)

if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 3:
        print("Usage: python scripts/silk_process.py landmarks.json video.mov out_dir [--filter]")
        sys.exit(1)
    filter_flag = '--filter' in args
    args = [a for a in args if not a.startswith('--')]
    run_postprocess(args[0], args[1], args[2], filter=filter_flag)
