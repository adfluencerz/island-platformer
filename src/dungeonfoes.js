import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOE_R } from '../shared/dungeons.js';
import { damp } from './character.js';

// ---------- The dungeons' foes, as they are drawn ----------
// Each dungeon's own kind (src/dungeon.js has the dungeons): sproutlings
// (little angry parsnips), lion cubs, worker bees, rooks and bog frogs,
// posed from what they are up to (closing in, winding up, going for
// someone, reeling from a bop), and gone in a puff when bopped down. What of
// a foe doesn't move on its own is drawn as one mesh (its colors on its
// corners), the same for every foe of its kind; what does (wings, a tail,
// leaves) on its own.

const mats = new Map();
const mat = (color, extra = {}) => {
  const key = `${color}:${JSON.stringify(extra)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra }));
  return mats.get(key);
};
const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(0.5, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const cone = new THREE.ConeGeometry(0.5, 1, 8);
const shadowGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

function part(parent, geo, material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// A foe: its model (each dungeon's own kind), and pose(dt, t, f, at): f as
// dungeonFromWire has it (null: resting where the dungeon starts it off),
// at: where it is drawn ({ x, y, z })
export function createFoe(id, parent) {
  const root = new THREE.Group();
  parent.add(root);
  const body = new THREE.Group(); // (what squashes and leans)
  root.add(body);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.scale.setScalar(FOE_R * 0.9);
  shadow.renderOrder = 1;
  root.add(shadow);
  const model = MODELS[id](body);
  still(id, body);
  const puffs = [];
  let flinchAt = -1;
  let downAt = -1;
  let yaw = 0;
  let now = 0;
  const v = new THREE.Vector3();

  function puff() {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const blob = part(parent, ball, PUFF_MAT, root.position.x, root.position.y + 0.35, root.position.z, 0.25, 0.25, 0.25);
      blob.castShadow = false;
      blob.userData.v = new THREE.Vector3(Math.cos(a) * 1.6, 1 + Math.random(), Math.sin(a) * 1.6);
      blob.userData.age = 0;
      puffs.push(blob);
    }
  }

  return {
    flinch() {
      flinchAt = now;
    },
    top(out) {
      return out.set(root.position.x, root.position.y + 0.5, root.position.z);
    },
    pose(dt, t, f, at) {
      now = t;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const blob = puffs[i];
        blob.userData.age += dt;
        blob.position.addScaledVector(blob.userData.v, dt);
        blob.scale.setScalar(0.25 * (1 + blob.userData.age * 2));
        if (blob.userData.age > 0.45) {
          parent.remove(blob);
          puffs.splice(i, 1);
        }
      }
      if (!f) {
        root.visible = false;
        downAt = -1;
        return;
      }
      if (f.state === 'down') {
        if (downAt < 0 && root.visible) {
          downAt = t;
          puff();
        }
        root.visible = false;
        return;
      }
      downAt = -1;
      root.visible = true;
      root.position.set(at.x, at.y, at.z);
      let diff = f.yaw - yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      yaw += diff * damp(10, dt);
      root.rotation.y = yaw;
      shadow.position.y = 0.02 - at.y;
      shadow.scale.setScalar(FOE_R * 0.9 * Math.max(0.4, 1 - at.y * 0.2));
      // how it stands: squashed down to wind up, stretched going for you, reeling when bopped
      let sy = 1 + Math.sin(t * 3 + root.position.x) * 0.03;
      let lean = 0;
      let wobble = 0;
      if (f.state === 'roam') wobble = Math.sin(t * 12) * 0.12;
      else if (f.state === 'windup') {
        sy = 0.78;
        wobble = Math.sin(t * 40) * 0.06;
      } else if (f.state === 'attack') {
        sy = 1.15;
        lean = 0.35;
      } else if (f.state === 'hurt') {
        lean = -0.5;
        wobble = Math.sin(t * 30) * 0.2;
      }
      const reel = flinchAt >= 0 && t - flinchAt < 0.3 ? 1 - (t - flinchAt) / 0.3 : 0;
      sy *= 1 - reel * 0.3;
      body.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
      body.rotation.set(lean, 0, wobble);
      model.animate?.(t, f, v);
    },
  };
}
// A part that moves on its own (left out of still())
function moving(mesh) {
  mesh.userData.moves = true;
  return mesh;
}

// The parts of a foe's body that don't move, as one mesh: built from the first
// foe of its kind, and shared by the rest
const stills = new Map(); // id -> BufferGeometry
const stillMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
function still(id, body) {
  const parts = body.children.filter((c) => c.isMesh && !c.userData.moves);
  if (!stills.has(id)) {
    const geos = parts.map((mesh) => {
      mesh.updateMatrix();
      const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix);
      geo.deleteAttribute('uv');
      const { r, g, b } = mesh.material.color;
      geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geo.attributes.position.count }, () => [r, g, b]).flat(), 3));
      return geo;
    });
    stills.set(id, mergeGeometries(geos));
  }
  for (const mesh of parts) body.remove(mesh);
  const one = new THREE.Mesh(stills.get(id), stillMat);
  one.castShadow = true;
  body.add(one);
}

const PUFF_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });

// Each dungeon's foe (about FOE_H tall, facing +z), built into `g`: { animate(t, f) } for what moves on its own
const MODELS = {
  // a little angry parsnip on stubby feet, leaves on top
  parsnip(g) {
    const skin = mat(0xf2e2b0);
    part(g, cone, skin, 0, 0.42, 0, 0.42, 0.62, 0.42, Math.PI, 0, 0);
    part(g, ball, skin, 0, 0.6, 0, 0.44, 0.3, 0.44);
    const leaves = new THREE.Group();
    leaves.position.y = 0.76;
    g.add(leaves);
    for (let i = 0; i < 3; i++) part(leaves, ball, mat(0x5aa83c), Math.sin(i * 2.1) * 0.08, 0.12, Math.cos(i * 2.1) * 0.08, 0.1, 0.32, 0.18, Math.cos(i * 2.1) * 0.5, 0, -Math.sin(i * 2.1) * 0.5);
    face(g, 0.58, 0.21, 0.07);
    for (const sx of [-1, 1]) part(g, ball, mat(0x8a5a32), sx * 0.1, 0.06, 0.02, 0.13, 0.1, 0.17);
    return { animate: (t, f) => (leaves.rotation.y = f.state === 'windup' ? t * 18 : Math.sin(t * 2) * 0.3) };
  },
  // a lion cub: a round tan body, a big head in a little mane, a tufted tail
  lion(g) {
    const fur = mat(0xe0a848);
    part(g, ball, fur, 0, 0.3, -0.08, 0.42, 0.34, 0.56);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) part(g, cyl, fur, sx * 0.12, 0.1, -0.08 + sz * 0.17, 0.1, 0.22, 0.1);
    const tail = moving(part(g, cyl, fur, 0, 0.42, -0.42, 0.05, 0.3, 0.05, -0.8, 0, 0));
    part(g, ball, mat(0xb8761f), 0, 0.52, -0.53, 0.12, 0.12, 0.12);
    part(g, ball, mat(0xb8761f), 0, 0.5, 0.2, 0.56, 0.52, 0.3);
    part(g, ball, fur, 0, 0.5, 0.27, 0.4, 0.38, 0.36);
    for (const sx of [-1, 1]) part(g, ball, fur, sx * 0.15, 0.7, 0.24, 0.12, 0.12, 0.08);
    part(g, ball, mat(0xf7e2b8), 0, 0.44, 0.42, 0.2, 0.14, 0.12);
    part(g, ball, mat(0x3d2416), 0, 0.48, 0.48, 0.07, 0.05, 0.05);
    face(g, 0.55, 0.12, 0.42);
    return { animate: (t) => (tail.rotation.z = Math.sin(t * 6) * 0.4) };
  },
  // a worker bee: striped, buzzing wings, a little sting
  bee(g) {
    const yellow = mat(0xffd23f);
    const black = mat(0x2a1a10);
    part(g, ball, yellow, 0, 0.32, -0.12, 0.38, 0.34, 0.46);
    for (const z of [-0.06, -0.22]) part(g, ball, black, 0, 0.32, z, 0.39, 0.35, 0.07);
    part(g, cone, black, 0, 0.3, -0.38, 0.08, 0.14, 0.08, -Math.PI / 2, 0, 0);
    part(g, ball, black, 0, 0.36, 0.14, 0.26, 0.26, 0.24);
    part(g, ball, black, 0, 0.42, 0.3, 0.24, 0.24, 0.22);
    for (const sx of [-1, 1]) {
      part(g, ball, mat(0xffffff), sx * 0.07, 0.46, 0.39, 0.08, 0.1, 0.05);
      part(g, cyl, black, sx * 0.05, 0.6, 0.34, 0.02, 0.2, 0.02, 0.4, 0, sx * 0.3);
    }
    const wings = [-1, 1].map((sx) => {
      const w = moving(part(g, ball, WING_MAT, sx * 0.17, 0.52, 0.02, 0.26, 0.03, 0.16));
      w.castShadow = false;
      return w;
    });
    return {
      animate: (t) => wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * (0.3 + Math.sin(t * 60) * 0.4))),
    };
  },
  // a rook: black, a pale beak, wings it flaps going up and about
  crow(g) {
    const black = mat(0x26282e);
    part(g, ball, black, 0, 0.36, -0.04, 0.38, 0.38, 0.54);
    part(g, ball, black, 0, 0.58, 0.18, 0.28, 0.28, 0.28);
    part(g, cone, mat(0xc9ccd1), 0, 0.56, 0.38, 0.1, 0.24, 0.1, Math.PI / 2, 0, 0);
    part(g, box, black, 0, 0.36, -0.36, 0.26, 0.05, 0.24, 0.3, 0, 0);
    for (const sx of [-1, 1]) {
      part(g, ball, mat(0xffffff), sx * 0.09, 0.62, 0.27, 0.07, 0.07, 0.04);
      part(g, ball, mat(0x111111), sx * 0.1, 0.62, 0.29, 0.035, 0.035, 0.02);
      part(g, cyl, mat(0x3a3632), sx * 0.07, 0.1, 0, 0.03, 0.22, 0.03);
    }
    const wings = [-1, 1].map((sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.17, 0.44, -0.02);
      g.add(pivot);
      part(pivot, ball, mat(0x1c1d22), sx * 0.12, 0, 0, 0.3, 0.06, 0.4);
      return pivot;
    });
    return {
      animate: (t, f) => {
        const flap = f.y > 0.15 || f.state === 'windup' ? Math.sin(t * 22) * 0.8 : 0.1;
        wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * flap));
      },
    };
  },
  // a bog frog: squat and green, a pale belly, eyes up on top
  toad(g) {
    const green = mat(0x5f9a3a);
    part(g, ball, green, 0, 0.26, 0, 0.6, 0.38, 0.56);
    part(g, ball, mat(0xd8e8a0), 0, 0.2, 0.12, 0.44, 0.24, 0.34);
    for (const sx of [-1, 1]) {
      part(g, ball, green, sx * 0.15, 0.46, 0.14, 0.18, 0.18, 0.18);
      part(g, ball, mat(0xe0c040), sx * 0.15, 0.49, 0.2, 0.12, 0.12, 0.08);
      part(g, ball, mat(0x111111), sx * 0.15, 0.49, 0.24, 0.07, 0.03, 0.03);
      part(g, ball, green, sx * 0.27, 0.12, -0.12, 0.2, 0.18, 0.34);
      part(g, ball, green, sx * 0.17, 0.06, 0.24, 0.1, 0.08, 0.14);
    }
    for (let i = 0; i < 4; i++) part(g, ball, mat(0x4a7a2e), Math.sin(i * 1.9) * 0.18, 0.42, -0.12 + Math.cos(i * 1.9) * 0.1, 0.06, 0.04, 0.06);
    part(g, box, mat(0x2f4a22), 0, 0.27, 0.27, 0.3, 0.02, 0.02);
    const throat = moving(part(g, ball, mat(0xe8f0b8), 0, 0.17, 0.24, 0.24, 0.14, 0.14));
    return { animate: (t) => throat.scale.set(0.24, 0.14 + Math.max(0, Math.sin(t * 4)) * 0.06, 0.14) };
  },
};
const WING_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, roughness: 0.3 });

// two eyes and cross brows, on the front of a head at height y, `w` apart, `z` out
function face(g, y, w, z) {
  for (const sx of [-1, 1]) {
    part(g, ball, mat(0x111111), sx * w / 2, y, z + 0.13, 0.07, 0.09, 0.04);
    part(g, box, mat(0x3d2416), sx * w / 2, y + 0.08, z + 0.14, 0.11, 0.025, 0.02, 0, 0, sx * 0.45);
  }
}
