# 49 Crops and the tilled field

Goal: A planted patch next to the plaza (high tier, 12:00, the low wide
camera) reads as a Breath of the Wild field: dark, rich, crumbly tilled earth
in clear furrows that catch the midday side light, darker and faintly wet
where it was watered, its edge melting into the grass; crops as lush leafy
plants with lit tops and dark undersides, fruit that pops in colour with a
little gloss, seedlings you can read, all of it swaying gently in the wind;
instead of flat brown boxes with three ribs and small faceted plants.

- A fixed shot of a field (`scripts/shots.mjs` `field-noon`, desktop, high,
  in the contact sheet, not in the `--check` list): next to the plaza, tilled,
  planted and watered with the game's own functions (dev helpers on
  `__game`: till, plant, water, untill, uproot), soil at every stage (dry
  tilled, seeds, watered seedlings, growing and ripe crops with fruit), framed
  at 12:00; the patch is taken up again and the farm saved after the shot
  (the test account is shared).
- Tilled soil (`src/crops.js` `soilGeometry`, used by `src/main.js`): one
  smooth mesh a tile (not a box and three ribs: four draw calls down to
  one), the full tile wide so a patch is one field, three rounded ridges
  running away from the camera (north-south) so their east faces catch the
  midday sun (`MIDDAY_SIDE`) and their west faces fall dark; the troughs
  darker in its vertex colours (damp, shaded), the crests lighter and drier.
- The edge: a tile's open sides (no tilled neighbour) slope down to the
  ground and fade toward a grassy earth colour, the outline wavering, so the
  patch blends into the grass (the carpet still clears on tilled tiles); the
  geometry picked by which neighbours are tilled (16 shared geometries),
  re-picked round a tile when it is tilled or goes back to grass.
- Dry soil a dark, rich umber with the `soil` look's clods; watered soil
  darker, a little cooler, with a faint wet sheen (lower roughness: the
  sun's highlight on the crests toward the camera).
- Crops (`src/crops.js`): smooth-shaded (no facets), leaves a little bigger
  and fuller, a deeper green with a lighter one; the `crop` look (`src/gfx/detail.js`)
  darkens leaf undersides and lifts their sunlit tops (from the smooth
  normal), veins kept; fruit more saturated and glossier (lower roughness);
  seedlings bigger and a fresher green, seeds pale so they read on dark earth.
- Sway: every crop sways gently with the wind's clock (`uTime`, harder in a
  storm's `uWind`), a wave across the field; plants that are ledges barely.
- No new programs beyond one; shaders lean; farming rules, saves and
  `npm test` unchanged; the low tier sane; `plaza-noon` and `phone` as before.
- Done when: in `field-noon` at full size the soil reads as rich tilled
  earth with furrows lit on one side, the watered tiles darker and wet, the
  patch's edge blends into the grass, the crops read as lush plants with lit
  tops and dark undersides, the fruit pops, the seedlings read; `plaza-noon`
  and `phone` look as before; within the budgets.
  Proof: `field-noon`, `plaza-noon`, `phone`.
