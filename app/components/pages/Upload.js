export function Upload() {
    const page = document.createElement('div');
    page.className = 'page page-upload';

    page.innerHTML = `
        <div class="upload-header">
            <h2>Upload Video</h2>
            <p>Upload a video of your aerial silk routine to get pose analysis.</p>
        </div>
        <div class="upload-area" id="upload-area">
            <div class="upload-prompt">
                <div class="upload-icon-wrap">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 16 12 12 8 16"></polyline>
                        <line x1="12" y1="12" x2="12" y2="21"></line>
                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
                    </svg>
                </div>
                <p class="upload-label">Drag and drop your video here</p>
                <p class="upload-hint">or click to browse &mdash; .mov, .mp4, .avi supported</p>
            </div>
            <input type="file" id="file-input" accept="video/*" hidden>
        </div>
        <div id="upload-status"></div>
        <div class="upload-note">
            <strong>Note:</strong> Processing is not yet available in the browser. To analyze a video, add it to <code>data/raw_videos/</code> and run the pipeline locally.
        </div>
    `;

    const area = page.querySelector('#upload-area');
    const input = page.querySelector('#file-input');

    area.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) showSelected(page, file);
    });

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) showSelected(page, file);
    });

    return page;
}

function showSelected(page, file) {
    const status = page.querySelector('#upload-status');
    status.innerHTML = `
        <div class="selected-file">
            <div class="selected-file-info">
                <span class="selected-file-name">${file.name}</span>
                <span class="selected-file-size">${(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <button class="btn btn-primary" disabled>Analyze (coming soon)</button>
        </div>
    `;
}
