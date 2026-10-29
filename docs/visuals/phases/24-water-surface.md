# 24 Water surface

Goal: The lake, the sea and the ponds read as a moving surface, not a flat
slab: broad soft waves, sun glints you can see from the play camera, and a
darker wet edge where the bank meets the water.

- Broad waves (`src/world.js` `addRipples`): a few larger, slower crossing
  swells (metres long) under the fine ripples, tilting the normal enough
  that the sky's gradient in the mirror shifts across them, and a soft
  wave-shade on `diffuseColor` (crests lighter, troughs darker); the height
  handed on to the water hook.
- The water hook (`src/gfx/water.js`): the wave-shade kept after the sky's
  mirror (so it still shows at a low sun), and a second, coarser layer of
  glints: a scatter of broad flashes on the crests, a few pixels across at
  960x600, dealt anew as they fade, warm at sunset, faded out far away.
- The ponds and the lake (`src/maps.js`, `src/build.js`): a deeper,
  slightly more solid teal base, so the mud under them reads as depth and
  not as a brown slab.
- The bank (`src/gfx/ground.js` cliff): the wet band over the water a
  little darker and taller, and the rock under the water falling dark (a
  soft contact shadow seen through it).
- The sea, the shallows and the ponds stay consistent; the dry-land shots
  unchanged; the low tier matches; no new programs beyond the water's;
  budgets hold; the shaders lean (sines and one hash cell).
- Done when: in `lake-sunset` and `shore-noon` at full size the water shows
  broad lighter and darker waves, a scatter of glints that read at that
  size, and (the lake) a darker band where the bank meets the water;
  `plaza-noon`, `forest-noon` and `dungeon` look as before; `programs`
  unchanged.
  Proof: `lake-sunset`, `shore-noon`, `plaza-noon` (unchanged).
