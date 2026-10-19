import * as THREE from 'three';
import { CROP_GROW_TIME } from '../shared/level.js';

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

export const CROPS = {
  turnip: { growTime: CROP_GROW_TIME.turnip, produce: 'turnip', build: buildTurnip },
  carrot: { growTime: CROP_GROW_TIME.carrot, produce: 'carrot', build: buildCarrot },
  sunflower: { growTime: CROP_GROW_TIME.sunflower, produce: 'sunflower', build: buildSunflower },
  golden_turnip: {
    growTime: CROP_GROW_TIME.golden_turnip,
    produce: 'golden_turnip',
    build: () => buildTurnip(goldBulbMat, goldTopMat),
  },
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
