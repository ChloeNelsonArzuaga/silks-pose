import { supabase } from '../../lib/supabase.js';
import { fetchVideos, getSignedUrl, updateVideo } from '../../lib/videos.js';
import { buildMoveGroups, buildTagCollections, renderThumbStack, setMoveFav, setAutoCollFav, STAR_SVG } from '../../lib/groups.js';

const STACK_THUMBS = 3;

export function Favorites() {
    const page = document.createElement('div');
    page.className = 'page page-favorites';
    page.innerHTML = `
        <div class="lib-page">
            <div class="lib-page-header">
                <div>
                    <h1 class="lib-title">Favorites</h1>
                    <p class="lib-subtitle">Your starred videos, moves, and collections.</p>
                </div>
            </div>
            <div class="lib-toolbar">
                <div class="lib-toolbar-left">
                    <div class="lib-search-wrap">
                        <svg class="lib-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input class="lib-search" type="text" id="fav-search" placeholder="Search favorites..." autocomplete="off">
                    </div>
                </div>
            </div>
            <div id="fav-content"><p class="lib-empty">Loading...</p></div>
        </div>

        <div class="player-modal-bg" id="fav-player-bg">
            <div class="player-modal">
                <div class="player-modal-header">
                    <div class="player-modal-title" id="fav-player-title"></div>
                    <button class="coll-modal-close" id="fav-player-close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <video class="player-video" id="fav-player-video" controls playsinline></video>
                <div class="player-tags" id="fav-player-tags"></div>
            </div>
        </div>
    `;

    const content = page.querySelector('#fav-content');
    const searchInput = page.querySelector('#fav-search');
    const playerBg = page.querySelector('#fav-player-bg');
    const playerVideo = page.querySelector('#fav-player-video');
    const playerTitle = page.querySelector('#fav-player-title');
    const playerTags = page.querySelector('#fav-player-tags');

    let allVideos = [];
    let favVideos = [];
    let favMoves = [];
    let favColls = [];
    let q = '';

    fetchVideos().then(data => {
        allVideos = data;
        favVideos = allVideos.filter(v => v.favorite);
        favMoves = buildMoveGroups(allVideos).filter(g => g.favorite);
        const manual = JSON.parse(localStorage.getItem('collections') || '[]').filter(c => c.favorite);
        const auto = buildTagCollections(allVideos).filter(c => c.favorite);
        favColls = [...auto, ...manual];
        render();
    }).catch(e => {
        content.innerHTML = `<p class="lib-empty">Could not load favorites: ${e.message}</p>`;
    });

    searchInput.addEventListener('input', () => { q = searchInput.value.trim().toLowerCase(); render(); });

    function render() {
        const vids = q ? favVideos.filter(v =>
            (v.customName || v.filename || '').toLowerCase().includes(q) ||
            (v.poses || []).some(p => p.toLowerCase().includes(q)) ||
            (v.tags || []).some(t => t.toLowerCase().includes(q))
        ) : favVideos;
        const moves = q ? favMoves.filter(g => g.display.toLowerCase().includes(q)) : favMoves;
        const colls = q ? favColls.filter(c => c.name.toLowerCase().includes(q)) : favColls;

        if (!vids.length && !moves.length && !colls.length) {
            content.innerHTML = '<p class="lib-empty">No favorites yet — star videos, moves, or collections to see them here.</p>';
            return;
        }

        content.innerHTML = [
            moves.length ? renderSection('Moves', renderMoveCards(moves)) : '',
            colls.length ? renderSection('Collections', renderCollCards(colls)) : '',
            vids.length  ? renderSection('Videos',  renderVideoCards(vids))  : '',
        ].join('');

        bindEvents();
    }

    function renderSection(title, cardsHtml) {
        return `
            <div class="fav-section">
                <div class="fav-section-title">${title}</div>
                <div class="lib-grid">${cardsHtml}</div>
            </div>
        `;
    }

    // ── Move cards ──────────────────────────────────────────
    function renderMoveCards(moves) {
        return moves.map(g => `
            <div class="prog-card fav-move-card" data-move="${g.key}">
                <div class="prog-stack">${renderThumbStack(g.videos, STACK_THUMBS)}</div>
                <div class="prog-card-body">
                    <div class="prog-card-top">
                        <div class="prog-card-title">${g.display}</div>
                        <button class="fav-btn fav-active fav-move-unfav" data-move="${g.key}" title="Unfavorite">
                            ${STAR_SVG(true)}
                        </button>
                    </div>
                    <div class="prog-card-count">${g.videos.length} video${g.videos.length !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `).join('');
    }

    // ── Collection cards ────────────────────────────────────
    function renderCollCards(colls) {
        return colls.map(c => {
            const videos = allVideos.filter(v => (c.videoIds || []).includes(v.id));
            const count = c.videoIds?.length || 0;
            const stackHtml = videos.length
                ? `<div class="prog-stack coll-card-stack">${renderThumbStack(videos, STACK_THUMBS)}</div>`
                : '';
            return `
                <div class="coll-card coll-card-auto fav-coll-card" data-coll-id="${c.id}">
                    <div class="coll-card-thumb">
                        ${stackHtml}
                        <span class="coll-card-count">${count} video${count !== 1 ? 's' : ''}</span>
                        <button class="fav-btn fav-active fav-coll-unfav" data-coll-id="${c.id}" title="Unfavorite">
                            ${STAR_SVG(true)}
                        </button>
                    </div>
                    <div class="coll-card-body">
                        <div class="coll-card-name">${c.name}</div>
                        ${c.description ? `<div class="coll-card-desc">${c.description}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Video cards ─────────────────────────────────────────
    function thumbnailUrl(v) {
        const path = v.thumbnail_path || `${v.id}.jpg`;
        const { data } = supabase.storage.from('thumbnails').getPublicUrl(path);
        return data.publicUrl;
    }

    function renderVideoCards(vids) {
        return vids.map(v => {
            const name = v.customName || (v.poses || [])[0] || v.filename?.replace(/\.[^.]+$/, '') || '';
            const poses = (v.poses || []).slice(0, 3);
            const tags = (v.tags || []).slice(0, 2);
            const pills = [
                ...poses.map(t => `<span class="lib-tag">${t}</span>`),
                ...tags.map(t => `<span class="lib-tag lib-tag-meta">${t}</span>`),
            ].join('');
            return `
                <div class="lib-card fav-video-card" data-id="${v.id}">
                    <div class="lib-card-thumb-wrap">
                        <img class="lib-card-thumb" src="${thumbnailUrl(v)}" alt="" onerror="this.style.opacity='0'">
                    </div>
                    <div class="lib-card-body">
                        <div class="lib-card-top">
                            <span class="lib-card-title">${name}</span>
                            <button class="fav-btn fav-active fav-video-unfav" data-id="${v.id}" title="Unfavorite">
                                ${STAR_SVG(true)}
                            </button>
                        </div>
                        <div class="lib-card-tags">${pills}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Events ──────────────────────────────────────────────
    function bindEvents() {
        content.querySelectorAll('.fav-video-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.fav-video-unfav')) return;
                const v = allVideos.find(x => x.id === card.dataset.id);
                if (v) openPlayer(v);
            });
        });

        content.querySelectorAll('.fav-video-unfav').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const v = allVideos.find(x => x.id === btn.dataset.id);
                if (!v) return;
                v.favorite = false;
                localStorage.setItem(`fav_${v.id}`, '0');
                updateVideo(v.id, { favorite: false });
                favVideos = favVideos.filter(x => x.id !== v.id);
                render();
            });
        });

        content.querySelectorAll('.fav-move-unfav').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const key = btn.dataset.move;
                setMoveFav(key, false);
                favMoves = favMoves.filter(g => g.key !== key);
                render();
            });
        });

        content.querySelectorAll('.fav-coll-unfav').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.dataset.collId;
                const c = favColls.find(x => x.id === id);
                if (!c) return;
                if (c.auto) setAutoCollFav(id, false);
                else {
                    const manual = JSON.parse(localStorage.getItem('collections') || '[]');
                    const found = manual.find(x => x.id === id);
                    if (found) { found.favorite = false; localStorage.setItem('collections', JSON.stringify(manual)); }
                }
                favColls = favColls.filter(x => x.id !== id);
                render();
            });
        });
    }

    async function openPlayer(v) {
        playerTitle.textContent = v.customName || (v.poses || [])[0] || v.filename?.replace(/\.[^.]+$/, '') || '';
        const url = await getSignedUrl(v.storage_path || v.path);
        playerVideo.src = url || '';
        if (url) playerVideo.play().catch(() => {});
        const pills = [...(v.poses || []).map(t => `<span class="lib-tag">${t}</span>`),
                       ...(v.tags  || []).map(t => `<span class="lib-tag lib-tag-meta">${t}</span>`)].join('');
        playerTags.innerHTML = pills;
        playerBg.classList.add('is-open');
    }

    function closePlayer() {
        playerBg.classList.remove('is-open');
        playerVideo.pause();
        playerVideo.src = '';
    }

    page.querySelector('#fav-player-close').addEventListener('click', closePlayer);
    playerBg.addEventListener('click', e => { if (e.target === playerBg) closePlayer(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePlayer(); });

    return page;
}
