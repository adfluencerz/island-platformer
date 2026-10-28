# 05 Post-processing

Goal: A post chain (bloom, grade, output) on medium and high, split screen intact.

- `src/gfx/post.js`: `EffectComposer` on a `WebGLRenderTarget` (`HalfFloatType`,
  `samples` 4 on high, 0 on medium at pixel ratio ≤ 1.25); passes:
  `SeatsRenderPass` (a `Pass` whose `render()` sets the target's own
  `viewport/scissor` per seat and calls main.js's seat callback, which keeps
  `within(seat, …)` + `lookFrom(split)`), `UnrealBloomPass` (0.22, 0.35, 0.9),
  `ShaderPass` grade (saturation 1.08, vignette 0.2, warm/cool tint from
  `dayNight.sky`), `OutputPass`. Low tier: no composer, today's direct path.
  `layout()` resizes the composer.
- Done when: `split-2` seats are correct; `phone` draws; `?lowgfx` path is
  unchanged; `--full` shots render under SwiftShader (fall back to `samples 0`
  if the MSAA resolve fails there). Proof: `night-lamps`, `split-2`, `phone`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- renderer `src/main.js:191-204`
- `draw()` `main.js:5550-5572` (resets the stats first) and `lookFrom(split)` `:1807-1828`
- `three/addons/*` already resolves (`character.js:2`)
