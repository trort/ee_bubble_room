# Game Design Document: EE's Bubble Room!

## 1. Project Overview

**EE's Bubble Room!** is a client-side AR web application hosted on **GitHub Pages**. It transforms the player into a vibrant neon silhouette within a themed world. The game is specifically tuned for the motor skills and attention spans of children aged 4–6.

## 2. Technical Architecture

* **Hosting:** GitHub Pages (Static site).
* **Logic:** JavaScript (ES6+) with **MediaPipe Selfie Segmentation**.
* **Rendering:** HTML5 Canvas for the game world; CSS3 for the Start/End UI overlays.
* **Persistence:** `localStorage` for the Top 5 High Scores.
* **Performance:** Object Pooling for bubbles to maintain 60 FPS on tablets and laptops.

---

## 3. Game Flow & Logic

### A. The Start Sequence

1. **Start Menu:** Selection of Color and Theme + Giant "GO" Button.
2. **Countdown Stage:** A 3-second countdown () appears in the center.
* The camera initializes.
* The **Theme Background** and **Player Silhouette** are visible so the child can "find themselves" in the frame before bubbles appear.



### B. Refined Bubble Mechanics

* **Growth:** Bubbles "inflate" from the side edges () over –.
* **Continuous Adaptive Rate:** The spawn interval () is determined by the current bubble count ():



*This ensures the screen never feels "empty" but never becomes impossible for a child to clear.*
* **Velocity:** Launch angle is fixed at  (up or down from horizontal), but initial speed is randomized between a "Slow Drift" and a "Gentle Float."

### C. The Solar Flare (Special Event)

* **Appearance:** One special, pulsating/glowing bubble spawns from the left or right between **45s and 53s**.
* **The "Big Pop":** When touched, it triggers a screen-wide clear with a unique sound effect.

---

## 4. Visual Assets Checklist

Since you are deploying to GitHub, you will need a `assets/` folder. Here is what you need to create or source:

### UI & Backgrounds

* [ ] **Theme Backgrounds (4):** `unicorn_bg.jpg`, `rainbow_bg.jpg`, `forest_bg.jpg`, `undersea_bg.jpg`. (High-res, optimized for web).
* [ ] **Theme Borders (4):** PNG files with transparency. Use **9-slice-ready** designs where corners are distinct from the tiling edges.
* [ ] **Victory Badge:** `badge_top5.png` (A gold star, medal, or trophy icon).
* [ ] **Icons:** Simple icons for the Start Menu (a small unicorn, a leaf, etc.) to help non-readers.

### Sprites & Shaders

* [ ] **Standard Bubble:** A PNG with a "soap film" look (iridescent highlights and transparency).
* [ ] **Solar Flare:** A variation of the bubble with a glow/aura (can be achieved via CSS filters or a specific sprite).

### Sounds

* [ ] **BGM (4):** One 60-second loop per theme.
* [ ] **The "Pop":** `bubble_pop.mp3`.
* [ ] **Solar Flare Sound:** `powerup_spawn.mp3` and `screen_clear.mp3`.
* [ ] **Presence Alert:** `ping_alert.mp3` (A friendly "ding-dong" or chime to indicate the player is out of frame).
* [ ] **Countdown:** `tick.mp3` and `start_bell.mp3`.

---

## 5. Responsive Design Strategy: The "Safety Box"

To support both a laptop (Landscape) and a phone (Portrait):

1. **Canvas Scaling:** The internal game resolution will be fixed (e.g., ), but the CSS will use `object-fit: contain` to ensure the game always fits the screen without cutting off the side edges (where bubbles spawn).
2. **The 9-Slice Border:**
This allows the frame to "hug" the edges of any screen size perfectly.

---

## 6. Local Storage & Results

* **Data Structure:** An array of objects `[{name: "Player", score: 120}, ...]` stored in `localStorage`.
* **Special Message:** If `currentScore > lowestTop5`, display the **Victory Badge** prominently.

---

## Final Refinement

* **HTTPS Requirement:** GitHub Pages serves over HTTPS. MediaPipe and Webcam access **require** HTTPS to function. This is already handled by GitHub, but you will need to ensure your code handles "Camera Permission Denied" gracefully.
