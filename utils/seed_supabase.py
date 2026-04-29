#!/usr/bin/env python3
"""
Seed the Supabase `videos` table + storage with example videos.

Run once after creating the schema (supabase/schema.sql).

Required env vars:
    SUPABASE_URL                 e.g. https://jqnezzhwqbtauljqhozp.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    service-role key (NOT the publishable key)
    SEED_USER_ID                 uuid of the user to attribute the seeds to
                                 (find in the Supabase Auth dashboard)

Usage:
    python utils/seed_supabase.py path/to/video1.mp4 path/to/video2.mov ...

For each video the script:
  1. uploads it to storage bucket `videos` at {user_id}/{uuid}.{ext}
  2. extracts a thumbnail at the midpoint and uploads to `thumbnails`
  3. inserts a row into `public.videos`

Skips a file if a video with the same filename already exists for the user.
"""
import json
import mimetypes
import os
import sys
import tempfile
import urllib.request
import urllib.error
import uuid
from pathlib import Path

import cv2


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
            body = resp.read()
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def storage_upload(bucket: str, path: str, content: bytes, content_type: str, *, upsert=False):
    headers = {
        "Content-Type": content_type,
        "x-upsert": "true" if upsert else "false",
    }
    status, body = http("POST", f"/storage/v1/object/{bucket}/{path}", headers=headers, data=content)
    if status >= 300:
        raise RuntimeError(f"upload {bucket}/{path} failed ({status}): {body[:200]!r}")


def insert_video(row: dict):
    status, body = http(
        "POST", "/rest/v1/videos",
        headers={"Prefer": "return=representation"},
        data=json.dumps(row).encode(),
    )
    if status >= 300:
        raise RuntimeError(f"insert videos row failed ({status}): {body[:300]!r}")
    return json.loads(body)


def existing_filenames() -> set:
    status, body = http(
        "GET",
        f"/rest/v1/videos?select=filename&user_id=eq.{USER_ID}",
    )
    if status >= 300:
        raise RuntimeError(f"select videos failed ({status}): {body[:300]!r}")
    return {row["filename"] for row in json.loads(body)}


def extract_thumbnail(video_path: Path) -> bytes:
    cap = cv2.VideoCapture(str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(total // 2, 0))
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"could not read frame from {video_path}")
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise RuntimeError(f"could not encode thumbnail for {video_path}")
    return buf.tobytes()


def seed(video_path: Path, skip: set):
    if not video_path.exists():
        print(f"[skip] {video_path}: not found")
        return
    if video_path.name in skip:
        print(f"[skip] {video_path.name}: already seeded for this user")
        return

    video_id = str(uuid.uuid4())
    ext = video_path.suffix.lstrip(".").lower() or "mp4"
    storage_path = f"{USER_ID}/{video_id}.{ext}"
    thumb_path = f"{video_id}.jpg"

    content_type, _ = mimetypes.guess_type(video_path.name)
    if not content_type:
        content_type = f"video/{ext}"

    print(f"[seed] {video_path.name} -> {storage_path}")
    storage_upload("videos", storage_path, video_path.read_bytes(), content_type)
    storage_upload("thumbnails", thumb_path, extract_thumbnail(video_path), "image/jpeg", upsert=True)
    insert_video({
        "id": video_id,
        "user_id": USER_ID,
        "filename": video_path.name,
        "storage_path": storage_path,
        "thumbnail_path": thumb_path,
        "split": "labeled",
        "tags": ["example"],
        "custom_name": video_path.stem.replace("_", " ").title(),
    })
    print(f"[ok]   {video_path.name}")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    paths = [Path(p) for p in sys.argv[1:]]
    skip = existing_filenames()
    for p in paths:
        try:
            seed(p, skip)
        except Exception as e:
            print(f"[err]  {p.name}: {e}")
    print("done.")


if __name__ == "__main__":
    main()
