# 16 Surface detail: built things and buildings

Goal: Every built or man-made surface gets painterly, hand-painted-looking
detail in its shader, so fences, walls, paths, stalls and houses stop reading
as flat colored boxes. No image files: procedural, from world position and
hash/value noise, through `hook()`.

- One `detail` hook with a few looks, chosen per material by a `userData.gfx.detail`
  key (and a sensible default by color/name): `wood` (grain lines along the
  piece's long axis, knots now and then, darker end grain), `plank` (wood plus
  board seams), `stone` (block edges with mortar lines, per-block tint, chips),
  `brick`, `cobble`, `thatch` (streaky bundles, darker eaves), `tile` (roof
  tile rows), `cloth` (weave speckle, slight fade), `metal` (brushed sheen,
  rust spots on iron), `plaster` (soft mottling). Each is a few lines of noise
  on `diffuseColor` and, where cheap, a nudge to the normal for lighting.
- Apply to `build.js` `MATS`, `homekit.js` `mat()`/baked materials (vertex
  colors stay as the base), `merchant.js`, `npcyards.js`, `house.js`,
  `dungeon.js` `KINDS` (stone), `animals.js` pens, machines, the workbench.
- Scale the detail for the camera: readable at the play camera's distance,
  no high-frequency shimmer (clamp octaves by distance or use `fwidth`), no
  extra draw calls, no new programs beyond one per look.
- Snow, seasons, cloud shadows, wrap light and rim must still apply on top.
- Done when: fences, walls, paths, the stall, the house, a neighbour's home
  and the dungeon walls all show their material at a glance in the shots;
  `programs` within budget; no shimmer in a zoomed-out shot. Proof:
  `plaza-morning`, `night-lamps`, `dungeon`.

## Pointers
- Shared material singletons: `build.js` `MATS`, `homekit.js` `mat()` and
  `bakedMaterial()`, `dungeon.js` `KINDS`, `skystyles.js` `material()`.
- The hook system: `src/gfx/shading.js` `hook(material, key, fn)`, `define()`,
  `vGfxWorld`; the ground detail hook from phase 10 is the pattern to follow.
