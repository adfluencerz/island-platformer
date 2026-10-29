// The game in a headless Chromium, on your own farm, frozen: the part of
// scripts/browser.mjs that scripts/shots.mjs shares. See .claude/skills/browser-test.
//
//   startDev(log)          npm run dev, unless it is up already; returns a stop()
//   launch()               the Chromium
//   openFarm(browser, o)   a new context and page, logged in (a test account is
//                          made once and its login kept in
//                          node_modules/.cache/browser-test), on the farm and
//                          frozen. o: { query, full, size: [w, h], touch, live, log }.
//                          Returns { context, page, errors } (errors: the page's, as they come)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

export const BASE = process.env.BROWSER_URL || 'http://localhost:5173';
const STATE = resolve('node_modules/.cache/browser-test/state.json');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

// a log line on stderr, with the seconds since it started
export function logger() {
  const t0 = Date.now();
  return (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
}

// ---- the servers ----
export async function startDev(log) {
  const up = async () => fetch(BASE).then((r) => r.ok, () => false);
  let dev = null;
  if (!(await up())) {
    log('starting npm run dev');
    dev = spawn(process.execPath, ['scripts/dev.js'], { stdio: 'ignore', detached: true });
    for (let i = 0; i < 100 && !(await up()); i++) await new Promise((r) => setTimeout(r, 200));
    if (!(await up())) throw new Error(`the dev server did not come up at ${BASE}`);
  }
  return () => dev && process.kill(-dev.pid, 'SIGTERM');
}

export function launch() {
  return chromium.launch({
    ...(existsSync(CHROMIUM) && { executablePath: CHROMIUM }),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
}

export async function openFarm(browser, { query = '', full = false, size = [480, 320], touch = false, live = false, log = () => {} } = {}) {
  const [width, height] = size;
  // (full graphics opens small and grows once on the farm: the page's first,
  // synchronous draw at a big size can keep the farm's login check waiting
  // past its time, and the welcome then asks to log in)
  const opening = full ? { width: Math.min(width, 480), height: Math.min(height, 320) } : { width, height };
  const context = await browser.newContext({ viewport: opening, ...(touch && { hasTouch: true, isMobile: true }), ...(existsSync(STATE) && { storageState: STATE }) });
  const page = await context.newPage();
  if (touch) await page.exposeFunction('__tap', (x, y) => page.touchscreen.tap(x, y));
  // Full graphics without a GPU: a frame takes a second or more, and the title
  // screen drawing them back to back starves the page, so the farm's login
  // check with the server times out (and the welcome asks to log in). No
  // frame at all until the welcome knows who we are (the first one compiles
  // every shader, seconds of work for a software GPU, which the login check
  // can't wait out); then, until on the farm, a frame a second at most.
  if (full) await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    const held = [];
    window.__harnessHold = true;
    const later = (f) => setTimeout(() => raf(f), 1000);
    const release = setInterval(() => {
      if (window.__harnessHold) return;
      clearInterval(release);
      held.splice(0).forEach(later);
    }, 100);
    window.requestAnimationFrame = (f) => (window.__harnessSlow === false ? raf(f) : window.__harnessHold ? held.push(f) : later(f));
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const q = [!full && 'lowgfx', query].filter(Boolean).join('&');
  await page.goto(`${BASE}/?${q}`);
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
  if (full) await page.evaluate(() => (window.__harnessHold = false));
  await farmButton.click();
  await page.waitForFunction(() => window.__game?.place === 'home' && window.__game.inGame);
  if (full) await page.evaluate(() => (window.__harnessSlow = false));
  if (opening.width !== width || opening.height !== height) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [width, height]);
  }
  if (!live) await page.evaluate(() => window.__game.step(0.5)); // (settle, then frozen)
  log('on the farm');
  return { context, page, errors };
}
