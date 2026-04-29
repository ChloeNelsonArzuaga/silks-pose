import { supabase } from './supabase.js';
import { IS_LOCAL } from './dataSource.js';

const SIGNED_URL_TTL = 60 * 60; // 1 hour
const urlCache = new Map(); // storage_path -> { url, exp }

export async function fetchVideos() {
    if (!IS_LOCAL) return fetchSupabase();
    // Local mode: bundled videos.json + anything the user has uploaded to Supabase.
    const [local, remote] = await Promise.all([
        fetchLocal().catch(e => { console.warn('[videos] local fetch failed:', e); return []; }),
        fetchSupabase().catch(e => { console.warn('[videos] supabase fetch failed (auth required):', e.message); return []; }),
    ]);
    return [...remote, ...local];
}

export async function getSignedUrl(pathOrStoragePath) {
    if (!pathOrStoragePath) return null;
    // Local-disk paths (videos.json) and absolute URLs are served directly.
    if (/^(data|app)\//.test(pathOrStoragePath) || /^(https?:|data:|blob:)/.test(pathOrStoragePath)) {
        return pathOrStoragePath;
    }
    // Otherwise treat as a Supabase storage path.
    const cached = urlCache.get(pathOrStoragePath);
    if (cached && cached.exp > Date.now()) return cached.url;
    const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(pathOrStoragePath, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) return null;
    urlCache.set(pathOrStoragePath, {
        url: data.signedUrl,
        exp: Date.now() + (SIGNED_URL_TTL - 60) * 1000,
    });
    return data.signedUrl;
}

export async function updateVideo(id, patch) {
    if (IS_LOCAL) {
        // Local mode keeps state in localStorage; callers already write there.
        return true;
    }
    const { error } = await supabase.from('videos').update(patch).eq('id', id);
    if (error) console.error('[videos] update failed:', error.message);
    return !error;
}

// ----- Supabase source -----

async function fetchSupabase() {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeSupabase);
}

function normalizeSupabase(row) {
    return {
        id: row.id,
        filename: row.filename,
        storage_path: row.storage_path,
        thumbnail_path: row.thumbnail_path,
        path: row.storage_path,
        split: row.split || 'unassigned',
        tags: row.tags || [],
        poses: row.poses || [],
        labels: row.labels || [],
        customName: row.custom_name || null,
        favorite: !!row.favorite,
        collection_id: row.collection_id || null,
        created_at: row.created_at,
    };
}

// ----- Local source (videos.json + localStorage overlays) -----

async function fetchLocal() {
    const res = await fetch('app/videos.json');
    if (!res.ok) throw new Error(`videos.json: ${res.status}`);
    const data = await res.json();
    return data.map(v => ({
        id: v.id,
        filename: v.filename,
        path: v.path,
        storage_path: null,
        thumbnail_path: null,
        split: localStorage.getItem(`video_split_${v.id}`) || v.split || 'unassigned',
        tags: JSON.parse(localStorage.getItem(`video_tags_${v.id}`) || JSON.stringify(v.tags || [])),
        poses: v.poses || [],
        labels: JSON.parse(localStorage.getItem(`labels_${v.id}`) || JSON.stringify(v.labels || [])),
        customName: localStorage.getItem(`name_${v.id}`) || null,
        favorite: localStorage.getItem(`fav_${v.id}`) === '1',
        collection_id: null,
    }));
}
