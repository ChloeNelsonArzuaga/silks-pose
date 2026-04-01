export function Navbar() {
    const nav = document.createElement('nav');
    nav.className = 'navbar';
    nav.innerHTML = `
        <div class="navbar-brand">
            <a href="#/">Silks Pose</a>
        </div>
        <div class="navbar-links">
            <a href="#/">Home</a>
            <a href="#/upload">Upload</a>
            <a href="#/admin">Admin</a>
        </div>
    `;
    return nav;
}
