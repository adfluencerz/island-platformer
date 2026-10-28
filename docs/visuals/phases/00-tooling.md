# 00 Tooling and tiers (no visual change)

Goal: Tiers, a stats readout and fixed screenshots to judge every later phase by, with no visual change.

- `src/gfx/quality.js`: tier `low|medium|high`; auto: `?lowgfx` → low,
  `isTouch()` → medium, else high; `?gfx=` overrides; menu toggle "Graphics"
  next to Sound/Music, saved in localStorage (`tp.gfx`) like `sound.js`;
  `applyTier()` is live. Table of knobs: pixel ratio cap 0.5/1.5/2, shadow map
  0/1024/2048, post off/half-res bloom/full, grass density 0.35/0.6/1.0, tree
  sway off/on/on, cloud shadows off/on/on, MSAA off/off/4, particles
  300/600/900 (replaces the `LOWGFX ? 300 : 900` branch).
- `src/gfx/stats.js`: `renderer.info.autoReset = false`, reset at the top of
  `draw()`, `__game.stats()` → `{calls, triangles, programs, geometries,
  textures, tier, pixelRatio}`; devtools Info rows.
- `scripts/lib/page.mjs` + `scripts/shots.mjs` (`npm run shots`, gitignored
  `shots/`): `plaza-morning` 8h, `plaza-noon` 12h, `forest-noon` (nearest tree
  cluster), `lake-sunset` 18.5h (`LAKE` in `shared/farmland.js`), `night-lamps`
  21.5h by the house, `rain-noon` (force `g.weather`), `dungeon` (new dev-only
  `__game.warp('dungeon')` via the bosses' portal path, `src/bosses.js:595-617`),
  `lobby` (`g.joinLobby` on the dev server), `split-2` (`g.addSeat`), `phone`
  (`--touch --size 390x844`); each: teleport (`__game.snapCamera` exposed),
  `g.dayNight.setTime`, `g.step(0.5)`, `g.draw()`, screenshot; a contact sheet
  via a blank page of data-URL images; `shots/stats.json`; `--check` fails
  when over the budgets in README.
- `docs/visuals/*` written; README "Graphics" paragraph, `npm run shots`
  under Tests, `src/gfx/` in Project structure; BACKLOG "Visuals" theme.
- Done when: `npm run shots` writes 10 PNGs + `contact.png` + `stats.json`;
  the baseline numbers are in STATUS.md; the toggle persists across reloads;
  tests and build pass. Proof: `contact.png` looks exactly like today.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- settings pattern `src/sound.js` :27-40 and the menu row `src/ui/splash.js` :117-129
- devtools info `main.js:1478`, FPS `devtools.js:170-190`
- `draw()` `main.js:5550-5572` (resets the stats first) and `lookFrom(split)` `:1807-1828`
- `window.__game` `main.js:5632` (with `stats`, `warp`, `snapCamera`)
