import * as THREE from 'three';
import { BOSS_IDS, ARENAS, ARENA_R } from '../shared/bosses.js';
import { ROOMS, ROOM_W, DOOR_W, FOE_R, roomRect, gateAt, dungeonExit } from '../shared/dungeons.js';
import { DUNGEONS } from '../shared/balance.js';
import { damp } from './character.js';

// ---------- The bosses' dungeons ----------
// The way to each boss's arena (shared/dungeons.js): ROOMS rooms in a row in
// front of it, on an island of their own out past the sea on the farm's
// world, and a bridge from the last of them into the arena. Each is the
// boss's own: the evil parsnip's a root cellar (earth walls on beams, roots
// hanging down, crates and sacks, lanterns), the super lion's sunbaked ruins
// (sandstone blocks and columns, braziers), the bee queen's honeycomb halls
// (walls of wax cells, some full of glowing honey), the giant crow's rookery
// (walls of woven sticks, nests, scarecrows, cold blue lanterns) and the bog
// toad's sunken bog (mossy stones, puddles and lily pads, reeds, glowing
// toadstools, fireflies). The side walls are tall; the ones across, between
// the rooms, are drawn low so the camera sees over them (they stop a farmer
// all the same), with a gate in the middle that sinks into the floor once
// its room's foes are all down. The way home stands by where farmers come in.
//
// The foes are drawn here too, each dungeon's own kind: sproutlings (little
// angry parsnips), lion cubs, worker bees, rooks and bog frogs, posed from
// what they are up to (closing in, winding up, going for someone, reeling
// from a bop), and gone in a puff when bopped down.
//
// The walls and floors go in the world's platforms, like the arenas'
// (src/arena.js). What doesn't move is drawn a few instanced meshes to a
// dungeon, and a dungeon is only drawn while we are in it or its arena.

const T = 0.6; // a wall's thickness
const WALL_H = 3.5; // (what stops a farmer: a little over a jump)
const SIDE_H = 2.6; // the side walls, as drawn
const MID_H = 1.3; // the walls across, between the rooms (low: the camera looks over them)
const GATE_H = 1.6;
const SINK_TIME = 0.7; // seconds a gate takes to sink into the floor

const mats = new Map();
const mat = (color, extra = {}) => {
  const key = `${color}:${JSON.stringify(extra)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
  return mats.get(key);
};
const glow = (color, k = 1) => mat(color, { emissive: color, emissiveIntensity: k });
const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(0.5, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const hex = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const cone = new THREE.ConeGeometry(0.5, 1, 8);
const disc = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const shadowGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });

function part(parent, geo, material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// What doesn't move, gathered up and drawn an instanced mesh to each shape
// and material: add() as part() does, then done()
function createBatch(parent) {
  const lists = new Map();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    add(geo, material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
      const key = `${geo.uuid}:${material.uuid}`;
      if (!lists.has(key)) lists.set(key, { geo, material, list: [] });
      lists.get(key).list.push(m.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(w, h, d)).clone());
    },
    done() {
      for (const { geo, material, list } of lists.values()) {
        const mesh = new THREE.InstancedMesh(geo, material, list.length);
        list.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // (spread far from its middle; a dungeon is only drawn while we are by it)
        parent.add(mesh);
      }
    },
  };
}

// a little random, the same every time (a dungeon looks the same on every page)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Each dungeon's look ----------
// floor, floor2: the floor and what is about on it; wall, wall2: its walls;
// trim: posts, beams, edging; light: its lamps' glow; swirl: the way home's
// (as its arena's); gate: the gate's bars
const THEMES = {
  parsnip: { floor: 0x6b4a2e, floor2: 0xd9b45a, wall: 0x5a3d25, wall2: 0x4a3220, trim: 0x8a5a32, light: 0xffc85a, swirl: [0x6a2f94, 0xd9a8ff], gate: 0x7a4f28, band: 0x3a3632 },
  lion: { floor: 0xe8d39a, floor2: 0xd9b77a, wall: 0xd9b77a, wall2: 0xc9a464, trim: 0xe8cf94, light: 0xff9a3a, swirl: [0xb8561a, 0xffd08a], gate: 0xc9a464, band: 0xe0a82e },
  bee: { floor: 0xf2c860, floor2: 0xe8b23a, wall: 0xb8801a, wall2: 0xf7d77a, trim: 0x8a5a12, light: 0xffb020, swirl: [0xc99a10, 0xfff0a0], gate: 0xf7d77a, band: 0xe8a820 },
  crow: { floor: 0x3f3a33, floor2: 0x2a2826, wall: 0x4a3a2a, wall2: 0x6b5a42, trim: 0x2f2a24, light: 0xa8c0ff, swirl: [0x2f3f8a, 0xa8c0ff], gate: 0x5a4a36, band: 0x2f2a24 },
  toad: { floor: 0x4a5a3a, floor2: 0x2f6a5a, wall: 0x5a6a52, wall2: 0x4a5a44, trim: 0x6f9a3e, light: 0x9fe870, swirl: [0x1f7a6a, 0x9ff0d0], gate: 0x5a4a30, band: 0x6f9a3e },
};

// world: the farm's (world.js buildWorld)
export function createDungeons(world) {
  const root = new THREE.Group();
  root.name = 'boss-dungeons';
  world.root.add(root);
  const dungeons = new Map(); // id -> { group, gates, foes, swirl, flies, shown }

  function solid({ x, y, z, w, h, d }, extra = {}) {
    const aabb = {
      center: new THREE.Vector3(x, y, z),
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ...extra,
    };
    world.platforms.push(aabb);
    return aabb;
  }

  for (const id of BOSS_IDS) build(id, BOSS_IDS.indexOf(id));

  function build(id, n) {
    const th = THEMES[id];
    const rand = seeded(9301 + n * 49297);
    const group = new THREE.Group();
    group.name = `dungeon-${id}`;
    group.visible = false;
    root.add(group);
    const b = createBatch(group);
    const { x: ax, z: az } = ARENAS[id];
    const xL = ax - ROOM_W / 2;
    const xR = ax + ROOM_W / 2;
    const zFar = roomRect(id, ROOMS - 1).z0;
    const zNear = roomRect(id, 0).z1;
    const len = zNear - zFar;
    const midZ = (zFar + zNear) / 2;

    // the island it stands on: earth sides, the floor on top at the ground's height
    b.add(box, mat(th.floor), ax, -0.15, midZ, ROOM_W + 2 * T, 0.3, len + 2 * T);
    b.add(box, mat(0x6b4426), ax, -1.4, midZ, ROOM_W + 2 * T + 0.6, 2.2, len + 2 * T + 0.6);
    solid({ x: ax, y: -0.6, z: midZ, w: ROOM_W + 2 * T, h: 1.2, d: len + 2 * T }, { ground: true });
    // the bridge into the arena, with low rails
    const bridgeFrom = az + ARENA_R - 0.8;
    const bridgeLen = zFar - T / 2 - bridgeFrom;
    const bridgeZ = bridgeFrom + bridgeLen / 2;
    const bw = DOOR_W + 0.8;
    b.add(box, mat(th.trim), ax, -0.12, bridgeZ, bw, 0.24, bridgeLen);
    b.add(box, mat(0x6b4426), ax, -0.9, bridgeZ, bw - 0.3, 1.4, bridgeLen);
    solid({ x: ax, y: -0.6, z: bridgeZ, w: bw, h: 1.2, d: bridgeLen }, { ground: true });
    for (const sx of [-1, 1]) {
      const rx = ax + sx * (bw / 2 + 0.1);
      b.add(box, mat(th.trim), rx, 0.3, bridgeZ, 0.2, 0.6, bridgeLen);
      solid({ x: rx, y: WALL_H / 2, z: bridgeZ, w: 0.2, h: WALL_H, d: bridgeLen });
    }

    // the side walls, tall, and the near wall, low (the camera looks in over it)
    for (const sx of [-1, 1]) {
      const wx = ax + sx * (ROOM_W / 2 + T / 2);
      sideWall(b, th, id, rand, wx, sx, zFar - T / 2, zNear + T / 2);
      solid({ x: wx, y: WALL_H / 2, z: midZ, w: T, h: WALL_H, d: len + 2 * T });
    }
    b.add(box, mat(th.wall), ax, 0.25, zNear + T / 2, ROOM_W + 2 * T, 0.5, T);
    b.add(box, mat(th.trim), ax, 0.53, zNear + T / 2, ROOM_W + 2 * T, 0.08, T + 0.06);
    solid({ x: ax, y: WALL_H / 2, z: zNear + T / 2, w: ROOM_W + 2 * T, h: WALL_H, d: T });

    // the walls across, a gate in each, and the rooms
    const gates = [];
    for (let k = 0; k < ROOMS; k++) {
      const r = roomRect(id, k);
      const g = gateAt(id, k);
      const seg = (ROOM_W - DOOR_W) / 2;
      for (const sx of [-1, 1]) {
        const cx = ax + sx * (DOOR_W / 2 + seg / 2);
        crossWall(b, th, id, rand, cx, r.z0, seg);
        solid({ x: cx, y: WALL_H / 2, z: r.z0, w: seg, h: WALL_H, d: T });
        // a post either side of the gate
        b.add(box, mat(th.trim), ax + sx * (DOOR_W / 2 + 0.2), 1.1, r.z0, 0.4, 2.2, T + 0.1);
        b.add(box, mat(th.wall2), ax + sx * (DOOR_W / 2 + 0.2), 2.26, r.z0, 0.5, 0.14, T + 0.2);
      }
      gates.push(makeGate(group, th, id, g.x, g.z, k));
      floorBits(b, th, id, rand, r, k);
      roomProps(b, group, th, id, rand, r, k);
    }

    // the way home, by where farmers come in
    const swirl = wayHome(group, th, dungeonExit(id));
    dungeons.set(id, { group, gates, swirl, foes: null, flies: group.userData.flies ?? [], cleared: 0 });
    b.done();
  }

  // ---------- Walls ----------
  // A side wall, at x (sx: which side: the room is toward -sx), from z0 to z1
  function sideWall(b, th, id, rand, x, sx, z0, z1) {
    const inner = x - sx * T / 2; // (its face, toward the room)
    const len = z1 - z0;
    const mid = (z0 + z1) / 2;
    if (id === 'bee') {
      // a backing of dark wax, and cells all over its face, some full of honey
      b.add(box, mat(th.wall), x, SIDE_H / 2, mid, T, SIDE_H, len);
      for (let row = 0; row < 5; row++) {
        const y = 0.3 + row * 0.5;
        for (let z = z0 + 0.3 + (row % 2) * 0.29; z < z1 - 0.2; z += 0.58) cell(b, th, rand, inner - sx * 0.02, y, z, sx, 'x');
      }
      for (let z = z0 + 1.5; z < z1; z += 3.3) b.add(ball, glow(0xffb020, 0.6), inner - sx * 0.08, SIDE_H - 0.2 - rand() * 0.6, z, 0.14, 0.4, 0.14); // honey dripping
      return;
    }
    if (id === 'crow') {
      // logs laid along it, sticks woven through, and nests on top
      for (let row = 0; row < 6; row++) b.add(cyl, mat(row % 2 ? th.wall : th.wall2), x, 0.22 + row * 0.42, mid, 0.44, len, 0.44, Math.PI / 2, 0, 0);
      for (let z = z0 + 0.6; z < z1; z += 0.9) {
        b.add(cyl, mat(0x7a6a50), inner - sx * 0.05, SIDE_H / 2, z, 0.05, SIDE_H * 1.05, 0.05, (rand() - 0.5) * 0.9, 0, 0);
      }
      for (let z = z0 + 2; z < z1 - 1; z += 4.3 + rand() * 2) nest(b, x, SIDE_H + 0.05, z, rand);
      return;
    }
    if (id === 'parsnip') {
      // packed earth on posts, a beam along the top, roots hanging down
      b.add(box, mat(th.wall), x, SIDE_H / 2, mid, T, SIDE_H, len);
      for (let z = z0 + 0.4; z < z1; z += 2.75) b.add(box, mat(th.trim), inner - sx * 0.05, SIDE_H / 2, z, 0.18, SIDE_H, 0.28);
      b.add(box, mat(th.trim), inner - sx * 0.02, SIDE_H - 0.12, mid, 0.22, 0.24, len);
      for (let z = z0 + 0.3; z < z1; z += 0.55 + rand() * 0.5) {
        const l = 0.3 + rand() * 0.8;
        b.add(cyl, mat(0x3d2a18), inner - sx * (0.12 + rand() * 0.1), SIDE_H - l / 2, z, 0.05, l, 0.05, (rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
        if (rand() < 0.4) b.add(ball, mat(0xf2e2b0), inner - sx * 0.15, SIDE_H - l, z, 0.09, 0.14, 0.09);
      }
      return;
    }
    // stone blocks in rows (the lion's sandstone, the toad's mossy stones)
    const rows = 5;
    const rh = SIDE_H / rows;
    for (let row = 0; row < rows; row++) {
      let z = z0 + (row % 2) * 0.55;
      if (row % 2) b.add(box, mat(th.wall2), x, rh * (row + 0.5), z0 + 0.275, T, rh * 0.96, 0.53);
      while (z < z1 - 0.05) {
        const l = Math.min(z1 - z, 0.9 + rand() * 0.5);
        b.add(box, mat(rand() < 0.5 ? th.wall : th.wall2), x - sx * (rand() * 0.04), rh * (row + 0.5), z + l / 2, T, rh * 0.94, l * 0.97);
        z += l;
      }
    }
    if (id === 'toad') {
      // moss along the top, and spilling down
      b.add(box, mat(th.trim), x, SIDE_H + 0.06, mid, T + 0.1, 0.14, len);
      for (let z = z0 + 0.5; z < z1; z += 0.8 + rand()) b.add(box, mat(0x5f8a36), inner - sx * 0.02, SIDE_H - 0.3 - rand() * 0.5, z, 0.06, 0.4 + rand() * 0.6, 0.4 + rand() * 0.4);
    } else {
      // columns against it, a capital on each
      b.add(box, mat(th.trim), x, SIDE_H + 0.08, mid, T + 0.1, 0.16, len);
      for (let z = z0 + 1.8; z < z1 - 1; z += 3.67) {
        const broken = rand() < 0.25;
        const h = broken ? 1 + rand() * 0.8 : SIDE_H + 0.3;
        b.add(cyl, mat(th.trim), inner - sx * 0.3, h / 2, z, 0.5, h, 0.5);
        if (!broken) b.add(box, mat(th.wall2), inner - sx * 0.3, h, z, 0.7, 0.2, 0.7);
        b.add(box, mat(th.wall2), inner - sx * 0.3, 0.1, z, 0.7, 0.2, 0.7);
      }
    }
  }

  // A low wall across, between two rooms, `w` long, its middle at x, z
  function crossWall(b, th, id, rand, x, z, w) {
    if (id === 'crow') {
      for (let row = 0; row < 3; row++) b.add(cyl, mat(row % 2 ? th.wall : th.wall2), x, 0.22 + row * 0.42, z, 0.44, w, 0.44, 0, 0, Math.PI / 2);
      return;
    }
    b.add(box, mat(th.wall), x, MID_H / 2, z, w, MID_H, T);
    if (id === 'bee') {
      for (const side of [-1, 1]) {
        for (let row = 0; row < 2; row++) {
          for (let cx = x - w / 2 + 0.3 + (row % 2) * 0.29; cx < x + w / 2 - 0.2; cx += 0.58) cell(b, THEMES.bee, rand, cx, 0.35 + row * 0.5, z + side * (T / 2 + 0.02), side, 'z');
        }
      }
    } else if (id === 'parsnip') {
      b.add(box, mat(th.trim), x, MID_H - 0.1, z, w, 0.2, T + 0.1);
    } else {
      b.add(box, mat(th.trim), x, MID_H + 0.06, z, w + 0.02, 0.14, T + 0.1);
      if (id === 'toad') for (let cx = x - w / 2 + 0.4; cx < x + w / 2; cx += 0.9) b.add(box, mat(0x5f8a36), cx, MID_H + 0.16, z, 0.6, 0.08, T + 0.15);
    }
  }

  // a wax cell of the honeycomb, on a wall at x, y, z facing `side` along `axis`
  function cell(b, th, rand, x, y, z, side, axis) {
    const [rx, rz] = axis === 'x' ? [0, Math.PI / 2] : [Math.PI / 2, 0];
    b.add(hex, mat(th.wall2), x, y, z, 0.3, 0.08, 0.3, rx, 0, rz);
    const full = rand() < 0.35;
    const [dx, dz] = axis === 'x' ? [-side * 0.05, 0] : [0, side * 0.05];
    b.add(hex, full ? glow(0xffb020, 0.5) : mat(0x8a5a12), x + dx, y, z + dz, 0.23, 0.05, 0.23, rx, 0, rz);
  }

  // a nest of sticks, with blue eggs in some
  function nest(b, x, y, z, rand) {
    b.add(cyl, mat(0x7a6a50), x, y + 0.1, z, 0.8, 0.2, 0.8);
    b.add(cyl, mat(0x3d3226), x, y + 0.16, z, 0.6, 0.12, 0.6);
    if (rand() < 0.6) for (let i = 0; i < 2; i++) b.add(ball, mat(0x9fc6d9), x + (i - 0.5) * 0.18, y + 0.25, z + (rand() - 0.5) * 0.15, 0.14, 0.18, 0.14);
  }

  // ---------- What is about in a room ----------
  function floorBits(b, th, id, rand, r, k) {
    const cx = (r.x0 + r.x1) / 2;
    if (id === 'lion') {
      // a path of flagstones down the middle
      for (let z = r.z0 + 0.6; z < r.z1 - 0.3; z += 1.05) b.add(box, mat(th.floor2), cx + (rand() - 0.5) * 0.2, 0.02, z, 1.6 + rand() * 0.4, 0.06, 0.9);
    } else if (id === 'bee') {
      // wax tiles
      for (let i = 0; i < 26; i++) b.add(hex, mat(i % 2 ? th.floor2 : 0xf7d77a), r.x0 + 0.8 + rand() * (ROOM_W - 1.6), 0.02, r.z0 + 0.8 + rand() * 9.4, 0.9, 0.05, 0.9);
    } else if (id === 'toad') {
      // puddles, lily pads on some
      for (let i = 0; i < 4; i++) {
        const px = cx + (rand() - 0.5) * (ROOM_W - 3);
        const pz = r.z0 + 1.5 + rand() * 8;
        const s = 1.2 + rand() * 1.4;
        b.add(disc, mat(th.floor2, { roughness: 0.2, metalness: 0.2 }), px, 0.015, pz, s, 0.02, s * 0.8);
        if (rand() < 0.7) b.add(disc, mat(0x4f9e3c), px + (rand() - 0.5) * s * 0.4, 0.035, pz, 0.45, 0.02, 0.45);
      }
    } else {
      // straw (the cellar), or fallen leaves and feathers (the rookery)
      for (let i = 0; i < 14; i++) {
        const leaf = id === 'crow' && i % 3;
        b.add(box, mat(id === 'crow' ? (leaf ? [0xc0662f, 0xd9a03a, 0x8a3a1a][i % 3] : 0x1a1a1f) : th.floor2), r.x0 + 0.8 + rand() * (ROOM_W - 1.6), 0.02, r.z0 + 0.8 + rand() * 9.4,
          leaf ? 0.22 : 0.08, 0.02, leaf ? 0.16 : 0.45, 0, rand() * Math.PI, 0);
      }
    }
  }

  // Things along the side walls of room k, and its lamps
  function roomProps(b, group, th, id, rand, r, k) {
    for (const sx of [-1, 1]) {
      const wallX = sx < 0 ? r.x0 : r.x1;
      const x = wallX - sx * 0.75;
      // a lamp halfway along
      lamp(b, group, th, id, wallX - sx * 0.3, (r.z0 + r.z1) / 2, sx);
      for (const z of [r.z0 + 1.6 + rand() * 1.2, r.z1 - 2.4 - rand() * 1.2]) prop(b, group, th, id, rand, x, z, sx, k);
    }
  }

  function lamp(b, group, th, id, x, z, sx) {
    const y = SIDE_H - 0.8;
    if (id === 'lion') {
      // a brazier on the floor
      b.add(cyl, mat(0x6b4a2e), x - sx * 0.3, 0.45, z, 0.12, 0.9, 0.12);
      b.add(cyl, mat(0x8a5a32), x - sx * 0.3, 0.95, z, 0.6, 0.18, 0.6);
      b.add(cone, glow(th.light, 1.2), x - sx * 0.3, 1.2, z, 0.4, 0.4, 0.4);
      return;
    }
    if (id === 'toad') {
      // glowing toadstools, and fireflies over them
      for (let i = 0; i < 3; i++) {
        const mx = x - sx * (0.2 + i * 0.25);
        const mz = z + (i - 1) * 0.35;
        b.add(cyl, mat(0xe8e0c8), mx, 0.15, mz, 0.08, 0.3, 0.08);
        b.add(ball, glow(0x7ae0bc, 0.8), mx, 0.32, mz, 0.3 - i * 0.05, 0.14, 0.3 - i * 0.05);
      }
      const flies = (group.userData.flies ??= []);
      for (let i = 0; i < 4; i++) {
        const fly = part(group, ball, glow(th.light, 1.5), x - sx * 1.2, 1 + i * 0.3, z, 0.06, 0.06, 0.06);
        fly.castShadow = false;
        fly.userData.home = fly.position.clone();
        fly.userData.phase = i * 1.7 + x;
        flies.push(fly);
      }
      return;
    }
    if (id === 'bee') return; // (the honey in the walls glows)
    // a lantern on the wall (warm in the cellar, cold blue in the rookery)
    b.add(box, mat(th.trim), x, y + 0.35, z, 0.08, 0.08, 0.3);
    b.add(box, mat(0x3a3632), x - sx * 0.1, y, z, 0.24, 0.32, 0.24);
    b.add(box, glow(th.light, 1.3), x - sx * 0.1, y, z, 0.18, 0.24, 0.18);
  }

  function prop(b, group, th, id, rand, x, z, sx, k) {
    const pick = Math.floor(rand() * 3);
    if (id === 'parsnip') {
      if (pick === 0) {
        // a crate, maybe two
        b.add(box, mat(0xa8713f), x, 0.35, z, 0.7, 0.7, 0.7, 0, rand() * 0.4, 0);
        b.add(box, mat(0x7a4f28), x, 0.35, z, 0.74, 0.12, 0.74);
        if (rand() < 0.5) b.add(box, mat(0xa8713f), x + 0.05, 0.95, z, 0.5, 0.5, 0.5, 0, rand(), 0);
      } else if (pick === 1) {
        // sacks
        for (let i = 0; i < 2; i++) b.add(ball, mat(0xd9c48a), x, 0.3, z + (i - 0.5) * 0.6, 0.55, 0.6, 0.5);
      } else {
        // a basket of parsnips
        b.add(cyl, mat(0x9a6a3a), x, 0.22, z, 0.8, 0.44, 0.8);
        for (let i = 0; i < 4; i++) b.add(cone, mat(0xf2e2b0), x + (rand() - 0.5) * 0.4, 0.5, z + (rand() - 0.5) * 0.4, 0.14, 0.35, 0.14, Math.PI + (rand() - 0.5), 0, (rand() - 0.5));
      }
    } else if (id === 'lion') {
      if (pick === 0) {
        // a pot
        b.add(ball, mat(0xc0662f), x, 0.35, z, 0.6, 0.7, 0.6);
        b.add(cyl, mat(0xa8521f), x, 0.75, z, 0.3, 0.16, 0.3);
      } else if (pick === 1) {
        // a lion on a plinth
        b.add(box, mat(th.wall2), x, 0.35, z, 0.7, 0.7, 0.7);
        b.add(ball, mat(0xe0a82e, { metalness: 0.4 }), x, 0.95, z, 0.62, 0.55, 0.3);
        b.add(ball, mat(0xffd27a, { metalness: 0.4 }), x - sx * 0.08, 0.95, z, 0.36, 0.36, 0.34);
      } else {
        // dry grass
        for (let i = 0; i < 5; i++) b.add(cone, mat(0xc9b05a), x + (rand() - 0.5) * 0.6, 0.2, z + (rand() - 0.5) * 0.6, 0.12, 0.45, 0.12, (rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
      }
    } else if (id === 'bee') {
      if (pick === 0) {
        // a honey pot
        b.add(ball, mat(0xc0762f), x, 0.3, z, 0.6, 0.6, 0.6);
        b.add(cyl, glow(0xffb020, 0.5), x, 0.58, z, 0.36, 0.08, 0.36);
      } else if (pick === 1) {
        // a big flower
        b.add(cyl, mat(0x4f9e3c), x, 0.5, z, 0.06, 1, 0.06);
        for (let i = 0; i < 5; i++) b.add(ball, mat(0xf28cb1), x + Math.sin(i * 1.26) * 0.2, 1, z + Math.cos(i * 1.26) * 0.2, 0.24, 0.08, 0.24);
        b.add(ball, mat(0xffd84a), x, 1.02, z, 0.16, 0.1, 0.16);
      } else {
        // a lump of wax cells
        for (let i = 0; i < 3; i++) b.add(hex, i ? mat(0xf7d77a) : glow(0xffb020, 0.4), x + (i - 1) * 0.3, 0.15 + (i % 2) * 0.3, z, 0.35, 0.3, 0.35);
      }
    } else if (id === 'crow') {
      if (pick === 0 && k !== 0) {
        // a scarecrow
        b.add(cyl, mat(0x7a5a3a), x, 0.8, z, 0.08, 1.6, 0.08);
        b.add(cyl, mat(0x7a5a3a), x, 1.25, z, 0.06, 1.1, 0.06, Math.PI / 2, 0, 0);
        b.add(box, mat(0x5a4a6a), x, 1.1, z, 0.35, 0.55, 0.3);
        b.add(ball, mat(0xe8d39a), x, 1.55, z, 0.3, 0.3, 0.3);
        b.add(cone, mat(0x3a3632), x, 1.78, z, 0.42, 0.3, 0.42);
      } else if (pick === 1) {
        nest(b, x, 0, z, rand);
      } else {
        // trinkets the rooks brought home
        for (let i = 0; i < 4; i++) b.add(disc, mat(0xffd84a, { metalness: 0.6, roughness: 0.3 }), x + (rand() - 0.5) * 0.6, 0.03 + i * 0.02, z + (rand() - 0.5) * 0.6, 0.18, 0.03, 0.18);
        b.add(box, mat(0xd6d4cc, { metalness: 0.6, roughness: 0.3 }), x, 0.05, z + 0.2, 0.05, 0.03, 0.35, 0, rand(), 0);
      }
    } else {
      if (pick === 0) {
        // reeds and cattails
        for (let i = 0; i < 5; i++) {
          const rx = x + (rand() - 0.5) * 0.6;
          const rz = z + (rand() - 0.5) * 0.6;
          const h = 0.8 + rand() * 0.6;
          b.add(cyl, mat(0x4f8a36), rx, h / 2, rz, 0.04, h, 0.04);
          if (i % 2) b.add(cyl, mat(0x6b4426), rx, h + 0.1, rz, 0.08, 0.22, 0.08);
        }
      } else if (pick === 1) {
        // a mossy log
        b.add(cyl, mat(0x5a4a30), x, 0.25, z, 0.5, 1.4, 0.5, Math.PI / 2, 0, 0);
        b.add(box, mat(0x6f9a3e), x, 0.48, z, 0.3, 0.06, 1.1);
      } else {
        // a stone, mossy on top
        b.add(ball, mat(0x6c6b66), x, 0.25, z, 0.8, 0.5, 0.7);
        b.add(ball, mat(0x6f9a3e), x, 0.45, z, 0.6, 0.12, 0.5);
      }
    }
  }

  // ---------- Gates ----------
  // the gate out of room k: bars across the door (each dungeon's own), and
  // what stops a farmer while it is shut
  function makeGate(group, th, id, x, z, k) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    group.add(g);
    if (id === 'bee') {
      // a wall of wax cells
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 4; i++) part(g, hex, mat(th.gate), (i - 1.5) * 0.56 + (row % 2) * 0.28 - 0.14, 0.3 + row * 0.5, 0, 0.3, 0.2, 0.3, Math.PI / 2, 0, 0);
      }
      part(g, box, glow(0xffb020, 0.4), 0, 0.8, 0, DOOR_W - 0.1, 1.5, 0.08);
    } else if (id === 'lion') {
      // a sandstone slab, a sun carved on it
      part(g, box, mat(th.gate), 0, GATE_H / 2, 0, DOOR_W, GATE_H, 0.3);
      part(g, disc, mat(th.band, { metalness: 0.4 }), 0, GATE_H / 2 + 0.1, 0.16, 0.6, 0.04, 0.6, Math.PI / 2, 0, 0);
    } else if (id === 'crow') {
      // a lattice of sticks
      for (let i = 0; i < 5; i++) {
        for (const lean of [-0.6, 0.6]) part(g, cyl, mat(th.gate), (i - 2) * 0.5, GATE_H / 2, 0, 0.07, GATE_H * 1.15, 0.07, 0, 0, lean);
      }
    } else if (id === 'toad') {
      // a fence of reeds, tied
      for (let i = 0; i < 9; i++) part(g, cyl, mat(i % 2 ? 0x4f8a36 : 0x6b8a3a), (i - 4) * 0.27, GATE_H / 2, 0, 0.1, GATE_H * (0.9 + (i % 3) * 0.05), 0.1);
      part(g, box, mat(th.gate), 0, GATE_H * 0.6, 0, DOOR_W, 0.08, 0.14);
    } else {
      // a portcullis of planks, iron bands across
      for (let i = 0; i < 5; i++) part(g, box, mat(th.gate), (i - 2) * 0.46, GATE_H / 2, 0, 0.36, GATE_H, 0.12);
      for (const y of [0.35, GATE_H - 0.35]) part(g, box, mat(th.band), 0, y, 0.02, DOOR_W, 0.1, 0.16);
    }
    const shut = solid({ x, y: WALL_H / 2, z, w: DOOR_W, h: WALL_H, d: T });
    return { group: g, shut, open: false, sink: 0, k };
  }

  function setGate(gate, open) {
    if (open === gate.open) return;
    gate.open = open;
    const i = world.platforms.indexOf(gate.shut);
    if (open && i >= 0) world.platforms.splice(i, 1);
    if (!open && i < 0) world.platforms.push(gate.shut);
  }

  // ---------- The way home ----------
  function wayHome(group, th, at) {
    const door = new THREE.Group();
    door.position.set(at.x, 0, at.z + 0.4);
    group.add(door);
    part(door, box, mat(0x9c9a92), 0, 0.06, 0, 1.6, 0.12, 0.6);
    for (const x of [-0.65, 0.65]) part(door, box, mat(0x9c9a92), x, 1.1, 0, 0.24, 2.2, 0.36);
    part(door, box, mat(0xb9b7ae), 0, 2.3, 0, 1.6, 0.24, 0.42);
    const swirl = new THREE.Group();
    swirl.position.set(0, 1.15, 0);
    door.add(swirl);
    part(swirl, ball, glow(th.swirl[0], 0.9), 0, 0, 0, 1.06, 2.05, 0.06);
    for (let i = 0; i < 3; i++) {
      const arm = part(swirl, box, glow(th.swirl[1], 1), 0, 0, 0, 0.07, 0.7, 0.02);
      arm.rotation.z = (i * Math.PI * 2) / 3;
      arm.position.set(-Math.sin(arm.rotation.z) * 0.24, Math.cos(arm.rotation.z) * 0.24, 0.05);
    }
    return swirl;
  }

  // ---------- The foes ----------
  function foesOf(id) {
    const d = dungeons.get(id);
    if (!d.foes) {
      const count = DUNGEONS[id].foes.reduce((a, b) => a + b, 0);
      d.foes = Array.from({ length: count }, () => createFoe(id, d.group));
    }
    return d.foes;
  }

  return {
    // Every frame, for each dungeon: `near` (we are in it or its arena: it
    // is drawn), `run` (as dungeonFromWire has it, the foes drawn where
    // `shown` has them: { x, y, z } each; null: fresh, every foe resting)
    update(dt, t, id, near, run, shown) {
      const d = dungeons.get(id);
      d.group.visible = near;
      // the gates: open for the rooms cleared (whether or not it is drawn: they stop farmers)
      const cleared = run?.cleared ?? 0;
      for (const gate of d.gates) setGate(gate, gate.k < cleared);
      if (!near) return;
      for (const gate of d.gates) {
        gate.sink += ((gate.open ? 1 : 0) - gate.sink) * Math.min(1, dt / SINK_TIME * 3);
        gate.group.position.y = -gate.sink * (GATE_H + 0.1);
        gate.group.visible = gate.sink < 0.98;
      }
      d.swirl.rotation.z = -t * 2.2;
      for (const fly of d.flies) {
        const { home, phase } = fly.userData;
        fly.position.set(home.x + Math.sin(t * 0.7 + phase) * 0.6, home.y + Math.sin(t * 1.3 + phase) * 0.25, home.z + Math.cos(t * 0.9 + phase) * 0.8);
      }
      const foes = foesOf(id);
      foes.forEach((view, i) => view.pose(dt, t, run?.foes[i] ?? null, shown?.[i] ?? null));
    },
    // A foe was bopped (it flinches), or bopped down (a puff)
    flinch(id, i) {
      dungeons.get(id).foes?.[i]?.flinch();
    },
    // Where foe i's head is (for an arrow at it)
    top(id, i, out) {
      return dungeons.get(id).foes?.[i]?.top(out) ?? null;
    },
  };
}

// ---------- A foe, as it is drawn ----------
// Its model (each dungeon's own kind), and pose(dt, t, f, at): f as
// dungeonFromWire has it (null: resting where the dungeon starts it off),
// at: where it is drawn ({ x, y, z })
function createFoe(id, parent) {
  const root = new THREE.Group();
  parent.add(root);
  const body = new THREE.Group(); // (what squashes and leans)
  root.add(body);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.scale.setScalar(FOE_R * 0.9);
  shadow.renderOrder = 1;
  root.add(shadow);
  const model = MODELS[id](body);
  const puffs = [];
  let flinchAt = -1;
  let downAt = -1;
  let yaw = 0;
  let now = 0;
  const v = new THREE.Vector3();

  function puff() {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const blob = part(parent, ball, PUFF_MAT, root.position.x, root.position.y + 0.35, root.position.z, 0.25, 0.25, 0.25);
      blob.castShadow = false;
      blob.userData.v = new THREE.Vector3(Math.cos(a) * 1.6, 1 + Math.random(), Math.sin(a) * 1.6);
      blob.userData.age = 0;
      puffs.push(blob);
    }
  }

  return {
    flinch() {
      flinchAt = now;
    },
    top(out) {
      return out.set(root.position.x, root.position.y + 0.5, root.position.z);
    },
    pose(dt, t, f, at) {
      now = t;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const blob = puffs[i];
        blob.userData.age += dt;
        blob.position.addScaledVector(blob.userData.v, dt);
        blob.scale.setScalar(0.25 * (1 + blob.userData.age * 2));
        if (blob.userData.age > 0.45) {
          parent.remove(blob);
          puffs.splice(i, 1);
        }
      }
      if (!f) {
        root.visible = false;
        downAt = -1;
        return;
      }
      if (f.state === 'down') {
        if (downAt < 0 && root.visible) {
          downAt = t;
          puff();
        }
        root.visible = false;
        return;
      }
      downAt = -1;
      root.visible = true;
      root.position.set(at.x, at.y, at.z);
      let diff = f.yaw - yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      yaw += diff * damp(10, dt);
      root.rotation.y = yaw;
      shadow.position.y = 0.02 - at.y;
      shadow.scale.setScalar(FOE_R * 0.9 * Math.max(0.4, 1 - at.y * 0.2));
      // how it stands: squashed down to wind up, stretched going for you, reeling when bopped
      let sy = 1 + Math.sin(t * 3 + root.position.x) * 0.03;
      let lean = 0;
      let wobble = 0;
      if (f.state === 'roam') wobble = Math.sin(t * 12) * 0.12;
      else if (f.state === 'windup') {
        sy = 0.78;
        wobble = Math.sin(t * 40) * 0.06;
      } else if (f.state === 'attack') {
        sy = 1.15;
        lean = 0.35;
      } else if (f.state === 'hurt') {
        lean = -0.5;
        wobble = Math.sin(t * 30) * 0.2;
      }
      const reel = flinchAt >= 0 && t - flinchAt < 0.3 ? 1 - (t - flinchAt) / 0.3 : 0;
      sy *= 1 - reel * 0.3;
      body.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
      body.rotation.set(lean, 0, wobble);
      model.animate?.(t, f, v);
    },
  };
}
const PUFF_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });

// Each dungeon's foe (about FOE_H tall, facing +z), built into `g`: { animate(t, f) } for what moves on its own
const MODELS = {
  // a little angry parsnip on stubby feet, leaves on top
  parsnip(g) {
    const skin = mat(0xf2e2b0);
    part(g, cone, skin, 0, 0.42, 0, 0.42, 0.62, 0.42, Math.PI, 0, 0);
    part(g, ball, skin, 0, 0.6, 0, 0.44, 0.3, 0.44);
    const leaves = new THREE.Group();
    leaves.position.y = 0.76;
    g.add(leaves);
    for (let i = 0; i < 3; i++) part(leaves, ball, mat(0x5aa83c), Math.sin(i * 2.1) * 0.08, 0.12, Math.cos(i * 2.1) * 0.08, 0.1, 0.32, 0.18, Math.cos(i * 2.1) * 0.5, 0, -Math.sin(i * 2.1) * 0.5);
    face(g, 0.58, 0.21, 0.07);
    for (const sx of [-1, 1]) part(g, ball, mat(0x8a5a32), sx * 0.1, 0.06, 0.02, 0.13, 0.1, 0.17);
    return { animate: (t, f) => (leaves.rotation.y = f.state === 'windup' ? t * 18 : Math.sin(t * 2) * 0.3) };
  },
  // a lion cub: a round tan body, a big head in a little mane, a tufted tail
  lion(g) {
    const fur = mat(0xe0a848);
    part(g, ball, fur, 0, 0.3, -0.08, 0.42, 0.34, 0.56);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) part(g, cyl, fur, sx * 0.12, 0.1, -0.08 + sz * 0.17, 0.1, 0.22, 0.1);
    const tail = part(g, cyl, fur, 0, 0.42, -0.42, 0.05, 0.3, 0.05, -0.8, 0, 0);
    part(g, ball, mat(0xb8761f), 0, 0.52, -0.53, 0.12, 0.12, 0.12);
    part(g, ball, mat(0xb8761f), 0, 0.5, 0.2, 0.56, 0.52, 0.3);
    part(g, ball, fur, 0, 0.5, 0.27, 0.4, 0.38, 0.36);
    for (const sx of [-1, 1]) part(g, ball, fur, sx * 0.15, 0.7, 0.24, 0.12, 0.12, 0.08);
    part(g, ball, mat(0xf7e2b8), 0, 0.44, 0.42, 0.2, 0.14, 0.12);
    part(g, ball, mat(0x3d2416), 0, 0.48, 0.48, 0.07, 0.05, 0.05);
    face(g, 0.55, 0.12, 0.42);
    return { animate: (t) => (tail.rotation.z = Math.sin(t * 6) * 0.4) };
  },
  // a worker bee: striped, buzzing wings, a little sting
  bee(g) {
    const yellow = mat(0xffd23f);
    const black = mat(0x2a1a10);
    part(g, ball, yellow, 0, 0.32, -0.12, 0.38, 0.34, 0.46);
    for (const z of [-0.06, -0.22]) part(g, ball, black, 0, 0.32, z, 0.39, 0.35, 0.07);
    part(g, cone, black, 0, 0.3, -0.38, 0.08, 0.14, 0.08, -Math.PI / 2, 0, 0);
    part(g, ball, black, 0, 0.36, 0.14, 0.26, 0.26, 0.24);
    part(g, ball, black, 0, 0.42, 0.3, 0.24, 0.24, 0.22);
    for (const sx of [-1, 1]) {
      part(g, ball, mat(0xffffff), sx * 0.07, 0.46, 0.39, 0.08, 0.1, 0.05);
      part(g, cyl, black, sx * 0.05, 0.6, 0.34, 0.02, 0.2, 0.02, 0.4, 0, sx * 0.3);
    }
    const wings = [-1, 1].map((sx) => {
      const w = part(g, ball, WING_MAT, sx * 0.17, 0.52, 0.02, 0.26, 0.03, 0.16);
      w.castShadow = false;
      return w;
    });
    return {
      animate: (t) => wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * (0.3 + Math.sin(t * 60) * 0.4))),
    };
  },
  // a rook: black, a pale beak, wings it flaps going up and about
  crow(g) {
    const black = mat(0x26282e);
    part(g, ball, black, 0, 0.36, -0.04, 0.38, 0.38, 0.54);
    part(g, ball, black, 0, 0.58, 0.18, 0.28, 0.28, 0.28);
    part(g, cone, mat(0xc9ccd1), 0, 0.56, 0.38, 0.1, 0.24, 0.1, Math.PI / 2, 0, 0);
    part(g, box, black, 0, 0.36, -0.36, 0.26, 0.05, 0.24, 0.3, 0, 0);
    for (const sx of [-1, 1]) {
      part(g, ball, mat(0xffffff), sx * 0.09, 0.62, 0.27, 0.07, 0.07, 0.04);
      part(g, ball, mat(0x111111), sx * 0.1, 0.62, 0.29, 0.035, 0.035, 0.02);
      part(g, cyl, mat(0x3a3632), sx * 0.07, 0.1, 0, 0.03, 0.22, 0.03);
    }
    const wings = [-1, 1].map((sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.17, 0.44, -0.02);
      g.add(pivot);
      part(pivot, ball, mat(0x1c1d22), sx * 0.12, 0, 0, 0.3, 0.06, 0.4);
      return pivot;
    });
    return {
      animate: (t, f) => {
        const flap = f.y > 0.15 || f.state === 'windup' ? Math.sin(t * 22) * 0.8 : 0.1;
        wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * flap));
      },
    };
  },
  // a bog frog: squat and green, a pale belly, eyes up on top
  toad(g) {
    const green = mat(0x5f9a3a);
    part(g, ball, green, 0, 0.26, 0, 0.6, 0.38, 0.56);
    part(g, ball, mat(0xd8e8a0), 0, 0.2, 0.12, 0.44, 0.24, 0.34);
    for (const sx of [-1, 1]) {
      part(g, ball, green, sx * 0.15, 0.46, 0.14, 0.18, 0.18, 0.18);
      part(g, ball, mat(0xe0c040), sx * 0.15, 0.49, 0.2, 0.12, 0.12, 0.08);
      part(g, ball, mat(0x111111), sx * 0.15, 0.49, 0.24, 0.07, 0.03, 0.03);
      part(g, ball, green, sx * 0.27, 0.12, -0.12, 0.2, 0.18, 0.34);
      part(g, ball, green, sx * 0.17, 0.06, 0.24, 0.1, 0.08, 0.14);
    }
    for (let i = 0; i < 4; i++) part(g, ball, mat(0x4a7a2e), Math.sin(i * 1.9) * 0.18, 0.42, -0.12 + Math.cos(i * 1.9) * 0.1, 0.06, 0.04, 0.06);
    part(g, box, mat(0x2f4a22), 0, 0.27, 0.27, 0.3, 0.02, 0.02);
    const throat = part(g, ball, mat(0xe8f0b8), 0, 0.17, 0.24, 0.24, 0.14, 0.14);
    return { animate: (t) => throat.scale.set(0.24, 0.14 + Math.max(0, Math.sin(t * 4)) * 0.06, 0.14) };
  },
};
const WING_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, roughness: 0.3 });

// two eyes and cross brows, on the front of a head at height y, `w` apart, `z` out
function face(g, y, w, z) {
  for (const sx of [-1, 1]) {
    part(g, ball, mat(0x111111), sx * w / 2, y, z + 0.13, 0.07, 0.09, 0.04);
    part(g, box, mat(0x3d2416), sx * w / 2, y + 0.08, z + 0.14, 0.11, 0.025, 0.02, 0, 0, sx * 0.45);
  }
}
