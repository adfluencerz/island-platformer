// Party game arenas from seeds. A lobby's party game (shared/minigame.js) is
// played on an arena of its own, grown from a seed the way a lobby's island
// is (shared/worldgen.js): the same seed grows the same arena on the server
// and in every browser, so only the seed goes over the wire. The server needs
// where the coins are and where players start; the pages build the rest from
// the same data (src/arenas.js).
//
// Pure JS (no three.js, no DOM).
//
// An arena is:
//   game, seed, half: tiles reach this far from the middle
//   coast: { r, waves }: a round little island, the shore by direction
//   bales: [[x, z, w, d, top], ...]: hay bales to climb, solid down to the
//     ground; a stack is a wide one with a narrower one standing on it
//   coins: [[x, y, z], ...]: a coin's id is its index (y: where it floats)
//   start(i, n): where player i of n starts, round the middle
// and answers isLand(x, z), groundAt(x, z) ('grass', 'sand' or null: the sea),
// topAt(x, z, margin) (the highest bale top over x, z, or 0).
//
// Arenas are versioned the way islands are: never change how a kind of arena
// grows from a seed once players know it; a new look is a new kind (or a new
// generation of seeds, as for islands).
import { mulberry32, hashSeed, normalizeSeed, randomSeed, STONE_CIRCLE } from './worldgen.js';
import { GROUND_STAND_Y } from './level.js';
import { MINIGAMES } from './balance.js';

// The party games there are, by kind: what they are called and how long they last
export const GAMES = {
  coin_rush: { name: 'Coin rush', ms: MINIGAMES.coin_rush.ms, blurb: 'Pick up the most coins before the time runs out' },
};

export const COIN_FLOAT = 0.7; // how high over what it is over a coin floats (a farmer standing there touches it)
const BALE_RISE = 1.2; // a bale's height (a stack is two)
const REACH_UP = 1.6; // the most a farmer climbs in one jump (as for an island's steps)

const waves = (a, list) => list.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * a + phase), 0);
const round1 = (v) => Math.round(v * 10) / 10;

// A seed for a new arena: "dewy-glade-31"
export const arenaSeed = (rand = Math.random) => normalizeSeed(randomSeed(rand).replace(/-v\d+$/, ''));

// ---------- Coin rush: a round meadow with hay bales ----------
function growCoinRush(seed, attempt) {
  const stream = (part) => {
    const rng = mulberry32(hashSeed(`coin_rush/${seed}/${attempt}/${part}`));
    const rand = (min, max) => min + rng() * (max - min);
    return { rng, rand, int: (min, max) => Math.floor(rand(min, max + 1)), pick: (arr) => arr[Math.floor(rng() * arr.length)] };
  };

  // The coast: round, with a couple of gentle bays
  const c = stream('coast');
  const coast = { r: round1(c.rand(13, 16)), waves: [[c.rand(0.6, 1.2), c.int(2, 3), c.rand(0, 6.3)], [c.rand(0.3, 0.7), c.int(4, 6), c.rand(0, 6.3)]] };
  const shoreDist = (x, z) => coast.r + waves(Math.atan2(z, x), coast.waves) - Math.hypot(x, z);

  // The hay bales: a few round the middle, some stacked two high
  const b = stream('bales');
  const bales = [];
  const clearOf = (x, z, w, d, gap) =>
    bales.every(([bx, bz, bw, bd]) => Math.abs(x - bx) > (w + bw) / 2 + gap || Math.abs(z - bz) > (d + bd) / 2 + gap);
  // a footprint well on land and clear of where everyone starts
  const fits = (x, z, w, d) =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => shoreDist(x + (sx * w) / 2, z + (sz * d) / 2) > 2) &&
    Math.hypot(x, z) > 3.5 + Math.max(w, d) / 2;
  const want = b.int(6, 9);
  for (let n = 0; n < 300 && bales.length < want; n++) {
    const a = b.rand(0, Math.PI * 2);
    const d = b.rand(4.5, coast.r - 3);
    const x = round1(Math.cos(a) * d);
    const z = round1(Math.sin(a) * d);
    const w = round1(b.rand(2.2, 3.4));
    const dd = round1(b.rand(2.2, 3.4));
    if (!fits(x, z, w, dd) || !clearOf(x, z, w, dd, 1.6)) continue;
    bales.push([x, z, w, dd, BALE_RISE]);
    // stacked: a narrower bale on one end of it (the other end is the step up)
    if (b.rng() < 0.45) {
      const along = w > dd;
      const sw = along ? round1(w * 0.5) : w;
      const sd = along ? dd : round1(dd * 0.5);
      const side = b.rng() < 0.5 ? -1 : 1;
      bales.push([along ? round1(x + side * (w - sw) / 2) : x, along ? z : round1(z + side * (dd - sd) / 2), sw, sd, BALE_RISE * 2]);
    }
  }
  if (bales.length < 4) return null;
  const topAt = (x, z, margin = 0) =>
    bales.reduce((top, [bx, bz, w, d, t]) => (Math.abs(x - bx) < w / 2 + margin && Math.abs(z - bz) < d / 2 + margin ? Math.max(top, t) : top), 0);

  // The coins: most on the grass, a share up on the bales
  const k = stream('coins');
  const { coins: [lo, hi], high } = MINIGAMES.coin_rush;
  const total = k.int(lo, hi);
  const coins = [];
  const apart = (x, y, z) => coins.every(([cx, cy, cz]) => Math.hypot(x - cx, z - cz) > 1.4 || Math.abs(y - cy) > 1);
  for (let n = 0; n < 4000 && coins.length < Math.round(total * high); n++) {
    const [bx, bz, w, d, top] = k.pick(bales);
    const x = round1(bx + k.rand(-0.5, 0.5) * (w - 0.8));
    const z = round1(bz + k.rand(-0.5, 0.5) * (d - 0.8));
    if (topAt(x, z) !== top) continue; // (under a bale stacked on this one)
    const y = round1(top + COIN_FLOAT);
    if (apart(x, y, z)) coins.push([x, y, z]);
  }
  for (let n = 0; n < 4000 && coins.length < total; n++) {
    const a = k.rand(0, Math.PI * 2);
    const d = Math.sqrt(k.rng()) * coast.r;
    const x = round1(Math.cos(a) * d);
    const z = round1(Math.sin(a) * d);
    if (shoreDist(x, z) < 1.8 || Math.hypot(x, z) < 2.6 || topAt(x, z, 0.6)) continue;
    if (apart(x, COIN_FLOAT, z)) coins.push([x, COIN_FLOAT, z]);
  }

  return finishArena({ game: 'coin_rush', seed, half: Math.ceil(coast.r + 3), coast, bales, coins });
}

// The questions everyone asks of an arena
function finishArena(desc) {
  const { coast, bales } = desc;
  const shoreDist = (x, z) => coast.r + waves(Math.atan2(z, x), coast.waves) - Math.hypot(x, z);
  const isLand = (x, z) => shoreDist(x, z) > 0.5;
  const groundAt = (x, z) => (!isLand(x, z) ? null : shoreDist(x, z) < 2 ? 'sand' : 'grass');
  const topAt = (x, z, margin = 0) =>
    bales.reduce((top, [bx, bz, w, d, t]) => (Math.abs(x - bx) < w / 2 + margin && Math.abs(z - bz) < d / 2 + margin ? Math.max(top, t) : top), 0);
  // round the middle, as farmers arrive on an island (shared/level.js spawnPoint)
  const start = (i, n) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    const r = n > 1 ? 1.6 : 0;
    return { x: round1(Math.cos(a) * r), y: GROUND_STAND_Y, z: round1(Math.sin(a) * r) };
  };
  return { ...desc, isLand, groundAt, topAt, start };
}

// What every arena must be: a list of what is wrong with it (empty: nothing).
// Every bale is on land and climbable (a stack's top a jump from the bale it
// stands on), every coin is on land, a farmer can touch it, and none is
// inside a bale.
export function checkArena(arena) {
  const problems = [];
  if (!arena.isLand(0, 0)) problems.push('the middle is in the sea');
  for (const [x, z, w, d, top] of arena.bales) {
    if (![[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => arena.isLand(x + (sx * w) / 2, z + (sz * d) / 2))) problems.push(`the bale at ${x}, ${z} hangs over the sea`);
    if (top > BALE_RISE) {
      const under = arena.bales.find(([bx, bz, bw, bd, bt]) => bt === top - BALE_RISE && Math.abs(x - bx) <= (bw - w) / 2 + 0.01 && Math.abs(z - bz) <= (bd - d) / 2 + 0.01 && (bw > w || bd > d));
      if (!under) problems.push(`the stacked bale at ${x}, ${z} has no step up`);
    } else if (top > REACH_UP) problems.push(`the bale at ${x}, ${z} is out of reach`);
  }
  for (const [x, y, z] of arena.coins) {
    const where = `the coin at ${x}, ${z}`;
    if (!arena.isLand(x, z)) problems.push(`${where} is in the sea`);
    const top = arena.topAt(x, z);
    if (Math.abs(y - top - COIN_FLOAT) > 0.01) problems.push(`${where} is not just over what is under it`);
    if (top === 0 && arena.topAt(x, z, 0.5)) problems.push(`${where} is pressed against a bale`);
  }
  for (let i = 0; i < 8; i++) {
    const { x, z } = arena.start(i, 8);
    if (!arena.isLand(x, z) || arena.topAt(x, z, 0.6)) problems.push('a start is not on open land');
  }
  return problems;
}

const GROW = { coin_rush: growCoinRush };

// The arena a kind of game grows from a seed (the same every time,
// everywhere), or null for a kind there isn't. A seed whose first tries make
// no good arena tries again from a variant of itself.
const arenas = new Map(); // "kind/seed" -> arena, the latest few
export function arenaFor(game, seed, { cached = true } = {}) {
  if (!Object.hasOwn(GROW, game)) return null;
  seed = normalizeSeed(seed) || 'meadow';
  const key = `${game}/${seed}`;
  if (cached && arenas.has(key)) return arenas.get(key);
  let arena = null;
  for (let attempt = 0; !arena && attempt < 50; attempt++) {
    const grown = GROW[game](seed, attempt);
    if (grown && !checkArena(grown).length) arena = grown;
  }
  arenas.set(key, arena);
  if (arenas.size > 8) arenas.delete(arenas.keys().next().value);
  return arena;
}

// ---------- The signpost ----------
// Where a lobby's party games start: a signpost just inside the stone circle
// where farmers arrive, in front of the standing stone that faces the middle
// of the island most. (Nothing grows there or lies there: shared/wilds.js
// keeps the circle clear, shared/worldgen.js the spots.)
export const SIGN_REACH = 2.2; // E this close to it
export function signFor(island) {
  const { spawn, stones } = island;
  const toMiddle = Math.atan2(-spawn.z, -spawn.x);
  const off = (a) => Math.abs(Math.atan2(Math.sin(a - toMiddle), Math.cos(a - toMiddle)));
  const a = stones.length ? stones.reduce((best, s) => (off(s) < off(best) ? s : best)) : toMiddle;
  const r = STONE_CIRCLE - 0.75;
  return { x: round1(spawn.x + Math.cos(a) * r), z: round1(spawn.z + Math.sin(a) * r), yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) };
}
