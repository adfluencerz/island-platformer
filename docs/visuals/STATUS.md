# Visuals: status

Current phase: 06 (`phases/06-painterly-light.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [x] 03 Sky dome
- [x] 04 Atmospheric fog
- [x] 05 Post-processing
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
- Post is `src/gfx/post.js` (medium/high): SeatsPass -> UnrealBloomPass -> grade ShaderPass, straight to the screen; no OutputPass. The seats are drawn into the half-float target exactly as on the screen (flagged `isXRRenderTarget` with the screen's color space while they draw): tone mapped, sRGB, fog and transparents blended as there, so tiers match and the far land meets the sky. Bloom and grade work on screen values (0..1).
- Grade uniforms: `uSaturation` 1.08, `uVignette` 0.2 (round each seat's part, `uSeats`/`uSeatCount`), `uTint` (set each frame in `post.render()`: `POST.warm` -> `POST.cool` by `uNight`, leaning `POST.skyTint` toward the horizon's hue, white underground). Bloom threshold 0.92 by day -> 0.72 at night/underground (`POST.bloom`). Live: `__game.post.grade.uniforms`, `__game.post.bloom`.
- Night desaturation belongs in the grade: lower `uSaturation` by `uNight` in `post.render()` (low tier would not get it; or in the lights, for both).
- For 06: lighting patches go in the materials before tone mapping as now; anything they add after `colorspace_fragment` (like the fog) must stay in output space, and the dome stays `toneMapped: false`. Bloom catches anything near white on screen: keep lit surfaces under ~0.9 or they will glow.
- plaza-noon 968 calls (post adds 14: bloom 13, grade 1), 32 programs (scene programs in the target's variant; switching tiers live adds the other set).
