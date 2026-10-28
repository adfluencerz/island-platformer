# Visuals: status

Current phase: 01 (`phases/01-shading-core.md`)

## Phases
- [x] 00 Tooling and tiers
- [ ] 01 Shading core and hook migration
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
- Medium is over its 0.8 M triangle budget at the start (≈ 831k, same scene as high): grass density (phase 07) brings it down; `--check` is run on high.
- `renderer.info` counts a whole frame (reset at the top of `draw()`); stats after `g.step()` alone are the last drawn frame's.
- The tier is applied in `quality.onApply` in `src/main.js` (pixel ratio, shadow map size, `sun.castShadow`, `weather.setParticles`); later knobs hook in there.
- `--full` used to fail to log in (title frames starved the 8 s login check): `scripts/lib/page.mjs` throttles frames until on the farm.
