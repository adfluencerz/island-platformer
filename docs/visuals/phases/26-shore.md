# 26 The shore

Goal: At noon the beach reads painterly, like a sunny coast: dry pale sand,
a darker wet band at the waterline, a soft lace of foam breathing in and out
with the ripples, turquoise shallows with the sand's ripples showing through,
and beyond them the sea deepening to a richer blue, patchy and sparkling
near, not one even color.

- The beach (`src/world.js` ground surface, `src/gfx/ground.js` tiles): a
  per-vertex nearness to the sea (`gfxShore`, 1 at a side that faces open
  water, 0 a tile and a half in); on sand, a darker, cooler wet band along
  it, its inner edge wavering and slowly breathing with the swash, a faint
  damp line at its top and a thin lace of foam washing over its outer edge.
- The foam (`src/world.js` `foamMat`): the solid line broken into lace
  (noise holes, drifting), the bands beyond it washing in and out with the
  swash, faded to their average where a pixel covers too much of them.
- The shallows (`src/world.js` `shallowsMat`, `src/gfx/water.js`
  `water:shallows`): reaching further out, more turquoise and more solid by
  the shore, the sand's ripples clearly showing through there; further out
  a paler, patchy teal fading into the sea, so the coast has a shelf.
- The sea (`src/main.js`, `water:sea`): a deeper blue base, broad slow
  patches of deeper and lighter water and a hint of green in the lighter
  ones; nothing that shimmers far out.
- Lakes, ponds, night, sunset and the lobbies keep their look; no image
  files, no new draw calls; at most one or two new programs; budgets hold;
  the shaders lean (a few noise reads). Where cheap, plaza-morning's calls
  back under 850.
- Done when: in `shore-noon` at full size the sand darkens to a wet band at
  the waterline, a lacy foam line runs along it, the shallows are turquoise
  with sand ripples visible under them, and the sea beyond is a deeper,
  varied blue; `lake-sunset`, `night-lamps` and `lobby` look as before;
  `programs` within one or two of before.
  Proof: `shore-noon`, `lake-sunset`, `phone`.
