// `npm run browser -- [options] [test.js]`: the game in a headless Chromium,
// on your own farm, frozen, for a test to drive with game time instead of
// waiting on a slow software-drawn page. See .claude/skills/browser-test.
//
//   test.js        an async function body run in the page, with `g` the game
//                  (window.__game: g.step(seconds), g.hold('Space', 0.3),
//                  g.player, g.inventory, ...); what it returns is printed
//   -e CODE        the same, inline
//   --url QUERY    extra query for the page, e.g. --url giant
//   --shot FILE    a screenshot when the test is done
//   --live         don't freeze the game (it runs at the page's frame rate)
//   --full         full graphics (shadows, the whole pixel ratio): no ?lowgfx,
//                  for judging how it looks (slower to draw)
//   --size WxH     the window's size (480x320)
//   --touch        a phone: a touch screen (the game's touch controls show),
//                  and `await window.__tap(x, y)` in the test taps the screen
//                  there with a finger, as a real tap does (pointer, touch
//                  and the mouse events a phone makes of a tap)
//
// The game server and Vite are started (and stopped after) unless `npm run
// dev` is already up. A test account is made once and its login kept in
// node_modules/.cache/browser-test, so later runs skip the sign up. (The
// launching, logging in and freezing: scripts/lib/page.mjs, shared with
// scripts/shots.mjs.)
import { readFileSync } from 'node:fs';
import { logger, startDev, launch, openFarm } from './lib/page.mjs';

// ---- the command line ----
const args = process.argv.slice(2);
const opts = { query: '', shot: null, live: false, code: null, full: false, size: [480, 320], touch: false };
while (args.length) {
  const a = args.shift();
  if (a === '-e') opts.code = args.shift();
  else if (a === '--url') opts.query = args.shift().replace(/^\?/, '');
  else if (a === '--shot') opts.shot = args.shift();
  else if (a === '--live') opts.live = true;
  else if (a === '--full') opts.full = true;
  else if (a === '--size') opts.size = args.shift().split('x').map(Number);
  else if (a === '--touch') opts.touch = true;
  else opts.code = readFileSync(a, 'utf8');
}

const log = logger();
const stopDev = await startDev(log);
const browser = await launch();
let exitCode = 0;
try {
  const { page, errors } = await openFarm(browser, { ...opts, log });

  if (opts.code) {
    const result = await page.evaluate(`(async (g) => { ${opts.code}\n})(window.__game)`);
    console.log(JSON.stringify(result, null, 2));
  }
  if (opts.shot) {
    if (!opts.live) await page.evaluate(() => window.__game.draw());
    await page.screenshot({ path: opts.shot });
    log('screenshot:', opts.shot);
  }
  if (errors.length) {
    console.error('page errors:\n  ' + errors.join('\n  '));
    exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  exitCode = 1;
} finally {
  await browser.close();
  stopDev();
  log('done');
}
process.exit(exitCode);
