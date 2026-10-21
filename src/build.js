import * as THREE from 'three';
import { PIECES } from '../shared/level.js';
import { TILE_SIZE } from './world.js';

// ---------- What is built on the farm ----------
// Fences, gates, walls (stone, low stone and palisades), paths, blocks to
// climb (steps, crates, log piles, barrels, straw bales, scaffolds, stone
// blocks and pillars), the workbench and what it
// makes for the farm (PIECES in shared/level.js), one to a tile. Lamp posts light up at night (setNight). This draws them on a world (the farm's), joins each fence and wall
// up with the fences and walls beside it, and gives the solid ones colliders
// in the world's platforms. main.js has build mode: where pieces may go,
// paying for them, and keeping them (in the farm's save, or its room).

const FENCE_H = 1.05; // a hop clears a fence...
const WALL_H = 2; // ...not a wall

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const MATS = {
  post: mat(0x9a6a3a),
  rail: mat(0xb8834d),
  plankA: mat(0xb07a45),
  plankB: mat(0x9a6a3a),
  stone: mat(0x9c9a92),
  stoneDark: mat(0x7d7b74),
  stoneLight: mat(0xb9b7ae),
  crate: mat(0xc9955a),
  crateDark: mat(0x8f6136),
  bark: mat(0x6e4a2b),
  stave: mat(0xa8713f),
  straw: mat(0xe2c26a),
  strawDark: mat(0xc9a64e),
  twine: mat(0x8a6a3a),
  endGrain: mat(0xe0b57a),
  benchTop: mat(0xc28a52),
  iron: mat(0x5d6470, { roughness: 0.5, metalness: 0.4 }),
  lantern: mat(0xffe7a3, { emissive: 0xffc35a, emissiveIntensity: 0 }),
  soil: mat(0x5b3a1e),
  leaf: mat(0x4f9e3c),
  petals: [mat(0xe0475b), mat(0xffd84a), mat(0xf28ad8), mat(0xffffff)],
};
const ball = new THREE.IcosahedronGeometry(0.5, 0);
const box = new THREE.BoxGeometry(1, 1, 1);
const flag = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const log = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const shaft = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const tip = new THREE.ConeGeometry(0.5, 1, 8);
const barrel = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const keyOf = (gx, gz) => `${gx},${gz}`;
const gridOf = (key) => key.split(',').map(Number);
// a cheap, steady number from a tile, so a stone path keeps its look
const hash = (gx, gz) => {
  let h = Math.imul(gx * 73856093 ^ gz * 19349663, 0x9e3779b1);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

function part(group, geo, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

// A stone wall `h` tall: a pier in the middle of the tile, and a run of
// stone to each wall or fence it joins
function stoneWall(g, solids, h, joined) {
  part(g, box, MATS.stone, 0, h / 2, 0, 0.56, h, 0.56);
  part(g, box, MATS.stoneLight, 0, h + 0.05, 0, 0.64, 0.1, 0.64);
  part(g, box, MATS.stoneDark, 0, Math.min(0.12, h / 8), 0, 0.62, Math.min(0.24, h / 4), 0.62);
  solids.push({ x: 0, y: h / 2, z: 0, w: 0.56, h, d: 0.56 });
  for (const [dx, dz] of joined) {
    const run = (w) => [dx ? 0.5 : w, dz ? 0.5 : w];
    const [w, d] = run(0.46);
    part(g, box, MATS.stone, dx * 0.25, h * 0.45, dz * 0.25, w, h * 0.9, d);
    const [cw, cd] = run(0.54);
    part(g, box, MATS.stoneLight, dx * 0.25, h * 0.9 + 0.05, dz * 0.25, cw, 0.1, cd);
    // a course of darker stones along the bottom, and one halfway
    const [bw, bd] = run(0.5);
    part(g, box, MATS.stoneDark, dx * 0.25, Math.min(0.12, h / 8), dz * 0.25, bw, Math.min(0.24, h / 4), bd);
    part(g, box, MATS.stoneDark, dx * 0.25, h * 0.48, dz * 0.25, bw, 0.08, bd);
    solids.push({ x: dx * 0.25, y: h / 2, z: dz * 0.25, w, h, d });
  }
}

// A piece's model, at the middle of its tile. joined: the directions
// ([dx, dz]) its fence or wall runs on to a neighbour. Returns the group and
// its colliders' boxes ({ x, y, z, w, h, d }, relative to the tile).
function model(id, gx, gz, joined) {
  const g = new THREE.Group();
  const solids = [];
  if (id === 'wood_fence') {
    part(g, box, MATS.post, 0, FENCE_H / 2, 0, 0.18, FENCE_H, 0.18);
    part(g, box, MATS.post, 0, FENCE_H + 0.03, 0, 0.24, 0.06, 0.24);
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.3, h: FENCE_H, d: 0.3 });
    for (const [dx, dz] of joined) {
      for (const y of [0.42, 0.8]) {
        part(g, box, MATS.rail, dx * 0.25, y, dz * 0.25, dx ? 0.5 : 0.07, 0.1, dz ? 0.5 : 0.07);
      }
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.2, h: FENCE_H, d: dz ? 0.5 : 0.2 });
    }
  } else if (id === 'stone_wall' || id === 'low_stone_wall') {
    stoneWall(g, solids, id === 'stone_wall' ? WALL_H : FENCE_H, joined);
  } else if (id === 'wood_palisade') {
    // pointed logs side by side, a little uneven, with a rail behind them
    const r = hash(gx, gz);
    const stake = (x, z, k, h) => {
      part(g, log, MATS.bark, x, h / 2, z, k, h, k);
      part(g, tip, MATS.endGrain, x, h + 0.12, z, k, 0.24, k);
    };
    stake(0, 0, 0.3, WALL_H - 0.2);
    solids.push({ x: 0, y: WALL_H / 2, z: 0, w: 0.4, h: WALL_H, d: 0.4 });
    for (const [dx, dz] of joined) {
      [0.2, 0.38].forEach((o, i) => stake(dx * o, dz * o, 0.24, WALL_H - 0.32 + ((r * 10 + i * 3 + dx + dz * 2) % 3) * 0.06));
      part(g, box, MATS.rail, dx * 0.25 - (dz ? 0.14 : 0), WALL_H * 0.62, dz * 0.25 - (dx ? 0.14 : 0), dx ? 0.5 : 0.06, 0.1, dz ? 0.5 : 0.06);
      solids.push({ x: dx * 0.25, y: WALL_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.3, h: WALL_H, d: dz ? 0.5 : 0.3 });
    }
  } else if (id === 'wood_path') {
    // three planks, along whichever way suits the tile, with a gap between
    const across = hash(gx, gz) < 0.5;
    [-0.31, 0, 0.31].forEach((o, i) => {
      const plank = part(g, box, i % 2 ? MATS.plankB : MATS.plankA, across ? o : 0, 0.035, across ? 0 : o, across ? 0.28 : 0.94, 0.05, across ? 0.94 : 0.28);
      plank.castShadow = false;
    });
  } else if (id === 'stone_path') {
    // a few flat stones, laid a little differently on every tile
    const r = hash(gx, gz);
    const stones = [[-0.22, -0.22, 0.42], [0.24, -0.2, 0.38], [-0.2, 0.24, 0.38], [0.22, 0.23, 0.44]];
    stones.forEach(([x, z, s], i) => {
      const k = s * (0.95 + ((r * (i + 3) * 7) % 0.2));
      const stone = part(g, flag, i % 2 ? MATS.stone : MATS.stoneLight, x, 0.03, z, k, 0.05, k);
      stone.rotation.y = r * 6 + i;
      stone.castShadow = false;
    });
  } else if (id === 'wood_gate') {
    // a post either side and a gate between, along the fences it joins
    // (across the tile on its own); it's walked through, so no colliders
    const along = joined.some(([dx]) => dx) || !joined.length ? [1, 0] : [0, 1];
    const [ax, az] = along;
    for (const s of [-1, 1]) {
      part(g, box, MATS.post, ax * s * 0.44, FENCE_H * 0.55, az * s * 0.44, 0.16, FENCE_H * 1.1, 0.16);
      part(g, box, MATS.post, ax * s * 0.44, FENCE_H * 1.1 + 0.03, az * s * 0.44, 0.22, 0.06, 0.22);
    }
    const len = 0.72;
    for (const y of [0.3, 0.86]) part(g, box, MATS.rail, 0, y, 0, ax ? len : 0.06, 0.1, az ? len : 0.06);
    for (const o of [-0.24, 0, 0.24]) part(g, box, MATS.plankA, ax * o, 0.58, az * o, ax ? 0.12 : 0.05, 0.62, az ? 0.12 : 0.05);
    // a brace corner to corner, and the latch
    const brace = part(g, box, MATS.plankB, 0, 0.58, 0, ax ? 0.78 : 0.05, 0.08, az ? 0.78 : 0.05);
    if (ax) brace.rotation.z = 0.62;
    else brace.rotation.x = -0.62;
    part(g, box, MATS.iron, ax * 0.3, 0.62, az * 0.3, 0.1, 0.06, 0.1);
  } else if (PIECES[id]?.block) {
    // a block to climb on: a box filling the tile, with a little trim
    const h = PIECES[id].block;
    const w = 0.96;
    if (id === 'wood_crate') {
      part(g, box, MATS.crate, 0, h / 2, 0, w, h, w);
      // a frame around each side, and a diagonal board across it
      for (const [fx, fz] of DIRS) {
        const along = fz ? [w + 0.02, 0.12] : [0.12, w + 0.02];
        for (const y of [0.06, h - 0.06]) part(g, box, MATS.crateDark, fx * 0.47, y, fz * 0.47, fz ? along[0] : 0.04, 0.12, fz ? 0.04 : along[1]);
        const diag = part(g, box, MATS.crateDark, fx * 0.485, h / 2, fz * 0.485, fz ? 1.05 : 0.03, 0.1, fz ? 0.03 : 1.05);
        if (fz) diag.rotation.z = fz * 0.72;
        else diag.rotation.x = -fx * 0.72;
      }
      for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) part(g, box, MATS.crateDark, x, h / 2, z, 0.14, h, 0.14);
      part(g, box, MATS.plankA, 0, h + 0.005, 0, w - 0.16, 0.01, w - 0.16).castShadow = false;
    } else if (id === 'wood_step') {
      // a low box of boards, with the boards' ends showing on top
      part(g, box, MATS.crateDark, 0, h / 2, 0, w, h, w);
      [-0.36, -0.12, 0.12, 0.36].forEach((o, i) => {
        part(g, box, i % 2 ? MATS.plankB : MATS.plankA, o, h + 0.015, 0, 0.22, 0.03, w).castShadow = false;
      });
      for (const [fx, fz] of DIRS) part(g, box, MATS.plankA, fx * 0.475, h * 0.5, fz * 0.475, fz ? w : 0.03, h * 0.5, fz ? 0.03 : w);
    } else if (id === 'log_pile') {
      // three rows of three logs, their cut ends to the front and back,
      // over a dark core so no light shows between them
      part(g, box, MATS.crateDark, 0, h / 2, 0, w - 0.1, h - 0.06, w - 0.1);
      const r = hash(gx, gz);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = (col - 1) * 0.31 + (row % 2 ? 0.02 : -0.02);
          const y = 0.165 + row * 0.33;
          const k = 0.31 + ((r * 10 + row * 3 + col) % 3) * 0.01;
          part(g, log, MATS.bark, x, y, 0, k, w, k).rotation.x = Math.PI / 2;
          for (const s of [-1, 1]) {
            const end = part(g, log, MATS.endGrain, x, y, s * (w / 2 + 0.005), k * 0.8, 0.01, k * 0.8);
            end.rotation.x = Math.PI / 2;
            end.castShadow = false;
          }
        }
      }
    } else if (id === 'wood_scaffold') {
      // a plank deck on four posts, braced on every side
      const top = 0.1;
      part(g, box, MATS.plankA, 0, h - top / 2, 0, w, top, w);
      [-0.32, 0, 0.32].forEach((o) => part(g, box, MATS.plankB, o, h + 0.005, 0, 0.02, 0.01, w - 0.04).castShadow = false);
      for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) part(g, box, MATS.post, x, (h - top) / 2, z, 0.12, h - top, 0.12);
      for (const [fx, fz] of DIRS) {
        part(g, box, MATS.rail, fx * 0.44, 0.2, fz * 0.44, fz ? w - 0.1 : 0.06, 0.08, fz ? 0.06 : w - 0.1);
        const brace = part(g, box, MATS.rail, fx * 0.45, (h - top) / 2, fz * 0.45, fz ? 1.2 : 0.05, 0.08, fz ? 0.05 : 1.2);
        if (fz) brace.rotation.z = fz * 0.85;
        else brace.rotation.x = -fx * 0.85;
      }
    } else if (id === 'wood_barrel') {
      // a barrel of staves, bulging at the middle, with iron hoops and a lid
      part(g, barrel, MATS.stave, 0, h * 0.25, 0, 0.86, h * 0.5, 0.86);
      part(g, barrel, MATS.stave, 0, h * 0.75, 0, 0.86, h * 0.5, 0.86);
      part(g, barrel, MATS.crate, 0, h / 2, 0, w, h * 0.4, w);
      for (const [y, k] of [[0.1, 0.88], [h * 0.3, w + 0.02], [h * 0.7, w + 0.02], [h - 0.1, 0.88]]) part(g, barrel, MATS.iron, 0, y, 0, k, 0.05, k).castShadow = false;
      part(g, barrel, MATS.plankA, 0, h + 0.005, 0, 0.78, 0.01, 0.78).castShadow = false;
      part(g, box, MATS.plankB, 0, h + 0.012, 0, 0.7, 0.01, 0.04).castShadow = false;
    } else if (id === 'straw_bale') {
      // a bale of flax straw, tied twice round with twine, a little ragged
      const r = hash(gx, gz);
      part(g, box, MATS.straw, 0, h / 2, 0, w, h, w);
      part(g, box, MATS.strawDark, 0, 0.05, 0, w + 0.02, 0.1, w + 0.02).castShadow = false;
      for (const x of [-0.24, 0.24]) part(g, box, MATS.twine, x, h / 2, 0, 0.04, h + 0.02, w + 0.02).castShadow = false;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.9 + r * 6;
        part(g, box, MATS.strawDark, Math.cos(a) * 0.3, h + 0.01, Math.sin(a) * 0.3, 0.26, 0.015, 0.03).rotation.y = a;
      }
    } else if (id === 'stone_pillar') {
      // a round column on a square plinth, with a square cap to stand on
      const r = hash(gx, gz);
      part(g, box, MATS.stoneDark, 0, 0.12, 0, w, 0.24, w);
      part(g, box, MATS.stone, 0, 0.29, 0, w - 0.1, 0.1, w - 0.1);
      part(g, shaft, r < 0.5 ? MATS.stone : MATS.stoneLight, 0, h / 2, 0, 0.7, h - 0.5, 0.7);
      for (const y of [h * 0.4, h * 0.65]) part(g, shaft, MATS.stoneDark, 0, y, 0, 0.72, 0.03, 0.72).castShadow = false;
      part(g, box, MATS.stone, 0, h - 0.19, 0, w - 0.1, 0.1, w - 0.1);
      part(g, box, r < 0.5 ? MATS.stoneLight : MATS.stone, 0, h - 0.07, 0, w, 0.14, w);
    } else {
      // dressed stone, a shade different on every tile, with a darker
      // course along the bottom and a lighter cap
      const r = hash(gx, gz);
      part(g, box, r < 0.5 ? MATS.stone : MATS.stoneLight, 0, h / 2, 0, w, h, w);
      part(g, box, MATS.stoneDark, 0, Math.min(0.1, h / 4), 0, w + 0.02, Math.min(0.2, h / 2), w + 0.02);
      part(g, box, r < 0.5 ? MATS.stoneLight : MATS.stone, 0, h + 0.02, 0, w - 0.04, 0.04, w - 0.04);
      // the joints between its courses of stone, one about every half a tile up
      const courses = Math.round(h / 0.5);
      for (let i = 1; i < courses; i++) {
        for (const [fx, fz] of DIRS) part(g, box, MATS.stoneDark, fx * 0.485, (h * i) / courses, fz * 0.485, fz ? w : 0.03, 0.05, fz ? 0.03 : w);
      }
    }
    solids.push({ x: 0, y: h / 2, z: 0, w, h, d: w });
  } else if (id === 'workbench') {
    part(g, box, MATS.benchTop, 0, 0.82, 0, 0.96, 0.1, 0.62);
    for (const [x, z] of [[-0.4, -0.24], [0.4, -0.24], [-0.4, 0.24], [0.4, 0.24]]) part(g, box, MATS.post, x, 0.39, z, 0.1, 0.78, 0.1);
    part(g, box, MATS.plankB, 0, 0.22, 0, 0.84, 0.05, 0.52); // the shelf
    part(g, box, MATS.stoneLight, -0.2, 0.3, 0.02, 0.3, 0.12, 0.22); // a block of stone on it
    part(g, box, MATS.iron, 0.3, 0.93, -0.16, 0.16, 0.12, 0.12); // a vise
    part(g, box, MATS.post, -0.18, 0.9, 0.1, 0.36, 0.05, 0.05); // a mallet
    part(g, box, MATS.iron, -0.02, 0.92, 0.1, 0.1, 0.1, 0.14);
    solids.push({ x: 0, y: 0.45, z: 0, w: 0.96, h: 0.9, d: 0.62 });
  } else if (id === 'lamp_post') {
    part(g, box, MATS.iron, 0, 0.08, 0, 0.36, 0.16, 0.36);
    part(g, box, MATS.iron, 0, 1.05, 0, 0.1, 2, 0.1);
    part(g, box, MATS.iron, 0, 2.1, 0, 0.4, 0.06, 0.4);
    part(g, box, MATS.lantern, 0, 1.92, 0, 0.28, 0.3, 0.28).castShadow = false;
    part(g, box, MATS.iron, 0, 2.17, 0, 0.18, 0.08, 0.18);
    solids.push({ x: 0, y: 1.1, z: 0, w: 0.3, h: 2.2, d: 0.3 });
  } else if (id === 'garden_bench') {
    part(g, box, MATS.benchTop, 0, 0.42, 0.04, 0.92, 0.07, 0.36); // the seat, facing the camera
    part(g, box, MATS.rail, 0, 0.7, -0.14, 0.92, 0.2, 0.05); // the back
    for (const x of [-0.4, 0.4]) {
      part(g, box, MATS.post, x, 0.2, 0.16, 0.07, 0.4, 0.07);
      part(g, box, MATS.post, x, 0.4, -0.14, 0.07, 0.8, 0.07);
    }
    solids.push({ x: 0, y: 0.25, z: 0, w: 0.92, h: 0.5, d: 0.4 });
  } else if (id === 'planter') {
    part(g, box, MATS.stone, 0, 0.22, 0, 0.8, 0.44, 0.8);
    part(g, box, MATS.stoneLight, 0, 0.46, 0, 0.88, 0.06, 0.88);
    part(g, box, MATS.soil, 0, 0.47, 0, 0.7, 0.04, 0.7);
    const r = hash(gx, gz);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + r * 6;
      const d = i ? 0.2 + (i % 2) * 0.08 : 0;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const h = 0.18 + ((r * 10 + i) % 3) * 0.05;
      part(g, box, MATS.leaf, x, 0.49 + h / 2, z, 0.03, h, 0.03);
      part(g, ball, MATS.petals[(i + Math.floor(r * 4)) % 4], x, 0.5 + h, z, 0.12, 0.08, 0.12);
    }
    solids.push({ x: 0, y: 0.25, z: 0, w: 0.8, h: 0.5, d: 0.8 });
  }
  return { group: g, solids };
}

// world: the world the pieces are on (world.js buildWorld)
export function createBuildings(world) {
  const pieces = new Map(); // key -> { id, group, colliders }

  const joins = (gx, gz) => PIECES[pieces.get(keyOf(gx, gz))?.id]?.joins;
  const joinedAt = (gx, gz) => DIRS.filter(([dx, dz]) => joins(gx + dx, gz + dz));

  function undraw(piece) {
    world.root.remove(piece.group);
    for (const c of piece.colliders) world.platforms.splice(world.platforms.indexOf(c), 1);
    piece.group = null;
    piece.colliders = [];
  }

  function draw(key) {
    const piece = pieces.get(key);
    if (!piece) return;
    if (piece.group) undraw(piece);
    const [gx, gz] = gridOf(key);
    const { group, solids } = model(piece.id, gx, gz, PIECES[piece.id].joins ? joinedAt(gx, gz) : []);
    const x = gx * TILE_SIZE;
    const z = gz * TILE_SIZE;
    group.position.set(x, 0, z);
    world.root.add(group);
    piece.group = group;
    piece.colliders = solids.map((s) => {
      const c = {
        center: new THREE.Vector3(x + s.x, s.y, z + s.z),
        min: new THREE.Vector3(x + s.x - s.w / 2, s.y - s.h / 2, z + s.z - s.d / 2),
        max: new THREE.Vector3(x + s.x + s.w / 2, s.y + s.h / 2, z + s.z + s.d / 2),
        piece: true,
      };
      world.platforms.push(c);
      return c;
    });
  }

  // fences and walls around a tile, joined up afresh
  function redrawAround(key) {
    const [gx, gz] = gridOf(key);
    for (const [dx, dz] of DIRS) if (joins(gx + dx, gz + dz)) draw(keyOf(gx + dx, gz + dz));
  }

  // ---------- The see-through piece build mode shows where it would go ----------
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8cff7a, transparent: true, opacity: 0.45, depthWrite: false });
  const ghostEdge = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.7, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
    ghostMat
  );
  ghostEdge.position.y = 0.09;
  let ghost = null; // { group, id, key }

  return {
    get: (key) => pieces.get(key)?.id ?? null,
    list: () => [...pieces].map(([key, p]) => [key, p.id]),
    size: () => pieces.size,

    // false: something is built there already, or no such piece
    place(key, id) {
      if (pieces.has(key) || !PIECES[id]) return false;
      pieces.set(key, { id, group: null, colliders: [] });
      draw(key);
      if (PIECES[id].joins) redrawAround(key);
      world.clearFoliageOnTile(key);
      return true;
    },

    // the piece that was there (or null)
    remove(key) {
      const piece = pieces.get(key);
      if (!piece) return null;
      undraw(piece);
      pieces.delete(key);
      if (PIECES[piece.id].joins) redrawAround(key);
      world.restoreFoliage(key);
      return piece.id;
    },

    clear() {
      for (const piece of pieces.values()) undraw(piece);
      pieces.clear();
    },

    // The nearest piece of kind `id` whose tile is within `reach` of pos (its key, or null)
    nearest(id, pos, reach) {
      let best = null;
      let bestD = reach;
      for (const [key, piece] of pieces) {
        if (piece.id !== id) continue;
        const [gx, gz] = gridOf(key);
        const d = Math.hypot(gx * TILE_SIZE - pos.x, gz * TILE_SIZE - pos.z);
        if (d <= bestD) {
          bestD = d;
          best = key;
        }
      }
      return best;
    },

    // night: 0 by day, 1 at night (the lamp posts' glow)
    setNight(night) {
      MATS.lantern.emissiveIntensity = night * 1.6;
    },

    // Show where `id` would go on tile key (null: nowhere), green or red
    // (ok). id 'remove': just the tile's outline.
    preview(key, id, ok) {
      if (!key) {
        if (ghost) ghost.group.visible = false;
        return;
      }
      const [gx, gz] = gridOf(key);
      if (!ghost || ghost.id !== id || ghost.key !== key) {
        if (ghost) world.root.remove(ghost.group);
        const group = id === 'remove' || !PIECES[id]
          ? new THREE.Group()
          : model(id, gx, gz, PIECES[id].joins ? joinedAt(gx, gz) : []).group;
        group.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.material = ghostMat;
          obj.castShadow = false;
        });
        group.add(ghostEdge);
        group.position.set(gx * TILE_SIZE, 0.01, gz * TILE_SIZE);
        world.root.add(group);
        ghost = { group, id, key };
      }
      ghost.group.visible = true;
      ghostMat.color.set(ok ? 0x8cff7a : 0xff6b5a);
    },
  };
}
