// Where the trees and rocks of an island stand, and the other places each can
// grow back in. The server works them out (shared/room.js for a lobby's
// island, server/farmroom.js for a farm) and sends them to every page, so
// every farmer sees the same trees and rocks in the same places, and a tree
// or a rock is known everywhere by its number. A page draws them (src/world.js)
// and never places them itself: pages that round a sine a hair differently
// would otherwise grow their trees in different places. The farm's are worked
// out once and kept in shared/homewilds.js (`npm run wilds`), for a farm
// played alone.
//
// Nothing stands outside the island or in the air: every tree and rock (and
// every place it can grow back in) is on dry land all round, on ground at
// sea level (not in the pond), and clear of the terraces, the toadstool caps,
// the sky isles and their stairs, the stone circle and everything else kept
// clear.
//
// growWilds(place) -> { trees: [{ x, z, kind, scale, look, sites }],
//   rocks: [{ x, z, size, look, sites }] }: place is an island (islandFor) or
//   'home'. kind: 'pine' | 'round'. look: a number the page draws its details
//   from (which way it turns, its leaves, a rock's shape). sites: [[x, z], ...],
//   the first where it stands at the start.
import { mulberry32, hashSeed, distToPaths, STONE_CIRCLE, WILD_HALF } from './worldgen.js';
import { homeGround, inPlayArea, HOME_HALF, HOME_PLATFORMS, HOME_KEEP_CLEAR } from './farmland.js';

const SITES = 3; // where it started, and two more
const AWAY = 4; // a new place is at least this far from the others
const NEAR = 20; // and at most this far from where it started
const CELL = 4;
const round2 = (v) => Math.round(v * 100) / 100;

// The ground a tree or rock may stand on (bushes too: src/maps.js)
export const WILD_DECOR = new Set(['grass', 'moss', 'meadow', 'heath', 'marsh', 'glade', 'field', 'patch', 'glen', 'dune']);
export const HOME_DECOR = new Set(['grass']);

// [x, z, r]: where nothing grows on a wild island: the spots, the stone circle
// and (generation 10) up into a sky isle or its stair
export function wildKeepClear(island) {
  return [
    ...island.spots.map(([, x, , z]) => [x, z, 1]),
    [island.spawn.x, island.spawn.z, STONE_CIRCLE + 0.8],
    ...(island.sky ?? []).flatMap((isle) => [[isle.x, isle.z, isle.r + 1.5], ...isle.steps.map(([x, z, w, d]) => [x, z, Math.max(w, d) / 2 + 1.2])]),
  ];
}

// n of something on an island of the usual size, and as many for each such
// island's worth of ground on a bigger one (generation 3)
const forSize = (island, n) => Math.round(n * (island.half / WILD_HALF) ** 2);

const wildsCache = new Map(); // seed -> wilds, the latest few
// (cached: false works them out afresh, for tests)
export function growWilds(place, { cached = true } = {}) {
  const key = place === 'home' ? 'home' : place.seed;
  if (cached && wildsCache.has(key)) return wildsCache.get(key);
  const wilds = place === 'home' ? grow(homeLayout()) : grow(wildLayout(place));
  wildsCache.set(key, wilds);
  if (wildsCache.size > 16) wildsCache.delete(wildsCache.keys().next().value);
  return wilds;
}

// ---------- What each kind of island is like ----------
// seed, half, ground(gx, gz) (a tile's kind, null: the sea), level(x, z)
// (the ground's height, if not all at sea level), decor (where
// things grow), boxes ([x, z, w, d]: footprints nothing grows under),
// keepClear, growBackAnywhere, plant(api): its trees and rocks
function homeLayout() {
  return {
    seed: 1337,
    half: HOME_HALF,
    ground: homeGround,
    decor: HOME_DECOR,
    boxes: HOME_PLATFORMS.map(({ x, z, w, d }) => [x, z, w, d]),
    keepClear: HOME_KEEP_CLEAR,
    plant({ scatter, tree, rock, open, tileAt, rand }) {
      scatter(70, 2.6, (x, z) => !inPlayArea(x, z) && open(x, z, 1), (x, z) => tree(x, z, rand(0.8, 1.35)));
      scatter(30, 1.5, (x, z) => tileAt(x, z) === 'sand' || open(x, z, 0.5), (x, z) => rock(x, z, [0.15, 0.45]));
    },
  };
}

function wildLayout(island) {
  const offTrail = (x, z, d) => distToPaths(x, z, island.trails) > d;
  const nearTerrace = (x, z, margin) =>
    island.terraces.some(([tx, tz, w, d]) => Math.abs(x - tx) < w / 2 + margin && Math.abs(z - tz) < d / 2 + margin);
  const more = (n) => forSize(island, n);
  const stones = island.stones.map((a) => [island.spawn.x + Math.cos(a) * STONE_CIRCLE, island.spawn.z + Math.sin(a) * STONE_CIRCLE, 0.8, 0.8]);
  return {
    seed: hashSeed(`${island.seed}/wilds`),
    half: island.half,
    ground: island.groundAt,
    level: island.floorAt, // (the pond's edge wobbles across its tiles)
    decor: WILD_DECOR,
    boxes: [
      ...island.terraces.map(([x, z, w, d]) => [x, z, w, d]),
      ...island.toadstools.map(([x, z, size]) => [x, z, size, size]), // (under a cap)
      ...stones,
    ],
    keepClear: wildKeepClear(island),
    growBackAnywhere: true, // (a tree from the full forest may grow back out on the grass)
    plant({ scatter, tree, rock, open, tileAt, rand }) {
      // The forest: thick on the moss, with big old trees among the pines
      scatter(more(130), 2.1, (x, z) => tileAt(x, z) === 'moss' && open(x, z, 1.2) && offTrail(x, z, 1.8), (x, z) => tree(x, z, rand(1, 1.6)));
      // Lone trees out on the grass
      scatter(more(24), 5, (x, z) => tileAt(x, z) === 'grass' && open(x, z, 1.6) && offTrail(x, z, 2.2), (x, z) => tree(x, z, rand(0.8, 1.35)));
      scatter(more(45), 1.4, (x, z) => tileAt(x, z) === 'sand' || open(x, z, 0.5), (x, z) => rock(x, z, [0.15, 0.45]));
      // Boulders tumbled at the foot of the terraces
      scatter(more(9), 2.2, (x, z) => nearTerrace(x, z, 2.2) && !nearTerrace(x, z, 0.6) && open(x, z, 0.4) && offTrail(x, z, 1.6),
        (x, z) => rock(x, z, [0.7, 1.1]));
      // Rocks out on each later generation's ground
      const later = [
        ['heath', island.heath, 14, [0.5, 0.9]], ['marsh', island.marsh, 6, [0.4, 0.7]], ['glade', island.glade, 4, [0.4, 0.7]],
        ['field', island.field, 3, [0.4, 0.7]], ['patch', island.patch, 3, [0.4, 0.7]], ['glen', island.glen, 6, [0.4, 0.8]],
        ['dune', island.dunes, 5, [0.4, 0.7]],
      ];
      for (const [ground, there, n, size] of later) {
        if (!there) continue;
        scatter(n, ground === 'glade' || ground === 'field' || ground === 'patch' ? 2.6 : 2.4,
          (x, z) => tileAt(x, z) === ground && open(x, z, 0.6) && offTrail(x, z, 1.2), (x, z) => rock(x, z, size));
      }
    },
  };
}

// ---------- Placing them ----------
function grow(layout) {
  const rng = mulberry32(layout.seed);
  const rand = (min, max) => min + rng() * (max - min);
  const look = () => Math.floor(rng() * 0x7fffffff);
  const H = layout.half;
  const tiles = new Map(); // "gx,gz" -> its kind (asked again and again)
  const tileAt = (x, z) => {
    const gx = Math.round(x);
    const gz = Math.round(z);
    if (Math.max(Math.abs(gx), Math.abs(gz)) >= H) return null; // (nothing on the last row of tiles, at the very edge, or past it)
    const key = gx * 4096 + gz;
    if (!tiles.has(key)) tiles.set(key, layout.ground(gx, gz) ?? null);
    return tiles.get(key);
  };
  const trees = [];
  const rocks = [];
  // [x, z, r]: trunks and boulders (as their colliders were), by CELL-sized squares
  const cellKey = (cx, cz) => cx * 4096 + cz;
  const taken = new Map();
  const take = (x, z, r) => {
    const key = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!taken.has(key)) taken.set(key, []);
    taken.get(key).push([x, z, r]);
  };
  const near = (grid, x, z, hit) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) for (const item of grid.get(cellKey(i, j)) ?? []) if (hit(item)) return true;
    }
    return false;
  };

  // On dry land all round, at sea level: not out over the sea, not in the pond
  const onLand = (x, z, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => {
    const t = tileAt(x + dx, z + dz);
    return t !== null && t !== 'pond' && (layout.level?.(x + dx, z + dz) ?? 0) === 0;
  });
  // Clear of everything solid and everything kept clear (and of the trunks
  // and boulders so far, unless finding places to grow back in)
  let findingSites = false;
  // (each box and circle kept in every CELL-sized square it reaches into, with the widest margin asked)
  const solid = new Map();
  const MOST_MARGIN = 2;
  const keep = (item, x, z, hw, hd) => {
    for (let i = Math.floor((x - hw - MOST_MARGIN) / CELL); i <= Math.floor((x + hw + MOST_MARGIN) / CELL); i++) {
      for (let j = Math.floor((z - hd - MOST_MARGIN) / CELL); j <= Math.floor((z + hd + MOST_MARGIN) / CELL); j++) {
        const key = cellKey(i, j);
        if (!solid.has(key)) solid.set(key, []);
        solid.get(key).push(item);
      }
    }
  };
  for (const [x, z, w, d] of layout.boxes) keep((px, pz, m) => Math.abs(px - x) < w / 2 + m && Math.abs(pz - z) < d / 2 + m, x, z, w / 2, d / 2);
  for (const [x, z, r] of layout.keepClear) keep((px, pz, m) => Math.hypot(px - x, pz - z) < r + m, x, z, r, r);
  const blocked = (x, z, margin) =>
    (solid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []).some((hit) => hit(x, z, margin)) ||
    (!findingSites && near(taken, x, z, ([tx, tz, r]) => Math.abs(x - tx) < r + margin && Math.abs(z - tz) < r + margin));
  const open = (x, z, margin = 0) => layout.decor.has(tileAt(x, z)) && !blocked(x, z, margin);

  let rule = null; // the rule the one being placed passed (to find the places it may grow back in)
  function scatter(count, minDist, accept, place, tries = count * 40) {
    const placed = [];
    for (let n = 0; n < tries && placed.length < count; n++) {
      const x = round2(rand(-H, H)); // (rounded as they are sent, before they are checked)
      const z = round2(rand(-H, H));
      if (!accept(x, z)) continue;
      if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < minDist)) continue;
      rule = accept;
      if (place(x, z)) placed.push([x, z]);
      rule = null;
    }
  }
  // (each false if it doesn't fit there: it reaches out over the water, or under a cap)
  function tree(x, z, size) {
    const scale = round2(size);
    const kind = rng() < 0.45 ? 'pine' : 'round';
    const reach = 0.8 * scale;
    if (!onLand(x, z, reach) || blocked(x, z, 0)) return false;
    trees.push({ x, z, kind, scale, look: look(), sites: [[x, z]], rule, reach });
    take(x, z, 0.25 * scale);
    return true;
  }
  function rock(x, z, [lo, hi]) {
    const size = round2(rand(lo, hi));
    const reach = 0.9 * size;
    if (!onLand(x, z, reach) || blocked(x, z, 0)) return false;
    rocks.push({ x, z, size, look: look(), sites: [[x, z]], rule, reach });
    if (size > 0.6) take(x, z, 0.7 * size);
    return true;
  }
  layout.plant({ scatter, tree, rock, open, tileAt, rand });

  // ---------- Growing back elsewhere ----------
  // Each has a few places, all on ground its own rule accepts (or, as a full
  // forest is, any open ground, on an island that allows it), clear of every
  // other tree and rock and each other's places, from a draw of their own.
  // Which place it stands in is its lobby's or farm's count of how often it
  // grew back.
  const grng = mulberry32((layout.seed ^ 0x5eed) >>> 0);
  const grid = new Map(); // by CELL-sized squares: [[x, z, r]]
  const claim = (x, z, r) => {
    const key = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([x, z, r]);
  };
  const clear = (x, z, r) => !near(grid, x, z, ([px, pz, pr]) => Math.hypot(x - px, z - pz) < r + pr);
  const roomFor = (thing) => (thing.size === undefined ? 1 : Math.max(0.4, thing.size * 1.1)); // (a tree, a rock)
  const all = [...trees, ...rocks];
  for (const thing of all) claim(thing.x, thing.z, roomFor(thing));
  findingSites = true; // (the grid keeps them apart instead)
  // one more place for each in turn, then another (so the first don't take all the room)
  for (let round = 1; round < SITES; round++) for (const thing of all) {
    if (thing.sites.length !== round) continue;
    const r = roomFor(thing);
    for (let n = 0; n < 300 && thing.sites.length === round; n++) {
      const a = grng() * Math.PI * 2;
      const d = AWAY + grng() * (NEAR - AWAY);
      const x = round2(thing.sites[0][0] + Math.cos(a) * d);
      const z = round2(thing.sites[0][1] + Math.sin(a) * d);
      if (thing.sites.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < AWAY)) continue;
      if (!clear(x, z, r) || !onLand(x, z, thing.reach) || blocked(x, z, 0)) continue;
      if (!(thing.rule(x, z) || (layout.growBackAnywhere && n >= 100 && open(x, z, 1)))) continue;
      thing.sites.push([x, z]);
      claim(x, z, r);
    }
  }

  return {
    trees: trees.map(({ x, z, kind, scale, look, sites }) => ({ x, z, kind, scale, look, sites })),
    rocks: rocks.map(({ x, z, size, look, sites }) => ({ x, z, size, look, sites })),
  };
}

// ---------- Over the wire ----------
// As WELCOME carries them: trees [[pine 1 | round 0, scale, look, x, z, x, z, ...]]
// (each of its places, the first where it starts), rocks [[size, look, x, z, ...]]
export function wildsToWire({ trees, rocks }) {
  return {
    trees: trees.map((t) => [t.kind === 'pine' ? 1 : 0, t.scale, t.look, ...t.sites.flat()]),
    rocks: rocks.map((r) => [r.size, r.look, ...r.sites.flat()]),
  };
}

// ...and back (null: not that)
export function wildsFromWire(wire) {
  if (!wire || !Array.isArray(wire.trees) || !Array.isArray(wire.rocks)) return null;
  const sitesOf = (list) => {
    const sites = [];
    for (let i = 0; i + 1 < list.length && sites.length < SITES; i += 2) {
      if (Number.isFinite(list[i]) && Number.isFinite(list[i + 1])) sites.push([list[i], list[i + 1]]);
    }
    return sites;
  };
  const trees = [];
  for (const [pine, scale, look, ...at] of wire.trees.filter(Array.isArray)) {
    const sites = sitesOf(at);
    if (!sites.length || !Number.isFinite(scale)) return null;
    trees.push({ x: sites[0][0], z: sites[0][1], kind: pine ? 'pine' : 'round', scale, look: look | 0, sites });
  }
  const rocks = [];
  for (const [size, look, ...at] of wire.rocks.filter(Array.isArray)) {
    const sites = sitesOf(at);
    if (!sites.length || !Number.isFinite(size)) return null;
    rocks.push({ x: sites[0][0], z: sites[0][1], size, look: look | 0, sites });
  }
  return { trees, rocks };
}

// Where tree or rock `thing` stands after growing back n times (its place in
// its list, round and round)
export const siteOf = (thing, n = 0) => thing.sites[n % thing.sites.length];

// Is (x, z), where a page says tree or rock `thing` stands, one of its places?
// (a page may have it in the next place along: on a farm it skips a place
// that is tilled or built on)
export const standsAt = (thing, x, z) => !!thing && thing.sites.some(([sx, sz]) => Math.hypot(x - sx, z - sz) <= 0.75);
