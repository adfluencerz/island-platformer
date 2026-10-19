import { defineConfig } from 'vite';

// The game server (server/index.js) runs beside Vite in development; the page
// talks to it through these proxies, so it is one origin either way.
const GAME_SERVER = `http://localhost:${process.env.GAME_PORT || 3001}`;

export default defineConfig({
  server: {
    host: true, // reachable from other machines on the network, for testing with friends
    proxy: {
      '/api': GAME_SERVER,
      '/ws': { target: GAME_SERVER, ws: true },
    },
  },
});
