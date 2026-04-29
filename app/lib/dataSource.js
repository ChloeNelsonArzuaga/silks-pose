// Decide whether the app reads from the local videos.json + filesystem
// (development on `python3 utils/serve.py`) or from Supabase (deployed).
//
// Order of precedence:
//   1. ?source=local | ?source=supabase in the URL (also stored to localStorage)
//   2. localStorage 'data_source' setting
//   3. hostname heuristic — localhost / 127.0.0.1 / file: → local, else supabase

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '']);

function detect() {
    const params = new URL(window.location.href).searchParams;
    const fromUrl = params.get('source');
    if (fromUrl === 'local' || fromUrl === 'supabase') {
        localStorage.setItem('data_source', fromUrl);
        return fromUrl;
    }
    const stored = localStorage.getItem('data_source');
    if (stored === 'local' || stored === 'supabase') return stored;
    return LOCAL_HOSTS.has(window.location.hostname) ? 'local' : 'supabase';
}

export const DATA_SOURCE = detect();
export const IS_LOCAL = DATA_SOURCE === 'local';
