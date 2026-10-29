# 23 Dungeon light

Goal: A dungeon room reads moody and deep: warm pools of torchlight on its
floor and walls, cool blue-grey fill in its corners, the far side and the
cavern beyond falling into darkness, the farmer clearly lit.

- Real torchlight (`src/dungeon.js` -> `src/build.js`): each dungeon's lamps
  (wall lanterns, braziers, honey lamps, cages, toadstools; the boss's hall's
  too) are handed to the buildings' pooled `GLOW_LIGHTS` through the same
  `addLamps` path as the neighbours' lanterns, in their theme's light color;
  underground they are lit whatever the hour (`setNight(night, focus, under)`),
  at most the existing 6 lights, nearest first. No new lights, no new programs.
- The underground light (`src/daynight.js` `CAVE`): the hemisphere a cool
  blue-grey fill (its ground darker and cool), dimmer, so what no torch
  reaches reads blue-grey, not brown; the cave's flat overhead light lower;
  the farmer's own glow smaller and softer (a short reach), so it lights the
  farmer without washing the room in one warm patch.
- The additive floor pools (`b.pool`) tuned to sit under the torches with
  the real light, not instead of it.
- Depth (`src/main.js` `CAVE_FOG`): the fog closer, so the far side of the
  room and the cavern beyond fade into the dark.
- The bloom underground (`src/gfx/post.js` `underThreshold`): the flames,
  crystals and glow pools bloom; the walls do not.
- Boss halls (same builder) lit the same way; the dark over unopened rooms
  (`darken()`) still covers them; the low tier matches; budgets hold;
  shaders untouched.
- Done when: in `dungeon` at full size the floor shows distinct warm pools
  under the lamps with darker floor between, the corners and the walls away
  from the lamps read cool blue-grey, the far wall and the rock beyond fall
  off into darkness, and the farmer stands out; the other shots look as
  before; `programs` unchanged.
  Proof: `dungeon`, `night-lamps`, `plaza-noon`.
