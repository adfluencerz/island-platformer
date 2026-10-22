// ---------- Fishing ----------
// With a rod in hand (made at the workbench), E facing water casts the line:
// the bobber lands a little way out, and some seconds later it dips. E again
// before the window closes lands what bit; the rarer it is, the quicker you
// have to be. A better rod gets bites sooner and rarer things on the line.
//
// Where: the sea round any island, from the shore; a fish pond built on the
// farm; and a lobby's water (its sea and its pond), where the rarer fish are.
// Some only bite at certain hours of the day. Now and then it is an old boot,
// some driftwood, an old key or a little chest of loot. Every fish comes in
// at a weight of its own (FISH_WEIGHT): the journal keeps your heaviest, a
// lobby has a board of its biggest catches, and a fishing contest (a party
// game, shared/minigame.js) goes by the weight landed. Bait in the backpack
// makes bites come sooner, a lure brings rarer fish (TACKLE).
//
// On a farm the page rolls the catch itself, as the workbench makes things
// (src/fishing.js); in a lobby the room does (shared/room.js: CAST, REEL),
// and tells the whole lobby about a rare one. What bites where, and the
// rods, are numbers in shared/balance.js (FISHING, RODS).
import { RODS, BITE_WINDOW, FISHING, FISHED_CHEST, FISH_WEIGHT, FISH_HEAVY, TACKLE, MINIGAMES } from './balance.js';
import { pick, rollBundle } from './level.js';
import { bonusChance } from './skills.js';

export { RODS, CAST_EVERY, FISH_WEIGHT } from './balance.js';
export const CAST_REACH = 4.5; // the farthest out a bobber lands, from the farmer
const ROD_TIER = Object.fromEntries(Object.keys(RODS).map((rod, i) => [rod, i])); // (0: the plain rod)

// Is it one of the hours [from, to] (past midnight if from > to)? No hours: always
const inHours = (hours, hour) => !hours || (hours[0] <= hours[1] ? hour >= hours[0] && hour < hours[1] : hour >= hours[0] || hour < hours[1]);

// What can bite in water ('sea', 'pond', 'lobby', 'contest') on rod at this
// hour of the day: [[item, weight, rarity, [min, max]], ...] (weights with the
// rod's luck, times a lure's: lure true)
export function biting(water, rod, hour, lure = false) {
  const luck = RODS[rod].luck * (lure ? TACKLE.lure.luck : 1);
  const h = ((hour % 24) + 24) % 24;
  return FISHING[water]
    .filter(([, , , { rod: least = 0, hours } = {}]) => least <= ROD_TIER[rod] && inHours(hours, h))
    .map(([item, w, rarity, { count = [1, 1] } = {}]) => [item, w * luck ** rarity, rarity, count]);
}

// One cast: { bite, window, item, count, grams?, items? }: seconds till
// something bites, ms to land it in, what it is, and a fish's weight ('chest':
// a little chest of loot, what is in it as items [[item, count], ...]).
// level: the farmer's fishing skill (shared/skills.js: bites that much
// sooner). tackle: { bait, lure } in the backpack (TACKLE). In a contest
// every rod is alike, and bites come quickly. rand: () => [0, 1)
export function castLine(water, rod, hour, level = 1, rand = Math.random, { bait = false, lure = false } = {}) {
  const contest = water === 'contest';
  const sooner = contest ? 1 : (1 - bonusChance('fishing', level)) * (bait ? TACKLE.bait.bite : 1);
  const [lo, hi] = (contest ? MINIGAMES.fishing_contest.bite : RODS[rod].bite).map((s) => s * sooner);
  const table = biting(water, contest ? 'fishing_rod' : rod, hour, lure && !contest);
  const [item, count] = pick(table.map(([it, w, , [min, max]]) => [it, w, min, max]), rand);
  const rarity = table.find(([it]) => it === item)[2];
  const line = { bite: lo + rand() * (hi - lo), window: BITE_WINDOW[rarity], item, count };
  if (FISH_WEIGHT[item]) line.grams = weighFish(item, rand);
  if (item === 'chest') line.items = rollBundle(FISHED_CHEST, rand);
  return line;
}

// How heavy a fish of this kind is, in grams (the heavy ones rarer)
export function weighFish(item, rand = Math.random) {
  const [lo, hi] = FISH_WEIGHT[item];
  return Math.round(lo + (hi - lo) * rand() ** FISH_HEAVY);
}

// A weight in words: "85 g", "1.4 kg", "32 kg"
export function weightText(grams) {
  if (grams < 1000) return `${Math.round(grams)} g`;
  const kg = grams / 1000;
  return `${kg < 10 ? Math.round(kg * 10) / 10 : Math.round(kg)} kg`;
}

// ---------- The fishing journal ----------
// Every fish there is, in the order the journal lists them (the sea's, the
// pond's, the lobbies'), with where and when it bites: [{ id, water, rarity,
// rod, hours }, ...] (rod: the least rod tier, 0 the plain one)
export const FISH_LIST = ['sea', 'pond', 'lobby'].flatMap((water) =>
  FISHING[water]
    .filter(([item]) => FISH_WEIGHT[item])
    .map(([id, , rarity, { rod = 0, hours = null } = {}]) => ({ id, water, rarity, rod, hours })));
export const ROD_NAMES = Object.keys(RODS); // (by tier)

// What the journal keeps of a fish: { id: [how many landed, the heaviest in
// grams] }, from a save (only fish there are, and sensible numbers)
export function cleanLog(saved) {
  const out = {};
  for (const { id } of FISH_LIST) {
    const [n, best] = Array.isArray(saved?.[id]) ? saved[id] : [];
    if (Number.isInteger(n) && n > 0) out[id] = [Math.min(n, 1e7), Number.isFinite(best) && best > 0 ? Math.round(best) : 0];
  }
  return out;
}

// ---------- A lobby's board of its biggest catches ----------
// A noticeboard on the shore of the lobby's pond, facing the camera: the
// heaviest fish landed in the lobby, one for each farmer at most (BOARD_SIZE
// of them). E at it starts a fishing contest. island: islandFor(seed);
// blocked(x, z): something stands there (a tree, a rock, a spot)
export const BOARD_SIZE = 5;
export const BOARD_REACH = 2.2; // E this close to it
export function boardFor(island, blocked = () => false) {
  const { pond, spawn } = island;
  // on the side of the pond toward where farmers arrive, a step out of the water
  const a0 = Math.atan2(spawn.z - pond.z, spawn.x - pond.x);
  for (let i = 0; i < 18; i++) {
    const a = a0 + Math.ceil(i / 2) * (i % 2 ? 0.35 : -0.35); // (0, then either side, further and further round)
    for (let r = pond.r + 1; r < pond.r + 6; r += 0.25) {
      const x = pond.x + Math.cos(a) * r;
      const z = pond.z + Math.sin(a) * r;
      const clear = island.isLand(x, z) && !blocked(x, z) && [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].every(([dx, dz]) => island.isLand(x + dx, z + dz) && !island.inPond(x + dx, z + dz));
      if (clear) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: 0 };
    }
  }
  return { x: Math.round((pond.x + pond.r + 1.5) * 10) / 10, z: pond.z, yaw: 0 };
}

// The board with a catch on it: [[name, item, grams], ...], heaviest first,
// each farmer (by name) at most once. Null: it doesn't make the board.
export function onBoard(board, name, item, grams) {
  const mine = board.find(([who]) => who === name);
  if (mine && mine[2] >= grams) return null;
  const next = [...board.filter(([who]) => who !== name), [name, item, grams]].sort((a, b) => b[2] - a[2]).slice(0, BOARD_SIZE);
  return next.some(([who, it, g]) => who === name && it === item && g === grams) ? next : null;
}

// The water at x, z on a wild island (islandFor, shared/worldgen.js): 'sea',
// 'pond' or null (land)
export const waterOn = (island, x, z) => (!island.isLand(x, z) ? 'sea' : island.inPond(x, z) ? 'pond' : null);
