# 22 Rain

Goal: At noon in the rain the world looks wet and moody, not just grey:
darker, richer ground with a sky sheen, puddles on the paths and the stone,
rain you can see, and a cool blue overcast light.

- A wetness (`uWet`, 0 to 1, a shared uniform): up as a shower starts, held
  while it falls, drying over a couple of game hours after it stops (from the
  farm's clock, `shared/weather.js` read only); none indoors, underground,
  in a lobby (no weather) or in the snow. And `uRain`, how hard it falls now.
- The light hook (`src/gfx/light.js`, every lit material, every tier): wet
  surfaces a little darker and more saturated (up-facing ones most), the
  grass a shade darker, and a sheen of the sky's color on up-facing ones,
  stronger at a glancing view. Nothing changes when dry (`uWet` 0).
- Puddles (`src/gfx/ground.js`, the tiles' path and stone, the plaza's
  slabs): shallow, noise-masked patches in their hollows that go dark and
  mirror the sky, with drops ringing on them while it rains; the same rings
  on the sea, the shallows and the ponds.
- The streaks (`src/weather.js`): longer and a little brighter, so they show
  against dark ground.
- The overcast (`src/daynight.js`, `src/gfx/post.js`): a cooler, bluer light
  and grade in the rain rather than a flat grey wash.
- No new programs beyond a handful; budgets hold; the dungeon and the lobby
  as before; shaders lean (constant loops, no `fract(sin)`).
- Done when: in `rain-noon` at full size the paths and stone read wet (darker,
  with light sky-colored puddles), the streaks are clearly visible, and the
  light is cool and blue rather than a grey veil; `plaza-noon`, `dungeon` and
  `lobby` look as before; the low tier shows the wet ground too.
  Proof: `rain-noon`, `plaza-noon`, `dungeon`.
