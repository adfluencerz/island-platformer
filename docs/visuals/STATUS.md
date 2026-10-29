# Visuals: status

Current phase: 12 (`phases/12-cliffs.md`)

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
- [ ] 12 Cliff skirts
- [ ] 13 Characters
- [ ] 14 Ambience
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
- plaza-noon 741-750 calls (unchanged), 1.22M tris, programs 42 -> 44; lake-sunset 322 calls, 45 programs.
- `src/gfx/water.js` `waterLook(material, kind)`: the hook `water:<kind>` (sea, shallows, pond), after `addRipples`. Fresnel toward the sky (atmos.js `gfxHorizon`, toward `uSkyZenith` as the reflection looks up) and glitter are added after tone mapping (new needle `colorspace_fragment`), so glints pass bloom's threshold; capped at 1.6.
- The camera always has the sun behind it (daynight.js: sunDir z 0.45), so a mirror-true sun path is never in a shot: the glitter comes from little wave facets (WATER_FACETS a unit, WATER_TILT) that catch the sun from any side.
- Phase 12's cliff skirts meet the sea at `SEA_LEVEL` (-0.6, world.js); the shallows strip (2.4 wide, y +0.035) and foam (0.8, y +0.04) lie on it along each tile edge facing open water (`shoreStrip`): skirts should drop from the tile edge to below `SEA_LEVEL` so the strips start right at their foot.
- None of the shots shows the open sea (lobby and plaza-noon frame only land): judge water with `npm run browser -- --full --size 960x600 --shot FILE -e 'g.warp({x:-66,z:4}); g.dayNight.setTime(18.5); g.step(0.5); g.snapCamera(); g.draw()'` (the west shore at sunset).
