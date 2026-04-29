import { supabase } from '../../lib/supabase.js';
import { fetchVideos } from '../../lib/videos.js';
import { buildTagCollections, setAutoCollFav } from '../../lib/groups.js';

const SMART = [
    { key: 'recent', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', label: 'Recently Added' },
    { key: 'watched', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>', label: 'Most Watched' },
    { key: 'favorites', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', label: 'Favorites' },
];

export function Collections() {
    const page = document.createElement('div');
    page.className = 'page page-collections';

    page.innerHTML = `
        <!-- Main collections view -->
        <div class="coll-view" id="coll-main-view">
            <div class="coll-page">
                <div class="coll-header-row">
                    <div class="coll-header-text">
                        <h1 class="lib-title">Collections</h1>
                        <p class="coll-desc">Organize your videos your way. Create collections,<br>add tags, and group your training to find what<br>you need—fast.</p>
                    </div>
                    <div class="coll-stats" id="coll-stats">
                        <div class="coll-stat">
                            <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
                            <div><div class="coll-stat-num" id="stat-collections">—</div><div class="coll-stat-label">Collections</div></div>
                        </div>
                        <div class="coll-stat">
                            <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
                            <div><div class="coll-stat-num" id="stat-videos">—</div><div class="coll-stat-label">Videos</div></div>
                        </div>
                        <div class="coll-stat">
                            <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                            <div><div class="coll-stat-num" id="stat-hours">—</div><div class="coll-stat-label">Hours of Footage</div></div>
                        </div>
                        <div class="coll-stat">
                            <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                            <div><div class="coll-stat-num" id="stat-favorites">—</div><div class="coll-stat-label">Favorites</div></div>
                        </div>
                    </div>
                </div>
                <div class="coll-toolbar">
                    <div class="lib-search-wrap coll-search-wrap">
                        <svg class="lib-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input class="lib-search" type="text" id="coll-search" placeholder="Search collections..." autocomplete="off">
                    </div>
                    <div class="coll-toolbar-right">
                        <label class="coll-sort-label">Sort by</label>
                        <select class="coll-sort" id="coll-sort">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="alpha">A–Z</option>
                            <option value="size">Most Videos</option>
                        </select>
                        <button class="lib-view-btn lib-view-active" id="coll-view-grid" title="Grid view">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        </button>
                        <button class="lib-view-btn" id="coll-view-list" title="List view">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                <div class="coll-grid" id="coll-grid"><p class="lib-empty">Loading...</p></div>
                <div class="coll-smart">
                    <div class="coll-smart-header">
                        <div>
                            <div class="coll-smart-title">Smart Collections</div>
                            <div class="coll-smart-sub">Auto-updated collections to help you stay organized.</div>
                        </div>
                    </div>
                    <div class="coll-smart-row" id="coll-smart-row"></div>
                </div>
            </div>
        </div>

        <!-- Detail view (collection videos) -->
        <div class="coll-view" id="coll-detail-view" style="display:none">
            <div class="coll-page">
                <div class="coll-detail-header">
                    <button class="coll-back-btn" id="coll-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        Collections
                    </button>
                    <div class="coll-detail-title-row">
                        <div>
                            <h1 class="lib-title" id="coll-detail-title"></h1>
                            <p class="lib-subtitle" id="coll-detail-desc"></p>
                        </div>
                        <button class="btn btn-primary" id="coll-add-videos-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add Videos
                        </button>
                    </div>
                </div>
                <div class="lib-grid" id="coll-detail-grid"><p class="lib-empty">No videos in this collection yet.</p></div>
            </div>
        </div>

        <!-- Add videos view (select from library) -->
        <div class="coll-view" id="coll-add-view" style="display:none">
            <div class="coll-page">
                <div class="coll-detail-header">
                    <button class="coll-back-btn" id="coll-add-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        Back
                    </button>
                    <div>
                        <h1 class="lib-title" id="coll-add-title">Add Videos</h1>
                        <p class="lib-subtitle">Select videos to add to this collection.</p>
                    </div>
                </div>
                <div class="lib-grid" id="coll-add-grid"></div>
            </div>
        </div>

        <!-- Add videos action bar -->
        <div class="lib-action-bar" id="coll-add-action-bar">
            <span class="lib-action-count" id="coll-add-count">0 selected</span>
            <div class="lib-action-btns">
                <button class="btn btn-primary" id="coll-add-confirm">Add to Collection</button>
                <button class="btn btn-secondary" id="coll-add-cancel">Cancel</button>
            </div>
        </div>

        <!-- Player modal -->
        <div class="player-modal-bg" id="coll-player-bg">
            <div class="player-modal">
                <div class="player-modal-header">
                    <div class="player-modal-title" id="coll-player-title"></div>
                    <button class="coll-modal-close" id="coll-player-close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <video class="player-video" id="coll-player-video" controls playsinline></video>
                <div class="player-tags" id="coll-player-tags"></div>
            </div>
        </div>

        <!-- New collection modal -->
        <div class="coll-modal-bg" id="coll-modal-bg">
            <div class="coll-modal">
                <div class="coll-modal-header">
                    <h2 class="coll-modal-title">New Collection</h2>
                    <button class="coll-modal-close" id="coll-modal-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <form id="coll-form">
                    <div class="login-field">
                        <label class="login-label">Name</label>
                        <input class="login-input" type="text" id="coll-name" placeholder="e.g. Drops & Rolls" required>
                    </div>
                    <div class="login-field">
                        <label class="login-label">Description</label>
                        <input class="login-input" type="text" id="coll-desc-input" placeholder="Optional description">
                    </div>
                    <div class="login-field">
                        <label class="login-label">Tags (comma separated)</label>
                        <input class="login-input" type="text" id="coll-tags" placeholder="e.g. drops, transitions">
                    </div>
                    <div class="coll-modal-actions">
                        <button type="button" class="btn btn-secondary" id="coll-cancel">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Collection</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // State
    let allCollections = [];
    let filtered = [];
    let allVideos = [];
    let viewMode = 'grid';
    let currentCollId = null;
    let addSelectedIds = new Set();

    // Views
    const mainView = page.querySelector('#coll-main-view');
    const detailView = page.querySelector('#coll-detail-view');
    const addView = page.querySelector('#coll-add-view');

    // Refs
    const grid = page.querySelector('#coll-grid');
    const searchInput = page.querySelector('#coll-search');
    const sortSelect = page.querySelector('#coll-sort');
    const modalBg = page.querySelector('#coll-modal-bg');
    const form = page.querySelector('#coll-form');
    const detailGrid = page.querySelector('#coll-detail-grid');
    const addGrid = page.querySelector('#coll-add-grid');
    const addActionBar = page.querySelector('#coll-add-action-bar');
    const addCount = page.querySelector('#coll-add-count');
    const playerBg = page.querySelector('#coll-player-bg');
    const playerVideo = page.querySelector('#coll-player-video');
    const playerTitle = page.querySelector('#coll-player-title');
    const playerTags = page.querySelector('#coll-player-tags');

    // ─── View switching ───
    function showView(view) {
        mainView.style.display = 'none';
        detailView.style.display = 'none';
        addView.style.display = 'none';
        addActionBar.classList.remove('is-open');
        view.style.display = '';
    }

    // ─── Load data ───
    fetchVideos().then(data => {
        allVideos = data;
        page.querySelector('#stat-videos').textContent = allVideos.length;
        const favCount = allVideos.filter(v => v.favorite).length;
        page.querySelector('#stat-favorites').textContent = favCount;
        page.querySelector('#stat-hours').textContent = (allVideos.length / 60).toFixed(1);
        renderSmart();
        loadCollections();
    }).catch(e => {
        console.error('[collections] fetch failed:', e);
    });

    function renderThumbStack(c) {
        const ids = (c.videoIds || []).slice(0, 3);
        const imgs = ids.map((vid, i) => {
            const v = allVideos.find(x => x.id === vid);
            const thumbId = v?.thumbnail_path || `${vid}.jpg`;
            const { data } = supabase.storage.from('thumbnails').getPublicUrl(thumbId);
            return `<img class="prog-stack-img prog-stack-img-${i}" src="${data.publicUrl}" alt="" onerror="this.style.opacity='0'">`;
        }).join('');
        return `<div class="prog-stack coll-card-stack">${imgs}</div>`;
    }

    function buildAutoCollections() {
        return buildTagCollections(allVideos).map(c => ({ ...c, createdAt: 0 }));
    }

    // ─── Collections CRUD ───
    function loadCollections() {
        const manual = JSON.parse(localStorage.getItem('collections') || '[]');
        const auto = buildAutoCollections();
        allCollections = [...auto, ...manual];
        page.querySelector('#stat-collections').textContent = allCollections.length;
        applyFilter();
    }

    function saveCollections() {
        // Only manual collections persist. Auto ones are recomputed from videos every load.
        const manual = allCollections.filter(c => !c.auto);
        localStorage.setItem('collections', JSON.stringify(manual));
        page.querySelector('#stat-collections').textContent = allCollections.length;
    }

    function applyFilter() {
        const q = searchInput.value.trim().toLowerCase();
        filtered = q
            ? allCollections.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q) ||
                (c.tags || []).some(t => t.toLowerCase().includes(q)))
            : [...allCollections];
        const sort = sortSelect.value;
        if (sort === 'newest') filtered.sort((a, b) => b.createdAt - a.createdAt);
        else if (sort === 'oldest') filtered.sort((a, b) => a.createdAt - b.createdAt);
        else if (sort === 'alpha') filtered.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === 'size') filtered.sort((a, b) => (b.videoIds || []).length - (a.videoIds || []).length);
        renderMainGrid();
    }

    // ─── Main grid rendering ───
    function renderMainGrid() {
        grid.className = viewMode === 'list' ? 'coll-list' : 'coll-grid';
        if (viewMode === 'list') {
            grid.innerHTML = filtered.map(c => renderRow(c)).join('');
        } else {
            grid.innerHTML = filtered.map(c => renderCard(c)).join('');
        }
        bindMainGridEvents();
    }

    function renderCard(c) {
        const tags = (c.tags || []).slice(0, 2);
        const count = (c.videoIds || []).length;
        const stackHtml = (c.videoIds && c.videoIds.length) ? renderThumbStack(c) : '';
        const menuHtml = c.auto ? '' : `
            <div class="coll-card-menu-wrap">
                <button class="coll-card-menu" data-id="${c.id}" title="Options">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                <div class="coll-card-dropdown" data-menu="${c.id}" style="display:none">
                    <button class="coll-card-dropdown-item coll-card-delete" data-id="${c.id}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Delete
                    </button>
                </div>
            </div>`;
        return `
            <div class="coll-card ${c.auto ? 'coll-card-auto' : ''}" data-id="${c.id}">
                <div class="coll-card-thumb">
                    ${stackHtml}
                    <span class="coll-card-count">${count} video${count !== 1 ? 's' : ''}</span>
                    ${menuHtml}
                </div>
                <div class="coll-card-body">
                    <div class="coll-card-name">${c.name}</div>
                    ${c.description ? `<div class="coll-card-desc">${c.description}</div>` : ''}
                    <div class="coll-card-footer">
                        <div class="lib-card-tags">${tags.map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                        <button class="fav-btn coll-card-fav ${c.favorite ? 'fav-active' : ''}" data-id="${c.id}">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="${c.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    }

    function renderNewCard() {
        return `
            <div class="coll-card coll-card-new" id="coll-new-inline">
                <div class="coll-new-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div class="coll-card-name">New Collection</div>
                <div class="coll-card-desc">Create a new collection to organize your videos.</div>
            </div>`;
    }

    function renderRow(c) {
        const count = (c.videoIds || []).length;
        const tags = (c.tags || []).slice(0, 3);
        return `
            <div class="coll-row" data-id="${c.id}">
                <div class="coll-row-thumb"></div>
                <div class="coll-row-info"><div class="coll-card-name">${c.name}</div>${c.description ? `<div class="coll-card-desc">${c.description}</div>` : ''}</div>
                <div class="lib-card-tags">${tags.map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                <div class="coll-row-count">${count} video${count !== 1 ? 's' : ''}</div>
            </div>`;
    }

    function bindMainGridEvents() {
        window.addEventListener('new-collection', openModal);

        grid.querySelectorAll('.coll-card-menu').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const dd = page.querySelector(`[data-menu="${btn.dataset.id}"]`);
                grid.querySelectorAll('.coll-card-dropdown').forEach(d => { if (d !== dd) d.style.display = 'none'; });
                dd.style.display = dd.style.display === 'none' ? '' : 'none';
            });
        });

        grid.querySelectorAll('.coll-card-delete').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                allCollections = allCollections.filter(c => c.id !== btn.dataset.id);
                saveCollections();
                applyFilter();
            });
        });

        grid.querySelectorAll('.coll-card-fav').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const c = allCollections.find(c => c.id === btn.dataset.id);
                if (!c) return;
                c.favorite = !c.favorite;
                if (c.auto) setAutoCollFav(c.id, c.favorite);
                saveCollections();
                btn.classList.toggle('fav-active', c.favorite);
                btn.querySelector('svg').setAttribute('fill', c.favorite ? 'currentColor' : 'none');
            });
        });

        // Click card → open detail
        grid.querySelectorAll('.coll-card:not(.coll-card-new)').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.coll-card-menu-wrap') || e.target.closest('.fav-btn')) return;
                const coll = allCollections.find(c => c.id === card.dataset.id);
                if (coll) openDetail(coll);
            });
        });

        grid.querySelectorAll('.coll-row').forEach(row => {
            row.addEventListener('click', () => {
                const coll = allCollections.find(c => c.id === row.dataset.id);
                if (coll) openDetail(coll);
            });
        });

        document.addEventListener('click', () => {
            grid.querySelectorAll('.coll-card-dropdown').forEach(d => { d.style.display = 'none'; });
        }, { once: true });
    }

    // ─── Detail view ───
    function openDetail(c) {
        currentCollId = c.id;
        page.querySelector('#coll-detail-title').textContent = c.name;
        page.querySelector('#coll-detail-desc').textContent = c.description || `${(c.videoIds || []).length} videos`;
        const addBtn = page.querySelector('#coll-add-videos-btn');
        if (addBtn) addBtn.style.display = c.auto ? 'none' : '';
        const videos = allVideos.filter(v => (c.videoIds || []).includes(v.id));
        if (videos.length === 0) {
            detailGrid.innerHTML = '<p class="lib-empty">No videos in this collection yet. Click "Add Videos" to get started.</p>';
        } else {
            detailGrid.className = 'lib-grid';
            detailGrid.innerHTML = videos.map(v => renderVideoCard(v)).join('');
            detailGrid.querySelectorAll('canvas[data-src]').forEach(canvas => captureMidframe(canvas, canvas.dataset.src, canvas.dataset.id));
            detailGrid.querySelectorAll('.lib-card').forEach(card => {
                card.addEventListener('click', () => {
                    const v = allVideos.find(v => v.id === card.dataset.id);
                    if (v) openPlayer(v);
                });
            });
        }
        showView(detailView);
    }

    page.querySelector('#coll-back').addEventListener('click', () => { showView(mainView); loadCollections(); });
    page.querySelector('#coll-add-videos-btn').addEventListener('click', openAddVideos);

    // ─── Add videos view ───
    function openAddVideos() {
        addSelectedIds.clear();
        const coll = allCollections.find(c => c.id === currentCollId);
        const existing = new Set(coll?.videoIds || []);
        page.querySelector('#coll-add-title').textContent = `Add Videos to "${coll?.name}"`;
        renderAddGrid(existing);
        showView(addView);
        addActionBar.classList.add('is-open');
        updateAddCount();
    }

    function renderAddGrid(existing) {
        const available = allVideos.filter(v => !existing.has(v.id));
        if (available.length === 0) {
            addGrid.innerHTML = '<p class="lib-empty">All videos are already in this collection.</p>';
            return;
        }
        addGrid.className = 'lib-grid';
        addGrid.innerHTML = available.map(v => {
            const selected = addSelectedIds.has(v.id);
            return `
                <div class="lib-card lib-card-selectable ${selected ? 'lib-card-selected' : ''}" data-id="${v.id}">
                    <div class="lib-card-checkbox ${selected ? 'lib-card-checkbox-checked' : ''}">
                        ${selected ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                    </div>
                    <div class="lib-card-thumb-wrap">
                        <canvas class="lib-card-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}" data-id="${v.id}"></canvas>
                    </div>
                    <div class="lib-card-body">
                        <div class="lib-card-top"><div class="lib-card-title">${getPoses(v)[0] || ''}</div></div>
                        <div class="lib-card-tags">${getPoses(v).slice(0, 3).map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                    </div>
                </div>`;
        }).join('');

        addGrid.querySelectorAll('canvas[data-src]').forEach(canvas => captureMidframe(canvas, canvas.dataset.src, canvas.dataset.id));
        addGrid.querySelectorAll('.lib-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                if (addSelectedIds.has(id)) addSelectedIds.delete(id);
                else addSelectedIds.add(id);
                renderAddGrid(existing);
            });
        });
    }

    function updateAddCount() {
        addCount.textContent = `${addSelectedIds.size} selected`;
        page.querySelector('#coll-add-confirm').disabled = addSelectedIds.size === 0;
    }

    // Watch for selection changes
    const origRender = renderAddGrid;
    const _renderAddGrid = renderAddGrid;

    page.querySelector('#coll-add-confirm').addEventListener('click', () => {
        const coll = allCollections.find(c => c.id === currentCollId);
        if (!coll) return;
        coll.videoIds = [...new Set([...(coll.videoIds || []), ...addSelectedIds])];
        saveCollections();
        addSelectedIds.clear();
        openDetail(coll);
    });

    page.querySelector('#coll-add-cancel').addEventListener('click', () => {
        addSelectedIds.clear();
        const coll = allCollections.find(c => c.id === currentCollId);
        if (coll) openDetail(coll);
    });

    page.querySelector('#coll-add-back').addEventListener('click', () => {
        addSelectedIds.clear();
        const coll = allCollections.find(c => c.id === currentCollId);
        if (coll) openDetail(coll);
    });

    // Override renderAddGrid to also update count
    const _origRenderAddGrid = renderAddGrid;

    // ─── Shared helpers ───
    function renderVideoCard(v) {
        const poses = getPoses(v);
        return `
            <div class="lib-card" data-id="${v.id}">
                <div class="lib-card-thumb-wrap">
                    <canvas class="lib-card-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}" data-id="${v.id}"></canvas>
                </div>
                <div class="lib-card-body">
                    <div class="lib-card-top"><div class="lib-card-title">${poses[0] || ''}</div></div>
                    <div class="lib-card-tags">${poses.slice(0, 3).map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                </div>
            </div>`;
    }

    function getPoses(video) {
        const seen = new Set();
        return (video.labels || []).map(l => l.label && l.label.trim()).filter(l => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
    }

    function getThumbTime(v) {
        const poses = getPoses(v);
        if (poses.length < 2 || poses[0].toLowerCase().includes('cats crad')) {
            const first = (v.labels || []).find(l => l.label && l.label.trim());
            return first != null ? first.startTime : '';
        }
        const match = (v.labels || []).find(l => l.label && l.label.trim().toLowerCase() === poses[1].toLowerCase());
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

    function captureMidframe(canvas, src, videoId) {
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(`${videoId}.jpg`);
        const img = new Image();
        img.onload = () => drawToCanvas(canvas, img);
        img.onerror = () => {
            const vid = document.createElement('video');
            vid.src = src;
            vid.muted = true;
            vid.preload = 'metadata';
            const seekTo = canvas.dataset?.seek !== '' ? parseFloat(canvas.dataset?.seek) : null;
            vid.addEventListener('loadedmetadata', () => { vid.currentTime = (seekTo !== null && !isNaN(seekTo)) ? seekTo : vid.duration / 2; });
            vid.addEventListener('seeked', () => { drawToCanvas(canvas, vid); vid.src = ''; });
        };
        img.src = publicUrl + '?t=1';
    }

    // ─── Player ───
    function openPlayer(v) {
        const poses = getPoses(v);
        playerTitle.textContent = poses[0] || v.filename.replace(/\.[^.]+$/, '');
        playerVideo.src = v.path;
        playerVideo.play();
        playerTags.innerHTML = poses.map(t => `<span class="lib-tag">${t}</span>`).join('');
        playerBg.classList.add('is-open');
    }

    function closePlayer() {
        playerBg.classList.remove('is-open');
        playerVideo.pause();
        playerVideo.src = '';
    }

    page.querySelector('#coll-player-close').addEventListener('click', closePlayer);
    playerBg.addEventListener('click', e => { if (e.target === playerBg) closePlayer(); });

    // ─── Smart collections ───
    function renderSmart() {
        const favCount = allVideos.filter(v => localStorage.getItem(`fav_${v.id}`) === '1').length;
        const counts = { recent: Math.min(allVideos.length, 22), watched: Math.min(allVideos.length, 15), favorites: favCount };
        page.querySelector('#coll-smart-row').innerHTML = SMART.map(s => `
            <div class="coll-smart-item" data-smart="${s.key}">
                <div class="coll-smart-icon">${s.icon}</div>
                <div><div class="coll-smart-name">${s.label}</div><div class="coll-smart-count">${counts[s.key]} videos</div></div>
            </div>`).join('');

        page.querySelector('[data-smart="favorites"]')?.addEventListener('click', () => {
            window.location.hash = '#/favorites';
        });
    }

    // ─── New collection modal ───
    function openModal() { modalBg.classList.add('is-open'); page.querySelector('#coll-name').focus(); }
    function closeModal() { modalBg.classList.remove('is-open'); form.reset(); }

    page.querySelector('#coll-modal-close').addEventListener('click', closeModal);
    page.querySelector('#coll-cancel').addEventListener('click', closeModal);
    modalBg.addEventListener('click', e => { if (e.target === modalBg) closeModal(); });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = page.querySelector('#coll-name').value.trim();
        const description = page.querySelector('#coll-desc-input').value.trim();
        const tags = page.querySelector('#coll-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        allCollections.unshift({ id: crypto.randomUUID(), name, description, tags, videoIds: [], favorite: false, createdAt: Date.now() });
        saveCollections();
        closeModal();
        applyFilter();
    });

    // ─── Events ───
    searchInput.addEventListener('input', applyFilter);
    sortSelect.addEventListener('change', applyFilter);

    page.querySelector('#coll-view-grid').addEventListener('click', () => {
        viewMode = 'grid';
        page.querySelector('#coll-view-grid').classList.add('lib-view-active');
        page.querySelector('#coll-view-list').classList.remove('lib-view-active');
        renderMainGrid();
    });

    page.querySelector('#coll-view-list').addEventListener('click', () => {
        viewMode = 'list';
        page.querySelector('#coll-view-list').classList.add('lib-view-active');
        page.querySelector('#coll-view-grid').classList.remove('lib-view-active');
        renderMainGrid();
    });

    // Watch addSelectedIds changes via mutation on addGrid
    const addObserver = new MutationObserver(updateAddCount);
    addObserver.observe(addGrid, { childList: true });

    loadCollections();
    return page;
}
