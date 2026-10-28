# Visuals: status

Current phase: 03 (`phases/03-sky-dome.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [ ] 03 Sky dome
- [ ] 04 Atmospheric fog
- [ ] 05 Post-processing
- [ ] 06 Painterly shading, clouds overhead, cloud shadows
- [ ] 07 Grass v2
- [ ] 08 Trees: instancing, dithered fade, painterly canopy
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
- Tone mapping is `src/gfx/tonemap.js`: three's `CustomToneMapping` = AgX at exposure 1.15, mixed half-way with the scene's own hue at AgX's brightness (plain AgX turned the grass yellow and grey); OutputPass picks up the same chunk. Name tags and fireflies are `toneMapped: false`.
- `daynight.js` KEYS: day sun 1.45 warm (0xfff6ea), sky light 0.95 cool (0xc4d8ff), ground bounce blue (0x34487a); dusk 18.3 sun 1.9 and hemi 1.25 so sunsets glow; night moon 0.6 blue; CAVE hemiI 0.7. Not x1.3 across the board: AgX at 1.15 already came out brighter than before.
- `scene.background` and fog color are not tone mapped (fog mixes after it, in output space). The sky dome (03) is a mesh, so it will be: give it `toneMapped: false`, or lift its colors, so it still meets the fog at the horizon in KEYS' `sky` color.
- Night grass still reads green under the blue moon (green albedo); a night desaturation belongs in shading (06) or the grade (05), not the lights.
- Still true from 01: change a shader only with `hook()` (`src/gfx/shading.js`, key = every setting); shared uniforms in `src/gfx/uniforms.js`; `npm run gates` runs every gate (about 2 min).
