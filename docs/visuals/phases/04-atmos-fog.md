# 04 Atmospheric fog

Goal: Atmospheric fog: far land melts into the sky, a low haze over the sea.

- `fog_pars_fragment`/`fog_fragment` patched under `GFX_ATMOS`: linear
  distance term as today (so `lookFrom`'s per-seat near/far and `CAVE_FOG`
  are untouched) plus a sea-level height haze (`uFogHeight = (SEA_LEVEL,
  0.35)`) and a warm tint toward `uSkyGlow` in the sun's direction; `uUnder`
  lerps to `CAVE_DARK`.
- Done when: far ground melts into the sky; name tags, signs and glow sprites
  unchanged; the dungeon fog unchanged. Proof: `lake-sunset`, `dungeon`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- `draw()` `main.js:5550-5572` (resets the stats first) and `lookFrom(split)` `:1807-1828`
- `daynight.js` `KEYS` :19-29 and `apply()` :193-248
