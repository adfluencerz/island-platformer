# Visuals: status

Current phase: 43 (polish rounds again: `phases/19-polish-rounds.md`)

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
- Noon has its own near/far: `gfxDay()` in `src/gfx/atmos.js` (sun above ~33 degrees, clear, by day, in the open; 0 at 8:00, 18:30, rain, night, underground), so the other hours are unchanged (contact sheet checked).
- Near field (`src/gfx/light.js`): DAY_FILL 0.38 of the sky's fill cut near (shade most), NOON_GLSL makes near colors 22% richer and 10% deeper, the sky's light a little less blue by day; carpet roots 0.28 deeper (`src/world.js`).
- Far field: the haze held back to the middle distance (start +0.45 fog-nears) and lifting into a pale blue-green (the horizon's luma times 0.92/1.06/1.0); the mid grass no longer washed blue.
- Cloud shadows had very soft edges (25-unit blur) so they never read at noon: at a clear noon each patch is crisper (edge width x0.25), a little lighter (x0.8) and covers a little more; the plaza's start view sits half under one (lower left). A warm noon rim on grass tips and crown tops (`vGfxSunGlow`); near round crowns darker at night (`night-lamps` bush, about -27%).
- Still front-lit at noon: the sun stands behind the camera (sunDir z +0.45, x near 0), so crowns light flat and their shadows fall behind them; a midday side light (`src/daynight.js`, keyed to the high sun) would model them. Programs read 46-48 between runs with the same code (drift).
- Weakest shot now: lobby (high, noon on a wild autumn island, untouched since the big gaps): its near crowns are dull olive blobs, the autumn colors flat and even, the path and stones without shadow or depth.
