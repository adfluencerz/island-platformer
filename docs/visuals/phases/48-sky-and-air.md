# 48 The sky and the air

Goal: From the low, wide camera the sky fills the top third of every shot, so
it reads as a Breath of the Wild sky: big soft cumulus lit on the sun's side
and shaded underneath, layered toward a denser bank on the horizon, thin wisps
high up, a sun with a warm halo, dusk's colour in bands, a starry night with a
faint Milky Way and a haloed moon, birds crossing by day and leaves, seeds and
pollen drifting near the camera; instead of one flat layer of grey-white
noise over a plain gradient.

- Clouds as painterly volumes (`src/gfx/sky.js`): three layers at different
  sizes and speeds: the low cumulus (anchored to the world, the same drift and
  noise as their shadows on the ground, `gfxCloudShadow`, so a shadow drifts
  under its cloud), a denser bank of heaped cloud along the horizon (layered
  depth, fading into the haze), and thin stretched wisps high up. Each cumulus
  lit on its top and the sun's side in two soft steps, its underside and thick
  core shaded cool, a bright rim where the sun is behind it; at dusk the
  undersides catch the low sun's warm colour.
- The sun's halo warm and wide (`uSkyGlow`), dusk's colours in bands above the
  horizon (a warm band low down, a rose band above it, toward the zenith's
  violet), the horizon itself left as `gfxHorizon` (the fog's, the ground's far
  colour: `uSkyHorizon` and `uSkyGlow` keep their meaning).
- Night: more stars, of more sizes, a faint Milky Way band across the sky
  (soft, mottled, a few more stars in it), a soft halo round the moon.
- Rain: the sky heavy and low (darker, closer, larger cloud masses, a little
  movement), the streaks of round 38 kept as they are (`src/weather.js`).
- Birds (`src/gfx/birds.js`): a small flock, an instanced V each, flapping in
  the vertex shader, crossing the sky by day (none at night, in the rain or
  underground): one draw call, one program.
- The air (`src/gfx/motes.js`): the pollen kept, and on the high tier a few
  leaves, petals and seeds tumbling through the same points (one draw call,
  their own shape in the same program, which replaces the old one).
- `src/daynight.js` only adds the birds beside the motes; no change to
  `uniforms.js`, `shading.js`, `light.js`, `atmos.js`, `world.js`, `main.js`.
- At most one more draw call and one more program; the sky shader lean
  (SwiftShader startup); the low tier sane.
- Done when: in `plaza-noon` the clouds read as lit volumes with shaded
  undersides and a denser bank toward the horizon, with wisps above; in
  `lake-sunset` the sun's halo and the dusk's bands sit with the ground's
  warm haze and the clouds' undersides glow; in `night-lamps` the sky is
  starry with a faint Milky Way and a haloed moon; birds and drifting leaves
  show by day; `rain-noon`'s sky heavy and low with its streaks; the ground
  unchanged; within the budgets.
  Proof: `plaza-noon`, `lake-sunset`, `night-lamps`, `phone-forest-dusk`, `rain-noon`.

## Notes (round 48)
- The low camera sees only about 12 degrees of sky over the horizon, so every
  cloud in view is 120 to 330 units off, at a grazing angle: a flat noise layer
  reads as thin streaks there. The cumulus are now a height field over the
  layer (`src/gfx/sky.js`: four steps along the rising ray, front to back), so
  their undersides are flat and shaded and their flanks and tops lit.
- The cumulus layer is anchored to the land (`cameraPosition`, 40 units up) on
  `gfxCloudShadow`'s own noise and drift (its two octaves are the layer's
  first two), so the shadows on the ground drift under the clouds overhead
  (only roughly: the sun's slant is ignored, and the night and the rain
  change the sky's cover and height, not the shadows'). The comment in
  `src/gfx/light.js` on the dome's old cloud coordinates is now stale (left
  alone: another round's file).
- Birds: `src/gfx/birds.js`, one mesh (9 Vs, 36 triangles), one program,
  placed round the camera like the dome, crossing whatever the camera looks
  at every 70 s; part of each crossing is behind the HUD's top corners.
- Motes: one `motes` hook on the PointsMaterial (premultiplied blend: the
  pollen adds, the 22 leaves on the high tier cover); same draw call.
