// `npm test`: the room's rules (shared/room.js, driven tick by tick) and the
// game server end to end (server/index.js, over real sockets).
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import WebSocket from 'ws';
import { Room } from '../shared/room.js';
import { Lobby } from '../server/lobby.js';
import { Store } from '../server/store.js';
import { Farms, normalizePairCode } from '../server/farms.js';
import { FarmRooms, FarmRoom } from '../server/farmroom.js';
import { C, S, farmNameKey, pinProblem } from '../shared/protocol.js';
import { PROTOCOL_VERSION, HOLD_MS, CLOSE, PLAYER_COLORS } from '../shared/constants.js';
import { SPOT_KINDS, RARE, TREE, ROCK, DROP_MS, woodFor, stoneFor, mostStone } from '../shared/level.js';
import { islandFor, checkIsland, normalizeSeed, randomSeed, mulberry32, genOf, CURRENT_GEN } from '../shared/worldgen.js';
import { fingerprint } from './seed-fingerprint.js';

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

// Old seeds must grow the very island they always did, whatever the world
// learns later. Never change these numbers: grow the world behind a newer
// generation instead (shared/worldgen.js, genOf).
const GEN_1_SEEDS = {
  'classic': 2693436923,
  'mossy-cove-7': 3115431686,
  'dewy-glade-31': 693153227,
  'sunny-knoll-5': 1916120231,
  'golden-fen-0': 1743048432,
  'quiet-ridge-88': 48222456,
  'willow-isle-12': 2930347281,
  'pebble-nook-64': 2968322765,
  'honey-grove-3': 2807543281,
  'amber-bluff-50': 1860705309,
  'fern-dell-77': 3709163302,
  'velvet-shore-19': 2854819371,
  'my-island': 1496012741,
};
await test('old seeds (generation 1) grow exactly the islands they always did', () => {
  for (const [seed, print] of Object.entries(GEN_1_SEEDS)) {
    assert.equal(genOf(seed), 1, seed);
    assert.equal(fingerprint(seed), print, `the island of "${seed}" changed`);
    assert.ok(!islandFor(seed).heath && !islandFor(seed).spots.some(([k]) => k === 'heather'), `"${seed}" grew generation 2 things`);
  }
});

await test('new seeds carry their generation, and grow what it added', () => {
  assert.equal(genOf('dewy-glade-31-v2'), 2);
  assert.equal(genOf('dewy-glade-31-v25'), 1);
  assert.equal(genOf('classic'), 1);
  assert.match(randomSeed(mulberry32(1)), new RegExp(`-v${CURRENT_GEN}$`));
  assert.equal(normalizeSeed('Dewy Glade 31 V2'), 'dewy-glade-31-v2');
  assert.ok(normalizeSeed(randomSeed(() => 0.999)).endsWith(`-v${CURRENT_GEN}`), 'the longest seed still fits its marker');
  let heaths = 0;
  for (let i = 0; i < 40; i++) {
    const seed = `${randomSeed(mulberry32(i))}`;
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    if (island.heath) {
      heaths++;
      assert.ok(island.spots.filter(([k]) => k === 'heather').length >= 3, seed);
      assert.ok(island.spots.filter(([k]) => k === 'heather').every(([, x, , z]) => island.groundAt(x, z) === 'heath'), `${seed}: heather grows on the heath`);
    }
    // the same island with the marker taken off is the old kind, without the heath
    assert.ok(!islandFor(seed.replace(/-v2$/, '-v1')).heath);
  }
  assert.ok(heaths >= 30, `most gen 2 islands have a heath (${heaths} of 40)`);
});

await test('every seed grows a sound island: spots on land, reachable, not inside a cliff or a toadstool', () => {
  for (let i = 0; i < 300; i++) {
    const island = islandFor(randomSeed(mulberry32(i)).replace(/-v2$/, '') + i);
    assert.deepEqual(checkIsland(island), [], `seed ${island.seed}`);
    assert.ok(island.spots.length >= 25, `seed ${island.seed} has ${island.spots.length} spots`);
    for (const kind of Object.keys(SPOT_KINDS).filter((k) => k !== 'heather')) assert.ok(island.spots.some(([k]) => k === kind), `seed ${island.seed} has no ${kind}`);
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

await test('rocks: broken by whoever finishes first, next to it, not too fast; a new one surfaces', () => {
  const room = new Room({ code: 'TEST13' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const at = (who, x, z) => room.message(who.p, { t: C.STATE, x, y: 0.8, z, yaw: 0, f: 1 });
  const rock = { id: 4, x: 6, z: 2, size: 0.4 };
  at(a, 0, 0);
  room.message(a.p, { t: C.MINE, ...rock });
  assert.equal(a.conn.last(S.MINE_DENY)?.id, 4, 'too far');
  at(a, 7, 2);
  room.message(a.p, { t: C.MINE, ...rock });
  const mined = b.conn.last(S.MINED);
  assert.equal(mined.id, 4);
  assert.equal(mined.by, a.p.id);
  assert.ok(mined.count >= ROCK.stone[0] && mined.count <= ROCK.stone[1]);
  assert.equal(a.p.stone, mined.count);
  at(b, 6, 3);
  room.message(b.p, { t: C.MINE, ...rock });
  assert.equal(b.conn.last(S.MINE_DENY)?.id, 4, 'already broken');
  room.message(a.p, { t: C.MINE, id: 5, x: 7.5, z: 2 });
  assert.equal(a.conn.last(S.MINE_DENY)?.id, 5, 'faster than a pickaxe');
  room.message(a.p, { t: C.MINE, id: -1, x: 7, z: 2 });
  room.message(a.p, { t: C.MINE, id: 'x', x: 7, z: 2 });
  assert.equal(a.conn.all(S.MINE_DENY).length, 4, 'nonsense ids are turned down');
  assert.deepEqual(join(room, 'C').conn.last(S.WELCOME).mined, [4]);
  assert.equal(room.rosterList().find((p) => p.id === a.p.id).stone, mined.count);
  room.update(Date.now() + ROCK.regrow[1] * 1000 + 100);
  assert.equal(b.conn.last(S.RESURFACED)?.id, 4);
  assert.deepEqual(join(room, 'D').conn.last(S.WELCOME).mined, []);
});

await test('bopping: the farmer in front, in reach, knocked back; what they gathered drops, for anyone to pick up', () => {
  const room = new Room({ code: 'TEST15' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const { x: sx, z: sz } = room.island.spawn;
  const at = (who, x, z, yaw = 0) => room.message(who.p, { t: C.STATE, x: sx + x, y: 0.8, z: sz + z, yaw, f: 1 });
  at(a, 8, 0, 0); // facing +z
  at(b, 8, 1.2);
  b.p.bag = { wood: 3, golden_seeds: 1 };
  room.message(a.p, { t: C.BOP, weapon: 'spoon', yaw: 0 });
  assert.equal(b.conn.last(S.BOPPED), undefined, 'not a weapon');
  room.message(a.p, { t: C.BOP, weapon: 'wooden_sword', yaw: Math.PI });
  assert.equal(b.conn.last(S.BOPPED), undefined, 'facing the other way');
  a.p.bopAt = 0;
  room.message(a.p, { t: C.BOP, weapon: 'wooden_sword', yaw: 0 });
  const bop = b.conn.last(S.BOPPED);
  assert.deepEqual([bop.by, bop.id, bop.dz, bop.drop], [a.p.id, b.p.id, 1, ['wood', 1]]);
  assert.equal(b.p.bag.wood, 2);
  const drop = a.conn.last(S.DROP);
  assert.deepEqual([drop.item, drop.count], ['wood', 1]);
  room.message(a.p, { t: C.BOP, weapon: 'wooden_sword', yaw: 0 });
  assert.equal(b.conn.all(S.BOPPED).length, 1, 'not again so soon');
  // the drop: too far for A, B walks into it and gets it back (to be knocked loose again)
  at(a, 12, 0);
  room.message(a.p, { t: C.PICKUP, id: drop.id });
  assert.equal(a.conn.last(S.DROP_DENY).id, drop.id);
  room.message(b.p, { t: C.PICKUP, id: drop.id });
  assert.deepEqual([a.conn.last(S.PICKED).by, b.p.bag.wood], [b.p.id, 3]);
  room.message(a.p, { t: C.PICKUP, id: drop.id });
  assert.equal(a.conn.all(S.DROP_DENY).length, 2, 'gone');
  // rare finds stay put; the stone circle is for resting
  at(a, 8, 0);
  b.p.bag = { golden_seeds: 1 };
  b.p.boppedAt = 0;
  a.p.bopAt = 0;
  room.message(a.p, { t: C.BOP, weapon: 'mallet', yaw: 0 });
  assert.equal(b.conn.last(S.BOPPED).drop, null);
  at(a, 0, 0);
  at(b, 0, 1.2);
  b.p.boppedAt = 0;
  a.p.bopAt = 0;
  room.message(a.p, { t: C.BOP, weapon: 'mallet', yaw: 0 });
  assert.equal(b.conn.all(S.BOPPED).length, 2, 'nobody is bopped by the spawn');
  // drops fade, and a newcomer sees the ones still about
  at(a, 8, 0);
  at(b, 8, 1.2);
  b.p.bag = { stone: 5 };
  b.p.boppedAt = 0;
  a.p.bopAt = 0;
  room.message(a.p, { t: C.BOP, weapon: 'mallet', yaw: 0 });
  assert.deepEqual(b.conn.last(S.BOPPED).drop, ['stone', 2]);
  assert.equal(join(room, 'C').conn.last(S.WELCOME).drops.length, 1);
  room.update(Date.now() + DROP_MS + 100);
  assert.equal(a.conn.last(S.PICKED).by, 0);
  assert.equal(room.drops.size, 0);
});

await test('bigger rocks give more stone, within the sizes rocks come in', () => {
  const luck = (r) => () => r;
  assert.equal(stoneFor(ROCK.per, luck(0)), ROCK.stone[0]);
  assert.equal(stoneFor(ROCK.per, luck(0.99)), ROCK.stone[1]);
  assert.ok(stoneFor(1.1, luck(0)) > stoneFor(ROCK.per, luck(0.99)), 'a boulder beats a stone');
  assert.equal(stoneFor(0.15, luck(0)), 1, 'even a pebble gives one');
  assert.equal(stoneFor(40, luck(0.99)), stoneFor(ROCK.size[1], luck(0.99)), 'no mountains');
  assert.ok(mostStone(1.1) >= stoneFor(1.1, luck(0.99)));
  const room = new Room({ code: 'TEST14', rand: luck(0.99) });
  const a = join(room, 'A');
  room.message(a.p, { t: C.STATE, x: 7, y: 0.8, z: 2, yaw: 0, f: 1 });
  room.message(a.p, { t: C.MINE, id: 2, x: 6.2, z: 2, size: 1 });
  assert.equal(a.conn.last(S.MINED).count, stoneFor(1, luck(0.99)));
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

console.log('keeping lobbies');
await test('a saved room comes back as it was: spots, felled trees, broken rocks, clock, seats', () => {
  const room = new Room({ code: 'SAVE01', name: 'Kept', seed: 'mossy-cove-7', inviteOnly: true, maxPlayers: 4 });
  const a = join(room, 'A', 'keyA');
  join(room, 'B', 'keyB');
  const id = room.spots.findIndex((s) => s.kind === 'meadow');
  standAt(room, a, id);
  room.message(a.p, { t: C.TAKE, id });
  room.message(a.p, { t: C.STATE, x: 11, y: 0.8, z: -3, yaw: 0, f: 1 });
  room.message(a.p, { t: C.CHOP, id: 5, x: 10, z: -3 });
  room.message(a.p, { t: C.MINE, id: 9, x: 10.5, z: -2, size: 0.5 });
  room.createdAt -= 3_600_000; // an hour in
  assert.ok(room.changed);

  const save = JSON.parse(JSON.stringify(room.toSave())); // (as it is on disk)
  const holdUntil = Date.now() + 60_000;
  const back = Room.fromSave(save, { holdUntil });
  assert.equal(back.changed, false);
  assert.deepEqual([back.code, back.name, back.seed, back.inviteOnly, back.maxPlayers], ['SAVE01', 'Kept', 'mossy-cove-7', true, 4]);
  assert.equal(back.createdAt, room.createdAt);
  assert.deepEqual(back.spots, room.spots);
  assert.deepEqual([...back.felled], [...room.felled]);
  assert.deepEqual([...back.mined], [...room.mined]);
  assert.equal(back.mined.size, 1);
  assert.deepEqual(back.rosterList(), room.rosterList().map((p) => ({ ...p, away: true })));
  assert.ok(back.nextId > 2);
  // the seats are held, for their players to come back to
  const again = join(back, 'A', 'keyA');
  assert.equal(again.p.id, a.p.id);
  assert.equal(again.conn.last(S.WELCOME).resumed, true);
  assert.equal(again.p.finds, 1);
  assert.ok(join(back, 'C').p.id >= 3, 'a newcomer gets an id of their own');
  back.update(holdUntil + 1000);
  assert.deepEqual([...back.players.values()].map((p) => p.name).sort(), ['A', 'C'], 'B never came back');
});

await test('a save from before a change keeps only what still fits', () => {
  const room = new Room({ code: 'SAVE02', seed: 'classic' });
  const save = room.toSave();
  const ledge = save.spots.findIndex(([, kind]) => kind === 'ledge');
  const bush = save.spots.findIndex(([, kind]) => kind === 'bush');
  const meadow = save.spots.findIndex(([, kind]) => kind === 'meadow');
  const mushroom = save.spots.findIndex(([, kind]) => kind === 'mushroom');
  save.spots[ledge][4] = 'pineapple'; // an item that no longer turns up there
  save.spots[bush][3] += 5; // the spot moved
  save.spots[meadow] = [meadow, 'meadow', save.spots[meadow][2], save.spots[meadow][3], 'coin', 99, 0];
  save.spots[mushroom] = [mushroom, 'mushroom', save.spots[mushroom][2], save.spots[mushroom][3], null, 0, Date.now() + 5000];
  save.spots.push([9999, 'ledge', 0, 0, 'gem', 1, 0]); // a spot the island lost
  save.felled = [[3, Date.now() + 1000], [-1, 0], ['x', 0], [5000, 0]];
  save.seats = [{ id: 1, key: 'k', name: 'A\u0000b', color: 123, finds: -4 }, { id: 1, key: 'k2' }, { id: 2 }];
  const back = Room.fromSave(save);
  assert.ok(back.spots[ledge].item !== 'pineapple' && back.spots[ledge].item, 'rolled afresh');
  assert.equal(back.spots[meadow].count, 1, 'no more than a spot can hold');
  assert.equal(back.spots[mushroom].item, null, 'still growing back');
  assert.equal(back.spots.length, islandFor('classic').spots.length);
  assert.deepEqual([...back.felled.keys()], [3]);
  assert.deepEqual(back.rosterList().map(({ name, color, finds }) => [name, color, finds]), [['Ab', PLAYER_COLORS[0], 0]]);
});

await test('an empty lobby goes dormant, wakes by its code, and is let go after a week', () => {
  const kept = [];
  const lobby = new Lobby({ log: () => {}, store: { load: () => null, save: (d) => kept.push(d) } });
  const room = lobby.make({ name: 'Sleepy', seed: 'dewy glade 31' });
  const a = join(room, 'A');
  const id = room.spots.findIndex((s) => s.kind === 'ledge');
  standAt(room, a, id);
  room.message(a.p, { t: C.TAKE, id });
  room.leave(a.p, { hold: false });
  room.emptySince -= 91_000;
  lobby.reap();
  assert.equal(lobby.rooms.size, 0);
  assert.deepEqual(lobby.list().map((l) => [l.code, l.quiet, l.players]), [[room.code, true, 0]], 'listed as quiet while dormant');
  const hidden = lobby.make({ name: 'Secret', inviteOnly: true });
  hidden.emptySince -= 91_000;
  lobby.reap();
  assert.equal(lobby.list().length, 1, 'an invite-only one stays unlisted, dormant too');
  lobby.dormant.delete(hidden.code);
  assert.equal(room.timer, null, 'stopped');
  const woke = lobby.find(room.code);
  assert.ok(woke && woke !== room);
  assert.equal(woke.seed, 'dewy-glade-31');
  assert.equal(woke.spots[id].item, null, 'what was taken is still gone');
  assert.equal(lobby.list().length, 1);
  woke.emptySince -= 91_000;
  lobby.reap();
  lobby.dormant.get(room.code).since -= 8 * 24 * 3600_000;
  lobby.reap();
  assert.equal(lobby.find(room.code), null);
  lobby.save();
  assert.deepEqual(kept.at(-1).dormant, []);
  assert.deepEqual(kept.at(-1).rooms, []);
  woke.close();
});

await test('the store writes atomically and sets aside a file it cannot read', () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'lobbies-'));
  try {
    const path = joinPath(dir, 'lobbies.json');
    const store = new Store(path, { log: () => {} });
    assert.equal(store.load(), null);
    store.save({ rooms: [1] });
    store.save({ rooms: [2] });
    assert.deepEqual(store.load().rooms, [2]);
    assert.deepEqual(JSON.parse(readFileSync(`${path}.bak`, 'utf8')).rooms, [1], 'the last good one is the .bak');
    writeFileSync(path, '{"v":1,"rooms":[3'); // a crash halfway
    assert.deepEqual(store.load().rooms, [1], 'the .bak is read');
    assert.ok(readdirSync(dir).some((f) => /^lobbies\.broken-\d+\.json$/.test(f)), 'the broken file is set aside');
    writeFileSync(path, '{"v":99}');
    store.load();
    assert.ok(readdirSync(dir).filter((f) => f.includes('broken')).length >= 2, 'a newer server\'s file is not written over');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

console.log('farms');
const aSave = (gold = 0) => ({ v: 3, farm: null, backpack: { slots: [], gold, selected: 0 } });
const bearer = ({ id, token }) => `Bearer ${id}.${token}`;

await test('a farm is made from a save, kept on disk with only its token\'s hash, and read back', () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'farms-'));
  try {
    const farms = new Farms({ dir, log: () => {} });
    const made = farms.create(aSave(5), 'session-one');
    assert.match(made.id, /^[a-f0-9]{16}$/);
    assert.equal(made.rev, 1);
    const text = readFileSync(joinPath(dir, `${made.id}.json`), 'utf8');
    assert.ok(!text.includes(made.token), 'the token itself is not kept');
    const again = new Farms({ dir, log: () => {} }); // (after a restart)
    const farm = again.auth(bearer(made));
    assert.equal(farm?.save.backpack.gold, 5);
    assert.equal(again.auth(bearer({ id: made.id, token: 'not-the-token-at-all' })), null);
    assert.equal(again.auth(`Bearer ../../etc.${made.token}`), null);
    assert.equal(again.auth(undefined), null);
    assert.equal(farms.create({ v: 'x' }, 'session-one').status, 400, 'not a save');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

await test('the device that opened the farm last holds it', () => {
  const farms = new Farms({ log: () => {} });
  const made = farms.create(aSave(1), 'laptop-page');
  const farm = farms.auth(bearer(made));
  assert.equal(farms.put(farm, 'laptop-page', aSave(2)).rev, 2);
  // the phone opens it: it gets what the laptop saved, and holds it now
  assert.deepEqual(farms.open(farm, 'phone-page'), { save: aSave(2), rev: 2, roomRev: 0, helpers: 0, name: '' });
  assert.equal(farms.put(farm, 'laptop-page', aSave(99)).status, 409, 'the laptop\'s tab is too late');
  assert.equal(farms.put(farm, 'phone-page', aSave(3)).rev, 3);
  assert.equal(farm.save.backpack.gold, 3);
});

await test('a pairing code gives another device a token of its own, once, for a while', () => {
  const farms = new Farms({ log: () => {} });
  const made = farms.create(aSave(7), 'p1');
  const farm = farms.auth(bearer(made));
  const { code, expiresIn } = farms.pair(farm);
  assert.equal(code.length, 6);
  assert.equal(expiresIn, 600);
  assert.equal(normalizePairCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `), code);
  const phone = farms.claim(`${code.slice(0, 3)}-${code.slice(3)}`);
  assert.equal(phone.id, made.id);
  assert.notEqual(phone.token, made.token);
  assert.equal(farms.auth(bearer(phone)), farm);
  assert.equal(farms.auth(bearer(made)), farm, 'the first device still has it');
  assert.equal(farms.claim(code).status, 404, 'only once');
  const late = farms.pair(farm).code;
  farms.pairs.get(late).until = Date.now() - 1;
  assert.equal(farms.claim(late).status, 404, 'not after it ran out');
  const first = farms.pair(farm).code;
  const second = farms.pair(farm).code;
  assert.equal(farms.claim(first).status, 404, 'a new code undoes the last');
  assert.equal(farms.claim(second).id, made.id);
  // guessing is slowed down
  const tries = Array.from({ length: 8 }, () => farms.claim('ZZZZZZ', '10.0.0.9').status);
  assert.ok(tries.includes(429));
});

await test('a farm\'s name is one of a kind, whatever the capitals and punctuation; easy PINs are refused', async () => {
  assert.equal(farmNameKey('Sunny Acres!'), farmNameKey('  sunny-ACRES '));
  assert.equal(farmNameKey('Café Ölmühle'), 'cafe-olmuhle');
  assert.equal(farmNameKey('a!'), '');
  for (const easy of ['000000', '123456', '987654', '890123']) assert.ok(pinProblem(easy), easy);
  assert.ok(pinProblem('12345') && pinProblem('12a456') && pinProblem(undefined));
  assert.equal(pinProblem('482913'), '');

  const farms = new Farms({ log: () => {} });
  const a = farms.auth(bearer(farms.create(aSave(1), 'pa')));
  const b = farms.auth(bearer(farms.create(aSave(2), 'pb')));
  assert.equal((await farms.setRecovery(a, { name: 'Sunny Acres', pin: '111111' })).status, 400, 'too easy');
  assert.equal((await farms.setRecovery(a, { name: 'Sunny Acres' })).status, 400, 'a first PIN is needed');
  assert.equal((await farms.setRecovery(a, { name: '!!', pin: '482913' })).status, 400, 'no name');
  assert.deepEqual(await farms.setRecovery(a, { name: '  Sunny   Acres ', pin: '482913' }), { name: 'Sunny Acres' });
  assert.equal((await farms.setRecovery(b, { name: 'sunny-acres!', pin: '271828' })).status, 409, 'taken');
  // racing for one name: only one gets it
  const c = farms.auth(bearer(farms.create(aSave(3), 'pc')));
  const race = await Promise.all([farms.setRecovery(b, { name: 'Moss Hill', pin: '271828' }), farms.setRecovery(c, { name: 'moss hill', pin: '314159' })]);
  assert.deepEqual(race.map((r) => r.status ?? 200).sort(), [200, 409]);
  // renaming frees the old name, and an empty PIN keeps the PIN
  assert.deepEqual(await farms.setRecovery(a, { name: 'Clover Field', pin: '' }), { name: 'Clover Field' });
  assert.ok(!farms.names.has('sunny-acres'));
  assert.equal((await farms.recover({ name: 'Clover Field', pin: '482913' })).id, a.id, 'the old PIN still works');
  assert.equal(JSON.stringify(a).includes('482913'), false, 'the PIN itself is not kept');
});

await test('a farm comes back with its name and PIN, as a device of its own; wrong PINs lock it a while', async () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'farms-'));
  try {
    let farms = new Farms({ dir, log: () => {} });
    const made = farms.create(aSave(9), 'p1');
    await farms.setRecovery(farms.auth(bearer(made)), { name: 'Turnip Hollow', pin: '505172' });
    farms = new Farms({ dir, log: () => {} }); // (a restart: the names are gathered again)
    const back = await farms.recover({ name: 'turnip hollow', pin: '505172' });
    assert.equal(back.id, made.id);
    assert.equal(back.name, 'Turnip Hollow');
    assert.notEqual(back.token, made.token);
    assert.equal(farms.auth(bearer(back)).save.backpack.gold, 9);
    assert.equal((await farms.recover({ name: 'Nowhere Farm', pin: '505172' })).status, 403);
    // five wrong, then even the right PIN waits
    for (let i = 0; i < 5; i++) assert.equal((await farms.recover({ name: 'Turnip Hollow', pin: '000001' })).status, 403);
    const locked = await farms.recover({ name: 'Turnip Hollow', pin: '505172' });
    assert.equal(locked.status, 429);
    assert.match(locked.error, /15 minutes/);
    // still locked after a restart; the next lock is longer
    farms = new Farms({ dir, log: () => {} });
    const farm = farms.get(made.id);
    assert.equal((await farms.recover({ name: 'Turnip Hollow', pin: '505172' })).status, 429);
    farm.lockedUntil = 0;
    for (let i = 0; i < 5; i++) await farms.recover({ name: 'Turnip Hollow', pin: '000001' });
    assert.match((await farms.recover({ name: 'Turnip Hollow', pin: '505172' })).error, /30 minutes/);
    // guesses sent all at once don't slip past the lock
    farm.lockedUntil = 0;
    farm.pinFails = 0;
    const burst = await Promise.all(Array.from({ length: 40 }, (_, i) => farms.recover({ name: 'Turnip Hollow', pin: String(600000 + i) })));
    assert.equal(burst.filter((r) => r.status === 403).length, 5, 'only five were checked');
    // from one address, tries are limited too
    farm.lockedUntil = 0;
    const tries = [];
    for (let i = 0; i < 12; i++) tries.push((await farms.recover({ name: 'Nowhere Farm', pin: '505172' }, '10.0.0.7')).status);
    assert.ok(tries.includes(429));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

console.log('farms with helpers');
await test('a helper is invited once, comes onto the farm, and can be taken off again', () => {
  const farms = new Farms({ log: () => {} });
  const madeA = farms.create(aSave(1), 'pa');
  const madeB = farms.create(aSave(2), 'pb');
  const a = farms.auth(bearer(madeA));
  const b = farms.auth(bearer(madeB));
  const { code } = farms.invite(a, 'Ann');
  assert.equal(farms.invited(code).name, "Ann's farm");
  assert.equal(farms.acceptHelp(code, a, 'Ann').status, 400, 'not on your own farm');
  assert.deepEqual(farms.acceptHelp(code, b, 'Bo'), { id: a.id, name: "Ann's farm" });
  assert.equal(farms.acceptHelp(code, b, 'Bo').status, 404, 'good once');
  assert.deepEqual(farms.helpersOf(a).map((h) => h.name), ['Bo']);
  assert.deepEqual(farms.helpingOf(b), [{ id: a.id, name: "Ann's farm" }]);
  assert.ok(farms.seenHelper(a, b.id, 'Bo'));
  assert.deepEqual(farms.removeHelper(a, b.id), { helpers: [] });
  assert.ok(!farms.seenHelper(a, b.id, 'Bo'));
  assert.deepEqual(farms.helpingOf(b), []);
});

await test('a farm room: farming together, the chest, and the farm kept in the owner\'s save', () => {
  const farms = new Farms({ log: () => {} });
  const madeA = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: 8, tilled: ['3,3'], crops: [], hens: [[0, 1, 2, 9]] }, backpack: {} }, 'pa');
  const madeB = farms.create(aSave(2), 'pb');
  const madeC = farms.create(aSave(3), 'pc');
  const a = farms.auth(bearer(madeA));
  farms.acceptHelp(farms.invite(a, 'Ann').code, farms.auth(bearer(madeB)), 'Bo');
  const rooms = new FarmRooms({ farms, log: () => {} });
  const room = rooms.open(a.id);
  const enter = (made, name) => {
    const conn = fakeConn();
    const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name, key: name, auth: `${made.id}.${made.token}` });
    return { conn, p };
  };
  const ann = enter(madeA, 'Ann');
  const bo = enter(madeB, 'Bo');
  const stranger = enter(madeC, 'Cy');
  assert.equal(stranger.p, null);
  assert.equal(stranger.conn.closed, CLOSE.NOT_HELPER);
  assert.equal(ann.conn.last(S.FARM).mine, true);
  const welcome = bo.conn.last(S.FARM);
  assert.equal(welcome.mine, false);
  assert.deepEqual(welcome.tilled.map(([key]) => key), ['3,3']);
  assert.deepEqual(welcome.animals.hens, [[0, 1, 2, 9]]);
  assert.ok(welcome.hours >= 8);
  // Bo stands by 4,3: tills it, plants a turnip; too far for 9,9
  room.message(bo.p, { t: C.STATE, x: 4, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(bo.p, { t: C.TILL, key: '4,3' });
  assert.equal(ann.conn.last(S.TILLED).key, '4,3');
  room.message(bo.p, { t: C.TILL, key: '9,9' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'till');
  room.message(bo.p, { t: C.PLANT, key: '4,3', crop: 'turnip' });
  assert.equal(ann.conn.last(S.PLANTED).crop, 'turnip');
  room.message(bo.p, { t: C.PLANT, key: '4,3', crop: 'carrot' });
  assert.deepEqual([bo.conn.last(S.FARM_DENY).op, bo.conn.last(S.FARM_DENY).crop], ['plant', 'carrot'], 'the seed comes back');
  // not ripe yet; an hour on (15 s of growing, then more), it is, and into the chest
  room.message(bo.p, { t: C.HARVEST, key: '4,3' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'harvest');
  room.clockBase += 2; // (two game hours: 30 s)
  room.message(bo.p, { t: C.HARVEST, key: '4,3' });
  assert.equal(ann.conn.last(S.HARVESTED).item, 'turnip');
  assert.deepEqual(ann.conn.last(S.CHEST).items, { turnip: 1 });
  // the chest: anyone puts in, only the owner takes out
  room.message(bo.p, { t: C.CHEST_PUT, item: 'flax', count: 3 });
  room.message(bo.p, { t: C.CHEST_TAKE, item: 'flax', count: 3 });
  assert.equal(bo.conn.last(S.CHEST_GOT), undefined);
  room.message(ann.p, { t: C.CHEST_TAKE, item: 'flax', count: 2 });
  assert.deepEqual(ann.conn.last(S.CHEST_GOT), { t: S.CHEST_GOT, item: 'flax', count: 2 });
  assert.deepEqual(room.chest, { turnip: 1, flax: 1 });
  // the clock is the owner's only when alone; the animals are the owner's to say
  const before = room.hours();
  room.message(ann.p, { t: C.CLOCK, hours: before + 5 });
  assert.ok(room.hours() < before + 1);
  room.message(bo.p, { t: C.ANIMALS, state: { hens: [] } });
  assert.deepEqual(room.animals.hens, [[0, 1, 2, 9]]);
  room.message(ann.p, { t: C.ANIMALS, state: { hens: [[1, 1, 1, 1]], tilled: ['0,0'] } });
  assert.deepEqual(Object.keys(room.animals), ['hens']);
  // building: next to you, not on soil, a piece, nothing there yet; whoever is close takes it down
  room.message(bo.p, { t: C.BUILD, key: '5,3', piece: 'wood_fence' });
  assert.deepEqual(ann.conn.last(S.BUILT), { t: S.BUILT, key: '5,3', piece: 'wood_fence', by: bo.p.id });
  for (const [key, piece] of [['5,3', 'stone_wall'], ['4,3', 'wood_path'], ['5,4', 'castle'], ['9,9', 'wood_path'], ['5,2', 'constructor']]) {
    room.message(bo.p, { t: C.BUILD, key, piece });
    assert.equal(bo.conn.last(S.FARM_DENY).op, 'build', `${piece} on ${key}`);
  }
  assert.equal(bo.conn.last(S.FARM_DENY).piece, undefined, 'only pieces there are come back');
  room.message(bo.p, { t: C.TILL, key: '5,3' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'till', 'no tilling under a fence');
  room.message(ann.p, { t: C.UNBUILD, key: '5,3' });
  assert.equal(ann.conn.last(S.FARM_DENY).op, 'unbuild', 'too far');
  room.message(bo.p, { t: C.UNBUILD, key: '5,3' });
  assert.deepEqual(ann.conn.last(S.UNBUILT), { t: S.UNBUILT, key: '5,3', piece: 'wood_fence', by: bo.p.id });
  // gates and the blocks to climb on are pieces too
  for (const piece of ['wood_gate', 'wood_crate', 'stone_step', 'stone_block']) {
    room.message(bo.p, { t: C.BUILD, key: '5,3', piece });
    assert.deepEqual(ann.conn.last(S.BUILT), { t: S.BUILT, key: '5,3', piece, by: bo.p.id });
    room.message(bo.p, { t: C.UNBUILD, key: '5,3' });
    assert.deepEqual(ann.conn.last(S.UNBUILT), { t: S.UNBUILT, key: '5,3', piece, by: bo.p.id });
  }
  room.message(bo.p, { t: C.BUILD, key: '5,4', piece: 'stone_path' });
  room.message(ann.p, { t: C.STATE, x: 0, y: 0.8, z: 5, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.BUILD, key: '0,4', piece: 'stone_path' });
  assert.equal(ann.conn.last(S.FARM_DENY).op, 'build', 'the plaza\'s middle stays clear');
  room.message(ann.p, { t: C.ANIMALS, state: { hens: [[1, 1, 1, 1]], built: [] } });
  assert.equal(room.built.size, 1, 'the animals can\'t take it down');
  // the farm's rocks: broken by whoever is next to one (the stone is theirs); the room keeps when it comes back
  room.message(bo.p, { t: C.MINE, id: 3, x: 5, z: 3, size: 0.3 });
  const mined = ann.conn.last(S.MINED);
  assert.deepEqual([mined.id, mined.by], [3, bo.p.id]);
  assert.ok(mined.count >= 1 && mined.at > Date.now());
  room.message(ann.p, { t: C.MINE, id: 4, x: 5, z: 3, size: 0.3 });
  assert.equal(ann.conn.last(S.MINE_DENY)?.id, 4, 'too far');
  // ...and its trees, the same way (Bo's rock was a moment ago: chopping isn't mining)
  room.message(bo.p, { t: C.CHOP, id: 7, x: 5, z: 4, size: 1.2 });
  const felled = ann.conn.last(S.FELLED);
  assert.deepEqual([felled.id, felled.by], [7, bo.p.id]);
  assert.ok(felled.count >= 1 && felled.at > Date.now());
  room.message(ann.p, { t: C.CHOP, id: 8, x: 5, z: 4, size: 1.2 });
  assert.equal(ann.conn.last(S.CHOP_DENY)?.id, 8, 'too far');
  room.message(ann.p, { t: C.ANIMALS, state: { hens: [[1, 1, 1, 1]], felled: [], mined: [] } });
  assert.ok(room.mined.has(3) && room.felled.has(7), 'the animals can\'t bring them back');
  // written into the owner's save, the chest beside it
  rooms.write(room);
  assert.deepEqual(a.save.farm.built, [['5,4', 'stone_path']]);
  assert.deepEqual([a.save.farm.felled, a.save.farm.mined], [[[7, felled.at]], [[3, mined.at]]]);
  const reopened = new FarmRoom({ farm: a, admit: () => null });
  assert.ok(reopened.felled.has(7) && reopened.mined.has(3), 'still down when the farm opens again');
  room.tickPlace(Math.max(felled.at, mined.at) + 1);
  assert.deepEqual([bo.conn.last(S.REGROWN)?.id, bo.conn.last(S.RESURFACED)?.id], [7, 3]);
  assert.equal(room.felled.size + room.mined.size, 0);
  assert.deepEqual(rooms.farms.get(a.id) && new FarmRoom({ farm: a, admit: () => null }).built.get('5,4'), 'stone_path', 'and back from it');
  assert.deepEqual(a.save.farm.tilled.map(([key]) => key).sort(), ['3,3', '4,3']);
  assert.deepEqual(a.save.farm.hens, [[1, 1, 1, 1]]);
  assert.deepEqual(a.chest, { turnip: 1, flax: 1 });
  assert.equal(a.roomRev, 1);
  // a save from a page that didn't have that farm keeps the room's farm, but its backpack counts
  farms.put(a, 'pa', { v: 5, farm: { savedAt: 1, hours: 1, tilled: [], crops: [] }, backpack: { gold: 77 } }, { live: false, roomRev: 0 });
  assert.deepEqual(a.save.farm.tilled.map(([key]) => key).sort(), ['3,3', '4,3']);
  assert.equal(a.save.backpack.gold, 77);
  farms.allowPut = () => true;
  farms.put(a, 'pa', { v: 5, farm: { savedAt: 1, hours: 1, tilled: [], crops: [] }, backpack: {} }, { live: true, roomRev: 1 });
  assert.equal(a.save.farm.tilled.length, 2, 'not while the room has it');
  farms.put(a, 'pa', { v: 5, farm: { savedAt: 1, hours: 1, tilled: [], crops: [] }, backpack: {} }, { live: false, roomRev: 1 });
  assert.equal(a.save.farm.tilled.length, 0, 'the page had the latest');
  // taken off the helpers: out of the farm
  farms.removeHelper(a, madeB.id);
  rooms.turnOut(a.id, madeB.id);
  assert.equal(bo.conn.closed, CLOSE.NOT_HELPER);
  assert.equal(room.players.size, 1);
  room.close();
});

// ---------- The server, over sockets ----------
console.log('server');
const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://localhost:${PORT}`;
function startServer(env = {}) {
  const proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), GAME_DATA: 'off', ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  const ready = new Promise((done) => proc.stdout.on('data', (d) => String(d).includes('game server') && done()));
  const exited = new Promise((done) => proc.on('exit', done));
  return { proc, ready, exited };
}
let server = startServer();
await server.ready;

// (farm: be on that farm instead, as the farm auth says: "<id>.<token>")
function client(code = '', key = `key${Math.random()}`, { farm = null, auth = null } = {}) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws${farm ? `?farm=${farm}` : code ? `?lobby=${code}` : ''}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters]) if (w.match(m)) waiters.splice(waiters.indexOf(w), 1) && w.done(m);
  });
  const closed = new Promise((done) => ws.on('close', (code) => done(code)));
  ws.on('open', () => ws.send(JSON.stringify({ t: C.JOIN, v: PROTOCOL_VERSION, name: 'Bot', key, ...(farm && { auth }) })));
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

  await test('farms over HTTP: make, open, save, pair; another device\'s page is turned down', async () => {
    const call = (method, path, { body = {}, auth, session = 'page-aaaaaaaa', type = 'application/json' } = {}) =>
      fetch(`${base}${path}`, {
        method,
        headers: { 'content-type': type, 'x-farm-session': session, ...(auth && { authorization: bearer(auth) }) },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const made = (await call('POST', '/api/farms', { body: { save: aSave(4) } })).body;
    assert.equal(made.rev, 1);
    assert.equal((await call('PUT', '/api/farms/me', { body: { save: aSave(5) }, auth: made })).body.rev, 2);
    const { code } = (await call('POST', '/api/farms/me/pair', { auth: made })).body;
    const phone = (await call('POST', '/api/farms/pair', { body: { code }, session: 'page-bbbbbbbb' })).body;
    const opened = await call('POST', '/api/farms/me/open', { auth: phone, session: 'page-bbbbbbbb' });
    assert.deepEqual(opened.body, { save: aSave(5), rev: 2, roomRev: 0, helpers: 0, name: '' });
    // a helper, over HTTP
    const friend = (await call('POST', '/api/farms', { body: { save: aSave(1) }, session: 'page-cccccccc' })).body;
    const invite = (await call('POST', '/api/farms/me/helpers/invite', { body: { name: 'Ann' }, auth: made })).body;
    assert.equal((await call('POST', '/api/farms/invite', { body: { code: invite.code } })).body.name, "Ann's farm");
    assert.equal((await call('POST', '/api/farms/me/help', { body: { code: invite.code, name: 'Bo' }, auth: friend, session: 'page-cccccccc' })).body.id, made.id);
    assert.deepEqual((await call('POST', '/api/farms/me/helping', { auth: friend, session: 'page-cccccccc' })).body.farms, [{ id: made.id, name: "Ann's farm", here: 0 }]);
    assert.equal((await call('POST', '/api/farms/me/helpers', { auth: made })).body.helpers[0].name, 'Bo');
    // both on the farm: the helper tills, the owner sees it; a stranger is turned away
    const owner = client('', 'k-owner', { farm: made.id, auth: `${phone.id}.${phone.token}` });
    const helper = client('', 'k-helper', { farm: made.id, auth: `${friend.id}.${friend.token}` });
    assert.equal((await owner.next(S.FARM)).mine, true);
    assert.equal((await helper.next(S.FARM)).mine, false);
    helper.send({ t: C.STATE, x: 2, y: 0.8, z: 2, yaw: 0, f: 1 });
    await new Promise((r) => setTimeout(r, 100));
    helper.send({ t: C.TILL, key: '2,2' });
    assert.equal((await owner.next(S.TILLED)).key, '2,2');
    const stranger = client('', 'k-stranger', { farm: made.id, auth: `${made.id}.not-the-right-token` });
    assert.equal(await stranger.closed, CLOSE.NOT_HELPER);
    owner.ws.close(1000);
    helper.ws.close(1000);
    assert.equal((await call('PUT', '/api/farms/me', { body: { save: aSave(6) }, auth: made })).status, 409);
    assert.equal((await call('PUT', '/api/farms/me', { body: { save: aSave(6) }, auth: { id: made.id, token: 'wrong-token-here' } })).status, 401);
    assert.equal((await call('POST', '/api/farms', { body: { save: aSave() }, type: 'text/plain' })).status, 415);
    assert.equal((await call('POST', '/api/farms', { body: { save: aSave() }, session: '' })).status, 400);
    assert.equal((await call('POST', '/api/farms', { body: { save: { v: 3, junk: 'x'.repeat(70_000) } } })).status, 413);
    assert.equal((await call('GET', '/api/farms/me', { auth: made })).status, 404);
    // a name and PIN, then the farm back on a device with nothing
    assert.deepEqual((await call('PUT', '/api/farms/me/recovery', { body: { name: 'Http Meadow', pin: '820417' }, auth: phone, session: 'page-bbbbbbbb' })).body, { name: 'Http Meadow' });
    const lost = await call('POST', '/api/farms/recover', { body: { name: 'http meadow', pin: '820417' }, session: 'page-cccccccc' });
    assert.equal(lost.body.id, made.id);
    assert.equal((await call('POST', '/api/farms/me/open', { auth: lost.body, session: 'page-cccccccc' })).body.name, 'Http Meadow');
    assert.equal((await call('POST', '/api/farms/recover', { body: 7, session: 'page-cccccccc' })).status, 403);
  });

  await test('a restart keeps the lobbies: the same island, what was taken, the seat', async () => {
    server.proc.kill();
    await server.exited;
    const dir = mkdtempSync(joinPath(tmpdir(), 'lobbies-'));
    const GAME_DATA = joinPath(dir, 'lobbies.json');
    try {
      server = startServer({ GAME_DATA });
      await server.ready;
      const made = await fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ours', seed: 'sunny knoll 5', inviteOnly: true }) }).then((r) => r.json());
      const a = client(made.code, 'restart-key');
      const w = await a.next(S.WELCOME);
      const [id, , x, , z] = w.spots.find(([, kind]) => kind === 'meadow');
      a.send({ t: C.STATE, x, y: 0.8, z, yaw: 0, f: 1 });
      await new Promise((r) => setTimeout(r, 100));
      a.send({ t: C.TAKE, id });
      await a.next(S.TAKEN);

      server.proc.kill('SIGTERM'); // (what node --watch does)
      await server.exited;
      assert.notEqual(await a.closed, 1000);
      server = startServer({ GAME_DATA });
      await server.ready;

      const info = await fetch(`${base}/api/lobbies/${made.code}`).then((r) => r.json());
      assert.deepEqual([info.name, info.seed, info.inviteOnly], ['Ours', 'sunny-knoll-5', true]);
      const again = client(made.code, 'restart-key');
      const w2 = await again.next(S.WELCOME);
      assert.equal(w2.resumed, true);
      assert.equal(w2.id, w.id);
      assert.equal(w2.roster.find((p) => p.id === w.id).finds, 1);
      assert.equal(w2.spots.find(([sid]) => sid === id)[5], null, 'still taken');
      again.ws.close(1000);
    } finally {
      server.proc.kill();
      await server.exited;
      rmSync(dir, { recursive: true });
    }
  });
} finally {
  server.proc.kill();
}

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
process.exit();
