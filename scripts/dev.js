// `npm run dev`: the game server (restarted when its code changes) and Vite,
// side by side in one terminal. Ctrl+C stops both.
//
// Vite gets --strictPort: if something else (an old Vite without the proxy,
// say) holds its port, it stops with an error instead of quietly moving to the
// next port, where the page at the usual address would never reach the server.
import { spawn } from 'node:child_process';

// GAME_PORT and VITE_PORT pick the ports (3001 and 5173 by default), so several
// checkouts can run side by side; point BROWSER_URL at the Vite port for the
// browser harness (scripts/lib/page.mjs).
const GAME_PORT = process.env.GAME_PORT || '3001';
const env = { ...process.env, GAME_PORT };

const procs = [
  spawn(process.execPath, ['--watch-path=server', '--watch-path=shared', 'server/index.js'], {
    stdio: 'inherit',
    env: { ...env, PORT: GAME_PORT, GAME_DEV: '1' },
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--strictPort', ...(process.env.VITE_PORT ? ['--port', process.env.VITE_PORT] : [])], { stdio: 'inherit', env }),
];

const stop = () => {
  for (const p of procs) p.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
