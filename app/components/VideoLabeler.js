import { IS_LOCAL } from '../lib/dataSource.js';

const TEST_FILENAME = 'IMG_0237_compressed.mp4';
const TEST_LABELS = [
    { videoId: null, startTime: 48.733, endTime: 60.333, startFrame: 1462, endFrame: 1810, label: 'cats cradle' },
    { videoId: null, startTime: 64.367, endTime: 71.667, startFrame: 1931, endFrame: 2150, label: 'cats cradle end' },
];

export function VideoLabeler() {
    const container = document.createElement('div');
    container.className = 'labeler';

    container.innerHTML = `
        <div class="labeler-header">
            <h3>Pose Labeler</h3>
            <div class="labeler-video-select">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-prev-video">&larr;</button>
                <select id="video-select">
                    <option value="">Loading videos...</option>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-next-video">&rarr;</button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-hide-labeled">Hide Labeled</button>
            </div>
        </div>
        <div class="labeler-workspace">
            <div class="labeler-player">
                <video id="labeler-video" controls playsinline></video>
                <div class="labeler-time">
                    <span id="labeler-current-time">0:00</span> / <span id="labeler-duration">0:00</span>
                    &mdash; Frame: <span id="labeler-frame">0</span>
                </div>
            </div>
            <div class="labeler-controls">
                <div class="labeler-scrub">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-back-5">-5s</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-back-1">-1s</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-prev-frame">&lt; Frame</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-next-frame">Frame &gt;</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-fwd-1">+1s</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-fwd-5">+5s</button>
                </div>
                <div class="labeler-range">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-mark-in">Start</button>
                    <span class="range-display" id="range-display">No range set</span>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-mark-out">Stop</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-range">Clear</button>
                </div>
                <div class="labeler-input">
                    <input type="text" id="pose-label" placeholder="Enter pose name..." />
                    <button type="button" class="btn btn-primary btn-sm" id="btn-add-label">Label</button>
                </div>
                <div class="labeler-labels" id="labels-list">
                    <p class="labeler-empty">No labels yet. Scrub to a pose and add a label.</p>
                </div>
                <div class="labeler-section-title">Dataset Split</div>
                <div class="split-selector" id="split-selector">
                    <button type="button" class="split-btn" data-split="train">Train</button>
                    <button type="button" class="split-btn" data-split="test">Test</button>
                    <button type="button" class="split-btn" data-split="labeled">Labeled</button>
                    <button type="button" class="split-btn" data-split="unused">Unused</button>
                    <button type="button" class="split-btn" data-split="unassigned">Unassigned</button>
                </div>
                <div class="labeler-section-title">Video Tags</div>
                <div class="tagger-chips" id="tagger-chips"></div>
                <div class="tagger-input-row">
                    <input type="text" id="tag-input" placeholder="New tag..." />
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-add-tag">Add</button>
                </div>
                <div class="labeler-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-export">Export This Video</button>
                    <button type="button" class="btn btn-primary btn-sm" id="btn-export-all">Export All Videos</button>
                </div>
            </div>
        </div>
    `;

    // State
    let videos = [];
    let hideLabeled = false;
    let labels = [];  // { videoId, startTime, endTime, startFrame, endFrame, label }
    let fps = 30;
    let markIn = null;   // in-point time in seconds
    let markOut = null;  // out-point time in seconds

    // Tag state: allTags = every tag ever created, videoTags = active tags for current video
    let allTags = JSON.parse(localStorage.getItem('all_tags') || '["dark","out of frame","blurry","low quality","partial","obstructed","good take"]');
    let videoTags = [];
    let videoSplit = 'unassigned';

    // Elements
    const select = container.querySelector('#video-select');
    const video = container.querySelector('#labeler-video');
    const currentTimeEl = container.querySelector('#labeler-current-time');
    const durationEl = container.querySelector('#labeler-duration');
    const frameEl = container.querySelector('#labeler-frame');
    const poseInput = container.querySelector('#pose-label');
    const labelsList = container.querySelector('#labels-list');
    const rangeDisplay = container.querySelector('#range-display');

    // Load manifest — local mode reads videos.json, Supabase mode loads the test video
    if (IS_LOCAL) {
        fetch('app/videos.json', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                videos = data;
                populateSelect();
                const first = visibleVideos()[0];
                if (first) loadVideo(first);
            })
            .catch(() => {
                select.innerHTML = '<option>No videos found — run generate_manifest.py</option>';
            });
    } else {
        const TEST_ID = 'test-video-demo';
        const v = {
            id: TEST_ID,
            filename: TEST_FILENAME,
            path: 'app/assets/test_video.mp4',
            split: 'labeled',
            tags: [],
            labels: [],
        };
        // Always re-seed so stale timestamps from a previous version get replaced
        const seeded = TEST_LABELS.map(l => ({ ...l, videoId: TEST_ID }));
        localStorage.setItem(`labels_${TEST_ID}`, JSON.stringify(seeded));
        if (!localStorage.getItem(`video_split_${TEST_ID}`)) {
            localStorage.setItem(`video_split_${TEST_ID}`, 'labeled');
        }
        videos = [v];
        populateSelect();
        setTimeout(() => loadVideo(v), 0);
    }

    select.addEventListener('change', () => {
        const v = videos.find(v => v.path === select.value);
        if (v) loadVideo(v);
    });

    function visibleVideos() {
        if (!hideLabeled) return videos;
        return videos.filter(v => {
            const split = localStorage.getItem(`video_split_${v.id}`) || v.split || 'unassigned';
            return split !== 'labeled' && split !== 'train' && split !== 'test';
        });
    }

    function populateSelect() {
        const visible = visibleVideos();
        select.innerHTML = visible.map(v =>
            `<option value="${v.path}">${v.filename}</option>`
        ).join('');
    }

    const hideLabeledBtn = container.querySelector('#btn-hide-labeled');
    hideLabeledBtn.addEventListener('click', () => {
        hideLabeled = !hideLabeled;
        hideLabeledBtn.textContent = hideLabeled ? 'Show All' : 'Hide Labeled';
        hideLabeledBtn.classList.toggle('filter-active', hideLabeled);
        populateSelect();
        const first = visibleVideos()[0];
        if (first) { select.value = first.path; loadVideo(first); }
    });

    container.querySelector('#btn-prev-video').addEventListener('click', () => {
        const visible = visibleVideos();
        const idx = visible.findIndex(v => v.path === select.value);
        if (idx > 0) { select.value = visible[idx - 1].path; loadVideo(visible[idx - 1]); }
    });

    container.querySelector('#btn-next-video').addEventListener('click', () => {
        const visible = visibleVideos();
        const idx = visible.findIndex(v => v.path === select.value);
        if (idx !== -1 && idx < visible.length - 1) { select.value = visible[idx + 1].path; loadVideo(visible[idx + 1]); }
    });

    function loadVideo(v) {
        video.src = v.path;
        video.load();
        markIn = null;
        markOut = null;
        updateRangeDisplay();
        const saved = localStorage.getItem(`labels_${v.id}`);
        labels = saved ? JSON.parse(saved) : [];
        const savedTags = localStorage.getItem(`video_tags_${v.id}`);
        videoTags = savedTags ? JSON.parse(savedTags) : [];
        videoSplit = localStorage.getItem(`video_split_${v.id}`) || 'unassigned';
        renderLabels();
        renderTagger();
        renderSplit();
    }

    // Time display
    video.addEventListener('timeupdate', updateTimeDisplay);
    video.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(video.duration);
    });

    function updateTimeDisplay() {
        currentTimeEl.textContent = formatTime(video.currentTime);
        frameEl.textContent = Math.round(video.currentTime * fps);
    }

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    function formatTimeMs(s) {
        const m = Math.floor(s / 60);
        const sec = (s % 60).toFixed(1);
        return `${m}:${sec.padStart(4, '0')}`;
    }

    // Scrub controls
    function seek(e, delta) {
        e.preventDefault();
        e.stopPropagation();
        if (video.readyState < 1) return; // metadata not loaded yet
        const t = video.currentTime + delta;
        video.currentTime = Math.max(0, Math.min(video.duration, t));
    }

    container.querySelector('#btn-back-5').addEventListener('click', (e) => seek(e, -5));
    container.querySelector('#btn-back-1').addEventListener('click', (e) => seek(e, -1));
    container.querySelector('#btn-fwd-1').addEventListener('click', (e) => seek(e, 1));
    container.querySelector('#btn-fwd-5').addEventListener('click', (e) => seek(e, 5));
    container.querySelector('#btn-prev-frame').addEventListener('click', (e) => seek(e, -1 / fps));
    container.querySelector('#btn-next-frame').addEventListener('click', (e) => seek(e, 1 / fps));



    // Range controls
    container.querySelector('#btn-mark-in').addEventListener('click', () => {
        markIn = Math.round(video.currentTime * 1000) / 1000;
        if (markOut !== null && markOut < markIn) markOut = null;
        updateRangeDisplay();
    });

    container.querySelector('#btn-mark-out').addEventListener('click', () => {
        markOut = Math.round(video.currentTime * 1000) / 1000;
        if (markIn !== null && markIn > markOut) markIn = null;
        updateRangeDisplay();
    });

    container.querySelector('#btn-clear-range').addEventListener('click', () => {
        markIn = null;
        markOut = null;
        updateRangeDisplay();
    });

    function updateRangeDisplay() {
        if (markIn === null && markOut === null) {
            rangeDisplay.textContent = 'No range — labels single frame';
            rangeDisplay.className = 'range-display';
        } else {
            const inStr = markIn !== null ? formatTimeMs(markIn) : '?';
            const outStr = markOut !== null ? formatTimeMs(markOut) : '?';
            const inF = markIn !== null ? Math.round(markIn * fps) : '?';
            const outF = markOut !== null ? Math.round(markOut * fps) : '?';
            rangeDisplay.textContent = `${inStr} (f${inF}) → ${outStr} (f${outF})`;
            rangeDisplay.className = 'range-display range-active';
        }
    }

    // Labeling
    container.querySelector('#btn-add-label').addEventListener('click', addLabel);
    poseInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addLabel();
    });

    function addLabel() {
        const text = poseInput.value.trim();
        if (!text) return;
        const v = videos.find(v => v.path === select.value);

        const currentTime = Math.round(video.currentTime * 1000) / 1000;
        const startTime = markIn !== null ? markIn : currentTime;
        const endTime = markOut !== null ? markOut : (markIn !== null && currentTime > markIn ? currentTime : startTime);

        labels.push({
            videoId: v ? v.id : 'unknown',
            startTime,
            endTime,
            startFrame: Math.round(startTime * fps),
            endFrame: Math.round(endTime * fps),
            label: text,
        });
        poseInput.value = '';
        markIn = null;
        markOut = null;
        updateRangeDisplay();
        saveLabels(v);
        renderLabels();
    }

    function saveLabels(v) {
        if (v) localStorage.setItem(`labels_${v.id}`, JSON.stringify(labels));
    }

    function renderLabels() {
        if (labels.length === 0) {
            labelsList.innerHTML = '<p class="labeler-empty">No labels yet. Scrub to a pose and add a label.</p>';
            return;
        }
        const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
        labelsList.innerHTML = sorted.map((l) => {
            const isRange = l.startFrame !== l.endFrame;
            const timeStr = isRange
                ? `${formatTime(l.startTime)} → ${formatTime(l.endTime)}`
                : formatTime(l.startTime);
            const frameStr = isRange
                ? `f${l.startFrame}–${l.endFrame}`
                : `f${l.startFrame}`;
            const idx = labels.indexOf(l);
            return `
                <div class="label-entry">
                    <span class="label-time" data-time="${l.startTime}">${timeStr}</span>
                    <span class="label-frame">${frameStr}</span>
                    <span class="label-text" contenteditable="true" data-index="${idx}">${l.label}</span>
                    <button type="button" class="label-delete" data-index="${idx}">&times;</button>
                </div>
            `;
        }).join('');

        // Edit label text inline
        labelsList.querySelectorAll('.label-text').forEach(el => {
            el.addEventListener('blur', () => {
                const idx = parseInt(el.dataset.index);
                labels[idx].label = el.textContent.trim();
                const v = videos.find(v => v.path === select.value);
                saveLabels(v);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
            });
        });

        // Click time to seek
        labelsList.querySelectorAll('.label-time').forEach(el => {
            el.addEventListener('click', () => {
                video.currentTime = parseFloat(el.dataset.time);
            });
        });

        // Delete
        labelsList.querySelectorAll('.label-delete').forEach(el => {
            el.addEventListener('click', () => {
                labels.splice(parseInt(el.dataset.index), 1);
                const v = videos.find(v => v.path === select.value);
                saveLabels(v);
                renderLabels();
            });
        });
    }

    // Split selector
    const splitSelector = container.querySelector('#split-selector');
    splitSelector.querySelectorAll('.split-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            videoSplit = btn.dataset.split;
            const v = videos.find(v => v.path === select.value);
            if (v) localStorage.setItem(`video_split_${v.id}`, videoSplit);
            renderSplit();
        });
    });

    function renderSplit() {
        splitSelector.querySelectorAll('.split-btn').forEach(btn => {
            btn.classList.toggle('split-active', btn.dataset.split === videoSplit);
        });
    }

    // Tagger
    const chipsEl = container.querySelector('#tagger-chips');
    const tagInput = container.querySelector('#tag-input');

    container.querySelector('#btn-add-tag').addEventListener('click', addTag);
    tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTag(); });

    function addTag() {
        const text = tagInput.value.trim().toLowerCase();
        if (!text) return;
        if (!allTags.includes(text)) {
            allTags.push(text);
            localStorage.setItem('all_tags', JSON.stringify(allTags));
        }
        if (!videoTags.includes(text)) {
            videoTags.push(text);
            saveVideoTags();
        }
        tagInput.value = '';
        renderTagger();
    }

    function saveVideoTags() {
        const v = videos.find(v => v.path === select.value);
        if (v) localStorage.setItem(`video_tags_${v.id}`, JSON.stringify(videoTags));
    }

    function renderTagger() {
        chipsEl.innerHTML = allTags.map(tag => {
            const active = videoTags.includes(tag);
            return `
                <span class="tag-chip-wrap">
                    <button class="tag-chip ${active ? 'tag-active' : ''}" data-tag="${tag}">${tag}</button>
                    <button class="tag-delete" data-tag="${tag}" title="Delete tag">&times;</button>
                </span>`;
        }).join('');

        chipsEl.querySelectorAll('.tag-chip').forEach(el => {
            el.addEventListener('click', () => {
                const tag = el.dataset.tag;
                if (videoTags.includes(tag)) {
                    videoTags = videoTags.filter(t => t !== tag);
                } else {
                    videoTags.push(tag);
                }
                saveVideoTags();
                renderTagger();
            });
        });

        chipsEl.querySelectorAll('.tag-delete').forEach(el => {
            el.addEventListener('click', () => {
                const tag = el.dataset.tag;
                allTags = allTags.filter(t => t !== tag);
                videoTags = videoTags.filter(t => t !== tag);
                localStorage.setItem('all_tags', JSON.stringify(allTags));
                saveVideoTags();
                renderTagger();
            });
        });
    }

    function buildPayload(v) {
        const savedLabels = JSON.parse(localStorage.getItem(`labels_${v.id}`) || '[]');
        const savedTags   = JSON.parse(localStorage.getItem(`video_tags_${v.id}`) || '[]');
        const savedSplit  = localStorage.getItem(`video_split_${v.id}`) || 'unassigned';
        return { id: v.id, filename: v.filename, split: savedSplit, tags: savedTags, labels: savedLabels };
    }

    function download(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Export current video
    container.querySelector('#btn-export').addEventListener('click', () => {
        const v = videos.find(v => v.path === select.value);
        if (!v) return;
        download(`${v.id}_labels.json`, buildPayload(v));
    });

    // Export all videos as a single JSON array
    container.querySelector('#btn-export-all').addEventListener('click', () => {
        const all = videos.map(v => buildPayload(v));
        download('all_labels.json', all);
    });

    return container;
}
