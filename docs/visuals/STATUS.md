# Visuals: status

Current phase: 11 (`phases/11-water.md`)

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
- plaza-noon 741-757 calls (unchanged), 1.22M tris, programs 39 -> 42 (one per ground kind); phone 652 calls.
- `src/gfx/ground.js` `groundDetail(material, kind)`: the `ground:<kind>` hook (tiles, slab, turf, earth, rough), patched at color_fragment so it runs before the seasons' grass swap (hooked earlier). The ground chunks carry `gfxKind` (u8 x4: green, stone, path, sand weights), each world's slabs `gfxMoss` (grass on -x, +x, -z, +z).
- `src/gfx/noise.js`: `NOISE` (gfxHash, gfxHash2, gfxNoise, gfxFootprint, gfxShow: fade an octave by pixel footprint) and `VORONOI` (gfxVoronoi: edge distance, cell id), guarded so several hooks can include them; light.js's clouds use them too. Reuse these for phases 16-18.
- Harness: full graphics now opens at 480x320 and resizes once on the farm (`scripts/lib/page.mjs`): at 960x600 the startup work outlasted the login check's 8 s timeout and shots failed, on main too.
- lake-sunset's dark pine at lower left stands beside the sight line, not in it, so it rightly doesn't fade (blocksView); left as is.
