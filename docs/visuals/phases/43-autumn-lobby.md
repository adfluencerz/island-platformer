# 43 The autumn island

Goal: The lobby (high tier, noon on a wild autumn island, `g.joinLobby`)
reads as a Breath of the Wild autumn wood: a riot of reds, oranges and
golds with a few greens, each tree its own colour with a lit top and a cool
shade, the path and stones with shadows and depth under the noon sun, the
far trees fading into haze; instead of dull olive blobs in one flat, even
autumn colour beside the polished farm.

- A rich autumn palette per tree (`src/maps.js`: the theme's leaves, and a
  wider palette of reds, oranges, golds and a few greens picked per tree and
  per bush by a hash of where it stands, carried in the instance tint
  `src/world.js` already writes, so no new materials, draws or programs).
- The crown shading of phases 30/35 (`hookTree` in `src/world.js`) giving
  warm crowns lit tops and a deep, cool shade too: the shade's blue-green
  tint is made for greens and greys an orange crown out, so on a warm crown
  the shade goes deeper and a little redder, the top golden.
- The wild island's ground, path, stones and set pieces checked against the
  farm's noon treatment: `gfxDay()` near/far depth (round 42), the carpet
  (phase 33), the detail looks, cloud shadows and crisp sun shadows; what
  misses a hook gets it by the shared materials, not new ones (the lobby is
  at about 470 calls, 88 programs: reuse, do not add).
- The sky isles and the water as on the farm; the far trees fading into the
  noon haze.
- Secondary, if cheap: a midday side light keyed to the high sun
  (`src/daynight.js`), so crowns get shape at noon on every island instead
  of being lit from straight behind the camera; the shadow box still covers
  the near field; `plaza-noon` and `forest-noon` checked.
- No new draw calls or programs; shaders lean; the low tier sane.
- Done when: in `lobby` the crowns are varied autumn colours (reds, oranges,
  golds, a few greens) with lit tops and shaded sides, the path and stones
  have shadows and depth, the far wood fades into haze; `split-2` and the
  farm shots unchanged (but for the side light, if done); within the
  budgets.
  Proof: `lobby`, `split-2`, `plaza-noon`, `forest-noon`.
