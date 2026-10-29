# Visuals: the overhaul, phase by phase

## Art direction
Stylized painterly, in the spirit of Breath of the Wild, not realism:
- soft shading with a gentle wrap, warm sunlight and cool blue shadows;
- lush, dense grass that sways, trees with soft round canopies;
- a real sky: a gradient dome, drifting clouds, sun, moon and stars, and cloud shadows on the ground;
- atmospheric depth: far land melts into the sky, a low haze over the sea;
- bloom on lamps, glints and the sun, and a light color grade (a touch of saturation, a soft vignette);
- smooth, soft forms (no faceted flat shading), cloud-like canopies, rounded rocks:
  since phase 31 the low-poly facets are gone; the flat-color palette stays.
It must stay playable in a browser and on phones: the Graphics setting (tiers,
below) is the escape hatch, and every phase keeps the low tier cheap.

## Tiers (`src/gfx/quality.js`)
Picked in the menu (Graphics: high/medium/low, kept as `tp.gfx`), or `?gfx=low|medium|high`;
`?lowgfx` is low; by default a touch screen is medium and anything else high.

| knob          | low  | medium        | high |
|---------------|------|---------------|------|
| pixel ratio cap | 0.5 | 1.5          | 2    |
| shadow map    | off  | 1024          | 2048 |
| post          | off  | half-res bloom | full |
| grass density | 0.35 | 0.75          | 1.0  |
| grass blades (of 7 a tuft) | 3 | 6     | 7    |
| grass spread (tuft width) | 1 | 1.2    | 1    |
| tree detail (tris a canopy blob) | 20 | 80 (since 31) | 80 |
| tree sway     | off  | on            | on   |
| cloud shadows | off  | on            | on   |
| MSAA (post)   | off  | off           | 4    |
| particles (rain, snow; motes: 160 at 900) | 300 | 600 | 900 |
| night's grey  | in the light (0.35) | in the grade | in the grade |
| character outline | off | off       | on   |
| ground detail gain | 1 | 1.35        | 1    |

## Budgets (final from phase 15: `plaza-noon` and `phone` in `npm run shots`, each at its tier)
Measured in phase 15 (960x600, pixel ratio 1, SwiftShader, shadow pass included; calls drift ±20 between runs):

| tier   | plaza-noon calls / triangles / programs | phone calls / triangles | budget calls / triangles / programs |
|--------|------------------------------------------|-------------------------|--------------------------------------|
| high   | 787 / 831k / 44 | 661 / 505k  | 850 / 1.0 M / 120 |
| medium | 773 / 611k / 43 | 659 / 373k  | 850 / 0.7 M / 120 |
| low    | 359 / 478k / 30 | 180 / 264k  | 450 / 0.6 M / 100 |

- Programs are the headroom for the surface detail of phases 16–18: about 75 free on every tier (a lobby, the most, has 85 on high).
- `npm run shots -- --check` reads the line below for plaza-noon and the phone at their tiers; lower a number as phases bring it down, never raise it.
<!-- budgets {"high": {"calls": 850, "triangles": 1000000, "programs": 120}, "medium": {"calls": 850, "triangles": 700000, "programs": 120}, "low": {"calls": 450, "triangles": 600000, "programs": 100}} -->

## Gates (every phase, all must pass before pushing)
`npm run gates` runs them all in order (`scripts/gates.mjs`: one line per gate, the tail of any failure's output):
- `npm test` and `npm run build`.
- `npm run browser --silent -- -e 'g.step(2); return g.stats()'` with no page errors, and the same with `--full`.
- `npm run shots -- --tier low --check`, then `npm run shots -- --check` (twelve PNGs, `contact.png`, `stats.json`: high, the two phone shots medium).
- Look at `shots/contact.png` once and judge it against the phase's "Proof" line.

## Rules
Never: merge red; touch `shared/`, `server/`, saves or the protocol; break the `?lowgfx`
harness path; skip or loosen a test; change the island fingerprints in `npm test`.
Shaders must compile under SwiftShader: constant loop bounds, `highp` hashes, no `fract(sin(...))`.
Watch `programs` for cache-key collisions; dispose what you make.

## Worker protocol
1. Read this file, `STATUS.md` and your `phases/NN-*.md`; then only the code you touch.
2. Implement the phase. 3. Run the gates. 4. `npm run shots`, look at `contact.png`, fix.
5. Commit in the repo's plain-English style; `git push -u origin claude/festive-goldberg-tcdcpc`.
6. Open the PR (body = the report). 7. Return the report.

## Report (fixed shape, ≤ 20 lines)
```
phase: NN
pr: <url>
gates: test=pass|fail build=… browser-lowgfx=… browser-full=… shots=… check=…
stats plaza-noon: calls=… triangles=… programs=… (tier high)
done-when: <item>: yes|no — one line each
shots: <what contact.png showed, 2 lines>
notes for next phase: ≤ 5 lines
```

## Tools
- `window.__game` (dev): `stats()`, `warp('plaza'|'lake'|'house'|'forest'|'dungeon'|{x,z})`,
  `snapCamera()`, `dayNight.setTime(h)`, `step(s)`, `draw()`; the devtools Info tab shows the stats.
- `?cam=wide|classic`: the camera's angle from above (the menu's Camera button, kept as `tp.cam`; wide by default, classic underground and indoors).
- `npm run shots [-- --tier low|medium|high] [--check]`: `scripts/shots.mjs`, launcher in `scripts/lib/page.mjs`.
