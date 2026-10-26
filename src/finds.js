import { RARE } from '../shared/level.js';
import { FARM_FINDS, FARM_FORAGE } from '../shared/balance.js';
import { createItemMesh } from './itemmesh.js';

// ---------- Finds on the farm ----------
// Now and then something turns up on your farm: a coin, a few seeds, once in
// a long while something golden. One or two at a time at most, out on the
// grass, bobbing and spinning like a lobby's treasures; walk into one to pick
// it up. Only on your own farm while you play it alone (on a farm with
// helpers its room has the say over what is on it), and not kept: they are
// gone when you set off.
// (how often, how likely, and what: FARM_FINDS in shared/balance.js)
//
// Out in the valley round the old farm, what grows wild turns up the same
// way, each biome its own (forage): mushrooms on the forest's moss,
// bluebells in the glade, heather on the heath, seashells on the dunes...
// (FARM_FORAGE), more often, and more of it lying about at once.
//
// What the farmer drops out of their backpack (drop()) lies about the same
// way, but is kept with the farm (dropped(), restoreDropped()), and isn't
// picked straight back up: not till they have stepped away from it.
const { every: CHECK_EVERY, chance: CHANCE, two: TWO, most: MOST, loot: FINDS } = FARM_FINDS;
const { every: FORAGE_EVERY, most: MOST_FORAGE, loot: FORAGE } = FARM_FORAGE;
const FLOAT_Y = 0.6; // over the ground
const REACH = 1.1; // from the farmer's middle, to pick one up
const GROW = 0.4; // seconds to pop up

function roll(table = FINDS) {
  let r = Math.random() * table.reduce((sum, [, w]) => sum + w, 0);
  for (const [item, w, min, max] of table) {
    r -= w;
    if (r < 0) return [item, min + Math.floor(Math.random() * (max - min + 1))];
  }
  return ['coin', 1];
}

// freeSpot(): somewhere on the farm for a find, { x, y, z } (y: the ground), or null.
// forageSpot(): somewhere out in the valley for forage, { x, y, z, ground }, or null.
// onPickUp(item, count, i): into the backpack (of farmer i, of update's at);
// false if there was no room.
// isItem(id): an item there is (a save is not to be trusted).
export function createFarmFinds({ scene, freeSpot, forageSpot = () => null, onPickUp, isItem = () => true }) {
  const finds = []; // { item, count, mesh, x, y, z, age, retryAt, own, away, wild } (own: dropped by the farmer; away: they have stepped off it since; wild: forage)
  let wait = CHECK_EVERY;
  let forageWait = FORAGE_EVERY;

  function add(item, count, x, y, z, own = false, away = false, wild = false) {
    const mesh = createItemMesh(item);
    mesh.position.set(x, y + FLOAT_Y, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0);
    scene.add(mesh);
    finds.push({ item, count, mesh, x, y: y + FLOAT_Y, z, age: 0, retryAt: 0, own, away, wild });
  }

  // something wild, in the biome of a spot out in the valley
  function forage() {
    const spot = forageSpot();
    if (!spot || !FORAGE[spot.ground]) return;
    const [item, count] = roll(FORAGE[spot.ground]);
    add(item, count, spot.x, spot.y, spot.z, false, false, true);
  }

  function spawn() {
    const spot = freeSpot();
    if (!spot) return;
    const [item, count] = roll();
    add(item, count, spot.x, spot.y, spot.z);
  }

  // Dropped by the farmer at x, z, on the ground at height y
  function drop(item, count, x, y, z) {
    add(item, count, x, y, z, true);
  }

  function remove(find) {
    scene.remove(find.mesh);
    finds.splice(finds.indexOf(find), 1);
  }

  // (what the farmer dropped stays, unless `all`: another farm is on screen)
  function clear(all = false) {
    for (const find of [...finds]) if (all || !find.own) remove(find);
    wait = CHECK_EVERY;
    forageWait = FORAGE_EVERY;
  }

  // What the farmer dropped, for the farm's save: [[item, count, x, y, z], ...]
  function dropped() {
    return finds.filter((f) => f.own).map((f) => [f.item, f.count, f.x, f.y - FLOAT_Y, f.z]);
  }

  // The farm's save's dropped() (another farm's, or none: nothing lying about)
  function restoreDropped(list) {
    clear(true);
    for (const d of Array.isArray(list) ? list : []) {
      const [item, count, x, y, z] = Array.isArray(d) ? d : [];
      if (isItem(item) && Number.isInteger(count) && count > 0 && [x, y, z].every(Number.isFinite)) add(item, count, x, y, z, true, true);
    }
  }

  // active: on our own farm, alone. counting: being played (not behind a menu).
  // at: the farmer's position (Vector3), or each farmer's at the screen.
  function update(dt, t, { active, counting, at }) {
    const farmers = [at].flat();
    for (const find of finds) find.mesh.visible = active;
    if (!active) {
      if (finds.some((f) => !f.own)) clear();
      return;
    }
    if (counting && (wait -= dt) <= 0) {
      wait = CHECK_EVERY;
      const lying = () => finds.filter((f) => !f.own && !f.wild).length; // (what the farmer dropped doesn't count, nor forage)
      if (lying() < MOST && Math.random() < CHANCE) {
        spawn();
        if (lying() < MOST && Math.random() < TWO) spawn();
      }
    }
    if (counting && (forageWait -= dt) <= 0) {
      forageWait = FORAGE_EVERY;
      if (finds.filter((f) => f.wild).length < MOST_FORAGE) forage();
    }
    for (const find of [...finds]) {
      const { mesh } = find;
      // Bob and spin, as a lobby's treasures do (main.js, updateSpots)
      find.age += dt;
      const size = RARE[find.item] ? 1.3 : 1;
      mesh.scale.setScalar(size * Math.min(1, find.age / GROW));
      mesh.position.y = find.y + Math.sin(t * 2 + find.x) * 0.15;
      mesh.rotation.y += dt * 1.5;
      const near = farmers.map((at) => Math.hypot(find.x - at.x, mesh.position.y - at.y, find.z - at.z) < REACH);
      if (find.own && !find.away) find.away = !near.some(Boolean); // (dropped: not back into the backpack till we have stepped off it)
      if (!near.some(Boolean) || (find.own && !find.away) || performance.now() < find.retryAt) continue;
      // (the first one in reach with room for it: a full backpack doesn't keep it from the others)
      if (near.some((close, i) => close && onPickUp(find.item, find.count, i))) remove(find);
      else find.retryAt = performance.now() + 1000;
    }
  }

  // (the developer tools: one now, whatever the odds; true if there was somewhere for it)
  function spawnNow() {
    const before = finds.length;
    spawn();
    return finds.length > before;
  }

  // (and forage)
  function forageNow() {
    const before = finds.length;
    forage();
    return finds.length > before;
  }

  return { update, clear, drop, dropped, restoreDropped, spawnNow, forageNow, list: () => finds };
}
