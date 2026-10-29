# Visuals: status

Current phase: 15 (`phases/15-polish.md`)

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
- [ ] 15 Perf and polish
- [ ] 16 Surface detail: built things and buildings
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

## Notes from the last phase
- plaza-noon 754 calls (+0..2: the motes), 1.26M tris, programs 43 -> 46; phone (medium) 650 calls, 786k tris.
- `src/gfx/motes.js` `MOTES`: 160 at 900 particles (`dayNight.setParticles(k.particles)`: 53 low, 107 medium), box 24 wide from -0.6 to +4.4 round the player, size 0.13, warm 0xfff0bd-ish at 0.6 (not tone mapped), breeze + 0.35 of `uWind`; faded by `(1-night)*(1-1.6*cloud)*(1-under)` in `daynight.js`.
- Night emissives: build.js lantern 2.5, window 2.0, flame 0.6+1.9n, core 0.8+1.7n; npchomes lantern 2.5, window 2.0; house lantern 2.5. Fireflies 72, warmer (1, .86, .36) x1.35, size 0.19.
- Bloom: `POST.bloom.underThreshold` 0.8 underground (night 0.72); dungeon `KINDS.glow` color 1.7 (past white). Rain: `RAIN_TINT` in weather.js (sky horizon x1.2, 30% pale grey).
- Phase 15: re-measure the phone shot's frame time with motes + rain (both CPU-updated Points/lines a frame) and the bloom at night on medium.
