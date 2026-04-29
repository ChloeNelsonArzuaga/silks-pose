# Silks Pose

Pose detection and classification pipeline for aerial silk performances.
Uses MediaPipe to extract joint landmarks from video, labels moves via a web app, and trains a classifier to recognize poses.

---

## Project Structure

```
pipeline/           # Core processing steps (extract, preprocess, visualize)
training/           # Dataset summary, batch extraction, model training
utils/              # Dev server, manifest generator, label merge, HSV tuner
app/                # Web labeling tool (served via utils/serve.py)
data/
  raw_videos/       # Input videos (gitignored)
  landmarks/        # Raw MediaPipe landmark JSON per video (gitignored)
  preprocessed/     # Body-frame normalized .npy arrays per video (gitignored)
  exports/          # Exported label JSON from the web app (gitignored)
  output/           # Annotated output videos and label clips (gitignored)
models/             # MediaPipe model file (gitignored)
config/             # HSV settings for silk color detection
```

---

## Workflows

### 1. Label videos in the web app

Start the local server:
```bash
python3 utils/serve.py
```
Open `http://localhost:8000` in your browser. Use the **Admin** page to label pose ranges in each video, assign splits (Train / Test / Labeled), and add tags.

Export labels from the browser, save to `data/exports/all_labels.json`, then merge into the manifest:
```bash
python3 utils/merge_labels.py data/exports/all_labels.json
```

### 2. Refresh the video manifest

Run this after adding new videos to `data/raw_videos/`:
```bash
python3 utils/generate_manifest.py
```

### 3. Batch extract landmarks for all labeled videos

Runs MediaPipe extraction + body-frame preprocessing on every video with split `labeled`, `train`, or `test`. Skips videos already processed.
```bash
python3 training/batch_extract.py
```
Options:
- `--force` — reprocess even if outputs already exist
- `--dry-run` — show what would run without executing

### 4. Summarize labeled data

Outputs `training/label_summary.csv` with move name, number of videos, number of frames, and video names. Useful for deciding which moves have enough data to train on.
```bash
python3 training/summarize_labels.py
```

### 5. Export annotated skeleton clips

Exports a short annotated video clip for each labeled segment so you can visually verify the labels. Clips are saved to `data/output/label_clips/`.
```bash
python3 training/export_label_clips.py                  # cats cradle only (default)
python3 training/export_label_clips.py --move "angel"   # any specific move
python3 training/export_label_clips.py --all-moves      # every labeled segment
```

### 6. Train the classifier

Trains a binary classifier (cats cradle vs. not) using a video-level 7/2 train/test split to avoid data leakage. Saves the model to `training/`.
```bash
python3 training/train.py
python3 training/train.py --list-splits    # preview which videos are train vs. test
python3 training/train.py --seed 1         # try a different video split
```

### 7. Run the pipeline on a single video

Extracts landmarks, preprocesses, and generates an annotated visualization for one video.
```bash
python3 run.py data/raw_videos/myvideo.mp4 myvideo
```
Defaults to `data/raw_videos/test.mov` when run from the VS Code play button.

---

## Utilities

| Script | Purpose |
|---|---|
| `utils/serve.py` | Local dev server with byte-range support (required for video scrubbing) |
| `utils/generate_manifest.py` | Scan `data/raw_videos/` and update `app/videos.json` |
| `utils/merge_labels.py` | Merge exported label JSON back into `app/videos.json` |
| `utils/hsv_tuner.py` | Interactive HSV threshold tuner for silk color detection |
| `utils/clean.py` | Delete generated output directories |

---

## Data sources: local vs Supabase

The web app auto-detects which source to read from:

| Where you load it from | Source |
|---|---|
| `localhost` / `127.0.0.1` (the `utils/serve.py` dev server) | **Local** — reads `app/videos.json` and localStorage overlays |
| Any other hostname (deployed) | **Supabase** — reads the `videos` table over the API |

To force a mode for testing, append `?source=supabase` or `?source=local` to the URL once — the choice is remembered in localStorage. Clear it with `localStorage.removeItem('data_source')`.

The Upload button always writes to Supabase (browsers can't write back to your local filesystem), so uploads from localhost still land in the live database.

## Supabase setup

The web app stores videos and metadata in Supabase. To set this up on a fresh project:

1. **Apply the schema** — open the Supabase SQL editor and run [`supabase/schema.sql`](supabase/schema.sql). This creates the `videos` and `tag_vocabulary` tables with row-level security, plus the private `videos` storage bucket.
2. **Confirm the `thumbnails` bucket exists** — create one (public) if it isn't there yet; the app already reads/writes thumbnails from it.
3. **Sign up a user** in the running app (Login page) so RLS-protected inserts can attach to `auth.users`.
4. **(Optional) Seed example videos** so the library isn't empty:
    ```bash
    export SUPABASE_URL=https://<your-project>.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
    export SEED_USER_ID=<uuid-from-Auth-dashboard>
    python3 utils/seed_supabase.py data/raw_videos/test.mov data/raw_videos/another.mp4
    ```
    The script uploads each video, extracts a thumbnail, and inserts a `videos` row owned by `SEED_USER_ID`. Service-role key is required to bypass RLS for the seed user.

The Upload button in the navbar opens a modal that runs MediaPipe pose detection on the selected video in-browser before submit, so you can verify tracking quality before committing to the upload.

## Requirements

```bash
pip3 install mediapipe opencv-python numpy scipy scikit-learn joblib tqdm
```

---

## License

[Specify your license here]
