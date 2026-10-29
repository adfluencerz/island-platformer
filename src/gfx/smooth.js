import * as THREE from 'three';

// ---------- Smooth forms: no faceted, flat-shaded look ----------
// The one switch (SMOOTH) for the whole game, so no material or builder has
// to change (src/main.js imports this first of all, before anything is made):
//  - flatShading is off on every material: set as it may be (`flatShading:
//    true` in a material's parameters, a copy, a clone), it reads false, so
//    no program is compiled FLAT_SHADED (a look that wants each facet its own
//    shade defines its own: world.js hookTree's GFX_PINE);
//  - a mesh given a faceted geometry (not indexed, each triangle's normals
//    its own face's: a polyhedron of detail 0, a pine's tier, the merged kits
//    of maps.js, homekit.js, build.js, the cliffs) has its normals smoothed
//    where it is set on the mesh, once a geometry (and its clones: a flag
//    in userData), creased: across an edge where two faces meet at more
//    than CREASE the edge stays hard (a box's, a roof's ridge, a pine's
//    rim); across the others the corners at a point share one normal. Only the faceted triangles
//    change: normals made smooth already (a cylinder's, a sphere's, the
//    grass's own) stay as they were. A geometry may set its own crease
//    (userData.crease, radians: world.js rockGeo).
export const SMOOTH = true;
export const CREASE = THREE.MathUtils.degToRad(52);

if (SMOOTH) {
  const flat = Symbol('flatShading');
  Object.defineProperty(THREE.Material.prototype, 'flatShading', {
    configurable: true,
    get() { return false; },
    set(v) { this[flat] = v; }, // (kept, never used)
  });

  const geo = Symbol('geometry');
  Object.defineProperty(THREE.Mesh.prototype, 'geometry', {
    configurable: true,
    get() { return this[geo]; },
    set(g) {
      this[geo] = g;
      if (g?.isBufferGeometry) smoothNormals(g);
    },
  });
}

const EPS = 1e-3;

// The geometry's faceted normals smoothed, in place (see above); returns it
export function smoothNormals(g, crease = g.userData.crease ?? CREASE) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  if (g.index || !pos || !nor || g.userData.gfxSmooth || pos.count < 6 || pos.count % 3) return g;
  g.userData.gfxSmooth = true;
  const tris = pos.count / 3;
  const face = new Float32Array(tris * 3);
  const faceted = new Uint8Array(tris);
  let any = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    c.sub(b);
    a.sub(b);
    c.cross(a);
    const l = c.length();
    if (l < 1e-12) continue;
    c.multiplyScalar(1 / l);
    face[t * 3] = c.x;
    face[t * 3 + 1] = c.y;
    face[t * 3 + 2] = c.z;
    let own = true;
    for (let k = 0; k < 3 && own; k++) {
      const i = t * 3 + k;
      own = Math.abs(nor.getX(i) * c.x + nor.getY(i) * c.y + nor.getZ(i) * c.z - 1) < EPS;
    }
    if (own) (faceted[t] = 1), any++;
  }
  if (!any) return g;
  // each corner's point (by position, to a hundredth of a millimetre)
  const q = (v) => Math.round(v * 1e4);
  const ids = new Map();
  const point = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${q(pos.getX(i))},${q(pos.getY(i))},${q(pos.getZ(i))}`;
    let id = ids.get(key);
    if (id === undefined) ids.set(key, (id = ids.size));
    point[i] = id;
  }
  // corners at a point join where their triangles share an edge from it and
  // meet at less than the crease: each group one normal, its faces' averaged
  // (by the angle at the corner)
  const up = new Int32Array(pos.count).map((_, i) => i);
  const find = (i) => {
    while (up[i] !== i) i = up[i] = up[up[i]];
    return i;
  };
  const cos = Math.cos(crease);
  const edges = new Map();
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      const j = t * 3 + ((k + 1) % 3);
      const [lo, hi] = point[i] < point[j] ? [i, j] : [j, i];
      const key = point[lo] * 1048576 + point[hi];
      const list = edges.get(key);
      if (!list) {
        edges.set(key, [[lo, hi]]);
        continue;
      }
      for (const [lo2, hi2] of list) {
        const u = (lo2 / 3) | 0;
        if (face[u * 3] * face[t * 3] + face[u * 3 + 1] * face[t * 3 + 1] + face[u * 3 + 2] * face[t * 3 + 2] < cos) continue; // (a crease: kept)
        up[find(lo)] = find(lo2);
        up[find(hi)] = find(hi2);
      }
      list.push([lo, hi]);
    }
  }
  const sum = new Float32Array(pos.count * 3);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = (i / 3) | 0;
    const k = i - t * 3;
    v.fromBufferAttribute(pos, i);
    e1.fromBufferAttribute(pos, t * 3 + ((k + 1) % 3)).sub(v);
    e2.fromBufferAttribute(pos, t * 3 + ((k + 2) % 3)).sub(v);
    const w = e1.angleTo(e2) || 0;
    const r = find(i) * 3;
    sum[r] += face[t * 3] * w;
    sum[r + 1] += face[t * 3 + 1] * w;
    sum[r + 2] += face[t * 3 + 2] * w;
  }
  for (let i = 0; i < pos.count; i++) {
    if (!faceted[(i / 3) | 0]) continue;
    const r = find(i) * 3;
    const l = Math.hypot(sum[r], sum[r + 1], sum[r + 2]) || 1;
    nor.setXYZ(i, sum[r] / l, sum[r + 1] / l, sum[r + 2] / l);
  }
  nor.needsUpdate = true;
  return g;
}
