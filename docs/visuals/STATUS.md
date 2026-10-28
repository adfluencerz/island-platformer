# Visuals: status

Current phase: 05 (`phases/05-post.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [x] 03 Sky dome
- [x] 04 Atmospheric fog
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
- The fog is `src/gfx/atmos.js`, a base hook on every lit material (`userData.gfx.noAtmos` opts out, own program): `fog_fragment` swapped under `GFX_ATMOS` for three's linear term (lookFrom's near/far, `CAVE_FOG`) plus an aerial haze from ~0.4 fog-near and a sea-level haze (`uFogHeight` = (SEA_LEVEL, 0.35 per unit)); off from `uUnder` 0.6 (the dungeon is three's fog alone). Unlit sprites/tags keep three's plain fog.
- Its color is `gfxHorizon(dir)` (`HORIZON_GLSL`, the dome uses the same function), warm toward a low sun, written with `linearToOutputTexel`: like three's `fogColor` it follows the output space, so into a render target it is linear and still meets the dome.
- For 05: three's fog runs after tone mapping and the dome is `toneMapped: false`, so neither is tone mapped; tone map or grade in post only if fog, dome and ground get it alike (or keep the scene's own tone mapping and grade after), or the far land stops meeting the sky.
- Render order: the dome is `renderOrder -1000`, no depth test/write, drawn first round each camera; a post pass must keep it first and not read it as depth (bloom on the sun disc is fine).
- plaza-noon unchanged: 960 calls, 24 programs (every lit material gets the hook, so no new programs).
