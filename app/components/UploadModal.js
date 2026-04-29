import { supabase } from '../lib/supabase.js';
import {
    FilesetResolver,
    PoseLandmarker,
    DrawingUtils,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerPromise = null;
function getLandmarker() {
    if (!landmarkerPromise) {
        landmarkerPromise = (async () => {
            const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
            return PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
                runningMode: 'VIDEO',
                numPoses: 1,
            });
        })();
    }
    return landmarkerPromise;
}

const TEST_VIDEO_URL = 'app/assets/test_video.mp4';
const TEST_VIDEO_THUMB_URL = 'app/assets/test_video_thumb.jpg';
const TEST_VIDEO_NAME = 'test_video.mp4';

export function openUploadModal(initialFile) {
    const overlay = document.createElement('div');
    overlay.className = 'upload-modal-bg is-open';
    overlay.innerHTML = `
        <div class="upload-modal" role="dialog" aria-modal="true">
            <div class="upload-modal-header">
                <div class="upload-modal-title">Upload Video</div>
                <button class="coll-modal-close" id="upm-close" aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <div class="upm-chooser" id="upm-chooser">
                <div class="upm-chooser-title">How would you like to start?</div>
                <div class="upm-chooser-options">
                    <button class="upm-chooser-card" id="upm-pick-file" type="button">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                        <div class="upm-chooser-card-title">Select from files</div>
                        <div class="upm-chooser-card-sub">Pick a video from your device</div>
                    </button>
                    <button class="upm-chooser-card" id="upm-use-test" type="button">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <div class="upm-chooser-card-title">Use test video</div>
                        <div class="upm-chooser-card-sub">Bundled aerial silk clip</div>
                    </button>
                </div>
                <input type="file" id="upm-file-input" accept="video/*" hidden>
            </div>

            <div class="upm-preview" id="upm-preview" hidden>
                <div class="upload-modal-body">
                    <div class="upm-preview-wrap">
                        <video class="upm-video" id="upm-video" controls playsinline muted autoplay></video>
                        <canvas class="upm-overlay" id="upm-overlay"></canvas>
                    </div>
                    <div class="upm-form">
                        <label class="upm-field">
                            <span>Name</span>
                            <input type="text" id="upm-name" placeholder="e.g. Cats cradle drill">
                        </label>
                        <div class="upm-field">
                            <span>Detected Poses</span>
                            <div class="upm-detected" id="upm-detected"></div>
                        </div>
                        <label class="upm-field">
                            <span>Add Poses <em>(comma-separated)</em></span>
                            <input type="text" id="upm-poses" placeholder="straddle, hip key">
                        </label>
                        <label class="upm-field">
                            <span>Add Tags <em>(comma-separated)</em></span>
                            <input type="text" id="upm-tags" placeholder="warm-up, drill, conditioning">
                        </label>
                        <div class="upm-meta" id="upm-meta">Loading pose detector…</div>
                    </div>
                </div>
                <div class="upload-modal-actions">
                    <button class="btn btn-secondary" id="upm-cancel">Cancel</button>
                    <button class="btn btn-primary" id="upm-submit" disabled>Upload</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const chooser = overlay.querySelector('#upm-chooser');
    const previewSection = overlay.querySelector('#upm-preview');
    const fileInput = overlay.querySelector('#upm-file-input');
    const video = overlay.querySelector('#upm-video');
    const canvas = overlay.querySelector('#upm-overlay');
    const meta = overlay.querySelector('#upm-meta');
    const submitBtn = overlay.querySelector('#upm-submit');

    let activeFile = null;
    let fileURL = null;
    let presetThumbnailUrl = null;

    function startPreview(file, opts = {}) {
        activeFile = file;
        presetThumbnailUrl = opts.thumbnailUrl || null;
        fileURL = URL.createObjectURL(file);
        video.src = fileURL;
        video.play().catch(() => {});
        chooser.hidden = true;
        previewSection.hidden = false;
        if (file.name) {
            const stem = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
            overlay.querySelector('#upm-name').value = stem;
        }
        overlay.querySelector('#upm-detected').innerHTML = opts.isTestVideo
            ? `<span class="upm-detected-tag">cats cradle</span>`
            : '';
    }

    overlay.querySelector('#upm-pick-file').onclick = () => fileInput.click();
    fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) startPreview(f);
    });

    overlay.querySelector('#upm-use-test').onclick = async () => {
        try {
            const res = await fetch(TEST_VIDEO_URL);
            if (!res.ok) throw new Error(`fetch ${res.status}`);
            const blob = await res.blob();
            const file = new File([blob], TEST_VIDEO_NAME, { type: blob.type || 'video/mp4' });
            startPreview(file, { thumbnailUrl: TEST_VIDEO_THUMB_URL, isTestVideo: true });
        } catch (e) {
            console.error('[upload] test video load failed:', e);
            alert('Could not load test video: ' + e.message);
        }
    };

    if (initialFile) startPreview(initialFile);

    let landmarker = null;
    let rafId = null;
    let lastVideoTime = -1;
    let closed = false;

    function fitCanvas() {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;
        const rect = video.getBoundingClientRect();
        const containerRatio = rect.width / rect.height;
        const videoRatio = vw / vh;
        let dispW, dispH, offsetX, offsetY;
        if (videoRatio > containerRatio) {
            dispW = rect.width;
            dispH = rect.width / videoRatio;
            offsetX = 0;
            offsetY = (rect.height - dispH) / 2;
        } else {
            dispH = rect.height;
            dispW = rect.height * videoRatio;
            offsetX = (rect.width - dispW) / 2;
            offsetY = 0;
        }
        canvas.width = vw;
        canvas.height = vh;
        canvas.style.left = offsetX + 'px';
        canvas.style.top = offsetY + 'px';
        canvas.style.width = dispW + 'px';
        canvas.style.height = dispH + 'px';
    }
    video.addEventListener('loadedmetadata', fitCanvas);
    window.addEventListener('resize', fitCanvas);
    const ro = new ResizeObserver(fitCanvas);
    ro.observe(video);

    function close() {
        if (closed) return;
        closed = true;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', fitCanvas);
        ro.disconnect();
        if (fileURL) URL.revokeObjectURL(fileURL);
        overlay.remove();
    }

    overlay.querySelector('#upm-close').onclick = close;
    overlay.querySelector('#upm-cancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape' && !closed) {
            close();
            document.removeEventListener('keydown', onEsc);
        }
    });

    (async () => {
        try {
            landmarker = await getLandmarker();
            if (closed) return;
            meta.textContent = 'Pose detection active — press play to preview.';
            submitBtn.disabled = false;
        } catch (e) {
            console.warn('[upload] pose detector failed:', e);
            meta.textContent = 'Pose preview unavailable; you can still upload.';
            submitBtn.disabled = false;
        }
    })();

    function renderFrame() {
        if (closed) return;
        rafId = requestAnimationFrame(renderFrame);
        if (!landmarker || video.readyState < 2) return;
        if (video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let result;
        try {
            result = landmarker.detectForVideo(video, performance.now());
        } catch (e) {
            return;
        }
        const drawer = new DrawingUtils(ctx);
        for (const landmarks of result.landmarks) {
            drawer.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
                color: '#5c4ec9', lineWidth: 4,
            });
            drawer.drawLandmarks(landmarks, {
                color: '#ffffff', fillColor: '#5c4ec9', radius: 4, lineWidth: 2,
            });
        }
    }
    renderFrame();

    submitBtn.onclick = async () => {
        if (!activeFile) return;
        submitBtn.disabled = true;
        meta.textContent = 'Uploading…';
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');

            const id = crypto.randomUUID();
            const ext = (activeFile.name.split('.').pop() || 'mp4').toLowerCase();
            const storagePath = `${user.id}/${id}.${ext}`;

            const { error: upErr } = await supabase.storage
                .from('videos')
                .upload(storagePath, activeFile, {
                    contentType: activeFile.type || `video/${ext}`,
                    upsert: false,
                });
            if (upErr) throw upErr;

            const thumbPath = `${id}.jpg`;
            let thumbBlob = null;
            if (presetThumbnailUrl) {
                const r = await fetch(presetThumbnailUrl);
                if (r.ok) thumbBlob = await r.blob();
            }
            if (!thumbBlob && video.videoWidth) {
                const tCanvas = document.createElement('canvas');
                tCanvas.width = video.videoWidth;
                tCanvas.height = video.videoHeight;
                tCanvas.getContext('2d').drawImage(video, 0, 0);
                thumbBlob = await new Promise(r => tCanvas.toBlob(r, 'image/jpeg', 0.85));
            }
            if (thumbBlob) {
                const { error: thumbErr } = await supabase.storage
                    .from('thumbnails')
                    .upload(thumbPath, thumbBlob, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });
                if (thumbErr) console.warn('[upload] thumbnail upload failed:', thumbErr.message);
            }

            const dedupe = list => {
                const seen = new Set();
                return list.filter(t => {
                    const k = t.toLowerCase();
                    if (!t || seen.has(k)) return false;
                    seen.add(k);
                    return true;
                });
            };
            const detected = Array.from(overlay.querySelectorAll('#upm-detected .upm-detected-tag'))
                .map(el => el.textContent.trim()).filter(Boolean);
            const userPoses = overlay.querySelector('#upm-poses').value
                .split(',').map(t => t.trim()).filter(Boolean);
            const poses = dedupe([...detected, ...userPoses]);
            const tags = dedupe(
                overlay.querySelector('#upm-tags').value
                    .split(',').map(t => t.trim()).filter(Boolean)
            );
            const customName = overlay.querySelector('#upm-name').value.trim() || null;

            const { error: insErr } = await supabase.from('videos').insert({
                id,
                user_id: user.id,
                filename: activeFile.name,
                storage_path: storagePath,
                thumbnail_path: thumbPath,
                poses,
                tags,
                custom_name: customName,
            });
            if (insErr) throw insErr;

            if (tags.length) {
                await supabase.from('tag_vocabulary').upsert(
                    tags.map(name => ({ name, user_id: user.id })),
                    { onConflict: 'user_id,name', ignoreDuplicates: true },
                );
            }

            meta.textContent = 'Uploaded.';
            window.dispatchEvent(new CustomEvent('video-uploaded', { detail: { id } }));
            setTimeout(close, 500);
        } catch (e) {
            console.error('[upload] failed:', e);
            meta.textContent = 'Error: ' + (e.message || 'upload failed');
            submitBtn.disabled = false;
        }
    };
}
