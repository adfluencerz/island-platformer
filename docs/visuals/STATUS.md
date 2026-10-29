# Visuals: status

Current phase: 30 (polish rounds: `phases/19-polish-rounds.md`)

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
- One frame (`.inv-frame`, inventory.css tokens `--frame-*`, `--hud-bg`): cream parchment, a thin warm line, uneven corners, a soft inner shadow; the palette moved from orange to cream/sand/terracotta, so menus, bag, shop and touch buttons follow.
- The HUD over the world is see-through (`--hud-bg`): place panel, guide, clock (daynight.css), gold (light digit slots), toolbar (cream wells, terracotta ring), party card, prompt (a pill).
- Place panel: hint on one line, cut short (at home beside the name, `.brief`), all of it on hover or a click (`.open`); the guide 300px wide in smaller type. Chat and notices have no box (`--hud-text-shadow`); notices sit over the prompt, 40cqw wide.
- No GPU cost: plaza-noon 753-802 calls, 860k triangles, 49-51 programs, as before.
- Weakest now: forest-noon (flat canopy tops, the trees read as green blobs from above); then rain-noon's grey wash.
