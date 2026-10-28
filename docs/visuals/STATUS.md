# Visuals: status

Current phase: 07 (`phases/07-grass.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [x] 03 Sky dome
- [x] 04 Atmospheric fog
- [x] 05 Post-processing
- [x] 06 Painterly shading, clouds overhead, cloud shadows
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
- Painterly light is a base hook, `src/gfx/light.js` (opt-outs `noWrap`, `noCloud`): it swaps three's `lights_*_pars_fragment` (diffuse wrapped by `gfxWrapNL`, specular as it was) and `lights_fragment_begin` under `GFX_LIGHT`. `uWrap` 0.45 (none by moonlight), `uToon` 0.3, `uShadowTint` (0.80, 0.86, 1.0) on the sky's light by `1 - gfxSunLit` (cast shadow x cloud x facing).
- Cloud shadows: `gfxCloudShadow(worldXZ)` (in the pars chunk, so any lit hook can call it; grass in 07 can paste `CLOUD_GLSL` and use `LIGHT_UNIFORMS`): 2-octave value noise at `(xz - uCloudOffset) * 0.018 + (5.5, 19.5)`, returns 1 in sun, down to 0.3 (clear) / 0.65 (overcast) under cloud; the sun gets it all, the sky's light 0.6 of it. Coverage ~40 % clear, ~90 % in rain. Off on low (`uCloudShadows` 0), underground, half at night; the wardrobe stage zeroes it while it draws.
- Shadows: `PCFShadowMap` (PCFSoft ignored `radius`), `radius` 2.5, `normalBias` 0.035; back faces (N.L < 0) fade the map out so the wrap, not the map, darkens them: no acne band, a smooth terminator. The dome's clouds now drift with the wind (`- uCloudOffset`), the same way as their shadows.
- plaza-noon looks ~10 % darker on average (cloud patch in view); night unchanged by the wrap. Night desaturation still not done (grade, `post.render()`).
