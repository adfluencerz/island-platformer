import * as THREE from 'three';
import { SPAWN } from '../shared/level.js';
import { hashSeed, STONE_CIRCLE } from '../shared/worldgen.js';
import { distToPaths, addDecor, rockGeo, rockMats, foliageMat } from './world.js';
import { STALL, buildStall } from './merchant.js';

// ---------- Maps ----------
// What the worlds look like (built by world.js): your farm, and the wild
// island a lobby's seed grows (shared/worldgen.js). A map says, per ground tile,
// what kind of tile it is (or null for sea); how each kind looks and whether
// grass grows on it; its platforms; and decorate() puts the trees, bushes and
// rocks around. build() is for a map's own set pieces, and may return a
// function that animates them.

// ---------- Home: your farm's island ----------
// A square island: a sand rim, a stone plaza at spawn, dirt paths toward a
// staggered set of platforms and the merchant's stall, and grass everywhere else.
const HOME_PATHS = [
  [[1, 27], [1, 15], [0, 6]], // from the south shore up to spawn
  [[0, 6], [-3, 1], [-6, -1]], // spawn -> first platform
  [[0, 6], [4, 2], [8, -6], [11, -12]], // spawn -> under the high platforms
  [[1, 7], [STALL.x, STALL.z + 2]], // spawn -> the merchant's stall
];
const HOME_PLAZA = { x: 0, z: 5, r: 2.6 };
const HOME_HALF = 29;

// Trees stay out of the platforming area so they never block a jump or the view
const PLAY_AREA = { minX: -14, maxX: 17, minZ: -21, maxZ: 9 };
const inPlayArea = (x, z) =>
  x > PLAY_AREA.minX && x < PLAY_AREA.maxX && z > PLAY_AREA.minZ && z < PLAY_AREA.maxZ;

const platform = (x, y, z, w, h, d, color = 0x8b5a2b) => ({ x, y, z, w, h, d, color, cap: 'grass' });

export const HOME = {
  name: 'home',
  seed: 1337,
  half: HOME_HALF,
  spawn: SPAWN,
  tileType(gx, gz) {
    if (Math.max(Math.abs(gx), Math.abs(gz)) >= HOME_HALF - 1) return 'sand';
    if (Math.hypot(gx - HOME_PLAZA.x, gz - HOME_PLAZA.z) < HOME_PLAZA.r) return 'stone';
    if (distToPaths(gx, gz, HOME_PATHS) < 0.85) return 'path';
    return 'grass';
  },
  tileStyles: {
    grass: { color: 0x5d9b3a, jitter: 0.035, top: [0.006, 0.026], lush: true },
    path: { color: 0xb08a5a, jitter: 0.05, top: [0.004, 0.01] },
    stone: { color: 0x9c9a92, jitter: 0.07, top: [0.012, 0.03] },
    sand: { color: 0xe3cc94, jitter: 0.03, top: [0.004, 0.012] },
  },
  decorTypes: new Set(['grass']),
  foliage: { grass: { tufts: 2.2, lushTufts: 1.5, flowerLush: 0.35, flowerChance: 0.35 } },
  platforms: [
    platform(-6, 1, -4, 4, 1, 4),
    platform(0, 2.5, -8, 4, 1, 4),
    platform(6, 4, -12, 4, 1, 4),
    platform(12, 5.5, -16, 4, 1, 4),
    platform(-10, 3, -14, 3, 1, 3, 0xa0522d),
  ],
  keepClear: [[SPAWN.x, SPAWN.z, 1.5], [STALL.x, STALL.z + 1.5, 4]],
  build: buildStall,
  decorate({ scatter, addTree, addBush, addRock, isOpenGround, tileAt }) {
    scatter(70, 2.6, (x, z) => !inPlayArea(x, z) && isOpenGround(x, z, 1), (x, z) => addTree(x, z));
    scatter(40, 2, (x, z) => isOpenGround(x, z, 0.8), addBush);
    scatter(30, 1.5, (x, z) => tileAt(x, z) === 'sand' || isOpenGround(x, z, 0.5), (x, z) => addRock(x, z));
  },
};

// ---------- The wild islands: one per online lobby ----------
// Bigger and wilder than a farm, and grown from the lobby's seed
// (shared/worldgen.js has its shape): a ragged coast, a mossy forest with
// giant toadstools to hop across, a shallow pond, a flower meadow, rocky
// terraces, winding trails, and a ring of standing stones where farmers
// arrive. The seed also picks the island's season: its colors.
const THEMES = {
  spring: {
    tiles: { grass: 0x5a9a38, moss: 0x3d6b2f, meadow: 0x79b54c },
    flowers: [0xffffff, 0xffe14d, 0xff7eb6, 0xb58cff, 0xff6b4a, 0x7ec8ff],
  },
  autumn: {
    tiles: { grass: 0x86973c, moss: 0x5a6530, meadow: 0xa9aa4c },
    hue: [0.15, 0.22], // the grass is turning
    leaves: [0xd9822b, 0xc4502b, 0xe3a832, 0x9e8a34],
    flowers: [0xffe14d, 0xff9f1c, 0xff6b4a, 0xffffff, 0xd8452f],
  },
  blossom: {
    tiles: { grass: 0x62a63e, moss: 0x467a33, meadow: 0x86c055 },
    leaves: [0xf4b6cf, 0xeb94b8, 0xf9d3e2, 0x5aa83f],
    flowers: [0xffffff, 0xffc2dc, 0xff7eb6, 0xd7b8ff, 0xfff1a8],
  },
};
const themeLeaves = new Map(); // theme -> its leaf materials (made once, shared by its islands)
function leavesOf(name) {
  const colors = THEMES[name].leaves;
  if (!colors) return undefined; // (the usual greens)
  if (!themeLeaves.has(name)) themeLeaves.set(name, colors.map(foliageMat));
  return themeLeaves.get(name);
}

// island: from islandFor(seed)
export function wildMap(island) {
  const theme = THEMES[island.theme] ?? THEMES.spring;
  const { trails } = island;
  const nearTerrace = (x, z, margin) =>
    island.terraces.some(([tx, tz, w, d]) => Math.abs(x - tx) < w / 2 + margin && Math.abs(z - tz) < d / 2 + margin);
  const offTrail = (x, z, d) => distToPaths(x, z, trails) > d;
  return {
    name: `wild:${island.seed}`,
    island,
    seed: hashSeed(island.seed),
    half: island.half,
    spawn: island.spawn,
    tileType: island.groundAt,
    floors: { pond: island.pondFloor },
    tileStyles: {
      grass: { color: theme.tiles.grass, jitter: 0.04, top: [0.006, 0.026], lush: true },
      moss: { color: theme.tiles.moss, jitter: 0.05, top: [0.004, 0.02], lush: true },
      meadow: { color: theme.tiles.meadow, jitter: 0.035, top: [0.006, 0.022], lush: true },
      path: { color: 0xa98457, jitter: 0.06, top: [0.004, 0.012] },
      stone: { color: 0x8f8d86, jitter: 0.08, top: [0.012, 0.035] },
      sand: { color: 0xe0c690, jitter: 0.03, top: [0.004, 0.012] },
      pond: { color: 0x6b6446, jitter: 0.05, top: [0.004, 0.02] },
    },
    decorTypes: new Set(['grass', 'moss', 'meadow']),
    foliage: {
      grass: { tufts: 2.6, lushTufts: 1.5, flowerLush: 0.3, flowerChance: 0.25, hue: theme.hue },
      moss: { tufts: 1.4, lushTufts: 1, flowerLush: 9, flowerChance: 0, light: [0.26, 0.34], hue: theme.hue },
      meadow: { tufts: 3, lushTufts: 1.2, flowerLush: -2, flowerChance: 0.8, hue: theme.hue },
    },
    flowerColors: theme.flowers,
    leafMats: leavesOf(island.theme),
    // Rock steps, solid down to the ground, with moss on top
    platforms: island.terraces.map(([x, z, w, d, top], i) => ({
      x, y: top / 2, z, w, h: top, d, color: [0x8a857b, 0x7d786f, 0x918b80, 0x86817a][i % 4], cap: 'moss',
    })),
    // nothing grows on the spots or in the stone circle
    keepClear: [
      ...island.spots.map(([, x, , z]) => [x, z, 1]),
      [island.spawn.x, island.spawn.z, STONE_CIRCLE + 0.8],
    ],
    build: (ctx) => buildWildPieces(island, ctx),
    decorate({ scatter, addTree, addBush, addRock, isOpenGround, tileAt, rand }) {
      // The forest: thick on the moss, with big old trees among the pines
      scatter(130, 2.1, (x, z) => tileAt(x, z) === 'moss' && isOpenGround(x, z, 1.2) && offTrail(x, z, 1.8),
        (x, z) => addTree(x, z, { scale: rand(1, 1.6) }));
      // Lone trees out on the grass
      scatter(24, 5, (x, z) => tileAt(x, z) === 'grass' && isOpenGround(x, z, 1.6) && offTrail(x, z, 2.2),
        (x, z) => addTree(x, z));
      scatter(60, 1.8, (x, z) => isOpenGround(x, z, 0.8) && offTrail(x, z, 1.2), addBush);
      scatter(45, 1.4, (x, z) => tileAt(x, z) === 'sand' || isOpenGround(x, z, 0.5), (x, z) => addRock(x, z));
      // Boulders tumbled at the foot of the terraces
      scatter(9, 2.2, (x, z) => nearTerrace(x, z, 2.2) && !nearTerrace(x, z, 0.6) && isOpenGround(x, z, 0.4) && offTrail(x, z, 1.6),
        (x, z) => addRock(x, z, [0.7, 1.1]));
    },
  };
}

// ---------- The wild island's set pieces ----------
const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.8 });
const toadCapMat = new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.55 });
const gillMat = new THREE.MeshStandardMaterial({ color: 0xe8d2b0, roughness: 0.9 });
const dotMat = new THREE.MeshStandardMaterial({ color: 0xfff8ec, roughness: 0.6 });
const dotGeo = new THREE.SphereGeometry(0.16, 8, 6);
const pondWaterMat = new THREE.MeshStandardMaterial({ color: 0x3aa0a8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.72 });
const padMat = new THREE.MeshStandardMaterial({ color: 0x4f9e3c, roughness: 0.7 });
const lotusMat = new THREE.MeshStandardMaterial({ color: 0xff9fcf, roughness: 0.6, flatShading: true });
const reedMat = foliageMat(0x6b8a3a);
const logMat = foliageMat(0x7a5432);
const logEndMat = foliageMat(0xc49a6c);

function buildWildPieces(island, { root, rand, rng, addCollider, isOpenGround, tileAt, scatter }) {
  // Giant toadstools: a flat red cap you can stand on, white dots, a pale stalk
  for (const [x, z, size, top] of island.toadstools) {
    const r = size * 0.6;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, top - 0.35, 10), stalkMat);
    stalk.position.set(x, (top - 0.35) / 2, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.4, 20), toadCapMat);
    cap.position.set(x, top - 0.2, z);
    const gills = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.5, 0.12, 20), gillMat);
    gills.position.set(x, top - 0.44, z);
    root.add(stalk, cap, gills);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4 + x;
      const d = i % 3 === 0 ? r * 0.35 : r * 0.82;
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x + Math.cos(a) * d, top - (i % 3 === 0 ? 0.02 : 0.12), z + Math.sin(a) * d);
      dot.scale.set(1, 0.35, 1);
      root.add(dot);
    }
    for (const mesh of [stalk, cap, gills]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    addCollider({ x, y: top - 0.2, z, w: size, h: 0.4, d: size });
    addCollider({ x, y: (top - 0.4) / 2, z, w: 0.8, h: top - 0.4, d: 0.8 });
  }

  // The standing stones round the arrival spot, with gaps where the trails go
  for (const a of island.stones) {
    const x = island.spawn.x + Math.cos(a) * STONE_CIRCLE;
    const z = island.spawn.z + Math.sin(a) * STONE_CIRCLE;
    const h = rand(1.6, 2.2);
    const stone = addDecor(rockGeo, rockMats[1], x, h / 2, z, 0.45, h / 2, 0.38, root);
    stone.rotation.set(rand(-0.06, 0.06), -a, rand(-0.06, 0.06));
    addCollider({ x, y: h / 2, z, w: 0.8, h, d: 0.8 });
  }

  // The pond: still water over a muddy bottom, lily pads, a few pink flowers, reeds
  const { pond } = island;
  const water = new THREE.Mesh(new THREE.CircleGeometry(pond.r + 0.9, 40), pondWaterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(pond.x, -0.12, pond.z);
  root.add(water);
  const pads = [];
  for (let i = 0; i < 9; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(1.2, pond.r - 0.6);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 12, 1, false, 0.4, Math.PI * 1.8), padMat);
    pad.position.set(pond.x + Math.cos(a) * d, -0.1, pond.z + Math.sin(a) * d);
    pad.rotation.y = rand(0, Math.PI * 2);
    if (rng() < 0.4) {
      const lotus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), lotusMat);
      lotus.position.y = 0.08;
      pad.add(lotus);
    }
    root.add(pad);
    pads.push(pad);
  }
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const x = pond.x + Math.cos(a) * rand(pond.r - 0.5, pond.r + 0.4);
    const z = pond.z + Math.sin(a) * rand(pond.r - 0.5, pond.r + 0.4);
    if (!island.inPond(x, z)) continue;
    for (let n = 0; n < 4; n++) {
      const h = rand(0.6, 1.1);
      const reed = addDecor(new THREE.ConeGeometry(0.035, h, 4), reedMat, x + rand(-0.15, 0.15), island.pondFloor + h / 2, z + rand(-0.15, 0.15), 1, 1, 1, root);
      reed.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
    }
  }

  // Fallen logs in the forest, to hop over (or along)
  scatter(5, 7, (x, z) => tileAt(x, z) === 'moss' && isOpenGround(x, z, 1.6) && distToPaths(x, z, island.trails) > 2, (x, z) => {
    const len = rand(2.2, 3.4);
    const along = rng() < 0.5; // lying east-west, else north-south
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, len, 9), [logMat, logEndMat, logEndMat]);
    log.rotation.set(along ? 0 : Math.PI / 2, 0, along ? Math.PI / 2 : 0);
    log.position.set(x, 0.3, z);
    log.castShadow = true;
    log.receiveShadow = true;
    root.add(log);
    addCollider({ x, y: 0.28, z, w: along ? len : 0.6, h: 0.56, d: along ? 0.6 : len });
  });

  // the lily pads drift a little
  return (t) => {
    pads.forEach((pad, i) => {
      pad.position.y = -0.1 + Math.sin(t * 1.3 + i) * 0.012;
      pad.rotation.y += Math.sin(t * 0.4 + i) * 0.0008;
    });
  };
}
