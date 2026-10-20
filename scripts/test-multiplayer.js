// `npm test`: the room's rules (shared/room.js, driven tick by tick) and the
// game server end to end (server/index.js, over real sockets).
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { Room } from '../shared/room.js';
import { C, S } from '../shared/protocol.js';
import { PROTOCOL_VERSION, HOLD_MS, CLOSE } from '../shared/constants.js';
import { SPOT_KINDS, RARE, TREE, woodFor } from '../shared/level.js';
import { islandFor, checkIsland, normalizeSeed, randomSeed, mulberry32 } from '../shared/worldgen.js';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n`, e);
    process.exitCode = 1;
  }
}

// ---------- The room, without a network ----------
function fakeConn() {
  const conn = {
    inbox: [],
    closed: null,
    send: (data) => conn.inbox.push(JSON.parse(data)),
    close: (code) => (conn.closed = code),
    last: (t) => conn.inbox.findLast((m) => m.t === t),
    all: (t) => conn.inbox.filter((m) => m.t === t),
  };
  return conn;
}
const join = (room, name, key = name) => {
  const conn = fakeConn();
  const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name, key });
  return { conn, p };
};
// the first spot of a kind (rooms are on the classic island unless told otherwise)
const spotOf = (kind) => islandFor('classic').spots.findIndex(([k]) => k === kind);
// tell the room we stand right on spot id
function standAt(room, who, id) {
  const { x, y, z } = room.spots[id];
  room.message(who.p, { t: C.STATE, x, y: Math.max(y, 0.8), z, yaw: 0, f: 1 });
}

console.log('islands');
await test('the classic island is as it was made, and sound', () => {
  const classic = islandFor('classic');
  assert.equal(classic.spots.length, 28);
  assert.deepEqual(checkIsland(classic), []);
});

await test('every seed grows a sound island: spots on land, reachable, not inside a cliff or a toadstool', () => {
  for (let i = 0; i < 300; i++) {
    const island = islandFor(randomSeed(mulberry32(i)) + i);
    assert.deepEqual(checkIsland(island), [], `seed ${island.seed}`);
    assert.ok(island.spots.length >= 25, `seed ${island.seed} has ${island.spots.length} spots`);
    for (const kind of Object.keys(SPOT_KINDS)) assert.ok(island.spots.some(([k]) => k === kind), `seed ${island.seed} has no ${kind}`);
  }
});

await test('a seed grows the same island every time; another seed another island', () => {
  const plain = (island) => JSON.stringify(island); // (the functions drop out)
  const a = plain(islandFor('mossy-cove-7'));
  assert.equal(plain(islandFor('mossy-cove-7', { cached: false })), a);
  assert.equal(plain(islandFor(' Mossy Cove 7 ')), a, 'typed differently, the same seed');
  assert.notEqual(plain(islandFor('mossy-cove-8')), a);
  assert.equal(normalizeSeed('  Hello,  World! '), 'hello-world');
  assert.equal(normalizeSeed('!!!'), '');
});

console.log('room');
await test('a room on a grown island has that island\'s spots and arrival', () => {
  const island = islandFor('dewy-glade-31');
  const room = new Room({ code: 'TEST10', seed: 'Dewy Glade 31' });
  const a = join(room, 'A');
  const w = a.conn.last(S.WELCOME);
  assert.equal(w.seed, 'dewy-glade-31');
  assert.deepEqual(w.spots.map(([, kind, x, y, z]) => [kind, x, y, z]), island.spots);
  assert.ok(Math.hypot(w.pos.x - island.spawn.x, w.pos.z - island.spawn.z) < 2.5, 'arrives in the stone circle');
  assert.equal(room.info().seed, 'dewy-glade-31');
});

await test('names are made unique and colors differ', () => {
  const room = new Room({ code: 'TEST01' });
  const a = join(room, 'Bob', 'k1');
  const b = join(room, 'Bob', 'k2');
  assert.equal(a.p.name, 'Bob');
  assert.equal(b.p.name, 'Bob#2');
  assert.notEqual(a.p.color, b.p.color);
});

await test('every spot starts with something on it, and the newcomer sees them all', () => {
  const room = new Room({ code: 'TEST02' });
  const a = join(room, 'A');
  const w = a.conn.last(S.WELCOME);
  assert.equal(w.spots.length, islandFor('classic').spots.length);
  assert.equal(w.seed, 'classic');
  assert.ok(w.spots.every(([, , , , , item, count]) => item && count >= 1));
});

await test('spots: whoever gets there first, checked against position, counted', () => {
  const room = new Room({ code: 'TEST03' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const ledge = spotOf('ledge');
  room.message(a.p, { t: C.TAKE, id: ledge });
  assert.equal(a.conn.last(S.DENY)?.id, ledge, 'too far');
  standAt(room, a, ledge);
  const { item, count } = room.spots[ledge];
  room.message(a.p, { t: C.TAKE, id: ledge });
  assert.deepEqual(b.conn.last(S.TAKEN), { t: S.TAKEN, id: ledge, by: a.p.id, item, count });
  standAt(room, b, ledge);
  room.message(b.p, { t: C.TAKE, id: ledge });
  assert.equal(b.conn.last(S.DENY)?.id, ledge, 'already taken');
  assert.equal(a.p.finds, 1);
  // A bush is gathered from beside it, not from on top of it
  const bush = spotOf('bush');
  const { x, z } = room.spots[bush];
  room.message(b.p, { t: C.STATE, x: x + 1.2, y: 0.8, z, yaw: 0, f: 1 });
  room.message(b.p, { t: C.TAKE, id: bush });
  assert.equal(b.conn.last(S.TAKEN).item, 'berries');
});

await test('trees: felled by whoever finishes first, next to it, not too fast; they grow back', () => {
  const room = new Room({ code: 'TEST11' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const at = (who, x, z) => room.message(who.p, { t: C.STATE, x, y: 0.8, z, yaw: 0, f: 1 });
  const tree = { id: 7, x: 10, z: -3 };
  at(a, 0, 0);
  room.message(a.p, { t: C.CHOP, ...tree });
  assert.equal(a.conn.last(S.CHOP_DENY)?.id, 7, 'too far');
  at(a, 11, -3);
  room.message(a.p, { t: C.CHOP, ...tree });
  const felled = b.conn.last(S.FELLED);
  assert.equal(felled.id, 7);
  assert.equal(felled.by, a.p.id);
  assert.ok(felled.count >= TREE.wood[0] && felled.count <= TREE.wood[1]);
  assert.equal(a.p.wood, felled.count);
  at(b, 9, -3);
  room.message(b.p, { t: C.CHOP, ...tree });
  assert.equal(b.conn.last(S.CHOP_DENY)?.id, 7, 'already down');
  room.message(a.p, { t: C.CHOP, id: 8, x: 11.5, z: -3 });
  assert.equal(a.conn.last(S.CHOP_DENY)?.id, 8, 'faster than an axe');
  room.message(a.p, { t: C.CHOP, id: -1, x: 11, z: -3 });
  room.message(a.p, { t: C.CHOP, id: 'x', x: 11, z: -3 });
  assert.equal(a.conn.all(S.CHOP_DENY).length, 4, 'nonsense ids are turned down');
  // a newcomer sees it down; then it grows back for everyone
  const c = join(room, 'C');
  assert.deepEqual(c.conn.last(S.WELCOME).felled, [7]);
  assert.equal(room.rosterList().find((p) => p.id === a.p.id).wood, felled.count);
  room.update(Date.now() + TREE.regrow[1] * 1000 + 100);
  assert.equal(b.conn.last(S.REGROWN)?.id, 7);
  assert.deepEqual(join(room, 'D').conn.last(S.WELCOME).felled, []);
});

await test('bigger trees give more wood, within the sizes trees come in', () => {
  const luck = (r) => () => r; // the same roll every time
  assert.equal(woodFor(1, luck(0)), TREE.wood[0]);
  assert.equal(woodFor(1, luck(0.99)), TREE.wood[1]);
  assert.ok(woodFor(1.6, luck(0.99)) > woodFor(1, luck(0.99)), 'a big old tree beats an ordinary one');
  assert.ok(woodFor(0.8, luck(0)) >= 1, 'even a little one gives some');
  assert.equal(woodFor(50, luck(0.99)), woodFor(TREE.size[1], luck(0.99)), 'no giants');
  assert.equal(woodFor(undefined, luck(0.5)), woodFor(1, luck(0.5)), 'no size: an ordinary tree');
  // and the room goes by the size the page says
  const room = new Room({ code: 'TEST12', rand: luck(0.99) });
  const a = join(room, 'A');
  room.message(a.p, { t: C.STATE, x: 11, y: 0.8, z: -3, yaw: 0, f: 1 });
  room.message(a.p, { t: C.CHOP, id: 3, x: 10, z: -3, size: 1.5 });
  assert.equal(a.conn.last(S.FELLED).count, woodFor(1.5, luck(0.99)));
});

await test('an emptied spot grows back after a while, with a fresh roll', () => {
  const room = new Room({ code: 'TEST04' });
  const a = join(room, 'A');
  const id = spotOf('mushroom');
  standAt(room, a, id);
  room.message(a.p, { t: C.TAKE, id });
  const now = Date.now();
  room.update(now + 5_000);
  assert.equal(room.spots[id].item, null, 'not yet');
  const [, slowest] = SPOT_KINDS.mushroom.regrow;
  room.update(now + slowest * 1000 + 100);
  assert.ok(room.spots[id].item);
  assert.equal(a.conn.last(S.SPOT).id, id);
});

await test('rare finds are announced when they turn up and when someone takes one', () => {
  const lucky = () => 0.97; // (the top of every loot table: the rare end)
  const room = new Room({ code: 'TEST05', rand: lucky });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const id = spotOf('ledge');
  assert.ok(RARE[room.spots[id].item]);
  assert.ok(room.info().rare > 0, 'the lobby list says rare finds are about');
  standAt(room, a, id);
  room.message(a.p, { t: C.TAKE, id });
  assert.match(b.conn.last(S.CHAT).text, /^A found (golden seeds|an old key)!$/);
  assert.equal(a.p.rares, 1);
  room.update(Date.now() + 120_000);
  assert.ok(b.conn.all(S.CHAT).some((m) => /sparkles up on a ledge/.test(m.text)));
});

await test('a dropped player gets their seat back; heading home gives it up', () => {
  const room = new Room({ code: 'TEST06' });
  const a = join(room, 'A', 'keyA');
  join(room, 'B', 'keyB');
  a.p.finds = 7;
  room.leave(a.p); // a reload
  assert.equal(room.players.size, 2, 'held');
  const back = join(room, 'A', 'keyA');
  assert.equal(back.p.id, a.p.id);
  assert.equal(back.p.finds, 7);
  assert.equal(back.conn.last(S.WELCOME).resumed, true);
  room.leave(back.p, { hold: false });
  assert.equal(room.players.size, 1);
  room.update(Date.now() + HOLD_MS + 1000);
  assert.equal(room.players.size, 1);
});

await test('a held seat is let go after a while', () => {
  const room = new Room({ code: 'TEST07' });
  const a = join(room, 'A');
  room.leave(a.p);
  room.update(Date.now() + HOLD_MS + 1000);
  assert.equal(room.players.size, 0);
  assert.ok(room.emptySince > 0, 'empty: the lobby list may close it');
});

await test('a full lobby turns people away', () => {
  const room = new Room({ code: 'TEST08', maxPlayers: 2 });
  join(room, 'A');
  join(room, 'B');
  const c = join(room, 'C');
  assert.equal(c.p, null);
  assert.equal(c.conn.closed, CLOSE.FULL);
});

await test('chat is cleaned and rate limited', () => {
  const room = new Room({ code: 'TEST09' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  room.message(a.p, { t: C.CHAT, text: '  hi\u0000 there  ' });
  assert.equal(b.conn.last(S.CHAT).text, 'hi there');
  for (let i = 0; i < 10; i++) room.message(a.p, { t: C.CHAT, text: `spam ${i}` });
  assert.ok(b.conn.all(S.CHAT).filter((m) => m.from === a.p.id).length <= 5);
});

// ---------- The server, over sockets ----------
console.log('server');
const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ready) => server.stdout.on('data', (d) => String(d).includes('game server') && ready()));

function client(code = '', key = `key${Math.random()}`) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws${code ? `?lobby=${code}` : ''}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters]) if (w.match(m)) waiters.splice(waiters.indexOf(w), 1) && w.done(m);
  });
  const closed = new Promise((done) => ws.on('close', (code) => done(code)));
  ws.on('open', () => ws.send(JSON.stringify({ t: C.JOIN, v: PROTOCOL_VERSION, name: 'Bot', key })));
  return {
    ws,
    inbox,
    closed,
    send: (m) => ws.send(JSON.stringify(m)),
    // the first message (already in, or still to come) that matches
    next(t, match = () => true, ms = 6000) {
      const m = (x) => x.t === t && match(x);
      const have = inbox.find(m);
      if (have) return Promise.resolve(have);
      return new Promise((done, fail) => {
        waiters.push({ match: m, done });
        setTimeout(() => fail(new Error(`no ${t} within ${ms} ms`)), ms);
      });
    },
  };
}

try {
  await test('open, list, look up; invite-only lobbies stay unlisted', async () => {
    const post = (body) => fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    const pub = await post({ name: 'Public one', maxPlayers: 4 });
    const priv = await post({ name: 'Secret', inviteOnly: true, seed: 'Sunny Knoll 5' });
    assert.equal(pub.code.length, 6);
    assert.equal(priv.code.length, 10);
    const { list } = await fetch(`${base}/api/lobbies`).then((r) => r.json());
    assert.ok(list.some((g) => g.code === pub.code));
    assert.ok(!list.some((g) => g.code === priv.code));
    assert.equal((await fetch(`${base}/api/lobbies/${priv.code}`).then((r) => r.json())).name, 'Secret');
    assert.equal((await fetch(`${base}/api/lobbies/ZZZZZZ`)).status, 404);
    // an island by its seed, or a fresh one
    assert.equal(priv.seed, 'sunny-knoll-5');
    assert.ok(pub.seed && pub.seed !== 'classic', 'a lobby opened without a seed gets a new island');
  });

  await test('two players: snapshots, taking a spot, chat; a reload resumes the seat', async () => {
    const { code } = await fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json());
    const a = client(code, 'reload-key');
    const b = client(code);
    const wa = await a.next(S.WELCOME);
    const wb = await b.next(S.WELCOME);
    assert.equal(wa.code, code);
    await a.next(S.SNAP, (m) => m.p.length === 2);

    const [id, , x, y, z] = wa.spots.find(([, kind]) => kind === 'meadow');
    a.send({ t: C.STATE, x, y: 0.8, z, yaw: 0, f: 1 });
    await new Promise((r) => setTimeout(r, 100));
    a.send({ t: C.TAKE, id });
    assert.equal((await b.next(S.TAKEN)).by, wa.id);

    a.send({ t: C.CHAT, text: 'hello' });
    assert.equal((await b.next(S.CHAT, (m) => m.from === wa.id)).text, 'hello');

    a.ws.close(1001); // a reload
    await a.closed;
    const again = client(code, 'reload-key');
    const w2 = await again.next(S.WELCOME);
    assert.equal(w2.resumed, true);
    assert.equal(w2.id, wa.id);
    assert.equal(w2.roster.find((p) => p.id === wa.id).finds, 1);
    again.ws.close(1000);
    b.ws.close(1000);
    assert.ok(wb.id !== wa.id);
  });

  await test('quick join finds a lobby; an unknown code is turned away', async () => {
    const q = client();
    assert.ok((await q.next(S.WELCOME)).code);
    q.ws.close(1000);
    const bad = client('ABCDEF');
    assert.equal(await bad.closed, CLOSE.NO_GAME);
  });
} finally {
  server.kill();
}

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
process.exit();
