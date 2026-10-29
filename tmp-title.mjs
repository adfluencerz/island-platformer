// (scratch: not committed) the title shots alone, quickly
import { logger, startDev, launch, openFarm } from './scripts/lib/page.mjs';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-island-platformer/3bb546e0-f6fc-5311-bd5d-17d912772252/scratchpad';
const log = logger();
const stop = await startDev(log);
const browser = await launch();
const nc = browser.newContext.bind(browser);
browser.newContext = async (o) => { const c = await nc(o); c.setDefaultTimeout(180000); c.setDefaultNavigationTimeout(180000); return c; };
const which = (process.env.WHICH || 'desk,phone').split(',');
const extra = process.env.EXTRA || '';
const shootTitle = (name, [width, height]) => async (page) => {
  await page.evaluate(() => (window.__harnessHold = false));
  await page.setViewportSize({ width, height });
  await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [width, height]);
  const s = await page.evaluate(async (extra) => {
    const g = window.__game;
    g.step(0.5);
    if (extra) await eval(extra);
    g.draw();
    await document.fonts.ready;
    return g.stats();
  }, extra);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(name, JSON.stringify(s));
  await page.evaluate(() => window.__game.freeze(false));
};
try {
  if (which.includes('desk')) {
    const d = await openFarm(browser, { full: true, size: [960, 600], log, onTitle: shootTitle('title', [960, 600]) });
    if (which.includes('menu')) {
      await d.page.evaluate(() => {
        const g = window.__game;
        g.warp('plaza');
        g.dayNight.setTime(12);
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
        g.step(0.5);
        g.snapCamera();
        g.draw();
      });
      await d.page.screenshot({ path: `${OUT}/menu.png` });
    }
    if (d.errors.length) log('errors', d.errors);
    await d.context.close();
  }
  if (which.includes('phone')) {
    const p = await openFarm(browser, { full: true, size: [390, 844], touch: true, log, onTitle: shootTitle('title-phone', [390, 844]) });
    if (p.errors.length) log('errors', p.errors);
    await p.context.close();
  }
} catch (e) {
  console.error(e);
} finally {
  await browser.close();
  stop();
}
