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
import { GROUND_STAND_Y, SPOT_KINDS, RARE, TREE, ROCK, DROP_MS, woodFor, stoneFor, mostStone, mostWood } from '../shared/level.js';
import { islandFor, checkIsland, normalizeSeed, randomSeed, mulberry32, genOf, CURRENT_GEN, distToPaths, STONE_CIRCLE, shuffled } from '../shared/worldgen.js';
import { HOME_HALF, HOME_KEEP_CLEAR, HOME_PLATFORMS } from '../shared/farmland.js';
import { fingerprint } from './seed-fingerprint.js';
import { SKY_STYLES, SKY_KINDS, onIsle, relicAt } from '../shared/skyisles.js';
import { growWilds, wildsFromWire, wildsToWire, siteOf } from '../shared/wilds.js';
import { HOME_WILDS } from '../shared/homewilds.js';
import { homeWildsSource } from './wilds.js';
import { levelOf, cleanSkills, overallLevel, canDoubleJump, swingsAt, bonusChance } from '../shared/skills.js';
import { SKILLS, DOUBLE_JUMP } from '../shared/balance.js';
import { newDeck, shuffle, evaluate, bestHand } from '../shared/cards.js';
import { coinflip, handTotal, blackjackDeal, blackjackHit, blackjackStand, blackjackDouble, luckyStart, luckyPick, luckyPlay, luckyDiscard, luckyScore, luckyPays, jokerText } from '../shared/arcade.js';
import { LUCKY, LUCKY_JOKERS } from '../shared/balance.js';

// spot kinds only later generations grow (2 and up)
const LATER_KINDS = new Set(['heather', 'cattail', 'bluebell', 'sunflower', 'pumpkin', 'fern', 'seashell', ...SKY_KINDS]);

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
// tree or rock id where the room has it (shared/wilds.js), as a page says it in a CHOP or MINE
const treeOf = (wilds, id) => ({ id, x: wilds.trees[id].x, z: wilds.trees[id].z });
const rockOf = (wilds, id) => ({ id, x: wilds.rocks[id].x, z: wilds.rocks[id].z, size: wilds.rocks[id].size });
const FARM_WILDS = wildsFromWire(HOME_WILDS);
function standAt(room, who, id) {
  const { x, y, z } = room.spots[id];
  room.message(who.p, { t: C.STATE, x, y: Math.max(y, 0.8), z, yaw: 0, f: 1 });
}

console.log('islands');
await test('skills level up from their XP, and the overall level unlocks the double jump', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: SKILLS.next[0] });
  assert.equal(levelOf(SKILLS.next[0] - 1).level, 1);
  assert.deepEqual(levelOf(SKILLS.next[0] + 5), { level: 2, into: 5, need: SKILLS.next[1] });
  assert.deepEqual(levelOf(1e9), { level: SKILLS.max, into: 0, need: 0 });
  const fresh = cleanSkills(null);
  assert.equal(overallLevel(fresh), 5, 'every skill starts at level 1');
  assert.deepEqual(cleanSkills({ farming: -3, mining: 'x', woodcutting: 12.7, extra: 9 }), { farming: 0, animals: 0, woodcutting: 12, mining: 0, fishing: 0 });
  const xpTo = (level) => SKILLS.next.slice(0, level - 1).reduce((a, b) => a + b, 0);
  const almost = { ...fresh, farming: xpTo(4), animals: xpTo(3), woodcutting: xpTo(4), mining: xpTo(2) };
  assert.equal(overallLevel(almost), DOUBLE_JUMP.level - 1);
  assert.ok(!canDoubleJump(almost));
  assert.ok(canDoubleJump({ ...almost, mining: xpTo(3) }));
  assert.equal(bonusChance('woodcutting', 1), 0);
  assert.equal(swingsAt(TREE.hits, SKILLS.fewerSwings - 1), TREE.hits);
  assert.equal(swingsAt(TREE.hits, SKILLS.fewerSwings), TREE.hits - 1);
  assert.equal(swingsAt(2, SKILLS.max), 2, 'never under the fewest a lobby allows');
});

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

// Generations 2 and 3 are as settled as generation 1 now: pinned the same way.
const LATER_SEEDS = {
  9: {"mossy-cove-7-v9":163191364,"dewy-glade-31-v9":2456990911,"sunny-knoll-5-v9":1189004014,"golden-fen-0-v9":1161798591,"quiet-ridge-88-v9":2581909254,"willow-isle-12-v9":746226636,"pebble-nook-64-v9":502613636,"honey-grove-3-v9":3163829055},
  8: {"mossy-cove-7-v8":2495688328,"dewy-glade-31-v8":1583329832,"sunny-knoll-5-v8":186462849,"golden-fen-0-v8":2840815162,"quiet-ridge-88-v8":901564798,"willow-isle-12-v8":3187697367,"pebble-nook-64-v8":1809298910,"honey-grove-3-v8":596487143},
  7: {"mossy-cove-7-v7":861000100,"dewy-glade-31-v7":2645773252,"sunny-knoll-5-v7":3262897498,"golden-fen-0-v7":2913660827,"quiet-ridge-88-v7":1012903713,"willow-isle-12-v7":142691819,"pebble-nook-64-v7":2979833659,"honey-grove-3-v7":702780834},
  2: { 'mossy-cove-7-v2': 119939977, 'dewy-glade-31-v2': 2076144126, 'sunny-knoll-5-v2': 4173192289, 'golden-fen-0-v2': 1296267364, 'quiet-ridge-88-v2': 2011619196, 'willow-isle-12-v2': 4045709457, 'pebble-nook-64-v2': 869828886, 'honey-grove-3-v2': 2547208232 },
  6: {"mossy-cove-7-v6":3096900676,"dewy-glade-31-v6":2629822513,"sunny-knoll-5-v6":163208784,"golden-fen-0-v6":1784216000,"quiet-ridge-88-v6":2185361121,"willow-isle-12-v6":3551543839,"pebble-nook-64-v6":755167583,"honey-grove-3-v6":164978941},
  5: {"mossy-cove-7-v5":450326002,"dewy-glade-31-v5":3459739216,"sunny-knoll-5-v5":3901735779,"golden-fen-0-v5":2353024595,"quiet-ridge-88-v5":3223947397,"willow-isle-12-v5":3675653226,"pebble-nook-64-v5":2655493373,"honey-grove-3-v5":803211333},
  4: {"mossy-cove-7-v4":1587304027,"dewy-glade-31-v4":2535534902,"sunny-knoll-5-v4":4282641216,"golden-fen-0-v4":2506278968,"quiet-ridge-88-v4":1283944460,"willow-isle-12-v4":2433746912,"pebble-nook-64-v4":2936599587,"honey-grove-3-v4":3566523821},
  3: { 'mossy-cove-7-v3': 2325607642, 'dewy-glade-31-v3': 395772194, 'sunny-knoll-5-v3': 1431089034, 'golden-fen-0-v3': 572641172, 'quiet-ridge-88-v3': 2526362288, 'willow-isle-12-v3': 1353456352, 'pebble-nook-64-v3': 3529699339, 'honey-grove-3-v3': 2551931431 },
};
await test('generation 2 to 9 seeds grow exactly the islands they did, with nothing newer', () => {
  for (const [gen, seeds] of Object.entries(LATER_SEEDS)) {
    for (const [seed, print] of Object.entries(seeds)) {
      assert.equal(genOf(seed), Number(gen), seed);
      assert.equal(fingerprint(seed), print, `the island of "${seed}" changed`);
      if (Number(gen) < 4) assert.ok(!islandFor(seed).marsh && !islandFor(seed).spots.some(([k]) => k === 'cattail'), `"${seed}" grew generation 4 things`);
      if (Number(gen) < 5) assert.ok(!islandFor(seed).glade && !islandFor(seed).spots.some(([k]) => k === 'bluebell'), `"${seed}" grew generation 5 things`);
      if (Number(gen) < 6) assert.ok(!islandFor(seed).field && !islandFor(seed).spots.some(([k]) => k === 'sunflower'), `"${seed}" grew generation 6 things`);
      if (Number(gen) < 7) assert.ok(!islandFor(seed).patch && !islandFor(seed).spots.some(([k]) => k === 'pumpkin'), `"${seed}" grew generation 7 things`);
      if (Number(gen) < 8) assert.ok(!islandFor(seed).glen && !islandFor(seed).spots.some(([k]) => k === 'fern'), `"${seed}" grew generation 8 things`);
      if (Number(gen) < 9) assert.ok(!islandFor(seed).dunes && !islandFor(seed).spots.some(([k]) => k === 'seashell'), `"${seed}" grew generation 9 things`);
      assert.ok(!islandFor(seed).sky && !islandFor(seed).spots.some(([k]) => SKY_KINDS.includes(k)), `"${seed}" grew generation 10 things`);
    }
  }
});

await test('generation 4 islands are generation 3 islands with a reed marsh and cattails', () => {
  assert.equal(genOf('dewy-glade-31-v4'), 4);
  let marshes = 0;
  for (let i = 0; i < 60; i++) {
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v4');
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    assert.equal(island.half, 68, `${seed}: as wide as generation 3`);
    if (island.marsh) {
      marshes++;
      const cattails = island.spots.filter(([k]) => k === 'cattail');
      assert.ok(cattails.length >= 3, seed);
      assert.ok(cattails.every(([, x, , z]) => island.groundAt(x, z) === 'marsh'), `${seed}: cattails grow in the marsh`);
    }
  }
  assert.ok(marshes >= 45, `most gen 4 islands have a marsh (${marshes} of 60)`);
});

await test('generation 5 islands are generation 4 islands with a bluebell glade', () => {
  assert.equal(genOf('dewy-glade-31-v5'), 5);
  let glades = 0;
  for (let i = 0; i < 60; i++) {
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v5');
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    assert.equal(island.half, 68, `${seed}: as wide as generation 3`);
    if (island.glade) {
      glades++;
      const bells = island.spots.filter(([k]) => k === 'bluebell');
      assert.ok(bells.length >= 3, seed);
      assert.ok(bells.every(([, x, , z]) => island.groundAt(x, z) === 'glade'), `${seed}: bluebells grow in the glade`);
    }
  }
  assert.ok(glades >= 45, `most gen 5 islands have a glade (${glades} of 60)`);
});

await test('generation 6 islands are generation 5 islands with a sunflower field', () => {
  assert.equal(genOf('dewy-glade-31-v6'), 6);
  let fields = 0;
  for (let i = 0; i < 60; i++) {
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v6');
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    assert.equal(island.half, 68, `${seed}: as wide as generation 3`);
    if (island.field) {
      fields++;
      const heads = island.spots.filter(([k]) => k === 'sunflower');
      assert.ok(heads.length >= 3, seed);
      assert.ok(heads.every(([, x, , z]) => island.groundAt(x, z) === 'field'), `${seed}: sunflowers grow in the field`);
    }
  }
  assert.ok(fields >= 45, `most gen 6 islands have a field (${fields} of 60)`);
});

await test('generation 7 islands are generation 6 islands with a pumpkin patch', () => {
  assert.equal(genOf('dewy-glade-31-v7'), 7);
  let patches = 0;
  for (let i = 0; i < 60; i++) {
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v7');
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    assert.equal(island.half, 68, `${seed}: as wide as generation 3`);
    if (island.patch) {
      patches++;
      const pumpkins = island.spots.filter(([k]) => k === 'pumpkin');
      assert.ok(pumpkins.length >= 3, seed);
      assert.ok(pumpkins.every(([, x, , z]) => island.groundAt(x, z) === 'patch'), `${seed}: pumpkins grow in the patch`);
    }
  }
  assert.ok(patches >= 45, `most gen 7 islands have a patch (${patches} of 60)`);
});

// Generations 8 and 9: a fern glen, then shell dunes, on most islands
for (const [gen, name, area, kind, ground] of [[8, 'a fern glen', 'glen', 'fern', 'glen'], [9, 'shell dunes', 'dunes', 'seashell', 'dune']]) {
  await test(`generation ${gen} islands are generation ${gen - 1} islands with ${name}`, () => {
    assert.equal(genOf(`dewy-glade-31-v${gen}`), gen);
    let found = 0;
    for (let i = 0; i < 60; i++) {
      const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, `-v${gen}`);
      const island = islandFor(seed);
      assert.deepEqual(checkIsland(island), [], seed);
      assert.equal(island.half, 68, `${seed}: as wide as generation 3`);
      if (gen === 8) assert.ok(!island.dunes, `${seed}: no generation 9 things`);
      if (island[area]) {
        found++;
        const spots = island.spots.filter(([k]) => k === kind);
        assert.ok(spots.length >= 3, seed);
        assert.ok(spots.every(([, x, , z]) => island.groundAt(x, z) === ground), `${seed}: the ${kind} spots are in the ${area}`);
      }
    }
    assert.ok(found >= 45, `most gen ${gen} islands have ${name} (${found} of 60)`);
  });
}

// Generation 10: sky isles, each up its own stair, with its relic and its two chests
await test('generation 10 islands are generation 9 islands with sky isles overhead', () => {
  assert.equal(genOf('dewy-glade-31-v10'), 10);
  assert.equal(genOf('dewy-glade-31-v1'), 1);
  let isles = 0;
  const styles = new Set();
  for (let i = 0; i < 60; i++) {
    const seed = randomSeed(mulberry32(i));
    assert.match(seed, /-v10$/);
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    assert.ok(!islandFor(seed.replace(/-v10$/, '-v9')).sky, `${seed}: generation 9 has none`);
    // the sky's spots come after the ground's, so those keep their ids
    const first = island.spots.findIndex(([k]) => SKY_KINDS.includes(k));
    if (first >= 0) assert.ok(island.spots.slice(first).every(([k]) => SKY_KINDS.includes(k)), `${seed}: the sky's spots come last`);
    const sky = island.sky ?? [];
    assert.ok(sky.length <= 3, seed);
    assert.equal(new Set(sky.map((isle) => isle.style)).size, sky.length, `${seed}: each isle a style of its own`);
    for (const isle of sky) {
      isles++;
      styles.add(isle.style);
      assert.ok(isle.top >= 9 && isle.steps.length >= 6, seed);
      const on = island.spots.filter(([, x, , z]) => onIsle(isle, x, z));
      for (const kind of ['relic', 'sky_chest', 'sky_vault']) assert.equal(on.filter(([k]) => k === kind).length, 1, `${seed}: one ${kind} on each isle`);
      const [, rx, , rz] = on.find(([k]) => k === 'relic');
      assert.equal(relicAt(island, rx, rz), SKY_STYLES[isle.style].relic, seed);
    }
  }
  assert.ok(isles >= 90, `most gen 10 islands have more than one sky isle (${isles} on 60)`);
  assert.ok(styles.size >= 15, `the isles go round the styles (${styles.size} of ${SKY_STYLES.length})`);
});

await test('a sky isle chest opens once, for what is in it; the locked one takes a key; the relic is announced', () => {
  const seed = randomSeed(mulberry32(3));
  const room = new Room({ code: 'SKY', seed, rand: mulberry32(7) });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const [chest, vault, relic] = ['sky_chest', 'sky_vault', 'relic'].map((kind) => room.spots.findIndex((s) => s.kind === kind));
  assert.equal(room.spots[chest].item, 'chest');
  const inChest = room.spots[chest].bundle;
  assert.ok(inChest.length >= 1 && room.spots[vault].bundle.length >= 1);
  // the chest: whoever is there first, everything in it at once
  standAt(room, a, chest);
  room.message(a.p, { t: C.TAKE, id: chest });
  const taken = b.conn.last(S.TAKEN);
  assert.equal(taken.by, a.p.id);
  assert.deepEqual(taken.items, inChest);
  for (const [item, count] of inChest) if (item !== 'coin' && !RARE[item]) assert.ok(a.p.bag[item] >= count, `${item} in the bag (a bop could knock it loose)`);
  standAt(room, b, chest);
  room.message(b.p, { t: C.TAKE, id: chest });
  assert.equal(b.conn.last(S.DENY)?.id, chest, 'already open');
  // the locked one: not without a key
  standAt(room, b, vault);
  room.message(b.p, { t: C.TAKE, id: vault });
  assert.equal(b.conn.last(S.DENY)?.id, vault, 'locked');
  room.message(b.p, { t: C.TAKE, id: vault, key: true });
  assert.equal(a.conn.last(S.TAKEN).id, vault);
  assert.ok(a.conn.all(S.CHAT).some((m) => /unlocked/.test(m.text)), 'the lobby hears');
  // the relic: its isle's, rare, and everyone hears who found it
  const { item, x, z } = room.spots[relic];
  assert.ok(RARE[item], 'a relic is a rare find');
  assert.equal(item, relicAt(room.island, x, z));
  assert.ok(room.island.sky.some((isle) => SKY_STYLES[isle.style].relic === item));
  standAt(room, a, relic);
  room.message(a.p, { t: C.TAKE, id: relic });
  assert.equal(b.conn.last(S.TAKEN).item, item);
  assert.ok(b.conn.all(S.CHAT).some((m) => m.text === `A found ${RARE[item].toLowerCase()}!`));
});

await test('every lobby has an old key somewhere, on a spot a save keeps it on', () => {
  const hasKey = (room) => room.spots.some((s) => s.item === 'key' || s.bundle?.some(([item]) => item === 'key'));
  for (let i = 0; i < 40; i++) {
    const seed = i === 0 ? 'classic' : randomSeed(mulberry32(100 + i));
    assert.ok(hasKey(new Room({ code: 'KEY', seed, rand: mulberry32(i) })), `a key on ${seed}`);
  }
  // nothing rolled one (the bottom of every loot table): one is put out anyway
  const room = new Room({ code: 'KEY', seed: randomSeed(mulberry32(5)), rand: () => 0 });
  const spot = room.spots.find((s) => s.item === 'key');
  assert.ok(['meadow', 'ledge', 'sky'].includes(spot?.kind), 'on a meadow, ledge or sky spot');
  assert.ok(!room.spots.some((s) => s.bundle?.some(([item]) => item === 'key')), 'not in a chest');
  const back = Room.fromSave(room.toSave(), { rand: () => 0.5 });
  assert.equal(back.spots[spot.id].item, 'key', 'still there after a restart');
  // ...and never in place of golden seeds
  const can = room.spots.filter((s) => ['meadow', 'ledge', 'sky'].includes(s.kind));
  for (const s of can) Object.assign(s, { item: 'golden_seeds', count: 1 });
  can.at(-1).item = 'coin';
  room.hideKey();
  assert.equal(can.at(-1).item, 'key');
  assert.equal(can.filter((s) => s.item === 'golden_seeds').length, can.length - 1);
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
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v2');
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

await test('generation 3 islands: twice as wide, with climbs, rings of toadstools and trails out to every wood', () => {
  assert.equal(genOf('dewy-glade-31-v3'), 3);
  for (let i = 0; i < 120; i++) {
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v3');
    const island = islandFor(seed);
    assert.deepEqual(checkIsland(island), [], seed);
    const narrow = islandFor(seed.replace(/-v3$/, '-v2'));
    assert.equal(island.half, narrow.half * 2, seed);
    assert.ok(island.coast.r > narrow.coast.r * 1.6, `${seed}: the coast is further out`);
    assert.ok(new Set(island.terraces.map((step) => step[5])).size >= 2, `${seed}: more than one climb`);
    assert.ok(new Set(island.toadstools.map((cap) => cap[4])).size >= 2, `${seed}: more than one ring of toadstools`);
    assert.ok(island.spots.length >= 50, `${seed} has ${island.spots.length} spots`);
    for (const kind of Object.keys(SPOT_KINDS).filter((k) => !LATER_KINDS.has(k))) assert.ok(island.spots.some(([k]) => k === kind), `${seed} has no ${kind}`);
    // every wood has a trail into it
    for (const [x, z, r] of island.woods) assert.ok(distToPaths(x, z, island.trails) < r, `${seed}: no trail to the wood at ${x}, ${z}`);
  }
});

await test('every seed grows a sound island: spots on land, reachable, not inside a cliff or a toadstool', () => {
  for (let i = 0; i < 300; i++) {
    const island = islandFor(randomSeed(mulberry32(i)).replace(/-v\d+$/, '') + i);
    assert.deepEqual(checkIsland(island), [], `seed ${island.seed}`);
    assert.ok(island.spots.length >= 25, `seed ${island.seed} has ${island.spots.length} spots`);
    for (const kind of Object.keys(SPOT_KINDS).filter((k) => !LATER_KINDS.has(k))) assert.ok(island.spots.some(([k]) => k === kind), `seed ${island.seed} has no ${kind}`);
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

await test('trees: felled by whoever finishes first, next to it, not too fast; they stay down', () => {
  const room = new Room({ code: 'TEST11' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const at = (who, x, z) => room.message(who.p, { t: C.STATE, x, y: 0.8, z, yaw: 0, f: 1 });
  const tree = treeOf(room.wilds, 7);
  at(a, tree.x + 6, tree.z);
  room.message(a.p, { t: C.CHOP, ...tree });
  assert.equal(a.conn.last(S.CHOP_DENY)?.id, 7, 'too far');
  at(a, tree.x + 1, tree.z);
  room.message(a.p, { t: C.CHOP, ...tree, x: tree.x + 3 });
  assert.equal(a.conn.last(S.CHOP_DENY)?.id, 7, 'not where it stands');
  room.message(a.p, { t: C.CHOP, ...tree });
  const felled = b.conn.last(S.FELLED);
  assert.equal(felled.id, 7);
  assert.equal(felled.by, a.p.id);
  assert.ok(felled.count >= TREE.wood[0] && felled.count <= mostWood(room.wilds.trees[7].scale), 'as much wood as a tree that size gives');
  assert.equal(a.p.wood, felled.count);
  at(b, tree.x - 1, tree.z);
  room.message(b.p, { t: C.CHOP, ...tree });
  assert.equal(b.conn.last(S.CHOP_DENY)?.id, 7, 'already down');
  const next = treeOf(room.wilds, 8);
  at(a, next.x + 1, next.z);
  room.message(a.p, { t: C.CHOP, ...next });
  assert.equal(a.conn.last(S.CHOP_DENY)?.id, 8, 'faster than an axe');
  room.message(a.p, { t: C.CHOP, id: -1, x: next.x, z: next.z });
  room.message(a.p, { t: C.CHOP, id: 'x', x: next.x, z: next.z });
  room.message(a.p, { t: C.CHOP, id: room.wilds.trees.length, x: next.x, z: next.z });
  assert.equal(a.conn.all(S.CHOP_DENY).length, 6, 'nonsense ids are turned down');
  // a newcomer sees it down, and it never grows back
  const c = join(room, 'C');
  assert.deepEqual(c.conn.last(S.WELCOME).felled, [7]);
  assert.equal(room.rosterList().find((p) => p.id === a.p.id).wood, felled.count);
  room.update(Date.now() + TREE.regrow[1] * 1000 + 100);
  assert.equal(b.conn.last(S.REGROWN), undefined);
  assert.deepEqual(join(room, 'D').conn.last(S.WELCOME).felled, [7]);
});

await test('bigger trees give more wood, within the sizes trees come in', () => {
  const luck = (r) => () => r; // the same roll every time
  assert.equal(woodFor(1, luck(0)), TREE.wood[0]);
  assert.equal(woodFor(1, luck(0.99)), TREE.wood[1]);
  assert.ok(woodFor(1.6, luck(0.99)) > woodFor(1, luck(0.99)), 'a big old tree beats an ordinary one');
  assert.ok(woodFor(0.8, luck(0)) >= 1, 'even a little one gives some');
  assert.equal(woodFor(50, luck(0.99)), woodFor(TREE.size[1], luck(0.99)), 'no giants');
  assert.equal(woodFor(undefined, luck(0.5)), woodFor(1, luck(0.5)), 'no size: an ordinary tree');
  // and the room goes by the size it has the tree as (shared/wilds.js), whatever the page says
  const room = new Room({ code: 'TEST12', rand: luck(0.99) });
  const a = join(room, 'A');
  const tree = treeOf(room.wilds, 3);
  room.message(a.p, { t: C.STATE, x: tree.x + 1, y: 0.8, z: tree.z, yaw: 0, f: 1 });
  room.message(a.p, { t: C.CHOP, ...tree, size: 50 });
  assert.equal(a.conn.last(S.FELLED).count, woodFor(room.wilds.trees[3].scale, luck(0.99)));
});

await test('rocks: broken by whoever finishes first, next to it, not too fast; they stay broken', () => {
  const room = new Room({ code: 'TEST13' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const at = (who, x, z) => room.message(who.p, { t: C.STATE, x, y: 0.8, z, yaw: 0, f: 1 });
  const rock = rockOf(room.wilds, 4);
  at(a, rock.x + 6, rock.z);
  room.message(a.p, { t: C.MINE, ...rock });
  assert.equal(a.conn.last(S.MINE_DENY)?.id, 4, 'too far');
  at(a, rock.x + 1, rock.z);
  room.message(a.p, { t: C.MINE, ...rock });
  const mined = b.conn.last(S.MINED);
  assert.equal(mined.id, 4);
  assert.equal(mined.by, a.p.id);
  assert.ok(mined.count >= ROCK.stone[0] && mined.count <= ROCK.stone[1]);
  assert.equal(a.p.stone, mined.count);
  at(b, rock.x, rock.z + 1);
  room.message(b.p, { t: C.MINE, ...rock });
  assert.equal(b.conn.last(S.MINE_DENY)?.id, 4, 'already broken');
  const next = rockOf(room.wilds, 5);
  at(a, next.x + 1, next.z);
  room.message(a.p, { t: C.MINE, ...next });
  assert.equal(a.conn.last(S.MINE_DENY)?.id, 5, 'faster than a pickaxe');
  room.message(a.p, { t: C.MINE, id: -1, x: next.x, z: next.z });
  room.message(a.p, { t: C.MINE, id: 'x', x: next.x, z: next.z });
  assert.equal(a.conn.all(S.MINE_DENY).length, 4, 'nonsense ids are turned down');
  assert.deepEqual(join(room, 'C').conn.last(S.WELCOME).mined, [4]);
  assert.equal(room.rosterList().find((p) => p.id === a.p.id).stone, mined.count);
  room.update(Date.now() + ROCK.regrow[1] * 1000 + 100);
  assert.equal(b.conn.last(S.RESURFACED), undefined);
  assert.deepEqual(join(room, 'D').conn.last(S.WELCOME).mined, [4]);
});

await test('trees and rocks: the room places them, on dry land at ground level, the same every time', () => {
  const seeds = ['classic', 'mossy-cove-7'];
  for (let gen = 2; gen <= CURRENT_GEN; gen++) for (let i = 0; i < 3; i++) seeds.push(randomSeed(mulberry32(100 * gen + i)).replace(/-v\d+$/, `-v${gen}`));
  for (const seed of seeds) {
    const island = islandFor(seed);
    const wilds = growWilds(island);
    assert.ok(wilds.trees.length > 20 && wilds.rocks.length > 20, `${seed}: a wood and some rocks`);
    assert.deepEqual(wildsToWire(growWilds(island, { cached: false })), wildsToWire(wilds), `${seed}: the same every time`);
    for (const [kind, list, reach] of [['tree', wilds.trees, (t) => 0.8 * t.scale], ['rock', wilds.rocks, (r) => 0.9 * r.size]]) {
      list.forEach((thing, id) => {
        assert.ok(thing.sites.length >= 1 && thing.sites.length <= 3);
        assert.deepEqual(thing.sites[0], [thing.x, thing.z]);
        for (const [x, z] of thing.sites) {
          const where = `${seed}: ${kind} ${id} at ${x}, ${z}`;
          const r = reach(thing);
          for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
            const ground = island.groundAt(Math.round(x + dx), Math.round(z + dz));
            assert.ok(ground && ground !== 'pond', `${where} reaches out over the water`);
          }
          assert.equal(island.floorAt(x, z), 0, `${where} is not at ground level`);
          assert.equal(island.topOver(x, z), null, `${where} is inside a cliff or under a toadstool`);
          assert.equal(island.skyOver(x, z, 1), null, `${where} is under a sky isle`);
          assert.ok(Math.hypot(x - island.spawn.x, z - island.spawn.z) > STONE_CIRCLE + 0.8, `${where} is in the stone circle`);
          assert.ok(island.spots.every(([, sx, , sz]) => Math.hypot(x - sx, z - sz) >= 1), `${where} is on a spot`);
        }
      });
    }
  }
  // and the farm's: kept in shared/homewilds.js, on the farm's grass and sand, clear of the pens, the stall and the platforms
  assert.equal(readFileSync(new URL('../shared/homewilds.js', import.meta.url), 'utf8'), homeWildsSource(), 'shared/homewilds.js is out of date: npm run wilds');
  for (const thing of [...FARM_WILDS.trees, ...FARM_WILDS.rocks]) {
    for (const [x, z] of thing.sites) {
      assert.ok(Math.max(Math.abs(x), Math.abs(z)) < HOME_HALF - 0.5, `the farm's ${x}, ${z} is off the edge`);
      assert.ok(HOME_KEEP_CLEAR.every(([kx, kz, r]) => Math.hypot(x - kx, z - kz) >= r), `the farm's ${x}, ${z} is in a pen or by the stall`);
      assert.ok(HOME_PLATFORMS.every((p) => Math.abs(x - p.x) >= p.w / 2 || Math.abs(z - p.z) >= p.d / 2), `the farm's ${x}, ${z} is under a platform`);
    }
  }
});

await test('a shuffle is the same everywhere: every number kept, the same order for the same draws', () => {
  for (let i = 0; i < 200; i++) {
    const order = shuffled([2, 3, 4, 5, 7, 9], mulberry32(i));
    assert.deepEqual([...order].sort((a, b) => a - b), [2, 3, 4, 5, 7, 9]);
    assert.deepEqual(shuffled([2, 3, 4, 5, 7, 9], mulberry32(i)), order);
  }
});

await test('the room sends every page where its trees and rocks stand; a giant is one of them', () => {
  const room = new Room({ code: 'TEST30', seed: 'mossy-cove-7' });
  const welcome = join(room, 'A').conn.last(S.WELCOME);
  assert.deepEqual(welcome.wilds, wildsToWire(room.wilds));
  assert.deepEqual(wildsFromWire(JSON.parse(JSON.stringify(welcome.wilds))), room.wilds, 'and back, as the page reads it');
  assert.equal(wildsFromWire({ trees: [[1, 1, 1]], rocks: [] }), null, 'nonsense is not a forest');
  assert.deepEqual(room.giants.counts, { tree: room.wilds.trees.length, rock: room.wilds.rocks.length }, 'without a page saying how many');
  const tree = room.wilds.trees[0];
  assert.deepEqual(siteOf(tree, tree.sites.length), tree.sites[0], 'round and round its places');
});

await test('a bop knocks things loose onto the ground, never into the air or the sea', () => {
  const room = new Room({ code: 'TEST31' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const { x: sx, z: sz } = room.island.spawn;
  const bop = (by, y) => {
    room.message(by.p, { t: C.STATE, x: sx + 8, y: 0.8, z: sz, yaw: 0, f: 1 });
    room.message(b.p, { t: C.STATE, x: sx + 8, y, z: sz + 1.2, yaw: 0, f: 1 });
    b.p.bag = { wood: 3 };
    b.p.boppedAt = 0;
    by.p.bopAt = 0;
    room.message(by.p, { t: C.BOP, weapon: 'wooden_sword', yaw: 0 });
  };
  bop(a, 1.9); // (B jumping)
  assert.equal(a.conn.last(S.DROP).y, GROUND_STAND_Y, 'down on the ground');
  // out over the sea: nothing drops (it stays in the bag)
  const sea = { x: room.island.half + 5, z: 0 };
  b.p.bag = { wood: 3 };
  b.p.x = sea.x;
  b.p.z = sea.z;
  assert.equal(room.knockLoose(b.p, 1, Date.now()), null);
  assert.equal(b.p.bag.wood, 3);
  // up on a terrace: on the terrace
  const [tx, tz, , , top] = room.island.terraces[0];
  assert.equal(room.groundUnder(tx, top + GROUND_STAND_Y + 1.5, tz), top);
  assert.equal(room.groundUnder(tx, GROUND_STAND_Y, tz), 0, 'not if they are under it');
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
  const rock = rockOf(room.wilds, 2);
  room.message(a.p, { t: C.STATE, x: rock.x + 1, y: 0.8, z: rock.z, yaw: 0, f: 1 });
  room.message(a.p, { t: C.MINE, ...rock, size: 40 });
  assert.equal(a.conn.last(S.MINED).count, stoneFor(rock.size, luck(0.99)), 'the room goes by its own size');
});

await test('an emptied spot stays empty: nothing in a lobby grows back', () => {
  const room = new Room({ code: 'TEST04' });
  const a = join(room, 'A');
  const id = spotOf('mushroom');
  standAt(room, a, id);
  room.message(a.p, { t: C.TAKE, id });
  const [, slowest] = SPOT_KINDS.mushroom.regrow;
  room.update(Date.now() + slowest * 1000 * 100);
  assert.equal(room.spots[id].item, null);
  assert.equal(a.conn.last(S.SPOT), undefined);
});

await test('rare finds are announced when someone takes one', () => {
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
  const tree = treeOf(room.wilds, 5);
  const rock = rockOf(room.wilds, 9);
  room.message(a.p, { t: C.STATE, x: tree.x + 1, y: 0.8, z: tree.z, yaw: 0, f: 1 });
  room.message(a.p, { t: C.CHOP, ...tree });
  room.message(a.p, { t: C.STATE, x: rock.x + 1, y: 0.8, z: rock.z, yaw: 0, f: 1 });
  room.message(a.p, { t: C.MINE, ...rock });
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

await test('an empty lobby is thrown away a little after the last farmer leaves', () => {
  const kept = [];
  const lobby = new Lobby({ log: () => {}, store: { load: () => null, save: (d) => kept.push(d) } });
  const room = lobby.make({ name: 'Brief', seed: 'dewy glade 31' });
  const a = join(room, 'A');
  assert.deepEqual(lobby.list().map((l) => l.code), [room.code]);
  room.leave(a.p, { hold: false });
  room.emptySince -= 10_000;
  lobby.reap();
  assert.equal(lobby.find(room.code), room, 'not yet: a reload is quick');
  room.emptySince -= 25_000;
  lobby.reap();
  assert.equal(lobby.find(room.code), null);
  assert.equal(room.timer, null, 'stopped');
  assert.deepEqual(lobby.list(), []);
  lobby.save();
  assert.deepEqual(kept.at(-1).rooms, []);
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

await test('an account: made with a username, password and shirt color, logged in from another device, wrong passwords lock it', async () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'farms-'));
  try {
    let farms = new Farms({ dir, log: () => {} });
    const made = await farms.register({ username: 'Niels', password: 'turnips4', color: PLAYER_COLORS[2], save: aSave(7) }, null, 'p1');
    assert.equal(made.username, 'Niels');
    assert.ok(made.token, 'a new farm, from the save');
    assert.ok(!readFileSync(joinPath(dir, `${made.id}.json`), 'utf8').includes('turnips4'), 'the password itself is not kept');
    assert.equal((await farms.register({ username: 'niels!', password: 'another1', color: PLAYER_COLORS[0], save: aSave() }, null, 'p2')).status, 409, 'taken');
    assert.equal((await farms.register({ username: 'Bo Peep', password: 'short', color: PLAYER_COLORS[0], save: aSave() }, null, 'p2')).status, 400, 'too short');
    // an old farm without an account gets one, keeping its id
    const old = farms.create(aSave(3), 'p3');
    const attached = await farms.register({ username: 'Ann', password: 'hollyhock', color: PLAYER_COLORS[1] }, farms.auth(bearer(old)), 'p3');
    assert.equal(attached.id, old.id);
    farms = new Farms({ dir, log: () => {} }); // (a restart: the usernames are gathered again)
    const back = await farms.login({ username: 'NIELS', password: 'turnips4' });
    assert.equal(back.id, made.id);
    assert.equal(back.color, PLAYER_COLORS[2]);
    assert.equal(farms.auth(bearer(back)).save.backpack.gold, 7);
    assert.deepEqual(farms.setColor(farms.auth(bearer(back)), PLAYER_COLORS[5]), { username: 'Niels', color: PLAYER_COLORS[5] });
    assert.equal(farms.open(farms.auth(bearer(back)), 'p4').color, PLAYER_COLORS[5]);
    for (let i = 0; i < 5; i++) assert.equal((await farms.login({ username: 'Niels', password: 'wrong-one' })).status, 403);
    assert.equal((await farms.login({ username: 'Niels', password: 'turnips4' })).status, 429, 'locked a while');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  // gates, arches, arbors, low walls, rail and picket fences, hedges, palisades, cobbles, gravel, stepping stones, wells, lanterns, scarecrows, hay carts, beehives, birdbaths, signposts, wattle fences, troughs, stone benches, sundials, wheelbarrows, torches, log fences, mailboxes, birdhouses, flagpoles, cairns, clotheslines and the blocks to climb on are pieces too
  for (const piece of ['wood_gate', 'wood_crate', 'stone_step', 'stone_block', 'wood_step', 'log_pile', 'wood_scaffold', 'tall_stone_block', 'stone_pillar', 'low_stone_wall', 'wood_palisade', 'wood_barrel', 'straw_bale', 'straw_stack', 'log_tower', 'stone_arch', 'cobble_path', 'rail_fence', 'wood_arbor', 'gravel_path', 'mossy_stone_block', 'stone_well', 'box_hedge', 'stepping_stones', 'tree_stump', 'crate_stack', 'stone_lantern', 'scarecrow', 'picket_fence', 'grain_sacks', 'hay_cart', 'beehive', 'birdbath', 'signpost', 'wattle_fence', 'water_trough', 'stone_bench', 'sundial', 'wheelbarrow', 'barrel_stack', 'straw_step', 'torch', 'log_fence', 'mailbox', 'birdhouse', 'flagpole', 'stone_cairn', 'clothesline']) {
    room.message(bo.p, { t: C.BUILD, key: '5,3', piece });
    assert.deepEqual(ann.conn.last(S.BUILT), { t: S.BUILT, key: '5,3', piece, by: bo.p.id });
    room.message(bo.p, { t: C.UNBUILD, key: '5,3' });
    assert.deepEqual(ann.conn.last(S.UNBUILT), { t: S.UNBUILT, key: '5,3', piece, by: bo.p.id });
  }
  // the farm's chest is a piece too, but a farm has only the one
  room.message(bo.p, { t: C.BUILD, key: '5,3', piece: 'farm_chest' });
  assert.deepEqual(ann.conn.last(S.BUILT), { t: S.BUILT, key: '5,3', piece: 'farm_chest', by: bo.p.id });
  room.message(bo.p, { t: C.BUILD, key: '5,4', piece: 'farm_chest' });
  assert.deepEqual([bo.conn.last(S.FARM_DENY).op, bo.conn.last(S.FARM_DENY).key], ['build', '5,4'], 'one chest to a farm');
  room.message(bo.p, { t: C.UNBUILD, key: '5,3' });
  room.message(bo.p, { t: C.BUILD, key: '5,4', piece: 'farm_chest' });
  assert.deepEqual(ann.conn.last(S.BUILT), { t: S.BUILT, key: '5,4', piece: 'farm_chest', by: bo.p.id }, 'taken down, it goes somewhere else');
  room.message(bo.p, { t: C.UNBUILD, key: '5,4' });
  room.message(bo.p, { t: C.BUILD, key: '5,4', piece: 'stone_path' });
  room.message(ann.p, { t: C.STATE, x: 0, y: 0.8, z: 5, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.BUILD, key: '0,4', piece: 'stone_path' });
  assert.equal(ann.conn.last(S.FARM_DENY).op, 'build', 'the plaza\'s middle stays clear');
  room.message(ann.p, { t: C.ANIMALS, state: { hens: [[1, 1, 1, 1]], built: [] } });
  assert.equal(room.built.size, 1, 'the animals can\'t take it down');
  // the house stands on 20 tiles, its door on the one it was built on; its room's field is farmed while it stands
  room.message(ann.p, { t: C.STATE, x: 112, y: 0.8, z: -2, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.TILL, key: '112,-2' });
  assert.equal(ann.conn.last(S.FARM_DENY).key, '112,-2', 'no house yet: no field');
  room.message(ann.p, { t: C.STATE, x: 8, y: 0.8, z: 11.2, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.BUILD, key: '8,10', piece: 'house' });
  assert.deepEqual(bo.conn.last(S.BUILT), { t: S.BUILT, key: '8,10', piece: 'house', by: ann.p.id });
  assert.equal(room.covered.size, 21, 'the house\'s 20 tiles, and the path');
  for (const key of ['8,9', '10,10']) {
    room.message(ann.p, { t: C.BUILD, key, piece: 'wood_path' });
    assert.equal(ann.conn.last(S.FARM_DENY).key, key, `no path in the house (${key})`);
    room.message(ann.p, { t: C.TILL, key });
    assert.equal(ann.conn.last(S.FARM_DENY).op, 'till', `no tilling in the house (${key})`);
  }
  room.message(ann.p, { t: C.BUILD, key: '7,12', piece: 'house' });
  assert.equal(ann.conn.last(S.FARM_DENY).key, '7,12', 'one house to a farm');
  room.message(ann.p, { t: C.STATE, x: 112, y: 0.8, z: -2, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.TILL, key: '112,-2' });
  assert.deepEqual(bo.conn.last(S.TILLED), { t: S.TILLED, key: '112,-2', by: ann.p.id }, 'the field');
  room.message(ann.p, { t: C.PLANT, key: '112,-2', crop: 'turnip' });
  assert.equal(bo.conn.last(S.PLANTED).key, '112,-2');
  room.message(ann.p, { t: C.STATE, x: 114, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.TILL, key: '114,3' });
  assert.equal(ann.conn.last(S.FARM_DENY).key, '114,3', 'the boards aren\'t field');
  room.message(ann.p, { t: C.STATE, x: 11.2, y: 0.8, z: 7, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.UNBUILD, key: '10,7' });
  assert.deepEqual(bo.conn.last(S.UNBUILT), { t: S.UNBUILT, key: '8,10', piece: 'house', by: ann.p.id }, 'taken down from beside any of its tiles, its back corner too');
  assert.equal(room.covered.size, 1);
  room.tilled.delete('112,-2');
  room.crops.delete('112,-2');
  room.message(ann.p, { t: C.STATE, x: 0, y: 0.8, z: 5, yaw: 0, f: 1 });
  // what the builder's backpack is short of comes out of the chest: the owner's only, only what it costs, only what is there
  room.message(bo.p, { t: C.CHEST_PUT, item: 'wood', count: 3 });
  room.message(bo.p, { t: C.BUILD, key: '5,3', piece: 'wood_fence', chest: { wood: 2 } });
  assert.deepEqual([bo.conn.last(S.FARM_DENY).op, bo.conn.last(S.FARM_DENY).key], ['build', '5,3'], 'a helper builds from their own backpack');
  for (const asked of [{ wood: 3 }, { stone: 1 }, { wood: 1.5 }, [2], 'wood']) {
    room.message(ann.p, { t: C.BUILD, key: '2,5', piece: 'wood_fence', chest: asked });
    assert.equal(ann.conn.last(S.FARM_DENY).key, '2,5', JSON.stringify(asked));
  }
  room.message(ann.p, { t: C.BUILD, key: '2,5', piece: 'wood_fence', chest: { wood: 2 } });
  assert.deepEqual(bo.conn.last(S.BUILT), { t: S.BUILT, key: '2,5', piece: 'wood_fence', by: ann.p.id });
  assert.equal(bo.conn.last(S.CHEST).items.wood, 1);
  room.message(ann.p, { t: C.BUILD, key: '2,6', piece: 'wood_fence', chest: { wood: 2 } });
  assert.equal(ann.conn.last(S.FARM_DENY).key, '2,6', 'not what isn\'t there');
  assert.ok(!room.built.has('2,6'));
  room.message(ann.p, { t: C.UNBUILD, key: '2,5' });
  room.message(ann.p, { t: C.CHEST_TAKE, item: 'wood', count: 1 });
  // the farm's rocks: broken by whoever is next to one (the stone is theirs); the room keeps when it comes back
  const stand = (who, { x, z }, dx = 1) => room.message(who.p, { t: C.STATE, x: x + dx, y: 0.8, z, yaw: 0, f: 1 });
  stand(bo, rockOf(FARM_WILDS, 3));
  room.message(bo.p, { t: C.MINE, ...rockOf(FARM_WILDS, 3) });
  const mined = ann.conn.last(S.MINED);
  assert.deepEqual([mined.id, mined.by], [3, bo.p.id]);
  assert.ok(mined.count >= 1 && mined.at > Date.now());
  stand(ann, rockOf(FARM_WILDS, 4), 8);
  room.message(ann.p, { t: C.MINE, ...rockOf(FARM_WILDS, 4) });
  assert.equal(ann.conn.last(S.MINE_DENY)?.id, 4, 'too far');
  // ...and its trees, the same way (Bo's rock was a moment ago: chopping isn't mining)
  stand(bo, treeOf(FARM_WILDS, 7));
  room.message(bo.p, { t: C.CHOP, ...treeOf(FARM_WILDS, 7) });
  const felled = ann.conn.last(S.FELLED);
  assert.deepEqual([felled.id, felled.by], [7, bo.p.id]);
  assert.ok(felled.count >= 1 && felled.at > Date.now());
  stand(ann, treeOf(FARM_WILDS, 8), 8);
  room.message(ann.p, { t: C.CHOP, ...treeOf(FARM_WILDS, 8) });
  assert.equal(ann.conn.last(S.CHOP_DENY)?.id, 8, 'too far');
  stand(bo, { x: 4, z: 3 }, 0);
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
  // lamp posts and benches made at the workbench before they were built from wood and stone come back as what they cost
  assert.deepEqual(new FarmRoom({ farm: { ...a, chest: { wood: 1, lamp_post: 2, garden_bench: 1 } }, admit: () => null }).chest, { wood: 13, stone: 4 });
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

// ---------- Cards and the arcade ----------
console.log('cards and the arcade');
await test('poker hands are told apart and ranked, and the best five of seven found', () => {
  const name = (cards) => evaluate(cards.split(' ')).name;
  assert.equal(name('As Ks Qs Js Ts'), 'Straight flush');
  assert.equal(name('9c 9d 9h 9s 2c'), 'Four of a kind');
  assert.equal(name('3c 3d 3h 7s 7c'), 'Full house');
  assert.equal(name('2h 7h 9h Jh Kh'), 'Flush');
  assert.equal(name('Ac 2d 3h 4s 5c'), 'Straight', 'the wheel');
  assert.equal(name('Qc Kd Ah 2s 3c'), 'High card', 'no wrapping round');
  assert.equal(name('5c 5d 5h'), 'Three of a kind');
  assert.equal(name('8c 8d 4h 4s'), 'Two pair');
  assert.equal(name('Jc Jd'), 'Pair');
  assert.deepEqual(evaluate(['Kc', '4d', '9h']).scoring, ['Kc'], 'a high card scores the highest');
  assert.deepEqual(evaluate(['Jc', '3d', 'Jd', '9s']).scoring, ['Jc', 'Jd']);
  const v = (cards) => evaluate(cards.split(' ')).value;
  assert.ok(v('Ac Ad 2h 3s 4c') > v('Kc Kd Qh Js 9c'), 'aces beat kings');
  assert.ok(v('Ac Ad 9h 3s 4c') > v('Ah As 8h 7s 6c'), 'then the kicker');
  assert.ok(v('6c 7d 8h 9s Tc') > v('Ac 2d 3h 4s 5c'), 'the wheel is the lowest straight');
  assert.equal(v('Ac Ad 9h 3s 4c'), v('Ah As 9c 3d 4h'), 'a split pot');
  const best = bestHand('2c 2d 7h 8h 9h Th Jh'.split(' '));
  assert.equal(best.name, 'Straight flush');
  assert.deepEqual(new Set(best.cards), new Set(['7h', '8h', '9h', 'Th', 'Jh']));
  const deck = shuffle(newDeck(), mulberry32(5));
  assert.equal(new Set(deck).size, 52);
});

await test('the arcade: coinflip doubles or loses, blackjack settles by the rules', () => {
  assert.deepEqual(coinflip(40, 'heads', () => 0.1), { side: 'heads', won: true, payout: 80 });
  assert.deepEqual(coinflip(40, 'heads', () => 0.9), { side: 'tails', won: false, payout: 0 });
  assert.deepEqual(handTotal(['As', '6d']), { total: 17, soft: true });
  assert.deepEqual(handTotal(['As', '6d', '9c']), { total: 16, soft: false });
  // a hand dealt from a stacked shoe: the dealer's cards come off second and fourth
  const deal = (cards) => {
    const rand = mulberry32(1);
    const game = blackjackDeal(10, rand);
    game.shoe = [...cards].reverse();
    Object.assign(game, { player: [], dealer: [], over: false, result: '', payout: 0 });
    game.player.push(game.shoe.pop());
    game.dealer.push(game.shoe.pop());
    game.player.push(game.shoe.pop());
    game.dealer.push(game.shoe.pop());
    return game;
  };
  let g = blackjackStand(deal(['Ts', '9d', '9c', '8h']));
  assert.equal(g.result, 'win');
  assert.equal(g.payout, 20);
  g = blackjackHit(deal(['Ts', '9d', '6c', '8h', 'Kd']));
  assert.equal(g.result, 'bust');
  assert.equal(g.payout, 0);
  g = blackjackDouble(deal(['5s', '9d', '6c', '7h', 'Td', 'Th']));
  assert.ok(g.doubled && g.over);
  assert.equal(g.stake, 20);
  assert.equal(g.result, 'dealer bust', '21 against the dealer\'s 9 + 7 + 10');
  assert.equal(g.payout, 40);
  g = blackjackStand(deal(['Ts', '9d', '7c', '9h']));
  assert.equal(g.result, 'lose');
  g = blackjackStand(deal(['Ts', '9d', '7c', '8h']));
  assert.equal(g.result, 'push');
  assert.equal(g.payout, 10);
  // a natural ends the hand as it is dealt
  let n = 0;
  for (let seed = 1; seed < 400 && !n; seed++) {
    const game = blackjackDeal(10, mulberry32(seed));
    if (game.result === 'blackjack') n = game.payout;
  }
  assert.equal(n, 25, 'a blackjack pays 3 to 2');
});

await test('Lucky Hand: jokers, plays and swaps, and the payout tiers', () => {
  assert.deepEqual(luckyScore(['Kc', 'Kd']), { cat: 1, name: 'Pair', chips: 30, mult: 2, total: 60, scoring: ['Kc', 'Kd'] });
  // 10 + 10 + 10 chips, 2 mult; +8 mult with a pair; +3 for a scoring heart; x2 needs three of a kind
  assert.equal(luckyScore(['Kh', 'Kd', '3c'], ['twin_turnips', 'rosy_heart', 'scarecrow']).total, 30 * 13);
  assert.equal(luckyScore(['Kh', 'Kd', 'Kc'], ['scarecrow', 'golden_goose']).total, (30 + 30) * 3 * 3);
  assert.equal(luckyScore(['2h', '3h', '4h', '5h', '6h'], ['garden_path', 'bouquet']).total, (100 + 20) * (8 + 22));
  for (const id of Object.keys(LUCKY_JOKERS)) assert.ok(jokerText(id).length > 10, id);
  const game = luckyStart(100, mulberry32(9));
  assert.equal(game.hand.length, LUCKY.hand);
  assert.equal(game.offer.length, LUCKY.offer);
  luckyPlay(game, [0]);
  assert.equal(game.plays, LUCKY.plays, 'a joker first');
  luckyPick(game, game.offer[0]);
  luckyDiscard(game, [0, 1, 2]);
  assert.equal(game.discards, LUCKY.discards - 1);
  assert.equal(game.hand.length, LUCKY.hand);
  luckyPlay(game, [0, 1]);
  assert.equal(game.offer.length, LUCKY.offer, 'and a second after the first hand');
  luckyPick(game, game.offer[1]);
  assert.equal(game.jokers.length, 2);
  while (!game.over) luckyPlay(game, [0, 1, 2, 3, 4]);
  assert.equal(game.offer.length, 0, 'no more than two');
  assert.equal(game.payout, Math.floor(100 * luckyPays(game.score)));
  assert.equal(luckyPays(0), 0);
  assert.equal(luckyPays(LUCKY.tiers[1][0]), LUCKY.tiers[1][1]);
  assert.equal(luckyPays(1e9), LUCKY.tiers.at(-1)[1]);
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

// An account on the server: its farm's auth, "<id>.<token>" (a lobby is for logged in farmers)
async function signUp(username, color = PLAYER_COLORS[3]) {
  const out = await fetch(`${base}/api/account/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-farm-session': `signup-${Math.random().toString(36).slice(2)}` },
    body: JSON.stringify({ username, password: 'bot-password', color, save: { v: 7, farm: null, backpack: {} } }),
  }).then((r) => r.json());
  return `${out.id}.${out.token}`;
}
let botAuth = await signUp('Bot');

// (farm: be on that farm instead; auth: whose browser it is, as "<id>.<token>")
function client(code = '', key = `key${Math.random()}`, { farm = null, auth = botAuth } = {}) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws${farm ? `?farm=${farm}` : code ? `?lobby=${code}` : ''}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters]) if (w.match(m)) waiters.splice(waiters.indexOf(w), 1) && w.done(m);
  });
  const closed = new Promise((done) => ws.on('close', (code) => done(code)));
  ws.on('open', () => ws.send(JSON.stringify({ t: C.JOIN, v: PROTOCOL_VERSION, name: 'Bot', key, ...(auth && { auth }) })));
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

  await test('a lobby is for logged in farmers: their account\'s name and shirt, whatever the page says', async () => {
    const { code } = await fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json());
    assert.equal(await client(code, 'k-nobody', { auth: null }).closed, CLOSE.NO_ACCOUNT);
    assert.equal(await client(code, 'k-forged', { auth: `${botAuth.split('.')[0]}.not-the-right-token` }).closed, CLOSE.NO_ACCOUNT);
    const fern = client(code, 'k-fern', { auth: await signUp('Fern', PLAYER_COLORS[6]) });
    const w = await fern.next(S.WELCOME);
    assert.deepEqual([w.name, w.color], ['Fern', PLAYER_COLORS[6]]);
    fern.ws.close(1000);
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
      botAuth = await signUp('Bot'); // (this server keeps its farms, and its accounts, in dir)
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
