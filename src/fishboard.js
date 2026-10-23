import * as THREE from 'three';
import { ITEMS } from './items.js';
import { weightText, BOARD_SIZE } from '../shared/fishing.js';

// ---------- A lobby's board of its biggest catches ----------
// A noticeboard on two posts by the lobby's pond (where the lobby says it
// stands: shared/fishing.js boardFor), with the heaviest fish landed there
// painted on it, both sides; E at it starts a fishing contest (main.js).
// show(board) repaints it: [[name, item, grams], ...], heaviest first.

const W = 512;
const H = 384;
const postMat = new THREE.MeshStandardMaterial({ color: 0x7a5432, roughness: 0.9 });
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x3f7f9a, roughness: 0.8 });

export function createFishBoard() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });

  const group = new THREE.Group();
  group.name = 'fish-board';
  for (const x of [-0.75, 0.75]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), postMat);
    post.position.set(x, 1.05, 0);
    group.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.25, 0.08), [edgeMat, edgeMat, edgeMat, edgeMat, face, face]);
  board.position.y = 1.3;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.4), roofMat);
  roof.position.y = 2.0;
  roof.rotation.x = 0.12;
  group.add(board, roof);
  group.traverse((obj) => obj.isMesh && (obj.castShadow = true));

  function paint(list) {
    const g = canvas.getContext('2d');
    g.fillStyle = '#d6aa6a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#c4955a';
    for (let y = 26; y < H; y += 44) g.fillRect(0, y, W, 4);
    g.fillStyle = '#3b2412';
    g.textAlign = 'center';
    g.font = 'bold 50px sans-serif';
    g.fillText('Biggest catches', W / 2, 56);
    g.font = '34px sans-serif';
    if (!list.length) {
      g.globalAlpha = 0.75;
      g.fillText('Nothing landed yet.', W / 2, 170);
      g.fillText('Be the first!', W / 2, 216);
      g.globalAlpha = 1;
    }
    g.font = '30px sans-serif';
    list.slice(0, BOARD_SIZE).forEach(([name, item, grams], i) => {
      const y = 112 + i * 46;
      g.textAlign = 'left';
      g.fillStyle = i ? '#3b2412' : '#9a3a12';
      g.fillText(`${i + 1}. ${ITEMS[item]?.name ?? item}`, 24, y);
      g.textAlign = 'right';
      g.fillText(`${weightText(grams)} · ${name.slice(0, 12)}`, W - 24, y);
    });
    g.textAlign = 'center';
    g.fillStyle = '#2f5f7a';
    g.font = 'bold 30px sans-serif';
    g.fillText('E: start a fishing contest', W / 2, H - 22);
    tex.needsUpdate = true;
  }
  paint([]);

  return {
    // onto the lobby's island (root), where the lobby says ({ x, z, yaw })
    placeIn(root, at) {
      group.removeFromParent();
      if (!at) return;
      group.position.set(at.x, 0, at.z);
      group.rotation.y = at.yaw;
      root.add(group);
    },
    show: paint,
  };
}
