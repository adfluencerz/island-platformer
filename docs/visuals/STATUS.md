# Visuals: status

Current phase: 10 (`phases/10-ground.md`)

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
- [ ] 10 Ground detail
- [ ] 11 Water
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
- plaza-noon calls 815-824 -> 712-755 (budget line now 850), 1.22M tris, 41 programs; phone 656 calls; whole-farm overview 3646 -> 1387 calls, triangles unchanged.
- Three instancers per world (`world.js`): `treeDecor` (trees and their stumps, a hidden slot each till felled), `rockDecor` (a rock's slot is rewritten by `drawRock` on every shake/crumble/surface/giant; chips stay meshes) and `stillDecor`.
- `stillDecor` takes every mesh in `root` with `userData.decor` once `map.decorate` is done: `addDecor` sets it, maps set it on logs, driftwood, toadstool dots. The meshes stay in root, invisible; don't toggle their `visible`, write the slot (`show`).
- `makeInstancer.adopt` now takes a lone mesh or a multi-material one; an instanced mesh with every slot hidden is not drawn, and a hidden slot sits at its thing's position (snug bounds).
- For phase 10: decor stands on the ground at y≈0 in root space; ground detail placed by `isOpenGround` already steers clear of wild trees/rocks, not of bushes or biome plants (their spots are not tracked).
