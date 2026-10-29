# 19 Night figures

Goal: At night the farmers and the neighbours read against the dark: warm
pools of lamp light on the ground and on whoever stands in them, a cool
moonlit edge on everyone else, and no pale halo round dark hair.

- The neighbours' yard lanterns (`npcyards.js` `lantern()`, Mabel's by the
  bakery door, Rosa's porch, Basil's arbor, Finn's hut) join the pool of
  real lamp lights in `build.js` (the nearest few to the player get them),
  so the ground and the figures under them catch warm light. No new lights:
  the same `GLOW_LIGHTS`, at most a couple more if the shot needs them.
- The pooled lamps tuned (reach, intensity, falloff) so a lantern throws a
  pool you can see on the ground, not just a glow on its wall.
- The rim (`character.js` `rimShader`) scaled by the surface's own color, so
  dark hair keeps a faint edge instead of a pale halo, and light cloth and
  skin keep theirs; tinted by what it lands on so it reads as light.
- The player's night glow (`daynight.js`) and the moonlight (`KEYS`) only
  touched if figures still crush to black; the dungeon, the day and the
  interiors stay as they are; the low tier gets the same lights.
- Done when: in `night-lamps` at full size Mabel and the farmer are lit warm
  from the lantern side with a visible pool on the ground under it, the
  farmer's hair has no pale outline, and day shots and the dungeon look
  unchanged; budgets hold (lights: no change in count unless noted).
  Proof: `night-lamps`, `plaza-noon` (unchanged), `dungeon` (unchanged).
