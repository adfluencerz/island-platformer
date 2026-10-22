import * as THREE from 'three';
import { TILE_SIZE } from './world.js';
import { badgeMat } from './animals.js';
import { isMachine, isReady, fillsItself, contentsBack, machinesFromSave, machinesToSave } from '../shared/machines.js';

// ---------- The farm's machines, on the page ----------
// What is in each machine built on the farm (shared/machines.js): the page's
// own on a farm without helpers (kept in the farm's save), and on one with
// them what the room last said (server/farmroom.js). Over each, a little
// bubble: what it is making, faint while it works, and bobbing once it is
// ready to collect. main.js does the rest (E next to one, the campfire's
// dishes, sending the room what we do).

const REACH = 1.5; // from a machine's middle
const BADGE_Y = { campfire: 1.1, beehive: 1.6, mayo_machine: 1.75 }; // (the rest: 2)
const BADGE = 0.55;

// buildings: from createBuildings (what is built where). root: the farm's world.
export function createMachines({ buildings, root }) {
  const machines = new Map(); // key -> { item, at, takes, pending? }
  const badges = new Map(); // key -> { sprite, item, ready }
  const faintMats = {};
  const faint = (id) => {
    if (faintMats[id]) return faintMats[id];
    const m = badgeMat(id).clone();
    m.opacity = 0.45;
    m.transparent = true;
    return (faintMats[id] = m);
  };

  function drop(key) {
    const badge = badges.get(key);
    if (!badge) return;
    root.remove(badge.sprite);
    badges.delete(key);
  }

  return {
    get: (key) => machines.get(key) ?? null,
    // what is in it now (null: nothing)
    set(key, state) {
      if (state) machines.set(key, state);
      else machines.delete(key);
    },
    clear() {
      machines.clear();
      for (const key of [...badges.keys()]) drop(key);
    },
    // From the farm's save (or the room's welcome): [[key, item, at, takes]]
    restore(list, hours) {
      this.clear();
      const keys = buildings.list().map(([key]) => key);
      for (const [key, state] of machinesFromSave(list, (k) => buildings.get(k), keys, hours)) machines.set(key, state);
    },
    capture: () => machinesToSave(machines),
    // A machine was just built on tile key (a beehive gets going)
    built(key, piece, hours) {
      const full = fillsItself(piece, hours);
      if (full) machines.set(key, full);
    },
    // Taken down: what was in it comes back, { item: count }
    removed(key, hours) {
      const back = contentsBack(machines.get(key), hours);
      machines.delete(key);
      return back;
    },
    // The nearest machine within reach of pos (its key), or null
    nearest(pos, reach = REACH) {
      let best = null;
      let bestD = reach;
      for (const [key, piece] of buildings.list()) {
        if (!isMachine(piece)) continue;
        const [gx, gz] = key.split(',').map(Number);
        const d = Math.hypot(gx * TILE_SIZE - pos.x, gz * TILE_SIZE - pos.z);
        if (d <= bestD && Math.abs(pos.y - 0.8) < 1) {
          bestD = d;
          best = key;
        }
      }
      return best;
    },
    // Each frame on the farm: the bubbles (hours: the farm's clock; t: seconds)
    update(hours, t) {
      for (const key of [...badges.keys()]) if (!machines.has(key)) drop(key);
      for (const [key, state] of machines) {
        const ready = isReady(state, hours);
        let badge = badges.get(key);
        if (badge && (badge.item !== state.item || badge.ready !== ready)) {
          drop(key);
          badge = null;
        }
        if (!badge) {
          const sprite = new THREE.Sprite(ready ? badgeMat(state.item) : faint(state.item));
          const [gx, gz] = key.split(',').map(Number);
          sprite.position.set(gx * TILE_SIZE, BADGE_Y[buildings.get(key)] ?? 2, gz * TILE_SIZE);
          sprite.scale.setScalar(ready ? BADGE : BADGE * 0.75);
          sprite.renderOrder = 2;
          root.add(sprite);
          badge = { sprite, item: state.item, ready, y: sprite.position.y };
          badges.set(key, badge);
        }
        if (ready) badge.sprite.position.y = badge.y + Math.sin(t * 3 + badge.sprite.position.x) * 0.06;
      }
    },
  };
}
