# 17 Surface detail: nature

Goal: Trunks, rocks, soil, sand, cliffs, crops and water edges get painterly
surface detail in their shaders, matching phase 16's built things, so the
whole valley reads as hand-painted rather than flat-shaded. Procedural only.

- Reuse the `detail` hook from phase 16 and add looks: `bark` (vertical
  ridges, darker furrows, a lighter rim toward the light), `rock` (cracks
  along Voronoi edges, lichen and moss pockets on the shaded side and near
  the ground, per-rock tint already from instancing), `soil` (clods and a
  darker damp speckle; tilled rows keep their ridges), `sand` (fine ripples
  across the wind direction, shell flecks on the dunes), `cliff` (strata
  bands from phase 12 plus cracks and moss at the lip), `leaf` (a soft
  blotchy canopy mottle, light on top), `crop` (a little vein and highlight
  variation on leaves and fruit), `reed`/`fern` (streaks along the blade).
- Water edges: the shallows and foam get a sandy ripple under the water and
  a wet darkening band on the shore.
- Apply to `world.js` `trunkMat`, `rockMats`, `earthMat`, `roughMat`, the
  cliff material from phase 12, `maps.js` biome set-piece materials, the
  soil materials in `main.js`, `crops.js` materials, `shallowsMat`/`foamMat`.
- Same rules as 16: readable at the play camera's distance, no shimmer, no
  extra draw calls, seasons/snow/cloud shadows still apply.
- Done when: a trunk, a rock, tilled soil, the beach and the lake shore each
  show their material at a glance; `programs` within budget; no shimmer in
  a zoomed-out shot. Proof: `forest-noon`, `lake-sunset`, `lobby`.

## Pointers
- `world.js` decor kit: `foliageMat`, `trunkMat`, `rockMats`, `earthMat`,
  `roughMat`, `shallowsMat`, `foamMat`; the instancer from phase 8/9 for
  per-instance tint; `maps.js` set-piece materials; `crops.js` `mat()`.
