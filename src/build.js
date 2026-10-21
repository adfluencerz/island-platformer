import * as THREE from 'three';
import { PIECES, pieceTiles } from '../shared/level.js';
import { TILE_SIZE } from './world.js';
import { chestModel, CHEST_W } from './chest.js';

// ---------- What is built on the farm ----------
// Fences (wood, picket and split rail), box hedges, gates, arches and
// arbors, walls (stone, low stone and palisades), paths and stepping stones,
// blocks to climb (steps, tree stumps, crates and crate stacks, grain sacks,
// log piles, barrels, straw bales and stacks, scaffolds, log towers, stone
// blocks, mossy or not, and pillars), wells, stone lanterns, scarecrows, hay
// carts, beehives, birdbaths, signposts, the workbench and what it makes for the farm, and the farm's chest (PIECES in shared/level.js), one to a tile. Lamp posts light up at night (setNight). This draws them on a world (the farm's), joins each fence and wall
// up with the fences and walls beside it, and gives the solid ones colliders
// in the world's platforms. main.js has build mode: where pieces may go,
// paying for them, and keeping them (in the farm's save, or its room).

const FENCE_H = 1.05; // a hop clears a fence (or a hedge)...
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
  moss: mat(0x6f9a3e),
  mossDark: mat(0x527a30),
  gravel: mat(0xa89f8c),
  water: mat(0x3d7fa8, { roughness: 0.3 }),
  plaster: mat(0xf0e2c4),
  roofTile: mat(0xa8492f),
  roofDark: mat(0x83361f),
  window: mat(0xffe7a3, { emissive: 0xffb84a, emissiveIntensity: 0 }), // (the house's, lit at night with the lamps)
  hedge: mat(0x3f7f34),
  hedgeLight: mat(0x5a9a42),
  hedgeDark: mat(0x2f6128),
  cloth: mat(0xb5483a),
  clothDark: mat(0x8a3229),
  sack: mat(0xd9c08a),
  sackDark: mat(0xbfa26c),
  crow: mat(0x26262c),
  beak: mat(0xe0a23a),
  picket: mat(0xe6d6b4),
  picketDark: mat(0xc4b28e),
  bee: mat(0xf2c230),
  hole: mat(0x2a1a0e),
  bird: mat(0x8a5a3a),
  birdBreast: mat(0xd99a6a),
  petals: [mat(0xe0475b), mat(0xffd84a), mat(0xf28ad8), mat(0xffffff)],
};
const ball = new THREE.IcosahedronGeometry(0.5, 0);
const box = new THREE.BoxGeometry(1, 1, 1);
const flag = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const log = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const shaft = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const tip = new THREE.ConeGeometry(0.5, 1, 8);
const barrel = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const pyramid = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4); // a square base 1 across
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- The house ----------
// 5 tiles across and 4 deep (PIECES.house.size), built from the middle of its
// front row: the door is on that tile, facing the camera, and the rest of the
// house stands behind it. A cottage: a stone footing, timber-framed walls, a
// gabled roof of red tiles with a chimney, and windows that light up at night.
const HOUSE_W = 4.7; // the walls (the tiles are 5 by 4)
const HOUSE_D = 3.7;
const HOUSE_Z = -1.5; // the middle of the house, from the middle of the door's tile
const FOOT_H = 0.3;
const WALL_TOP = FOOT_H + 2.2;
const RIDGE = 1.5; // from the wall tops up to the roof's ridge
const gableShape = new THREE.Shape([new THREE.Vector2(-HOUSE_D / 2, 0), new THREE.Vector2(HOUSE_D / 2, 0), new THREE.Vector2(0, RIDGE)]);
const gable = new THREE.ExtrudeGeometry(gableShape, { depth: HOUSE_W, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-HOUSE_W / 2, 0, 0);

function house(g, solids) {
  const z0 = HOUSE_Z;
  const front = z0 + HOUSE_D / 2;
  part(g, box, MATS.stoneDark, 0, FOOT_H / 2, z0, HOUSE_W + 0.3, FOOT_H, HOUSE_D + 0.3);
  part(g, box, MATS.plaster, 0, (FOOT_H + WALL_TOP) / 2, z0, HOUSE_W, WALL_TOP - FOOT_H, HOUSE_D);
  // the timber frame: a post at each corner and either side of the door, a beam round the top
  for (const x of [-HOUSE_W / 2, HOUSE_W / 2]) {
    for (const z of [z0 - HOUSE_D / 2, front]) part(g, box, MATS.bark, x, (FOOT_H + WALL_TOP) / 2, z, 0.2, WALL_TOP - FOOT_H, 0.2);
  }
  for (const x of [-0.65, 0.65]) part(g, box, MATS.bark, x, (FOOT_H + WALL_TOP) / 2, front + 0.02, 0.16, WALL_TOP - FOOT_H, 0.06);
  part(g, box, MATS.bark, 0, WALL_TOP - 0.08, front + 0.03, HOUSE_W + 0.1, 0.16, 0.06);
  part(g, box, MATS.bark, 0, FOOT_H + 0.08, front + 0.03, HOUSE_W + 0.1, 0.16, 0.06);
  // the roof: the gables, and two slopes of tiles meeting at the ridge
  part(g, gable, MATS.plaster, 0, WALL_TOP, z0, 1, 1, 1);
  const slope = Math.atan2(RIDGE, HOUSE_D / 2);
  const run = Math.hypot(RIDGE, HOUSE_D / 2) + 0.45;
  for (const s of [1, -1]) {
    const a = s * slope;
    const y = WALL_TOP + RIDGE / 2 + 0.1;
    const z = z0 + s * (HOUSE_D / 4 + 0.1);
    part(g, box, MATS.roofTile, 0, y, z, HOUSE_W + 0.6, 0.16, run).rotation.x = a;
    // rows of tiles: darker lines across the slope (along it from its middle, on top of it)
    for (const t of [-0.3, 0, 0.3]) {
      const along = t * run;
      const row = part(g, box, MATS.roofDark, 0, y + 0.09 * Math.cos(a) - along * Math.sin(a), z + 0.09 * Math.sin(a) + along * Math.cos(a), HOUSE_W + 0.62, 0.04, 0.07);
      row.rotation.x = a;
      row.castShadow = false;
    }
  }
  part(g, box, MATS.roofDark, 0, WALL_TOP + RIDGE + 0.12, z0, HOUSE_W + 0.65, 0.14, 0.24); // the ridge
  // the chimney, at the back on the right
  part(g, box, MATS.stone, 1.4, WALL_TOP + RIDGE * 0.55, z0 - 0.75, 0.55, RIDGE * 1.3 + 0.5, 0.55);
  part(g, box, MATS.stoneDark, 1.4, WALL_TOP + RIDGE * 1.2 + 0.32, z0 - 0.75, 0.65, 0.14, 0.65);
  // the door, a step up to it, and a lamp over it
  part(g, box, MATS.plankB, 0, FOOT_H + 0.78, front + 0.04, 0.9, 1.56, 0.06);
  for (const x of [-0.22, 0, 0.22]) part(g, box, MATS.plankA, x, FOOT_H + 0.78, front + 0.075, 0.18, 1.5, 0.02).castShadow = false;
  part(g, box, MATS.iron, 0.3, FOOT_H + 0.78, front + 0.1, 0.07, 0.07, 0.05);
  part(g, box, MATS.stone, 0, FOOT_H / 2, front + 0.32, 1.2, FOOT_H, 0.36);
  part(g, box, MATS.iron, 0, WALL_TOP - 0.38, front + 0.12, 0.08, 0.08, 0.2);
  part(g, box, MATS.lantern, 0, WALL_TOP - 0.52, front + 0.2, 0.2, 0.24, 0.2).castShadow = false;
  // windows: two at the front with flower boxes under them, one on each side
  const pane = (x, y, z, sideways) => {
    part(g, box, MATS.bark, x, y, z, sideways ? 0.08 : 0.86, 0.76, sideways ? 0.86 : 0.08);
    part(g, box, MATS.window, x + (sideways ? Math.sign(x) * 0.02 : 0), y, z + (sideways ? 0 : 0.02), sideways ? 0.06 : 0.66, 0.56, sideways ? 0.66 : 0.06).castShadow = false;
    part(g, box, MATS.bark, x + (sideways ? Math.sign(x) * 0.04 : 0), y, z + (sideways ? 0 : 0.04), sideways ? 0.03 : 0.05, 0.56, sideways ? 0.05 : 0.03);
    part(g, box, MATS.bark, x + (sideways ? Math.sign(x) * 0.04 : 0), y, z + (sideways ? 0 : 0.04), sideways ? 0.03 : 0.66, 0.05, sideways ? 0.66 : 0.03);
  };
  for (const x of [-1.55, 1.55]) {
    pane(x, FOOT_H + 1.3, front, false);
    part(g, box, MATS.crateDark, x, FOOT_H + 0.8, front + 0.14, 0.8, 0.18, 0.22);
    for (let i = 0; i < 4; i++) part(g, ball, MATS.petals[(i + (x > 0 ? 2 : 0)) % 4], x - 0.27 + i * 0.18, FOOT_H + 0.94, front + 0.14, 0.14, 0.12, 0.14);
  }
  for (const x of [-HOUSE_W / 2, HOUSE_W / 2]) pane(x, FOOT_H + 1.3, z0, true);
  solids.push({ x: 0, y: WALL_TOP / 2, z: z0, w: HOUSE_W + 0.3, h: WALL_TOP, d: HOUSE_D + 0.3 });
}

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

// A wood crate `h` tall and `w` across, its bottom at y0: a frame around
// each side with a board corner to corner across it, and a lid
function crate(g, y0, h, w) {
  part(g, box, MATS.crate, 0, y0 + h / 2, 0, w, h, w);
  const slope = Math.atan2(h - 0.2, w - 0.2);
  const len = Math.hypot(h - 0.2, w - 0.2) + 0.1;
  for (const [fx, fz] of DIRS) {
    const along = fz ? [w + 0.02, 0.12] : [0.12, w + 0.02];
    for (const y of [0.06, h - 0.06]) part(g, box, MATS.crateDark, fx * 0.47, y0 + y, fz * 0.47, fz ? along[0] : 0.04, 0.12, fz ? 0.04 : along[1]);
    const diag = part(g, box, MATS.crateDark, fx * 0.485, y0 + h / 2, fz * 0.485, fz ? len : 0.03, 0.1, fz ? 0.03 : len);
    if (fz) diag.rotation.z = fz * slope;
    else diag.rotation.x = -fx * slope;
  }
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) part(g, box, MATS.crateDark, x, y0 + h / 2, z, 0.14, h, 0.14);
  part(g, box, MATS.plankA, 0, y0 + h + 0.005, 0, w - 0.16, 0.01, w - 0.16).castShadow = false;
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
  } else if (id === 'rail_fence') {
    // a squat post, and three split rails to each fence or wall it joins,
    // resting a little unevenly, as if cut by hand
    const r = hash(gx, gz);
    part(g, box, MATS.bark, 0, 0.47, 0, 0.2, 0.94, 0.2);
    part(g, box, MATS.endGrain, 0, 0.95, 0, 0.16, 0.02, 0.16).castShadow = false;
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.3, h: FENCE_H, d: 0.3 });
    for (const [dx, dz] of joined) {
      [0.24, 0.52, 0.8].forEach((y, i) => {
        const sag = ((r * 10 + i + dx + dz * 2 + 6) % 3) * 0.015;
        const rail = part(g, flag, i % 2 ? MATS.plankB : MATS.rail, dx * 0.27, y - sag, dz * 0.27, 0.09, 0.56, 0.09);
        if (dx) rail.rotation.z = Math.PI / 2;
        else rail.rotation.x = Math.PI / 2;
      });
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.2, h: FENCE_H, d: dz ? 0.5 : 0.2 });
    }
  } else if (id === 'box_hedge') {
    // a clipped hedge: a bush in the middle of the tile, grown on to each
    // fence, wall or hedge it joins, with tufts of new growth on top
    const r = hash(gx, gz);
    const h = FENCE_H - 0.1;
    part(g, box, MATS.hedge, 0, h / 2, 0, 0.62, h, 0.62);
    part(g, box, MATS.hedgeDark, 0, 0.08, 0, 0.66, 0.16, 0.66).castShadow = false;
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.62, h: FENCE_H, d: 0.62 });
    const tufts = [[0, 0]];
    for (const [dx, dz] of joined) {
      part(g, box, MATS.hedge, dx * 0.25, h / 2, dz * 0.25, dx ? 0.5 : 0.56, h, dz ? 0.5 : 0.56);
      part(g, box, MATS.hedgeDark, dx * 0.25, 0.08, dz * 0.25, dx ? 0.5 : 0.6, 0.16, dz ? 0.5 : 0.6).castShadow = false;
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.56, h: FENCE_H, d: dz ? 0.5 : 0.56 });
      tufts.push([dx * 0.3, dz * 0.3]);
    }
    tufts.forEach(([x, z], i) => {
      for (let j = 0; j < 2; j++) {
        const o = ((r * 10 + i * 3 + j * 5) % 3 - 1) * 0.12;
        const k = 0.2 + ((r * 7 + i + j) % 2) * 0.06;
        part(g, ball, j ? MATS.hedgeLight : MATS.hedge, x + (z ? o : 0) + (j ? 0.08 : -0.08) * (x ? 0 : 1), h, z + (x ? o : 0), k, k * 0.6, k).castShadow = false;
      }
    });
  } else if (id === 'picket_fence') {
    // pale pickets with pointed tops on two rails, a post in the middle of
    // the tile and a run of pickets to each fence, hedge or wall it joins
    part(g, box, MATS.picketDark, 0, (FENCE_H + 0.05) / 2, 0, 0.16, FENCE_H + 0.05, 0.16);
    part(g, pyramid, MATS.picketDark, 0, FENCE_H + 0.1, 0, 0.16, 0.1, 0.16);
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.3, h: FENCE_H, d: 0.3 });
    for (const [dx, dz] of joined) {
      for (const y of [0.3, 0.72]) part(g, box, MATS.picketDark, dx * 0.25, y, dz * 0.25, dx ? 0.5 : 0.05, 0.08, dz ? 0.5 : 0.05);
      for (const o of [0.2, 0.36]) {
        const h = FENCE_H - 0.15;
        part(g, box, MATS.picket, dx * o, h / 2, dz * o, dx ? 0.1 : 0.03, h, dz ? 0.1 : 0.03);
        part(g, pyramid, MATS.picket, dx * o, h + 0.05, dz * o, dx ? 0.1 : 0.03, 0.1, dz ? 0.1 : 0.03);
      }
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.2, h: FENCE_H, d: dz ? 0.5 : 0.2 });
    }
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
  } else if (id === 'cobble_path') {
    // small round cobbles packed close in rows, each a little different, on
    // a bed of darker grit
    const r = hash(gx, gz);
    part(g, box, MATS.stoneDark, 0, 0.015, 0, 0.94, 0.02, 0.94).castShadow = false;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const j = (r * 97 + row * 0.37 + col * 0.61) % 1;
        const x = (col - 2) * 0.185 + (row % 2 ? 0.045 : -0.045);
        if (Math.abs(x) > 0.42) continue;
        const k = 0.15 + j * 0.03;
        const cobble = part(g, flag, j < 0.5 ? MATS.stone : MATS.stoneLight, x, 0.035 + j * 0.01, (row - 2) * 0.185, k, 0.045, k);
        cobble.rotation.y = j * 6;
        cobble.castShadow = false;
      }
    }
  } else if (id === 'stepping_stones') {
    // three round flat stones across the grass, a stride apart, set a
    // little differently on every tile
    const r = hash(gx, gz);
    const flip = r < 0.5 ? 1 : -1;
    [[-0.26, -0.24, 0.36], [0.06, 0.04, 0.4], [0.28, 0.3, 0.32]].forEach(([x, z, k], i) => {
      const s = k * (0.92 + ((r * (i + 5) * 11) % 0.16));
      const stone = part(g, flag, i % 2 ? MATS.stoneLight : MATS.stone, x * flip, 0.03, z, s, 0.05, s * 0.86);
      stone.rotation.y = r * 6 + i * 1.3;
      stone.castShadow = false;
      const rim = part(g, flag, MATS.stoneDark, x * flip, 0.012, z, s + 0.04, 0.02, s * 0.86 + 0.04);
      rim.rotation.y = stone.rotation.y;
      rim.castShadow = false;
    });
  } else if (id === 'gravel_path') {
    // a bed of raked gravel, with pebbles scattered over it a little
    // differently on every tile
    const r = hash(gx, gz);
    part(g, box, MATS.gravel, 0, 0.015, 0, 0.96, 0.02, 0.96).castShadow = false;
    for (let i = 0; i < 12; i++) {
      const j = (r * 131 + i * 0.618) % 1;
      const a = i * 2.4 + r * 6;
      const d = 0.08 + ((j * 7) % 1) * 0.34;
      const k = 0.05 + j * 0.05;
      const pebble = part(g, ball, i % 3 ? MATS.stone : i % 2 ? MATS.stoneLight : MATS.stoneDark, Math.cos(a) * d, 0.03, Math.sin(a) * d, k, k * 0.6, k);
      pebble.castShadow = false;
    }
  } else if (id === 'wood_arbor') {
    // an arbor over the way through: a pair of posts either side, along the
    // fences or walls it joins (across the tile on its own), beams and
    // rafters overhead, and a vine climbing it with a few flowers. Like a
    // gate it's walked through, so no colliders
    const [ax, az] = joined.some(([dx]) => dx) || !joined.length ? [1, 0] : [0, 1];
    const top = 2.1;
    const r = hash(gx, gz);
    // a spot o along the fence line and t across the way through
    const at = (o, t) => [ax * o + az * t, az * o + ax * t];
    const leaf = (x, y, z, k, i) => {
      part(g, ball, MATS.leaf, x, y, z, k, k * 0.8, k);
      if ((i + Math.floor(r * 5)) % 3 === 0) part(g, ball, MATS.petals[(i + Math.floor(r * 4)) % 4], x, y + k * 0.35, z, 0.09, 0.06, 0.09);
    };
    for (const s of [-1, 1]) {
      for (const t of [-1, 1]) {
        const [x, z] = at(s * 0.4, t * 0.3);
        part(g, box, MATS.post, x, top / 2, z, 0.12, top, 0.12);
        for (let i = 0; i < 3; i++) leaf(x, 0.45 + i * 0.55 + ((r * 10 + i + s + t + 6) % 2) * 0.12, z, 0.2, i + s + t + 2);
      }
      // a beam along the fence line over each pair of posts
      const [x, z] = at(0, s * 0.3);
      part(g, box, MATS.rail, x, top, z, ax ? 1.04 : 0.1, 0.12, az ? 1.04 : 0.1);
    }
    [-0.39, -0.13, 0.13, 0.39].forEach((o) => {
      const [x, z] = at(o, 0);
      part(g, box, MATS.plankB, x, top + 0.1, z, ax ? 0.07 : 0.92, 0.08, az ? 0.07 : 0.92);
    });
    for (let i = 0; i < 6; i++) {
      const [x, z] = at(-0.45 + i * 0.18, i % 2 ? 0.3 : -0.3);
      leaf(x, top + 0.06, z, 0.18, i);
    }
  } else if (id === 'stone_arch') {
    // two stone piers along the walls it joins (across the tile on its own),
    // and an arch of stones over the way through, with a keystone at the top.
    // Like a gate it's walked through, so no colliders
    const [ax, az] = joined.some(([dx]) => dx) || !joined.length ? [1, 0] : [0, 1];
    const pierH = WALL_H + 0.1;
    for (const s of [-1, 1]) {
      const o = s * 0.39;
      part(g, box, MATS.stone, ax * o, pierH / 2, az * o, ax ? 0.22 : 0.5, pierH, az ? 0.22 : 0.5);
      part(g, box, MATS.stoneDark, ax * o, 0.12, az * o, ax ? 0.26 : 0.56, 0.24, az ? 0.26 : 0.56);
      part(g, box, MATS.stoneDark, ax * o, WALL_H * 0.48, az * o, ax ? 0.24 : 0.52, 0.08, az ? 0.24 : 0.52);
    }
    // the arch: voussoirs round a half circle from pier to pier
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * (i + 0.5)) / n;
      const along = Math.cos(a) * 0.36;
      const stone = part(g, box, i === (n - 1) / 2 ? MATS.stoneLight : MATS.stone, ax * along, pierH - 0.1 + Math.sin(a) * 0.3, az * along, ax ? 0.17 : 0.48, 0.14, az ? 0.17 : 0.48);
      if (ax) stone.rotation.z = a - Math.PI / 2;
      else stone.rotation.x = -(a - Math.PI / 2);
    }
    part(g, box, MATS.stoneLight, 0, pierH + 0.26, 0, ax ? 1 : 0.56, 0.1, az ? 1 : 0.56);
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
      crate(g, 0, h, w);
    } else if (id === 'crate_stack') {
      // a big crate with a low one on top, set down a little askew, and a
      // coil of rope on the lid
      const r = hash(gx, gz);
      crate(g, 0, h - 0.45, w);
      const top = new THREE.Group();
      crate(top, h - 0.45, 0.45, w);
      top.rotation.y = (r - 0.5) * 0.06;
      g.add(top);
      const coil = part(g, barrel, MATS.twine, -0.2 + r * 0.4, h + 0.03, 0.15 - r * 0.3, 0.3, 0.05, 0.3);
      coil.castShadow = false;
      part(g, barrel, MATS.plankB, coil.position.x, h + 0.035, coil.position.z, 0.14, 0.05, 0.14).castShadow = false;
    } else if (id === 'tree_stump') {
      // a sawn-off stump in its bark, roots spreading into the ground, and
      // its rings on top
      const r = hash(gx, gz);
      part(g, log, MATS.bark, 0, h / 2, 0, 0.9, h, 0.9);
      [[0.8, MATS.endGrain], [0.6, MATS.crate], [0.44, MATS.endGrain], [0.26, MATS.crate], [0.1, MATS.endGrain]].forEach(([k, m], i) => {
        part(g, log, m, 0, h + 0.004 + i * 0.002, 0, k, 0.008, k).castShadow = false;
      });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + r * 6;
        const root = part(g, box, MATS.bark, Math.cos(a) * 0.42, 0.07, Math.sin(a) * 0.42, 0.18, 0.16, 0.34);
        root.rotation.y = -a + Math.PI / 2;
        root.rotation.x = 0.35;
      }
    } else if (id === 'grain_sacks') {
      // plump sacks of flax seed, two lying along the tile and two across
      // them on top, each tied at the neck, over a dark core so no light
      // shows between them
      const r = hash(gx, gz);
      part(g, box, MATS.twine, 0, h / 2 - 0.04, 0, w - 0.3, h - 0.2, w - 0.3);
      const sack = (x, y, z, along, i) => {
        const turn = (m) => {
          if (along) m.rotation.z = Math.PI / 2;
          else m.rotation.x = Math.PI / 2;
          return m;
        };
        const [ax, az] = along ? [1, 0] : [0, 1];
        const mat = i % 2 ? MATS.sack : MATS.sackDark;
        turn(part(g, barrel, mat, x, y, z, along ? 0.44 : 0.48, 0.66, along ? 0.48 : 0.44));
        for (const s of [-1, 1]) part(g, ball, mat, x + ax * s * 0.33, y, z + az * s * 0.33, along ? 0.28 : 0.46, 0.42, along ? 0.46 : 0.28);
        turn(part(g, barrel, MATS.twine, x + ax * 0.46, y + 0.02, z + az * 0.46, 0.12, 0.05, 0.12)).castShadow = false;
        part(g, ball, mat, x + ax * 0.5, y + 0.04, z + az * 0.5, 0.12, 0.12, 0.12).castShadow = false;
      };
      const flip = r < 0.5;
      for (const s of [-1, 1]) {
        sack(flip ? s * 0.24 : 0, 0.22, flip ? 0 : s * 0.24, !flip, s + 1);
        sack(flip ? 0 : s * 0.24, 0.66, flip ? s * 0.24 : 0, flip, s + 2);
      }
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
    } else if (id === 'straw_stack') {
      // bales lying three high, each course turned across the one below,
      // with the twine showing on every one
      const r = hash(gx, gz);
      const course = h / 3;
      for (let i = 0; i < 3; i++) {
        const y = course * i;
        const off = ((r * 10 + i * 3) % 3 - 1) * 0.015;
        part(g, box, i % 2 ? MATS.strawDark : MATS.straw, off, y + course / 2, -off, w, course - 0.01, w);
        for (const o of [-0.24, 0.24]) {
          part(g, box, MATS.twine, i % 2 ? 0 : o, y + course / 2, i % 2 ? o : 0, i % 2 ? w + 0.02 : 0.04, course + 0.005, i % 2 ? 0.04 : w + 0.02).castShadow = false;
        }
      }
      for (let i = 0; i < 6; i++) {
        const a = i * 1.9 + r * 6;
        part(g, box, MATS.strawDark, Math.cos(a) * 0.3, h + 0.01, Math.sin(a) * 0.3, 0.26, 0.015, 0.03).rotation.y = a;
      }
    } else if (id === 'log_tower') {
      // a crib of logs laid two by two, each pair across the pair below, like
      // a log cabin's corners, over a dark core, with a plank deck on top
      part(g, box, MATS.crateDark, 0, (h - 0.1) / 2, 0, w - 0.22, h - 0.1, w - 0.22);
      const r = hash(gx, gz);
      const layers = 8;
      const step = (h - 0.08) / layers;
      for (let i = 0; i < layers; i++) {
        const y = step * (i + 0.5);
        const k = step + 0.02;
        for (const s of [-1, 1]) {
          const len = w + 0.04 + ((r * 10 + i) % 2) * 0.04;
          const lg = part(g, log, MATS.bark, i % 2 ? s * 0.38 : 0, y, i % 2 ? 0 : s * 0.38, k, len, k);
          if (i % 2) lg.rotation.x = Math.PI / 2;
          else lg.rotation.z = Math.PI / 2;
        }
      }
      part(g, box, MATS.plankA, 0, h - 0.04, 0, w, 0.08, w);
      [-0.24, 0, 0.24].forEach((o) => part(g, box, MATS.plankB, o, h + 0.005, 0, 0.02, 0.01, w - 0.04).castShadow = false);
    } else if (id === 'mossy_stone_block') {
      // old stone grown over with moss: a cushion of it on top, spilling
      // down the sides in patches
      const r = hash(gx, gz);
      part(g, box, r < 0.5 ? MATS.stone : MATS.stoneDark, 0, h / 2, 0, w, h, w);
      part(g, box, MATS.stoneDark, 0, Math.min(0.1, h / 4), 0, w + 0.02, Math.min(0.2, h / 2), w + 0.02);
      for (const [fx, fz] of DIRS) part(g, box, MATS.stoneDark, fx * 0.485, h / 2, fz * 0.485, fz ? w : 0.03, 0.05, fz ? 0.03 : w);
      part(g, box, MATS.moss, 0, h, 0, w - 0.02, 0.04, w - 0.02);
      for (const [fx, fz] of DIRS) {
        for (let i = 0; i < 2; i++) {
          const o = ((r * 10 + i * 3 + fx + fz * 2 + 6) % 3 - 1) * 0.25;
          const len = 0.2 + ((r * 7 + i * 0.4) % 1) * 0.35;
          part(g, box, i ? MATS.mossDark : MATS.moss, fx * 0.485 + fz * o, h - len / 2, fz * 0.485 + fx * o, fz ? 0.24 : 0.03, len, fz ? 0.03 : 0.24).castShadow = false;
        }
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
  } else if (id === 'stone_well') {
    // a ring of stones round dark water, two posts holding a little plank
    // roof, and a bucket hanging on its rope from the crank
    const r = hash(gx, gz);
    part(g, barrel, MATS.stoneDark, 0, 0.27, 0, 0.7, 0.54, 0.7);
    part(g, barrel, MATS.water, 0, 0.55, 0, 0.68, 0.02, 0.68).castShadow = false;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const stone = part(g, box, (i + Math.floor(r * 10)) % 3 ? MATS.stone : MATS.stoneLight, Math.cos(a) * 0.38, 0.33, Math.sin(a) * 0.38, 0.16, 0.66 - ((i + Math.floor(r * 10)) % 2) * 0.04, 0.27);
      stone.rotation.y = -a;
    }
    for (const s of [-1, 1]) part(g, box, MATS.post, s * 0.42, 0.85, 0, 0.1, 1.7, 0.1);
    part(g, box, MATS.post, 0, 1.72, 0, 0.94, 0.08, 0.1);
    for (const s of [-1, 1]) {
      const roof = part(g, box, s < 0 ? MATS.plankA : MATS.plankB, 0, 1.85, s * 0.2, 1.1, 0.05, 0.5);
      roof.rotation.x = s * 0.6;
    }
    part(g, box, MATS.plankB, 0, 1.99, 0, 1.12, 0.06, 0.08);
    // the crank, the rope and the bucket
    part(g, log, MATS.post, 0, 1.25, 0, 0.07, 0.84, 0.07).rotation.z = Math.PI / 2;
    part(g, box, MATS.iron, 0.5, 1.18, 0, 0.03, 0.16, 0.03);
    part(g, box, MATS.post, 0.54, 1.1, 0, 0.1, 0.04, 0.04);
    part(g, box, MATS.twine, 0, 1.08, 0, 0.02, 0.34, 0.02).castShadow = false;
    part(g, barrel, MATS.stave, 0, 0.84, 0, 0.18, 0.16, 0.18);
    part(g, barrel, MATS.iron, 0, 0.86, 0, 0.19, 0.03, 0.19).castShadow = false;
    solids.push({ x: 0, y: 1, z: 0, w: 0.92, h: 2, d: 0.92 });
  } else if (id === 'stone_lantern') {
    // a garden lantern of stone: a post on a base, a little firebox with a
    // light in it that comes on at night (like the lamp posts), and a
    // square roof with a knob on top
    const r = hash(gx, gz);
    const light = r < 0.5 ? MATS.stone : MATS.stoneLight;
    part(g, box, MATS.stoneDark, 0, 0.08, 0, 0.62, 0.16, 0.62);
    part(g, box, MATS.stone, 0, 0.2, 0, 0.48, 0.08, 0.48);
    part(g, shaft, light, 0, 0.5, 0, 0.26, 0.56, 0.26);
    part(g, box, MATS.stone, 0, 0.83, 0, 0.56, 0.1, 0.56);
    part(g, box, MATS.lantern, 0, 1.03, 0, 0.3, 0.3, 0.3).castShadow = false;
    for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) part(g, box, light, x, 1.03, z, 0.08, 0.3, 0.08);
    part(g, box, MATS.stoneDark, 0, 1.2, 0, 0.44, 0.06, 0.44);
    part(g, pyramid, light, 0, 1.36, 0, 0.74, 0.28, 0.74);
    part(g, ball, MATS.stoneDark, 0, 1.54, 0, 0.14, 0.14, 0.14);
    solids.push({ x: 0, y: 0.8, z: 0, w: 0.6, h: 1.6, d: 0.6 });
  } else if (id === 'scarecrow') {
    // a post with a crossbar, an old red shirt with straw poking out of
    // its sleeves, a sacking head under a straw hat, all facing the camera;
    // on some farms a crow has come to sit on its arm anyway
    const r = hash(gx, gz);
    part(g, box, MATS.bark, 0, 0.9, 0, 0.1, 1.8, 0.1);
    part(g, box, MATS.bark, 0, 1.28, 0, 0.88, 0.08, 0.08);
    part(g, box, MATS.cloth, 0, 1.1, 0.02, 0.44, 0.52, 0.24);
    part(g, box, MATS.clothDark, 0.1, 1.0, 0.145, 0.12, 0.12, 0.01).castShadow = false; // a patch
    part(g, box, MATS.twine, 0, 0.86, 0.02, 0.46, 0.05, 0.26).castShadow = false; // a rope belt
    for (const s of [-1, 1]) {
      part(g, box, MATS.cloth, s * 0.31, 1.27, 0.02, 0.2, 0.17, 0.17);
      for (let i = 0; i < 3; i++) {
        const tuft = part(g, box, i % 2 ? MATS.strawDark : MATS.straw, s * 0.45, 1.27 + (i - 1) * 0.05, 0.02, 0.12, 0.03, 0.05);
        tuft.rotation.z = s * (i - 1) * 0.5;
      }
    }
    for (let i = 0; i < 3; i++) part(g, box, MATS.straw, (i - 1) * 0.1, 0.8, 0.04, 0.04, 0.14, 0.04).castShadow = false;
    part(g, ball, MATS.sack, 0, 1.58, 0.02, 0.36, 0.38, 0.34);
    for (const s of [-1, 1]) part(g, box, MATS.crow, s * 0.07, 1.61, 0.18, 0.05, 0.05, 0.02).castShadow = false; // stitched eyes
    part(g, box, MATS.twine, 0, 1.43, 0.02, 0.2, 0.04, 0.2).castShadow = false; // tied at the neck
    part(g, flag, MATS.straw, 0, 1.72, 0.02, 0.58, 0.03, 0.58);
    part(g, flag, MATS.strawDark, 0, 1.82, 0.02, 0.3, 0.18, 0.3);
    part(g, flag, MATS.cloth, 0, 1.76, 0.02, 0.31, 0.04, 0.31).castShadow = false; // a band round the hat
    if (r < 0.5) {
      const s = r < 0.25 ? -1 : 1;
      part(g, ball, MATS.crow, s * 0.32, 1.4, 0, 0.14, 0.14, 0.2);
      part(g, ball, MATS.crow, s * 0.32, 1.5, 0.08, 0.1, 0.1, 0.1);
      part(g, tip, MATS.beak, s * 0.32, 1.5, 0.15, 0.04, 0.07, 0.04).rotation.x = Math.PI / 2;
      part(g, box, MATS.crow, s * 0.32, 1.38, -0.12, 0.08, 0.03, 0.12).rotation.x = -0.4; // its tail
    }
    solids.push({ x: 0, y: 0.9, z: 0, w: 0.3, h: 1.8, d: 0.3 });
  } else if (id === 'hay_cart') {
    // a two-wheeled farm cart heaped with hay, its shafts resting on the
    // ground, a little differently on every tile
    const r = hash(gx, gz);
    part(g, box, MATS.plankA, 0.06, 0.5, 0, 0.78, 0.08, 0.6);
    for (const s of [-1, 1]) {
      part(g, box, MATS.plankB, 0.06, 0.66, s * 0.3, 0.8, 0.24, 0.05);
      // a wheel of spokes in an iron-shod rim, on the axle under the bed
      const wheel = new THREE.Group();
      part(wheel, barrel, MATS.iron, 0, 0, 0, 0.6, 0.06, 0.6);
      part(wheel, barrel, MATS.stave, 0, 0, 0, 0.5, 0.07, 0.5);
      part(wheel, barrel, MATS.crateDark, 0, 0, 0, 0.12, 0.1, 0.12);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0.12, 0.3, s * 0.38);
      g.add(wheel);
      for (let i = 0; i < 3; i++) part(g, box, MATS.post, 0.12, 0.3, s * 0.41, 0.46, 0.04, 0.02).rotation.z = (i * Math.PI) / 3 + r;
      // a shaft running down to the ground at the front
      part(g, box, MATS.post, -0.36, 0.2, s * 0.2, 0.36, 0.06, 0.06).rotation.z = 0.9;
    }
    part(g, box, MATS.post, 0.12, 0.3, 0, 0.06, 0.06, 0.8); // the axle
    for (const x of [-0.33, 0.45]) part(g, box, MATS.plankB, x, 0.66, 0, 0.05, 0.24, 0.6);
    // the hay, heaped over the sides, with wisps sticking out
    part(g, box, MATS.straw, 0.06, 0.8, 0, 0.74, 0.3, 0.56);
    part(g, ball, MATS.straw, 0.06, 0.96, 0, 0.7, 0.36, 0.5);
    part(g, ball, MATS.strawDark, 0.06 + (r - 0.5) * 0.2, 1.08, 0.02, 0.4, 0.22, 0.32);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.9 + r * 6;
      const wisp = part(g, box, MATS.strawDark, 0.06 + Math.cos(a) * 0.3, 0.92, Math.sin(a) * 0.22, 0.2, 0.02, 0.03);
      wisp.rotation.y = a;
      wisp.rotation.z = 0.3;
      wisp.castShadow = false;
    }
    solids.push({ x: 0, y: 0.55, z: 0, w: 0.9, h: 1.1, d: 0.84 });
  } else if (id === 'beehive') {
    // a straw skep on a little stand, coil on coil, with a dark doorway at
    // the front and a few bees about it
    const r = hash(gx, gz);
    part(g, box, MATS.plankA, 0, 0.36, 0, 0.7, 0.06, 0.7);
    for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) part(g, box, MATS.post, x, 0.17, z, 0.07, 0.34, 0.07);
    const coils = 6;
    for (let i = 0; i < coils; i++) {
      const k = 0.62 * Math.cos((i / coils) * Math.PI * 0.45);
      part(g, flag, i % 2 ? MATS.strawDark : MATS.straw, 0, 0.45 + i * 0.1, 0, k, 0.1, k);
    }
    part(g, ball, MATS.straw, 0, 0.45 + coils * 0.1 - 0.02, 0, 0.36, 0.22, 0.36);
    part(g, box, MATS.hole, 0, 0.47, 0.3, 0.14, 0.08, 0.04).castShadow = false;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + r * 6;
      const x = Math.cos(a) * 0.42;
      const z = Math.sin(a) * 0.3 + 0.22;
      const y = 0.6 + ((r * 10 + i) % 3) * 0.14;
      part(g, ball, MATS.bee, x, y, z, 0.06, 0.05, 0.08).castShadow = false;
      part(g, box, MATS.crow, x, y, z, 0.065, 0.055, 0.02).castShadow = false;
    }
    solids.push({ x: 0, y: 0.5, z: 0, w: 0.7, h: 1, d: 0.7 });
  } else if (id === 'birdbath') {
    // a shallow stone bowl of water on a pillar, and a bird come to drink
    // at some
    const r = hash(gx, gz);
    const light = r < 0.5 ? MATS.stone : MATS.stoneLight;
    part(g, flag, MATS.stoneDark, 0, 0.06, 0, 0.52, 0.12, 0.52);
    part(g, shaft, light, 0, 0.42, 0, 0.2, 0.62, 0.2);
    part(g, shaft, MATS.stoneDark, 0, 0.6, 0, 0.24, 0.04, 0.24).castShadow = false;
    part(g, flag, MATS.stone, 0, 0.74, 0, 0.42, 0.1, 0.42);
    part(g, flag, light, 0, 0.84, 0, 0.72, 0.1, 0.72);
    part(g, flag, MATS.water, 0, 0.895, 0, 0.6, 0.01, 0.6).castShadow = false;
    if (r < 0.6) {
      const a = r * 10;
      const x = Math.cos(a) * 0.33;
      const z = Math.sin(a) * 0.33;
      const bird = new THREE.Group();
      part(bird, ball, MATS.bird, 0, 0.98, 0, 0.12, 0.1, 0.16);
      part(bird, ball, MATS.birdBreast, 0, 0.96, 0.04, 0.09, 0.07, 0.08);
      part(bird, ball, MATS.bird, 0, 1.06, 0.07, 0.08, 0.08, 0.08);
      part(bird, tip, MATS.beak, 0, 1.06, 0.12, 0.025, 0.05, 0.025).rotation.x = Math.PI / 2;
      part(bird, box, MATS.bird, 0, 1.0, -0.1, 0.06, 0.02, 0.1).rotation.x = 0.4; // its tail
      bird.position.set(x, 0, z);
      bird.rotation.y = Math.atan2(-x, -z); // looking into the water
      g.add(bird);
    }
    solids.push({ x: 0, y: 0.45, z: 0, w: 0.5, h: 0.9, d: 0.5 });
  } else if (id === 'signpost') {
    // a post with two arrow boards, pointing off one way and back the other,
    // at a slightly different slant on every tile
    const r = hash(gx, gz);
    part(g, box, MATS.post, 0, 0.8, 0, 0.1, 1.6, 0.1);
    part(g, pyramid, MATS.post, 0, 1.65, 0, 0.12, 0.1, 0.12);
    [[1.38, (r - 0.5) * 0.9], [1.08, Math.PI + (0.5 - r) * 0.9]].forEach(([y, a], i) => {
      const arm = new THREE.Group();
      part(arm, box, i ? MATS.plankB : MATS.plankA, 0.24, 0, 0, 0.42, 0.16, 0.04);
      const point = part(arm, box, i ? MATS.plankB : MATS.plankA, 0.45, 0, 0, 0.113, 0.113, 0.04);
      point.rotation.z = Math.PI / 4;
      for (const z of [-0.022, 0.022]) {
        // what is written on it, both sides
        part(arm, box, MATS.crateDark, 0.22, 0.02, z, 0.26, 0.02, 0.005).castShadow = false;
        part(arm, box, MATS.crateDark, 0.2, -0.03, z, 0.2, 0.02, 0.005).castShadow = false;
      }
      arm.position.y = y;
      arm.rotation.y = a;
      g.add(arm);
    });
    solids.push({ x: 0, y: 0.8, z: 0, w: 0.2, h: 1.6, d: 0.2 });
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
  } else if (id === 'farm_chest') {
    // just where it is in the way: the chest itself is chest.js's, which
    // main.js stands on this tile (it opens, and keeps what is in it)
    solids.push({ x: 0, y: 0.4, z: 0, w: CHEST_W, h: 0.8, d: 0.7 });
  } else if (id === 'house') {
    house(g, solids);
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
  const covered = new Map(); // every tile a piece stands on (a house: many) -> the key it was built on

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
    // what stands on tile key (any tile of it), or null
    get: (key) => pieces.get(covered.get(key))?.id ?? null,
    // the piece built on tile key, as drawn (to tap)
    groupOf: (key) => pieces.get(key)?.group ?? null,
    // the tile the piece standing on tile key was built on (null: nothing there)
    anchor: (key) => covered.get(key) ?? null,
    // the tile a piece of kind `id` is built on (the first, for one there is only one of), or null
    find(id) {
      for (const [key, piece] of pieces) if (piece.id === id) return key;
      return null;
    },
    list: () => [...pieces].map(([key, p]) => [key, p.id]),
    size: () => pieces.size,

    // false: something is built there already, or no such piece
    place(key, id) {
      if (!PIECES[id]) return false;
      const tiles = pieceTiles(id, key);
      if (tiles.some((k) => covered.has(k))) return false;
      pieces.set(key, { id, group: null, colliders: [] });
      for (const k of tiles) covered.set(k, key);
      draw(key);
      if (PIECES[id].joins) redrawAround(key);
      for (const k of tiles) world.clearFoliageOnTile(k);
      return true;
    },

    // the piece that was there (or null)
    // (key: any tile it stands on)
    remove(key) {
      key = covered.get(key);
      const piece = pieces.get(key);
      if (!piece) return null;
      undraw(piece);
      pieces.delete(key);
      for (const k of pieceTiles(piece.id, key)) {
        covered.delete(k);
        world.restoreFoliage(k);
      }
      if (PIECES[piece.id].joins) redrawAround(key);
      return piece.id;
    },

    clear() {
      for (const piece of pieces.values()) undraw(piece);
      pieces.clear();
      covered.clear();
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
      MATS.window.emissiveIntensity = night * 1.2;
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
        if (ghost) {
          world.root.remove(ghost.group);
          // (the chest's shapes are its own, not shared like the pieces')
          if (ghost.id === 'farm_chest') ghost.group.traverse((obj) => obj.isMesh && obj !== ghostEdge && obj.geometry.dispose());
        }
        const group = id === 'remove' || !PIECES[id]
          ? new THREE.Group()
          : id === 'farm_chest'
            ? chestModel().root
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
