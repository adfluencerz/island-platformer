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
import { Presence } from '../server/presence.js';
import { Leaderboards } from '../server/leaderboards.js';
import { PC, PS } from '../shared/protocol.js';
import { Store } from '../server/store.js';
import { Farms, normalizePairCode } from '../server/farms.js';
import { FarmRooms, FarmRoom } from '../server/farmroom.js';
import { C, S, farmNameKey, pinProblem } from '../shared/protocol.js';
import { PROTOCOL_VERSION, HOLD_MS, CLOSE, PLAYER_COLORS, DAY_LENGTH_SECONDS } from '../shared/constants.js';
import { GROUND_STAND_Y, SPOT_KINDS, RARE, TREE, ROCK, DROP_MS, DROP_OWN_MS, PIECES, woodFor, stoneFor, mostStone, mostWood } from '../shared/level.js';
import { islandFor, checkIsland, normalizeSeed, randomSeed, mulberry32, genOf, CURRENT_GEN, distToPaths, STONE_CIRCLE, shuffled } from '../shared/worldgen.js';
import { HOME_HALF, HOME_KEEP_CLEAR, HOME_PLATFORMS } from '../shared/farmland.js';
import { FISHING, RODS, SHOP, FISH_WEIGHT, TACKLE, AQUARIUM } from '../shared/balance.js';
import { BEANSTALK, DAY_LENGTH_SECONDS as DAY_SECONDS } from '../shared/balance.js';
import { biting, castLine, FISH_LIST, cleanLog, onBoard, boardFor, weightText, BOARD_SIZE } from '../shared/fishing.js';
import { fingerprint } from './seed-fingerprint.js';
import { requestFor } from '../src/requests.js';
import { REQUESTS } from '../shared/balance.js';
import { MORE_CROPS, PLATFORM_PLANTS } from '../shared/balance.js';
import { TRADE, cleanOffer } from '../shared/trade.js';
import { SKY_STYLES, SKY_KINDS, onIsle, relicAt } from '../shared/skyisles.js';
import { growWilds, wildsFromWire, wildsToWire, siteOf } from '../shared/wilds.js';
import { HOME_WILDS } from '../shared/homewilds.js';
import { seasonAt, SEASON_DAYS, SEASONS } from '../src/seasons.js';
import { homeWildsSource } from './wilds.js';
import { BossFight, ARENAS, ARENA_R, arenaAt, arenaStart, portalOf, waveHits, seedAt, seedHits, swarmAt, swarmHits, swoopHits, bossFromWire, BOSS_IDS } from '../shared/bosses.js';
import { BOSSES } from '../shared/balance.js';
import { levelOf, cleanSkills, overallLevel, canDoubleJump, swingsAt, bonusChance } from '../shared/skills.js';
import { SKILLS, DOUBLE_JUMP } from '../shared/balance.js';
import { newDeck, shuffle, evaluate, bestHand } from '../shared/cards.js';
import { coinflip, handTotal, blackjackDeal, blackjackHit, blackjackStand, blackjackDouble, luckyStart, luckyPick, luckyPlay, luckyDiscard, luckyScore, luckyPays, jokerText } from '../shared/arcade.js';
import { LUCKY, LUCKY_JOKERS } from '../shared/balance.js';
import { arenaFor, checkArena, HOP, LOBBY_GAMES } from '../shared/arenas.js';
import { MINIGAMES } from '../shared/balance.js';
import { WEATHER, spellOn, weatherAt, rainSince } from '../shared/weather.js';

// spot kinds only later generations grow (2 and up)
const LATER_KINDS = new Set(['heather', 'cattail', 'bluebell', 'sunflower', 'pumpkin', 'fern', 'seashell', ...SKY_KINDS, 'strawberry']);

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
  10: {"mossy-cove-7-v10":3123767506,"dewy-glade-31-v10":4279408072,"sunny-knoll-5-v10":2411265113,"golden-fen-0-v10":3674036579,"quiet-ridge-88-v10":3617889765,"willow-isle-12-v10":2907811276,"pebble-nook-64-v10":4169286385,"honey-grove-3-v10":1318108465},
  9: {"mossy-cove-7-v9":163191364,"dewy-glade-31-v9":2456990911,"sunny-knoll-5-v9":1189004014,"golden-fen-0-v9":1161798591,"quiet-ridge-88-v9":2581909254,"willow-isle-12-v9":746226636,"pebble-nook-64-v9":502613636,"honey-grove-3-v9":3163829055},
  8: {"mossy-cove-7-v8":2495688328,"dewy-glade-31-v8":1583329832,"sunny-knoll-5-v8":186462849,"golden-fen-0-v8":2840815162,"quiet-ridge-88-v8":901564798,"willow-isle-12-v8":3187697367,"pebble-nook-64-v8":1809298910,"honey-grove-3-v8":596487143},
  7: {"mossy-cove-7-v7":861000100,"dewy-glade-31-v7":2645773252,"sunny-knoll-5-v7":3262897498,"golden-fen-0-v7":2913660827,"quiet-ridge-88-v7":1012903713,"willow-isle-12-v7":142691819,"pebble-nook-64-v7":2979833659,"honey-grove-3-v7":702780834},
  2: { 'mossy-cove-7-v2': 119939977, 'dewy-glade-31-v2': 2076144126, 'sunny-knoll-5-v2': 4173192289, 'golden-fen-0-v2': 1296267364, 'quiet-ridge-88-v2': 2011619196, 'willow-isle-12-v2': 4045709457, 'pebble-nook-64-v2': 869828886, 'honey-grove-3-v2': 2547208232 },
  6: {"mossy-cove-7-v6":3096900676,"dewy-glade-31-v6":2629822513,"sunny-knoll-5-v6":163208784,"golden-fen-0-v6":1784216000,"quiet-ridge-88-v6":2185361121,"willow-isle-12-v6":3551543839,"pebble-nook-64-v6":755167583,"honey-grove-3-v6":164978941},
  5: {"mossy-cove-7-v5":450326002,"dewy-glade-31-v5":3459739216,"sunny-knoll-5-v5":3901735779,"golden-fen-0-v5":2353024595,"quiet-ridge-88-v5":3223947397,"willow-isle-12-v5":3675653226,"pebble-nook-64-v5":2655493373,"honey-grove-3-v5":803211333},
  4: {"mossy-cove-7-v4":1587304027,"dewy-glade-31-v4":2535534902,"sunny-knoll-5-v4":4282641216,"golden-fen-0-v4":2506278968,"quiet-ridge-88-v4":1283944460,"willow-isle-12-v4":2433746912,"pebble-nook-64-v4":2936599587,"honey-grove-3-v4":3566523821},
  3: { 'mossy-cove-7-v3': 2325607642, 'dewy-glade-31-v3': 395772194, 'sunny-knoll-5-v3': 1431089034, 'golden-fen-0-v3': 572641172, 'quiet-ridge-88-v3': 2526362288, 'willow-isle-12-v3': 1353456352, 'pebble-nook-64-v3': 3529699339, 'honey-grove-3-v3': 2551931431 },
};
await test('generation 2 to 10 seeds grow exactly the islands they did, with nothing newer', () => {
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
      if (Number(gen) < 10) assert.ok(!islandFor(seed).sky && !islandFor(seed).spots.some(([k]) => SKY_KINDS.includes(k)), `"${seed}" grew generation 10 things`);
      assert.ok(!islandFor(seed).bank && !islandFor(seed).spots.some(([k]) => k === 'strawberry'), `"${seed}" grew generation 11 things`);
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

// Generations 8 and 9: a fern glen, then shell dunes, on most islands (and
// generation 11: a strawberry bank)
for (const [gen, name, area, kind, ground] of [[8, 'a fern glen', 'glen', 'fern', 'glen'], [9, 'shell dunes', 'dunes', 'seashell', 'dune'], [11, 'a strawberry bank', 'bank', 'strawberry', 'bank']]) {
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
    const seed = randomSeed(mulberry32(i)).replace(/-v\d+$/, '-v10');
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

await test('dropping things out of the backpack: at your feet, for anyone (not straight back to you); never tools or coins', () => {
  const room = new Room({ code: 'TEST16' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const { x: sx, z: sz } = room.island.spawn;
  const at = (who, x, z) => room.message(who.p, { t: C.STATE, x: sx + x, y: 0.8, z: sz + z, yaw: 0, f: 1 });
  at(a, 8, 0);
  a.p.bag = { wood: 5 };
  room.message(a.p, { t: C.THROW, item: 'wood', count: 4 });
  const drop = b.conn.last(S.DROP);
  assert.deepEqual([drop.item, drop.count, drop.from, drop.wait], ['wood', 4, a.p.id, DROP_OWN_MS]);
  assert.deepEqual([drop.x, drop.y, drop.z], [sx + 8, GROUND_STAND_Y, sz], 'at their feet, on the ground');
  assert.equal(a.p.bag.wood, 1, 'out of what a bop could knock loose');
  room.message(a.p, { t: C.PICKUP, id: drop.id });
  assert.equal(a.conn.last(S.DROP_DENY).id, drop.id, 'not straight back');
  at(b, 8, 0.5);
  room.message(b.p, { t: C.PICKUP, id: drop.id });
  assert.deepEqual([b.conn.last(S.PICKED).by, b.p.bag.wood], [b.p.id, 4]);
  // what can't be dropped comes back, to go back into the backpack
  const deny = (msg, why) => {
    a.p.throwAt = 0;
    const before = a.conn.all(S.THROW_DENY).length;
    room.message(a.p, { t: C.THROW, ...msg });
    assert.equal(a.conn.all(S.THROW_DENY).length, before + 1, why);
    assert.deepEqual([a.conn.last(S.THROW_DENY).item, a.conn.last(S.THROW_DENY).count], [typeof msg.item === 'string' ? msg.item : null, Number.isInteger(msg.count) ? msg.count : 0]);
  };
  deny({ item: 'axe', count: 1 }, 'a tool');
  deny({ item: 'coin', count: 5 }, 'coins');
  deny({ item: 'nonsense', count: 1 }, 'no such thing');
  deny({ item: 'wood', count: 0 }, 'none of it');
  deny({ item: 'wood', count: 1.5 }, 'a part of one');
  deny({ item: { x: 1 }, count: 1 }, 'not an item at all');
  a.p.throwAt = 0;
  room.message(a.p, { t: C.THROW, item: 'stone', count: 1 });
  room.message(a.p, { t: C.THROW, item: 'stone', count: 1 });
  assert.equal(a.conn.last(S.THROW_DENY).item, 'stone', 'not so fast');
  at(a, room.island.half + 5, 0);
  deny({ item: 'stone', count: 1 }, 'out over the sea');
  // off in a party game's arena: not the lobby's ground
  at(a, 8, 0);
  a.p.game = 1;
  deny({ item: 'stone', count: 1 }, 'in an arena');
});

await test('trading in a lobby: ask and ask back, offer, both ready on the same offers, and each hears what to give and get', () => {
  const room = new Room({ code: 'TRADE' });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const c = join(room, 'C');
  const { x: sx, z: sz } = room.island.spawn;
  const at = (who, x, z) => room.message(who.p, { t: C.STATE, x: sx + x, y: 0.8, z: sz + z, yaw: 0, f: 1 });
  at(a, 0, 0);
  at(b, TRADE.reach + 1, 0);
  at(c, 1, 0);
  room.message(a.p, { t: C.TRADE_ASK, id: b.p.id });
  assert.equal(b.conn.last(S.TRADE_ASKED), undefined, 'too far off to ask');
  at(b, 2, 0);
  room.trades.asks.clear();
  room.message(a.p, { t: C.TRADE_ASK, id: b.p.id });
  assert.deepEqual([b.conn.last(S.TRADE_ASKED).from, b.conn.last(S.TRADE_ASKED).name], [a.p.id, 'A']);
  assert.equal(a.conn.last(S.TRADE), undefined, 'not open till they ask back');
  room.message(b.p, { t: C.TRADE_ASK, id: a.p.id });
  const opened = a.conn.last(S.TRADE);
  assert.deepEqual([opened.with, opened.mine, opened.theirs, opened.ready], [b.p.id, { items: {}, gold: 0 }, { items: {}, gold: 0 }, false]);
  // someone else can't butt in
  room.message(c.p, { t: C.TRADE_ASK, id: a.p.id });
  assert.equal(a.conn.all(S.TRADE_ASKED).length, 0);
  // offers: what can be traded, made sane
  a.p.bag = { berries: 5 };
  room.message(a.p, { t: C.TRADE_OFFER, items: { berries: 3 }, gold: 10 });
  room.message(b.p, { t: C.TRADE_OFFER, items: { wood: 5 } });
  for (const bad of [{ items: { axe: 1 } }, { items: { coin: 5 } }, { items: { wood: 0 } }, { items: { wood: 1.5 } }, { items: { wood: 1 }, gold: -1 }, { items: [] , gold: 'x' }]) {
    assert.equal(cleanOffer(bad), null, JSON.stringify(bad));
  }
  room.message(b.p, { t: C.TRADE_OFFER, items: { axe: 1 } });
  let now = b.conn.last(S.TRADE);
  assert.deepEqual([now.mine, now.theirs], [{ items: { wood: 5 }, gold: 0 }, { items: { berries: 3 }, gold: 10 }], 'a bad offer changes nothing');
  // ready, on the offers as they were seen: a change takes both back
  room.message(a.p, { t: C.TRADE_READY, ready: true, v: now.v });
  assert.equal(b.conn.last(S.TRADE).theirsReady, true);
  room.message(a.p, { t: C.TRADE_OFFER, items: { berries: 2 }, gold: 10 });
  now = b.conn.last(S.TRADE);
  assert.equal(now.theirsReady, false, 'changing an offer takes the ready back');
  room.message(b.p, { t: C.TRADE_READY, ready: true, v: now.v - 1 });
  assert.equal(a.conn.last(S.TRADE).theirsReady, false, 'ready on an old offer: no');
  room.message(b.p, { t: C.TRADE_READY, ready: true, v: now.v });
  room.message(a.p, { t: C.TRADE_READY, ready: true, v: now.v });
  const doneA = a.conn.last(S.TRADE_DONE);
  const doneB = b.conn.last(S.TRADE_DONE);
  assert.deepEqual([doneA.give, doneA.get], [{ items: { berries: 2 }, gold: 10 }, { items: { wood: 5 }, gold: 0 }]);
  assert.deepEqual([doneB.give, doneB.get], [doneA.get, doneA.give]);
  assert.equal(a.p.bag.berries, 3, 'what they gave a bop can no longer knock loose');
  assert.equal(room.trades.open.size, 0);
  // walking apart ends one, and so does calling it off
  room.message(a.p, { t: C.TRADE_ASK, id: b.p.id });
  room.trades.asks.get(a.p.id).at -= TRADE.askEvery;
  room.message(b.p, { t: C.TRADE_ASK, id: a.p.id });
  assert.equal(room.trades.open.size, 2);
  at(b, TRADE.far + 1, 0);
  room.update();
  assert.deepEqual([a.conn.last(S.TRADE_END).why, b.conn.last(S.TRADE_END).why], ['far', 'far']);
  at(b, 2, 0);
  room.trades.asks.clear();
  room.message(a.p, { t: C.TRADE_ASK, id: b.p.id });
  room.message(b.p, { t: C.TRADE_ASK, id: a.p.id });
  room.message(b.p, { t: C.TRADE_CANCEL });
  assert.deepEqual([a.conn.last(S.TRADE_END).why, a.conn.last(S.TRADE_END).by], ['cancelled', b.p.id]);
  // and going away
  room.trades.asks.clear();
  room.message(a.p, { t: C.TRADE_ASK, id: b.p.id });
  room.message(b.p, { t: C.TRADE_ASK, id: a.p.id });
  room.leave(b.p);
  room.update();
  assert.deepEqual([a.conn.last(S.TRADE_END).why, a.conn.last(S.TRADE_END).by], ['gone', b.p.id]);
  room.close();
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
  // the drop: not straight back to B, standing on it (A gets a look in)
  assert.deepEqual([drop.from, drop.wait], [b.p.id, DROP_OWN_MS]);
  room.message(b.p, { t: C.PICKUP, id: drop.id });
  assert.equal(b.conn.last(S.DROP_DENY).id, drop.id, 'not straight back');
  // too far for A; a while later, B walks into it and gets it back (to be knocked loose again)
  at(a, 12, 0);
  room.message(a.p, { t: C.PICKUP, id: drop.id });
  assert.equal(a.conn.last(S.DROP_DENY).id, drop.id);
  room.drops.get(drop.id).ownAt = Date.now() - 1;
  room.message(b.p, { t: C.PICKUP, id: drop.id });
  assert.deepEqual([a.conn.last(S.PICKED).by, b.p.bag.wood], [b.p.id, 3]);
  room.message(a.p, { t: C.PICKUP, id: drop.id });
  assert.equal(a.conn.all(S.DROP_DENY).length, 2, 'gone');
  // and knocked loose again, A can take it straight away
  at(a, 8, 0);
  b.p.boppedAt = 0;
  a.p.bopAt = 0;
  room.message(a.p, { t: C.BOP, weapon: 'wooden_sword', yaw: 0 });
  const again = a.conn.last(S.DROP);
  at(a, 8, 1.2);
  room.message(a.p, { t: C.PICKUP, id: again.id });
  assert.deepEqual([a.conn.last(S.PICKED).id, a.conn.last(S.PICKED).by], [again.id, a.p.id]);
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
  assert.equal(b.conn.all(S.BOPPED).length, 3, 'nobody is bopped by the spawn');
  // drops fade, and a newcomer sees the ones still about
  at(a, 8, 0);
  at(b, 8, 1.2);
  b.p.bag = { stone: 5 };
  b.p.boppedAt = 0;
  a.p.bopAt = 0;
  room.message(a.p, { t: C.BOP, weapon: 'mallet', yaw: 0 });
  assert.deepEqual(b.conn.last(S.BOPPED).drop, ['stone', 2]);
  const seen = join(room, 'C').conn.last(S.WELCOME).drops;
  assert.equal(seen.length, 1);
  assert.equal(seen[0][6], b.p.id, 'whose it was, for a newcomer too');
  room.update(Date.now() + DROP_MS + 100);
  assert.equal(a.conn.last(S.PICKED).by, 0);
  assert.equal(room.drops.size, 0);
});

console.log('party games');
// An arena's fingerprint: where its bales and coins are (shared/arenas.js)
const arenaPrint = (a) => {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify([a.coast, a.bales, a.coins])) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h;
};
await test('every seed grows a sound coin rush arena, the same every time', () => {
  for (let i = 0; i < 200; i++) {
    const seed = `arena-${i}`;
    const arena = arenaFor('coin_rush', seed, { cached: false });
    assert.ok(arena, seed);
    assert.deepEqual(checkArena(arena), [], seed);
    const [lo, hi] = MINIGAMES.coin_rush.coins;
    assert.ok(arena.coins.length >= lo && arena.coins.length <= hi, seed);
    assert.ok(arena.coins.some(([, y]) => y > 1), `${seed}: coins up on the bales`);
    assert.equal(arenaPrint(arenaFor('coin_rush', seed, { cached: false })), arenaPrint(arena));
  }
  assert.notEqual(arenaPrint(arenaFor('coin_rush', 'a')), arenaPrint(arenaFor('coin_rush', 'b')));
  assert.equal(arenaFor('hopscotch', 'a'), null);
});

// Arenas players know must never change: grow a new kind (or generation) instead
const ARENA_SEEDS = { 'meadow': 2486539853, 'dewy-glade-31': 2502642802, 'amber-hollow-58': 97696243, 'willow-meadow-54': 3570715387 };
await test('coin rush arenas grow exactly as they always did', () => {
  for (const [seed, print] of Object.entries(ARENA_SEEDS)) assert.equal(arenaPrint(arenaFor('coin_rush', seed, { cached: false })), print, seed);
});

// A lobby opened for a party game (on the classic island): Ann, Bo and Cy in
// it (`who`: the names that come), everyone gathered, from the first one there
function gameRoom(game, who = ['Ann', 'Bo', 'Cy']) {
  const room = new Room({ code: 'PARTY1', game, rand: mulberry32(7) });
  const [a, b, c] = who.map((name) => join(room, name));
  const stand = (who, x, y, z) => room.message(who.p, { t: C.STATE, x, y, z, yaw: 0, f: 1 });
  return { room, a, b, c, stand };
}
await test('a lobby opened for a game: everyone who comes is in it, it starts a while after the first one gets there, and takes nobody new once it is on', () => {
  const room = new Room({ code: 'PARTY1', game: 'coin_rush', rand: mulberry32(7) });
  assert.equal(room.party.wire().phase, 'gathering');
  assert.equal(room.party.wire().ms, -1, 'waiting for the first farmer');
  assert.deepEqual([room.info().game, room.info().open], ['coin_rush', true]);
  const a = join(room, 'Ann');
  const gathering = a.conn.last(S.WELCOME).game;
  assert.deepEqual(gathering.players, [[a.p.id, 0]]);
  assert.ok(gathering.ms > MINIGAMES.gatherMs - 100 && gathering.ms <= MINIGAMES.gatherMs);
  assert.equal(a.conn.last(S.WELCOME).room.game, 'coin_rush');
  assert.ok(a.conn.all(S.CHAT).some((m) => /^Coin rush starts in 15 s/.test(m.text)));
  const b = join(room, 'Bo');
  const c = join(room, 'Cy');
  assert.deepEqual(a.conn.last(S.GAME).game.players.map(([id]) => id), [a.p.id, b.p.id, c.p.id]);
  // (no starting or leaving it from the lobby: everyone there is in it)
  room.message(c.p, { t: 'gameLeave' });
  assert.equal(room.party.game.players.size, 3);

  const now = Date.now();
  room.update(now + MINIGAMES.gatherMs + 10);
  const { game } = c.conn.last(S.GAME);
  assert.equal(game.phase, 'ready');
  const arena = arenaFor('coin_rush', game.seed);
  assert.deepEqual([a.p.x, a.p.z], [arena.start(0, 3).x, arena.start(0, 3).z]);
  assert.deepEqual([b.p.x, b.p.z], [arena.start(1, 3).x, arena.start(1, 3).z]);
  assert.ok(a.p.game && b.p.game && c.p.game);
  const roster = c.conn.last(S.ROSTER).list;
  assert.equal(roster.find((p) => p.id === a.p.id).game, game.id, 'pages know who is away');
  // nobody new now...
  assert.equal(room.info().open, false);
  const d = join(room, 'Di');
  assert.equal(d.p, null);
  assert.equal(d.conn.closed, CLOSE.STARTED);
  // ...but a reload in the arena comes back to it
  room.leave(b.p);
  const b2 = { conn: fakeConn() };
  room.join(b2.conn, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Bo', key: 'Bo' });
  assert.equal(b2.conn.last(S.WELCOME).game.phase, 'ready');
  assert.deepEqual(b2.conn.last(S.WELCOME).pos, { x: b.p.x, y: b.p.y, z: b.p.z });
});

await test('coin rush: a coin counts once, for whoever is by it, only while it is on; the winner gets the prize, and the lobby is over', () => {
  const { room, a, b, stand } = gameRoom('coin_rush', ['Ann', 'Bo']);
  const now = Date.now();
  room.update(now + MINIGAMES.gatherMs + 10);
  const arena = room.party.game.arena;
  const [x, y, z] = arena.coins[0];
  stand(a, x, y + 0.1, z);
  room.message(a.p, { t: C.GAME_COIN, id: 0 });
  assert.equal(a.conn.last(S.GAME_COIN), undefined, 'not before it starts');
  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + 20);
  assert.equal(b.conn.last(S.GAME).game.phase, 'playing');
  room.message(b.p, { t: C.GAME_COIN, id: 0 });
  assert.equal(a.conn.last(S.GAME_COIN), undefined, 'not from over there');
  room.message(a.p, { t: C.GAME_COIN, id: 0 });
  room.message(a.p, { t: C.GAME_COIN, id: 0 });
  room.message(a.p, { t: C.GAME_COIN, id: 999 });
  assert.deepEqual(b.conn.all(S.GAME_COIN), [{ t: S.GAME_COIN, id: 0, by: a.p.id, score: 1 }]);
  // nothing of the lobby's while away: its spots
  const spot = spotOf('meadow');
  standAt(room, a, spot);
  room.message(a.p, { t: C.TAKE, id: spot });
  assert.deepEqual(a.conn.last(S.DENY), { t: S.DENY, id: spot });
  assert.ok(room.spots[spot].item);
  // ...but in the arena, playful bops (knocked back, nothing knocked loose)
  stand(a, 0, 0.8, -20);
  stand(b, 0, 0.8, -21);
  a.p.bag.wood = 3;
  room.message(b.p, { t: C.BOP, weapon: 'mallet', yaw: 0 });
  assert.equal(a.conn.last(S.BOPPED).id, a.p.id);
  assert.equal(a.conn.last(S.BOPPED).drop, null);

  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + MINIGAMES.coin_rush.ms + 50);
  const end = b.conn.last(S.GAME_END);
  assert.equal(end.winner, a.p.id);
  assert.deepEqual(end.scores, [[a.p.id, 1], [b.p.id, 0]]);
  const prize = new Map(end.prizes);
  const { coins, perPlayer, played } = MINIGAMES.prize;
  assert.deepEqual(prize.get(a.p.id)[0], ['coin', coins + perPlayer]);
  assert.equal(prize.get(a.p.id).length, 2, 'and a roll of loot');
  assert.ok(MINIGAMES.prize.loot.some(([item]) => item === prize.get(a.p.id)[1][0]));
  const [, n] = prize.get(b.p.id)[0];
  assert.ok(n >= played[0] && n <= played[1]);
  assert.equal(b.conn.last(S.GAME).game, null);
  assert.ok(!a.p.game && !b.p.game);
  assert.ok(Math.hypot(a.p.x - room.island.spawn.x, a.p.z - room.island.spawn.z) < STONE_CIRCLE, 'back where farmers arrive');
  assert.deepEqual(end.pos.map(([id]) => id), [a.p.id, b.p.id]);
  assert.match(b.conn.last(S.CHAT).text, /Ann won the coin rush with 1 coin!/);
  // that was the lobby's game: nobody new comes now
  assert.ok(room.party.over);
  assert.equal(room.info().open, false);
  assert.equal(join(room, 'Cy').conn.closed, CLOSE.STARTED);
});

await test('a lobby\'s game is called off once everyone in it has gone (before it starts, it waits for whoever comes); nobody scoring means no winner', () => {
  const { room, a, b } = gameRoom('coin_rush', ['Ann', 'Bo']);
  room.leave(a.p, { hold: false }); // (headed home)
  room.leave(b.p, { hold: false });
  assert.equal(room.party.game.phase, 'gathering', 'still waiting');
  assert.equal(room.party.wire().ms, -1);
  assert.ok(!room.party.over);
  const c = join(room, 'Cy');
  const d = join(room, 'Di');
  const now = Date.now();
  room.update(now + MINIGAMES.gatherMs + 10);
  assert.equal(room.party.game.phase, 'ready');
  room.leave(c.p, { hold: false });
  assert.ok(room.party.game && d.p.game);
  room.leave(d.p, { hold: false });
  assert.equal(room.party.game, null);
  assert.ok(room.party.over);

  const alone = gameRoom('coin_rush', ['Ann']);
  alone.room.update(now + MINIGAMES.gatherMs + 10);
  alone.room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + 20); // (a phase a tick)
  alone.room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + MINIGAMES.coin_rush.ms + 50);
  const end = alone.a.conn.last(S.GAME_END);
  assert.equal(end.winner, 0);
  assert.deepEqual(end.prizes, [[alone.a.p.id, end.prizes[0][1]]]);
  assert.equal(end.prizes[0][1][0][0], 'coin', 'a few coins for playing');
  assert.match(alone.a.conn.last(S.CHAT).text, /The coin rush is over: nobody picked up a coin./);
});

await test('a loot run: on the lobby\'s own island, from the stone circle; every find scores (rare ones more), only while it is on; drop in any time', () => {
  const { room, a, b, stand } = gameRoom('loot_run', ['Ann', 'Bo']);
  assert.ok(a.conn.all(S.CHAT).some((m) => /^Loot run starts in 15 s/.test(m.text)));
  const plain = (kind) => room.spots.findIndex((s) => s.item && !RARE[s.item] && !s.bundle && s.kind === kind);
  const meadow = plain('meadow');
  const rare = room.spots.findIndex((s) => s.item && RARE[s.item] && !s.bundle && s.kind !== 'sky_vault');
  assert.ok(meadow >= 0 && rare >= 0, 'every lobby has its old key');
  standAt(room, a, meadow);
  room.message(a.p, { t: C.TAKE, id: meadow });
  assert.deepEqual(a.conn.last(S.DENY), { t: S.DENY, id: meadow }, 'not before it starts');
  assert.ok(room.spots[meadow].item);
  let now = Date.now() + MINIGAMES.gatherMs + 10;
  room.update(now);
  assert.equal(room.party.game.phase, 'ready');
  assert.ok(!a.p.game && !b.p.game, 'no arena: still on the island');
  assert.deepEqual([a.p.x, a.p.z], [room.spawnFor(a.p.id).x, room.spawnFor(a.p.id).z], 'back in the stone circle to start');
  assert.equal(room.info().open, true, 'a loot run can be dropped in on');
  room.update((now += MINIGAMES.readyMs));
  assert.equal(room.party.game.phase, 'playing');
  // a find: a point; a rare one more
  standAt(room, a, meadow);
  room.message(a.p, { t: C.TAKE, id: meadow });
  assert.deepEqual(b.conn.last(S.GAME_SCORE), { t: S.GAME_SCORE, by: a.p.id, score: MINIGAMES.loot_run.find });
  standAt(room, b, rare);
  room.message(b.p, { t: C.TAKE, id: rare });
  const score = MINIGAMES.loot_run.find + MINIGAMES.loot_run.rare;
  assert.deepEqual(a.conn.last(S.GAME_SCORE), { t: S.GAME_SCORE, by: b.p.id, score });
  // farmers may drop in, and play from then on
  const c = join(room, 'Cy');
  assert.ok(c.p);
  assert.deepEqual(c.conn.last(S.WELCOME).game.players.find(([id]) => id === c.p.id), [c.p.id, 0]);
  // empty hands don't shove here (it isn't an arena)
  stand(a, 0, 0.8, -20);
  stand(c, 0, 0.8, -21);
  room.message(c.p, { t: C.BOP, weapon: 'shove', yaw: 0 });
  assert.equal(a.conn.last(S.BOPPED), undefined);

  room.update((now += MINIGAMES.loot_run.ms + 50));
  const end = a.conn.last(S.GAME_END);
  assert.equal(end.game, 'loot_run');
  assert.equal(end.winner, b.p.id);
  assert.deepEqual(end.scores, [[b.p.id, score], [a.p.id, 1], [c.p.id, 0]]);
  assert.deepEqual(end.pos, [], 'nobody to bring back');
  assert.equal(new Map(end.prizes).get(b.p.id).length, 2);
  assert.match(a.conn.last(S.CHAT).text, new RegExp(`Bo won the loot run with ${score} points!`));
  // over: the island is closed to looting, and to newcomers
  const left = plain('meadow');
  standAt(room, a, left);
  room.message(a.p, { t: C.TAKE, id: left });
  assert.deepEqual(a.conn.last(S.DENY), { t: S.DENY, id: left });
  assert.equal(room.info().open, false);
  assert.equal(join(room, 'Di').conn.closed, CLOSE.STARTED);
});

await test('a loot run is over early once the island is picked clean', () => {
  const { room, a } = gameRoom('loot_run', ['Ann']);
  let now = Date.now() + MINIGAMES.gatherMs + 10;
  room.update(now);
  room.update((now += MINIGAMES.readyMs));
  for (const spot of room.spots) Object.assign(spot, { item: null, count: 0 });
  room.update((now += 50));
  assert.equal(a.conn.last(S.GAME_END).game, 'loot_run');
  assert.ok(room.party.over);
});

await test('a lobby without a game is a plain one to roam: anyone in, any time, spots for the taking', () => {
  const room = new Room({ code: 'ROAM', game: 'tag' });
  assert.equal(room.game, null, 'not a game there is');
  const a = join(room, 'Ann');
  assert.equal(a.conn.last(S.WELCOME).game, null);
  const meadow = spotOf('meadow');
  standAt(room, a, meadow);
  room.message(a.p, { t: C.TAKE, id: meadow });
  assert.equal(a.conn.last(S.TAKEN).id, meadow);
  assert.equal(room.info().open, true);
});
// King of the hill's arena's fingerprint: where its hill and bales are
const hillPrint = (a) => arenaPrint({ coast: a.coast, bales: [a.hill, a.bales], coins: [] });
// (as for coin rush: these must never change)
const HILL_SEEDS = { 'meadow': 764127896, 'dewy-glade-31': 890417291 };
await test('every seed grows a sound king of the hill arena, the same every time', () => {
  for (let i = 0; i < 200; i++) {
    const seed = `hill-${i}`;
    const arena = arenaFor('king_of_hill', seed, { cached: false });
    assert.ok(arena, seed);
    assert.deepEqual(checkArena(arena), [], seed);
    assert.equal(arena.hill.length, 3, seed);
    assert.ok(arena.onCrown(arena.crown[0], arena.crown[4], arena.crown[1]), seed);
    for (let k = 0; k < 8; k++) assert.ok(Math.hypot(arena.start(k, 8).x, arena.start(k, 8).z) > 7, `${seed}: starts round the edge`);
    assert.equal(hillPrint(arenaFor('king_of_hill', seed, { cached: false })), hillPrint(arena));
  }
  for (const [seed, print] of Object.entries(HILL_SEEDS)) assert.equal(hillPrint(arenaFor('king_of_hill', seed, { cached: false })), print, seed);
});

await test('king of the hill: time on the crown counts, a second a point; empty hands shove there', () => {
  const { room, a, b, stand } = gameRoom('king_of_hill', ['Ann', 'Bo']);
  let now = Date.now() + MINIGAMES.gatherMs + 10;
  room.update(now);
  const { arena } = room.party.game;
  const [cx, cz, , , top] = arena.crown;
  stand(a, cx, top + 0.8, cz);
  room.update((now += 100));
  assert.equal(a.conn.last(S.GAME_SCORE), undefined, 'not before it starts');
  room.update((now += MINIGAMES.readyMs));
  for (let i = 0; i < 50; i++) room.update((now += 50)); // 2.5 s
  stand(b, cx + 0.4, top + 0.8, cz); // b climbs up too
  for (let i = 0; i < 25; i++) room.update((now += 50)); // 1.25 s more
  const score = b.conn.last(S.GAME_SCORE);
  assert.deepEqual(score.top, [a.p.id, b.p.id]);
  assert.deepEqual(new Map(score.scores).get(a.p.id), 3);
  assert.deepEqual(new Map(score.scores).get(b.p.id), 1);
  // a stall in the ticks gives nobody a lot
  room.update((now += 10_000));
  assert.ok(new Map(b.conn.last(S.GAME_SCORE).scores).get(a.p.id) <= 4);
  // empty hands shove in this arena
  room.message(b.p, { t: C.BOP, weapon: 'shove', yaw: -Math.PI / 2 });
  assert.equal(a.conn.last(S.BOPPED).knock, MINIGAMES.shove.knock);
  // down off the hill: nothing more counts
  stand(a, arena.start(0, 2).x, 0.8, arena.start(0, 2).z);
  room.update((now += 50));
  assert.deepEqual(b.conn.last(S.GAME_SCORE).top, [b.p.id]);
  room.update((now += MINIGAMES.king_of_hill.ms));
  const end = b.conn.last(S.GAME_END);
  assert.equal(end.winner, a.p.id);
  assert.match(b.conn.last(S.CHAT).text, /Ann won the king of the hill with \d+ s on top!/);
});
// Last one standing's arena's fingerprint: its tiles, the order they drop in, the islet
const floorPrint = (a) => arenaPrint({ coast: a.coast, bales: [a.tiles, a.order], coins: [] });
const FLOOR_SEEDS = { 'meadow': 3168082783, 'dewy-glade-31': 408035169 }; // (as for coin rush: these must never change)
await test('every seed grows a sound last one standing arena, the same every time', () => {
  const { ms, graceMs, quietMs, keep } = MINIGAMES.last_one;
  for (let i = 0; i < 200; i++) {
    const seed = `floor-${i}`;
    const arena = arenaFor('last_one', seed, { cached: false });
    assert.ok(arena, seed);
    assert.deepEqual(checkArena(arena), [], seed);
    const falls = arena.fallAt.filter(Number.isFinite);
    assert.equal(falls.length, arena.tiles.length - keep, seed);
    assert.ok(Math.min(...falls) > graceMs && Math.max(...falls) <= ms - quietMs + 1, seed);
    assert.ok(arena.isLand(arena.watch(0, 1).x, arena.watch(0, 1).z), `${seed}: washed up on the islet`);
    assert.equal(floorPrint(arenaFor('last_one', seed, { cached: false })), floorPrint(arena));
  }
  for (const [seed, print] of Object.entries(FLOOR_SEEDS)) assert.equal(floorPrint(arenaFor('last_one', seed, { cached: false })), print, seed);
});

// a and b (and c, if `three`) in a game of last one standing, playing from `now`
function lastOneRoom(three = false) {
  const party = gameRoom('last_one', three ? ['Ann', 'Bo', 'Cy'] : ['Ann', 'Bo']);
  const { room } = party;
  let now = Date.now() + MINIGAMES.gatherMs + 10;
  room.update(now);
  room.update((now += MINIGAMES.readyMs));
  return { ...party, now };
}
await test('last one standing: whoever falls in is out; the last one up wins, there and then', () => {
  let { room, a, b, c, stand, now } = lastOneRoom(true);
  const { arena } = room.party.game;
  assert.deepEqual(room.party.wire(now).top, [a.p.id, b.p.id, c.p.id]);
  room.update((now += 5000));
  stand(a, a.p.x, -1, a.p.z); // splash
  room.update((now += 50));
  const score = b.conn.last(S.GAME_SCORE);
  assert.deepEqual(score.top, [b.p.id, c.p.id]);
  assert.equal(new Map(score.scores).get(a.p.id), 5);
  stand(a, a.p.x, 0.8, a.p.z); // (back up: still out)
  const islet = arena.watch(0, 3);
  stand(c, islet.x, islet.y, islet.z); // washed up on the islet: out too
  room.update((now += 3000));
  const end = b.conn.last(S.GAME_END);
  assert.deepEqual(end.winners, [b.p.id]);
  assert.equal(end.winner, b.p.id);
  assert.deepEqual(end.scores.map(([id]) => id), [b.p.id, c.p.id, a.p.id]);
  assert.match(b.conn.last(S.CHAT).text, /Bo won the last one standing with 8 s up!/);
  assert.equal(new Map(end.prizes).get(b.p.id).length, 2);
});

await test('last one standing: everyone still up when the time runs out wins', () => {
  let { room, a, b, now } = lastOneRoom();
  room.update((now += MINIGAMES.last_one.ms + 50));
  const end = a.conn.last(S.GAME_END);
  assert.deepEqual(end.winners.toSorted(), [a.p.id, b.p.id].toSorted());
  assert.ok(end.prizes.every(([, got]) => got.length === 2), 'a prize each');
  assert.match(a.conn.last(S.CHAT).text, /(Ann and Bo|Bo and Ann) won the last one standing/);
});

// The hop race's arena's fingerprint: its meadow, its hops and its goal
const racePrint = (a) => arenaPrint({ coast: a.coast, bales: [a.hops, a.goal], coins: [] });
const RACE_SEEDS = { 'meadow': 3284256935, 'dewy-glade-31': 80847400 }; // (as for coin rush: these must never change)
await test('every seed grows a sound hop race, the same every time', () => {
  for (let i = 0; i < 200; i++) {
    const seed = `race-${i}`;
    const arena = arenaFor('hop_race', seed, { cached: false });
    assert.ok(arena, seed);
    assert.deepEqual(checkArena(arena), [], seed);
    assert.ok(arena.hops.length >= HOP.count[0] - 1, seed);
    assert.ok(arena.onGoal(arena.goal[0], arena.goal[3], arena.goal[1]), seed);
    assert.ok(!arena.onGoal(0, 0, 0), `${seed}: not at the start`);
    assert.equal(racePrint(arenaFor('hop_race', seed, { cached: false })), racePrint(arena));
  }
  for (const [seed, print] of Object.entries(RACE_SEEDS)) assert.equal(racePrint(arenaFor('hop_race', seed, { cached: false })), print, seed);
});

await test('the hop race: whoever gets to the goal is across, first one there wins; over when everyone is', () => {
  const { room, a, b, c, stand } = gameRoom('hop_race');
  let now = Date.now() + MINIGAMES.gatherMs + 10;
  room.update(now);
  const { arena } = room.party.game;
  const [gx, gz, , top] = arena.goal;
  stand(b, gx, top + 0.8, gz);
  room.update((now += 100));
  assert.equal(b.conn.last(S.GAME_SCORE), undefined, 'not before it starts');
  room.update((now += MINIGAMES.readyMs));
  room.update((now += 20_000)); // b there 20 s in: 70 s to spare
  const first = a.conn.last(S.GAME_SCORE);
  assert.deepEqual(first.top, [b.p.id]);
  assert.equal(new Map(first.scores).get(b.p.id), 70);
  assert.match(a.conn.last(S.CHAT).text, /Bo made it across, first!/);
  stand(a, gx + 0.5, top + 0.8, gz);
  room.update((now += 5000));
  assert.deepEqual(c.conn.last(S.GAME_SCORE).top, [b.p.id, a.p.id]);
  assert.equal(room.party.game?.kind, 'hop_race', 'still on: Cy is hopping');
  stand(c, gx, top + 1.5, gz - 0.5); // (hopping about on the goal counts)
  room.update((now += 50));
  const end = a.conn.last(S.GAME_END);
  assert.equal(end.winner, b.p.id);
  assert.deepEqual(end.scores.map(([id]) => id), [b.p.id, a.p.id, c.p.id]);
  assert.match(a.conn.last(S.CHAT).text, /Bo won the hop race with 70 s to spare!/);
});

await test('the hop race: nobody across when the time runs out, nobody wins', () => {
  const { room, a } = gameRoom('hop_race', ['Ann', 'Bo']);
  let now = Date.now() + MINIGAMES.gatherMs + 10;
  room.update(now);
  room.update((now += MINIGAMES.readyMs));
  room.update((now += MINIGAMES.hop_race.ms + 50));
  assert.equal(a.conn.last(S.GAME_END).winner, 0);
  assert.match(a.conn.last(S.CHAT).text, /The hop race is over: nobody made it across./);
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
  assert.match(b.conn.last(S.CHAT).text, /^A found (golden seeds|an old key|a key piece to the .+)!$/);
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

await test('fishing: what bites where, with which rod, at what hour', () => {
  for (const [water, table] of Object.entries(FISHING)) {
    for (const [item] of table) assert.ok(item === 'chest' || item === 'key' || item === 'wood' || SHOP[item]?.sell, `${water}: the merchant buys ${item}`);
  }
  const at = (hour, rod = 'fishing_rod') => biting('sea', rod, hour).map(([item]) => item);
  assert.ok(at(23).includes('moonfish') && !at(12).includes('moonfish'), 'the moonfish only at night');
  assert.ok(!at(23).includes('pufferfish') && at(23, 'sturdy_rod').includes('pufferfish'), 'the pufferfish takes a sturdy rod');
  const share = (rod) => {
    const table = biting('lobby', rod, 23);
    const total = table.reduce((sum, [, w]) => sum + w, 0);
    return table.filter(([, , rarity]) => rarity >= 2).reduce((sum, [, w]) => sum + w, 0) / total;
  };
  assert.ok(share('golden_rod') > share('sturdy_rod') && share('sturdy_rod') > share('fishing_rod'), 'a better rod, rarer things');
  const rand = mulberry32(4);
  for (let i = 0; i < 200; i++) {
    const line = castLine('pond', 'golden_rod', 12, 1, rand);
    assert.ok(line.bite >= RODS.golden_rod.bite[0] && line.bite <= RODS.golden_rod.bite[1] && line.window > 0);
    if (line.item === 'chest') assert.ok(line.items.length >= 1);
    assert.notEqual(line.item, 'catfish', 'no catfish at noon');
  }
});

await test('fishing in a lobby: the room rolls it, a bite in time lands it, a late one gets away', () => {
  const room = new Room({ code: 'FISH', rand: mulberry32(2) });
  const a = join(room, 'A');
  const b = join(room, 'B');
  // on the sand, facing the sea
  const shore = room.island.coastAt(0) - 1.5;
  room.message(a.p, { t: C.STATE, x: shore, y: 0.8, z: 0, yaw: Math.PI / 2, f: 1 });
  assert.ok(room.island.isLand(shore, 0) && !room.island.isLand(shore + 2.5, 0));
  room.message(a.p, { t: C.CAST, n: 1, x: shore - 2, z: 0, rod: 'fishing_rod' });
  assert.equal(a.conn.last(S.CAUGHT)?.n, 1, 'not on dry land');
  assert.equal(a.p.line, null);
  a.p.castAt = 0;
  room.message(a.p, { t: C.CAST, n: 2, x: shore + 2.5, z: 0, rod: 'fishing_rod' });
  assert.ok(a.p.line && !a.p.line.bit);
  room.message(a.p, { t: C.REEL });
  assert.equal(a.p.line, null, 'reeled in before a bite: nothing');
  assert.equal(a.conn.all(S.CAUGHT).length, 1);
  // a bite, and E in time
  a.p.castAt = 0;
  room.message(a.p, { t: C.CAST, n: 3, x: shore + 2.5, z: 0, rod: 'golden_rod' });
  Object.assign(a.p.line, { item: 'golden_carp', count: 1, items: undefined, biteAt: Date.now() - 1 });
  room.update();
  assert.deepEqual(a.conn.last(S.BITE), { t: S.BITE, n: 3, window: a.p.line.window });
  room.message(a.p, { t: C.REEL });
  assert.equal(a.conn.last(S.CAUGHT).item, 'golden_carp');
  assert.equal(a.p.rares, 1);
  assert.ok(b.conn.all(S.CHAT).some((m) => m.text === 'A fished up a golden carp!'), 'the lobby hears of a rare one');
  assert.equal(a.p.bag.golden_carp, undefined, 'a rare fish is never knocked loose');
  // too slow
  a.p.castAt = 0;
  room.message(a.p, { t: C.CAST, n: 4, x: shore + 2.5, z: 0, rod: 'fishing_rod' });
  a.p.line.biteAt = Date.now() - 10_000;
  a.p.line.bit = true;
  room.message(a.p, { t: C.REEL });
  assert.deepEqual(a.conn.last(S.CAUGHT), { t: S.CAUGHT, n: 4, item: null });
  // and not again straight away
  room.message(a.p, { t: C.CAST, n: 5, x: shore + 2.5, z: 0, rod: 'fishing_rod' });
  assert.equal(a.conn.last(S.CAUGHT).n, 5, 'casting again too soon');
});

await test('fish weigh what their kind does; bait brings bites sooner, a lure rarer fish; the journal keeps only fish there are', () => {
  for (const { id } of FISH_LIST) assert.ok(FISH_WEIGHT[id] && SHOP[id]?.sell, id);
  for (const table of Object.values(FISHING)) for (const [item] of table) if (!['chest', 'key', 'wood', 'seaweed', 'old_boot'].includes(item)) assert.ok(FISH_WEIGHT[item], `${item} has a weight`);
  assert.ok(FISHING.contest.every(([item]) => FISH_WEIGHT[item]), 'a contest is all fish');
  const rand = mulberry32(9);
  let plain = 0;
  let baited = 0;
  for (let i = 0; i < 300; i++) {
    const line = castLine('sea', 'sturdy_rod', 10, 1, rand);
    if (FISH_WEIGHT[line.item]) {
      const [lo, hi] = FISH_WEIGHT[line.item];
      assert.ok(Number.isInteger(line.grams) && line.grams >= lo && line.grams <= hi, `${line.item} ${line.grams}`);
    } else {
      assert.equal(line.grams, undefined, `${line.item} has no weight`);
    }
    plain += line.bite;
    baited += castLine('sea', 'sturdy_rod', 10, 1, rand, { bait: true }).bite;
  }
  assert.ok(Math.abs(baited / plain - TACKLE.bait.bite) < 0.1, 'bait: bites sooner');
  const rare = (lure) => biting('lobby', 'fishing_rod', 12, lure).filter(([, , r]) => r >= 2).reduce((sum, [, w]) => sum + w, 0);
  assert.ok(rare(true) > rare(false), 'a lure: rarer fish');
  assert.deepEqual(cleanLog({ trout: [3, 1200.4], nope: [1, 5], salmon: [0, 9], carp: ['x', 1] }), { trout: [3, 1200] });
  assert.equal(weightText(85), '85 g');
  assert.equal(weightText(1460), '1.5 kg');
  assert.equal(weightText(32400), '32 kg');
});

await test('a lobby\'s board of its biggest catches: heaviest first, a farmer once, a new heaviest heard of', () => {
  let board = [];
  for (const [name, item, g] of [['A', 'trout', 500], ['B', 'carp', 3000], ['A', 'salmon', 2000], ['C', 'trout', 100], ['D', 'trout', 200], ['E', 'trout', 300], ['F', 'trout', 400]]) board = onBoard(board, name, item, g) ?? board;
  assert.equal(board.length, BOARD_SIZE);
  assert.deepEqual(board.slice(0, 2), [['B', 'carp', 3000], ['A', 'salmon', 2000]]);
  assert.equal(onBoard(board, 'A', 'minnow', 10), null, 'lighter than their own');
  assert.equal(onBoard(board, 'G', 'minnow', 10), null, 'lighter than the lightest on a full board');
  for (const seed of ['classic', ...Array.from({ length: 20 }, (_, i) => `board-${i}-v${CURRENT_GEN}`)]) {
    const island = islandFor(seed);
    const at = new Room({ code: 'B', seed }).party.board;
    assert.ok(island.isLand(at.x, at.z) && !island.inPond(at.x, at.z), seed);
    assert.ok(Math.hypot(at.x - island.pond.x, at.z - island.pond.z) < island.pond.r + 7, `${seed}: by the pond`);
    assert.ok(Math.hypot(at.x - island.spawn.x, at.z - island.spawn.z) > STONE_CIRCLE + 1.5, `${seed}: out of the stone circle`);
  }

  const room = new Room({ code: 'BOARD', rand: mulberry32(3) });
  const a = join(room, 'A');
  const b = join(room, 'B');
  assert.deepEqual(a.conn.last(S.WELCOME).board, []);
  assert.deepEqual(a.conn.last(S.WELCOME).boardAt, room.party.board);
  const shore = room.island.coastAt(0) - 1.5;
  const land = (who, n, item, grams) => {
    who.p.castAt = 0;
    room.message(who.p, { t: C.STATE, x: shore, y: 0.8, z: 0, yaw: Math.PI / 2, f: 1 });
    room.message(who.p, { t: C.CAST, n, x: shore + 2.5, z: 0, rod: 'fishing_rod' });
    Object.assign(who.p.line, { item, count: 1, grams, items: undefined, biteAt: Date.now() - 1 });
    room.update();
    room.message(who.p, { t: C.REEL });
  };
  land(a, 1, 'trout', 900);
  assert.equal(a.conn.last(S.CAUGHT).grams, 900);
  assert.deepEqual(b.conn.last(S.BOARD).board, [['A', 'trout', 900]]);
  assert.ok(!b.conn.all(S.CHAT).some((m) => /biggest catch/.test(m.text)), 'not for the very first');
  land(b, 1, 'salmon', 4200);
  assert.deepEqual(a.conn.last(S.BOARD).board, [['B', 'salmon', 4200], ['A', 'trout', 900]]);
  assert.ok(a.conn.all(S.CHAT).some((m) => m.text === 'B landed a 4.2 kg salmon: the biggest catch on the board!'));
  // kept with the lobby
  assert.deepEqual(Room.fromSave(JSON.parse(JSON.stringify(room.toSave()))).board, room.board);
});

await test('a fishing contest: fished off the arena\'s shore, won by the most weight', () => {
  const { room, a, b: c, stand } = gameRoom('fishing_contest', ['Ann', 'Bo']);
  const now = Date.now();
  room.update(now + MINIGAMES.gatherMs + 10);
  const { game } = c.conn.last(S.GAME);
  const arena = arenaFor('fishing_contest', game.seed);
  assert.deepEqual(checkArena(arena), []);
  // off the arena's shore (not the lobby's water): only once it is on
  const shore = arena.coast.r - 1;
  stand(a, shore, 0.8, 0);
  room.message(a.p, { t: C.CAST, n: 1, x: shore + 3, z: 0, rod: 'fishing_rod' });
  assert.equal(a.conn.last(S.CAUGHT).n, 1, 'not while getting ready');
  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + 20);
  assert.equal(room.party.game.phase, 'playing');
  a.p.castAt = 0;
  room.message(a.p, { t: C.CAST, n: 2, x: shore - 3, z: 0, rod: 'fishing_rod' });
  assert.equal(a.conn.last(S.CAUGHT).n, 2, 'not on the arena\'s land');
  a.p.castAt = 0;
  room.message(a.p, { t: C.CAST, n: 3, x: shore + 3, z: 0, rod: 'golden_rod', bait: true, lure: true });
  assert.ok(a.p.line && FISHING.contest.some(([item]) => item === a.p.line.item), 'the contest\'s fish');
  Object.assign(a.p.line, { item: 'carp', count: 1, grams: 2500, items: undefined, biteAt: Date.now() - 1 });
  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + 30);
  a.p.line.biteAt = Date.now() - 1; // (the room's clock went on: a bite just now)
  room.message(a.p, { t: C.REEL });
  assert.equal(a.conn.last(S.CAUGHT).item, 'carp');
  assert.deepEqual(c.conn.last(S.GAME_SCORE), { t: S.GAME_SCORE, by: a.p.id, score: 2500 });
  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + MINIGAMES.fishing_contest.ms + 50);
  const end = c.conn.last(S.GAME_END);
  assert.equal(end.winner, a.p.id);
  assert.ok(c.conn.all(S.CHAT).some((m) => m.text === 'Ann won the fishing contest with 2.5 kg of fish!'));
  assert.equal(a.p.game, 0);
  assert.equal(a.p.line, null);
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

await test('a lobby is opened for a game (a loot run if none is said); quick join skips ones under way; one whose game is over closes once everyone has gone', () => {
  const lobby = new Lobby({ log: () => {} });
  assert.equal(lobby.make({ name: 'Plain' }).game, 'loot_run');
  assert.equal(lobby.make({ game: 'nope' }).game, 'loot_run');
  const race = lobby.make({ name: 'Race', game: 'hop_race' });
  assert.equal(race.game, 'hop_race');
  assert.deepEqual(lobby.list().find((l) => l.code === race.code).game, 'hop_race');
  // under way: not for quick join, and listed as closed
  const a = join(race, 'A');
  for (const r of lobby.rooms.values()) if (r !== race) r.close(), lobby.rooms.delete(r.code);
  assert.equal(lobby.quick(), race, 'gathering: anyone can come');
  race.update(Date.now() + MINIGAMES.gatherMs + 10);
  assert.equal(lobby.list().find((l) => l.code === race.code).open, false);
  const fresh = lobby.quick();
  assert.notEqual(fresh, race);
  assert.equal(fresh.game, 'loot_run', 'a new loot run instead');
  // over: off the list, and closed once nobody is left on it
  race.update(Date.now() + MINIGAMES.gatherMs + MINIGAMES.readyMs + 20);
  race.update(Date.now() + MINIGAMES.gatherMs + MINIGAMES.readyMs + MINIGAMES.hop_race.ms + 50);
  assert.ok(race.party.over);
  assert.ok(!lobby.list().some((l) => l.code === race.code));
  lobby.reap();
  assert.equal(lobby.find(race.code), race, 'not while they are still on it (the results)');
  race.party.overAt = Date.now() - 61_000; // (a minute on)
  lobby.reap();
  assert.equal(lobby.find(race.code), null, 'not for long, even so');
  assert.equal(a.conn.closed, CLOSE.ENDED);
  const other = lobby.make({ game: 'coin_rush' });
  const b = join(other, 'B');
  other.update(Date.now() + MINIGAMES.gatherMs + 10);
  other.update(Date.now() + MINIGAMES.gatherMs + MINIGAMES.readyMs + 20);
  other.update(Date.now() + MINIGAMES.gatherMs + MINIGAMES.readyMs + MINIGAMES.coin_rush.ms + 50);
  other.leave(b.p, { hold: false }); // (headed home)
  lobby.reap();
  assert.equal(lobby.find(other.code), null, 'straight away, once they have all gone');
  // kept: its game; one that was over isn't put back after a restart
  const saved = JSON.parse(JSON.stringify(fresh.toSave()));
  assert.equal(Room.fromSave(saved).game, 'loot_run');
  const later = new Lobby({ log: () => {}, store: { load: () => ({ rooms: [{ ...saved, seats: [{ id: 1, key: 'k', name: 'A' }] }, { ...saved, code: 'OVERAB', over: true, seats: [{ id: 1, key: 'k', name: 'A' }] }] }), save: () => {} } });
  assert.deepEqual([...later.rooms.keys()], [fresh.code]);
  for (const r of [...lobby.rooms.values(), ...later.rooms.values()]) r.close();
});

await test('a lobby started with friends is for the game picked: the invitations say which, and it opens for it', () => {
  const farms = new Map(['a', 'b'].map((id) => [id, { id, account: { name: id === 'a' ? 'Ann' : 'Bo' }, color: PLAYER_COLORS[0], friends: [id === 'a' ? 'b' : 'a'] }]));
  const presence = new Presence({
    farms: { auth: (h) => farms.get(h.slice(7)) ?? null, get: (id) => farms.get(id), areFriends: (x, y) => !!y && x.friends.includes(y.id) },
    lobby: new Lobby({ log: () => {} }),
    log: () => {},
  });
  const [ca, cb] = ['a', 'b'].map((id) => {
    const conn = fakeConn();
    assert.ok(presence.hello(conn, { t: PC.HELLO, v: PROTOCOL_VERSION, auth: id }));
    return conn;
  });
  presence.message(ca, { t: PC.PARTY, invite: ['b'], game: 'last_one' });
  const invited = cb.last(PS.INVITED);
  assert.equal(invited.game, 'last_one');
  presence.message(cb, { t: PC.ANSWER, party: invited.party, yes: true });
  const { code } = ca.last(PS.GO);
  assert.equal(cb.last(PS.GO).code, code);
  const room = presence.lobby.find(code);
  assert.equal(room.game, 'last_one');
  // more friends, later: only while it can still be joined
  presence.message(ca, { t: PC.INVITE, code, invite: ['b'] });
  assert.equal(cb.last(PS.INVITED).game, 'last_one');
  join(room, 'Ann');
  room.update(Date.now() + MINIGAMES.gatherMs + 10);
  const before = cb.all(PS.INVITED).length;
  presence.message(ca, { t: PC.INVITE, code, invite: ['b'] });
  assert.equal(cb.all(PS.INVITED).length, before, 'not once its game is on');
  // a game there isn't: a loot run
  presence.message(ca, { t: PC.PARTY, invite: [], game: 'tag' });
  assert.equal(presence.lobby.find(ca.last(PS.GO).code).game, 'loot_run');
  for (const r of presence.lobby.rooms.values()) r.close();
});

await test('the leaderboards: each farmer\'s best in every game, their wins and games; the best first, then the most wins, then who got there first', () => {
  const saved = [];
  const store = { load: () => null, save: (d) => (saved.push(JSON.parse(JSON.stringify(d))), true) };
  const boards = new Leaderboards({ store, log: () => {} });
  assert.deepEqual(boards.record('coin_rush', [
    { id: 1, farm: 'fa', name: 'Ann', score: 5, won: true },
    { id: 2, farm: 'fb', name: 'Bo', score: 3, won: false },
    { id: 3, name: 'Nobody', score: 9, won: false }, // (no account: not on the board)
  ], 1000), [[1, 1], [2, 2]], 'new bests, and where they are');
  // a better score moves Bo up; a worse one leaves Ann's best as it was
  assert.deepEqual(boards.record('coin_rush', [
    { id: 7, farm: 'fb', name: 'Bo', score: 8, won: true },
    { id: 8, farm: 'fa', name: 'Ann', score: 2, won: false },
  ], 2000), [[7, 1]]);
  boards.record('coin_rush', [{ id: 1, farm: 'fc', name: 'Cy', score: 5, won: false }], 3000); // (level with Ann, fewer wins)
  boards.record('coin_rush', [{ id: 1, farm: 'fd', name: 'Di', score: 0, won: false }], 4000); // (played, nothing yet)
  const { games, you } = boards.list(10, 'CY');
  assert.deepEqual(games.coin_rush.map(({ rank, name, best, wins, played }) => [rank, name, best, wins, played]), [[1, 'Bo', 8, 1, 2], [2, 'Ann', 5, 1, 2], [3, 'Cy', 5, 0, 1]]);
  assert.deepEqual(you, { coin_rush: { rank: 3, name: 'Cy', best: 5, wins: 0, played: 1 } });
  assert.deepEqual(Object.keys(games).sort(), Object.keys(LOBBY_GAMES).sort(), 'a board for every lobby game');
  assert.deepEqual(games.hop_race, []);
  assert.equal(boards.list(2).games.coin_rush.length, 2, 'the top n');
  assert.equal(boards.record('tag', [{ id: 1, farm: 'fa', name: 'Ann', score: 1, won: true }]).length, 0, 'not a game there is');
  // kept: written out, and read back as it was
  boards.flush();
  const again = new Leaderboards({ store: { load: () => ({ v: 1, ...saved.at(-1), boards: { ...saved.at(-1).boards, tag: [['fa', 'Ann', 1, 0, 1, 1]] } }), save: () => true }, log: () => {} });
  assert.deepEqual(again.list(10, 'cy'), boards.list(10, 'cy'));
});

await test('a lobby game\'s results go onto its leaderboard, and whoever beat their best hears their place', () => {
  const boards = new Leaderboards({ log: () => {} });
  const room = new Room({ code: 'BOARDS', game: 'coin_rush', rand: mulberry32(7), onGameEnd: (kind, results) => boards.record(kind, results) });
  const joinAs = (name, farm) => {
    const conn = fakeConn();
    return { conn, p: room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name, key: name }, { farm, account: name }) };
  };
  const a = joinAs('Ann', 'fa');
  const b = joinAs('Bo', 'fb');
  const now = Date.now();
  room.update(now + MINIGAMES.gatherMs + 10);
  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + 20);
  const [x, y, z] = room.party.game.arena.coins[0];
  room.message(a.p, { t: C.STATE, x, y: y + 0.1, z, yaw: 0, f: 1 });
  room.message(a.p, { t: C.GAME_COIN, id: 0 });
  room.update(now + MINIGAMES.gatherMs + MINIGAMES.readyMs + MINIGAMES.coin_rush.ms + 50);
  assert.deepEqual(b.conn.last(S.GAME_END).records, [[a.p.id, 1]], 'Ann beat her best (Bo picked nothing up)');
  assert.deepEqual(boards.list().games.coin_rush.map(({ name, best, wins, played }) => [name, best, wins, played]), [['Ann', 1, 1, 1]]);
  assert.equal(boards.boards.get('coin_rush').get('fb').played, 1, 'Bo played, all the same');
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
  // gates, arches, arbors, low walls, rail and picket fences, hedges, palisades, cobbles, gravel, stepping stones, wells, lanterns, scarecrows, hay carts, beehives, birdbaths, signposts, wattle fences, troughs, stone benches, sundials, wheelbarrows, torches, log fences, mailboxes, birdhouses, flagpoles, cairns, clotheslines, rope fences, log benches, compost bins, milk churns, dovecotes and the blocks to climb on (boulders too) are pieces too
  for (const piece of ['wood_gate', 'wood_crate', 'stone_step', 'stone_block', 'wood_step', 'log_pile', 'wood_scaffold', 'tall_stone_block', 'stone_pillar', 'low_stone_wall', 'wood_palisade', 'wood_barrel', 'straw_bale', 'straw_stack', 'log_tower', 'stone_arch', 'cobble_path', 'rail_fence', 'wood_arbor', 'gravel_path', 'mossy_stone_block', 'stone_well', 'box_hedge', 'stepping_stones', 'tree_stump', 'crate_stack', 'stone_lantern', 'scarecrow', 'picket_fence', 'grain_sacks', 'hay_cart', 'beehive', 'birdbath', 'signpost', 'wattle_fence', 'water_trough', 'stone_bench', 'sundial', 'wheelbarrow', 'barrel_stack', 'straw_step', 'torch', 'log_fence', 'mailbox', 'birdhouse', 'flagpole', 'stone_cairn', 'clothesline', 'rope_fence', 'boulder', 'log_bench', 'compost_bin', 'milk_churns', 'dovecote']) {
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
  // the workbench takes what the backpack is short of out of the chest too: the owner's only, all of it or none, answered
  room.message(bo.p, { t: C.CHEST_PUT, item: 'wood', count: 5 });
  room.message(bo.p, { t: C.CHEST_SPEND, id: 1, items: { wood: 2 } });
  assert.deepEqual(bo.conn.last(S.CHEST_SPENT), undefined, 'a helper can\'t spend what is in the chest');
  room.message(ann.p, { t: C.CHEST_SPEND, id: 2, items: { wood: 2 } });
  assert.deepEqual(ann.conn.last(S.CHEST_SPENT), { t: S.CHEST_SPENT, id: 2, ok: true });
  assert.equal(bo.conn.last(S.CHEST).items.wood, 3, 'the room says what is left');
  for (const [id, items] of [[3, { wood: 4 }], [4, { wood: 1, stone: 1 }], [5, { wood: 0 }], [6, { wood: 1.5 }], [7, {}], [8, [3]], [9, 'wood'], [10, { turnip: 2 }]]) {
    room.message(ann.p, { t: C.CHEST_SPEND, id, items });
    assert.deepEqual(ann.conn.last(S.CHEST_SPENT), { t: S.CHEST_SPENT, id, ok: false }, JSON.stringify(items));
  }
  assert.deepEqual([room.chest.wood, room.chest.turnip], [3, 1], 'turned down: nothing used');
  room.message(ann.p, { t: C.CHEST_SPEND, id: 11, items: { wood: 3, turnip: 1 } });
  assert.deepEqual(ann.conn.last(S.CHEST_SPENT), { t: S.CHEST_SPENT, id: 11, ok: true });
  assert.equal(room.chest.wood, undefined, 'an emptied item leaves the chest');
  room.message(bo.p, { t: C.CHEST_PUT, item: 'turnip', count: 1 }); // (back as it was, for the checks after)
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
  assert.deepEqual(new FarmRoom({ farm: { ...a, chest: { wood: 1, lamp_post: 2, garden_bench: 1, planter: 2 } }, admit: () => null }).chest, { wood: 15, stone: 12 });
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

await test('a farm room: a tomato plant and a berry bush stay when they are picked, ripe again in a while; the hoe digs one up', () => {
  const farms = new Farms({ log: () => {} });
  const made = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: 8, tilled: ['3,3', '4,3', '5,3'], crops: [] }, backpack: {} }, 'pw');
  const a = farms.auth(bearer(made));
  const rooms = new FarmRooms({ farms, log: () => {} });
  const room = rooms.open(a.id);
  const conn = fakeConn();
  const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann', auth: `${made.id}.${made.token}` });
  room.message(p, { t: C.STATE, x: 3.5, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.PLANT, key: '3,3', crop: 'tomato' });
  room.message(p, { t: C.PLANT, key: '4,3', crop: 'berry_bush' });
  room.message(p, { t: C.PLANT, key: '5,3', crop: 'pumpkin' });
  room.message(p, { t: C.UPROOT, key: '5,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'uproot', 'a pumpkin comes up when it is picked: no digging it up');
  const hour = 24 / DAY_LENGTH_SECONDS; // (game hours in a second)
  room.clockBase += Math.max(...Object.values(MORE_CROPS).map((c) => c.grow)) * hour; // (all ripe)
  for (const key of ['3,3', '4,3', '5,3']) room.message(p, { t: C.HARVEST, key });
  assert.deepEqual(conn.all(S.HARVESTED).map((m) => [m.key, m.item]), [['3,3', 'tomato'], ['4,3', 'berries'], ['5,3', 'pumpkin']]);
  assert.deepEqual([room.chest.tomato, room.chest.berries, room.chest.pumpkin], [1, 2, 1], 'a berry bush gives two');
  assert.ok(room.crops.has('3,3') && room.crops.has('4,3'), 'the tomato plant and the bush stay');
  assert.ok(!room.crops.has('5,3') && room.tilled.has('5,3'), 'the pumpkin is pulled up, the soil left');
  // ripe again only in a while
  room.message(p, { t: C.HARVEST, key: '3,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'harvest', 'not ripe again yet');
  room.clockBase += MORE_CROPS.tomato.again * hour;
  room.message(p, { t: C.HARVEST, key: '3,3' });
  assert.equal(room.chest.tomato, 2);
  // kept in the save, part grown
  rooms.write(room);
  const saved = Object.fromEntries(a.save.farm.crops.map(([key, crop, age]) => [key, [crop, Math.round(age)]]));
  assert.deepEqual(saved['3,3'], ['tomato', MORE_CROPS.tomato.grow - MORE_CROPS.tomato.again]);
  assert.equal(saved['4,3'][0], 'berry_bush');
  // the hoe digs the bush up, for good
  room.message(p, { t: C.UPROOT, key: '4,3' });
  assert.deepEqual([conn.last(S.UPROOTED).key, conn.last(S.UPROOTED).by], ['4,3', p.id]);
  assert.ok(!room.crops.has('4,3') && room.tilled.has('4,3'));
  room.close();
});

await test('a farm room: platform plants: a bounce shroom gives mushrooms and grows back, a lily leaf wilts, cloud cotton is picked from on top', () => {
  const farms = new Farms({ log: () => {} });
  const made = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: 8, tilled: ['3,3', '4,3', '5,3'], crops: [] }, backpack: {} }, 'pw');
  const a = farms.auth(bearer(made));
  const rooms = new FarmRooms({ farms, log: () => {} });
  const room = rooms.open(a.id);
  const conn = fakeConn();
  const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann', auth: `${made.id}.${made.token}` });
  room.message(p, { t: C.STATE, x: 4, y: GROUND_STAND_Y, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.PLANT, key: '3,3', crop: 'bounce_shroom' });
  room.message(p, { t: C.PLANT, key: '4,3', crop: 'lily_leaf' });
  room.message(p, { t: C.PLANT, key: '5,3', crop: 'cloud_cotton' });
  const hour = 24 / DAY_LENGTH_SECONDS; // (game hours in a second)
  room.clockBase += Math.max(...Object.values(PLATFORM_PLANTS).map((c) => c.grow)) * hour; // (all ripe)
  // a bounce shroom: two mushrooms, and its cap grows back
  room.message(p, { t: C.HARVEST, key: '3,3' });
  assert.equal(room.chest.mushroom, 2);
  assert.ok(room.crops.has('3,3'));
  // a lily leaf wilts (a pick of nothing) and grows back
  room.message(p, { t: C.HARVEST, key: '4,3' });
  const wilted = conn.last(S.HARVESTED);
  assert.deepEqual([wilted.key, wilted.item], ['4,3', undefined]);
  assert.ok(room.crops.has('4,3'));
  assert.equal(Object.keys(room.chest).length, 1, 'nothing more in the chest');
  // cloud cotton: picked from on top of it, up in the air
  room.message(p, { t: C.STATE, x: 5, y: GROUND_STAND_Y + PLATFORM_PLANTS.cloud_cotton.top, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.HARVEST, key: '5,3' });
  assert.equal(room.chest.cloud_cotton, 1);
  assert.ok(!room.crops.has('5,3'), 'picked, it is gone');
  room.message(p, { t: C.STATE, x: 3, y: GROUND_STAND_Y + 6, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.UPROOT, key: '3,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'uproot', 'too high up to dig');
  room.message(p, { t: C.STATE, x: 3, y: GROUND_STAND_Y, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.UPROOT, key: '3,3' });
  assert.equal(conn.last(S.UPROOTED).key, '3,3');
  room.close();
});

await test('a farm room: a watered crop grows the rest of the way twice as fast, and stays watered in the save', () => {
  const farms = new Farms({ log: () => {} });
  const made = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: 8, tilled: ['3,3', '4,3'], crops: [] }, backpack: {} }, 'pw');
  const a = farms.auth(bearer(made));
  const rooms = new FarmRooms({ farms, log: () => {} });
  const room = rooms.open(a.id);
  const conn = fakeConn();
  const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann', auth: `${made.id}.${made.token}` });
  room.message(p, { t: C.STATE, x: 3.5, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.PLANT, key: '3,3', crop: 'turnip' });
  room.message(p, { t: C.PLANT, key: '4,3', crop: 'turnip' });
  room.message(p, { t: C.WATER, key: '9,9' });
  assert.equal(conn.last(S.FARM_DENY).op, 'water', 'nothing growing there');
  const hour = 24 / DAY_LENGTH_SECONDS; // (game hours in a second)
  room.clockBase += 20 * hour; // 20 s of growing
  room.message(p, { t: C.WATER, key: '3,3' });
  const watered = conn.last(S.WATERED);
  assert.deepEqual([watered.key, watered.by], ['3,3', p.id]);
  room.message(p, { t: C.WATER, key: '3,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'water', 'watered already');
  // 20 s, then 40 more: 20 + 80 = 100 s grown, a turnip's time; the other has 60 s
  room.clockBase += 40 * hour;
  room.message(p, { t: C.HARVEST, key: '4,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'harvest', 'the dry one is still growing');
  // kept in the save as watered, and growing on as fast when the farm opens again
  rooms.write(room);
  const saved = a.save.farm.crops.find(([key]) => key === '3,3');
  assert.equal(saved[3], 1);
  assert.ok(Math.abs(saved[2] - 100) < 1, `${saved[2]} s grown`);
  assert.equal(a.save.farm.crops.find(([key]) => key === '4,3')[3], undefined);
  const reopened = new FarmRoom({ farm: a, admit: () => null });
  assert.notEqual(reopened.crops.get('3,3').wateredAt, undefined);
  assert.equal(reopened.crops.get('4,3').wateredAt, undefined);
  room.message(p, { t: C.HARVEST, key: '3,3' });
  assert.equal(conn.last(S.HARVESTED).key, '3,3');
  // a newcomer hears when it was watered
  room.message(p, { t: C.WATER, key: '4,3' });
  const welcome = (() => {
    const c2 = fakeConn();
    room.join(c2, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann2', auth: `${made.id}.${made.token}` });
    return c2.last(S.FARM);
  })();
  const [, crop, , wateredAt] = welcome.crops.find(([key]) => key === '4,3');
  assert.equal(crop, 'turnip');
  assert.ok(Number.isFinite(wateredAt));
  room.close();
});

await test('the weather: the same on every page and farm, from the clock; dry on the first day, no storm in the first few', () => {
  assert.equal(spellOn(0), null, 'the first day is dry');
  const kinds = { rain: 0, storm: 0, dry: 0 };
  for (let day = 0; day < 1000; day++) {
    const spell = spellOn(day);
    assert.deepEqual(spell, spellOn(day), 'the same every time');
    kinds[spell?.kind ?? 'dry']++;
    if (!spell) continue;
    if (day < WEATHER.calm) assert.equal(spell.kind, 'rain', `day ${day}: a shower, not a storm`);
    assert.ok(spell.from >= day * 24 && spell.to <= day * 24 + 23 && spell.to > spell.from, `day ${day}: within the day`);
    const mid = (spell.from + spell.to) / 2;
    assert.equal(weatherAt(mid).kind, spell.kind);
    assert.equal(weatherAt(spell.from - 0.01), null);
    assert.equal(weatherAt(spell.to), null);
    assert.ok(weatherAt(spell.from + 0.01).amount < 0.1, 'it starts gently');
  }
  assert.ok(kinds.rain > 250 && kinds.storm > 50 && kinds.dry > 500, JSON.stringify(kinds));
  // when rain first fell: as it came, or straight away when it was raining already
  const day = [...Array(50).keys()].find((d) => spellOn(d));
  const { from, to } = spellOn(day);
  assert.equal(rainSince(from - 5, from + 1), from);
  assert.equal(rainSince(from + 0.5, to + 3), from + 0.5);
  assert.equal(rainSince(from - 1, from - 0.5), null);
  assert.equal(rainSince(to + 0.01, to + 0.02), null);
});

await test('a farm room: rain waters the crops growing out in it, and what grew while nobody was on the farm', () => {
  const day = [...Array(50).keys()].find((d) => spellOn(d));
  const { from: rainFrom } = spellOn(day);
  const hour = 24 / DAY_LENGTH_SECONDS; // (game hours in a second)
  const farms = new Farms({ log: () => {} });
  const made = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: rainFrom - 0.5, tilled: ['3,3', '4,3', '5,3'], crops: [] }, backpack: {} }, 'pw');
  const a = farms.auth(bearer(made));
  const rooms = new FarmRooms({ farms, log: () => {} });
  const room = rooms.open(a.id);
  const conn = fakeConn();
  const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann', auth: `${made.id}.${made.token}` });
  room.message(p, { t: C.STATE, x: 3.5, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.PLANT, key: '3,3', crop: 'turnip' });
  room.crops.get('3,3').plantedAt -= 100 * hour; // (planted long enough ago to be ripe)
  room.message(p, { t: C.PLANT, key: '4,3', crop: 'turnip' });
  room.tickPlace(Date.now() + 1500);
  assert.equal(conn.all(S.WATERED).length, 0, 'dry still');
  // the rain comes: the growing one is watered from then, by nobody; not the ripe one
  room.clockBase = rainFrom + 0.1;
  room.tickPlace(Date.now() + 3000);
  const watered = conn.all(S.WATERED);
  assert.deepEqual(watered.map((m) => [m.key, m.by]), [['4,3', 0]]);
  assert.ok(Math.abs(watered[0].at - rainFrom) < 0.01, 'from when it came');
  // planted while it rains: watered straight away
  room.message(p, { t: C.PLANT, key: '5,3', crop: 'turnip' });
  room.tickPlace(Date.now() + 4500);
  assert.equal(conn.last(S.WATERED).key, '5,3');
  room.message(p, { t: C.WATER, key: '5,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'water', 'the rain watered it already');
  // kept watered in the save
  rooms.write(room);
  assert.equal(a.save.farm.crops.find(([key]) => key === '4,3')[3], 1);
  room.close();
  // a farm left before the rain and opened once it has come: what was growing
  // then was watered from when it came (5 s grown, 30 more till the rain)
  const left = farms.create({ v: 5, farm: { savedAt: Date.now() - (0.8 * 1000) / hour, hours: rainFrom - 0.5, tilled: ['3,3'], crops: [['3,3', 'turnip', 5]] }, backpack: {} }, 'pw2');
  const reopened = new FarmRoom({ farm: farms.auth(bearer(left)), admit: () => null });
  reopened.tickPlace(Date.now() + 1500);
  assert.ok(Math.abs(reopened.crops.get('3,3').wateredAt - rainFrom) < 0.01);
});

await test('a farm room: things dropped lie there for anyone (not straight back to whoever dropped them), kept with the farm', () => {
  const farms = new Farms({ log: () => {} });
  const madeA = farms.create({ v: 7, farm: { savedAt: Date.now(), hours: 8, tilled: [], crops: [], built: [], dropped: [['wood', 2, 1, 0, 3], ['axe', 1, 0, 0, 0], ['nonsense', 1, 0, 0, 0], ['stone', 0, 0, 0, 0]] }, backpack: {} }, 'pa');
  const madeB = farms.create(aSave(2), 'pb');
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
  // what was dropped while the farm was played alone is there (only real things)
  const [kept] = ann.conn.last(S.FARM).drops;
  assert.equal(ann.conn.last(S.FARM).drops.length, 1);
  assert.deepEqual(kept.slice(1, 6), ['wood', 2, 1, GROUND_STAND_Y, 3]);
  assert.equal(ann.conn.last(S.FARM).animals.dropped, undefined, 'not taken for the animals');
  // Bo drops some stone: for Ann, not straight back for Bo
  room.message(bo.p, { t: C.STATE, x: 4, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(bo.p, { t: C.THROW, item: 'stone', count: 3 });
  const drop = ann.conn.last(S.DROP);
  assert.deepEqual([drop.item, drop.count, drop.x, drop.y, drop.z, drop.from, drop.wait], ['stone', 3, 4, 0.8, 3, bo.p.id, DROP_OWN_MS]);
  room.message(bo.p, { t: C.PICKUP, id: drop.id });
  assert.equal(bo.conn.last(S.DROP_DENY).id, drop.id, 'not straight back');
  room.message(ann.p, { t: C.PICKUP, id: drop.id });
  assert.equal(ann.conn.last(S.DROP_DENY).id, drop.id, 'too far');
  room.message(ann.p, { t: C.STATE, x: 4.5, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.PICKUP, id: drop.id });
  assert.deepEqual([bo.conn.last(S.PICKED).id, bo.conn.last(S.PICKED).by], [drop.id, ann.p.id]);
  // never a tool, coins or nonsense; not too fast
  for (const [item, count] of [['axe', 1], ['coin', 3], ['nonsense', 1], ['wood', 0]]) {
    bo.p.throwAt = 0;
    room.message(bo.p, { t: C.THROW, item, count });
    assert.deepEqual([bo.conn.last(S.THROW_DENY).item, bo.conn.last(S.THROW_DENY).count], [item, count]);
  }
  bo.p.throwAt = 0;
  room.message(bo.p, { t: C.THROW, item: 'egg', count: 2 });
  room.message(bo.p, { t: C.THROW, item: 'egg', count: 1 });
  assert.deepEqual([bo.conn.last(S.THROW_DENY).item, bo.conn.last(S.THROW_DENY).count], ['egg', 1], 'not so fast');
  // kept with the farm (the ground's height, as the page keeps it), and back from it
  assert.deepEqual(room.toFarm().dropped, [['wood', 2, 1, 0, 3], ['egg', 2, 4, 0, 3]]);
  rooms.write(room);
  room.close();
  rooms.rooms.delete(a.id);
  const again = rooms.open(a.id);
  const ann2 = fakeConn();
  again.join(ann2, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann', auth: `${madeA.id}.${madeA.token}` });
  assert.deepEqual(ann2.last(S.FARM).drops.map((d) => [d[1], d[2]]), [['wood', 2], ['egg', 2]]);
  again.close();
});

await test('a farm room: a friend of the farmer comes to look round (a visitor), farming nothing; the farmer home, or off their friends, out', async () => {
  const farms = new Farms({ log: () => {} });
  const madeA = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: 8, tilled: ['3,3', '4,3'], crops: [] }, backpack: {} }, 'pa');
  const madeB = farms.create(aSave(), 'pb');
  const madeC = farms.create(aSave(), 'pc');
  const [a, b] = [madeA, madeB].map((made) => farms.auth(bearer(made)));
  let home = true; // (Ann at home on her page: server/presence.js)
  const rooms = new FarmRooms({ farms, atHome: () => home, log: () => {} });
  let room = rooms.open(a.id);
  const joinAs = (made, name) => {
    const conn = fakeConn();
    return { conn, p: room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name, key: name, auth: `${made.id}.${made.token}` }) };
  };
  // someone who is neither a helper nor a friend: no
  const cy = joinAs(madeC, 'Cy');
  assert.deepEqual([cy.p, cy.conn.closed], [null, CLOSE.NOT_HELPER]);
  // a friend, while the farmer plays the farm (no helpers) on their own: not now
  a.friends = [b.id];
  b.friends = [a.id];
  const early = joinAs(madeB, 'Bo');
  assert.deepEqual([early.p, early.conn.closed], [null, CLOSE.AT_HOME]);
  await Promise.resolve();
  assert.ok(!rooms.has(a.id), 'the room they opened is put away again, so her page keeps saving the farm');
  // ...and once she's out: in, to look round
  home = false;
  room = rooms.open(a.id);
  const rev = a.rev;
  const bo = joinAs(madeB, 'Bo');
  assert.equal(bo.conn.last(S.FARM).visitor, true);
  assert.equal(bo.conn.last(S.FARM).mine, false);
  assert.equal(room.rosterList().find((p) => p.id === bo.p.id).visitor, true);
  assert.match(bo.conn.last(S.CHAT).text, /came to look round/);
  // they farm nothing: each ask turned down, with what a page needs to put back
  room.message(bo.p, { t: C.STATE, x: 3.5, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(bo.p, { t: C.PLANT, key: '3,3', crop: 'turnip' });
  assert.deepEqual([bo.conn.last(S.FARM_DENY).op, bo.conn.last(S.FARM_DENY).crop], ['plant', 'turnip'], 'the seed back');
  room.message(bo.p, { t: C.TILL, key: '5,3' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'till');
  room.message(bo.p, { t: C.BUILD, key: '6,6', piece: 'wood_crate' });
  assert.deepEqual([bo.conn.last(S.FARM_DENY).op, bo.conn.last(S.FARM_DENY).piece], ['build', 'wood_crate'], 'its cost back');
  room.message(bo.p, { t: C.THROW, item: 'wood', count: 2 });
  assert.deepEqual([bo.conn.last(S.THROW_DENY).item, bo.conn.last(S.THROW_DENY).count], ['wood', 2]);
  room.message(bo.p, { t: C.CHEST_PUT, item: 'wood', count: 2 });
  assert.deepEqual([bo.conn.last(S.CHEST_GOT).item, bo.conn.last(S.CHEST_GOT).count], ['wood', 2], 'back to them');
  assert.ok(!room.crops.size && !room.built.size && !room.drops.size && !Object.keys(room.chest).length, 'the farm as it was');
  room.changed = true;
  rooms.save();
  assert.equal(a.rev, rev, 'only a friend looking round: the farm is never written back');
  // the farmer comes home: friends looking round go, and the room with them
  rooms.ownerHome(a.id);
  assert.equal(bo.conn.closed, CLOSE.AT_HOME);
  assert.ok(!rooms.has(a.id));
  // with helpers it's played on the server, with them, and friends can look round any time
  a.helpers = [{ id: madeC.id, name: 'Cy', since: Date.now() }];
  room = rooms.open(a.id);
  const again = joinAs(madeB, 'Bo');
  assert.equal(again.conn.last(S.FARM).visitor, true);
  rooms.ownerHome(a.id);
  assert.ok(!again.conn.closed, 'a farm with helpers: they stay');
  // the farmer farms on
  const ann = joinAs(madeA, 'Ann');
  room.message(ann.p, { t: C.STATE, x: 3.5, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.PLANT, key: '3,3', crop: 'turnip' });
  assert.ok(room.crops.has('3,3'));
  // no longer friends: out (a visitor only: rooms.turnOut with visitor)
  farms.removeFriend(a, b.id);
  rooms.turnOut(a.id, b.id, { visitor: true });
  assert.equal(again.conn.closed, CLOSE.NOT_HELPER);
  assert.ok(!ann.conn.closed, 'the farmer stays');
  room.close();
});

await test('a farm room: a beanstalk grows like any crop, and its beans are picked from up on its crown', () => {
  const farms = new Farms({ log: () => {} });
  const made = farms.create({ v: 5, farm: { savedAt: Date.now(), hours: 8, tilled: ['3,3', '4,3'], crops: [] }, backpack: {} }, 'pv');
  const a = farms.auth(bearer(made));
  const rooms = new FarmRooms({ farms, log: () => {} });
  const room = rooms.open(a.id);
  const conn = fakeConn();
  const p = room.join(conn, { t: C.JOIN, v: PROTOCOL_VERSION, name: 'Ann', key: 'Ann', auth: `${made.id}.${made.token}` });
  room.message(p, { t: C.STATE, x: 3.5, y: GROUND_STAND_Y, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.PLANT, key: '3,3', crop: 'vine_bean' });
  room.message(p, { t: C.PLANT, key: '4,3', crop: 'turnip' });
  assert.equal(conn.last(S.PLANTED).crop, 'turnip');
  room.clockBase += ((BEANSTALK.grow + 5) * 24) / DAY_SECONDS; // (both ripe)
  // up on the crown, over the ground by the beanstalk's height
  room.message(p, { t: C.STATE, x: 3, y: GROUND_STAND_Y + BEANSTALK.top, z: 3, yaw: 0, f: 1 });
  room.message(p, { t: C.HARVEST, key: '4,3' });
  assert.equal(conn.last(S.FARM_DENY).op, 'harvest', 'a turnip is picked from the ground');
  room.message(p, { t: C.HARVEST, key: '3,3' });
  assert.deepEqual([conn.last(S.HARVESTED).key, conn.last(S.HARVESTED).item], ['3,3', 'beans']);
  assert.equal(room.chest.beans, 1);
  room.close();
});

await test('a farm room: machines take things in, and whoever is next to one when it is done collects it', () => {
  const farms = new Farms({ log: () => {} });
  const madeA = farms.create({ v: 7, farm: { savedAt: Date.now(), hours: 8, tilled: [], crops: [], built: [['6,3', 'beehive']] }, backpack: {} }, 'pa');
  const madeB = farms.create(aSave(2), 'pb');
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
  // a beehive built before it made honey makes it now
  const [hive] = ann.conn.last(S.FARM).machines;
  assert.deepEqual([hive[0], hive[1]], ['6,3', 'honey']);
  room.message(bo.p, { t: C.STATE, x: 4, y: 0.8, z: 3, yaw: 0, f: 1 });
  room.message(bo.p, { t: C.BUILD, key: '5,3', piece: 'cheese_press' });
  assert.equal(ann.conn.last(S.BUILT).piece, 'cheese_press');
  room.message(bo.p, { t: C.LOAD, key: '4,3' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'load', 'nothing built there');
  room.message(bo.p, { t: C.LOAD, key: '5,3' });
  const loaded = ann.conn.last(S.MACHINE);
  assert.deepEqual([loaded.key, loaded.state[0], loaded.state[2], loaded.by], ['5,3', 'cheese', { milk: 1 }, bo.p.id]);
  room.message(bo.p, { t: C.LOAD, key: '5,3' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'load', 'one at a time');
  room.message(bo.p, { t: C.COLLECT, key: '5,3' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'collect', 'not done yet');
  // kept in the farm's save, and back from it
  rooms.write(room);
  assert.deepEqual(a.save.farm.machines.find(([key]) => key === '5,3').slice(0, 2), ['5,3', 'cheese']);
  assert.ok(new FarmRoom({ farm: a, admit: () => null }).machines.has('5,3'));
  assert.ok(!('machines' in room.animals), 'not the animals\'');
  // four hours on, Ann (next to it) collects it: hers, and the press is empty
  room.clockBase += 4;
  room.message(ann.p, { t: C.STATE, x: 5, y: 0.8, z: 4, yaw: 0, f: 1 });
  room.message(ann.p, { t: C.COLLECT, key: '5,3' });
  assert.deepEqual([bo.conn.last(S.MACHINE).state, bo.conn.last(S.MACHINE).got, bo.conn.last(S.MACHINE).by], [null, 'cheese', ann.p.id]);
  // the campfire: only its own dishes
  room.message(bo.p, { t: C.BUILD, key: '4,4', piece: 'campfire' });
  room.message(bo.p, { t: C.LOAD, key: '4,4', dish: 'pancakes' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'load', 'a kitchen dish');
  room.message(bo.p, { t: C.LOAD, key: '4,4', dish: 'fried_egg' });
  assert.deepEqual(bo.conn.last(S.MACHINE).state.slice(0, 1), ['fried_egg']);
  // taken down while it cooks, what went in comes back
  room.message(bo.p, { t: C.UNBUILD, key: '4,4' });
  assert.deepEqual(ann.conn.last(S.UNBUILT).back, { egg: 1 });
  assert.ok(!room.machines.has('4,4'));
  // three on the fire at once (any fish: back as the cheapest), and all three collected
  room.message(bo.p, { t: C.BUILD, key: '4,4', piece: 'campfire' });
  room.message(bo.p, { t: C.LOAD, key: '4,4', dish: 'grilled_fish', n: 4 });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'load', 'too many at once');
  room.message(bo.p, { t: C.LOAD, key: '4,4', dish: 'grilled_fish', n: 3 });
  assert.deepEqual(bo.conn.last(S.MACHINE).state.slice(2), [{ minnow: 3 }, 3]);
  rooms.write(room);
  assert.equal(new FarmRoom({ farm: a, admit: () => null }).machines.get('4,4').n, 3, 'kept in the save');
  room.clockBase += 1;
  room.message(bo.p, { t: C.COLLECT, key: '4,4' });
  assert.deepEqual([ann.conn.last(S.MACHINE).got, ann.conn.last(S.MACHINE).n], ['grilled_fish', 3]);
  // a farm feast eaten: everyone on the farm hears of it (an ordinary dish: nobody)
  room.message(bo.p, { t: C.FEAST, dish: 'pancakes' });
  assert.equal(ann.conn.last(S.FEAST), undefined);
  room.message(bo.p, { t: C.FEAST, dish: 'farm_feast' });
  assert.deepEqual([ann.conn.last(S.FEAST).dish, ann.conn.last(S.FEAST).by], ['farm_feast', bo.p.id]);
  // a beehive built now: honey on its way; collected once ready, it starts again
  room.message(bo.p, { t: C.BUILD, key: '3,4', piece: 'beehive' });
  assert.equal(ann.conn.last(S.MACHINE).state[0], 'honey');
  room.clockBase += 24;
  room.message(bo.p, { t: C.COLLECT, key: '3,4' });
  const honey = ann.conn.last(S.MACHINE);
  assert.equal(honey.got, 'honey');
  assert.ok(honey.state[1] > room.hours() + 23, 'the next jar, a day off');
  // an aquarium: fish go in, up to how many it holds, and come back out
  room.message(bo.p, { t: C.BUILD, key: '5,4', piece: 'aquarium' });
  assert.equal(ann.conn.last(S.BUILT).piece, 'aquarium');
  room.message(bo.p, { t: C.LOAD, key: '5,4', dish: 'cheese' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'load', 'only fish');
  room.message(bo.p, { t: C.LOAD, key: '5,4', dish: 'koi' });
  room.message(bo.p, { t: C.LOAD, key: '5,4', dish: 'trout' });
  assert.deepEqual(ann.conn.last(S.MACHINE).state[2], { koi: 1, trout: 1 });
  for (let i = 2; i < AQUARIUM.holds; i++) room.message(bo.p, { t: C.LOAD, key: '5,4', dish: 'koi' });
  room.message(bo.p, { t: C.LOAD, key: '5,4', dish: 'koi' });
  assert.equal(bo.conn.last(S.FARM_DENY).op, 'load', 'full');
  room.message(ann.p, { t: C.COLLECT, key: '5,4', item: 'trout' });
  assert.deepEqual([bo.conn.last(S.MACHINE).got, bo.conn.last(S.MACHINE).state[2]], ['trout', { koi: AQUARIUM.holds - 1 }]);
  rooms.write(room);
  assert.deepEqual(new FarmRoom({ farm: a, admit: () => null }).machines.get('5,4').takes, { koi: AQUARIUM.holds - 1 });
  room.message(bo.p, { t: C.UNBUILD, key: '5,4' });
  assert.deepEqual(ann.conn.last(S.UNBUILT).back, { koi: AQUARIUM.holds - 1 }, 'taken down, the fish come back');
  room.close();
});

console.log('bosses');
await test('a boss sleeps till someone comes, fights, gets tougher with more farmers, and turns friendly when bopped enough', () => {
  const fight = new BossFight('parsnip', mulberry32(7));
  const at = ARENAS.parsnip;
  assert.equal(arenaAt(at.x + 3, at.z), 'parsnip');
  assert.equal(arenaAt(0, 0), null, 'the farm is no arena');
  assert.deepEqual(fight.step(0.1, []), [], 'nobody there: asleep');
  const a = { id: 1, x: at.x, y: GROUND_STAND_Y, z: at.z + 2 };
  assert.deepEqual(fight.step(0.1, [a]).map((fx) => fx.e), ['wake']);
  assert.equal(fight.bop(1, 'mallet', a.x, a.y, a.z), null, 'not bopped while it wakes');
  for (let i = 0; i < 30; i++) fight.step(0.1, [a]);
  assert.equal(fight.phase, 'fight');
  const one = fight.max;
  fight.step(0.05, [a, { ...a, id: 2 }]);
  assert.ok(fight.max > one && fight.hp > one * 0.99, 'more health with two');
  // moves: shockwaves and seeds come out, a jump clears them
  const fx = [];
  for (let i = 0; i < 400; i++) fx.push(...fight.step(0.05, [a, { ...a, id: 2 }]));
  assert.ok(fx.some((f) => f.e === 'wave') && fx.some((f) => f.e === 'seeds'), 'it hops and shoots');
  const wave = { x: 0, z: 0, speed: 7, max: 4.5 };
  assert.ok(waveHits(wave, 0.5, 3.5, GROUND_STAND_Y, 0) && !waveHits(wave, 0.5, 3.5, GROUND_STAND_Y + 1, 0), 'jumped over');
  const seeds = { x: 0, z: 0, a0: 0, n: 4, speed: 6 };
  assert.ok(seedHits(seedAt(seeds, 0, 0.5), 0, GROUND_STAND_Y, 3));
  // bopped till it is friendly: out of reach doesn't count
  fight.start('rest', { dur: 1e9 });
  assert.equal(fight.bop(1, 'mallet', fight.x + 9, GROUND_STAND_Y, fight.z), null, 'too far');
  assert.equal(fight.bop(1, 'axe', fight.x + 1, GROUND_STAND_Y, fight.z), null, 'not a weapon');
  let hit;
  for (let i = 0; i < 200 && !hit?.won; i++) hit = fight.bop(1, 'wooden_sword', fight.x + 1, GROUND_STAND_Y, fight.z);
  assert.equal(hit.hp, 0);
  assert.deepEqual(hit.won.sort(), [1, 2], 'everyone who was there');
  assert.equal(fight.phase, 'friendly');
  // left alone, back to sleep, fresh
  for (let i = 0; i < 100; i++) fight.step(0.1, []);
  assert.equal(fight.phase, 'sleep');
  assert.equal(fight.hp, BOSSES.parsnip.hp);
});

await test('the super lion pounces and roars rings of shockwaves, in an arena of its own', () => {
  const fight = new BossFight('lion', mulberry32(3));
  const at = ARENAS.lion;
  assert.equal(arenaAt(at.x, at.z), 'lion');
  assert.notDeepEqual(ARENAS.lion, ARENAS.parsnip);
  const a = { id: 1, x: at.x, y: GROUND_STAND_Y, z: at.z + 6 };
  const fx = [];
  const moves = new Set();
  for (let i = 0; i < 600; i++) {
    fx.push(...fight.step(0.05, [a]));
    moves.add(fight.move);
  }
  assert.ok(moves.has('pounce') && moves.has('roar') && !moves.has('roll') && !moves.has('seeds'), 'its own moves');
  assert.ok(fx.some((f) => f.e === 'wave' && f.roar && f.max === BOSSES.lion.roar.max), 'a roar');
  assert.ok(fx.some((f) => f.e === 'wave' && !f.roar && f.max === BOSSES.lion.pounce.waveMax), 'a pounce lands');
  assert.deepEqual(PIECES.lion_portal.cost, { mane_tuft: 3 });
  assert.equal(PIECES.lion_statue.statue, 'lion');
});

await test('the bee queen sends swarms at everyone in her arena, and dashes', () => {
  const fight = new BossFight('bee', mulberry32(5));
  const at = ARENAS.bee;
  assert.equal(arenaAt(at.x, at.z), 'bee');
  const a = { id: 1, x: at.x, y: GROUND_STAND_Y, z: at.z + 6 };
  const b = { id: 2, x: at.x - 6, y: GROUND_STAND_Y, z: at.z };
  const fx = [];
  const moves = new Set();
  for (let i = 0; i < 600; i++) {
    fx.push(...fight.step(0.05, [a, b]));
    moves.add(fight.move);
  }
  assert.ok(moves.has('swarm') && moves.has('roll') && moves.has('dizzy'), 'swarms, dashes, and a dizzy sit-down after');
  const swarm = fx.find((f) => f.e === 'swarm');
  assert.equal(swarm.a.length, BOSSES.bee.swarm.count + BOSSES.bee.swarm.perPlayer, 'one more swarm for the second farmer');
  // a swarm flies off along its line, and a jump clears it
  const flat = { x: 0, z: 0, a: [0], speed: 4, life: 3 };
  const at1 = swarmAt(flat, 0, 1);
  assert.ok(Math.abs(at1.z - 4) < 1e-9 && Math.abs(at1.x) <= 0.9);
  assert.ok(swarmHits(at1, at1.x, GROUND_STAND_Y, at1.z) && !swarmHits(at1, at1.x, GROUND_STAND_Y + 1.2, at1.z));
  assert.deepEqual(PIECES.bee_portal.cost, { honey_drop: 3 });
});

await test('the giant crow swoops down from the sky (out of reach up there) and beats up gusts', () => {
  assert.deepEqual(BOSS_IDS, ['parsnip', 'lion', 'bee', 'crow', 'toad'], 'all five');
  const fight = new BossFight('crow', mulberry32(9));
  const at = ARENAS.crow;
  assert.equal(arenaAt(at.x, at.z), 'crow');
  const a = { id: 1, x: at.x, y: GROUND_STAND_Y, z: at.z + 6 };
  const fx = [];
  let high = 0;
  let low = 0;
  let caught = 0;
  let outOfReach = false;
  for (let i = 0; i < 800; i++) {
    fx.push(...fight.step(0.05, [a]));
    if (fight.move !== 'swoop') continue;
    if (fight.y >= BOSSES.crow.swoop.height - 1e-6) {
      high++;
      outOfReach ||= fight.bop(1, 'mallet', fight.x + 1, GROUND_STAND_Y, fight.z) === null;
    }
    if (fight.y > 0 && fight.y < 1) low++;
    const b = bossFromWire(fight.toWire());
    if (swoopHits(b, BOSSES.crow, b.x, GROUND_STAND_Y, b.z)) caught++;
  }
  assert.ok(high && low && caught, 'up high, then down low through them');
  assert.ok(outOfReach, 'no bopping it up in the sky');
  assert.ok(fx.some((f) => f.e === 'wave' && f.gust), 'a gust');
  assert.deepEqual(PIECES.crow_portal.cost, { crow_feather: 3 });
});

await test('the bog toad hops with a splash, puffs out flies and croaks rings, in an arena of its own', () => {
  const fight = new BossFight('toad', mulberry32(11));
  const at = ARENAS.toad;
  assert.equal(arenaAt(at.x, at.z), 'toad');
  for (const id of BOSS_IDS) if (id !== 'toad') assert.ok(Math.hypot(ARENAS[id].x - at.x, ARENAS[id].z - at.z) > 2 * ARENA_R + 10, `clear of the ${id}'s arena`);
  const a = { id: 1, x: at.x, y: GROUND_STAND_Y, z: at.z + 6 };
  const fx = [];
  const moves = new Set();
  for (let i = 0; i < 1200; i++) {
    fx.push(...fight.step(0.05, [a]));
    moves.add(fight.move);
  }
  assert.ok(['hop', 'swarm', 'roar'].every((move) => moves.has(move)), [...moves].join(' '));
  assert.ok(fx.some((f) => f.e === 'wave' && f.roar), 'a croak');
  assert.ok(fx.some((f) => f.e === 'wave' && !f.roar), 'a landing');
  assert.ok(fx.some((f) => f.e === 'swarm'), 'its flies');
  assert.deepEqual(PIECES.toad_portal.cost, { bog_pearl: 3 });
  assert.equal(PIECES.toad_statue.statue, 'toad');
  // beaten (a mallet a bop, and plenty of them), it is friendly
  const fresh = new BossFight('toad', mulberry32(3));
  for (let i = 0; i < 60; i++) fresh.step(0.05, [a]);
  let won = null;
  for (let i = 0; i < 400 && !won; i++) {
    fresh.step(0.05, [a]);
    won = fresh.bop(1, 'mallet', fresh.x + 1, GROUND_STAND_Y, fresh.z)?.won ?? null;
    a.t = (a.t ?? 0) + 1;
  }
  assert.ok(won, 'beaten');
  assert.equal(fresh.phase, 'friendly');
});

await test('a boss fight on a farm with helpers: its portal, the bops, and the portal used up when it is beaten', () => {
  const room = new FarmRoom({ farm: { id: 'bossfarm', save: null }, admit: () => ({ id: 'bossfarm', owner: true }) });
  const a = join(room, 'Ann');
  const b = join(room, 'Bo');
  const start = arenaStart('parsnip');
  // a full set of seals builds the portal (paid from the builder's backpack, on the page)
  assert.deepEqual(PIECES.parsnip_portal.cost, { [BOSSES.parsnip.key]: BOSSES.parsnip.pieces });
  room.message(a.p, { t: C.STATE, x: 5, y: GROUND_STAND_Y, z: 6, yaw: 0, f: 1 });
  room.message(a.p, { t: C.BUILD, key: '5,5', piece: 'parsnip_portal' });
  assert.equal(room.built.get('5,5'), 'parsnip_portal');
  room.message(a.p, { t: C.BUILD, key: '6,5', piece: 'parsnip_portal' });
  assert.equal(room.built.get('6,5'), undefined, 'one to a farm');
  // into the arena: it wakes and fights
  for (const who of [a, b]) room.message(who.p, { t: C.STATE, x: start.x, y: GROUND_STAND_Y, z: start.z, yaw: 0, f: 1 });
  let now = Date.now();
  for (let i = 0; i < 60; i++) room.tickBosses((now += 50));
  const fight = room.fights.get('parsnip');
  assert.equal(fight.phase, 'fight');
  assert.ok(a.conn.all(S.BOSS).length > 5 && b.conn.all(S.BOSS_FX).some((m) => m.fx.e === 'wake'));
  // not taken down with a fight on through it
  room.message(a.p, { t: C.STATE, x: 5, y: GROUND_STAND_Y, z: 6, yaw: 0, f: 1 });
  room.message(a.p, { t: C.UNBUILD, key: '5,5' });
  assert.equal(room.built.get('5,5'), 'parsnip_portal');
  // bopped from beside it, never faster than a weapon swings
  const beside = () => {
    fight.start('rest', { dur: 1e9 });
    for (const who of [a, b]) room.message(who.p, { t: C.STATE, x: fight.x + 1, y: GROUND_STAND_Y, z: fight.z, yaw: 0, f: 1 });
  };
  beside();
  room.message(a.p, { t: C.BOSS_BOP, boss: 'parsnip', weapon: 'mallet' });
  room.message(a.p, { t: C.BOSS_BOP, boss: 'parsnip', weapon: 'mallet' });
  assert.equal(b.conn.all(S.BOSS_FX).filter((m) => m.fx.e === 'bop').length, 1, 'too fast');
  room.message(b.p, { t: C.BOSS_BOP, boss: 'lion', weapon: 'mallet' });
  assert.equal(b.conn.all(S.BOSS_FX).filter((m) => m.fx.e === 'bop').length, 1, 'not that boss here');
  for (let i = 0; i < 200 && !a.conn.last(S.BOSS_WON); i++) {
    beside();
    a.p.bossBopAt = 0;
    room.message(a.p, { t: C.BOSS_BOP, boss: 'parsnip', weapon: 'mallet' });
  }
  const won = b.conn.last(S.BOSS_WON);
  assert.ok(won, 'beaten');
  assert.deepEqual(won.won.sort(), [a.p.id, b.p.id].sort(), 'both took part');
  assert.equal(room.built.get('5,5'), undefined, 'its portal is used up');
  assert.deepEqual(a.conn.last(S.UNBUILT), { t: S.UNBUILT, key: '5,5', piece: portalOf('parsnip'), by: 0 }, 'and nobody gets the seals back');
  room.close();
});

// ---------- Cards and the arcade ----------
console.log('cards and the arcade');
await test('the merchant\'s request: the same for everyone on a day, something sold at the stall, paying more than the stall', () => {
  const days = Array.from({ length: 60 }, (_, d) => requestFor(d + 1));
  assert.deepEqual(requestFor(7), requestFor(7));
  assert.deepEqual([requestFor(1).item, requestFor(2).item], ['turnip', 'turnip'], 'what a new farmer grows first');
  assert.ok(new Set(days.map((r) => r.item)).size > 5, 'a different thing now and then');
  for (const r of days) {
    const [, least, most] = REQUESTS.wants.find(([item]) => item === r.item);
    assert.ok(r.count >= least && r.count <= most, `${r.count} ${r.item}`);
    assert.ok(r.gold > r.count * SHOP[r.item].sell, `${r.gold}g for ${r.count} ${r.item}`);
    assert.equal(r.gold % 10, 0);
  }
});

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

await test('the farm\'s seasons: a week each, spring to winter and round again, turning on a season\'s last day', () => {
  const at = (day, hour) => {
    const { now, next, blend } = seasonAt(day, hour);
    return [now.name, next.name, +blend.toFixed(2)];
  };
  assert.deepEqual(at(1, 6), ['Spring', 'Summer', 0]);
  assert.deepEqual(at(SEASON_DAYS, 12), ['Spring', 'Summer', 0.5], 'turning on its last day');
  assert.deepEqual(at(SEASON_DAYS + 1, 0), ['Summer', 'Autumn', 0]);
  assert.deepEqual(at(SEASON_DAYS * 3 + 1, 12), ['Winter', 'Spring', 0]);
  assert.deepEqual(at(SEASON_DAYS * 4 + 1, 12), ['Spring', 'Summer', 0], 'and round again');
  // each dresses all the farm's leaves and needles, and snow lies (and the flowers are gone) in winter only
  for (const s of SEASONS) {
    assert.deepEqual([s.leaves.length, s.pines.length], [4, 3], s.name);
    assert.equal(s.snow > 0, s.name === 'Winter', `${s.name}: snow`);
    assert.equal(s.flowers === 0, s.name === 'Winter', `${s.name}: flowers`);
    assert.ok(['petal', 'fluff', 'leaf', 'flake'].includes(s.fall[0]) && s.fall[1] <= 100, `${s.name}: what drifts`);
  }
  assert.equal(seasonAt(SEASON_DAYS * 2 + 3, 0).into, 2, 'how far into it');
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
    // (a hop race's lobby: its spots are for the taking while it gathers, unlike a loot run's)
    const { code } = await fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"game":"hop_race"}' }).then((r) => r.json());
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

  await test('the leaderboards over HTTP: every lobby game\'s board', async () => {
    const { games } = await fetch(`${base}/api/leaderboards?name=nobody`).then((r) => r.json());
    assert.deepEqual(Object.keys(games).sort(), Object.keys(LOBBY_GAMES).sort());
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
      const made = await fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ours', seed: 'sunny knoll 5', inviteOnly: true, game: 'hop_race' }) }).then((r) => r.json());
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
      assert.deepEqual([info.name, info.seed, info.inviteOnly, info.game], ['Ours', 'sunny-knoll-5', true, 'hop_race']);
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
