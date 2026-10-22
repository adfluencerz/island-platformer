import * as THREE from 'three';
import { hashSeed } from '../shared/worldgen.js';
import { createItemMesh } from './itemmesh.js';

// ---------- Party game arenas ----------
// What a party game's arena looks like (built by world.js, as the islands in
// maps.js are), from the arena a seed grows (shared/arenas.js): a round
// meadow in the sea with hay bales to climb and, for a coin rush, its coins
// floating about. arenaMap(arena).coins is filled in as the world is built:
// a view per coin, by its id, for the page to hide as they are picked up.

const baleMat = new THREE.MeshStandardMaterial({ color: 0xe0c060, roughness: 0.95, flatShading: true });
const baleTopMat = new THREE.MeshStandardMaterial({ color: 0xead47a, roughness: 1, flatShading: true });
const twineMat = new THREE.MeshStandardMaterial({ color: 0x9a6a32, roughness: 0.9 });

export function arenaMap(arena) {
  const coins = [];
  return {
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
    keepClear: [[0, 0, 2.6], ...arena.coins.map(([x, , z]) => [x, z, 0.5])],
    coins,
    build: (ctx) => buildArena(arena, ctx, coins),
    decorate({ scatter, addBush, isOpenGround }) {
      scatter(10, 3, (x, z) => isOpenGround(x, z, 1) && Math.hypot(x, z) > arena.coast.r - 4, addBush);
    },
  };
}

function buildArena(arena, { root, addCollider }, coins) {
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
