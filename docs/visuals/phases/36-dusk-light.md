# 36 Dusk light with depth

Goal: At dusk the meadow has depth, as in Breath of the Wild: a darker,
richer foreground striped by long soft shadows, the sun's gold on grass tips
and crown edges, and a field that goes warmer and paler only toward the
horizon, so near and far separate by value, not only by haze.

- One shared "dusk" amount (`src/gfx/atmos.js` DUSK_GLSL): a low sun in the
  west, by day, out in the open, not overcast; 0 in the morning, at noon, at
  night, in the rain and underground, so those stay as they are.
- Less sky fill near the camera at dusk (`src/gfx/light.js`): the hemisphere's
  light on what is near is cut by distance (in fog-nears, as the haze is),
  back in full by the far field, so the near grass is deeper and the long
  shadows of the trees read across it instead of drowning in lavender fill.
- The haze ramped by distance at dusk (`src/gfx/atmos.js`): it starts further
  out, so the foreground stays clear and saturated, and is paler and more
  gold toward the horizon (the far field pale gold, not a yellow-green veil
  over everything).
- The carpet (hook 'carpet'): its roots darker at dusk, and its tips catching
  the low sun (more when looking toward it): a sun glow on the direct light
  only (GFX_SUN_GLOW, a varying the light hook reads), so blades in shadow
  stay dark.
- The crowns (hook 'tree'): a bright warm rim on the edge that faces the low
  sun, by the same sun glow (round crowns and pines).
- The shadow box and bias checked against the wide phone camera: the trees'
  shadows reach the near field.
- No new draw calls or programs; the low tier (no carpet, no shadows) only
  gets the fill and the haze; noon, morning, night and rain unchanged.
- Done when: in `phone-forest-dusk` the near field is darker and richer than
  the far field, long tree shadows stripe the grass, grass tips and crown
  edges toward the sun are lit gold, and the far field is paler and warmer;
  `lake-sunset` the same or better; `plaza-noon` and `night-lamps` unchanged;
  within the budgets.
  Proof: `phone-forest-dusk`, `lake-sunset`, `plaza-noon`, `night-lamps`.
