import * as THREE from 'three';
import { SPAWN } from '../shared/level.js';
import { hashSeed, STONE_CIRCLE, WILD_HALF } from '../shared/worldgen.js';
import { distToPaths, addDecor, rockGeo, rockMats, foliageMat, addRipples } from './world.js';
import { buildStall } from './merchant.js';
import { buildPens } from './animals.js';
import { buildSkyIsles } from './skyisles.js';
import { homeGround, HOME_HALF, HOME_PLATFORMS, HOME_KEEP_CLEAR, PEN_RECTS } from '../shared/farmland.js';
import { WILD_DECOR, HOME_DECOR, wildKeepClear } from '../shared/wilds.js';

// ---------- Maps ----------
// What the worlds look like (built by world.js): your farm, and the wild
// island a lobby's seed grows (shared/worldgen.js). A map says, per ground tile,
// what kind of tile it is (or null for sea); how each kind looks and whether
// grass grows on it; its platforms; and decorate() puts the bushes around
// (the trees and rocks stand where the server says: shared/wilds.js).
// build() is for a map's own set pieces, and may return a function that
// animates them.

// ---------- Home: your farm's island ----------
// A square island: a sand rim, a stone plaza at spawn, dirt paths toward a
// staggered set of platforms, the merchant's stall and the gates of the hen
// yard and the pasture, and grass everywhere else (its plan: shared/farmland.js;
// its trees and rocks: shared/homewilds.js).
export const HOME = {
  name: 'home',
  seed: 1337,
  half: HOME_HALF,
  spawn: SPAWN,
  tileType: homeGround, // (world.js asks between tiles too)
  tileStyles: {
    grass: { color: 0x5d9b3a, jitter: 0.035, top: [0.006, 0.026], lush: true },
    path: { color: 0xb08a5a, jitter: 0.05, top: [0.004, 0.01] },
    stone: { color: 0x9c9a92, jitter: 0.07, top: [0.012, 0.03] },
    sand: { color: 0xe3cc94, jitter: 0.03, top: [0.004, 0.012] },
  },
  decorTypes: HOME_DECOR,
  foliage: { grass: { tufts: 2.2, lushTufts: 1.5, flowerLush: 0.35, flowerChance: 0.35 } },
  platforms: HOME_PLATFORMS,
  keepClear: HOME_KEEP_CLEAR,
  build(ctx) {
    buildStall(ctx);
    buildPens(ctx);
  },
  decorate({ scatter, addBush, isOpenGround }) {
    scatter(40, 2, (x, z) => isOpenGround(x, z, 0.8) && !inBiggestPen(x, z, 0.8), addBush);
  },
};

// (where the pens' fences go out to at their last level: no bushes there)
function inBiggestPen(x, z, margin) {
  return Object.values(PEN_RECTS).some((levels) => {
    const r = levels[levels.length - 1];
    return Math.abs(x - r.x) < r.w / 2 + margin && Math.abs(z - r.z) < r.d / 2 + margin;
  });
}

// ---------- The wild islands: one per online lobby ----------
// Bigger and wilder than a farm (from generation 3 on, twice as wide again),
// and grown from the lobby's seed (shared/worldgen.js has its shape): a
// ragged coast, mossy forests, giant toadstools to hop across,
// a shallow pond, a flower meadow, rocky terraces, winding trails, and a ring
// of standing stones where farmers arrive. The seed also picks the island's
// season: its colors.
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

// n of something on an island of the usual size, and as many for each such
// island's worth of ground on a bigger one (generation 3)
const forSize = (island, n) => Math.round(n * (island.half / WILD_HALF) ** 2);

// island: from islandFor(seed)
export function wildMap(island) {
  const theme = THEMES[island.theme] ?? THEMES.spring;
  const { trails } = island;
  const offTrail = (x, z, d) => distToPaths(x, z, trails) > d;
  const more = (n) => forSize(island, n);
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
      heath: { color: 0x7d6f8a, jitter: 0.04, top: [0.006, 0.024], lush: true },
      marsh: { color: 0x5f6b3a, jitter: 0.05, top: [0.004, 0.016], lush: true },
      glade: { color: 0x5f8a6a, jitter: 0.04, top: [0.006, 0.024], lush: true },
      field: { color: 0x9a9a3a, jitter: 0.04, top: [0.006, 0.024], lush: true },
      patch: { color: 0x8a7a3a, jitter: 0.04, top: [0.006, 0.024], lush: true },
      glen: { color: 0x3d6b3a, jitter: 0.04, top: [0.006, 0.02], lush: true },
      dune: { color: 0xd9c188, jitter: 0.03, top: [0.006, 0.02] },
    },
    decorTypes: WILD_DECOR,
    foliage: {
      grass: { tufts: 2.6, lushTufts: 1.5, flowerLush: 0.3, flowerChance: 0.25, hue: theme.hue },
      moss: { tufts: 1.4, lushTufts: 1, flowerLush: 9, flowerChance: 0, light: [0.26, 0.34], hue: theme.hue },
      meadow: { tufts: 3, lushTufts: 1.2, flowerLush: -2, flowerChance: 0.8, hue: theme.hue },
      heath: { tufts: 2.4, lushTufts: 1.4, flowerLush: -2, flowerChance: 0.5, light: [0.36, 0.46], hue: [0.7, 0.78] },
      marsh: { tufts: 3, lushTufts: 1.6, flowerLush: -2, flowerChance: 0.1, light: [0.28, 0.38], hue: [0.2, 0.26] },
      glade: { tufts: 2.6, lushTufts: 1.4, flowerLush: -2, flowerChance: 0.6, light: [0.34, 0.44], hue: [0.38, 0.44] },
      field: { tufts: 2.8, lushTufts: 1.4, flowerLush: -2, flowerChance: 0.3, light: [0.34, 0.44], hue: [0.14, 0.2] },
      patch: { tufts: 2.2, lushTufts: 1.2, flowerLush: -2, flowerChance: 0.2, light: [0.3, 0.4], hue: [0.1, 0.16] },
      glen: { tufts: 3.2, lushTufts: 1.8, flowerLush: -2, flowerChance: 0, light: [0.22, 0.32], hue: [0.3, 0.36] },
      dune: { tufts: 1.2, lushTufts: 0.6, flowerLush: -2, flowerChance: 0, light: [0.5, 0.6], hue: [0.12, 0.16] },
    },
    flowerColors: theme.flowers,
    leafMats: leavesOf(island.theme),
    // Rock steps, solid down to the ground, with moss on top
    platforms: island.terraces.map(([x, z, w, d, top], i) => ({
      x, y: top / 2, z, w, h: top, d, color: [0x8a857b, 0x7d786f, 0x918b80, 0x86817a][i % 4], cap: 'moss',
    })),
    // nothing grows on the spots or in the stone circle (or up into a sky isle)
    keepClear: wildKeepClear(island),
    build: (ctx) => buildWildPieces(island, ctx),
    // (its trees and rocks are the server's: shared/wilds.js)
    decorate({ scatter, addBush, isOpenGround }) {
      scatter(more(60), 1.8, (x, z) => isOpenGround(x, z, 0.8) && offTrail(x, z, 1.2), addBush);
    },
  };
}

// ---------- The wild island's set pieces ----------
const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.8 });
const gillMat = new THREE.MeshStandardMaterial({ color: 0xe8d2b0, roughness: 0.9 });
// reeds on the marsh (generation 4): a thin stalk 2 tall (scaled to its height) and a brown velvet head
const marshReedGeo = new THREE.CylinderGeometry(0.018, 0.035, 2, 5);
const marshSpikeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 7);
const gladeStemGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.4, 4);
const gladeBellGeo = new THREE.SphereGeometry(0.04, 6, 5);
const gladeStemMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3e, roughness: 0.8 });
const gladeBellMat = new THREE.MeshStandardMaterial({ color: 0x5a6fd8, roughness: 0.5 });
const patchVineGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.5, 4).rotateZ(Math.PI / 2);
const patchPumpkinGeo = new THREE.SphereGeometry(0.22, 8, 6);
const patchVineMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.8 });
const patchPumpkinMat = new THREE.MeshStandardMaterial({ color: 0xe8821e, roughness: 0.6 });
// fern fronds in the glen (generation 8): a leaning blade, a few to a clump
const glenFrondGeo = new THREE.ConeGeometry(0.09, 1, 4).translate(0, 0.5, 0);
const glenFrondMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3e, roughness: 0.8 });
// dune grass (generation 9): a pale, narrow plume; and driftwood, 1 long (scaled to its length)
const plumeGeo = new THREE.ConeGeometry(0.07, 1, 5).translate(0, 0.5, 0);
const plumeMat = new THREE.MeshStandardMaterial({ color: 0xc9bd7a, roughness: 0.85 });
const driftGeo = new THREE.CylinderGeometry(0.13, 0.15, 1, 7).rotateZ(Math.PI / 2);
const driftMat = foliageMat(0xb8a58a);
const driftEndMat = foliageMat(0xd9cdb4);
const fieldStemGeo = new THREE.CylinderGeometry(0.02, 0.03, 1, 5);
const fieldHeadGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10).rotateX(Math.PI / 2);
const fieldHeartGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8).rotateX(Math.PI / 2);
const fieldStemMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3e, roughness: 0.8 });
const fieldHeadMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 });
const fieldHeartMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });
const marshReedMat = new THREE.MeshStandardMaterial({ color: 0x6f8f3e, roughness: 0.8 });
const marshSpikeMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
// a ring of toadstools' look (its `look` in shared/worldgen.js): red with white
// dots, a brown cep, violet, and golden
const TOAD_LOOKS = [[0xd8452f, 0xfff8ec], [0x8a5a34, 0xf1dcb4], [0x8e5bb8, 0xf4ecff], [0xe9a92a, 0xfffbe8]].map(([cap, dots]) => ({
  cap: new THREE.MeshStandardMaterial({ color: cap, roughness: 0.55 }),
  dots: new THREE.MeshStandardMaterial({ color: dots, roughness: 0.6 }),
}));
const dotGeo = new THREE.SphereGeometry(0.16, 8, 6);
export const LOBBY_POND_Y = -0.12; // the lobby pond's surface (where a bobber floats: src/fishing.js)
const pondWaterMat = addRipples(new THREE.MeshStandardMaterial({ color: 0x3aa0a8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.72 }));
const padMat = new THREE.MeshStandardMaterial({ color: 0x4f9e3c, roughness: 0.7 });
const lotusMat = new THREE.MeshStandardMaterial({ color: 0xff9fcf, roughness: 0.6, flatShading: true });
const reedMat = foliageMat(0x6b8a3a);
const logMat = foliageMat(0x7a5432);
const logEndMat = foliageMat(0xc49a6c);

function buildWildPieces(island, { root, rand, rng, addCollider, isOpenGround, tileAt, scatter }) {
  // Giant toadstools: a flat cap you can stand on (red with white dots, or
  // its ring's own colors), a pale stalk
  for (const [x, z, size, top, , look = 0] of island.toadstools) {
    const { cap: capMat, dots: dotMat } = TOAD_LOOKS[look] ?? TOAD_LOOKS[0];
    const r = size * 0.6;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, top - 0.35, 10), stalkMat);
    stalk.position.set(x, (top - 0.35) / 2, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.4, 20), capMat);
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
  water.position.set(pond.x, LOBBY_POND_Y, pond.z);
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
  scatter(forSize(island, 5), 7, (x, z) => tileAt(x, z) === 'moss' && isOpenGround(x, z, 1.6) && distToPaths(x, z, island.trails) > 2, (x, z) => {
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

  // Generation 2: cairns, stacks of flat stones, on the heath (after everything
  // else drew from rng, so the older set pieces stay where they were)
  if (island.heath) {
    scatter(4, 5, (x, z) => tileAt(x, z) === 'heath' && isOpenGround(x, z, 1) && distToPaths(x, z, island.trails) > 1.5, (x, z) => {
      let y = 0;
      for (let i = 0, n = 3 + Math.floor(rng() * 2); i < n; i++) {
        const r = 0.42 - i * 0.08;
        const h = 0.2;
        const stone = addDecor(rockGeo, rockMats[i % rockMats.length], x + rand(-0.04, 0.04), y + h / 2, z + rand(-0.04, 0.04), r, h / 2, r * 0.9, root);
        stone.rotation.y = rand(0, Math.PI * 2);
        y += h * 0.9;
      }
      addCollider({ x, y: y / 2, z, w: 0.7, h: y, d: 0.7 });
    });
  }

  // Generation 4: reeds, thin stalks with brown heads, thick on the marsh (after
  // everything else drew from rng); you walk through them
  if (island.marsh) {
    scatter(40, 1.1, (x, z) => tileAt(x, z) === 'marsh' && isOpenGround(x, z, 0.3) && distToPaths(x, z, island.trails) > 1, (x, z) => {
      for (let i = 0, n = 2 + Math.floor(rng() * 3); i < n; i++) {
        const h = rand(0.8, 1.5);
        const px = x + rand(-0.25, 0.25);
        const pz = z + rand(-0.25, 0.25);
        const tilt = [rand(-0.1, 0.1), rand(-0.1, 0.1)];
        const stalk = addDecor(marshReedGeo, marshReedMat, px, h / 2, pz, 1, h / 2, 1, root);
        stalk.rotation.set(tilt[0], 0, tilt[1]);
        if (rng() < 0.6) addDecor(marshSpikeGeo, marshSpikeMat, px + tilt[1] * -h * 0.9, h * 0.9, pz + tilt[0] * h * 0.9, 1, 1, 1, root);
      }
    });
  }

  // Generation 5: bluebells, nodding blue bells on thin stems, thick in the glade
  // (after everything else drew from rng); you walk through them
  if (island.glade) {
    scatter(46, 0.9, (x, z) => tileAt(x, z) === 'glade' && isOpenGround(x, z, 0.3) && distToPaths(x, z, island.trails) > 1, (x, z) => {
      for (let i = 0, n = 2 + Math.floor(rng() * 3); i < n; i++) {
        const h = rand(0.7, 1.1);
        const px = x + rand(-0.25, 0.25);
        const pz = z + rand(-0.25, 0.25);
        const stem = addDecor(gladeStemGeo, gladeStemMat, px, 0.2 * h, pz, 1, h, 1, root);
        stem.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
        for (let b = 0; b < 3; b++) addDecor(gladeBellGeo, gladeBellMat, px + (b - 1) * 0.03, (0.3 + b * 0.04) * h + 0.1, pz, 1, 1.3, 1, root);
      }
    });
  }

  // Generation 6: sunflowers, tall stems nodding a yellow head, thick in the field
  // (after everything else drew from rng); you walk through them
  if (island.field) {
    scatter(30, 1.1, (x, z) => tileAt(x, z) === 'field' && isOpenGround(x, z, 0.3) && distToPaths(x, z, island.trails) > 1, (x, z) => {
      const h = rand(1.1, 1.6);
      const px = x + rand(-0.3, 0.3);
      const pz = z + rand(-0.3, 0.3);
      addDecor(fieldStemGeo, fieldStemMat, px, h / 2, pz, 1, h, 1, root);
      const head = addDecor(fieldHeadGeo, fieldHeadMat, px, h, pz + 0.02, 1, 1, 1, root);
      head.rotation.set(rand(-0.2, 0.1), rand(-0.6, 0.6), 0);
      addDecor(fieldHeartGeo, fieldHeartMat, px, h, pz + 0.05, 1, 1, 1, root).rotation.copy(head.rotation);
    });
  }

  // Generation 7: pumpkins on their vines, scattered over the patch (after
  // everything else drew from rng); they sit low, so you walk around them
  if (island.patch) {
    scatter(12, 1.6, (x, z) => tileAt(x, z) === 'patch' && isOpenGround(x, z, 0.4) && distToPaths(x, z, island.trails) > 1, (x, z) => {
      const s = rand(0.7, 1.2);
      const px = x + rand(-0.3, 0.3);
      const pz = z + rand(-0.3, 0.3);
      addDecor(patchPumpkinGeo, patchPumpkinMat, px, 0.16 * s, pz, s, 0.75 * s, s, root);
      addDecor(patchVineGeo, patchVineMat, px, 0.04, pz, 1.4, 1, 1, root).rotation.y = rand(0, Math.PI);
    });
  }

  // Generation 8: fern fronds, thick in the glen (after everything else drew
  // from rng); you walk through them
  if (island.glen) {
    scatter(40, 1.1, (x, z) => tileAt(x, z) === 'glen' && isOpenGround(x, z, 0.3) && distToPaths(x, z, island.trails) > 1, (x, z) => {
      for (let i = 0, n = 3 + Math.floor(rng() * 3); i < n; i++) {
        const h = rand(0.5, 1.1);
        const a = rand(0, Math.PI * 2);
        const frond = addDecor(glenFrondGeo, glenFrondMat, x + Math.cos(a) * 0.15, 0, z + Math.sin(a) * 0.15, 1, h, 1, root);
        frond.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
    });
  }

  // Generation 9: tufts of pale dune grass, leaning in the wind, and driftwood
  // on the dunes (after everything else drew from rng); you walk through the grass
  if (island.dunes) {
    scatter(30, 1.2, (x, z) => tileAt(x, z) === 'dune' && isOpenGround(x, z, 0.3) && distToPaths(x, z, island.trails) > 1, (x, z) => {
      for (let i = 0, n = 3 + Math.floor(rng() * 3); i < n; i++) {
        const h = rand(0.5, 1.1);
        const blade = addDecor(plumeGeo, plumeMat, x + rand(-0.25, 0.25), 0, z + rand(-0.25, 0.25), 1, h, 1, root);
        blade.rotation.set(rand(-0.15, 0.15), 0, rand(0.1, 0.3));
      }
    });
    scatter(3, 6, (x, z) => tileAt(x, z) === 'dune' && isOpenGround(x, z, 1) && distToPaths(x, z, island.trails) > 1.5, (x, z) => {
      const len = rand(1.2, 2);
      const log = new THREE.Mesh(driftGeo, [driftMat, driftEndMat, driftEndMat]);
      log.rotation.y = rand(0, Math.PI);
      log.scale.x = len;
      log.position.set(x, 0.14, z);
      log.castShadow = true;
      log.receiveShadow = true;
      root.add(log);
    });
  }

  // Generation 10: the sky isles overhead (src/skyisles.js)
  const sky = buildSkyIsles(island, { root, addCollider });

  // the lily pads drift a little (and on the sky isles, what turns turns)
  return (t) => {
    pads.forEach((pad, i) => {
      pad.position.y = -0.1 + Math.sin(t * 1.3 + i) * 0.012;
      pad.rotation.y += Math.sin(t * 0.4 + i) * 0.0008;
    });
    sky?.(t);
  };
}
