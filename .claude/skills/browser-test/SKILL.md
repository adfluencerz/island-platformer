---
name: browser-test
description: Test the game in a real (headless) browser, fast. Use whenever a change should be checked in the running game rather than only by `npm test` - movement, jumping, farming, UI, sound settings, a screenshot of how something looks - or when asked to run, play, try out or screenshot the game.
---

# Testing the game in a browser

`npm run browser` opens the game in headless Chromium, logs in, walks onto
your own farm and **freezes** it. A test then moves the game on by game time
with `g.step(seconds)`, which computes as fast as it can and draws nothing. So
a test doesn't depend on the frame rate: in the cloud container Chromium has
no GPU and draws only about 2 frames a second, and waiting on real time there
is slow and gives wrong answers.

A whole run takes about 10 seconds: the first one also makes a test account
(its login is kept in `node_modules/.cache/browser-test/`).

## Running it

```bash
npm run browser --silent -- test.js                    # a test from a file
npm run browser --silent -- -e 'g.step(1); return g.player.position'
npm run browser --silent -- --shot shot.png -e 'g.hold("KeyD", 1)'
npm run browser --silent -- --shot night.png -e 'g.dayNight.setTime(21); g.step(0.1)'
```

- The test is the body of an async function, with `g` the game
  (`window.__game`, dev builds only). What it returns is printed as JSON on
  stdout; progress and page errors go to stderr.
- Any error in the page fails the run (exit code 1) and is listed.
- `--shot FILE` takes a screenshot at the end (drawn first, at 480×320 with
  `?lowgfx`: half the pixel ratio and no shadows). Look at it with Read.
- `--url QUERY` adds to the page's query, e.g. `giant` (giant trees and rocks
  now). For the time of day use `g.dayNight.setTime(21)` (9 pm on day 1):
  `?hour=` is overwritten once the account's farm comes from the server.
- `--live` leaves the game running in real time instead of frozen.
- `--touch` is a phone: a touch screen, so the game's touch controls show,
  and `await window.__tap(x, y)` in the test taps the screen there with a
  finger, as a real tap does (the pointer and touch events, and the mouse
  events a phone makes of a tap). Find a button's middle with
  `getBoundingClientRect()`. Use it for anything the touch controls do: a key
  sent from a test with `dispatchEvent` is not what a tap sends.
- `--full` draws with full graphics (shadows, no `?lowgfx`) and `--size 960x600`
  sets the window: for judging how something looks. A frame takes a few
  seconds to draw without a GPU, so step first and draw once.
- It starts `npm run dev` itself, and stops it after, unless one is already
  running on port 5173. Put test files in the scratchpad, not the repo.

## What `g` has

- `g.step(seconds, dt = 1/30)`: run the game for that long.
- `g.hold(code, seconds)`: hold a key (`'Space'`, `'KeyD'`, `'KeyE'`...) that
  long, then let go. For a tap or a press without the step in between,
  dispatch the events yourself:
  `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))`.
- `g.draw()`: draw the scene (for a screenshot taken from inside a test).
- `g.player` (`position`, `velocity`, `onGround`), `g.inventory`, `g.shop`,
  `g.chest`, `g.animals`, `g.buildings`, `g.machines`, `g.cooking`,
  `g.fishing`, `g.dayNight`, `g.world`, `g.sound`, `g.place`, `g.net`, and
  more: see `window.__game` at the end of `src/main.js`. Add to it there when
  a test needs something it doesn't have.

The game reads its timers from game time (`clock.elapsedTime`), so stepping
moves them on too. Code that times things with `performance.now()` or
`setTimeout` (some UI, the network) still runs on the wall clock.

## Example: how high a jump goes, held or tapped

```js
const p = g.player;
const ground = () => { while (!p.onGround) g.step(0.05); g.step(0.2); };
const jump = (holdFor) => {
  ground();
  const y0 = p.position.y;
  let top = y0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  for (let t = 0; t < 2; t += 1 / 30) {
    if (t >= holdFor) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    g.step(1 / 30);
    top = Math.max(top, p.position.y);
  }
  return +(top - y0).toFixed(2);
};
return { held: jump(0.6), tapped: jump(0.07) };
```

## Lobbies and multiplayer

The server side (lobbies, farm rooms, party games) is covered faster without
a browser by `npm test` (`scripts/test-multiplayer.js`). Use a browser test
for what the page does: drawing, input, the UI.
