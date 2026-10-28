# 18 Surface detail: characters, animals and held things

Goal: Farmers, neighbours, animals, tools, items and mounts get the same
painterly surface detail as the world, so they sit in it instead of looking
like smooth plastic on a textured stage. Procedural only; the existing
procedural cloth canvases get richer rather than replaced.

- Characters (`character.js`): the cloth `CanvasTexture`s gain visible weave,
  stitching at seams, a worn fade on knees and elbows, and knit/plaid at a
  resolution that reads at the play camera's distance; skin gets a soft
  mottle; hair a strand streak; straw hats the `thatch` look; leather and
  brass the `metal`/`leather` looks from phase 16's hook. Keep the rim light
  and the per-farmer `own` materials (repaint, don't rebuild).
- Animals (`animals.js`): hide and wool detail (a short-fur speckle, a wool
  curl mottle, darker underside), beaks and hooves slightly glossy.
- Held tools and items (`itemmesh.js`, `character.js` tools): wood grain on
  handles, brushed metal on blades, a dull sheen on the watering can.
- Mounts and bosses (`mounts.js`, `bossview.js`): the same looks by material
  kind, nothing bespoke.
- Done when: a farmer's shirt, hat and boots, a hen, a cow and the axe each
  show their material at a glance in `plaza-morning` at full size; name tags
  and the wardrobe stage are unchanged; `programs` within budget. Proof:
  `plaza-morning`, `night-lamps` (Mabel), `phone`.

## Pointers
- `character.js` `mat()`, `textures` map (`cloth`, `twill`, `knit`, `plaid`,
  `straw`, `stripes`, `dots`), `rimShader` hook, `Parts` merge per material.
- `animals.js` `matOf`/`matCache`; `itemmesh.js` `itemMaterial`.
