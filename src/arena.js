import * as THREE from 'three';
import { ARENAS, ARENA_R, BOSS_IDS, arenaExit } from '../shared/bosses.js';

// ---------- The bosses' arenas ----------
// A boss's arena (shared/bosses.js ARENAS): a round island of meadow out past
// the sea on the farm's world, a hedge in flower all round it (too tall to
// hop: the way home is the portal at its front, toward the camera). Its
// ground and hedge go in the world's platforms, like the house's room
// (src/house.js). The boss on it is src/bossview.js's.

const HEDGE_H = 1.4;
const WALL_H = 3.5; // (what stops a farmer: a little over a jump)
const SEGMENTS = 36;

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const MATS = {
  grass: mat(0x7cc95a),
  grassDark: mat(0x5fae45),
  dirt: mat(0x8a5a32),
  dirtDark: mat(0x6b4426),
  hedge: mat(0x3f7f34),
  hedgeLight: mat(0x5a9a42),
  petals: [mat(0xffd84a), mat(0xf28cb1), mat(0xffffff), mat(0xb06fd0)],
  stone: mat(0x9c9a92),
  stoneLight: mat(0xb9b7ae),
  moss: mat(0x6f9a3e),
  swirl: mat(0x6a2f94, { emissive: 0x7a3fa0, emissiveIntensity: 0.9 }),
  swirlLight: mat(0xd9a8ff, { emissive: 0xc58cf0, emissiveIntensity: 1 }),
  wood: mat(0xa8713f),
  sign: mat(0xe8c98f),
};
const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(0.5, 1);

// world: the farm's (world.js buildWorld)
export function createArenas(world) {
  const root = new THREE.Group();
  root.name = 'boss-arenas';
  world.root.add(root);
  const swirls = [];

  function part(parent, geo, material, x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function solid({ x, y, z, w, h, d }, extra = {}) {
    world.platforms.push({
      center: new THREE.Vector3(x, y, z),
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ...extra,
    });
  }

  for (const id of BOSS_IDS) {
    const { x: ax, z: az } = ARENAS[id];
    const arena = new THREE.Group();
    arena.name = `arena-${id}`;
    arena.position.set(ax, 0, az);
    root.add(arena);

    // the island: earth sides, a meadow on top at the ground's height
    const r = ARENA_R + 1.2;
    const sides = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 1.5, 2.4, 40), MATS.dirt);
    sides.position.y = -1.25;
    sides.receiveShadow = true;
    arena.add(sides);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 40), MATS.grass);
    top.position.y = -0.05;
    top.receiveShadow = true;
    arena.add(top);
    solid({ x: ax, y: -0.6, z: az, w: 2 * r, h: 1.2, d: 2 * r }, { ground: true });
    // a ring of darker grass, the boss's ground
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_R * 0.55, ARENA_R * 0.58, 48).rotateX(-Math.PI / 2), MATS.grassDark);
    ring.position.y = 0.01;
    arena.add(ring);

    // the hedge all round, in flower, with a gap at the front for the way home
    const exit = arenaExit(id);
    const gapAt = Math.atan2(exit.x - ax, exit.z - az);
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const gap = Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < 0.12;
      const hx = Math.sin(a) * (ARENA_R + 0.4);
      const hz = Math.cos(a) * (ARENA_R + 0.4);
      const len = ((Math.PI * 2 * (ARENA_R + 0.4)) / SEGMENTS) * 1.08;
      const seg = new THREE.Group();
      seg.position.set(hx, 0, hz);
      seg.rotation.y = a;
      arena.add(seg);
      if (!gap) {
        // (low at the front, so the camera sees in)
        const front = Math.cos(a - gapAt) > 0.5;
        const h = front ? 0.6 : HEDGE_H;
        part(seg, box, i % 2 ? MATS.hedge : MATS.hedgeLight, 0, h / 2, 0, len, h, 0.9);
        for (let k = 0; k < 3; k++) part(seg, ball, MATS.petals[(i + k) % 4], (k - 1) * len * 0.3, h + 0.02, ((k * 7 + i) % 3) * 0.15 - 0.15, 0.16, 0.12, 0.16);
      }
      // what stops a farmer: all round (the way home is a portal, not a walk)
      const c = Math.cos(a);
      const s = Math.sin(a);
      const w = Math.abs(len * c) + Math.abs(0.9 * s);
      const d = Math.abs(len * s) + Math.abs(0.9 * c);
      solid({ x: ax + hx, y: WALL_H / 2, z: az + hz, w, h: WALL_H, d });
    }

    // tufts and flowers about the meadow, kept off the middle
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39996;
      const d = ARENA_R * (0.65 + ((i * 37) % 30) / 100);
      const fx = Math.sin(a) * d;
      const fz = Math.cos(a) * d;
      if (Math.hypot(fx - (exit.x - ax), fz - (exit.z - az)) < 2.5) continue;
      part(arena, box, MATS.grassDark, fx, 0.12, fz, 0.06, 0.24, 0.06);
      if (i % 3 === 0) part(arena, ball, MATS.petals[i % 4], fx, 0.26, fz, 0.14, 0.1, 0.14);
    }

    // the way home: a portal like the one on the farm, in the hedge's gap
    const door = new THREE.Group();
    door.position.set(exit.x - ax, 0, exit.z - az + 0.6);
    arena.add(door);
    part(door, box, MATS.stone, 0, 0.06, 0, 1.6, 0.12, 0.6);
    for (const x of [-0.65, 0.65]) part(door, box, MATS.stone, x, 1.1, 0, 0.24, 2.2, 0.36);
    part(door, box, MATS.stoneLight, 0, 2.3, 0, 1.6, 0.24, 0.42);
    part(door, box, MATS.moss, 0.4, 2.44, 0.05, 0.4, 0.05, 0.24);
    const swirl = new THREE.Group();
    swirl.position.set(0, 1.15, 0);
    door.add(swirl);
    part(swirl, ball, MATS.swirl, 0, 0, 0, 1.06, 2.05, 0.06);
    for (let i = 0; i < 3; i++) {
      const arm = part(swirl, box, MATS.swirlLight, 0, 0, 0, 0.07, 0.7, 0.02);
      arm.rotation.z = (i * Math.PI * 2) / 3;
      arm.position.set(-Math.sin(arm.rotation.z) * 0.24, Math.cos(arm.rotation.z) * 0.24, 0.05);
    }
    swirls.push(swirl);
    // a signpost by it: home's that way
    part(door, box, MATS.wood, 1.35, 0.55, 0.1, 0.1, 1.1, 0.1);
    part(door, box, MATS.sign, 1.35, 1.0, 0.16, 0.7, 0.3, 0.06);
  }

  return {
    // t: seconds
    update(t) {
      for (const swirl of swirls) swirl.rotation.z = -t * 2.2;
    },
  };
}
