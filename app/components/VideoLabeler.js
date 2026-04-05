/**
 * Video labeling widget.
 * Loads videos from videos.json manifest, lets user scrub through
 * and label a single frame or a range of frames with a pose name.
 */
export function VideoLabeler() {
    const container = document.createElement('div');
    container.className = 'labeler';

    container.innerHTML = `
        <div class="labeler-header">
            <h3>Pose Labeler</h3>
            <div class="labeler-video-select">
                <select id="video-select">
                    <option value="">Loading videos...</option>
                </select>
            </div>
        </div>
        <div class="labeler-workspace">
            <div class="labeler-player">
                <video id="labeler-video" controls></video>
                <div class="labeler-time">
                    <span id="labeler-current-time">0:00</span> / <span id="labeler-duration">0:00</span>
                    &mdash; Frame: <span id="labeler-frame">0</span>
                </div>
            </div>
            <div class="labeler-controls">
                <div class="labeler-scrub">
                    <button class="btn btn-secondary btn-sm" id="btn-back-5">-5s</button>
                    <button class="btn btn-secondary btn-sm" id="btn-back-1">-1s</button>
                    <button class="btn btn-secondary btn-sm" id="btn-prev-frame">&lt; Frame</button>
                    <button class="btn btn-secondary btn-sm" id="btn-next-frame">Frame &gt;</button>
                    <button class="btn btn-secondary btn-sm" id="btn-fwd-1">+1s</button>
                    <button class="btn btn-secondary btn-sm" id="btn-fwd-5">+5s</button>
                </div>
                <div class="labeler-range">
                    <button class="btn btn-secondary btn-sm" id="btn-mark-in">Set In</button>
                    <span class="range-display" id="range-display">No range set</span>
                    <button class="btn btn-secondary btn-sm" id="btn-mark-out">Set Out</button>
                    <button class="btn btn-secondary btn-sm" id="btn-clear-range">Clear</button>
                </div>
                <div class="labeler-input">
                    <input type="text" id="pose-label" placeholder="Enter pose name..." />
                    <button class="btn btn-primary btn-sm" id="btn-add-label">Label</button>
                </div>
                <div class="labeler-labels" id="labels-list">
                    <p class="labeler-empty">No labels yet. Scrub to a pose and add a label.</p>
                </div>
                <div class="labeler-section-title">Dataset Split</div>
                <div class="split-selector" id="split-selector">
                    <button class="split-btn" data-split="train">Train</button>
                    <button class="split-btn" data-split="test">Test</button>
                    <button class="split-btn" data-split="unused">Unused</button>
                    <button class="split-btn" data-split="unassigned">Unassigned</button>
                </div>
                <div class="labeler-section-title">Video Tags</div>
                <div class="tagger-chips" id="tagger-chips"></div>
                <div class="tagger-input-row">
                    <input type="text" id="tag-input" placeholder="New tag..." />
                    <button class="btn btn-secondary btn-sm" id="btn-add-tag">Add</button>
                </div>
                <div class="labeler-actions">
                    <button class="btn btn-secondary btn-sm" id="btn-export">Export Labels (JSON)</button>
                </div>
            </div>
        </div>
    `;

    // State
    let videos = [];
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

    // Load manifest
    fetch('app/videos.json')
        .then(r => r.json())
        .then(data => {
            videos = data;
            select.innerHTML = videos.map(v =>
                `<option value="${v.path}">${v.filename}</option>`
            ).join('');
            if (videos.length > 0) loadVideo(videos[0]);
        })
        .catch(() => {
            select.innerHTML = '<option>No videos found — run generate_manifest.py</option>';
        });

    select.addEventListener('change', () => {
        const v = videos.find(v => v.path === select.value);
        if (v) loadVideo(v);
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
    container.querySelector('#btn-back-5').addEventListener('click', () => seek(-5));
    container.querySelector('#btn-back-1').addEventListener('click', () => seek(-1));
    container.querySelector('#btn-fwd-1').addEventListener('click', () => seek(1));
    container.querySelector('#btn-fwd-5').addEventListener('click', () => seek(5));
    container.querySelector('#btn-prev-frame').addEventListener('click', () => seek(-1 / fps));
    container.querySelector('#btn-next-frame').addEventListener('click', () => seek(1 / fps));

    function seek(delta) {
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
    }

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
            return `
                <div class="label-entry">
                    <span class="label-time" data-time="${l.startTime}">${timeStr}</span>
                    <span class="label-frame">${frameStr}</span>
                    <span class="label-text">${l.label}</span>
                    <button class="label-delete" data-index="${labels.indexOf(l)}">&times;</button>
                </div>
            `;
        }).join('');

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

    // Export
    container.querySelector('#btn-export').addEventListener('click', () => {
        const v = videos.find(v => v.path === select.value);
        const payload = {
            id: v ? v.id : 'unknown',
            filename: v ? v.filename : 'unknown',
            split: videoSplit,
            tags: videoTags,
            labels,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${v ? v.id : 'labels'}_labels.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    return container;
}
