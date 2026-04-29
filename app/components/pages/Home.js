import { supabase } from '../../lib/supabase.js';
import { fetchVideos, getSignedUrl, updateVideo } from '../../lib/videos.js';
import { IS_LOCAL } from '../../lib/dataSource.js';

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
                    <button class="lib-select-btn" id="lib-select-btn">Select</button>
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

        <!-- Video player modal -->
        <div class="player-modal-bg" id="player-modal-bg">
            <div class="player-modal">
                <div class="player-modal-header">
                    <div class="player-modal-title" id="player-title"></div>
                    <button class="coll-modal-close" id="player-close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <video class="player-video" id="player-video" controls playsinline></video>
                <div class="player-tags" id="player-tags"></div>
                <div class="player-label-row">
                    <input class="player-label-input" type="text" id="player-label-input" placeholder="Add a pose label…">
                    <button class="btn btn-primary btn-sm" id="player-label-btn">Add</button>
                </div>
            </div>
        </div>

        <!-- Selection action bar -->
        <div class="lib-action-bar" id="lib-action-bar" hidden>
            <span class="lib-action-count" id="lib-action-count">0 selected</span>
            <div class="lib-action-btns">
                <button class="btn btn-primary" id="lib-move-btn">Move to Collection</button>
                <button class="btn btn-secondary" id="lib-cancel-select">Cancel</button>
            </div>
        </div>

        <!-- Collection picker modal -->
        <div class="coll-modal-bg" id="lib-coll-modal-bg">
            <div class="coll-modal">
                <div class="coll-modal-header">
                    <h2 class="coll-modal-title">Move to Collection</h2>
                    <button class="coll-modal-close" id="lib-coll-modal-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="coll-picker-list" id="coll-picker-list"></div>
                <div class="coll-modal-actions">
                    <button class="btn btn-secondary" id="lib-coll-cancel">Cancel</button>
                </div>
            </div>
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
    const actionBar = page.querySelector('#lib-action-bar');
    const actionCount = page.querySelector('#lib-action-count');
    const collModalBg = page.querySelector('#lib-coll-modal-bg');
    const collPickerList = page.querySelector('#coll-picker-list');

    let selectMode = false;
    let selectedIds = new Set();

    const playerModalBg = page.querySelector('#player-modal-bg');
    const playerVideo = page.querySelector('#player-video');
    const playerTitle = page.querySelector('#player-title');
    const playerTags = page.querySelector('#player-tags');
    const playerLabelInput = page.querySelector('#player-label-input');
    const playerLabelBtn = page.querySelector('#player-label-btn');

    let currentPlayerVideo = null;

    async function openPlayer(v) {
        currentPlayerVideo = v;
        const name = v.customName || getPoses(v)[0] || v.filename.replace(/\.[^.]+$/, '');
        playerTitle.textContent = name;
        const url = await getSignedUrl(v.storage_path || v.path);
        playerVideo.src = url || '';
        if (url) playerVideo.play().catch(() => {});
        playerTags.innerHTML = renderPills(getPoses(v), getTags(v));
        playerLabelInput.value = '';
        playerModalBg.classList.add('is-open');
    }

    async function addPlayerLabel() {
        const text = playerLabelInput.value.trim();
        if (!text || !currentPlayerVideo) return;
        const v = currentPlayerVideo;
        if (!(v.poses || []).map(p => p.toLowerCase()).includes(text.toLowerCase())) {
            v.poses = [...(v.poses || []), text];
            playerTags.innerHTML = renderPills(getPoses(v), getTags(v));
            updateVideo(v.id, { poses: v.poses });
        }
        playerLabelInput.value = '';
        // Refresh the card in the grid
        const card = grid.querySelector(`.lib-card[data-id="${v.id}"]`);
        if (card) {
            const posePills = card.querySelector('.lib-card-tags');
            if (posePills) posePills.innerHTML = renderPills(getPoses(v).slice(0, 3), getTags(v).slice(0, 3));
        }
    }

    playerLabelBtn.addEventListener('click', addPlayerLabel);
    playerLabelInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayerLabel(); });

    function closePlayer() {
        playerModalBg.classList.remove('is-open');
        playerVideo.pause();
        playerVideo.src = '';
        currentPlayerVideo = null;
    }

    page.querySelector('#player-close').addEventListener('click', closePlayer);
    playerModalBg.addEventListener('click', e => { if (e.target === playerModalBg) closePlayer(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePlayer(); });

    async function loadAndRender() {
        try {
            allVideos = await fetchVideos();
            filteredVideos = allVideos;
            if (!allVideos.length) {
                grid.innerHTML = IS_LOCAL
                    ? '<p class="lib-empty">No videos found — run utils/generate_manifest.py</p>'
                    : '<p class="lib-empty">No videos yet — click Upload to add one.</p>';
                return;
            }
            renderPage();
        } catch (e) {
            console.error('[home] fetch videos failed:', e);
            grid.innerHTML = `<p class="lib-empty">Couldn't load videos: ${e.message}</p>`;
        }
    }
    loadAndRender();
    window.addEventListener('video-uploaded', loadAndRender);

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

    // Select mode
    page.querySelector('#lib-select-btn').addEventListener('click', () => {
        selectMode = true;
        selectedIds.clear();
        page.querySelector('#lib-select-btn').hidden = true;
        actionBar.classList.add('is-open');
        updateActionCount();
        renderPage();
    });

    page.querySelector('#lib-cancel-select').addEventListener('click', exitSelectMode);

    function exitSelectMode() {
        selectMode = false;
        selectedIds.clear();
        page.querySelector('#lib-select-btn').hidden = false;
        actionBar.classList.remove('is-open');
        renderPage();
    }

    function updateActionCount() {
        actionCount.textContent = `${selectedIds.size} selected`;
        page.querySelector('#lib-move-btn').disabled = selectedIds.size === 0;
    }

    page.querySelector('#lib-move-btn').addEventListener('click', () => {
        const collections = JSON.parse(localStorage.getItem('collections') || '[]');
        renderCollPicker(collections);
        collModalBg.classList.add('is-open');
    });

    function renderCollPicker(collections) {
        collPickerList.innerHTML = collections.map(c => `
            <button class="coll-picker-item" data-id="${c.id}">
                <div class="coll-picker-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div>
                    <div class="coll-picker-name">${c.name}</div>
                    <div class="coll-picker-count">${(c.videoIds || []).length} videos</div>
                </div>
            </button>
        `).join('') + `
            <button class="coll-picker-item coll-picker-new" id="coll-picker-new-btn">
                <div class="coll-picker-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div>
                    <div class="coll-picker-name">New Collection</div>
                    <div class="coll-picker-count">Create and add</div>
                </div>
            </button>
        `;

        collPickerList.querySelectorAll('.coll-picker-item:not(.coll-picker-new)').forEach(btn => {
            btn.addEventListener('click', () => addToCollection(btn.dataset.id));
        });

        collPickerList.querySelector('#coll-picker-new-btn').addEventListener('click', () => {
            collPickerList.innerHTML = `
                <div class="coll-picker-inline-form">
                    <input class="login-input" type="text" id="coll-picker-name" placeholder="Collection name" required>
                    <div class="coll-picker-inline-actions">
                        <button class="btn btn-secondary" id="coll-picker-back">Back</button>
                        <button class="btn btn-primary" id="coll-picker-create">Create & Add</button>
                    </div>
                </div>
            `;
            const nameInput = collPickerList.querySelector('#coll-picker-name');
            nameInput.focus();
            collPickerList.querySelector('#coll-picker-back').addEventListener('click', () => {
                renderCollPicker(JSON.parse(localStorage.getItem('collections') || '[]'));
            });
            collPickerList.querySelector('#coll-picker-create').addEventListener('click', () => {
                const name = nameInput.value.trim();
                if (!name) return;
                const collections = JSON.parse(localStorage.getItem('collections') || '[]');
                const newColl = { id: crypto.randomUUID(), name, description: '', tags: [], videoIds: [], favorite: false, createdAt: Date.now() };
                collections.unshift(newColl);
                localStorage.setItem('collections', JSON.stringify(collections));
                addToCollection(newColl.id);
            });
        });
    }

    function addToCollection(collId) {
        const collections = JSON.parse(localStorage.getItem('collections') || '[]');
        const coll = collections.find(c => c.id === collId);
        if (!coll) return;
        coll.videoIds = [...new Set([...(coll.videoIds || []), ...selectedIds])];
        localStorage.setItem('collections', JSON.stringify(collections));
        closeCollModal();
        exitSelectMode();
        const toast = document.createElement('div');
        toast.className = 'upload-toast';
        toast.textContent = `${selectedIds.size} video${selectedIds.size !== 1 ? 's' : ''} added to "${coll.name}"`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('toast-visible'), 10);
        setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 300); }, 3000);
    }

    function closeCollModal() { collModalBg.classList.remove('is-open'); }
    page.querySelector('#lib-coll-modal-close').addEventListener('click', closeCollModal);
    page.querySelector('#lib-coll-cancel').addEventListener('click', closeCollModal);
    collModalBg.addEventListener('click', e => { if (e.target === collModalBg) closeCollModal(); });

    function getPoses(video) {
        const seen = new Set();
        const out = [];
        const add = name => {
            const trimmed = name && name.trim();
            if (!trimmed) return;
            const k = trimmed.toLowerCase();
            if (seen.has(k)) return;
            seen.add(k);
            out.push(trimmed);
        };
        (video.poses || []).forEach(add);
        (video.labels || []).forEach(l => add(l.label));
        return out;
    }
    function getTags(video) {
        return (video.tags || []).filter(Boolean);
    }
    function renderPills(poses, tags) {
        return [
            ...poses.map(t => `<span class="lib-tag">${t}</span>`),
            ...tags.map(t => `<span class="lib-tag lib-tag-meta">${t}</span>`),
        ].join('');
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

        // Delete buttons
        grid.querySelectorAll('.lib-card-delete-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const v = allVideos.find(v => v.id === id);
                if (!v) return;
                const name = getCardName(v) || v.filename;
                if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
                if (!IS_LOCAL) {
                    if (v.storage_path) await supabase.storage.from('videos').remove([v.storage_path]);
                    if (v.thumbnail_path) await supabase.storage.from('thumbnails').remove([v.thumbnail_path]);
                    await supabase.from('videos').delete().eq('id', id);
                }
                allVideos = allVideos.filter(x => x.id !== id);
                filteredVideos = filteredVideos.filter(x => x.id !== id);
                renderPage();
            });
        });

        // Card clicks
        grid.querySelectorAll('.lib-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.fav-btn') || e.target.closest('.lib-card-edit-btn') || e.target.closest('.lib-card-delete-btn')) return;
                const id = card.dataset.id;
                if (selectMode) {
                    if (selectedIds.has(id)) selectedIds.delete(id);
                    else selectedIds.add(id);
                    updateActionCount();
                    renderPage();
                } else {
                    const v = allVideos.find(v => v.id === id);
                    if (v) openPlayer(v);
                }
            });
        });

        // Thumbnails
        grid.querySelectorAll('canvas[data-src]').forEach(canvas => {
            captureMidframe(canvas, canvas.dataset.src, canvas.dataset.id);
        });

        // Name edit
        grid.querySelectorAll('.lib-card-edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const v = allVideos.find(v => v.id === id);
                if (!v) return;
                const titleEl = grid.querySelector(`.lib-card-title[data-id="${id}"]`);
                const current = getCardName(v);
                const input = document.createElement('input');
                input.className = 'lib-card-title-input';
                input.value = current;
                titleEl.replaceWith(input);
                input.focus();
                input.select();
                function save() {
                    const val = input.value.trim() || current;
                    v.customName = val;
                    localStorage.setItem(`name_${id}`, val);
                    updateVideo(id, { custom_name: val });
                    const span = document.createElement('span');
                    span.className = 'lib-card-title';
                    span.dataset.id = id;
                    span.textContent = val;
                    input.replaceWith(span);
                }
                input.addEventListener('blur', save);
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') { input.value = current; input.blur(); }
                });
            });
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
                updateVideo(id, { favorite: v.favorite });
                btn.classList.toggle('fav-active', v.favorite);
                btn.querySelector('svg').setAttribute('fill', v.favorite ? 'currentColor' : 'none');
            });
        });

        renderPagination(totalPages);

        // Footer count
        const countEl = page.querySelector('#lib-count');
        if (countEl) countEl.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filteredVideos.length)} of ${filteredVideos.length} videos`;
    }

    function getCardName(v) {
        if (v.customName) return v.customName;
        const first = getPoses(v)[0];
        return first || '';
    }

    function renderCard(v) {
        const poses = getPoses(v).slice(0, 3);
        const tags = getTags(v).slice(0, 3);
        const name = getCardName(v);
        const isSelected = selectedIds.has(v.id);
        return `
            <div class="lib-card ${selectMode ? 'lib-card-selectable' : ''} ${isSelected ? 'lib-card-selected' : ''}" data-id="${v.id}">
                ${selectMode ? `<div class="lib-card-checkbox ${isSelected ? 'lib-card-checkbox-checked' : ''}">
                    ${isSelected ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </div>` : ''}
                <div class="lib-card-thumb-wrap">
                    <canvas class="lib-card-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}" data-id="${v.id}"></canvas>
                </div>
                <div class="lib-card-body">
                    <div class="lib-card-top">
                        <div class="lib-card-title-wrap">
                            <span class="lib-card-title" data-id="${v.id}">${name}</span>
                            <button class="lib-card-edit-btn" data-id="${v.id}" title="Rename">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="lib-card-delete-btn" data-id="${v.id}" title="Delete">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                        </div>
                        <button class="fav-btn ${v.favorite ? 'fav-active' : ''}" data-id="${v.id}" title="Favorite">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="${v.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                    </div>
                    <div class="lib-card-tags">${renderPills(poses, tags)}</div>
                </div>
            </div>
        `;
    }

    function renderListRow(v) {
        const poses = getPoses(v).slice(0, 4);
        const tags = getTags(v).slice(0, 4);

        return `
            <div class="lib-row">
                <canvas class="lib-row-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}"></canvas>
                <div class="lib-row-info">
                    <div class="lib-row-tags">${renderPills(poses, tags)}</div>
                </div>
                <div class="lib-row-tags">${renderPills(poses, tags)}</div>
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
        const poses = getPoses(v);
        if (poses.length < 2 || poses[0].toLowerCase().includes('cats crad')) {
            const first = (v.labels || []).find(l => l.label && l.label.trim());
            return first != null ? first.startTime : '';
        }
        const second = poses[1];
        const match = (v.labels || []).find(l => l.label && l.label.trim().toLowerCase() === second.toLowerCase());
        return match != null ? match.startTime : '';
    }

    function drawToCanvas(canvas, source) {
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 220;
        const ch = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 138;
        const vw = source.videoWidth || source.naturalWidth;
        const vh = source.videoHeight || source.naturalHeight;
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.filter = 'blur(18px) brightness(0.85)';
        ctx.drawImage(source, -cw * 0.1, -ch * 0.1, cw * 1.2, ch * 1.2);
        ctx.filter = 'none';
        const scale = Math.min(cw / vw, ch / vh);
        ctx.drawImage(source, (cw - vw * scale) / 2, (ch - vh * scale) / 2, vw * scale, vh * scale);
    }

    async function uploadThumbnail(canvas, videoId) {
        return new Promise(resolve => {
            canvas.toBlob(async blob => {
                if (!blob) { console.warn('[thumb] toBlob returned null for', videoId); return resolve(); }
                const { error } = await supabase.storage.from('thumbnails').upload(`${videoId}.jpg`, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });
                if (error) console.error('[thumb] upload failed for', videoId, error.message);
                else console.log('[thumb] uploaded', videoId);
                resolve();
            }, 'image/jpeg', 0.85);
        });
    }

    function captureMidframe(canvas, src, videoId) {
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(`${videoId}.jpg`);
        const img = new Image();
        img.onload = () => drawToCanvas(canvas, img);
        img.onerror = () => captureFromVideo(canvas, src, videoId);
        img.src = publicUrl + '?t=1';
    }

    function captureFromVideo(canvas, src, videoId, onDone) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.muted = true;
        vid.preload = 'metadata';
        const seekTo = canvas.dataset?.seek !== '' ? parseFloat(canvas.dataset?.seek) : null;
        vid.addEventListener('loadedmetadata', () => {
            vid.currentTime = (seekTo !== null && !isNaN(seekTo)) ? seekTo : vid.duration / 2;
        });
        vid.addEventListener('seeked', () => {
            drawToCanvas(canvas, vid);
            vid.src = '';
            if (onDone) onDone(canvas);
            else uploadThumbnail(canvas, videoId);
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
