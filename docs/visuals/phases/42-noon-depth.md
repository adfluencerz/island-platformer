# 42 Noon light with depth

Goal: At noon on the plaza, from the low camera, the farm reads as a Breath
of the Wild noon: a rich, saturated near field with crisp sun shadows and
cloud shadows drifting over the grass, the far field lifting into a pale
blue-green haze under the horizon; instead of one flat, even light from
the near grass to the far trees.

- A daylight near/far treatment (`src/gfx/atmos.js`, a `gfxDay()` beside
  `gfxDusk()`, `gfxMorning()`, `gfxRain()` and `gfxNight()`: a high sun, by
  day, out in the open, not overcast; 0 at 8:00, at 18:30, in the rain, at
  night and underground), so the other hours keep their own values.
- The near field richer (`src/gfx/light.js`): less of the sky's flat blue
  fill near the camera, more in the shade than in the sun, back in full by
  the far field; the sky's light a little less blue by day, so the greens
  hold; the carpet's roots a touch deeper (`src/world.js`).
- Sun and cloud shadows readable on the carpet: the cloud shadows a little
  more of the land at a clear noon (`gfxCloudShadow`), the shadow box, bias
  and `uCloudAmount` at noon in the wide view checked.
- The far field lifting into a pale blue-green haze toward the horizon
  (`src/gfx/atmos.js`): the haze held back from the near field, ramped by
  distance, its color paler and a little greener than the sky's blue, so it
  does not bleach the far grass.
- A sun rim at noon (the `vGfxSunGlow` path, keyed to the high sun): grass
  tips and the round crowns' and pines' top edges catching the sun, on the
  sun's own light, so what is in shadow stays dark.
- Secondary, if a line or two: the near round crowns darker at night
  (`night-lamps`: the bush at top left no longer bright green under the moon).
- No new draw calls or programs; shaders lean; no geometry (medium plaza-noon
  is at about 670k of 700k triangles); the low tier sane.
- Done when: in `phone` and `plaza-noon` the near field is richer and a
  little darker than the far field, sun and cloud shadows read on the
  carpet, the far field lifts into a pale blue-green haze, grass tips and
  crown edges catch the noon sun; `plaza-morning`, `phone-forest-dusk`,
  `lake-sunset`, `rain-noon` and `night-lamps` unchanged but for the
  night crowns; within the budgets.
  Proof: `phone`, `plaza-noon`, `forest-noon`, `phone-forest-dusk`.
