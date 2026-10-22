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
export function createFarmFinds({ scene, freeSpot, onPickUp }) {
  const finds = []; // { item, count, mesh, x, y, z, age, retryAt }
  let wait = CHECK_EVERY;

  function spawn() {
    const spot = freeSpot();
    if (!spot) return;
    const [item, count] = roll();
    const mesh = createItemMesh(item);
    mesh.position.set(spot.x, spot.y + FLOAT_Y, spot.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0);
    scene.add(mesh);
    finds.push({ item, count, mesh, x: spot.x, y: spot.y + FLOAT_Y, z: spot.z, age: 0, retryAt: 0 });
  }

  function remove(find) {
    scene.remove(find.mesh);
    finds.splice(finds.indexOf(find), 1);
  }

  function clear() {
    while (finds.length) remove(finds[0]);
    wait = CHECK_EVERY;
  }

  // active: on our own farm, alone. counting: being played (not behind a menu).
  // at: the farmer's position (Vector3).
  function update(dt, t, { active, counting, at }) {
    if (!active) {
      if (finds.length) clear();
      return;
    }
    if (counting && (wait -= dt) <= 0) {
      wait = CHECK_EVERY;
      if (finds.length < MOST && Math.random() < CHANCE) {
        spawn();
        if (finds.length < MOST && Math.random() < TWO) spawn();
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
      if (!near || performance.now() < find.retryAt) continue;
      if (onPickUp(find.item, find.count)) remove(find);
      else find.retryAt = performance.now() + 1000;
    }
  }

  return { update, clear, list: () => finds };
}
