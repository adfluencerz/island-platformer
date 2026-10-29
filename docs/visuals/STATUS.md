# Visuals: status

Current phase: 33 (big gap: `phases/33-carpet-grass.md`)

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
- [ ] 33 Grass as a carpet (big gap 3)
- [ ] 34 Trees, rocks and bushes reshaped (big gap 4)
- 35+ polish rounds again

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
- Camera (`src/main.js` CAM_WIDE_*): wide is the default, 30 degrees up from the farmer, 14 back, aimed above them so the horizon sits 0.55 (landscape) / 0.42 (portrait) of the way up from mid-screen; an upright screen widens the lens (40 degrees across at least) instead of pulling back. Menu "Camera: wide/classic" (`tp.cam`, `?cam=`; the first-person button is "View:" now); underground and indoors ease to classic.
- Distance rings, per view (`viewFrom` in main.js and world.js, all times the zoom): grass to half by 18 m from the camera, none by 30 (aRank, a tuft's place in its patch's shuffled order: far patches draw fewer instances); ground surface beyond 30 m its coarse index (8 triangles a tile, not 32); canopies beyond 40 m the 20-triangle blob (rarely: decor squares are 71 m now).
- Far: fog 30..75 in wide (90 classic); the camera's far plane is the fog's end + 1, sky dome radius 50 (drawn first, no depth). Shadow box 20 m ahead of the farmer in wide (was 8). Trees, rocks and still decor in 71 m squares (fewer, bigger draws: calls were the binding budget).
- Sky: the gradient reaches the zenith by about 30 degrees up (a low camera only sees the bottom of the dome); dusk horizon 0xf0a274 (was a red orange that flooded the view).
- Budget left (plaza-noon / phone): high 754 calls / 601k tris of 850 / 1M; medium 760 / 554k, phone 604 / 443k of 850 / 700k; low 376 / 354k, phone 180 / 235k of 450 / 600k.
