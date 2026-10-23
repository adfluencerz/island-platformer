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
//   coast: { r, waves, x, z }: a round little island, the shore by direction
//     (x, z: its middle, if not the arena's)
//   bales: [[x, z, w, d, top], ...]: hay bales to climb, solid down to the
//     ground; a stack is a wide one with a narrower one standing on it
//   coins: [[x, y, z], ...]: a coin's id is its index (y: where it floats)
//   hill: [[x, z, w, d, top], ...]: king of the hill's steps, bottom up (the
//     last is the crown); [] for other games
//   tiles: [[x, z], ...]: last one standing's floor over the sea (TILE
//     apart, their tops at 0); order: which falls when (tile ids, the first
//     to go first), fallAt[id]: ms into the game it drops (Infinity: it stays)
//   hops: [[x, z, size, top], ...]: the hop race's wooden hops over the sea,
//     in the order they are hopped; goal: [x, z, size, top], where it ends
//   start(i, n): where player i of n starts, round the middle (round the
//     edge, with a hill there)
// and answers isLand(x, z), groundAt(x, z) ('grass', 'sand' or null: the sea),
// topAt(x, z, margin) (the highest bale or step over x, z, or 0),
// onCrown(x, feetY, z) (up on the hill's top) and onGoal(x, feetY, z) (on
// the hop race's goal).
//
// Arenas are versioned the way islands are: never change how a kind of arena
// grows from a seed once players know it; a new look is a new kind (or a new
// generation of seeds, as for islands).
import { mulberry32, hashSeed, normalizeSeed, randomSeed, STONE_CIRCLE } from './worldgen.js';
import { GROUND_STAND_Y } from './level.js';
import { MINIGAMES } from './balance.js';
import { weightText } from './fishing.js';

// The party games there are, by kind: what they are called and how long they last
export const GAMES = {
  coin_rush: {
    name: 'Coin rush', ms: MINIGAMES.coin_rush.ms, blurb: 'Pick up the most coins before the time runs out',
    unit: '', scored: (n) => `${n} coin${n === 1 ? '' : 's'}`, nobody: 'nobody picked up a coin',
  },
  king_of_hill: {
    name: 'King of the hill', ms: MINIGAMES.king_of_hill.ms, blurb: 'Stand on top of the hill the longest: bop the others off',
    unit: ' s', scored: (n) => `${n} s on top`, nobody: 'nobody held the hill', shove: true,
  },
  last_one: {
    name: 'Last one standing', ms: MINIGAMES.last_one.ms, blurb: 'The tiles drop one by one: be the last one up (shove the others off)',
    unit: ' s', scored: (n) => `${n} s up`, nobody: 'everyone took a splash', shove: true,
  },
  hop_race: {
    name: 'Hop race', ms: MINIGAMES.hop_race.ms, blurb: 'Hop across the water to the flag: first there wins (fall in, start again)',
    unit: ' s', scored: (n) => `${n} s to spare`, nobody: 'nobody made it across',
  },
  fishing_contest: {
    name: 'Fishing contest', ms: MINIGAMES.fishing_contest.ms, blurb: 'Land the most weight of fish before the time runs out',
    unit: '', scored: (n) => `${weightText(n)} of fish`, nobody: 'nobody landed a fish', board: true, // (started at the board by the pond, not the signpost)
  },
};

export const COIN_FLOAT = 0.7; // how high over what it is over a coin floats (a farmer standing there touches it)
const BALE_RISE = 1.2; // a bale's height (a stack is two)
const REACH_UP = 1.6; // the most a farmer climbs in one jump (as for an island's steps)

const waves = (a, list) => list.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * a + phase), 0);
const round1 = (v) => Math.round(v * 10) / 10;

// A seed for a new arena: "dewy-glade-31"
export const arenaSeed = (rand = Math.random) => normalizeSeed(randomSeed(rand).replace(/-v\d+$/, ''));

// Hay bales round an arena (b: a stream): want [min, max] of them, at
// [near, far] from the middle, with footprints well on land and where
// clear(x, z, w, d) says; nearly half have a narrower one stacked on one end
// (the other end is the step up). The order the stream is drawn from never
// changes (coin rush arenas are pinned).
function growBales(b, shoreDist, clear, [lo, hi], [near, far]) {
  const bales = [];
  const clearOf = (x, z, w, d, gap) =>
    bales.every(([bx, bz, bw, bd]) => Math.abs(x - bx) > (w + bw) / 2 + gap || Math.abs(z - bz) > (d + bd) / 2 + gap);
  const fits = (x, z, w, d) =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => shoreDist(x + (sx * w) / 2, z + (sz * d) / 2) > 2) && clear(x, z, w, d);
  const want = b.int(lo, hi);
  for (let n = 0; n < 300 && bales.length < want; n++) {
    const a = b.rand(0, Math.PI * 2);
    const d = b.rand(near, far);
    const x = round1(Math.cos(a) * d);
    const z = round1(Math.sin(a) * d);
    const w = round1(b.rand(2.2, 3.4));
    const dd = round1(b.rand(2.2, 3.4));
    if (!fits(x, z, w, dd) || !clearOf(x, z, w, dd, 1.6)) continue;
    bales.push([x, z, w, dd, BALE_RISE]);
    if (b.rng() < 0.45) {
      const along = w > dd;
      const sw = along ? round1(w * 0.5) : w;
      const sd = along ? dd : round1(dd * 0.5);
      const side = b.rng() < 0.5 ? -1 : 1;
      bales.push([along ? round1(x + side * (w - sw) / 2) : x, along ? z : round1(z + side * (dd - sd) / 2), sw, sd, BALE_RISE * 2]);
    }
  }
  return bales;
}

// A stream of numbers for one part of one try at an arena
function streamFor(kind, seed, attempt) {
  return (part) => {
    const rng = mulberry32(hashSeed(`${kind}/${seed}/${attempt}/${part}`));
    const rand = (min, max) => min + rng() * (max - min);
    return { rng, rand, int: (min, max) => Math.floor(rand(min, max + 1)), pick: (arr) => arr[Math.floor(rng() * arr.length)] };
  };
}

// ---------- Coin rush: a round meadow with hay bales ----------
function growCoinRush(seed, attempt) {
  const stream = streamFor('coin_rush', seed, attempt);

  // The coast: round, with a couple of gentle bays
  const c = stream('coast');
  const coast = { r: round1(c.rand(13, 16)), waves: [[c.rand(0.6, 1.2), c.int(2, 3), c.rand(0, 6.3)], [c.rand(0.3, 0.7), c.int(4, 6), c.rand(0, 6.3)]] };
  const shoreDist = (x, z) => coast.r + waves(Math.atan2(z, x), coast.waves) - Math.hypot(x, z);

  // The hay bales: a few round the middle (clear of where everyone starts), some stacked two high
  const bales = growBales(stream('bales'), shoreDist, (x, z, w, d) => Math.hypot(x, z) > 3.5 + Math.max(w, d) / 2, [6, 9], [4.5, coast.r - 3]);
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

// ---------- King of the hill: a meadow with a stepped hill in the middle ----------
// The hill is three grassy steps, each standing on the one under it with a
// ledge all round; its top step is the crown, where the time counts.
// Farmers start round the edge, a few bales between them and the hill.
function growKingOfHill(seed, attempt) {
  const stream = streamFor('king_of_hill', seed, attempt);
  const c = stream('coast');
  const coast = { r: round1(c.rand(13, 15)), waves: [[c.rand(0.5, 1), c.int(2, 3), c.rand(0, 6.3)], [c.rand(0.3, 0.6), c.int(4, 6), c.rand(0, 6.3)]] };
  const shoreDist = (x, z) => coast.r + waves(Math.atan2(z, x), coast.waves) - Math.hypot(x, z);

  // The hill: each step a little off the middle of the one under it
  const h = stream('hill');
  const hill = [];
  let [x, z, w, d, top] = [0, 0, h.rand(8, 9.5), h.rand(8, 9.5), 0];
  for (const [shrink, rise] of [[1, h.rand(0.9, 1.1)], [h.rand(0.6, 0.68), h.rand(0.9, 1.1)], [h.rand(0.52, 0.6), h.rand(0.9, 1.1)]]) {
    const nw = round1(w * shrink);
    const nd = round1(d * shrink);
    x = round1(x + h.rand(-0.15, 0.15) * (w - nw));
    z = round1(z + h.rand(-0.15, 0.15) * (d - nd));
    top = round1(top + rise);
    hill.push([x, z, nw, nd, top]);
    [w, d] = [nw, nd];
  }

  // A few bales out toward the edge, clear of the hill and of where everyone starts
  const startR = round1(coast.r - 3.5);
  const [hx, hz, hw, hd] = hill[0];
  const clear = (bx, bz, bw, bd) =>
    (Math.abs(bx - hx) > (bw + hw) / 2 + 2 || Math.abs(bz - hz) > (bd + hd) / 2 + 2) &&
    Math.abs(Math.hypot(bx, bz) - startR) > 1.2 + Math.max(bw, bd) / 2;
  const bales = growBales(stream('bales'), shoreDist, clear, [3, 5], [6, coast.r - 2.5]);

  return finishArena({ game: 'king_of_hill', seed, half: Math.ceil(coast.r + 3), coast, hill, bales, coins: [], startR });
}

// ---------- Last one standing: a floor of tiles over the sea ----------
// The tiles drop one by one, from the edge in (more or less), quicker and
// quicker, till only a couple are left. Whoever falls in washes up on a
// little islet off to the side to watch, too far to jump back from.
export const TILE = 2; // the tiles' spacing (each is TILE_GAP narrower)
export const TILE_GAP = 0.1;
function growLastOne(seed, attempt) {
  const stream = streamFor('last_one', seed, attempt);
  const f = stream('floor');
  const r = f.rand(6.5, 8);
  const bumps = [[f.rand(0.4, 0.9), f.int(2, 4), f.rand(0, 6.3)]];
  const tiles = [];
  const n = Math.ceil(r / TILE + 1);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const [x, z] = [i * TILE, j * TILE];
      if (Math.hypot(x, z) < r + waves(Math.atan2(z, x), bumps)) tiles.push([x, z]);
    }
  }
  // the order they fall in: mostly from the edge in, with a good shuffle
  const o = stream('order');
  const key = tiles.map(([x, z]) => o.rng() * 0.5 - (Math.hypot(x, z) / r) * 0.5);
  const order = tiles.map((_, id) => id).sort((a, b) => key[a] - key[b] || a - b);
  // where fallen farmers wash up
  const w = stream('watch');
  const a = w.rand(0, Math.PI * 2);
  const coast = { r: 3.2, waves: [[0.3, 3, w.rand(0, 6.3)]], x: round1(Math.cos(a) * (r + 11)), z: round1(Math.sin(a) * (r + 11)) };
  return finishArena({
    game: 'last_one', seed, half: Math.ceil(r + 11 + coast.r + 3), coast, bales: [], coins: [], tiles, order, startR: MINIGAMES.last_one.startR,
  });
}

// When each of last one standing's tiles drops (ms into the game; Infinity:
// it stays), from the order they go in: one every so often, quicker toward
// the end. (MINIGAMES.last_one: tuning it doesn't change the arena.)
function fallTimes(order) {
  const { ms, graceMs, quietMs, keep, slowdown } = MINIGAMES.last_one;
  const at = new Array(order.length).fill(Infinity);
  const m = order.length - keep;
  const weights = Array.from({ length: m }, (_, k) => 1 + (slowdown - 1) * (1 - k / Math.max(m - 1, 1)));
  const total = weights.reduce((sum, v) => sum + v, 0);
  let t = graceMs;
  for (let k = 0; k < m; k++) {
    t += (weights[k] / total) * (ms - graceMs - quietMs);
    at[order[k]] = Math.round(t);
  }
  return at;
}

// ---------- Hop race: hop to hop across the water, to the flag ----------
// A little start meadow, then a winding line of wooden hops on posts over
// the sea, up and down a little, each a jump from the last (HOP: the gap
// between their edges, how much higher or lower), out to the goal: a wide
// landing with a flag. First onto the goal wins; whoever falls in starts
// again on the meadow (their page sees to that).
export const HOP = { gap: [1.1, 2.3], rise: [-0.7, 0.9], size: [1.6, 2.3], count: [10, 14], top: [0.6, 3.4], goal: 4 };
// the gap between two squares' nearest edges ([x, z, size])
const edgeGap = ([ax, az, as], [bx, bz, bs]) => Math.hypot(Math.max(0, Math.abs(ax - bx) - (as + bs) / 2), Math.max(0, Math.abs(az - bz) - (as + bs) / 2));
function growHopRace(seed, attempt) {
  const stream = streamFor('hop_race', seed, attempt);
  const c = stream('coast');
  const coast = { r: round1(c.rand(5.5, 6.5)), waves: [[c.rand(0.2, 0.5), c.int(2, 3), c.rand(0, 6.3)]] };
  const shoreDist = (x, z) => coast.r + waves(Math.atan2(z, x), coast.waves) - Math.hypot(x, z);

  // Out from the shore, the way it heads wandering a little (never back)
  const h = stream('hops');
  const out = h.rand(0, Math.PI * 2);
  let heading = out;
  const hops = [];
  // the next square on from `last`, `gap` from its edge, along the heading
  const next = (last, size, gap) => {
    for (let d = (last[2] + size) / 2; d < 12; d += 0.05) {
      const sq = [round1(last[0] + Math.cos(heading) * d), round1(last[1] + Math.sin(heading) * d), size];
      if (edgeGap(last, sq) >= gap) return sq;
    }
    return null;
  };
  // (from the shore: where the land ends, that way)
  const shore = (coast.r + waves(out, coast.waves)) - 0.6;
  let last = [Math.cos(out) * shore, Math.sin(out) * shore, 0, 0];
  const count = h.int(...HOP.count);
  for (let i = 0; i <= count; i++) {
    const goal = i === count;
    const size = goal ? HOP.goal : round1(h.rand(...HOP.size));
    const gap = h.rand(HOP.gap[0], HOP.gap[1]);
    const rise = i === 0 ? h.rand(0.6, 0.9) : h.rand(...HOP.rise);
    heading = out + Math.max(-1, Math.min(1, heading - out + h.rand(-0.5, 0.5)));
    const sq = next(last, size, gap);
    if (!sq) return null;
    const top = round1(Math.max(HOP.top[0], Math.min(HOP.top[1], (last[3] || 0) + rise)));
    last = [...sq, top];
    hops.push(last);
  }
  const goal = hops.pop();
  const far = Math.max(...[...hops, goal].map(([x, z, s]) => Math.max(Math.abs(x), Math.abs(z)) + s));
  return finishArena({ game: 'hop_race', seed, half: Math.ceil(far + 3), coast, bales: [], coins: [], hops, goal });
}

// ---------- Fishing contest: a little round island, the sea all round ----------
// Fished from its shore (shared/fishing.js: the 'contest' water), with a few
// clumps of reeds along it (the pages') and nothing to climb
function growFishingContest(seed) {
  const rng = mulberry32(hashSeed(`fishing_contest/${seed}/coast`));
  const rand = (min, max) => min + rng() * (max - min);
  const int = (min, max) => Math.floor(rand(min, max + 1));
  const coast = { r: round1(rand(9, 11)), waves: [[rand(0.5, 1), int(2, 3), rand(0, 6.3)], [rand(0.2, 0.5), int(4, 6), rand(0, 6.3)]] };
  return finishArena({ game: 'fishing_contest', seed, half: Math.ceil(coast.r + 3), coast, bales: [], coins: [] });
}

// The questions everyone asks of an arena
function finishArena(desc) {
  const { coast, bales, hill = [], startR = 1.6, tiles = [], order = [], hops = [], goal = null } = desc;
  const blocks = [...bales, ...hill];
  const [ox, oz] = [coast.x ?? 0, coast.z ?? 0];
  const shoreDist = (x, z) => coast.r + waves(Math.atan2(z - oz, x - ox), coast.waves) - Math.hypot(x - ox, z - oz);
  const isLand = (x, z) => shoreDist(x, z) > 0.5;
  const groundAt = (x, z) => (!isLand(x, z) ? null : shoreDist(x, z) < 2 ? 'sand' : 'grass');
  const topAt = (x, z, margin = 0) =>
    blocks.reduce((top, [bx, bz, w, d, t]) => (Math.abs(x - bx) < w / 2 + margin && Math.abs(z - bz) < d / 2 + margin ? Math.max(top, t) : top), 0);
  // Last one standing: the tile under x, z (its id; -1: none)
  const tileIds = new Map(tiles.map(([x, z], id) => [`${Math.round(x / TILE)},${Math.round(z / TILE)}`, id]));
  const tileAt = (x, z) => tileIds.get(`${Math.round(x / TILE)},${Math.round(z / TILE)}`) ?? -1;
  // round the middle, as farmers arrive on an island (shared/level.js
  // spawnPoint); round the edge for a game with a hill in the middle; on the
  // tiles nearest a ring round the middle, over the sea
  const start = (i, n) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    const r = hill.length || tiles.length ? startR : n > 1 ? startR : 0;
    let [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
    if (tiles.length) [x, z] = tiles.reduce((best, t) => (Math.hypot(t[0] - x, t[1] - z) < Math.hypot(best[0] - x, best[1] - z) ? t : best));
    return { x: round1(x), y: GROUND_STAND_Y, z: round1(z) };
  };
  // Last one standing: where farmer i of n who fell in washes up, on the islet
  const watch = (i, n) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    return { x: round1(ox + Math.cos(a) * 1.4), y: GROUND_STAND_Y, z: round1(oz + Math.sin(a) * 1.4) };
  };
  // King of the hill: whether a farmer with their feet at y is up on the
  // crown (standing, or jumping about over it)
  const crown = hill.at(-1);
  const onCrown = (x, y, z) =>
    !!crown && Math.abs(x - crown[0]) < crown[2] / 2 + 0.3 && Math.abs(z - crown[1]) < crown[3] / 2 + 0.3 && y > crown[4] - 0.3 && y < crown[4] + 2.5;
  const fallAt = tiles.length ? fallTimes(order) : [];
  // Hop race: whether a farmer with their feet at y is on the goal (standing,
  // or hopping about on it)
  const onGoal = (x, y, z) =>
    !!goal && Math.abs(x - goal[0]) < goal[2] / 2 + 0.3 && Math.abs(z - goal[1]) < goal[2] / 2 + 0.3 && y > goal[3] - 0.3 && y < goal[3] + 2.5;
  return { ...desc, hill, tiles, order, hops, goal, isLand, groundAt, topAt, start, crown, onCrown, tileAt, fallAt, watch, onGoal };
}

// What every arena must be: a list of what is wrong with it (empty: nothing).
// Every bale is on land and climbable (a stack's top a jump from the bale it
// stands on), every coin is on land, a farmer can touch it, and none is
// inside a bale.
export function checkArena(arena) {
  const problems = [];
  if (!arena.tiles.length && !arena.isLand(0, 0)) problems.push('the middle is in the sea');
  // last one standing: enough floor, and the islet out of a jump's reach of it
  if (arena.tiles.length) {
    if (arena.tiles.length < 25) problems.push('too few tiles');
    const { x, z, r } = arena.coast;
    if (!arena.isLand(x, z)) problems.push('the islet is in the sea');
    const gap = Math.min(...arena.tiles.map(([tx, tz]) => Math.hypot(tx - x, tz - z))) - TILE * 0.71 - r - 0.4;
    if (gap < 6) problems.push(`the islet is a jump from the tiles (${gap.toFixed(1)})`);
  }
  // hop race: each hop over the sea, a jump on from the one before (the
  // first from the shore), none in another's way
  if (arena.goal) {
    const line = [...arena.hops, arena.goal];
    const shore = Math.min(...Array.from({ length: 72 }, (_, k) => {
      const a = (k / 72) * Math.PI * 2;
      let d = 0;
      while (arena.isLand(Math.cos(a) * (d + 0.1), Math.sin(a) * (d + 0.1))) d += 0.1;
      return edgeGap([Math.cos(a) * d, Math.sin(a) * d, 0], line[0]);
    }));
    if (shore > HOP.gap[1] + 0.6) problems.push(`the first hop is out of reach of the shore (${shore.toFixed(1)})`);
    if (line[0][3] > 1) problems.push('the first hop is too high to jump up onto');
    line.forEach(([x, z, size, top], i) => {
      if ([[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx, sz]) => arena.isLand(x + (sx * size) / 2, z + (sz * size) / 2))) problems.push(`hop ${i} is on land`);
      if (!i) return;
      const gap = edgeGap(line[i - 1], line[i]);
      if (gap > HOP.gap[1] + 0.05 || gap < HOP.gap[0] - 0.05) problems.push(`hop ${i} is ${gap.toFixed(1)} from the one before`);
      if (top - line[i - 1][3] > HOP.rise[1] + 0.05) problems.push(`hop ${i} is too high a jump`);
      for (let j = 0; j < i - 1; j++) if (edgeGap(line[j], line[i]) < 1) problems.push(`hops ${j} and ${i} are in each other's way`);
    });
  }
  for (const [x, z, w, d, top] of arena.bales) {
    if (![[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => arena.isLand(x + (sx * w) / 2, z + (sz * d) / 2))) problems.push(`the bale at ${x}, ${z} hangs over the sea`);
    if (top > BALE_RISE) {
      const under = arena.bales.find(([bx, bz, bw, bd, bt]) => bt === top - BALE_RISE && Math.abs(x - bx) <= (bw - w) / 2 + 0.01 && Math.abs(z - bz) <= (bd - d) / 2 + 0.01 && (bw > w || bd > d));
      if (!under) problems.push(`the stacked bale at ${x}, ${z} has no step up`);
    } else if (top > REACH_UP) problems.push(`the bale at ${x}, ${z} is out of reach`);
  }
  // the hill's steps: on land, each on the one under it with a ledge all round, a jump up
  arena.hill.forEach(([x, z, w, d, top], i) => {
    const [ux, uz, uw, ud, ut] = i ? arena.hill[i - 1] : [x, z, w + 2, d + 2, 0];
    if (![[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => arena.isLand(x + (sx * w) / 2, z + (sz * d) / 2))) problems.push(`the hill's step ${i} hangs over the sea`);
    if (top - ut > REACH_UP || top <= ut) problems.push(`the hill's step ${i} is out of reach`);
    if (Math.abs(x - ux) > (uw - w) / 2 - 0.8 || Math.abs(z - uz) > (ud - d) / 2 - 0.8) problems.push(`the hill's step ${i} has no ledge to climb from`);
  });
  for (const [x, y, z] of arena.coins) {
    const where = `the coin at ${x}, ${z}`;
    if (!arena.isLand(x, z)) problems.push(`${where} is in the sea`);
    const top = arena.topAt(x, z);
    if (Math.abs(y - top - COIN_FLOAT) > 0.01) problems.push(`${where} is not just over what is under it`);
    if (top === 0 && arena.topAt(x, z, 0.5)) problems.push(`${where} is pressed against a bale`);
  }
  for (let i = 0; i < 8; i++) {
    const { x, z } = arena.start(i, 8);
    if (arena.tiles.length) {
      if (arena.tileAt(x, z) < 0 || arena.fallAt[arena.tileAt(x, z)] < MINIGAMES.last_one.graceMs + 3000) problems.push('a start is not on a tile that stays a while');
    } else if (!arena.isLand(x, z) || arena.topAt(x, z, 0.6)) problems.push('a start is not on open land');
  }
  return problems;
}

const GROW = { coin_rush: growCoinRush, king_of_hill: growKingOfHill, last_one: growLastOne, hop_race: growHopRace, fishing_contest: growFishingContest };

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
