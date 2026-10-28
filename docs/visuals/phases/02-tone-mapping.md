# 02 Tone mapping and light rebalance

Goal: Filmic tone mapping and rebalanced lights, so day, dusk, night and the dungeon all read well.

- `renderer.toneMapping = THREE.AgXToneMapping` (fallback `Neutral`), exposure
  ≈ 1.15; works for direct rendering now and for `OutputPass` later. Rebalance
  `KEYS` intensities (~×1.3) and hemi ground toward blue; name tags brightened
  if dull.
- Done when: 8h, 12h, 18.5h, 21.5h and the dungeon all read well (nothing
  crushed or grey). Proof: those five shots.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- renderer `src/main.js:191-204`
- lights `main.js:261-299` (tier applied :311-325)
- `daynight.js` `KEYS` :19-29 and `apply()` :193-248
- `seasons.js` light tint :243-252
