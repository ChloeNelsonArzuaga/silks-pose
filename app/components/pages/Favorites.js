import { supabase } from '../../lib/supabase.js';

export function Favorites() {
    const page = document.createElement('div');
    page.className = 'page page-favorites';

    page.innerHTML = `
        <div class="lib-page">
            <div class="lib-page-header">
                <div>
                    <h1 class="lib-title">Favorites</h1>
                    <p class="lib-subtitle">Your starred videos, all in one place.</p>
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
            <div class="lib-grid" id="fav-grid">
                <p class="lib-empty">Loading...</p>
            </div>
        </div>

        <!-- Video player modal -->
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

    const grid = page.querySelector('#fav-grid');
    const searchInput = page.querySelector('#fav-search');
    const playerBg = page.querySelector('#fav-player-bg');
    const playerVideo = page.querySelector('#fav-player-video');
    const playerTitle = page.querySelector('#fav-player-title');
    const playerTags = page.querySelector('#fav-player-tags');

    let allFavs = [];
    let filtered = [];

    function openPlayer(v) {
        const name = getCardName(v);
        playerTitle.textContent = name;
        playerVideo.src = v.path;
        playerVideo.play();
        const poses = getPoses(v);
        playerTags.innerHTML = poses.map(t => `<span class="lib-tag">${t}</span>`).join('');
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

    fetch('app/videos.json')
        .then(r => r.json())
        .then(data => {
            allFavs = data
                .map(v => ({
                    ...v,
                    labels: JSON.parse(localStorage.getItem(`labels_${v.id}`) || JSON.stringify(v.labels || [])),
                    customName: localStorage.getItem(`name_${v.id}`) || null,
                    favorite: localStorage.getItem(`fav_${v.id}`) === '1',
                }))
                .filter(v => v.favorite);
            filtered = allFavs;
            render();
        })
        .catch(() => {
            grid.innerHTML = '<p class="lib-empty">No videos found.</p>';
        });

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        filtered = q
            ? allFavs.filter(v =>
                (v.filename || '').toLowerCase().includes(q) ||
                getPoses(v).some(p => p.toLowerCase().includes(q))
              )
            : allFavs;
        render();
    });

    function getPoses(video) {
        const seen = new Set();
        return (video.labels || [])
            .map(l => l.label && l.label.trim())
            .filter(l => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
    }

    function getCardName(v) {
        if (v.customName) return v.customName;
        return getPoses(v)[0] || '';
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

    function captureMidframe(canvas, src, videoId) {
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(`${videoId}.jpg`);
        const img = new Image();
        img.onload = () => drawToCanvas(canvas, img);
        img.onerror = () => captureFromVideo(canvas, src, videoId);
        img.src = publicUrl + '?t=1';
    }

    function captureFromVideo(canvas, src, videoId) {
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
        });
    }

    function render() {
        if (filtered.length === 0) {
            grid.innerHTML = '<p class="lib-empty">No favorites yet. Star videos in your Library to see them here.</p>';
            return;
        }

        grid.className = 'lib-grid';
        grid.innerHTML = filtered.map(v => {
            const poses = getPoses(v).slice(0, 3);
            const name = getCardName(v);
            return `
                <div class="lib-card" data-id="${v.id}">
                    <div class="lib-card-thumb-wrap">
                        <canvas class="lib-card-thumb" data-src="${v.path}" data-seek="${getThumbTime(v)}" data-id="${v.id}"></canvas>
                    </div>
                    <div class="lib-card-body">
                        <div class="lib-card-top">
                            <div class="lib-card-title-wrap">
                                <span class="lib-card-title">${name}</span>
                            </div>
                            <button class="fav-btn fav-active" data-id="${v.id}" title="Unfavorite">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>
                        </div>
                        <div class="lib-card-tags">${poses.map(t => `<span class="lib-tag">${t}</span>`).join('')}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Card clicks → open player
        grid.querySelectorAll('.lib-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.fav-btn')) return;
                const v = allFavs.find(v => v.id === card.dataset.id);
                if (v) openPlayer(v);
            });
        });

        // Thumbnails
        grid.querySelectorAll('canvas[data-src]').forEach(canvas => {
            captureMidframe(canvas, canvas.dataset.src, canvas.dataset.id);
        });

        // Unfavorite
        grid.querySelectorAll('.fav-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                localStorage.setItem(`fav_${id}`, '0');
                allFavs = allFavs.filter(v => v.id !== id);
                filtered = filtered.filter(v => v.id !== id);
                render();
            });
        });
    }

    return page;
}
