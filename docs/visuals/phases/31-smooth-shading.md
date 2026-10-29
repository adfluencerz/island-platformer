# 31 Smooth painterly shading (big gap 1 of 4)

Goal: the game stops reading as faceted low-poly. Every surface becomes smooth
and softly lit, warm in the sun and cool in the shade, at every hour, and the
tree that fades between the camera and the player no longer leaves a green
ghost. This is the first of four "big gap" phases: a real phone screenshot
(`/root/.claude/uploads/3bb546e0-f6fc-5311-bd5d-17d912772252/8860db17-image.jpg`,
a forest at 6:20 pm on a phone) showed the scene still far from the references
after thirty rounds of detail polish. Look at it once before starting.

- No facets. `flatShading: true` is set in about 52 places (`grep -rn flatShading src`).
  Turn it off everywhere through one switch (the base hook in `src/gfx/shading.js`
  or a shared material helper), not 52 edits. Flat shading off only helps when
  vertices are shared: canopies, pines, rocks, bushes, the blossom tree, cliffs
  and the merged decor are non-indexed, so run `mergeVertices` and
  `computeVertexNormals` on their geometries (`src/world.js` canopyGeo/pineGeo,
  rock and bush kits, `maps.js` set pieces, `homekit.js`/`build.js` kits), with a
  crease angle so boxes and roofs keep hard edges. Characters and tools too.
- Soft half-tone light: a wider wrap (`uWrap`), a two-step toon ramp with a soft
  edge (`uToon`), warm key and cool blue fill, the sun shadow softer
  (`shadow.radius`, PCF soft). Ambient lifted at dawn and dusk so the ground is
  warm green and gold, never muddy olive; night stays blue, not grey.
- Grade: a touch more saturation and contrast in the mids; dusk warm, noon clean.
- The fade ghost: the dithered `aFade` on a canopy between camera and player
  reads as a see-through green blob on a phone (pixel ratio 1.5, no MSAA).
  Replace it with a clean cut: a soft-edged circular hole in screen space around
  the player (smooth alpha, `transparent` only while fading, depthWrite off for
  the fading instance, or a second pass), or a fade that goes fully invisible
  within 0.3 s. Must look clean in the new `phone-forest-dusk` shot.
- Add the shot `phone-forest-dusk` to `scripts/shots.mjs`: the phone page
  (390x844, touch, medium), `g.warp('forest')`, 18.5 h, the camera snapped, so
  it matches the user's screenshot. It joins `contact.png` and `--check`
  (phone budgets).
- Done when: at phone size no triangle facets show on trees, rocks, bushes or
  the blossom tree; the 18.5 h forest reads warm and saturated; the ghost is
  gone; programs within budget; `npm test` unchanged. Proof: `phone-forest-dusk`,
  `forest-noon`, `plaza-noon`, `lake-sunset`.

## Pointers
- `src/gfx/shading.js` base hooks (every lit material compiles through them);
  `src/gfx/light.js` wrap/toon; `src/gfx/post.js` grade; `src/daynight.js` KEYS;
  `src/world.js` canopyGeo, pineGeo, makeInstancer, the `aFade` dither hook.
- `three/addons/utils/BufferGeometryUtils.js` `mergeVertices`.
