# 28 The plaza stone

Goal: The stone plaza at noon reads painterly like the Breath of the Wild
ruins: warm, worn, hand-laid slabs in dark mortar, grass and moss creeping
over a crisp but hand-painted edge, not a cool grey patch in a grey halo.

- The halo: the ground's vertex colors (`src/world.js`, The ground's
  surface) blend each kind with its neighbors a quarter tile out, so the
  stone's grey bled into the grass round the plaza. Stone no longer lends
  its color to its neighbors; the ground's shader (`ground:tiles`,
  `src/gfx/ground.js`) paints the stone ground itself, a warm dark mortar,
  out to a wavering edge (its stone share plus a noise, cut sharp at the
  pixel), with moss and soil creeping in from the grass side.
- The slabs (`ground:slab`): warmer stone (the instance colors), each slab
  its own tint, a darker worn rim and a lighter worn center, a few slabs
  cracked right across, and moss in the joints and along each slab's
  shaded (north) edge.
- A few slabs sunken and tipped a little (`src/world.js`, by a hash of the
  tile: no draws from the island's random stream).
- Tufts of grass creeping over the slab edges that face grass, from a
  random stream of their own (nothing else moves), in the grass patches
  that are drawn already.
- No new draw calls, no new programs beyond one, no image files; the fine
  detail fades with distance (gfxShow), so nothing shimmers. Gameplay,
  tilling and the island fingerprints untouched.
- Done when: in `plaza-noon` the plaza reads warm, with visible mortar lines,
  per-slab tint, worn centers, a few cracked or sunken slabs, moss in the
  joints on the shaded side, and a crisp, hand-painted edge into the grass
  with no grey halo; `plaza-morning` and `phone` show the same plaza
  better; the other shots as before; within the budgets.
  Proof: `plaza-noon`, `plaza-morning`, `phone`.
