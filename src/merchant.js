import * as THREE from 'three';
import { ITEMS } from './items.js';
import { createFarmer, damp } from './character.js';
import { foliageMat } from './world.js';

// ---------- The merchant's stall ----------
// A market stall on the home farm, just east of the plaza: a counter with
// baskets of produce and seed packets, a striped awning, a sign and a lantern.
// The merchant stands behind the counter, turns to watch you come over and
// gives a little hop when you step up to trade (E opens the shop, shop.js).
//
// The stall is one of the farm's set pieces (maps.js builds it with the
// island); the merchant is added by main.js, since they look at the player.
// Everything faces +Z, toward the camera, so you trade from the south side.

export const STALL = { x: 5.5, z: 6.5 };
const COUNTER = { w: 3, h: 1, d: 0.8, z: 0.3 }; // local to the stall
const FRONT = COUNTER.z + COUNTER.d / 2; // the counter's front face
export const TRADE_SPOT = { x: STALL.x, z: STALL.z + FRONT + 0.8 }; // where a customer stands
const TRADE_REACH = 1.9;
const WATCH_RANGE = 7; // the merchant turns to look at you inside this

const woodMat = foliageMat(0xa0682f);
const darkWoodMat = foliageMat(0x7a4a22);
const topMat = foliageMat(0xc48a4a);
const clothMats = [foliageMat(0xfff4e0), foliageMat(0xd8452f)];
const basketMat = foliageMat(0xc9a066);
const signMat = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.9 });
const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa630, emissiveIntensity: 1.2 });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
const turnipMat = foliageMat(0xf2eef5);
const carrotMat = foliageMat(0xff8c1a);
const sunflowerMat = foliageMat(0xffd23f);
const berryMat = foliageMat(0xd8344f);

const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(1, 1);
const cone = new THREE.ConeGeometry(1, 1, 6);

function signTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4dcae';
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = '#5b3a1e';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 72);
  ctx.fillStyle = '#5b2b0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'Seeds & Trade';
  let size = 40;
  do ctx.font = `bold ${size--}px "Trebuchet MS", system-ui, sans-serif`;
  while (ctx.measureText(text).width > 220);
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

// A wicker basket on the counter heaped with something
function basket(parent, x, z, fill) {
  const g = new THREE.Group();
  g.position.set(x, COUNTER.h + 0.06, z);
  parent.add(g);
  piece(g, box, basketMat, [0, 0.08, 0], [0.5, 0.16, 0.36]);
  fill(g);
}

// ctx: from world.js's buildWorld (the farm's set pieces)
export function buildStall({ root, addCollider }) {
  const stall = new THREE.Group();
  stall.name = 'stall'; // (tapping it walks you over to trade, see main.js)
  stall.position.set(STALL.x, 0, STALL.z);
  root.add(stall);

  // The counter: planks down the front, a lighter top
  const { w, h, d, z } = COUNTER;
  piece(stall, box, woodMat, [0, h / 2, z], [w, h, d]);
  piece(stall, box, topMat, [0, h + 0.03, z + 0.02], [w + 0.12, 0.06, d + 0.12]);
  for (let i = -3; i <= 3; i++) {
    piece(stall, box, darkWoodMat, [i * 0.42, h / 2, FRONT + 0.005], [0.04, h - 0.1, 0.02]);
  }

  // Posts: shorter at the front, so the awning slopes toward you. High
  // enough that the camera, looking down at 45°, sees the merchant's face
  // under the awning's front edge.
  const BACK = -1.05;
  const FRONT_H = 2.95;
  const BACK_H = 3.25;
  const OVERHANG = 0.1;
  for (const sx of [-1, 1]) {
    piece(stall, box, darkWoodMat, [sx * 1.45, FRONT_H / 2, FRONT - 0.06], [0.12, FRONT_H, 0.12]);
    piece(stall, box, darkWoodMat, [sx * 1.45, BACK_H / 2, BACK], [0.12, BACK_H, 0.12]);
  }

  // The striped awning, and a scalloped edge hanging off its front
  const span = FRONT + OVERHANG - BACK;
  const tilt = Math.atan2(BACK_H - FRONT_H, span);
  const awning = new THREE.Group();
  awning.position.set(0, (FRONT_H + BACK_H) / 2 + 0.06, (FRONT + OVERHANG + BACK) / 2);
  awning.rotation.x = tilt;
  stall.add(awning);
  const STRIPES = 6;
  const stripeW = 3.4 / STRIPES;
  const length = Math.hypot(span, BACK_H - FRONT_H);
  for (let i = 0; i < STRIPES; i++) {
    const x = -1.7 + stripeW * (i + 0.5);
    piece(awning, box, clothMats[i % 2], [x, 0, 0], [stripeW, 0.06, length]);
    piece(awning, cone, clothMats[i % 2], [x, -0.1, length / 2], [stripeW / 2, 0.16, 0.05], [Math.PI, 0, 0]);
  }

  // The sign over the awning, tipped back toward the camera
  const sign = piece(stall, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, signMat, darkWoodMat],
    [0, BACK_H + 0.42, BACK + 0.25], [1.7, 0.53, 0.06], [-0.35, 0, 0]);
  sign.castShadow = false;
  for (const sx of [-0.6, 0.6]) piece(stall, box, darkWoodMat, [sx, BACK_H + 0.1, BACK + 0.15], [0.05, 0.4, 0.05]);

  // A lantern hanging off the front right post, warm at night
  piece(stall, box, ironMat, [1.45, FRONT_H - 0.05, FRONT + 0.12], [0.04, 0.04, 0.32]);
  piece(stall, box, ironMat, [1.45, FRONT_H - 0.2, FRONT + 0.26], [0.02, 0.25, 0.02]);
  const lantern = piece(stall, ball, lanternMat, [1.45, FRONT_H - 0.42, FRONT + 0.26], [0.11, 0.14, 0.11]);
  lantern.castShadow = false;
  piece(stall, cone, ironMat, [1.45, FRONT_H - 0.26, FRONT + 0.26], [0.1, 0.08, 0.1]);

  // On the counter: turnips, carrots, sunflower heads, berries, and a row of seed packets
  basket(stall, -1.05, z - 0.1, (g) => {
    for (const [x, zz] of [[-0.12, -0.06], [0.12, -0.05], [0, 0.08], [-0.1, 0.1], [0.13, 0.1]]) {
      piece(g, ball, turnipMat, [x, 0.2, zz], [0.09, 0.08, 0.09]);
    }
  });
  basket(stall, -0.45, z - 0.1, (g) => {
    for (let i = 0; i < 5; i++) {
      piece(g, cone, carrotMat, [-0.16 + i * 0.08, 0.2, (i % 2) * 0.08 - 0.04], [0.04, 0.24, 0.04], [Math.PI / 2, 0, 0.3 - i * 0.15]);
    }
  });
  basket(stall, 0.95, z - 0.12, (g) => {
    for (const [x, zz] of [[-0.1, 0], [0.12, 0.02]]) {
      piece(g, box, sunflowerMat, [x, 0.21, zz], [0.17, 0.05, 0.17], [-0.4, 0.3, 0]);
    }
    for (let i = 0; i < 6; i++) piece(g, ball, berryMat, [-0.15 + i * 0.06, 0.18, 0.12], [0.035, 0.035, 0.035]);
  });
  const packets = ['turnip_seeds', 'carrot_seeds', 'flax_seeds', 'sunflower_seeds'];
  packets.forEach((id, i) => {
    const color = foliageMat(ITEMS[id].color);
    piece(stall, box, color, [0.05 + (i - 1.5) * 0.17, h + 0.14, z + 0.24], [0.13, 0.18, 0.02], [-0.5, 0, 0]);
  });

  // Crates behind the counter, to either side of the merchant
  piece(stall, box, woodMat, [-1.05, 0.25, -0.65], [0.5, 0.5, 0.5]);
  piece(stall, box, woodMat, [1.05, 0.22, -0.7], [0.45, 0.44, 0.45], [0, 0.3, 0]);
  piece(stall, box, darkWoodMat, [1.05, 0.55, -0.7], [0.3, 0.22, 0.3], [0, 0.6, 0]);

  // Solid all the way up to the awning: you can't walk behind or hop onto the counter
  const depth = FRONT - (BACK - 0.06);
  addCollider({ x: STALL.x, y: FRONT_H / 2, z: STALL.z + FRONT - depth / 2, w: 3.1, h: FRONT_H, d: depth });
}

// The merchant behind the counter. update() needs the player, so main.js
// drives it each frame while you're home.
export function createMerchant() {
  const merchant = createFarmer({ shirt: 0x7b4fa0, overalls: 0x3f6b3a, hat: 0x6b4a2b, band: 0xd4a017, mustache: true });
  merchant.hoe.visible = false;
  merchant.root.position.set(STALL.x, 0.8, STALL.z - 0.3); // close behind the counter
  let greeted = false; // hopped hello since you came close

  function update(dt, time, playerPos) {
    const dx = playerPos.x - merchant.root.position.x;
    const dz = playerPos.z - merchant.root.position.z;
    const near = Math.hypot(dx, dz) < WATCH_RANGE;
    // Watch you, within reason (never turning their back on the counter)
    const yaw = near ? THREE.MathUtils.clamp(Math.atan2(dx, dz), -1, 1) : 0;
    merchant.anim.facing += (yaw - merchant.anim.facing) * damp(4, dt);
    if (inReach(playerPos) && !greeted) {
      greeted = true;
      merchant.anim.squash = -0.25; // a little hop hello
    } else if (!near) {
      greeted = false;
    }
    merchant.animate(dt, { moving: false, onGround: true, targetYaw: 0, time });
  }

  return { root: merchant.root, update };
}

// Close enough to trade: standing at the counter
export function inReach(pos) {
  return Math.hypot(pos.x - TRADE_SPOT.x, pos.z - TRADE_SPOT.z) < TRADE_REACH;
}
