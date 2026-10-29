# 51 Floating earth islands

Goal: The grass platforms that hover over the plaza and the farm read as
chunks of land torn out of the ground, as the references' floating islands do:
a grassy top with a soft overhang lip, irregular earth and rock strata down
the sides, tapering underneath into a rough, rocky point with roots hanging
from it; instead of a flat green top on a plain brown box.

- Only how they look (`src/world.js` addBox): the colliders, their walkable
  footprint and height stay exactly as they are (`shared/` untouched, `npm
  test` unchanged). Only boxes that float (their bottom above the ground
  under them, the farm's grass platforms) change; a wild island's rock steps,
  solid down to the ground, keep their rough box.
- The top: a rounded turf slab at the same height, its edge rolling over in a
  soft lip that spills a little past the footprint and hangs down unevenly,
  grass tufts on top and a fringe of strands hanging from the lip; in the
  map's turf material (the seasons still color it).
- The body: rings round a rounded outline, pushed in and out by a hash (each
  platform its own), ledged in strata down the collider's depth, then
  tapering into an inverted cone with a couple of smaller rocky lumps beside
  its point, and a few thin roots dangling; colored warm earth under the
  turf, through banded earth to grey rock, darker and cooler underneath. In
  the cliffs' material (phase 12: its strata, cracks and moss hanging from
  under the lip, `gfxCliff`), indexed and smooth-shaded.
- The tip never reaches the ground (bounded by the floor under it); the soft
  shadow below is the shadow map's, as before.
- The same draw calls (a body and a turf mesh a platform, as now), no new
  program (the cliffs' and the turf's are compiled already), triangles a
  platform about two thousand, so medium `plaza-noon` stays under 700k.
- Done when: in `plaza-noon` and `plaza-morning` the platforms read as
  floating earth islands with grassy tops, a lip, strata and a tapering rocky
  underside; in `phone` and `split-2` the same at their size; everything else
  unchanged; budgets met on every tier.
- Proof: `plaza-noon`, `plaza-morning`, `phone`, `split-2`.
