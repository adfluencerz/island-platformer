# 20 Golden hour

Goal: At 18:30 the lake glows: low warm light pours across the grass with
long cool shadows, the sky's peach and mauve sit in the water, and the
reeds and the bank catch the low sun.

- The sun sits lower toward sunset and sunrise (`daynight.js` `apply()`:
  about 16° at 18:30 instead of 23°, noon as it was, the moon's path as it
  was), so shadows stretch; the shadow box still covers the view.
- The sunset keyframes (`KEYS`, 17:00 to 19:00): the warm peak moved to the
  shot's hour, a golden sun strong enough for the lower angle, a cooler
  lavender sky light so the shade reads blue against the gold.
- The shade's tint (`uShadowTint`) cooler round a low sun, so the long
  shadows are blue, not grey-brown.
- The pond (`gfx/water.js`): at a low sun it mirrors more of the sky, the
  reflection leans toward the warm horizon (peach into mauve) instead of the
  dim zenith, the muddy base gives way, and the glint is a little stronger.
- The grade leans further toward the sky's warm color round a low sun
  (`gfx/post.js`); the haze toward the sun follows the lower sun by itself.
- Noon, night, the dungeon and the low tier's look unchanged except for
  the same sunset; no new programs beyond the water's variants; budgets hold.
- Done when: in `lake-sunset` at full size the grass is lit gold with long
  blue-violet shadows, the lake shows warm sky (peach/mauve), not brown-grey,
  and `plaza-noon`, `night-lamps` and `dungeon` look as before.
  Proof: `lake-sunset`, `plaza-noon` (unchanged), `night-lamps` (unchanged).
