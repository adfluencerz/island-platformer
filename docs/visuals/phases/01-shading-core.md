# 01 Shading core and hook migration (no visual change)

Goal: One registry for shader hooks and shared uniforms, every existing hook moved onto it, with no visual change.

- `src/gfx/shading.js`: `hook(material, key, fn)` with a `WeakMap` registry;
  `onBeforeCompile` runs base hooks then the list; `customProgramCacheKey =
  'gfx1|' + baseFlags + '|' + keys.join('+')` (keys encode parameters, e.g.
  `wind:0.25`). Set `THREE.Material.prototype.onBeforeCompile` and
  `customProgramCacheKey` once so every built-in lit material (Standard,
  Lambert, Phong; never sprites, points, lines, basic, depth) gets the base
  hooks at first compile with no rescans. `cloneHooked()` for the tree clones
  (phase 08 removes them). `userData.gfx` opt-outs `noCloud|noWrap|noAtmos`.
- `src/gfx/uniforms.js`: `uTime` (= `windTime`), `uSunDir`, `uSunColor`,
  `uSkyZenith`, `uSkyHorizon`, `uSkyGlow`, `uNight`, `uUnder`, `uCloudAmount`,
  `uCloudOffset`, `uWind`, `uPlayers[4]`, `uFogHeight`, `uShadowTint`, `uWrap`,
  `uToon`; `gfx.frame(dt, …)` in `updateWorld`, `gfx.look(camera)` in `lookFrom`.
  A base vertex hook adds `vGfxWorld` (after `project_vertex`, instancing-aware).
- Migrate `addWind`, `addRipples`, foam, rim, `itemMaterial`, `seasonal()` to
  `hook()`; `snowOn()` skips by `hasHook(m, /^season/)` instead of "any custom
  hook"; water and items get `noSnow`.
- `src/gfx/chunks.js`: `patch(chunk, needle, replacement)` helper, guarded by
  `#ifdef GFX_*` so unhooked materials compile unchanged; a Node test in
  `scripts/test-multiplayer.js` asserts every needle exists in the installed
  three and that `hook()` keys compose deterministically.
- Done when: shots identical to the phase 0 baseline; `programs` not higher;
  winter snow still shows on grass and roofs (`g.dayNight.setTime(day*24)`);
  tests pass. Proof: `plaza-morning`, `night-lamps`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
- `seasons.js` `seasonal()` :117-152, `snowOn()` :157-167
- `draw()` `main.js:5550-5572` (resets the stats first) and `lookFrom(split)` `:1807-1828`
- `window.__game` `main.js:5632` (with `stats`, `warp`, `snapCamera`)
- `three/addons/*` already resolves (`character.js:2`)
