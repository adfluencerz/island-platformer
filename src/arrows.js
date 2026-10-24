import * as THREE from 'three';
import { ARROW_SPEED } from '../shared/balance.js';

// ---------- Arrows in flight ----------
// A shot from a bow (src/main.js, src/bosses.js): an arrow flying from the
// bow to where it was aimed, a little arc to it, gone when it gets there.
// Just for show: the bop it makes has landed already. Every frame update(dt).

const ARC = 0.04; // how high the arc goes, for each metre flown
const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.6, 4).rotateX(Math.PI / 2);
const headGeo = new THREE.ConeGeometry(0.03, 0.09, 5).rotateX(Math.PI / 2).translate(0, 0, 0.33);
const tailGeo = new THREE.BoxGeometry(0.006, 0.06, 0.1).translate(0, 0, -0.26);
const shaftMat = new THREE.MeshStandardMaterial({ color: 0xc9a066, roughness: 0.8 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xa9b3c1, roughness: 0.4, metalness: 0.5 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xe0475b, roughness: 0.9 });

export function createArrows(scene) {
  const flying = []; // { mesh, from, to, t, time }
  const at = new THREE.Vector3();
  const ahead = new THREE.Vector3();

  // From `from` to `to` (Vector3s)
  function shoot(from, to) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(shaftGeo, shaftMat), new THREE.Mesh(headGeo, headMat));
    for (const turn of [0, Math.PI / 2]) mesh.add(new THREE.Mesh(tailGeo, tailMat).rotateZ(turn));
    mesh.position.copy(from);
    scene.add(mesh);
    flying.push({ mesh, from: from.clone(), to: to.clone(), t: 0, time: Math.max(0.05, from.distanceTo(to) / ARROW_SPEED) });
    if (flying.length > 30) end(0);
  }

  // where it is at t (0..1) of the way, into v
  function along(f, t, v) {
    v.lerpVectors(f.from, f.to, t);
    v.y += 4 * ARC * f.time * ARROW_SPEED * t * (1 - t);
    return v;
  }

  function end(i) {
    scene.remove(flying[i].mesh);
    flying.splice(i, 1);
  }

  return {
    shoot,
    update(dt) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt / f.time;
        if (f.t >= 1) {
          end(i);
          continue;
        }
        f.mesh.position.copy(along(f, f.t, at));
        f.mesh.lookAt(along(f, Math.min(1, f.t + 0.05), ahead));
      }
    },
  };
}
