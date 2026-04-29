export function Progress() {
    const page = document.createElement('div');
    page.className = 'page page-placeholder';
    page.innerHTML = `
        <div class="placeholder-wrap">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <h2>Progress</h2>
            <p>Track your aerial silk journey over time. Coming soon.</p>
        </div>
    `;
    return page;
}
