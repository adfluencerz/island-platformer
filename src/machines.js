import * as THREE from 'three';
import { TILE_SIZE } from './world.js';
import { badgeMat } from './animals.js';
import { createItemMesh } from './itemmesh.js';
import { TANK_BOX } from './build.js';
import { isMachine, isReady, fillsItself, contentsBack, machinesFromSave, machinesToSave, TANK } from '../shared/machines.js';

// ---------- The farm's machines, on the page ----------
// What is in each machine built on the farm (shared/machines.js): the page's
// own on a farm without helpers (kept in the farm's save), and on one with
// them what the room last said (server/farmroom.js). Over each, a little
// bubble: what it is making, faint while it works, and bobbing once it is
// ready to collect. main.js does the rest (E next to one, the campfire's
// dishes, sending the room what we do). An aquarium has no bubble: the fish
// in it swim about inside its glass instead.

const REACH = 1.5; // from a machine's middle
const BADGE_Y = { campfire: 1.1, beehive: 1.6, mayo_machine: 1.75 }; // (the rest: 2)
const BADGE = 0.55;

// buildings: from createBuildings (what is built where). root: the farm's world.
export function createMachines({ buildings, root }) {
  const machines = new Map(); // key -> { item, at, takes, pending? }
  const badges = new Map(); // key -> { sprite, item, ready }
  const tanks = new Map(); // an aquarium's key -> { sig, fish: [{ mesh, heading, speed, bob }] }
  const faintMats = {};
  const faint = (id) => {
    if (faintMats[id]) return faintMats[id];
    const m = badgeMat(id).clone();
    m.opacity = 0.45;
    m.transparent = true;
    return (faintMats[id] = m);
  };

  // ---------- The aquariums ----------
  // The fish in the one on tile key, as it holds them now
  function emptyTank(key) {
    for (const f of tanks.get(key)?.fish ?? []) root.remove(f.mesh);
    tanks.delete(key);
  }
  function swim(key, state, dt) {
    const sig = JSON.stringify(state.takes);
    let tank = tanks.get(key);
    if (tank?.sig !== sig) {
      emptyTank(key);
      tank = { sig, fish: [] };
      tanks.set(key, tank);
      const [gx, gz] = key.split(',').map(Number);
      const [cx, cy, cz] = TANK_BOX.at;
      const [hx, hy, hz] = TANK_BOX.half;
      for (const [item, n] of Object.entries(state.takes)) {
        for (let i = 0; i < n; i++) {
          const mesh = createItemMesh(item);
          mesh.scale.setScalar(0.3);
          mesh.position.set(gx * TILE_SIZE + cx + (Math.random() * 2 - 1) * hx, cy + (Math.random() * 2 - 1) * hy, gz * TILE_SIZE + cz + (Math.random() * 2 - 1) * hz);
          root.add(mesh);
          tank.fish.push({ mesh, heading: Math.random() * Math.PI * 2, speed: 0.12 + Math.random() * 0.1, bob: Math.random() * 6, home: [gx * TILE_SIZE + cx, cy, gz * TILE_SIZE + cz] });
        }
      }
    }
    // to and fro, turning at the glass
    const [hx, hy, hz] = TANK_BOX.half;
    for (const f of tank.fish) {
      const p = f.mesh.position;
      const [ox, oy, oz] = f.home;
      f.bob += dt;
      f.heading += Math.sin(f.bob * 0.7) * dt * 0.6;
      let nx = p.x + Math.cos(f.heading) * f.speed * dt;
      let nz = p.z + Math.sin(f.heading) * f.speed * dt;
      if (Math.abs(nx - ox) > hx || Math.abs(nz - oz) > hz) {
        f.heading += Math.PI * (0.7 + Math.random() * 0.6);
        nx = p.x;
        nz = p.z;
      }
      p.set(nx, oy + Math.sin(f.bob * 0.9) * hy * 0.8, nz);
      f.mesh.rotation.set(0, -f.heading, Math.sin(f.bob * 6) * 0.08);
    }
  }

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
      for (const key of [...tanks.keys()]) emptyTank(key);
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
    // Each frame on the farm: the bubbles, and the fish in the aquariums
    // (hours: the farm's clock; t, dt: seconds)
    update(hours, t, dt = 0) {
      for (const key of [...badges.keys()]) if (!machines.has(key)) drop(key);
      for (const key of [...tanks.keys()]) if (machines.get(key)?.item !== TANK) emptyTank(key);
      for (const [key, state] of machines) {
        if (state.item === TANK) {
          swim(key, state, dt);
          continue;
        }
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
