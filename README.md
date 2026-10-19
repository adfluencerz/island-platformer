# Three.js Platformer — Starter

A minimal 3D platformer scaffold built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).

## What's included
- A player capsule with gravity, jumping, and WASD/arrow-key movement
- Simple AABB collision so you can land on and jump between platforms
- A staggered set of starter platforms to test jumping
- A camera that smoothly follows the player from an angled overhead view
- A stylized farmer character with walk, jump, landing and hoe-swing animations
- Shadows and basic lighting (hemisphere + directional "sun")

## Setup

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Controls
- `W`/`A`/`S`/`D` or arrow keys — move
- `Space` — jump (only works while grounded)

## Project structure
```
threejs-platformer/
├── index.html        # entry point, mounts the canvas
├── src/
│   └── main.js        # scene setup, player physics, platforms, game loop
├── package.json
```

## Where to go next
- Swap the capsule/boxes for real models (glTF via `GLTFLoader`)
- Add collectibles, moving platforms, or hazards
- Replace the simple AABB resolver with a physics engine (e.g. `cannon-es` or `rapier3d`) once you need more complex shapes
- Add a start screen / win condition

## Build for production
```bash
npm run build
npm run preview
```
