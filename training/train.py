#!/usr/bin/env python3
"""
Train a binary pose classifier: cats cradle vs. not cats cradle.

Splits by video (not by frame) to avoid data leakage.
Guarantees both train and test sets contain cats cradle AND non-cats-cradle frames.
Uses normalized_landmarks.npy (body-frame joint coordinates) as features.

Usage:
    python3 training/train.py                    # auto split
    python3 training/train.py --seed 42          # fix random split
    python3 training/train.py --list-splits      # show which videos land in train vs test
"""
import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent.parent
EXPORTS_PATH = ROOT / "data" / "exports" / "all_labels.json"
PREPROCESSED_DIR = ROOT / "data" / "preprocessed"
OUT_DIR = ROOT / "training"

TARGET_MOVE = "cats cradle"
TARGET_ALIASES = {"cats cradle", "cats craddle"}  # handle typo variant
VALID_SPLITS = {"labeled", "train", "test"}
TEST_FRACTION = 0.2  # ~20% of cats-cradle videos held out for test


def normalize_move(name):
    return name.strip().lower()


def is_target(move):
    return normalize_move(move) in TARGET_ALIASES


def load_dataset(videos):
    """
    For each video, slice frames using label ranges.
    Labeled target frames -> class 1
    All other labeled frames -> class 0
    Returns X (frames x 99), y (0/1), meta list.
    """
    X, y, meta = [], [], []

    for v in videos:
        vid_id = v["id"]
        npy_path = PREPROCESSED_DIR / vid_id / "normalized_landmarks.npy"

        if not npy_path.exists():
            print(f"  [skip] no preprocessed data for {vid_id}")
            continue

        landmarks = np.load(npy_path)  # (T, 33, 3)
        T = landmarks.shape[0]

        for lbl in v.get("labels", []):
            move = lbl.get("label", "")
            start = int(lbl.get("startFrame", 0))
            end = min(int(lbl.get("endFrame", start)), T - 1)

            if start > end:
                continue

            frames = landmarks[start:end + 1]
            valid = ~np.isnan(frames).all(axis=(1, 2))
            frames = frames[valid]
            if len(frames) == 0:
                continue

            features = frames.reshape(len(frames), -1)
            label = 1 if is_target(move) else 0
            X.append(features)
            y.extend([label] * len(features))
            meta.extend([(vid_id, move)] * len(features))

    if not X:
        return None, None, None

    return np.vstack(X), np.array(y), meta


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=0, help="Random seed for video split")
    parser.add_argument("--list-splits", action="store_true", help="Print train/test video split and exit")
    args = parser.parse_args()

    if not EXPORTS_PATH.exists():
        print(f"[ERROR] Labels file not found: {EXPORTS_PATH}")
        sys.exit(1)

    data = json.loads(EXPORTS_PATH.read_text())
    all_labeled = [
        v for v in data
        if v.get("split") in VALID_SPLITS
        and v.get("labels")
        and (PREPROCESSED_DIR / v["id"] / "normalized_landmarks.npy").exists()
    ]

    # Videos that contain at least one cats-cradle label
    cats_cradle_videos = [
        v for v in all_labeled
        if any(is_target(lbl.get("label", "")) for lbl in v.get("labels", []))
    ]

    # Videos with labels but NO cats cradle — pure negatives, always go in train
    negative_only_videos = [
        v for v in all_labeled
        if not any(is_target(lbl.get("label", "")) for lbl in v.get("labels", []))
    ]

    if len(cats_cradle_videos) < 3:
        print(f"[ERROR] Only {len(cats_cradle_videos)} video(s) with '{TARGET_MOVE}'. Need at least 3.")
        sys.exit(1)

    rng = random.Random(args.seed)

    # Split cats-cradle videos ~80/20
    n_test_cc = max(1, round(len(cats_cradle_videos) * TEST_FRACTION))
    shuffled_cc = cats_cradle_videos[:]
    rng.shuffle(shuffled_cc)
    test_cc_videos = shuffled_cc[:n_test_cc]
    train_cc_videos = shuffled_cc[n_test_cc:]

    # Split negative-only videos ~80/20, guarantee at least 1 in test
    n_test_neg = max(1, round(len(negative_only_videos) * TEST_FRACTION))
    shuffled_neg = negative_only_videos[:]
    rng.shuffle(shuffled_neg)
    test_neg_videos = shuffled_neg[:n_test_neg]
    train_neg_videos = shuffled_neg[n_test_neg:]

    train_videos = train_cc_videos + train_neg_videos
    test_videos = test_cc_videos + test_neg_videos

    print(f"\nTarget move: '{TARGET_MOVE}' (including typo variants)")
    print(f"Videos with cats cradle: {len(cats_cradle_videos)}")
    print(f"Videos with other moves only: {len(negative_only_videos)}")
    print(f"\nTRAIN ({len(train_videos)} videos):")
    for v in train_cc_videos:
        n = sum(1 for l in v["labels"] if is_target(l["label"]))
        print(f"  [+cc] {v['filename']}  ({n} cats cradle label(s))")
    for v in train_neg_videos:
        print(f"  [neg] {v['filename']}")

    print(f"\nTEST ({len(test_videos)} videos):")
    for v in test_cc_videos:
        n = sum(1 for l in v["labels"] if is_target(l["label"]))
        print(f"  [+cc] {v['filename']}  ({n} cats cradle label(s))")
    for v in test_neg_videos:
        print(f"  [neg] {v['filename']}")

    if args.list_splits:
        return

    # Build datasets
    print("\nBuilding training set...")
    X_train, y_train, _ = load_dataset(train_videos)
    print(f"  {np.sum(y_train == 1):,} cats cradle frames  |  {np.sum(y_train == 0):,} other frames")

    print("Building test set...")
    X_test, y_test, _ = load_dataset(test_videos)
    print(f"  {np.sum(y_test == 1):,} cats cradle frames  |  {np.sum(y_test == 0):,} other frames")

    if X_train is None or X_test is None:
        print("[ERROR] Failed to build dataset — check preprocessed data exists")
        sys.exit(1)

    if np.sum(y_test == 0) == 0:
        print("[WARN] Test set has no negative frames — evaluation will be one-sided")

    # Drop NaN rows
    mask_tr = ~np.isnan(X_train).any(axis=1)
    mask_te = ~np.isnan(X_test).any(axis=1)
    X_train, y_train = X_train[mask_tr], y_train[mask_tr]
    X_test, y_test = X_test[mask_te], y_test[mask_te]

    # Train
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import classification_report, confusion_matrix
        from sklearn.preprocessing import StandardScaler
        import joblib
    except ImportError:
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "scikit-learn", "joblib", "-q"])
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import classification_report, confusion_matrix
        from sklearn.preprocessing import StandardScaler
        import joblib

    print("\nTraining Random Forest (class_weight=balanced)...")
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    clf = RandomForestClassifier(
        n_estimators=200, max_depth=12, n_jobs=-1,
        random_state=args.seed, class_weight="balanced"
    )
    clf.fit(X_train_s, y_train)

    # Evaluate
    y_pred = clf.predict(X_test_s)
    print("\n--- Results on held-out test videos ---")
    print(classification_report(y_test, y_pred, target_names=["not cats cradle", "cats cradle"]))

    cm = confusion_matrix(y_test, y_pred)
    print("Confusion matrix:")
    print(f"  {'':20} Pred: not  Pred: yes")
    print(f"  {'True: not cats cradle':<20} {cm[0][0]:>10}  {cm[0][1]:>9}")
    print(f"  {'True: cats cradle':<20} {cm[1][0]:>10}  {cm[1][1]:>9}")

    # Save model
    model_path = OUT_DIR / "cats_cradle_clf.joblib"
    scaler_path = OUT_DIR / "cats_cradle_scaler.joblib"
    joblib.dump(clf, model_path)
    joblib.dump(scaler, scaler_path)
    print(f"\nSaved model  → {model_path}")
    print(f"Saved scaler → {scaler_path}")


if __name__ == "__main__":
    main()
