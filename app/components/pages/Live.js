import { FilesetResolver, PoseLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const IGNORE = new Set([0,1,2,3,4,5,6,7,8,9,10]); // face landmarks

export function Live() {
    const page = document.createElement('div');
    page.className = 'page page-live';

    page.innerHTML = `
        <div class="live-layout">
            <div class="live-header">
                <h1 class="lib-title">Live Capture</h1>
                <p class="lib-subtitle">Record your routine with real-time pose detection.</p>
            </div>
            <div class="live-stage">
                <div class="live-video-wrap">
                    <video class="live-video" id="live-video" autoplay muted playsinline></video>
                    <canvas class="live-canvas" id="live-canvas"></canvas>
                </div>
            </div>
            <div class="live-controls">
                <button class="live-btn live-btn-start" id="live-start">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
                    Start Camera
                </button>
                <button class="live-btn live-btn-record" id="live-record" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
                    Record
                </button>
                <button class="live-btn live-btn-stop" id="live-stop" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    Stop
                </button>
            </div>
            <div class="live-recordings" id="live-recordings"></div>
        </div>
    `;

    const video = page.querySelector('#live-video');
    const canvas = page.querySelector('#live-canvas');
    const startBtn = page.querySelector('#live-start');
    const recordBtn = page.querySelector('#live-record');
    const stopBtn = page.querySelector('#live-stop');
    const recordings = page.querySelector('#live-recordings');

    let landmarker = null;
    let connections = null;
    let stream = null;
    let recorder = null;
    let chunks = [];
    let animFrame = null;
    let lastVideoTime = -1;
    let canvasSized = false;

    async function initLandmarker() {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
        });
        connections = PoseLandmarker.POSE_CONNECTIONS;
    }

    startBtn.addEventListener('click', async () => {
        startBtn.disabled = true;
        startBtn.textContent = 'Starting…';

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            video.srcObject = stream;
            await video.play();

            startBtn.textContent = 'Loading model…';
            await initLandmarker();

            startBtn.textContent = 'Camera On';
            recordBtn.disabled = false;
            detect();
        } catch (err) {
            startBtn.disabled = false;
            startBtn.textContent = 'Start Camera';
            console.error('[live]', err);
        }
    });

    recordBtn.addEventListener('click', () => {
        chunks = [];
        recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = saveRecording;
        recorder.start();
        recordBtn.disabled = true;
        stopBtn.disabled = false;
    });

    stopBtn.addEventListener('click', () => {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        recordBtn.disabled = false;
        stopBtn.disabled = true;
    });

    function detect() {
        animFrame = requestAnimationFrame(detect);
        if (!landmarker || video.readyState < 2) return;

        // Size canvas once when video dimensions are known
        if (!canvasSized && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvasSized = true;
        }

        if (video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;

        const result = landmarker.detectForVideo(video, performance.now());
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (result.landmarks.length > 0) {
            drawSkeleton(ctx, result.landmarks[0]);
        }
    }

    function drawSkeleton(ctx, landmarks) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.strokeStyle = 'rgba(86, 50, 132, 0.85)';
        ctx.lineWidth = 6;
        for (const { start, end } of connections) {
            if (IGNORE.has(start) || IGNORE.has(end)) continue;
            const lA = landmarks[start];
            const lB = landmarks[end];
            if (!lA || !lB || lA.visibility < 0.3 || lB.visibility < 0.3) continue;
            ctx.beginPath();
            ctx.moveTo(lA.x * w, lA.y * h);
            ctx.lineTo(lB.x * w, lB.y * h);
            ctx.stroke();
        }

        for (let i = 0; i < landmarks.length; i++) {
            if (IGNORE.has(i)) continue;
            const lm = landmarks[i];
            if (!lm || lm.visibility < 0.3) continue;
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, 8, 0, 2 * Math.PI);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#563284';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    function saveRecording() {
        const mimeType = getSupportedMimeType();
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toLocaleString();

        const item = document.createElement('div');
        item.className = 'live-recording-item';
        item.innerHTML = `
            <video class="live-rec-preview" src="${url}" controls></video>
            <div class="live-rec-info">
                <span class="live-rec-time">${timestamp}</span>
                <a class="live-rec-download" href="${url}" download="silkvault-${Date.now()}.${ext}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                </a>
            </div>
        `;
        recordings.prepend(item);
    }

    function getSupportedMimeType() {
        const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
        return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
    }

    // Cleanup when page is removed from DOM
    const observer = new MutationObserver(() => {
        if (!document.contains(page)) {
            if (animFrame) cancelAnimationFrame(animFrame);
            if (stream) stream.getTracks().forEach(t => t.stop());
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return page;
}
