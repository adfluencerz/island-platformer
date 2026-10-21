// Islands from seeds. Every lobby's wild island is grown from a seed (a short
// string like "mossy-cove-7"): its coast, the pond, the rocky terraces, the
// giant toadstools, the woods, the meadow, the trails, where farmers arrive and
// where the resource spots are. The same seed grows the same island on the
// server and in every browser, so only the seed goes over the wire.
//
// Pure JS (no three.js, no DOM): the server needs the island's shape and spots
// (shared/room.js), the client draws it (src/maps.js, src/world.js).
//
// The seed "classic" is the hand-made island the game started with.
//
// The world grows over time (new biomes, plants, items, props), but an island
// that players know must never change. So growth is versioned by the seed
// itself: a seed ending in "-v2" is a generation 2 island, which has what
// generation 2 added; every other seed is generation 1, exactly as it always
// was. New random seeds get the newest marker (randomSeed), so typing an old
// seed in still grows the old island. To grow the world further: raise
// CURRENT_GEN, add the new things behind `gen >= N` using streams of their own
// (see growExtras), and pin a few old seeds in the tests so they stay put.
//
// Generation 2 added the heath. Generation 3 grows islands twice as wide, with
// several climbs of terraces and rings of toadstools, more woods and trails
// out to them all (NARROW and WIDE below). Generation 4 added the reed marsh,
// generation 5 the sunflower field.

export const CLASSIC_SEED = 'classic';
export const MAX_SEED = 24;
export const WILD_HALF = 34; // tiles reach this far from the middle, on both axes (generations 1 and 2, and the classic island)
const WIDE_HALF = 68; // and from generation 3 on: twice as wide
export const STONE_CIRCLE = 3.6; // radius of the standing stones around the arrival spot
export const THEMES = ['spring', 'autumn', 'blossom'];
export const CURRENT_GEN = 5;
export const HEATH_RADIUS = [4.5, 6]; // the heath's size (gen 2)
export const MARSH_RADIUS = [5, 7]; // the reed marsh's size (gen 4, on islands twice as wide)
export const FIELD_RADIUS = [5.5, 7.5]; // the sunflower field's size (gen 5, on islands twice as wide)

// Which generation of the world a seed grows: "...-v2" is 2, any other seed 1
export function genOf(seed) {
  const m = /-v([1-9])$/.exec(String(seed));
  return m ? Math.min(CURRENT_GEN, Number(m[1])) : 1;
}

// ---------- Randomness ----------
export function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a string -> 32 bits (FNV-1a, then mixed so close strings land far apart)
export function hashSeed(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// What a player types -> a seed: lower case, words joined by dashes. '' if nothing is left.
export function normalizeSeed(s) {
  return String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SEED);
}

const SEED_WORDS = [
  ['mossy', 'sunny', 'misty', 'golden', 'quiet', 'windy', 'dewy', 'amber', 'clover', 'honey', 'sleepy', 'bramble', 'willow', 'velvet', 'pebble', 'fern'],
  ['hollow', 'meadow', 'brook', 'glade', 'knoll', 'cove', 'orchard', 'thicket', 'dell', 'fen', 'isle', 'grove', 'bluff', 'nook', 'shore', 'ridge'],
];

// A fresh seed for a new lobby, e.g. "dewy-glade-31-v2" (of the newest generation). rand: () => [0, 1)
export function randomSeed(rand = Math.random) {
  const [adj, noun] = SEED_WORDS.map((words) => words[Math.floor(rand() * words.length)]);
  return `${adj}-${noun}-${Math.floor(rand() * 100)}-v${CURRENT_GEN}`;
}

// ---------- Geometry ----------
export function distToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// distance from (x, z) to the nearest of a set of polylines
export function distToPaths(x, z, paths) {
  let best = Infinity;
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) best = Math.min(best, distToSegment(x, z, path[i - 1], path[i]));
  }
  return best;
}

const waves = (a, list) => list.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * a + phase), 0);

// ---------- An island ----------
// The plain description (what the generator or the hand-made classic gives)
// plus the questions everyone asks of it:
//   seed, theme, half, spawn: { x, z }
//   coast: { r, waves: [[amp, freq, phase], ...] }: how far the shore is, by direction
//   pond: { x, z, r, wobble: [amp, freq, phase] }, pondFloor
//   terraces: [[x, z, w, d, top, chain], ...]: rock steps, solid down to the ground
//     (chain: which climb, from generation 3; before that there is one)
//   toadstools: [[x, z, cap size, cap top, ring, look], ...] (ring: which ring of
//     caps, look: its color, src/maps.js; from generation 3, one ring before)
//   woods: [[x, z, r], ...]: forest patches (ragged edges)
//   meadow: { x, z, r }, trails: [polylines], stones: [angles round the spawn]
//   heath: { x, z, r } | undefined: a heather moor (generation 2 and up)
//   marsh: { x, z, r } | undefined: a reed marsh with cattails (generation 4 and up)
//   field: { x, z, r } | undefined: a sunflower field (generation 5 and up)
//   spots: [[kind, x, y, z], ...]: a spot's id is its index
function finishIsland(desc) {
  const { coast, pond } = desc;
  const coastAt = (angle) => coast.r + waves(angle, coast.waves);
  const isLand = (x, z) => Math.hypot(x, z) < coastAt(Math.atan2(z, x)) - 0.5;
  const inPond = (x, z) => {
    const a = Math.atan2(z - pond.z, x - pond.x);
    return Math.hypot(x - pond.x, z - pond.z) < pond.r + waves(a, [pond.wobble]);
  };
  // > 0: forest
  const woodsAt = (x, z) =>
    Math.max(...desc.woods.map(([cx, cz, r]) => 1 - Math.hypot(x - cx, z - cz) / r)) +
    Math.sin(x * 0.5 + z * 0.3) * 0.08 + Math.sin(x * 0.23 - z * 0.41) * 0.1;
  // the height you stand on at (x, z) on open ground (platforms aside)
  const floorAt = (x, z) => (inPond(x, z) ? desc.pondFloor : 0);
  // the terrace or toadstool cap over (x, z), give or take margin: { x, z, w, d, top }
  const tops = [
    ...desc.terraces.map(([x, z, w, d, top]) => ({ x, z, w, d, top })),
    ...desc.toadstools.map(([x, z, size, top]) => ({ x, z, w: size, d: size, top })),
  ];
  const topOver = (x, z, margin = 0) =>
    tops.find((t) => Math.abs(x - t.x) < t.w / 2 + margin && Math.abs(z - t.z) < t.d / 2 + margin) ?? null;
  // what the ground is at (x, z): null (the sea), 'pond', 'sand', 'stone' (the
  // stone circle), 'path', 'meadow', 'heath' (the moor), 'marsh' (the reeds),
  // 'field' (the sunflowers), 'moss' (the woods) or 'grass'
  const { spawn, meadow, trails, heath, marsh, field } = desc;
  const groundAt = (x, z) => {
    if (!isLand(x, z)) return null;
    if (inPond(x, z)) return 'pond';
    if (Math.hypot(x, z) > coastAt(Math.atan2(z, x)) - 2.4) return 'sand';
    if (Math.hypot(x - spawn.x, z - spawn.z) < 2.6) return 'stone';
    if (distToPaths(x, z, trails) < 0.9) return 'path';
    const a = Math.atan2(z - meadow.z, x - meadow.x);
    if (Math.hypot(x - meadow.x, z - meadow.z) < meadow.r + Math.sin(a * 4) * 0.8) return 'meadow';
    if (heath) {
      const h = Math.atan2(z - heath.z, x - heath.x);
      if (Math.hypot(x - heath.x, z - heath.z) < heath.r + Math.sin(h * 3 + 1) * 0.9) return 'heath';
    }
    if (marsh) {
      const m = Math.atan2(z - marsh.z, x - marsh.x);
      if (Math.hypot(x - marsh.x, z - marsh.z) < marsh.r + Math.sin(m * 4 + 2) * 1.1) return 'marsh';
    }
    if (field) {
      const f = Math.atan2(z - field.z, x - field.x);
      if (Math.hypot(x - field.x, z - field.z) < field.r + Math.sin(f * 5 + 3) * 1) return 'field';
    }
    if (woodsAt(x, z) > 0) return 'moss';
    return 'grass';
  };
  return { ...desc, coastAt, isLand, inPond, woodsAt, floorAt, topOver, groundAt };
}

// ---------- The classic island ----------
// A ragged coast, a mossy forest in the west and north with giant toadstools
// to hop across, a shallow pond, a flower meadow in the east, rocky terraces
// climbing to the north, and a ring of standing stones where farmers arrive.
function classicIsland() {
  const terraces = [
    [9.5, -8, 5, 4, 1.2],
    [13.5, -12, 4, 4, 2.4],
    [10, -16.5, 4, 3.5, 3.6],
    [4.5, -19, 3.5, 3.5, 4.8],
  ];
  const toadstools = [
    [-16, -4, 3, 1.4],
    [-19.5, -7, 3, 2.6],
    [-16.5, -10.5, 3, 3.8],
  ];
  const pond = { x: -11, z: 3, r: 4.5, wobble: [0.6, 3, 1] };
  const pondFloor = -0.45;
  const above = (top) => top + 0.7; // a treasure floats this far over what it sits on
  const [, t2, t3, t4] = terraces;
  const [m1, m2, m3] = toadstools;
  return finishIsland({
    seed: CLASSIC_SEED,
    theme: 'spring',
    half: WILD_HALF,
    spawn: { x: 0, z: 10 },
    coast: { r: 27, waves: [[3.5, 3, 0.7], [2, 5, 2.1], [1.2, 9, 0.3]] },
    pond,
    pondFloor,
    terraces,
    toadstools,
    woods: [[-17, -8, 9.5], [-6, -20, 8], [-23, 4, 6], [6, -25, 5]],
    meadow: { x: 11, z: 5, r: 6.5 },
    trails: [
      [[0, 10], [0, 5], [-3, 1], [-6, 0.5]], // stone circle -> the pond's shore
      [[0, 5], [5, 1], [9, -4.5]], // -> the foot of the terraces
      [[-3, 1], [-8, -3], [-12.5, -2.5]], // -> into the forest, toward the toadstools
      [[0, 10], [2, 16], [3, 23]], // -> the south shore
      [[6, -9], [2, -12], [-3, -17]], // past the terraces into the north woods
    ],
    stones: [-0.1, 0.55, 2.0, 2.75, 3.45, 4.15],
    spots: [
      // up on the terraces and the toadstools
      ['ledge', t2[0], above(t2[4]), t2[1]],
      ['ledge', t3[0], above(t3[4]), t3[1]],
      ['ledge', t4[0], above(t4[4]), t4[1]],
      ['ledge', m2[0], above(m2[3]), m2[1]],
      ['ledge', m3[0], above(m3[3]), m3[1]],
      // out in the open: the meadow, along the trails, and one on the pond's bottom
      ['meadow', 8, 0.5, 4],
      ['meadow', 12, 0.5, 9],
      ['meadow', 15, 0.5, 2],
      ['meadow', -3, 0.5, -2],
      ['meadow', 2, 0.5, -9],
      ['meadow', -6, 0.5, 15],
      ['meadow', 5, 0.5, 17],
      ['meadow', pond.x, pondFloor + 0.5, pond.z],
      ['meadow', m1[0] + 0.6, above(m1[3]), m1[1] + 0.4],
      // berry bushes along the forest's edge and the meadow
      ['bush', -8, 0, -6],
      ['bush', -12, 0, -15],
      ['bush', 3, 0, -13],
      ['bush', 17, 0, 6],
      ['bush', -4, 0, 19],
      ['bush', -17, 0, 9],
      ['bush', 18, 0, -5],
      // mushrooms in the forest
      ['mushroom', -14, 0, 0],
      ['mushroom', -18, 0, -1],
      ['mushroom', -10, 0, -10],
      ['mushroom', -6, 0, -20],
      ['mushroom', -20, 0, -13],
      ['mushroom', -2, 0, -15],
      ['mushroom', -19, 0, 3],
    ],
  });
}

// ---------- Growing an island ----------
// The layout follows the classic one, rearranged by the seed: the tall things
// (terraces, toadstools) stand in the north half so they rise away from the
// camera, which looks north; farmers arrive in the south and look out over
// it, with the pond and the meadow to either side. The stairs climb north and
// sideways, never back toward the camera. Every step is within a jump of the
// last (a jump reaches ~1.8 up and ~3.5 across).
const NORTH = -Math.PI / 2;
const SOUTH = Math.PI / 2;
const STEP_RISE = 1.2;
const SPOT_COUNTS = { meadow: 4, trail: 3, bush: 7, mushroom: 7 };
const HEATHER_SPOTS = 5; // (gen 2)
const CATTAIL_SPOTS = 5; // (gen 4)
const SUNFLOWER_SPOTS = 5; // (gen 5)
// How big an island grows and how much is on it: up to generation 2 as it
// always did; from generation 3 on twice as wide, with more of everything
// (several climbs and rings of toadstools, more woods, trails out to them all)
const NARROW = {
  half: WILD_HALF, coast: [23.5, 27], bulges: [[2, 3.6], [1.2, 2.2], [0.6, 1.3]], arrival: [5, 9], pond: [3.6, 4.8], meadow: [5.5, 7],
  spots: SPOT_COUNTS, tries: 600, heath: 1,
};
const WIDE = {
  half: WIDE_HALF, coast: [47, 54], bulges: [[4, 7.2], [2.4, 4.4], [1.2, 2.6]], arrival: [10, 18], pond: [5.4, 7.2], meadow: [9, 11.5],
  spots: { meadow: 8, trail: 6, bush: 18, mushroom: 18 }, tries: 2000, heath: 1.6,
};

function growIsland(seed, attempt) {
  const wide = genOf(seed) >= 3;
  const size = wide ? WIDE : NARROW;
  // One stream per part, so a change to how one part grows leaves the rest of
  // every island as it was
  const stream = (part) => {
    const rng = mulberry32(hashSeed(`${seed}/${attempt}/${part}`));
    const rand = (min, max) => min + rng() * (max - min);
    return { rng, rand, int: (min, max) => Math.floor(rand(min, max + 1)), pick: (arr) => arr[Math.floor(rng() * arr.length)] };
  };

  // The coast: a round island with a few bays and headlands, never past the edge
  const c = stream('coast');
  const r = c.rand(...size.coast);
  const room = size.half - 1.5 - r; // how far the coast may bulge
  const freqs = [2, 3, 4, 5, 7, 9].sort(() => c.rng() - 0.5).slice(0, 3).sort((a, b) => a - b);
  const amps = size.bulges.map((range) => c.rand(...range));
  const scale = Math.min(1, room / amps.reduce((a, b) => a + b, 0));
  const coast = { r, waves: freqs.map((f, i) => [amps[i] * scale, f, c.rand(0, Math.PI * 2)]) };
  const coastAt = (a) => coast.r + waves(a, coast.waves);
  const inland = (a, frac) => ({ x: Math.cos(a) * coastAt(a) * frac, z: Math.sin(a) * coastAt(a) * frac });
  const shoreDist = (x, z) => coastAt(Math.atan2(z, x)) - Math.hypot(x, z); // < 0: in the sea

  // Where everything goes: the arrival in the south, the pond and the meadow
  // to either side of it, the terraces and the toadstools in the north
  const p = stream('places');
  const spawnA = SOUTH + p.rand(-0.5, 0.5);
  const sd = p.rand(...size.arrival);
  const spawn = { x: round1(Math.cos(spawnA) * sd), z: round1(Math.sin(spawnA) * sd) };
  const side = p.rng() < 0.5 ? 1 : -1; // which side the pond is on
  const pondAt = inland(SOUTH + side * p.rand(1.0, 1.6), p.rand(0.42, 0.55));
  const pond = { x: round1(pondAt.x), z: round1(pondAt.z), r: round1(p.rand(...size.pond)), wobble: [p.rand(0.4, 0.7), p.int(2, 4), p.rand(0, 6)] };
  const pondFloor = -0.45;
  const meadowAt = inland(SOUTH - side * p.rand(0.9, 1.5), p.rand(0.4, 0.55));
  const meadow = { x: round1(meadowAt.x), z: round1(meadowAt.z), r: round1(p.rand(...size.meadow)) };
  const terraceA = NORTH + p.rand(-0.9, 0.9);
  // the toadstools on the other side of north from the terraces
  const toadA = terraceA + (terraceA > NORTH ? -1 : 1) * p.rand(1.3, 1.9);

  const tops = []; // footprints so far: { x, z, w, d }
  const clearOf = (x, z, w, d, gap) =>
    tops.every((t) => Math.abs(x - t.x) > (w + t.w) / 2 + gap || Math.abs(z - t.z) > (d + t.d) / 2 + gap);
  // a footprint well on land, clear of the pond and the arrival spot
  const fits = (x, z, w, d) =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => shoreDist(x + (sx * w) / 2, z + (sz * d) / 2) > 3.2) &&
    Math.hypot(x - pond.x, z - pond.z) > pond.r + 2 + Math.max(w, d) / 2 &&
    Math.hypot(x - spawn.x, z - spawn.z) > STONE_CIRCLE + 3 + Math.max(w, d) / 2 &&
    Math.hypot(x - meadow.x, z - meadow.z) > meadow.r * 0.6 + Math.max(w, d) / 2;

  const terraces = [];
  const toadstools = [];
  if (!wide) {
    // The terraces: rock steps climbing north (and sideways), each 1.2 up
    const t = stream('terraces');
    {
      const start = inland(terraceA, t.rand(0.3, 0.42));
      let w = t.rand(4.2, 5.4);
      let d = t.rand(3.6, 4.4);
      if (!fits(start.x, start.z, w, d)) return null;
      terraces.push([round1(start.x), round1(start.z), round1(w), round1(d), STEP_RISE]);
      const steps = t.int(3, 5);
      let last = null; // the way the last step went
      while (terraces.length < steps) {
        const [px, pz, pw, pd, ptop] = terraces[terraces.length - 1];
        let placed = false;
        for (let n = 0; n < 12 && !placed; n++) {
          const dir = t.pick(['n', 'n', 'e', 'w'].filter((k) => !(last === 'e' && k === 'w') && !(last === 'w' && k === 'e')));
          w = t.rand(3.4, 4.6);
          d = t.rand(3.2, 4.4);
          const gap = t.rand(-0.6, 0.3); // (< 0: they overlap a little)
          let x;
          let z;
          if (dir === 'n') {
            z = pz - (pd + d) / 2 - gap;
            x = px + t.rand(-1, 1) * Math.max(0, (pw + w) / 2 - 1.8); // keep 1.8 of shared edge
          } else {
            x = px + (dir === 'e' ? 1 : -1) * ((pw + w) / 2 + gap);
            z = pz + t.rand(-1, 0.3) * Math.max(0, (pd + d) / 2 - 1.8);
          }
          // clear of every step but the one it climbs from
          const others = terraces.slice(0, -1).map(([ox, oz, ow, od]) => ({ x: ox, z: oz, w: ow, d: od }));
          const clear = others.every((o) => Math.abs(x - o.x) > (w + o.w) / 2 + 0.4 || Math.abs(z - o.z) > (d + o.d) / 2 + 0.4);
          if (clear && fits(x, z, w, d)) {
            terraces.push([round1(x), round1(z), round1(w), round1(d), round1(ptop + STEP_RISE)]);
            last = dir;
            placed = true;
          }
        }
        if (!placed) break;
      }
      if (terraces.length < 3) return null;
    }
    for (const [x, z, w, d] of terraces) tops.push({ x, z, w, d });

    // The giant toadstools: caps to hop across, each 1.2 above the last
    const m = stream('toadstools');
    {
      const count = m.int(3, 4);
      let at = inland(toadA, m.rand(0.45, 0.6));
      let heading = m.rand(0, Math.PI * 2);
      for (let i = 0; i < count; i++) {
        const size = round1(m.rand(2.8, 3.3));
        let placed = false;
        for (let n = 0; n < 16 && !placed; n++) {
          const x = i === 0 ? at.x + m.rand(-1, 1) : at.x + Math.cos(heading) * m.rand(4.1, 4.6);
          const z = i === 0 ? at.z + m.rand(-1, 1) : at.z + Math.sin(heading) * m.rand(4.1, 4.6);
          // (toward the camera the next cap would hide the one you stand on)
          if (i > 0 && z > at.z + 1.5) {
            heading += m.rand(0.6, 1.6);
            continue;
          }
          if (fits(x, z, size, size) && clearOf(x, z, size, size, 0.8)) {
            toadstools.push([round1(x), round1(z), size, round1(1.4 + i * STEP_RISE)]);
            tops.push({ x, z, w: size, d: size });
            at = { x, z };
            placed = true;
          }
          heading += m.rand(-0.9, 0.9);
        }
        if (!placed) break;
      }
      if (toadstools.length < 3) return null;
    }
  } else {
    // somewhere for the next climb or ring of caps to start (not the first)
    const elsewhere = (s) => inland(s.rand(0, Math.PI * 2), s.rand(0.25, 0.75));

    // The terraces: climbs of rock steps going north (and sideways), each its
    // own: how many steps, how big, how far up each one (`chain`: which climb)
    const t = stream('terraces');
    for (let chain = 0, climbs = t.int(2, 4), n = 0; chain < climbs && n < 20; n++) {
      const steps = t.int(3, 7);
      const rise = () => round1(t.rand(0.8, 1.5));
      const start = chain === 0 ? inland(terraceA, t.rand(0.3, 0.42)) : elsewhere(t);
      let w = t.rand(3.8, 6.4);
      let d = t.rand(3.4, 5.2);
      if (!fits(start.x, start.z, w, d) || !clearOf(start.x, start.z, w, d, 2.5)) {
        if (chain === 0) return null;
        continue;
      }
      const climb = [[round1(start.x), round1(start.z), round1(w), round1(d), rise(), chain]];
      let last = null; // the way the last step went
      while (climb.length < steps) {
        const [px, pz, pw, pd, ptop] = climb[climb.length - 1];
        let placed = false;
        for (let k = 0; k < 12 && !placed; k++) {
          const dir = t.pick(['n', 'n', 'e', 'w'].filter((q) => !(last === 'e' && q === 'w') && !(last === 'w' && q === 'e')));
          w = t.rand(2.8, 5.2);
          d = t.rand(2.8, 4.8);
          const gap = t.rand(-0.6, 0.6); // (< 0: they overlap a little)
          let x;
          let z;
          if (dir === 'n') {
            z = pz - (pd + d) / 2 - gap;
            x = px + t.rand(-1, 1) * Math.max(0, (pw + w) / 2 - 1.8); // keep 1.8 of shared edge
          } else {
            x = px + (dir === 'e' ? 1 : -1) * ((pw + w) / 2 + gap);
            z = pz + t.rand(-1, 0.3) * Math.max(0, (pd + d) / 2 - 1.8);
          }
          // clear of every step but the one it climbs from, and of the other climbs
          const others = climb.slice(0, -1).map(([ox, oz, ow, od]) => ({ x: ox, z: oz, w: ow, d: od }));
          const clear = others.every((o) => Math.abs(x - o.x) > (w + o.w) / 2 + 0.4 || Math.abs(z - o.z) > (d + o.d) / 2 + 0.4);
          if (clear && fits(x, z, w, d) && clearOf(x, z, w, d, 2.5)) {
            climb.push([round1(x), round1(z), round1(w), round1(d), round1(ptop + rise()), chain]);
            last = dir;
            placed = true;
          }
        }
        if (!placed) break;
      }
      if (climb.length < 3) {
        if (chain === 0) return null;
        continue;
      }
      terraces.push(...climb);
      for (const [x, z, w, d] of climb) tops.push({ x, z, w, d });
      chain++;
    }

    // The giant toadstools: rings of caps to hop across, each higher than the
    // last; each ring its own size, count and color (`ring`; `look`: which
    // color, src/maps.js)
    const m = stream('toadstools');
    for (let ring = 0, rings = m.int(2, 4), n = 0; ring < rings && n < 20; n++) {
      const count = m.int(3, 6);
      const look = ring === 0 ? 0 : m.int(0, 3);
      const big = m.rand(2.4, 3.8); // (this ring's caps are about this wide)
      const caps = [];
      let at = ring === 0 ? inland(toadA, m.rand(0.45, 0.6)) : elsewhere(m);
      let heading = m.rand(0, Math.PI * 2);
      let top = round1(m.rand(1, 1.5));
      for (let i = 0; i < count; i++) {
        const size = round1(big * m.rand(0.85, 1.15));
        const prev = caps[caps.length - 1];
        let placed = false;
        for (let k = 0; k < 16 && !placed; k++) {
          const reach = prev ? (prev[2] + size) / 2 + m.rand(0.8, 1.8) : 0;
          const x = prev ? at.x + Math.cos(heading) * reach : at.x + m.rand(-1, 1);
          const z = prev ? at.z + Math.sin(heading) * reach : at.z + m.rand(-1, 1);
          // (toward the camera the next cap would hide the one you stand on)
          if (prev && z > at.z + 1.5) {
            heading += m.rand(0.6, 1.6);
            continue;
          }
          if (fits(x, z, size, size) && clearOf(x, z, size, size, prev ? 0.8 : 2.5)) {
            caps.push([round1(x), round1(z), size, top, ring, look]);
            tops.push({ x, z, w: size, d: size });
            at = { x, z };
            top = round1(top + m.rand(0.8, 1.4));
            placed = true;
          }
          heading += m.rand(-0.9, 0.9);
        }
        if (!placed) break;
      }
      if (caps.length < 3) {
        if (ring === 0) return null;
        tops.splice(tops.length - caps.length, caps.length);
        continue;
      }
      toadstools.push(...caps);
      ring++;
    }
  }
  // the climbs (steps that share a `chain`) and the rings of caps (`ring`); up to generation 2, one of each
  const climbs = [...new Set(terraces.map((step) => step[5]))].map((chain) => terraces.filter((step) => step[5] === chain));
  const rings = [...new Set(toadstools.map((cap) => cap[4]))].map((ring) => toadstools.filter((cap) => cap[4] === ring));

  // The woods: one round the toadstools, a few more scattered about
  const wd = stream('woods');
  const woods = [];
  if (!wide) {
    const mid = toadstools.reduce((s, [x, z]) => ({ x: s.x + x / toadstools.length, z: s.z + z / toadstools.length }), { x: 0, z: 0 });
    woods.push([round1(mid.x), round1(mid.z), round1(wd.rand(8, 10))]);
    for (let n = 0, more = wd.int(2, 3); n < 60 && woods.length < more + 1; n++) {
      const { x, z } = inland(wd.rand(0, Math.PI * 2), wd.rand(0.5, 0.85));
      const rr = wd.rand(5, 7.5);
      if (Math.hypot(x - spawn.x, z - spawn.z) < rr + STONE_CIRCLE + 2) continue;
      if (Math.hypot(x - meadow.x, z - meadow.z) < rr + meadow.r * 0.5) continue;
      if (woods.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < (rr + or) * 0.7)) continue;
      woods.push([round1(x), round1(z), round1(rr)]);
    }
  } else {
    // (from generation 3: one round each ring of toadstools, more scattered about)
    woods.push(...rings.map((caps) => {
      const mid = caps.reduce((s, [x, z]) => ({ x: s.x + x / caps.length, z: s.z + z / caps.length }), { x: 0, z: 0 });
      return [round1(mid.x), round1(mid.z), round1(wd.rand(10, 14))];
    }));
    for (let n = 0, more = wd.int(5, 7), want = woods.length + more; n < 300 && woods.length < want; n++) {
      const { x, z } = inland(wd.rand(0, Math.PI * 2), wd.rand(0.4, 0.85));
      const rr = wd.rand(6, 11);
      if (Math.hypot(x - spawn.x, z - spawn.z) < rr + STONE_CIRCLE + 2) continue;
      if (Math.hypot(x - meadow.x, z - meadow.z) < rr + meadow.r * 0.5) continue;
      if (woods.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < (rr + or) * 0.7)) continue;
      woods.push([round1(x), round1(z), round1(rr)]);
    }
  }

  // The trails: from the stone circle to everything, with a bend in each.
  // From generation 3, from the nearest of those (or a trail branching off
  // them) out to every other climb, ring of toadstools and wood too, the
  // nearest first
  const tr = stream('trails');
  const toward = (from, to, by) => {
    const len = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    return { x: from.x + ((to.x - from.x) / len) * by, z: from.z + ((to.z - from.z) / len) * by };
  };
  const trail = (from, to) => {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const bend = tr.rand(-0.18, 0.18); // sideways, times the trail's length (dx, dz)
    const mx = (from.x + to.x) / 2 - dz * bend;
    const mz = (from.z + to.z) / 2 + dx * bend;
    return [[round1(from.x), round1(from.z)], [round1(mx), round1(mz)], [round1(to.x), round1(to.z)]];
  };
  // the foot of a climb: just south of its first step
  const footOf = ([[x, z, , d]]) => ({ x, z: z + d / 2 + 1.6 });
  // just short of the first cap of a ring
  const capsFrom = (from, [[x, z, msize]]) => toward({ x, z }, from, msize / 2 + 1.8);
  const trails = [
    trail(spawn, toward(pond, spawn, pond.r + 1.4)), // -> the pond's shore
    trail(spawn, footOf(climbs[0])), // -> the foot of the (first) terraces
    trail(spawn, capsFrom(spawn, rings[0])), // -> the (first) toadstools
    trail(spawn, toward(meadow, spawn, meadow.r * 0.4)), // -> the meadow
    trail(spawn, inland(spawnA + tr.rand(-0.3, 0.3), 0.95)), // -> the south shore
  ];
  const fromSpawn = trails.length;
  if (wide) {
    // the point on the trails so far nearest to (x, z)
    const nearestOnTrails = (x, z) => {
      let best = spawn;
      let bestD = Infinity;
      for (const path of trails) {
        for (let i = 1; i < path.length; i++) {
          const [[ax, az], [bx, bz]] = [path[i - 1], path[i]];
          for (let f = 0; f <= 1; f += 0.125) {
            const px = ax + (bx - ax) * f;
            const pz = az + (bz - az) * f;
            const dd = Math.hypot(x - px, z - pz);
            if (dd < bestD) [best, bestD] = [{ x: px, z: pz }, dd];
          }
        }
      }
      return best;
    };
    const ends = [
      ...climbs.slice(1).map((climb) => ({ at: footOf(climb) })),
      ...rings.slice(1).map((caps) => ({ at: { x: caps[0][0], z: caps[0][1] }, caps })),
      ...woods.map(([x, z]) => ({ at: { x, z } })),
    ];
    ends.sort((a, b) => Math.hypot(a.at.x - spawn.x, a.at.z - spawn.z) - Math.hypot(b.at.x - spawn.x, b.at.z - spawn.z));
    for (const { at, caps } of ends) {
      const from = nearestOnTrails(at.x, at.z);
      const to = caps ? capsFrom(from, caps) : at;
      if (Math.hypot(to.x - from.x, to.z - from.z) > 3) trails.push(trail(from, to));
    }
  }

  // The standing stones round the arrival spot, with gaps where the trails from it go
  const ways = trails.slice(0, fromSpawn).map(([[ax, az], [bx, bz]]) => Math.atan2(bz - az, bx - ax));
  const turn = tr.rand(0, 1);
  const stones = [];
  for (let i = 0; i < 9; i++) {
    const a = ((i + turn) / 9) * Math.PI * 2;
    if (ways.every((w) => Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w))) > 0.42)) stones.push(round2(a));
  }

  // A provisional island, to ask where the ground is while placing the spots
  const theme = stream('theme').pick(['spring', 'spring', 'autumn', 'blossom']);
  const draft = finishIsland({ seed, theme, half: size.half, spawn, coast, pond, pondFloor, terraces, toadstools, woods, meadow, trails, stones, spots: [] });

  // ---------- The spots ----------
  const s = stream('spots');
  const above = (top) => round1(top + 0.7);
  const spots = [];
  // ledges up on every step of a climb but the first, and on every cap of a ring but the lowest
  for (const climb of climbs) for (const [x, z, , , top] of climb.slice(1)) spots.push(['ledge', x, above(top), z]);
  for (const caps of rings) for (const [x, z, , top] of caps.slice(1)) spots.push(['ledge', x, above(top), z]);
  // a treasure on the lowest cap of each ring, and one on the pond's bottom
  for (const [[x, z, , top]] of rings) spots.push(['meadow', round1(x + 0.6), above(top), round1(z + 0.4)]);
  spots.push(['meadow', pond.x, round1(pondFloor + 0.5), pond.z]);

  const taken = spots.map(([, x, , z]) => [x, z]);
  const groundOk = (x, z) =>
    draft.isLand(x, z) && shoreDist(x, z) > 3.2 && !draft.inPond(x, z) && !draft.topOver(x, z, 0.8) &&
    Math.hypot(x - spawn.x, z - spawn.z) > STONE_CIRCLE + 1.4 && taken.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > 2.4);
  // keep: does (x, z) suit this kind of spot. near(): where to look.
  function place(kind, count, near, keep, y = 0) {
    let found = 0;
    for (let n = 0; n < size.tries && found < count; n++) {
      const { x, z } = near();
      const rx = round1(x);
      const rz = round1(z);
      if (!groundOk(rx, rz) || !keep(rx, rz)) continue;
      spots.push([kind, rx, y, rz]);
      taken.push([rx, rz]);
      found++;
    }
    return found === count;
  }
  const anywhere = () => inland(s.rand(0, Math.PI * 2), Math.sqrt(s.rng()) * 0.9);
  const aroundMeadow = () => {
    const a = s.rand(0, Math.PI * 2);
    const d = Math.sqrt(s.rng()) * (meadow.r - 1);
    return { x: meadow.x + Math.cos(a) * d, z: meadow.z + Math.sin(a) * d };
  };
  const onTrail = (x, z) => distToPaths(x, z, trails) < 1;
  const offTrail = (x, z) => distToPaths(x, z, trails) > 1.3;
  const ok =
    place('meadow', size.spots.meadow, aroundMeadow, () => true, 0.5) &&
    place('meadow', size.spots.trail, anywhere, (x, z) => onTrail(x, z) && Math.hypot(x - meadow.x, z - meadow.z) > meadow.r, 0.5) &&
    // berry bushes along the forest's edge and round the meadow
    place('bush', size.spots.bush, anywhere, (x, z) => {
      const edge = draft.woodsAt(x, z);
      const byMeadow = Math.abs(Math.hypot(x - meadow.x, z - meadow.z) - meadow.r - 1) < 1.2;
      return offTrail(x, z) && ((edge > -0.3 && edge < 0.05) || byMeadow);
    }) &&
    // mushrooms deep in the woods
    place('mushroom', size.spots.mushroom, anywhere, (x, z) => offTrail(x, z) && draft.woodsAt(x, z) > 0.15);
  if (!ok) return null;

  // the ledges first, like the classic island (the order is the spots' ids)
  const order = { ledge: 0, meadow: 1, bush: 2, mushroom: 3 };
  spots.sort((a, b) => order[a[0]] - order[b[0]]);
  // What later generations added comes last, so the spots above keep their ids
  let heath;
  if (genOf(seed) >= 2) {
    heath = growHeath(seed, attempt, { draft, spots, shoreDist, groundOk, inland, taken, pond, meadow, spawn, grow: size.heath });
    for (const spot of heath?.spots ?? []) spots.push(spot);
  }
  // Generation 4 comes after generation 2's, for the same reason
  let marsh;
  if (genOf(seed) >= 4) {
    marsh = growMarsh(seed, attempt, { draft, spots, shoreDist, groundOk, inland, taken, pond, meadow, spawn, heath: heath?.area, grow: size.heath });
    for (const spot of marsh?.spots ?? []) spots.push(spot);
  }
  // Generation 5 after generation 4's
  let field;
  if (genOf(seed) >= 5) {
    field = growField(seed, attempt, { draft, spots, shoreDist, groundOk, inland, taken, pond, meadow, spawn, others: [heath?.area, marsh?.area], grow: size.heath });
    for (const spot of field?.spots ?? []) spots.push(spot);
  }
  const island = finishIsland({ ...draft, spots, ...(heath && { heath: heath.area }), ...(marsh && { marsh: marsh.area }), ...(field && { field: field.area }) });
  return checkIsland(island).length ? null : island;
}

// ---------- Generation 2: the heath ----------
// A moor of heather in a clear stretch of land, with heather to pick on it.
// Streams of its own ('heath', 'heather'), so it never moves anything else.
// An island with no room for one just goes without. grow: how much bigger
// than on a generation 2 island (with as many more heather spots)
function growHeath(seed, attempt, { draft, spots, shoreDist, groundOk, inland, taken, pond, meadow, spawn, grow = 1 }) {
  const h = mulberry32(hashSeed(`${seed}/${attempt}/heath`));
  const rand = (min, max) => min + h() * (max - min);
  const r = round1(rand(...HEATH_RADIUS) * grow);
  const rocks = [...draft.terraces.map(([x, z, w, d]) => ({ x, z, size: Math.max(w, d) })), ...draft.toadstools.map(([x, z, s]) => ({ x, z, size: s }))];
  let area = null;
  for (let n = 0; n < 300 && !area; n++) {
    const { x, z } = inland(rand(0, Math.PI * 2), rand(0.2, 0.8));
    const rx = round1(x);
    const rz = round1(z);
    if (shoreDist(rx, rz) < r * 0.7 + 2.5) continue;
    if (Math.hypot(rx - pond.x, rz - pond.z) < pond.r + r + 1.5) continue;
    if (Math.hypot(rx - meadow.x, rz - meadow.z) < meadow.r + r + 1) continue;
    if (Math.hypot(rx - spawn.x, rz - spawn.z) < r + STONE_CIRCLE + 3) continue;
    if (rocks.some((t) => Math.hypot(rx - t.x, rz - t.z) < r + t.size / 2 + 2)) continue;
    area = { x: rx, z: rz, r };
  }
  if (!area) return null;
  const q = mulberry32(hashSeed(`${seed}/${attempt}/heather`));
  const found = [];
  for (let n = 0, want = Math.round(HEATHER_SPOTS * grow); n < 400 && found.length < want; n++) {
    const a = q() * Math.PI * 2;
    const d = Math.sqrt(q()) * (area.r - 1.3);
    const x = round1(area.x + Math.cos(a) * d);
    const z = round1(area.z + Math.sin(a) * d);
    if (!groundOk(x, z) || distToPaths(x, z, draft.trails) < 1.3 || found.some(([, ox, , oz]) => Math.hypot(x - ox, z - oz) < 2.4)) continue;
    found.push(['heather', x, 0, z]);
    taken.push([x, z]);
  }
  if (found.length < 3) return null;
  return { area, spots: found };
}

// ---------- Generation 4: the reed marsh ----------
// A soggy stretch of land, walkable but muddy, thick with reeds, with cattails
// to pick. Streams of its own ('marsh', 'cattail'), so it never moves anything
// else. Like the heath, an island with no room for one goes without.
function growMarsh(seed, attempt, { draft, spots, shoreDist, groundOk, inland, taken, pond, meadow, spawn, heath, grow = 1 }) {
  const h = mulberry32(hashSeed(`${seed}/${attempt}/marsh`));
  const rand = (min, max) => min + h() * (max - min);
  const r = round1(rand(...MARSH_RADIUS) * grow);
  const rocks = [...draft.terraces.map(([x, z, w, d]) => ({ x, z, size: Math.max(w, d) })), ...draft.toadstools.map(([x, z, s]) => ({ x, z, size: s }))];
  let area = null;
  for (let n = 0; n < 300 && !area; n++) {
    const { x, z } = inland(rand(0, Math.PI * 2), rand(0.25, 0.85));
    const rx = round1(x);
    const rz = round1(z);
    if (shoreDist(rx, rz) < r * 0.7 + 2.5) continue;
    if (Math.hypot(rx - pond.x, rz - pond.z) < pond.r + r + 1.5) continue;
    if (Math.hypot(rx - meadow.x, rz - meadow.z) < meadow.r + r + 1) continue;
    if (Math.hypot(rx - spawn.x, rz - spawn.z) < r + STONE_CIRCLE + 3) continue;
    if (heath && Math.hypot(rx - heath.x, rz - heath.z) < heath.r + r + 1.5) continue;
    if (rocks.some((t) => Math.hypot(rx - t.x, rz - t.z) < r + t.size / 2 + 2)) continue;
    area = { x: rx, z: rz, r };
  }
  if (!area) return null;
  const q = mulberry32(hashSeed(`${seed}/${attempt}/cattail`));
  const found = [];
  for (let n = 0, want = Math.round(CATTAIL_SPOTS * grow); n < 400 && found.length < want; n++) {
    const a = q() * Math.PI * 2;
    const d = Math.sqrt(q()) * (area.r - 1.6);
    const x = round1(area.x + Math.cos(a) * d);
    const z = round1(area.z + Math.sin(a) * d);
    if (!groundOk(x, z) || distToPaths(x, z, draft.trails) < 1.3 || found.some(([, ox, , oz]) => Math.hypot(x - ox, z - oz) < 2.4)) continue;
    found.push(['cattail', x, 0, z]);
    taken.push([x, z]);
  }
  if (found.length < 3) return null;
  return { area, spots: found };
}

// ---------- Generation 5: the sunflower field ----------
// A sunny stretch of land thick with sunflowers, with some to pick. Streams of
// its own ('field', 'sunflower'), so it never moves anything
// else. Like the marsh, an island with no room for one goes without.
function growField(seed, attempt, { draft, spots, shoreDist, groundOk, inland, taken, pond, meadow, spawn, others = [], grow = 1 }) {
  const h = mulberry32(hashSeed(`${seed}/${attempt}/field`));
  const rand = (min, max) => min + h() * (max - min);
  const r = round1(rand(...FIELD_RADIUS) * grow);
  const rocks = [...draft.terraces.map(([x, z, w, d]) => ({ x, z, size: Math.max(w, d) })), ...draft.toadstools.map(([x, z, s]) => ({ x, z, size: s }))];
  let area = null;
  for (let n = 0; n < 300 && !area; n++) {
    const { x, z } = inland(rand(0, Math.PI * 2), rand(0.3, 0.9));
    const rx = round1(x);
    const rz = round1(z);
    if (shoreDist(rx, rz) < r * 0.7 + 2.5) continue;
    if (Math.hypot(rx - pond.x, rz - pond.z) < pond.r + r + 1.5) continue;
    if (Math.hypot(rx - meadow.x, rz - meadow.z) < meadow.r + r + 1) continue;
    if (Math.hypot(rx - spawn.x, rz - spawn.z) < r + STONE_CIRCLE + 3) continue;
    if (others.some((o) => o && Math.hypot(rx - o.x, rz - o.z) < o.r + r + 1.5)) continue;
    if (rocks.some((t) => Math.hypot(rx - t.x, rz - t.z) < r + t.size / 2 + 2)) continue;
    area = { x: rx, z: rz, r };
  }
  if (!area) return null;
  const q = mulberry32(hashSeed(`${seed}/${attempt}/sunflower`));
  const found = [];
  for (let n = 0, want = Math.round(SUNFLOWER_SPOTS * grow); n < 400 && found.length < want; n++) {
    const a = q() * Math.PI * 2;
    const d = Math.sqrt(q()) * (area.r - 1.6);
    const x = round1(area.x + Math.cos(a) * d);
    const z = round1(area.z + Math.sin(a) * d);
    if (!groundOk(x, z) || distToPaths(x, z, draft.trails) < 1.3 || found.some(([, ox, , oz]) => Math.hypot(x - ox, z - oz) < 2.4)) continue;
    found.push(['sunflower', x, 0, z]);
    taken.push([x, z]);
  }
  if (found.length < 3) return null;
  return { area, spots: found };
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;

// ---------- Checking an island ----------
// What every island must be, generated or hand-made: a list of what is wrong
// with it (empty: nothing). Every spot is on the land and somewhere a farmer
// can get to: a ledge's just over its terrace or cap, the rest on open ground
// (not inside a cliff or a toadstool), none in the stone circle.
export function checkIsland(island) {
  const problems = [];
  const { spawn } = island;
  if (!island.isLand(spawn.x, spawn.z) || island.inPond(spawn.x, spawn.z) || island.topOver(spawn.x, spawn.z, STONE_CIRCLE)) {
    problems.push('the arrival spot is not on open land');
  }
  for (const [x, z, w, d] of [...island.terraces, ...island.toadstools.map(([x, z, s]) => [x, z, s, s])]) {
    if (!island.isLand(x - w / 2, z - d / 2) || !island.isLand(x + w / 2, z + d / 2)) problems.push(`the rock or cap at ${x}, ${z} hangs over the sea`);
  }
  // each step within a jump of the one before
  // (a climb's steps share a `chain`, a ring's caps a `ring`; up to generation 2, one of each)
  const byGroup = (list, at, step) => [...new Set(list.map((it) => it[at] ?? 0))].map((g) => list.filter((it) => (it[at] ?? 0) === g).map(step));
  const chains = [
    ...byGroup(island.terraces, 5, ([x, z, w, d, top]) => ({ x, z, w, d, top })),
    ...byGroup(island.toadstools, 4, ([x, z, s, top]) => ({ x, z, w: s, d: s, top })),
  ];
  for (const chain of chains) {
    if (chain.length && chain[0].top > 1.6) problems.push('the first step is out of reach from the ground');
    for (let i = 1; i < chain.length; i++) {
      const [a, b] = [chain[i - 1], chain[i]];
      const gapX = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
      const gapZ = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
      if (b.top - a.top > 1.6 || Math.hypot(Math.max(0, gapX), Math.max(0, gapZ)) > 2.2) problems.push(`the step at ${b.x}, ${b.z} is out of reach`);
    }
  }
  for (const [kind, x, y, z] of island.spots) {
    const where = `${kind} at ${x}, ${z}`;
    if (!island.isLand(x, z)) problems.push(`${where} is in the sea`);
    const top = island.topOver(x, z, 0.4);
    if (kind === 'ledge' || y > 1) {
      if (!top) problems.push(`${where} floats with nothing under it`);
      else if (!(y > top.top && y < top.top + 1.2)) problems.push(`${where} is not just over its ledge`);
    } else {
      if (top) problems.push(`${where} is inside a cliff or a toadstool`);
      if (!(y >= island.floorAt(x, z) && y < island.floorAt(x, z) + 1)) problems.push(`${where} is not on the ground`);
    }
    if (Math.hypot(x - spawn.x, z - spawn.z) <= 4.5) problems.push(`${where} is in the stone circle`);
  }
  return problems;
}

// ---------- Islands by seed ----------
// The island a seed grows (the same every time, everywhere). A seed whose
// first tries do not make a good island tries again from a variant of
// itself, so every seed grows one. (cached: false grows it afresh, for tests)
const islands = new Map(); // seed -> island, the latest few
export function islandFor(seed, { cached = true } = {}) {
  seed = normalizeSeed(seed) || CLASSIC_SEED;
  if (cached && islands.has(seed)) return islands.get(seed);
  let island = seed === CLASSIC_SEED ? classicIsland() : null;
  for (let attempt = 0; !island && attempt < 200; attempt++) island = growIsland(seed, attempt);
  island ??= classicIsland(); // (never seen: most seeds grow on the first or second try)
  islands.set(seed, island);
  if (islands.size > 32) islands.delete(islands.keys().next().value);
  return island;
}
