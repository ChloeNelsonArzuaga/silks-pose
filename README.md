# Silks Pose

An end-to-end system for aerial silk performance analysis. Videos are labeled with pose names through a web app, processed through a MediaPipe landmark extraction pipeline, and used to train a move classifier. A full-stack library app lets performers upload, browse, and organize their training footage.

---

## Architecture

```
pipeline/           # CV processing: extract landmarks, preprocess, visualize
training/           # Batch extraction, classifier training, label summaries
utils/              # Dev server, manifest tools, Supabase seeding, HSV tuner
app/                # Web app (Vanilla JS, served via utils/serve.py or deployed)
  components/       # Navbar, Router, page components, VideoLabeler, UploadModal
  lib/              # Supabase client, data source detection, video helpers, group logic
  assets/           # Bundled test video + thumbnail
supabase/           # schema.sql — tables, RLS, storage bucket policies
data/
  raw_videos/       # Input videos (gitignored)
  landmarks/        # Raw MediaPipe landmark JSON (gitignored)
  preprocessed/     # Body-frame normalized .npy arrays (gitignored)
  exports/          # Exported label JSON from the web app (gitignored)
  output/           # Annotated output videos and label clips (gitignored)
models/             # MediaPipe model file (gitignored)
config/             # HSV settings for silk color detection
```

---

## Web App

Start the local dev server (required for video scrubbing — handles byte-range requests):
```bash
python3 utils/serve.py
```
Open `http://localhost:8000`. Sign in, then explore:

| Page | What it does |
|---|---|
| **Library** | Browse all videos. Search, filter, favorite, rename, move to collections. |
| **Collections** | Auto-groups videos by shared tag. Create manual collections. |
| **Progress** | Groups videos by labeled move. Shows counts per pose. |
| **Favorites** | Starred videos, moves, and collections in one place. |
| **Upload** | Live MediaPipe pose preview before commit. Choose from files or the bundled test clip. |
| **Admin** | Pose Labeler — scrub video, set start/stop points, label pose ranges. |
| **Dataset** | Assign train/test/labeled/unused splits across all videos. |

### Local vs Supabase mode

The app auto-detects which data source to use:

| Where loaded | Source |
|---|---|
| `localhost` / `127.0.0.1` | **Local** — reads `app/videos.json` + localStorage overlays, plus any Supabase uploads |
| Any deployed hostname | **Supabase** — reads the `videos` table only |

Override with `?source=supabase` or `?source=local` — choice sticks in localStorage. Clear with `localStorage.removeItem('data_source')`.

---

## Pipeline Workflows

### 1. Label videos
Open the Admin page in the web app. Scrub to a pose, set Start/Stop points, type a name, click Label. Export labels and merge back into the manifest:
```bash
python3 utils/merge_labels.py data/exports/all_labels.json
```

### 2. Refresh the video manifest
Run after adding videos to `data/raw_videos/`:
```bash
python3 utils/generate_manifest.py
```

### 3. Batch extract landmarks
Runs MediaPipe extraction + body-frame preprocessing on every labeled/train/test video. Skips already-processed.
```bash
python3 training/batch_extract.py
python3 training/batch_extract.py --force     # reprocess existing
python3 training/batch_extract.py --dry-run   # preview only
```

### 4. Summarize labeled data
Outputs `training/label_summary.csv` — move name × video count × frame count. Useful for deciding what has enough data to train on.
```bash
python3 training/summarize_labels.py
```

### 5. Export annotated skeleton clips
Exports short annotated clips per labeled segment for visual verification.
```bash
python3 training/export_label_clips.py                  # cats cradle (default)
python3 training/export_label_clips.py --move "angel"
python3 training/export_label_clips.py --all-moves
```

### 6. Train the classifier
Binary classifier (cats cradle vs. not) with a video-level 7/2 train/test split to avoid temporal leakage.
```bash
python3 training/train.py
python3 training/train.py --list-splits    # preview split assignments
python3 training/train.py --seed 1         # try a different split
```

### 7. Run the pipeline on a single video
```bash
python3 run.py data/raw_videos/myvideo.mp4 myvideo
```
Defaults to `data/raw_videos/test.mov` when run from the VS Code play button.

---

## Supabase Setup

The deployed app stores everything in Supabase. Run once on a new project:

1. **Apply the schema** — Supabase SQL Editor → paste and run [`supabase/schema.sql`](supabase/schema.sql). Creates `videos` + `tag_vocabulary` tables with RLS, plus the private `videos` and public `thumbnails` storage buckets.

2. **Sign up** — create a user via the app's Login page (or Supabase Auth dashboard).

3. **Seed metadata** — populates the library with all locally-labeled videos (thumbnails + pose/tag data, no video file upload):
    ```bash
    export SUPABASE_URL=https://<project>.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # never commit this
    export SEED_USER_ID=<uuid-from-Auth-dashboard>
    python3 utils/seed_metadata.py
    python3 utils/seed_metadata.py --labeled-only          # only videos with labels/tags
    python3 utils/seed_metadata.py --dry-run --limit 5     # preview first
    ```

4. **Seed a full video** (optional — for the upload flow demo):
    ```bash
    python3 utils/seed_supabase.py data/raw_videos/IMG_0237_compressed.mp4
    ```

---

## Utilities

| Script | Purpose |
|---|---|
| `utils/serve.py` | Local dev server with byte-range support |
| `utils/generate_manifest.py` | Scan `data/raw_videos/` → `app/videos.json` |
| `utils/merge_labels.py` | Merge exported labels back into `app/videos.json` |
| `utils/seed_metadata.py` | Seed Supabase with thumbnails + metadata for all local videos |
| `utils/seed_supabase.py` | Seed Supabase with full video files + metadata |
| `utils/hsv_tuner.py` | Interactive HSV threshold tuner for silk color detection |
| `utils/clean.py` | Delete generated output directories |

---

## Requirements

```bash
pip3 install mediapipe opencv-python numpy scipy scikit-learn joblib tqdm
```

---

## License

[Specify your license here]
