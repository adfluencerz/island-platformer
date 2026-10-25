import * as THREE from 'three';
import { damp } from './character.js';
import { foliageMat } from './world.js';
import { ITEMS } from './items.js';
import { ANIMALS, LAY_HOURS, EGGS_PER_HEN, PEN_LEVELS } from '../shared/balance.js'; // (what they give, and how often; the pens' levels)
import { YARD, PASTURE, PEN_RECTS } from '../shared/farmland.js';

export { YARD, PASTURE };

// ---------- Animals: hens, cows and sheep ----------
// Two pens on the home farm. West of the plaza, a fenced yard with a coop for
// the hens; south of it, by the path to the shore, a pasture for the cows and
// sheep. By day the animals wander their pen and graze (the hens peck), the
// hens and sheep scurry off when you run at them, and the cows just let you
// walk round them. Walk up to one and press E: pet her, or milk the cow or
// shear the sheep when she's ready (a little picture floats over her).
// Toward dusk the hens go up the ramp to roost; the cows and sheep lie down
// in the grass. They're up again after sunrise.
//
// What they give, on the farm's clock (so it comes faster with T held, and
// while you're away):
// - a hen lays an egg a day, some time between mid-morning and the
//   afternoon, where she stands, or in the nest by the coop when it fell due
//   while she slept or you were off the farm. Walk over an egg to pick it up.
// - a cow has milk once a day, from the morning after she was last milked.
// - a sheep's fleece grows back in two days; you can see it fill out.
//
// The merchant buys eggs, milk and wool, and sells the animals: one is an
// item in the backpack until you let her out in her pen (E). A new farm
// comes with two hens, a cow and a sheep.
//
// Each pen has three levels, bought at the workbench (PEN_LEVELS in
// shared/balance.js): every level the fence goes out a little (PEN_RECTS in
// shared/farmland.js) and there is room for more of them, the yard's coop
// gets bigger and some of the eggs are large ones, the pasture gets a hay
// rack and then a barn, and a cow or sheep may give two at a time.
//
// The pens are among the farm's set pieces (maps.js builds them with the
// island; setPenLevels() builds them afresh at the farm's levels); the
// animals are added by main.js, which drives them and saves them with the
// farm. Like the stall, everything faces +Z, toward the camera.

const rand = (min, max) => min + Math.random() * (max - min);
const hourOf = (hours) => THREE.MathUtils.euclideanModulo(hours, 24);
const ROOST_AT = 19.25; // hours: in to bed a little before dark...
const WAKE_AT = 6.25; // ...and up again after sunrise
const isBedtime = (hours) => hourOf(hours) >= ROOST_AT || hourOf(hours) < WAKE_AT;
const nextMorning = (hours) => (Math.floor((hours - WAKE_AT) / 24) + 1) * 24 + WAKE_AT;

// ---------- The pens ----------
const FENCE_H = 0.8;
const rectOf = ({ x, z, w, d }) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

// Each pen's level (1 to 3), and where everything in it stands at that level
// (laid out afresh by layOut() when a level changes)
const penLevel = { yard: 1, pasture: 1 };
let Y, COOP, COOP_FRONT, RAMP_END, DOOR, NEST, TROUGH, P, HAY, WATER, RACK, BARN, PENS;
function layOut() {
  Y = rectOf(PEN_RECTS.yard[penLevel.yard - 1]);
  // the coop, against the north fence (wider from level 2, taller at 3)
  COOP = { x: Y.minX + 2.4, z: Y.minZ + 0.85, w: penLevel.yard > 1 ? 3 : 2.4, d: 1.5, floor: 0.4, wallH: penLevel.yard > 2 ? 1.55 : 1.1 };
  COOP_FRONT = COOP.z + COOP.d / 2;
  RAMP_END = COOP_FRONT + 0.7; // the ramp runs from the door sill down to here
  DOOR = { x: COOP.x, z: RAMP_END + 0.15 }; // where a hen waits at the foot of the ramp
  NEST = { x: Y.minX + 4.4, z: Y.minZ + 1.1 }; // straw beside the coop
  TROUGH = { x: Y.maxX - 1.3, z: Y.minZ + 0.75 };

  P = rectOf(PEN_RECTS.pasture[penLevel.pasture - 1]);
  // along the north fence: the barn (level 3), the hay bales, the hay rack (from level 2), the water
  BARN = penLevel.pasture > 2 ? { x: P.minX + 1.5, z: P.minZ + 0.9, w: 2.6, d: 1.5 } : null;
  const hay = P.minX + (BARN ? 3.4 : 1.3);
  HAY = [[hay, P.minZ + 0.75], [hay + 1.15, P.minZ + 0.7]];
  RACK = penLevel.pasture > 1 ? { x: hay + 3, z: P.minZ + 0.55 } : null;
  WATER = { x: P.maxX - 2.2, z: P.minZ + 0.6 };

  // Each pen: its fence, its gate (a gap in the east fence, toward the paths:
  // where it always was), and where its animals roam (in front of what stands
  // along the north fence)
  PENS = {
    yard: { rect: Y, gate: { z: YARD.z, w: 1.6 }, roam: { minX: Y.minX + 0.5, maxX: Y.maxX - 0.5, minZ: RAMP_END + 0.3, maxZ: Y.maxZ - 0.5 } },
    pasture: { rect: P, gate: { z: PASTURE.z, w: 1.8 }, roam: { minX: P.minX + 0.6, maxX: P.maxX - 0.6, minZ: P.minZ + 1.7, maxZ: P.maxZ - 0.6 } },
  };
}
layOut();

// What a pen's level gives (PEN_LEVELS): its room, largeEgg, second
const penAt = (pen) => PEN_LEVELS[pen][penLevel[pen] - 1];

const inRect = (r, x, z, margin = 0) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
// In one of the pens (margin: how far outside the fence still counts)
export const inPen = (x, z, margin = 0) => Object.values(PENS).some((pen) => inRect(pen.rect, x, z, margin));

// ---------- The kinds of animal ----------
// pen: where she lives (how many it has room for: PEN_LEVELS). radius: how
// much room she takes (bigger ones nudge the farmer aside). reach: how close
// (beyond her radius) to pet her. walk / scurry: speeds. startle: a moving farmer this close sends her scurrying (0:
// never). product: what she gives (an item), and `regrow`: game hours until
// she has more ('morning': the next morning), both from ANIMALS in
// shared/balance.js. The item that lets one out is named like the kind (items.js).
const KINDS = {
  hen: { pen: 'yard', name: 'hen', radius: 0.25, reach: 1.15, walk: 0.9, scurry: 2.8, startle: 0.8, full: (n) => `The coop is full: ${n} hens is plenty` },
  cow: { pen: 'pasture', name: 'cow', radius: 0.62, reach: 1, walk: 0.55, scurry: 0, startle: 0, ...ANIMALS.cow, verb: 'Milk the cow', full: (n) => `The pasture has room for ${n} cows` },
  sheep: { pen: 'pasture', name: 'sheep', radius: 0.45, reach: 1, walk: 0.75, scurry: 2.2, startle: 1, ...ANIMALS.sheep, verb: 'Shear the sheep', full: (n) => `The pasture has room for ${n} sheep` },
};
export const ANIMAL_KINDS = Object.keys(KINDS);
const roomFor = (kind) => penAt(KINDS[kind].pen).room[kind];

const EGG_REACH = 0.55;
const SHORN = 0.72; // a freshly shorn sheep's fleece, against a full one

// When the next egg falls due: today if there's still time, else tomorrow
function nextLay(hours) {
  const day = Math.floor(hours / 24) * 24;
  const today = day + rand(...LAY_HOURS);
  return today > hours + 0.5 ? today : day + 24 + rand(...LAY_HOURS);
}

// ---------- Building the pens ----------
const railMat = foliageMat(0xd9b48a);
const postMat = foliageMat(0xa0682f);
const wallMat = foliageMat(0xb8452f);
const trimMat = foliageMat(0xf3ead8);
const roofMat = foliageMat(0x5b4636);
const darkMat = foliageMat(0x2a1a10);
const strawMat = foliageMat(0xe3c46a);
const hayEndMat = foliageMat(0xc9a64a);
const grainMat = foliageMat(0xf0d27a);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x5ab4d6, roughness: 0.15, metalness: 0.1 });
const box = new THREE.BoxGeometry(1, 1, 1);
const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe7a3, emissive: 0xffc35a, emissiveIntensity: 0.8, roughness: 0.6 });
const FLOWER_MATS = [0xff7eb6, 0xffe14d, 0xffffff, 0xb58cff].map((c) => foliageMat(c));
const flowerGeo = new THREE.SphereGeometry(0.055, 6, 5);

function piece(parent, geo, material, [x, y, z], [sx, sy, sz], rotation) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A run of fence from (x0, z0) to (x1, z1): posts about a meter apart, two
// rails (rail: their material, painted on a pen of a higher level)
function fence(parent, addCollider, x0, z0, x1, z1, rail) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    piece(parent, box, postMat, [x0 + (x1 - x0) * k, FENCE_H / 2, z0 + (z1 - z0) * k], [0.12, FENCE_H, 0.12]);
  }
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  for (const y of [0.32, 0.64]) {
    piece(parent, box, rail, [cx, y, cz], along ? [len, 0.08, 0.05] : [0.05, 0.08, len]);
  }
  addCollider({ x: cx, y: FENCE_H / 2, z: cz, w: along ? len : 0.2, h: FENCE_H, d: along ? 0.2 : len });
}

// The fence round a pen, with its gate (from level 2 the rails are painted
// white, and at level 3 a lantern hangs on each gatepost)
function penFence(parent, addCollider, { rect: r, gate }, level) {
  const gate0 = gate.z - gate.w / 2;
  const gate1 = gate.z + gate.w / 2;
  const rail = level > 1 ? trimMat : railMat;
  fence(parent, addCollider, r.minX, r.minZ, r.maxX, r.minZ, rail); // north
  fence(parent, addCollider, r.minX, r.maxZ, r.maxX, r.maxZ, rail); // south
  fence(parent, addCollider, r.minX, r.minZ, r.minX, r.maxZ, rail); // west
  fence(parent, addCollider, r.maxX, r.minZ, r.maxX, gate0, rail); // east, either side of the gate
  fence(parent, addCollider, r.maxX, gate1, r.maxX, r.maxZ, rail);
  for (const z of [gate0, gate1]) {
    piece(parent, box, postMat, [r.maxX, 0.5, z], [0.18, 1, 0.18]); // taller gateposts
    if (level < 3) continue;
    piece(parent, box, roofMat, [r.maxX, 1.03, z], [0.24, 0.06, 0.24]);
    piece(parent, box, lampMat, [r.maxX, 1.14, z], [0.12, 0.16, 0.12]).castShadow = false;
    piece(parent, box, roofMat, [r.maxX, 1.25, z], [0.2, 0.05, 0.2]);
  }
}

// A little building with a gabled roof, its ridge running east-west, its
// front (+Z) open for a door: the coop, and the pasture's barn. Its walls
// stand `floor` up (on stilts) and are `wallH` high, w across and d deep.
const gableGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
function shed(parent, { w, d, floor, wallH, wall = wallMat, rise = 0.5 }) {
  if (floor) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      piece(parent, box, postMat, [sx * (w / 2 - 0.12), floor / 2, sz * (d / 2 - 0.12)], [0.12, floor, 0.12]);
    }
  }
  piece(parent, box, wall, [0, floor + wallH / 2, 0], [w, wallH, d]);
  piece(parent, box, trimMat, [0, floor + 0.04, 0], [w + 0.06, 0.08, d + 0.06]);
  for (const sx of [-1, 1]) piece(parent, box, trimMat, [sx * (w / 2), floor + wallH / 2, d / 2 + 0.01], [0.08, wallH, 0.04]);
  // the gable ends: a triangle of wall under the roof on each side (a
  // three-sided cylinder turned on its side, point up)
  for (const sx of [-1, 1]) {
    piece(parent, gableGeo, wall, [sx * (w / 2 - 0.05), floor + wallH + rise / 3, 0], [d / 2 / 0.866, 0.1, (rise * 2) / 3], [-Math.PI / 2, 0, -Math.PI / 2]);
  }
  // the roof: two slopes meeting on the ridge
  const slope = Math.atan2(rise, d / 2);
  const slopeLen = Math.hypot(rise, d / 2) + 0.2;
  for (const sz of [-1, 1]) {
    piece(parent, box, roofMat, [0, floor + wallH + rise * 0.54, sz * (d / 4 + 0.03)], [w + 0.35, 0.08, slopeLen], [sz * slope, 0, 0]);
  }
  piece(parent, box, trimMat, [0, floor + wallH + rise + 0.03, 0], [w + 0.4, 0.07, 0.1]);
  return floor + wallH + rise; // (how high its ridge is)
}

// A round window in the front wall at x, y, with a box of flowers under it (flowers: at level 3)
function roundWindow(parent, x, y, z, flowers) {
  const win = piece(parent, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), darkMat, [x, y, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
  win.castShadow = false;
  piece(parent, new THREE.TorusGeometry(0.18, 0.035, 6, 16), trimMat, [x, y, z + 0.02], [1, 1, 1]);
  if (!flowers) return;
  piece(parent, box, postMat, [x, y - 0.27, z + 0.08], [0.46, 0.12, 0.14]);
  FLOWER_MATS.forEach((m, i) => piece(parent, flowerGeo, m, [x - 0.15 + i * 0.1, y - 0.18, z + 0.08], [1, 1, 1]));
}

// The coop: a little red henhouse up on stilts, a gabled roof, a door with a
// ramp. Wider from level 2, with a nest box on its side; at level 3 taller,
// with a loft window, flower boxes and a weathervane on the ridge.
function buildCoop(pens, addCollider, level) {
  const coop = new THREE.Group();
  coop.name = 'coop';
  coop.position.set(COOP.x, 0, COOP.z);
  pens.add(coop);
  const { w, d, floor, wallH } = COOP;
  const ridge = shed(coop, { w, d, floor, wallH });
  const front = d / 2 + 0.01;
  // the door, its lintel, and the round windows
  piece(coop, box, darkMat, [0, floor + 0.3, front], [0.46, 0.56, 0.04]);
  piece(coop, box, trimMat, [0, floor + 0.6, d / 2 + 0.02], [0.56, 0.06, 0.05]);
  roundWindow(coop, -w / 2 + 0.45, floor + 0.65, front, level > 2);
  if (level > 1) roundWindow(coop, w / 2 - 0.45, floor + 0.65, front, level > 2);
  if (level > 2) {
    piece(coop, box, darkMat, [0, floor + 1.15, front], [0.36, 0.26, 0.04]); // the loft's hatch
    piece(coop, box, trimMat, [0, floor + 1.15, d / 2 + 0.02], [0.44, 0.04, 0.05]);
    // a weathervane: a post, an arrow and a little tin hen
    piece(coop, box, darkMat, [0.5, ridge + 0.3, 0], [0.04, 0.6, 0.04]);
    piece(coop, box, darkMat, [0.5, ridge + 0.45, 0], [0.5, 0.03, 0.03]);
    piece(coop, new THREE.ConeGeometry(0.05, 0.1, 4), darkMat, [0.77, ridge + 0.45, 0], [1, 1, 1], [0, 0, -Math.PI / 2]);
    ball(coop, darkMat, [0.5, ridge + 0.66, 0], [0.09, 0.07, 0.03]);
    ball(coop, darkMat, [0.58, ridge + 0.72, 0], [0.04, 0.04, 0.025]);
  }
  if (level > 1) {
    // the nest box on its west side, with straw peeping out
    piece(coop, box, wallMat, [-w / 2 - 0.25, floor + 0.25, 0.1], [0.5, 0.5, 0.9]);
    piece(coop, box, roofMat, [-w / 2 - 0.27, floor + 0.53, 0.1], [0.6, 0.06, 1], [0, 0, 0.35]);
    piece(coop, box, strawMat, [-w / 2 - 0.25, floor + 0.08, 0.57], [0.4, 0.06, 0.04]);
  }
  const rampLen = Math.hypot(floor, RAMP_END - COOP_FRONT);
  const ramp = new THREE.Group();
  ramp.position.set(0, floor / 2, d / 2 + (RAMP_END - COOP_FRONT) / 2);
  ramp.rotation.x = Math.atan2(floor, RAMP_END - COOP_FRONT);
  coop.add(ramp);
  piece(ramp, box, railMat, [0, 0, 0], [0.4, 0.04, rampLen]);
  for (let i = 0; i < 4; i++) piece(ramp, box, postMat, [0, 0.03, -rampLen / 2 + 0.12 + i * 0.17], [0.4, 0.03, 0.03]);
  // Solid: you can't walk through the coop (the hens go in by the door)
  const nestBox = level > 1 ? 0.5 : 0;
  addCollider({ x: COOP.x - nestBox / 2, y: (ridge + 0.1) / 2, z: COOP.z, w: w + nestBox, h: ridge + 0.1, d });
}

// The pasture's barn (level 3): a red barn with white trim, its big doors
// crossed with white, and a hay loft over them
function buildBarn(pens, addCollider) {
  const barn = new THREE.Group();
  barn.name = 'barn';
  barn.position.set(BARN.x, 0, BARN.z);
  pens.add(barn);
  const { w, d } = BARN;
  const ridge = shed(barn, { w, d, floor: 0, wallH: 1.5, rise: 0.75 });
  const front = d / 2 + 0.01;
  for (const sx of [-1, 1]) {
    piece(barn, box, darkMat, [sx * 0.33, 0.6, front], [0.62, 1.2, 0.04]);
    for (const tilt of [-1, 1]) piece(barn, box, trimMat, [sx * 0.33, 0.6, front + 0.02], [0.06, 1.25, 0.03], [0, 0, tilt * 0.47]);
  }
  piece(barn, box, trimMat, [0, 1.24, front + 0.01], [1.4, 0.07, 0.05]);
  piece(barn, box, darkMat, [0, 1.7, front], [0.4, 0.3, 0.04]); // the loft door
  piece(barn, box, strawMat, [0, 1.58, front + 0.04], [0.34, 0.06, 0.06]);
  addCollider({ x: BARN.x, y: (ridge + 0.1) / 2, z: BARN.z, w, h: ridge + 0.1, d });
}

// The hay rack (from level 2): a wooden manger on legs, full of hay
function buildRack(pens, addCollider) {
  const { x, z } = RACK;
  for (const sx of [-1, 1]) piece(pens, box, postMat, [x + sx * 0.62, 0.35, z], [0.1, 0.7, 0.1]);
  piece(pens, box, postMat, [x, 0.42, z], [1.3, 0.06, 0.42]);
  for (let i = 0; i < 6; i++) piece(pens, box, railMat, [x - 0.55 + i * 0.22, 0.62, z + 0.2], [0.04, 0.4, 0.04], [0.25, 0, 0]);
  piece(pens, box, strawMat, [x, 0.6, z], [1.2, 0.26, 0.34]);
  for (let i = 0; i < 4; i++) piece(pens, box, strawMat, [x - 0.4 + i * 0.3, 0.015, z + 0.45 + (i % 2) * 0.1], [0.2, 0.02, 0.03], [0, i * 1.4, 0]);
  addCollider({ x, y: 0.4, z, w: 1.35, h: 0.8, d: 0.5 });
}

// The pens as their levels have them (ctx: from world.js's buildWorld, the
// farm's set pieces). Built once with the island, and afresh by setPenLevels().
let pensCtx = null;
let pensBuilt = null; // { group, colliders }
function buildPensNow() {
  const { root, removeCollider } = pensCtx;
  if (pensBuilt) {
    root.remove(pensBuilt.group);
    pensBuilt.colliders.forEach(removeCollider);
  }
  const pens = new THREE.Group();
  const colliders = [];
  const addCollider = (box) => colliders.push(pensCtx.addCollider(box));
  root.add(pens);
  pensBuilt = { group: pens, colliders };
  penFence(pens, addCollider, PENS.yard, penLevel.yard);
  penFence(pens, addCollider, PENS.pasture, penLevel.pasture);
  buildCoop(pens, addCollider, penLevel.yard);

  // The nest: a ring of straw with a few loose wisps
  const nest = piece(pens, new THREE.TorusGeometry(0.22, 0.09, 6, 14), strawMat, [NEST.x, 0.06, NEST.z], [1, 1, 0.6], [Math.PI / 2, 0, 0]);
  nest.receiveShadow = true;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    piece(pens, box, strawMat, [NEST.x + Math.cos(a) * 0.4, 0.015, NEST.z + Math.sin(a) * 0.35], [0.18, 0.02, 0.03], [0, a * 1.7, 0]);
  }

  // A trough of grain and a water dish
  piece(pens, box, postMat, [TROUGH.x, 0.15, TROUGH.z], [0.9, 0.3, 0.35]);
  piece(pens, box, grainMat, [TROUGH.x, 0.29, TROUGH.z], [0.8, 0.04, 0.26]);
  piece(pens, new THREE.CylinderGeometry(0.22, 0.18, 0.12, 12), trimMat, [TROUGH.x - 0.95, 0.06, TROUGH.z + 0.1], [1, 1, 1]);
  piece(pens, new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), waterMat, [TROUGH.x - 0.95, 0.12, TROUGH.z + 0.1], [1, 1, 1]); // (its top 2 cm over the rim: level with it, the two flickered)
  addCollider({ x: TROUGH.x - 0.3, y: 0.15, z: TROUGH.z, w: 1.6, h: 0.3, d: 0.5 });

  // In the pasture: round hay bales lying along the north fence, and a long water trough
  const baleGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16);
  for (const [x, z] of HAY) {
    piece(pens, baleGeo, [strawMat, hayEndMat, hayEndMat], [x, 0.45, z], [1, 1, 1], [0, 0, Math.PI / 2]);
    addCollider({ x, y: 0.45, z, w: 0.8, h: 0.9, d: 0.9 });
  }
  for (let i = 0; i < 5; i++) piece(pens, box, strawMat, [HAY[0][0] + 0.4 + i * 0.25, 0.015, HAY[0][1] + 0.6 + (i % 2) * 0.12], [0.2, 0.02, 0.03], [0, i * 1.3, 0]);
  piece(pens, box, postMat, [WATER.x, 0.22, WATER.z], [1.8, 0.44, 0.5]);
  piece(pens, box, waterMat, [WATER.x, 0.43, WATER.z], [1.65, 0.06, 0.36]); // (as the dish's)
  addCollider({ x: WATER.x, y: 0.22, z: WATER.z, w: 1.8, h: 0.44, d: 0.5 });
  if (RACK) buildRack(pens, addCollider);
  if (BARN) buildBarn(pens, addCollider);
}

export function buildPens(ctx) {
  pensCtx = ctx;
  buildPensNow();
}

// The farm's pen levels ({ yard, pasture }: 1 to 3; missing, 1): the pens are
// built afresh if they changed (the animals are let out again by restore()).
// True if they did.
export function setPenLevels(levels) {
  const next = Object.fromEntries(Object.keys(penLevel).map((pen) => [pen, THREE.MathUtils.clamp(Math.floor(levels?.[pen]) || 1, 1, PEN_LEVELS[pen].length)]));
  if (Object.keys(penLevel).every((pen) => next[pen] === penLevel[pen])) return false;
  Object.assign(penLevel, next);
  layOut();
  if (pensCtx) buildPensNow();
  return true;
}

// Where pen would stand at `level`: { minX, maxX, minZ, maxZ } (to see what is in the way of a bigger one)
export const penRect = (pen, level) => rectOf(PEN_RECTS[pen][level - 1]);

// ---------- The animals' models ----------
// Built from primitives like the farmer (character.js), facing +Z, with the
// origin at the feet. Each comes in a few colors; everything else is shared.
// A model gives: root, rig (scaled for squash & stretch from the feet), legs
// [{ pivot, phase, front }], and pose(a, t), which moves its own parts (head,
// wings, tail, fleece) from the animal's state.
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
const matCache = new Map();
const matOf = (color) => {
  if (!matCache.has(color)) matCache.set(color, mat(color));
  return matCache.get(color);
};
const ballGeo = new THREE.SphereGeometry(1, 12, 9);
const ball = (parent, material, at, scale) => piece(parent, ballGeo, material, at, scale);
const eyeMat = mat(0x111111, { roughness: 0.3 });

function limb(parent, [x, y, z], geo, material, length, foot, footMat, phase, front) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  piece(pivot, geo, material, [0, -length / 2, 0], [1, 1, 1]);
  if (foot) piece(pivot, foot, footMat, [0, -length, 0.01], [1, 1, 1]);
  return { pivot, phase, front };
}

// A hen: round body, tail up, little wings, red comb
const HEN_COLORS = [0xf6f1e4, 0xa45a2a, 0xd9a24a, 0x3d3735];
const combMat = mat(0xe0362c, { roughness: 0.6 });
const beakMat = mat(0xf2a516, { roughness: 0.6 });
const henLegMat = mat(0xe8962a, { roughness: 0.6 });
const beakGeo = new THREE.ConeGeometry(0.035, 0.08, 5);
const henLegGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 4);
const henFootGeo = new THREE.BoxGeometry(0.06, 0.012, 0.08);
const tailGeo = new THREE.ConeGeometry(0.1, 0.22, 6);
const HEN_SCALE = 1.5;

function buildHen(color) {
  const feathers = matOf(HEN_COLORS[color] ?? HEN_COLORS[0]);
  const root = new THREE.Group();
  root.userData.noSnow = true; // (snow keeps off the animals: src/seasons.js)
  const rig = new THREE.Group();
  rig.scale.setScalar(HEN_SCALE);
  root.add(rig);
  const legs = [-1, 1].map((sx, i) => limb(rig, [sx * 0.065, 0.15, 0.02], henLegGeo, henLegMat, 0.14, henFootGeo, henLegMat, i * Math.PI, true));

  const body = new THREE.Group();
  body.position.y = 0.27;
  rig.add(body);
  ball(body, feathers, [0, 0, 0], [0.17, 0.15, 0.21]);
  piece(body, tailGeo, feathers, [0, 0.1, -0.17], [1, 1, 0.5], [-0.7, 0, 0]);
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.15, 0.06, 0);
    body.add(pivot);
    ball(pivot, feathers, [sx * 0.015, -0.06, -0.02], [0.04, 0.09, 0.15]);
    return pivot;
  });

  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.15);
  body.add(head);
  ball(head, feathers, [0, 0.08, 0], [0.09, 0.1, 0.09]);
  for (const [z, y, s] of [[0.03, 0.19, 0.03], [-0.01, 0.2, 0.034], [-0.05, 0.18, 0.028]]) ball(head, combMat, [0, y, z], [0.018, s, s]);
  piece(head, beakGeo, beakMat, [0, 0.075, 0.1], [1, 1, 1], [Math.PI / 2, 0, 0]).castShadow = false;
  ball(head, combMat, [0, 0.025, 0.08], [0.018, 0.03, 0.018]); // wattle
  for (const sx of [-1, 1]) ball(head, eyeMat, [sx * 0.065, 0.1, 0.05], [0.014, 0.016, 0.014]);

  // the head bobs to and fro on the walk and dips sharply to peck; wings flap
  function pose(a, t) {
    const peck = a.state === 'graze' ? Math.max(0, Math.sin(a.graze * Math.PI * 2)) ** 2 : 0;
    body.position.y = 0.27 + Math.abs(a.step) * 0.02;
    head.position.z = 0.15 + Math.sin(a.walkPhase * 2) * 0.03 * a.walkAmount + peck * 0.06;
    head.rotation.x = peck * 1.3;
    head.rotation.y = a.look;
    body.rotation.x = peck * 0.35 + a.walkAmount * 0.08;
    const flap = a.flap * (0.5 + Math.sin(t * 38) * 0.5) * 1.1;
    wings[0].rotation.z = -flap;
    wings[1].rotation.z = flap;
  }
  return { root, rig, legs, scale: HEN_SCALE, lieDrop: 0, pose };
}

// A cow: a long body with patches, a pink muzzle, little horns, a bell and a swishing tail
const COW_COLORS = [[0xf7f3ea, 0x2b2b2b], [0xc68a52, 0xf7f3ea], [0x6b3f22, 0x4a2a16]];
const muzzleMat = mat(0xf2a7a7, { roughness: 0.6 });
const hoofMat = mat(0x3a2a20);
const hornMat = mat(0xf0e4c8, { roughness: 0.5 });
const bellMat = mat(0xd9a520, { roughness: 0.35, metalness: 0.6 });
const cowLegGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.5, 7);
const hoofGeo = new THREE.CylinderGeometry(0.075, 0.08, 0.08, 7);
const cowBodyGeo = new THREE.CapsuleGeometry(0.36, 0.7, 6, 14).rotateX(Math.PI / 2);
const hornGeo = new THREE.ConeGeometry(0.04, 0.14, 6);
const tailRopeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5).translate(0, -0.25, 0);
const bellGeo = new THREE.ConeGeometry(0.06, 0.1, 8);

function buildCow(color) {
  const [hide, patch] = COW_COLORS[color] ?? COW_COLORS[0];
  const hideMat = matOf(hide);
  const patchMat = matOf(patch);
  const root = new THREE.Group();
  root.userData.noSnow = true;
  const rig = new THREE.Group();
  root.add(rig);
  const legs = [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]].map(([sx, sz, phase]) =>
    limb(rig, [sx * 0.2, 0.55, sz * 0.42], cowLegGeo, hideMat, 0.5, hoofGeo, hoofMat, phase, sz > 0));

  const body = new THREE.Group();
  body.position.y = 0.86;
  rig.add(body);
  piece(body, cowBodyGeo, hideMat, [0, 0, 0], [0.95, 1, 1]);
  // patches, standing a little proud of the hide
  for (const [x, y, z, sy, sz] of [[0.33, 0.05, 0.2, 0.2, 0.26], [-0.33, -0.02, -0.25, 0.22, 0.3], [0.31, 0.08, -0.45, 0.15, 0.14], [0.08, 0.33, -0.1, 0.05, 0.3], [-0.3, 0.1, 0.4, 0.14, 0.12]]) {
    ball(body, patchMat, [x, y, z], [Math.abs(x) > 0.2 ? 0.06 : 0.22, sy, sz]);
  }
  ball(body, muzzleMat, [0, -0.32, -0.32], [0.14, 0.1, 0.15]); // udder
  const tail = new THREE.Group();
  tail.position.set(0, 0.22, -0.7);
  body.add(tail);
  piece(tail, tailRopeGeo, hideMat, [0, 0, 0], [1, 1, 1]);
  ball(tail, patchMat, [0, -0.52, 0], [0.05, 0.08, 0.05]);

  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.68);
  body.add(head);
  ball(head, hideMat, [0, 0.04, 0.12], [0.21, 0.23, 0.27]);
  ball(head, muzzleMat, [0, -0.08, 0.33], [0.18, 0.13, 0.12]);
  for (const sx of [-1, 1]) {
    ball(head, eyeMat, [sx * 0.07, -0.06, 0.44], [0.022, 0.03, 0.015]); // nostrils
    ball(head, eyeMat, [sx * 0.14, 0.11, 0.27], [0.03, 0.035, 0.03]);
    const ear = ball(head, patchMat, [sx * 0.25, 0.12, 0.05], [0.12, 0.045, 0.07]);
    ear.rotation.z = sx * -0.3;
    piece(head, hornGeo, hornMat, [sx * 0.12, 0.27, 0.04], [1, 1, 1], [0, 0, sx * -0.6]);
  }
  piece(head, bellGeo, bellMat, [0, -0.26, 0.05], [1, 1, 1]);

  // the head goes down to graze and chews; the tail swishes now and then
  function pose(a, t) {
    const down = a.graze;
    body.position.y = 0.86 + Math.abs(a.step) * 0.02;
    head.rotation.x = down * 0.9 + Math.sin(t * 9) * 0.03 * down;
    head.position.y = 0.2 - down * 0.08;
    head.rotation.y = a.look;
    body.rotation.x = down * 0.06;
    tail.rotation.z = Math.sin(t * 2.3 + a.seed) ** 9 * 0.8 + Math.sin(t * 1.1) * 0.05;
    tail.rotation.x = 0.15 + a.walkAmount * 0.2;
  }
  return { root, rig, legs, scale: 1, lieDrop: 0.42, pose };
}

// A sheep: a dark face peeping out of a cloud of fleece, which you can shear
const WOOL_COLORS = [0xf4f0e6, 0xe8dcc0, 0x9c968e, 0x3d3735];
const faceMat = mat(0x3a3330);
const skinMat = mat(0xe9d8c4);
const sheepLegGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.38, 6);
const woolGeo = new THREE.IcosahedronGeometry(1, 1);
const FLEECE = [[0, 0, 0, 0.36, 0.32, 0.46], [0.2, 0.17, 0.22, 0.2], [-0.2, 0.17, 0.2, 0.2], [0.22, 0.14, -0.2, 0.21], [-0.21, 0.15, -0.22, 0.21], [0, 0.26, 0, 0.22], [0, 0.22, -0.28, 0.19], [0.27, -0.05, 0, 0.19], [-0.27, -0.05, 0, 0.19], [0, 0.18, 0.3, 0.17]];

function buildSheep(color) {
  const woolMat = matOf(WOOL_COLORS[color] ?? WOOL_COLORS[0]);
  const root = new THREE.Group();
  root.userData.noSnow = true;
  const rig = new THREE.Group();
  root.add(rig);
  const legs = [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]].map(([sx, sz, phase]) =>
    limb(rig, [sx * 0.14, 0.4, sz * 0.24], sheepLegGeo, faceMat, 0.38, null, null, phase, sz > 0));

  const body = new THREE.Group();
  body.position.y = 0.62;
  rig.add(body);
  ball(body, skinMat, [0, 0, 0], [0.27, 0.25, 0.37]); // under the fleece
  const fleece = new THREE.Group();
  body.add(fleece);
  for (const [x, y, z, sx, sy = sx, sz = sx] of FLEECE) piece(fleece, woolGeo, woolMat, [x, y, z], [sx, sy, sz]);

  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.4);
  body.add(head);
  ball(head, faceMat, [0, -0.02, 0.1], [0.13, 0.15, 0.19]);
  piece(head, woolGeo, woolMat, [0, 0.11, 0.02], [0.14, 0.09, 0.13]); // a woolly cap
  for (const sx of [-1, 1]) {
    const ear = ball(head, faceMat, [sx * 0.15, 0.03, 0.02], [0.1, 0.035, 0.05]);
    ear.rotation.z = sx * -0.4;
    ball(head, trimMat, [sx * 0.085, 0.03, 0.2], [0.03, 0.03, 0.025]);
    ball(head, eyeMat, [sx * 0.09, 0.03, 0.22], [0.015, 0.018, 0.012]);
  }

  function pose(a, t) {
    const down = a.graze;
    body.position.y = 0.62 + Math.abs(a.step) * 0.025;
    head.rotation.x = down * 0.85 + Math.sin(t * 10) * 0.03 * down;
    head.position.y = 0.12 - down * 0.1;
    head.rotation.y = a.look;
    fleece.scale.setScalar(SHORN + (1 - SHORN) * a.growth);
  }
  return { root, rig, legs, scale: 1, lieDrop: 0.3, pose };
}

const BUILD = { hen: buildHen, cow: buildCow, sheep: buildSheep };
// One drawn on its own, for show (Rosa's at her ranch: src/npchomes.js):
// { root, rig, legs, pose(a, t) }, a: how she stands (as an animal's own state is)
export const animalModel = (kind, color = 0) => BUILD[kind](color);
const COLORS = { hen: HEN_COLORS.length, cow: COW_COLORS.length, sheep: WOOL_COLORS.length };

// ---------- Shiny ones ----------
// For beating a boss (src/bosses.js): an animal in gold, that sparkles. Her
// color is SHINY (kept in the save like any other), she gives what any of
// her kind does, and she doesn't count toward how many the pen has room for.
export const SHINY = 9;
const MOST_SHINY = 12; // of a kind
const goldMats = new Map(); // a material -> its gold one
function gild(root) {
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material?.color) return;
    if (!goldMats.has(obj.material)) {
      const { r, g, b } = obj.material.color;
      const light = 0.35 + 0.65 * Math.min(1, 0.3 * r + 0.59 * g + 0.11 * b + 0.25); // (dark parts stay a darker gold)
      goldMats.set(obj.material, new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 0.8, 0.25).multiplyScalar(light),
        emissive: 0x6b4a00,
        emissiveIntensity: 0.35,
        metalness: 0.55,
        roughness: 0.35,
      }));
    }
    obj.material = goldMats.get(obj.material);
  });
}
const sparkleMat = new THREE.SpriteMaterial({ depthWrite: false, transparent: true, map: canvasTexture(32, (ctx) => {
  ctx.fillStyle = '#fff6c0';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 3 : 15;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
  }
  ctx.fill();
}) });
// little stars that come and go round her: returns twinkle(t), for each frame
function sparkles(root, height) {
  const stars = Array.from({ length: 4 }, (_, i) => {
    const star = new THREE.Sprite(sparkleMat);
    star.userData.seed = i * 1.7;
    root.add(star);
    return star;
  });
  return (t) => {
    for (const star of stars) {
      const k = (t * 0.6 + star.userData.seed) % 1;
      const a = star.userData.seed * 2.3 + Math.floor(t * 0.6 + star.userData.seed) * 2.1;
      star.position.set(Math.cos(a) * 0.45, height * (0.4 + k * 0.8), Math.sin(a) * 0.45);
      star.scale.setScalar(0.22 * Math.sin(k * Math.PI));
    }
  };
}

// ---------- What floats over them ----------
function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// a heart, for a pleased animal
const heartMat = new THREE.SpriteMaterial({ depthWrite: false, map: canvasTexture(64, (ctx) => {
  ctx.fillStyle = '#ff5f7e';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(4, 36, 6, 10, 22, 10);
  ctx.bezierCurveTo(28, 10, 32, 16, 32, 20);
  ctx.bezierCurveTo(32, 16, 36, 10, 42, 10);
  ctx.bezierCurveTo(58, 10, 60, 36, 32, 54);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}) });
// a z, drifting up off a sleeping cow or sheep
const zMat = new THREE.SpriteMaterial({ depthWrite: false, map: canvasTexture(64, (ctx) => {
  ctx.font = 'bold 50px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2b3550';
  ctx.strokeText('z', 32, 32);
  ctx.fillStyle = '#e8eefc';
  ctx.fillText('z', 32, 32);
}) });
// what she has for you, as its item picture in a little bubble
function itemBadge(id) {
  const { sprite, palette } = ITEMS[id];
  const tex = canvasTexture(64, (ctx) => {
    ctx.fillStyle = 'rgba(255, 248, 230, 0.92)';
    ctx.strokeStyle = '#5b3a1e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    sprite.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(16 + x * 2, 16 + y * 2, 2, 2);
    }));
  });
  tex.magFilter = THREE.NearestFilter;
  return new THREE.SpriteMaterial({ map: tex, depthWrite: false });
}
const badgeMats = {};
export const badgeMat = (id) => (badgeMats[id] ??= itemBadge(id)); // (the machines show theirs too: src/machines.js)

// ---------- Eggs ----------
const eggGeo = new THREE.SphereGeometry(1, 10, 8);
const eggMat = mat(0xf3e3c3, { roughness: 0.5 });
const largeEggMat = mat(0xd9a46a, { roughness: 0.5 }); // (a large one: bigger, and brown)

// ---------- The animals ----------
// main.js adds `root` to the farm, calls update() each frame at home, and
// saves capture() with the farm (restore() puts it back).
export function createAnimals() {
  const root = new THREE.Group();
  const animals = [];
  const eggs = []; // { mesh, x, z, wobble, large }
  const floaters = []; // hearts and z's: { sprite, age, life }
  let hours = 0; // the farm's clock, as of the last update

  const penOf = (a) => PENS[a.def.pen];
  const roamSpot = (a) => {
    const r = penOf(a).roam;
    return { x: rand(r.minX, r.maxX), z: rand(r.minZ, r.maxZ) };
  };
  const clampRoam = (a, p) => {
    const r = penOf(a).roam;
    p.x = THREE.MathUtils.clamp(p.x, r.minX, r.maxX);
    p.z = THREE.MathUtils.clamp(p.z, r.minZ, r.maxZ);
    return p;
  };
  const countOf = (kind) => animals.filter((a) => a.kind === kind && a.color !== SHINY).length; // (shiny ones are extra)
  const isReady = (a) => !!a.def.product && hours >= a.readyAt;

  // due: game hours of her next egg (a hen) or until she has milk or wool
  function add(kind, { color = 0, x, z, due, asleep = false }) {
    const def = KINDS[kind];
    const shiny = color === SHINY;
    const model = BUILD[kind](shiny ? 0 : color);
    if (shiny) gild(model.root);
    const a = {
      kind,
      def,
      model,
      root: model.root,
      color,
      pos: new THREE.Vector3(x, 0, z),
      yaw: rand(-Math.PI, Math.PI),
      state: asleep ? 'asleep' : 'idle',
      timer: rand(0.5, 2),
      target: null,
      nextEgg: kind === 'hen' ? due : 0,
      readyAt: kind === 'hen' ? 0 : due,
      growth: 1, // a sheep's fleece: 0 shorn, 1 full
      walkPhase: rand(0, 10),
      walkAmount: 0,
      step: 0,
      graze: 0, // a hen: 0..1 through a peck; the others: how far the head is down
      flap: 0,
      squash: 0,
      look: 0,
      lookTarget: 0,
      lie: asleep && kind !== 'hen' ? 1 : 0,
      wakeAt: 0,
      zAt: rand(0, 3),
      seed: rand(0, 100),
      twinkle: shiny ? sparkles(model.root, kind === 'hen' ? 0.6 : 1.3) : null,
    };
    a.root.visible = !(asleep && kind === 'hen'); // (a hen sleeps in the coop)
    a.badge = def.product ? new THREE.Sprite(badgeMat(def.product)) : null;
    if (a.badge) {
      a.badge.scale.setScalar(0.52);
      a.badge.visible = false;
      root.add(a.badge);
    }
    root.add(a.root);
    animals.push(a);
    place(a);
    return a;
  }

  function place(a) {
    a.root.position.copy(a.pos);
    a.root.rotation.y = a.yaw;
  }

  function float(material, x, y, z, { life = 1, scale = 0.35 } = {}) {
    const sprite = new THREE.Sprite(material.clone());
    sprite.scale.setScalar(scale);
    sprite.position.set(x, y, z);
    root.add(sprite);
    floaters.push({ sprite, age: 0, life });
  }

  // ---------- Eggs ----------
  // (large: a large egg, which a hen in a well kept yard lays now and then)
  function addEgg(x, z, fresh = false, large = false) {
    const mesh = new THREE.Mesh(eggGeo, large ? largeEggMat : eggMat);
    const k = large ? 1.3 : 1;
    mesh.scale.set(0.1 * k, 0.125 * k, 0.1 * k);
    mesh.position.set(x, 0.12 * k, z);
    mesh.rotation.z = rand(-0.3, 0.3);
    mesh.castShadow = true;
    root.add(mesh);
    eggs.push({ mesh, x, z, wobble: fresh ? 1 : 0, large });
  }
  const largeEgg = () => Math.random() < penAt('yard').largeEgg;

  // An egg she laid while asleep or with nobody about: in the nest
  function nestEgg(large) {
    const i = eggs.length;
    const a = i * 2.4;
    const r = i === 0 ? 0 : 0.15;
    addEgg(NEST.x + Math.cos(a) * r, NEST.z + Math.sin(a) * r, false, large);
  }

  function lay(hen) {
    while (hen.nextEgg <= hours) {
      // a very long time away: only the last few days' eggs matter
      if (hours - hen.nextEgg > 24 * EGGS_PER_HEN) hen.nextEgg += 24 * Math.floor((hours - hen.nextEgg) / 24 - EGGS_PER_HEN);
      const roomForMore = eggs.length < countOf('hen') * EGGS_PER_HEN;
      const outAndAbout = hen.root.visible && hen.state !== 'roost' && hours - hen.nextEgg < 0.5;
      if (roomForMore && outAndAbout) {
        // right behind her, with a squat and a flap
        addEgg(hen.pos.x - Math.sin(hen.yaw) * 0.3, hen.pos.z - Math.cos(hen.yaw) * 0.3, true, largeEgg());
        hen.squash = 0.35;
        hen.flap = 1;
        hen.state = 'idle';
        hen.timer = 1.2;
      } else if (roomForMore) {
        nestEgg(largeEgg());
      }
      hen.nextEgg = (Math.floor(hen.nextEgg / 24) + 1) * 24 + rand(...LAY_HOURS);
    }
  }

  // ---------- Behaviour ----------
  function walkTo(a, target, state = 'walk') {
    a.target = target;
    a.state = state;
  }

  // Step toward a.target; true once there
  function stepToward(a, speed, dt) {
    const dx = a.target.x - a.pos.x;
    const dz = a.target.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const step = Math.min(d, speed * dt);
    a.pos.x += (dx / d) * step;
    a.pos.z += (dz / d) * step;
    let diff = Math.atan2(dx, dz) - a.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.yaw += diff * damp(a.kind === 'hen' ? 10 : 4, dt);
    return false;
  }

  // What she does next when she's done with the last thing. The cows and
  // sheep graze longer, and wander less.
  function decide(a) {
    const r = Math.random();
    const big = a.kind !== 'hen';
    if (r < (big ? 0.35 : 0.45)) walkTo(a, roamSpot(a));
    else if (r < 0.85) {
      a.state = 'graze';
      a.timer = big ? rand(3, 8) : rand(1.2, 3);
    } else {
      a.state = 'idle';
      a.timer = rand(1, 3);
      a.lookTarget = rand(-0.8, 0.8);
    }
  }

  function wake(a) {
    a.wakeAt = 0;
    if (a.kind === 'hen') {
      // out of the coop and down the ramp
      a.pos.set(COOP.x, COOP.floor, COOP_FRONT - 0.1);
      a.yaw = 0;
      a.root.visible = true;
      walkTo(a, { x: DOOR.x + rand(-0.2, 0.2), z: DOOR.z + 0.4 }, 'emerge');
    } else {
      a.state = 'idle'; // (she gets up as `lie` eases off)
      a.timer = rand(1, 2);
    }
  }

  function think(a, dt, players) {
    const bedtime = isBedtime(hours);
    if (a.state === 'asleep') {
      if (bedtime) {
        a.wakeAt = 0;
        return;
      }
      // up in the morning, one after another
      if (!a.wakeAt) a.wakeAt = performance.now() + rand(0, 6000);
      if (performance.now() >= a.wakeAt) wake(a);
      return;
    }
    if (bedtime && a.state !== 'roost' && a.state !== 'toDoor') {
      if (a.kind === 'hen') walkTo(a, { x: DOOR.x, z: DOOR.z }, 'toDoor');
      else {
        a.state = 'asleep'; // down in the grass, where she stands
        return;
      }
    }

    const calm = ['petted', 'toDoor', 'roost', 'emerge'].includes(a.state);
    const player = !calm && a.def.startle && players.find((p) => p.moving && p.onGround && Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < a.def.startle);
    if (player) {
      // off she goes, away from the farmer
      const away = Math.atan2(a.pos.x - player.pos.x, a.pos.z - player.pos.z) + rand(-0.5, 0.5);
      walkTo(a, clampRoam(a, { x: a.pos.x + Math.sin(away) * 1.8, z: a.pos.z + Math.cos(away) * 1.8 }), 'scurry');
      a.flap = 1;
    }

    switch (a.state) {
      case 'walk':
      case 'emerge': // (a hen, down the ramp)
        if (stepToward(a, a.def.walk, dt)) decide(a);
        break;
      case 'scurry':
        if (stepToward(a, a.def.scurry, dt)) {
          a.state = 'idle';
          a.timer = rand(0.6, 1.5);
        }
        break;
      case 'toDoor':
        if (stepToward(a, a.def.walk * 1.3, dt)) walkTo(a, { x: COOP.x, z: COOP_FRONT - 0.1 }, 'roost');
        break;
      case 'roost': // up the ramp and in
        if (stepToward(a, a.def.walk, dt)) {
          a.state = 'asleep';
          a.root.visible = false;
        }
        break;
      default: // graze, idle, petted
        if ((a.timer -= dt) <= 0) decide(a);
    }
    // a hen on the ramp climbs it
    const onRamp = a.state === 'emerge' || a.state === 'roost' || a.state === 'toDoor';
    a.pos.y = onRamp ? COOP.floor * THREE.MathUtils.clamp((RAMP_END - a.pos.z) / (RAMP_END - COOP_FRONT), 0, 1) : 0;
    if (!onRamp) clampRoam(a, a.pos);
  }

  // Animals keep a little room between them (and nudge the farmer aside: the
  // bigger ones, which you'd otherwise walk through)
  function makeRoom(players) {
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i];
      if (!a.root.visible) continue;
      for (let j = i + 1; j < animals.length; j++) {
        const b = animals[j];
        if (!b.root.visible || a.def.pen !== b.def.pen) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const room = (a.def.radius + b.def.radius) * 1.1;
        if (d > room || d === 0) continue;
        const push = (room - d) / 2 / d;
        a.pos.x -= dx * push;
        a.pos.z -= dz * push;
        b.pos.x += dx * push;
        b.pos.z += dz * push;
      }
      if (a.kind === 'hen') continue;
      for (const player of players) {
        if (player.pos.y > 1.2 + a.def.radius) continue;
        const dx = player.pos.x - a.pos.x;
        const dz = player.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const room = a.def.radius + 0.35;
        if (d < room && d > 0) {
          player.pos.x += (dx / d) * (room - d);
          player.pos.z += (dz / d) * (room - d);
        }
      }
    }
  }

  function animate(a, dt, t) {
    const moving = ['walk', 'scurry', 'emerge', 'toDoor', 'roost'].includes(a.state);
    a.walkAmount += ((moving ? 1 : 0) - a.walkAmount) * damp(10, dt);
    if (moving) a.walkPhase += dt * (a.state === 'scurry' ? 26 : a.kind === 'cow' ? 7 : 14);
    a.step = Math.sin(a.walkPhase) * a.walkAmount;

    // lying down for the night (the cows and sheep), and getting up again
    a.lie += ((a.state === 'asleep' && a.kind !== 'hen' ? 1 : 0) - a.lie) * damp(3, dt);
    for (const leg of a.model.legs) {
      const fold = a.lie * (leg.front ? 1.45 : -1.45); // tucked in under her
      leg.pivot.rotation.x = Math.sin(a.walkPhase + leg.phase) * 0.6 * a.walkAmount * (1 - a.lie) + fold;
    }

    if (a.kind === 'hen') {
      if (a.state === 'graze') a.graze = (a.graze + dt * 2.2) % 1;
      else a.graze = Math.max(0, a.graze - dt * 4);
    } else {
      a.graze += ((a.state === 'graze' || a.state === 'asleep' ? 1 : 0) - a.graze) * damp(a.state === 'asleep' ? 1 : 4, dt);
    }
    if (a.state !== 'idle') a.lookTarget = 0;
    else if (Math.random() < dt * 0.7) a.lookTarget = rand(-0.9, 0.9);
    a.look += (a.lookTarget - a.look) * damp(a.state === 'idle' ? 12 : 6, dt);
    a.flap += (0 - a.flap) * damp(2.5, dt);
    if (a.kind === 'sheep') a.growth = THREE.MathUtils.clamp(1 - (a.readyAt - hours) / a.def.regrow, 0, 1);
    a.model.pose(a, t);

    a.squash += (0 - a.squash) * damp(8, dt);
    const s = a.model.scale;
    const breathe = Math.sin(t * (a.state === 'asleep' ? 1.6 : 3) + a.seed) * 0.015;
    a.model.rig.scale.set(s * (1 + a.squash * 0.4), s * (1 - a.squash + breathe), s * (1 + a.squash * 0.4));
    a.model.rig.position.y = -a.model.lieDrop * a.lie;
    place(a);

    // what she has for you floats over her; z's drift off her while she sleeps
    if (a.badge) {
      a.badge.visible = isReady(a) && a.state !== 'asleep' && a.root.visible;
      a.badge.position.set(a.pos.x, (a.kind === 'cow' ? 1.75 : 1.4) + Math.sin(t * 2.5 + a.seed) * 0.06, a.pos.z);
    }
    if (a.state === 'asleep' && a.kind !== 'hen' && (a.zAt -= dt) <= 0) {
      a.zAt = rand(1.8, 3.2);
      float(zMat, a.pos.x + rand(-0.1, 0.1), a.kind === 'cow' ? 1.1 : 0.8, a.pos.z + 0.2, { life: 2.2, scale: 0.28 });
    }
  }

  // players: [{ pos, moving, onGround, collect }], each farmer about (pos is
  // moved if she's in the way; collect(item): one into their backpack, false
  // if it's full). (Or one, as player and collect.)
  function update(dt, t, { hours: now, player, collect, players = [{ ...player, collect }] }) {
    hours = now;
    for (const a of animals) {
      think(a, dt, players);
      if (a.kind === 'hen') lay(a);
    }
    makeRoom(players);
    for (const a of animals) animate(a, dt, t);
    for (const a of animals) a.twinkle?.(t);

    for (let i = eggs.length - 1; i >= 0; i--) {
      const egg = eggs[i];
      egg.wobble = Math.max(0, egg.wobble - dt * 0.7);
      egg.mesh.rotation.x = Math.sin(t * 14) * 0.25 * egg.wobble;
      const near = (p) => Math.hypot(p.pos.x - egg.x, p.pos.z - egg.z) < EGG_REACH && p.pos.y < 1.6;
      if (players.some((p) => near(p) && p.collect?.(egg.large ? 'large_egg' : 'egg'))) {
        root.remove(egg.mesh);
        eggs.splice(i, 1);
      }
    }

    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      f.sprite.position.y += dt * 0.6;
      f.sprite.position.x += Math.sin(f.age * 3 + i) * dt * 0.1;
      f.sprite.material.opacity = 1 - (f.age / f.life) ** 2;
      if (f.age >= f.life) {
        root.remove(f.sprite);
        f.sprite.material.dispose();
        floaters.splice(i, 1);
      }
    }
  }

  // ---------- The farmer and the animals ----------
  const canReach = (a, pos) =>
    a.root.visible && a.state !== 'roost' && a.state !== 'asleep' && pos.y < 2.2 &&
    Math.hypot(pos.x - a.pos.x, pos.z - a.pos.z) < a.def.radius + a.def.reach;

  // the animal within reach, nearest first
  function inReach(pos) {
    let best = null;
    let bestD = Infinity;
    for (const a of animals) {
      const d = Math.hypot(pos.x - a.pos.x, pos.z - a.pos.z) - a.def.radius;
      if (d < bestD && canReach(a, pos)) {
        best = a;
        bestD = d;
      }
    }
    return best;
  }

  // She stops, turns to look at you, and is pleased
  function pet(a, from) {
    if (a.state === 'toDoor') return; // (off to bed: no time for that)
    a.state = 'petted';
    a.timer = 1.8;
    a.target = null;
    a.yaw = Math.atan2(from.x - a.pos.x, from.z - a.pos.z);
    a.squash = a.kind === 'hen' ? 0.3 : 0.12;
    a.flap = 0.5;
    float(heartMat, a.pos.x, a.kind === 'cow' ? 1.6 : a.kind === 'sheep' ? 1.25 : 1.1, a.pos.z);
  }

  // E next to her: milk or shear her when she's ready, else pet her.
  // collect(item): into the backpack, false if it's full (she keeps it).
  // (in a well kept pasture, now and then two: PEN_LEVELS' `second`)
  function tend(a, from, collect) {
    if (isReady(a)) {
      if (!collect(a.def.product)) return;
      if (Math.random() < penAt(a.def.pen).second) collect(a.def.product); // (if there's room for it)
      a.readyAt = a.def.regrow === 'morning' ? nextMorning(hours) : hours + a.def.regrow;
    }
    pet(a, from);
  }

  // What E does to her, for the prompt
  const verbFor = (a) => (isReady(a) ? a.def.verb : `Pet the ${a.def.name}`);

  // Is this where one of `kind` is let out? (margin: just outside the fence counts)
  const inPenFor = (kind, x, z, margin = 0) => inRect(PENS[KINDS[kind].pen].rect, x, z, margin);

  // A new animal from the backpack, out in her pen. Returns what's in the
  // way (a notice to show), or null once she's out.
  function letOut(kind, x, z) {
    const def = KINDS[kind];
    if (!inPenFor(kind, x, z, 0.5)) return kind === 'hen' ? 'Let her out in the hen yard, by the coop' : `Let the ${def.name} loose in the pasture`;
    if (countOf(kind) >= roomFor(kind)) {
      const bigger = penLevel[def.pen] < PEN_LEVELS[def.pen].length;
      return def.full(roomFor(kind)) + (bigger ? `. A bigger ${def.pen === 'yard' ? 'yard' : 'pasture'} has room for more (the workbench)` : '');
    }
    const a = { def };
    const spot = clampRoam(a, { x, z });
    const due = kind === 'hen' ? nextLay(hours) : hours; // (a cow or sheep comes with milk or wool)
    const animal = add(kind, { color: countOf(kind) % COLORS[kind], x: spot.x, z: spot.z, due });
    animal.squash = -0.3; // a hop out of the basket (or off the lead)
    animal.flap = 1;
    return null;
  }

  // A shiny one of `kind`, for beating a boss, out in her pen now
  function addShiny(kind) {
    if (!KINDS[kind] || animals.filter((a) => a.kind === kind && a.color === SHINY).length >= MOST_SHINY) return null;
    const a = { def: KINDS[kind] };
    const spot = roamSpot(a);
    const animal = add(kind, { color: SHINY, x: spot.x, z: spot.z, due: kind === 'hen' ? nextLay(hours) : hours });
    animal.squash = -0.3;
    animal.flap = 1;
    float(heartMat, spot.x, kind === 'hen' ? 1 : 2, spot.z, { life: 1.5, scale: 0.45 });
    return animal;
  }

  function clear() {
    for (const a of animals) {
      root.remove(a.root); // (geometry and materials are shared)
      if (a.badge) root.remove(a.badge);
    }
    for (const egg of eggs) root.remove(egg.mesh);
    for (const f of floaters) {
      root.remove(f.sprite);
      f.sprite.material.dispose();
    }
    animals.length = eggs.length = floaters.length = 0;
  }

  const r2 = (v) => Math.round(v * 100) / 100;
  // A new farm's animals (and those of a farm saved before they came)
  const STARTERS = {
    hen: (h) => [[0, YARD.x - 1, YARD.z + 1, nextLay(h)], [1, YARD.x + 1.5, YARD.z + 1.8, nextLay(h)]],
    cow: (h) => [[0, PASTURE.x + 2, PASTURE.z + 1, h]],
    sheep: (h) => [[0, PASTURE.x - 2, PASTURE.z + 1.5, h]],
  };
  const SAVE_KEYS = { hen: 'hens', cow: 'cows', sheep: 'sheep' };

  return {
    root,
    update,
    inReach,
    canReach,
    tend,
    verbFor,
    inPenFor,
    letOut,
    addShiny,
    clear,
    list: () => animals,
    // For the save: each kind as [color, x, z, due (game hours)], eggs as
    // [x, z] (a large one [x, z, 1])
    capture() {
      const save = { eggs: eggs.map((e) => (e.large ? [r2(e.x), r2(e.z), 1] : [r2(e.x), r2(e.z)])) };
      for (const [kind, key] of Object.entries(SAVE_KEYS)) {
        save[key] = animals.filter((a) => a.kind === kind).map((a) => {
          const inCoop = a.state === 'asleep' && kind === 'hen';
          return [a.color, r2(inCoop ? DOOR.x : a.pos.x), r2(inCoop ? DOOR.z + 0.4 : a.pos.z), r2(kind === 'hen' ? a.nextEgg : a.readyAt)];
        });
      }
      return save;
    },
    // saved: from capture() (a kind missing from it gets a new farm's). now:
    // the farm's clock. (The pens' levels first: setPenLevels(), which says
    // how many fit.)
    restore(saved, now) {
      clear();
      hours = now;
      const asleep = isBedtime(now);
      for (const [kind, key] of Object.entries(SAVE_KEYS)) {
        const list = saved?.[key] ?? STARTERS[kind](now);
        // (the shiny ones besides as many as the pen holds)
        const plain = list.filter(([color]) => color !== SHINY).slice(0, roomFor(kind));
        for (const [color, x, z, due] of [...plain, ...list.filter(([color]) => color === SHINY).slice(0, MOST_SHINY)]) {
          if (![x, z, due].every(Number.isFinite)) continue;
          const spot = clampRoam({ def: KINDS[kind] }, { x, z });
          add(kind, { color: (color >= 0 && color < COLORS[kind]) || color === SHINY ? color : 0, x: spot.x, z: spot.z, due, asleep });
        }
      }
      for (const [x, z, large] of (saved?.eggs ?? []).slice(0, countOf('hen') * EGGS_PER_HEN)) {
        if (Number.isFinite(x) && Number.isFinite(z)) addEgg(x, z, false, large === 1);
      }
    },
  };
}
