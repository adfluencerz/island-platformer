# 21 Forest light

Goal: At noon the forest has depth and dappled light: pines in layered,
lighter-rimmed tiers that catch the sun on top and go cool underneath, and a
floor that is darker and cooler under the trees with sun between them.

- The pine's tier (`world.js`, a `pineGeo` in place of the plain cone): a
  serrated, drooping skirt round a steeper top and a hollow underside, still
  instanced; the full shape where the tier's `treeDetail` is on, a plainer one
  (seven sides) where it is off, by draw range as the round canopy does.
- The tree hook's shade becomes a tint: each pine tier light at the top, its
  rim lighter and a touch warmer, its underside dark and cool; a round
  canopy's top a little warm and its underside cool (no new programs).
- The floor under a canopy (ground vertices and grass tufts, on the CPU, every
  tier alike): darker and cooler toward the trunk, broken by dappled patches of
  sun, following the trees as they are felled, grow back elsewhere or turn
  giant (only standing trees shade).
- The cloud shadows a touch more contrasty in clear weather.
- The farm's trees where they are (fingerprints), fell/regrow/giant as they
  were; budgets hold (high plaza-noon under 850 calls, 1 M triangles); the day
  and night keyframes untouched.
- Done when: in `forest-noon` at full size the pines read as layered tiers
  with lighter rims and a top-to-bottom gradient, the ground under the trees
  is visibly darker and cooler than the open grass between them, and
  `plaza-noon`, `lake-sunset` and `night-lamps` look as before apart from
  their trees.
  Proof: `forest-noon`, `plaza-noon`, `lake-sunset`.
