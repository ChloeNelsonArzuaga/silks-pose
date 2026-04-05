export function Dataset() {
    const page = document.createElement('div');
    page.className = 'page page-dataset';

    page.innerHTML = `
        <h2>Dataset Overview</h2>
        <p>Review and assign all videos to train, test, or unused splits.</p>
        <div class="dataset-toolbar">
            <div class="dataset-filters">
                <button class="filter-btn filter-active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="unassigned">Unassigned</button>
                <button class="filter-btn" data-filter="train">Train</button>
                <button class="filter-btn" data-filter="test">Test</button>
                <button class="filter-btn" data-filter="unused">Unused</button>
            </div>
            <div class="dataset-toolbar-right">
                <div class="dataset-stats" id="dataset-stats"></div>
                <button class="btn btn-secondary btn-sm" id="btn-thumbnails">Thumbnails: Off</button>
            </div>
        </div>
        <div class="dataset-grid" id="dataset-grid">
            <p class="labeler-empty">Loading videos...</p>
        </div>
    `;

    let videos = [];
    let activeFilter = 'all';
    let thumbnailsOn = false;

    const grid = page.querySelector('#dataset-grid');
    const statsEl = page.querySelector('#dataset-stats');
    const thumbBtn = page.querySelector('#btn-thumbnails');

    // Thumbnail toggle
    thumbBtn.addEventListener('click', () => {
        thumbnailsOn = !thumbnailsOn;
        thumbBtn.textContent = `Thumbnails: ${thumbnailsOn ? 'On' : 'Off'}`;
        thumbBtn.classList.toggle('filter-active', thumbnailsOn);
        renderGrid();
    });

    // Load manifest
    fetch('app/videos.json')
        .then(r => r.json())
        .then(data => {
            videos = data.map(v => ({
                ...v,
                split: localStorage.getItem(`video_split_${v.id}`) || v.split || 'unassigned',
                tags: JSON.parse(localStorage.getItem(`video_tags_${v.id}`) || JSON.stringify(v.tags || [])),
                labels: JSON.parse(localStorage.getItem(`labels_${v.id}`) || JSON.stringify(v.labels || [])),
            }));
            renderStats();
            renderGrid();
        })
        .catch(() => {
            grid.innerHTML = '<p class="labeler-empty">No videos found — run generate_manifest.py</p>';
        });

    // Filters
    page.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            page.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-active'));
            btn.classList.add('filter-active');
            activeFilter = btn.dataset.filter;
            renderGrid();
        });
    });

    function renderStats() {
        const counts = { train: 0, test: 0, unused: 0, unassigned: 0 };
        videos.forEach(v => counts[v.split] = (counts[v.split] || 0) + 1);
        statsEl.innerHTML = `
            <span class="stat-pill stat-train">${counts.train} train</span>
            <span class="stat-pill stat-test">${counts.test} test</span>
            <span class="stat-pill stat-unused">${counts.unused} unused</span>
            <span class="stat-pill stat-unassigned">${counts.unassigned} unassigned</span>
        `;
    }

    function renderGrid() {
        const filtered = activeFilter === 'all' ? videos : videos.filter(v => v.split === activeFilter);
        if (filtered.length === 0) {
            grid.innerHTML = `<p class="labeler-empty">No videos in this category.</p>`;
            return;
        }

        grid.innerHTML = filtered.map(v => `
            <div class="dataset-card" data-id="${v.id}">
                ${thumbnailsOn ? `<div class="dataset-thumb-wrap"><canvas class="dataset-thumb" data-src="${v.path}"></canvas></div>` : ''}
                <div class="dataset-card-name">${v.filename}</div>
                <div class="dataset-card-meta">
                    <span class="label-count">${v.labels.length} label${v.labels.length !== 1 ? 's' : ''}</span>
                    ${v.tags.length > 0 ? v.tags.map(t => `<span class="mini-tag">${t}</span>`).join('') : ''}
                </div>
                <div class="dataset-card-split">
                    <button class="split-btn ${v.split === 'train' ? 'split-active' : ''}" data-split="train" data-id="${v.id}">Train</button>
                    <button class="split-btn ${v.split === 'test' ? 'split-active' : ''}" data-split="test" data-id="${v.id}">Test</button>
                    <button class="split-btn ${v.split === 'unused' ? 'split-active' : ''}" data-split="unused" data-id="${v.id}">Unused</button>
                    <button class="split-btn ${v.split === 'unassigned' ? 'split-active' : ''}" data-split="unassigned" data-id="${v.id}">—</button>
                </div>
                <a class="btn btn-secondary btn-sm dataset-card-open" href="#/admin">Open in Labeler</a>
            </div>
        `).join('');

        // Wire split buttons
        grid.querySelectorAll('.split-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const split = btn.dataset.split;
                const v = videos.find(v => v.id === id);
                if (!v) return;
                v.split = split;
                localStorage.setItem(`video_split_${id}`, split);
                renderStats();
                renderGrid();
            });
        });

        // Generate thumbnails
        if (thumbnailsOn) {
            grid.querySelectorAll('canvas.dataset-thumb').forEach(canvas => {
                captureMidframe(canvas, canvas.dataset.src);
            });
        }
    }

    function captureMidframe(canvas, src) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.preload = 'metadata';

        vid.addEventListener('loadedmetadata', () => {
            vid.currentTime = vid.duration / 2;
        });

        vid.addEventListener('seeked', () => {
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            canvas.getContext('2d').drawImage(vid, 0, 0);
            vid.src = ''; // free memory
        });
    }

    return page;
}
