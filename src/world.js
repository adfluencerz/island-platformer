import * as THREE from 'three';
import { damp } from './character.js';
import { mulberry32 } from '../shared/worldgen.js';
import { giantScale } from '../shared/giants.js';

// (the islands' geometry helpers live with the islands, for the server too)
export { mulberry32, distToSegment, distToPaths } from '../shared/worldgen.js';

// ---------- Worlds ----------
// An island built from a map definition (maps.js): the ground as a grid of
// 1x1 tiles (the same grid the hoe tills on), the earth under them, platforms,
// grass and flowers, trees, bushes and rocks, plus anything special the map
// builds itself. The trees and rocks are where the server says (wilds:
// shared/wilds.js), the same for everyone; the rest is placed with a seeded
// RNG so a map looks the same on every load, and steers clear of them.
//
// buildWorld() returns everything the game needs from a world: its root group
// (added to the scene while you are there), its colliders, its tiles, its
// trees (which can be felled and grow back), its rocks (which can be broken up
// and surface again), and the per-frame bits (tree fading and falling, the
// map's own animation).

export const TILE_SIZE = 1;

export function tileKeyFor(x, z) {
  return `${Math.round(x / TILE_SIZE)},${Math.round(z / TILE_SIZE)}`;
}

// Cheap smooth "noise" for meadow patches (lush grass, flower fields)
const meadowNoise = (x, z) =>
  Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin((x + z) * 0.11 + 1.3) * 0.4;

// Wind sway for grass and flowers, done in the vertex shader so thousands of
// instances cost nothing on the CPU. Sway scales with height above the base.
// One clock for every world (main.js sets it).
export const windTime = { value: 0 };
function addWind(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec2 windPos = instanceMatrix[3].xz;
      float sway = sin(uWindTime * 1.8 + windPos.x * 0.35 + windPos.y * 0.25) * ${strength.toFixed(3)} * position.y;
      transformed.x += sway;
      transformed.z += sway * 0.5;`
    );
  };
}

// A repeatable 0..1 value for a point: the same point always gets the same
// value, so vertices that two meshes share agree on it
export const hash2 = (x, z) => {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

// Ripples for still or open water, in the fragment shader: the surface normal
// rocks to and fro (so the sun glints off it) and the color drifts a little.
export function addRipples(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = 'varying vec2 vRipplePos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vRipplePos = (modelMatrix * vec4(transformed, 1.0)).xz;`
    );
    shader.fragmentShader = 'uniform float uWindTime;\nvarying vec2 vRipplePos;\n' + shader.fragmentShader
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rippleA = vRipplePos.x * 1.3 + uWindTime * 1.1;
        float rippleB = vRipplePos.y * 1.7 - uWindTime * 0.9;
        float rippleC = (vRipplePos.x - vRipplePos.y) * 2.6 + uWindTime * 1.7;
        diffuseColor.rgb *= 0.95 + 0.07 * sin(rippleA * 0.4 + rippleB * 0.3);`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        vec3 rippleNormal = normalize(vec3(cos(rippleA) * 0.07 + cos(rippleC) * 0.04, 1.0, cos(rippleB) * 0.07 - cos(rippleC) * 0.04));
        normal = normalize((viewMatrix * vec4(rippleNormal, 0.0)).xyz);`
      );
  };
  return material;
}

// The sea around every island (main.js puts it there), lighter in the
// shallows along the shore, and the foam where it meets the shore
export const SEA_LEVEL = -0.6;
const SHALLOWS_WIDTH = 2.4;
const SHALLOWS_COLOR = new THREE.Color(0x6fd6d0);
const shallowsMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false });
const FOAM_WIDTH = 0.8;
const FOAM_COLOR = new THREE.Color(0xffffff);
const foamMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false });
foamMat.onBeforeCompile = (shader) => {
  shader.uniforms.uWindTime = windTime;
  shader.vertexShader = 'varying vec2 vFoamPos;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    vFoamPos = (modelMatrix * vec4(transformed, 1.0)).xz;`
  );
  // vertex alpha: 1 at the shore, 0 at the foam's outer edge. A solid line
  // hugs the shore and bands of foam wash in and out beyond it.
  shader.fragmentShader = 'uniform float uWindTime;\nvarying vec2 vFoamPos;\n' + shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
    float shore = vColor.a;
    float drift = sin(vFoamPos.x * 0.8 + vFoamPos.y * 0.6) * 1.5;
    float wave = sin(shore * 11.0 + uWindTime * 1.6 + drift);
    diffuseColor.a = max(smoothstep(0.55, 0.9, shore) * 0.9, smoothstep(0.5, 0.9, wave) * shore * 0.75);`
  );
};

// ---------- The decor kit: a few shared geometries/materials, many meshes ----------
export const foliageMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
const trunkMat = foliageMat(0x6b4423);
export const leafMats = [0x3f8a3a, 0x4f9e3c, 0x2f7a45, 0x5aa83f].map(foliageMat);
const pineMats = [0x2c6b3f, 0x24603a, 0x34784a].map(foliageMat);
export const rockMats = [0x8d8d88, 0x7a7a76, 0x9e9a90].map(foliageMat);

const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0);
export const coneGeo = new THREE.ConeGeometry(1, 1.4, 7);
export const blobGeo = new THREE.IcosahedronGeometry(1, 0);
export const rockGeo = new THREE.DodecahedronGeometry(1, 0);

export function addDecor(geo, material, x, y, z, sx, sy = sx, sz = sx, parent) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Turf on top of a platform. It overhangs a little and its top sits just
// above the collider top so it doesn't z-fight.
const CAP_COLORS = { grass: 0x5d9b3a, moss: 0x4f8a3a };
const roughMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
const turfMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

// A box with rough sides, for rock and earth: subdivided, the vertices on its
// sides pushed in or out a little (by their position alone, so faces that
// share an edge move it together and the box stays closed), and colored
// darker toward the bottom, in layers, with a mottle.
// push: how far the sides wander; dark: how much darker the bottom is.
function roughBox(x, y, z, w, h, d, color, { push = 0.07, dark = 0.3, layers = 0.05 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, Math.ceil(w * 2), Math.max(1, Math.round(h * 2.5)), Math.ceil(d * 2));
  const p = geo.attributes.position;
  const base = new THREE.Color(color);
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i), ly = p.getY(i), lz = p.getZ(i);
    const n = hash2(x + lx * 1.7 + ly * 0.9, z + lz * 1.3 - ly * 1.1) - 0.5;
    const onX = Math.abs(Math.abs(lx) - w / 2) < 1e-4;
    const onZ = Math.abs(Math.abs(lz) - d / 2) < 1e-4;
    if (onX) p.setX(i, lx + Math.sign(lx) * n * push * 2);
    if (onZ) p.setZ(i, lz + Math.sign(lz) * n * push * 2);
    const up = (ly + h / 2) / h; // 0 at the bottom, 1 at the top
    const k = 1 - dark * (1 - up) + Math.sin((y + ly) * 7) * layers + n * 0.12;
    tint.copy(base).multiplyScalar(k);
    colors.push(tint.r, tint.g, tint.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// The earth under the island's tiles: lighter just under the turf, darker down by the sea
const earthMat = new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.9, vertexColors: true });
const earthGeo = new THREE.BoxGeometry(1, 1, 1);
earthGeo.setAttribute('color', new THREE.Float32BufferAttribute(
  Array.from({ length: earthGeo.attributes.position.count }, (_, i) => {
    const k = 0.7 + 0.3 * (earthGeo.attributes.position.getY(i) + 0.5);
    return [k, k, k];
  }).flat(), 3));

// The ground's surface sits this far above its floor (tilled soil is above it)
const GROUND_LIFT = 0.012;
const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
const slabGeo = new THREE.BoxGeometry(0.86, 0.06, 0.86);
const slabMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });

// A felled tree topples away from whoever chopped it, then shrinks away and
// leaves a stump (low enough to step onto) until it grows back.
const TREE_FALL = 1; // seconds to topple
const TREE_GONE = 0.4; // then to shrink away
const TREE_GROW = 1.2; // growing back
const STUMP_H = 0.28;
const stumpGeo = new THREE.CylinderGeometry(0.16, 0.2, STUMP_H, 7).translate(0, STUMP_H / 2, 0);
const stumpMats = [trunkMat, foliageMat(0xd9b48a), trunkMat]; // side, cut top, bottom
const ROCK_BREAK = 0.3; // seconds to crumble away
const ROCK_GROW = 0.9; // a new one surfacing
const CHIPS = 5; // bits that fly off a breaking rock
const CHIP_LIFE = 0.7;
const _q = new THREE.Quaternion();
const easeOutBack = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;
const _rb = new THREE.Vector3();

// A tree's or rock's collider, w wide and deep, round where it stands
function fitBox(box, x, z, w) {
  box.min.x = x - w / 2;
  box.max.x = x + w / 2;
  box.min.z = z - w / 2;
  box.max.z = z + w / 2;
  box.center.x = x;
  box.center.z = z;
}

// Fade trees whose canopy sits on the line of sight from the camera to the
// player. Canopies are treated as boxes around the trunk: CANOPY_RADIUS wide
// and spanning CANOPY_BOTTOM..CANOPY_TOP in height (all times tree scale).
const CANOPY_RADIUS = 1.3;
const CANOPY_BOTTOM = 0.8;
const CANOPY_TOP = 3.4;

function blocksView(tree, eye, camera) {
  const { x: tx, z: tz } = tree.group.position;
  const k = tree.scale * tree.big;
  const r = CANOPY_RADIUS * k + 0.4; // a little margin around the player
  const dz = camera.position.z - eye.z;
  if (Math.abs(dz) < 1e-3) return false;

  // The sight line climbs toward the camera; find where it crosses the
  // canopy's near and far edges in Z and test height and sideways distance.
  const sNear = (tz + r - eye.z) / dz;
  const sFar = (tz - r - eye.z) / dz;
  if (sNear <= 0 || sFar >= 1) return false;
  const yAt = (s) => eye.y + (camera.position.y - eye.y) * THREE.MathUtils.clamp(s, 0, 1);
  const xAt = (s) => eye.x + (camera.position.x - eye.x) * THREE.MathUtils.clamp(s, 0, 1);
  const sMid = (tz - eye.z) / dz;
  return (
    yAt(sFar) < CANOPY_TOP * k &&
    yAt(sNear) > CANOPY_BOTTOM * k &&
    Math.abs(xAt(sMid) - tx) < r
  );
}

// Grass tufts: three thin blades, lit as if facing up so they match the ground,
// darker at the root and lighter at the tip. Each blade is two triangles with
// opposite winding (rather than DoubleSide, which would flip the back face's
// normal downward and render it black).
function makeTuftGeometry(rand) {
  const pos = [];
  const col = [];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI + rand(-0.3, 0.3);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ox = rand(-0.06, 0.06);
    const oz = rand(-0.06, 0.06);
    const w = 0.05;
    const h = rand(0.26, 0.4);
    const lean = rand(-0.08, 0.08);
    const left = [ox - w * ca, 0, oz - w * sa];
    const right = [ox + w * ca, 0, oz + w * sa];
    const tip = [ox + lean * -sa, h, oz + lean * ca];
    pos.push(...left, ...right, ...tip, ...right, ...left, ...tip);
    for (let side = 0; side < 2; side++) col.push(0.55, 0.65, 0.5, 0.55, 0.65, 0.5, 1.1, 1.15, 0.9);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

const FLOWER_COLORS = [0xffffff, 0xffe14d, 0xff7eb6, 0xb58cff, 0xff6b4a];

// wilds: where the trees and rocks stand (shared/wilds.js growWilds, as the
// server sent them)
export function buildWorld(map, wilds = { trees: [], rocks: [] }) {
  const rng = mulberry32(map.seed);
  const rand = (min, max) => min + rng() * (max - min);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const H = map.half;
  const root = new THREE.Group();
  const platforms = []; // AABBs the player can stand on / bump into
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();

  function addCollider({ x, y, z, w, h, d }, extra = {}) {
    const box = {
      center: new THREE.Vector3(x, y, z),
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ...extra,
    };
    platforms.push(box);
    return box;
  }

  // (a set piece's, when it is built afresh: the pens, when they grow)
  function removeCollider(box) {
    const i = platforms.indexOf(box);
    if (i >= 0) platforms.splice(i, 1);
  }

  function addBox({ x, y, z, w, h, d, color = 0x6b8e23, cap = null }) {
    const mesh = new THREE.Mesh(roughBox(x, y, z, w, h, d, color), roughMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (cap) {
      const top = new THREE.Mesh(
        roughBox(x, y, z, w + 0.12, 0.2, d + 0.12, CAP_COLORS[cap], { push: 0.03, dark: 0.3, layers: 0 }),
        turfMat
      );
      top.position.set(x, y + h / 2 - 0.095, z);
      top.castShadow = true;
      top.receiveShadow = true;
      root.add(top);
    }
    return addCollider({ x, y, z, w, h, d });
  }

  // ---------- Ground ----------
  const tileGrid = new Map(); // "gx,gz" -> tile type, land only
  for (let gx = -H; gx <= H; gx++) {
    for (let gz = -H; gz <= H; gz++) {
      const type = map.tileType(gx, gz);
      if (type) tileGrid.set(`${gx},${gz}`, type);
    }
  }
  const tileAt = (x, z) => tileGrid.get(tileKeyFor(x, z));
  const floorOf = (type) => map.floors?.[type] ?? 0;

  // The earth under the tiles, and what you stand on: one box per run of
  // land tiles at the same height along each row
  const runs = [];
  for (let gz = -H; gz <= H; gz++) {
    let start = null;
    let floor = 0;
    for (let gx = -H; gx <= H + 1; gx++) {
      const type = tileGrid.get(`${gx},${gz}`);
      const f = type ? floorOf(type) : null;
      if (start !== null && f !== floor) {
        runs.push([start, gx - 1, gz, floor]);
        start = null;
      }
      if (type && start === null) {
        start = gx;
        floor = f;
      }
    }
  }
  const earth = new THREE.InstancedMesh(earthGeo, earthMat, runs.length);
  earth.receiveShadow = true;
  runs.forEach(([a, b, gz, floor], i) => {
    const w = (b - a + 1) * TILE_SIZE;
    const x = ((a + b) / 2) * TILE_SIZE;
    m.compose(v.set(x, floor - 0.5, gz * TILE_SIZE), q.identity(), s.set(w, 1, TILE_SIZE));
    earth.setMatrixAt(i, m);
    addCollider({ x, y: floor - 0.5, z: gz * TILE_SIZE, w, h: 1, d: TILE_SIZE }, { ground: true });
  });
  root.add(earth);

  // Each tile's own color, a little varied, and how high it sits: what a
  // stone slab on it looks like (see The ground's surface)
  const tileLook = new Map(); // "gx,gz" -> { color, top }
  for (const [key, type] of tileGrid) {
    const style = map.tileStyles[type];
    const top = rand(...style.top);
    const color = new THREE.Color(style.color).offsetHSL(0, 0, rand(-style.jitter, style.jitter));
    tileLook.set(key, { color, top });
  }

  for (const p of map.platforms ?? []) addBox(p);

  // Every place a tree or rock may stand in, by 4x4 squares: [x, z, r]
  const WILD_CELL = 4;
  const wildCell = (x, z) => `${Math.floor(x / WILD_CELL)},${Math.floor(z / WILD_CELL)}`;
  const wildPlaces = new Map();
  for (const [list, room] of [[wilds.trees, (t) => 0.35 * t.scale], [wilds.rocks, (r) => 0.9 * r.size]]) {
    for (const thing of list) {
      for (const [x, z] of thing.sites) {
        const key = wildCell(x, z);
        if (!wildPlaces.has(key)) wildPlaces.set(key, []);
        wildPlaces.get(key).push([x, z, room(thing)]);
      }
    }
  }
  function nearWild(x, z, margin) {
    const cx = Math.floor(x / WILD_CELL);
    const cz = Math.floor(z / WILD_CELL);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        for (const [px, pz, r] of wildPlaces.get(`${i},${j}`) ?? []) if (Math.hypot(x - px, z - pz) < r + margin) return true;
      }
    }
    return false;
  }

  // Is this spot a good place for decoration? On a tile where things grow,
  // clear of platforms' footprints, the places the map keeps clear, and
  // every place a tree or rock may stand in.
  function isOpenGround(x, z, margin = 0) {
    if (!map.decorTypes.has(tileAt(x, z))) return false;
    for (const box of platforms) {
      if (box.ground || box.grows) continue;
      if (x > box.min.x - margin && x < box.max.x + margin && z > box.min.z - margin && z < box.max.z + margin) return false;
    }
    for (const [kx, kz, r] of map.keepClear) {
      if (Math.hypot(x - kx, z - kz) < r + margin) return false;
    }
    return !nearWild(x, z, margin);
  }

  // Scatter by rejection sampling: random spots, kept only if far enough
  // from earlier placements and the rule for that kind of decoration passes.
  function scatter(count, minDist, accept, place, tries = count * 40) {
    const placed = [];
    for (let n = 0; n < tries && placed.length < count; n++) {
      const x = rand(-H, H);
      const z = rand(-H, H);
      if (!accept(x, z)) continue;
      if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < minDist)) continue;
      placed.push([x, z]);
      place(x, z);
    }
  }

  const ctx = { root, rng, rand, pick, tileAt, isOpenGround, scatter, addBox, addCollider, removeCollider };

  // The map's own set pieces (they claim their ground before anything grows)
  const animate = map.build?.(ctx);

  // ---------- Grass and flowers ----------
  // Instanced ground foliage per tile, so tilling a tile can clear what grows on it
  const foliageByTile = new Map(); // "gx,gz" -> [{ mesh, index }]
  function trackFoliage(x, z, mesh, index) {
    const key = tileKeyFor(x, z);
    if (!foliageByTile.has(key)) foliageByTile.set(key, []);
    foliageByTile.get(key).push({ mesh, index });
  }

  {
    // Gather placements first so each InstancedMesh is allocated at its exact size
    const tufts = []; // [x, z, [light min, max], [hue min, max]]
    const flowers = [];
    for (const [key, type] of tileGrid) {
      const f = map.foliage[type];
      if (!f) continue;
      const [gx, gz] = key.split(',').map(Number);
      const lush = meadowNoise(gx, gz);
      const tuftCount = Math.floor(rand(0, f.tufts + lush * f.lushTufts));
      for (let n = 0; n < tuftCount; n++) {
        const x = gx + rand(-0.45, 0.45);
        const z = gz + rand(-0.45, 0.45);
        if (isOpenGround(x, z)) tufts.push([x, z, f.light ?? [0.38, 0.5], f.hue ?? [0.24, 0.3]]);
      }
      if (lush > f.flowerLush && rng() < f.flowerChance) {
        const x = gx + rand(-0.4, 0.4);
        const z = gz + rand(-0.4, 0.4);
        if (isOpenGround(x, z)) flowers.push([x, z]);
      }
    }

    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x6fb043, roughness: 1, vertexColors: true });
    addWind(tuftMat, 0.25);
    const tuftMesh = new THREE.InstancedMesh(makeTuftGeometry(rand), tuftMat, tufts.length);
    tuftMesh.receiveShadow = true;
    tufts.forEach(([x, z, light, hue], i) => {
      q.setFromAxisAngle(up, rand(0, Math.PI * 2));
      const k = rand(0.7, 1.3);
      m.compose(v.set(x, 0.02, z), q, s.set(k, k, k));
      tuftMesh.setMatrixAt(i, m);
      tuftMesh.setColorAt(i, c.setHSL(rand(...hue), 0.5, rand(...light)));
      trackFoliage(x, z, tuftMesh, i);
    });
    root.add(tuftMesh);

    // Flowers: green stems plus colored heads, two InstancedMeshes sharing matrices
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4).translate(0, 0.15, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.065, 0).translate(0, 0.31, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 1 });
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true });
    addWind(stemMat, 0.18);
    addWind(headMat, 0.18);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowers.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, flowers.length);
    const colors = map.flowerColors ?? FLOWER_COLORS;
    flowers.forEach(([x, z], i) => {
      const k = rand(0.8, 1.25);
      m.compose(v.set(x, 0.02, z), q.setFromAxisAngle(up, rand(0, Math.PI * 2)), s.set(k, k, k));
      stems.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      heads.setColorAt(i, c.setHex(pick(colors)));
      trackFoliage(x, z, stems, i);
      trackFoliage(x, z, heads, i);
    });
    root.add(stems, heads);
  }

  // Tilling (or building) hides a tile's foliage (scaled to nothing); its
  // matrices are kept in hiddenFoliage so the ground can grow back
  // (restoreFoliage(), or restoreFoliage(key) for one tile).
  let hiddenFoliage = [];
  function clearFoliageOnTile(key) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const entry of foliageByTile.get(key) || []) {
      entry.key = key;
      entry.matrix = new THREE.Matrix4();
      entry.mesh.getMatrixAt(entry.index, entry.matrix);
      entry.mesh.setMatrixAt(entry.index, zero);
      entry.mesh.instanceMatrix.needsUpdate = true;
      hiddenFoliage.push(entry);
    }
    foliageByTile.delete(key);
  }

  function restoreFoliage(key = null) {
    const back = key === null ? hiddenFoliage : hiddenFoliage.filter((entry) => entry.key === key);
    for (const entry of back) {
      entry.mesh.setMatrixAt(entry.index, entry.matrix);
      entry.mesh.instanceMatrix.needsUpdate = true;
      // (tracked again so it can be tilled away again)
      const e = new THREE.Vector3().setFromMatrixPosition(entry.matrix);
      trackFoliage(e.x, e.z, entry.mesh, entry.index);
    }
    hiddenFoliage = key === null ? [] : hiddenFoliage.filter((entry) => entry.key !== key);
  }

  // ---------- Trees, bushes, rocks ----------
  // { id, group, scale, materials, fade, x, z, collider, state, ... } — fade
  // drives see-through when blocking the player; state is 'up', 'falling',
  // 'down' or 'growing' (see Felling trees). id: its place in this list, the
  // same for everyone on the island, which is how a lobby names a tree.
  const trees = [];

  // One of wilds.trees (shared/wilds.js): kind 'pine' | 'round', scale its
  // size, look what its details are drawn from (the same on every page).
  // A map may dress its trees and bushes in its own leaves (a season, say)
  const leaves = map.leafMats ?? leafMats;
  const needles = map.pineMats ?? pineMats;
  function addTree({ x, z, kind, scale, look, sites }) {
    const lr = mulberry32(look);
    const pickOwn = (arr) => arr[Math.floor(lr() * arr.length)];
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.rotation.y = lr() * Math.PI * 2;
    const k = scale;
    tree.scale.setScalar(k);
    root.add(tree);

    if (kind === 'pine') {
      // Pine: stacked cones
      const leaf = pickOwn(needles);
      addDecor(trunkGeo, trunkMat, 0, 0, 0, 1, 1.1, 1, tree);
      addDecor(coneGeo, leaf, 0, 1.3, 0, 1.05, 1, 1.05, tree);
      addDecor(coneGeo, leaf, 0, 2.0, 0, 0.8, 0.9, 0.8, tree);
      addDecor(coneGeo, leaf, 0, 2.6, 0, 0.55, 0.8, 0.55, tree);
    } else {
      // Round tree: a cluster of leafy blobs
      const leaf = pickOwn(leaves);
      addDecor(trunkGeo, trunkMat, 0, 0, 0, 1.1, 1.5, 1.1, tree);
      addDecor(blobGeo, leaf, 0, 2.1, 0, 1.0, 0.9, 1.0, tree);
      addDecor(blobGeo, leaf, 0.55, 1.8, 0.3, 0.7, 0.65, 0.7, tree);
      addDecor(blobGeo, leaf, -0.45, 1.85, -0.35, 0.75, 0.7, 0.75, tree);
    }

    // Each tree gets its own material copies so it can fade independently
    const materials = new Map();
    tree.traverse((obj) => {
      if (!obj.isMesh) return;
      if (!materials.has(obj.material)) materials.set(obj.material, obj.material.clone());
      obj.material = materials.get(obj.material);
    });
    // Trunk collider; tall enough that you can't jump up into the canopy
    const collider = addCollider({ x, y: 3, z, w: 0.5 * k, h: 6, d: 0.5 * k }, { grows: true });
    trees.push({
      id: trees.length, group: tree, scale: k, materials: [...materials.values()], fade: 1,
      x, z, collider, trunk: kind === 'pine' ? 1 : 1.1, base: tree.quaternion.clone(),
      state: 'up', t: 0, shake: 0, axis: new THREE.Vector3(1, 0, 0), stump: null,
      big: 1, from: 0.01, // (a giant is drawn `big` times its scale; growing: from this scale)
      sites: sites.map(([sx, sz]) => [sx, sz]), // (where it may grow back: see place())
    });
  }

  function addBush(x, z) {
    const leaf = pick(leaves);
    const k = rand(0.35, 0.6);
    addDecor(blobGeo, leaf, x, k * 0.6, z, k, k * 0.8, k, root);
    addDecor(blobGeo, leaf, x + k * 0.7, k * 0.45, z + rand(-0.3, 0.3), k * 0.7, k * 0.6, k * 0.7, root);
    if (rng() < 0.5) addDecor(blobGeo, leaf, x - k * 0.6, k * 0.4, z + rand(-0.3, 0.3), k * 0.6, k * 0.5, k * 0.6, root);
  }

  // { id, mesh, x, z, scale, radius, collider, state, ... }: radius is how far
  // it reaches out sideways as drawn (it is stretched, so more than its scale
  // says); state is 'up',
  // 'breaking', 'gone' or 'growing' (see Breaking rocks). id: its place in
  // this list, the same for everyone on the island, which is how a lobby
  // names a rock.
  const rocks = [];

  // One of wilds.rocks (shared/wilds.js): size (big ones are boulders and
  // get a collider), look (its shape, the same on every page)
  function addRock({ x, z, size, look, sites }) {
    const lr = mulberry32(look);
    const own = (min, max) => min + lr() * (max - min);
    const k = size;
    const rock = addDecor(rockGeo, rockMats[Math.floor(lr() * rockMats.length)], x, k * 0.3, z, k * own(1, 1.5), k * own(0.5, 0.8), k, root);
    rock.rotation.set(own(0, 0.4), own(0, Math.PI * 2), own(0, 0.4));
    const collider = k > 0.6 ? addCollider({ x, y: k * 0.35, z, w: k * 1.4, h: k * 0.7, d: k * 1.4 }, { grows: true }) : null;
    rocks.push({
      id: rocks.length, mesh: rock, x, z, scale: k, radius: Math.max(rock.scale.x, rock.scale.z) * 0.85,
      collider, base: rock.scale.clone(), baseY: rock.position.y,
      state: 'up', t: 0, shake: 0, chips: null,
      big: 1, from: 0, baseRadius: 0, // (as for trees; growing: from this much of its size)
      sites: sites.map(([sx, sz]) => [sx, sz]),
    });
  }

  for (const tree of wilds.trees) addTree(tree);
  for (const rock of wilds.rocks) addRock(rock);
  for (const rock of rocks) rock.baseRadius = rock.radius;
  // (the bushes and anything else the map scatters steer clear of them: isOpenGround)
  Object.assign(ctx, { addBush });
  map.decorate(ctx);

  // ---------- Growing back elsewhere ----------
  // A felled tree or a broken rock grows back somewhere else: each has a few
  // places (sites, from the server: the first is where it grew at the start).
  // Which place it stands in is its lobby's or farm's count of how often it
  // grew back (see place()).

  // Put a tree or rock in its place number n (a count of how often it grew
  // back; it goes round its places), or the next one canGrow(x, z) allows,
  // if the map has that rule (the farm: not on tilled soil or anything built).
  function place(thing, n) {
    const { sites } = thing;
    let [x, z] = sites[0];
    for (let i = 0; i < sites.length; i++) {
      const site = sites[(n + i) % sites.length];
      if (!map.canGrow || map.canGrow(site[0], site[1])) {
        [x, z] = site;
        break;
      }
    }
    const dx = x - thing.x;
    const dz = z - thing.z;
    if (!dx && !dz) return;
    thing.x = x;
    thing.z = z;
    for (const box of [thing.collider].filter(Boolean)) {
      for (const v of [box.min, box.max, box.center]) {
        v.x += dx;
        v.z += dz;
      }
    }
    const obj = thing.group ?? thing.mesh;
    obj.position.x = x;
    obj.position.z = z;
    thing.stump?.position.set(x, 0, z);
  }

  // ---------- The ground's surface ----------
  // One mesh for every tile, colored by what the map says the ground is at
  // each vertex rather than per tile, so a path winds along its own curve
  // instead of in grid steps, and grass meets it and the sand without hard
  // tile lines. Each tile is a 5x5 patch of vertices, a quarter tile apart;
  // a vertex mixes the kinds of ground at it and the eight points around it
  // (a quarter tile away), which softens the edges. A point the map puts on
  // another floor (or in the sea) counts as its tile's own kind. The ground
  // is shaded a little darker right around whatever stands on it, which is
  // why it is laid after the decorations.
  // Stone tiles get a slab each on top: a plaza should look paved.
  {
    const kindColors = {}; // the plain color of each kind of ground
    for (const [type, style] of Object.entries(map.tileStyles)) {
      kindColors[type] = new THREE.Color(style.color);
      if (type === 'stone') kindColors[type].offsetHSL(0, -0.03, -0.07); // the gaps between the slabs
    }
    const kinds = new Map(); // "qx,qz" (in quarter tiles) -> the map's kind of ground there
    const kindAt = (qx, qz) => {
      const key = `${qx},${qz}`;
      if (!kinds.has(key)) kinds.set(key, map.tileType(qx / 4, qz / 4));
      return kinds.get(key);
    };

    const standing = platforms.filter((box) => !box.ground);
    // how much the things standing at (x, z) shade the ground there, 0..1
    const contactShade = (x, y, z) => {
      let shade = 0;
      for (const box of standing) {
        if (box.min.y > y + 0.2 || box.max.y < y) continue;
        const r = 0.35 + 0.25 * Math.min(box.max.x - box.min.x, box.max.z - box.min.z, 1.6);
        const dx = Math.max(box.min.x - x, 0, x - box.max.x);
        if (dx >= r) continue;
        const dz = Math.max(box.min.z - z, 0, z - box.max.z);
        if (dz >= r) continue;
        const near = 1 - Math.min(Math.hypot(dx, dz) / r, 1);
        shade = Math.max(shade, near * near);
      }
      return shade;
    };

    const pos = [];
    const col = [];
    const index = [];
    const tint = new THREE.Color();
    const slabs = [];
    for (const [key, type] of tileGrid) {
      const [gx, gz] = key.split(',').map(Number);
      const floor = floorOf(type);
      const first = pos.length / 3;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const ox = (j - 2) / 4;
          const oz = (i - 2) / 4;
          const x = (gx + ox) * TILE_SIZE;
          const z = (gz + oz) * TILE_SIZE;
          const qx = gx * 4 + j - 2;
          const qz = gz * 4 + i - 2;
          tint.setRGB(0, 0, 0);
          let lush = 0;
          let jitter = 0;
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              let kind = kindAt(qx + dj, qz + di);
              if (!kind || floorOf(kind) !== floor) kind = type;
              const w = (di ? 1 : 2) * (dj ? 1 : 2) / 16;
              tint.add(c.copy(kindColors[kind]).multiplyScalar(w));
              if (map.tileStyles[kind].lush) lush += w;
              jitter += map.tileStyles[kind].jitter * w;
            }
          }
          const shade = 1 - meadowNoise(x, z) * 0.1 * lush + (hash2(x, z) - 0.5) * jitter * 5;
          tint.multiplyScalar(shade * (1 - 0.4 * contactShade(x, floor, z)));
          pos.push(x, floor + GROUND_LIFT, z);
          col.push(tint.r, tint.g, tint.b);
        }
      }
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const a = first + i * 5 + j;
          index.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
        }
      }
      if (type === 'stone') slabs.push([gx, gz, floor]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(index);
    const ground = new THREE.Mesh(geo, groundMat);
    ground.receiveShadow = true;
    root.add(ground);

    const stones = new THREE.InstancedMesh(slabGeo, slabMat, slabs.length);
    stones.receiveShadow = true;
    slabs.forEach(([gx, gz, floor], i) => {
      const { color, top } = tileLook.get(`${gx},${gz}`);
      const nx = hash2(gx, gz) - 0.5;
      const nz = hash2(gz, gx) - 0.5;
      q.setFromAxisAngle(up, nx * 0.16);
      m.compose(v.set((gx + nx * 0.05) * TILE_SIZE, floor + top - 0.03, (gz + nz * 0.05) * TILE_SIZE), q, s.set(1, 1, 1));
      stones.setMatrixAt(i, m);
      stones.setColorAt(i, color);
    });
    root.add(stones);
  }

  // ---------- Shallows and foam along the shore ----------
  // Strips on the sea along every tile edge that faces open water, with a
  // corner piece round each outside corner of the coast: lighter water
  // reaching out from the island, and foam over it. Vertex alpha: 1 at the
  // shore, 0 out at sea.
  const sea = (gx, gz) => !tileGrid.has(`${gx},${gz}`);
  function shoreStrip(width, color, y, material) {
    const pos = [];
    const col = [];
    const quad = (corners) => {
      // corners: four [x, z, alpha] going round
      for (const k of [0, 2, 1, 0, 3, 2]) {
        const [x, z, a] = corners[k];
        pos.push(x * TILE_SIZE, y, z * TILE_SIZE);
        col.push(color.r, color.g, color.b, a);
      }
    };
    const W = width;
    for (const key of tileGrid.keys()) {
      const [gx, gz] = key.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!sea(gx + dx, gz + dz)) continue;
        // the edge runs along (tx, tz), from -0.5 to 0.5 of the tile
        const [tx, tz] = [-dz, dx];
        const ex = gx + dx / 2;
        const ez = gz + dz / 2;
        quad([
          [ex - tx / 2, ez - tz / 2, 1],
          [ex - tx / 2 + dx * W, ez - tz / 2 + dz * W, 0],
          [ex + tx / 2 + dx * W, ez + tz / 2 + dz * W, 0],
          [ex + tx / 2, ez + tz / 2, 1],
        ]);
        // round the corner, where the coast turns away
        if (sea(gx + tx, gz + tz) && sea(gx + dx + tx, gz + dz + tz)) {
          const cx = ex + tx / 2;
          const cz = ez + tz / 2;
          quad([
            [cx, cz, 1],
            [cx + dx * W, cz + dz * W, 0],
            [cx + (dx + tx) * W * 0.7, cz + (dz + tz) * W * 0.7, 0],
            [cx + tx * W, cz + tz * W, 0],
          ]);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    return new THREE.Mesh(geo, material);
  }
  const shallows = shoreStrip(SHALLOWS_WIDTH, SHALLOWS_COLOR, SEA_LEVEL + 0.035, shallowsMat);
  const foam = shoreStrip(FOAM_WIDTH, FOAM_COLOR, SEA_LEVEL + 0.04, foamMat);
  shallows.renderOrder = 1; // over the sea
  foam.renderOrder = 2; // and over the shallows
  root.add(shallows, foam);

  // ---------- Felling trees ----------
  const moving = new Set(); // trees in the middle of shaking, falling or growing

  // the way a tree tips: away from `from` (a position), or any way at all
  function tipAway(tree, from) {
    let dx = from ? tree.x - from.x : rand(-1, 1);
    let dz = from ? tree.z - from.z : rand(-1, 1);
    const len = Math.hypot(dx, dz) || 1;
    // rotating about (dz, 0, -dx) tips the top toward (dx, dz)
    tree.axis.set(dz / len, 0, -dx / len);
  }

  function setTrunk(tree, standing) {
    const box = tree.collider;
    box.max.y = standing ? 6 : STUMP_H * tree.scale * tree.big;
    box.center.y = (box.min.y + box.max.y) / 2;
  }

  // a hit with the axe: a shiver up the trunk
  function shakeTree(id, from) {
    const tree = trees[id];
    if (tree?.state !== 'up') return;
    tipAway(tree, from);
    tree.shake = 1;
    tree.t = 0;
    moving.add(tree);
  }

  // instant: it is simply down already (it was felled before we came)
  function fellTree(id, from, { instant = false } = {}) {
    const tree = trees[id];
    if (!tree || tree.state === 'falling' || tree.state === 'down') return;
    if (!tree.stump) {
      tree.stump = new THREE.Mesh(stumpGeo, stumpMats);
      tree.stump.position.set(tree.x, 0, tree.z);
      tree.stump.castShadow = tree.stump.receiveShadow = true;
      root.add(tree.stump);
    }
    const k = tree.scale * tree.big; // (a giant leaves a giant stump)
    tree.stump.scale.set(k * tree.trunk, k, k * tree.trunk);
    tree.stump.visible = true;
    setTrunk(tree, false);
    tipAway(tree, from);
    tree.state = instant ? 'down' : 'falling';
    tree.t = 0;
    tree.group.visible = !instant;
    if (instant) moving.delete(tree);
    else moving.add(tree);
  }

  // n: how often it has grown back (which of its places it is in; see
  // Growing back elsewhere)
  function regrowTree(id, { instant = false, n = 0 } = {}) {
    const tree = trees[id];
    if (!tree || tree.state === 'up' || tree.state === 'growing') return;
    place(tree, n);
    tree.big = 1; // (a giant comes back as itself)
    tree.from = 0.01;
    fitBox(tree.collider, tree.x, tree.z, 0.5 * tree.scale);
    setTrunk(tree, true);
    tree.stump.visible = false;
    tree.group.visible = true;
    tree.group.quaternion.copy(tree.base);
    tree.group.scale.setScalar(instant ? tree.scale : 0.01);
    tree.state = instant ? 'up' : 'growing';
    tree.t = 0;
    tree.shake = 0;
    if (instant) moving.delete(tree);
    else moving.add(tree);
  }

  // ---------- Breaking rocks ----------
  const crumbling = new Set(); // rocks shaking, breaking or surfacing

  function setBoulder(rock, standing) {
    const box = rock.collider;
    if (!box) return;
    const k = rock.scale * rock.big;
    box.max.y = standing && k > 0.6 ? k * 0.7 : box.min.y; // (broken, or a small one: nothing to bump into)
    box.center.y = (box.min.y + box.max.y) / 2;
  }

  // a hit with the pickaxe: a jolt
  function shakeRock(id) {
    const rock = rocks[id];
    if (rock?.state !== 'up') return;
    rock.shake = 1;
    rock.t = 0;
    crumbling.add(rock);
  }

  // instant: it is simply gone already (it was broken before we came)
  function breakRock(id, { instant = false } = {}) {
    const rock = rocks[id];
    if (!rock || rock.state === 'breaking' || rock.state === 'gone') return;
    setBoulder(rock, false);
    rock.state = instant ? 'gone' : 'breaking';
    rock.t = 0;
    rock.mesh.visible = !instant;
    if (instant) return crumbling.delete(rock);
    // chips fly off it
    if (!rock.chips) {
      rock.chips = Array.from({ length: CHIPS }, () => {
        const chip = new THREE.Mesh(rockGeo, rock.mesh.material);
        chip.castShadow = true;
        root.add(chip);
        return { mesh: chip, v: new THREE.Vector3() };
      });
    }
    for (const chip of rock.chips) {
      const a = Math.random() * Math.PI * 2;
      const out = 1.2 + Math.random() * 1.6;
      chip.v.set(Math.cos(a) * out, 3 + Math.random() * 2.5, Math.sin(a) * out);
      chip.mesh.position.set(rock.x, (rock.baseY + rock.scale * 0.3) * rock.big, rock.z);
      chip.mesh.scale.setScalar(Math.max(0.05, rock.scale * rock.big * (0.18 + Math.random() * 0.14)));
      chip.mesh.visible = true;
    }
    crumbling.add(rock);
  }

  function regrowRock(id, { instant = false, n = 0 } = {}) {
    const rock = rocks[id];
    if (!rock || rock.state === 'up' || rock.state === 'growing') return;
    place(rock, n);
    rock.big = 1;
    rock.from = 0;
    rock.radius = rock.baseRadius;
    fitRock(rock);
    for (const chip of rock.chips ?? []) chip.mesh.visible = false;
    rock.mesh.visible = true;
    rock.mesh.scale.copy(rock.base).multiplyScalar(instant ? 1 : 0.01);
    rock.mesh.position.y = rock.baseY;
    rock.state = instant ? 'up' : 'growing';
    rock.t = 0;
    rock.shake = 0;
    if (instant) crumbling.delete(rock);
    else crumbling.add(rock);
  }

  // A rock's collider as big as it is drawn (a giant one gets one, even a pebble's)
  function fitRock(rock) {
    const k = rock.scale * rock.big;
    if (!rock.collider) {
      if (k <= 0.6) return;
      rock.collider = addCollider({ x: rock.x, y: 0, z: rock.z, w: 0, h: 0, d: 0 }, { grows: true });
    }
    fitBox(rock.collider, rock.x, rock.z, k * 1.4);
    setBoulder(rock, rock.state === 'up' || rock.state === 'growing');
  }

  // ---------- Giants ----------
  // A standing tree or rock grows into a giant (shared/giants.js): it is drawn
  // giantScale times its size, and stays that till it comes down. instant:
  // it is simply a giant already (it was before we came).
  function makeGiant(kind, id, { instant = false } = {}) {
    if (kind === 'tree') {
      const tree = trees[id];
      if (!tree || tree.big > 1 || (tree.state !== 'up' && tree.state !== 'growing')) return;
      const was = tree.scale;
      tree.big = giantScale('tree', tree.scale);
      fitBox(tree.collider, tree.x, tree.z, 0.5 * tree.scale * tree.big);
      if (instant) {
        tree.state = 'up';
        tree.group.scale.setScalar(tree.scale * tree.big);
        moving.delete(tree);
      } else if (tree.state === 'up') {
        Object.assign(tree, { state: 'growing', from: was, t: 0, shake: 0 });
        tree.group.quaternion.copy(tree.base);
        moving.add(tree);
      }
    } else {
      const rock = rocks[id];
      if (!rock || rock.big > 1 || (rock.state !== 'up' && rock.state !== 'growing')) return;
      rock.big = giantScale('rock', rock.scale);
      rock.radius = rock.baseRadius * rock.big;
      rock.mesh.position.set(rock.x, rock.baseY * rock.big, rock.z);
      fitRock(rock);
      if (instant) {
        rock.state = 'up';
        rock.mesh.scale.copy(rock.base).multiplyScalar(rock.big);
        crumbling.delete(rock);
      } else if (rock.state === 'up') {
        Object.assign(rock, { state: 'growing', from: 1 / rock.big, t: 0, shake: 0 });
        crumbling.add(rock);
      }
    }
  }

  // A giant standing as itself again, at once (starting the island's picture over)
  function unGiant(kind, thing) {
    if (thing.big <= 1) return;
    const standing = thing.state === 'up' || thing.state === 'growing';
    thing.big = 1;
    if (kind === 'tree') {
      thing.from = 0.01;
      fitBox(thing.collider, thing.x, thing.z, 0.5 * thing.scale);
      if (!standing) return;
      thing.state = 'up';
      thing.group.scale.setScalar(thing.scale);
      moving.delete(thing);
    } else {
      thing.from = 0;
      thing.radius = thing.baseRadius;
      if (standing) {
        thing.state = 'up';
        thing.mesh.scale.copy(thing.base);
        thing.mesh.position.set(thing.x, thing.baseY, thing.z);
        crumbling.delete(thing);
      }
      fitRock(thing);
    }
  }

  // Where a giant's health bar goes (null: it isn't standing)
  function giantTop(kind, id) {
    const thing = kind === 'tree' ? trees[id] : rocks[id];
    if (!thing || thing.big <= 1 || thing.state === 'down' || thing.state === 'gone') return null;
    return new THREE.Vector3(thing.x, kind === 'tree' ? 3.4 : thing.scale * thing.big * 0.75 + 0.6, thing.z);
  }

  function updateRocks(dt) {
    for (const rock of crumbling) {
      rock.t += dt;
      const { mesh } = rock;
      const base = _rb.copy(rock.base).multiplyScalar(rock.big);
      if (rock.state === 'up') {
        rock.shake *= Math.exp(-9 * dt);
        mesh.position.x = rock.x + Math.sin(rock.t * 55) * 0.04 * rock.shake * Math.min(1, rock.scale * 2);
        if (rock.shake < 0.01) {
          mesh.position.x = rock.x;
          crumbling.delete(rock);
        }
      } else if (rock.state === 'breaking') {
        const p = Math.min(rock.t / ROCK_BREAK, 1);
        mesh.scale.copy(base).multiplyScalar(Math.max(0.01, 1 - p * p));
        mesh.position.set(rock.x, (rock.baseY - p * rock.scale * 0.2) * rock.big, rock.z);
        for (const chip of rock.chips) {
          chip.v.y -= 22 * dt;
          chip.mesh.position.addScaledVector(chip.v, dt);
          if (chip.mesh.position.y < 0.03) {
            chip.mesh.position.y = 0.03;
            chip.v.multiplyScalar(0.4);
            chip.v.y = Math.abs(chip.v.y) * 0.3;
          }
          chip.mesh.rotation.x += dt * 9;
          chip.mesh.rotation.z += dt * 7;
          if (rock.t > CHIP_LIFE - 0.2) chip.mesh.scale.multiplyScalar(Math.exp(-14 * dt));
        }
        if (p >= 1 && rock.t >= CHIP_LIFE) {
          rock.state = 'gone';
          mesh.visible = false;
          for (const chip of rock.chips) chip.mesh.visible = false;
          crumbling.delete(rock);
        }
      } else if (rock.state === 'growing') {
        const p = Math.min(rock.t / ROCK_GROW, 1);
        mesh.scale.copy(base).multiplyScalar(Math.max(0.01, rock.from + (1 - rock.from) * easeOutBack(p)));
        if (p >= 1) {
          rock.state = 'up';
          crumbling.delete(rock);
        }
      } else {
        crumbling.delete(rock);
      }
    }
  }

  function updateTrees(dt) {
    updateRocks(dt);
    for (const tree of moving) {
      tree.t += dt;
      const { group, base, axis } = tree;
      const k = tree.scale * tree.big;
      if (tree.state === 'falling') {
        // Slow at first, then faster, with a little bounce as it lands
        const p = Math.min(tree.t / TREE_FALL, 1);
        const landed = tree.t - TREE_FALL;
        const bounce = landed > 0 ? Math.sin(Math.min(landed / 0.25, 1) * Math.PI) * 0.12 : 0;
        group.quaternion.setFromAxisAngle(axis, (Math.PI / 2 - 0.1) * p * p - bounce).multiply(base);
        if (landed > 0.25) {
          const q = Math.min((landed - 0.25) / TREE_GONE, 1);
          group.scale.setScalar(k * (1 - q * q));
          if (q >= 1) {
            tree.state = 'down';
            group.visible = false;
            moving.delete(tree);
          }
        }
      } else if (tree.state === 'growing') {
        const p = Math.min(tree.t / TREE_GROW, 1);
        group.scale.setScalar(Math.max(0.01, tree.from + (k - tree.from) * easeOutBack(p)));
        if (p >= 1) {
          tree.state = 'up';
          moving.delete(tree);
        }
      } else if (tree.state === 'up') {
        tree.shake *= Math.exp(-6 * dt);
        group.quaternion.copy(base);
        if (tree.shake < 0.01) {
          moving.delete(tree);
        } else {
          group.quaternion.premultiply(_q.setFromAxisAngle(axis, Math.sin(tree.t * 32) * 0.05 * tree.shake));
        }
      } else {
        moving.delete(tree);
      }
    }
  }

  const _eye = new THREE.Vector3();
  return {
    name: map.name,
    root,
    platforms,
    tileGrid,
    spawn: map.spawn,
    trees,
    shakeTree,
    fellTree,
    regrowTree,
    updateTrees, // (and the rocks)
    rocks,
    shakeRock,
    breakRock,
    regrowRock,
    makeGiant,
    giantTop,
    // every rock whole again, at once (arriving on an island we were on
    // before), each in its place as counted in moved ([[id, n]], see Growing back elsewhere)
    restoreAllRocks(moved = []) {
      const at = new Map(moved);
      for (const rock of rocks) {
        unGiant('rock', rock);
        regrowRock(rock.id, { instant: true });
        place(rock, at.get(rock.id) ?? 0);
      }
    },
    // every tree standing again, at once (the same way)
    standAllTrees(moved = []) {
      const at = new Map(moved);
      for (const tree of trees) {
        unGiant('tree', tree);
        regrowTree(tree.id, { instant: true });
        place(tree, at.get(tree.id) ?? 0);
      }
    },
    tileAt,
    clearFoliageOnTile,
    restoreFoliage,
    // eye: the player's chest; trees in front of it fade out
    updateTreeFade(dt, eye, camera) {
      const k = damp(8, dt);
      _eye.copy(eye);
      for (const tree of trees) {
        const blocking = tree.state === 'up' && blocksView(tree, _eye, camera);
        tree.fade += ((blocking ? 0.25 : 1) - tree.fade) * k;
        const transparent = tree.fade < 0.99;
        for (const mat of tree.materials) {
          mat.opacity = tree.fade;
          if (mat.transparent !== transparent) {
            // Toggling transparency changes the shader variant (opaque materials
            // force alpha to 1), so it must be recompiled
            mat.transparent = transparent;
            mat.depthWrite = !transparent;
            mat.needsUpdate = true;
          }
        }
      }
    },
    update(t) {
      animate?.(t);
    },
    // Let go of its GPU buffers and shaders, once it is out of the scene for
    // good. (Some geometries and materials are shared between worlds: three.js
    // uploads those again the next time they are drawn.)
    dispose() {
      root.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry.dispose();
        for (const mat of [obj.material].flat()) mat.dispose();
        if (obj.isInstancedMesh) obj.dispose();
      });
    },
  };
}
