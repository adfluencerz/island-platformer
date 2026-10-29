# 38 Rain with depth

Goal: The noon rain gets the depth rounds 36 and 37 gave the dusk and the
morning: a dark, wet, saturated foreground with sheen on the stone and the
sky in the puddles, heavy slanted streaks, a dark low sky, and the grey only
taking over with distance, instead of one flat grey-green veil over the frame.

- One shared "rain" amount beside the dusk's and the morning's
  (`src/gfx/atmos.js` gfxRain, next to gfxDusk and gfxMorning): how hard it
  rains now (uRain), by day, out in the open; 0 when dry, at night's depth and
  underground, so noon, morning, dusk and night stay as they are.
- The veil ramped by distance (`src/gfx/atmos.js`): in the rain the air and
  the low haze start further out and grow thicker and greyer far off, so the
  near field is clear and the grey lies over the middle distance and the far
  field.
- A darker, wetter near field (`src/gfx/light.js`): less of the overcast's
  flat sky fill near the camera (as the dusk's and the morning's fill cut by
  distance), the wet colors richer and darker there; the cool light and the
  cloud shadows kept.
- Sheen and puddles that read at the wide camera (`src/gfx/light.js`): the
  sky's color stronger on wet up-facing stone and paths, the puddles brighter
  mirrors of the sky with drops ringing in them.
- Heavier rain (`src/weather.js`): each streak longer and brighter, tapered
  (a bright head, a fading tail, vertex colors on the same line batch), a
  slight slant even without a storm, and a few larger drops falling near the
  camera; the tier's particle count as it was.
- A dark, heavy sky in the rain (`src/gfx/sky.js`): the low clouds' undersides
  darker, the horizon's band pale, so the far grey reads against it.
- No new draw calls or programs; shaders lean; the low tier (no shadows, no
  post) gets the depth, the wet and the streaks too; noon, morning, dusk and
  night unchanged (mean pixel differences under about 1/255, particle noise
  aside).
- Done when: in `rain-noon` the foreground is darker, wetter and richer than
  the far field, the grey is a distance ramp (not a veil), the streaks are
  readable and slanted with a few larger drops near the camera, the paths and
  slabs show sheen and the sky in their puddles, and the sky is dark and low;
  `plaza-noon`, `phone-forest-dusk` and `night-lamps` unchanged; within the
  budgets.
  Proof: `rain-noon`, `plaza-noon`, `phone-forest-dusk`, `night-lamps`.
