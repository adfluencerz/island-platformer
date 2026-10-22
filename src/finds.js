import { RARE } from '../shared/level.js';
import { FARM_FINDS } from '../shared/balance.js';
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
// What the farmer drops out of their backpack (drop()) lies about the same
// way, but is kept with the farm (dropped(), restoreDropped()), and isn't
// picked straight back up: not till they have stepped away from it.
const { every: CHECK_EVERY, chance: CHANCE, two: TWO, most: MOST, loot: FINDS } = FARM_FINDS;
const FLOAT_Y = 0.6; // over the ground
const REACH = 1.1; // from the farmer's middle, to pick one up
const GROW = 0.4; // seconds to pop up

function roll() {
  let r = Math.random() * FINDS.reduce((sum, [, w]) => sum + w, 0);
  for (const [item, w, min, max] of FINDS) {
    r -= w;
    if (r < 0) return [item, min + Math.floor(Math.random() * (max - min + 1))];
  }
  return ['coin', 1];
}

// freeSpot(): somewhere on the farm for a find, { x, y, z } (y: the ground), or null.
// onPickUp(item, count): into the backpack; false if there was no room.
// isItem(id): an item there is (a save is not to be trusted).
export function createFarmFinds({ scene, freeSpot, onPickUp, isItem = () => true }) {
  const finds = []; // { item, count, mesh, x, y, z, age, retryAt, own, away } (own: dropped by the farmer; away: they have stepped off it since)
  let wait = CHECK_EVERY;

  function add(item, count, x, y, z, own = false, away = false) {
    const mesh = createItemMesh(item);
    mesh.position.set(x, y + FLOAT_Y, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0);
    scene.add(mesh);
    finds.push({ item, count, mesh, x, y: y + FLOAT_Y, z, age: 0, retryAt: 0, own, away });
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
  // at: the farmer's position (Vector3).
  function update(dt, t, { active, counting, at }) {
    for (const find of finds) find.mesh.visible = active;
    if (!active) {
      if (finds.some((f) => !f.own)) clear();
      return;
    }
    if (counting && (wait -= dt) <= 0) {
      wait = CHECK_EVERY;
      const lying = () => finds.filter((f) => !f.own).length; // (what the farmer dropped doesn't count)
      if (lying() < MOST && Math.random() < CHANCE) {
        spawn();
        if (lying() < MOST && Math.random() < TWO) spawn();
      }
    }
    for (const find of [...finds]) {
      const { mesh } = find;
      // Bob and spin, as a lobby's treasures do (main.js, updateSpots)
      find.age += dt;
      const size = RARE[find.item] ? 1.3 : 1;
      mesh.scale.setScalar(size * Math.min(1, find.age / GROW));
      mesh.position.y = find.y + Math.sin(t * 2 + find.x) * 0.15;
      mesh.rotation.y += dt * 1.5;
      const near = Math.hypot(find.x - at.x, mesh.position.y - at.y, find.z - at.z) < REACH;
      if (find.own && !find.away) find.away = !near; // (dropped: not back into the backpack till we have stepped off it)
      if (!near || (find.own && !find.away) || performance.now() < find.retryAt) continue;
      if (onPickUp(find.item, find.count)) remove(find);
      else find.retryAt = performance.now() + 1000;
    }
  }

  // (the developer tools: one now, whatever the odds; true if there was somewhere for it)
  function spawnNow() {
    const before = finds.length;
    spawn();
    return finds.length > before;
  }

  return { update, clear, drop, dropped, restoreDropped, spawnNow, list: () => finds };
}
