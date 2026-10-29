# 27 The phone

Goal: On a portrait phone (the medium tier) the plaza at noon reads painterly
like the desktop does: a lush meadow, not ground showing through thin tufts;
the slabs and the ground's mottle visible at that size; light, not murky.

- Re-weigh the medium tier (`src/gfx/quality.js`) against its budget (850
  calls, 0.7 M triangles, 120 programs), measured on the phone and on a
  desktop's plaza-noon at medium: grass is the big triangle cost, the
  outline and the round canopies cost triangles medium cannot spare on a
  desktop.
- The grass on medium: more of the tufts and six blades of seven, and each
  tuft spread a little wider (`grassSpread`, a shared uniform scaling the
  tuft across in the grass hook: `src/world.js`), so the meadow covers the
  ground for far fewer triangles than high's; the flowers as they were.
- The ground's detail on medium (`detailGain`, a shared uniform in
  `src/gfx/ground.js`): the mottle, speckle, worn paths, the slabs' pieces
  and cracks a little stronger, so they read on a small screen with no
  MSAA; high and low as they were.
- No new draw calls, no post pass, no new programs beyond one or two; the
  HUD and touch controls untouched; low and high look as before.
- Done when: in `phone` the meadow round the plaza reads lush (the ground
  barely showing between tufts), the slabs and the mottle show, and the
  picture is no darker than plaza-noon; `plaza-noon` (high) and the other
  desktop shots look as before; the low tier's phone as before; the phone
  and a medium plaza-noon within the medium budget.
  Proof: `phone`, `plaza-noon`, `phone` at `--tier low`.
