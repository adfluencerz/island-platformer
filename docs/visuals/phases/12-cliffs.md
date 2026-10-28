# 12 Cliff skirts

Goal: Shaped, banded cliff skirts round the islands instead of plain boxes.

- Per coast edge (the shallows/foam enumeration), a 4×3 strip from the lip to
  below `SEA_LEVEL`, hash-displaced 0.05–0.25, banded vertex colors (turf lip,
  earth, wet rock), one merged flat-shaded mesh per island, a grass overhang
  lip; earth boxes stay for inner faces and colliders.
- Done when: foam still aligns; no seams; colliders untouched. Proof:
  `lake-sunset`, `lobby`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- earth boxes `world.js` :358-386
- ground `world.js` :705-810
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
