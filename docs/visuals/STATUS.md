# Visuals: status

Current phase: 02 (`phases/02-tone-mapping.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [ ] 02 Tone mapping and light rebalance
- [ ] 03 Sky dome
- [ ] 04 Atmospheric fog
- [ ] 05 Post-processing
- [ ] 06 Painterly shading, clouds overhead, cloud shadows
- [ ] 07 Grass v2
- [ ] 08 Trees: instancing, dithered fade, painterly canopy
- [ ] 09 Bushes, rocks, biome decor instanced
- [ ] 10 Ground detail
- [ ] 11 Water
- [ ] 12 Cliff skirts
- [ ] 13 Characters
- [ ] 14 Ambience
- [ ] 15 Perf and polish
- 16+ polish rounds (`phases/16-polish-rounds.md`)

## Baseline (phase 0)
`plaza-noon`, tier high, 960x600, pixel ratio 1 (SwiftShader), shadow pass included:
calls 960, triangles 832,626, programs 24, geometries 138, textures 11.
Calls drift by about ±20 between runs (the test farm changes as it is played): the README's `calls` budget is 1000.
Other shots (high): plaza-morning 1162 calls, forest-noon 726, lake-sunset 920, night-lamps 1575,
rain-noon 919, dungeon 389, split-2 2166, lobby 1106; phone (medium) 1269 calls, 831k triangles.
Low tier (`?lowgfx`, no shadow pass): about 271 calls, 785k triangles.

## Notes from the last phase
- Change a shader only with `hook(material, key, fn)` (`src/gfx/shading.js`): the key must encode every setting fn uses (it is the program cache key); patch at `NEEDLES` (`src/gfx/chunks.js`, checked by `npm test`) inside `#ifdef GFX_*`.
- Shared uniforms are in `src/gfx/uniforms.js` (`use(shader, names, 'v'|'f'|'vf')`); `frame()` runs in `updateWorld`, `look()` in `lookFrom`, `light()` in `daynight.js apply()` (per view in split screen). Most are filled but no shader reads them yet.
- Every lit material gets `vGfxWorld` when a hook does `define(shader, 'GFX_WORLD')` (ripples and foam use it). `snowOn()` now skips by `userData.noSnow`: water, items, foam, farmers and the swaying flowers carry it.
- Shots are not pixel-stable run to run (0.3-4% of pixels move: NPCs, animals); phase 01 was judged by old/new diffs within that noise and identical mean colors. `programs` plaza-noon 22 to 24 between runs (baseline 24): what has compiled by then varies.
- `npm run gates` runs every gate (about 2 min).
