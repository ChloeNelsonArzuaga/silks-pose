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
        container.appendChild(page());
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
