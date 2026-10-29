# 44 Torchlight in the dungeon

Goal: The dungeon (high tier, `g.warp('dungeon')`, the classic camera
underground) reads as a Breath of the Wild cellar: each torch throws its own
warm pool with real dark between them, the floor and walls are stone in
blocks with worn edges, the corners, the feet of the walls and the undersides
of ledges go dark, and a faint cool fill from above keeps the shadows
readable; instead of one flat, even warm-brown room.

- Torch pools (`src/build.js` `UNDER_GLOW`): the dungeon's lamps brighter
  close by and with a much shorter reach and a steeper falloff, so two lamps
  along a wall light two pools, not one band; no new lights (the pooled six).
- The light round the farmer (`src/daynight.js` `CAVE`): smaller and dimmer,
  so it lights the farmer without washing the middle of the room; the
  hemisphere a faint, cooler blue from above (its ground stays dark).
- The additive floor pools (`b.pool`) and the flames' bloom
  (`src/gfx/post.js` `underThreshold`) tuned to sit as hot hearts inside the
  real pools, not a warm wash over the floor.
- Stone (`src/dungeon.js` `LOOKS`): the first dungeon's (the root cellar's)
  floor and its earthen wall bands painted as the phase 16 `stone` look
  (flagstones and blocks, mortar, per-block tint, softened edges) in a
  grey-brown stone, the timber frame and boardwalk kept.
- Ambient occlusion (a `dungeon:shade` hook on the dungeon's own `KINDS`
  and the cavern floor): darker toward the walls on the floor, toward the
  floor on the walls (most in the corners, from a small uniform array of the
  shown dungeon's room rects and its hall), and on what faces down (the
  undersides of beams and ledges). One hook, no new programs beyond the
  dungeon's own (its materials swap their program, they do not add one).
- Fog dark and `CAVE_DARK`/`uUnder` unchanged; foes and the way home still
  read; the farm, lobby and split shots unchanged (the dungeon's materials
  are its own); calls and programs about where they are (about 428, 62);
  the low tier sane.
- Done when: in `dungeon` at full size the lamps along each wall light
  distinct warm pools on the floor and walls with darker floor between, the
  floor and walls read as stone blocks with mortar and worn edges, the
  corners, wall feet and beam undersides are darker, the unlit parts read a
  cool blue-grey, the farmer, foes and portal read; `night-lamps` and
  `plaza-noon` look as before; within the budgets.
  Proof: `dungeon`, `night-lamps`, `plaza-noon`.
