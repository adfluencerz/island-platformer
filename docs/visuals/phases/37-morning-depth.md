# 37 Morning light with depth

Goal: The misty morning (8:00) gets its own depth, as round 36 gave the
dusk: a clear, cool, rich foreground striped by long soft shadows from the
low eastern sun, dew catching the light on grass tips and crown edges, and
the mist held back to the middle distance and the far field, so near and far
separate by value instead of lying under one flat pink-beige veil.

- One shared "morning" amount beside the dusk's (`src/gfx/atmos.js`
  gfxMorning, next to gfxDusk): the morning's mist (uMist) with the sun in the
  east, by day, out in the open, not overcast; 0 at noon, at dusk, at night,
  in the rain and underground, so those stay as they are.
- The mist ramped by distance (`src/gfx/atmos.js`): in the morning the air
  and the low haze start further out and end a little further, so the near
  field is clear and the mist lies over the middle distance and the far
  field; the peach horizon (the sky dome, the haze's color toward the sun)
  as it was.
- Less sky fill near the camera in the morning (`src/gfx/light.js`, the dusk's
  fill cut by distance, smaller), leaning cool in the near shade: deeper,
  bluer shadows the low sun's long shadows read in, the lit grass not dimmed
  much.
- The carpet (hook 'carpet'): its roots a little darker; its tips catching
  the sun, cool-bright, and a sparse dew sparkle on the tips, all on the
  sun's own light (GFX_SUN_GLOW, now a color: vGfxSunGlow vec3), so blades in
  shadow stay dark.
- The crowns (hook 'tree'): a cool-bright rim on the edge toward the low
  eastern sun, by the same sun glow.
- The shadow box checked against the wide camera at 8:00 (the 0.7x pull-in
  round a low sun): the trees' and the stall's shadows reach the near field.
- No new draw calls or programs; shaders lean; the low tier (no carpet, no
  shadows) only gets the fill and the haze; noon, dusk, night and rain
  unchanged (mean pixel differences under about 1/255).
- Done when: in `plaza-morning` the foreground is clearer and richer than the
  far field, long shadows stripe the grass, the mist is a distance ramp (not a
  veil), grass tips and crown edges toward the sun catch a cool-bright light,
  and the peach horizon stays; `phone-forest-dusk`, `plaza-noon` and
  `lake-sunset` unchanged; within the budgets.
  Proof: `plaza-morning`, `phone-forest-dusk`, `plaza-noon`, `lake-sunset`.
