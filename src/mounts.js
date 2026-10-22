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

const MOUNTS = { parsnip };

// A new mount of this kind (a boss's id), or null for one this page doesn't know
export const createMount = (kind) => MOUNTS[kind]?.() ?? null;
