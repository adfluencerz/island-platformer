import * as THREE from 'three';
import { SKY_STYLES, rimAt, onIsle, PEDESTAL_H } from '../shared/skyisles.js';
import { hashSeed, mulberry32 } from '../shared/worldgen.js';
import { kit, matsFor, drawStep, drawBuilding, drawDecor, SKY_LOOKS } from './skystyles.js';
import { chestModel } from './chest.js';
import { ITEMS } from './items.js';

// ---------- The sky isles (generation 10) ----------
// Draws the landmasses floating over a lobby's island (shared/skyisles.js
// has where they are): each one's ground and the rock hanging under it, its
// stair of floating steps, its building and what stands about on it, all in
// its style (src/skystyles.js), and the pedestal its relic floats over. Called
// from the wild island's set pieces (src/maps.js); returns what animates them.
//
// The relic and the chests are the lobby's spots: main.js draws them (with
// skyChestView and relicBeam, below) and asks the lobby for them.
//
// An isle between the camera and a farmer down under it (on its stair, or
// on the ground) fades, as trees do (updateSkyFade), so the steps behind it
// can be seen; the steps themselves never fade.

let drawn = null; // what is drawn now: { island, root, addCollider, isles: [{ group, stair, colliders, moving, style, materials, fade, depth }] }

// island: islandFor(seed), with its `sky`. root, addCollider: the world's (world.js buildWorld)
export function buildSkyIsles(island, { root, addCollider }) {
  drawn = null;
  if (!island.sky) return null; // (an island from before generation 10)
  const isles = island.sky.map((isle, n) => drawIsle({ island, root, addCollider }, isle, n, isle.style));
  drawn = { island, root, addCollider, isles };
  return (t) => {
    for (const isle of isles) for (const move of isle.moving) move(t);
  };
}

function drawIsle({ island, root, addCollider }, isle, n, styleIndex) {
  const style = SKY_STYLES[styleIndex].id;
  const look = SKY_LOOKS[style];
  const m = matsFor(style, isle.variant);
  const rng = mulberry32(hashSeed(`${island.seed}/sky/${n}`));
  const rand = (min, max) => min + rng() * (max - min);
  const group = new THREE.Group();
  group.name = `sky-isle-${n}`;
  group.position.set(isle.x, isle.top, isle.z);
  root.add(group);
  const solids = [];
  const moving = [];
  const k = kit(group, solids, moving);
  k.mats = m;
  const colliders = [];
  const collide = (box) => colliders.push(addCollider(box));

  // ---------- The land ----------
  // its ground: the edge's shape, a turf on top of a band of soil
  const edge = new THREE.Shape();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = rimAt(isle, a);
    edge[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, -Math.sin(a) * r);
  }
  const slab = (depth) => new THREE.ExtrudeGeometry(edge, { depth, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
  const turf = new THREE.Mesh(slab(0.35).translate(0, -0.35, 0), m.grass);
  const soil = new THREE.Mesh(slab(0.6).translate(0, -0.95, 0), m.soil);
  soil.scale.set(0.985, 1, 0.985);
  for (const mesh of [turf, soil]) {
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
  }
  // the rock hanging under it, narrowing to a point
  const depth = isle.r * look.under * rand(0.9, 1.1);
  const under = underRock(isle, depth, m.rock.color, m.rockDark.color, rng);
  group.add(under.mesh);
  hang(k, look.hang, isle, under.yAt, rand);
  // what is stood on: one box for each strip across it
  const reach = isle.r + isle.waves.reduce((sum, [amp]) => sum + amp, 0);
  for (let z = -reach; z < reach; z += 0.5) {
    const zc = z + 0.25;
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = -reach; x <= reach; x += 0.1) {
      if (!onIsle(isle, isle.x + x, isle.z + zc)) continue;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    if (hi > lo) collide({ x: isle.x + (lo + hi) / 2, y: isle.top - 0.5, z: isle.z + zc, w: hi - lo + 0.1, h: 1, d: 0.5 });
  }

  // ---------- The stair ----------
  // (a group of its own, beside the isle's, so it stays when the isle fades)
  const stair = new THREE.Group();
  stair.position.copy(group.position);
  root.add(stair);
  const sk = kit(stair, solids, moving);
  sk.mats = m;
  isle.steps.forEach(([x, z, w, d, top], i) => {
    drawStep(style, sk.sub(x - isle.x, top - isle.top, z - isle.z), w, d, i);
    collide({ x, y: top - 0.25, z, w, h: 0.5, d });
  });

  // ---------- The building, the pedestal, the chests' places ----------
  const { house } = isle;
  drawBuilding(style, k.sub(house.x - isle.x, 0, house.z - isle.z), house.w, house.d, isle.variant);
  const here = island.spots.filter(([kind, x, , z]) => (kind === 'relic' || kind === 'sky_chest' || kind === 'sky_vault' || kind === 'sky') && onIsle(isle, x, z));
  for (const [kind, x, , z] of here) {
    if (kind === 'relic') {
      const p = k.sub(x - isle.x, 0, z - isle.z);
      p.cyl(m.stone, 0, 0, 0, 0.5, PEDESTAL_H - 0.08, { sides: 8 });
      p.cyl(m.metalGold, 0, PEDESTAL_H - 0.08, 0, 0.45, 0.08, { sides: 8 });
      p.ring(m.metalGold, 0, 0.08, 0, 0.52, 0.04);
      p.solid(0, 0, 0, 0.9, PEDESTAL_H, 0.9);
    } else if (kind !== 'sky') {
      k.solid(x - isle.x, 0, z - isle.z, 1.1, 0.8, 0.7); // (main.js draws the chest)
    }
  }

  // ---------- What stands about ----------
  // clear of the building, the spots, where the stair comes up, and each other
  const [lx, lz] = isle.steps[isle.steps.length - 1];
  const arrival = { x: lx - isle.x, z: lz - isle.z };
  const taken = here.map(([, x, , z]) => ({ x: x - isle.x, z: z - isle.z, r: 1.4 }));
  const inner = isle.r - isle.waves.reduce((sum, [amp]) => sum + amp, 0) - 0.7;
  let i = 0;
  for (const [kind, count] of look.decor) {
    for (let placed = 0, tries = 0; placed < count && tries < 40; tries++) {
      const a = rand(0, Math.PI * 2);
      const d = Math.sqrt(rng()) * inner;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x - (house.x - isle.x)) < house.w / 2 + 0.9 && Math.abs(z - (house.z - isle.z)) < house.d / 2 + 0.9) continue;
      if (Math.hypot(x - arrival.x, z - arrival.z) < 3.2) continue;
      if (taken.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
      drawDecor(kind, k, x, z, i++);
      taken.push({ x, z, r: 1.2 });
      placed++;
    }
  }

  // the solids, in the world's space
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  for (const { g, x, y, z, w, h, d } of solids) {
    v.set(x, y, z).applyMatrix4(g.matrixWorld).applyMatrix4(toRoot);
    collide({ x: v.x, y: v.y, z: v.z, w, h, d });
  }
  // materials of its own, so it can fade without fading anything else
  const own = new Map();
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!own.has(obj.material)) own.set(obj.material, obj.material.clone());
    obj.material = own.get(obj.material);
  });
  const materials = [...own.values()].map((mat) => ({ mat, opacity: mat.opacity, transparent: mat.transparent }));
  return { group, stair, colliders, moving, style: styleIndex, materials, fade: 1, depth };
}

// Fade the isles that hide eye (a point on the farmer) from the camera: an
// isle the farmer is below, which the line from eye to the camera goes
// through. dt: seconds since the last frame.
const FADED = 0.2;
export function updateSkyFade(dt, eye, camera) {
  if (!drawn) return;
  const k = 1 - Math.exp(-8 * dt);
  const cam = camera.position;
  drawn.isles.forEach((view, n) => {
    const isle = drawn.island.sky[n];
    let hides = false;
    if (eye.y < isle.top - 0.2) {
      for (let i = 1; i <= 24 && !hides; i++) {
        const s = i / 24;
        const y = eye.y + (cam.y - eye.y) * s;
        hides = y > isle.top - view.depth - 1 && y < isle.top + 6 && onIsle(isle, eye.x + (cam.x - eye.x) * s, eye.z + (cam.z - eye.z) * s, 0.5);
      }
    }
    view.fade += ((hides ? FADED : 1) - view.fade) * k;
    const see = view.fade < 0.99;
    for (const entry of view.materials) {
      const { mat } = entry;
      mat.opacity = entry.opacity * view.fade;
      const transparent = see || entry.transparent;
      if (mat.transparent !== transparent) {
        // (another shader: three.js has to compile it again)
        mat.transparent = transparent;
        mat.depthWrite = !see;
        mat.needsUpdate = true;
      }
    }
  });
}

// The rock under an isle: rings narrowing down to a point, a little rough,
// shading darker toward the bottom. yAt(f): how far down its underside is,
// f of the way out from the middle to the edge.
const underMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
function underRock(isle, depth, light, dark, rng) {
  const RINGS = 5;
  const SIDES = 28;
  const top = -0.9;
  const ringY = (k) => top - depth * (k / RINGS) ** 0.85;
  const ringF = (k) => 0.97 * (1 - (k / RINGS) ** 1.6);
  const points = [];
  for (let k = 0; k <= RINGS; k++) {
    const row = [];
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const r = rimAt(isle, a) * ringF(k) * (k ? 1 + (rng() - 0.5) * 0.18 : 1);
      row.push(k === RINGS ? [0, ringY(k), 0] : [Math.cos(a) * r, ringY(k) + (k ? (rng() - 0.5) * 0.3 : 0), -Math.sin(a) * r]);
    }
    points.push(row);
  }
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const shade = (k) => c.copy(light).lerp(dark, k / RINGS);
  const vert = (k, i) => {
    pos.push(...points[k][i % SIDES]);
    shade(k);
    col.push(c.r, c.g, c.b);
  };
  for (let k = 0; k < RINGS; k++) {
    for (let i = 0; i < SIDES; i++) {
      // (wound so the faces look out and down)
      vert(k, i); vert(k + 1, i); vert(k, i + 1);
      if (k + 1 < RINGS) {
        vert(k, i + 1); vert(k + 1, i); vert(k + 1, i + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, underMat);
  mesh.castShadow = true;
  // (the rings' depth, f of the way out: between the rings, a straight line)
  const yAt = (f) => {
    for (let k = 0; k < RINGS; k++) {
      const [f0, f1] = [ringF(k), ringF(k + 1)];
      if (f <= f0 && f >= f1) return ringY(k) + ((f0 - f) / (f0 - f1)) * (ringY(k + 1) - ringY(k));
    }
    return ringY(RINGS);
  };
  return { mesh, yAt };
}

// What hangs under an isle, from its underside
function hang(k, kind, isle, yAt, rand) {
  if (kind === 'none') return;
  const m = k.mats;
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2);
    const f = rand(0.15, 0.85);
    const x = Math.cos(a) * rimAt(isle, a) * f;
    const z = -Math.sin(a) * rimAt(isle, a) * f;
    const y = yAt(f) + 0.15;
    const len = rand(0.8, 2.4) * (1.2 - f);
    if (kind === 'roots' || kind === 'vines') {
      const root = k.cyl(kind === 'roots' ? m.bark : m.leaf, x, y - len, z, kind === 'roots' ? 0.07 : 0.04, len, { top: 1.8, sides: 5 });
      root.rotation.set(rand(-0.25, 0.25), 0, rand(-0.25, 0.25));
      if (kind === 'vines' && i % 3 === 0) k.ball(m.flower ?? m.leaf, x, y - len, z, 0.09);
    } else if (kind === 'icicles' || kind === 'crystals' || kind === 'drips') {
      const mat = kind === 'icicles' ? m.ice : kind === 'crystals' ? (i % 2 ? m.glow : m.glow2 ?? m.glow) : m.rockDark;
      const spike = k.cone(mat, x, y, z, kind === 'crystals' ? 0.22 : 0.16, len * (kind === 'crystals' ? 1.2 : 0.9), kind === 'crystals' ? 6 : 5);
      spike.rotation.x = Math.PI;
    } else if (kind === 'puffs') {
      k.bob(k.blob(i % 2 ? m.step : m.step2, x * 1.1, y - 0.3, z * 1.1, rand(0.5, 0.9), 0.55), 0.12, 0.6);
    } else if (kind === 'chains') {
      k.cyl(m.metal2, x, y - len, z, 0.03, len, { sides: 4 });
      k.ring(m.metal, x, y - len - 0.1, z, 0.12, 0.035).rotation.x = Math.PI / 2;
    }
  }
}

// ---------- The developer tools ----------
// Draw the isle nearest (x, z) in the next style, to look them all over
// (only the look: the lobby's relic stays the one it was). Its name, or null.
export function restyleNearest(x, z) {
  if (!drawn) return null;
  const { island, root, addCollider, isles } = drawn;
  let n = -1;
  island.sky.forEach((isle, i) => {
    if (n < 0 || Math.hypot(x - isle.x, z - isle.z) < Math.hypot(x - island.sky[n].x, z - island.sky[n].z)) n = i;
  });
  if (n < 0) return null;
  const old = isles[n];
  root.remove(old.group, old.stair);
  for (const box of old.colliders) {
    box.min.y = box.max.y = box.center.y = -1e4; // (out of the way)
  }
  const style = (old.style + 1) % SKY_STYLES.length;
  isles[n] = drawIsle({ island, root, addCollider }, island.sky[n], n, style);
  return SKY_STYLES[style].name;
}

// Where to stand to climb to the isle nearest (x, z): by its first step
export function stairFoot(x, z) {
  if (!drawn) return null;
  let best = null;
  for (const isle of drawn.island.sky) {
    const [sx, sz, , d] = isle.steps[0];
    const at = { x: sx, z: sz + d / 2 + 1.2 };
    if (!best || Math.hypot(x - at.x, z - at.z) < Math.hypot(x - best.x, z - best.z)) best = at;
  }
  return best;
}

// ---------- The lobby's spots up there (main.js) ----------
export const SKY_CHEST_KINDS = new Set(['sky_chest', 'sky_vault']);

// A chest, standing at the origin, its front to the camera: the vault darker,
// banded in gold and padlocked. It stays when it has been emptied, its lid
// open (userData.open(true)).
const vaultMats = {
  wood: new THREE.MeshStandardMaterial({ color: 0x4a2a3a, roughness: 0.8, flatShading: true }),
  top: new THREE.MeshStandardMaterial({ color: 0x5a3448, roughness: 0.8, flatShading: true }),
  band: new THREE.MeshStandardMaterial({ color: 0xe0b23a, roughness: 0.35, metalness: 0.7, flatShading: true }),
};
export function skyChestView(spot) {
  const vault = spot.kind === 'sky_vault';
  const { root, lid } = chestModel(vault ? vaultMats : undefined);
  let lock = null;
  if (vault) {
    lock = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.08), vaultMats.band);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 5, 10, Math.PI), vaultMats.band);
    shackle.position.y = 0.1;
    lock.add(body, shackle);
    lock.position.set(0, 0.42, 0.4);
    root.add(lock);
  }
  root.userData.stays = true;
  root.userData.open = (open) => {
    lid.rotation.x = open ? -1.9 : 0;
    if (lock) lock.visible = !open;
  };
  return root;
}

// A column of light over a relic, seen from far off, while it is there to be found
const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 40, 10, 1, true).translate(0, 20, 0);
export function relicBeam(item) {
  const material = new THREE.MeshBasicMaterial({ color: ITEMS[item]?.color ?? 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(beamGeo, material);
  beam.position.y = -0.6;
  return beam;
}
