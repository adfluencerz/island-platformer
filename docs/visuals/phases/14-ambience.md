# 14 Ambience

Goal: Pollen by day, lamps and dungeon glows that bloom at night.

- `src/gfx/motes.js`: 160 daytime pollen `Points` (fireflies' pattern), warm,
  drifting with `uWind`, off at night/rain/underground; lantern and window
  `emissiveIntensity` 2.5 so bloom lifts them; fireflies retuned; dungeon glow
  pools bloom.
- Done when: night lamps bloom softly; fill rate fine on `phone`. Proof:
  `night-lamps`, `dungeon`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- `daynight.js` `KEYS` :19-29 and `apply()` :193-248
- devtools info `main.js:1478`, FPS `devtools.js:170-190`
