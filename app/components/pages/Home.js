export function Home() {
    const page = document.createElement('div');
    page.className = 'page page-home';

    page.innerHTML = `
        <div class="lib-page">
            <!-- Page header -->
            <div class="lib-page-header">
                <div>
                    <h1 class="lib-title">My Library</h1>
                    <p class="lib-subtitle">All your uploaded videos in one place.</p>
                </div>
            </div>

            <!-- Toolbar -->
            <div class="lib-toolbar">
                <div class="lib-toolbar-left">
                    <div class="lib-search-wrap">
                        <svg class="lib-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input class="lib-search" type="text" id="lib-search" placeholder="Search videos..." autocomplete="off">
                    </div>
                </div>
                <div class="lib-toolbar-right">
                    <button class="lib-view-btn lib-view-active" id="view-grid" title="Grid view">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    </button>
                    <button class="lib-view-btn" id="view-list" title="List view">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </button>
                </div>
            </div>

            <!-- Grid -->
            <div class="lib-grid" id="lib-grid">
                <p class="lib-empty">Loading videos...</p>
            </div>

            <!-- Pagination -->
            <div class="lib-pagination" id="lib-pagination"></div>
        </div>

        <input type="file" id="file-input" accept="video/*" hidden>
    `;

    const SHOW_SPLITS = new Set(['labeled', 'train', 'test']);
    const PAGE_SIZE = 10;
    let allVideos = [];
    let filteredVideos = [];
    let currentPage = 1;
    let viewMode = 'grid';

    const grid = page.querySelector('#lib-grid');
    const searchInput = page.querySelector('#lib-search');
    const pagination = page.querySelector('#lib-pagination');

    fetch('app/videos.json')
        .then(r => r.json())
        .then(data => {
            allVideos = data
                .filter(v => SHOW_SPLITS.has(v.split || 'unassigned') || true) // show all for now
                .map(v => ({
                    ...v,
                    labels: JSON.parse(localStorage.getItem(`labels_${v.id}`) || JSON.stringify(v.labels || [])),
                    tags: JSON.parse(localStorage.getItem(`video_tags_${v.id}`) || JSON.stringify(v.tags || [])),
                    split: localStorage.getItem(`video_split_${v.id}`) || v.split || 'unassigned',
                    favorite: localStorage.getItem(`fav_${v.id}`) === '1',
                }));
            filteredVideos = allVideos;
            renderPage();
        })
        .catch(() => {
            grid.innerHTML = '<p class="lib-empty">No videos found — run generate_manifest.py</p>';
        });

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        filteredVideos = q
            ? allVideos.filter(v =>
                v.filename.toLowerCase().includes(q) ||
                getPoses(v).some(p => p.toLowerCase().includes(q)) ||
                (v.tags || []).some(t => t.toLowerCase().includes(q))
              )
            : allVideos;
        currentPage = 1;
        renderPage();
    });

    page.querySelector('#view-grid').addEventListener('click', () => {
        viewMode = 'grid';
        page.querySelector('#view-grid').classList.add('lib-view-active');
        page.querySelector('#view-list').classList.remove('lib-view-active');
        renderPage();
    });

    page.querySelector('#view-list').addEventListener('click', () => {
        viewMode = 'list';
        page.querySelector('#view-list').classList.add('lib-view-active');
        page.querySelector('#view-grid').classList.remove('lib-view-active');
        renderPage();
    });

    function getPoses(video) {
        const seen = new Set();
        return (video.labels || [])
            .map(l => l.label && l.label.trim())
            .filter(l => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
    }

    function renderPage() {
        const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
        currentPage = Math.min(currentPage, totalPages);
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageVideos = filteredVideos.slice(start, start + PAGE_SIZE);

        if (filteredVideos.length === 0) {
            grid.innerHTML = '<p class="lib-empty">No videos found.</p>';
            pagination.innerHTML = '';
            return;
        }

        grid.className = viewMode === 'list' ? 'lib-list' : 'lib-grid';
        grid.id = 'lib-grid';

        if (viewMode === 'list') {
            grid.innerHTML = pageVideos.map(v => renderListRow(v)).join('');
        } else {
            grid.innerHTML = pageVideos.map(v => renderCard(v)).join('');
        }

        // Thumbnails
        grid.querySelectorAll('canvas[data-src]').forEach(canvas => {
            captureMidframe(canvas, canvas.dataset.src);
        });

        // Favorite toggles
        grid.querySelectorAll('.fav-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const v = allVideos.find(v => v.id === id);
                if (!v) return;
                v.favorite = !v.favorite;
                localStorage.setItem(`fav_${id}`, v.favorite ? '1' : '0');
                btn.classList.toggle('fav-active', v.favorite);
                btn.querySelector('svg').setAttribute('fill', v.favorite ? 'currentColor' : 'none');
            });
        });

        renderPagination(totalPages);

        // Footer count
        const countEl = page.querySelector('#lib-count');
        if (countEl) countEl.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filteredVideos.length)} of ${filteredVideos.length} videos`;
    }

    function renderCard(v) {
        const poses = getPoses(v);
        const tags = [...poses, ...(v.tags || [])].slice(0, 3);
        const splitColor = { train: 'tag-green', test: 'tag-blue', labeled: 'tag-yellow', unused: 'tag-red', unassigned: '' }[v.split] || '';

        return `
            <div class="lib-card">
                <div class="lib-card-thumb-wrap">
                    <canvas class="lib-card-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}"></canvas>
                </div>
                <div class="lib-card-body">
                    <div class="lib-card-top">
                        <div class="lib-card-title">${v.filename.replace(/\.[^.]+$/, '')}</div>
                        <button class="fav-btn ${v.favorite ? 'fav-active' : ''}" data-id="${v.id}" title="Favorite">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="${v.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                    </div>
                    <div class="lib-card-meta">${v.split !== 'unassigned' ? `<span class="lib-tag ${splitColor}">${v.split}</span>` : ''}</div>
                    <div class="lib-card-tags">${tags.map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                </div>
            </div>
        `;
    }

    function renderListRow(v) {
        const poses = getPoses(v);
        const tags = [...poses, ...(v.tags || [])].slice(0, 4);

        return `
            <div class="lib-row">
                <canvas class="lib-row-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}"></canvas>
                <div class="lib-row-info">
                    <div class="lib-row-title">${v.filename.replace(/\.[^.]+$/, '')}</div>
                    <div class="lib-row-filename">${v.filename}</div>
                </div>
                <div class="lib-row-tags">${tags.map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                <button class="fav-btn ${v.favorite ? 'fav-active' : ''}" data-id="${v.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="${v.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
            </div>
        `;
    }

    function renderPagination(totalPages) {
        if (totalPages <= 1) { pagination.innerHTML = `<div class="lib-count" id="lib-count">Showing ${filteredVideos.length} of ${filteredVideos.length} videos</div>`; return; }

        const maxVisible = 5;
        let pages = [];
        if (totalPages <= maxVisible + 2) {
            pages = Array.from({ length: totalPages }, (_, i) => i + 1);
        } else {
            pages = [1];
            if (currentPage > 3) pages.push('…');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('…');
            pages.push(totalPages);
        }

        pagination.innerHTML = `
            <button class="page-btn page-arrow" id="page-prev" ${currentPage === 1 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            ${pages.map(p => p === '…'
                ? `<span class="page-ellipsis">…</span>`
                : `<button class="page-btn ${p === currentPage ? 'page-active' : ''}" data-page="${p}">${p}</button>`
            ).join('')}
            <button class="page-btn page-arrow" id="page-next" ${currentPage === totalPages ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <span class="lib-count" id="lib-count">Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredVideos.length)} of ${filteredVideos.length} videos</span>
        `;

        pagination.querySelector('#page-prev')?.addEventListener('click', () => { currentPage--; renderPage(); });
        pagination.querySelector('#page-next')?.addEventListener('click', () => { currentPage++; renderPage(); });
        pagination.querySelectorAll('.page-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => { currentPage = +btn.dataset.page; renderPage(); });
        });
    }

    function getThumbTime(v) {
        const first = (v.labels || []).find(l => l.label && l.label.trim());
        return first != null ? first.startTime : '';
    }

    function captureMidframe(canvas, src) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.preload = 'metadata';
        const seekTo = canvas.dataset.seek !== '' ? parseFloat(canvas.dataset.seek) : null;
        vid.addEventListener('loadedmetadata', () => {
            vid.currentTime = (seekTo !== null && !isNaN(seekTo)) ? seekTo : vid.duration / 2;
        });
        vid.addEventListener('seeked', () => {
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            canvas.getContext('2d').drawImage(vid, 0, 0);
            vid.src = '';
        });
    }

    // Upload from file input
    const fileInput = page.querySelector('#file-input');
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const toast = document.createElement('div');
        toast.className = 'upload-toast';
        toast.textContent = `${file.name} — add to data/raw_videos/ and run the pipeline`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('toast-visible'), 10);
        setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 300); }, 4000);
        fileInput.value = '';
    });

    return page;
}
