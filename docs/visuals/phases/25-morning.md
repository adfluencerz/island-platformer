# 25 Morning

Goal: At 8:00 the farm wakes up: a low, warm, soft sun from the east throws
long shadows across the plaza and the grass, the shade is a cool blue, a
pale haze lies low over the valley and thins as the sun climbs, the grass
tips are bright with dew, and the sky's horizon is still a little peach.

- The sun's path (`daynight.js` `apply()`): in the morning it climbs more
  slowly (about 20° up at 8:00 instead of 30°), back on its old path by
  noon; sunset, noon and the moon as they were.
- The morning keyframes (`KEYS`, 6:00 to 9:30): the warm peak a little
  later, a warm-cream sun strong enough for the low angle, a peach horizon
  at 8:00, a cool blue sky light so the shade reads blue; cooler, paler and
  less saturated than the sunset; the day's colors back by 9:30.
- A morning-mist amount (`uMist`, `gfx/uniforms.js`: 1 from dawn to about
  8:30, gone by 10:00, none underground, less under rain clouds), set with
  the day's light.
- The air (`gfx/atmos.js`): with the mist, the low haze is thicker, starts
  nearer and lies a little higher, paler and cooler, while the sun's side of
  it stays warm (the sun burning through).
- The grass (`world.js` grass hook): a dew sheen on the tips in the mist's
  hours, a cool, bright lift at the blade's top (vertex color, no new
  texture reads).
- The grade (`gfx/post.js`): with the mist a little less saturation and a
  paler, cooler lean, so morning is not a second sunset.
- Noon, the sunset, night, the dungeon and the lobbies as they were; the
  low tier gets the same sun, mist and dew (no grade); no new programs;
  budgets hold; the shaders lean (a few multiply-adds).
- Done when: in `plaza-morning` at full size the light is low and warm from
  the east with long soft cool shadows, a haze lies over the far grass, the
  grass tips catch a dewy sheen and the horizon is peach; `plaza-noon`,
  `lake-sunset`, `night-lamps`, `dungeon` and `lobby` look as before;
  `programs` unchanged.
  Proof: `plaza-morning`, `plaza-noon` (unchanged), `lake-sunset` (unchanged).
