import { supabase } from '../lib/supabase.js';
import { openUploadModal } from './UploadModal.js';

export function Navbar(session) {
    const nav = document.createElement('nav');
    nav.className = 'navbar';
    nav.innerHTML = `
        <div class="navbar-brand">
            <div class="brand-icon">
                <img src="app/assets/logo.png" alt="" class="brand-logo">
            </div>
            <div class="brand-text">
                <a href="#/" class="brand-name">SilkVault</a>
                <span class="brand-tagline">YOUR AERIAL JOURNEY, SAVED.</span>
            </div>
        </div>
        <div class="navbar-links">
            <a href="#/" class="nav-link" data-path="/">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                Library
            </a>
            <a href="#/collections" class="nav-link" data-path="/collections">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Collections
            </a>
            <a href="#/progress" class="nav-link" data-path="/progress">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Progress
            </a>
            <a href="#/favorites" class="nav-link" data-path="/favorites">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Favorites
            </a>
            <a href="#/live" class="nav-link" data-path="/live">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
                Live
            </a>
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
                ${session?.user?.app_metadata?.role === 'admin' ? `
                <div class="avatar-menu-divider"></div>
                <a href="#/dataset" class="avatar-menu-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    Dataset
                </a>
                <a href="#/admin" class="avatar-menu-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Admin
                </a>
                <div class="avatar-menu-divider"></div>
                ` : ''}
                <button class="avatar-menu-signout" id="nav-signout">Sign out</button>
            </div>
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

    // Upload from navbar — open the modal; it handles file picking and the test video
    nav.querySelector('#nav-upload-btn').addEventListener('click', () => openUploadModal());

    return nav;
}
