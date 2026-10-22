import * as THREE from 'three';

// ---------- Mounts ----------
// What a farmer rides once a boss is beaten (its `mount` item, src/items.js):
// just for show, no faster than walking. A mount goes under the farmer
// (character.js ride()), at their feet, facing where they face; `seat` is
// how high they sit on it. animate(dt, walk, t): walk 0..1, how much they
// are walking.

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true });
const MATS = {
  skin: mat(0xf0e2b0),
  skinDark: mat(0xd4bd84),
  leaf: mat(0x4f9e3c),
  leafLight: mat(0x7cc95a),
  saddle: mat(0xb5483a),
  saddleDark: mat(0x7a2e24),
  dark: mat(0x2a1a10),
  white: mat(0xffffff),
  blush: mat(0xf28cb1),
};
const ball = new THREE.IcosahedronGeometry(0.5, 1);
const box = new THREE.BoxGeometry(1, 1, 1);
const cone = new THREE.ConeGeometry(0.42, 1.5, 12).rotateX(-Math.PI / 2); // (point backward, along -z)
const ring = new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2);

function part(parent, geo, material, [x, y, z], [sx, sy, sz]) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// The evil parsnip, friends now: lying along, a saddle on its back, a happy
// face at the front, leaves bobbing, four stubby legs
function parsnip() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.62;
  root.add(body);
  part(body, cone, MATS.skin, [0, 0, -0.2], [1, 1, 1]);
  part(body, ball, MATS.skin, [0, 0, 0.55], [0.84, 0.84, 0.4]);
  for (const z of [-0.55, -0.15]) {
    const r = (0.42 * (z + 0.95)) / 1.5 + 0.01; // (the cone's width there)
    part(body, ring, MATS.skinDark, [0, 0, z], [r, r, 0.035]);
  }
  // leaves out of its head
  const leaves = new THREE.Group();
  leaves.position.set(0, 0.25, 0.62);
  body.add(leaves);
  for (const [a, m] of [[-0.5, MATS.leaf], [0, MATS.leafLight], [0.5, MATS.leaf]]) {
    const stem = new THREE.Group();
    stem.rotation.set(-0.4, 0, a);
    leaves.add(stem);
    part(stem, ball, m, [0, 0.3, 0], [0.18, 0.65, 0.06]);
  }
  // a happy face, at the front
  for (const sx of [-1, 1]) {
    part(body, ball, MATS.white, [sx * 0.14, 0.1, 0.74], [0.14, 0.16, 0.06]);
    part(body, ball, MATS.dark, [sx * 0.14, 0.09, 0.77], [0.07, 0.08, 0.03]);
    part(body, ball, MATS.blush, [sx * 0.27, -0.03, 0.7], [0.1, 0.05, 0.03]);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 5, 10, Math.PI), MATS.dark);
  smile.position.set(0, -0.06, 0.77);
  smile.rotation.z = Math.PI;
  body.add(smile);
  // the saddle
  part(body, box, MATS.saddle, [0, 0.38, -0.05], [0.56, 0.1, 0.6]);
  part(body, box, MATS.saddleDark, [0, 0.47, -0.32], [0.5, 0.12, 0.08]);
  for (const sx of [-1, 1]) part(body, box, MATS.saddleDark, [sx * 0.3, 0.1, -0.05], [0.04, 0.5, 0.12]);
  // legs
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.22, 0.4, sz * 0.3);
    root.add(pivot);
    part(pivot, ball, MATS.skinDark, [0, -0.2, 0], [0.16, 0.42, 0.16]);
    return { pivot, phase: i === 0 || i === 3 ? 0 : Math.PI };
  });
  let phase = 0;
  return {
    root,
    seat: 0.62 + 0.42,
    animate(dt, walk, t) {
      phase += dt * 11 * walk;
      for (const leg of legs) leg.pivot.rotation.x = Math.sin(phase + leg.phase) * 0.6 * walk;
      body.position.y = 0.62 + Math.abs(Math.sin(phase)) * 0.05 * walk + Math.sin(t * 2.2) * 0.01;
      leaves.rotation.x = Math.sin(t * 3 + phase) * 0.15;
    },
    dispose() {
      root.traverse((obj) => obj.isMesh && obj.geometry !== ball && obj.geometry !== box && obj.geometry !== cone && obj.geometry !== ring && obj.geometry.dispose());
    },
  };
}

// The super lion, friends now: a saddle on its back, its mane round a happy
// face at the front, its cape on and its tail swishing
const LION = { coat: mat(0xe8a83e), coatLight: mat(0xf6d08a), mane: mat(0xb85c1e), cape: mat(0xd6453a) };
function lion() {
  const { coat, coatLight, mane } = LION;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.7;
  root.add(body);
  part(body, ball, coat, [0, 0, 0], [0.8, 0.6, 1.3]);
  part(body, box, MATS.saddle, [0, 0.3, -0.05], [0.56, 0.1, 0.55]);
  for (const sx of [-1, 1]) part(body, box, MATS.saddleDark, [sx * 0.31, 0.08, -0.05], [0.04, 0.4, 0.12]);
  part(body, box, LION.cape, [0, 0.27, 0.42], [0.7, 0.04, 0.3]); // (its cape, rolled over its shoulders)
  const head = new THREE.Group();
  head.position.set(0, 0.32, 0.62);
  body.add(head);
  part(head, ball, mane, [0, 0, -0.08], [0.78, 0.78, 0.4]);
  part(head, ball, coat, [0, 0, 0.06], [0.5, 0.48, 0.45]);
  part(head, ball, coatLight, [0, -0.1, 0.25], [0.3, 0.2, 0.18]);
  part(head, ball, MATS.dark, [0, -0.02, 0.34], [0.09, 0.06, 0.05]);
  for (const sx of [-1, 1]) {
    part(head, ball, MATS.white, [sx * 0.11, 0.08, 0.24], [0.1, 0.11, 0.05]);
    part(head, ball, MATS.dark, [sx * 0.11, 0.07, 0.27], [0.05, 0.06, 0.03]);
    part(head, ball, MATS.blush, [sx * 0.18, -0.06, 0.22], [0.08, 0.04, 0.03]);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, -0.62);
  body.add(tail);
  part(tail, ball, coat, [0, 0.12, -0.2], [0.08, 0.08, 0.5]).rotation.x = -0.6;
  part(tail, ball, mane, [0, 0.28, -0.4], [0.16, 0.16, 0.16]);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.24, 0.5, sz * 0.38);
    root.add(pivot);
    part(pivot, ball, coat, [0, -0.24, 0], [0.18, 0.5, 0.2]);
    part(pivot, ball, coatLight, [0, -0.48, 0.04], [0.2, 0.1, 0.24]);
    return { pivot, phase: i === 0 || i === 3 ? 0 : Math.PI };
  });
  let phase = 0;
  return {
    root,
    seat: 0.7 + 0.36,
    animate(dt, walk, t) {
      phase += dt * 11 * walk;
      for (const leg of legs) leg.pivot.rotation.x = Math.sin(phase + leg.phase) * 0.6 * walk;
      body.position.y = 0.7 + Math.abs(Math.sin(phase)) * 0.05 * walk + Math.sin(t * 2.2) * 0.01;
      tail.rotation.y = Math.sin(t * 3) * 0.4;
      head.rotation.x = Math.sin(t * 2 + phase) * 0.05;
    },
    dispose() {
      root.traverse((obj) => obj.isMesh && obj.geometry !== ball && obj.geometry !== box && obj.geometry !== cone && obj.geometry !== ring && obj.geometry.dispose());
    },
  };
}

// The bee queen, friends now: buzzing along just over the grass, a saddle
// between her wings, her crown still on
const BEE = { fuzz: mat(0xffc93c), fuzzLight: mat(0xffe08a), stripe: mat(0x3a2a14), gold: mat(0xffd84a),
  wing: new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.6, roughness: 0.2 }) };
function bee() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.75;
  root.add(body);
  part(body, ball, BEE.fuzz, [0, 0, -0.25], [0.8, 0.7, 1.0]);
  for (const z of [-0.15, -0.45]) part(body, ball, BEE.stripe, [0, 0, z], [0.78, 0.68, 0.14]);
  part(body, ball, BEE.fuzzLight, [0, 0.02, 0.3], [0.6, 0.6, 0.55]);
  part(body, box, MATS.saddle, [0, 0.33, 0], [0.5, 0.08, 0.5]);
  for (const sx of [-1, 1]) part(body, box, MATS.saddleDark, [sx * 0.3, 0.1, 0], [0.04, 0.36, 0.1]);
  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.62);
  body.add(head);
  part(head, ball, BEE.fuzz, [0, 0, 0], [0.48, 0.45, 0.42]);
  for (const sx of [-1, 1]) {
    part(head, ball, MATS.white, [sx * 0.1, 0.05, 0.18], [0.1, 0.12, 0.05]);
    part(head, ball, MATS.dark, [sx * 0.1, 0.04, 0.21], [0.05, 0.07, 0.03]);
    part(head, ball, MATS.blush, [sx * 0.16, -0.06, 0.16], [0.07, 0.035, 0.03]);
  }
  part(head, ring, BEE.gold, [0, 0.24, 0], [0.13, 0.13, 0.08]).rotation.x = Math.PI / 2; // (her crown)
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.22, 0.32, -0.25);
    body.add(pivot);
    const w = part(pivot, ball, BEE.wing, [sx * 0.4, 0.05, 0], [0.8, 0.03, 0.4]);
    w.castShadow = false;
    return { pivot, sx };
  });
  let flap = 0;
  return {
    root,
    seat: 0.75 + 0.37,
    animate(dt, walk, t) {
      flap += dt * 45;
      for (const w of wings) w.pivot.rotation.z = w.sx * Math.sin(flap) * 0.5;
      body.position.y = 0.75 + Math.sin(t * 3) * 0.06 + walk * 0.04;
      body.rotation.x = walk * 0.12;
    },
    dispose() {
      root.traverse((obj) => obj.isMesh && obj.geometry !== ball && obj.geometry !== box && obj.geometry !== cone && obj.geometry !== ring && obj.geometry.dispose());
    },
  };
}

// The giant crow, friends now: hopping along, its wings folded round the
// saddle, its scarf flying
const CROW = { plume: mat(0x2a2f45), plumeLight: mat(0x445078), beak: mat(0xf2a516), scarf: mat(0xd6453a) };
function crow() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.85;
  root.add(body);
  part(body, ball, CROW.plume, [0, 0, -0.05], [0.85, 0.75, 1.2]);
  part(body, ball, CROW.plumeLight, [0, -0.12, 0.2], [0.6, 0.5, 0.6]);
  part(body, box, MATS.saddle, [0, 0.36, -0.05], [0.5, 0.08, 0.5]);
  for (const sx of [-1, 1]) {
    part(body, ball, CROW.plume, [sx * 0.4, 0.05, -0.15], [0.12, 0.5, 0.9]); // folded wings
    part(body, box, MATS.saddleDark, [sx * 0.3, 0.12, -0.05], [0.04, 0.4, 0.1]);
  }
  part(body, ball, CROW.plume, [0, 0.1, -0.7], [0.4, 0.06, 0.5]); // tail
  const head = new THREE.Group();
  head.position.set(0, 0.4, 0.55);
  body.add(head);
  part(head, ball, CROW.plume, [0, 0, 0], [0.5, 0.48, 0.48]);
  const beak = part(head, cone, CROW.beak, [0, -0.04, 0.38], [0.25, 0.25, 0.22]);
  beak.rotation.y = Math.PI; // (the cone points back: turned to point ahead)
  for (const sx of [-1, 1]) {
    part(head, ball, MATS.white, [sx * 0.12, 0.07, 0.19], [0.1, 0.11, 0.05]);
    part(head, ball, MATS.dark, [sx * 0.12, 0.06, 0.22], [0.05, 0.06, 0.03]);
    part(head, ball, MATS.blush, [sx * 0.19, -0.04, 0.16], [0.07, 0.035, 0.03]);
  }
  part(head, ring, CROW.scarf, [0, -0.25, -0.02], [0.24, 0.24, 0.1]).rotation.x = Math.PI / 2;
  const scarfTail = part(body, box, CROW.scarf, [0.15, 0.32, 0.4], [0.1, 0.04, 0.4]);
  const legs = [-1, 1].map((sx, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.2, 0.5, 0.05);
    root.add(pivot);
    part(pivot, box, CROW.beak, [0, -0.25, 0], [0.06, 0.5, 0.06]);
    part(pivot, box, CROW.beak, [0, -0.5, 0.08], [0.12, 0.04, 0.22]);
    return { pivot, phase: i * Math.PI };
  });
  let phase = 0;
  return {
    root,
    seat: 0.85 + 0.4,
    animate(dt, walk, t) {
      phase += dt * 11 * walk;
      for (const leg of legs) leg.pivot.rotation.x = Math.sin(phase + leg.phase) * 0.5 * walk;
      body.position.y = 0.85 + Math.abs(Math.sin(phase)) * 0.1 * walk + Math.sin(t * 2.2) * 0.01;
      head.rotation.x = Math.sin(t * 2.5 + phase) * 0.08;
      scarfTail.rotation.x = -0.3 * walk + Math.sin(t * 9) * 0.1 * walk;
    },
    dispose() {
      root.traverse((obj) => obj.isMesh && obj.geometry !== ball && obj.geometry !== box && obj.geometry !== cone && obj.geometry !== ring && obj.geometry.dispose());
    },
  };
}

const MOUNTS = { parsnip, lion, bee, crow };

// A new mount of this kind (a boss's id), or null for one this page doesn't know
export const createMount = (kind) => MOUNTS[kind]?.() ?? null;
