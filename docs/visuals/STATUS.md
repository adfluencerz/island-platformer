# Visuals: status

Current phase: 14 (`phases/14-ambience.md`)

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
- plaza-noon 754 calls (+9, the hulls and drift), 1.26M tris (+22k), programs 45 -> 43 (animals and mounts now share the farmers' rim program); plaza-morning 782.
- Rim: `character.js` `RIM` (sky color warmed toward 0xffe6c2 at its own brightness, smoothstep from 0.35, squared), `rimmed(m)` for any lit material (animals' `mat`, gold ones, `mounts.js`); main.js `lightFarmers(hemi.color, 0.3 * hemi.intensity)`.
- Outline: `buildHull` in `character.js`, knob `outline` (high only, `quality.js`): one `SkinnedMesh` a farmer, pieces pushed 0.018 along normals, bones = torso, arms, legs groups; `hullMat` 0x3a281c `BackSide`, no shadow; noShadow and non-FrontSide pieces left out; rebuilt with the look, made or dropped as the tier changes.
- Cloth maps (phase 18 builds on these, all `texture()` keyed CanvasTextures, gray ones `NoColorSpace` multiplying the color): `cloth`, `twill`, `knit`, `plaid`, `straw`, `stripes:<hex>`, `dots:<hex>` (sRGB); contrast raised (knit ribs 162/228/255, plaid bands 0.38). Normal or roughness maps would go beside them on `own.*` materials.
- Animals (`animals.js`) have the rim but no hull: they are many small groups, a hull each would add more than one draw; phase 18 could skin them the same way.
