# 32 Camera: a lower, wider view (big gap 2 of 4)

Goal: the sky, clouds, horizon and distance haze are in frame during normal
play. Today the camera looks down at 45 degrees from 9 m (`src/main.js`
CAM_HEIGHT / CAM_TILT_DEG) and never shows the sky, so phases 3, 4 and 6 are
invisible while playing. Every reference image is a low, wide view.

- New default: the camera looks down about 28-32 degrees (height about 7,
  further back), so at the default zoom the horizon sits in the top quarter of
  a landscape screen and the top third of a portrait phone. Tune by eye on
  `phone-forest-dusk` and `plaza-noon`.
- A menu toggle "Camera: wide / classic" next to Graphics, saved like `tp.gfx`,
  live; `?cam=classic|wide` for the harness. Classic is today's angle.
- Keep: the follow, the zoom-to-fit rules, split-screen seats (each seat gets
  the same angle), touch, `snapCamera`, name tags, the dungeon and NPC rooms
  (underground keeps classic, they have ceilings), picking/targeting if any
  reads the camera (check `lookFrom`, raycasts, the build cursor).
- Far distance: a low camera sees much further. Sky dome radius and fog ranges
  retuned so the far island melts into haze rather than popping; the grass
  patch and surface chunk culling must still cut what is behind the camera;
  grass density falls off with distance (half beyond ~18 m, none beyond ~30 m,
  the ground shader's green carries it); canopy tier by distance. Budgets must
  hold on every shot at every tier: measure with `npm run shots -- --check`
  for low, medium and high.
- Shots: all shots use the new default; `dungeon` unchanged (classic).
- Done when: sky and horizon visible in `plaza-noon`, `forest-noon`,
  `lake-sunset` and `phone-forest-dusk`; the toggle persists; split-2 and the
  lobby correct; `npm test` unchanged; budgets hold on all tiers. Proof:
  `phone-forest-dusk`, `plaza-noon`, `lake-sunset`, `split-2`, `dungeon`.

## Pointers
- `src/main.js` CAM_* constants and `lookFrom(split)`; `src/gfx/sky.js` radius;
  `src/gfx/atmos.js` fog; `src/world.js` GRASS_PATCH / SURFACE_CHUNK culling;
  the settings pattern in `src/sound.js` and the menu row in `src/ui/splash.js`.
