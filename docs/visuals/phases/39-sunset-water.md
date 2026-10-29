# 39 Water at sunset

Goal: At the wide, low camera the pond and the sea at sunset mirror the warm
sky toward the sun and go cool blue away from it, with readable shallows, a
dark deep middle, glints on the far side and a wet, dark shore, instead of a
flat grey-lilac disc in a pale ring; the noon and night water unchanged.

- The sunset mirror (`src/gfx/water.js`, the surface for every `water:<kind>`):
  round a low sun, by day, out in the open (as the old `dusk` term), the sky
  in the water is the sunset's: warm peach-gold (`uSkyHorizon` toward
  `uSkyGlow`) where the reflection looks toward the sun, cool blue-lilac
  (toward `uSkyZenith`) where it looks away, weighted by a fresnel that reads
  at the 30-degree view (more mirror toward the far side, the water's own
  body nearer the camera). 0 at noon, at night and under rain clouds.
- Depth (the pond and the lake: their geometry's distance to the bank,
  `gfxBank`, now reaching to the middle, `src/maps.js`, `src/build.js`):
  readable shallows by the edge, the floor showing through a tint, and a dark,
  opaque deep middle.
- Glints round a low sun weighted to the far side (grazing) and the warm side,
  the near water nearly bare of them, bright enough for the bloom.
- A cheap fake reflection of the far bank: a soft dark band on the water
  under the far shore (where the bank lies beyond the water, as seen),
  wavering with the ripples.
- Ripples that read at this angle: the swells tilt the sunset mirror between
  its warm and cool sides and its dark body.
- The rim: no pale ring; the water at the bank dark and wet against the
  reeds and the bank's wet rock.
- The sea (`src/main.js`) and the shallows (`src/world.js`) share the same
  hooks, so the sea at sunset gains the glow too.
- No new draw calls or programs; shaders lean; the low tier the same look
  (no post: glints just bright); noon and night water unchanged.
- Done when: in `lake-sunset` the pond glows warm toward the sun and goes
  cool away from it, the shallows read by the edge and the middle is dark,
  the glints sit on the far side, a dark band lies under the far bank and no
  pale ring is left; the sea at sunset mirrors the same sky; `shore-noon`,
  `night-lamps` and the lobby's pond unchanged; within the budgets.
  Proof: `lake-sunset`, `shore-noon`, `night-lamps`, `phone-forest-dusk`.
