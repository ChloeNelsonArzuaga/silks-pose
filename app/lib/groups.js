import { supabase } from './supabase.js';

// ── Favorites storage ────────────────────────────────────────
const FAV_MOVES_KEY = 'fav_moves';
const FAV_COLLS_KEY = 'fav_auto_colls';

export function getFavMoves() {
    return new Set(JSON.parse(localStorage.getItem(FAV_MOVES_KEY) || '[]'));
}
export function setMoveFav(moveName, on) {
    const s = getFavMoves();
    on ? s.add(moveName.toLowerCase()) : s.delete(moveName.toLowerCase());
    localStorage.setItem(FAV_MOVES_KEY, JSON.stringify([...s]));
}

export function getFavAutoColls() {
    return new Set(JSON.parse(localStorage.getItem(FAV_COLLS_KEY) || '[]'));
}
export function setAutoCollFav(collId, on) {
    const s = getFavAutoColls();
    on ? s.add(collId) : s.delete(collId);
    localStorage.setItem(FAV_COLLS_KEY, JSON.stringify([...s]));
}

// ── Move groups (Progress) ────────────────────────────────────
export function buildMoveGroups(videos) {
    const map = new Map();
    const add = (name, video) => {
        if (!name || !name.trim()) return;
        const key = name.toLowerCase().trim();
        let g = map.get(key);
        if (!g) {
            g = { display: name.trim(), key, videos: [] };
            map.set(key, g);
        }
        if (!g.videos.find(x => x.id === video.id)) g.videos.push(video);
    };
    for (const v of videos) {
        (v.poses || []).forEach(p => add(p, v));
        (v.labels || []).forEach(l => l && l.label && add(l.label, v));
    }
    const favMoves = getFavMoves();
    return [...map.values()]
        .filter(g => g.videos.length > 0)
        .map(g => ({ ...g, favorite: favMoves.has(g.key) }))
        .sort((a, b) => b.videos.length - a.videos.length || a.display.localeCompare(b.display));
}

// ── Tag collections (Collections auto) ───────────────────────
export function buildTagCollections(videos) {
    const map = new Map();
    for (const v of videos) {
        for (const t of v.tags || []) {
            if (!t || !t.trim()) continue;
            const key = t.toLowerCase().trim();
            let g = map.get(key);
            if (!g) {
                g = { display: t.trim(), key, videoIds: new Set() };
                map.set(key, g);
            }
            g.videoIds.add(v.id);
        }
    }
    const favColls = getFavAutoColls();
    return [...map.values()]
        .filter(g => g.videoIds.size >= 2)
        .map(g => ({
            id: `auto:tag:${g.key}`,
            name: g.display,
            description: `${g.videoIds.size} videos share this tag.`,
            tags: [g.display],
            videoIds: [...g.videoIds],
            favorite: favColls.has(`auto:tag:${g.key}`),
            auto: true,
            autoKind: 'tag',
        }))
        .sort((a, b) => b.videoIds.length - a.videoIds.length || a.name.localeCompare(b.name));
}

// ── Shared thumbnail helpers ──────────────────────────────────
export function thumbnailUrl(v) {
    const path = v.thumbnail_path || `${v.id}.jpg`;
    const { data } = supabase.storage.from('thumbnails').getPublicUrl(path);
    return data.publicUrl;
}

export function renderThumbStack(videoList, limit = 3) {
    return videoList.slice(0, limit).map((v, i) =>
        `<img class="prog-stack-img prog-stack-img-${i}" src="${thumbnailUrl(v)}" alt="" onerror="this.style.opacity='0'">`
    ).join('');
}

export const STAR_SVG = (filled) =>
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
