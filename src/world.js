import * as THREE from 'three';
import { damp } from './character.js';
import { mulberry32 } from '../shared/worldgen.js';

// (the islands' geometry helpers live with the islands, for the server too)
export { mulberry32, distToSegment, distToPaths } from '../shared/worldgen.js';

// ---------- Worlds ----------
// An island built from a map definition (maps.js): the ground as a grid of
// 1x1 tiles (the same grid the hoe tills on), the earth under them, platforms,
// grass and flowers, trees, bushes and rocks, plus anything special the map
// builds itself. Everything is placed with a seeded RNG so a map looks the
// same on every load, and for everyone in a lobby.
//
// buildWorld() returns everything the game needs from a world: its root group
// (added to the scene while you are there), its colliders, its tiles, and the
// per-frame bits (tree fading, the map's own animation).

export const TILE_SIZE = 1;

export function tileKeyFor(x, z) {
  return `${Math.round(x / TILE_SIZE)},${Math.round(z / TILE_SIZE)}`;
}

// Cheap smooth "noise" for meadow patches (lush grass, flower fields)
export const meadowNoise = (x, z) =>
  Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin((x + z) * 0.11 + 1.3) * 0.4;

// Wind sway for grass and flowers, done in the vertex shader so thousands of
// instances cost nothing on the CPU. Sway scales with height above the base.
// One clock for every world (main.js sets it).
export const windTime = { value: 0 };
export function addWind(material, strength) {
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

// ---------- The decor kit: a few shared geometries/materials, many meshes ----------
export const foliageMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
export const trunkMat = foliageMat(0x6b4423);
export const leafMats = [0x3f8a3a, 0x4f9e3c, 0x2f7a45, 0x5aa83f].map(foliageMat);
export const pineMats = [0x2c6b3f, 0x24603a, 0x34784a].map(foliageMat);
export const rockMats = [0x8d8d88, 0x7a7a76, 0x9e9a90].map(foliageMat);

export const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0);
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
const CAP_MATS = {
  grass: new THREE.MeshStandardMaterial({ color: 0x5d9b3a, roughness: 1 }),
  moss: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 1 }),
};
const earthMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
const unitBox = new THREE.BoxGeometry(1, 1, 1);

// Fade trees whose canopy sits on the line of sight from the camera to the
// player. Canopies are treated as boxes around the trunk: CANOPY_RADIUS wide
// and spanning CANOPY_BOTTOM..CANOPY_TOP in height (all times tree scale).
const CANOPY_RADIUS = 1.3;
const CANOPY_BOTTOM = 0.8;
const CANOPY_TOP = 3.4;

function blocksView(tree, eye, camera) {
  const { x: tx, z: tz } = tree.group.position;
  const k = tree.scale;
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

export function buildWorld(map) {
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

  function addBox({ x, y, z, w, h, d, color = 0x6b8e23, cap = null }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (cap) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.2, d + 0.12), CAP_MATS[cap]);
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
  const earth = new THREE.InstancedMesh(unitBox, earthMat, runs.length);
  earth.receiveShadow = true;
  runs.forEach(([a, b, gz, floor], i) => {
    const w = (b - a + 1) * TILE_SIZE;
    const x = ((a + b) / 2) * TILE_SIZE;
    m.compose(v.set(x, floor - 0.5, gz * TILE_SIZE), q.identity(), s.set(w, 1, TILE_SIZE));
    earth.setMatrixAt(i, m);
    addCollider({ x, y: floor - 0.5, z: gz * TILE_SIZE, w, h: 1, d: TILE_SIZE }, { ground: true });
  });
  root.add(earth);

  {
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.985, 0.2, TILE_SIZE * 0.985);
    const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), tileGrid.size);
    tiles.receiveShadow = true;
    let i = 0;
    for (const [key, type] of tileGrid) {
      const [gx, gz] = key.split(',').map(Number);
      const style = map.tileStyles[type];
      const top = rand(...style.top); // tiny height variation reads as hand-laid tiles
      m.makeTranslation(gx * TILE_SIZE, floorOf(type) + top - 0.1, gz * TILE_SIZE);
      tiles.setMatrixAt(i, m);
      c.setHex(style.color);
      if (style.lush) c.offsetHSL(meadowNoise(gx, gz) * 0.03, 0, meadowNoise(gx, gz) * -0.05);
      c.offsetHSL(0, 0, rand(-style.jitter, style.jitter));
      tiles.setColorAt(i, c);
      i++;
    }
    root.add(tiles);
  }

  for (const p of map.platforms ?? []) addBox(p);

  // Is this spot a good place for decoration? On a tile where things grow,
  // clear of platforms' footprints and the places the map keeps clear.
  function isOpenGround(x, z, margin = 0) {
    if (!map.decorTypes.has(tileAt(x, z))) return false;
    for (const box of platforms) {
      if (box.ground) continue;
      if (x > box.min.x - margin && x < box.max.x + margin && z > box.min.z - margin && z < box.max.z + margin) return false;
    }
    for (const [kx, kz, r] of map.keepClear) {
      if (Math.hypot(x - kx, z - kz) < r + margin) return false;
    }
    return true;
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

  const ctx = { root, rng, rand, pick, tileAt, isOpenGround, scatter, addBox, addCollider };

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

  // Tilling hides a tile's foliage (scaled to nothing); its matrices are kept
  // in hiddenFoliage so the ground can grow back (restoreFoliage).
  const hiddenFoliage = [];
  function clearFoliageOnTile(key) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const entry of foliageByTile.get(key) || []) {
      entry.matrix = new THREE.Matrix4();
      entry.mesh.getMatrixAt(entry.index, entry.matrix);
      entry.mesh.setMatrixAt(entry.index, zero);
      entry.mesh.instanceMatrix.needsUpdate = true;
      hiddenFoliage.push(entry);
    }
    foliageByTile.delete(key);
  }

  function restoreFoliage() {
    for (const entry of hiddenFoliage) {
      entry.mesh.setMatrixAt(entry.index, entry.matrix);
      entry.mesh.instanceMatrix.needsUpdate = true;
      // (tracked again so it can be tilled away again)
      const e = new THREE.Vector3().setFromMatrixPosition(entry.matrix);
      trackFoliage(e.x, e.z, entry.mesh, entry.index);
    }
    hiddenFoliage.length = 0;
  }

  // ---------- Trees, bushes, rocks ----------
  const trees = []; // { group, scale, materials, fade } — fade drives see-through when blocking the player

  // kind: 'pine' | 'round' (default: either). scale: its size.
  // A map may dress its trees and bushes in its own leaves (a season, say)
  const leaves = map.leafMats ?? leafMats;
  const needles = map.pineMats ?? pineMats;
  function addTree(x, z, { kind = rng() < 0.45 ? 'pine' : 'round', scale = rand(0.8, 1.35) } = {}) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.rotation.y = rand(0, Math.PI * 2);
    const k = scale;
    tree.scale.setScalar(k);
    root.add(tree);

    if (kind === 'pine') {
      // Pine: stacked cones
      const leaf = pick(needles);
      addDecor(trunkGeo, trunkMat, 0, 0, 0, 1, 1.1, 1, tree);
      addDecor(coneGeo, leaf, 0, 1.3, 0, 1.05, 1, 1.05, tree);
      addDecor(coneGeo, leaf, 0, 2.0, 0, 0.8, 0.9, 0.8, tree);
      addDecor(coneGeo, leaf, 0, 2.6, 0, 0.55, 0.8, 0.55, tree);
    } else {
      // Round tree: a cluster of leafy blobs
      const leaf = pick(leaves);
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
    trees.push({ group: tree, scale: k, materials: [...materials.values()], fade: 1 });

    // Trunk collider; tall enough that you can't jump up into the canopy
    addCollider({ x, y: 3, z, w: 0.5 * k, h: 6, d: 0.5 * k });
  }

  function addBush(x, z) {
    const leaf = pick(leaves);
    const k = rand(0.35, 0.6);
    addDecor(blobGeo, leaf, x, k * 0.6, z, k, k * 0.8, k, root);
    addDecor(blobGeo, leaf, x + k * 0.7, k * 0.45, z + rand(-0.3, 0.3), k * 0.7, k * 0.6, k * 0.7, root);
    if (rng() < 0.5) addDecor(blobGeo, leaf, x - k * 0.6, k * 0.4, z + rand(-0.3, 0.3), k * 0.6, k * 0.5, k * 0.6, root);
  }

  // size: [min, max] (big ones are boulders and get a collider)
  function addRock(x, z, [lo, hi] = [0.15, 0.45]) {
    const k = rand(lo, hi);
    const rock = addDecor(rockGeo, pick(rockMats), x, k * 0.3, z, k * rand(1, 1.5), k * rand(0.5, 0.8), k, root);
    rock.rotation.set(rand(0, 0.4), rand(0, Math.PI * 2), rand(0, 0.4));
    if (k > 0.6) addCollider({ x, y: k * 0.35, z, w: k * 1.4, h: k * 0.7, d: k * 1.4 });
  }

  Object.assign(ctx, { addTree, addBush, addRock });
  map.decorate(ctx);

  const _eye = new THREE.Vector3();
  return {
    name: map.name,
    root,
    platforms,
    tileGrid,
    spawn: map.spawn,
    tileAt,
    clearFoliageOnTile,
    restoreFoliage,
    // eye: the player's chest; trees in front of it fade out
    updateTreeFade(dt, eye, camera) {
      const k = damp(8, dt);
      _eye.copy(eye);
      for (const tree of trees) {
        tree.fade += ((blocksView(tree, _eye, camera) ? 0.25 : 1) - tree.fade) * k;
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
