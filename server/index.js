// The game server: the lobbies' HTTP API, their sockets, and (after
// `npm run build`) the built client, all on one port.
//
//   GET  /api/lobbies          the public lobbies
//   GET  /api/lobbies/:code    one lobby, invite-only ones too (an invite link's card)
//   POST /api/lobbies          open one: { name, seed, inviteOnly, maxPlayers } -> its info
//   WS   /ws?lobby=CODE        be in that lobby; /ws alone is a quick join
//
//   POST /api/farms            a new farm: { save } -> { id, token, rev }
//   POST /api/farms/me/open    this page holds the farm now -> { save, rev }
//   PUT  /api/farms/me         { save } -> { rev } (409: it is open on another device)
//   POST /api/farms/me/pair    a pairing code for another device -> { code, expiresIn }
//   POST /api/farms/pair       { code } -> { id, token }: this device's own token
//   (/me: "Authorization: Bearer <id>.<token>", and every farm call names the
//   page in "X-Farm-Session"; see server/farms.js)
//
// In development Vite serves the client and proxies /api and /ws here
// (vite.config.js); `npm run dev` starts both.
//
// The lobbies are kept in data/lobbies.json (GAME_DATA=<file> for another
// file, GAME_DATA=off for none), so they outlive a restart (server/store.js),
// and the farms beside it, in farms/ (in memory only with GAME_DATA=off).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Lobby, CODE_RE } from './lobby.js';
import { Store } from './store.js';
import { Farms, MAX_SAVE } from './farms.js';
import { CLOSE, CLOSE_TEXT } from '../shared/constants.js';

const PORT = Number(process.env.PORT) || 3001;
const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const MAX_BODY = 4096;
const MAX_MSGS_PER_SEC = 120; // a client sends ~20 states a second plus the odd action
const DEV = process.env.GAME_DEV === '1'; // set by `npm run dev`: joining an unknown code opens it

const DATA = process.env.GAME_DATA || fileURLToPath(new URL('../data/lobbies.json', import.meta.url));

const lobby = new Lobby({ store: DATA === 'off' ? null : new Store(resolve(DATA)) });
const farms = new Farms({ dir: DATA === 'off' ? null : join(dirname(resolve(DATA)), 'farms') });

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req, limit = MAX_BODY) {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        // (the rest is read and dropped, so the answer gets through; then the connection closes)
        fail(new Error('too large'));
        chunks.length = 0;
        req.removeAllListeners('data');
        req.resume();
        req.on('end', () => req.socket.end());
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        done(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      } catch (e) {
        fail(e);
      }
    });
    req.on('error', fail);
  });
}

async function serveStatic(req, res, pathname) {
  // the built client; any path that is not a file is the page (?lobby= links)
  let file = normalize(join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST + sep)) return json(res, 400, { error: 'bad path' });
  try {
    if (!(await stat(file)).isFile()) file = join(DIST, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    const hashed = file.includes(`${DIST}/assets/`);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not built yet: run `npm run build`, or use `npm run dev` while developing.');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  if (path === '/api/lobbies' && req.method === 'GET') return json(res, 200, { list: lobby.list() });
  if (path === '/api/lobbies' && req.method === 'POST') {
    // JSON only, so a form on another site cannot open lobbies in a visitor's name
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: 'JSON only' });
    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: 'bad request' });
    }
    const made = lobby.make(body, req.socket.remoteAddress);
    if (made.error) return json(res, made.status, { error: made.error });
    return json(res, 200, made.info());
  }
  const one = path.match(/^\/api\/lobbies\/([A-Za-z0-9]+)$/);
  if (one && req.method === 'GET') {
    const room = lobby.find(one[1].toUpperCase());
    return room ? json(res, 200, room.info()) : json(res, 404, { error: 'no such lobby' });
  }
  if (path.startsWith('/api/farms')) return farmApi(req, res, path);
  if (path.startsWith('/api/')) return json(res, 404, { error: 'not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });
  return serveStatic(req, res, path);
});

// ---------- Farms ----------
async function farmApi(req, res, path) {
  const route = `${req.method} ${path}`;
  const routes = ['POST /api/farms', 'POST /api/farms/me/open', 'PUT /api/farms/me', 'POST /api/farms/me/pair', 'POST /api/farms/pair'];
  if (!routes.includes(route)) return json(res, 404, { error: 'not found' });
  // JSON only (as for lobbies), and the page that is asking
  if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: 'JSON only' });
  const session = String(req.headers['x-farm-session'] ?? '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(session)) return json(res, 400, { error: 'bad request' });
  let body;
  try {
    body = await readJson(req, MAX_SAVE + 1024);
  } catch {
    return json(res, 413, { error: 'That is too big for a farm.' });
  }
  const address = req.socket.remoteAddress;
  let out;
  if (route === 'POST /api/farms') out = farms.create(body?.save, session, address);
  else if (route === 'POST /api/farms/pair') out = farms.claim(body?.code, address);
  else {
    const farm = farms.auth(req.headers.authorization);
    if (!farm) return json(res, 401, { error: 'This device does not have that farm.' });
    if (route === 'POST /api/farms/me/open') out = farms.open(farm, session);
    else if (route === 'PUT /api/farms/me') out = farms.put(farm, session, body?.save);
    else out = farms.pair(farm);
  }
  if (out.error) return json(res, out.status, { error: out.error });
  return json(res, 200, out);
}

// ---------- Game sockets ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const code = (url.searchParams.get('lobby') || '').toUpperCase();
    let room = code ? (CODE_RE.test(code) ? lobby.find(code) : null) : lobby.quick();
    if (!room && code && DEV) room = lobby.makeWithCode(code);
    if (!room || room.error) {
      const why = room?.error ? CLOSE.ENDED : CLOSE.NO_GAME;
      return ws.close(why, CLOSE_TEXT[why]);
    }
    attach(ws, room);
  });
});

function attach(ws, room) {
  const conn = {
    send: (data) => ws.readyState === ws.OPEN && ws.send(data),
    close: (code, reason) => ws.close(code, reason),
  };
  let player = null;
  let count = 0;
  let windowStart = Date.now();
  // a socket that never says who it is does not get to hold on
  const joinTimer = setTimeout(() => !player && ws.close(1008, 'no join'), 10_000);

  ws.on('message', (data, isBinary) => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      count = 0;
    }
    if (++count > MAX_MSGS_PER_SEC || isBinary) return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!player) {
      player = room.join(conn, msg);
      if (player) clearTimeout(joinTimer);
    } else if (player.conn === conn) {
      room.message(player, msg);
    }
  });
  ws.on('close', (code) => {
    clearTimeout(joinTimer);
    // 1000 is the client's Leave; anything else (a reload, a drop) holds the seat
    if (player && player.conn === conn) room.leave(player, { hold: code !== 1000 });
  });
  ws.on('error', () => {});
}

server.listen(PORT, () => console.log(`game server on http://localhost:${PORT}`));

// Ctrl+C, or `node --watch` restarting us: keep the lobbies as they are now
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    lobby.flush();
    process.exit(0);
  });
}
