# 06 Painterly shading, clouds overhead, cloud shadows

Goal: Painterly wrap shading, cool shadow tint and drifting cloud shadows.

- Chunk patches under `GFX_WRAP`: `RE_Direct_Physical`/`RE_Direct_Lambert`
  `dotNL = smoothstep(-uWrap, 1, dot)` with a soft half-tone step by `uToon`;
  `lights_fragment_begin`: inside the directional loop multiply
  `directLight.color` by `gfxCloudShadow(vGfxWorld.xz)` (2-octave FBM, off on
  low and underground) and tint `indirectDiffuse` by `uShadowTint`
  (≈ 0.80, 0.86, 1.0) where the sun is shaded. `sun.shadow.radius` 2–3,
  `normalBias` 0.035. Weather drives `uCloudAmount`.
- Done when: the terminator is clean (no acne band), cloud shadows drift,
  overcast darkens. Proof: `forest-noon`, `rain-noon`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- lights `main.js:261-299` (tier applied :311-325)
- `daynight.js` `KEYS` :19-29 and `apply()` :193-248
- `seasons.js` light tint :243-252
