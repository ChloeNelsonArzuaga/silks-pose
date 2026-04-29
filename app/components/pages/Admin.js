import { VideoLabeler } from '../VideoLabeler.js';

export function Admin() {
    const page = document.createElement('div');
    page.className = 'page page-admin';
    page.innerHTML = `
        <h2>Admin Dashboard</h2>
        <p>Label videos and manage the training dataset.</p>
    `;

    // Add labeler widget below the cards
    page.appendChild(VideoLabeler());

    return page;
}
