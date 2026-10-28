// `npm run gates`: every check a change must pass before it is pushed
// (docs/visuals/README.md), in order: one line each ("test: pass (41s)"),
// and for one that fails, the last 30 lines of what it printed. Exits 1 if
// any failed.
import { spawn } from 'node:child_process';

const STEP = 'g.step(2); return g.stats()';
const GATES = [
  ['test', ['test']],
  ['build', ['run', 'build']],
  ['browser-lowgfx', ['run', 'browser', '--silent', '--', '-e', STEP]],
  ['browser-full', ['run', 'browser', '--silent', '--', '--full', '-e', STEP]],
  ['shots-check', ['run', 'shots', '--', '--check']],
];

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => resolve({ ok: false, out: out + String(e) }));
    child.on('close', (code) => resolve({ ok: code === 0, out }));
  });
}

let failed = false;
for (const [name, args] of GATES) {
  const start = Date.now();
  const { ok, out } = await run(args);
  console.log(`${name}: ${ok ? 'pass' : 'fail'} (${Math.round((Date.now() - start) / 1000)}s)`);
  if (!ok) {
    failed = true;
    console.log(out.trimEnd().split('\n').slice(-30).map((line) => `  ${line}`).join('\n'));
  }
}
process.exit(failed ? 1 : 0);
