# Game Design Document: EE's Bubble Room!

## 1. Project Overview

**EE's Bubble Room!** is a client-side AR web application hosted on **GitHub Pages**. It transforms the player into a vibrant neon silhouette within a themed world. The game is specifically tuned for the motor skills and attention spans of children aged 4–6.

## 2. Technical Architecture

* **Hosting:** GitHub Pages (Static site).
* **Logic:** JavaScript (ES6+) with **MediaPipe Selfie Segmentation**.
* **Rendering:** HTML5 Canvas for the game world; CSS3 for the Start/End UI overlays.
* **Persistence:** `localStorage` for the Top 5 High Scores.
* **Performance:** Object Pooling (60 bubbles) to maintain 60 FPS on tablets and laptops.

---

## 3. Game Flow & Logic

### A. The Start Sequence

1. **Start Menu:** Selection of Color (Hot Pink, Cyan, Lime, Gold, or Random) and Theme (Unicorn, Rainbow, Forest, Undersea, or Random) + Giant "GO" Button.
2. **Countdown Stage:** A 3-second countdown (3… 2… 1…) appears in the center.
   * The camera initializes.
   * The **Theme Background** and **Player Silhouette** are visible so the child can "find themselves" in the frame before bubbles appear.
3. **Restart:** When clicking "PLAY AGAIN" after a game ends, the player returns to the **Start Menu** so they can re-choose their theme and color.

### B. Bubble Mechanics

* **Growth:** Bubbles spawn from the left or right edge and "inflate" from a tiny radius up to their max size.
* **Continuous Adaptive Rate:** The target bubble count increases over time: `targetBubbles = 15 + floor(elapsed / 4000)`. Spawn interval is 250ms when below target, 700ms when at or above. This ensures the screen never feels "empty" but never becomes impossible for a child to clear.
* **Velocity:** Launch angle is randomized within ±0.65π radians from horizontal (toward the opposite edge), and initial speed is randomized for organic drift.
* **Physics:** Bubbles bounce off screen edges (with 0.85 damping) and off each other (elastic collisions with 0.6 energy retention). Tiny random drift is added each frame for a natural "floating" feel.

### C. The Solar Flare (Special Event)

* **Appearance:** One special, pulsating/glowing bubble spawns from the left or right between **25s and 35s** of the game.
* **Special Duration:** The solar flare is **special for only 5 seconds** after spawning. During this window it renders with rainbow-pulsing rings and a glowing aura.
* **Transition to Normal:** After 5 seconds, the solar flare becomes a **normal bubble** — it loses its special glow/visuals and awards normal points if popped.
* **The "Big Pop":** If touched while still special (within the first 5 seconds), it triggers a screen-wide clear with a flash effect. Awards 50 points for the solar flare + 5 points per chain-popped bubble.

### D. Scoring

* **Normal Bubble Pop:** 10 points.
* **Solar Flare Pop (while special):** 50 points + chain-pop clears all other bubbles (5 points each).
* **Solar Flare Pop (after becoming normal):** 10 points (treated as regular bubble).

### E. Camera Fallback (No AR Mode)

* When the camera permission is denied or camera is unavailable, the game functions without the AR silhouette.
* In this mode, the player can **click with mouse or tap with finger** to pop bubbles directly.

---

## 4. Visual Assets Checklist

Since you are deploying to GitHub, you will need a `assets/` folder. Here is what you need to create or source:

### UI & Backgrounds

* [x] **Theme Backgrounds (4):** `unicorn_bg.png`, `rainbow_bg.png`, `forest_bg.png`, `undersea_bg.png`. (High-res, optimized for web).
* [ ] **Theme Borders (4):** PNG files with transparency. Use **9-slice-ready** designs where corners are distinct from the tiling edges. *(Not yet implemented)*
* [ ] **Victory Badge:** `badge_top5.png` (A gold star, medal, or trophy icon). *(Not yet implemented)*
* [ ] **Icons:** Simple icons for the Start Menu (a small unicorn, a leaf, etc.) to help non-readers. *(Not yet implemented)*

### Sprites & Shaders

* [x] **Standard Bubble:** Rendered procedurally in canvas (iridescent highlights and transparency).
* [x] **Solar Flare:** Rendered procedurally with rainbow gradient, pulsing glow rings, and star highlights.

### Sounds *(Not yet implemented)*

* [ ] **BGM (4):** One 60-second loop per theme.
* [ ] **The "Pop":** `bubble_pop.mp3`.
* [ ] **Solar Flare Sound:** `powerup_spawn.mp3` and `screen_clear.mp3`.
* [ ] **Presence Alert:** `ping_alert.mp3` (A friendly "ding-dong" or chime to indicate the player is out of frame).
* [ ] **Countdown:** `tick.mp3` and `start_bell.mp3`.

---

## 5. Responsive Design Strategy

To support both a laptop (Landscape) and a phone (Portrait):

1. **Canvas Scaling:** The canvas is set to `window.innerWidth × window.innerHeight` and re-scaled on resize. The video feed (if available) is center-cropped/covered to fill the canvas using computed `renderScale`, `renderDx`, `renderDy`.
2. **CSS Responsive:** Media queries adjust font sizes and button padding for screens < 600px wide.

---

## 6. Local Storage & Results

* **Data Structure:** An array of objects `[{name: "Player", score: 120}, ...]` stored in `localStorage`.
* **Top 5:** Only the top 5 scores are retained.

---

## Final Notes

* **HTTPS Requirement:** GitHub Pages serves over HTTPS. MediaPipe and Webcam access **require** HTTPS to function. This is already handled by GitHub, but the code handles "Camera Permission Denied" gracefully by enabling click/touch input as a fallback.
