# 47 Buildings and props at the low camera

Goal: Since the low, wide camera (phase 32) the homes, the stall and the
props are seen from the side, not from above, and they still wear the phase 16
looks tuned for roofs seen from overhead. Make them read as Breath of the
Wild buildings at this angle: roofs in tile rows with a ridge, plaster walls
with a soft mottle and a damp darker foot, dark under the eaves and in the
door and window recesses, windows that read as glass by day and glow warm at
dusk and night, wood with seams and grain, props with worn edges sitting in
the grass with a contact shadow; instead of clean coloured boxes.

- Walls (`src/gfx/detail.js`, the built looks: `plaster`, `plank`, `stone`,
  `brick`): retuned for a wall seen side-on at 10 to 25 metres: a broader,
  stronger plaster mottle and a damp, darker foot with a ragged top edge;
  plank seams and grain that survive the distance; stone courses on the
  footings. All additive in the built family's branch: nature's and the
  living looks untouched.
- Cheap ambient occlusion, in the same built branch (no new program): the
  feet of walls and props darker near the ground (a contact shadow on what
  stands in the grass), the tops of tall wall faces darker under the eaves,
  faces that look down (eave and awning undersides) darker still.
- Roofs (`tile`, `thatch`): rows sized and shaded for a slope seen from the
  side (deeper shade under each row's lip, each tile its own tint, a little
  moss and weathering low on the slope), the ridge capped darker.
- Windows (a `glass` look, built family): a sky reflection by day (lighter
  and cooler toward the top, a pale diagonal sheen, the room dark behind),
  the warm emissive glow at dusk and night on top as before; the
  neighbours' (`src/homekit.js`), the farm house's (`src/build.js`).
- Recesses: a dark reveal round each door and window (`src/homekit.js`
  `house()` and `addWindow()`, `src/build.js` `house()`), baked into the
  home's mesh, so no new draw calls on the neighbours' homes.
- Props (crates, barrels, sacks, signs, the stall's crates): edges worn paler
  on the wood looks; the stall's awning (`src/merchant.js`, the `cloth`
  look): each stripe hemmed darker at its edges, sagging and rippled, its
  underside darker (the occlusion above).
- The chimney smoke kept; the night windows still bloom.
- Budgets: no new draw calls on the homes (baked), at most one new program;
  the low tier sane.
- Done when: in `plaza-noon` the stall's awning reads as striped cloth with
  shade under it and its wood as boards, the far homes' roofs show tile rows
  and a ridge and their walls a darker foot; in `night-lamps` the bakery's
  walls read as plaster with a darker foot and dark under the eaves, its roof
  as tiles in rows, its windows glow warm; in `plaza-morning` the same in the
  low sun; in `phone` the stall and homes read at the phone's size; the rest
  of each shot as before, within the budgets.
  Proof: `plaza-noon`, `night-lamps`, `plaza-morning`, `phone`.

## Notes (round 47)
- All in the built family of `src/gfx/detail.js` (no new program; nature and
  living looks untouched): `tile` rows 0.24 high with a lit lip and the next
  row's shade, grime and moss (as dark as the tiles) toward the eave;
  `plaster` a broad mottle and a damp, darker foot with a ragged top; `cloth`
  panels hemmed darker at their edges, sagging and rippled (the stall's
  awning); `wood`/`plank` props (known size, none over 1.7) worn paler at
  their edges; a new `glass` look (index 28): the room dark, the sky in the
  upper pane, a sheen streak, the frame's shade on top, and at night the
  emissive brighter in the middle (it scales `totalEmissiveRadiance`).
- Ambient occlusion for every built look except a dungeon's instanced pieces
  (they keep `dungeon:shade`): faces looking down 30% darker, the foot of
  what stands near world y 0 up to 40% darker (`vGfxWorld`, so the built
  family now defines `GFX_WORLD`), the top metre of a tall plank or plaster
  wall darker under its eaves.
- Homes (`src/homekit.js`): windows in the `glass` look, a dark reveal round
  each door, the ridge capped darker (all baked: no new draw calls); the farm
  house (`src/build.js`) and the room (`src/house.js`) windows glass too, the
  farm house's door a dark gap round it; sky isles' glass (`src/skystyles.js`).
- Stats (high, before -> after): plaza-noon 689 / 764k / 48 -> 691 / 764k /
  48; night-lamps 299 / 693k / 51 -> 299 / 693k / 51; phone (medium) 579 /
  516k / 43 -> 550-580 / 512-516k / 44 (calls drift with the test farm).
- For the other rounds: the coop's shingles (`src/animals.js`, `tile`) and
  the pens' rails pick up the new tile rows and the contact shade at their feet.
