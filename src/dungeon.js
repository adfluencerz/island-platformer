import * as THREE from 'three';
import { BOSS_IDS, ARENAS, ARENA_R } from '../shared/bosses.js';
import { ROOMS, ROOM_W, ROOM_D, DOOR_W, roomRect, gateAt, dungeonExit } from '../shared/dungeons.js';
import { DUNGEONS } from '../shared/balance.js';
import { createFoe } from './dungeonfoes.js';

// ---------- The bosses' dungeons ----------
// The way to each boss's arena (shared/dungeons.js): ROOMS rooms in a row in
// front of it, down in a cavern of its own out past the sea on the farm's
// world (dark rock rising all round into the dark; src/bosses.js has the sky
// and the light go dark in there), and a bridge from the last of them out
// into the arena. Each is the boss's own:
//   the evil parsnip's root cellar: earth walls on a stone footing in a
//     timber frame, roots and strings of garlic hanging down, shelves of
//     jars, a boardwalk, crates, sacks and barrels, hanging lanterns;
//   the super lion's sunbaked ruins: sandstone blocks under a carved frieze,
//     columns, red banners, a red runner over the flagstones, sand drifting
//     in, braziers, a broken lion, a sunken pool, a golden lion on an altar;
//   the bee queen's honeycomb halls: walls and floor of wax cells (some full
//     of honey, some glowing), wax dripping, honey lamps, a honey pool, a
//     nursery of glowing cells, a giant flower;
//   the giant crow's rookery: log walls, wicker, nests along the top, perches
//     with rooks on them, bird cages of cold blue light, moonbeams, a broken
//     cart of pumpkins, a giant nest, a hoard of shiny things;
//   the bog toad's sunken bog: mossy stones hung with vines, shelf fungi,
//     murky water with lily pads and stepping stones, reeds, glowing
//     toadstools and fireflies, a pond with a plank bridge, a sunken boat.
// The side walls are tall; the ones across, between the rooms, are drawn low
// so the camera sees over them (they stop a farmer all the same), with an
// arch over the gate in the middle, which sinks into the floor once its
// room's foes are all down. Till then, for a farmer in the dungeon, it is
// dark past that gate: nothing of the rooms beyond (nor the arena) shows
// till it opens, and the dark over the next room lifts. The way home stands
// by where farmers come in.
// Lamps light pools of the floor round them and flicker, and motes (dust,
// embers, pollen, spores) drift in the air. The foes are src/dungeonfoes.js's.
//
// The walls and floors go in the world's platforms, like the arenas'
// (src/arena.js). What doesn't move is drawn a few instanced meshes to a
// dungeon (each piece its own shade), and a dungeon is only drawn while we
// are in it or its arena.

const T = 0.6; // a wall's thickness
const WALL_H = 3.5; // (what stops a farmer: a little over a jump)
const SIDE_H = 2.8; // the side walls, as drawn
const MID_H = 1.3; // the walls across, between the rooms (low: the camera looks over them)
const GATE_H = 1.6;
const SINK_TIME = 0.7; // seconds a gate takes to sink into the floor
const CAVE_SIDE = 26; // how far the cavern reaches out beside the dungeon...
const CAVE_NEAR = 14; // ...and in front of it (toward the camera; behind it is the arena)
const MOTES = 140; // drifting in the air of a dungeon
const LIFT_TIME = 1.2; // seconds the dark over a room takes to lift, once the gate into it opens
const FADE = [0.45, 0.35, 0.25, 0.15]; // the sheets of dark the cavern fades through into it, nearest it first
const DARK = 0x040306; // (as black as it is all round, underground: daynight.js)

// What a piece is made of: white, each piece its own color (instance colors)
const KINDS = {
  matte: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true }),
  gloss: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.05, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.65, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffffff }), // (lit from within: flames, honey, crystals)
  water: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.82 }),
};
const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(0.5, 1);
const rock = new THREE.IcosahedronGeometry(0.5, 0);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const log = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
const hex = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const cone = new THREE.ConeGeometry(0.5, 1, 7);
const disc = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const ring = new THREE.TorusGeometry(0.5, 0.12, 6, 18);
const arch = new THREE.TorusGeometry(0.5, 0.08, 6, 14, Math.PI);

// A soft round glow (a pool of lamplight on the floor, a mote in the air)
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
let soft = null;
const softGlow = () => (soft ??= glowTexture());
const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

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

// What doesn't move, gathered up and drawn an instanced mesh to each shape and
// kind: add(geo, kind, color, x, y, z, w, h, d, rx, ry, rz) as a part would be
// placed (each a little lighter or darker than `color`, by up to `vary`), then
// done(). pool(color, x, z, size, y): a pool of light on what is under it.
function createBatch(parent, rand) {
  const lists = new Map();
  const pools = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  return {
    add(geo, kind, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0, vary = 0.08) {
      const key = `${geo.uuid}:${kind}`;
      if (!lists.has(key)) lists.set(key, { geo, kind, list: [] });
      c.setHex(color).multiplyScalar(1 + (rand() * 2 - 1) * vary);
      lists.get(key).list.push([m.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(w, h, d)).clone(), c.clone()]);
    },
    pool(color, x, z, size, y = 0.03) {
      pools.push([x, y, z, size, color]);
    },
    done() {
      for (const { geo, kind, list } of lists.values()) {
        const mesh = new THREE.InstancedMesh(geo, KINDS[kind], list.length);
        list.forEach(([matrix, color], i) => {
          mesh.setMatrixAt(i, matrix);
          mesh.setColorAt(i, color);
        });
        mesh.castShadow = kind !== 'glow' && kind !== 'water';
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // (spread far from its middle; a dungeon is only drawn while we are by it)
        parent.add(mesh);
      }
      if (!pools.length) return null;
      const material = new THREE.MeshBasicMaterial({ map: softGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
      const mesh = new THREE.InstancedMesh(poolGeo, material, pools.length);
      pools.forEach(([x, y, z, size, color], i) => {
        mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q.identity(), s.set(size, 1, size)));
        mesh.setColorAt(i, c.setHex(color));
      });
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      parent.add(mesh);
      return material;
    },
  };
}

// ---------- Each dungeon's colors ----------
// rock: its cavern's; floor: the floor; wall, wall2: its walls; trim: posts,
// beams, ledges; light: its lamps' glow; mote: what drifts in its air (and
// how: rising, or sinking); swirl: the way home's (as its arena's); gate: the
// gate's; cave: the light down there (src/bosses.js tints the dark with it)
export const THEMES = {
  parsnip: { rock: 0x3a2c22, floor: 0x4a3524, wall: 0x5a3d25, wall2: 0x6b4a2e, trim: 0x7a4f28, light: 0xffb050, mote: [0xffd9a0, 0.15], swirl: [0x6a2f94, 0xd9a8ff], gate: 0x7a4f28, band: 0x3a3632, cave: 0xffc890 },
  lion: { rock: 0x5a4430, floor: 0xd9bf88, wall: 0xd9b77a, wall2: 0xc9a464, trim: 0xe8cf94, light: 0xff9a3a, mote: [0xffb050, 0.35], swirl: [0xb8561a, 0xffd08a], gate: 0xc9a464, band: 0xe0a82e, cave: 0xffd0a0 },
  bee: { rock: 0x4a3418, floor: 0xe8b23a, wall: 0xb8801a, wall2: 0xf2c860, trim: 0x8a5a12, light: 0xffb020, mote: [0xffe070, 0.2], swirl: [0xc99a10, 0xfff0a0], gate: 0xf7d77a, band: 0xe8a820, cave: 0xffd890 },
  crow: { rock: 0x26262c, floor: 0x3a322a, wall: 0x4a3a2a, wall2: 0x5e4c38, trim: 0x2f2a24, light: 0x8fb0ff, mote: [0xc8d8ff, -0.12], swirl: [0x2f3f8a, 0xa8c0ff], gate: 0x5a4a36, band: 0x2f2a24, cave: 0xa8b8e8 },
  toad: { rock: 0x26302a, floor: 0x3a4630, wall: 0x56664e, wall2: 0x4a5a44, trim: 0x5f8a36, light: 0x7ae0bc, mote: [0xb8ff90, 0.1], swirl: [0x1f7a6a, 0x9ff0d0], gate: 0x5a4a30, band: 0x6f9a3e, cave: 0xa8e0c0 },
};

// world: the farm's (world.js buildWorld)
export function createDungeons(world) {
  const root = new THREE.Group();
  root.name = 'boss-dungeons';
  world.root.add(root);
  const dungeons = new Map(); // id -> { group, gates, swirl, flames, flies, motes, pools, foes }

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

  for (const [n, id] of BOSS_IDS.entries()) build(id, n);

  function build(id, n) {
    const th = THEMES[id];
    const rand = seeded(9301 + n * 49297);
    const group = new THREE.Group();
    group.name = `dungeon-${id}`;
    group.visible = false;
    root.add(group);
    const b = createBatch(group, rand);
    const { x: ax, z: az } = ARENAS[id];
    const zFar = roomRect(id, ROOMS - 1).z0;
    const zNear = roomRect(id, 0).z1;
    const len = zNear - zFar;
    const midZ = (zFar + zNear) / 2;
    // (what moves, made as it is built: flames that flicker, fireflies)
    const d = { group, id, th, rand, b, ax, az, zFar, zNear, flames: [], flies: [] };

    // the floor, at the ground's height
    b.add(box, 'matte', th.floor, ax, -0.15, midZ, ROOM_W + 2 * T, 0.3, len + 2 * T, 0, 0, 0, 0);
    solid({ x: ax, y: -0.6, z: midZ, w: ROOM_W + 2 * T, h: 1.2, d: len + 2 * T }, { ground: true });
    cavern(d);
    // the bridge out into the arena, with low rails
    const bridgeFrom = az + ARENA_R - 0.8;
    const bridgeLen = zFar - T / 2 - bridgeFrom;
    const bridgeZ = bridgeFrom + bridgeLen / 2;
    const bw = DOOR_W + 0.8;
    for (let z = bridgeFrom + 0.25; z < zFar - T / 2; z += 0.5) b.add(box, 'matte', th.trim, ax, -0.08, z, bw, 0.14, 0.44);
    b.add(box, 'matte', th.rock, ax, -1, bridgeZ, bw - 0.4, 1.8, bridgeLen);
    solid({ x: ax, y: -0.6, z: bridgeZ, w: bw, h: 1.2, d: bridgeLen }, { ground: true });
    for (const sx of [-1, 1]) {
      const rx = ax + sx * (bw / 2 + 0.1);
      b.add(box, 'matte', th.trim, rx, 0.55, bridgeZ, 0.14, 0.12, bridgeLen);
      for (let z = bridgeFrom + 0.3; z < zFar; z += 1.1) b.add(box, 'matte', th.trim, rx, 0.3, z, 0.16, 0.6, 0.16);
      solid({ x: rx, y: WALL_H / 2, z: bridgeZ, w: 0.2, h: WALL_H, d: bridgeLen });
    }

    // the side walls, tall, and the near wall, low (the camera looks in over it)
    for (const sx of [-1, 1]) {
      const wx = ax + sx * (ROOM_W / 2 + T / 2);
      sideWall(d, wx, sx, zFar - T / 2, zNear + T / 2);
      solid({ x: wx, y: WALL_H / 2, z: midZ, w: T, h: WALL_H, d: len + 2 * T });
    }
    nearWall(d, zNear + T / 2);
    solid({ x: ax, y: WALL_H / 2, z: zNear + T / 2, w: ROOM_W + 2 * T, h: WALL_H, d: T });

    // the walls across, a gate in each, and the rooms
    const gates = [];
    for (let k = 0; k < ROOMS; k++) {
      const r = roomRect(id, k);
      const g = gateAt(id, k);
      const seg = (ROOM_W - DOOR_W) / 2;
      for (const sx of [-1, 1]) {
        const cx = ax + sx * (DOOR_W / 2 + seg / 2);
        crossWall(d, cx, r.z0, seg);
        solid({ x: cx, y: WALL_H / 2, z: r.z0, w: seg, h: WALL_H, d: T });
      }
      gateArch(d, g.x, g.z);
      gates.push(makeGate(d, g.x, g.z, k));
      floor(d, r, k);
      dressing(d, r, k);
      SETPIECES[id](d, r, k);
    }

    const swirl = wayHome(group, th, dungeonExit(id));
    const pools = b.done();
    const motes = makeMotes(d);
    dungeons.set(id, { group, gates, swirl, flames: d.flames, flies: d.flies, motes, pools, foes: null, dark: makeDark(d) });
  }

  // ---------- The cavern ----------
  // Dark rock all round the dungeon, rising the further out it goes (into the
  // dark), but flat by the bridge, where it opens out to the arena; spires of
  // rock on it, boulders, and crystals glowing in the dungeon's light
  function cavern(d) {
    const { th, rand, ax, zFar, zNear, b } = d;
    const x0 = ax - ROOM_W / 2 - T - CAVE_SIDE;
    const x1 = ax + ROOM_W / 2 + T + CAVE_SIDE;
    const z0 = zFar - 1;
    const z1 = zNear + T + CAVE_NEAR;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / 1.3), Math.round((z1 - z0) / 1.3)).rotateX(-Math.PI / 2);
    const s = [rand() * 9, rand() * 9, rand() * 9];
    const bumps = (x, z) => Math.sin(x * 0.55 + s[0]) * Math.cos(z * 0.47 + s[1]) + Math.sin((x + z) * 1.3 + s[2]) * 0.45;
    const height = (x, z) => {
      const out = Math.hypot(Math.max(0, Math.abs(x - ax) - ROOM_W / 2 - T - 0.2), Math.max(0, z - zNear - T - 0.2, zFar - 0.2 - z));
      if (out <= 0) return -0.1;
      const open = Math.min(1, Math.max(0, (z - z0) / 9)); // (flat by the arena's side)
      return (0.15 * out ** 1.45 + bumps(x, z) * 0.5 * Math.min(1, out / 3)) * open - 0.04;
    };
    const pos = geo.attributes.position;
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (x0 + x1) / 2;
      const z = pos.getZ(i) + (z0 + z1) / 2;
      const h = height(x, z);
      pos.setY(i, h);
      c.setHex(th.rock).multiplyScalar(0.8 + 0.35 * (0.5 + 0.5 * Math.sin(x * 2.1 + z * 1.7)) - Math.min(0.45, Math.max(0, h) * 0.05));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    ground.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    ground.receiveShadow = true;
    d.group.add(ground);
    // spires, boulders and crystals, out on the rock
    for (let i = 0; i < 140; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + rand() * (z1 - z0);
      const h = height(x, z);
      if (h < 0.05 && Math.abs(x - ax) < ROOM_W / 2 + T + 1.5) continue; // (not in the dungeon)
      const front = z > zNear && Math.abs(x - ax) < ROOM_W / 2 + 8; // (between the camera and the dungeon: nothing tall)
      const pick = front ? 0.5 + rand() * 0.5 : rand();
      if (pick < 0.45) {
        const tall = 1 + rand() * 3.5;
        b.add(cone, 'matte', th.rock, x, h + tall / 2 - 0.1, z, 0.5 + rand() * 0.9, tall, 0.5 + rand() * 0.9, (rand() - 0.5) * 0.2, rand() * 3, (rand() - 0.5) * 0.2, 0.18);
      } else if (pick < 0.8) {
        const size = front ? 0.4 + rand() * 0.5 : 0.6 + rand() * 1.8;
        b.add(rock, 'matte', th.rock, x, h + size * 0.25, z, size, size * (0.5 + rand() * 0.5), size * (0.7 + rand() * 0.5), 0, rand() * 3, 0, 0.18);
      } else {
        // crystals, a few together
        for (let k = 0; k < 3; k++) {
          const tall = 0.4 + rand() * 0.9;
          b.add(cone, 'glow', th.light, x + (rand() - 0.5) * 0.5, h + tall / 2, z + (rand() - 0.5) * 0.5, 0.18 + rand() * 0.12, tall, 0.18 + rand() * 0.12, (rand() - 0.5) * 0.7, 0, (rand() - 0.5) * 0.7, 0.2);
        }
        b.pool(th.light, x, z, 3.2, h + 0.06);
      }
    }
    CAVES[d.id]?.(d, height, x0, x1, z0, z1);
  }

  // ---------- Walls ----------
  // A side wall at x (sx: which side: the room is toward -sx), from z0 to z1
  function sideWall(d, x, sx, z0, z1) {
    const { th, rand, b, id } = d;
    const face = x - (sx * T) / 2; // (its face, toward the room)
    const at = (out) => face - sx * out; // (out from the face, into the room)
    const len = z1 - z0;
    const mid = (z0 + z1) / 2;
    // its back and top, in the cavern's rock
    b.add(box, 'matte', th.rock, x + sx * 0.2, SIDE_H / 2, mid, T + 0.4, SIDE_H, len, 0, 0, 0, 0.05);
    if (id === 'parsnip') {
      // a footing of stones, earth above in bands, a timber frame, roots and garlic hanging down
      for (let z = z0 + 0.2; z < z1; z += 0.42 + rand() * 0.2) b.add(rock, 'matte', 0x6c665e, at(0.05), 0.25, z, 0.3, 0.45, 0.5, 0, rand() * 3, 0, 0.15);
      for (let band = 0; band < 4; band++) b.add(box, 'matte', band % 2 ? th.wall : th.wall2, at(0.02 + rand() * 0.04), 0.7 + band * 0.52, mid, 0.08, 0.52, len, 0, 0, 0, 0.06);
      for (let z = z0 + 0.4; z < z1; z += 2.75) {
        b.add(box, 'matte', th.trim, at(0.1), SIDE_H / 2, z, 0.2, SIDE_H, 0.26);
        if (z + 2.75 < z1) {
          // a brace across to the next post
          b.add(box, 'matte', th.trim, at(0.08), 1.4, z + 1.375, 0.12, 2.6, 0.14, Math.atan2(2.4, 2.2) * (rand() < 0.5 ? 1 : -1), 0, 0);
        }
      }
      b.add(box, 'matte', th.trim, at(0.1), SIDE_H - 0.15, mid, 0.24, 0.26, len);
      for (let z = z0 + 0.3; z < z1; z += 0.5 + rand() * 0.6) {
        const l = 0.3 + rand() * 0.9;
        const rx = at(0.18 + rand() * 0.12);
        b.add(cyl, 'matte', 0x3d2a18, rx, SIDE_H - l / 2, z, 0.05, l, 0.05, (rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
        if (rand() < 0.5) b.add(cyl, 'matte', 0x3d2a18, rx - sx * 0.08, SIDE_H - l * 0.7, z + 0.06, 0.03, l * 0.5, 0.03, 0.5, 0, sx * 0.5);
        if (rand() < 0.35) b.add(ball, 'matte', 0xf2e2b0, rx, SIDE_H - l, z, 0.09, 0.15, 0.09);
      }
      // strings of garlic and onions off the beam
      for (let z = z0 + 1.6; z < z1 - 1; z += 3.1 + rand() * 1.5) {
        b.add(cyl, 'matte', 0xd9c48a, at(0.3), SIDE_H - 0.55, z, 0.03, 0.8, 0.03);
        for (let k = 0; k < 5; k++) b.add(ball, 'matte', k % 2 ? 0xf4ecdc : 0xb06a8a, at(0.3 + (k % 2) * 0.05), SIDE_H - 0.3 - k * 0.15, z + (k % 2 ? 0.07 : -0.07), 0.16, 0.15, 0.16);
      }
      return;
    }
    if (id === 'lion') {
      // big sandstone blocks in rows, a carved frieze, a ledge on top, columns, banners
      const rows = [0.6, 0.6, 0.6];
      let y = 0;
      for (const [row, rh] of rows.entries()) {
        for (let z = z0 + (row % 2) * 0.6; z < z1 - 0.05;) {
          const l = Math.min(z1 - z, 1.1 + rand() * 0.5);
          b.add(box, 'matte', rand() < 0.5 ? th.wall : th.wall2, at(rand() * 0.04), y + rh / 2, z + l / 2, 0.12, rh * 0.94, l * 0.96);
          z += l;
        }
        y += rh;
      }
      b.add(box, 'matte', 0xb08a50, at(0.03), y + 0.25, mid, 0.1, 0.5, len, 0, 0, 0, 0.03);
      for (let z = z0 + 0.9; z < z1; z += 1.8) b.add(disc, 'metal', th.band, at(0.09), y + 0.25, z, 0.32, 0.05, 0.32, 0, 0, Math.PI / 2, 0.05);
      b.add(box, 'matte', th.trim, at(0.12), SIDE_H - 0.08, mid, 0.3, 0.16, len);
      for (let z = z0 + 1.8; z < z1 - 1; z += 3.67) {
        const broken = rand() < 0.2;
        const h = broken ? 1 + rand() * 0.8 : SIDE_H;
        b.add(cyl, 'matte', th.trim, at(0.32), h / 2, z, 0.46, h, 0.46);
        for (const [ry, size] of [[0.12, 0.66], [h - 0.1, broken ? 0 : 0.7]]) if (size) b.add(box, 'matte', th.wall2, at(0.32), ry, z, size, 0.2, size);
        if (broken) b.add(cyl, 'matte', th.trim, at(0.9), 0.23, z + 0.8, 0.46, 1.2, 0.46, Math.PI / 2, 0.6, 0);
        // a banner between this column and the next
        if (z + 1.85 < z1 - 1) {
          b.add(box, 'matte', 0xa8261c, at(0.06), 1.55, z + 1.85, 0.04, 1.5, 0.9);
          b.add(box, 'metal', th.band, at(0.07), 2.32, z + 1.85, 0.05, 0.08, 1);
          b.add(disc, 'metal', th.band, at(0.09), 1.6, z + 1.85, 0.36, 0.03, 0.36, 0, 0, Math.PI / 2);
          b.add(cone, 'matte', 0xa8261c, at(0.06), 0.72, z + 1.85, 0.7, 0.3, 0.06, Math.PI, 0, 0);
        }
      }
      return;
    }
    if (id === 'bee') {
      // cells all over its face (some full of honey, some glowing), wax dripping, wax pillars
      for (let row = 0; row < 6; row++) {
        const y = 0.28 + row * 0.47;
        for (let z = z0 + 0.3 + (row % 2) * 0.27; z < z1 - 0.2; z += 0.54) cell(d, at(0), y, z, sx, 'x');
      }
      for (let z = z0 + 0.4; z < z1; z += 0.7 + rand() * 0.8) {
        const l = 0.3 + rand() * 0.8;
        b.add(ball, 'gloss', 0xffb020, at(0.08), SIDE_H - l / 2, z, 0.16, l, 0.16);
        b.add(ball, 'gloss', 0xffb020, at(0.1), SIDE_H - l, z, 0.2, 0.22, 0.2);
      }
      for (let z = z0 + 0.3; z < z1; z += 0.6) b.add(ball, 'gloss', th.wall2, at(0.05), SIDE_H + 0.05, z, 0.7, 0.35, 0.7);
      for (let z = z0 + 2.75; z < z1 - 1; z += 5.5) {
        b.add(hex, 'gloss', th.wall2, at(0.35), SIDE_H / 2, z, 0.75, SIDE_H, 0.75);
        b.add(hex, 'gloss', 0xc98a1a, at(0.35), 0.12, z, 0.95, 0.24, 0.95);
      }
      return;
    }
    if (id === 'crow') {
      // logs laid along it (their ends paler), wicker panels, nests along the top, perches with rooks on
      for (let row = 0; row < 7; row++) {
        b.add(log, 'matte', row % 2 ? th.wall : th.wall2, at(0.08), 0.2 + row * 0.39, mid, 0.42, len, 0.42, Math.PI / 2, 0, 0);
      }
      for (let z = z0 + 1.2; z < z1 - 1; z += 4.2) {
        // a wicker panel
        for (let k = 0; k < 7; k++) {
          for (const lean of [-0.7, 0.7]) b.add(cyl, 'matte', 0x8a7550, at(0.32), 1.2, z + (k - 3) * 0.22, 0.035, 1.9, 0.035, lean, 0, 0);
        }
        b.add(box, 'matte', 0x5a4a36, at(0.32), 1.2, z, 0.08, 2, 0.08);
      }
      for (let z = z0 + 2; z < z1 - 1; z += 3 + rand() * 2.5) nest(d, at(-0.1), SIDE_H + 0.05, z);
      for (let z = z0 + 3.2; z < z1 - 1; z += 5.3) {
        b.add(cyl, 'matte', th.trim, at(0.5), 2.1, z, 0.07, 1, 0.07, 0, 0, sx * Math.PI / 2);
        perched(d, at(0.75), 2.15, z, -sx);
      }
      return;
    }
    // the bog: mossy stones in rows, moss on top and spilling down, vines, shelf fungi
    for (let row = 0; row < 5; row++) {
      for (let z = z0 + (row % 2) * 0.5; z < z1 - 0.05;) {
        const l = Math.min(z1 - z, 0.8 + rand() * 0.6);
        b.add(box, 'matte', rand() < 0.5 ? th.wall : th.wall2, at(rand() * 0.06), 0.28 + row * 0.55, z + l / 2, 0.14, 0.52, l * 0.95, 0, 0, 0, 0.1);
        z += l;
      }
    }
    b.add(box, 'matte', th.trim, x, SIDE_H + 0.08, mid, T + 0.5, 0.18, len);
    for (let z = z0 + 0.4; z < z1; z += 0.6 + rand() * 0.7) {
      b.add(box, 'matte', 0x4f7a2e, at(0.02), SIDE_H - 0.3 - rand() * 0.4, z, 0.08, 0.5 + rand() * 0.9, 0.35 + rand() * 0.4);
      if (rand() < 0.45) {
        const l = 0.8 + rand() * 1.4;
        b.add(cyl, 'matte', 0x3f6a2a, at(0.12), SIDE_H - l / 2, z, 0.03, l, 0.03);
        for (let k = 0; k < 3; k++) b.add(ball, 'matte', 0x5f9a3a, at(0.15), SIDE_H - l * (0.3 + k * 0.3), z + (k % 2 ? 0.06 : -0.06), 0.12, 0.06, 0.1);
      }
      if (rand() < 0.2) b.add(disc, 'glow', th.light, at(0.15), 0.6 + rand() * 1.4, z, 0.4, 0.06, 0.3, 0, 0, 0, 0.15);
    }
  }

  // The near wall: low, a ledge and stones (the camera looks in over it)
  function nearWall(d, z) {
    const { th, b, ax, rand, id } = d;
    b.add(box, 'matte', id === 'lion' ? th.wall2 : th.wall, ax, 0.25, z, ROOM_W + 2 * T, 0.5, T);
    b.add(box, 'matte', th.trim, ax, 0.55, z, ROOM_W + 2 * T + 0.1, 0.1, T + 0.1);
    for (let x = ax - ROOM_W / 2; x < ax + ROOM_W / 2; x += 0.9 + rand() * 0.6) b.add(rock, 'matte', th.rock, x, 0.62, z + (rand() - 0.5) * 0.3, 0.35, 0.18, 0.3, 0, rand() * 3, 0, 0.2);
  }

  // A low wall across, between two rooms, `w` long, its middle at x, z
  function crossWall(d, x, z, w) {
    const { th, b, id, rand } = d;
    if (id === 'crow') {
      for (let row = 0; row < 3; row++) b.add(log, 'matte', row % 2 ? th.wall : th.wall2, x, 0.21 + row * 0.4, z, 0.42, w, 0.42, 0, 0, Math.PI / 2);
      return;
    }
    if (id === 'bee') {
      b.add(box, 'gloss', th.wall, x, MID_H / 2, z, w, MID_H, T * 0.8);
      for (const side of [-1, 1]) {
        for (let row = 0; row < 2; row++) {
          for (let cx = x - w / 2 + 0.3 + (row % 2) * 0.27; cx < x + w / 2 - 0.2; cx += 0.54) cell(d, cx, 0.32 + row * 0.47, z + (side * T) / 2, side, 'z');
        }
      }
      for (let cx = x - w / 2 + 0.3; cx < x + w / 2; cx += 0.55) b.add(ball, 'gloss', th.wall2, cx, MID_H + 0.05, z, 0.6, 0.3, 0.7);
      return;
    }
    const stone = id === 'parsnip' ? 0x6c665e : th.wall;
    for (let row = 0; row < 2; row++) {
      for (let cx = x - w / 2 + (row % 2) * 0.4; cx < x + w / 2 - 0.05;) {
        const l = Math.min(x + w / 2 - cx, 0.7 + rand() * 0.5);
        b.add(box, 'matte', rand() < 0.5 ? stone : id === 'parsnip' ? 0x5c5750 : th.wall2, cx + l / 2, 0.32 + row * 0.62, z, l * 0.96, 0.6, T, 0, 0, 0, 0.1);
        cx += l;
      }
    }
    b.add(box, 'matte', th.trim, x, MID_H + 0.06, z, w + 0.04, 0.14, T + 0.12);
    if (id === 'toad') for (let cx = x - w / 2 + 0.3; cx < x + w / 2; cx += 0.7) b.add(box, 'matte', 0x4f7a2e, cx, MID_H + 0.17, z + (rand() - 0.5) * 0.2, 0.5, 0.1, T + 0.1);
  }

  // The arch over a gate (each dungeon's own), its middle at x, z
  function gateArch(d, x, z) {
    const { th, b, id } = d;
    const px = DOOR_W / 2 + 0.25;
    if (id === 'bee') {
      // a hexagon of wax round the door
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = 1.55;
        b.add(box, 'gloss', th.wall2, x + Math.sin(a + Math.PI / 6) * r, 1.3 + Math.cos(a + Math.PI / 6) * r, z, 0.35, r * 1.05, 0.5, 0, 0, -(a + Math.PI / 6));
      }
      return;
    }
    for (const sx of [-1, 1]) {
      if (id === 'crow') {
        b.add(cyl, 'matte', 0x3d3226, x + sx * px, 1.2, z, 0.22, 2.4, 0.22, 0, 0, sx * 0.06);
      } else if (id === 'toad') {
        b.add(box, 'matte', th.wall2, x + sx * px, 1.15, z, 0.5, 2.3, T + 0.15);
        b.add(box, 'matte', 0x4f7a2e, x + sx * px, 2.32, z, 0.55, 0.12, T + 0.2);
      } else {
        b.add(box, 'matte', th.trim, x + sx * px, 1.15, z, 0.45, 2.3, T + 0.15);
        b.add(box, 'matte', id === 'lion' ? th.wall2 : th.band, x + sx * px, 0.1, z, 0.6, 0.2, T + 0.25);
      }
    }
    if (id === 'parsnip') {
      b.add(box, 'matte', th.trim, x, 2.4, z, DOOR_W + 1.1, 0.3, T + 0.2);
      lantern(d, x, 2.05, z + 0.4);
    } else if (id === 'lion') {
      b.add(arch, 'matte', th.trim, x, 2.25, z, DOOR_W + 0.9, DOOR_W + 0.9, 3.5);
      b.add(ball, 'metal', th.band, x, 2.25 + (DOOR_W + 0.9) / 2, z + 0.15, 0.5, 0.45, 0.25);
    } else if (id === 'crow') {
      b.add(arch, 'matte', 0x3d3226, x, 2.3, z, DOOR_W + 0.55, DOOR_W * 0.7, 2.2);
      for (let k = -1; k <= 1; k++) b.add(box, 'matte', 0x1a1a1f, x + k * 0.2, 2.3 + DOOR_W * 0.35, z + 0.12, 0.06, 0.4, 0.02, 0, 0, k * 0.5);
    } else {
      b.add(arch, 'matte', 0x5a4a30, x, 2.25, z, DOOR_W + 0.6, DOOR_W * 0.75, 2.5);
      for (let k = 0; k < 5; k++) b.add(cyl, 'matte', 0x3f6a2a, x + (k - 2) * 0.45, 2.3, z + 0.1, 0.03, 0.4 + (k % 2) * 0.5, 0.03);
    }
  }

  // a wax cell of the honeycomb, on a wall at x, y, z facing `side` along `axis`
  function cell(d, x, y, z, side, axis) {
    const { b, th, rand } = d;
    const [rx, rz] = axis === 'x' ? [0, Math.PI / 2] : [Math.PI / 2, 0];
    const [dx, dz] = axis === 'x' ? [-side, 0] : [0, side];
    b.add(hex, 'gloss', th.wall2, x + dx * 0.04, y, z + dz * 0.04, 0.5, 0.08, 0.5, rx, 0, rz, 0.06);
    const pick = rand();
    const fill = pick < 0.25 ? ['gloss', 0xffa810] : pick < 0.33 ? ['glow', 0xffd060] : ['matte', 0x6a420e];
    b.add(hex, fill[0], fill[1], x + dx * 0.07, y, z + dz * 0.07, 0.38, 0.05, 0.38, rx, 0, rz, 0.1);
  }

  // a nest of sticks, with blue eggs in some
  function nest(d, x, y, z, size = 1) {
    const { b, rand } = d;
    b.add(ring, 'matte', 0x7a6a50, x, y + 0.1 * size, z, 0.8 * size, 0.8 * size, 1.4 * size, Math.PI / 2, 0, 0);
    b.add(disc, 'matte', 0x3d3226, x, y + 0.06 * size, z, 0.65 * size, 0.08 * size, 0.65 * size);
    for (let i = 0; i < 6; i++) b.add(cyl, 'matte', 0x8a7550, x + (rand() - 0.5) * 0.6 * size, y + 0.14 * size, z + (rand() - 0.5) * 0.6 * size, 0.025, 0.6 * size, 0.025, Math.PI / 2, rand() * 3, 0);
    if (rand() < 0.7) for (let i = 0; i < 1 + Math.floor(rand() * 3); i++) b.add(ball, 'gloss', 0x9fc6d9, x + (i - 1) * 0.16 * size, y + 0.2 * size, z + (rand() - 0.5) * 0.15 * size, 0.14 * size, 0.18 * size, 0.14 * size);
  }

  // a rook sat on a perch, facing `face` (+1: +x)
  function perched(d, x, y, z, face) {
    const { b } = d;
    b.add(ball, 'matte', 0x26282e, x, y + 0.2, z, 0.3, 0.32, 0.42, 0, face * Math.PI / 2, 0);
    b.add(ball, 'matte', 0x26282e, x + face * 0.14, y + 0.4, z, 0.22, 0.22, 0.22);
    b.add(cone, 'matte', 0xc9ccd1, x + face * 0.3, y + 0.38, z, 0.08, 0.2, 0.08, 0, 0, -face * Math.PI / 2);
    b.add(ball, 'glow', 0xfff0c0, x + face * 0.2, y + 0.45, z + 0.08, 0.04, 0.04, 0.04, 0, 0, 0, 0);
    b.add(box, 'matte', 0x1c1d22, x - face * 0.24, y + 0.15, z, 0.24, 0.04, 0.2, 0, 0, face * 0.4);
  }

  // ---------- Floors ----------
  function floor(d, r, k) {
    const { th, b, rand, id } = d;
    const cx = (r.x0 + r.x1) / 2;
    if (id === 'parsnip') {
      // packed earth, a boardwalk down the middle, straw and pebbles
      for (let i = 0; i < 30; i++) b.add(box, 'matte', 0x3f2d1e, r.x0 + 0.5 + rand() * (ROOM_W - 1), 0.01, r.z0 + 0.5 + rand() * (ROOM_D - 1), 0.6 + rand(), 0.02, 0.6 + rand(), 0, rand() * 3, 0, 0.15);
      for (let z = r.z0 + 0.25; z < r.z1 - 0.1; z += 0.45) b.add(box, 'matte', 0x8a5a32, cx + (rand() - 0.5) * 0.08, 0.04, z, 2.4, 0.06, 0.4, 0, (rand() - 0.5) * 0.04, 0, 0.12);
      for (const sx of [-1, 1]) b.add(box, 'matte', 0x5a3d25, cx + sx * 1.15, 0.06, (r.z0 + r.z1) / 2, 0.1, 0.05, ROOM_D - 0.2);
      for (let i = 0; i < 16; i++) b.add(box, 'matte', 0xd9b45a, r.x0 + 0.8 + rand() * (ROOM_W - 1.6), 0.03, r.z0 + 0.6 + rand() * (ROOM_D - 1.2), 0.06, 0.02, 0.45, 0, rand() * Math.PI, 0, 0.15);
      for (let i = 0; i < 20; i++) b.add(rock, 'matte', 0x7a746a, r.x0 + 0.5 + rand() * (ROOM_W - 1), 0.03, r.z0 + 0.5 + rand() * (ROOM_D - 1), 0.12, 0.08, 0.1, 0, rand() * 3, 0, 0.2);
    } else if (id === 'lion') {
      // flagstones, a red runner down the middle with gold edges, sand drifting in by the walls
      for (let x = r.x0 + 0.5; x < r.x1; x += 1) {
        for (let z = r.z0 + 0.5; z < r.z1; z += 1) {
          const cracked = rand() < 0.08;
          b.add(box, 'matte', cracked ? 0xb89c68 : th.floor, x, cracked ? -0.01 : 0.02, z, 0.96, 0.06, 0.96, 0, 0, 0, 0.07);
        }
      }
      b.add(box, 'matte', 0x9a2418, cx, 0.06, (r.z0 + r.z1) / 2, 1.8, 0.02, ROOM_D - 0.6, 0, 0, 0, 0);
      for (const sx of [-1, 1]) b.add(box, 'metal', th.band, cx + sx * 0.85, 0.075, (r.z0 + r.z1) / 2, 0.1, 0.02, ROOM_D - 0.6, 0, 0, 0, 0);
      for (let i = 0; i < 8; i++) {
        const sx = rand() < 0.5 ? -1 : 1;
        b.add(ball, 'matte', 0xe8d39a, cx + sx * (ROOM_W / 2 - 0.5 - rand() * 0.8), 0, r.z0 + 0.6 + rand() * (ROOM_D - 1.2), 1.4 + rand(), 0.35, 1 + rand(), 0, rand() * 3, 0, 0.05);
      }
    } else if (id === 'bee') {
      // a floor of wax cells, honey in some, a few glowing
      const R = 0.5;
      const w = Math.sqrt(3) * R;
      for (let row = 0; row * 1.5 * R < ROOM_D; row++) {
        const z = r.z0 + 0.3 + row * 1.5 * R;
        for (let x = r.x0 + 0.4 + (row % 2) * (w / 2); x < r.x1 - 0.3; x += w) {
          const pick = rand();
          b.add(hex, pick < 0.12 ? 'gloss' : 'matte', pick < 0.12 ? 0xffa810 : pick < 0.5 ? th.floor : 0xf2c860, x, 0.02, z, R * 1.9, 0.06, R * 1.9, 0, Math.PI / 6, 0, 0.06);
          if (pick > 0.985) b.add(hex, 'glow', 0xffd060, x, 0.06, z, R * 1.2, 0.04, R * 1.2, 0, Math.PI / 6, 0);
        }
      }
      for (let i = 0; i < 4; i++) b.add(disc, 'gloss', 0xffa810, r.x0 + 1 + rand() * (ROOM_W - 2), 0.06, r.z0 + 1 + rand() * (ROOM_D - 2), 0.8 + rand(), 0.02, 0.6 + rand() * 0.8);
    } else if (id === 'crow') {
      // boards along the room, straw, black feathers and fallen leaves
      for (let x = r.x0 + 0.3; x < r.x1; x += 0.6) b.add(box, 'matte', rand() < 0.5 ? th.floor : 0x2e2822, x, 0.02, (r.z0 + r.z1) / 2, 0.56, 0.05, ROOM_D - 0.1, 0, 0, 0, 0.08);
      for (let i = 0; i < 26; i++) {
        const what = i % 3;
        b.add(box, 'matte', what === 0 ? 0x111114 : what === 1 ? [0xc0662f, 0xd9a03a, 0x8a3a1a][i % 3] : 0xb89a5a, r.x0 + 0.6 + rand() * (ROOM_W - 1.2), 0.05, r.z0 + 0.6 + rand() * (ROOM_D - 1.2),
          what === 1 ? 0.22 : 0.06, 0.015, what === 1 ? 0.16 : 0.45, 0, rand() * Math.PI, 0, 0.1);
      }
    } else {
      // mud, murky water, stepping stones across it, lily pads and duckweed
      for (let i = 0; i < 6; i++) {
        const px = r.x0 + 1.5 + rand() * (ROOM_W - 3);
        const pz = r.z0 + 1.2 + rand() * (ROOM_D - 2.4);
        const s = 1.4 + rand() * 1.8;
        b.add(disc, 'water', 0x1f4a42, px, 0.02, pz, s, 0.02, s * (0.6 + rand() * 0.4), 0, rand() * 3, 0, 0.05);
        for (let k = 0; k < 3; k++) if (rand() < 0.7) b.add(disc, 'matte', 0x4f9e3c, px + (rand() - 0.5) * s * 0.6, 0.04, pz + (rand() - 0.5) * s * 0.4, 0.4, 0.02, 0.4, 0, rand() * 3, 0, 0.15);
        if (rand() < 0.5) b.add(ball, 'matte', 0xffb8d0, px, 0.1, pz, 0.14, 0.1, 0.14);
        for (let k = 0; k < 6; k++) b.add(disc, 'matte', 0x7ab83a, px + (rand() - 0.5) * s * 0.7, 0.035, pz + (rand() - 0.5) * s * 0.5, 0.06, 0.01, 0.06);
      }
      for (let z = r.z0 + 0.8; z < r.z1 - 0.3; z += 1.3) b.add(rock, 'matte', 0x7a7a6c, (r.x0 + r.x1) / 2 + (rand() - 0.5) * 1.6, 0.05, z, 0.8, 0.18, 0.7, 0, rand() * 3, 0, 0.12);
    }
  }

  // ---------- What stands about a room ----------
  // Lamps along its side walls, and things by them (out of the middle, where the foes go)
  function dressing(d, r, k) {
    const { rand } = d;
    for (const sx of [-1, 1]) {
      const wallX = sx < 0 ? r.x0 : r.x1;
      for (const z of [r.z0 + 2.6, r.z1 - 3]) lamp(d, wallX, z, sx);
      for (const z of [r.z0 + 1.2 + rand() * 0.6, (r.z0 + r.z1) / 2 + (rand() - 0.5), r.z1 - 1.4 - rand() * 0.6]) prop(d, wallX - sx * 0.8, z, sx, k);
    }
  }

  // A flame (it flickers: update()), and the pool of light it makes
  function flame(d, x, y, z, size = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const outer = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: d.th.light, transparent: true, opacity: 0.9 }));
    outer.scale.set(0.16 * size, 0.34 * size, 0.16 * size);
    outer.position.y = 0.15 * size;
    const inner = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    inner.scale.set(0.08 * size, 0.2 * size, 0.08 * size);
    inner.position.y = 0.1 * size;
    g.add(outer, inner);
    g.userData.phase = d.rand() * 10;
    d.group.add(g);
    d.flames.push(g);
  }

  // a lantern hanging at x, y, z: a frame, its glass lit, a flame in it
  function lantern(d, x, y, z, color = d.th.light) {
    const { b } = d;
    b.add(box, 'metal', 0x3a3632, x, y + 0.2, z, 0.26, 0.05, 0.26);
    b.add(cone, 'metal', 0x3a3632, x, y + 0.3, z, 0.3, 0.16, 0.3);
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(box, 'metal', 0x3a3632, x + ox * 0.11, y, z + oz * 0.11, 0.03, 0.4, 0.03);
    b.add(box, 'glow', color, x, y, z, 0.18, 0.3, 0.18, 0, 0, 0, 0);
    b.add(box, 'metal', 0x3a3632, x, y - 0.2, z, 0.26, 0.05, 0.26);
  }

  function lamp(d, wallX, z, sx) {
    const { th, b, id, rand } = d;
    const x = wallX - sx * 0.35; // (by the wall)
    if (id === 'parsnip') {
      // a lantern hanging off the beam on a chain
      b.add(cyl, 'metal', 0x3a3632, x, SIDE_H - 0.35, z, 0.02, 0.5, 0.02);
      lantern(d, x, SIDE_H - 0.85, z);
      b.pool(th.light, x - sx * 1.2, z, 4.2);
      b.pool(th.light, x, z, 2, 1.5);
    } else if (id === 'lion') {
      // a brazier on a stand, a fire in it
      const bx = x - sx * 0.35;
      for (let i = 0; i < 3; i++) b.add(cyl, 'metal', 0x5a3a20, bx + Math.sin(i * 2.1) * 0.18, 0.45, z + Math.cos(i * 2.1) * 0.18, 0.05, 0.95, 0.05, Math.cos(i * 2.1) * 0.2, 0, -Math.sin(i * 2.1) * 0.2);
      b.add(cyl, 'metal', 0x8a5a2a, bx, 0.98, z, 0.62, 0.2, 0.62);
      b.add(cyl, 'glow', 0xff6a1a, bx, 1.07, z, 0.5, 0.04, 0.5);
      flame(d, bx, 1.05, z, 1.8);
      b.pool(th.light, bx - sx * 0.5, z, 5);
    } else if (id === 'bee') {
      // a ball of glowing honey in a wax cup on a stalk
      b.add(cyl, 'gloss', th.wall2, x, 0.6, z, 0.14, 1.2, 0.14);
      b.add(cyl, 'gloss', th.wall2, x, 1.25, z, 0.5, 0.18, 0.5);
      b.add(ball, 'glow', 0xffc040, x, 1.42, z, 0.42, 0.38, 0.42);
      b.pool(th.light, x - sx * 0.8, z, 4.5);
    } else if (id === 'crow') {
      // a bird cage hanging, cold light in it
      const y = SIDE_H - 1.1;
      b.add(cyl, 'metal', 0x3a3632, x, SIDE_H - 0.3, z, 0.02, 0.5, 0.02);
      b.add(cone, 'metal', 0x3a3632, x, y + 0.45, z, 0.5, 0.25, 0.5);
      b.add(disc, 'metal', 0x3a3632, x, y - 0.3, z, 0.5, 0.05, 0.5);
      for (let i = 0; i < 8; i++) b.add(cyl, 'metal', 0x3a3632, x + Math.sin(i * 0.785) * 0.23, y + 0.06, z + Math.cos(i * 0.785) * 0.23, 0.015, 0.72, 0.015);
      b.add(ball, 'glow', 0xd8e4ff, x, y, z, 0.24, 0.24, 0.24);
      b.pool(th.light, x - sx * 1, z, 4.2);
    } else {
      // glowing toadstools, fireflies about them
      for (let i = 0; i < 3; i++) {
        const mx = x - sx * (0.1 + i * 0.3);
        const mz = z + (i - 1) * 0.4;
        const h = 0.3 + (2 - i) * 0.25;
        b.add(cyl, 'matte', 0xe8e0c8, mx, h / 2, mz, 0.1, h, 0.1);
        b.add(ball, 'glow', th.light, mx, h, mz, 0.5 - i * 0.1, 0.22, 0.5 - i * 0.1, 0, 0, 0, 0.1);
      }
      b.pool(th.light, x - sx * 0.8, z, 4);
      for (let i = 0; i < 3; i++) {
        const fly = new THREE.Mesh(ball, KINDS.glow);
        fly.scale.setScalar(0.06);
        fly.userData.home = new THREE.Vector3(x - sx * (0.8 + rand()), 0.8 + rand(), z);
        fly.userData.phase = rand() * 10;
        d.group.add(fly);
        d.flies.push(fly);
      }
    }
  }

  // Something along a wall, at x, z (sx: which wall), in room k
  function prop(d, x, z, sx, k) {
    const { b, rand, id, th } = d;
    const pick = Math.floor(rand() * 4);
    if (id === 'parsnip') {
      if (pick === 0) {
        // crates, slats on them
        for (const [oy, s] of [[0.35, 0.7], ...(rand() < 0.6 ? [[0.95, 0.5]] : [])]) {
          const ry = rand() * 0.4;
          b.add(box, 'matte', 0xa8713f, x, oy, z, s, s, s, 0, ry, 0);
          for (const y of [-0.3, 0.3]) b.add(box, 'matte', 0x7a4f28, x, oy + y * s, z, s + 0.03, 0.06, s + 0.03, 0, ry, 0);
        }
      } else if (pick === 1) {
        // sacks, one slumped
        for (let i = 0; i < 3; i++) b.add(ball, 'matte', 0xd9c48a, x + (i === 2 ? -sx * 0.4 : 0), i === 2 ? 0.22 : 0.32, z + (i - 0.8) * 0.5, 0.55, i === 2 ? 0.45 : 0.65, 0.48, 0, 0, i === 2 ? 0.6 : 0);
      } else if (pick === 2) {
        // barrels, hooped
        for (let i = 0; i < 2; i++) {
          const bz = z + (i - 0.5) * 0.75;
          b.add(cyl, 'matte', 0x8a5a32, x, 0.45, bz, 0.62, 0.9, 0.62);
          for (const y of [0.18, 0.72]) b.add(cyl, 'metal', 0x3a3632, x, y, bz, 0.66, 0.05, 0.66);
        }
      } else {
        // shelves of jars
        for (const y of [0.55, 1.2]) {
          b.add(box, 'matte', 0x7a4f28, x + sx * 0.3, y, z, 0.4, 0.05, 1.4);
          for (let i = 0; i < 4; i++) {
            const glowing = rand() < 0.2;
            b.add(cyl, glowing ? 'glow' : 'gloss', glowing ? 0xc8ff70 : [0x7a9a3a, 0xc08030, 0xa04030][i % 3], x + sx * 0.3, y + 0.15, z + (i - 1.5) * 0.32, 0.2, 0.26, 0.2);
          }
        }
        for (const oz of [-0.65, 0.65]) b.add(box, 'matte', 0x5a3d25, x + sx * 0.3, 0.7, z + oz, 0.4, 1.4, 0.05);
      }
    } else if (id === 'lion') {
      if (pick === 0) {
        // an urn
        b.add(ball, 'matte', 0xc0662f, x, 0.4, z, 0.6, 0.8, 0.6);
        b.add(cyl, 'matte', 0xa8521f, x, 0.85, z, 0.26, 0.2, 0.26);
        b.add(disc, 'matte', 0x2a1a10, x, 0.4, z, 0.62, 0.08, 0.62);
      } else if (pick === 1) {
        // a lion on a plinth
        b.add(box, 'matte', th.wall2, x, 0.35, z, 0.7, 0.7, 0.7);
        b.add(ball, 'metal', th.band, x, 0.95, z, 0.6, 0.5, 0.32);
        b.add(ball, 'metal', 0xffd27a, x - sx * 0.1, 0.95, z, 0.34, 0.34, 0.3);
      } else if (pick === 2) {
        // a fallen bit of column
        b.add(cyl, 'matte', th.trim, x, 0.24, z, 0.48, 1.3, 0.48, Math.PI / 2, rand() * 0.6, 0);
        b.add(rock, 'matte', th.wall2, x + 0.3, 0.12, z + 0.6, 0.35, 0.25, 0.3);
      } else {
        // dry grass in a pot
        b.add(cyl, 'matte', 0xb8561a, x, 0.25, z, 0.5, 0.5, 0.5);
        for (let i = 0; i < 6; i++) b.add(cone, 'matte', 0xc9b05a, x + (rand() - 0.5) * 0.3, 0.75, z + (rand() - 0.5) * 0.3, 0.1, 0.7, 0.1, (rand() - 0.5) * 0.7, 0, (rand() - 0.5) * 0.7);
      }
    } else if (id === 'bee') {
      if (pick === 0) {
        // a honey pot, a dipper in it, honey running down
        b.add(ball, 'matte', 0xb86a2a, x, 0.32, z, 0.66, 0.64, 0.66);
        b.add(cyl, 'gloss', 0xffa810, x, 0.6, z, 0.4, 0.06, 0.4);
        b.add(ball, 'gloss', 0xffa810, x + 0.22, 0.42, z, 0.12, 0.3, 0.12);
        b.add(cyl, 'matte', 0xd9a066, x + 0.05, 0.8, z, 0.04, 0.5, 0.04, 0, 0, 0.3);
      } else if (pick === 1) {
        // a big flower
        b.add(cyl, 'matte', 0x4f9e3c, x, 0.6, z, 0.06, 1.2, 0.06);
        b.add(ball, 'matte', 0x5aa83c, x + 0.15, 0.4, z, 0.3, 0.05, 0.14, 0, 0, 0.5);
        for (let i = 0; i < 6; i++) b.add(ball, 'matte', [0xf28cb1, 0xffffff, 0xb06fd0][k % 3], x + Math.sin(i * 1.05) * 0.24, 1.2, z + Math.cos(i * 1.05) * 0.24, 0.28, 0.08, 0.28);
        b.add(ball, 'glow', 0xffd84a, x, 1.23, z, 0.2, 0.12, 0.2);
      } else if (pick === 2) {
        // a heap of pollen
        b.add(ball, 'matte', 0xffd23f, x, 0.05, z, 1.1, 0.4, 0.9);
        b.add(ball, 'matte', 0xffe070, x + 0.2, 0.18, z, 0.5, 0.25, 0.4);
      } else {
        // a lump of comb
        for (let i = 0; i < 4; i++) b.add(hex, i % 3 ? 'gloss' : 'glow', i % 3 ? th.wall2 : 0xffc040, x + (i % 2) * 0.3, 0.18 + Math.floor(i / 2) * 0.32, z + (i - 1.5) * 0.15, 0.36, 0.3, 0.36);
      }
    } else if (id === 'crow') {
      if (pick === 0 && k !== 0) {
        // a scarecrow, in a ragged coat
        b.add(cyl, 'matte', 0x7a5a3a, x, 0.85, z, 0.08, 1.7, 0.08);
        b.add(cyl, 'matte', 0x7a5a3a, x, 1.3, z, 0.06, 1.2, 0.06, Math.PI / 2, 0, 0);
        b.add(box, 'matte', 0x4a3a5a, x, 1.12, z, 0.38, 0.6, 0.32);
        for (const oz of [-0.5, 0.5]) b.add(cone, 'matte', 0xd9b45a, x, 1.2, z + oz, 0.12, 0.25, 0.12, Math.PI / 2 * Math.sign(oz), 0, 0);
        b.add(ball, 'matte', 0xd9a03a, x, 1.6, z, 0.34, 0.32, 0.34);
        b.add(cone, 'matte', 0x2f2a24, x, 1.85, z, 0.48, 0.32, 0.48);
        b.add(disc, 'matte', 0x2f2a24, x, 1.72, z, 0.62, 0.03, 0.62);
      } else if (pick === 1) {
        nest(d, x, 0, z);
      } else if (pick === 2) {
        // sheaves of wheat, leant together
        for (let i = 0; i < 3; i++) b.add(cyl, 'matte', 0xd9b45a, x + (i - 1) * 0.2, 0.5, z, 0.22, 1, 0.22, 0, 0, (i - 1) * 0.25);
        b.add(box, 'matte', 0x8a5a32, x, 0.5, z, 0.6, 0.06, 0.25);
      } else {
        // trinkets the rooks brought home, glinting
        for (let i = 0; i < 6; i++) b.add(disc, 'metal', 0xffd84a, x + (rand() - 0.5) * 0.6, 0.03 + i * 0.015, z + (rand() - 0.5) * 0.6, 0.18, 0.03, 0.18);
        b.add(box, 'metal', 0xd6d4cc, x, 0.05, z + 0.2, 0.05, 0.03, 0.35, 0, rand(), 0);
        b.add(box, 'glow', 0xe8f0ff, x - 0.15, 0.08, z - 0.2, 0.12, 0.02, 0.18, 0.3, rand(), 0);
      }
    } else {
      if (pick === 0) {
        // reeds and cattails
        for (let i = 0; i < 7; i++) {
          const rx = x + (rand() - 0.5) * 0.7;
          const rz = z + (rand() - 0.5) * 0.7;
          const h = 0.8 + rand() * 0.8;
          b.add(cyl, 'matte', 0x4f8a36, rx, h / 2, rz, 0.04, h, 0.04, (rand() - 0.5) * 0.2, 0, (rand() - 0.5) * 0.2);
          if (i % 2) b.add(cyl, 'matte', 0x6b4426, rx, h + 0.1, rz, 0.09, 0.24, 0.09);
        }
      } else if (pick === 1) {
        // a mossy log, a mushroom on it
        b.add(log, 'matte', 0x5a4a30, x, 0.28, z, 0.56, 1.6, 0.56, Math.PI / 2, 0, 0);
        b.add(box, 'matte', 0x5f8a36, x, 0.54, z, 0.32, 0.06, 1.2);
        b.add(disc, 'glow', th.light, x + sx * 0.25, 0.4, z + 0.3, 0.3, 0.05, 0.22, 0, 0, sx * 0.3);
      } else if (pick === 2) {
        // a big toadstool
        b.add(cyl, 'matte', 0xe8e0c8, x, 0.4, z, 0.2, 0.8, 0.2);
        b.add(ball, 'matte', 0xb83a2a, x, 0.82, z, 0.9, 0.42, 0.9);
        for (let i = 0; i < 5; i++) b.add(ball, 'matte', 0xffffff, x + Math.sin(i * 1.3) * 0.28, 0.98, z + Math.cos(i * 1.3) * 0.28, 0.1, 0.05, 0.1);
      } else {
        // a stone, mossy on top
        b.add(rock, 'matte', 0x6c6b66, x, 0.25, z, 0.9, 0.55, 0.8);
        b.add(ball, 'matte', 0x5f8a36, x, 0.45, z, 0.65, 0.14, 0.55);
      }
    }
  }

  // ---------- Gates ----------
  // the gate out of room k: bars across the door (each dungeon's own), and
  // what stops a farmer while it is shut
  function makeGate(d, x, z, k) {
    const { th, id } = d;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    d.group.add(g);
    const add = (geo, color, gx, gy, gz, w, h, dd, rx = 0, ry = 0, rz = 0, extra = {}) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra }));
      mesh.position.set(gx, gy, gz);
      mesh.scale.set(w, h, dd);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      g.add(mesh);
    };
    if (id === 'bee') {
      // a wall of wax cells
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 5; i++) add(hex, th.gate, (i - 2) * 0.48 + (row % 2) * 0.24 - 0.12, 0.3 + row * 0.5, 0, 0.5, 0.2, 0.5, Math.PI / 2, 0, 0);
      }
      add(box, 0xffa810, 0, 0.8, 0, DOOR_W - 0.1, 1.5, 0.1, 0, 0, 0, { emissive: 0xff9000, emissiveIntensity: 0.4 });
    } else if (id === 'lion') {
      // a sandstone slab, a golden sun on it
      add(box, th.gate, 0, GATE_H / 2, 0, DOOR_W, GATE_H, 0.3);
      add(disc, th.band, 0, GATE_H / 2 + 0.1, 0.16, 0.7, 0.05, 0.7, Math.PI / 2, 0, 0, { metalness: 0.6, roughness: 0.35 });
      for (let i = 0; i < 8; i++) add(box, th.band, Math.sin(i * 0.785) * 0.5, GATE_H / 2 + 0.1 + Math.cos(i * 0.785) * 0.5, 0.16, 0.06, 0.2, 0.04, 0, 0, -i * 0.785, { metalness: 0.6, roughness: 0.35 });
    } else if (id === 'crow') {
      // a lattice of sticks, lashed
      for (let i = 0; i < 5; i++) {
        for (const lean of [-0.6, 0.6]) add(cyl, th.gate, (i - 2) * 0.5, GATE_H / 2, 0, 0.07, GATE_H * 1.15, 0.07, 0, 0, lean);
      }
      add(box, 0x2f2a24, 0, GATE_H - 0.1, 0, DOOR_W, 0.1, 0.12);
    } else if (id === 'toad') {
      // a fence of reeds, tied
      for (let i = 0; i < 9; i++) add(cyl, i % 2 ? 0x4f8a36 : 0x6b8a3a, (i - 4) * 0.27, GATE_H / 2, 0, 0.1, GATE_H * (0.9 + (i % 3) * 0.05), 0.1);
      for (const y of [0.4, GATE_H * 0.7]) add(box, th.gate, 0, y, 0, DOOR_W, 0.08, 0.14);
    } else {
      // a portcullis of planks, iron bands across, studs
      for (let i = 0; i < 5; i++) add(box, i % 2 ? 0x7a4f28 : 0x6b4426, (i - 2) * 0.46, GATE_H / 2, 0, 0.42, GATE_H, 0.12);
      for (const y of [0.35, GATE_H - 0.35]) {
        add(box, th.band, 0, y, 0.03, DOOR_W, 0.12, 0.14, 0, 0, 0, { metalness: 0.6, roughness: 0.4 });
        for (let i = 0; i < 5; i++) add(ball, 0x8a8680, (i - 2) * 0.46, y, 0.11, 0.06, 0.06, 0.04, 0, 0, 0, { metalness: 0.6, roughness: 0.4 });
      }
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
    const stone = new THREE.MeshStandardMaterial({ color: 0x9c9a92, roughness: 0.9, flatShading: true });
    const add = (geo, material, x, y, z, w, h, d) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      door.add(mesh);
      return mesh;
    };
    add(box, stone, 0, 0.06, 0, 1.6, 0.12, 0.6);
    for (const x of [-0.65, 0.65]) add(box, stone, x, 1.1, 0, 0.24, 2.2, 0.36);
    add(box, stone, 0, 2.3, 0, 1.6, 0.24, 0.42);
    const swirl = new THREE.Group();
    swirl.position.set(0, 1.15, 0);
    door.add(swirl);
    const glowMat = (color) => new THREE.MeshBasicMaterial({ color });
    const disk = new THREE.Mesh(ball, glowMat(th.swirl[0]));
    disk.scale.set(1.06, 2.05, 0.06);
    swirl.add(disk);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(box, glowMat(th.swirl[1]));
      arm.scale.set(0.07, 0.7, 0.02);
      arm.rotation.z = (i * Math.PI * 2) / 3;
      arm.position.set(-Math.sin(arm.rotation.z) * 0.24, Math.cos(arm.rotation.z) * 0.24, 0.05);
      swirl.add(arm);
    }
    return swirl;
  }

  // ---------- The dark past a shut gate ----------
  // A wall of black from just past the gate, as high and wide and deep as can
  // be seen (drawn last, over everything behind it: the rooms beyond, their
  // lamps, the cavern, the arena), the cavern's rock either side darkening
  // into it over the last few metres before it (thin sheets of dark, one
  // behind another); and a second wall over the room a gate has just let
  // into, which fades away
  function makeDark(d) {
    const veil = (opacity = 1) => {
      const mesh = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: DARK, transparent: true, opacity, depthWrite: false, fog: false }));
      mesh.renderOrder = 10;
      mesh.frustumCulled = false;
      mesh.visible = false;
      d.group.add(mesh);
      return mesh;
    };
    const fade = FADE.flatMap((opacity) => [veil(opacity), veil(opacity)]);
    return { ahead: veil(), fade, lifting: veil(), shown: -1, liftAt: -Infinity };
  }

  // a veil over z from `near` back to `far` (-Infinity: on past the arena), the dungeon's whole width and more
  function cover(veil, id, near, far) {
    const { x } = ARENAS[id];
    const back = Number.isFinite(far) ? far : near - 160;
    veil.position.set(x, 5, (near + back) / 2);
    veil.scale.set(140, 80, near - back);
    veil.visible = true;
  }

  // the sheets of dark in front of it, out beside the dungeon (not over it): one every metre
  function fadeIn(fade, id, near, show) {
    const { x } = ARENAS[id];
    const out = ROOM_W / 2 + T + 0.6;
    fade.forEach((sheet, i) => {
      sheet.visible = show;
      if (!show) return;
      const side = i % 2 ? 1 : -1;
      sheet.position.set(x + side * (out + 35), 5, near + 1 + Math.floor(i / 2));
      sheet.scale.set(70, 80, 0.02);
    });
  }

  // Dark past the first shut gate (gate k is room k's: the next room's, and
  // on), the room the gate just opened lifting into sight. inside: we are
  // in the dungeon (from anywhere else, no veils)
  function darken(id, d, cleared, inside, t) {
    const { ahead, lifting } = d.dark;
    const edge = (k) => gateAt(id, k).z - T / 2 - 0.02; // (just past gate k)
    if (cleared > d.dark.shown && d.dark.shown >= 0 && inside) {
      // a gate opened: what it lets into lifts out of the dark
      cover(lifting, id, edge(d.dark.shown), cleared < ROOMS ? edge(cleared) : -Infinity);
      d.dark.liftAt = t;
    }
    d.dark.shown = inside ? cleared : -1;
    const dark = inside && cleared < ROOMS;
    if (dark) cover(ahead, id, edge(cleared), -Infinity);
    else ahead.visible = false;
    fadeIn(d.dark.fade, id, dark ? edge(cleared) : 0, dark);
    const k = (t - d.dark.liftAt) / LIFT_TIME;
    lifting.material.opacity = 1 - k;
    if (k >= 1 || !inside) lifting.visible = false;
  }

  // ---------- Motes in the air ----------
  // A few hundred specks drifting about the dungeon (rising or sinking, as its theme has them)
  function makeMotes(d) {
    const { th, rand, ax, zFar, zNear } = d;
    const positions = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      positions[i * 3] = ax + (rand() - 0.5) * ROOM_W;
      positions[i * 3 + 1] = rand() * 3;
      positions[i * 3 + 2] = zFar + rand() * (zNear - zFar);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: th.mote[0], size: 0.12, map: softGlow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    points.frustumCulled = false;
    d.group.add(points);
    return { points, rise: th.mote[1], phase: Array.from({ length: MOTES }, () => rand() * 10) };
  }

  // ---------- The foes ----------
  function foesOf(id) {
    const d = dungeons.get(id);
    if (!d.foes) {
      const count = DUNGEONS[id].foes.reduce((a, n) => a + n, 0);
      d.foes = Array.from({ length: count }, () => createFoe(id, d.group));
    }
    return d.foes;
  }

  return {
    // Every frame, for each dungeon: `near` (we are in it or its arena: it
    // is drawn), `inside` (in it: it is dark past its first shut gate), `run`
    // (as dungeonFromWire has it, the foes drawn where `shown` has them: { x,
    // y, z } each; null: fresh, every foe resting)
    update(dt, t, id, near, inside, run, shown) {
      const d = dungeons.get(id);
      d.group.visible = near;
      // the gates: open for the rooms cleared (whether or not it is drawn: they stop farmers)
      const cleared = run?.cleared ?? 0;
      for (const gate of d.gates) setGate(gate, gate.k < cleared);
      darken(id, d, cleared, inside && near, t);
      if (!near) return;
      for (const gate of d.gates) {
        gate.sink += ((gate.open ? 1 : 0) - gate.sink) * Math.min(1, (dt / SINK_TIME) * 3);
        gate.group.position.y = -gate.sink * (GATE_H + 0.1);
        gate.group.visible = gate.sink < 0.98;
      }
      d.swirl.rotation.z = -t * 2.2;
      for (const f of d.flames) {
        const p = f.userData.phase;
        const k = 1 + Math.sin(t * 13 + p) * 0.12 + Math.sin(t * 29 + p * 2) * 0.08;
        f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      }
      if (d.pools) d.pools.opacity = 0.5 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
      for (const fly of d.flies) {
        const { home, phase } = fly.userData;
        fly.position.set(home.x + Math.sin(t * 0.7 + phase) * 0.6, home.y + Math.sin(t * 1.3 + phase) * 0.25, home.z + Math.cos(t * 0.9 + phase) * 0.8);
      }
      // the motes drift (round again at the top, or the bottom)
      const { points, rise, phase } = d.motes;
      const pos = points.geometry.attributes.position;
      for (let i = 0; i < MOTES; i++) {
        let y = pos.getY(i) + rise * dt;
        if (y > 3.2) y = 0;
        else if (y < 0) y = 3.2;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.5 + phase[i]) * 0.1 * dt);
      }
      pos.needsUpdate = true;
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

// ---------- The rooms' set pieces ----------
// One in each room, out of the way of the middle: (d, r: the room's rect, k: which)
const SETPIECES = {
  parsnip(d, r, k) {
    const { b, rand } = d;
    const x = r.x0 + 2.2;
    const z = r.z0 + 2;
    if (k === 0) {
      // a heap of parsnips by a cart
      for (let i = 0; i < 14; i++) b.add(cone, 'matte', 0xf2e2b0, x + (rand() - 0.5) * 1.2, 0.15 + rand() * 0.35, z + (rand() - 0.5) * 1.2, 0.2, 0.55, 0.2, (rand() - 0.5) * 2.5, rand() * 3, (rand() - 0.5) * 2.5);
      for (let i = 0; i < 5; i++) b.add(ball, 'matte', 0x5aa83c, x + (rand() - 0.5), 0.55, z + (rand() - 0.5), 0.15, 0.28, 0.12, rand(), 0, rand());
      const cx = r.x1 - 2;
      b.add(box, 'matte', 0x8a5a32, cx, 0.65, z, 1, 0.45, 1.6);
      for (const oz of [-0.55, 0.55]) b.add(ring, 'matte', 0x5a3d25, cx + 0.55, 0.4, z + oz, 0.75, 0.75, 1.2, 0, Math.PI / 2, 0);
      for (let i = 0; i < 5; i++) b.add(cone, 'matte', 0xff8a2a, cx + (rand() - 0.5) * 0.6, 0.95, z + (rand() - 0.5) * 1.2, 0.14, 0.4, 0.14, Math.PI / 2, rand() * 3, 0);
    } else if (k === 1) {
      // a great root bursting up through the floor
      const rx = r.x1 - 2.2;
      const rz = r.z0 + 2.6;
      for (let i = 0; i < 5; i++) b.add(cyl, 'matte', 0x4a3220, rx + Math.sin(i * 1.3) * 0.3, 0.6 + i * 0.25, rz + i * 0.15, 0.55 - i * 0.07, 1.3, 0.55 - i * 0.07, 0.6 - i * 0.25, 0, Math.sin(i) * 0.5);
      for (let i = 0; i < 6; i++) b.add(cyl, 'matte', 0x4a3220, rx + Math.sin(i) * 1.2, 0.1, rz + Math.cos(i) * 1.2, 0.18, 1.4, 0.18, Math.PI / 2, i, 0);
      b.add(rock, 'matte', 0x5a3d25, rx, 0.05, rz, 2.4, 0.3, 2.2);
    } else {
      // a pickling vat, its brine glowing
      const vx = x;
      b.add(cyl, 'matte', 0x7a4f28, vx, 0.55, z, 1.5, 1.1, 1.5);
      for (const y of [0.2, 0.9]) b.add(cyl, 'metal', 0x3a3632, vx, y, z, 1.56, 0.06, 1.56);
      b.add(cyl, 'glow', 0xb8f070, vx, 1.08, z, 1.3, 0.04, 1.3);
      d.b.pool(0xb8f070, vx, z, 3.5, 1.15);
      for (let i = 0; i < 4; i++) b.add(cone, 'matte', 0xd8e8a0, vx + (rand() - 0.5) * 0.8, 1.15, z + (rand() - 0.5) * 0.8, 0.14, 0.4, 0.14, 2.6, rand() * 3, 0);
    }
  },
  lion(d, r, k) {
    const { b, th, rand } = d;
    const x = r.x0 + 2.4;
    const z = r.z0 + 2.4;
    if (k === 0) {
      // a lion statue, fallen apart, on its pedestal
      b.add(box, 'matte', th.wall2, x, 0.4, z, 1.6, 0.8, 1.2);
      b.add(box, 'matte', th.trim, x, 0.85, z, 1.4, 0.1, 1);
      b.add(ball, 'matte', th.trim, x, 1.35, z - 0.1, 1.1, 0.8, 0.7);
      b.add(ball, 'matte', th.wall2, x + 0.6, 0.2, z + 1, 0.9, 0.7, 0.6);
      b.add(ball, 'matte', 0xd9b77a, x + 0.6, 0.35, z + 1.05, 0.5, 0.5, 0.4);
      for (let i = 0; i < 5; i++) b.add(rock, 'matte', th.trim, x + (rand() - 0.5) * 2, 0.1, z + 1 + rand(), 0.3, 0.2, 0.25);
    } else if (k === 1) {
      // a sunken pool, steps down into it
      const px = r.x1 - 2.6;
      b.add(box, 'matte', th.wall2, px, 0.15, z, 2.6, 0.3, 2.6);
      b.add(box, 'water', 0x2a8a9a, px, 0.28, z, 2.2, 0.04, 2.2);
      for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) b.add(cyl, 'matte', th.trim, px + ox, 0.45, z + oz, 0.3, 0.9, 0.3);
      b.add(ball, 'metal', th.band, px, 0.6, z, 0.35, 0.35, 0.35);
      d.b.pool(0x6ae0ff, px, z, 3, 0.32);
    } else {
      // an altar, a golden lion head on it, braziers either side
      const ax = (r.x0 + r.x1) / 2 + 3.6;
      for (let s = 0; s < 3; s++) b.add(box, 'matte', th.wall2, ax, 0.1 + s * 0.2, r.z0 + 1.4, 2.2 - s * 0.4, 0.2, 1.6 - s * 0.3);
      b.add(ball, 'metal', th.band, ax, 0.95, r.z0 + 1.4, 0.75, 0.7, 0.5);
      b.add(ball, 'metal', 0xffd27a, ax, 0.95, r.z0 + 1.6, 0.42, 0.42, 0.38);
      b.add(box, 'glow', 0xffe0a0, ax, 1.05, r.z0 + 1.82, 0.2, 0.05, 0.02);
      d.b.pool(th.light, ax, r.z0 + 1.6, 3.5);
    }
  },
  bee(d, r, k) {
    const { b, th, rand } = d;
    const x = r.x0 + 2.4;
    const z = r.z0 + 2.2;
    if (k === 0) {
      // a pool of honey in a wax rim, a dipper
      b.add(hex, 'gloss', th.wall2, x, 0.12, z, 2.6, 0.24, 2.6);
      b.add(hex, 'gloss', 0xffa810, x, 0.22, z, 2.2, 0.04, 2.2);
      b.add(cyl, 'matte', 0xd9a066, x + 0.6, 0.5, z, 0.06, 0.9, 0.06, 0, 0, 0.6);
      d.b.pool(0xffa810, x, z, 3.2, 0.26);
    } else if (k === 1) {
      // the nursery: glowing cells in a little mound
      const nx = r.x1 - 2.4;
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI * 2;
        const ox = i ? Math.sin(a) * 0.62 : 0;
        const oz = i ? Math.cos(a) * 0.62 : 0;
        b.add(hex, 'gloss', th.wall2, nx + ox, 0.3 + (i ? 0 : 0.2), z + oz, 0.7, 0.6 + (i ? 0 : 0.4), 0.7);
        b.add(hex, 'glow', 0xfff2c0, nx + ox, 0.62 + (i ? 0 : 0.4), z + oz, 0.5, 0.04, 0.5);
      }
      d.b.pool(0xfff2c0, nx, z, 3.5);
    } else {
      // a giant flower
      const fx = x + 0.4;
      b.add(cyl, 'matte', 0x4f9e3c, fx, 1.1, z, 0.14, 2.2, 0.14);
      for (const s of [-1, 1]) b.add(ball, 'matte', 0x5aa83c, fx + s * 0.4, 0.8, z, 0.7, 0.08, 0.3, 0, 0, -s * 0.5);
      for (let i = 0; i < 8; i++) b.add(ball, 'matte', 0xf28cb1, fx + Math.sin(i * 0.785) * 0.6, 2.2, z + Math.cos(i * 0.785) * 0.6, 0.7, 0.12, 0.45, 0, i * 0.785, 0.2);
      b.add(ball, 'glow', 0xffd84a, fx, 2.26, z, 0.55, 0.25, 0.55);
      d.b.pool(0xffd84a, fx, z, 3.5);
      for (let i = 0; i < 3; i++) b.add(ball, 'matte', 0xffd23f, fx + (rand() - 0.5) * 1.6, 0.05, z + (rand() - 0.5) * 1.6, 0.8, 0.3, 0.7);
    }
  },
  crow(d, r, k) {
    const { b, rand } = d;
    const x = r.x0 + 2.4;
    const z = r.z0 + 2.4;
    if (k === 0) {
      // a broken cart, pumpkins spilt from it
      b.add(box, 'matte', 0x5a4a36, x, 0.55, z, 1.2, 0.4, 1.8, 0, 0, 0.25);
      b.add(ring, 'matte', 0x3d3226, x + 0.7, 0.45, z - 0.5, 0.85, 0.85, 1.1, 0, Math.PI / 2, 0);
      b.add(ring, 'matte', 0x3d3226, x + 0.9, 0.08, z + 0.7, 0.85, 0.85, 1.1, Math.PI / 2, 0, 0);
      for (let i = 0; i < 5; i++) {
        const px = x + (rand() - 0.5) * 1.8;
        const pz = z + 0.6 + rand() * 1.2;
        b.add(ball, 'matte', 0xd9701a, px, 0.18, pz, 0.45, 0.36, 0.45);
        b.add(cyl, 'matte', 0x4f6a2a, px, 0.38, pz, 0.04, 0.12, 0.04);
      }
    } else if (k === 1) {
      // a giant nest, its eggs pale blue
      nestBig(d, r.x1 - 2.6, z);
    } else {
      // the hoard: a heap of shiny things, glinting
      const hx = r.x1 - 2.6;
      b.add(ball, 'metal', 0xe8b84a, hx, 0, z, 2.2, 0.8, 1.8);
      for (let i = 0; i < 22; i++) b.add(disc, 'metal', 0xffd84a, hx + (rand() - 0.5) * 1.8, 0.2 + rand() * 0.2, z + (rand() - 0.5) * 1.4, 0.2, 0.03, 0.2, rand() - 0.5, 0, rand() - 0.5);
      for (let i = 0; i < 4; i++) b.add(box, 'glow', 0xe8f4ff, hx + (rand() - 0.5) * 1.4, 0.4, z + (rand() - 0.5), 0.1, 0.1, 0.1, rand(), rand(), rand());
      b.add(box, 'metal', 0xb04a4a, hx - 0.3, 0.42, z + 0.2, 0.45, 0.3, 0.32);
      d.b.pool(0xd8e4ff, hx, z, 3.2, 0.5);
    }
    // a shaft of moonlight down into the room
    const mx = (r.x0 + r.x1) / 2 + (k % 2 ? -2 : 2);
    const mz = (r.z0 + r.z1) / 2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 6, 12, 1, true), new THREE.MeshBasicMaterial({
      color: 0x8fb0ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.set(mx, 3, mz);
    d.group.add(beam);
    b.pool(0x8fb0ff, mx, mz, 3.2);
  },
  toad(d, r, k) {
    const { b, th, rand } = d;
    const x = r.x0 + 2.4;
    const z = r.z0 + 2.4;
    if (k === 0) {
      // a ring of glowing toadstools
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const h = 0.4 + rand() * 0.5;
        const mx = x + Math.sin(a) * 1.1;
        const mz = z + Math.cos(a) * 1.1;
        b.add(cyl, 'matte', 0xe8e0c8, mx, h / 2, mz, 0.12, h, 0.12);
        b.add(ball, 'glow', th.light, mx, h, mz, 0.42, 0.2, 0.42);
      }
      b.pool(th.light, x, z, 4);
    } else if (k === 1) {
      // a pond, lily pads on it and a plank bridge over
      const px = r.x1 - 2.6;
      b.add(disc, 'water', 0x1f4a42, px, 0.03, z, 3.2, 0.02, 2.6);
      for (let i = 0; i < 5; i++) b.add(disc, 'matte', 0x4f9e3c, px + (rand() - 0.5) * 2.2, 0.05, z + (rand() - 0.5) * 1.6, 0.5, 0.02, 0.5);
      b.add(ball, 'matte', 0xffe0ec, px + 0.6, 0.1, z + 0.3, 0.2, 0.14, 0.2);
      for (let i = 0; i < 6; i++) b.add(box, 'matte', 0x7a5a3a, px + (i - 2.5) * 0.45, 0.22 + Math.sin((i / 5) * Math.PI) * 0.2, z, 0.4, 0.06, 0.8, 0, 0, 0, 0.12);
      for (const ox of [-1.3, 1.3]) for (const oz of [-0.4, 0.4]) b.add(cyl, 'matte', 0x5a4a30, px + ox, 0.25, z + oz, 0.08, 0.5, 0.08);
    } else {
      // a rowboat, sunk in the mud
      const bx = x + 0.4;
      b.add(ball, 'matte', 0x6b5236, bx, 0.12, z, 1.2, 0.6, 2.6, 0.25, 0.4, 0.15);
      b.add(ball, 'matte', 0x2a2218, bx, 0.3, z, 0.9, 0.3, 2.1, 0.25, 0.4, 0.15);
      b.add(box, 'matte', 0x7a5a3a, bx, 0.38, z, 1, 0.06, 0.25, 0.2, 0.4, 0.15);
      b.add(cyl, 'matte', 0x7a5a3a, bx + 0.8, 0.3, z - 0.6, 0.05, 1.6, 0.05, 1.2, 0.4, 0);
      for (let i = 0; i < 4; i++) b.add(cyl, 'matte', 0x4f8a36, bx + (rand() - 0.5) * 1.5, 0.4, z + (rand() - 0.5) * 2, 0.04, 0.8, 0.04);
    }
  },
};

// a nest as big as a cart, eggs in it
function nestBig(d, x, z) {
  const { b, rand } = d;
  for (let i = 0; i < 3; i++) b.add(ring, 'matte', [0x7a6a50, 0x8a7550, 0x5a4a36][i], x, 0.15 + i * 0.12, z, 2.4 - i * 0.2, 2.4 - i * 0.2, 2.6, Math.PI / 2, 0, 0);
  b.add(disc, 'matte', 0x3d3226, x, 0.12, z, 2, 0.15, 2);
  for (let i = 0; i < 18; i++) b.add(cyl, 'matte', 0x8a7550, x + (rand() - 0.5) * 2.4, 0.3, z + (rand() - 0.5) * 2.4, 0.04, 1.2, 0.04, Math.PI / 2, rand() * 3, rand() - 0.5);
  for (let i = 0; i < 3; i++) b.add(ball, 'gloss', 0x9fc6d9, x + (i - 1) * 0.42, 0.45, z + (rand() - 0.5) * 0.3, 0.38, 0.5, 0.38);
}

// ---------- What is about in each cavern ----------
// (d, height(x, z): the rock there, x0..x1, z0..z1: how far it reaches)
const CAVES = {
  parsnip(d, height, x0, x1, z0, z1) {
    // roots poking out of the rock
    scatter(d, height, x0, x1, z0, z1, 40, (b, x, y, z, rand) => b.add(cyl, 'matte', 0x3d2a18, x, y + 0.3, z, 0.12, 1.4, 0.12, (rand() - 0.5) * 2, rand() * 3, (rand() - 0.5) * 2));
  },
  lion(d, height, x0, x1, z0, z1) {
    // drifts of sand, a toppled column or two
    scatter(d, height, x0, x1, z0, z1, 26, (b, x, y, z, rand) => {
      if (rand() < 0.7) b.add(ball, 'matte', 0xc9a464, x, y, z, 2 + rand() * 2, 0.6, 1.5 + rand() * 2, 0, rand() * 3, 0);
      else b.add(cyl, 'matte', 0xe8cf94, x, y + 0.25, z, 0.5, 2.5, 0.5, Math.PI / 2, rand() * 3, 0);
    });
  },
  bee(d, height, x0, x1, z0, z1) {
    // lumps of old wax, honey oozing
    scatter(d, height, x0, x1, z0, z1, 30, (b, x, y, z, rand) => {
      b.add(ball, 'gloss', 0xc98a1a, x, y + 0.2, z, 1 + rand(), 0.8, 1 + rand());
      if (rand() < 0.5) b.add(ball, 'glow', 0xffa810, x + 0.3, y + 0.5, z, 0.3, 0.3, 0.3);
    });
  },
  crow(d, height, x0, x1, z0, z1) {
    // dead trees, twisted
    scatter(d, height, x0, x1, z0, z1, 18, (b, x, y, z, rand) => {
      const h = 2 + rand() * 2;
      b.add(cyl, 'matte', 0x2a2420, x, y + h / 2, z, 0.25, h, 0.25, (rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
      for (let i = 0; i < 3; i++) b.add(cyl, 'matte', 0x2a2420, x + (rand() - 0.5) * 0.6, y + h * (0.5 + i * 0.15), z, 0.08, 1.2, 0.08, (rand() - 0.5) * 2, rand() * 3, 0.9 + rand());
    });
  },
  toad(d, height, x0, x1, z0, z1) {
    // pools of dark water, moss, glowing mushrooms
    scatter(d, height, x0, x1, z0, z1, 34, (b, x, y, z, rand) => {
      const pick = rand();
      if (pick < 0.4) b.add(ball, 'matte', 0x3f6a2a, x, y, z, 1.6 + rand() * 1.5, 0.3, 1.2 + rand() * 1.5);
      else if (pick < 0.7) {
        b.add(cyl, 'matte', 0xe8e0c8, x, y + 0.3, z, 0.14, 0.6, 0.14);
        b.add(ball, 'glow', 0x7ae0bc, x, y + 0.6, z, 0.6, 0.25, 0.6);
      } else b.add(disc, 'water', 0x163a34, x, y + 0.03, z, 1.8 + rand() * 1.5, 0.02, 1.4 + rand());
    });
  },
};

// n things on the cavern's rock (not in the dungeon itself)
function scatter(d, height, x0, x1, z0, z1, n, each) {
  const { b, rand, ax, zNear } = d;
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0);
    const z = z0 + rand() * (z1 - z0);
    const y = height(x, z);
    if (y < 0.05 && Math.abs(x - ax) < ROOM_W / 2 + T + 1.5) continue;
    if (z > zNear && Math.abs(x - ax) < ROOM_W / 2 + 8) continue; // (not between the camera and the dungeon)
    each(b, x, y, z, rand);
  }
}
