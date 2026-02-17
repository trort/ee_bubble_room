# 🫧 Bubble Room — Junior Edition

An **AR web game** designed for children aged 4–6. Players become a vibrant neon silhouette and pop floating bubbles by moving their body!

![HTML5](https://img.shields.io/badge/HTML5-Canvas-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Selfie_Segmentation-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **Real-time AR** — MediaPipe Selfie Segmentation transforms the player into a glowing silhouette
- **Themed Backgrounds** — Each theme has a unique generated background image
- **Countdown Preview** — See your silhouette during the 3-2-1 countdown so kids can find themselves
- **Bubble Physics** — 60 bubbles with elastic collisions, edge bouncing, and organic drift
- **Solar Flare** — A special rainbow-pulsing orb that chain-pops every bubble on screen
- **4 Themes** — Unicorn 🦄, Rainbow 🌈, Forest 🌲, and Undersea 🐠
- **4 Silhouette Colors** — Hot Pink, Cyan, Lime, and Gold
- **High Scores** — Top 5 saved locally via `localStorage`
- **Graceful Fallback** — Game works even without camera access

## 🎮 How to Play

1. Choose your **theme** and **silhouette color**
2. Press **GO!** and wait for the 3-2-1 countdown
3. **Move your body** to pop bubbles before time runs out (60 seconds)
4. Watch for the **Solar Flare** near the end — it's worth 50 points and clears the screen!

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/trort/ee_bubble_room.git
cd ee_bubble_room

# Serve locally (HTTPS required for camera access)
python3 -m http.server 8080

# Open in browser
# http://localhost:8080
```

> **Note:** Camera access requires a secure context (HTTPS or localhost). GitHub Pages provides HTTPS automatically.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **HTML5 Canvas** | Game rendering |
| **JavaScript (ES6+)** | Game logic, physics |
| **MediaPipe Tasks Vision** | Real-time person segmentation |
| **CSS3** | UI overlays, animations |
| **localStorage** | High score persistence |

## 📁 Project Structure

```
bubble_room/
├── index.html          # Main HTML with game canvas and UI overlays
├── style.css           # Styling for start/end screens, HUD, animations
├── script.js           # Core game logic, physics, segmentation
├── assets/             # Generated theme background images
├── DESIGN_DOC.md       # Full game design document
└── README.md
```

## 🎯 Game Design

See [DESIGN_DOC.md](DESIGN_DOC.md) for the full game design document, including:
- Bubble mechanics and adaptive spawn rates
- Solar Flare special event details
- Visual asset checklist
- Responsive design strategy

## 📄 License

MIT
