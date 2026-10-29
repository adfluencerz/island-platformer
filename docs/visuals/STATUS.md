# Visuals: status

Current phase: 36 (polish rounds again: `phases/19-polish-rounds.md`)

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
- Round crowns (`src/world.js` CANOPY_LAYOUTS, canopyGeos): four lobe layouts (round with hanging lobes, wide, a big low side lobe, lopsided), the layout going with the tree's leaf so each (leaf, square) set keeps one geometry: no new draws; crown middle 1.7-1.84 on a trunk 1.3 (was 2-2.15 on 1.5).
- Clump normals (clumpNormals): the near level lit from 14 smaller leaf clumps sunk under the surface, the far level from its lobes; the crease between clumps rides in the normal's length (0.5..1), read by the tree hook in place of the radius `crownBump`; bushes get the same.
- Tree hook: a per-pixel step (varying vCrownLit) from a clump's shaded foot to its lit, warm top, on the sun's side or toward the sky; dark creases; what faces down warm and lifted (+0.22), not black. Snow lies on each clump's top. Fade cylinder 1.45 wide, from 0.7 up.
- Budget unchanged: high plaza-noon 747 calls / 750k; medium 686 / 650k, phone 574 / 502k, phone-forest-dusk 488k; low 346 / 349k.
- Weakest shot now: phone-forest-dusk still, but for the ground and light, not the trees: backlit at dusk the meadow is a flat yellow-green haze with little depth between the near grass and the treeline, and the near crowns' shaded side is still soft (the clumps read best with the sun on them, as in lake-sunset and forest-noon).
