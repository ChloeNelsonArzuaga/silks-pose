export function Upload() {
    const page = document.createElement('div');
    page.className = 'page page-upload';
    page.innerHTML = `
        <h2>Upload Video</h2>
        <p>Upload a video of your aerial silk routine to get pose analysis.</p>
        <div class="upload-area" id="upload-area">
            <div class="upload-prompt">
                <span class="upload-icon">+</span>
                <p>Drag and drop a video file here, or click to browse</p>
                <p class="upload-hint">Supported formats: .mov, .mp4, .avi</p>
            </div>
            <input type="file" id="file-input" accept="video/*" hidden>
        </div>
        <div id="upload-status"></div>
    `;

    // Wire up click-to-browse
    const area = page.querySelector('#upload-area');
    const input = page.querySelector('#file-input');
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) showSelected(page, file);
    });

    // Drag and drop
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
            <strong>${file.name}</strong> (${(file.size / 1024 / 1024).toFixed(1)} MB)
            <button class="btn btn-primary" disabled>Process (coming soon)</button>
        </div>
    `;
}
