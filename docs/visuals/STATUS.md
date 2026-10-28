# Visuals: status

Current phase: 04 (`phases/04-atmos-fog.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [x] 03 Sky dome
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
- The sky is `src/gfx/sky.js`: a dome drawn round each camera in its vertex shader (no per-view code), not tone mapped, from the shared uniforms only; plaza-noon +1 call, +1 program.
- The fog must meet it at `uSkyHorizon` (= `scene.fog.color` = `dayNight.sky.horizon` after the season's tint), output as is (not tone mapped): below the horizon the dome is exactly that color and eases off it through the haze band (sun glow, stars and clouds fade in over ~8°).
- For 04's fog use `uSkyHorizon`, `uSkyZenith`, `uSkyGlow` (sun/moon light color), `uSunDir`, `uNight`, `uUnder`, `uCloudAmount`, `uFlash`, `uCamPos`, `uFogHeight`; if fog tints toward the sun, the dome's horizon must get the same tint (sky.js keeps the glow off the haze band today).
- KEYS: `sky` is now `horizon` (still the fog's), plus `zenith`; overcast, lightning and the cave's dark reach both. Sun disc and moon fade by `uNight` (sun gone before 19:00's swap to the moon's side).
- The 45° play camera never sees above the horizon (top ray ~15° down): clouds show on the title, the lobby and tilted views only; clouds overhead belong to 06. `npm run shots` lobby flaked once ("never got into the lobby"), passed on rerun.
