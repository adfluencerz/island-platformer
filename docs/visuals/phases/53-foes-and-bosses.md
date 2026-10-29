# 53 Dungeon foes and bosses

Goal: The dungeons' foes and the bosses read as Breath of the Wild creatures
at the low camera: chunky, smooth silhouettes with a soft dark outline and
the farmer's rim, their material at a glance (fur, skin, feathers, a frog's
slick hide), eyes that glow in the dark of a dungeon, and a boss that feels
big: a hot emissive accent, a dark shadow pool under it, a slow breath;
instead of small faceted toys with black bead eyes on a hard grey disc.

- Two new fixed shots (`scripts/shots.mjs`, desktop page, contact sheet only,
  not the `--check` list): `foes` (the bog's first room, its frogs awake and
  in view) and `boss` (the lion's hall, the lion awake in front of the
  farmer), reached with `g.warp()` to `dungeonStart()` / `arenaStart()`.
- Foes (`src/dungeonfoes.js`): smooth shapes (round spheres, no flat
  shading) for the still body; its material rimmed (`rimmed()`, the
  farmers' sun and sky rim, the darker underside) with a `living` look per
  kind (skin for sproutlings and frogs, fur for cubs and bees, fur as
  feathers for rooks), the frogs glossy; eyes on a shared unlit glow
  material per color (bloom picks it up): amber, red, yellow; a hit flash
  (the body's material swapped for a bright one for a moment); the
  outline hull of the farmers (`src/character.js`, an additive export),
  one draw a foe, on the tiers with the outline.
- Bosses (`src/bossview.js`): the same smooth, rimmed materials (the animals'
  program), the pupils glowing while awake and fighting (dark again when
  friendly), a stronger emissive accent where it fits (the bee queen's
  crown), a dark soft shadow pool (the shared contact blob, larger) in place
  of the faint disc, a slow breath on top of each pose, the farmers'
  outline hull; hit flashes as before.
- No hitboxes, timings or gameplay touched (`npm test` unchanged); the shared
  gfx core untouched; at most one new program; the low tier sane (no hull).
- Done when: in `foes` the frogs read as chunky slick creatures with
  glowing eyes, an edge and a rim against the floor; in `boss` the lion is
  big and dramatic, its eyes glowing, a dark pool under it and an edge
  against the hall; `dungeon`'s sproutlings read the same way; every other
  shot as before; within the budgets.
  Proof: `foes`, `boss`, `dungeon`.
