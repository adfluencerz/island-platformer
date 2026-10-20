import * as THREE from 'three';
import { damp } from './character.js';
import { foliageMat } from './world.js';

// ---------- Animals: the hens ----------
// A coop in a fenced yard on the home farm, west of the plaza, and the hens
// that live there. By day they wander the yard, peck at the grass and scurry
// off when you run at them; walk up to one and press E to pet her. Toward
// dusk they go up the ramp to roost, and in the morning they come back out.
//
// Each hen lays an egg a day, some time between mid-morning and the
// afternoon (game time, so eggs come with the clock: faster with T held,
// and while you're away). She lays it where she stands, or in the nest by
// the coop when it fell due while she slept or you were off the farm. Walk
// over an egg to pick it up; the merchant buys them, and sells hens: a hen is
// an item in the backpack until you let her out in the yard (E).
//
// The yard is one of the farm's set pieces (maps.js builds it with the
// island); the hens are added by main.js, which drives them and saves them
// with the farm. Like the stall, everything faces +Z, toward the camera.

export const YARD = { x: -9, z: 6, w: 8, d: 6 };
const Y = { minX: YARD.x - YARD.w / 2, maxX: YARD.x + YARD.w / 2, minZ: YARD.z - YARD.d / 2, maxZ: YARD.z + YARD.d / 2 };
const GATE = { z: YARD.z, w: 1.6 }; // a gap in the east fence, toward the plaza
const FENCE_H = 0.8;
const COOP = { x: -10.6, z: 3.85, w: 2.4, d: 1.5, floor: 0.4 }; // against the north fence
const COOP_FRONT = COOP.z + COOP.d / 2;
const RAMP_END = COOP_FRONT + 0.7; // the ramp runs from the door sill down to here
const DOOR = { x: COOP.x, z: RAMP_END + 0.15 }; // where a hen waits at the foot of the ramp
const NEST = { x: -8.6, z: 4.1 }; // straw beside the coop
const TROUGH = { x: -6.3, z: 3.75 };
// Where hens roam: in front of the coop, clear of the fence
const ROAM = { minX: Y.minX + 0.5, maxX: Y.maxX - 0.5, minZ: RAMP_END + 0.3, maxZ: Y.maxZ - 0.5 };

export const MAX_HENS = 8;
const EGGS_PER_HEN = 3; // eggs left lying about stop at this many a hen
const ROOST_AT = 19.25; // hours: in to roost a little before dark...
const WAKE_AT = 6.25; // ...and out again after sunrise
const LAY_HOURS = [8, 16]; // when in the day an egg falls due
const PET_REACH = 1.4;
const EGG_REACH = 0.55;
const STARTLE = 0.8; // a farmer walking this close sends a hen scurrying
const WALK_SPEED = 0.9;
const SCURRY_SPEED = 2.8;

// In the hen yard (margin: how far outside the fence still counts)
export const inYard = (x, z, margin = 0) =>
  x > Y.minX - margin && x < Y.maxX + margin && z > Y.minZ - margin && z < Y.maxZ + margin;

const clampRoam = (p) => {
  p.x = THREE.MathUtils.clamp(p.x, ROAM.minX, ROAM.maxX);
  p.z = THREE.MathUtils.clamp(p.z, ROAM.minZ, ROAM.maxZ);
  return p;
};
const rand = (min, max) => min + Math.random() * (max - min);
const randomRoamSpot = () => ({ x: rand(ROAM.minX, ROAM.maxX), z: rand(ROAM.minZ, ROAM.maxZ) });
const hourOf = (hours) => THREE.MathUtils.euclideanModulo(hours, 24);
const isRoostTime = (hours) => hourOf(hours) >= ROOST_AT || hourOf(hours) < WAKE_AT;

// When the next egg falls due: today if there's still time, else tomorrow
function nextLay(hours) {
  const day = Math.floor(hours / 24) * 24;
  const today = day + rand(...LAY_HOURS);
  return today > hours + 0.5 ? today : day + 24 + rand(...LAY_HOURS);
}

// ---------- The yard: fence, coop, nest, trough ----------
const railMat = foliageMat(0xd9b48a);
const postMat = foliageMat(0xa0682f);
const wallMat = foliageMat(0xb8452f);
const trimMat = foliageMat(0xf3ead8);
const roofMat = foliageMat(0x5b4636);
const darkMat = foliageMat(0x2a1a10);
const strawMat = foliageMat(0xe3c46a);
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

// ctx: from world.js's buildWorld (the farm's set pieces)
export function buildHenYard({ root, addCollider }) {
  const yard = new THREE.Group();
  root.add(yard);
  const gate0 = GATE.z - GATE.w / 2;
  const gate1 = GATE.z + GATE.w / 2;
  fence(yard, addCollider, Y.minX, Y.minZ, Y.maxX, Y.minZ); // north
  fence(yard, addCollider, Y.minX, Y.maxZ, Y.maxX, Y.maxZ); // south
  fence(yard, addCollider, Y.minX, Y.minZ, Y.minX, Y.maxZ); // west
  fence(yard, addCollider, Y.maxX, Y.minZ, Y.maxX, gate0); // east, either side of the gate
  fence(yard, addCollider, Y.maxX, gate1, Y.maxX, Y.maxZ);
  for (const z of [gate0, gate1]) piece(yard, box, postMat, [Y.maxX, 0.5, z], [0.18, 1, 0.18]); // taller gateposts

  // The coop: a little red henhouse up on stilts, a gabled roof, a door with a ramp
  const coop = new THREE.Group();
  coop.name = 'coop';
  coop.position.set(COOP.x, 0, COOP.z);
  yard.add(coop);
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
  const nest = piece(yard, new THREE.TorusGeometry(0.22, 0.09, 6, 14), strawMat, [NEST.x, 0.06, NEST.z], [1, 1, 0.6], [Math.PI / 2, 0, 0]);
  nest.receiveShadow = true;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    piece(yard, box, strawMat, [NEST.x + Math.cos(a) * 0.4, 0.015, NEST.z + Math.sin(a) * 0.35], [0.18, 0.02, 0.03], [0, a * 1.7, 0]);
  }

  // A trough of grain and a water dish
  piece(yard, box, postMat, [TROUGH.x, 0.15, TROUGH.z], [0.9, 0.3, 0.35]);
  piece(yard, box, grainMat, [TROUGH.x, 0.29, TROUGH.z], [0.8, 0.04, 0.26]);
  piece(yard, new THREE.CylinderGeometry(0.22, 0.18, 0.12, 12), trimMat, [TROUGH.x - 0.95, 0.06, TROUGH.z + 0.1], [1, 1, 1]);
  piece(yard, new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), waterMat, [TROUGH.x - 0.95, 0.11, TROUGH.z + 0.1], [1, 1, 1]);
  addCollider({ x: TROUGH.x - 0.3, y: 0.15, z: TROUGH.z, w: 1.6, h: 0.3, d: 0.5 });
}

// ---------- A hen ----------
// Built from primitives like the farmer (character.js), facing +Z, with her
// origin at her feet. Feathers come in a few colors; the rest is shared.
export const HEN_COLORS = [0xf6f1e4, 0xa45a2a, 0xd9a24a, 0x3d3735];
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
const featherMats = HEN_COLORS.map((c) => mat(c));
const combMat = mat(0xe0362c, { roughness: 0.6 });
const beakMat = mat(0xf2a516, { roughness: 0.6 });
const legMat = mat(0xe8962a, { roughness: 0.6 });
const eyeMat = mat(0x111111, { roughness: 0.3 });
const ballGeo = new THREE.SphereGeometry(1, 12, 9);
const beakGeo = new THREE.ConeGeometry(0.035, 0.08, 5);
const legGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 4);
const footGeo = new THREE.BoxGeometry(0.06, 0.012, 0.08);
const tailGeo = new THREE.ConeGeometry(0.1, 0.22, 6);
const HEN_SCALE = 1.5;

function ball(parent, material, [x, y, z], [sx, sy, sz]) {
  return piece(parent, ballGeo, material, [x, y, z], [sx, sy, sz]);
}

function createHenModel(colorIndex) {
  const feathers = featherMats[colorIndex] ?? featherMats[0];
  const root = new THREE.Group();
  const rig = new THREE.Group(); // scaled for squash & stretch from the feet
  rig.scale.setScalar(HEN_SCALE);
  root.add(rig);

  const legs = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.065, 0.15, 0.02);
    rig.add(pivot);
    piece(pivot, legGeo, legMat, [0, -0.07, 0], [1, 1, 1]);
    piece(pivot, footGeo, legMat, [0, -0.14, 0.02], [1, 1, 1]);
    return pivot;
  });

  const body = new THREE.Group();
  body.position.y = 0.27;
  rig.add(body);
  ball(body, feathers, [0, 0, 0], [0.17, 0.15, 0.21]);
  const tail = piece(body, tailGeo, feathers, [0, 0.1, -0.17], [1, 1, 0.5], [-0.7, 0, 0]);
  tail.castShadow = true;
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
  const beak = piece(head, beakGeo, beakMat, [0, 0.075, 0.1], [1, 1, 1], [Math.PI / 2, 0, 0]);
  beak.castShadow = false;
  ball(head, combMat, [0, 0.025, 0.08], [0.018, 0.03, 0.018]); // wattle
  for (const sx of [-1, 1]) ball(head, eyeMat, [sx * 0.065, 0.1, 0.05], [0.014, 0.016, 0.014]);

  return { root, rig, body, head, legs, wings };
}

// ---------- Hearts, for a petted hen ----------
const heartMat = new THREE.SpriteMaterial({ map: heartTexture(), depthWrite: false });
function heartTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
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
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Eggs ----------
const eggGeo = new THREE.SphereGeometry(1, 10, 8);
const eggMat = mat(0xf3e3c3, { roughness: 0.5 });

// ---------- The flock ----------
// main.js adds `root` to the farm, calls update() each frame at home, and
// saves capture() with the farm (restore() puts it back).
export function createHens() {
  const root = new THREE.Group();
  const hens = [];
  const eggs = []; // { mesh, x, z, wobble }
  const hearts = []; // { sprite, age }

  function addHen({ color = 0, x, z, nextEgg, asleep = false }) {
    const model = createHenModel(color);
    const hen = {
      ...model,
      color,
      pos: new THREE.Vector3(x, 0, z),
      yaw: rand(-Math.PI, Math.PI),
      state: asleep ? 'asleep' : 'idle',
      timer: rand(0.5, 2),
      target: null,
      nextEgg,
      walkPhase: rand(0, 10),
      walkAmount: 0,
      peck: 0, // 0..1 through a peck
      flap: 0, // how hard the wings are going, eases off
      squash: 0,
      look: 0, // head turned this much
      lookTarget: 0,
      wakeAt: 0,
    };
    model.root.visible = !asleep;
    root.add(model.root);
    hens.push(hen);
    place(hen);
    return hen;
  }

  function place(hen) {
    hen.root.position.copy(hen.pos);
    hen.root.rotation.y = hen.yaw;
  }

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

  function lay(hen, hours) {
    while (hen.nextEgg <= hours) {
      // a very long time away: only the last few days' eggs matter
      if (hours - hen.nextEgg > 24 * EGGS_PER_HEN) hen.nextEgg += 24 * Math.floor((hours - hen.nextEgg) / 24 - EGGS_PER_HEN);
      const roomForMore = eggs.length < hens.length * EGGS_PER_HEN;
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

  function walkTo(hen, target, state = 'walk') {
    hen.target = target;
    hen.state = state;
  }

  // Step toward hen.target; true once there
  function stepToward(hen, speed, dt) {
    const dx = hen.target.x - hen.pos.x;
    const dz = hen.target.z - hen.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const step = Math.min(d, speed * dt);
    hen.pos.x += (dx / d) * step;
    hen.pos.z += (dz / d) * step;
    let diff = Math.atan2(dx, dz) - hen.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    hen.yaw += diff * damp(10, dt);
    return false;
  }

  // What a hen does next when she's done with the last thing
  function decide(hen) {
    const r = Math.random();
    if (r < 0.45) walkTo(hen, randomRoamSpot());
    else if (r < 0.85) {
      hen.state = 'peck';
      hen.timer = rand(1.2, 3);
    } else {
      hen.state = 'idle';
      hen.timer = rand(1, 3);
      hen.lookTarget = rand(-0.8, 0.8);
    }
  }

  function think(hen, dt, hours, player) {
    const roostTime = isRoostTime(hours);
    if (hen.state === 'asleep') {
      if (roostTime) {
        hen.wakeAt = 0;
        return;
      }
      // out again in the morning, one after another
      if (!hen.wakeAt) hen.wakeAt = performance.now() + rand(0, 6000);
      if (performance.now() < hen.wakeAt) return;
      hen.wakeAt = 0;
      hen.pos.set(COOP.x, COOP.floor, COOP_FRONT - 0.1);
      hen.yaw = 0;
      hen.root.visible = true;
      walkTo(hen, { x: DOOR.x + rand(-0.2, 0.2), z: DOOR.z + 0.4 }, 'emerge');
      return;
    }
    if (roostTime && hen.state !== 'roost' && hen.state !== 'toDoor') {
      walkTo(hen, { x: DOOR.x, z: DOOR.z }, 'toDoor');
    }

    const toPlayer = Math.hypot(player.pos.x - hen.pos.x, player.pos.z - hen.pos.z);
    const calm = hen.state === 'petted' || hen.state === 'toDoor' || hen.state === 'roost' || hen.state === 'emerge';
    if (!calm && player.moving && player.onGround && toPlayer < STARTLE) {
      // off she goes, flapping, away from the farmer
      const away = Math.atan2(hen.pos.x - player.pos.x, hen.pos.z - player.pos.z) + rand(-0.5, 0.5);
      walkTo(hen, clampRoam({ x: hen.pos.x + Math.sin(away) * 1.8, z: hen.pos.z + Math.cos(away) * 1.8 }), 'scurry');
      hen.flap = 1;
    }

    switch (hen.state) {
      case 'walk':
        if (stepToward(hen, WALK_SPEED, dt)) decide(hen);
        break;
      case 'scurry':
        if (stepToward(hen, SCURRY_SPEED, dt)) {
          hen.state = 'idle';
          hen.timer = rand(0.6, 1.5);
        }
        break;
      case 'emerge': // down the ramp
        if (stepToward(hen, WALK_SPEED, dt)) decide(hen);
        break;
      case 'toDoor':
        if (stepToward(hen, WALK_SPEED * 1.3, dt)) walkTo(hen, { x: COOP.x, z: COOP_FRONT - 0.1 }, 'roost');
        break;
      case 'roost': // up the ramp and in
        if (stepToward(hen, WALK_SPEED, dt)) {
          hen.state = 'asleep';
          hen.root.visible = false;
        }
        break;
      case 'peck':
      case 'idle':
      case 'petted':
        if ((hen.timer -= dt) <= 0) decide(hen);
        break;
    }
    // on the ramp, she climbs it
    const onRamp = hen.state === 'emerge' || hen.state === 'roost' || hen.state === 'toDoor';
    hen.pos.y = onRamp ? COOP.floor * THREE.MathUtils.clamp((RAMP_END - hen.pos.z) / (RAMP_END - COOP_FRONT), 0, 1) : 0;
    if (!onRamp) clampRoam(hen.pos);
  }

  // Hens keep a little room between them
  function spread() {
    for (let i = 0; i < hens.length; i++) {
      const a = hens[i];
      if (!a.root.visible) continue;
      for (let j = i + 1; j < hens.length; j++) {
        const b = hens[j];
        if (!b.root.visible) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.55 || d === 0) continue;
        const push = (0.55 - d) / 2 / d;
        a.pos.x -= dx * push;
        a.pos.z -= dz * push;
        b.pos.x += dx * push;
        b.pos.z += dz * push;
      }
    }
  }

  function animate(hen, dt, t) {
    const moving = ['walk', 'scurry', 'emerge', 'toDoor', 'roost'].includes(hen.state);
    hen.walkAmount += ((moving ? 1 : 0) - hen.walkAmount) * damp(10, dt);
    if (moving) hen.walkPhase += dt * (hen.state === 'scurry' ? 26 : 14);
    const step = Math.sin(hen.walkPhase) * hen.walkAmount;
    hen.legs[0].rotation.x = step * 0.7;
    hen.legs[1].rotation.x = -step * 0.7;
    hen.body.position.y = 0.27 + Math.abs(step) * 0.02;

    // the head: bobbing to and fro on the walk, down to peck, looking about when idle
    if (hen.state === 'peck') hen.peck = (hen.peck + dt * 2.2) % 1;
    else hen.peck = Math.max(0, hen.peck - dt * 4);
    const peckDip = hen.state === 'peck' ? Math.max(0, Math.sin(hen.peck * Math.PI * 2)) ** 2 : 0;
    hen.head.position.z = 0.15 + Math.sin(hen.walkPhase * 2) * 0.03 * hen.walkAmount + peckDip * 0.06;
    hen.head.rotation.x = peckDip * 1.3;
    hen.body.rotation.x = peckDip * 0.35 + hen.walkAmount * 0.08;
    if (hen.state !== 'idle') hen.lookTarget = 0;
    else if (Math.random() < dt * 0.7) hen.lookTarget = rand(-0.9, 0.9);
    hen.look += (hen.lookTarget - hen.look) * damp(hen.state === 'idle' ? 12 : 6, dt);
    hen.head.rotation.y = hen.look;

    // wings flap when she's startled (or pleased), then fold
    hen.flap += (0 - hen.flap) * damp(2.5, dt);
    const flap = hen.flap * (0.5 + Math.sin(t * 38) * 0.5) * 1.1;
    hen.wings[0].rotation.z = -flap;
    hen.wings[1].rotation.z = flap;

    hen.squash += (0 - hen.squash) * damp(8, dt);
    const breathe = Math.sin(t * 3 + hen.walkPhase) * 0.015;
    hen.rig.scale.set(HEN_SCALE * (1 + hen.squash * 0.4), HEN_SCALE * (1 - hen.squash + breathe), HEN_SCALE * (1 + hen.squash * 0.4));
    place(hen);
  }

  // player: { pos, moving, onGround }. collect(): an egg into the backpack, false if it's full
  function update(dt, t, { hours, player, collect }) {
    for (const hen of hens) {
      think(hen, dt, hours, player);
      lay(hen, hours);
    }
    spread();
    for (const hen of hens) animate(hen, dt, t);

    for (let i = eggs.length - 1; i >= 0; i--) {
      const egg = eggs[i];
      egg.wobble = Math.max(0, egg.wobble - dt * 0.7);
      egg.mesh.rotation.x = Math.sin(t * 14) * 0.25 * egg.wobble;
      const near = Math.hypot(player.pos.x - egg.x, player.pos.z - egg.z) < EGG_REACH && player.pos.y < 1.6;
      if (near && collect?.()) {
        root.remove(egg.mesh);
        eggs.splice(i, 1);
      }
    }

    for (let i = hearts.length - 1; i >= 0; i--) {
      const heart = hearts[i];
      heart.age += dt;
      heart.sprite.position.y += dt * 0.7;
      heart.sprite.material.opacity = 1 - heart.age ** 2;
      if (heart.age >= 1) {
        root.remove(heart.sprite);
        heart.sprite.material.dispose();
        hearts.splice(i, 1);
      }
    }
  }

  const canPet = (hen, pos) =>
    hen.root.visible && hen.state !== 'roost' && Math.hypot(pos.x - hen.pos.x, pos.z - hen.pos.z) < PET_REACH && pos.y < 2;

  // the hen within reach to pet, nearest first
  function inReach(pos) {
    let best = null;
    let bestD = Infinity;
    for (const hen of hens) {
      const d = Math.hypot(pos.x - hen.pos.x, pos.z - hen.pos.z);
      if (canPet(hen, pos) && d < bestD) {
        best = hen;
        bestD = d;
      }
    }
    return best;
  }

  // She stops, turns to look up at you, and is pleased
  function pet(hen, from) {
    if (hen.state === 'toDoor') return; // (off to bed: no time for that)
    hen.state = 'petted';
    hen.timer = 1.8;
    hen.target = null;
    hen.yaw = Math.atan2(from.x - hen.pos.x, from.z - hen.pos.z);
    hen.squash = 0.3;
    hen.flap = 0.5;
    const sprite = new THREE.Sprite(heartMat.clone());
    sprite.scale.setScalar(0.35);
    sprite.position.set(hen.pos.x, 1.1, hen.pos.z);
    root.add(sprite);
    hearts.push({ sprite, age: 0 });
  }

  // A new hen from the backpack, out in the yard (false: the coop is full)
  function letOut(x, z, hours) {
    if (hens.length >= MAX_HENS) return false;
    const spot = clampRoam({ x, z });
    const hen = addHen({ color: hens.length % HEN_COLORS.length, x: spot.x, z: spot.z, nextEgg: nextLay(hours) });
    hen.squash = -0.3; // a hop out of the basket
    hen.flap = 1;
    return true;
  }

  function clear() {
    for (const hen of hens) root.remove(hen.root); // (their geometry and materials are shared)
    for (const egg of eggs) root.remove(egg.mesh);
    for (const heart of hearts) {
      root.remove(heart.sprite);
      heart.sprite.material.dispose();
    }
    hens.length = eggs.length = hearts.length = 0;
  }

  const r2 = (v) => Math.round(v * 100) / 100;

  return {
    root,
    update,
    inReach,
    canPet,
    pet,
    letOut,
    clear,
    list: () => hens,
    // For the save: hens as [color, x, z, nextEgg (game hours)], eggs as [x, z]
    capture() {
      return {
        hens: hens.map((h) => [h.color, r2(h.state === 'asleep' ? DOOR.x : h.pos.x), r2(h.state === 'asleep' ? DOOR.z + 0.4 : h.pos.z), r2(h.nextEgg)]),
        eggs: eggs.map((e) => [r2(e.x), r2(e.z)]),
      };
    },
    // saved: from capture(), or null for a farm saved before it had hens (it
    // gets the two that come with a farm). hours: the farm's clock now.
    restore(saved, hours) {
      clear();
      const asleep = isRoostTime(hours);
      const list = saved?.hens ?? [[0, YARD.x - 1, YARD.z + 1, nextLay(hours)], [1, YARD.x + 1.5, YARD.z + 1.8, nextLay(hours)]];
      for (const [color, x, z, nextEgg] of list.slice(0, MAX_HENS)) {
        if (![x, z, nextEgg].every(Number.isFinite)) continue;
        const spot = clampRoam({ x, z });
        addHen({ color: HEN_COLORS[color] ? color : 0, x: spot.x, z: spot.z, nextEgg, asleep });
      }
      for (const [x, z] of (saved?.eggs ?? []).slice(0, hens.length * EGGS_PER_HEN)) {
        if (Number.isFinite(x) && Number.isFinite(z)) addEgg(x, z);
      }
    },
  };
}
