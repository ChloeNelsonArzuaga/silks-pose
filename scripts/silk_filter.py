

#!/usr/bin/env python3
"""
Detect and mark joints that are likely silk (false positives) by simple heuristics.

Usage:
  python scripts/silk_filter.py landmarks.json video.mov preprocessed_silk preprocessed_filtered/

Inputs expected:
 - landmarks.json (MediaPipe output)
 - preprocessed_silk/silk_min_distance.npy  (or script will compute mask on the fly)
 - hsv_settings.json (optional) for color match

Outputs:
 - preprocessed_filtered/landmarks_for_training.json  (same format as landmarks.json but flagged joints set to [None,None,None,0])
 - preprocessed_filtered/filter_stats.txt
"""
import json, sys, math
import numpy as np
from pathlib import Path
import cv2

# thresholds (tweakable)
# thresholds (tweakable) — made more conservative
CONTACT_THRESHOLD_NORM = 0.020    # smaller -> require joints be closer to silk to count as "on silk"
JUMP_FACTOR = 0.25                # larger -> require bigger frame-to-frame jumps to be considered bad
NEIGHBOR_FACTOR = 0.6             # larger -> allow more neighbor deviation before marking inconsistent
COLOR_MATCH_THRESH = 30           # unused (kept)

# require at least TWO signals (neighbor_inconsistent, jump, color_match) to mark occluded
REQUIRE_TWO_SIGNALS = True

# temporal cleanup: don't keep flags that are isolated single-frame spikes
TEMPORAL_MIN_FRAMES = 3   # if flags occur for <3 consecutive frames, ignore them (undo)

# landmark neighbor map (for simple expected position — use symmetric pairs)
# for MediaPipe indices: shoulder(11,12), elbow(13,14), wrist(15,16), hip(23,24), knee(25,26), ankle(27,28)
NEIGHBORS = {
    15: [13], 16: [14], 13: [11,15], 14: [12,16],
    11: [13,23], 12: [14,24],
    23: [11,25], 24: [12,26],
    25: [23,27], 26: [24,28],
    27: [25], 28: [26]
}

def load_landmarks(path):
    return json.load(open(path))

def load_silk_min_dist(path):
    p = Path(path) / "silk_min_distance.npy"
    if p.exists():
        return np.load(p)
    return None

# This script flags pose landmarks that are likely occluded by silk using heuristics.
# It uses spatial, temporal, and color-based checks to mark unreliable joints for training.
# Outputs filtered landmarks and stats for downstream use.

def get_frame_diag(frame):
    h,w = frame.shape[:2]
    return math.hypot(w,h)

def color_matches_silk(frame, x_norm, y_norm, lower, upper):
    h,w = frame.shape[:2]
    xi = int(x_norm * w); yi = int(y_norm * h)
    if xi<0 or yi<0 or xi>=w or yi>=h:
        return False
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    hv = hsv[yi, xi].astype(int)
    # simple threshold in HSV box
    return (lower[0] <= hv[0] <= upper[0]) and (lower[1] <= hv[1] <= upper[1]) and (lower[2] <= hv[2] <= upper[2])

def run(landmarks_json, video_path, preproc_dir, out_dir):
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    data = load_landmarks(landmarks_json)
    silk_min_dist = load_silk_min_dist(preproc_dir)  # shape (T,N) or None

    # optionally load hsv_settings.json
    hsv = None
    hsv_path = Path("hsv_settings.json")
    if hsv_path.exists():
        j = json.load(open(hsv_path))
        lower = np.array(j['lower'], dtype=int)
        upper = np.array(j['upper'], dtype=int)
        hsv = (lower, upper)

    cap = cv2.VideoCapture(str(video_path))
    T = len(data)
     # Load pose landmarks from a JSON file.
    # determine frame diag from first frame
    ret, frame0 = cap.read()
    if not ret:
        raise RuntimeError("Cannot read video")
     # Load silk minimum distance array from .npy file if present.
    diag = get_frame_diag(frame0)
    cap.release()

    # build F x N mask for filtered occlusions
    N = 0
    for rec in data:
        if rec.get("landmarks"):
     # Compute diagonal length of a video frame (for normalization).
            N = max(N, len(rec['landmarks']))
    silk_flag = np.zeros((T, N), dtype=np.uint8)  # 1 means mark as occluded

    # helper to compute euclidean distance normalized (use diag)
    def norm_dist(a,b):
     # Check if a pixel at normalized (x,y) matches silk color in HSV mask.
        return math.hypot(a[0]-b[0], a[1]-b[1])

    # compute neighbor-based expected distances (per frame)
    for t, rec in enumerate(data):
        lms = rec.get("landmarks")
        if lms is None:
            continue
        # convert to xy pairs, allow None
        pts = []
        vis = []
        for lm in lms:
            if lm is None or lm[0] is None:
                pts.append(None); vis.append(0.0)
            else:
                pts.append((float(lm[0]), float(lm[1])))
                vis.append(float(lm[3]) if len(lm)>3 else 1.0)

        # for each joint candidate, test heuristics
        for i, p in enumerate(pts):
            if p is None:
                continue
            on_silk = False
            if silk_min_dist is not None:
                if silk_min_dist.shape[0] > t and silk_min_dist.shape[1] > i:
                    on_silk = silk_min_dist[t, i] <= CONTACT_THRESHOLD_NORM
            # if silk_min_dist not available, skip color test (could compute mask here)

            if not on_silk:
                continue  # only consider joints that are on/near silk

            # neighbor consistency: compare distance to neighbor mean
            neighs = NEIGHBORS.get(i, [])
            if neighs:
                neigh_pts = [pts[n] for n in neighs if pts[n] is not None]
                if neigh_pts:
                    # expected position ~ mean of neighbors (simple heuristic)
                    expx = sum(q[0] for q in neigh_pts)/len(neigh_pts)
                    expy = sum(q[1] for q in neigh_pts)/len(neigh_pts)
                    d_norm = norm_dist(p, (expx, expy))
                    # compute approximate limb length scale using neighbor distances
                    limb_scale = np.mean([norm_dist(q, (expx, expy)) for q in neigh_pts]) if len(neigh_pts)>0 else 0.0
                    if limb_scale <= 0:
                        neighbor_inconsistent = False
                    else:
                        neighbor_inconsistent = (d_norm > NEIGHBOR_FACTOR * limb_scale)
                else:
                    neighbor_inconsistent = False
            else:
                neighbor_inconsistent = False

            # temporal jump: compare to previous frame (if available)
            prev_p = None
            if t>0:
                prev_rec = data[t-1].get("landmarks")
                if prev_rec and i < len(prev_rec):
                    prev_lm = prev_rec[i]
                    if prev_lm and prev_lm[0] is not None:
                        prev_p = (float(prev_lm[0]), float(prev_lm[1]))
            jump = False
            if prev_p is not None:
                if norm_dist(p, prev_p) * diag > JUMP_FACTOR*diag:
                    jump = True

            # color match (optional)
            color_match = False
            if hsv is not None:
                cap = cv2.VideoCapture(str(video_path))
                cap.set(cv2.CAP_PROP_POS_FRAMES, t)
                ok, frame = cap.read()
                cap.release()
                if ok:
                    color_match = color_matches_silk(frame, p[0], p[1], hsv[0], hsv[1])

            # if on silk and (neighbor inconsistent OR jump OR color match), mark occluded
            # if neighbor_inconsistent or jump or color_match:
            #     silk_flag[t,i] = 1
            # safer decision: require multiple signals if requested
            signals = 0
            if neighbor_inconsistent:
                signals += 1
            if jump:
                signals += 1
            if color_match:
                signals += 1

            mark = False
            if REQUIRE_TWO_SIGNALS:
                mark = (signals >= 2)
            else:
                mark = (signals >= 1)

            if mark:
                silk_flag[t,i] = 1

    # create a copy of the landmarks JSON and set flagged joints to None (but ONLY in the training copy)
    filtered = []
    for t, rec in enumerate(data):
        newrec = dict(rec)
        lms = rec.get("landmarks")
        if lms is None:
            filtered.append(newrec); continue
        new_lms = []
        for i, lm in enumerate(lms):
            if i < silk_flag.shape[1] and silk_flag[t,i]==1:
                # set to None-like entry
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
    if len(sys.argv) < 4:
        print("Usage: python scripts/silk_filter.py landmarks.json video.mov preprocessed_silk out_dir")
    else:
        run(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])