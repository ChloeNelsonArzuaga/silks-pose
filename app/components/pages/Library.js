export function Library() {
    const page = document.createElement('div');
    page.className = 'page page-library';

    page.innerHTML = `
        <div class="library-header">
            <h2>Pose Library</h2>
            <p>Browse videos by pose. Search to filter by move name.</p>
            <div class="library-search-wrap">
                <input
                    class="library-search"
                    type="text"
                    placeholder="Search poses..."
                    id="library-search"
                    autocomplete="off"
                />
            </div>
        </div>
        <div class="library-grid" id="library-grid">
            <p class="labeler-empty">Loading library...</p>
        </div>
    `;

    let videos = [];
    const grid = page.querySelector('#library-grid');
    const searchInput = page.querySelector('#library-search');

    // Only show videos with at least one label and a known split
    const SHOW_SPLITS = new Set(['labeled', 'train', 'test']);

    fetch('app/videos.json')
        .then(r => r.json())
        .then(data => {
            videos = data
                .filter(v => SHOW_SPLITS.has(v.split) && v.labels && v.labels.length > 0)
                .map(v => ({
                    ...v,
                    labels: JSON.parse(localStorage.getItem(`labels_${v.id}`) || JSON.stringify(v.labels || [])),
                }));
            render('');
        })
        .catch(() => {
            grid.innerHTML = '<p class="labeler-empty">No videos found — run generate_manifest.py</p>';
        });

    searchInput.addEventListener('input', () => render(searchInput.value.trim().toLowerCase()));

    function getPoses(video) {
        const seen = new Set();
        return video.labels
            .map(l => l.label && l.label.trim())
            .filter(l => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
    }

    function render(query) {
        const filtered = query
            ? videos.filter(v => getPoses(v).some(p => p.toLowerCase().includes(query)))
            : videos;

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="labeler-empty">${query ? `No videos found for "${query}"` : 'No labeled videos yet.'}</p>`;
            return;
        }

        grid.innerHTML = filtered.map(v => {
            const poses = getPoses(v);
            const highlighted = query
                ? poses.map(p => p.toLowerCase().includes(query)
                    ? `<span class="pose-tag pose-tag-match">${p}</span>`
                    : `<span class="pose-tag">${p}</span>`)
                : poses.map(p => `<span class="pose-tag">${p}</span>`);

            return `
                <div class="library-card">
                    <div class="library-thumb-wrap">
                        <canvas class="library-thumb" data-src="${v.path}"></canvas>
                    </div>
                    <div class="library-card-body">
                        <div class="library-card-name">${v.filename}</div>
                        <div class="library-poses">${highlighted.join('')}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Generate thumbnails
        grid.querySelectorAll('canvas.library-thumb').forEach(canvas => {
            captureMidframe(canvas, canvas.dataset.src);
        });
    }

    function captureMidframe(canvas, src) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.preload = 'metadata';
        vid.addEventListener('loadedmetadata', () => { vid.currentTime = vid.duration / 2; });
        vid.addEventListener('seeked', () => {
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            canvas.getContext('2d').drawImage(vid, 0, 0);
            vid.src = '';
        });
    }

    return page;
}
