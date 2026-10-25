import * as THREE from 'three';
import { BOSS_IDS, ARENAS, ARENA_R, arenaExit } from '../shared/bosses.js';
import { MAIN, ROOM_W, DOOR_W, LAYOUTS, roomCount, roomRect, gateAt, sideDoorAt, chestAt, dungeonExit } from '../shared/dungeons.js';
import { DUNGEONS } from '../shared/balance.js';
import { createFoe } from './dungeonfoes.js';

// ---------- The bosses' dungeons ----------
// The way to each boss's arena (shared/dungeons.js): its main rooms one after
// another in front of it, each a little to one side of the last, and a side
// room off a couple of them with a chest in it (its LAYOUTS), down in a
// cavern of its own out past the sea on the farm's world (dark rock rising
// all round into the dark; src/bosses.js has the sky and the light go dark
// in there), and a bridge from the last main room into the arena: the
// boss's hall, the dungeon's last room, round, built as the rest of it is
// (its floor, its walls, its lamps), with the boss's own things at the back
// and the way home. Each is the boss's own:
//   the evil parsnip's root cellar: earth walls on a stone footing in a
//     timber frame, roots and strings of garlic hanging down, shelves of
//     jars, a boardwalk, crates, sacks and barrels, hanging lanterns; in its
//     hall, its own patch of parsnips;
//   the super lion's sunbaked ruins: sandstone blocks under a carved frieze,
//     columns, red banners, a red runner over the flagstones, sand drifting
//     in, braziers, a broken lion, a sunken pool, a golden lion on an altar;
//     in its hall, a golden sun in the floor and a lion's head on a dais;
//   the bee queen's honeycomb halls: walls and floor of wax cells (some full
//     of honey, some glowing), wax dripping, honey lamps, a honey pool, a
//     nursery of glowing cells, a giant flower; in its hall, a great comb;
//   the giant crow's rookery: log walls, wicker, nests along the top, perches
//     with rooks on them, bird cages of cold blue light, moonbeams, a broken
//     cart of pumpkins, a giant nest, a hoard of shiny things; in its hall, a
//     dead tree full of rooks;
//   the bog toad's sunken bog: mossy stones hung with vines, shelf fungi,
//     murky water with lily pads and stepping stones, reeds, glowing
//     toadstools and fireflies, a pond with a plank bridge, a sunken boat; in
//     its hall, a lily pond and a stone toad.
// The side walls are tall; the ones across, between the rooms, are drawn low
// so the camera sees over them (they stop a farmer all the same), with an
// arch over the gate, which sinks into the floor once its room's foes are
// all down, and the doors to its side rooms with it. Till then, for a farmer
// in the dungeon, it is dark past that gate and that door: nothing of the
// rooms beyond (nor the arena) shows till they open, and the dark over them
// lifts. A side room's chest (each dungeon's own) opens its lid once it is
// ours today. The way home stands by where farmers come in.
// Lamps light pools of the floor round them and flicker, and motes (dust,
// embers, pollen, spores) drift in the air. The foes are src/dungeonfoes.js's.
//
// The walls and floors go in the world's platforms, like the house's room's
// (src/house.js). What doesn't move is drawn a few instanced meshes to a
// dungeon (each piece its own shade), and a dungeon is only drawn while we
// are in it or its hall.

const T = 0.6; // a wall's thickness
const WALL_H = 3.5; // (what stops a farmer: a little over a jump)
const SIDE_H = 2.8; // the side walls, as drawn
const MID_H = 1.3; // the walls across, between the rooms (low: the camera looks over them)
const GATE_H = 1.6;
const SINK_TIME = 0.7; // seconds a gate takes to sink into the floor
const CAVE_SIDE = 26; // how far the cavern reaches out beside the dungeon...
const CAVE_NEAR = 14; // ...in front of it (toward the camera)...
const CAVE_BACK = 22; // ...and behind the boss's hall
const MOTES = 140; // drifting in the air of a dungeon...
const HALL_MOTES = 70; // ...and of its boss's hall
const HALL_SIDES = 16; // the hall's walls, as drawn: a ring of straight ones...
const HALL_W = ARENA_R + 0.3; // ...from its middle to theirs (their faces a little in from that)
const HALL_R = HALL_W - T / 2; // (the hall's floor, inside its walls)
const SEGMENTS = 36; // what stops a farmer at its walls: short pieces all round
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
const round = new THREE.CylinderGeometry(0.5, 0.5, 1, 48);
const hoop = new THREE.RingGeometry(0.95, 1, 48).rotateX(-Math.PI / 2);
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
// within(matrix, fn): what fn adds (and the pools, the flames and the
// fireflies it makes: at(x, y, z)), moved by matrix (a wall built along z,
// turned to run along x, or round the boss's hall)
function createBatch(parent, rand) {
  const lists = new Map();
  const pools = [];
  let frame = null;
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
      const matrix = m.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(w, h, d)).clone();
      lists.get(key).list.push([frame ? matrix.premultiply(frame) : matrix, c.clone()]);
    },
    within(matrix, fn) {
      const was = frame;
      frame = frame && matrix ? matrix.clone().premultiply(frame) : matrix;
      fn();
      frame = was;
    },
    at(x, y, z) {
      const v = new THREE.Vector3(x, y, z);
      return frame ? v.applyMatrix4(frame) : v;
    },
    pool(color, x, z, size, y = 0.03) {
      const v = this.at(x, y, z);
      pools.push([v.x, v.y, v.z, size, color]);
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
// how: rising, or sinking); swirl: its ways home's; gate: the
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
    const rooms = Array.from({ length: roomCount(id) }, (_, room) => roomRect(id, room));
    const zFar = rooms[MAIN - 1].z0;
    const zNear = rooms[0].z1;
    // (what moves, made as it is built: flames that flicker, fireflies)
    const d = { group, id, th, rand, b, ax, az, zFar, zNear, rooms, xMin: Math.min(...rooms.map((r) => r.x0)), xMax: Math.max(...rooms.map((r) => r.x1)), flames: [], flies: [] };

    // the floors, at the ground's height (each room's to the middle of the walls it shares)
    rooms.forEach((r, room) => {
      const side = room >= MAIN ? LAYOUTS[id].sides[room - MAIN][1] : 0;
      const x0 = side > 0 ? r.x0 : r.x0 - T;
      const x1 = side < 0 ? r.x1 : r.x1 + T;
      const z0 = side ? r.z0 - T : room === MAIN - 1 ? r.z0 - T / 2 : r.z0;
      const z1 = side ? r.z1 + T : room === 0 ? r.z1 + T : r.z1;
      b.add(box, 'matte', th.floor, (x0 + x1) / 2, -0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, 0, 0, 0, 0);
      solid({ x: (x0 + x1) / 2, y: -0.6, z: (z0 + z1) / 2, w: x1 - x0, h: 1.2, d: z1 - z0 }, { ground: true });
    });
    cavern(d);
    bridge(d);
    const hallSwirl = hall(d);

    // the main rooms' walls: tall at the sides (a door in one to a side room),
    // low across (a gate in each), and low in front of the first
    const gates = [];
    for (let k = 0; k < MAIN; k++) {
      const r = rooms[k];
      for (const sx of [-1, 1]) {
        const wx = sx < 0 ? r.x0 - T / 2 : r.x1 + T / 2;
        const doors = LAYOUTS[id].sides.map(([room, side], s) => (room === k && side === sx ? sideDoorAt(id, s) : null)).filter(Boolean);
        let from = r.z0 - T / 2;
        for (const door of [...doors, null]) {
          const to = door ? door.z - DOOR_W / 2 : r.z1 + T / 2;
          if (to - from > 0.05) {
            sideWall(d, wx, sx, from, to);
            solid({ x: wx, y: WALL_H / 2, z: (from + to) / 2, w: T, h: WALL_H, d: to - from });
          }
          if (door) from = door.z + DOOR_W / 2;
        }
      }
      const next = k < MAIN - 1 ? rooms[k + 1] : r;
      const xa = Math.min(r.x0, next.x0) - T;
      const xb = Math.max(r.x1, next.x1) + T;
      const g = gateAt(id, k);
      for (const [p, q] of [[xa, g.x - DOOR_W / 2], [g.x + DOOR_W / 2, xb]]) {
        crossWall(d, (p + q) / 2, r.z0, q - p);
        solid({ x: (p + q) / 2, y: WALL_H / 2, z: r.z0, w: q - p, h: WALL_H, d: T });
      }
      gateArch(d, g.x, g.z);
      gates.push(makeGate(d, g.x, g.z, k, false));
      floor(d, r, k);
      dressing(d, r, k);
      SETPIECES[id](d, r, k);
    }
    nearWall(d, (rooms[0].x0 + rooms[0].x1) / 2, zNear + T / 2, ROOM_W + 2 * T);
    solid({ x: (rooms[0].x0 + rooms[0].x1) / 2, y: WALL_H / 2, z: zNear + T / 2, w: ROOM_W + 2 * T, h: WALL_H, d: T });

    // the side rooms: a tall wall beyond and behind, a low one in front, a
    // door from the main room (an arch over it), and the chest
    const chests = [];
    LAYOUTS[id].sides.forEach(([k, side], s) => {
      const r = rooms[MAIN + s];
      const ox = side > 0 ? r.x1 + T / 2 : r.x0 - T / 2;
      sideWall(d, ox, side, r.z0 - T, r.z1 + T);
      solid({ x: ox, y: WALL_H / 2, z: (r.z0 + r.z1) / 2, w: T, h: WALL_H, d: r.z1 - r.z0 + 2 * T });
      const xa = side > 0 ? r.x0 - T : r.x0;
      const xb = side > 0 ? r.x1 : r.x1 + T;
      // (the wall behind: a side wall, turned to run across)
      b.within(new THREE.Matrix4().makeRotationY(-Math.PI / 2), () => sideWall(d, r.z0 - T / 2, -1, -xb, -xa));
      solid({ x: (xa + xb) / 2, y: WALL_H / 2, z: r.z0 - T / 2, w: xb - xa, h: WALL_H, d: T });
      nearWall(d, (xa + xb) / 2, r.z1 + T / 2, xb - xa);
      solid({ x: (xa + xb) / 2, y: WALL_H / 2, z: r.z1 + T / 2, w: xb - xa, h: WALL_H, d: T });
      const door = sideDoorAt(id, s);
      const turn = new THREE.Matrix4().makeTranslation(door.x, 0, door.z).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(-door.x, 0, -door.z));
      b.within(turn, () => gateArch(d, door.x, door.z));
      gates.push(makeGate(d, door.x, door.z, k, true));
      floor(d, r, MAIN + s);
      sideDressing(d, r, s, side);
      chests.push(makeChest(d, s));
    });

    const swirl = wayHome(group, th, dungeonExit(id));
    const pools = b.done();
    const motes = makeMotes(d);
    dungeons.set(id, { group, gates, chests, swirl, hallSwirl, flames: d.flames, flies: d.flies, motes, pools, foes: null, dark: makeDark(d) });
  }

  // The bridge from the last main room's gate over to the way into the boss's
  // hall, with low rails
  function bridge(d) {
    const { b, th, ax, az, zFar } = d;
    const from = az + HALL_W + T / 2; // (from the hall's wall: what holds a farmer up goes on into the hall a little)
    const len = zFar - T / 2 - from;
    const mid = from + len / 2;
    const bw = DOOR_W + 0.8;
    for (let z = from + 0.25; z < zFar - T / 2; z += 0.5) b.add(box, 'matte', th.trim, ax, -0.08, z, bw, 0.14, 0.44);
    b.add(box, 'matte', th.rock, ax, -1, mid, bw - 0.4, 1.8, len);
    solid({ x: ax, y: -0.6, z: mid - 0.8, w: bw, h: 1.2, d: len + 1.6 }, { ground: true });
    for (const sx of [-1, 1]) {
      const rx = ax + sx * (bw / 2 + 0.1);
      b.add(box, 'matte', th.trim, rx, 0.55, mid, 0.14, 0.12, len);
      for (let z = from + 0.3; z < zFar; z += 1.1) b.add(box, 'matte', th.trim, rx, 0.3, z, 0.16, 0.6, 0.16);
      solid({ x: rx, y: WALL_H / 2, z: mid - T / 2, w: 0.2, h: WALL_H, d: len + T });
    }
  }

  // ---------- The boss's hall ----------
  // Its arena (shared/bosses.js), the dungeon's last room: round, its floor
  // and its walls the dungeon's (a ring of straight walls, tall but for the
  // front, where they are low so the camera sees in), the bridge coming in
  // between two posts, a lamp on each tall wall and things along them, the boss's
  // own things at the back, and the way home off to one side. What stops a
  // farmer at its walls is short pieces all round, but for the way in.
  // Returns the way home's swirl.
  function hall(d) {
    const { b, th, ax, az, id, rand } = d;
    b.add(round, 'matte', th.floor, ax, -0.15, az, 2 * HALL_W + T, 0.3, 2 * HALL_W + T, 0, 0, 0, 0);
    solid({ x: ax, y: -0.6, z: az, w: 2 * HALL_W + 2, h: 1.2, d: 2 * HALL_W + 2 }, { ground: true });
    hallFloor(d);
    const len = 2 * HALL_W * Math.tan(Math.PI / HALL_SIDES);
    const turned = new THREE.Matrix4().makeTranslation(HALL_W, 0, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)); // (a near wall, built along x, turned to run along z)
    const wayIn = DOOR_W / 2 + 0.5; // (to the outside of its posts)
    for (let i = 0; i < HALL_SIDES; i++) {
      const a = (i / HALL_SIDES) * Math.PI * 2;
      // (each wall built at x = HALL_W along z, the hall's middle toward -x, then turned to its place)
      const frame = new THREE.Matrix4().makeTranslation(ax, 0, az).multiply(new THREE.Matrix4().makeRotationY(a - Math.PI / 2));
      b.within(frame, () => {
        if (Math.cos(a) > 0.5) {
          b.within(turned, () => {
            if (i) nearWall(d, 0, 0, len + 0.1);
            else for (const s of [-1, 1]) nearWall(d, (s * (len / 2 + wayIn)) / 2, 0, len / 2 - wayIn + 0.05);
          });
          return;
        }
        sideWall(d, HALL_W, 1, -len / 2 - 0.02, len / 2 + 0.02);
        lamp(d, HALL_R, 0, 1);
        if (Math.cos(a) > -0.8 && rand() < 0.7) prop(d, HALL_R - 0.8, (rand() < 0.5 ? -1 : 1) * 1.5, 1, MAIN); // (not at the back: the boss's own things are there)
      });
    }
    for (const sx of [-1, 1]) wayInPost(d, ax + sx * (DOOR_W / 2 + 0.25), az + HALL_W);
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      if (c > 0.99) continue; // (the way in)
      const r = ARENA_R + 0.4;
      const piece = ((Math.PI * 2 * r) / SEGMENTS) * 1.08;
      const w = Math.abs(piece * c) + Math.abs(0.9 * s);
      let x0 = s * r - w / 2;
      let x1 = s * r + w / 2;
      if (c > 0.9) [x0, x1] = s > 0 ? [Math.max(x0, DOOR_W / 2), x1] : [x0, Math.min(x1, -DOOR_W / 2)]; // (either side of the way in: to its posts)
      solid({ x: ax + (x0 + x1) / 2, y: WALL_H / 2, z: az + c * r, w: x1 - x0, h: WALL_H, d: Math.abs(piece * s) + Math.abs(0.9 * c) });
    }
    // the boss's own things at the back, a set piece either side
    throne(d, ax, az - HALL_R + 2.4);
    for (const k of HALL_PIECES[id]) SETPIECES[id](d, { x0: ax - 8, x1: ax + 8, z0: az - 10.4, z1: az - 2 }, k);
    // the way home, a signpost by it
    const exit = arenaExit(id);
    b.add(box, 'matte', th.trim, exit.x + 1.35, 0.55, exit.z + 0.5, 0.1, 1.1, 0.1);
    b.add(box, 'matte', 0xe8c98f, exit.x + 1.35, 1, exit.z + 0.56, 0.7, 0.3, 0.06);
    return wayHome(d.group, th, exit);
  }

  // A post beside the way into the hall, at x, z: low (no arch over it: the
  // camera looks in over it), each dungeon's own thing lit on top
  function wayInPost(d, x, z) {
    const { b, th, id } = d;
    const h = 1.3;
    if (id === 'bee') {
      b.add(hex, 'gloss', th.wall2, x, h / 2, z, 0.55, h, 0.55);
      b.add(ball, 'glow', 0xffc040, x, h + 0.15, z, 0.36, 0.32, 0.36);
    } else if (id === 'crow') {
      b.add(cyl, 'matte', 0x3d3226, x, h / 2, z, 0.26, h, 0.26);
      perched(d, x, h, z, x > d.ax ? 1 : -1);
    } else if (id === 'toad') {
      b.add(box, 'matte', th.wall2, x, h / 2, z, 0.5, h, 0.5);
      b.add(box, 'matte', 0x4f7a2e, x, h + 0.04, z, 0.56, 0.1, 0.56);
      b.add(cyl, 'matte', 0xe8e0c8, x, h + 0.2, z, 0.08, 0.3, 0.08);
      b.add(ball, 'glow', th.light, x, h + 0.36, z, 0.4, 0.18, 0.4);
    } else {
      b.add(box, 'matte', th.trim, x, h / 2, z, 0.45, h, 0.45);
      b.add(box, 'matte', id === 'lion' ? th.wall2 : th.band, x, 0.1, z, 0.6, 0.2, 0.6);
      if (id === 'lion') {
        b.add(cyl, 'metal', 0x8a5a2a, x, h + 0.08, z, 0.5, 0.16, 0.5);
        b.add(cyl, 'glow', 0xff6a1a, x, h + 0.16, z, 0.4, 0.03, 0.4);
        flame(d, x, h + 0.14, z, 1.4);
      } else lantern(d, x, h + 0.25, z);
    }
    b.pool(th.light, x, z - 0.8, 2.6);
  }

  // The hall's floor: the dungeon's, round, and a ring round the boss's
  // ground in the middle (where it sleeps)
  function hallFloor(d) {
    const { b, th, rand, id, ax, az } = d;
    const R = HALL_R;
    const ring = ARENA_R * 0.58;
    // (somewhere on the floor, at least m in from its edge)
    const spot = (m) => {
      const r = Math.sqrt(rand()) * (R - m);
      const a = rand() * Math.PI * 2;
      return [ax + Math.sin(a) * r, az + Math.cos(a) * r];
    };
    const on = (x, z, m) => Math.hypot(x - ax, z - az) < R - m;
    const lane = [az + ring + 0.5, az + R - 0.1]; // (from the way in to the ring)
    const laneZ = (lane[0] + lane[1]) / 2;
    const laneD = lane[1] - lane[0];
    if (id === 'parsnip') {
      // packed earth, a boardwalk in to a ring of stones, straw and pebbles
      for (let i = 0; i < 80; i++) {
        const [x, z] = spot(0.8);
        b.add(box, 'matte', 0x3f2d1e, x, 0.01, z, 0.6 + rand() * 1.2, 0.02, 0.6 + rand() * 1.2, 0, rand() * 3, 0, 0.15);
      }
      for (let z = lane[0]; z < lane[1]; z += 0.45) b.add(box, 'matte', 0x8a5a32, ax + (rand() - 0.5) * 0.08, 0.04, z, 2.4, 0.06, 0.4, 0, (rand() - 0.5) * 0.04, 0, 0.12);
      for (const sx of [-1, 1]) b.add(box, 'matte', 0x5a3d25, ax + sx * 1.15, 0.06, laneZ, 0.1, 0.05, laneD);
      for (let i = 0; i < 14; i++) {
        const [x, z] = spot(1);
        b.add(box, 'matte', 0xa8884a, x, 0.03, z, 0.06, 0.02, 0.45, 0, rand() * Math.PI, 0, 0.15); // (a little straw: not much, nor bright, the parsnip's seeds stand out on the floor)
      }
      for (let i = 0; i < 50; i++) {
        const [x, z] = spot(0.6);
        b.add(rock, 'matte', 0x7a746a, x, 0.03, z, 0.12, 0.08, 0.1, 0, rand() * 3, 0, 0.2);
      }
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * Math.PI * 2;
        b.add(rock, 'matte', 0x6c665e, ax + Math.sin(a) * ring, 0.04, az + Math.cos(a) * ring, 0.5, 0.16, 0.36, 0, a, 0, 0.15);
      }
    } else if (id === 'lion') {
      // flagstones, a red runner in from the way in, a golden ring and a sun inlaid where the lion sleeps, sand drifting in by the walls
      for (let x = ax - R + 0.5; x < ax + R; x += 1) {
        for (let z = az - R + 0.5; z < az + R; z += 1) {
          if (!on(x, z, 0.4)) continue;
          const cracked = rand() < 0.08;
          b.add(box, 'matte', cracked ? 0xb89c68 : th.floor, x, cracked ? -0.01 : 0.02, z, 0.96, 0.06, 0.96, 0, 0, 0, 0.07);
        }
      }
      b.add(box, 'matte', 0x9a2418, ax, 0.06, laneZ, 1.8, 0.02, laneD, 0, 0, 0, 0);
      for (const sx of [-1, 1]) b.add(box, 'metal', th.band, ax + sx * 0.85, 0.075, laneZ, 0.1, 0.02, laneD, 0, 0, 0, 0);
      b.add(hoop, 'metal', th.band, ax, 0.06, az, ring, 1, ring, 0, 0, 0, 0);
      b.add(disc, 'metal', th.band, ax, 0.06, az, 2.4, 0.02, 2.4, 0, 0, 0, 0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        b.add(box, 'metal', th.band, ax + Math.sin(a) * 1.9, 0.06, az + Math.cos(a) * 1.9, 0.22, 0.02, 1.1, 0, a, 0, 0);
      }
      for (let i = 0; i < 16; i++) {
        const a = rand() * Math.PI * 2;
        if (Math.cos(a) > 0.9) continue; // (not in the way in)
        const r = R - 0.7 - rand() * 0.8;
        b.add(ball, 'matte', 0xe8d39a, ax + Math.sin(a) * r, 0, az + Math.cos(a) * r, 1.4 + rand(), 0.35, 1 + rand(), 0, a, 0, 0.05);
      }
    } else if (id === 'bee') {
      // wax cells, honey in some, a few glowing, puddles of honey, a ring of wax
      const C = 0.5;
      const w = Math.sqrt(3) * C;
      for (let row = 0; az - R + 0.3 + row * 1.5 * C < az + R; row++) {
        const z = az - R + 0.3 + row * 1.5 * C;
        for (let x = ax - R + 0.4 + (row % 2) * (w / 2); x < ax + R; x += w) {
          if (!on(x, z, 0.3)) continue;
          const pick = rand();
          b.add(hex, pick < 0.12 ? 'gloss' : 'matte', pick < 0.12 ? 0xffa810 : pick < 0.5 ? th.floor : 0xf2c860, x, 0.02, z, C * 1.9, 0.06, C * 1.9, 0, Math.PI / 6, 0, 0.06);
          if (pick > 0.985) b.add(hex, 'glow', 0xffd060, x, 0.06, z, C * 1.2, 0.04, C * 1.2, 0, Math.PI / 6, 0);
        }
      }
      for (let i = 0; i < 8; i++) {
        const [x, z] = spot(2);
        b.add(disc, 'gloss', 0xffa810, x, 0.06, z, 0.8 + rand(), 0.02, 0.6 + rand() * 0.8);
      }
      b.add(hoop, 'gloss', 0xc98a1a, ax, 0.07, az, ring, 1, ring, 0, 0, 0, 0);
    } else if (id === 'crow') {
      // boards, straw, black feathers and fallen leaves, a ring of straw
      for (let x = ax - R + 0.3; x < ax + R; x += 0.6) {
        const half = Math.sqrt(Math.max(0, R * R - (x - ax) ** 2)) - 0.15;
        if (half > 0.2) b.add(box, 'matte', rand() < 0.5 ? th.floor : 0x2e2822, x, 0.02, az, 0.56, 0.05, 2 * half, 0, 0, 0, 0.08);
      }
      for (let i = 0; i < 70; i++) {
        const [x, z] = spot(0.8);
        const what = i % 3;
        b.add(box, 'matte', what === 0 ? 0x111114 : what === 1 ? [0xc0662f, 0xd9a03a, 0x8a3a1a][i % 3] : 0xb89a5a, x, 0.05, z,
          what === 1 ? 0.22 : 0.06, 0.015, what === 1 ? 0.16 : 0.45, 0, rand() * Math.PI, 0, 0.1);
      }
      b.add(hoop, 'matte', 0xb89a5a, ax, 0.06, az, ring, 1, ring, 0, 0, 0, 0.05);
    } else {
      // mud, murky pools with lily pads and duckweed, stepping stones in to a ring of moss
      for (let i = 0; i < 12; i++) {
        const [x, z] = spot(2.2);
        if (Math.abs(x - ax) < 2 && z > lane[0] - 1) continue; // (not over the stepping stones)
        const s = 1.4 + rand() * 1.8;
        b.add(disc, 'water', 0x1f4a42, x, 0.02, z, s, 0.02, s * (0.6 + rand() * 0.4), 0, rand() * 3, 0, 0.05);
        for (let k = 0; k < 3; k++) if (rand() < 0.7) b.add(disc, 'matte', 0x4f9e3c, x + (rand() - 0.5) * s * 0.6, 0.04, z + (rand() - 0.5) * s * 0.4, 0.4, 0.02, 0.4, 0, rand() * 3, 0, 0.15);
        if (rand() < 0.5) b.add(ball, 'matte', 0xffb8d0, x, 0.1, z, 0.14, 0.1, 0.14);
        for (let k = 0; k < 6; k++) b.add(disc, 'matte', 0x7ab83a, x + (rand() - 0.5) * s * 0.7, 0.035, z + (rand() - 0.5) * s * 0.5, 0.06, 0.01, 0.06);
      }
      for (let z = lane[0] + 0.3; z < lane[1] - 0.2; z += 1.3) b.add(rock, 'matte', 0x7a7a6c, ax + (rand() - 0.5) * 0.8, 0.05, z, 0.8, 0.18, 0.7, 0, rand() * 3, 0, 0.12);
      b.add(hoop, 'matte', 0x4f7a2e, ax, 0.04, az, ring, 1, ring, 0, 0, 0, 0.05);
    }
  }

  // The boss's own things, at the back of its hall, x, z their middle
  function throne(d, x, z) {
    const { b, th, rand, id } = d;
    if (id === 'parsnip') {
      // its own patch: a bed of turned earth, parsnips' leafy tops in rows, a lantern on a post at each end
      b.add(box, 'matte', 0x3a2818, x, 0.15, z, 4.4, 0.3, 2);
      for (let row = 0; row < 3; row++) {
        const rz = z - 0.6 + row * 0.6;
        b.add(box, 'matte', 0x2e2014, x, 0.33, rz, 4.2, 0.1, 0.32);
        for (let i = 0; i < 6; i++) {
          const px = x - 1.75 + i * 0.7 + (rand() - 0.5) * 0.1;
          b.add(cone, 'matte', 0xf2e2b0, px, 0.44, rz, 0.24, 0.2, 0.24, Math.PI, 0, 0);
          for (let l = 0; l < 3; l++) b.add(ball, 'matte', 0x5aa83c, px + (l - 1) * 0.07, 0.7, rz, 0.1, 0.42, 0.07, 0, l * 0.9, (l - 1) * 0.45);
        }
      }
      for (const sx of [-1, 1]) {
        b.add(box, 'matte', th.trim, x + sx * 2.6, 1.1, z, 0.18, 2.2, 0.18);
        b.add(box, 'matte', th.trim, x + sx * 2.4, 2.15, z, 0.6, 0.12, 0.12);
        b.add(cyl, 'metal', 0x3a3632, x + sx * 2.2, 2, z, 0.02, 0.3, 0.02);
        lantern(d, x + sx * 2.2, 1.65, z);
        b.pool(th.light, x + sx * 2.2, z + 0.6, 3.6);
      }
    } else if (id === 'lion') {
      // a dais of three steps, a golden lion's head on it, a brazier either side
      for (let s = 0; s < 3; s++) b.add(box, 'matte', th.wall2, x, 0.12 + s * 0.24, z, 4.4 - s, 0.24, 2.4 - s * 0.55);
      b.add(box, 'matte', th.trim, x, 0.98, z, 0.9, 0.5, 0.8);
      b.add(ball, 'metal', th.band, x, 1.7, z, 1.3, 1.2, 0.7);
      b.add(ball, 'metal', 0xffd27a, x, 1.68, z + 0.25, 0.72, 0.72, 0.5);
      b.add(ball, 'metal', 0xe0a82e, x, 1.5, z + 0.48, 0.28, 0.2, 0.16);
      for (const sx of [-1, 1]) b.add(box, 'glow', 0xffe0a0, x + sx * 0.15, 1.8, z + 0.5, 0.08, 0.05, 0.02, 0, 0, 0, 0);
      for (const sx of [-1, 1]) brazier(d, x + sx * 2.8, z + 0.3);
      b.pool(th.light, x, z + 1, 4.5);
    } else if (id === 'bee') {
      // a great comb, honey glowing in its cells and running down it, a pool of honey at its foot
      for (const [ox, oz, h] of [[-1.1, -0.65, 1.8], [-0.4, -0.65, 2.5], [0.4, -0.65, 2.5], [1.1, -0.65, 1.8], [-1.5, 0, 1.3], [-0.75, 0, 2.1], [0, 0, 2.8], [0.75, 0, 2.1], [1.5, 0, 1.3]]) {
        b.add(hex, 'gloss', th.wall2, x + ox, h / 2, z + oz, 0.82, h, 0.82);
        b.add(hex, 'glow', 0xffd060, x + ox, h + 0.01, z + oz, 0.6, 0.03, 0.6);
        if (!oz) b.add(ball, 'gloss', 0xffa810, x + ox + 0.2, h * 0.55, z + 0.36, 0.14, h * 0.5, 0.12);
      }
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) cell(d, x - 1.05 + i * 0.7 + (row % 2) * 0.35 - 0.17, 0.4 + row * 0.42, z + 0.4, 1, 'z');
      b.add(disc, 'gloss', 0xffa810, x, 0.04, z + 1, 3, 0.04, 1.2);
      b.pool(0xffd060, x, z + 0.8, 4.2);
    } else if (id === 'crow') {
      // a dead tree, rooks perched along its boughs, their hoard of shiny things at its foot
      b.add(cyl, 'matte', 0x2a2420, x, 1.8, z, 0.5, 3.6, 0.5, 0, 0, 0.05);
      b.add(cone, 'matte', 0x2a2420, x, 0.25, z, 1.1, 0.5, 1.1);
      for (const [sx, y, l] of [[-1, 2.3, 1.8], [1, 2.8, 1.6], [-1, 3.3, 1.1], [1, 1.8, 1.2]]) {
        const a = sx * 1.2;
        b.add(cyl, 'matte', 0x2a2420, x + Math.sin(a) * l * 0.5, y + Math.cos(a) * l * 0.5, z, 0.14, l, 0.14, 0, 0, -a);
        perched(d, x + Math.sin(a) * l * 0.85, y + Math.cos(a) * l * 0.85, z, sx);
      }
      b.add(ball, 'metal', 0xe8b84a, x + 1.3, 0, z + 0.7, 1.6, 0.6, 1.2);
      for (let i = 0; i < 14; i++) b.add(disc, 'metal', 0xffd84a, x + 1.3 + (rand() - 0.5) * 1.4, 0.15 + rand() * 0.15, z + 0.7 + (rand() - 0.5), 0.2, 0.03, 0.2, rand() - 0.5, 0, rand() - 0.5);
      for (let i = 0; i < 3; i++) b.add(box, 'glow', 0xe8f4ff, x + 1.3 + (rand() - 0.5), 0.32, z + 0.7 + (rand() - 0.5) * 0.6, 0.1, 0.1, 0.1, rand(), rand(), rand());
      b.pool(0xd8e4ff, x + 1.3, z + 0.7, 3);
    } else {
      // a pond, a giant lily pad on it with a pink lily, reeds round, a stone toad watching over it
      b.add(disc, 'water', 0x1f4a42, x, 0.03, z, 5, 0.02, 3);
      b.add(disc, 'matte', 0x4f9e3c, x - 0.6, 0.06, z + 0.2, 2, 0.03, 2);
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785;
        b.add(ball, 'matte', 0xffb8d0, x - 0.6 + Math.sin(a) * 0.22, 0.2, z + 0.2 + Math.cos(a) * 0.22, 0.2, 0.12, 0.36, 0.5, a, 0);
      }
      b.add(ball, 'glow', 0xffe070, x - 0.6, 0.24, z + 0.2, 0.16, 0.1, 0.16);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (0.55 + rand() * 0.9);
        const rx = x + Math.sin(a) * 2.6;
        const rz = z - Math.abs(Math.cos(a)) * 1.6;
        const h = 0.8 + rand() * 0.8;
        b.add(cyl, 'matte', 0x4f8a36, rx, h / 2, rz, 0.04, h, 0.04, (rand() - 0.5) * 0.2, 0, (rand() - 0.5) * 0.2);
        if (i % 2) b.add(cyl, 'matte', 0x6b4426, rx, h + 0.1, rz, 0.09, 0.24, 0.09);
      }
      b.add(box, 'matte', th.wall2, x + 1.7, 0.2, z - 0.4, 1.2, 0.4, 1);
      b.add(ball, 'matte', th.wall, x + 1.7, 0.75, z - 0.4, 1.1, 0.8, 1);
      b.add(ball, 'matte', 0x5f8a36, x + 1.7, 1.12, z - 0.4, 0.9, 0.12, 0.8);
      for (const ox of [-0.25, 0.25]) b.add(ball, 'glow', th.light, x + 1.7 + ox, 1.15, z - 0.05, 0.16, 0.16, 0.12);
      b.pool(th.light, x, z + 0.4, 4.4);
    }
  }

  // Is x, z in (or within `m` of) one of the dungeon's rooms?
  function inRooms(d, x, z, m) {
    return d.rooms.some((r) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);
  }

  // ---------- The cavern ----------
  // Dark rock all round the dungeon and its boss's hall, rising the further
  // out it goes (into the dark); spires of rock on it, boulders, and crystals
  // glowing in the dungeon's light
  function cavern(d) {
    const { th, rand, ax, az, zNear, b, rooms } = d;
    const x0 = Math.min(d.xMin - T, ax - HALL_W) - CAVE_SIDE;
    const x1 = Math.max(d.xMax + T, ax + HALL_W) + CAVE_SIDE;
    const z0 = az - HALL_W - CAVE_BACK;
    const z1 = zNear + T + CAVE_NEAR;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / 1.3), Math.round((z1 - z0) / 1.3)).rotateX(-Math.PI / 2);
    const s = [rand() * 9, rand() * 9, rand() * 9];
    const bumps = (x, z) => Math.sin(x * 0.55 + s[0]) * Math.cos(z * 0.47 + s[1]) + Math.sin((x + z) * 1.3 + s[2]) * 0.45;
    // (how far out of the dungeon x, z is: from the nearest room, or the bridge)
    const away = (x, z, r) => Math.hypot(Math.max(0, r.x0 - T - 0.2 - x, x - r.x1 - T - 0.2), Math.max(0, r.z0 - T - 0.2 - z, z - r.z1 - T - 0.2));
    const bridged = { x0: ax - DOOR_W, x1: ax + DOOR_W, z0: az + ARENA_R, z1: d.zFar };
    const height = (x, z) => {
      const out = Math.min(away(x, z, bridged), Math.max(0, Math.hypot(x - ax, z - az) - HALL_W - T - 0.2), ...rooms.map((r) => away(x, z, r)));
      if (out <= 0) return -0.1;
      return 0.15 * out ** 1.45 + bumps(x, z) * 0.5 * Math.min(1, out / 3) - 0.04;
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
      if (h < 0.05 && (inRooms(d, x, z, T + 1.5) || inHall(d, x, z, 1.5))) continue; // (not in the dungeon)
      const front = inFront(d, x, z); // (between the camera and the dungeon: nothing tall)
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

  // A near wall (in front of a room, toward the camera), `w` long, its middle
  // at x, z: low, a ledge and stones (the camera looks in over it)
  function nearWall(d, x, z, w) {
    const { th, b, rand, id } = d;
    b.add(box, 'matte', id === 'lion' ? th.wall2 : th.wall, x, 0.25, z, w, 0.5, T);
    b.add(box, 'matte', th.trim, x, 0.55, z, w + 0.1, 0.1, T + 0.1);
    for (let sx = x - w / 2 + T; sx < x + w / 2 - T; sx += 0.9 + rand() * 0.6) b.add(rock, 'matte', th.rock, sx, 0.62, z + (rand() - 0.5) * 0.3, 0.35, 0.18, 0.3, 0, rand() * 3, 0, 0.2);
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



  // ---------- Floors ----------
  function floor(d, r, k) {
    const { th, b, rand, id } = d;
    const cx = (r.x0 + r.x1) / 2;
    const W = r.x1 - r.x0;
    const D = r.z1 - r.z0;
    if (id === 'parsnip') {
      // packed earth, a boardwalk down the middle, straw and pebbles
      for (let i = 0; i < 30; i++) b.add(box, 'matte', 0x3f2d1e, r.x0 + 0.5 + rand() * (W - 1), 0.01, r.z0 + 0.5 + rand() * (D - 1), 0.6 + rand(), 0.02, 0.6 + rand(), 0, rand() * 3, 0, 0.15);
      for (let z = r.z0 + 0.25; z < r.z1 - 0.1; z += 0.45) b.add(box, 'matte', 0x8a5a32, cx + (rand() - 0.5) * 0.08, 0.04, z, 2.4, 0.06, 0.4, 0, (rand() - 0.5) * 0.04, 0, 0.12);
      for (const sx of [-1, 1]) b.add(box, 'matte', 0x5a3d25, cx + sx * 1.15, 0.06, (r.z0 + r.z1) / 2, 0.1, 0.05, D - 0.2);
      for (let i = 0; i < 16; i++) b.add(box, 'matte', 0xd9b45a, r.x0 + 0.8 + rand() * (W - 1.6), 0.03, r.z0 + 0.6 + rand() * (D - 1.2), 0.06, 0.02, 0.45, 0, rand() * Math.PI, 0, 0.15);
      for (let i = 0; i < 20; i++) b.add(rock, 'matte', 0x7a746a, r.x0 + 0.5 + rand() * (W - 1), 0.03, r.z0 + 0.5 + rand() * (D - 1), 0.12, 0.08, 0.1, 0, rand() * 3, 0, 0.2);
    } else if (id === 'lion') {
      // flagstones, a red runner down the middle with gold edges, sand drifting in by the walls
      for (let x = r.x0 + 0.5; x < r.x1; x += 1) {
        for (let z = r.z0 + 0.5; z < r.z1; z += 1) {
          const cracked = rand() < 0.08;
          b.add(box, 'matte', cracked ? 0xb89c68 : th.floor, x, cracked ? -0.01 : 0.02, z, 0.96, 0.06, 0.96, 0, 0, 0, 0.07);
        }
      }
      b.add(box, 'matte', 0x9a2418, cx, 0.06, (r.z0 + r.z1) / 2, 1.8, 0.02, D - 0.6, 0, 0, 0, 0);
      for (const sx of [-1, 1]) b.add(box, 'metal', th.band, cx + sx * 0.85, 0.075, (r.z0 + r.z1) / 2, 0.1, 0.02, D - 0.6, 0, 0, 0, 0);
      for (let i = 0; i < 8; i++) {
        const sx = rand() < 0.5 ? -1 : 1;
        b.add(ball, 'matte', 0xe8d39a, cx + sx * (W / 2 - 0.5 - rand() * 0.8), 0, r.z0 + 0.6 + rand() * (D - 1.2), 1.4 + rand(), 0.35, 1 + rand(), 0, rand() * 3, 0, 0.05);
      }
    } else if (id === 'bee') {
      // a floor of wax cells, honey in some, a few glowing
      const R = 0.5;
      const w = Math.sqrt(3) * R;
      for (let row = 0; row * 1.5 * R < D; row++) {
        const z = r.z0 + 0.3 + row * 1.5 * R;
        for (let x = r.x0 + 0.4 + (row % 2) * (w / 2); x < r.x1 - 0.3; x += w) {
          const pick = rand();
          b.add(hex, pick < 0.12 ? 'gloss' : 'matte', pick < 0.12 ? 0xffa810 : pick < 0.5 ? th.floor : 0xf2c860, x, 0.02, z, R * 1.9, 0.06, R * 1.9, 0, Math.PI / 6, 0, 0.06);
          if (pick > 0.985) b.add(hex, 'glow', 0xffd060, x, 0.06, z, R * 1.2, 0.04, R * 1.2, 0, Math.PI / 6, 0);
        }
      }
      for (let i = 0; i < 4; i++) b.add(disc, 'gloss', 0xffa810, r.x0 + 1 + rand() * (W - 2), 0.06, r.z0 + 1 + rand() * (D - 2), 0.8 + rand(), 0.02, 0.6 + rand() * 0.8);
    } else if (id === 'crow') {
      // boards along the room, straw, black feathers and fallen leaves
      for (let x = r.x0 + 0.3; x < r.x1; x += 0.6) b.add(box, 'matte', rand() < 0.5 ? th.floor : 0x2e2822, x, 0.02, (r.z0 + r.z1) / 2, 0.56, 0.05, D - 0.1, 0, 0, 0, 0.08);
      for (let i = 0; i < 26; i++) {
        const what = i % 3;
        b.add(box, 'matte', what === 0 ? 0x111114 : what === 1 ? [0xc0662f, 0xd9a03a, 0x8a3a1a][i % 3] : 0xb89a5a, r.x0 + 0.6 + rand() * (W - 1.2), 0.05, r.z0 + 0.6 + rand() * (D - 1.2),
          what === 1 ? 0.22 : 0.06, 0.015, what === 1 ? 0.16 : 0.45, 0, rand() * Math.PI, 0, 0.1);
      }
    } else {
      // mud, murky water, stepping stones across it, lily pads and duckweed
      for (let i = 0; i < 6; i++) {
        const px = r.x0 + 1.5 + rand() * (W - 3);
        const pz = r.z0 + 1.2 + rand() * (D - 2.4);
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
  // Lamps along its side walls, and things by them (out of the middle, where
  // the foes go; not in a doorway, nor in front of the way home)
  function dressing(d, r, k) {
    const { rand, id } = d;
    for (const sx of [-1, 1]) {
      const wallX = sx < 0 ? r.x0 : r.x1;
      const door = LAYOUTS[id].sides.some(([room, side]) => room === k && side === sx);
      for (const z of [r.z0 + 2.6, r.z1 - 3]) lamp(d, wallX, z, sx);
      const spots = [r.z0 + 1.2 + rand() * 0.6, (r.z0 + r.z1) / 2 + (rand() - 0.5), r.z1 - 1.4 - rand() * 0.6];
      spots.forEach((z, i) => {
        if ((door && i === 1) || (k === 0 && sx > 0 && i === 2)) return;
        prop(d, wallX - sx * 0.8, z, sx, k);
      });
    }
  }

  // A side room's lamps (on its far wall, either side of the chest), and a
  // thing or two in its corners by the door
  function sideDressing(d, r, s, side) {
    const { b, th } = d;
    const wallX = side > 0 ? r.x1 : r.x0;
    for (const z of [r.z0 + 1.6, r.z1 - 1.6]) lamp(d, wallX, z, side);
    const innerX = side > 0 ? r.x0 + 0.8 : r.x1 - 0.8;
    prop(d, innerX, r.z0 + 1, -side, MAIN + s);
    // a rug under the chest, and the gleam of it
    const at = chestAt(d.id, s);
    b.add(box, 'matte', TREASURE[d.id], at.x - side * 1.1, 0.03, at.z, 2.4, 0.02, 3, 0, 0, 0, 0);
    b.pool(th.light, at.x - side * 0.6, at.z, 3.6);
  }

  // A flame (it flickers: update()), and the pool of light it makes
  function flame(d, x, y, z, size = 1) {
    const g = new THREE.Group();
    g.position.copy(d.b.at(x, y, z));
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

  // a brazier on a stand, a fire in it
  function brazier(d, x, z) {
    const { b } = d;
    for (let i = 0; i < 3; i++) b.add(cyl, 'metal', 0x5a3a20, x + Math.sin(i * 2.1) * 0.18, 0.45, z + Math.cos(i * 2.1) * 0.18, 0.05, 0.95, 0.05, Math.cos(i * 2.1) * 0.2, 0, -Math.sin(i * 2.1) * 0.2);
    b.add(cyl, 'metal', 0x8a5a2a, x, 0.98, z, 0.62, 0.2, 0.62);
    b.add(cyl, 'glow', 0xff6a1a, x, 1.07, z, 0.5, 0.04, 0.5);
    flame(d, x, 1.05, z, 1.8);
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
      const bx = x - sx * 0.35;
      brazier(d, bx, z);
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
        fly.userData.home = d.b.at(x - sx * (0.8 + rand()), 0.8 + rand(), z);
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
  // A gate at x, z (a side room's door: turned to sit in a side wall) that
  // opens once main room k is cleared: bars across the door (each dungeon's
  // own), and what stops a farmer while it is shut
  function makeGate(d, x, z, k, sideDoor) {
    const { th, id } = d;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (sideDoor) g.rotation.y = Math.PI / 2;
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
    const shut = solid({ x, y: WALL_H / 2, z, w: sideDoor ? T : DOOR_W, h: WALL_H, d: sideDoor ? DOOR_W : T });
    return { group: g, shut, open: false, sink: 0, k };
  }

  // ---------- Chests ----------
  // Side room s's chest, each dungeon's own, its front to the door; its lid
  // (on a hinge at the back) opens once it is ours today, and till then a
  // little glow hangs over it
  function makeChest(d, s) {
    const { th, id } = d;
    const at = chestAt(id, s);
    const g = new THREE.Group();
    g.position.set(at.x, 0, at.z);
    g.rotation.y = at.side > 0 ? -Math.PI / 2 : Math.PI / 2; // (its front, +z, toward the door)
    d.group.add(g);
    const look = CHESTS[id];
    const mats = new Map();
    const matOf = (color, kind = 'matte') => {
      const key = `${color}:${kind}`;
      if (!mats.has(key)) mats.set(key, kind === 'glow' ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: kind === 'metal' ? 0.35 : 0.8, metalness: kind === 'metal' ? 0.6 : 0, flatShading: true }));
      return mats.get(key);
    };
    const add = (parent, geo, color, kind, x, y, z, w, h, dd, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, matOf(color, kind));
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, dd);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // the box: its body, bands round it, a lock on the front
    add(g, box, look.body, 'matte', 0, 0.28, 0, 1.1, 0.56, 0.72);
    for (const x of [-0.38, 0.38]) add(g, box, look.band, look.metal, x, 0.29, 0, 0.1, 0.58, 0.76);
    add(g, box, look.trim, 'matte', 0, 0.04, 0, 1.16, 0.08, 0.78);
    // the lid, on its hinge at the back
    const lid = new THREE.Group();
    lid.position.set(0, 0.56, -0.36);
    g.add(lid);
    add(lid, box, look.body, 'matte', 0, 0.11, 0.36, 1.12, 0.22, 0.74);
    add(lid, cyl, look.body, 'matte', 0, 0.2, 0.36, 0.3, 1.12, 0.74, 0, 0, Math.PI / 2); // (rounded over the top)
    for (const x of [-0.38, 0.38]) add(lid, box, look.band, look.metal, x, 0.14, 0.36, 0.1, 0.3, 0.78);
    add(g, box, look.lock, 'metal', 0, 0.48, 0.38, 0.16, 0.2, 0.06);
    look.extra?.(add, g, lid);
    // what is in it, glinting (seen with the lid up)
    add(g, box, 0xffd84a, 'glow', 0, 0.5, 0, 0.9, 0.08, 0.6);
    // a glow over it, while it has something for us
    const gleam = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: softGlow(), color: th.light, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    gleam.rotation.x = Math.PI / 2;
    gleam.position.set(0, 1.1, 0.2);
    gleam.scale.set(1.4, 1, 1.4);
    g.add(gleam);
    solid({ x: at.x, y: 0.4, z: at.z, w: 0.8, h: 0.8, d: 1.2 });
    return { group: g, lid, gleam, open: 0 };
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
    const sides = LAYOUTS[d.id].sides.map(() => ({ veil: veil(), liftAt: -Infinity }));
    return { ahead: veil(), fade, lifting: veil(), sides, shown: -1, liftAt: -Infinity };
  }

  // a veil over z from `near` back to `far` (-Infinity: on past the arena), the dungeon's whole width and more
  function cover(veil, id, near, far) {
    const { x } = ARENAS[id];
    const back = Number.isFinite(far) ? far : near - 160;
    veil.position.set(x, 5, (near + back) / 2);
    veil.scale.set(140, 80, near - back);
    veil.visible = true;
  }

  // the sheets of dark in front of it, out beside room r (not over it): one every metre
  function fadeIn(fade, r, near, show) {
    fade.forEach((sheet, i) => {
      sheet.visible = show;
      if (!show) return;
      const side = i % 2 ? 1 : -1;
      const out = side > 0 ? r.x1 + T + 0.6 : r.x0 - T - 0.6;
      sheet.position.set(out + side * 35, 5, near + 1 + Math.floor(i / 2));
      sheet.scale.set(70, 80, 0.02);
    });
  }

  // a veil over what is out past side room s's door (the side room, and on
  // out to that side), from in front of it back to the main room's far wall
  function coverSide(veil, id, s) {
    const [k, side] = LAYOUTS[id].sides[s];
    const m = roomRect(id, k);
    const r = roomRect(id, MAIN + s);
    const inner = side > 0 ? m.x1 + T : m.x0 - T;
    const near = r.z1 + T + 0.3;
    veil.position.set(inner + side * 70, 5, (near + m.z0) / 2);
    veil.scale.set(140, 80, near - m.z0);
    veil.visible = true;
  }

  // Dark past the first shut gate (gate k is room k's: the next room's, and
  // on) and past the shut doors to side rooms, what a gate or door just
  // opened onto lifting into sight. inside: we are in the dungeon (from
  // anywhere else, no veils)
  function darken(id, d, cleared, inside, t) {
    const { ahead, lifting } = d.dark;
    const edge = (k) => gateAt(id, k).z - T / 2 - 0.02; // (just past gate k)
    const was = d.dark.shown;
    if (cleared > was && was >= 0 && inside) {
      // a gate opened: what it lets into lifts out of the dark
      cover(lifting, id, edge(was), cleared < MAIN ? edge(cleared) : -Infinity);
      d.dark.liftAt = t;
    }
    d.dark.shown = inside ? cleared : -1;
    const dark = inside && cleared < MAIN;
    if (dark) cover(ahead, id, edge(cleared), -Infinity);
    else ahead.visible = false;
    fadeIn(d.dark.fade, roomRect(id, Math.min(cleared, MAIN - 1)), dark ? edge(cleared) : 0, dark);
    const k = (t - d.dark.liftAt) / LIFT_TIME;
    lifting.material.opacity = 1 - k;
    if (k >= 1 || !inside) lifting.visible = false;
    // the side rooms: dark till the room they are off is cleared, then lifting
    LAYOUTS[id].sides.forEach(([room], s) => {
      const side = d.dark.sides[s];
      if (inside && cleared > room && was >= 0 && was <= room) side.liftAt = t;
      const lift = (t - side.liftAt) / LIFT_TIME;
      if (inside && (cleared <= room || lift < 1)) {
        coverSide(side.veil, id, s);
        side.veil.material.opacity = cleared <= room ? 1 : 1 - lift;
      } else side.veil.visible = false;
    });
  }

  // ---------- Motes in the air ----------
  // A few hundred specks drifting about the dungeon (rising or sinking, as its theme has them)
  function makeMotes(d) {
    const { th, rand, zFar, zNear, ax, az } = d;
    const positions = new Float32Array((MOTES + HALL_MOTES) * 3);
    for (let i = 0; i < MOTES + HALL_MOTES; i++) {
      const r = Math.sqrt(rand()) * HALL_R;
      const a = rand() * Math.PI * 2;
      positions[i * 3] = i < MOTES ? d.xMin + rand() * (d.xMax - d.xMin) : ax + Math.sin(a) * r;
      positions[i * 3 + 1] = rand() * 3;
      positions[i * 3 + 2] = i < MOTES ? zFar + rand() * (zNear - zFar) : az + Math.cos(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: th.mote[0], size: 0.12, map: softGlow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    points.frustumCulled = false;
    d.group.add(points);
    return { points, rise: th.mote[1], phase: Array.from({ length: MOTES + HALL_MOTES }, () => rand() * 10) };
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
    // Every frame, for each dungeon: `near` (we are in it or its hall: it
    // is drawn), `inside` (in it: it is dark past its first shut gate), `run`
    // (as dungeonFromWire has it, the foes drawn where `shown` has them: { x,
    // y, z } each; null: fresh, every foe resting), looted(s): whether side
    // room s's chest is ours today (its lid up)
    update(dt, t, id, near, inside, run, shown, looted = () => false) {
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
      d.hallSwirl.rotation.z = -t * 2.2;
      d.chests.forEach((chest, s) => {
        chest.open += ((looted(s) ? 1 : 0) - chest.open) * Math.min(1, dt * 4);
        chest.lid.rotation.x = -1.9 * chest.open;
        chest.gleam.visible = chest.open < 0.5;
        chest.gleam.material.opacity = 0.35 + Math.sin(t * 3 + s) * 0.15;
      });
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
      for (let i = 0; i < phase.length; i++) {
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

// ---------- The side rooms' chests, and the rugs they stand on ----------
// body, band (and how: matte or metal), trim, lock; extra(add, chest, lid): what else is on it
const CHESTS = {
  parsnip: { body: 0x8a5a32, band: 0x3a3632, metal: 'metal', trim: 0x5a3d25, lock: 0xe0b84a },
  lion: {
    body: 0xe0a82e, band: 0xd9b77a, metal: 'matte', trim: 0xc9a464, lock: 0xb8261c,
    extra: (add, g, lid) => add(lid, ball, 0xb8261c, 'metal', 0, 0.36, 0.36, 0.16, 0.12, 0.16),
  },
  bee: {
    body: 0xf2c860, band: 0xc98a1a, metal: 'matte', trim: 0x8a5a12, lock: 0xffa810,
    extra: (add, g, lid) => {
      for (const x of [-0.25, 0.1, 0.32]) add(lid, ball, 0xffa810, 'matte', x, 0.12, 0.74, 0.1, 0.22, 0.08);
    },
  },
  crow: {
    body: 0x3a2e24, band: 0xb8bcc4, metal: 'metal', trim: 0x26221c, lock: 0xb8bcc4,
    extra: (add, g, lid) => add(lid, box, 0x111114, 'matte', 0.2, 0.36, 0.36, 0.06, 0.02, 0.5, 0, 0.6, 0),
  },
  toad: {
    body: 0x5a4a30, band: 0x3f4a3a, metal: 'metal', trim: 0x3f3324, lock: 0xb8a060,
    extra: (add, g, lid) => {
      add(lid, box, 0x5f8a36, 'matte', -0.15, 0.36, 0.36, 0.6, 0.06, 0.5);
      add(lid, disc, 0x4f9e3c, 'matte', 0.25, 0.37, 0.4, 0.4, 0.03, 0.4);
    },
  },
};
const TREASURE = { parsnip: 0x6a2a1e, lion: 0x9a2418, bee: 0xc98a1a, crow: 0x2a2a44, toad: 0x2f4a3a };

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
    } else if (k === 3) {
      // crates stacked high in a corner, carrots spilt from one
      const cx = r.x1 - 1.8;
      for (const [ox, oy, oz, size] of [[0, 0.4, 0, 0.8], [0.9, 0.4, 0.1, 0.8], [0.4, 1.2, 0.05, 0.75], [0.1, 0.35, 1, 0.7]]) {
        b.add(box, 'matte', 0xa8713f, cx + ox - 0.4, oy, z + oz, size, size, size, 0, rand() * 0.3, 0);
        b.add(box, 'matte', 0x7a4f28, cx + ox - 0.4, oy, z + oz, size + 0.03, 0.06, size + 0.03);
      }
      for (let i = 0; i < 8; i++) b.add(cone, 'matte', 0xff8a2a, cx - 1 + (rand() - 0.5) * 1.2, 0.08, z + 1.4 + rand() * 0.8, 0.12, 0.38, 0.12, Math.PI / 2, rand() * 3, 0);
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
    } else if (k === 3) {
      // a colossus's head, toppled long ago, half sunk in the sand
      const hx = r.x1 - 2.6;
      b.add(ball, 'matte', 0xb08a50, hx, 0.5, z, 2.2, 1.6, 1.6, 0.4, 0.5, 0.3);
      b.add(ball, 'matte', th.trim, hx + 0.2, 0.7, z + 0.2, 1.4, 1.3, 1.2, 0.4, 0.5, 0.3);
      b.add(box, 'matte', 0x7a5a30, hx + 0.6, 0.8, z + 0.6, 0.3, 0.06, 0.04, 0, 0.5, 0.3);
      b.add(ball, 'matte', 0xe8d39a, hx - 0.4, 0, z + 0.8, 2.6, 0.5, 1.8);
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
    } else if (k === 3) {
      // wax pillars, honey running down into a pool between them
      const px = r.x1 - 2.6;
      for (const [ox, oz, h] of [[-0.7, 0, 2.6], [0.6, -0.4, 2.1], [0.2, 0.8, 1.5]]) {
        b.add(hex, 'gloss', th.wall2, px + ox, h / 2, z + oz, 0.7, h, 0.7);
        b.add(ball, 'gloss', 0xffa810, px + ox + 0.25, h * 0.6, z + oz + 0.2, 0.14, h * 0.6, 0.14);
      }
      b.add(disc, 'gloss', 0xffa810, px, 0.04, z + 0.3, 2.2, 0.04, 1.8);
      d.b.pool(0xffa810, px, z, 3.4);
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
    } else if (k === 3) {
      // a scarecrow, rooks perched along its arms, bales of straw by it
      const sx = r.x1 - 2.6;
      b.add(cyl, 'matte', 0x7a5a3a, sx, 1.1, z, 0.1, 2.2, 0.1);
      b.add(cyl, 'matte', 0x7a5a3a, sx, 1.7, z, 0.08, 1.8, 0.08, 0, 0, Math.PI / 2);
      b.add(box, 'matte', 0x4a3a5a, sx, 1.45, z, 0.45, 0.75, 0.36);
      b.add(ball, 'matte', 0xd9a03a, sx, 2.05, z, 0.4, 0.38, 0.4);
      b.add(cone, 'matte', 0x2f2a24, sx, 2.35, z, 0.56, 0.36, 0.56);
      for (const ox of [-0.75, 0.7]) perched(d, sx + ox, 1.72, z, ox > 0 ? 1 : -1);
      for (const [ox, oz] of [[-1.3, 0.9], [1.1, 1]]) b.add(box, 'matte', 0xd9b45a, sx + ox, 0.35, z + oz, 1, 0.7, 0.6, 0, rand() * 0.4, 0);
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
    } else if (k === 3) {
      // an old stone fountain, a frog on top, water spilling into its basin
      const fx = r.x1 - 2.6;
      b.add(cyl, 'matte', th.wall2, fx, 0.25, z, 2.2, 0.5, 2.2);
      b.add(cyl, 'water', 0x2a6a5a, fx, 0.48, z, 1.9, 0.04, 1.9);
      b.add(cyl, 'matte', th.wall, fx, 0.9, z, 0.4, 1.2, 0.4);
      b.add(ball, 'matte', 0x5f8a36, fx, 1.6, z, 0.6, 0.45, 0.6);
      for (const ox of [-0.13, 0.13]) b.add(ball, 'matte', 0xe0c040, fx + ox, 1.82, z + 0.15, 0.14, 0.14, 0.12);
      b.add(cyl, 'glow', 0x9ff0d0, fx, 1.05, z + 0.45, 0.06, 0.8, 0.06, 0.5, 0, 0);
      b.add(box, 'matte', 0x5f8a36, fx, 0.52, z, 2.2, 0.06, 0.3, 0, 0.7, 0);
      d.b.pool(th.light, fx, z, 3.2, 0.5);
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

// The two of each dungeon's set pieces that stand in its boss's hall too,
// either side at the back (SETPIECES' k: one along its room's left, one its right)
const HALL_PIECES = { parsnip: [2, 1], lion: [0, 3], bee: [2, 1], crow: [0, 1], toad: [0, 3] };

// a rook sat on a perch, facing `face` (+1: +x)
function perched(d, x, y, z, face) {
  const { b } = d;
  b.add(ball, 'matte', 0x26282e, x, y + 0.2, z, 0.3, 0.32, 0.42, 0, face * Math.PI / 2, 0);
  b.add(ball, 'matte', 0x26282e, x + face * 0.14, y + 0.4, z, 0.22, 0.22, 0.22);
  b.add(cone, 'matte', 0xc9ccd1, x + face * 0.3, y + 0.38, z, 0.08, 0.2, 0.08, 0, 0, -face * Math.PI / 2);
  b.add(ball, 'glow', 0xfff0c0, x + face * 0.2, y + 0.45, z + 0.08, 0.04, 0.04, 0.04, 0, 0, 0, 0);
  b.add(box, 'matte', 0x1c1d22, x - face * 0.24, y + 0.15, z, 0.24, 0.04, 0.2, 0, 0, face * 0.4);
}

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
  const { b, rand, rooms } = d;
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0);
    const z = z0 + rand() * (z1 - z0);
    const y = height(x, z);
    if (y < 0.05 && (rooms.some((r) => x > r.x0 - T - 1.5 && x < r.x1 + T + 1.5 && z > r.z0 - T - 1.5 && z < r.z1 + T + 1.5) || inHall(d, x, z, 1.5))) continue;
    if (inFront(d, x, z)) continue; // (not between the camera and the dungeon)
    each(b, x, y, z, rand);
  }
}

// Is x, z in (or within `m` of) the boss's hall?
function inHall(d, x, z, m) {
  return Math.hypot(x - d.ax, z - d.az) < HALL_W + T / 2 + m;
}

// Is x, z between the camera and the dungeon: in front of its first room, or
// of the hall (by the bridge)? (nothing tall there)
function inFront(d, x, z) {
  const first = d.rooms[0];
  return (z > d.zNear && x > first.x0 - 8 && x < first.x1 + 8) || (z > d.az && z < d.zFar + 2 && Math.abs(x - d.ax) < HALL_W + 8);
}
