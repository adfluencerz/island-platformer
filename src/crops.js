import * as THREE from 'three';
import { detail } from './gfx/detail.js';
import { CROP_GROW_TIME } from '../shared/level.js';
import { BEANSTALK, MORE_CROPS, PLATFORM_PLANTS } from '../shared/balance.js';

// ---------- Crops ----------
// What each seed grows into. `growTime` is seconds from planting to ripe
// (shared/level.js, so the game server knows it too);
// `produce` is the item a ripe crop gives when harvested. Models are built
// from primitives with shared geometry/materials, so removing a crop from the
// scene is enough (nothing per-crop to dispose).

// (painted detail, src/gfx/detail.js: a leaf's veins, its sunlit top and
// dark underside, a fruit's blush and speckle; fruit glossier: `fruit`)
const mat = (color, look = 'crop', roughness = 0.8) => detail(new THREE.MeshStandardMaterial({ color, roughness }), look);
const fruit = (color) => mat(color, 'crop', 0.42);
const leafMat = mat(0x52a53a);
const darkLeafMat = mat(0x2f7d2e);
const stemMat = mat(0x5f9e3a);
const sproutMat = mat(0x78c445); // (a seedling's fresh green, to read on the dark earth)
const seedMat = mat(0xd8b67a); // (pale seeds on the dark earth)

const leafGeo = new THREE.SphereGeometry(1, 8, 5); // scaled per use into flat leaves
const coneGeo = new THREE.ConeGeometry(1, 1, 6);
const seedGeo = new THREE.SphereGeometry(0.04, 6, 4);
const sproutStemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.14, 5);

const turnipBulbGeo = new THREE.SphereGeometry(0.17, 8, 6);
const turnipTopGeo = new THREE.SphereGeometry(0.175, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
const turnipBulbMat = fruit(0xf4eef2);
const turnipTopMat = fruit(0xa040c4);
const goldBulbMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.35, metalness: 0.6, emissive: 0x6a4a00, flatShading: true });
const goldTopMat = new THREE.MeshStandardMaterial({ color: 0xe0a800, roughness: 0.35, metalness: 0.6, emissive: 0x4a3200, flatShading: true });
const carrotRootGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.12, 7);
const carrotMat = fruit(0xff7a0e);
const sunflowerStemGeo = new THREE.CylinderGeometry(0.035, 0.05, 1.3, 6);
const sunflowerDiscGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 10);
const petalMat = mat(0xffcc1e);
const discMat = mat(0x6b3f17);
const flaxStemGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 5);
const bellGeo = new THREE.ConeGeometry(0.09, 0.16, 6);
const bellMat = fruit(0x5f86e6);

function mesh(geo, material, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

// A flattened leaf standing out from the center at `angle`, tilted by `lean`
function leaf(angle, { y = 0.15, length = 0.22, width = 0.09, lean = 0.6, material = leafMat } = {}) {
  const pivot = new THREE.Group();
  pivot.position.y = y;
  pivot.rotation.set(0, angle, 0);
  const tilt = new THREE.Group();
  tilt.rotation.x = lean;
  pivot.add(tilt);
  tilt.add(mesh(leafGeo, material, [0, length, 0], [width, length, 0.025]));
  return pivot;
}

function buildTurnip(bulbMat = turnipBulbMat, topMat = turnipTopMat) {
  const g = new THREE.Group();
  g.add(mesh(turnipBulbGeo, bulbMat, [0, 0.08, 0], [1, 0.85, 1]));
  g.add(mesh(turnipTopGeo, topMat, [0, 0.085, 0], [1, 0.85, 1]));
  for (let i = 0; i < 5; i++) g.add(leaf((i / 5) * Math.PI * 2, { y: 0.18, length: 0.26, width: 0.11, lean: 0.55 + 0.25 * (i % 2), material: i % 2 ? darkLeafMat : leafMat }));
  return g;
}

function buildCarrot() {
  const g = new THREE.Group();
  g.add(mesh(carrotRootGeo, carrotMat, [0, 0.04, 0]));
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Group();
    frond.position.y = 0.1;
    frond.rotation.set(0, (i / 7) * Math.PI * 2, 0);
    const c = mesh(coneGeo, i % 2 ? leafMat : darkLeafMat, [0, 0.24, 0], [0.06, 0.48, 0.04]);
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.3 + 0.2 * (i % 2);
    tilt.add(c);
    frond.add(tilt);
    g.add(frond);
  }
  return g;
}

function buildSunflower() {
  const g = new THREE.Group();
  g.add(mesh(sunflowerStemGeo, stemMat, [0, 0.65, 0]));
  g.add(leaf(0.5, { y: 0.45, length: 0.2, width: 0.1, lean: 1.0 }));
  g.add(leaf(0.5 + Math.PI, { y: 0.75, length: 0.18, width: 0.09, lean: 1.0 }));

  // Head faces +Z (toward the camera), tipped back so it reads from above
  const head = new THREE.Group();
  head.position.set(0, 1.32, 0.04);
  head.rotation.x = -0.7;
  g.add(head);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const petal = mesh(leafGeo, petalMat, [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0], [0.07, 0.13, 0.02]);
    petal.rotation.z = a - Math.PI / 2;
    head.add(petal);
  }
  const disc = mesh(sunflowerDiscGeo, discMat, [0, 0, 0.02]);
  disc.rotation.x = Math.PI / 2;
  head.add(disc);
  return g;
}

// Flax: a slender stalk with a few thin leaves and one blue bell at the top
function buildFlax() {
  const g = new THREE.Group();
  g.add(mesh(flaxStemGeo, stemMat, [0, 0.5, 0]));
  for (let i = 0; i < 3; i++) {
    g.add(leaf((i / 3) * Math.PI * 2, { y: 0.35 + i * 0.15, length: 0.14, width: 0.05, lean: 1.1 }));
  }
  const bell = mesh(bellGeo, bellMat, [0, 1.06, 0]);
  bell.rotation.x = Math.PI; // open end facing down, like a flax flower
  g.add(bell);
  return g;
}

// A beanstalk: a tall twisting stalk with big leaves round it, each a step
// up from the one before (BEAN_LEDGES: [x, z] out from the middle, the
// height of the leaf's top, how wide it is), the last its crown, where the
// bean pods hang. Once it is ripe the leaves are ledges to climb (main.js
// puts them in the world's platforms). Planted facing one way, so the
// ledges are where the leaves are drawn; each out to a side of its own, so
// a farmer (a metre wide) never bumps their head on the next one up.
export const BEAN_LEDGES = [
  [1, 0, 1.0, 0.9],
  [0, -1, 2.05, 0.9],
  [-1, 0, 3.1, 0.9],
  [0, 1, BEANSTALK.top, 1], // (the crown)
];
export const BEAN_CROWN = BEAN_LEDGES.at(-1);
const beanStalkMat = mat(0x4f8f2e);
const beanLeafMat = mat(0x7ccf4a);
const podMat = fruit(0x8fd46a);
const beanLeafGeo = new THREE.SphereGeometry(0.5, 8, 5);
const podGeo = new THREE.CapsuleGeometry(0.06, 0.22, 3, 6);

function buildBeanstalk() {
  const g = new THREE.Group();
  // the stalk, in a few twisting pieces
  const pieces = 5;
  for (let i = 0; i < pieces; i++) {
    const h = BEANSTALK.top / pieces;
    const piece = mesh(new THREE.CylinderGeometry(0.15 - i * 0.015, 0.18 - i * 0.015, h * 1.08, 7), beanStalkMat, [Math.sin(i * 1.7) * 0.05, h * (i + 0.5), Math.cos(i * 1.7) * 0.05]);
    piece.rotation.z = Math.sin(i * 2.3) * 0.08;
    g.add(piece);
  }
  // a leaf to each ledge, flat enough to stand on, its stem back to the stalk
  for (const [x, z, top, w] of BEAN_LEDGES) {
    const leaf = mesh(beanLeafGeo, beanLeafMat, [x, top - 0.08, z], [w * 1.2, 0.2, w * 1.2]);
    leaf.rotation.y = Math.atan2(x, z);
    g.add(leaf);
    if (x || z) {
      const stem = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), beanStalkMat, [x / 2, top - 0.12, z / 2]);
      stem.rotation.z = Math.PI / 2;
      stem.rotation.y = Math.atan2(-z, x);
      g.add(stem);
    }
  }
  // the pods, hanging under the crown
  const [cx, cz] = BEAN_CROWN;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const pod = mesh(podGeo, podMat, [cx + Math.cos(a) * 0.4, BEANSTALK.top - 0.3, cz + Math.sin(a) * 0.4]);
    pod.rotation.z = Math.cos(a) * 0.3;
    pod.rotation.x = -Math.sin(a) * 0.3;
    g.add(pod);
  }
  return g;
}

// A tomato plant: a stake with the plant tied up it, leaves all the way up,
// and its tomatoes (`userData.fruit`: only on it when it's ripe)
const stakeMat = mat(0x8a5a2e, 'wood');
const tomatoMat = fruit(0xec2f1c);
const stakeGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.95, 5);
const tomatoGeo = new THREE.SphereGeometry(0.075, 8, 6);

function buildTomato() {
  const g = new THREE.Group();
  g.add(mesh(stakeGeo, stakeMat, [0.06, 0.47, 0]));
  g.add(mesh(flaxStemGeo, stemMat, [0, 0.4, 0], [1.2, 0.8, 1.2]));
  for (let i = 0; i < 6; i++) g.add(leaf(i * 2.1, { y: 0.15 + i * 0.12, length: 0.19, width: 0.1, lean: 1.0, material: i % 2 ? leafMat : darkLeafMat }));
  const fruit = new THREE.Group();
  for (const [x, y, z] of [[0.13, 0.32, 0.06], [-0.1, 0.45, 0.1], [0.08, 0.6, -0.11], [-0.12, 0.26, -0.08], [0.02, 0.72, 0.12]]) {
    fruit.add(mesh(tomatoGeo, tomatoMat, [x, y, z], [1, 0.9, 1]));
  }
  g.add(fruit);
  g.userData.fruit = fruit;
  return g;
}

// A pumpkin: a fat ribbed orange ball on its vine, big leaves round it
const pumpkinMat = fruit(0xf47a14);
const pumpkinStalkMat = mat(0x6b5a2a);
const pumpkinRibGeo = new THREE.SphereGeometry(0.17, 8, 6);

function buildPumpkin() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rib = mesh(pumpkinRibGeo, pumpkinMat, [Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1], [0.75, 0.95, 1.15]);
    rib.rotation.y = -a;
    g.add(rib);
  }
  g.add(mesh(sproutStemGeo, pumpkinStalkMat, [0, 0.36, 0], [2.5, 0.8, 2.5]));
  for (let i = 0; i < 4; i++) g.add(leaf(i * 1.6 + 0.4, { y: 0.04, length: 0.3, width: 0.2, lean: 1.3, material: i % 2 ? leafMat : darkLeafMat }));
  return g;
}

// A berry bush: a round leafy bush, red berries on it (`userData.fruit`)
const bushMat = mat(0x3f8a3a, 'leaf');
const bushLightMat = mat(0x5aa83f, 'leaf');
const berryMat = fruit(0xe01f45);
const berryGeo = new THREE.SphereGeometry(0.045, 6, 4);

function buildBerryBush() {
  const g = new THREE.Group();
  for (const [x, y, z, r, m] of [[0, 0.28, 0, 0.3, bushMat], [0.16, 0.22, 0.1, 0.2, bushLightMat], [-0.15, 0.24, 0.08, 0.21, bushLightMat], [0.02, 0.4, -0.12, 0.2, bushMat]]) {
    g.add(mesh(leafGeo, m, [x, y, z], [r, r * 0.85, r]));
  }
  const fruit = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const up = 0.18 + (i % 3) * 0.12;
    fruit.add(mesh(berryGeo, berryMat, [Math.cos(a) * 0.29, up, Math.sin(a) * 0.29]));
  }
  g.add(fruit);
  g.userData.fruit = fruit;
  return g;
}

// ---------- Plants that are platforms ----------
// (PLATFORM_PLANTS: each is stood on at its `top`; main.js makes that a
// ledge once it's ripe)

// A bounce shroom: a thick white stem under a big spotted cap, springy
const shroomStemMat = mat(0xf4efe4);
const shroomCapMat = mat(0xd84a5a);
const shroomSpotMat = mat(0xffffff);
const shroomCapGeo = new THREE.SphereGeometry(0.5, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const shroomStemGeo = new THREE.CylinderGeometry(0.17, 0.22, 0.5, 8);
const spotGeo = new THREE.SphereGeometry(0.07, 6, 4);

function buildBounceShroom() {
  const g = new THREE.Group();
  const { top } = PLATFORM_PLANTS.bounce_shroom;
  g.add(mesh(shroomStemGeo, shroomStemMat, [0, 0.25, 0]));
  g.add(mesh(shroomCapGeo, shroomCapMat, [0, top - 0.3, 0], [1, 0.6, 1]));
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const out = i ? 0.3 : 0; // (one on top)
    g.add(mesh(spotGeo, shroomSpotMat, [Math.cos(a) * out, top - 0.02 - (out * out) * 0.5, Math.sin(a) * out], [1, 0.4, 1]));
  }
  return g;
}

// A lily leaf: a stout stalk with a big round leaf flat on top, a notch cut
// in it and a pink bud by the stalk
const lilyLeafMat = mat(0x5fbf6a);
const lilyStalkMat = mat(0x3f8a3a);
const lilyBudMat = mat(0xf0a0c8);
const lilyLeafGeo = new THREE.CylinderGeometry(0.72, 0.68, 0.08, 16, 1, false, 0.35, Math.PI * 2 - 0.7);
const lilyStalkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.1, 6);

function buildLilyLeaf() {
  const g = new THREE.Group();
  const { top } = PLATFORM_PLANTS.lily_leaf;
  g.add(mesh(lilyStalkGeo, lilyStalkMat, [0, 0.55, 0]));
  g.add(mesh(lilyLeafGeo, lilyLeafMat, [0, top - 0.04, 0]));
  g.add(mesh(bellGeo, lilyBudMat, [0.2, top + 0.08, -0.15], [1.4, 1.2, 1.4]));
  return g;
}

// Cloud cotton: a thin stem winding up to a cloud of white puffs, floating
const cottonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0x30343c });
const cottonGeo = new THREE.SphereGeometry(1, 8, 6);
const cottonStemGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.5, 5);

function buildCloudCotton() {
  const g = new THREE.Group();
  const { top } = PLATFORM_PLANTS.cloud_cotton;
  const bottom = top - 0.3;
  for (let i = 0; i < 5; i++) {
    const piece = mesh(cottonStemGeo, stemMat, [Math.sin(i * 1.9) * 0.08, (i + 0.5) * (bottom / 5), Math.cos(i * 1.9) * 0.08], [1, bottom / 5 / 0.5 * 1.1, 1]);
    piece.rotation.z = Math.sin(i * 2.7) * 0.25;
    g.add(piece);
  }
  for (const [x, y, z, r] of [[0, 0.15, 0, 0.38], [0.32, 0.08, 0.1, 0.27], [-0.3, 0.1, -0.05, 0.29], [0.05, 0.1, 0.3, 0.26], [-0.05, 0.08, -0.32, 0.26], [0.1, 0.24, -0.1, 0.24]]) {
    g.add(mesh(cottonGeo, cottonMat, [x, bottom + y, z], [r, r * 0.8, r]));
  }
  return g;
}

export const CROPS = {
  turnip: { growTime: CROP_GROW_TIME.turnip, produce: 'turnip', build: buildTurnip },
  carrot: { growTime: CROP_GROW_TIME.carrot, produce: 'carrot', build: buildCarrot },
  flax: { growTime: CROP_GROW_TIME.flax, produce: 'flax', build: buildFlax },
  sunflower: { growTime: CROP_GROW_TIME.sunflower, produce: 'sunflower', build: buildSunflower },
  golden_turnip: {
    growTime: CROP_GROW_TIME.golden_turnip,
    produce: 'golden_turnip',
    build: () => buildTurnip(goldBulbMat, goldTopMat),
  },
  // (`climb`: its beans are picked from the top, see BEAN_LEDGES: what to say
  // to one trying from the ground)
  vine_bean: { growTime: CROP_GROW_TIME.vine_bean, produce: 'beans', build: buildBeanstalk, climb: 'The beans grow up at the top: climb the leaves to pick them' },
  // (`again`: it stays when it's picked, ripe again so many seconds later;
  // `gives`: so many a pick; `name`: the plant's, to dig it up)
  tomato: { growTime: CROP_GROW_TIME.tomato, produce: 'tomato', build: buildTomato, again: MORE_CROPS.tomato.again, name: 'tomato plant' },
  pumpkin: { growTime: CROP_GROW_TIME.pumpkin, produce: 'pumpkin', build: buildPumpkin },
  berry_bush: { growTime: CROP_GROW_TIME.berry_bush, produce: 'berries', build: buildBerryBush, again: MORE_CROPS.berry_bush.again, gives: MORE_CROPS.berry_bush.gives, name: 'berry bush' },
  // (`platform`: what it is to stand on, PLATFORM_PLANTS; a lily leaf has nothing to pick)
  bounce_shroom: { growTime: CROP_GROW_TIME.bounce_shroom, produce: 'mushroom', build: buildBounceShroom, again: PLATFORM_PLANTS.bounce_shroom.again, gives: PLATFORM_PLANTS.bounce_shroom.gives, name: 'bounce shroom', platform: PLATFORM_PLANTS.bounce_shroom },
  lily_leaf: { growTime: CROP_GROW_TIME.lily_leaf, produce: null, build: buildLilyLeaf, again: PLATFORM_PLANTS.lily_leaf.again, name: 'lily leaf', platform: PLATFORM_PLANTS.lily_leaf },
  cloud_cotton: { growTime: CROP_GROW_TIME.cloud_cotton, produce: 'cloud_cotton', build: buildCloudCotton, climb: 'Cloud cotton is picked from on top: jump up through it', platform: PLATFORM_PLANTS.cloud_cotton },
};

// Growth stages by progress (0..1): seeds in the soil, a sprout, then the crop
// itself filling out until it's ripe at 1. A plant that stays when it's
// picked (`again`) is whole from where a pick takes it back to, its fruit on
// it only when it's ripe.
const SPROUT_AT = 0.2;
const PLANT_AT = 0.55;

export function createCropView(cropId) {
  const group = new THREE.Group();
  group.rotation.order = 'ZXY'; // (its own turn first, then the wind's lean, x and z, the world's way: main.js)

  const seeds = new THREE.Group();
  for (const [x, z] of [[-0.12, -0.05], [0.08, -0.1], [0.02, 0.1], [0.13, 0.06]]) {
    seeds.add(mesh(seedGeo, seedMat, [x, 0.01, z]));
  }

  const sprout = new THREE.Group();
  sprout.add(mesh(sproutStemGeo, sproutMat, [0, 0.07, 0]));
  for (let i = 0; i < 3; i++) sprout.add(leaf((i / 3) * Math.PI * 2, { y: 0.12, length: 0.11, width: 0.07, lean: 1.05, material: sproutMat }));

  const plant = CROPS[cropId].build();
  group.add(seeds, sprout, plant);
  const { again, growTime } = CROPS[cropId];
  const whole = again ? 1 - again / growTime : PLANT_AT;

  function setProgress(p) {
    seeds.visible = p < SPROUT_AT;
    sprout.visible = p >= SPROUT_AT && p < whole;
    sprout.scale.setScalar(THREE.MathUtils.mapLinear(Math.min(p, whole), SPROUT_AT, whole, 0.6, 1.3));
    plant.visible = p >= whole;
    plant.scale.setScalar(p >= 1 || again ? 1 : THREE.MathUtils.mapLinear(p, PLANT_AT, 1, 0.4, 0.8));
    if (plant.userData.fruit) plant.userData.fruit.visible = p >= 1;
  }
  setProgress(0);

  return { group, setProgress };
}

// ---------- Tilled soil ----------
// One tile of tilled earth, the whole tile wide, so a patch is one field:
// three rounded ridges running north-south (z), so the midday sun, a little
// to the east (src/daynight.js MIDDAY_SIDE), lights their east faces and
// leaves their west ones dark; damp, darker troughs between (in its vertex
// colours, which the soil's material multiplies). `open`: the sides with no
// tilled tile beside them (1 west, 2 east, 4 north, 8 south): there it slopes
// down to the ground and fades to a grassy earth, along a wavering line, so
// the patch melts into the grass. One shared geometry for each (16 at most).
// Its y: metres over the ground; SOIL_TOP: the middle ridge's top, where a crop stands.
export const SOIL_TOP = 0.085;
const SOIL_X = 24; // (segments across: eight to a ridge)
const SOIL_Z = 12;
const SOIL_EDGE = 0.16; // (how far in from an open side it rises to its full height)
const EDGE_TINT = [0.95, 1.75, 1.15]; // (the soil's colour times this: an olive, grassy earth)
const soilGeos = new Map();
// a wave along a side, the same at both its ends (so the next tile's carries on)
const waver = (t, k) => 0.035 * Math.sin(Math.PI * 2 * t + k) + 0.018 * Math.sin(Math.PI * 6 * t + 2.3 * k);
export function soilGeometry(open = 15) {
  let geo = soilGeos.get(open);
  if (geo) return geo;
  const pos = [];
  const col = [];
  for (let j = 0; j <= SOIL_Z; j++) {
    for (let i = 0; i <= SOIL_X; i++) {
      const x = i / SOIL_X - 0.5;
      const z = j / SOIL_Z - 0.5;
      // how far in from the nearest open side (wavering)
      let e = 1;
      if (open & 1) e = Math.min(e, x + 0.5 + waver(z, 1.1));
      if (open & 2) e = Math.min(e, 0.5 - x + waver(z, 2.7));
      if (open & 4) e = Math.min(e, z + 0.5 + waver(x, 0.4));
      if (open & 8) e = Math.min(e, 0.5 - z + waver(x, 3.9));
      const t = THREE.MathUtils.clamp(e / SOIL_EDGE, 0, 1);
      const f = t * t * (3 - 2 * t);
      // the ridge (1 its top, 0 a trough), broad on top, and lumps (repeating each tile, so neighbours meet)
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 6 * x), 0.75);
      const lump = 0.006 * Math.sin(Math.PI * 2 * (3 * z + 2 * x) + 0.7) + 0.004 * Math.sin(Math.PI * 2 * (5 * z - x) + 2.1);
      const y = 0.004 + f * (0.026 + 0.064 * ridge + lump);
      pos.push(x, y, z);
      // troughs darker (damp, in the ridges' shade), the tops drier and paler
      const k = (0.4 + 0.75 * ridge) * (1 + 6 * lump);
      for (let c = 0; c < 3; c++) col.push(THREE.MathUtils.lerp(EDGE_TINT[c], k * [1.0, 0.97, 0.94][c], f));
    }
  }
  const index = [];
  const at = (i, j) => j * (SOIL_X + 1) + i;
  for (let j = 0; j < SOIL_Z; j++) {
    for (let i = 0; i < SOIL_X; i++) index.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
  }
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  soilGeos.set(open, geo);
  return geo;
}
