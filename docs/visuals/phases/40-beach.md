# 40 The beach from the low camera

Goal: At the 30-degree view the farm's beach reads as a Breath of the Wild
coast, a gradient from dark wet sand at the waterline to pale dry sand, its
edge with the grass broken by dune grass, pebbles and shells, sloping into
clear shallows behind a wandering foam line, instead of a flat, pale, straight
ribbon with a hard grass edge, a cliff step and a cyan band.

- The wet-sand gradient (`src/gfx/ground.js`, tiles; `gfxShore` from
  `src/world.js` reaching 2.5 tiles in now): dark wet sand with a faint sheen
  of the sky by the water, damp sand beyond, a faint tide line, then dry pale
  sand, each edge wavering, the wet one breathing with the swash.
- The beach slopes on into the sea (`src/world.js`, the cliffs): on sand at
  the sea, no rock cliff but a slope of wet sand down to the water and the
  sandy floor under it, its reach wandering along the shore, so the waterline
  isn't straight; the shallows and the foam start where the slope meets the
  sea. Only the look: what you stand on (the flat earth boxes) is unchanged.
- The edge with the grass: the sand and the green round each point blurred
  over two tiles (`beach.at`, gfxShore's y and z), the boundary wavered a
  metre or so by noise in the shader and the color pushed to the sand's or
  the grass's own across it; the carpet's edge breaking into clumps, and
  clumps of shorter, straw-green dune grass a tile or two onto the sand
  (`makeCarpet`, the high and medium tiers; the low tier keeps its tufts).
- A few pebbles and shells along the wet sand and by the grass, in the rocks'
  own instanced meshes (a material each square already draws: no new calls).
- Low dune rises on the middle of wide sand only (vertex displacement of the
  ground's tiles, its normals steeper than the rise), none by the sea or the
  grass; the colliders untouched.
- The shallows band blended: clearer at the waterline so the slope shows,
  its hue wandering along the shore (greener, sandier, bluer), a softer aqua.
- No new draw calls or programs; shaders lean; the low tier the same look
  without the carpet; nothing shimmers far off (the fine noise fades by
  `gfxShow`).
- Done when: in `shore-noon` the beach goes from dark wet sand at a wandering
  waterline to pale dry sand, its edge with the grass is broken and
  irregular with dune grass on the sand, pebbles show along the wet sand, the
  shallows blend into the sea; `lake-sunset`, the lobby's water and
  `night-lamps` unchanged; within the budgets.
  Proof: `shore-noon`, `lake-sunset`, `lobby`.
