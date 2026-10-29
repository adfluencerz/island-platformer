# 41 A moonlit night with depth

Goal: At night by the house, from the low camera, the farm reads as a Breath
of the Wild night: moonlit, not just dark. A cool moon key shapes the crowns
and the ground with soft shadows, a silver rim catches the crowns' edges and
the grass tips toward the moon, the near field is dark and rich while the far
field lifts into a blue haze under a lighter, starry horizon, and the lamps
throw large warm pools on the grass and the house walls; instead of one flat
navy wash with small glows.

- The moon as the key (`src/daynight.js` KEYS, the sun light's night state):
  brighter and a little more silver against a dimmer, deeper hemisphere fill,
  so lit and shaded sides of a crown, and the shadows on the ground, read
  apart; it stands to the side and a little behind what the camera sees (a
  side-back light), so the crowns are modelled, not lit flat from the front.
  The night's grey (the grade, and `uNightGrey` on the low tier) and `uNight`
  kept as they are.
- Near/far depth at night (`src/gfx/atmos.js`, a `gfxNight()` beside
  `gfxDusk()`, `gfxMorning()` and `gfxRain()`): less of the sky's fill near
  the camera (`src/gfx/light.js`), so the near field is dark and rich; the
  haze held back to the middle distance and lifting the far field into a
  cool blue toward a horizon that is lighter than the zenith, with the stars
  above it (`src/gfx/sky.js`: the night horizon a pale glow band).
- A silver rim (the `vGfxSunGlow` path from rounds 36-37, keyed to the moon
  at night): the crowns' edge toward the moon (round crowns and pines) and the
  carpet's tips, more looking toward the moon; on the moon's own light, so
  what is in shadow stays dark.
- The lamps' pools larger and warmer (phase 14's lights, no new ones): their
  reach and power up, a softer falloff, so the warm light spreads over the
  grass and up the house walls; the lanterns' and windows' emissive up a
  little for the bloom. Fireflies kept.
- No new draw calls or programs; shaders lean; the low tier (no carpet, no
  shadows) gets the moon, the fill and the haze; noon, morning, dusk, rain
  and the dungeon unchanged.
- Small, if cheap: medium plaza-noon's triangle creep after round 40 found
  and some clawed back with no visible change; the swimmer clipping into the
  beach's visual slope fixed, or a note left.
- Done when: in `night-lamps` the moon models the crowns and the ground, a
  silver rim shows on crown edges and grass tips toward it, the near field is
  darker and richer than a far field lifting into blue haze under a lighter
  starry horizon, the lamps' pools are large and warm; `phone-forest-dusk`,
  `plaza-noon` and `dungeon` unchanged; within the budgets.
  Proof: `night-lamps`, `phone-forest-dusk`, `plaza-noon`, `dungeon`.
