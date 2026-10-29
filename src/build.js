import * as THREE from 'three';
import { PIECES, pieceTiles } from '../shared/level.js';
import { TILE_SIZE, mulberry32, addRipples } from './world.js';
import { waterLook } from './gfx/water.js';
import { detailAll } from './gfx/detail.js';
import { chestModel, CHEST_W } from './chest.js';
import { createItemMesh } from './itemmesh.js';

// ---------- What is built on the farm ----------
// Fences (wood, picket, wattle, log and split rail), box hedges, gates, arches and
// arbors, walls (stone, low stone and palisades), paths and stepping stones,
// blocks to climb (steps, tree stumps, crates and crate stacks, grain sacks,
// log piles, barrels and barrel stacks, straw bales and stacks, scaffolds,
// log towers, stone blocks, mossy or not, and pillars), wells, stone
// lanterns, scarecrows, hay carts, beehives, birdbaths, signposts, water
// troughs, stone benches, sundials, wheelbarrows, torches, log fences,
// mailboxes, birdhouses, flagpoles, stone cairns, clotheslines, rope fences,
// boulders, log benches, compost bins, milk churns, dovecotes, campfires, bunting and market awnings, the workbench and what it makes for the farm (the machines among it: a cheese press, a mayonnaise machine and a loom), the arcade, the sky isles' relics on their pedestals (turning slowly, aglow at night), and the farm's chest (PIECES in shared/level.js), one to a tile. Lamp posts light up at night (setNight). This draws them on a world (the farm's), joins each fence and wall
// up with the fences and walls beside it and each path with the paths round
// it, and gives the solid ones colliders
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
  flame: mat(0xffa23a, { emissive: 0xff7a1a, emissiveIntensity: 0.6, transparent: true, opacity: 0.72, depthWrite: false }), // (a torch's: burning day and night)
  flameCore: mat(0xfff0a0, { emissive: 0xffd060, emissiveIntensity: 0.8 }),
  soil: mat(0x5b3a1e),
  leaf: mat(0x4f9e3c),
  moss: mat(0x6f9a3e),
  mossDark: mat(0x527a30),
  gravel: mat(0xa89f8c),
  gravelDark: mat(0x857b69),
  flagstone: mat(0xaba596),
  grout: mat(0x6b6253),
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
  portal: mat(0x6a2f94, { emissive: 0x7a3fa0, emissiveIntensity: 0.9 }), // (a boss's portal: its swirl)
  portalLight: mat(0xd9a8ff, { emissive: 0xc58cf0, emissiveIntensity: 1 }),
  lionPortal: mat(0xb8561a, { emissive: 0xc0661f, emissiveIntensity: 0.9 }), // (the super lion's: orange)
  lionPortalLight: mat(0xffd08a, { emissive: 0xf0a050, emissiveIntensity: 1 }),
  beePortal: mat(0xc99a10, { emissive: 0xd9a520, emissiveIntensity: 0.9 }), // (the bee queen's: gold)
  beePortalLight: mat(0xfff0a0, { emissive: 0xffe070, emissiveIntensity: 1 }),
  crowPortal: mat(0x2f3f8a, { emissive: 0x3a4fa0, emissiveIntensity: 0.9 }), // (the giant crow's: midnight blue)
  crowPortalLight: mat(0xa8c0ff, { emissive: 0x8fa8f0, emissiveIntensity: 1 }),
  toadPortal: mat(0x1f7a6a, { emissive: 0x2a8a78, emissiveIntensity: 0.9 }), // (the bog toad's: pond green)
  toadPortalLight: mat(0x9ff0d0, { emissive: 0x7ae0bc, emissiveIntensity: 1 }),
  sackDark: mat(0xbfa26c),
  crow: mat(0x26262c),
  beak: mat(0xe0a23a),
  picket: mat(0xe6d6b4),
  picketDark: mat(0xc4b28e),
  bee: mat(0xf2c230),
  hole: mat(0x2a1a0e),
  bird: mat(0x8a5a3a),
  birdBreast: mat(0xd99a6a),
  withy: mat(0x9c7a4c),
  withyDark: mat(0x7a5a34),
  brass: mat(0xb8893a, { roughness: 0.5, metalness: 0.5 }),
  linen: mat(0xf2ede0),
  cheese: mat(0xf2c84b),
  mayo: mat(0xfff6d8),
  glass: mat(0xcfe8f0, { transparent: true, opacity: 0.45, roughness: 0.2 }),
  mayoTin: mat(0xd8d6ce, { roughness: 0.45, metalness: 0.35 }),
  ash: mat(0x4a4038),
  blueCloth: mat(0x4a78b5),
  tin: mat(0xbcc4ca, { roughness: 0.45, metalness: 0.5 }),
  tinDark: mat(0x7f8a92, { roughness: 0.5, metalness: 0.5 }),
  dove: mat(0xeceae4),
  doveGrey: mat(0xa3a8ae),
  lichen: mat(0xb8b46a),
  petals: [mat(0xe0475b), mat(0xffd84a), mat(0xf28ad8), mat(0xffffff)],
};
detailAll(MATS); // (painted detail, each by its name: wood, planks, stone, thatch, tiles... src/gfx/detail.js)
// a boss's portal's swirl, by its boss: [deep, light]
const PORTAL_MATS = { parsnip: [MATS.portal, MATS.portalLight], lion: [MATS.lionPortal, MATS.lionPortalLight], bee: [MATS.beePortal, MATS.beePortalLight], crow: [MATS.crowPortal, MATS.crowPortalLight], toad: [MATS.toadPortal, MATS.toadPortalLight] };
const ball = new THREE.IcosahedronGeometry(0.5, 0);
const lump = new THREE.IcosahedronGeometry(0.5, 1); // rounder than a ball: a sack, a heap of hay
const box = new THREE.BoxGeometry(1, 1, 1);
const flag = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const log = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const shaft = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const tip = new THREE.ConeGeometry(0.5, 1, 8);
const barrel = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const pyramid = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4); // a square base 1 across
const shoulder = new THREE.CylinderGeometry(0.3, 0.5, 1, 12); // narrowing to the top, as a churn does
const flare = new THREE.CylinderGeometry(0.4, 0.5, 1, 8); // a log's foot, wider at the ground
const rootShape = new THREE.CylinderGeometry(0.25, 0.5, 1, 6); // a root, thinning away from the trunk
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- Light at night ----------
// Where the pieces that give light have their flame (from the middle of their
// tile). After dark a few real lights go to the ones nearest the player, so
// they light up the ground and what stands around them. (Always the same few
// lights, however many are built: more would slow the game down.)
const GLOWS = {
  lamp_post: [0, 1.96, 0],
  stone_lantern: [0, 1.03, 0],
  house: [0, 0, 0], // (set below: the lamp over the door)
  torch: [0, 1.5, 0],
  campfire: [0, 0.4, 0],
  ...Object.fromEntries(Object.keys(PIECES).filter((id) => PIECES[id].relic).map((id) => [id, [0, 1.2, 0]])), // (a relic)
  ...Object.fromEntries(Object.keys(PIECES).filter((id) => PIECES[id].portal).map((id) => [id, [0, 1, 0.3]])), // (a boss's portal)
};
const FLICKERS = new Set(['torch', 'campfire']); // (a flame, not a lamp: its light flickers)
const GLOW_LIGHTS = 6;
const GLOW_REACH = 9;

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
GLOWS.house = [0, WALL_TOP - 0.52, HOUSE_Z + HOUSE_D / 2 + 0.45];
const gable = new THREE.ExtrudeGeometry(gableShape, { depth: HOUSE_W, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-HOUSE_W / 2, 0, 0);

// ---------- The fish pond ----------
// 3 tiles by 3 (PIECES.pond.size), built from the middle of its front row:
// still water in a ring of stones, lily pads, reeds in a corner. Fished from
// its edge (src/fishing.js); the stones round it are too tall to step over.
export const POND_WATER_Y = 0.14; // the water's surface, where a bobber floats
const POND_Z = -1; // its middle, from the middle of the tile it was built on
const POND_IN = 1.25; // half the water's width
const waterMat = waterLook(addRipples(mat(0x3a96a8, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: false })), 'pond'); // (as the lake's: src/gfx/water.js)
const padMat = mat(0x4f9e3c);
// ---------- The aquarium ----------
// Where in it the fish swim, from the middle of its tile: [x, y, z] of the
// middle, and half its size
export const TANK_BOX = { at: [0, 0.84, 0], half: [0.36, 0.16, 0.18] };
const tankWaterMat = mat(0x6fc3e0, { roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
const sandMat = mat(0xe6cf98);

function pond(g, solids, r) {
  part(g, box, MATS.soil, 0, 0.02, POND_Z, POND_IN * 2, 0.04, POND_IN * 2);
  part(g, box, waterMat, 0, POND_WATER_Y, POND_Z, POND_IN * 2, 0.02, POND_IN * 2).castShadow = false;
  // the stones, round the edge
  const n = 7;
  for (const side of [0, 1, 2, 3]) {
    for (let i = 0; i < n; i++) {
      const along = -1.45 + (i / (n - 1)) * 2.9;
      const [x, z] = [[along, -1.45], [1.45, along], [-along, 1.45], [-1.45, -along]][side];
      const k = (side * n + i + Math.floor(r * 10)) % 3;
      const stone = part(g, ball, k ? MATS.stone : MATS.stoneLight, x, 0.14, POND_Z + z, 0.5, 0.3 + k * 0.05, 0.5);
      stone.rotation.y = i + side;
    }
  }
  // lily pads, one with a flower, and reeds in the back corner
  for (let i = 0; i < 3; i++) {
    const a = r * 6 + i * 2.1;
    const d = 0.35 + i * 0.25;
    part(g, flag, padMat, Math.cos(a) * d, POND_WATER_Y + 0.015, POND_Z + Math.sin(a) * d, 0.34, 0.02, 0.34).castShadow = false;
    if (!i) part(g, ball, MATS.petals[2], Math.cos(a) * d, POND_WATER_Y + 0.06, POND_Z + Math.sin(a) * d, 0.12, 0.08, 0.12);
  }
  for (let i = 0; i < 5; i++) part(g, box, MATS.leaf, -1.05 + (i % 3) * 0.12, 0.35, POND_Z - 1.05 + (i % 2) * 0.14, 0.04, 0.5 + (i % 3) * 0.12, 0.04);
  // in the way all round (taller than a jump, like the well), the water open in the middle
  for (const [x, z, w, d] of [[0, -1.45, 3, 0.2], [0, 1.45, 3, 0.2], [-1.45, 0, 0.2, 3], [1.45, 0, 0.2, 3]]) {
    solids.push({ x, y: 1.1, z: POND_Z + z, w, h: 2.2, d });
  }
}

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

// A stone wall `h` tall: a run of stone to each wall or fence it joins, and
// a pier in the middle of the tile where it stands alone, ends, turns a
// corner or branches. A straight run goes on unbroken from tile to tile. Its
// stones are laid in courses, each course's joints half a stone along from
// the one below's, on one grid along the wall so they carry on into the next
// tile's (a stone on a tile's edge is shared, half each side)
const WALL_STONE = 0.5; // a stone's length
function stoneWall(g, solids, h, joined, gx, gz) {
  const base = Math.min(0.24, h / 4); // the darker course along the bottom
  const straight = joined.length === 2 && joined[0][0] === -joined[1][0] && joined[0][1] === -joined[1][1];
  if (!straight) {
    // the pier: blocks of stone stood one on another, a cap on top
    const courses = Math.max(1, Math.round((h - base) / 0.4));
    const ch = (h - base) / courses;
    part(g, box, MATS.stoneDark, 0, h / 2, 0, 0.52, h, 0.52); // (showing in the joints)
    part(g, box, MATS.stoneDark, 0, base / 2, 0, 0.62, base, 0.62);
    for (let c = 0; c < courses; c++) part(g, box, hash(gx * 4 + c, gz) < 0.3 ? MATS.stoneLight : MATS.stone, 0, base + ch * (c + 0.5), 0, 0.56, ch - 0.03, 0.56);
    part(g, box, MATS.stoneLight, 0, h + 0.05, 0, 0.64, 0.1, 0.64);
    solids.push({ x: 0, y: h / 2, z: 0, w: 0.56, h, d: 0.56 });
  }
  // the wall along [ax, az], from a0 to a1 along it (from the tile's middle)
  const top = h * 0.9;
  const courses = Math.max(1, Math.round((top - base) / 0.4));
  const ch = (top - base) / courses;
  const run = (ax, az, a0, a1) => {
    const mid = (a0 + a1) / 2;
    // the whole length of it, k thick and `high` tall, its middle y up
    const slab = (material, y, high, k) => part(g, box, material, ax * mid, y, az * mid, ax ? a1 - a0 : k, high, az ? a1 - a0 : k);
    slab(MATS.stoneDark, top / 2, top, 0.42); // (showing in the joints)
    slab(MATS.stoneDark, base / 2, base, 0.5);
    slab(MATS.stoneLight, top + 0.05, 0.1, 0.54); // the coping
    const u = ax ? gx : gz; // the tile's middle, along the wall
    const across = ax ? gz * 2 : gx * 2 + 1;
    for (let c = 0; c < courses; c++) {
      const off = (c % 2) * WALL_STONE / 2;
      const y = base + ch * (c + 0.5);
      for (let k = Math.floor((u + a0 - off) / WALL_STONE); k * WALL_STONE + off < u + a1 - 1e-6; k++) {
        const from = k * WALL_STONE + off - u;
        const to = from + WALL_STONE;
        // a joint where the stone ends, not where the tile does
        const s0 = Math.max(from, a0) + (from >= a0 - 1e-6 ? 0.015 : 0);
        const s1 = Math.min(to, a1) - (to <= a1 + 1e-6 ? 0.015 : 0);
        const r = hash(k * 8 + c, across);
        const thick = 0.44 + r * 0.05; // (some a little proud of the rest)
        part(g, box, r < 0.3 ? MATS.stoneLight : MATS.stone, ax * (s0 + s1) / 2, y, az * (s0 + s1) / 2, ax ? s1 - s0 : thick, ch - 0.03, az ? s1 - s0 : thick);
      }
    }
    solids.push({ x: ax * mid, y: h / 2, z: az * mid, w: ax ? a1 - a0 : 0.46, h, d: az ? a1 - a0 : 0.46 });
  };
  if (straight) {
    const [[dx, dz]] = joined;
    run(Math.abs(dx), Math.abs(dz), -0.5, 0.5);
  } else {
    for (const [dx, dz] of joined) run(Math.abs(dx), Math.abs(dz), Math.min(0, (dx + dz) * 0.5), Math.max(0, (dx + dz) * 0.5));
  }
}

// A boulder's shape, 1 tall and 1 across (scaled to its size), a little
// different on every tile: a ball of facets, each corner pushed in or out,
// cut flat underneath and on top (to stand on), so its top is smaller than
// its middle and the edge round it uneven. Its own shape (`own`).
const BOULDER_CUT = [-0.2, 0.27]; // where the ball is cut, from its middle (it's 1 across)
function boulderShape(rand) {
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = geo.attributes.position;
  const bumps = new Map(); // (a corner is in several faces: pushed the same in each)
  const v = new THREE.Vector3();
  const [low, high] = BOULDER_CUT;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!bumps.has(key)) bumps.set(key, 0.84 + rand() * 0.24);
    v.multiplyScalar(bumps.get(key));
    pos.setXYZ(i, v.x, (THREE.MathUtils.clamp(v.y, low, high) - low) / (high - low) - 0.5, v.z);
  }
  geo.computeVertexNormals();
  geo.userData.own = true;
  return geo;
}

// A mossy stone block's moss: cells across its top, and how likely each is
// grown over, by how many cells it is from the corner the moss grows from
const MOSS_CELLS = 4;
const MOSS_COVER = [1, 0.95, 0.7, 0.45, 0.2, 0.08, 0];

// A fire `h` tall, its foot at (x, y, z): a tongue of flame, see-through
// enough that the yellow heart in it shows, and `tongues` smaller ones
// leaning out round it, a little differently on every tile (r). Named
// 'flame': it flickers (setNight stretches it up and down from its foot)
function fire(g, x, y, z, h, tongues, r) {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.name = 'flame';
  f.userData.h = 1;
  part(f, tip, MATS.flameCore, 0, h * 0.33, 0, h * 0.42, h * 0.66, h * 0.42).castShadow = false;
  part(f, tip, MATS.flame, 0, h / 2, 0, h * 0.56, h, h * 0.56).castShadow = false;
  for (let i = 0; i < tongues; i++) {
    const k = h * (0.45 + ((r * 10 + i * 7) % 3) * 0.1);
    const lean = new THREE.Group();
    lean.rotation.y = (i / tongues) * Math.PI * 2 + r * 6;
    const tongue = part(lean, tip, MATS.flame, h * 0.14, k * 0.42, 0, k * 0.46, k, k * 0.46);
    tongue.rotation.z = -0.4;
    tongue.castShadow = false;
    f.add(lean);
  }
  g.add(f);
}

// A wood crate `h` tall and `w` across, its bottom at y0: a frame around
// each side with a board corner to corner across it, and a lid
function crate(g, y0, h, w) {
  part(g, box, MATS.crate, 0, y0 + (h - 0.02) / 2, 0, w, h - 0.02, w); // (just under the frame's top: level with it, they flickered)
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

// A wood barrel `h` tall and `w` across, its bottom at y0: staves bulging
// at the middle, iron hoops and a lid
function cask(g, y0, h, w) {
  part(g, barrel, MATS.stave, 0, y0 + h * 0.25, 0, 0.86, h * 0.5, 0.86);
  part(g, barrel, MATS.stave, 0, y0 + h * 0.75, 0, 0.86, h * 0.5, 0.86);
  part(g, barrel, MATS.crate, 0, y0 + h / 2, 0, w, h * 0.4, w);
  for (const [y, k] of [[0.1, 0.88], [h * 0.3, w + 0.02], [h * 0.7, w + 0.02], [h - 0.1, 0.88]]) part(g, barrel, MATS.iron, 0, y0 + y, 0, k, 0.05, k).castShadow = false;
  part(g, barrel, MATS.plankA, 0, y0 + h + 0.005, 0, 0.78, 0.01, 0.78).castShadow = false;
  part(g, box, MATS.plankB, 0, y0 + h + 0.012, 0, 0.7, 0.01, 0.04).castShadow = false;
}

// The workbench, as fancy as the farm's workbench level (setBenchLevel):
// a plain bench with a vise and a mallet; from level 2 a pegboard of tools
// behind it, a lantern and a jar of nails; at level 3 a little shingled roof
// over it on posts, an anvil and a grindstone
let benchLevel = 1;
function workbench(g, solids, level) {
  part(g, box, MATS.benchTop, 0, 0.82, 0, 0.96, 0.1, 0.62);
  for (const [x, z] of [[-0.4, -0.24], [0.4, -0.24], [-0.4, 0.24], [0.4, 0.24]]) part(g, box, MATS.post, x, 0.39, z, 0.1, 0.78, 0.1);
  part(g, box, MATS.plankB, 0, 0.22, 0, 0.84, 0.05, 0.52); // the shelf
  part(g, box, MATS.stoneLight, -0.2, 0.3, 0.02, 0.3, 0.12, 0.22); // a block of stone on it
  part(g, box, MATS.iron, 0.3, 0.93, -0.16, 0.16, 0.12, 0.12); // a vise
  part(g, box, MATS.post, -0.18, 0.9, 0.1, 0.36, 0.05, 0.05); // a mallet
  part(g, box, MATS.iron, -0.02, 0.92, 0.1, 0.1, 0.1, 0.14);
  let top = 0.9;
  if (level > 1) {
    // the pegboard, and what hangs on it: a saw, a hammer, a coil of twine
    part(g, box, MATS.plankA, 0, 1.25, -0.29, 0.9, 0.7, 0.04);
    for (const x of [-0.42, 0.42]) part(g, box, MATS.post, x, 1.25, -0.29, 0.06, 0.74, 0.06);
    part(g, box, MATS.iron, -0.22, 1.3, -0.26, 0.3, 0.12, 0.01);
    part(g, box, MATS.post, -0.05, 1.3, -0.26, 0.06, 0.1, 0.03);
    part(g, box, MATS.post, 0.14, 1.22, -0.26, 0.04, 0.28, 0.03);
    part(g, box, MATS.iron, 0.14, 1.37, -0.25, 0.14, 0.06, 0.05);
    part(g, barrel, MATS.twine, 0.32, 1.38, -0.25, 0.12, 0.04, 0.12).rotation.x = Math.PI / 2;
    // a lantern on the corner, lit at night with the lamps
    part(g, box, MATS.iron, -0.36, 0.9, 0.18, 0.12, 0.04, 0.12);
    part(g, box, MATS.lantern, -0.36, 0.99, 0.18, 0.09, 0.14, 0.09).castShadow = false;
    part(g, box, MATS.iron, -0.36, 1.08, 0.18, 0.12, 0.03, 0.12);
    part(g, barrel, MATS.water, 0.12, 0.91, -0.12, 0.08, 0.1, 0.08); // a jar
    top = 1.6;
  }
  if (level > 2) {
    // the roof: posts at the back, a sloping roof of shingles
    for (const x of [-0.46, 0.46]) part(g, box, MATS.post, x, 0.95, -0.29, 0.08, 1.9, 0.08);
    const roof = part(g, box, MATS.roofTile, 0, 1.9, -0.02, 1.08, 0.06, 0.78);
    roof.rotation.x = 0.32;
    part(g, box, MATS.roofDark, 0, 2.02, -0.37, 1.1, 0.06, 0.08);
    // the anvil on a stump, and the grindstone in its frame
    part(g, log, MATS.bark, 0.2, 0.12, 0.42, 0.22, 0.24, 0.22);
    part(g, box, MATS.iron, 0.2, 0.3, 0.42, 0.24, 0.1, 0.12);
    part(g, tip, MATS.iron, 0.36, 0.31, 0.42, 0.08, 0.12, 0.08).rotation.z = -Math.PI / 2;
    for (const z of [0.36, 0.48]) part(g, box, MATS.post, -0.25, 0.18, z, 0.04, 0.36, 0.04);
    part(g, barrel, MATS.stoneLight, -0.25, 0.3, 0.42, 0.26, 0.06, 0.26).rotation.x = Math.PI / 2;
    top = 2.05;
  }
  solids.push({ x: 0, y: top / 2, z: 0, w: 0.96, h: top, d: 0.62 });
}

// ---------- Paths ----------
// A path is PATH_HALF either side of the middle of its tile, and runs on to
// the tile's edge toward each path beside it (of any kind: they all join up),
// and out into the corner too where the paths round it make a square. Each
// kind lays its stones, cobbles or planks on a grid of CELLs, so they run on
// into the next tile's as one path. at(dx, dz): the path beside the tile
// that way (its id), the corners too, or nothing.
const PATH_HALF = 0.375;
const CELL = 0.125; // (8 to a tile: the path is 6 across, with 1 more each side toward the next tile)
const SIDES = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // east, south, west and north: round the tile, seen from above
const CORNERS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const AROUND = [...SIDES, ...CORNERS];
const cellMid = (i) => -0.5 + (i + 0.5) * CELL;
// whether cell (i, j) of a tile's 8 by 8 is path
function pathCell(at, i, j) {
  const ex = i === 0 ? -1 : i === 7 ? 1 : 0;
  const ez = j === 0 ? -1 : j === 7 ? 1 : 0;
  return !!(ex && ez ? at(ex, 0) && at(0, ez) && at(ex, ez) : ex ? at(ex, 0) : ez ? at(0, ez) : true);
}
// whether (x, z) on the tile is at least m inside the path (with its
// outside corners rounded off by `round`)
function inPath(at, x, z, m, round = 0) {
  const lim = PATH_HALF - m;
  const sx = Math.sign(x) || 1;
  const sz = Math.sign(z) || 1;
  const inX = Math.abs(x) <= lim;
  const inZ = Math.abs(z) <= lim;
  if (inX && inZ) {
    const c = PATH_HALF - round;
    return !!(at(sx, 0) || at(0, sz)) || Math.abs(x) <= c || Math.abs(z) <= c || Math.hypot(Math.abs(x) - c, Math.abs(z) - c) <= round - m;
  }
  return !!((inZ && at(sx, 0)) || (inX && at(0, sz)) || (at(sx, 0) && at(0, sz) && at(sx, sz)));
}

// The ground a path is laid on, `half` either side of the middle: a flat
// shape, its outside corners rounded off by `round` and its inside ones by
// `fillet` (a few dozen different ones, made once each)
const pathShapes = new Map();
function pathGround(at, half, round, fillet) {
  const key = [half, round, fillet, ...AROUND.map(([dx, dz]) => (at(dx, dz) ? 1 : 0))].join();
  if (pathShapes.has(key)) return pathShapes.get(key);
  const pts = [];
  // a quarter circle round (cx, cz), from direction a to direction b
  const arc = (cx, cz, r, [ax, az], [bx, bz]) => {
    if (!r) return void pts.push([cx, cz]);
    for (let i = 0; i <= 4; i++) {
      const t = (i / 8) * Math.PI;
      pts.push([cx + r * (Math.cos(t) * ax + Math.sin(t) * bx), cz + r * (Math.cos(t) * az + Math.sin(t) * bz)]);
    }
  };
  // round the tile a corner at a time: the corner between side a and side b
  SIDES.forEach(([bx, bz], i) => {
    const [ax, az] = SIDES[(i + 3) % 4];
    if (!at(ax, az) && !at(bx, bz)) arc((half - round) * (ax + bx), (half - round) * (az + bz), round, [ax, az], [bx, bz]);
    else if (!at(ax, az)) pts.push([half * ax + 0.5 * bx, half * az + 0.5 * bz]);
    else if (!at(bx, bz)) pts.push([0.5 * ax + half * bx, 0.5 * az + half * bz]);
    else if (!at(ax + bx, az + bz)) {
      pts.push([0.5 * ax + half * bx, 0.5 * az + half * bz]);
      arc((half + fillet) * (ax + bx), (half + fillet) * (az + bz), fillet, [-bx, -bz], [-ax, -az]);
      pts.push([half * ax + 0.5 * bx, half * az + 0.5 * bz]);
    } else pts.push([0.5 * (ax + bx), 0.5 * (az + bz)]);
  });
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))).rotateX(-Math.PI / 2);
  pathShapes.set(key, geo);
  return geo;
}

// Where a path's edging goes (a kerb, a beam): strips w wide just outside
// its edges, [x0, z0, x1, z1, along x]. The ones along x run on round the
// outside corners and the others stop short of the inside ones, so none overlap.
function pathEdges(at, w) {
  const h = PATH_HALF;
  const strips = [];
  for (const [dx, dz] of SIDES) {
    if (at(dx, dz)) continue;
    if (dz) strips.push([at(-1, 0) ? -0.5 : -h - w, dz * h, at(1, 0) ? 0.5 : h + w, dz * (h + w), true]);
    else strips.push([dx * h, at(0, -1) ? -0.5 : -h, dx * (h + w), at(0, 1) ? 0.5 : h, false]);
  }
  for (const [sx, sz] of CORNERS) {
    if (!at(sx, 0) || !at(0, sz) || at(sx, sz)) continue;
    strips.push([sx * h, sz * h, sx * 0.5, sz * (h + w), true]);
    strips.push([sx * h, sz * (h + w), sx * (h + w), sz * 0.5, false]);
  }
  return strips.map(([x0, z0, x1, z1, alongX]) => [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), alongX]);
}

// Flagstones' lengths in a row across the middle of a tile, in CELLs
const FLAG_ROWS = [[2, 2, 2], [3, 3], [2, 4], [4, 2], [3, 1, 2], [2, 1, 3], [1, 3, 2]];

// A path's model: near, the paths round it ([dx, dz, id])
function pathModel(id, gx, gz, near) {
  const at = (dx, dz) => near.find(([x, z]) => x === dx && z === dz)?.[2];
  const h = PATH_HALF;
  // its parts, [shape, material, where]: made one mesh to each material (mergeParts)
  const parts = [];
  const lay = (geo, material, x, y, z, sx, sy, sz, turn = 0) => parts.push([geo, material, new THREE.Matrix4().compose(partAt.set(x, y, z), partTurn.setFromAxisAngle(UP, turn), partSize.set(sx, sy, sz))]);
  const flat = (geo, material, y) => parts.push([geo, material, new THREE.Matrix4().makeTranslation(0, y, 0)]);
  // steady numbers from the tile, one after another
  let n = 0;
  const rnd = () => hash(gx * 1031 + n * 7919, gz * 2053 - ++n * 104729);
  if (id === 'wood_path') {
    // a boardwalk over dark ground, a beam along its edges and a post at its
    // outside corners. Its planks lie across the way it goes: north to south
    // (for going east-west) unless it only goes north-south, and the ends
    // out to the paths beside it lie their own way
    flat(pathGround(at, h, 0, 0), MATS.soil, 0.018);
    const planks = (x0, z0, x1, z1, alongX) => {
      for (let i = 0; i < 8; i++) {
        const c = cellMid(i);
        if (alongX ? c < z0 || c > z1 : c < x0 || c > x1) continue;
        const r = alongX ? hash(gx * 8 + Math.round(x0 * 8) + 9001, gz * 8 + i) : hash(gx * 8 + i, gz * 8 + Math.round(z0 * 8));
        const len = (alongX ? x1 - x0 : z1 - z0) - 0.016 - r * 0.012;
        const mid = (alongX ? x0 + x1 : z0 + z1) / 2 + (r - 0.5) * 0.008;
        const top = 0.058 + r * 0.006;
        lay(box, [MATS.plankA, MATS.plankB, MATS.rail][Math.floor(r * 3)], alongX ? mid : c, top - 0.02, alongX ? c : mid, alongX ? len : 0.105, 0.04, alongX ? 0.105 : len);
      }
    };
    planks(-h, -h, h, h, !at(1, 0) && !at(-1, 0) && !!(at(0, 1) || at(0, -1)));
    for (const [dx, dz] of SIDES) {
      if (!at(dx, dz)) continue;
      if (dx) planks(Math.min(dx * h, dx * 0.5), -h, Math.max(dx * h, dx * 0.5), h, false);
      else planks(-h, Math.min(dz * h, dz * 0.5), h, Math.max(dz * h, dz * 0.5), true);
    }
    for (const [sx, sz] of CORNERS) {
      if (pathCell(at, sx > 0 ? 7 : 0, sz > 0 ? 7 : 0)) planks(Math.min(sx * h, sx * 0.5), Math.min(sz * h, sz * 0.5), Math.max(sx * h, sx * 0.5), Math.max(sz * h, sz * 0.5), false);
    }
    for (const [x0, z0, x1, z1] of pathEdges(at, 0.06)) lay(box, MATS.bark, (x0 + x1) / 2, 0.035, (z0 + z1) / 2, x1 - x0, 0.07, z1 - z0);
    for (const [sx, sz] of CORNERS) {
      if (!at(sx, 0) && !at(0, sz)) lay(box, MATS.post, sx * (h + 0.03), 0.06, sz * (h + 0.03), 0.09, 0.12, 0.09);
    }
  } else if (id === 'stone_path') {
    // flagstones in rows, of a few lengths, with dark ground between them.
    // The ones on a tile's edge are halves of stones shared with the next
    // tile: each tile draws its half, both alike (worked out from the whole
    // stone's place)
    flat(pathGround(at, h + 0.03, 0.08, 0.05), MATS.grout, 0.018);
    const gap = 0.022;
    for (const [j0, j1] of [[0, 0], [1, 2], [3, 4], [5, 6], [7, 7]]) {
      const wz = gz * 8 + (j0 ? j0 : -1);
      const runs = [[0, 0]];
      let i = 1;
      for (const len of FLAG_ROWS[Math.floor(hash(gx * 7 + 3, wz) * FLAG_ROWS.length)]) {
        runs.push([i, i + len - 1]);
        i += len;
      }
      runs.push([7, 7]);
      for (const [i0, i1] of runs) {
        if (!pathCell(at, i0, j0)) continue;
        const wx = gx * 8 + (i0 ? i0 : -1);
        const r = hash(wx, wz);
        const x0 = -0.5 + i0 * CELL + (i0 > 0 ? gap / 2 : 0);
        const x1 = -0.5 + (i1 + 1) * CELL - (i1 < 7 ? gap / 2 : 0);
        const z0 = -0.5 + j0 * CELL + (j0 > 0 ? gap / 2 : 0);
        const z1 = -0.5 + (j1 + 1) * CELL - (j1 < 7 ? gap / 2 : 0);
        const top = 0.04 + r * 0.012;
        // (a whole one sits a little askew)
        const whole = i0 > 0 && i1 < 7 && j0 > 0 && j1 < 7;
        lay(box, [MATS.stone, MATS.stoneLight, MATS.flagstone][Math.floor(hash(wz + 77, wx) * 3)], (x0 + x1) / 2, top - 0.015, (z0 + z1) / 2, x1 - x0, 0.03, z1 - z0, whole ? (r - 0.5) * 0.06 : 0);
      }
    }
  } else if (id === 'cobble_path') {
    // small cobbles packed close, one to a cell, each a little different, on
    // dark grit, with a kerb of long stones along the edges
    flat(pathGround(at, h + 0.02, 0, 0), MATS.stoneDark, 0.018);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (!pathCell(at, i, j)) continue;
        const r = hash(gx * 8 + i, gz * 8 + j);
        const r2 = hash(gz * 8 + j + 51, gx * 8 + i);
        const k = 0.1 + r2 * 0.022;
        lay(flag, r < 0.4 ? MATS.stone : r < 0.8 ? MATS.stoneLight : MATS.flagstone, cellMid(i) + (r2 - 0.5) * 0.016, 0.036 + r * 0.008, cellMid(j) + (r - 0.5) * 0.016, k, 0.045, k, r * 6);
      }
    }
    for (const [x0, z0, x1, z1, alongX] of pathEdges(at, 0.07)) {
      const len = alongX ? x1 - x0 : z1 - z0;
      const count = Math.max(1, Math.round(len / 0.25));
      for (let s = 0; s < count; s++) {
        const a = (alongX ? x0 : z0) + (len * s) / count + 0.006;
        const b = (alongX ? x0 : z0) + (len * (s + 1)) / count - 0.006;
        const [x, z] = alongX ? [(a + b) / 2, (z0 + z1) / 2] : [(x0 + x1) / 2, (a + b) / 2];
        const r = hash(Math.round((gx + x) * 16), Math.round((gz + z) * 16));
        const kh = 0.064 + r * 0.014;
        lay(box, r < 0.5 ? MATS.stoneLight : MATS.stone, x, kh / 2, z, alongX ? b - a : x1 - x0, kh, alongX ? z1 - z0 : b - a);
      }
    }
  } else if (id === 'gravel_path') {
    // raked gravel with a darker edge, round at the corners, and pebbles
    // scattered over it
    flat(pathGround(at, h + 0.035, 0.16, 0.06), MATS.gravelDark, 0.016);
    flat(pathGround(at, h, 0.14, 0.09), MATS.gravel, 0.022);
    for (let i = 0; i < 30; i++) {
      const x = rnd() - 0.5;
      const z = rnd() - 0.5;
      const k = 0.035 + rnd() * 0.05;
      const shade = rnd();
      if (!inPath(at, x, z, k / 2, 0.14)) continue;
      lay(ball, shade < 0.4 ? MATS.stone : shade < 0.7 ? MATS.stoneLight : shade < 0.85 ? MATS.stoneDark : MATS.gravelDark, x, 0.026, z, k, k * 0.5, k);
    }
  } else if (id === 'stepping_stones') {
    // round flat stones a stride apart, on toward each path beside it: one in
    // the middle of the tile, one on the edge between it and more stepping
    // stones (drawn by the tile west or north of it), and one near the edge
    // before another kind of path. On its own, three across the tile.
    let stones = [[0, 0, 0.36]];
    if (!SIDES.some(([dx, dz]) => at(dx, dz))) {
      const flip = hash(gx, gz) < 0.5 ? 1 : -1;
      stones = [[-0.26 * flip, -0.24, 0.36], [0.06 * flip, 0.04, 0.4], [0.28 * flip, 0.3, 0.32]];
    }
    for (const [dx, dz] of SIDES) {
      const next = at(dx, dz);
      if (next === 'stepping_stones' ? dx > 0 || dz > 0 : next) stones.push(next === 'stepping_stones' ? [dx * 0.5, dz * 0.5, 0.34] : [dx * 0.38, dz * 0.38, 0.3]);
    }
    for (const [x, z, k] of stones) {
      // (from where it is, so a stone on the edge is the same from either side)
      const r = hash(Math.round((gx + x) * 8), Math.round((gz + z) * 8));
      const r2 = hash(Math.round((gz + z) * 8) + 13, Math.round((gx + x) * 8));
      const s = k * (0.92 + r * 0.16);
      const px = x + (r2 - 0.5) * 0.07;
      const pz = z + (r - 0.5) * 0.07;
      lay(log, r2 < 0.5 ? MATS.stoneLight : MATS.stone, px, 0.034, pz, s, 0.05, s * (0.84 + r2 * 0.14), r * 6);
      lay(log, MATS.stoneDark, px, 0.016, pz, s + 0.04, 0.02, s * (0.84 + r2 * 0.14) + 0.04, r * 6);
    }
  }
  return mergeParts(parts);
}

// One mesh to each material, from a piece's many small parts ([shape,
// material, where]): a path's dozens of stones, drawn one by one, would slow
// a long path down. Its shapes are its own (`own`), to dispose of when it's
// taken away.
const partAt = new THREE.Vector3();
const partTurn = new THREE.Quaternion();
const partSize = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const partNormals = new THREE.Matrix3();
function mergeParts(parts) {
  const byMat = new Map();
  for (const p of parts) {
    if (!byMat.has(p[1])) byMat.set(p[1], []);
    byMat.get(p[1]).push(p);
  }
  const merged = new THREE.Group();
  for (const [material, list] of byMat) {
    const count = list.reduce((sum, [geo]) => sum + (geo.index ?? geo.attributes.position).count, 0);
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    let o = 0;
    for (const [geo, , where] of list) {
      const { position, normal } = geo.attributes;
      partNormals.getNormalMatrix(where);
      for (let i = 0; i < (geo.index ?? position).count; i++, o += 3) {
        const k = geo.index ? geo.index.getX(i) : i;
        partAt.fromBufferAttribute(position, k).applyMatrix4(where).toArray(pos, o);
        partAt.fromBufferAttribute(normal, k).applyMatrix3(partNormals).normalize().toArray(nor, o);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.userData.own = true;
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    merged.add(mesh);
  }
  return merged;
}
const disposeOwn = (group) => group.traverse((obj) => obj.isMesh && obj.geometry.userData.own && obj.geometry.dispose());

// A piece's model, at the middle of its tile. joined: the directions
// ([dx, dz]) its fence or wall runs on to a neighbour, or for a path, the
// paths round it ([dx, dz, id]). Returns the group and its colliders' boxes
// ({ x, y, z, w, h, d }, relative to the tile).
function model(id, gx, gz, joined) {
  if (PIECES[id].path) return { group: pathModel(id, gx, gz, joined), solids: [] };
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
    stoneWall(g, solids, id === 'stone_wall' ? WALL_H : FENCE_H, joined, gx, gz);
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
    // fence, wall or hedge it joins as wide as itself (so a row of them is one
    // hedge), with tufts of new growth on top
    const r = hash(gx, gz);
    const h = FENCE_H - 0.1;
    part(g, box, MATS.hedge, 0, h / 2, 0, 0.62, h, 0.62);
    part(g, box, MATS.hedgeDark, 0, 0.08, 0, 0.66, 0.16, 0.66).castShadow = false;
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.62, h: FENCE_H, d: 0.62 });
    const tufts = [[0, 0]];
    for (const [dx, dz] of joined) {
      part(g, box, MATS.hedge, dx * 0.25, h / 2, dz * 0.25, dx ? 0.5 : 0.62, h, dz ? 0.5 : 0.62);
      part(g, box, MATS.hedgeDark, dx * 0.25, 0.08, dz * 0.25, dx ? 0.5 : 0.66, 0.16, dz ? 0.5 : 0.66).castShadow = false;
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.62, h: FENCE_H, d: dz ? 0.5 : 0.62 });
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
      // a sawn-off stump in its bark and its rings on top
      const r = hash(gx, gz);
      part(g, log, MATS.bark, 0, h / 2, 0, 0.9, h, 0.9);
      [[0.8, MATS.endGrain], [0.6, MATS.crate], [0.44, MATS.endGrain], [0.26, MATS.crate], [0.1, MATS.endGrain]].forEach(([k, m], i) => {
        part(g, log, m, 0, h + 0.004 + i * 0.002, 0, k, 0.008, k).castShadow = false;
      });
      // its foot flaring out, and roots tapering away from it into the ground
      part(g, flare, MATS.bark, 0, 0.09, 0, 1.06, 0.18, 1.06);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + r * 6;
        const len = 0.38 + ((r * 10 + i * 3) % 3) * 0.03;
        const dip = 0.6; // (how steeply it goes down into the ground: its end is under it)
        const root = new THREE.Group();
        root.rotation.y = -a;
        part(root, rootShape, MATS.bark, 0.25 + (len / 2) * Math.cos(dip), 0.19 - (len / 2) * Math.sin(dip), 0, 0.3, len, 0.26).rotation.z = -(Math.PI / 2 + dip);
        g.add(root);
      }
    } else if (id === 'grain_sacks') {
      // plump sacks of flax seed, two lying along the tile and two across
      // them on top, each gathered in at one end to a tie and a tuft of
      // sacking past it, over a dark core so no light shows between them
      const r = hash(gx, gz);
      part(g, box, MATS.twine, 0, h / 2 - 0.04, 0, w - 0.56, h - 0.3, w - 0.56);
      const sack = (x, y, z, along, i) => {
        const [ax, az] = along ? [1, 0] : [0, 1];
        const end = i % 2 ? 1 : -1; // (the end its neck is at)
        const mat = i % 2 ? MATS.sack : MATS.sackDark;
        // its length along [ax, az] and its thickness across, its middle o along from (x, y, z)
        const lie = (geo, material, o, dy, len, k) => {
          const m = part(g, geo, material, x + ax * o, y + dy, z + az * o, k, len, k);
          if (along) m.rotation.z = -end * Math.PI / 2;
          else m.rotation.x = end * Math.PI / 2;
          return m;
        };
        part(g, lump, mat, x, y, z, along ? 0.82 : 0.52, 0.46, along ? 0.52 : 0.82);
        lie(shoulder, mat, end * 0.42, 0.03, 0.1, 0.2); // the neck, narrowing to the tie
        lie(barrel, MATS.twine, end * 0.47, 0.03, 0.03, 0.12).castShadow = false;
        part(g, lump, mat, x + ax * end * 0.51, y + 0.04, z + az * end * 0.51, 0.1, 0.13, 0.1).castShadow = false;
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
      cask(g, 0, h, w);
    } else if (id === 'barrel_stack') {
      // two barrels, one stood on the other, the top one's lid turned a
      // little differently on every tile, and a tap on the bottom one
      const r = hash(gx, gz);
      cask(g, 0, h / 2, w);
      const top = new THREE.Group();
      cask(top, h / 2, h / 2, w);
      top.rotation.y = r * Math.PI;
      g.add(top);
      part(g, box, MATS.plankB, 0, 0.22, 0.47, 0.06, 0.06, 0.1);
      part(g, box, MATS.iron, 0, 0.18, 0.51, 0.04, 0.08, 0.04).castShadow = false;
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
    } else if (id === 'straw_step') {
      // half a bale, lying low, with its twine round it and a few loose straws
      const r = hash(gx, gz);
      part(g, box, MATS.straw, 0, h / 2, 0, w, h, w);
      part(g, box, MATS.strawDark, 0, 0.04, 0, w + 0.02, 0.08, w + 0.02).castShadow = false;
      for (const z of [-0.24, 0.24]) part(g, box, MATS.twine, 0, h / 2, z, w + 0.02, h + 0.02, 0.04).castShadow = false;
      for (let i = 0; i < 4; i++) {
        const a = i * 2.3 + r * 6;
        part(g, box, MATS.strawDark, Math.cos(a) * 0.28, h + 0.01, Math.sin(a) * 0.28, 0.24, 0.015, 0.03).rotation.y = a;
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
    } else if (id === 'boulder') {
      // a rough, faceted boulder, broad at its foot and worn flat on top
      // where it is stood on, a couple of fallen chips beside it and lichen
      // on some
      const r = hash(gx, gz);
      const rand = mulberry32(Math.floor(r * 4294967296));
      part(g, boulderShape(rand), r < 0.5 ? MATS.stone : MATS.stoneLight, 0, h / 2, 0, 0.98, h, 0.98).rotation.y = rand() * Math.PI * 2;
      for (let i = 0; i < 2; i++) {
        const a = rand() * Math.PI * 2;
        const k = 0.14 + rand() * 0.08;
        part(g, ball, MATS.stoneDark, Math.cos(a) * 0.46, k * 0.3, Math.sin(a) * 0.46, k, k * 0.7, k).rotation.y = a;
      }
      if (r < 0.6) {
        const a = r * 10;
        part(g, flag, MATS.lichen, Math.cos(a) * 0.14, h + 0.003, Math.sin(a) * 0.14, 0.22, 0.006, 0.17).castShadow = false;
        part(g, flag, MATS.moss, -Math.cos(a) * 0.16, h + 0.003, -Math.sin(a) * 0.1, 0.14, 0.006, 0.12).castShadow = false;
      }
    } else if (id === 'mossy_stone_block') {
      // old stone, dressed like a stone block, grown over from one corner:
      // moss in a grid of cells on top, thick at that corner and thinning out
      // across it, the stone showing past it, and moss hanging down the two
      // sides by the corner under its edge (all one mesh: mergeParts)
      const r = hash(gx, gz);
      const rand = mulberry32(Math.floor(r * 4294967296));
      part(g, box, r < 0.5 ? MATS.stone : MATS.stoneDark, 0, h / 2, 0, w, h, w);
      part(g, box, MATS.stoneDark, 0, Math.min(0.1, h / 4), 0, w + 0.02, Math.min(0.2, h / 2), w + 0.02);
      for (const [fx, fz] of DIRS) part(g, box, MATS.stoneDark, fx * 0.485, h / 2, fz * 0.485, fz ? w : 0.03, 0.05, fz ? 0.03 : w);
      const [cx, cz] = CORNERS[Math.floor(r * 4)];
      const cell = w / MOSS_CELLS;
      const mid = (i) => -w / 2 + cell * (i + 0.5);
      const grown = [];
      for (let i = 0; i < MOSS_CELLS; i++) {
        for (let j = 0; j < MOSS_CELLS; j++) {
          const far = (cx > 0 ? MOSS_CELLS - 1 - i : i) + (cz > 0 ? MOSS_CELLS - 1 - j : j);
          grown[i * MOSS_CELLS + j] = rand() < MOSS_COVER[far];
        }
      }
      const moss = [];
      const lay = (x, y, z, sx, sy, sz) => moss.push([box, rand() < 0.3 ? MATS.mossDark : MATS.moss, new THREE.Matrix4().compose(partAt.set(x, y, z), partTurn.identity(), partSize.set(sx, sy, sz))]);
      const hang = () => cell * [0.5, 1, 1, 1.5][Math.floor(rand() * 4)];
      const edgeI = cx > 0 ? MOSS_CELLS - 1 : 0;
      const edgeJ = cz > 0 ? MOSS_CELLS - 1 : 0;
      for (let i = 0; i < MOSS_CELLS; i++) {
        for (let j = 0; j < MOSS_CELLS; j++) {
          if (!grown[i * MOSS_CELLS + j]) continue;
          const t = 0.02 + rand() * 0.02;
          lay(mid(i), h + t / 2, mid(j), cell + 0.002, t, cell + 0.002);
          if (i === edgeI) {
            const len = hang();
            lay(cx * (w / 2 + 0.01), h + 0.02 - len / 2, mid(j), 0.02, len + 0.02, cell);
          }
          if (j === edgeJ) {
            const len = hang();
            lay(mid(i), h + 0.02 - len / 2, cz * (w / 2 + 0.01), cell, len + 0.02, 0.02);
          }
        }
      }
      g.add(mergeParts(moss));
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
  } else if (id === 'arcade') {
    // a little fairground booth: a counter striped red and cream with cards
    // and a coin on it, a big gold coin on the back board, a striped awning,
    // and a sign on top ringed with bulbs that light up at night
    part(g, box, MATS.plankB, 0, 0.44, 0.02, 0.92, 0.88, 0.6);
    for (let i = 0; i < 6; i++) part(g, box, i % 2 ? MATS.linen : MATS.cloth, -0.385 + i * 0.154, 0.46, 0.325, 0.154, 0.74, 0.02).castShadow = false;
    part(g, box, MATS.benchTop, 0, 0.92, 0.04, 1.02, 0.08, 0.7);
    part(g, box, MATS.linen, -0.22, 0.975, 0.12, 0.16, 0.03, 0.22); // a deck of cards
    part(g, box, MATS.cloth, 0.04, 0.965, 0.14, 0.14, 0.01, 0.2).rotation.y = 0.3; // one dealt, face down
    part(g, flag, MATS.brass, 0.26, 0.975, 0.1, 0.14, 0.03, 0.14); // a coin
    for (const x of [-0.46, 0.46]) {
      part(g, box, MATS.post, x, 1.05, -0.28, 0.08, 2.1, 0.08);
      part(g, box, MATS.post, x, 1.4, 0.34, 0.06, 0.96, 0.06);
    }
    part(g, box, MATS.plankA, 0, 1.45, -0.3, 0.86, 0.9, 0.05); // the back board
    part(g, flag, MATS.brass, 0, 1.48, -0.26, 0.42, 0.04, 0.42).rotation.x = Math.PI / 2;
    part(g, flag, MATS.endGrain, 0, 1.48, -0.235, 0.26, 0.02, 0.26).rotation.x = Math.PI / 2;
    // the awning, sloping down to the front, with a scalloped edge
    for (let i = 0; i < 7; i++) {
      const x = -0.48 + i * 0.16;
      part(g, box, i % 2 ? MATS.linen : MATS.cloth, x, 1.98, 0.06, 0.16, 0.03, 0.82).rotation.x = 0.32;
      part(g, box, i % 2 ? MATS.linen : MATS.cloth, x, 1.81, 0.47, 0.14, 0.1, 0.02).castShadow = false;
    }
    // the sign, and its bulbs
    part(g, box, MATS.plankB, 0, 2.38, -0.28, 0.92, 0.36, 0.06);
    part(g, box, MATS.cloth, 0, 2.38, -0.245, 0.8, 0.24, 0.02).castShadow = false;
    for (let i = 0; i < 6; i++) {
      for (const y of [2.22, 2.54]) part(g, ball, MATS.lantern, -0.4 + i * 0.16, y, -0.24, 0.06, 0.06, 0.06).castShadow = false;
    }
    solids.push({ x: 0, y: 1.1, z: 0, w: 0.96, h: 2.2, d: 0.72 });
    workbench(g, solids, benchLevel);
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
    // the hay, filling the bed and heaped up over its sides, with wisps
    // sticking out
    part(g, box, MATS.straw, 0.06, 0.7, 0, 0.74, 0.16, 0.56);
    part(g, lump, MATS.straw, 0.06, 0.82, 0, 0.88, 0.42, 0.68);
    part(g, lump, MATS.strawDark, 0.06 + (r - 0.5) * 0.24, 0.98, (r - 0.5) * 0.1, 0.5, 0.26, 0.42);
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
  } else if (id === 'torch') {
    // a garden torch: a stick in the ground, a head of bound straw on top,
    // and a flame in it
    part(g, shaft, MATS.post, 0, 0.62, 0, 0.09, 1.24, 0.09);
    part(g, shaft, MATS.straw, 0, 1.28, 0, 0.18, 0.16, 0.18);
    part(g, shaft, MATS.twine, 0, 1.25, 0, 0.19, 0.04, 0.19).castShadow = false;
    fire(g, 0, 1.33, 0, 0.36, 3, hash(gx, gz));
    solids.push({ x: 0, y: 0.7, z: 0, w: 0.2, h: 1.4, d: 0.2 });
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
  } else if (id === 'wattle_fence') {
    // hazel withies woven in and out between thin stakes: a stake in the
    // middle of the tile and a woven run to each fence, hedge or wall it joins
    const r = hash(gx, gz);
    part(g, log, MATS.bark, 0, (FENCE_H + 0.05) / 2, 0, 0.12, FENCE_H + 0.05, 0.12);
    part(g, log, MATS.endGrain, 0, FENCE_H + 0.055, 0, 0.1, 0.01, 0.1).castShadow = false;
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.3, h: FENCE_H, d: 0.3 });
    for (const [dx, dz] of joined) {
      part(g, log, MATS.bark, dx * 0.3, (FENCE_H - 0.1) / 2, dz * 0.3, 0.08, FENCE_H - 0.1, 0.08);
      for (let i = 0; i < 9; i++) {
        // each withy passes the stake on the other side from the one below it
        const weave = ((i + dx + dz + 2) % 2 ? 1 : -1) * 0.035;
        const y = 0.14 + i * 0.09 + ((r * 10 + i) % 2) * 0.01;
        const withy = part(g, flag, i % 2 ? MATS.withyDark : MATS.withy, dx * 0.25 + (dz ? weave : 0), y, dz * 0.25 + (dx ? weave : 0), 0.1, 0.54, 0.1);
        if (dx) withy.rotation.z = Math.PI / 2;
        else withy.rotation.x = Math.PI / 2;
      }
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.2, h: FENCE_H, d: dz ? 0.5 : 0.2 });
    }
  } else if (id === 'water_trough') {
    // a long plank trough on splayed legs, bound with iron and full of
    // water, with a dipper hung on the rim of some
    const r = hash(gx, gz);
    for (const s of [-1, 1]) {
      part(g, box, MATS.plankA, 0, 0.52, s * 0.22, 0.9, 0.3, 0.06);
      part(g, box, MATS.plankB, s * 0.42, 0.52, 0, 0.06, 0.3, 0.5);
      for (const t of [-1, 1]) part(g, box, MATS.post, s * 0.34, 0.2, t * 0.19, 0.07, 0.42, 0.07).rotation.x = -t * 0.15;
    }
    part(g, box, MATS.plankB, 0, 0.39, 0, 0.84, 0.04, 0.44);
    for (const x of [-0.26, 0.26]) part(g, box, MATS.iron, x, 0.52, 0, 0.04, 0.32, 0.52).castShadow = false;
    part(g, box, MATS.water, 0, 0.62, 0, 0.78, 0.01, 0.38).castShadow = false;
    if (r < 0.5) {
      const x = (r - 0.25) * 1.2;
      part(g, barrel, MATS.stave, x, 0.66, 0.14, 0.14, 0.08, 0.14);
      part(g, box, MATS.post, x, 0.7, 0.26, 0.03, 0.03, 0.2).castShadow = false;
    }
    solids.push({ x: 0, y: 0.34, z: 0, w: 0.92, h: 0.68, d: 0.52 });
  } else if (id === 'stone_bench') {
    // a stone slab on two blocks, facing the camera, moss on the slab of
    // some
    const r = hash(gx, gz);
    const light = r < 0.5 ? MATS.stone : MATS.stoneLight;
    for (const s of [-1, 1]) {
      part(g, box, MATS.stoneDark, s * 0.32, 0.2, 0, 0.2, 0.4, 0.36);
      part(g, box, MATS.stone, s * 0.32, 0.03, 0, 0.26, 0.06, 0.42).castShadow = false;
    }
    part(g, box, light, 0, 0.45, 0, 0.94, 0.1, 0.42);
    part(g, box, MATS.stoneDark, 0, 0.398, 0, 0.9, 0.01, 0.4).castShadow = false;
    if (r < 0.4) {
      // a patch of it at one end, growing on over the back edge
      const s = r < 0.2 ? -1 : 1;
      part(g, flag, MATS.moss, s * 0.33, 0.503, -0.1, 0.22, 0.012, 0.18).rotation.y = r * 9;
      part(g, flag, MATS.mossDark, s * 0.24, 0.504, -0.15, 0.12, 0.012, 0.1).rotation.y = r * 5;
      part(g, box, MATS.mossDark, s * 0.3, 0.47, -0.213, 0.2, 0.07, 0.012);
    }
    solids.push({ x: 0, y: 0.25, z: 0, w: 0.94, h: 0.5, d: 0.42 });
  } else if (id === 'sundial') {
    // a brass dial on a stone pedestal, hours marked round its face, and
    // its gnomon pointing north (away from the camera), as a sundial's must
    const r = hash(gx, gz);
    const light = r < 0.5 ? MATS.stone : MATS.stoneLight;
    part(g, flag, MATS.stoneDark, 0, 0.06, 0, 0.6, 0.12, 0.6);
    part(g, flag, MATS.stone, 0, 0.16, 0, 0.46, 0.08, 0.46);
    part(g, shaft, light, 0, 0.5, 0, 0.26, 0.6, 0.26);
    part(g, flag, MATS.stone, 0, 0.84, 0, 0.44, 0.08, 0.44);
    part(g, barrel, MATS.brass, 0, 0.9, 0, 0.56, 0.04, 0.56);
    part(g, barrel, MATS.stoneLight, 0, 0.925, 0, 0.5, 0.01, 0.5).castShadow = false;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mark = part(g, box, MATS.stoneDark, Math.cos(a) * 0.2, 0.932, Math.sin(a) * 0.2, i % 3 ? 0.04 : 0.07, 0.004, 0.015);
      mark.rotation.y = -a;
      mark.castShadow = false;
    }
    const gnomon = part(g, box, MATS.brass, 0, 1.0, -0.05, 0.015, 0.02, 0.28);
    gnomon.rotation.x = 0.55;
    part(g, box, MATS.brass, 0, 0.96, 0.03, 0.012, 0.07, 0.1);
    solids.push({ x: 0, y: 0.47, z: 0, w: 0.5, h: 0.94, d: 0.5 });
  } else if (id === 'wheelbarrow') {
    // a wooden barrow on an iron-shod wheel, set down at a slant that
    // differs on every tile, with stones, logs or a heap of earth in it
    const r = hash(gx, gz);
    const cart = new THREE.Group();
    part(cart, box, MATS.plankB, -0.02, 0.42, 0, 0.5, 0.05, 0.44);
    for (const s of [-1, 1]) {
      part(cart, box, MATS.plankA, -0.02, 0.52, s * 0.24, 0.56, 0.2, 0.04).rotation.x = s * 0.3;
      part(cart, box, MATS.plankA, -0.02 + s * 0.28, 0.52, 0, 0.04, 0.2, 0.5).rotation.z = -s * 0.35;
      part(cart, box, MATS.post, -0.09, 0.38, s * 0.17, 0.78, 0.05, 0.05).rotation.z = 0.08;
      part(cart, box, MATS.post, -0.2, 0.18, s * 0.17, 0.05, 0.36, 0.05);
    }
    const wheel = new THREE.Group();
    part(wheel, barrel, MATS.iron, 0, 0, 0, 0.34, 0.05, 0.34);
    part(wheel, barrel, MATS.stave, 0, 0, 0, 0.28, 0.06, 0.28);
    part(wheel, barrel, MATS.crateDark, 0, 0, 0, 0.08, 0.1, 0.08);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.32, 0.17, 0);
    cart.add(wheel);
    if (r < 0.35) {
      [[-0.1, -0.08], [0.08, 0.06], [-0.04, 0.1], [0.1, -0.1]].forEach(([x, z], i) => {
        part(cart, ball, i % 2 ? MATS.stoneLight : MATS.stone, x, 0.52, z, 0.2, 0.16, 0.2);
      });
    } else if (r < 0.7) {
      [[-0.1, 0.5], [0.08, 0.5], [-0.01, 0.6]].forEach(([z, y]) => {
        const l = part(cart, log, MATS.bark, -0.02, y, z, 0.13, 0.6, 0.13);
        l.rotation.z = Math.PI / 2;
        part(cart, log, MATS.endGrain, 0.285, y, z, 0.11, 0.01, 0.11).rotation.z = Math.PI / 2;
      });
    } else {
      part(cart, ball, MATS.soil, -0.02, 0.5, 0, 0.46, 0.22, 0.4);
    }
    cart.rotation.y = (r - 0.5) * 0.8;
    g.add(cart);
    solids.push({ x: 0, y: 0.35, z: 0, w: 0.9, h: 0.7, d: 0.9 });
  } else if (id === 'log_fence') {
    // whole logs, bark and all, laid two high between stout stumps: a stump
    // in the middle of the tile and a pair of logs to each fence, hedge or
    // wall it joins, the upper one a little thinner, each lying a touch
    // unevenly
    const r = hash(gx, gz);
    part(g, log, MATS.bark, 0, 0.5, 0, 0.26, 1, 0.26);
    part(g, log, MATS.endGrain, 0, 1.005, 0, 0.22, 0.01, 0.22).castShadow = false;
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.3, h: FENCE_H, d: 0.3 });
    for (const [dx, dz] of joined) {
      [[0.34, 0.2], [0.74, 0.16]].forEach(([y, k], i) => {
        const roll = ((r * 10 + i + dx + dz * 2 + 6) % 3) * 0.012;
        const l = part(g, log, i ? MATS.post : MATS.bark, dx * 0.29, y + roll, dz * 0.29, k, 0.58, k);
        if (dx) l.rotation.z = Math.PI / 2;
        else l.rotation.x = Math.PI / 2;
      });
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.2, h: FENCE_H, d: dz ? 0.5 : 0.2 });
    }
  } else if (id === 'mailbox') {
    // a wooden mailbox with a rounded lid on a post, its door facing the
    // camera and a red flag at its side: up on some (there's post), with a
    // letter poking out of the door of a few
    const r = hash(gx, gz);
    part(g, box, MATS.post, 0, 0.5, 0, 0.1, 1, 0.1);
    part(g, box, MATS.plankB, 0, 0.99, 0, 0.18, 0.04, 0.38);
    part(g, box, MATS.plankA, 0, 1.11, 0, 0.26, 0.2, 0.46);
    part(g, barrel, MATS.plankA, 0, 1.21, 0, 0.26, 0.46, 0.26).rotation.x = Math.PI / 2;
    part(g, box, MATS.plankB, 0, 1.15, 0.235, 0.22, 0.26, 0.02);
    part(g, box, MATS.iron, 0, 1.2, 0.25, 0.05, 0.03, 0.02).castShadow = false;
    if (r < 0.3) part(g, box, MATS.linen, 0.02, 1.25, 0.25, 0.16, 0.02, 0.06).castShadow = false;
    const arm = new THREE.Group();
    part(arm, box, MATS.cloth, 0, 0.12, 0, 0.02, 0.24, 0.04);
    part(arm, box, MATS.cloth, 0, 0.2, 0.06, 0.02, 0.09, 0.12);
    arm.position.set(0.14, 1.08, -0.06);
    if (r >= 0.5) arm.rotation.x = -Math.PI / 2; // down, lying along the side
    g.add(arm);
    solids.push({ x: 0, y: 0.66, z: 0, w: 0.3, h: 1.32, d: 0.5 });
  } else if (id === 'birdhouse') {
    // a little house on a tall pole, a round door with a perch under it and
    // a pitched roof, and a bird sat on the perch of some
    const r = hash(gx, gz);
    part(g, box, MATS.post, 0, 0.78, 0, 0.1, 1.56, 0.1);
    part(g, box, MATS.plankB, 0, 1.54, 0, 0.3, 0.04, 0.3);
    part(g, box, r < 0.5 ? MATS.plankA : MATS.picket, 0, 1.72, 0, 0.32, 0.32, 0.32);
    const gableEnd = part(g, box, r < 0.5 ? MATS.plankA : MATS.picket, 0, 1.88, 0, 0.22, 0.22, 0.32);
    gableEnd.rotation.z = Math.PI / 4;
    for (const s of [-1, 1]) part(g, box, MATS.roofTile, s * 0.11, 1.96, 0, 0.3, 0.04, 0.42).rotation.z = -s * 0.75;
    part(g, flag, MATS.hole, 0, 1.76, 0.162, 0.1, 0.01, 0.1).rotation.x = Math.PI / 2;
    part(g, log, MATS.post, 0, 1.66, 0.2, 0.025, 0.08, 0.025).rotation.x = Math.PI / 2;
    if (r < 0.5) {
      const bird = new THREE.Group();
      part(bird, ball, MATS.bird, 0, 0, 0, 0.12, 0.1, 0.16);
      part(bird, ball, MATS.birdBreast, 0, -0.02, 0.04, 0.09, 0.07, 0.08);
      part(bird, ball, MATS.bird, 0, 0.08, 0.07, 0.08, 0.08, 0.08);
      part(bird, tip, MATS.beak, 0, 0.08, 0.12, 0.025, 0.05, 0.025).rotation.x = Math.PI / 2;
      part(bird, box, MATS.bird, 0, 0.02, -0.1, 0.06, 0.02, 0.1).rotation.x = 0.4; // its tail
      bird.position.set(0, 1.73, 0.27);
      bird.rotation.y = (r - 0.25) * 2; // looking about
      g.add(bird);
    }
    solids.push({ x: 0, y: 1, z: 0, w: 0.2, h: 2, d: 0.2 });
  } else if (id === 'flagpole') {
    // a tall pole on a stone footing, a brass ball on top, and a pennant
    // flying from it, rippling in the wind: red, blue or yellow
    const r = hash(gx, gz);
    part(g, flag, MATS.stoneDark, 0, 0.08, 0, 0.44, 0.16, 0.44);
    part(g, flag, MATS.stone, 0, 0.2, 0, 0.3, 0.1, 0.3);
    part(g, shaft, MATS.post, 0, 1.4, 0, 0.08, 2.4, 0.08);
    part(g, ball, MATS.brass, 0, 2.64, 0, 0.12, 0.12, 0.12);
    part(g, box, MATS.twine, 0.05, 1.5, 0, 0.01, 2.1, 0.01).castShadow = false; // the halyard
    part(g, box, MATS.iron, 0.06, 1.0, 0, 0.04, 0.08, 0.04).castShadow = false; // its cleat
    const cloth = [MATS.cloth, MATS.blueCloth, MATS.straw][Math.floor(r * 3)];
    const trim = cloth === MATS.straw ? MATS.clothDark : MATS.linen; // a stripe along it
    for (let i = 0; i < 5; i++) {
      const h = 0.46 - i * 0.07; // narrowing to a point
      const z = Math.sin(i * 1.3 + r * 6) * 0.05;
      const seg = part(g, box, cloth, 0.11 + i * 0.13, 2.3, z, 0.16, h, 0.02);
      seg.rotation.y = Math.cos(i * 1.3 + r * 6) * 0.35;
      if (i < 3) part(g, box, trim, 0.11 + i * 0.13, 2.3, z, 0.161, 0.06, 0.025).rotation.y = seg.rotation.y;
    }
    solids.push({ x: 0, y: 1.3, z: 0, w: 0.3, h: 2.6, d: 0.3 });
  } else if (id === 'stone_cairn') {
    // flat stones piled one on another, each a little smaller and set a
    // little off the one below, with moss at the foot of some
    const r = hash(gx, gz);
    let y = 0;
    [[0.72, 0.22], [0.6, 0.2], [0.48, 0.18], [0.38, 0.17], [0.26, 0.16]].forEach(([k, h], i) => {
      const a = r * 6 + i * 2.3;
      const o = i ? 0.04 : 0;
      const s = part(g, ball, [MATS.stone, MATS.stoneLight, MATS.stoneDark][(i + Math.floor(r * 3)) % 3], Math.cos(a) * o, y + h / 2, Math.sin(a) * o, k, h, k * 0.9);
      s.rotation.y = a;
      y += h * 0.85;
    });
    if (r < 0.5) {
      part(g, ball, MATS.moss, -0.22, 0.05, 0.18, 0.24, 0.08, 0.18).castShadow = false;
      part(g, ball, MATS.mossDark, 0.26, 0.04, -0.08, 0.16, 0.06, 0.2).castShadow = false;
    }
    solids.push({ x: 0, y: y / 2, z: 0, w: 0.6, h: y, d: 0.6 });
  } else if (id === 'clothesline') {
    // two T-posts with a line strung between, and the washing pegged out on
    // it: a shirt, a sheet and a pair of trousers, in an order and a set of
    // colours that differ from tile to tile
    const r = hash(gx, gz);
    for (const s of [-1, 1]) {
      part(g, box, MATS.post, s * 0.42, 0.75, 0, 0.08, 1.5, 0.08);
      part(g, box, MATS.post, s * 0.42, 1.46, 0, 0.06, 0.06, 0.3);
    }
    for (const z of [-0.1, 0.1]) part(g, box, MATS.twine, 0, 1.44, z, 0.84, 0.012, 0.012).castShadow = false;
    const washing = [
      (x, z, m) => {
        // a shirt, its sleeves out to the sides
        part(g, box, m, x, 1.28, z, 0.18, 0.28, 0.02);
        for (const s of [-1, 1]) part(g, box, m, x + s * 0.12, 1.36, z, 0.08, 0.12, 0.02).rotation.z = s * 0.5;
      },
      (x, z) => part(g, box, MATS.linen, x, 1.22, z, 0.22, 0.4, 0.02), // a sheet
      (x, z, m) => {
        // trousers: two legs from a waistband
        part(g, box, m, x, 1.38, z, 0.18, 0.08, 0.02);
        for (const s of [-1, 1]) part(g, box, m, x + s * 0.05, 1.2, z, 0.07, 0.3, 0.02).rotation.z = s * 0.06;
      },
    ];
    const order = r < 1 / 3 ? [0, 1, 2] : r < 2 / 3 ? [1, 2, 0] : [2, 0, 1];
    const colours = [MATS.cloth, MATS.blueCloth, MATS.sack];
    order.forEach((w, i) => {
      const x = -0.24 + i * 0.25;
      const z = i % 2 ? 0.1 : -0.1;
      washing[w](x, z, colours[(i + Math.floor(r * 9)) % 3]);
      for (const s of [-1, 1]) part(g, box, MATS.plankA, x + s * 0.06, 1.44, z, 0.02, 0.06, 0.03).castShadow = false; // the pegs
    });
    solids.push({ x: 0, y: 0.75, z: 0, w: 0.94, h: 1.5, d: 0.34 });
  } else if (id === 'rope_fence') {
    // stout round posts with a thick rope slung between them, sagging a
    // little to the middle of each run, and tied round every post
    part(g, log, MATS.bark, 0, 0.45, 0, 0.18, 0.9, 0.18);
    part(g, log, MATS.endGrain, 0, 0.905, 0, 0.15, 0.01, 0.15).castShadow = false;
    part(g, log, MATS.twine, 0, 0.72, 0, 0.21, 0.07, 0.21).castShadow = false;
    solids.push({ x: 0, y: FENCE_H / 2, z: 0, w: 0.3, h: FENCE_H, d: 0.3 });
    for (const [dx, dz] of joined) {
      // from the knot on this post down to the tile's edge, where it meets
      // the half from the post beside it
      const rope = part(g, flag, MATS.twine, dx * 0.25, 0.66, dz * 0.25, 0.05, 0.52, 0.05);
      if (dx) rope.rotation.z = Math.PI / 2 - dx * 0.235;
      else rope.rotation.x = Math.PI / 2 + dz * 0.235;
      solids.push({ x: dx * 0.25, y: FENCE_H / 2, z: dz * 0.25, w: dx ? 0.5 : 0.2, h: FENCE_H, d: dz ? 0.5 : 0.2 });
    }
  } else if (id === 'log_bench') {
    // a log, split along its top for a seat, on two short stumps, facing
    // the camera
    const r = hash(gx, gz);
    for (const s of [-1, 1]) part(g, log, MATS.bark, s * 0.3, 0.15, 0, 0.24, 0.3, 0.24);
    const seat = part(g, log, MATS.bark, 0, 0.42, 0, 0.32, 0.94, 0.32);
    seat.rotation.z = Math.PI / 2;
    part(g, box, MATS.crate, 0, 0.555, 0, 0.92, 0.03, 0.22);
    for (const s of [-1, 1]) {
      const end = part(g, log, MATS.endGrain, s * 0.472, 0.42, 0, 0.27, 0.01, 0.27);
      end.rotation.z = Math.PI / 2;
      end.castShadow = false;
    }
    // a knot in the bark, somewhere along the front
    part(g, ball, MATS.crateDark, (r - 0.5) * 0.6, 0.42, 0.155, 0.07, 0.07, 0.03).castShadow = false;
    solids.push({ x: 0, y: 0.29, z: 0, w: 0.94, h: 0.58, d: 0.34 });
  } else if (id === 'compost_bin') {
    // a bin of slats with gaps between them for the air, on corner posts,
    // the earth inside showing through, and peelings and greens heaped on top
    const r = hash(gx, gz);
    part(g, box, MATS.soil, 0, 0.3, 0, 0.7, 0.58, 0.7);
    part(g, ball, MATS.soil, 0, 0.6, 0, 0.66, 0.22, 0.66);
    for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) part(g, box, MATS.post, x, 0.35, z, 0.08, 0.7, 0.08);
    for (const [fx, fz] of DIRS) {
      for (let i = 0; i < 4; i++) part(g, box, i % 2 ? MATS.plankA : MATS.plankB, fx * 0.38, 0.1 + i * 0.165, fz * 0.38, fz ? 0.74 : 0.04, 0.12, fz ? 0.04 : 0.74);
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4 + r * 6;
      const d = 0.08 + (i % 3) * 0.08;
      const bit = i % 3 === 2 ? MATS.beak : i % 2 ? MATS.leaf : MATS.hedgeLight;
      part(g, ball, bit, Math.cos(a) * d, 0.7 - d * 0.3, Math.sin(a) * d, 0.12, 0.05, 0.08).rotation.y = a;
    }
    solids.push({ x: 0, y: 0.36, z: 0, w: 0.84, h: 0.72, d: 0.84 });
  } else if (id === 'milk_churns') {
    // tin churns stood on a plank, waiting for the milk: two tall ones and
    // a short one in front, its lid off on some
    const r = hash(gx, gz);
    part(g, box, MATS.plankA, 0, 0.04, 0, 0.9, 0.08, 0.7);
    const churn = (x, z, k, lid) => {
      const y0 = 0.08;
      part(g, barrel, MATS.tin, x, y0 + 0.24 * k, z, 0.3 * k, 0.48 * k, 0.3 * k);
      part(g, shoulder, MATS.tin, x, y0 + 0.54 * k, z, 0.3 * k, 0.12 * k, 0.3 * k);
      part(g, barrel, MATS.tin, x, y0 + 0.65 * k, z, 0.15 * k, 0.1 * k, 0.15 * k);
      for (const y of [0.04, 0.44]) part(g, barrel, MATS.tinDark, x, y0 + y * k, z, 0.31 * k, 0.03, 0.31 * k).castShadow = false;
      if (lid) {
        part(g, barrel, MATS.tinDark, x, y0 + 0.71 * k, z, 0.18 * k, 0.03, 0.18 * k);
        part(g, ball, MATS.tinDark, x, y0 + 0.74 * k, z, 0.06, 0.04, 0.06).castShadow = false;
      } else {
        part(g, barrel, MATS.picket, x, y0 + 0.695 * k, z, 0.12 * k, 0.005, 0.12 * k).castShadow = false; // the milk
      }
      for (const s of [-1, 1]) part(g, box, MATS.tinDark, x + s * 0.16 * k, y0 + 0.5 * k, z, 0.03, 0.08, 0.06).castShadow = false; // its handles
    };
    churn(-0.2, -0.12, 1, true);
    churn(0.2, -0.14, 1, true);
    churn((r - 0.5) * 0.3, 0.2, 0.7, r < 0.6);
    solids.push({ x: 0, y: 0.4, z: 0, w: 0.86, h: 0.8, d: 0.66 });
  } else if (id === 'dovecote') {
    // a little house for doves up on a post: doorways under a tiled roof,
    // a perch along its front, and a few doves on it and about the roof
    const r = hash(gx, gz);
    const top = 1.55;
    part(g, box, MATS.post, 0, top / 2, 0, 0.12, top, 0.12);
    for (const s of [-1, 1]) {
      const brace = part(g, box, MATS.post, s * 0.12, top - 0.14, 0, 0.05, 0.3, 0.05);
      brace.rotation.z = -s * 0.7;
    }
    part(g, box, MATS.plankB, 0, top + 0.02, 0, 0.6, 0.05, 0.56);
    part(g, box, MATS.picket, 0, top + 0.24, 0, 0.5, 0.4, 0.46);
    for (const x of [-0.12, 0.12]) {
      part(g, box, MATS.hole, x, top + 0.2, 0.231, 0.1, 0.13, 0.01).castShadow = false;
      part(g, box, MATS.plankA, x, top + 0.12, 0.27, 0.16, 0.02, 0.08);
    }
    part(g, pyramid, MATS.roofTile, 0, top + 0.6, 0, 0.66, 0.32, 0.62);
    part(g, box, MATS.roofDark, 0, top + 0.45, 0, 0.66, 0.04, 0.62).castShadow = false;
    const dove = (x, y, z, a) => {
      const bird = new THREE.Group();
      part(bird, ball, MATS.dove, 0, 0.06, 0, 0.12, 0.1, 0.17);
      part(bird, ball, MATS.dove, 0, 0.13, 0.07, 0.08, 0.08, 0.08);
      part(bird, box, MATS.doveGrey, 0, 0.07, -0.11, 0.07, 0.02, 0.1).rotation.x = 0.3; // its tail
      for (const s of [-1, 1]) part(bird, box, MATS.doveGrey, s * 0.055, 0.07, -0.01, 0.02, 0.05, 0.12).castShadow = false;
      part(bird, tip, MATS.beak, 0, 0.13, 0.12, 0.02, 0.04, 0.02).rotation.x = Math.PI / 2;
      bird.position.set(x, y, z);
      bird.rotation.y = a;
      g.add(bird);
    };
    dove((r - 0.5) * 0.3, top + 0.13, 0.28, (r - 0.5) * 1.2);
    if (r < 0.7) dove(0.16 - r * 0.2, top + 0.68, 0.04, r * 6);
    if (r < 0.35) dove(0.3, top + 0.02, -0.08, Math.PI / 2);
    solids.push({ x: 0, y: top / 2, z: 0, w: 0.24, h: top, d: 0.24 });
    solids.push({ x: 0, y: top + 0.4, z: 0, w: 0.6, h: 0.8, d: 0.56 });
  } else if (id === 'lamp_post') {
    // an iron post on a stepped foot, and on top a lantern: panes of lit
    // glass in an iron frame, a pointed roof and a knob on that
    part(g, box, MATS.iron, 0, 0.08, 0, 0.36, 0.16, 0.36);
    part(g, box, MATS.iron, 0, 0.2, 0, 0.22, 0.08, 0.22);
    part(g, box, MATS.iron, 0, 0.98, 0, 0.1, 1.6, 0.1);
    part(g, box, MATS.iron, 0, 1.76, 0, 0.18, 0.06, 0.18); // the collar the lantern sits in
    part(g, box, MATS.iron, 0, 1.8, 0, 0.32, 0.04, 0.32);
    part(g, box, MATS.lantern, 0, 1.96, 0, 0.26, 0.28, 0.26).castShadow = false;
    for (const [x, z] of CORNERS) part(g, box, MATS.iron, x * 0.14, 1.96, z * 0.14, 0.04, 0.3, 0.04);
    part(g, box, MATS.iron, 0, 2.12, 0, 0.34, 0.04, 0.34);
    part(g, pyramid, MATS.iron, 0, 2.22, 0, 0.36, 0.16, 0.36);
    part(g, ball, MATS.iron, 0, 2.32, 0, 0.07, 0.07, 0.07);
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
  } else if (PIECES[id]?.relic) {
    // A relic from a sky isle, floating over a little pedestal (it turns: setNight)
    part(g, box, MATS.stone, 0, 0.06, 0, 0.7, 0.12, 0.7);
    part(g, box, MATS.stoneLight, 0, 0.42, 0, 0.42, 0.6, 0.42);
    part(g, box, MATS.stone, 0, 0.76, 0, 0.6, 0.08, 0.6);
    const relic = createItemMesh(id);
    relic.name = 'relic';
    relic.position.y = 1.25;
    relic.scale.setScalar(1.15);
    relic.castShadow = true;
    g.add(relic);
    solids.push({ x: 0, y: 0.4, z: 0, w: 0.6, h: 0.8, d: 0.6 });
  } else if (id === 'pond') {
    pond(g, solids, hash(gx, gz));
  } else if (PIECES[id]?.portal) {
    // A boss's portal (shared/bosses.js): a stone arch round a purple swirl
    // that turns (setNight). Walked up to, not into.
    part(g, box, MATS.stoneDark, 0, 0.06, 0, 1, 0.12, 0.5);
    for (const x of [-0.43, 0.43]) part(g, box, MATS.stone, x, 0.95, 0, 0.18, 1.7, 0.3);
    part(g, box, MATS.stoneLight, 0, 1.86, 0, 1.08, 0.2, 0.34);
    part(g, box, MATS.moss, -0.3, 1.97, 0.05, 0.3, 0.04, 0.2);
    const swirl = new THREE.Group();
    swirl.name = 'swirl';
    swirl.position.set(0, 0.98, 0);
    g.add(swirl);
    const [deep, light] = PORTAL_MATS[PIECES[id].portal] ?? PORTAL_MATS.parsnip;
    part(swirl, ball, deep, 0, 0, 0, 0.68, 1.6, 0.06);
    for (let i = 0; i < 3; i++) {
      const arm = part(swirl, box, light, 0, 0, 0.04, 0.05, 0.5, 0.02);
      arm.rotation.z = (i * Math.PI * 2) / 3;
      arm.position.set(Math.sin(-arm.rotation.z) * 0.16, Math.cos(arm.rotation.z) * 0.16, 0.04);
    }
    solids.push({ x: 0, y: 0.06, z: 0, w: 1, h: 0.12, d: 0.5 });
  } else if (PIECES[id]?.statue === 'lion') {
    // The super lion's statue: sat up proud on a plinth, its mane all round its head
    part(g, box, MATS.stoneDark, 0, 0.1, 0, 0.8, 0.2, 0.8);
    part(g, box, MATS.stone, 0, 0.32, 0, 0.66, 0.24, 0.66);
    part(g, ball, MATS.stoneLight, 0, 0.75, -0.08, 0.5, 0.62, 0.56); // body
    for (const x of [-0.13, 0.13]) part(g, box, MATS.stoneLight, x, 0.62, 0.17, 0.12, 0.42, 0.12); // front legs
    part(g, ball, MATS.stone, 0, 1.22, 0.05, 0.66, 0.66, 0.4); // mane
    part(g, ball, MATS.stoneLight, 0, 1.2, 0.14, 0.42, 0.42, 0.38); // head
    part(g, ball, MATS.stoneDark, 0, 1.14, 0.33, 0.1, 0.07, 0.06); // nose
    part(g, box, MATS.stone, 0.26, 0.5, -0.28, 0.08, 0.08, 0.3).rotation.y = 0.6; // tail
    solids.push({ x: 0, y: 0.6, z: 0, w: 0.7, h: 1.2, d: 0.7 });
  } else if (PIECES[id]?.statue === 'bee') {
    // The bee queen's statue: hovering (on a little stalk) over a plinth, her crown on
    part(g, box, MATS.stoneDark, 0, 0.1, 0, 0.8, 0.2, 0.8);
    part(g, box, MATS.stone, 0, 0.32, 0, 0.66, 0.24, 0.66);
    part(g, box, MATS.stoneDark, 0, 0.6, 0, 0.08, 0.4, 0.08);
    part(g, ball, MATS.stoneLight, 0, 1.0, -0.1, 0.55, 0.5, 0.65); // abdomen
    for (const z of [-0.02, -0.22]) part(g, box, MATS.stoneDark, 0, 1.0, z, 0.5, 0.42, 0.05);
    part(g, ball, MATS.stoneLight, 0, 1.18, 0.3, 0.4, 0.4, 0.38); // head
    part(g, shaft, MATS.lichen, 0, 1.42, 0.3, 0.22, 0.1, 0.22); // crown
    for (const sx of [-1, 1]) part(g, ball, MATS.stone, sx * 0.32, 1.28, -0.05, 0.42, 0.04, 0.26).rotation.z = sx * 0.4; // wings
    solids.push({ x: 0, y: 0.6, z: 0, w: 0.7, h: 1.2, d: 0.7 });
  } else if (PIECES[id]?.statue === 'crow') {
    // The giant crow's statue: perched on a plinth, wings folded, its scarf on
    part(g, box, MATS.stoneDark, 0, 0.1, 0, 0.8, 0.2, 0.8);
    part(g, box, MATS.stone, 0, 0.32, 0, 0.66, 0.24, 0.66);
    for (const x of [-0.1, 0.1]) part(g, box, MATS.stoneDark, x, 0.52, 0.05, 0.05, 0.18, 0.05); // legs
    part(g, ball, MATS.stoneLight, 0, 0.88, -0.05, 0.55, 0.55, 0.7); // body
    part(g, ball, MATS.stone, 0, 0.82, -0.4, 0.3, 0.08, 0.5).rotation.x = 0.4; // tail
    part(g, box, MATS.stone, 0, 1.1, 0.12, 0.42, 0.08, 0.3); // scarf
    part(g, ball, MATS.stoneLight, 0, 1.28, 0.16, 0.38, 0.36, 0.36); // head
    part(g, tip, MATS.lichen, 0, 1.25, 0.42, 0.1, 0.25, 0.1).rotation.x = Math.PI / 2; // beak
    solids.push({ x: 0, y: 0.6, z: 0, w: 0.7, h: 1.2, d: 0.7 });
  } else if (PIECES[id]?.statue === 'toad') {
    // The bog toad's statue: squatting on a plinth, eyes up, its lily pad on its head
    part(g, box, MATS.stoneDark, 0, 0.1, 0, 0.8, 0.2, 0.8);
    part(g, box, MATS.stone, 0, 0.32, 0, 0.66, 0.24, 0.66);
    part(g, ball, MATS.stoneLight, 0, 0.72, 0, 0.7, 0.48, 0.62); // body
    part(g, ball, MATS.stone, 0, 0.66, 0.16, 0.5, 0.32, 0.36); // belly
    for (const sx of [-1, 1]) {
      part(g, ball, MATS.stoneLight, sx * 0.17, 1.0, 0.1, 0.2, 0.2, 0.2); // eyes
      part(g, ball, MATS.stoneDark, sx * 0.17, 1.02, 0.19, 0.08, 0.1, 0.04);
      part(g, ball, MATS.stone, sx * 0.3, 0.56, 0.22, 0.16, 0.12, 0.2); // front feet
    }
    part(g, shaft, MATS.lichen, 0, 1.1, -0.06, 0.4, 0.04, 0.4); // the lily pad
    solids.push({ x: 0, y: 0.6, z: 0, w: 0.7, h: 1.2, d: 0.7 });
  } else if (PIECES[id]?.statue) {
    // A boss's statue: the evil parsnip in stone, on a plinth
    part(g, box, MATS.stoneDark, 0, 0.1, 0, 0.8, 0.2, 0.8);
    part(g, box, MATS.stone, 0, 0.32, 0, 0.66, 0.24, 0.66);
    const root = part(g, tip, MATS.stoneLight, 0, 0.98, 0, 0.62, 1.1, 0.62);
    root.rotation.x = Math.PI; // (point down)
    part(g, ball, MATS.stoneLight, 0, 1.5, 0, 0.62, 0.2, 0.62);
    for (const [x, z, r] of [[0, 0, 0], [0.1, 0.05, 0.4], [-0.1, -0.02, -0.4]]) {
      const leaf = part(g, box, MATS.moss, x, 1.75, z, 0.08, 0.42, 0.04);
      leaf.rotation.z = r;
    }
    for (const x of [-0.12, 0.12]) part(g, box, MATS.stoneDark, x, 1.25, 0.25, 0.14, 0.04, 0.04).rotation.z = x > 0 ? 0.4 : -0.4; // (grumpy brows)
    solids.push({ x: 0, y: 0.6, z: 0, w: 0.7, h: 1.2, d: 0.7 });
  } else if (id === 'planter') {
    part(g, box, MATS.stone, 0, 0.22, 0, 0.8, 0.44, 0.8);
    part(g, box, MATS.stoneLight, 0, 0.46, 0, 0.88, 0.06, 0.88);
    part(g, box, MATS.soil, 0, 0.48, 0, 0.7, 0.06, 0.7); // (2 cm over the rim: level with it, the two flickered)
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
  } else if (id === 'cheese_press') {
    // a press on a stout wooden base: two posts and a crossbeam, an iron
    // screw turned by a bar, down onto the board over a round mould
    part(g, box, MATS.plankB, 0, 0.12, 0, 0.9, 0.24, 0.7);
    for (const s of [-1, 1]) part(g, box, MATS.post, s * 0.38, 0.8, 0, 0.12, 1.3, 0.14);
    part(g, box, MATS.post, 0, 1.4, 0, 0.92, 0.14, 0.18);
    part(g, shaft, MATS.iron, 0, 1.16, 0, 0.07, 0.86, 0.07);
    part(g, box, MATS.iron, 0, 1.62, 0, 0.6, 0.04, 0.04); // the bar
    part(g, ball, MATS.iron, 0, 1.58, 0, 0.1, 0.1, 0.1);
    part(g, barrel, MATS.stave, 0, 0.44, 0, 0.48, 0.4, 0.48); // the mould
    part(g, barrel, MATS.cheese, 0, 0.65, 0, 0.42, 0.04, 0.42).castShadow = false;
    part(g, barrel, MATS.plankA, 0, 0.74, 0, 0.44, 0.06, 0.44); // the board pressing down
    solids.push({ x: 0, y: 0.75, z: 0, w: 0.9, h: 1.5, d: 0.7 });
  } else if (id === 'mayo_machine') {
    // a tin box on a little wooden stand with a crank on its side, and a
    // glass jar on top with the mayonnaise in it
    for (const [x, z] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) part(g, box, MATS.post, x, 0.15, z, 0.07, 0.3, 0.07);
    part(g, box, MATS.plankA, 0, 0.32, 0, 0.74, 0.06, 0.6);
    part(g, box, MATS.mayoTin, 0, 0.6, 0, 0.56, 0.5, 0.48);
    part(g, box, MATS.iron, 0, 0.36, 0, 0.6, 0.04, 0.52).castShadow = false;
    part(g, barrel, MATS.mayo, 0, 0.98, 0, 0.3, 0.24, 0.3).castShadow = false;
    part(g, barrel, MATS.glass, 0, 1.0, 0, 0.36, 0.32, 0.36).castShadow = false;
    part(g, barrel, MATS.iron, 0, 1.18, 0, 0.38, 0.05, 0.38);
    part(g, box, MATS.iron, 0.31, 0.7, 0, 0.06, 0.06, 0.06); // the crank
    part(g, box, MATS.iron, 0.35, 0.8, 0, 0.04, 0.24, 0.04);
    part(g, box, MATS.post, 0.39, 0.9, 0.05, 0.05, 0.05, 0.14);
    solids.push({ x: 0, y: 0.6, z: 0, w: 0.74, h: 1.2, d: 0.6 });
  } else if (id === 'loom') {
    // an upright frame, the warp threads strung top to bottom and the
    // cloth woven so far at the bottom of them, the beater bar in front
    for (const s of [-1, 1]) {
      part(g, box, MATS.post, s * 0.42, 0.75, 0, 0.1, 1.5, 0.1);
      part(g, box, MATS.post, s * 0.42, 0.05, 0, 0.12, 0.1, 0.6); // its foot
    }
    part(g, shaft, MATS.rail, 0, 1.36, 0, 0.1, 0.84, 0.1).rotation.z = Math.PI / 2;
    part(g, shaft, MATS.rail, 0, 0.36, 0, 0.1, 0.84, 0.1).rotation.z = Math.PI / 2;
    for (let i = 0; i < 9; i++) part(g, box, MATS.linen, -0.32 + i * 0.08, 0.96, 0, 0.015, 0.8, 0.015).castShadow = false;
    part(g, box, MATS.cloth, 0, 0.56, 0.01, 0.72, 0.36, 0.03);
    for (const y of [0.48, 0.64]) part(g, box, MATS.linen, 0, y, 0.03, 0.72, 0.04, 0.01).castShadow = false;
    part(g, box, MATS.post, 0, 0.8, 0.12, 0.86, 0.06, 0.06); // the beater
    for (const s of [-1, 1]) part(g, box, MATS.post, s * 0.4, 0.8, 0.06, 0.04, 0.04, 0.12);
    solids.push({ x: 0, y: 0.75, z: 0, w: 0.96, h: 1.5, d: 0.6 });
  } else if (id === 'aquarium') {
    // a glass tank on a little wooden cabinet: sand, a few weeds and a stone
    // on the bottom, the water in it, and the fish put in swimming about
    // (src/machines.js draws those, inside TANK_BOX)
    part(g, box, MATS.plankB, 0, 0.25, 0, 0.94, 0.5, 0.56);
    part(g, box, MATS.plankA, 0, 0.27, 0.285, 0.8, 0.36, 0.02).castShadow = false;
    part(g, box, MATS.brass, 0, 0.3, 0.3, 0.12, 0.04, 0.02).castShadow = false;
    part(g, box, MATS.post, 0, 0.52, 0, 0.98, 0.04, 0.6);
    part(g, box, sandMat, 0, 0.58, 0, 0.88, 0.08, 0.5).castShadow = false;
    part(g, ball, MATS.stone, 0.24, 0.63, -0.08, 0.16, 0.12, 0.14);
    for (let i = 0; i < 4; i++) part(g, box, MATS.leaf, -0.32 + i * 0.05, 0.75, -0.14 + (i % 2) * 0.06, 0.03, 0.3 - (i % 3) * 0.06, 0.03).castShadow = false;
    part(g, box, tankWaterMat, 0, 0.84, 0, 0.88, 0.44, 0.5).castShadow = false;
    // the glass, edged in dark wood
    part(g, box, MATS.glass, 0, 0.86, 0, 0.92, 0.6, 0.54).castShadow = false;
    for (const x of [-0.46, 0.46]) for (const z of [-0.27, 0.27]) part(g, box, MATS.bark, x, 0.86, z, 0.04, 0.6, 0.04);
    for (const z of [-0.27, 0.27]) part(g, box, MATS.bark, 0, 1.16, z, 0.96, 0.04, 0.04);
    solids.push({ x: 0, y: 0.58, z: 0, w: 0.98, h: 1.16, d: 0.6 });
  } else if (id === 'campfire') {
    // a ring of stones round the ashes, logs leant together and a fire in
    // them (it flickers, and lights the ground round it at night), and a
    // spit over it on two forked sticks
    const r = hash(gx, gz);
    part(g, flag, MATS.ash, 0, 0.01, 0, 0.6, 0.02, 0.6).castShadow = false;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r;
      part(g, ball, i % 3 ? MATS.stone : MATS.stoneDark, Math.cos(a) * 0.36, 0.07, Math.sin(a) * 0.36, 0.2, 0.15, 0.18).rotation.y = -a;
    }
    for (let k = 0; k < 3; k++) {
      const l = part(g, log, MATS.bark, 0, 0.14, 0, 0.08, 0.5, 0.08);
      l.rotation.z = Math.PI / 2 - 0.3;
      l.rotation.y = (k * Math.PI) / 3 + r * 2;
    }
    fire(g, 0, 0.12, 0, 0.5, 5, r);
    for (const s of [-1, 1]) {
      part(g, box, MATS.post, s * 0.44, 0.3, 0, 0.04, 0.6, 0.04);
      part(g, box, MATS.post, s * 0.44, 0.62, 0, 0.12, 0.04, 0.04).rotation.z = 0.5;
    }
    part(g, shaft, MATS.post, 0, 0.6, 0, 0.03, 0.96, 0.03).rotation.z = Math.PI / 2;
    solids.push({ x: 0, y: 0.15, z: 0, w: 0.86, h: 0.3, d: 0.86 });
  } else if (id === 'bunting') {
    // two poles with a string of little flags between them
    const flags = [MATS.cloth, MATS.straw, MATS.blueCloth, MATS.linen];
    const r = Math.floor(hash(gx, gz) * 4);
    for (const s of [-1, 1]) {
      part(g, shaft, MATS.post, s * 0.42, 0.8, 0, 0.07, 1.6, 0.07);
      part(g, ball, MATS.post, s * 0.42, 1.62, 0, 0.09, 0.09, 0.09);
      solids.push({ x: s * 0.42, y: 0.8, z: 0, w: 0.1, h: 1.6, d: 0.1 });
    }
    part(g, box, MATS.twine, 0, 1.5, 0, 0.84, 0.02, 0.02).castShadow = false;
    for (let i = 0; i < 5; i++) {
      const pennant = part(g, tip, flags[(i + r) % 4], -0.3 + i * 0.15, 1.39, 0, 0.12, 0.2, 0.02);
      pennant.rotation.z = Math.PI;
    }
  } else if (id === 'market_awning') {
    // a little stall: a counter under a striped cloth roof on four posts,
    // a few things on show on it
    for (const [x, z] of [[-0.42, -0.36], [0.42, -0.36], [-0.42, 0.36], [0.42, 0.36]]) part(g, box, MATS.post, x, 0.78, z, 0.07, 1.56, 0.07);
    for (let i = 0; i < 6; i++) {
      const x = -0.375 + i * 0.15;
      part(g, box, i % 2 ? MATS.linen : MATS.cloth, x, 1.6, 0, 0.15, 0.04, 0.92).rotation.x = 0.18;
      part(g, tip, i % 2 ? MATS.linen : MATS.cloth, x, 1.44, 0.46, 0.15, 0.12, 0.02).rotation.z = Math.PI;
    }
    part(g, box, MATS.plankA, 0, 0.5, 0.12, 0.9, 0.06, 0.5);
    part(g, box, MATS.crate, 0, 0.24, 0.36, 0.86, 0.48, 0.04);
    part(g, box, MATS.crateDark, 0, 0.24, -0.1, 0.86, 0.48, 0.04);
    part(g, ball, MATS.cheese, -0.24, 0.58, 0.14, 0.18, 0.1, 0.18);
    part(g, barrel, MATS.mayo, 0.02, 0.6, 0.08, 0.1, 0.14, 0.1);
    for (const [x, z, k] of [[0.22, 0.04, 0], [0.3, 0.2, 1], [0.16, 0.22, 2]]) part(g, ball, MATS.petals[k], x, 0.58, z, 0.1, 0.1, 0.1);
    solids.push({ x: 0, y: 0.8, z: 0, w: 0.9, h: 1.6, d: 0.8 });
  }
  return { group: g, solids };
}

// world: the world the pieces are on (world.js buildWorld)
export function createBuildings(world) {
  const pieces = new Map(); // key -> { id, group, colliders }
  const covered = new Map(); // every tile a piece stands on (a house: many) -> the key it was built on

  const glows = new Map(); // key -> { at: where a light-giving piece's flame is, in the world, flicker, flame }
  const relics = new Map(); // key -> the relic floating over its pedestal (it turns)
  const swirls = new Map(); // key -> a boss's portal's swirl (it turns too)
  const glowLights = Array.from({ length: GLOW_LIGHTS }, () => {
    const light = new THREE.PointLight(0xffc35a, 0, GLOW_REACH, 1.5);
    light.castShadow = false;
    world.root.add(light);
    return light;
  });

  const joins = (gx, gz) => PIECES[pieces.get(keyOf(gx, gz))?.id]?.joins;
  const paved = (gx, gz) => PIECES[pieces.get(keyOf(gx, gz))?.id]?.path;
  // the pieces a piece of kind id on (gx, gz) joins up with: a fence's or
  // wall's, the fences and walls beside it ([dx, dz]); a path's, the paths
  // round it ([dx, dz, id])
  const joinedAt = (id, gx, gz) => PIECES[id].joins ? DIRS.filter(([dx, dz]) => joins(gx + dx, gz + dz))
    : PIECES[id].path ? AROUND.filter(([dx, dz]) => paved(gx + dx, gz + dz)).map(([dx, dz]) => [dx, dz, pieces.get(keyOf(gx + dx, gz + dz)).id])
    : [];

  function undraw(piece) {
    world.root.remove(piece.group);
    disposeOwn(piece.group);
    glows.delete(piece.key);
    relics.delete(piece.key);
    swirls.delete(piece.key);
    for (const c of piece.colliders) world.platforms.splice(world.platforms.indexOf(c), 1);
    piece.group = null;
    piece.colliders = [];
  }

  function draw(key) {
    const piece = pieces.get(key);
    if (!piece) return;
    if (piece.group) undraw(piece);
    const [gx, gz] = gridOf(key);
    const { group, solids } = model(piece.id, gx, gz, joinedAt(piece.id, gx, gz));
    const x = gx * TILE_SIZE;
    const z = gz * TILE_SIZE;
    group.position.set(x, 0, z);
    world.root.add(group);
    piece.group = group;
    piece.key = key;
    const relic = group.getObjectByName('relic');
    if (relic) relics.set(key, relic);
    const swirl = group.getObjectByName('swirl');
    if (swirl) swirls.set(key, swirl);
    const flame = GLOWS[piece.id];
    if (flame) {
      glows.set(key, {
        at: new THREE.Vector3(x + flame[0], flame[1], z + flame[2]),
        flicker: FLICKERS.has(piece.id),
        flame: group.getObjectByName('flame'),
        seed: hash(gx, gz) * 10,
      });
    }
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

  // what a piece of kind id on tile key joins up with, joined up afresh (it
  // was built, or taken down)
  function redrawAround(key, id) {
    const [gx, gz] = gridOf(key);
    if (PIECES[id].joins) for (const [dx, dz] of DIRS) if (joins(gx + dx, gz + dz)) draw(keyOf(gx + dx, gz + dz));
    if (PIECES[id].path) for (const [dx, dz] of AROUND) if (paved(gx + dx, gz + dz)) draw(keyOf(gx + dx, gz + dz));
  }

  // a piece on tile key, not drawn yet (false: something is built there
  // already, or no such piece)
  function put(key, id) {
    if (!PIECES[id]) return false;
    const tiles = pieceTiles(id, key);
    if (tiles.some((k) => covered.has(k))) return false;
    pieces.set(key, { id, group: null, colliders: [] });
    for (const k of tiles) covered.set(k, key);
    for (const k of tiles) world.clearFoliageOnTile(k);
    return true;
  }

  // ---------- The see-through piece build mode shows where it would go ----------
  // (one for each farmer building: slot, their seat at the screen, src/main.js)
  const ghosts = []; // slot -> { mat, edge, group, id, key }
  function ghostSlot(slot) {
    if (ghosts[slot]) return ghosts[slot];
    const mat = new THREE.MeshBasicMaterial({ color: 0x8cff7a, transparent: true, opacity: 0.45, depthWrite: false });
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.7, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
      mat
    );
    edge.position.y = 0.09;
    return (ghosts[slot] = { mat, edge, group: null, id: null, key: null });
  }

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
    // the tiles every piece of kind `id` is built on
    findAll: (id) => [...pieces].filter(([, p]) => p.id === id).map(([key]) => key),
    list: () => [...pieces].map(([key, p]) => [key, p.id]),
    size: () => pieces.size,

    // false: something is built there already, or no such piece
    place(key, id) {
      if (!put(key, id)) return false;
      draw(key);
      redrawAround(key, id);
      return true;
    },

    // a farm's pieces ([key, id]), all at once: each drawn the once, joined
    // up with the rest
    placeAll(list) {
      const placed = list.filter(([key, id]) => put(key, id));
      for (const [key] of placed) draw(key);
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
      redrawAround(key, piece.id);
      return piece.id;
    },

    clear() {
      for (const piece of pieces.values()) undraw(piece);
      pieces.clear();
      covered.clear();
    },

    // The farm's workbench level: its workbenches drawn to match
    setBenchLevel(level) {
      if (level === benchLevel) return;
      benchLevel = level;
      for (const [key, piece] of pieces) if (piece.id === 'workbench') draw(key);
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

    // night: 0 by day, 1 at night (the lamps' glow, and the light they
    // give the lamps nearest focus, the player)
    setNight(night, focus) {
      // (bright enough at night, ~2.5 linear, that the bloom lifts them softly: src/gfx/post.js)
      MATS.lantern.emissiveIntensity = night * 2.5;
      MATS.window.emissiveIntensity = night * 2.0;
      const t = performance.now() / 1000;
      MATS.flame.emissiveIntensity = 0.6 + night * 1.9;
      MATS.flameCore.emissiveIntensity = 0.8 + night * 1.7;
      // the torches' flames dance a little, day and night
      for (const glow of glows.values()) {
        if (glow.flame) glow.flame.scale.y = glow.flame.userData.h * (1 + 0.12 * Math.sin(t * 9 + glow.seed) + 0.06 * Math.sin(t * 23 + glow.seed * 3));
      }
      // the relics turn slowly and bob over their pedestals
      for (const relic of relics.values()) {
        relic.rotation.y = t * 0.8 + relic.parent.position.x;
        relic.position.y = 1.25 + Math.sin(t * 1.6 + relic.parent.position.z) * 0.06;
      }
      for (const swirl of swirls.values()) swirl.rotation.z = -t * 2.2;
      const nearest = night > 0.01 && focus
        ? [...glows.values()].sort((a, b) => a.at.distanceToSquared(focus) - b.at.distanceToSquared(focus))
        : [];
      glowLights.forEach((light, i) => {
        // (spare ones stay on, just dark: switching a light off and on makes
        // three.js rebuild its shaders, a hitch every dusk)
        const glow = nearest[i];
        if (!glow) return void (light.intensity = 0);
        const flicker = glow.flicker ? 0.85 + 0.1 * Math.sin(t * 11 + glow.seed) + 0.05 * Math.sin(t * 27 + glow.seed * 2) : 1;
        light.intensity = night * 6 * flicker;
        light.position.copy(glow.at);
      });
    },

    // Show where `id` would go on tile key (null: nowhere), green or red
    // (ok). id 'remove': just the tile's outline. slot: whose (a seat's)
    preview(key, id, ok, slot = 0) {
      const ghost = ghostSlot(slot);
      if (!key) {
        if (ghost.group) ghost.group.visible = false;
        return;
      }
      const [gx, gz] = gridOf(key);
      if (!ghost.group || ghost.id !== id || ghost.key !== key) {
        if (ghost.group) {
          world.root.remove(ghost.group);
          // (the chest's shapes are its own, not shared like the pieces')
          if (ghost.id === 'farm_chest') ghost.group.traverse((obj) => obj.isMesh && obj !== ghost.edge && obj.geometry.dispose());
          else disposeOwn(ghost.group);
        }
        const group = id === 'remove' || !PIECES[id]
          ? new THREE.Group()
          : id === 'farm_chest'
            ? chestModel().root
            : model(id, gx, gz, joinedAt(id, gx, gz)).group;
        group.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.material = ghost.mat;
          obj.castShadow = false;
        });
        group.add(ghost.edge);
        group.position.set(gx * TILE_SIZE, 0.01, gz * TILE_SIZE);
        world.root.add(group);
        Object.assign(ghost, { group, id, key });
      }
      ghost.group.visible = true;
      ghost.mat.color.set(ok ? 0x8cff7a : 0xff6b5a);
    },
  };
}
