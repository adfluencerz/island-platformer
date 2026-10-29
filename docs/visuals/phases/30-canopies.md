# 30 The tree crowns

Goal: Seen from the play camera, the trees read painterly like the Breath of
the Wild references: round crowns with a bright, warm sun-side top, a dark
warm underside and a soft rim toward the sky, broken into a few leafy lobes;
pines as layered, lit tiers, not flat dark-green blobs and plain cones.

- The crown's light (`src/world.js`, the 'tree' hook, per vertex): light on
  top from `uSunDir` (lifted toward up, so a noon crown is bright and a
  sunset one lit on its sun side), a touch of yellow-green where it is lit
  and a cooler blue-green in shade, the underside darker and warm; a soft
  rim toward the sky on the upper silhouette (by the view, `cameraPosition`),
  quieter at night. The per-instance tint (instance colors) kept.
- Leaf clusters: a few lobes of lighter and darker green a crown, from the
  blob's own bumps (its corners pushed out are lighter, the dimples darker)
  and a slow, smooth pattern seeded by where the blob stands: nothing finer
  than a lobe, so nothing shimmers at distance.
- Pines: each tier lit at its top and shoulder, a lighter, warmer skirt edge
  catching the sun, dark and cool under the skirt, and each facet its own
  shade (a hash of its face normal) so the tiers read as layered needle
  clumps rather than one smooth cone.
- Trunks untouched (a per-material uniform tells leaves from bark: the same
  program, no new one). The instanced path, dithered fade, sway, seasons and
  snow (on top, `src/seasons.js`) and themed leaf colors work as before.
- No new draw calls, no new programs beyond one, triangles unchanged; lean
  per-vertex code (SwiftShader's startup).
- Done when: in `forest-noon` the round crowns have a bright warm top, a
  darker underside, a soft sky rim and a few visible lobes each, the pines
  read as lit tiers with light edges and dark undersides, and the per-tree
  tint still shows; `plaza-noon` and `lake-sunset` trees look the same or
  better (the sunset lighting their sun side); night-lamps' trees stay quiet;
  within the budgets.
  Proof: `forest-noon`, `plaza-noon`, `lake-sunset`.
