# Visuals: the overhaul, phase by phase

## Art direction
Stylized painterly, in the spirit of Breath of the Wild, not realism:
- soft shading with a gentle wrap, warm sunlight and cool blue shadows;
- lush, dense grass that sways, trees with soft round canopies;
- a real sky: a gradient dome, drifting clouds, sun, moon and stars, and cloud shadows on the ground;
- atmospheric depth: far land melts into the sky, a low haze over the sea;
- bloom on lamps, glints and the sun, and a light color grade (a touch of saturation, a soft vignette);
- the low-poly shapes and flat-color charm stay: it is the light and air that change.
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
| grass density | 0.35 | 0.6           | 1.0  |
| tree sway     | off  | on            | on   |
| cloud shadows | off  | on            | on   |
| MSAA (post)   | off  | off           | 4    |
| particles     | 300  | 600           | 900  |

## Budgets (farm, `plaza-noon` in `npm run shots`)
- Draw calls: not more than the previous phase (the baseline is in STATUS.md); ≤ 900 from phase 09 on.
- Programs ≤ 120. Triangles ≤ 1.5 M on high, ≤ 0.8 M on medium.
- `npm run shots -- --check` reads the line below; lower `calls` as phases bring it down, never raise it.
<!-- budgets {"calls": 1000, "programs": 120, "triangles": {"high": 1500000, "medium": 800000, "low": 800000}} -->

## Gates (every phase, all must pass before pushing)
`npm run gates` runs them all in order (`scripts/gates.mjs`: one line per gate, the tail of any failure's output):
- `npm test` and `npm run build`.
- `npm run browser --silent -- -e 'g.step(2); return g.stats()'` with no page errors, and the same with `--full`.
- `npm run shots` (ten PNGs, `contact.png`, `stats.json`) and `npm run shots -- --check`.
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
- `npm run shots [-- --tier low|medium|high] [--check]`: `scripts/shots.mjs`, launcher in `scripts/lib/page.mjs`.
