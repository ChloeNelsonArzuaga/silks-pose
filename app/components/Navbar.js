import { supabase } from '../lib/supabase.js';

export function Navbar(session) {
    const nav = document.createElement('nav');
    nav.className = 'navbar';
    nav.innerHTML = `
        <div class="navbar-brand">
            <div class="brand-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 4 C10 4 6 9 8 14 C10 19 8 24 16 28 C24 24 22 19 24 14 C26 9 22 4 16 4Z" stroke="#5c4ec9" stroke-width="1.5" fill="none"/>
                    <path d="M16 4 C16 10 20 14 16 28" stroke="#5c4ec9" stroke-width="1.2" fill="none"/>
                </svg>
            </div>
            <div class="brand-text">
                <a href="#/" class="brand-name">SilkVault</a>
                <span class="brand-tagline">YOUR AERIAL JOURNEY, SAVED.</span>
            </div>
        </div>
        <div class="navbar-links">
            <a href="#/" class="nav-link" data-path="/">Library</a>
            <a href="#/dataset" class="nav-link" data-path="/dataset">Collections</a>
            <a href="#/admin" class="nav-link" data-path="/admin">Admin</a>
        </div>
        <div class="navbar-actions">
            <button class="btn btn-nav-upload" id="nav-upload-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Upload
            </button>
            <div class="avatar-circle" id="nav-avatar" title="${session?.user?.email || ''}">${(session?.user?.email?.[0] ?? 'S').toUpperCase()}</div>
            <div class="avatar-menu" id="avatar-menu" hidden>
                <div class="avatar-menu-email">${session?.user?.email ?? ''}</div>
                <button class="avatar-menu-signout" id="nav-signout">Sign out</button>
            </div>
            <input type="file" id="nav-file-input" accept="video/*" hidden>
        </div>
    `;

    // Active link highlighting
    function setActive() {
        const hash = window.location.hash.replace('#', '') || '/';
        nav.querySelectorAll('.nav-link').forEach(a => {
            a.classList.toggle('nav-active', a.dataset.path === hash);
        });
    }
    setActive();
    window.addEventListener('hashchange', setActive);

    // Avatar menu
    const avatar = nav.querySelector('#nav-avatar');
    const avatarMenu = nav.querySelector('#avatar-menu');
    avatar.addEventListener('click', e => {
        e.stopPropagation();
        avatarMenu.hidden = !avatarMenu.hidden;
    });
    document.addEventListener('click', () => { avatarMenu.hidden = true; });
    nav.querySelector('#nav-signout').addEventListener('click', () => supabase.auth.signOut());

    // Upload from navbar
    const uploadBtn = nav.querySelector('#nav-upload-btn');
    const fileInput = nav.querySelector('#nav-file-input');
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        // Show a brief toast
        const toast = document.createElement('div');
        toast.className = 'upload-toast';
        toast.textContent = `${file.name} selected — add to data/raw_videos/ and run the pipeline`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('toast-visible'), 10);
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
        fileInput.value = '';
    });

    return nav;
}
