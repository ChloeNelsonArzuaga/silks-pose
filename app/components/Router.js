/**
 * Hash-based router for GitHub Pages compatibility.
 * Routes are defined as { '/path': ComponentFunction }.
 * Uses #/path so GitHub Pages doesn't try to resolve real URLs.
 */
export function Router(routes, container) {
    function getPath() {
        const hash = window.location.hash || '#/';
        return hash.slice(1); // remove the '#'
    }

    function render() {
        const path = getPath();
        const page = routes[path] || routes['/'];
        container.innerHTML = '';
        try {
            container.appendChild(page());
        } catch (e) {
            console.error('[router] error rendering', path, e);
            container.innerHTML = `<div style="padding:2rem;color:#c00;font-family:monospace;white-space:pre-wrap"><b>Page error (${path})</b>\n${e.stack || e.message}</div>`;
        }
    }

    function navigate(path) {
        window.location.hash = '#' + path;
    }

    function start() {
        window.addEventListener('hashchange', render);
        render();
    }

    return { start, navigate };
}
