export function Admin() {
    const page = document.createElement('div');
    page.className = 'page page-admin';
    page.innerHTML = `
        <h2>Admin Dashboard</h2>
        <p>Model training and pipeline management tools.</p>
        <div class="admin-grid">
            <div class="admin-card">
                <h3>Pipeline</h3>
                <p>Run pose detection pipeline on uploaded videos.</p>
                <button class="btn btn-secondary" disabled>Coming soon</button>
            </div>
            <div class="admin-card">
                <h3>Training</h3>
                <p>Train and evaluate pose detection models.</p>
                <button class="btn btn-secondary" disabled>Coming soon</button>
            </div>
            <div class="admin-card">
                <h3>Library</h3>
                <p>Browse and search processed poses.</p>
                <button class="btn btn-secondary" disabled>Coming soon</button>
            </div>
        </div>
    `;
    return page;
}
