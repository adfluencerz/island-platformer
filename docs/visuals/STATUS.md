# Visuals: status

Current phase: 17 (`phases/17-detail-nature.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [x] 03 Sky dome
- [x] 04 Atmospheric fog
- [x] 05 Post-processing
- [x] 06 Painterly shading, clouds overhead, cloud shadows
- [x] 07 Grass v2
- [x] 08 Trees: instancing, dithered fade, painterly canopy
- [x] 09 Bushes, rocks, biome decor instanced
- [x] 10 Ground detail
- [x] 11 Water
- [x] 12 Cliff skirts
- [x] 13 Characters
- [x] 14 Ambience
- [x] 15 Perf and polish
- [x] 16 Surface detail: built things and buildings
- [ ] 17 Surface detail: nature
- [ ] 18 Surface detail: characters, animals and held things
- 19+ polish rounds (`phases/19-polish-rounds.md`)

## Baseline (phase 0)
`plaza-noon`, tier high, 960x600, pixel ratio 1 (SwiftShader), shadow pass included:
calls 960, triangles 832,626, programs 24, geometries 138, textures 11.
Calls drift by about ±20 between runs (the test farm changes as it is played): the README's `calls` budget is 1000.
Other shots (high): plaza-morning 1162 calls, forest-noon 726, lake-sunset 920, night-lamps 1575,
rain-noon 919, dungeon 389, split-2 2166, lobby 1106; phone (medium) 1269 calls, 831k triangles.
Low tier (`?lowgfx`, no shadow pass): about 271 calls, 785k triangles.

## Measured in phase 15
`npm run shots -- --tier T` (960x600, pixel ratio 1, SwiftShader), calls / triangles / programs, before -> after
(the grass in 24-tile patches and the ground surface and cliffs in 24-tile squares, out-of-view ones culled):
- high: plaza-noon 762 / 1.26M / 46 -> 787 / 831k / 44; phone 658 / 1.18M -> 661 / 505k; split-2 1505 / 1.37M; lobby 463 / 226k / 85.
- medium: plaza-noon 754 / 865k / 45 -> 773 / 611k / 43; phone 650 / 786k -> 659 / 373k; split-2 1458 / 1.01M.
- low: plaza-noon 330 / 644k / 31 -> 359 / 478k / 30; phone 165 / 548k -> 180 / 264k; split-2 556 / 756k.
- CPU a frame (headless Chromium, this container) of motes + rain + fireflies: 0.04 ms at 300 particles,
  0.06 ms at 600, 0.10 ms at 900 (g.step in a shower: about 0.1-0.17 ms of 0.2-0.4 ms a step): kept on the CPU.
- Dispose audit: geometries and textures steady over three lobby trips (home 420±10 with the last wild island
  kept), tier cycling (textures 23 / 22 / 9) and look changes (outline hull 420 <-> 422); programs only grow
  with three's per-material variants (shadows on/off), not per visit.

## Notes from the last phase
- The `detail` hook (`src/gfx/detail.js`): `detail(material, look?, name?)`, looks in `LOOKS` (wood, plank, stone, brick, cobble, thatch, tile, cloth, metal, plaster, endgrain) as the uniform `gfxDetailLook`, so every look is one program (plaza-noon 46 programs, lobby 88; calls unchanged).
- Look by `userData.gfx.detail`, else the name (`BY_NAME`, `PLAIN` keeps leaves, rock, grass, water plain for phase 17), else the color (`defaultLook`). To add one: a name in `LOOKS`, a branch in `FRAGMENT`, a pattern in `BY_NAME`.
- Frame: the piece's own (object space times its scale), so blocks and boards fit a part and grain runs along its long side; baked homes carry it per vertex (`bakeDetail`, 'detail:baked'), the dungeon per instance (`gfxLook`, 'detail:instanced', `add(geo, 'matte:stone', ...)`).
- For nature (17): add looks (bark, rock, leaf...) the same way and take `rock|grass|leaf...` out of `PLAIN`; world-space-continuous surfaces (cliffs, ground) stay on `groundDetail`.
