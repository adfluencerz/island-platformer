# Visuals: status

Current phase: 09 (`phases/09-decor-instanced.md`)

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
- [ ] 09 Bushes, rocks, biome decor instanced
- [ ] 10 Ground detail
- [ ] 11 Water
- [ ] 12 Cliff skirts
- [ ] 13 Characters
- [ ] 14 Ambience
- [ ] 15 Perf and polish
- 16+ polish rounds (`phases/16-polish-rounds.md`)

## Baseline (phase 0)
`plaza-noon`, tier high, 960x600, pixel ratio 1 (SwiftShader), shadow pass included:
calls 960, triangles 832,626, programs 24, geometries 138, textures 11.
Calls drift by about ±20 between runs (the test farm changes as it is played): the README's `calls` budget is 1000.
Other shots (high): plaza-morning 1162 calls, forest-noon 726, lake-sunset 920, night-lamps 1575,
rain-noon 919, dungeon 389, split-2 2166, lobby 1106; phone (medium) 1269 calls, 831k triangles.
Low tier (`?lowgfx`, no shadow pass): about 271 calls, 785k triangles.

## Notes from the last phase
- `makeInstancer(parent, chunk = GROUND_CHUNK)` in `world.js`: `adopt(group)` turns a group's direct child meshes into slots (one InstancedMesh per material x geometry x ground square, so culling still works), `build()` once all are adopted, `show(group, parts, shown)` after the group moves, `fade(parts, f)`. Groups stay in `root`, invisible, for transforms and raycasts; `obj.userData.tint` is the slot's instance color. Reuse it for bushes, rocks and decor.
- Hook `tree[:sway]` (`hookTree(material, soft)`): `aFade` dither (only under `USE_INSTANCING`, and every instanced geometry using these materials needs an `aFade` attribute: the instancer adds it, a missing one can read as 1), top-bright/under-dark gradient by `position.y`, gust sway. `hook()` now replaces by name (the key up to ':').
- `canopyGeo` holds an 80-tri and a 20-tri blob, picked by draw range from the new `treeDetail` knob (high 1, else 0). Pines keep flat shading; leaves and trunks are smooth.
- plaza-noon calls 1000 -> 815-824 (budget line now 900), 1.21M tris, 38-40 programs; phone 765k tris; whole-farm overview 5018 -> 3652 calls. `scripts/lib/page.mjs` holds frames until logged in (full graphics shader compiles timed the login out).
