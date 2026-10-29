// `npm run shots -- [--tier low|medium|high] [--check]`: fourteen fixed screenshots
// of the game at full graphics, to judge its look by (docs/visuals/), with
// what the renderer drew for each, and a contact sheet of them all:
//
//   shots/NAME.png      each shot (960x600; the phone's 390x844, touch)
//   shots/stats.json    { NAME: { calls, triangles, programs, geometries,
//                       textures, tier, pixelRatio } }, counted after its frame
//   shots/contact.png   all of them on one page, labelled
//
//   --tier T   draw at that graphics tier (?gfx=T); without, each page's own
//              (high on the desktop, medium on the phone)
//   --check    fail (exit 1) when plaza-noon or a phone shot is over its
//              tier's budgets in docs/visuals/README.md (its `budgets` comment)
//
// One dev server and one browser for all of them (scripts/lib/page.mjs); a
// second context for the phone. Each shot sets the scene with window.__game
// (warp, the time of day), steps the game on, then draws once: without a GPU
// a full frame takes a few seconds.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { weatherAt } from '../shared/weather.js';
import { BOSS_IDS, arenaStart } from '../shared/bosses.js';
import { dungeonStart } from '../shared/dungeons.js';
import { logger, startDev, launch, openFarm } from './lib/page.mjs';

const OUT = 'shots';
const SIZE = [960, 600];
const PHONE = [390, 844];

const args = process.argv.slice(2);
const opts = { tier: null, check: false };
while (args.length) {
  const a = args.shift();
  if (a === '--tier') opts.tier = args.shift();
  else if (a === '--check') opts.check = true;
  else throw new Error(`unknown option ${a}`);
}
if (opts.tier && !['low', 'medium', 'high'].includes(opts.tier)) throw new Error('--tier is low, medium or high');
const query = opts.tier ? `gfx=${opts.tier}` : '';

// an hour of the farm's clock with a good shower on (to force the rain with)
let rainy = 0;
for (let h = 0.5; !rainy; h += 0.5) if (weatherAt(h)?.kind === 'rain' && weatherAt(h).amount >= 1) rainy = h;

// Each shot: what to do in the page (g: window.__game) before it is drawn
const SHOTS = [
  ['plaza-morning', (g) => (g.warp('plaza'), g.dayNight.setTime(8))],
  ['plaza-noon', (g) => (g.warp('plaza'), g.dayNight.setTime(12))],
  ['forest-noon', (g) => (g.warp('forest'), g.dayNight.setTime(12))],
  ['shore-noon', (g) => (g.warp({ x: -66, z: 4 }), g.snapCamera(), g.dayNight.setTime(12))], // (the sea and the cliffs)
  ['lake-sunset', (g) => (g.warp('lake'), g.dayNight.setTime(18.5))],
  ['night-lamps', (g) => (g.warp('house'), g.dayNight.setTime(21.5))],
  ['rain-noon', (g, { rainy }) => {
    g.warp('plaza');
    g.dayNight.setTime(12);
    const update = g.weather.update;
    g.weather.update = (dt, o) => update(dt, { ...o, hours: rainy });
    g.step(2); // (the sky clouds over)
    g.__restoreWeather = () => (g.weather.update = update);
  }],
  ['dungeon', (g) => (g.warp('dungeon'), g.dayNight.setTime(12), g.step(2))], // (the dark settles in: the light goes underground over a second or so)
  ['foes', (g, { foesAt }) => (g.warp(foesAt), g.dayNight.setTime(12), g.step(2))], // (the bog's first room: its frogs awake and coming on)
  ['boss', (g, { bossAt }) => (g.warp(bossAt), g.dayNight.setTime(12), g.step(3))], // (the lion's hall, a few steps in: it wakes as we come)
  ['split-2', async (g) => {
    g.warp('plaza');
    g.dayNight.setTime(12);
    const seat = g.addSeat(1);
    await g.seatFarmer(seat, g.newGuest('Second', 0x4a90d9));
    g.layout();
  }],
  ['lobby', async (g) => {
    for (const seat of [...g.seats].slice(1)) g.dropSeat(seat);
    g.joinLobby({ name: 'shots', code: 'SNAPSZ' });
    for (let i = 0; i < 300 && g.place !== 'lobby'; i++) await new Promise((r) => setTimeout(r, 100));
    if (g.place !== 'lobby') throw new Error('never got into the lobby');
    g.dayNight.setTime(12);
  }],
];

// On the phone page (390x844, touch, its own tier: medium)
const PHONE_SHOTS = [
  ['phone', (g) => (g.warp('plaza'), g.dayNight.setTime(12))],
  ['phone-forest-dusk', (g) => (g.warp('forest'), g.dayNight.setTime(18.5), g.snapCamera())], // (the user's own phone screenshot: a forest at 6:20 pm)
];

const log = logger();
mkdirSync(OUT, { recursive: true });
const stopDev = await startDev(log);
const browser = await launch();
const stats = {};
const errors = [];
let exitCode = 0;

// set the scene, step, draw once, screenshot, count
async function shoot(page, name, set) {
  await page.evaluate(`(async (g, ctx) => { await (${set.toString()})(g, ctx); })(window.__game, ${JSON.stringify({ rainy, foesAt: dungeonStart(BOSS_IDS[4]), bossAt: { ...arenaStart(BOSS_IDS[1]), z: arenaStart(BOSS_IDS[1]).z - 3 } })})`);
  stats[name] = await page.evaluate(() => {
    const g = window.__game;
    g.step(0.5);
    g.snapCamera();
    g.draw();
    g.__restoreWeather?.();
    delete g.__restoreWeather;
    return g.stats();
  });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(name, JSON.stringify(stats[name]));
}

try {
  const desk = await openFarm(browser, { query, full: true, size: SIZE, log });
  for (const [name, set] of SHOTS) await shoot(desk.page, name, set);
  errors.push(...desk.errors.map((e) => `desktop: ${e}`));
  await desk.context.close();

  const phone = await openFarm(browser, { query, full: true, size: PHONE, touch: true, log });
  for (const [name, set] of PHONE_SHOTS) await shoot(phone.page, name, set);
  errors.push(...phone.errors.map((e) => `phone: ${e}`));

  writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 2) + '\n');

  // ---- the contact sheet: a blank page of the shots, labelled ----
  const names = [...SHOTS, ...PHONE_SHOTS].map(([n]) => n);
  const tall = new Set(PHONE_SHOTS.map(([n]) => n));
  const cell = (n) => {
    const s = stats[n];
    const src = `data:image/png;base64,${readFileSync(`${OUT}/${n}.png`).toString('base64')}`;
    return `<figure${tall.has(n) ? ' class="tall"' : ''}><img src="${src}"><figcaption><b>${n}</b> ${s.tier} · ${s.calls} calls · ${(s.triangles / 1e3).toFixed(0)}k tris · ${s.programs} programs</figcaption></figure>`;
  };
  const sheet = await phone.context.newPage();
  await sheet.setViewportSize({ width: 1500, height: 800 });
  await sheet.setContent(`<!doctype html><style>
    body { margin: 0; padding: 8px; background: #222; color: #eee; font: 13px system-ui, sans-serif; }
    main { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; align-items: start; }
    figure { margin: 0; } img { width: 100%; display: block; } figcaption { padding: 3px 0; }
    figure.tall img { width: auto; max-height: 360px; }
  </style><main>${names.map(cell).join('')}</main>`);
  await sheet.screenshot({ path: `${OUT}/contact.png`, fullPage: true });
  log(`contact sheet: ${OUT}/contact.png`);

  if (errors.length) {
    console.error('page errors:\n  ' + errors.join('\n  '));
    exitCode = 1;
  }

  // ---- the budgets (docs/visuals/README.md): plaza-noon and the phone, each at its tier ----
  if (opts.check) {
    const readme = readFileSync('docs/visuals/README.md', 'utf8');
    const budgets = JSON.parse(readme.match(/<!-- budgets (\{.*\}) -->/)[1]);
    const over = ['plaza-noon', ...PHONE_SHOTS.map(([n]) => n)].flatMap((name) => {
      const s = stats[name];
      const b = budgets[s.tier];
      return [
        s.calls > b.calls && `${name} calls ${s.calls} > ${b.calls}`,
        s.programs > b.programs && `${name} programs ${s.programs} > ${b.programs}`,
        s.triangles > b.triangles && `${name} triangles ${s.triangles} > ${b.triangles}`,
      ].map((o) => o && `${o} (${s.tier})`);
    }).filter(Boolean);
    if (over.length) {
      console.error(`over budget: ${over.join(', ')}`);
      exitCode = 1;
    } else log('plaza-noon and the phone are within the budgets');
  }
} catch (e) {
  console.error(e.stack || e.message);
  exitCode = 1;
} finally {
  await browser.close();
  stopDev();
  log('done');
}
process.exit(exitCode);
