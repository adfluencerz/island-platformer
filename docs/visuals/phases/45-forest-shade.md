# 45 Forest shade and dappled light

Goal: The wood at noon (high tier, `g.warp('forest')` at 12:00, last
polished in round 21, before the low camera) reads as a Breath of the Wild
forest: deep, cool shade on the floor under and between the canopies,
broken by bright sunlit gaps that dapple it and drift slowly with the wind,
crowns bright on top and dark underneath, trunks in shade; instead of pale,
even crowns over a bright, flat floor.

- Canopy cover (`src/world.js`): a coarse cover map built on the CPU from the
  standing trees (their positions and crown reach, two texels a tile, in one
  small single-channel texture a world, rebuilt when a tree falls or grows
  back), handed to the shaders as `uCanopyMap` and `uCanopyBox`
  (`src/gfx/uniforms.js`) by the world being viewed (`viewFrom`). Zero where
  no tree stands, so the open meadow is as it was.
- The sun under it (`src/gfx/light.js`, the base light hook every lit
  material has: no new programs): the sun's light on the floor, the carpet,
  tufts, flowers, rocks, trunks and the farmer cut by the cover, with soft
  sunlit gaps (two octaves of the shared value noise, drifting slowly with
  the clouds' wind) where it gets through, a little warm and bright; the
  sky's fill under it dimmer and blue-green, never grey. Only with a high sun
  (none at dusk, night, underground), so the other hours are as they were;
  not on the leaves themselves or the water.
- Crowns as volumes (`src/world.js` hookTree): at a clear noon a round
  crown's underside darker and cooler (less of the warm bounce lift), its
  lit top a little brighter, so it reads as a ball over its own shade.
- The floor's detail (rounds 19 and 21: ferns, roots, litter, the shaded
  vertex colors) kept and still reading in the shade.
- No new draw calls, programs or geometry (medium plaza-noon sits near 670k
  of 700k triangles); the shaders lean (one texture read, the noise only
  where there is cover); the low tier sane.
- Done when: in `forest-noon` at full size the floor under and between the
  canopies is in a cool, deep shade with bright sunlit gaps dappling it, the
  crowns read as volumes (bright tops, dark undersides), the trunks sit in
  shade, the ferns and litter still read; `plaza-noon`'s open meadow, `phone`,
  `phone-forest-dusk` and `lake-sunset` look as before; within the budgets.
  Proof: `forest-noon`, `phone-forest-dusk`, `plaza-noon`, `lake-sunset`.
