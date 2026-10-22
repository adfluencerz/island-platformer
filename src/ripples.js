import * as THREE from 'three';
import { createItemMesh } from './itemmesh.js';

// ---------- Ripples and splashes ----------
// On the water: a ring spreading out and fading (a fish rising, the bobber
// landing), a splash of droplets, and a catch leaping out of the water to
// the farmer. Every frame update(dt). Each is short, and a pool of them
// keeps the count down however much is going on.

const RING_LIFE = 1.1; // seconds
const DROP_LIFE = 0.6;
const LEAP_TIME = 0.55;
const GRAVITY = 9;
const ringGeo = new THREE.RingGeometry(0.42, 0.5, 24).rotateX(-Math.PI / 2);
const dropGeo = new THREE.IcosahedronGeometry(0.045, 0);
const dropMat = new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.9, depthWrite: false });

export function createRipples(scene) {
  const rings = []; // { mesh, age, size }
  const drops = []; // { mesh, v, age }
  const leaps = []; // { mesh, from, to, age }

  // A ring on the water at x, y, z, `size` across at the most
  function ring(x, y, z, size = 1.2) {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
    mesh.position.set(x, y + 0.015, z);
    mesh.renderOrder = 1;
    scene.add(mesh);
    rings.push({ mesh, age: 0, size });
    if (rings.length > 40) end(rings, 0);
  }

  // Droplets thrown up at x, y, z, and a ring
  function splash(x, y, z, n = 10) {
    ring(x, y, z, 1.6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.6 + Math.random() * 0.9;
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.position.set(x, y + 0.05, z);
      scene.add(mesh);
      drops.push({ mesh, v: new THREE.Vector3(Math.cos(a) * out, 2 + Math.random() * 1.6, Math.sin(a) * out), age: 0 });
    }
    while (drops.length > 80) end(drops, 0);
  }

  // What was landed (an item) leaping out of the water at `from` in an arc to `to` (Vector3s)
  function leap(item, from, to) {
    const mesh = createItemMesh(item);
    mesh.scale.setScalar(0.8);
    mesh.position.copy(from);
    scene.add(mesh);
    leaps.push({ mesh, from: from.clone(), to: to.clone(), age: 0 });
  }

  function end(list, i) {
    const { mesh } = list[i];
    scene.remove(mesh);
    if (list === rings) mesh.material.dispose();
    list.splice(i, 1);
  }

  function update(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.age += dt;
      const k = r.age / RING_LIFE;
      if (k >= 1) {
        end(rings, i);
        continue;
      }
      r.mesh.scale.setScalar(0.2 + r.size * Math.sqrt(k));
      r.mesh.material.opacity = 0.6 * (1 - k);
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt;
      d.v.y -= GRAVITY * dt;
      d.mesh.position.addScaledVector(d.v, dt);
      if (d.age >= DROP_LIFE) end(drops, i);
    }
    for (let i = leaps.length - 1; i >= 0; i--) {
      const l = leaps[i];
      l.age += dt;
      const k = Math.min(1, l.age / LEAP_TIME);
      l.mesh.position.lerpVectors(l.from, l.to, k);
      l.mesh.position.y += Math.sin(k * Math.PI) * 1.4;
      l.mesh.rotation.set(0, Math.atan2(l.from.z - l.to.z, l.to.x - l.from.x), Math.sin(l.age * 22) * 0.5); // (the sprite faces +x)
      if (k >= 1) end(leaps, i);
    }
  }

  return { ring, splash, leap, update };
}
