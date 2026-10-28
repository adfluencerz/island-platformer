# 08 Trees: instancing, dithered fade, painterly canopy

Goal: Instanced trees with a dithered fade and soft canopies, a thousand fewer draw calls.

- One `InstancedMesh` per (geometry, material): trunks, 4 leaf tints on one
  jittered `Icosahedron(1,1)` blob (hash-displaced ±0.12, vertex gradient top
  1.15 → under 0.72, instance color = tint), 3 pine materials: ~9 draws for
  318 trees. Each tree keeps an `Object3D` for felling/growing/giant/shake
  and writes `setMatrixAt` for its slots. Fade: `aFade` instanced attribute +
  `dither` hook (`discard` by a screen hash), no `transparent` toggling, no
  clones. Sway hook from `instanceMatrix[3]`. `seasons.js` tints the 7 shared
  materials directly (`copies` goes away).
- Done when: fell/regrow/giant scripts pass via `g.step`; fading behind a
  tree works; calls drop by > 1,000. Proof: `forest-noon`, stats.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- trees `world.js` :569-615 (cloned materials for fading, :1220-1237)
- `seasons.js` `seasonal()` :117-152, `snowOn()` :157-167
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
