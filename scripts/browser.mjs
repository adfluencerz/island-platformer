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
// node_modules/.cache/browser-test, so later runs skip the sign up.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BROWSER_URL || 'http://localhost:5173';
const STATE = resolve('node_modules/.cache/browser-test/state.json');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

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

const t0 = Date.now();
const log = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---- the servers ----
const up = async () => fetch(BASE).then((r) => r.ok, () => false);
let dev = null;
if (!(await up())) {
  log('starting npm run dev');
  dev = spawn(process.execPath, ['scripts/dev.js'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 100 && !(await up()); i++) await new Promise((r) => setTimeout(r, 200));
  if (!(await up())) throw new Error(`the dev server did not come up at ${BASE}`);
}
const stopDev = () => dev && process.kill(-dev.pid, 'SIGTERM');

const browser = await chromium.launch({
  ...(existsSync(CHROMIUM) && { executablePath: CHROMIUM }),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
let exitCode = 0;
try {
  const [width, height] = opts.size;
  const context = await browser.newContext({ viewport: { width, height }, ...(opts.touch && { hasTouch: true, isMobile: true }), ...(existsSync(STATE) && { storageState: STATE }) });
  const page = await context.newPage();
  if (opts.touch) await page.exposeFunction('__tap', (x, y) => page.touchscreen.tap(x, y));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const query = [!opts.full && 'lowgfx', opts.query].filter(Boolean).join('&');
  await page.goto(`${BASE}/?${query}`);
  const farmButton = page.getByText('Go to my farm');
  await Promise.race([farmButton.waitFor(), page.getByPlaceholder('What farmers call you').waitFor()]);

  // ---- logged in, or make the test account ----
  if (!(await farmButton.isVisible())) {
    log('making a test account');
    await page.locator('.ui-btn', { hasText: 'Create account' }).first().click();
    await page.getByPlaceholder('What farmers call you').fill(`tester${Math.floor(Math.random() * 1e6)}`);
    await page.locator('input[type=password]').first().fill('test-farmer-pass');
    await page.locator('.ui-btn-big', { hasText: 'Create account' }).click();
    await farmButton.waitFor();
    mkdirSync(dirname(STATE), { recursive: true });
    await context.storageState({ path: STATE });
  }

  // ---- onto the farm ----
  await farmButton.click();
  await page.waitForFunction(() => window.__game?.place === 'home' && window.__game.inGame);
  if (!opts.live) await page.evaluate(() => window.__game.step(0.5)); // (settle, then frozen)
  log('on the farm');

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
