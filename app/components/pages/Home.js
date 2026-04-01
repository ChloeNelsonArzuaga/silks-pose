export function Home() {
    const page = document.createElement('div');
    page.className = 'page page-home';
    page.innerHTML = `
        <section class="hero">
            <h1>Silks Pose</h1>
            <p>Pose detection and analysis for aerial silk performers.</p>
            <div class="hero-actions">
                <a href="#/upload" class="btn btn-primary">Upload a Video</a>
                <a href="#/admin" class="btn btn-secondary">Admin Dashboard</a>
            </div>
        </section>
    `;
    return page;
}
