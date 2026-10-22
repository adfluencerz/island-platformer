import * as THREE from 'three';

// ---------- A puff of air ----------
// A little ring of soft white blobs that spreads out and fades under the
// farmer's feet: the double jump's push off nothing. puff(at): one at the
// point at (the feet); puff(at, { rise: true }): a curl of steam going up
// from there instead (a pan, a campfire); update(dt) every frame.
const BLOBS = 8;
const LIFE = 0.45; // seconds
const STEAM_LIFE = 1.1;
const blobGeo = new THREE.IcosahedronGeometry(0.16, 1);

export function createPuffs(scene) {
  const live = []; // { group, blobs, age }

  function puff(at, { rise = false } = {}) {
    const group = new THREE.Group();
    group.position.copy(at);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false });
    const blobs = [];
    for (let i = 0; i < BLOBS; i++) {
      const a = (i / BLOBS) * Math.PI * 2 + Math.random() * 0.4;
      const mesh = new THREE.Mesh(blobGeo, mat);
      mesh.userData.dir = rise ? new THREE.Vector3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3) : new THREE.Vector3(Math.cos(a), -0.15, Math.sin(a));
      mesh.userData.speed = rise ? 0.5 + Math.random() * 0.6 : 1.6 + Math.random() * 0.8;
      if (rise) mesh.position.y = -Math.random() * 0.3; // (a curl, not a ring)
      group.add(mesh);
      blobs.push(mesh);
    }
    scene.add(group);
    live.push({ group, mat, blobs, age: 0, life: rise ? STEAM_LIFE : LIFE });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      const k = p.age / p.life;
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
