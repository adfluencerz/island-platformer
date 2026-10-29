# 35 Heavier tree crowns

Goal: The round trees read like Breath of the Wild's: crowns that sit low and
heavy on the trunk, built of lit leaf clumps that show inside the silhouette,
not only at its outline; each tree its own shape; the far ones trees, not
mushroom caps.

- Four lobe layouts (`src/world.js`, canopyGeos): a round heavy cloud, a wide
  one (wider than tall), one with a big lobe hanging low to one side of the
  trunk, and a lopsided two-mass one; different lobe counts. A tree's layout
  goes with its leaf (both picked by its look hash), so each (leaf, square)
  set keeps its one geometry: no new draw calls.
- Clump normals: each point's normal is its own lobe's (from the lobe's
  middle, blended across the creases), so every clump lights as a ball of
  its own, a lit top and a shaded foot, inside the outline too; the crease
  between two lobes (how evenly they share a point) rides in the normal's
  length, and the tree hook reads it for a soft dark crease, in place of the
  radius-based `crownBump`. Bushes get the same for free.
- Lower on the trunk: the crown's middle lower and its bottom lobes hanging
  down, the trunk shorter, so little bare trunk shows and the crown is heavy.
- A less black underside: warm shade and a green-gold bounce from the ground
  on what faces down, lifted a little out of the crown's own shadow.
- The far level (past canopyFar, and always on low) from the same lobes and
  clump normals, so distant trees keep their clumps and their heavy shape.
- Near level about 500 triangles, far 80; no new draw calls or programs.
  Pines, blossom, rocks unchanged unless improved for free. Felling,
  regrowth, giants, sway, seasons and snow (on each clump's top) work as
  before.
- Done when: in `phone-forest-dusk` the round crowns show lit clumps inside
  their outline, sit low on a short trunk, differ from tree to tree, and
  the far ones read as trees; `forest-noon` crowns clumpy and lit with a warm
  underside, not black; `lake-sunset` trees the same or better; within the
  budgets.
  Proof: `phone-forest-dusk`, `forest-noon`, `lake-sunset`.
