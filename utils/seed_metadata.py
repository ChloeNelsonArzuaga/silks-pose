#!/usr/bin/env python3
"""
Seed Supabase with metadata-only video rows for the entire labeling export.

Unlike utils/seed_supabase.py, this does NOT upload the actual video files.
Use it to populate the live site's library with all your local clips so a
viewer can browse cards, thumbnails, poses, and tags. Click-to-play will
fail (no video file in storage), which is the intended trade-off.

Required env vars:
    SUPABASE_URL                 e.g. https://jqnezzhwqbtauljqhozp.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    service-role / sb_secret key
    SEED_USER_ID                 uuid of the user to attribute the seeds to

Usage:
    python utils/seed_metadata.py [--labels-file path/to/all_labels.json]
                                  [--limit N]
                                  [--labeled-only]
                                  [--dry-run]

Defaults:
    labels-file = data/exports/all_labels.json
"""
import argparse
import json
import mimetypes  # noqa: F401  (kept for symmetry with seed_supabase.py)
import os
import sys
import urllib.request
import urllib.error
import uuid
from pathlib import Path

import cv2

LABELS_DEFAULT = "data/exports/all_labels.json"
RAW_DIR = Path("data/raw_videos")


def env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        sys.exit(f"[seed] missing env var: {name}")
    return val


SUPABASE_URL = env("SUPABASE_URL").rstrip("/")
SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")
USER_ID = env("SEED_USER_ID")

HEADERS_JSON = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def http(method: str, path: str, *, headers=None, data=None):
    url = f"{SUPABASE_URL}{path}"
    req_headers = dict(HEADERS_JSON)
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, method=method, headers=req_headers, data=data)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def storage_upload(bucket: str, path: str, content: bytes, content_type: str, *, upsert=True):
    headers = {"Content-Type": content_type, "x-upsert": "true" if upsert else "false"}
    status, body = http("POST", f"/storage/v1/object/{bucket}/{path}", headers=headers, data=content)
    if status >= 300:
        raise RuntimeError(f"upload {bucket}/{path} failed ({status}): {body[:200]!r}")


def existing_filenames() -> set:
    status, body = http(
        "GET", f"/rest/v1/videos?select=filename&user_id=eq.{USER_ID}",
    )
    if status >= 300:
        raise RuntimeError(f"select videos failed ({status}): {body[:300]!r}")
    return {row["filename"] for row in json.loads(body)}


def insert_videos_batch(rows: list) -> tuple[int, int]:
    """Insert rows. On batch failure, retry individually so one bad row doesn't poison the rest.
    Returns (inserted_count, errored_count)."""
    if not rows:
        return 0, 0
    status, body = http(
        "POST", "/rest/v1/videos",
        headers={"Prefer": "return=minimal"},
        data=json.dumps(rows).encode(),
    )
    if status < 300:
        return len(rows), 0

    inserted = errored = 0
    for row in rows:
        s, b = http(
            "POST", "/rest/v1/videos",
            headers={"Prefer": "return=minimal"},
            data=json.dumps([row]).encode(),
        )
        if s < 300:
            inserted += 1
        else:
            errored += 1
            print(f"[err]  {row.get('filename')}: insert failed ({s}): {b[:200]!r}")
    return inserted, errored


def extract_thumbnail(video_path: Path) -> bytes:
    cap = cv2.VideoCapture(str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(total // 2, 0))
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"could not read frame from {video_path}")
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        raise RuntimeError(f"could not encode thumbnail for {video_path}")
    return buf.tobytes()


def dedupe_lower(names):
    seen, out = set(), []
    for n in names:
        n = (n or "").strip()
        k = n.lower()
        if n and k not in seen:
            seen.add(k)
            out.append(n)
    return out


def derive_custom_name(filename: str, poses: list) -> str:
    if poses:
        return poses[0]
    stem = Path(filename).stem.replace("_", " ").replace("-", " ")
    return stem.title()


def safe_uuid(raw_id: str, filename: str) -> str:
    """Return raw_id if it parses as a UUID, otherwise a stable UUID5 from filename."""
    try:
        return str(uuid.UUID(raw_id))
    except (ValueError, AttributeError, TypeError):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"silks-pose:{filename}"))


def build_row(entry: dict, thumb_path: str) -> dict:
    poses = dedupe_lower([l.get("label") for l in entry.get("labels", [])])
    tags = dedupe_lower(entry.get("tags", []) or [])
    split = entry.get("split") or "unassigned"
    if split not in {"unassigned", "labeled", "train", "test"}:
        split = "unassigned"
    return {
        "id": safe_uuid(entry.get("id"), entry["filename"]),
        "user_id": USER_ID,
        "filename": entry["filename"],
        "storage_path": None,
        "thumbnail_path": thumb_path,
        "split": split,
        "tags": tags,
        "poses": poses,
        "custom_name": derive_custom_name(entry["filename"], poses),
    }


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--labels-file", default=LABELS_DEFAULT)
    p.add_argument("--limit", type=int, default=None, help="cap how many rows to seed")
    p.add_argument("--labeled-only", action="store_true",
                   help="only seed entries that have at least one label or tag")
    p.add_argument("--dry-run", action="store_true",
                   help="print what would be inserted without uploading anything")
    args = p.parse_args()

    labels_file = Path(args.labels_file)
    if not labels_file.exists():
        sys.exit(f"[seed] not found: {labels_file}")

    entries = json.loads(labels_file.read_text())
    if args.labeled_only:
        entries = [e for e in entries if e.get("labels") or e.get("tags")]
    if args.limit:
        entries = entries[: args.limit]

    skip = set() if args.dry_run else existing_filenames()
    print(f"[seed] candidate entries: {len(entries)} (already in DB: {len(skip)})")

    pending_rows = []
    queued = inserted = skipped = errored = 0
    BATCH = 50

    def flush():
        nonlocal pending_rows, inserted, errored
        if not pending_rows:
            return
        ins, err = insert_videos_batch(pending_rows)
        inserted += ins
        errored += err
        pending_rows = []

    for i, entry in enumerate(entries, 1):
        filename = entry.get("filename")
        if not filename:
            continue
        if filename in skip:
            skipped += 1
            continue

        local_path = RAW_DIR / filename
        if not local_path.exists():
            print(f"[skip] {filename}: missing local file")
            errored += 1
            continue

        video_id = safe_uuid(entry.get("id"), filename)
        thumb_path = f"{video_id}.jpg"

        try:
            if args.dry_run:
                row = build_row(entry, thumb_path)
                print(f"[dry] {filename} -> poses={row['poses']} tags={row['tags']} split={row['split']}")
                queued += 1
                continue

            thumb_bytes = extract_thumbnail(local_path)
            storage_upload("thumbnails", thumb_path, thumb_bytes, "image/jpeg", upsert=True)
            row = build_row(entry, thumb_path)
            row["filename"] = filename  # ensure present for error messages
            pending_rows.append(row)
            queued += 1

            if len(pending_rows) >= BATCH:
                flush()

            if i % 20 == 0:
                print(f"[seed] {i}/{len(entries)} processed (inserted={inserted}, errored={errored})")

        except Exception as e:
            print(f"[err]  {filename}: {e}")
            errored += 1

    if not args.dry_run:
        flush()
    else:
        inserted = queued

    print(f"\ndone. inserted={inserted} skipped={skipped} errored={errored}")


if __name__ == "__main__":
    main()
