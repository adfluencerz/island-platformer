# Visuals: status

Current phase: 52 (polish rounds again: `phases/19-polish-rounds.md`)

## Course correction (after round 30)
A real phone screenshot (a forest at 6:20 pm) showed the game still faceted,
dark at dusk, with sparse grass, the sky never in frame and a green ghost where a
canopy fades in front of the player. Polish rounds were tuning details on top of
that. Four "big gap" phases come first now; polish rounds resume after 34.
After each merge the orchestrator sends the user `phone-forest-dusk` and `phone`.

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
- [x] 17 Surface detail: nature
- [x] 18 Surface detail: characters, animals and held things
- 19+ polish rounds (`phases/19-polish-rounds.md`)
- [x] 19 Night figures
- [x] 20 Golden hour
- [x] 21 Forest light
- [x] 22 Rain
- [x] 23 Dungeon light
- [x] 24 Water surface
- [x] 25 Morning
- [x] 26 The shore
- [x] 27 The phone
- [x] 28 The plaza stone
- [x] 29 The HUD
- [x] 30 The tree crowns
- [x] 31 Smooth painterly shading (big gap 1)
- [x] 32 Camera: a lower, wider view (big gap 2)
- [x] 33 Grass as a carpet (big gap 3)
- [x] 34 Trees, rocks and bushes reshaped (big gap 4)
- 35+ polish rounds again
- [x] 35 Heavier tree crowns
- [x] 36 Dusk light with depth
- [x] 37 Morning light with depth
- [x] 38 Rain with depth
- [x] 39 Water at sunset
- [x] 40 The beach from the low camera
- [x] 41 A moonlit night with depth
- [x] 42 Noon light with depth
- [x] 43 The autumn island
- [x] 44 Torchlight in the dungeon
- [x] 45 Forest shade and dappled light
- [x] 47 Buildings at the low camera (PR #150)
- [x] 48 The sky and the air (PR #151)

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

## Parallel rounds
- 47 Buildings at the low camera (PR #150): the built family of `src/gfx/detail.js` got roof tile rows with lit lips, plaster damp at its foot, hemmed cloth, a `glass` look for windows and contact shade at the foot of what is built (no new program).
- 48 The sky and the air (PR #151): the cumulus a height field over the layer, anchored to the land on the cloud shadows' own noise (shaded undersides, lit flanks), a horizon bank and wisps, birds (`src/gfx/birds.js`, one draw) and tumbling leaves in the motes.

## Notes from the last phase
- Canopy cover: each world builds a coarse cover map on the CPU (`src/world.js` coverCanopy: 2 texels a tile, R8, from the standing trees, `COVER_REACH` 2.1 times their floor-shade reach, a lone tree 0.3 of a wood's), rebuilt when a tree falls or grows; `viewFrom` hands it to the shaders as `uCanopyMap`/`uCanopyBox` (`src/gfx/uniforms.js`, `NO_COVER` when none).
- The sun under it (`src/gfx/light.js` CANOPY_GLSL, in the base light hook: no new programs): the sun cut by the cover with soft gaps (two octaves of value noise drifting with `uCloudOffset` and a slow sway), a gap's sun a little warm (`CANOPY_GAP`), the sky's fill dimmer and blue-green (`CANOPY_SKY` 0.24, 0.4, 0.56); only with a high sun (none at dusk, night, underground); not on leaves (`uTreeLeaf`) or water; trunks, carpet, tufts, rocks and the farmer take it.
- Crowns at noon (hookTree, `crownNoon` = gfxDay): what faces down darker (to 0.42) and cool, not lifted by the warm bounce; tops as bright.
- Unchanged: the open meadow in `plaza-noon` (only the edge trees' floor and crowns differ), `phone-forest-dusk`, `lake-sunset`, the night; calls, triangles and programs as before on every tier; the low tier now gets dappled shade under its trees too (no shadow map there).
- Weakest shot now: lobby (high, never polished as its own round): a flat olive-brown floor with sparse grass under big, flat orange blob crowns (the near one fills a quarter of the frame), grey standing stones as blobs, no light and shade on the ground against the references' rich autumn wood.
