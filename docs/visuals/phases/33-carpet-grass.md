# 33 Grass as a carpet (big gap 3 of 4)

Goal: the ground near the player is a dense, swaying carpet of blades, the way
the references are, not tufts scattered on a dark plane. Far away the ground
shader's painted green takes over so the lower camera does not explode the
triangle count.

- Blades: taller (0.5-0.9), wider at the base, 2 segments, curved, in dense
  clumps that cover the ground completely within ~12 m of the camera; root
  color = the ground's color at that spot (sampled from the ground's noise or
  the vertex color), tip lighter and warmer; a few pale and a few dark blades
  for texture; flowers and clover kept.
- Wind: slow large waves across the field plus the fine shimmer; bends away
  from players and animals; cloud shadows and the sun's wrap apply.
- Density rings by distance to the camera (updated per frame or per chunk):
  full to 12 m, half to 20 m, a quarter to 30 m, none beyond; the ground
  shader darkens slightly under the carpet so the transition is invisible.
- Tiers: medium gets the same look at about 60 % of the blades with slightly
  wider blades; low keeps today's tufts. Budgets: high 1.0 M, medium 0.7 M
  triangles on `plaza-noon`, phone shots within their medium budget.
- Keep: tilling still clears blades; the island fingerprints in `npm test`
  (own rng stream for placement, as in phase 7); seasons and snow; the grass
  push from players.
- Done when: at phone size the ground reads as grass, not soil with tufts, in
  `phone-forest-dusk` and `forest-noon`; no visible ring where density drops;
  budgets hold; `npm test` unchanged. Proof: `phone-forest-dusk`,
  `forest-noon`, `plaza-noon`, `lake-sunset`.

## Pointers
- `src/world.js` grass tufts, GRASS_PATCH, the grass wind hook; `src/gfx/ground.js`
  for the ground color; `src/gfx/quality.js` knobs (grassDensity, grassBlades,
  grassSpread).
