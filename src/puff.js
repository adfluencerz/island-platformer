import * as THREE from 'three';

// ---------- A puff of air ----------
// A little ring of soft white blobs that spreads out and fades under the
// farmer's feet: the double jump's push off nothing. puff(at): one at the
// point at (the feet); update(dt) every frame.
const BLOBS = 8;
const LIFE = 0.45; // seconds
const blobGeo = new THREE.IcosahedronGeometry(0.16, 1);

export function createPuffs(scene) {
  const live = []; // { group, blobs, age }

  function puff(at) {
    const group = new THREE.Group();
    group.position.copy(at);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false });
    const blobs = [];
    for (let i = 0; i < BLOBS; i++) {
      const a = (i / BLOBS) * Math.PI * 2 + Math.random() * 0.4;
      const mesh = new THREE.Mesh(blobGeo, mat);
      mesh.userData.dir = new THREE.Vector3(Math.cos(a), -0.15, Math.sin(a));
      mesh.userData.speed = 1.6 + Math.random() * 0.8;
      group.add(mesh);
      blobs.push(mesh);
    }
    scene.add(group);
    live.push({ group, mat, blobs, age: 0 });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      const k = p.age / LIFE;
      for (const b of p.blobs) {
        b.position.addScaledVector(b.userData.dir, b.userData.speed * dt * (1 - k));
        b.scale.setScalar(0.7 + k * 0.9);
      }
      p.mat.opacity = 0.85 * (1 - k) ** 2;
      if (k >= 1) {
        scene.remove(p.group);
        p.mat.dispose();
        live.splice(i, 1);
      }
    }
  }

  return { puff, update };
}
