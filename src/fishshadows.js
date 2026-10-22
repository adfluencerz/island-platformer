import * as THREE from 'three';

// ---------- Fish under the water ----------
// Dark shapes of fish drifting about in the water near the farmer: in a
// pond, in a lobby's pond and along the shore of whatever island we are on.
// Now and then one comes up and a ring spreads out where it rose; with a
// line out, the nearest comes over to look at the bobber. Only for show: what
// bites is rolled (shared/fishing.js), not these.
//
// regions(): where they swim now, [{ inside(x, z), sample(around), n, y,
// near }] (sample(around): a spot inside, near `around` for a `near` one,
// else anywhere; null if none was found). A near region's fish that end up
// far from the farmer swim off and turn up somewhere nearer.

const SPEED = [0.35, 0.8]; // world units a second
const FAR = 24; // a near region's fish further than this from the farmer go
const RISE_EVERY = [5, 12]; // seconds between one coming up, in each region
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0b2a3a, transparent: true, opacity: 0.26, depthWrite: false });
const shadowGeo = (() => {
  // a fish seen from above: a long oval body and a forked tail behind it (toward -x)
  const shape = new THREE.Shape();
  shape.moveTo(0.32, 0);
  shape.bezierCurveTo(0.3, 0.1, 0.05, 0.12, -0.14, 0.05);
  shape.lineTo(-0.3, 0.11);
  shape.lineTo(-0.26, 0);
  shape.lineTo(-0.3, -0.11);
  shape.lineTo(-0.14, -0.05);
  shape.bezierCurveTo(0.05, -0.12, 0.3, -0.1, 0.32, 0);
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
})();
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ripples: src/ripples.js. player: { position }. regions: as above
export function createFishShadows({ scene, ripples, player, regions }) {
  const group = new THREE.Group();
  group.name = 'fish-shadows';
  scene.add(group);
  let swimmers = []; // { mesh, region, heading, speed, turn, size }
  let shapes = []; // the regions on show, with when the next fish rises in each
  let sig = '';

  function spawn(region) {
    const at = region.sample(player.position);
    if (!at) return null;
    const mesh = new THREE.Mesh(shadowGeo, shadowMat);
    const size = rand(0.7, 1.5);
    mesh.scale.setScalar(size);
    mesh.position.set(at[0], region.y + 0.012, at[1]);
    mesh.renderOrder = 1;
    group.add(mesh);
    return { mesh, region, heading: rand(0, Math.PI * 2), speed: rand(...SPEED), turn: 0, size };
  }

  // Where they swim, again (when it has changed: a pond built, another island)
  function refresh() {
    const list = regions();
    const next = list.map((r) => r.key).join('|');
    if (next === sig) return;
    sig = next;
    for (const s of swimmers) group.remove(s.mesh);
    swimmers = [];
    shapes = list.map((region) => ({ region, riseAt: rand(...RISE_EVERY) }));
    for (const region of list) {
      for (let i = 0; i < region.n; i++) {
        const s = spawn(region);
        if (s) swimmers.push(s);
      }
    }
  }

  let since = 0;
  // dt: seconds. bobber: our line's bobber on the water ({ x, z }), or null
  function update(dt, bobber) {
    since += dt;
    if (since > 1.5) {
      since = 0;
      refresh();
    }
    group.visible = swimmers.length > 0;
    // the nearest to the bobber comes over to look
    let looker = null;
    if (bobber) {
      let best = 4;
      for (const s of swimmers) {
        const d = Math.hypot(s.mesh.position.x - bobber.x, s.mesh.position.z - bobber.z);
        if (d < best && s.region.inside(bobber.x, bobber.z)) {
          best = d;
          looker = s;
        }
      }
    }
    for (let i = 0; i < swimmers.length; i++) {
      const s = swimmers[i];
      const p = s.mesh.position;
      if (s.region.near && Math.hypot(p.x - player.position.x, p.z - player.position.z) > FAR) {
        group.remove(s.mesh);
        swimmers[i] = spawn(s.region) ?? s;
        if (swimmers[i] !== s) continue;
        group.add(s.mesh);
      }
      if (s === looker) {
        // round and round the bobber, a little way off
        const want = Math.atan2(bobber.z - p.z, bobber.x - p.x) + (Math.hypot(bobber.x - p.x, bobber.z - p.z) < 0.6 ? Math.PI / 2 : 0);
        s.heading += Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading)) * Math.min(1, dt * 2);
      } else {
        s.turn += rand(-1, 1) * dt * 2;
        s.turn *= 0.97;
        s.heading += s.turn * dt;
      }
      const step = s.speed * dt;
      const nx = p.x + Math.cos(s.heading) * step;
      const nz = p.z + Math.sin(s.heading) * step;
      if (s.region.inside(nx, nz)) {
        p.x = nx;
        p.z = nz;
      } else {
        s.heading += Math.PI * rand(0.6, 1.4); // (off the edge: turn back)
        s.turn = 0;
      }
      s.mesh.rotation.y = -s.heading;
    }
    // now and then, a fish comes up somewhere
    for (const shape of shapes) {
      shape.riseAt -= dt;
      if (shape.riseAt > 0) continue;
      shape.riseAt = rand(...RISE_EVERY);
      const s = swimmers.filter((w) => w.region === shape.region)[Math.floor(Math.random() * shape.region.n)];
      if (s && Math.hypot(s.mesh.position.x - player.position.x, s.mesh.position.z - player.position.z) < FAR) {
        ripples.ring(s.mesh.position.x, shape.region.y, s.mesh.position.z, 0.8 + s.size * 0.4);
      }
    }
  }

  return { update, refresh };
}
