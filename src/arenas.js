import * as THREE from 'three';
import { hashSeed } from '../shared/worldgen.js';
import { TILE, TILE_GAP } from '../shared/arenas.js';
import { MINIGAMES } from '../shared/balance.js';
import { createItemMesh } from './itemmesh.js';

// ---------- Party game arenas ----------
// What a party game's arena looks like (built by world.js, as the islands in
// maps.js are), from the arena a seed grows (shared/arenas.js): a round
// meadow in the sea with hay bales to climb and, for a coin rush, its coins
// floating about; for king of the hill, a stepped hill in the middle with a
// flag on its crown; for last one standing, a floor of tiles over the sea
// (arenaMap(arena).dropTiles(ms) drops the ones due by ms into the game) and
// an islet off to the side; for the hop race, wooden hops on posts out over
// the sea to a goal with a flag and an arch. arenaMap(arena).coins is filled in as the world is built:
// a view per coin, by its id, for the page to hide as they are picked up.

const baleMat = new THREE.MeshStandardMaterial({ color: 0xe0c060, roughness: 0.95, flatShading: true });
const baleTopMat = new THREE.MeshStandardMaterial({ color: 0xead47a, roughness: 1, flatShading: true });
const twineMat = new THREE.MeshStandardMaterial({ color: 0x9a6a32, roughness: 0.9 });
const earthMat = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 1, flatShading: true });
const turfMat = new THREE.MeshStandardMaterial({ color: 0x72b84a, roughness: 1, flatShading: true });
const crownTurfMat = new THREE.MeshStandardMaterial({ color: 0x8fcf5a, roughness: 1, flatShading: true });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.35, metalness: 0.6, emissive: 0x4a3400 });

export function arenaMap(arena) {
  const coins = [];
  const map = {
    name: `arena:${arena.game}:${arena.seed}`,
    seed: hashSeed(`arena/${arena.game}/${arena.seed}`),
    half: arena.half,
    spawn: arena.start(0, 1),
    tileType: arena.groundAt,
    tileStyles: {
      grass: { color: 0x6aad42, jitter: 0.04, top: [0.006, 0.024], lush: true },
      sand: { color: 0xe6cf98, jitter: 0.03, top: [0.004, 0.012] },
    },
    decorTypes: new Set(['grass']),
    foliage: { grass: { tufts: 2.2, lushTufts: 1.2, flowerLush: 0.2, flowerChance: 0.45 } },
    flowerColors: [0xffffff, 0xffe14d, 0xff7eb6, 0xb58cff, 0xff9f1c],
    // (the bales are built below, with their twine)
    platforms: [],
    keepClear: [[0, 0, 2.6], ...arena.coins.map(([x, , z]) => [x, z, 0.5]), ...arena.hill.map(([x, z, w, d]) => [x, z, Math.hypot(w, d) / 2])],
    coins,
    dropTiles: () => {},
    build: (ctx) => buildArena(arena, ctx, coins, map),
    decorate({ scatter, addBush, isOpenGround }) {
      if (arena.tiles.length) return; // (the islet is for washing up on)
      scatter(10, 3, (x, z) => isOpenGround(x, z, 1) && Math.hypot(x, z) > arena.coast.r - 4, addBush);
    },
  };
  return map;
}

// Last one standing's tiles: checkered, cream and mint; one about to drop
// wobbles and blushes, then falls into the sea
const tileColors = [0xf3e6c4, 0xbfe3b4];
const blush = new THREE.Color(0xf2a07a);
function buildTiles(arena, { root, addCollider, removeCollider }, map) {
  const size = TILE - TILE_GAP;
  const geo = new THREE.BoxGeometry(size, 0.5, size);
  const views = arena.tiles.map(([x, z], id) => {
    const base = new THREE.Color(tileColors[(Math.round(x / TILE) + Math.round(z / TILE)) & 1]);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: base, roughness: 0.8, flatShading: true }));
    mesh.position.set(x, -0.25, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    const dims = { x, y: -0.25, z, w: size, h: 0.5, d: size };
    return { id, mesh, base, dims, box: addCollider(dims) };
  });
  // Every frame: each tile as it is `ms` into the game
  const { warnMs } = MINIGAMES.last_one;
  map.dropTiles = (ms) => {
    for (const v of views) {
      const at = arena.fallAt[v.id];
      const { mesh } = v;
      if (ms >= at) {
        if (v.box) removeCollider(v.box);
        v.box = null;
        const s = (ms - at) / 1000;
        mesh.position.y = -0.25 - 9 * s * s;
        mesh.rotation.set(s * 0.8, 0, s * 0.5);
        mesh.visible = mesh.position.y > -10;
        continue;
      }
      if (!v.box) v.box = addCollider(v.dims); // (back, for a game afresh)
      mesh.visible = true;
      const warn = ms > at - warnMs ? 1 - (at - ms) / warnMs : 0;
      mesh.position.set(v.dims.x + Math.sin(ms * 0.07) * 0.04 * warn, -0.25 - 0.05 * warn, v.dims.z);
      mesh.rotation.set(Math.sin(ms * 0.05) * 0.05 * warn, 0, Math.cos(ms * 0.06) * 0.05 * warn);
      mesh.material.color.copy(v.base).lerp(blush, warn);
    }
  };
}

// The hop race's hops: a square of planks on a post down into the sea, every
// other one a little darker; the goal a wide one on four posts, under an
// arch with bunting, and a flag on its far corner
const plankMats = [0xc08a4e, 0xa8743e].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
const rimMat = new THREE.MeshStandardMaterial({ color: 0x7a5432, roughness: 0.9, flatShading: true });
const goalMat = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.85, flatShading: true });
const buntingMats = [0xff7eb6, 0xffe14d, 0x7ec8ff, 0x8fcf5a].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
const HOP_DEPTH = 0.35; // how thick a hop's planks are
function buildHops(arena, { root, addCollider }) {
  const hop = ([x, z, size, top], mat) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(size, HOP_DEPTH, size), [rimMat, rimMat, mat, rimMat, rimMat, rimMat]);
    deck.position.set(x, top - HOP_DEPTH / 2, z);
    deck.castShadow = true;
    deck.receiveShadow = true;
    root.add(deck);
    addCollider({ x, y: top - HOP_DEPTH / 2, z, w: size, h: HOP_DEPTH, d: size });
  };
  const post = (x, z, top) => {
    const h = top + 3;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, h, 7), rimMat);
    p.position.set(x, top - h / 2 - HOP_DEPTH, z);
    p.castShadow = true;
    root.add(p);
  };
  arena.hops.forEach(([x, z, size, top], i) => {
    hop([x, z, size, top], plankMats[i % 2]);
    post(x, z, top);
  });
  const [x, z, size, top] = arena.goal;
  hop(arena.goal, goalMat);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) post(x + sx * (size / 2 - 0.3), z + sz * (size / 2 - 0.3), top);
  // the arch: two poles and a bar, with bunting along it
  const [a, b] = [[x - size / 2 + 0.25, z], [x + size / 2 - 0.25, z]];
  for (const [px, pz] of [a, b]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), twineMat);
    pole.position.set(px, top + 1.3, pz);
    root.add(pole);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(size - 0.4, 0.1, 0.1), twineMat);
  bar.position.set(x, top + 2.55, z);
  root.add(bar);
  for (let i = 0; i < 7; i++) {
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3), buntingMats[i % buntingMats.length]);
    flag.rotation.x = Math.PI;
    flag.position.set(x - (size - 0.8) / 2 + ((size - 0.8) / 6) * i, top + 2.32, z);
    root.add(flag);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), twineMat);
  pole.position.set(x + size / 2 - 0.3, top + 1, z + size / 2 - 0.3);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.03), new THREE.MeshStandardMaterial({ color: 0xff7eb6, roughness: 0.7 }));
  flag.position.set(pole.position.x - 0.37, top + 1.75, pole.position.z);
  root.add(pole, flag);
}

function buildArena(arena, ctx, coins, map) {
  const { root, addCollider } = ctx;
  if (arena.tiles.length) buildTiles(arena, ctx, map);
  if (arena.goal) buildHops(arena, ctx);
  // Hay bales, tied round with twine; a stacked one stands on the one under it
  for (const [x, z, w, d, top] of arena.bales) {
    const h = top > 1.2 ? 1.2 : top;
    const y = top - h / 2;
    const bale = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [baleMat, baleMat, baleTopMat, baleMat, baleMat, baleMat]);
    bale.position.set(x, y, z);
    bale.castShadow = true;
    bale.receiveShadow = true;
    root.add(bale);
    const along = w > d;
    for (const k of [-0.25, 0.25]) {
      const twine = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.08 : w + 0.04, h + 0.04, along ? d + 0.04 : 0.08), twineMat);
      twine.position.set(x + (along ? k * w : 0), y, z + (along ? 0 : k * d));
      root.add(twine);
    }
    addCollider({ x, y, z, w, h, d });
  }

  // The hill: grassy steps of earth, a flag on the crown's corner
  arena.hill.forEach(([x, z, w, d, top], i) => {
    const under = i ? arena.hill[i - 1][4] : 0;
    const h = top - under + 0.2; // (a little into the step under it)
    const turf = i === arena.hill.length - 1 ? crownTurfMat : turfMat;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [earthMat, earthMat, turf, earthMat, earthMat, earthMat]);
    step.position.set(x, top - h / 2, z);
    step.castShadow = true;
    step.receiveShadow = true;
    root.add(step);
    addCollider({ x, y: top / 2, z, w, h: top, d });
  });
  if (arena.crown) {
    const [x, z, w, d, top] = arena.crown;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), twineMat);
    pole.position.set(x + w / 2 - 0.2, top + 0.9, z + d / 2 - 0.2);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.03), new THREE.MeshStandardMaterial({ color: 0xff7eb6, roughness: 0.7 }));
    flag.position.set(pole.position.x - 0.32, top + 1.6, pole.position.z);
    root.add(pole, flag);
  }

  // The coins, bobbing and turning
  for (const [x, y, z] of arena.coins) {
    const coin = createItemMesh('coin');
    coin.position.set(x, y, z);
    coin.castShadow = true;
    root.add(coin);
    coins.push(coin);
  }
  return (t) => {
    coins.forEach((coin, i) => {
      if (!coin.visible) return;
      coin.position.y = arena.coins[i][1] + Math.sin(t * 2.4 + i) * 0.12;
      coin.rotation.y = t * 1.8 + i;
    });
  };
}

// A little gold crown, over the head of whoever holds the hill
export function buildCrown() {
  const crown = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.12, 10, 1, true), goldMat);
  band.material.side = THREE.DoubleSide;
  crown.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), goldMat);
    point.position.set(Math.cos(a) * 0.19, 0.12, Math.sin(a) * 0.19);
    crown.add(point);
  }
  return crown;
}

// ---------- The signpost ----------
// In a lobby's stone circle (shared/arenas.js signFor): a post with a painted
// board, where party games start
const postMat = new THREE.MeshStandardMaterial({ color: 0x7a5432, roughness: 0.9 });
let boardMats = null;
function boardMaterials() {
  if (boardMats) return boardMats;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c99a5c';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#b4834a';
  for (let y = 18; y < 128; y += 30) g.fillRect(0, y, 256, 3);
  g.fillStyle = '#4a2f18';
  g.textAlign = 'center';
  g.font = 'bold 40px sans-serif';
  g.fillText('Party', 128, 52);
  g.fillText('games', 128, 100);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9 });
  boardMats = [edge, edge, edge, edge, face, face];
  return boardMats;
}

export function buildSignpost({ x, z, yaw }) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 0.16), postMat);
  post.position.y = 0.85;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.08), boardMaterials());
  board.position.set(0, 1.45, 0.1);
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 3).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff7eb6, roughness: 0.7 }));
  flag.position.set(0.2, 1.9, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), postMat);
  pole.position.set(0, 1.95, 0);
  group.add(post, board, pole, flag);
  group.traverse((obj) => obj.isMesh && (obj.castShadow = true));
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  return group;
}
