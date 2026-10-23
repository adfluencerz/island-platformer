import * as THREE from 'three';

// ---------- The glider leaf ----------
// A big green leaf held up over the farmer's head on its stalk while they
// glide (main.js says when: Jump held on the way down, with a glider leaf in
// the backpack). It opens out quickly, rocks a little in the air, and folds
// away again on landing. update(dt, gliding, time) every frame.
const OPEN_RATE = 14; // how fast it opens and folds (per second, eased)

const leafMat = new THREE.MeshStandardMaterial({ color: 0x7cc44a, roughness: 0.8, side: THREE.DoubleSide });
const ribMat = new THREE.MeshStandardMaterial({ color: 0x3f7f2a, roughness: 0.9 });
const stalkMat = new THREE.MeshStandardMaterial({ color: 0x6b8f2e, roughness: 0.9 });

// A leaf's outline: pointed at both ends, widest a little past the middle
function leafGeometry(length, width) {
  const s = new THREE.Shape();
  s.moveTo(0, -length / 2);
  s.bezierCurveTo(width * 0.75, -length * 0.3, width * 0.6, length * 0.3, 0, length / 2);
  s.bezierCurveTo(-width * 0.6, length * 0.3, -width * 0.75, -length * 0.3, 0, -length / 2);
  return new THREE.ShapeGeometry(s, 8);
}

export function createGlider(farmer) {
  const root = new THREE.Group();
  root.visible = false;
  farmer.root.add(root);

  // the stalk, from the farmer's hands up past the hat
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.85, 6), stalkMat);
  stalk.position.y = 0.72;
  root.add(stalk);
  // the leaf, lying flat over the top, its tip forward; a rib down the middle
  const canopy = new THREE.Group();
  canopy.position.y = 1.15;
  root.add(canopy);
  const leaf = new THREE.Mesh(leafGeometry(1.5, 1.1), leafMat);
  leaf.rotation.x = Math.PI / 2;
  canopy.add(leaf);
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 1.4), ribMat);
  rib.position.y = 0.01;
  canopy.add(rib);
  root.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  let open = 0; // 0: folded away, 1: fully open

  return {
    root,
    update(dt, gliding, time) {
      open += ((gliding ? 1 : 0) - open) * (1 - Math.exp(-OPEN_RATE * dt));
      if (!gliding && open < 0.02) open = 0;
      root.visible = open > 0;
      if (!root.visible) return;
      root.scale.setScalar(0.3 + open * 0.7);
      canopy.scale.set(open, 1, 0.4 + open * 0.6);
      canopy.rotation.z = Math.sin(time * 3.1) * 0.08 * open; // rocking side to side
      canopy.rotation.x = -0.12 + Math.sin(time * 2.3) * 0.04 * open; // tip up a little, into the air
    },
  };
}
