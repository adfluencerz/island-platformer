import { chromium } from 'playwright-core';
for (const args of [[]]) {
  const b = await chromium.launch({ args, executablePath: '/tmp/claude-0/-home-user-island-platformer/3bb546e0-f6fc-5311-bd5d-17d912772252/scratchpad/chrome-proxy.sh' });
  const p = await (await b.newContext()).newPage();
  const t0 = Date.now();
  p.on('requestfailed', (r) => console.log('failed', Date.now() - t0, r.url().slice(0, 60), r.failure()?.errorText));
  await p.goto('http://localhost:5173/?', { timeout: 120000 });
  console.log(args, 'load', Date.now() - t0);
  await b.close();
}
