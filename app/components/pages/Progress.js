import { fetchVideos, getSignedUrl } from '../../lib/videos.js';
import { buildMoveGroups, renderThumbStack, thumbnailUrl, setMoveFav, STAR_SVG } from '../../lib/groups.js';

const STACK_THUMBS = 3;

export function Progress() {
    const page = document.createElement('div');
    page.className = 'page page-progress';
    page.innerHTML = `
        <div class="lib-page">
            <div class="lib-page-header">
                <div>
                    <h1 class="lib-title">Progress</h1>
                    <p class="lib-subtitle">Every aerial move you've captured, grouped by name.</p>
                </div>
                <div class="coll-stats" id="prog-stats">
                    <div class="coll-stat">
                        <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                        <div><div class="coll-stat-num" id="stat-moves">—</div><div class="coll-stat-label">Moves</div></div>
                    </div>
                    <div class="coll-stat">
                        <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
                        <div><div class="coll-stat-num" id="stat-prog-videos">—</div><div class="coll-stat-label">Videos</div></div>
                    </div>
                    <div class="coll-stat">
                        <div class="coll-stat-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                        <div><div class="coll-stat-num" id="stat-prog-hours">—</div><div class="coll-stat-label">Hours of Footage</div></div>
                    </div>
                </div>
            </div>
            <div class="lib-toolbar">
                <div class="lib-toolbar-left">
                    <div class="lib-search-wrap">
                        <svg class="lib-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input class="lib-search" type="text" id="prog-search" placeholder="Search moves..." autocomplete="off">
                    </div>
                </div>
            </div>
            <div class="lib-grid prog-grid" id="prog-grid">
                <p class="lib-empty">Loading...</p>
            </div>
        </div>
        <div class="player-modal-bg" id="prog-player-bg">
            <div class="player-modal">
                <div class="player-modal-header">
                    <div class="player-modal-title" id="prog-player-title"></div>
                    <button class="coll-modal-close" id="prog-player-close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <video class="player-video" id="prog-player-video" controls playsinline></video>
            </div>
        </div>
    `;

    const grid = page.querySelector('#prog-grid');
    const searchInput = page.querySelector('#prog-search');
    const playerBg = page.querySelector('#prog-player-bg');
    const playerVideo = page.querySelector('#prog-player-video');
    const playerTitle = page.querySelector('#prog-player-title');

    let allVideos = [];
    let groups = [];

    fetchVideos().then(data => {
        allVideos = data;
        groups = buildMoveGroups(allVideos);
        const labeledVideos = new Set(groups.flatMap(g => g.videos.map(v => v.id)));
        page.querySelector('#stat-moves').textContent = groups.length;
        page.querySelector('#stat-prog-videos').textContent = labeledVideos.size;
        page.querySelector('#stat-prog-hours').textContent = (labeledVideos.size / 60).toFixed(1);
        render();
    }).catch(e => {
        console.error('[progress] fetch failed:', e);
        grid.innerHTML = `<p class="lib-empty">Could not load videos: ${e.message}</p>`;
    });

    searchInput.addEventListener('input', render);


    function render() {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = q ? groups.filter(g => g.display.toLowerCase().includes(q)) : groups;
        if (!filtered.length) {
            grid.innerHTML = '<p class="lib-empty">No labeled moves yet — tag some videos with poses and they\'ll show up here.</p>';
            return;
        }
        grid.innerHTML = filtered.map(renderCard).join('');
        grid.querySelectorAll('.prog-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.prog-fav-btn')) return;
                openMove(card.dataset.move);
            });
        });
        grid.querySelectorAll('.prog-fav-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const g = groups.find(x => x.key === btn.dataset.move);
                if (!g) return;
                g.favorite = !g.favorite;
                setMoveFav(g.key, g.favorite);
                btn.classList.toggle('fav-active', g.favorite);
                btn.innerHTML = STAR_SVG(g.favorite);
            });
        });
    }

    function renderCard(g) {
        return `
            <div class="prog-card" data-move="${g.key}">
                <div class="prog-stack">${renderThumbStack(g.videos, STACK_THUMBS)}</div>
                <div class="prog-card-body">
                    <div class="prog-card-top">
                        <div class="prog-card-title">${g.display}</div>
                        <button class="fav-btn prog-fav-btn ${g.favorite ? 'fav-active' : ''}" data-move="${g.key}" title="Favorite">
                            ${STAR_SVG(g.favorite)}
                        </button>
                    </div>
                    <div class="prog-card-count">${g.videos.length} video${g.videos.length !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `;
    }

    function openMove(moveLower) {
        const g = groups.find(x => x.display.toLowerCase() === moveLower);
        if (!g) return;
        showMoveDetail(g);
    }

    function showMoveDetail(g) {
        const detail = document.createElement('div');
        detail.className = 'lib-page prog-detail';
        detail.innerHTML = `
            <button class="coll-back-btn" id="prog-back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
            </button>
            <div class="lib-page-header">
                <div>
                    <h1 class="lib-title prog-detail-title">${g.display}</h1>
                    <p class="lib-subtitle">${g.videos.length} video${g.videos.length !== 1 ? 's' : ''}</p>
                </div>
            </div>
            <div class="lib-grid prog-detail-grid"></div>
        `;
        const wrap = page.querySelector('.lib-page');
        wrap.style.display = 'none';
        wrap.parentNode.insertBefore(detail, wrap);

        const dGrid = detail.querySelector('.prog-detail-grid');
        dGrid.innerHTML = g.videos.map(v => `
            <div class="lib-card" data-id="${v.id}">
                <div class="lib-card-thumb-wrap">
                    <img class="lib-card-thumb" src="${thumbnailUrl(v)}" alt="" onerror="this.style.opacity='0'">
                </div>
                <div class="lib-card-body">
                    <div class="lib-card-top">
                        <span class="lib-card-title">${v.customName || v.filename.replace(/\.[^.]+$/, '')}</span>
                    </div>
                </div>
            </div>
        `).join('');
        dGrid.querySelectorAll('.lib-card').forEach(card => {
            card.addEventListener('click', () => {
                const v = g.videos.find(x => x.id === card.dataset.id);
                if (v) openPlayer(v);
            });
        });
        detail.querySelector('#prog-back').addEventListener('click', () => {
            detail.remove();
            wrap.style.display = '';
        });
    }

    async function openPlayer(v) {
        playerTitle.textContent = v.customName || v.filename.replace(/\.[^.]+$/, '');
        const url = await getSignedUrl(v.storage_path || v.path);
        playerVideo.src = url || '';
        if (url) playerVideo.play().catch(() => {});
        playerBg.classList.add('is-open');
    }

    function closePlayer() {
        playerBg.classList.remove('is-open');
        playerVideo.pause();
        playerVideo.src = '';
    }

    page.querySelector('#prog-player-close').addEventListener('click', closePlayer);
    playerBg.addEventListener('click', e => { if (e.target === playerBg) closePlayer(); });

    return page;
}
