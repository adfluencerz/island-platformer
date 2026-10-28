# 07 Grass v2

Goal: Dense, gust-swept grass that thins evenly by tier.

- New tuft geometry: 7/5/3 blades by tier, 2 segments each, height
  0.35–0.6, vertex colors root 0.5 → tip 1.15; wind hook `grass`: value-noise
  gust traveling with `uWind` plus the fine sine, bend scaled by height²;
  bending away from `uPlayers`; extra placement pass with its own
  `mulberry32(map.seed ^ 0x51a7)` so existing rng order and fingerprints are
  untouched; instances shuffled so `mesh.count = total × tierDensity` thins
  evenly. Flowers share the wind. Budget ≈ 340 k tris on high.
- Done when: tests unchanged; tilling still clears tufts; snow sink works;
  phone triangles within budget. Proof: `forest-noon`, `phone`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- grass tufts `world.js` :245-268 and :461-526
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
- `seasons.js` `seasonal()` :117-152, `snowOn()` :157-167
