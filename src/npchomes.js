import * as THREE from 'three';
import { NPC_HOMES, NPC_ROOMS, DOCK, SIGNPOSTS } from '../shared/farmland.js';
import { NPCS } from '../shared/npcs.js';
import { animalModel } from './animals.js';

// ---------- The neighbours' homes ----------
// Each neighbour (shared/npcs.js) lives in a home of their own out in the
// farm's valley (NPC_HOMES in shared/farmland.js), drawn here as one of the
// farm's set pieces (src/maps.js): Rosa's red ranch house with its paddock of
// animals, Basil's whitewashed cottage with its greenhouse and vegetable
// beds, Finn's fishing hut on the dunes with his dock out over the sea, and
// Mabel's timbered bakery with smoke from its chimney. Each faces south, a
// sign by the road, its door in the middle of its front.
//
// Inside each is a room of its own (NPC_ROOMS), out past the sea on the
// farm's world, where nothing else is, as the farmer's own house's room is
// (src/house.js): a counter across it with their wares on shelves behind,
// a bed in the corner, a table, a rug, and a low front wall so the camera
// sees in. src/npcs.js puts the neighbours in and out of them.
//
// What main.js and src/npcs.js need of them (the doors, the spots inside,
// the dock) is in `npcHomes`, from the farm's last build.

export const npcHomes = {
  outside: {}, // id -> the home's group on the farm (tapping it goes in)
  rooms: {}, // id -> { root, entry, exit, counter, customer, bed, table, door (its group) }
  dock: { mend() {} }, // Finn's dock: mend(true) puts its missing planks back
  setNight() {},
  animate() {},
};

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const cone = new THREE.ConeGeometry(1, 1, 8);

// A triangular prism along x, `w` long, its triangle `d` wide at the base
// and `h` high, standing on y = 0: the end of a gable roof
function prismGeo(w, h, d) {
  const [x0, x1, z0, z1] = [-w / 2, w / 2, -d / 2, d / 2];
  const v = [
    [x0, 0, z1], [x0, 0, z0], [x0, h, 0], // the end at x0
    [x1, 0, z0], [x1, 0, z1], [x1, h, 0], // the end at x1
    [x0, 0, z1], [x1, 0, z1], [x1, h, 0], [x0, 0, z1], [x1, h, 0], [x0, h, 0], // the front slope
    [x1, 0, z0], [x0, 0, z0], [x0, h, 0], [x1, 0, z0], [x0, h, 0], [x1, h, 0], // the back slope
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

function part(parent, geo, material, [x, y, z], [sx, sy, sz] = [1, 1, 1], rot) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A board with words on it, as the merchant's stall has (src/merchant.js)
function signTexture(text, { paper = '#f4dcae', ink = '#5b2b0a', edge = '#5b3a1e' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 72);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 40;
  do ctx.font = `bold ${size--}px "Trebuchet MS", system-ui, sans-serif`;
  while (ctx.measureText(text).width > 220);
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const woodMat = mat(0xa0682f);
const darkWoodMat = mat(0x6e4a2b);
const stoneMat = mat(0x9c9a92);
const ironMat = mat(0x3a3a3a, { roughness: 0.5, metalness: 0.5 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
const hayMat = mat(0xd9b24a);
const soilMat = mat(0x5b3a1e);
const leafMat = mat(0x4f9e3c);
const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffe7a3, emissive: 0xffb84a, emissiveIntensity: 0 });
// windows: pale by day, warm at night (setNight)
const windowMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0xffb84a, emissiveIntensity: 0, roughness: 0.3 });

// ---------- A house ----------
// Walls w by d, wallH high; a gable roof, its ridge along x (across the
// front) or z (its gable to the front), rise high; a door in the middle of
// the front and a window either side. `base`: a band of another color round
// its foot. Solid all round.
function house(g, home, { wallH = 2.4, rise = 1.6, ridge = 'x', wall, trim, roof, door, base = null, thick = 0.14, overhang = 0.35 }, addCollider) {
  const { w, d } = home;
  const wallMat = mat(wall);
  const trimMat = mat(trim);
  const roofMat = mat(roof);
  part(g, box, wallMat, [0, wallH / 2, 0], [w, wallH, d]);
  if (base) part(g, box, mat(base), [0, 0.3, 0], [w + 0.06, 0.6, d + 0.06]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, box, trimMat, [sx * (w / 2), wallH / 2, sz * (d / 2)], [0.16, wallH, 0.16]);
  part(g, box, trimMat, [0, wallH - 0.06, d / 2 + 0.02], [w + 0.1, 0.14, 0.06]);
  // the roof: the gable ends in the walls' color, the two slopes over them
  const roofG = new THREE.Group();
  roofG.position.y = wallH;
  if (ridge === 'z') roofG.rotation.y = Math.PI / 2;
  g.add(roofG);
  const [len, span] = ridge === 'z' ? [d, w] : [w, d];
  part(roofG, prismGeo(len, rise, span), wallMat, [0, 0, 0]);
  const slope = Math.atan2(rise, span / 2);
  const run = (span / 2 + overhang) / Math.cos(slope);
  for (const s of [-1, 1]) {
    part(roofG, box, roofMat, [0, rise - Math.sin(slope) * run / 2 + thick / 2, s * Math.cos(slope) * run / 2], [len + overhang * 2, thick, run], [s * slope, 0, 0]);
  }
  part(roofG, box, roofMat, [0, rise + thick * 0.6, 0], [len + overhang * 2 + 0.04, thick * 1.2, thick * 2.2]); // the ridge
  // the door, and a window either side of it
  const front = d / 2 + 0.03;
  part(g, box, trimMat, [0, 1.0, front], [1.2, 2.0, 0.06]);
  part(g, box, mat(door), [0, 0.95, front + 0.03], [0.96, 1.86, 0.06]);
  part(g, ball, ironMat, [0.32, 0.95, front + 0.08], [0.05, 0.05, 0.05]);
  part(g, box, stoneMat, [0, 0.06, front + 0.45], [1.4, 0.12, 0.7]); // a step
  const winX = Math.min(w / 2 - 0.9, 1.7);
  for (const sx of [-1, 1]) addWindow(g, sx * winX, 1.45, front, trimMat);
  addCollider({ x: home.x, y: (wallH + rise) / 2, z: home.z, w: w + 0.2, h: wallH + rise, d: d + 0.2 });
  return { wallMat, trimMat, roofMat, roofTop: wallH + rise };
}

function addWindow(parent, x, y, z, trimMat, w = 0.9, h = 0.8) {
  part(parent, box, trimMat, [x, y, z], [w + 0.14, h + 0.14, 0.06]);
  part(parent, box, windowMat, [x, y, z + 0.03], [w, h, 0.04]).castShadow = false;
  part(parent, box, trimMat, [x, y, z + 0.06], [0.06, h, 0.03]);
  part(parent, box, trimMat, [x, y, z + 0.06], [w, 0.06, 0.03]);
}

// A sign on two posts, with the home's name on it, beside the road
function roadSign(g, text, x, z, colors) {
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture(text, colors), roughness: 0.9 });
  for (const sx of [-0.7, 0.7]) part(g, box, darkWoodMat, [x + sx, 0.75, z], [0.1, 1.5, 0.1]);
  const board = part(g, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, signMat, darkWoodMat], [x, 1.35, z + 0.06], [1.7, 0.53, 0.06], [-0.25, 0, 0]);
  board.castShadow = false;
}

// A run of fence from (x0, z0) to (x1, z1) (local to g, at home.x, home.z): posts and two rails, solid
function fence(g, home, addCollider, x0, z0, x1, z1, material = woodMat) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    part(g, box, material, [x0 + (x1 - x0) * k, 0.45, z0 + (z1 - z0) * k], [0.12, 0.9, 0.12]);
  }
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  for (const y of [0.35, 0.7]) part(g, box, material, [cx, y, cz], along ? [len, 0.08, 0.06] : [0.06, 0.08, len]);
  addCollider({ x: home.x + cx, y: 0.5, z: home.z + cz, w: along ? len : 0.2, h: 1, d: along ? 0.2 : len });
}

// ---------- Each of them ----------
// Rosa: a red ranch house, its gable to the front with a hayloft door in it,
// and a paddock beside it with a cow, sheep and hens grazing
function rosaHome(g, home, addCollider, anims) {
  const { trimMat } = house(g, home, { ridge: 'z', wall: 0xa8392f, trim: 0xf2efe6, roof: 0x4a3b36, door: 0x7a2a1a, rise: 1.8 }, addCollider);
  // the hayloft door up in the gable, crossed with white
  const z = home.d / 2 + 0.05;
  part(g, box, mat(0x7a2a1a), [0, 3.1, z], [0.8, 0.7, 0.04]);
  for (const r of [0.72, -0.72]) part(g, box, trimMat, [0, 3.1, z + 0.03], [0.06, 1.0, 0.03], [0, 0, r]);
  // the paddock, west of the house
  const [x0, x1, z0, z1] = [-8.6, -4.6, -2.6, 3.4];
  fence(g, home, addCollider, x0, z0, x1, z0);
  fence(g, home, addCollider, x0, z1, x1, z1);
  fence(g, home, addCollider, x0, z0, x0, z1);
  fence(g, home, addCollider, x1, z0, x1, z1);
  part(g, cyl, hayMat, [x1 - 0.6, 0.3, z0 + 0.6], [0.45, 0.6, 0.45], [Math.PI / 2, 0, 0]);
  part(g, box, woodMat, [x0 + 0.5, 0.25, z1 - 0.9], [0.6, 0.4, 1.4]); // a trough
  part(g, box, mat(0x6fb6d8, { roughness: 0.2 }), [x0 + 0.5, 0.43, z1 - 0.9], [0.5, 0.04, 1.3]).castShadow = false;
  const herd = [['cow', 0, -6.6, 1.2, 0.6], ['sheep', 0, -5.6, -1.2, -0.8], ['sheep', 1, -7.6, -0.6, 2.2], ['hen', 1, -5.4, 2.4, 3], ['hen', 2, -6.2, 2.7, -2]];
  for (const [kind, color, x, zz, yaw] of herd) {
    const a = animalModel(kind, color);
    a.root.position.set(x, 0, zz);
    a.root.rotation.y = yaw;
    g.add(a.root);
    const state = { state: 'graze', graze: 0, step: 0, walkPhase: 0, walkAmount: 0, look: 0, flap: 0, growth: 1, seed: x };
    anims.push((t) => {
      state.graze = Math.max(0, Math.sin(t * 0.5 + x)) * (kind === 'hen' ? (t * 0.7 + x) % 1 : 1);
      state.look = Math.sin(t * 0.3 + zz) * 0.4;
      a.pose(state, t);
    });
  }
  // hay bales stacked by the house, and a cart
  for (const [x, y, zz] of [[3.4, 0.3, 2.6], [4.2, 0.3, 2.6], [3.8, 0.9, 2.6]]) part(g, box, hayMat, [x, y, zz], [0.75, 0.6, 0.5]);
  addCollider({ x: home.x + 3.8, y: 0.6, z: home.z + 2.6, w: 1.6, h: 1.2, d: 0.6 });
  roadSign(g, NPCS.rosa.title, 2.6, 5.2, { paper: '#fbe6c8', ink: '#7a2a1a' });
}

// Basil: a whitewashed cottage on a stone footing, thatched, with flower boxes
// under its windows, a greenhouse to the east and vegetable beds to the west
function basilHome(g, home, addCollider) {
  house(g, home, { wall: 0xeee6d6, trim: 0x8a6a4a, roof: 0xc9a45a, door: 0x3f6b3a, base: 0x9c9a92, rise: 1.7, thick: 0.32, overhang: 0.45 }, addCollider);
  const z = home.d / 2 + 0.18;
  const flowers = [0xe0362c, 0xf2c230, 0xff7eb6, 0xffffff];
  for (const sx of [-1, 1]) {
    part(g, box, darkWoodMat, [sx * 1.7, 0.92, z], [1, 0.2, 0.25]);
    for (let i = 0; i < 5; i++) part(g, ball, mat(flowers[(i + (sx > 0 ? 2 : 0)) % 4]), [sx * 1.7 - 0.4 + i * 0.2, 1.08, z], [0.08, 0.08, 0.08]);
  }
  // the greenhouse: a frame of white bars round glass, plants inside
  const gx = 6;
  const gz = -0.3;
  const [gw, gd, gh] = [3, 3.4, 2.2];
  const frameMat = mat(0xf4f4f0);
  part(g, box, glassMat, [gx, gh / 2, gz], [gw, gh, gd]).castShadow = false;
  part(g, prismGeo(gd, 0.9, gw), glassMat, [gx, gh, gz], [1, 1, 1], [0, Math.PI / 2, 0]).castShadow = false;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, box, frameMat, [gx + sx * gw / 2, gh / 2, gz + sz * gd / 2], [0.08, gh, 0.08]);
  for (const sz of [-1, 0, 1]) part(g, box, frameMat, [gx, gh, gz + sz * gd / 2], [gw, 0.08, 0.08]);
  part(g, box, frameMat, [gx, gh + 0.9, gz], [0.08, 0.08, gd]);
  for (let i = 0; i < 6; i++) {
    const px = gx - 0.9 + (i % 3) * 0.9;
    const pz = gz - 0.8 + Math.floor(i / 3) * 1.6;
    part(g, box, darkWoodMat, [px, 0.35, pz], [0.6, 0.7, 0.6]);
    part(g, ball, leafMat, [px, 0.9, pz], [0.32, 0.28, 0.32]);
    if (i % 2) part(g, ball, mat(0xe0362c), [px + 0.12, 0.98, pz + 0.12], [0.07, 0.07, 0.07]);
  }
  addCollider({ x: home.x + gx, y: 1.5, z: home.z + gz, w: gw + 0.1, h: 3, d: gd + 0.1 });
  // vegetable beds to the west, edged with planks
  for (const bz of [1.2, 3.2]) {
    part(g, box, woodMat, [-5, 0.09, bz], [2.8, 0.18, 1.4]);
    part(g, box, soilMat, [-5, 0.19, bz], [2.6, 0.04, 1.2]);
    for (let i = 0; i < 4; i++) part(g, ball, leafMat, [-6 + i * 0.66, 0.32, bz], [0.2, 0.16, 0.2]);
  }
  roadSign(g, NPCS.basil.title, -2.8, 5.2, { paper: '#e8f2d8', ink: '#2f5a2a' });
}

// Finn: a weathered blue fishing hut, its gable to the sea, a life ring on
// the wall, barrels and crates, an upturned boat on the sand, and his dock
function finnHome(g, home, addCollider) {
  house(g, home, { ridge: 'z', wall: 0x5f7f9a, trim: 0xe8e0d0, roof: 0x2f4f5a, door: 0x3a4a5a, rise: 1.4, wallH: 2.3 }, addCollider);
  // planks down the walls
  const plankMat = mat(0x4f6f8a);
  for (const x of [-2.6, -0.9, 0.9, 2.6]) part(g, box, plankMat, [x, 1.15, home.d / 2 + 0.005], [0.04, 2.2, 0.01]);
  // a life ring by the door
  const ring = part(g, new THREE.TorusGeometry(0.28, 0.08, 6, 16), mat(0xe8e8e0), [-1.75, 1.45, home.d / 2 + 0.1]);
  for (let i = 0; i < 4; i++) part(ring, box, mat(0xd8452f), [Math.cos((i * Math.PI) / 2) * 0.28, Math.sin((i * Math.PI) / 2) * 0.28, 0], [0.12, 0.12, 0.18], [0, 0, (i * Math.PI) / 2]);
  // barrels and crates by the side
  for (const [x, zz] of [[3.6, 1.2], [4.3, 0.6]]) part(g, cyl, woodMat, [x, 0.45, zz], [0.35, 0.9, 0.35]);
  part(g, box, woodMat, [3.8, 0.3, -0.8], [0.6, 0.6, 0.6], [0, 0.4, 0]);
  addCollider({ x: home.x + 3.95, y: 0.45, z: home.z + 0.4, w: 1.4, h: 0.9, d: 2.4 });
  // an upturned boat on the sand to the west
  part(g, new THREE.CylinderGeometry(0.7, 0.7, 3, 12, 1, false, 0, Math.PI), mat(0x8a5a32), [-4.4, 0.02, 1.6], [0.6, 1, 1], [0, Math.PI / 2, Math.PI / 2]);
  part(g, box, mat(0xd8452f), [-4.4, 0.44, 1.6], [0.16, 0.04, 3.02]);
  addCollider({ x: home.x - 4.4, y: 0.3, z: home.z + 1.6, w: 1.5, h: 0.6, d: 3 });
  // nets drying on two poles
  for (const nz of [-1.6, 0.6]) part(g, box, darkWoodMat, [-3.2, 0.9, nz], [0.08, 1.8, 0.08]);
  const net = part(g, new THREE.PlaneGeometry(2.2, 1.2, 8, 4), new THREE.MeshStandardMaterial({ color: 0x3a3a2a, wireframe: true }), [-3.2, 1.1, -0.5], [1, 1, 1], [0, Math.PI / 2, 0]);
  net.castShadow = false;
  roadSign(g, NPCS.finn.title, 3.2, 3.2, { paper: '#e8eef4', ink: '#2f4f7a' });
}

// Finn's dock: a deck of planks on posts from the front of his hut out over
// the sea. Before Finn has the wood to mend it (his first mission) the
// middle of it is gone, a rope across where it stops; mended, it runs all
// the way out, with a lantern at its end.
const DECK_Y = 0.3; // its top (a step up from the ground)
function buildDock(root, { addCollider, removeCollider }) {
  const g = new THREE.Group();
  g.name = 'dock';
  root.add(g);
  const plankMat = mat(0x9a7a52);
  const postMat = mat(0x6e5a42);
  const { x, z0, z1, w } = DOCK;
  const BROKEN_AT = z0 + 5; // the deck stops here, till it is mended
  const broken = new THREE.Group();
  const mended = new THREE.Group();
  g.add(broken, mended);
  const plank = (parent, z) => part(parent, box, plankMat, [x, DECK_Y - 0.06, z], [w, 0.12, 0.3]);
  for (let z = z0; z < z1; z += 0.34) {
    if (z < BROKEN_AT) plank(g, z);
    else {
      plank(mended, z);
      if (z > BROKEN_AT + 4 && z < BROKEN_AT + 6.5) plank(broken, z); // (a few still there, out past the gap)
    }
  }
  // posts down into the sand and the sea, every couple of steps
  for (let z = z0 + 0.3; z < z1; z += 2) {
    for (const s of [-1, 1]) {
      const post = part(g, cyl, postMat, [x + (s * w) / 2, -0.4, z], [0.1, 1.6 + DECK_Y, 0.1]);
      post.position.y = (DECK_Y - 1.3) / 2;
    }
  }
  // a rope across where the deck stops, and a little sign
  for (const s of [-1, 1]) part(broken, box, postMat, [x + s * (w / 2 - 0.1), DECK_Y + 0.45, BROKEN_AT - 0.2], [0.1, 0.9, 0.1]);
  part(broken, box, mat(0xd8c08a), [x, DECK_Y + 0.75, BROKEN_AT - 0.2], [w - 0.2, 0.05, 0.05]);
  const noteMat = new THREE.MeshStandardMaterial({ map: signTexture('Closed!', { paper: '#fff4e0', ink: '#a8392f' }), roughness: 0.9 });
  part(broken, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, noteMat, darkWoodMat], [x, DECK_Y + 0.6, BROKEN_AT - 0.17], [0.8, 0.26, 0.03]);
  addCollider({ x, y: DECK_Y - 0.25, z: (z0 + BROKEN_AT) / 2, w, h: 0.5, d: BROKEN_AT - z0 });
  const ropeStop = addCollider({ x, y: DECK_Y + 0.5, z: BROKEN_AT - 0.2, w, h: 1, d: 0.2 });
  // mended: a lantern at the end, and bollards to tie a boat to
  part(mended, box, postMat, [x + w / 2 - 0.15, DECK_Y + 0.9, z1 - 0.4], [0.12, 1.8, 0.12]);
  const lamp = part(mended, ball, lanternMat, [x + w / 2 - 0.15, DECK_Y + 1.7, z1 - 0.25], [0.13, 0.17, 0.13]);
  lamp.castShadow = false;
  for (const zz of [z1 - 3, z1 - 7]) part(mended, cyl, ironMat, [x - w / 2 + 0.25, DECK_Y + 0.15, zz], [0.12, 0.3, 0.12]);
  let rest = null; // the mended deck's collider, while it is mended
  function mend(on) {
    mended.visible = on;
    broken.visible = !on;
    if (on && !rest) {
      rest = addCollider({ x, y: DECK_Y - 0.25, z: (BROKEN_AT + z1) / 2, w, h: 0.5, d: z1 - BROKEN_AT });
      removeCollider(ropeStop);
    } else if (!on && rest) {
      removeCollider(rest);
      rest = null;
      addCollider({ x, y: DECK_Y + 0.5, z: BROKEN_AT - 0.2, w, h: 1, d: 0.2 });
    }
  }
  mend(false);
  return { mend, deckY: DECK_Y };
}

// Mabel: a cream bakery, timbered, with a terracotta roof, a striped awning
// over its windows, a bench, pots of flowers, and smoke from its chimney
function mabelHome(g, home, addCollider, anims) {
  const { roofTop } = house(g, home, { wall: 0xf2e2c0, trim: 0x6e4a2b, roof: 0xb5553a, door: 0x9c3a2e, rise: 1.8 }, addCollider);
  const { w, d } = home;
  const beamMat = mat(0x6e4a2b);
  const front = d / 2 + 0.02;
  // timbers across the front
  part(g, box, beamMat, [0, 2.0, front], [w, 0.12, 0.04]);
  for (const x of [-2.6, -0.8, 0.8, 2.6]) part(g, box, beamMat, [x, 1.2, front], [0.12, 2.4, 0.04]);
  // a striped awning over each window
  const stripes = [mat(0xd8452f), mat(0xfff4e0)];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) part(g, box, stripes[i % 2], [sx * 1.7 - 0.5 + i * 0.25, 2.05, front + 0.35], [0.25, 0.05, 0.75], [0.45, 0, 0]);
  }
  // the chimney, brick, out of the roof's back, and its smoke
  const chimX = 1.8;
  part(g, box, mat(0x8a3a2a), [chimX, roofTop - 0.2, -0.9], [0.6, 1.8, 0.6]);
  part(g, box, mat(0x5a2a1a), [chimX, roofTop + 0.75, -0.9], [0.7, 0.12, 0.7]);
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 });
  const puffs = Array.from({ length: 5 }, (_, i) => {
    const p = part(g, ball, smokeMat.clone(), [chimX, roofTop + 1, -0.9], [0.2, 0.2, 0.2]);
    p.castShadow = false;
    return { p, k: i / 5 };
  });
  anims.push((t) => {
    for (const { p, k } of puffs) {
      const a = (t * 0.25 + k) % 1;
      p.position.set(chimX + Math.sin(t + k * 6) * 0.15 + a * 0.4, roofTop + 1 + a * 2.2, -0.9 - a * 0.2);
      p.scale.setScalar(0.18 + a * 0.4);
      p.material.opacity = 0.55 * (1 - a);
    }
  });
  // a bench, and pots of flowers by the door
  part(g, box, woodMat, [-2.6, 0.45, front + 1.2], [1.6, 0.08, 0.5]);
  for (const sx of [-0.65, 0.65]) part(g, box, darkWoodMat, [-2.6 + sx, 0.22, front + 1.2], [0.1, 0.44, 0.4]);
  addCollider({ x: home.x - 2.6, y: 0.25, z: home.z + front + 1.2, w: 1.6, h: 0.5, d: 0.5 });
  for (const sx of [-1, 1]) {
    part(g, cyl, mat(0xb5553a), [sx * 0.95, 0.2, front + 0.35], [0.18, 0.4, 0.18]);
    part(g, ball, mat(sx > 0 ? 0xff7eb6 : 0xf2c230), [sx * 0.95, 0.5, front + 0.35], [0.2, 0.16, 0.2]);
  }
  roadSign(g, NPCS.mabel.title, 3.4, 5.2, { paper: '#fff0e0', ink: '#9c3a2e' });
}

// A signpost where a road leaves the old farm: a board on a post with the
// way to a neighbour's, and an arrow
function arrowTexture(text, dir) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8c890';
  ctx.fillRect(0, 0, 256, 72);
  ctx.strokeStyle = '#6e4a2b';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 66);
  ctx.fillStyle = '#5b2b0a';
  // the arrow, at the end it points to (or the start, pointing down or up)
  const [tip, ...rest] = {
    left: [[12, 36], [42, 14], [42, 58]],
    right: [[244, 36], [214, 14], [214, 58]],
    down: [[30, 60], [12, 26], [48, 26]],
    up: [[30, 12], [12, 46], [48, 46]],
  }[dir];
  ctx.beginPath();
  ctx.moveTo(...tip);
  for (const p of rest) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mid = dir === 'right' ? 116 : 140;
  let size = 34;
  do ctx.font = `bold ${size--}px "Trebuchet MS", system-ui, sans-serif`;
  while (ctx.measureText(text).width > 180);
  ctx.fillText(text, mid, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function buildSignposts(root) {
  for (const { x, z, text, dir } of SIGNPOSTS) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    part(g, box, darkWoodMat, [0, 0.95, -0.05], [0.12, 1.9, 0.12]);
    const face = new THREE.MeshStandardMaterial({ map: arrowTexture(text, dir), roughness: 0.9 });
    part(g, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, face, darkWoodMat], [0, 1.45, 0.03], [1.8, 0.5, 0.06], [-0.2, 0, 0]).castShadow = false;
  }
}

// ---------- Inside ----------
// A room at NPC_ROOMS[id]: boards, walls (the front one low, with a door in
// its middle), a dark round it; a counter across its back half, shelves on
// the back wall, a bed in the back corner, a table and stools, a rug, a
// lantern either side. `props` adds what makes it theirs.
const ROOM_WALL_H = 3;
const ROOM_FRONT_H = 0.5;
const darkMat = new THREE.MeshBasicMaterial({ color: 0x1b140e });
function buildRoom(root, id, look, addCollider) {
  const r = NPC_ROOMS[id];
  const g = new THREE.Group();
  g.name = 'npc-room'; // (no snow in here: src/seasons.js)
  root.add(g);
  const left = r.x0 - 0.5;
  const right = left + r.w;
  const back = r.z0 - 0.5;
  const front = back + r.d;
  const midX = (left + right) / 2;
  const midZ = (back + front) / 2;
  const floorMat = mat(look.floor);
  const wallMat = mat(look.wall);
  const beamMat = mat(look.beam ?? 0x6e4a2b);
  const solid = (x, y, z, w, h, d) => addCollider({ x, y, z, w, h, d });
  const block = (material, x, y, z, w, h, d) => {
    part(g, box, material, [x, y, z], [w, h, d]);
    solid(x, y, z, w, h, d);
  };
  part(g, new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2), darkMat, [midX, -0.03, midZ - 10]).castShadow = false; // (the camera looks a long way north)
  part(g, box, floorMat, [midX, -0.2, midZ], [r.w, 0.4, r.d]).castShadow = false;
  addCollider({ x: midX, y: -0.2, z: midZ, w: r.w, h: 0.4, d: r.d }, { ground: true });
  // the boards' gaps
  const gapMat = mat(new THREE.Color(look.floor).multiplyScalar(0.7).getHex());
  for (let z = back + 1; z < front; z++) part(g, box, gapMat, [midX, 0.002, z], [r.w, 0.004, 0.04]).castShadow = false;
  block(wallMat, midX, ROOM_WALL_H / 2, back - 0.2, r.w + 0.8, ROOM_WALL_H, 0.4);
  for (const x of [left - 0.2, right + 0.2]) block(wallMat, x, ROOM_WALL_H / 2, midZ, 0.4, ROOM_WALL_H, r.d);
  part(g, box, wallMat, [midX, ROOM_FRONT_H / 2, front + 0.2], [r.w + 0.8, ROOM_FRONT_H, 0.4]);
  solid(midX, ROOM_WALL_H / 2, front + 0.2, r.w + 0.8, ROOM_WALL_H, 0.4);
  part(g, box, beamMat, [midX, ROOM_WALL_H - 0.1, back + 0.05], [r.w, 0.2, 0.12]);
  part(g, box, beamMat, [midX, ROOM_FRONT_H + 0.05, front + 0.2], [r.w + 0.8, 0.1, 0.44]);
  for (const x of [left + 0.06, right - 0.06]) part(g, box, beamMat, [x, ROOM_WALL_H / 2, back + 0.06], [0.16, ROOM_WALL_H, 0.12]);
  // windows in the back wall, by the corners
  for (const x of [left + 1.6, right - 1.6]) addWindow(g, x, 1.9, back + 0.02, beamMat, 1.0, 0.9);
  // lanterns on the side walls
  for (const x of [left + 0.12, right - 0.12]) part(g, box, lanternMat, [x, 2.1, midZ], [0.2, 0.28, 0.2]).castShadow = false;
  // the door out, in the front wall, and a mat before it
  const door = new THREE.Group();
  door.name = 'npc-door-in';
  door.position.set(midX, 0, front);
  g.add(door);
  for (const x of [-0.6, 0.6]) part(door, box, beamMat, [x, 1.1, 0.1], [0.16, 2.2, 0.3]);
  part(door, box, beamMat, [0, 2.25, 0.1], [1.36, 0.16, 0.3]);
  part(door, box, mat(look.door ?? 0xa8713f), [0, 1.05, 0.12], [1.04, 2.0, 0.08]);
  part(g, box, mat(look.rug ?? 0xb8473c), [midX, 0.012, front - 0.75], [1.4, 0.02, 0.8]).castShadow = false;
  // the counter across the back half, the neighbour behind it
  const counterZ = back + 3.2;
  const counterW = 5.2;
  const topMat = mat(look.counterTop ?? 0xc48a4a);
  block(mat(look.counter ?? 0xa0682f), midX, 0.5, counterZ, counterW, 1, 0.8);
  part(g, box, topMat, [midX, 1.03, counterZ], [counterW + 0.12, 0.06, 0.92]);
  // the shelves on the back wall behind it
  const shelfMat = mat(0x6e4a2b);
  for (const y of [0.9, 1.6, 2.3]) part(g, box, shelfMat, [midX, y, back + 0.25], [counterW + 0.6, 0.06, 0.45]);
  for (const sx of [-1, 1]) part(g, box, shelfMat, [midX + sx * (counterW / 2 + 0.3), 1.3, back + 0.25], [0.08, 2.6, 0.45]);
  // the bed, in the back left corner
  const bedX = left + 0.9;
  const bedZ = back + 1.4;
  block(darkWoodMat, bedX, 0.25, bedZ, 1.4, 0.5, 2.4);
  part(g, box, mat(0xf4efe4), [bedX, 0.56, bedZ + 0.15], [1.3, 0.14, 2.1]);
  part(g, box, mat(look.blanket ?? 0x4f7fbf), [bedX, 0.62, bedZ + 0.45], [1.36, 0.1, 1.5]);
  part(g, box, mat(0xf4efe4), [bedX, 0.7, bedZ - 0.75], [1.0, 0.16, 0.5]);
  part(g, box, darkWoodMat, [bedX, 0.7, back + 0.15], [1.4, 0.9, 0.12]);
  // the table and two stools, front right
  const tableX = right - 2.2;
  const tableZ = front - 2.4;
  part(g, box, woodMat, [tableX, 0.78, tableZ], [1.4, 0.1, 1]);
  for (const [x, z] of [[-0.55, -0.38], [0.55, -0.38], [-0.55, 0.38], [0.55, 0.38]]) part(g, box, darkWoodMat, [tableX + x, 0.37, tableZ + z], [0.1, 0.74, 0.1]);
  solid(tableX, 0.42, tableZ, 1.4, 0.84, 1);
  for (const s of [-1, 1]) {
    part(g, box, woodMat, [tableX + s * 1.1, 0.45, tableZ], [0.45, 0.08, 0.45]);
    part(g, box, darkWoodMat, [tableX + s * 1.1, 0.21, tableZ], [0.12, 0.42, 0.12]);
  }
  // a rug in the middle
  part(g, box, mat(look.rugEdge ?? 0xe0b23a), [midX - 1, 0.01, front - 2.4], [2.6, 0.02, 1.6]).castShadow = false;
  part(g, box, mat(look.rug ?? 0xb8473c), [midX - 1, 0.015, front - 2.4], [2.3, 0.02, 1.3]).castShadow = false;
  const spots = {
    root: g,
    door,
    entry: { x: midX, z: front - 1.1 }, // where you come in
    exit: { x: midX, z: front - 0.6 }, // stand near this to go out
    counter: { x: midX, z: counterZ - 1, yaw: 0 }, // behind the counter, facing the shop
    customer: { x: midX, z: counterZ + 1 },
    bed: { x: bedX, z: bedZ + 0.1 },
    table: { x: tableX - 1.1, z: tableZ - 0.9, yaw: Math.PI / 2 },
    shelf: (x, y) => [midX + x, y, back + 0.25], // a spot on the shelves, for the wares
    left, right, back, front, midX, midZ, counterZ, counterW,
  };
  return spots;
}

// What makes each room theirs
function rosaRoom(g, s, addCollider) {
  const sack = mat(0xd8c49a);
  for (let i = 0; i < 4; i++) part(g, box, sack, s.shelf(-2.2 + i * 0.6, 1.08), [0.4, 0.32, 0.3]);
  for (let i = 0; i < 6; i++) part(g, ball, mat(i % 3 ? 0xf6f1e4 : 0xd9a24a), s.shelf(0.5 + i * 0.3, 1.72), [0.08, 0.1, 0.08]); // eggs
  part(g, box, mat(0xc9a066), s.shelf(1.3, 1.7), [0.9, 0.12, 0.35]);
  for (let i = 0; i < 3; i++) part(g, cyl, mat(0xf4f4f0), s.shelf(-1.6 + i * 0.5, 2.5), [0.12, 0.34, 0.12]); // milk bottles
  // hay bales in the back right, a basket of eggs on the counter, a horseshoe over the door
  for (const [dx, y, dz] of [[0, 0.3, 0], [0.8, 0.3, 0], [0.4, 0.9, 0]]) part(g, box, hayMat, [s.right - 1.6 + dx, y, s.back + 0.7 + dz], [0.75, 0.6, 0.5]);
  addCollider({ x: s.right - 1.2, y: 0.6, z: s.back + 0.7, w: 1.6, h: 1.2, d: 0.6 });
  part(g, box, mat(0xc9a066), [s.midX + 1.6, 1.12, s.counterZ], [0.5, 0.14, 0.36]);
  for (let i = 0; i < 4; i++) part(g, ball, mat(0xf6f1e4), [s.midX + 1.45 + (i % 2) * 0.3, 1.24, s.counterZ - 0.08 + Math.floor(i / 2) * 0.16], [0.07, 0.09, 0.07]);
  part(g, new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI * 1.3), ironMat, [s.midX, 2.55, s.front + 0.05], [1, 1, 1], [0, 0, -Math.PI * 0.15 + Math.PI]);
}

function basilRoom(g, s, addCollider) {
  const packets = [0xf2eef5, 0xff8c1a, 0xffd23f, 0x7fb3d5, 0xe0362c, 0x4f9e3c, 0xb58cff];
  for (const [row, y] of [[0, 1.08], [1, 1.78], [2, 2.48]]) {
    for (let i = 0; i < 9; i++) part(g, box, mat(packets[(i + row * 3) % packets.length]), s.shelf(-2.4 + i * 0.6, y), [0.32, 0.36, 0.06]);
  }
  // pots of plants on the counter and the floor, herbs hanging from the beam
  for (const dx of [-1.8, 1.8]) {
    part(g, cyl, mat(0xb5553a), [s.midX + dx, 1.2, s.counterZ], [0.15, 0.3, 0.15]);
    part(g, ball, leafMat, [s.midX + dx, 1.5, s.counterZ], [0.22, 0.2, 0.22]);
  }
  for (const [x, z] of [[s.right - 0.6, s.back + 1.8], [s.right - 0.6, s.back + 3], [s.left + 2.2, s.front - 0.8]]) {
    part(g, cyl, mat(0xb5553a), [x, 0.25, z], [0.25, 0.5, 0.25]);
    part(g, ball, leafMat, [x, 0.8, z], [0.4, 0.45, 0.4]);
    addCollider({ x, y: 0.5, z, w: 0.6, h: 1, d: 0.6 });
  }
  for (let i = 0; i < 5; i++) part(g, cone, mat(i % 2 ? 0x6b8a3a : 0x8aa04a), [s.midX - 2 + i, 2.6, s.back + 0.7], [0.12, 0.4, 0.12], [Math.PI, 0, 0]);
}

function finnRoom(g, s, addCollider) {
  // rods up on the wall, a mounted fish, a coil of rope, barrels of bait
  for (let i = 0; i < 5; i++) part(g, cyl, mat(i % 2 ? 0x5b84b1 : 0xb0743a), s.shelf(-2.4 + i * 0.25, 1.75), [0.025, 1.6, 0.025], [0, 0, 0.2]);
  const fish = new THREE.Group();
  fish.position.set(...s.shelf(1.4, 1.95));
  g.add(fish);
  part(fish, ball, mat(0x5a8ab0), [0, 0, 0.05], [0.7, 0.22, 0.1]);
  part(fish, cone, mat(0x5a8ab0), [0.8, 0, 0.05], [0.22, 0.4, 0.06], [0, 0, -Math.PI / 2]);
  part(fish, cone, mat(0xd9d9d9), [-0.85, 0.02, 0.05], [0.04, 0.6, 0.04], [0, 0, Math.PI / 2]); // its sword
  part(fish, box, darkWoodMat, [0, 0, -0.05], [1.6, 0.5, 0.05]);
  part(g, new THREE.TorusGeometry(0.22, 0.07, 6, 14), mat(0xd8c08a), s.shelf(-1, 1.12), [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (const [dx, dz] of [[0, 0], [0.75, 0.2]]) part(g, cyl, woodMat, [s.right - 1.4 + dx, 0.45, s.back + 0.7 + dz], [0.33, 0.9, 0.33]);
  addCollider({ x: s.right - 1.05, y: 0.45, z: s.back + 0.8, w: 1.5, h: 0.9, d: 0.9 });
  // a ship's lantern on the counter, and a wheel on the right wall
  part(g, box, lanternMat, [s.midX - 1.8, 1.25, s.counterZ], [0.2, 0.34, 0.2]).castShadow = false;
  const wheel = part(g, new THREE.TorusGeometry(0.45, 0.05, 6, 16), woodMat, [s.right - 0.08, 1.7, s.front - 2], [1, 1, 1], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 4; i++) part(wheel, box, woodMat, [0, 0, 0], [0.04, 1.15, 0.04], [0, 0, (i * Math.PI) / 4]);
}

function mabelRoom(g, s, addCollider, anims) {
  // loaves on the shelves, cakes on the counter, the oven glowing in the back right
  const loaf = mat(0xc8843a);
  for (const y of [1.08, 1.78]) for (let i = 0; i < 7; i++) part(g, new THREE.CapsuleGeometry(0.1, 0.22, 3, 8), loaf, s.shelf(-2.3 + i * 0.75, y), [1, 1, 1], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 5; i++) part(g, cyl, mat([0xf4b6cf, 0xfff4e0, 0x8a4a2a][i % 3]), s.shelf(-2 + i, 2.42), [0.2, 0.18, 0.2]);
  for (const dx of [-1.6, 1.6]) {
    part(g, cyl, mat(dx < 0 ? 0xf4b6cf : 0x8a4a2a), [s.midX + dx, 1.15, s.counterZ], [0.22, 0.18, 0.22]);
    part(g, new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat, [s.midX + dx, 1.06, s.counterZ]).castShadow = false;
  }
  const ox = s.right - 1.3;
  const oz = s.back + 0.8;
  part(g, box, mat(0x9a4a32), [ox, 0.9, oz], [1.8, 1.8, 1.2]);
  part(g, box, darkMat, [ox, 0.7, oz + 0.61], [0.9, 0.6, 0.02]).castShadow = false;
  const fire = part(g, box, new THREE.MeshBasicMaterial({ color: 0xff8a2a }), [ox, 0.55, oz + 0.62], [0.6, 0.25, 0.02]);
  fire.castShadow = false;
  part(g, box, mat(0x7a3a28), [ox, 2.4, oz - 0.2], [0.6, 1.2, 0.6]);
  addCollider({ x: ox, y: 0.9, z: oz, w: 1.8, h: 1.8, d: 1.2 });
  anims.push((t) => fire.scale.set(0.6 + Math.sin(t * 9) * 0.05, 0.25 + Math.sin(t * 13) * 0.05, 0.02));
  // sacks of flour
  for (const [x, z] of [[s.left + 2.2, s.back + 0.5], [s.left + 2.8, s.back + 0.6]]) part(g, box, mat(0xf4efe4), [x, 0.3, z], [0.5, 0.6, 0.4]);
}

const ROOMS = {
  rosa: { floor: 0x9a6a3a, wall: 0xf0e0c0, beam: 0x7a2a1a, blanket: 0xc0392b, door: 0x7a2a1a, props: rosaRoom },
  basil: { floor: 0x8a6a4a, wall: 0xe4ecd4, beam: 0x5a4632, blanket: 0x4f7a3a, door: 0x3f6b3a, rug: 0x4f7a3a, rugEdge: 0xd8c08a, props: basilRoom },
  finn: { floor: 0x7a6a5a, wall: 0xa8c0d0, beam: 0x3a4a5a, blanket: 0x2f4f7a, door: 0x3a4a5a, rug: 0x2f4f7a, rugEdge: 0xe8e0d0, counter: 0x5f7f9a, props: finnRoom },
  mabel: { floor: 0xb08a5a, wall: 0xfff2dc, beam: 0x6e4a2b, blanket: 0xe88aa8, door: 0x9c3a2e, rug: 0xe88aa8, rugEdge: 0xfff4e0, counterTop: 0xe8dcc8, props: mabelRoom },
};
const OUTSIDE = { rosa: rosaHome, basil: basilHome, finn: finnHome, mabel: mabelHome };

// ctx: world.js's set piece kit, for the farm (src/maps.js HOME.build)
export function buildNpcHomes(ctx) {
  const { root, addCollider } = ctx;
  const anims = [];
  for (const [id, home] of Object.entries(NPC_HOMES)) {
    const g = new THREE.Group();
    g.name = `home-${id}`;
    g.position.set(home.x, 0, home.z);
    root.add(g);
    OUTSIDE[id](g, home, addCollider, anims);
    npcHomes.outside[id] = g;
    const look = ROOMS[id];
    const spots = buildRoom(root, id, look, addCollider);
    look.props(spots.root, spots, addCollider, anims);
    npcHomes.rooms[id] = spots;
  }
  npcHomes.dock = buildDock(root, ctx);
  buildSignposts(root);
  npcHomes.setNight = (night) => {
    windowMat.emissiveIntensity = night ? 0.9 : 0;
    lanternMat.emissiveIntensity = night ? 1.2 : 0.15;
  };
  npcHomes.animate = (t) => anims.forEach((fn) => fn(t));
}

// The room x, z is in (its neighbour's id), or null
export function roomAt(x, z) {
  for (const [id, r] of Object.entries(NPC_ROOMS)) {
    if (x > r.x0 - 0.5 && x < r.x0 + r.w - 0.5 && z > r.z0 - 0.5 && z < r.z0 + r.d - 0.5) return id;
  }
  return null;
}
