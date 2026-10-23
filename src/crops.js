import * as THREE from 'three';
import { CROP_GROW_TIME } from '../shared/level.js';
import { BEANSTALK } from '../shared/balance.js';

// ---------- Crops ----------
// What each seed grows into. `growTime` is seconds from planting to ripe
// (shared/level.js, so the game server knows it too);
// `produce` is the item a ripe crop gives when harvested. Models are built
// from primitives with shared geometry/materials, so removing a crop from the
// scene is enough (nothing per-crop to dispose).

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
const leafMat = mat(0x4f9e3c);
const darkLeafMat = mat(0x3f8a3a);
const stemMat = mat(0x5f9e3a);
const seedMat = mat(0x3b2412);

const leafGeo = new THREE.SphereGeometry(1, 6, 4); // scaled per use into flat leaves
const coneGeo = new THREE.ConeGeometry(1, 1, 5);
const seedGeo = new THREE.SphereGeometry(0.035, 5, 4);
const sproutStemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.14, 5);

const turnipBulbGeo = new THREE.SphereGeometry(0.17, 8, 6);
const turnipTopGeo = new THREE.SphereGeometry(0.175, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
const turnipBulbMat = mat(0xf2eef5);
const turnipTopMat = mat(0x9b59b6);
const goldBulbMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.35, metalness: 0.6, emissive: 0x6a4a00, flatShading: true });
const goldTopMat = new THREE.MeshStandardMaterial({ color: 0xe0a800, roughness: 0.35, metalness: 0.6, emissive: 0x4a3200, flatShading: true });
const carrotRootGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.12, 7);
const carrotMat = mat(0xff8c1a);
const sunflowerStemGeo = new THREE.CylinderGeometry(0.035, 0.05, 1.3, 6);
const sunflowerDiscGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 10);
const petalMat = mat(0xffd23f);
const discMat = mat(0x6b3f17);
const flaxStemGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 5);
const bellGeo = new THREE.ConeGeometry(0.09, 0.16, 6);
const bellMat = mat(0x6f8fd6);

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
  for (let i = 0; i < 3; i++) g.add(leaf((i / 3) * Math.PI * 2, { y: 0.2, length: 0.2, lean: 0.4 }));
  return g;
}

function buildCarrot() {
  const g = new THREE.Group();
  g.add(mesh(carrotRootGeo, carrotMat, [0, 0.04, 0]));
  for (let i = 0; i < 5; i++) {
    const frond = new THREE.Group();
    frond.position.y = 0.1;
    frond.rotation.set(0, (i / 5) * Math.PI * 2, 0);
    const c = mesh(coneGeo, i % 2 ? leafMat : darkLeafMat, [0, 0.2, 0], [0.035, 0.4, 0.035]);
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.35;
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
const podMat = mat(0x8fd46a);
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
  // (`climb`: its beans are picked from the top, see BEAN_LEDGES)
  vine_bean: { growTime: CROP_GROW_TIME.vine_bean, produce: 'beans', build: buildBeanstalk, climb: true },
};

// Growth stages by progress (0..1): seeds in the soil, a sprout, then the crop
// itself filling out until it's ripe at 1.
const SPROUT_AT = 0.2;
const PLANT_AT = 0.55;

export function createCropView(cropId) {
  const group = new THREE.Group();

  const seeds = new THREE.Group();
  for (const [x, z] of [[-0.12, -0.05], [0.08, -0.1], [0.02, 0.1], [0.13, 0.06]]) {
    seeds.add(mesh(seedGeo, seedMat, [x, 0.01, z]));
  }

  const sprout = new THREE.Group();
  sprout.add(mesh(sproutStemGeo, stemMat, [0, 0.07, 0]));
  sprout.add(leaf(0, { y: 0.12, length: 0.09, width: 0.06, lean: 1.0 }));
  sprout.add(leaf(Math.PI, { y: 0.12, length: 0.09, width: 0.06, lean: 1.0 }));

  const plant = CROPS[cropId].build();
  group.add(seeds, sprout, plant);

  function setProgress(p) {
    seeds.visible = p < SPROUT_AT;
    sprout.visible = p >= SPROUT_AT && p < PLANT_AT;
    sprout.scale.setScalar(THREE.MathUtils.mapLinear(Math.min(p, PLANT_AT), SPROUT_AT, PLANT_AT, 0.6, 1.3));
    plant.visible = p >= PLANT_AT;
    plant.scale.setScalar(p >= 1 ? 1 : THREE.MathUtils.mapLinear(p, PLANT_AT, 1, 0.4, 0.8));
  }
  setProgress(0);

  return { group, setProgress };
}
