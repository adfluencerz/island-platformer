# Visuals: status

Current phase: 13 (`phases/13-characters.md`)

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
- plaza-noon 757 calls (+6, drift), 1.24M tris (+12k), programs 42 -> 45; lake-sunset 325 calls, lobby 454.
- Cliffs: `world.js` "The cliffs" (in the ground block): one non-indexed mesh a GROUND_CHUNK chunk, down every tile side facing the sea or a lower floor (the lake's bank); the lip reuses the tile's edge vertices and colors. Earth boxes and colliders unchanged.
- Material `cliffMat` (flat shaded, vertex colors), hook kind `ground:cliff` in `src/gfx/ground.js` (the earth mottle for now): phase 17's surface detail for cliffs goes there. The farm brings its own `map.cliffMat` so the seasons turn its grassy lip (`seasons.js`).
- Foam is 1.1 wide now (was 0.8) so its solid line shows past rock pushed out up to 0.25. Terraces (`roughBox`) already had rough banded sides and an overhanging moss cap: left as they are.
- A view of the cliffs from the sea: after a warp, `g.camera.position.set(...); g.camera.lookAt(...); g.draw()` (snapCamera first; draw doesn't move it back).
