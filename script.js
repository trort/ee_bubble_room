// ============================================================
// EE's Bubble Room!
// ============================================================
import {
    ImageSegmenter,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";

// ---- DOM refs ----
const video = document.getElementById('webcam');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const countdownOv = document.getElementById('countdown-overlay');
const countdownNum = document.getElementById('countdown-number');
const endScreen = document.getElementById('end-screen');
const finalScoreEl = document.getElementById('final-score');
const highScoresEl = document.getElementById('high-scores-list');
const restartBtn = document.getElementById('restart-btn');
const themeBtns = document.querySelectorAll('.theme-btn');
const colorBtns = document.querySelectorAll('.color-btn');

// ---- Settings ----
let selectedTheme = 'random';
let selectedColor = 'random';

const THEME_COLORS = {
    unicorn: { bg: '#2e0854', accent: '#e040fb' },
    rainbow: { bg: '#1a2744', accent: '#ffd600' },
    forest: { bg: '#0d2b0d', accent: '#69f0ae' },
    undersea: { bg: '#012040', accent: '#00e5ff' },
};

// ---- Preloaded theme images ----
const bgImages = {};
const THEMES = ['unicorn', 'rainbow', 'forest', 'undersea'];
THEMES.forEach(t => {
    const bg = new Image();
    bg.src = `assets/${t}_bg.png`;
    bgImages[t] = bg;
});

// ---- Offscreen canvas for silhouette (avoids getImageData) ----
let offCanvas = null;
let offCtx = null;
let maskCanvas = null;
let maskCtx = null;

const SILHOUETTE_RGB = {
    hotpink: [255, 105, 180],
    cyan: [0, 255, 255],
    lime: [50, 255, 50],
    gold: [255, 215, 0],
};

// ---- MediaPipe ----
let imageSegmenter = null;
let webcamRunning = false;
let lastVideoTime = -1;

// Person mask (smoothed, mirrored Float32Array)
let personMask = null; // current smoothed mask
let prevMask = null; // previous frame's mask for temporal smoothing
let maskW = 0;
let maskH = 0;
// Layout metrics for centering/scaling video to cover screen
let renderScale = 1;
let renderDx = 0;
let renderDy = 0;

function updateLayout() {
    const W = canvas.width;
    const H = canvas.height;
    if (maskW > 0 && maskH > 0) {
        renderScale = Math.max(W / maskW, H / maskH);
        const dw = maskW * renderScale;
        const dh = maskH * renderScale;
        renderDx = (W - dw) / 2;
        renderDy = (H - dh) / 2;
    }
}
const PERSON_THRESHOLD = 0.40;
const MASK_SMOOTHING = 0.35; // blend factor: 0 = all old, 1 = all new

// ---- Game State ----
const GAME_DURATION_MS = 60_000;
const BUBBLE_POOL_SIZE = 60;

let gameActive = false;
let score = 0;
let gameStartMs = 0;
let lastSpawnMs = 0;
let solarSpawned = false;

// ---- Bubble Physics Constants ----
const EDGE_MARGIN = 10;   // px from canvas edge where bubbles bounce
const BOUNCE_DAMPING = 0.85; // energy retained on bounce
const BUBBLE_BOUNCE = 0.6;  // energy retained on bubble-bubble bounce
const MIN_SPAWN_DIST = 80;   // min px between spawn points

// ---- Bubble Pool ----
class Bubble {
    constructor() { this.reset(); }
    reset() {
        this.active = false;
        this.x = 0; this.y = 0;
        this.radius = 0; this.maxRadius = 0;
        this.vx = 0; this.vy = 0;
        this.growthRate = 0;
        this.isSolar = false;
        this.colorIdx = 0;
        this.phase = Math.random() * Math.PI * 2;
        this.mass = 1;
    }

    spawn(w, h, isSolar = false, spawnX = -1, spawnY = -1) {
        this.active = true;
        this.isSolar = isSolar;
        const unit = Math.min(w, h); // base unit for relative sizing
        this.radius = unit * 0.005; // start tiny
        this.maxRadius = isSolar
            ? unit * (0.14 + Math.random() * 0.04)   // solar: 14-18% of screen
            : unit * (0.04 + Math.random() * 0.04);   // normal: 4-8% of screen
        this.growthRate = unit * 0.0014 + Math.random() * unit * 0.001;
        this.colorIdx = Math.floor(Math.random() * BUBBLE_FILL.length);
        this.phase = Math.random() * Math.PI * 2;
        this.mass = this.maxRadius * this.maxRadius;

        if (spawnX >= 0 && spawnY >= 0) {
            this.x = spawnX;
            this.y = spawnY;
        } else {
            const fromLeft = Math.random() < 0.5;
            this.x = fromLeft ? -5 : w + 5;
            this.y = h * 0.1 + Math.random() * (h * 0.8);
        }

        const baseAngle = this.x < w / 2 ? 0 : Math.PI;
        const spread = (Math.random() - 0.5) * (Math.PI * 0.65);
        const speed = unit * (0.005 + Math.random() * 0.005); // relative speed
        this.vx = Math.cos(baseAngle + spread) * speed;
        this.vy = Math.sin(baseAngle + spread) * speed;
    }

    update(w, h) {
        if (!this.active) return;

        // Grow
        if (this.radius < this.maxRadius) this.radius += this.growthRate;

        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        const r = this.radius;
        if (this.x - r < EDGE_MARGIN) {
            this.x = EDGE_MARGIN + r;
            this.vx = Math.abs(this.vx) * BOUNCE_DAMPING;
        } else if (this.x + r > w - EDGE_MARGIN) {
            this.x = w - EDGE_MARGIN - r;
            this.vx = -Math.abs(this.vx) * BOUNCE_DAMPING;
        }
        if (this.y - r < EDGE_MARGIN) {
            this.y = EDGE_MARGIN + r;
            this.vy = Math.abs(this.vy) * BOUNCE_DAMPING;
        } else if (this.y + r > h - EDGE_MARGIN) {
            this.y = h - EDGE_MARGIN - r;
            this.vy = -Math.abs(this.vy) * BOUNCE_DAMPING;
        }

        // Add a tiny random drift each frame for organic feel
        this.vx += (Math.random() - 0.5) * 0.08;
        this.vy += (Math.random() - 0.5) * 0.08;

        // Clamp max speed
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpd = 5;
        if (spd > maxSpd) {
            this.vx = (this.vx / spd) * maxSpd;
            this.vy = (this.vy / spd) * maxSpd;
        }
    }

    draw(ctx, t) {
        if (!this.active || this.radius < 1) return;
        const r = this.radius;
        ctx.save();

        if (this.isSolar) {
            // ---- Solar Flare: pulsing, rainbow-ringed, glowing orb ----
            const pulse = 0.8 + 0.2 * Math.sin(t * 0.008 + this.phase);
            const ringPulse = 1 + 0.15 * Math.sin(t * 0.004 + this.phase);

            // Outer glow rings (pulsing)
            for (let ring = 3; ring >= 1; ring--) {
                const ringR = r * (1 + ring * 0.25) * ringPulse;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ringR, 0, Math.PI * 2);
                const hue = (t * 0.1 + ring * 60 + this.phase * 30) % 360;
                ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.25 / ring})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Core gradient (rainbow shimmer)
            const hueBase = (t * 0.15 + this.phase * 50) % 360;
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
            grad.addColorStop(0, `hsla(${hueBase}, 100%, 90%, ${pulse})`);
            grad.addColorStop(0.4, `hsla(${(hueBase + 40) % 360}, 100%, 65%, ${pulse * 0.9})`);
            grad.addColorStop(0.8, `hsla(${(hueBase + 120) % 360}, 100%, 55%, ${pulse * 0.7})`);
            grad.addColorStop(1, `hsla(${(hueBase + 200) % 360}, 100%, 50%, 0.1)`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.shadowColor = `hsl(${hueBase}, 100%, 70%)`;
            ctx.shadowBlur = 50;
            ctx.fill();

            // Inner star / cross highlight
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `hsla(${hueBase}, 100%, 95%, 0.7)`;
            ctx.lineWidth = 2;
            const starLen = r * 0.6;
            for (let a = 0; a < 4; a++) {
                const angle = (a * Math.PI / 4) + t * 0.002;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(angle) * starLen, this.y + Math.sin(angle) * starLen);
                ctx.stroke();
            }
        } else {
            // ---- Normal bubble ----
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fillStyle = BUBBLE_FILL[this.colorIdx];
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            // Highlight shine
            ctx.beginPath();
            ctx.ellipse(
                this.x - r * 0.25, this.y - r * 0.28,
                r * 0.22, r * 0.12,
                -0.5, 0, Math.PI * 2
            );
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fill();
        }

        ctx.restore();
    }
}

const BUBBLE_FILL = [
    'rgba(135, 206, 250, 0.50)',
    'rgba(255, 182, 193, 0.50)',
    'rgba(152, 251, 152, 0.50)',
    'rgba(255, 255, 180, 0.50)',
    'rgba(221, 160, 255, 0.50)',
    'rgba(255, 200, 120, 0.50)',
    'rgba(180, 230, 255, 0.50)',
];

const bubbles = [];
for (let i = 0; i < BUBBLE_POOL_SIZE; i++) bubbles.push(new Bubble());

// ---- Smart Spawning ----
// Finds a random edge position that is at least MIN_SPAWN_DIST away from
// all other active bubbles' positions.
function findSpawnPos(w, h, attempts = 12) {
    for (let a = 0; a < attempts; a++) {
        const fromLeft = Math.random() < 0.5;
        const sx = fromLeft ? -3 : w + 3;
        const sy = h * 0.1 + Math.random() * (h * 0.8);
        let tooClose = false;
        for (const ob of bubbles) {
            if (!ob.active) continue;
            const dx = ob.x - sx;
            const dy = ob.y - sy;
            if (dx * dx + dy * dy < MIN_SPAWN_DIST * MIN_SPAWN_DIST) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) return [sx, sy];
    }
    // Fallback: random edge position anyway
    const fromLeft = Math.random() < 0.5;
    return [fromLeft ? -3 : w + 3, h * 0.1 + Math.random() * (h * 0.8)];
}

function spawnBubble(isSolar = false) {
    const b = bubbles.find(b => !b.active);
    if (!b) return;
    const [sx, sy] = findSpawnPos(canvas.width, canvas.height);
    b.spawn(canvas.width, canvas.height, isSolar, sx, sy);
}

// ---- Bubble-Bubble Collision ----
function resolveBubbleBubbleCollisions() {
    // Iterate directly over pool — no intermediate array allocation
    for (let i = 0; i < bubbles.length; i++) {
        const a = bubbles[i];
        if (!a.active) continue;
        for (let j = i + 1; j < bubbles.length; j++) {
            const b = bubbles[j];
            if (!b.active) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius;
            if (distSq < minDist * minDist && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;
                const totalMass = a.mass + b.mass;
                const ratioA = b.mass / totalMass;
                const ratioB = a.mass / totalMass;
                a.x -= nx * overlap * ratioA;
                a.y -= ny * overlap * ratioA;
                b.x += nx * overlap * ratioB;
                b.y += ny * overlap * ratioB;

                const dvx = a.vx - b.vx;
                const dvy = a.vy - b.vy;
                const dvDotN = dvx * nx + dvy * ny;
                if (dvDotN > 0) {
                    const impulse = dvDotN * BUBBLE_BOUNCE;
                    a.vx -= impulse * ratioA * nx;
                    a.vy -= impulse * ratioA * ny;
                    b.vx += impulse * ratioB * nx;
                    b.vy += impulse * ratioB * ny;
                }
            }
        }
    }
}

// ---- Pop particles ----
const particles = [];
function emitPop(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            size: 3 + Math.random() * 5,
            color,
        });
    }
}

// ---- MediaPipe Init ----
async function initSegmenter() {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            outputCategoryMask: false,
            outputConfidenceMasks: true
        });
        console.log('[Bubble Room] Segmenter ready');
        startBtn.disabled = false;
        startBtn.textContent = '▶ GO!';
    } catch (e) {
        console.warn('[Bubble Room] Segmenter failed to load:', e);
        startBtn.disabled = false;
        startBtn.textContent = '▶ GO! (no AR)';
    }
}

startBtn.disabled = true;
startBtn.textContent = '⏳ Loading AI…';
initSegmenter();

// ---- Camera ----
async function enableCam() {
    if (webcamRunning) return true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 }, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play();
        webcamRunning = true;
        console.log('[Bubble Room] Camera active', video.videoWidth, 'x', video.videoHeight);
        return true;
    } catch (e) {
        console.warn('[Bubble Room] Camera error:', e);
        return false;
    }
}

// ---- Countdown ----
let previewRunning = false;

// Preview loop: draws bg + silhouette during countdown
function previewLoop() {
    if (!previewRunning) return;
    runSegmentation();
    // Use the main draw function logic simplified, or just call drawGame(0) but without bubbles
    // Easier to duplicate simple logic for preview to avoid update recursion
    drawPreview();
    requestAnimationFrame(previewLoop);
}

function drawPreview() {
    const W = canvas.width;
    const H = canvas.height;

    // Background (Tiled, desaturated)
    const bgImg = bgImages[selectedTheme];
    const theme = THEME_COLORS[selectedTheme] || THEME_COLORS.unicorn;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.4;
        ctx.save();
        ctx.scale(2, 2);
        const pat = ctx.createPattern(bgImg, 'repeat');
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // Silhouette (Center Crop/Cover)
    if (personMask && maskW > 0 && maskH > 0) {
        // Use shared layout metrics
        const dw = maskW * renderScale;
        const dh = maskH * renderScale;

        if (!maskCanvas || maskCanvas.width !== maskW || maskCanvas.height !== maskH) {
            maskCanvas = document.createElement('canvas'); maskCanvas.width = maskW; maskCanvas.height = maskH;
            maskCtx = maskCanvas.getContext('2d');
            offCanvas = document.createElement('canvas'); offCanvas.width = maskW; offCanvas.height = maskH;
            offCtx = offCanvas.getContext('2d');
        }

        const maskImgData = maskCtx.createImageData(maskW, maskH);
        const md = maskImgData.data;
        for (let i = 0; i < personMask.length; i++) {
            const v = personMask[i];
            if (v > PERSON_THRESHOLD) {
                const a = Math.floor(Math.min(1.0, v * 1.3) * 220);
                const idx = i * 4;
                md[idx] = 255; md[idx + 1] = 255; md[idx + 2] = 255; md[idx + 3] = a;
            }
        }
        maskCtx.putImageData(maskImgData, 0, 0);

        const rgb = SILHOUETTE_RGB[selectedColor] || SILHOUETTE_RGB.hotpink;
        offCtx.clearRect(0, 0, maskW, maskH);
        offCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        offCtx.fillRect(0, 0, maskW, maskH);
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.drawImage(maskCanvas, 0, 0);
        offCtx.globalCompositeOperation = 'source-over';

        ctx.globalAlpha = 0.5;
        ctx.drawImage(offCanvas, 0, 0, maskW, maskH, renderDx, renderDy, dw, dh);
        ctx.globalAlpha = 1;
    }
}

function runCountdown() {
    return new Promise(resolve => {
        startScreen.classList.add('hidden');
        startScreen.classList.remove('active');
        countdownOv.classList.remove('hidden');
        countdownOv.classList.add('active');

        // Start preview so bg + silhouette are visible under the countdown
        previewRunning = true;
        requestAnimationFrame(previewLoop);

        let count = 3;
        countdownNum.textContent = count;
        const iv = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(iv);
                previewRunning = false; // stop preview
                countdownOv.classList.add('hidden');
                countdownOv.classList.remove('active');
                resolve();
            } else {
                countdownNum.textContent = count;
                countdownNum.style.animation = 'none';
                void countdownNum.offsetHeight;
                countdownNum.style.animation = '';
            }
        }, 1000);
    });
}

// ---- Game Start / End ----
async function handleStart() {
    startBtn.disabled = true;

    // Resolve random selections
    const themes = ['unicorn', 'rainbow', 'forest', 'undersea'];
    const colors = Object.keys(SILHOUETTE_RGB);
    if (selectedTheme === 'random') selectedTheme = themes[Math.floor(Math.random() * themes.length)];
    if (selectedColor === 'random') selectedColor = colors[Math.floor(Math.random() * colors.length)];

    const camOk = await enableCam();

    // Set canvas to full window size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    await runCountdown();
    score = 0;
    solarSpawned = false;
    bubbles.forEach(b => b.reset());
    particles.length = 0;
    personMask = null;
    prevMask = null;
    maskW = 0;
    maskH = 0;
    gameStartMs = performance.now();
    lastSpawnMs = gameStartMs;
    scoreEl.textContent = 'Score: 0';
    timerEl.textContent = 'Time: 60';
    hud.classList.remove('hidden');
    hud.classList.add('active');
    endScreen.classList.add('hidden');
    gameActive = true;
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameActive = false;
    hud.classList.add('hidden');
    hud.classList.remove('active');
    endScreen.classList.remove('hidden');
    endScreen.classList.add('active');
    finalScoreEl.textContent = `Final Score: ${score}`;
    saveHighScore(score);
    renderHighScores();
}

// ---- High Scores ----
function loadHighScores() {
    try { return JSON.parse(localStorage.getItem('bubbleroom_scores') || '[]'); }
    catch { return []; }
}
function saveHighScore(s) {
    const list = loadHighScores();
    list.push({ name: 'Player', score: s });
    list.sort((a, b) => b.score - a.score);
    if (list.length > 5) list.length = 5;
    localStorage.setItem('bubbleroom_scores', JSON.stringify(list));
}
function renderHighScores() {
    const list = loadHighScores();
    if (list.length === 0) { highScoresEl.innerHTML = ''; return; }
    highScoresEl.innerHTML = '<strong>🏆 Top 5</strong><br>' +
        list.map((e, i) => `${i + 1}. ${e.score}`).join('<br>');
}

// ---- Main Game Loop ----
let segFrameToggle = false; // throttle segmentation to every 2nd frame
function gameLoop(now) {
    if (!gameActive) return;

    const elapsed = now - gameStartMs;
    const remaining = Math.max(0, Math.ceil((GAME_DURATION_MS - elapsed) / 1000));
    timerEl.textContent = `Time: ${remaining}`;
    if (remaining <= 0) { endGame(); return; }

    // Run segmentation every other frame for performance
    segFrameToggle = !segFrameToggle;
    if (segFrameToggle) runSegmentation();

    updateGame(now);
    drawGame(now);
    requestAnimationFrame(gameLoop);
}

// ---- Resize Handling ----
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateLayout();
}

// ---- Segmentation with Temporal Smoothing ----
function runSegmentation() {
    if (!imageSegmenter || !webcamRunning) return;
    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    try {
        imageSegmenter.segmentForVideo(video, performance.now(), (result) => {
            if (!result.confidenceMasks || result.confidenceMasks.length === 0) return;

            const rawData = result.confidenceMasks[0].getAsFloat32Array();
            const pixelCount = vw * vh;

            // We store the mask in its NATIVE video resolution (e.g. 640x480)
            // We will scale/crop it when drawing to the full-screen canvas.
            if (!personMask || personMask.length !== pixelCount) {
                personMask = new Float32Array(pixelCount);
                prevMask = new Float32Array(pixelCount);
                maskW = vw;
                maskH = vh;
                updateLayout();
            }

            // Store old mask
            prevMask.set(personMask);

            // Mirror horizontally and apply temporal smoothing
            const alpha = MASK_SMOOTHING; // how much of the new frame to use
            for (let y = 0; y < vh; y++) {
                const rowStart = y * vw;
                for (let x = 0; x < vw; x++) {
                    const newVal = rawData[rowStart + x];
                    const mirroredIdx = rowStart + (vw - 1 - x);
                    const oldVal = prevMask[mirroredIdx];
                    // Blend: smooth = old * (1-α) + new * α
                    personMask[mirroredIdx] = oldVal * (1.0 - alpha) + newVal * alpha;
                }
            }
        });
    } catch (e) { /* transient errors OK */ }
}

// ---- Update ----
function updateGame(now) {
    const elapsed = now - gameStartMs;

    // Count active bubbles without allocating an array
    let activeCnt = 0;
    for (let i = 0; i < bubbles.length; i++) if (bubbles[i].active) activeCnt++;
    const targetBubbles = 15 + Math.floor(elapsed / 4000);
    const interval = activeCnt < targetBubbles ? 250 : 700;

    if (now - lastSpawnMs > interval) {
        spawnBubble(false);
        lastSpawnMs = now;
    }

    // Solar flare: one special bubble between 45s and 53s (per design doc)
    const elapsedSec = elapsed / 1000;
    if (!solarSpawned && elapsedSec >= 45 && elapsedSec <= 53) {
        if (Math.random() < 0.02) { // ~2% per frame for reliable spawn
            spawnBubble(true);
            solarSpawned = true;
        }
    }

    // Update bubbles
    bubbles.forEach(b => b.update(canvas.width, canvas.height));

    // Bubble-bubble bouncing
    resolveBubbleBubbleCollisions();

    // Person-bubble collisions
    checkPersonCollisions();

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // slight gravity on particles
        p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ---- Person Collision Detection ----
function isPersonAt(cx, cy) {
    if (!personMask) return false;
    // Transform screen coord (cx, cy) -> mask coord (mx, my)
    // screen = mask * scale + offset
    // mask = (screen - offset) / scale
    const mx = Math.floor((cx - renderDx) / renderScale);
    const my = Math.floor((cy - renderDy) / renderScale);

    if (mx < 0 || mx >= maskW || my < 0 || my >= maskH) return false;
    return personMask[my * maskW + mx] > PERSON_THRESHOLD;
}

function checkPersonCollisions() {
    if (!personMask) return;

    bubbles.forEach(b => {
        if (!b.active) return;

        // Sample center + 8 points around circumference (every 45°)
        const r70 = b.radius * 0.7;
        const r50 = b.radius * 0.5;
        const pts = [
            [b.x, b.y],
            [b.x - r70, b.y], [b.x + r70, b.y],
            [b.x, b.y - r70], [b.x, b.y + r70],
            [b.x - r50, b.y - r50], [b.x + r50, b.y - r50],
            [b.x - r50, b.y + r50], [b.x + r50, b.y + r50],
        ];
        for (const [px, py] of pts) {
            if (isPersonAt(px, py)) {
                popBubble(b);
                return;
            }
        }
    });
}

// ---- Draw ----
function drawGame(now) {
    const W = canvas.width;
    const H = canvas.height;

    // 1. Background image (tiled, desaturated)
    const theme = THEME_COLORS[selectedTheme] || THEME_COLORS.unicorn;
    const bgImg = bgImages[selectedTheme];

    // Draw solid theme color first, then overlay the pattern at reduced opacity
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.4;
        ctx.save();
        ctx.scale(2, 2);
        const pat = ctx.createPattern(bgImg, 'repeat');
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // 2. Player silhouette (CENTER CROP / COVER)
    if (personMask && maskW > 0 && maskH > 0) {
        // Use shared layout metrics
        const dw = maskW * renderScale;
        const dh = maskH * renderScale;

        // Prepare mask canvas (at native video resolution)
        if (!maskCanvas || maskCanvas.width !== maskW || maskCanvas.height !== maskH) {
            maskCanvas = document.createElement('canvas');
            maskCanvas.width = maskW;
            maskCanvas.height = maskH;
            maskCtx = maskCanvas.getContext('2d');
        }

        // Prepare offscreen canvas (at native video resolution) for color fill
        if (!offCanvas || offCanvas.width !== maskW || offCanvas.height !== maskH) {
            offCanvas = document.createElement('canvas');
            offCanvas.width = maskW;
            offCanvas.height = maskH;
            offCtx = offCanvas.getContext('2d');
        }

        // Put mask data
        const maskImgData = maskCtx.createImageData(maskW, maskH);
        const md = maskImgData.data;
        for (let i = 0; i < personMask.length; i++) {
            const v = personMask[i];
            if (v > PERSON_THRESHOLD) {
                const a = Math.floor(Math.min(1.0, v * 1.3) * 220);
                const idx = i * 4;
                md[idx] = 255;
                md[idx + 1] = 255;
                md[idx + 2] = 255;
                md[idx + 3] = a;
            }
        }
        maskCtx.putImageData(maskImgData, 0, 0);

        // Composite silhouette color + mask (at native res)
        const rgb = SILHOUETTE_RGB[selectedColor] || SILHOUETTE_RGB.hotpink;
        offCtx.clearRect(0, 0, maskW, maskH);
        offCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        offCtx.fillRect(0, 0, maskW, maskH);
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.drawImage(maskCanvas, 0, 0);
        offCtx.globalCompositeOperation = 'source-over';

        // Draw scale/cropped onto main canvas
        ctx.globalAlpha = 0.5;
        ctx.drawImage(offCanvas, 0, 0, maskW, maskH, renderDx, renderDy, dw, dh);
        ctx.globalAlpha = 1;
    }

    // 3. Bubbles
    for (let i = 0; i < bubbles.length; i++) bubbles[i].draw(ctx, now);

    // 4. Particles
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const s = p.size * p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 5. Screen flash (from solar flare pop)
    if (screenFlashAlpha > 0) {
        ctx.globalAlpha = screenFlashAlpha;
        ctx.fillStyle = screenFlashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        screenFlashAlpha -= 0.04;
    }
}

let screenFlashAlpha = 0;
let screenFlashColor = 'white';

function popBubble(b) {
    const wasSolar = b.isSolar;
    b.active = false;

    if (wasSolar) {
        // Dramatic solar flare pop: lots of golden particles + screen flash
        for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 8;
            const hue = Math.floor(Math.random() * 60); // gold-orange range
            particles.push({
                x: b.x, y: b.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                size: 4 + Math.random() * 7,
                color: `hsl(${hue}, 100%, 60%)`,
            });
        }
        screenFlashAlpha = 0.6;
        screenFlashColor = 'rgba(255, 230, 100, 1)';
        score += 50;
        // Chain pop: all other bubbles explode too!
        bubbles.forEach(other => {
            if (other.active) {
                emitPop(other.x, other.y, 'gold');
                other.active = false;
                score += 5;
            }
        });
    } else {
        emitPop(b.x, b.y, 'white');
        score += 10;
    }
    scoreEl.textContent = `Score: ${score}`;
}

// ---- UI Wiring ----
themeBtns.forEach(btn => btn.addEventListener('click', () => {
    themeBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTheme = btn.dataset.theme;
}));

colorBtns.forEach(btn => btn.addEventListener('click', () => {
    colorBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedColor = btn.dataset.color;
}));

startBtn.addEventListener('click', handleStart);
restartBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    endScreen.classList.remove('active');
    handleStart();
});
