# 10 Ground detail

Goal: Painterly detail on the ground, stone and paths, without shimmer.

- `ground` hook on `groundMat`, `turfMat`, `slabMat`, `earthMat`, `roughMat`:
  two value-noise octaves (±8 %, ±4 %) in `highp` world XZ, dark speckle on
  greens, Voronoi-edge cracks and per-slab tint on stone, moss pockets, worn
  lightening on path kinds.
- Done when: no shimmer at distance; tilled soil unchanged. Proof: `plaza-morning`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- ground `world.js` :705-810
- earth boxes `world.js` :358-386
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
