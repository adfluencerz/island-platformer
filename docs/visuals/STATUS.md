# Visuals: status

Current phase: 08 (`phases/08-trees.md`)

## Phases
- [x] 00 Tooling and tiers
- [x] 01 Shading core and hook migration
- [x] 02 Tone mapping and light rebalance
- [x] 03 Sky dome
- [x] 04 Atmospheric fog
- [x] 05 Post-processing
- [x] 06 Painterly shading, clouds overhead, cloud shadows
- [x] 07 Grass v2
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
- Grass: `makeTuftGeometry()` in `world.js`, 7 blades x 3 tris (indexed, `DoubleSide`, normals up; the hook re-flips the back's normal), drawRange = tier's `grassBlades` (3/5/7, new knob) x 9 indices; `mesh.count` = tufts x `grassDensity`, live via `grassTier()`/`onApply`. 27,888 tufts on the farm: ~586k tris high, ~251k medium, ~88k low.
- Extra pass from `mulberry32(map.seed ^ 0x51a7)` (`MORE_GRASS` 1.5; `isOpenGround(x, z, 0, -0.15)` lets it nearer tree sites); base pass keeps its rng draws (plus 15 burnt for the old tuft shape). Biome `tall` in `BIOME_FOLIAGE`. Tuft material now 0x8cc04f.
- Wind hook `grass:<height>` (`addGrassWind(material, height)`): gust = 2-octave value noise at `(root.xz - uCloudOffset * 5) * 0.07`, bend along `normalize(uWind + (0.6, 0.25))` (the clouds' drift), `0.08 + 0.42 gust + 0.3 storm`, fine sine, x height^2; feet push from `uPlayers` (y - 0.8), sheen `vColor *= 1 + 0.22 gust h`. Trees in 08 should sway with the same gust field (`GRASS_WIND_GLSL` is exported from `world.js`; sample at the trunk's xz) so canopies lean with the waves.
- Ground drawn in 47-tile squares (`GROUND_CHUNK`, 9 meshes on the farm): culling put phone at ~748k (it was 832k before any grass); plaza-noon calls 969-1000 across runs (the farm drifts), right on the 1000 line: 08 should save calls.
