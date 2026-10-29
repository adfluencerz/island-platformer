# 34 Trees, rocks and bushes reshaped (big gap 4 of 4)

Goal: the forest's shapes match the references: soft, cloud-like canopies in
several lobes, pines as layered soft skirts, rounded rocks, round bushes, the
blossom tree a pink cloud. One icosahedron blob per tree is what makes the
game read as "low-poly asset pack" even after smooth shading.

- Round canopies: 3-5 overlapping spheres per tree, hash-jittered in size and
  offset, merged with `mergeVertices` and smooth normals, lit by the phase 30
  crown shading (sun-side top, cool shade, warm underside, sky rim). Two
  levels: near (about 240 tris) and far (about 60), swapped by distance per
  instancer, so forest-noon stays near today's 718k triangles.
- Pines: 3-4 soft rounded skirts with a slight droop, lit tiers kept.
- Blossom tree: a cluster of soft pink lobes with a lighter top and a few
  petal specks; the petals drifting off it kept.
- Rocks: subdivided and smoothed, then flattened on the bottom, with the
  `rock` look's cracks and moss; bushes as two or three merged spheres.
- Keep: felling, regrowth, giant trees, rock breaking, instancing, dithered
  fade (now the clean cut from phase 31), sway, seasons, snow, shadows.
- Done when: in `forest-noon` and `phone-forest-dusk` no single-blob trees
  remain; silhouettes are soft and varied; rocks are rounded; budgets hold on
  all tiers; `npm test` unchanged. Proof: `forest-noon`, `phone-forest-dusk`,
  `lake-sunset`, `plaza-noon`.

## Pointers
- `src/world.js` canopyGeo, pineGeo, rock and bush geometry, makeInstancer
  tiers; `src/maps.js` set-piece decor; `src/seasons.js` for the tints.
