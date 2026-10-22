// ---------- Fishing ----------
// With a rod in hand (made at the workbench), E facing water casts the line:
// the bobber lands a little way out, and some seconds later it dips. E again
// before the window closes lands what bit; the rarer it is, the quicker you
// have to be. A better rod gets bites sooner and rarer things on the line.
//
// Where: the sea round any island, from the shore; a fish pond built on the
// farm; and a lobby's water (its sea and its pond), where the rarer fish are.
// Some only bite at certain hours of the day. Now and then it is an old boot,
// some driftwood, an old key or a little chest of loot.
//
// On a farm the page rolls the catch itself, as the workbench makes things
// (src/fishing.js); in a lobby the room does (shared/room.js: CAST, REEL),
// and tells the whole lobby about a rare one. What bites where, and the
// rods, are numbers in shared/balance.js (FISHING, RODS).
import { RODS, BITE_WINDOW, FISHING, FISHED_CHEST } from './balance.js';
import { pick, rollBundle } from './level.js';

export { RODS, CAST_EVERY } from './balance.js';
export const CAST_REACH = 4.5; // the farthest out a bobber lands, from the farmer
const ROD_TIER = Object.fromEntries(Object.keys(RODS).map((rod, i) => [rod, i])); // (0: the plain rod)

// Is it one of the hours [from, to] (past midnight if from > to)? No hours: always
const inHours = (hours, hour) => !hours || (hours[0] <= hours[1] ? hour >= hours[0] && hour < hours[1] : hour >= hours[0] || hour < hours[1]);

// What can bite in water ('sea', 'pond', 'lobby') on rod at this hour of the
// day: [[item, weight, rarity, [min, max]], ...] (weights with the rod's luck)
export function biting(water, rod, hour) {
  const { luck } = RODS[rod];
  const h = ((hour % 24) + 24) % 24;
  return FISHING[water]
    .filter(([, , , { rod: least = 0, hours } = {}]) => least <= ROD_TIER[rod] && inHours(hours, h))
    .map(([item, w, rarity, { count = [1, 1] } = {}]) => [item, w * luck ** rarity, rarity, count]);
}

// One cast: { bite, window, item, count, items? }: seconds till something
// bites, ms to land it in, and what it is ('chest': a little chest of loot,
// what is in it as items [[item, count], ...]). rand: () => [0, 1)
export function castLine(water, rod, hour, rand = Math.random) {
  const [lo, hi] = RODS[rod].bite;
  const table = biting(water, rod, hour);
  const [item, count] = pick(table.map(([it, w, , [min, max]]) => [it, w, min, max]), rand);
  const rarity = table.find(([it]) => it === item)[2];
  const line = { bite: lo + rand() * (hi - lo), window: BITE_WINDOW[rarity], item, count };
  if (item === 'chest') line.items = rollBundle(FISHED_CHEST, rand);
  return line;
}

// The water at x, z on a wild island (islandFor, shared/worldgen.js): 'sea',
// 'pond' or null (land)
export const waterOn = (island, x, z) => (!island.isLand(x, z) ? 'sea' : island.inPond(x, z) ? 'pond' : null);
