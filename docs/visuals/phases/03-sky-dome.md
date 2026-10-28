# 03 Sky dome

Goal: A real sky: gradient dome, sun, moon, stars and two drifting cloud layers.

- `src/gfx/sky.js`: `SphereGeometry` radius 150, `BackSide`, `ShaderMaterial`
  with `depthWrite/depthTest false`, `fog false`, `renderOrder -1000`,
  `frustumCulled false`, centered on the active camera in `gfx.look`.
  Fragment: zenith→horizon gradient, haze band, sun disc + glow along
  `uSunDir`, moon at night, hashed stars fading with `uNight`, two FBM cloud
  layers scrolled by `uCloudOffset` with coverage `uCloudAmount` (weather
  raises it) lit on the sun side, lightning via `uFlash`, `uUnder` → `CAVE_DARK`.
- `daynight.js`: `KEYS` gain `zenith` (today's `sky` becomes `horizon`);
  `apply()` fills a public `dayNight.sky` object that `seasons.light()` tints.
- Done when: the horizon matches the fog color; the dungeon is black all
  round; both split seats show the dome; lobby too. Proof: `lake-sunset`,
  `night-lamps`, `dungeon`, `split-2`, `lobby`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- `daynight.js` `KEYS` :19-29 and `apply()` :193-248
- `seasons.js` light tint :243-252
- `draw()` `main.js:5550-5572` (resets the stats first) and `lookFrom(split)` `:1807-1828`
- renderer `src/main.js:191-204`
