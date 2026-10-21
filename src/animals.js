import * as THREE from 'three';
import { damp } from './character.js';
import { foliageMat } from './world.js';
import { ITEMS } from './items.js';
import { ANIMALS, LAY_HOURS, EGGS_PER_HEN } from '../shared/balance.js'; // (what they give, and how often)

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
// The pens are among the farm's set pieces (maps.js builds them with the
// island); the animals are added by main.js, which drives them and saves them
// with the farm. Like the stall, everything faces +Z, toward the camera.

const rand = (min, max) => min + Math.random() * (max - min);
const hourOf = (hours) => THREE.MathUtils.euclideanModulo(hours, 24);
const ROOST_AT = 19.25; // hours: in to bed a little before dark...
const WAKE_AT = 6.25; // ...and up again after sunrise
const isBedtime = (hours) => hourOf(hours) >= ROOST_AT || hourOf(hours) < WAKE_AT;
const nextMorning = (hours) => (Math.floor((hours - WAKE_AT) / 24) + 1) * 24 + WAKE_AT;

// ---------- The pens ----------
const FENCE_H = 0.8;
const rectOf = ({ x, z, w, d }) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

export const YARD = { x: -9, z: 6, w: 8, d: 6 };
const Y = rectOf(YARD);
const COOP = { x: -10.6, z: 3.85, w: 2.4, d: 1.5, floor: 0.4 }; // against the north fence
const COOP_FRONT = COOP.z + COOP.d / 2;
const RAMP_END = COOP_FRONT + 0.7; // the ramp runs from the door sill down to here
const DOOR = { x: COOP.x, z: RAMP_END + 0.15 }; // where a hen waits at the foot of the ramp
const NEST = { x: -8.6, z: 4.1 }; // straw beside the coop
const TROUGH = { x: -6.3, z: 3.75 };

export const PASTURE = { x: -8.5, z: 15, w: 11, d: 8 };
const P = rectOf(PASTURE);
const HAY = [[P.minX + 1.3, P.minZ + 0.75], [P.minX + 2.45, P.minZ + 0.7]];
const WATER = { x: P.maxX - 2.2, z: P.minZ + 0.6 };

// Each pen: its fence, its gate (a gap in the east fence, toward the paths),
// and where its animals roam (in front of what stands along the north fence)
const PENS = {
  yard: { rect: Y, gate: { z: YARD.z, w: 1.6 }, roam: { minX: Y.minX + 0.5, maxX: Y.maxX - 0.5, minZ: RAMP_END + 0.3, maxZ: Y.maxZ - 0.5 } },
  pasture: { rect: P, gate: { z: PASTURE.z, w: 1.8 }, roam: { minX: P.minX + 0.6, maxX: P.maxX - 0.6, minZ: P.minZ + 1.7, maxZ: P.maxZ - 0.6 } },
};

const inRect = (r, x, z, margin = 0) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
// In one of the pens (margin: how far outside the fence still counts)
export const inPen = (x, z, margin = 0) => Object.values(PENS).some((pen) => inRect(pen.rect, x, z, margin));

// ---------- The kinds of animal ----------
// pen: where she lives. radius: how much room she takes (bigger ones nudge
// the farmer aside). reach: how close (beyond her radius) to pet her. walk /
// scurry: speeds. startle: a moving farmer this close sends her scurrying (0:
// never). product: what she gives (an item), and `regrow`: game hours until
// she has more ('morning': the next morning), both from ANIMALS in
// shared/balance.js. The item that lets one out is named like the kind (items.js).
const KINDS = {
  hen: { pen: 'yard', max: 8, name: 'hen', radius: 0.25, reach: 1.15, walk: 0.9, scurry: 2.8, startle: 0.8, full: 'The coop is full: eight hens is plenty' },
  cow: { pen: 'pasture', max: 4, name: 'cow', radius: 0.62, reach: 1, walk: 0.55, scurry: 0, startle: 0, ...ANIMALS.cow, verb: 'Milk the cow', full: 'The pasture has room for four cows' },
  sheep: { pen: 'pasture', max: 6, name: 'sheep', radius: 0.45, reach: 1, walk: 0.75, scurry: 2.2, startle: 1, ...ANIMALS.sheep, verb: 'Shear the sheep', full: 'The pasture has room for six sheep' },
};
export const ANIMAL_KINDS = Object.keys(KINDS);

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

// A run of fence from (x0, z0) to (x1, z1): posts about a meter apart, two rails
function fence(parent, addCollider, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    piece(parent, box, postMat, [x0 + (x1 - x0) * k, FENCE_H / 2, z0 + (z1 - z0) * k], [0.12, FENCE_H, 0.12]);
  }
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  for (const y of [0.32, 0.64]) {
    piece(parent, box, railMat, [cx, y, cz], along ? [len, 0.08, 0.05] : [0.05, 0.08, len]);
  }
  addCollider({ x: cx, y: FENCE_H / 2, z: cz, w: along ? len : 0.2, h: FENCE_H, d: along ? 0.2 : len });
}

// The fence round a pen, with its gate
function penFence(parent, addCollider, { rect: r, gate }) {
  const gate0 = gate.z - gate.w / 2;
  const gate1 = gate.z + gate.w / 2;
  fence(parent, addCollider, r.minX, r.minZ, r.maxX, r.minZ); // north
  fence(parent, addCollider, r.minX, r.maxZ, r.maxX, r.maxZ); // south
  fence(parent, addCollider, r.minX, r.minZ, r.minX, r.maxZ); // west
  fence(parent, addCollider, r.maxX, r.minZ, r.maxX, gate0); // east, either side of the gate
  fence(parent, addCollider, r.maxX, gate1, r.maxX, r.maxZ);
  for (const z of [gate0, gate1]) piece(parent, box, postMat, [r.maxX, 0.5, z], [0.18, 1, 0.18]); // taller gateposts
}

// ctx: from world.js's buildWorld (the farm's set pieces)
export function buildPens({ root, addCollider }) {
  const pens = new THREE.Group();
  root.add(pens);
  penFence(pens, addCollider, PENS.yard);
  penFence(pens, addCollider, PENS.pasture);

  // The coop: a little red henhouse up on stilts, a gabled roof, a door with a ramp
  const coop = new THREE.Group();
  coop.name = 'coop';
  coop.position.set(COOP.x, 0, COOP.z);
  pens.add(coop);
  const { w, d, floor } = COOP;
  const wallH = 1.1;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    piece(coop, box, postMat, [sx * (w / 2 - 0.12), floor / 2, sz * (d / 2 - 0.12)], [0.12, floor, 0.12]);
  }
  piece(coop, box, wallMat, [0, floor + wallH / 2, 0], [w, wallH, d]);
  piece(coop, box, trimMat, [0, floor + 0.04, 0], [w + 0.06, 0.08, d + 0.06]);
  for (const sx of [-1, 1]) piece(coop, box, trimMat, [sx * (w / 2), floor + wallH / 2, d / 2 + 0.01], [0.08, wallH, 0.04]);
  // the gable ends: a triangle of wall under the roof on each side (a
  // three-sided cylinder turned on its side, point up)
  const gable = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  for (const sx of [-1, 1]) {
    piece(coop, gable, wallMat, [sx * (w / 2 - 0.05), floor + wallH + 0.167, 0], [d / 2 / 0.866, 0.1, 0.333], [-Math.PI / 2, 0, -Math.PI / 2]);
  }
  // the roof: two slopes meeting on a ridge running east-west
  const slope = Math.atan2(0.5, d / 2);
  const slopeLen = Math.hypot(0.5, d / 2) + 0.2;
  for (const sz of [-1, 1]) {
    piece(coop, box, roofMat, [0, floor + wallH + 0.27, sz * (d / 4 + 0.03)], [w + 0.35, 0.08, slopeLen], [sz * slope, 0, 0]);
  }
  piece(coop, box, trimMat, [0, floor + wallH + 0.53, 0], [w + 0.4, 0.07, 0.1]);
  // the door, a round window, and the ramp up to the door
  piece(coop, box, darkMat, [0, floor + 0.3, d / 2 + 0.01], [0.46, 0.56, 0.04]);
  piece(coop, box, trimMat, [0, floor + 0.6, d / 2 + 0.02], [0.56, 0.06, 0.05]);
  const win = piece(coop, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), darkMat, [-0.75, floor + 0.65, d / 2 + 0.01], [1, 1, 1], [Math.PI / 2, 0, 0]);
  win.castShadow = false;
  piece(coop, new THREE.TorusGeometry(0.18, 0.035, 6, 16), trimMat, [-0.75, floor + 0.65, d / 2 + 0.03], [1, 1, 1]);
  const rampLen = Math.hypot(floor, RAMP_END - COOP_FRONT);
  const ramp = new THREE.Group();
  ramp.position.set(0, floor / 2, d / 2 + (RAMP_END - COOP_FRONT) / 2);
  ramp.rotation.x = Math.atan2(floor, RAMP_END - COOP_FRONT);
  coop.add(ramp);
  piece(ramp, box, railMat, [0, 0, 0], [0.4, 0.04, rampLen]);
  for (let i = 0; i < 4; i++) piece(ramp, box, postMat, [0, 0.03, -rampLen / 2 + 0.12 + i * 0.17], [0.4, 0.03, 0.03]);
  // Solid: you can't walk through the coop (the hens go in by the door)
  addCollider({ x: COOP.x, y: 1.1, z: COOP.z, w, h: 2.2, d });

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
  piece(pens, new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), waterMat, [TROUGH.x - 0.95, 0.11, TROUGH.z + 0.1], [1, 1, 1]);
  addCollider({ x: TROUGH.x - 0.3, y: 0.15, z: TROUGH.z, w: 1.6, h: 0.3, d: 0.5 });

  // In the pasture: round hay bales lying along the north fence, and a long water trough
  const baleGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16);
  for (const [x, z] of HAY) {
    piece(pens, baleGeo, [strawMat, hayEndMat, hayEndMat], [x, 0.45, z], [1, 1, 1], [0, 0, Math.PI / 2]);
    addCollider({ x, y: 0.45, z, w: 0.8, h: 0.9, d: 0.9 });
  }
  for (let i = 0; i < 5; i++) piece(pens, box, strawMat, [HAY[0][0] + 0.4 + i * 0.25, 0.015, HAY[0][1] + 0.6 + (i % 2) * 0.12], [0.2, 0.02, 0.03], [0, i * 1.3, 0]);
  piece(pens, box, postMat, [WATER.x, 0.22, WATER.z], [1.8, 0.44, 0.5]);
  piece(pens, box, waterMat, [WATER.x, 0.42, WATER.z], [1.65, 0.04, 0.36]);
  addCollider({ x: WATER.x, y: 0.22, z: WATER.z, w: 1.8, h: 0.44, d: 0.5 });
}

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
const COLORS = { hen: HEN_COLORS.length, cow: COW_COLORS.length, sheep: WOOL_COLORS.length };

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
const badgeMat = (id) => (badgeMats[id] ??= itemBadge(id));

// ---------- Eggs ----------
const eggGeo = new THREE.SphereGeometry(1, 10, 8);
const eggMat = mat(0xf3e3c3, { roughness: 0.5 });

// ---------- The animals ----------
// main.js adds `root` to the farm, calls update() each frame at home, and
// saves capture() with the farm (restore() puts it back).
export function createAnimals() {
  const root = new THREE.Group();
  const animals = [];
  const eggs = []; // { mesh, x, z, wobble }
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
  const countOf = (kind) => animals.filter((a) => a.kind === kind).length;
  const isReady = (a) => !!a.def.product && hours >= a.readyAt;

  // due: game hours of her next egg (a hen) or until she has milk or wool
  function add(kind, { color = 0, x, z, due, asleep = false }) {
    const def = KINDS[kind];
    const model = BUILD[kind](color);
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
  function addEgg(x, z, fresh = false) {
    const mesh = new THREE.Mesh(eggGeo, eggMat);
    mesh.scale.set(0.1, 0.125, 0.1);
    mesh.position.set(x, 0.12, z);
    mesh.rotation.z = rand(-0.3, 0.3);
    mesh.castShadow = true;
    root.add(mesh);
    eggs.push({ mesh, x, z, wobble: fresh ? 1 : 0 });
  }

  // An egg she laid while asleep or with nobody about: in the nest
  function nestEgg() {
    const i = eggs.length;
    const a = i * 2.4;
    const r = i === 0 ? 0 : 0.15;
    addEgg(NEST.x + Math.cos(a) * r, NEST.z + Math.sin(a) * r);
  }

  function lay(hen) {
    while (hen.nextEgg <= hours) {
      // a very long time away: only the last few days' eggs matter
      if (hours - hen.nextEgg > 24 * EGGS_PER_HEN) hen.nextEgg += 24 * Math.floor((hours - hen.nextEgg) / 24 - EGGS_PER_HEN);
      const roomForMore = eggs.length < countOf('hen') * EGGS_PER_HEN;
      const outAndAbout = hen.root.visible && hen.state !== 'roost' && hours - hen.nextEgg < 0.5;
      if (roomForMore && outAndAbout) {
        // right behind her, with a squat and a flap
        addEgg(hen.pos.x - Math.sin(hen.yaw) * 0.3, hen.pos.z - Math.cos(hen.yaw) * 0.3, true);
        hen.squash = 0.35;
        hen.flap = 1;
        hen.state = 'idle';
        hen.timer = 1.2;
      } else if (roomForMore) {
        nestEgg();
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

  function think(a, dt, player) {
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

    const toPlayer = Math.hypot(player.pos.x - a.pos.x, player.pos.z - a.pos.z);
    const calm = ['petted', 'toDoor', 'roost', 'emerge'].includes(a.state);
    if (!calm && a.def.startle && player.moving && player.onGround && toPlayer < a.def.startle) {
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
  function makeRoom(player) {
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
      if (a.kind === 'hen' || player.pos.y > 1.2 + a.def.radius) continue;
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

  // player: { pos, moving, onGround } (pos is moved if she's in the way).
  // collect(item): one into the backpack, false if it's full.
  function update(dt, t, { hours: now, player, collect }) {
    hours = now;
    for (const a of animals) {
      think(a, dt, player);
      if (a.kind === 'hen') lay(a);
    }
    makeRoom(player);
    for (const a of animals) animate(a, dt, t);

    for (let i = eggs.length - 1; i >= 0; i--) {
      const egg = eggs[i];
      egg.wobble = Math.max(0, egg.wobble - dt * 0.7);
      egg.mesh.rotation.x = Math.sin(t * 14) * 0.25 * egg.wobble;
      const near = Math.hypot(player.pos.x - egg.x, player.pos.z - egg.z) < EGG_REACH && player.pos.y < 1.6;
      if (near && collect?.('egg')) {
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
  function tend(a, from, collect) {
    if (isReady(a)) {
      if (!collect(a.def.product)) return;
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
    if (countOf(kind) >= def.max) return def.full;
    const a = { def };
    const spot = clampRoam(a, { x, z });
    const due = kind === 'hen' ? nextLay(hours) : hours; // (a cow or sheep comes with milk or wool)
    const animal = add(kind, { color: countOf(kind) % COLORS[kind], x: spot.x, z: spot.z, due });
    animal.squash = -0.3; // a hop out of the basket (or off the lead)
    animal.flap = 1;
    return null;
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
    clear,
    list: () => animals,
    // For the save: each kind as [color, x, z, due (game hours)], eggs as [x, z]
    capture() {
      const save = { eggs: eggs.map((e) => [r2(e.x), r2(e.z)]) };
      for (const [kind, key] of Object.entries(SAVE_KEYS)) {
        save[key] = animals.filter((a) => a.kind === kind).map((a) => {
          const inCoop = a.state === 'asleep' && kind === 'hen';
          return [a.color, r2(inCoop ? DOOR.x : a.pos.x), r2(inCoop ? DOOR.z + 0.4 : a.pos.z), r2(kind === 'hen' ? a.nextEgg : a.readyAt)];
        });
      }
      return save;
    },
    // saved: from capture() (a kind missing from it gets a new farm's). now:
    // the farm's clock.
    restore(saved, now) {
      clear();
      hours = now;
      const asleep = isBedtime(now);
      for (const [kind, key] of Object.entries(SAVE_KEYS)) {
        const list = saved?.[key] ?? STARTERS[kind](now);
        for (const [color, x, z, due] of list.slice(0, KINDS[kind].max)) {
          if (![x, z, due].every(Number.isFinite)) continue;
          const spot = clampRoam({ def: KINDS[kind] }, { x, z });
          add(kind, { color: color >= 0 && color < COLORS[kind] ? color : 0, x: spot.x, z: spot.z, due, asleep });
        }
      }
      for (const [x, z] of (saved?.eggs ?? []).slice(0, countOf('hen') * EGGS_PER_HEN)) {
        if (Number.isFinite(x) && Number.isFinite(z)) addEgg(x, z);
      }
    },
  };
}
