import * as THREE from 'three';
import { detail } from './gfx/detail.js';

// ---------- The sky isles' styles ----------
// What each style of sky isle (SKY_STYLES, shared/skyisles.js) looks like:
// its colors (three `palettes`, one per variant), what hangs under it
// (`under`: the rock's look, `hang`: roots, icicles, crystals...), its floating
// steps (`step`), what stands about on it (`decor`) and its building. Drawn
// from a small kit of shapes (kit()), like the farm's pieces (src/build.js);
// src/skyisles.js puts it all together.
//
// A building stands on its isle's ground (y 0) round its middle, its front
// to the camera (+z), within house.w across and house.d deep. What should be
// in the way goes in `solids` too (kit's `solid`); what turns or bobs, in
// `moving` (kit's spin and bob).

// ---------- Materials ----------
// A palette's colors as materials, made once for each style and variant. Keys
// starting with `glow` shine a little, `glass` and `water` and `ice` are
// see-through, `metal` keys are shiny.
const matCache = new Map();
function material(key, color) {
  if (key.startsWith('glow')) return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4, flatShading: true });
  if (key.startsWith('glass')) return detail(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.75 }), 'glass'); // (the sky in it, the room dark behind)
  if (key.startsWith('water')) return new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 });
  if (key.startsWith('ice')) return new THREE.MeshStandardMaterial({ color, roughness: 0.2, transparent: true, opacity: 0.85, flatShading: true });
  if (key.startsWith('metal')) return detail(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6, flatShading: true }), 'metal');
  return detail(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }), undefined, key); // (painted by its key: roof tiles, wall plaster, wood... src/gfx/detail.js)
}
export function matsFor(styleId, variant) {
  const look = SKY_LOOKS[styleId];
  const key = `${styleId}/${variant}`;
  if (!matCache.has(key)) {
    const palette = { ...COMMON, ...look.palettes[variant % look.palettes.length] };
    matCache.set(key, Object.fromEntries(Object.entries(palette).map(([k, c]) => [k, material(k, c)])));
  }
  return matCache.get(key);
}
// (colors every style may use, unless its palette says otherwise)
const COMMON = {
  door: 0x6e4a2b, dark: 0x2a2018, glass: 0xbfe3ff, bark: 0x6b4423, leaf: 0x4f9e3c, stone: 0x9c9a92, white: 0xf4efe4,
  metal: 0x8a8a8a, metal2: 0x6a6a6a, metalGold: 0xe0b23a, flower: 0xffffff, flower2: 0xffe14d,
};

// ---------- The kit ----------
// Shapes into group, positioned by their bottom (y) unless said. Geometries are shared.
const geoCache = new Map();
const geo = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const BALL = new THREE.IcosahedronGeometry(1, 1);
const BLOB = new THREE.IcosahedronGeometry(1, 0);
const DOME = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
// a gable roof: a triangular prism, its ridge along x, 1 long, 1 deep and 1 high
const PRISM = (() => {
  const shape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);
})();
// a barn's roof, the same way: steep at the eaves, flatter at the top
const GAMBREL = (() => {
  const shape = new THREE.Shape([[-0.5, 0], [0.5, 0], [0.36, 0.55], [0, 0.85], [-0.36, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);
})();
const PYRAMID = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const cylGeo = (top, sides) => geo(`cyl/${top}/${sides}`, () => new THREE.CylinderGeometry(top, 1, 1, sides).translate(0, 0.5, 0));
const coneGeo = (sides) => geo(`cone/${sides}`, () => new THREE.ConeGeometry(1, 1, sides).translate(0, 0.5, 0));
const torusGeo = (tube) => geo(`torus/${tube}`, () => new THREE.TorusGeometry(1, tube, 6, 18).rotateX(Math.PI / 2));
// a five-pointed star, 1 across, 1 thick, lying flat
const STAR = (() => {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.22 : 0.5;
    points.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return new THREE.ExtrudeGeometry(new THREE.Shape(points), { depth: 1, bevelEnabled: false }).rotateX(-Math.PI / 2);
})();

// group: where the shapes go. solids: colliders ({ g, x, y, z, w, h, d }: in g's space, y its middle). moving: [(t) => ...]
export function kit(group, solids, moving) {
  const add = (geometry, mat, x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const k = {
    group,
    solid: (x, y, z, w, h, d) => solids.push({ g: group, x, y: y + h / 2, z, w, h, d }),
    box(mat, x, y, z, w, h, d, solid = false) {
      if (solid) k.solid(x, y, z, w, h, d);
      return add(BOX, mat, x, y, z, w, h, d);
    },
    // r at the bottom, r * top at the top
    cyl(mat, x, y, z, r, h, { top = 1, sides = 10, solid = false } = {}) {
      if (solid) k.solid(x, y, z, r * 1.6, h, r * 1.6);
      return add(cylGeo(top, sides), mat, x, y, z, r, h, r);
    },
    cone: (mat, x, y, z, r, h, sides = 8) => add(coneGeo(sides), mat, x, y, z, r, h, r),
    ball: (mat, x, y, z, r, sy = 1) => add(BALL, mat, x, y, z, r, r * sy, r), // (y: its middle)
    blob: (mat, x, y, z, r, sy = 1) => add(BLOB, mat, x, y, z, r, r * sy, r), // (y: its middle)
    dome: (mat, x, y, z, r, sy = 1) => add(DOME, mat, x, y, z, r, r * sy, r),
    gable: (mat, x, y, z, len, h, d) => add(PRISM, mat, x, y, z, len, h, d),
    gambrel: (mat, x, y, z, len, h, d) => add(GAMBREL, mat, x, y, z, len, h, d),
    pyramid: (mat, x, y, z, w, h, d) => add(PYRAMID, mat, x, y, z, w, h, d),
    ring: (mat, x, y, z, r, tube = 0.08) => add(torusGeo(tube), mat, x, y, z, r, r, r),
    star: (mat, x, y, z, size, thick = 0.15) => add(STAR, mat, x, y, z, size, thick, size),
    // a door in a wall whose front is at z (dark in a frame)
    door(mat, x, y, z, w = 0.8, h = 1.4) {
      add(BOX, mat, x, y, z, w + 0.14, h + 0.08, 0.1);
      return add(BOX, k.mats.dark, x, y, z + 0.02, w, h, 0.1);
    },
    window(mat, x, y, z, w = 0.5, h = 0.55, glass = k.mats.glass) {
      add(BOX, mat, x, y - 0.06, z, w + 0.14, h + 0.12, 0.08);
      return add(BOX, glass, x, y, z + 0.02, w, h, 0.08);
    },
    // things that turn (about their own axis, at speed) or bob
    spin(obj, speed, axis = 'y') {
      moving.push((t) => (obj.rotation[axis] = t * speed));
      return obj;
    },
    bob(obj, amount = 0.15, speed = 1.5) {
      const y = obj.position.y;
      const phase = obj.position.x + obj.position.z;
      moving.push((t) => (obj.position.y = y + Math.sin(t * speed + phase) * amount));
      return obj;
    },
    // a group of its own, positioned and turned, in the same kit
    sub(x, y, z, ry = 0) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = ry;
      group.add(g);
      const inner = kit(g, solids, moving);
      inner.mats = k.mats;
      return inner;
    },
  };
  return k;
}

// ---------- The floating steps ----------
// A step w across and d deep, its top at y 0 (its collider is 0.5 thick under that). i: its number up the stair.
const STEPS = {
  slab(k, m, w, d, i) {
    k.box(m.step, 0, -0.5, 0, w, 0.45, d);
    k.box(m.grass, 0, -0.06, 0, w + 0.06, 0.08, d + 0.06);
    if (i % 3 === 1) {
      k.cyl(m.stone, w / 2 - 0.2, 0, -d / 2 + 0.2, 0.09, 0.45, { sides: 6 });
      k.box(m.glowLamp, w / 2 - 0.29, 0.45, -d / 2 + 0.11, 0.18, 0.2, 0.18);
    }
  },
  cloud(k, m, w, d, i) {
    const r = Math.min(w, d) / 2;
    k.blob(m.step, 0, -0.2, 0, r * 1.05, 0.35);
    for (let j = 0; j < 5; j++) {
      const a = j * 1.3 + i;
      k.blob(m.step2, Math.cos(a) * r * 0.65, -0.25 - (j % 2) * 0.1, Math.sin(a) * r * 0.65, r * 0.55, 0.45);
    }
  },
  plank(k, m, w, d) {
    for (let j = 0; j < 4; j++) k.box(j % 2 ? m.step : m.step2, -w / 2 + (w / 4) * (j + 0.5), -0.18, 0, w / 4 - 0.04, 0.16, d);
    k.box(m.bark, 0, -0.32, -d / 2 + 0.2, w + 0.1, 0.12, 0.14);
    k.box(m.bark, 0, -0.32, d / 2 - 0.2, w + 0.1, 0.12, 0.14);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cyl(m.bark, (sx * w) / 2 - sx * 0.1, -0.3, (sz * d) / 2 - sz * 0.1, 0.06, 0.8, { sides: 6 });
  },
  crystal(k, m, w, d, i) {
    const r = Math.min(w, d) / 2;
    k.cyl(m.step, 0, -0.35, 0, r, 0.35, { sides: 6, top: 1 });
    const tip = k.cone(m.glow, 0, -0.35, 0, r * 0.8, 1.3 + (i % 3) * 0.3, 6);
    tip.rotation.x = Math.PI;
    tip.position.y = -0.35;
  },
  toadstool(k, m, w, d) {
    const r = Math.min(w, d) / 2;
    k.cyl(m.cap, 0, -0.35, 0, r, 0.35, { top: 0.85, sides: 14 });
    k.cyl(m.stalk, 0, -0.9, 0, r * 0.3, 0.6, { top: 1.2, sides: 8 });
    for (let j = 0; j < 4; j++) k.ball(m.dots, Math.cos(j * 1.7) * r * 0.55, 0, Math.sin(j * 1.7) * r * 0.55, 0.12, 0.3);
  },
  hex(k, m, w, d) {
    k.cyl(m.step, 0, -0.4, 0, Math.min(w, d) / 2 + 0.05, 0.4, { sides: 6 });
    k.cyl(m.glowHoney, 0, -0.02, 0, Math.min(w, d) / 2 - 0.25, 0.04, { sides: 6 });
    const drip = k.ball(m.glowHoney, 0.2, -0.5, 0.1, 0.12, 1.6);
    drip.position.y = -0.5;
  },
  leaf(k, m, w, d, i) {
    const leaf = k.cyl(i % 2 ? m.step : m.step2, 0, -0.12, 0, Math.min(w, d) / 2 + 0.15, 0.12, { sides: 9 });
    leaf.scale.z *= 1.25;
    k.box(m.bark, 0, -0.04, 0, 0.06, 0.03, d * 1.1);
    k.cyl(m.bark, 0, -0.6, d / 2, 0.05, 0.5, { sides: 5 });
  },
  ice(k, m, w, d, i) {
    k.box(m.ice, 0, -0.45, 0, w, 0.45, d);
    k.box(m.white, 0, -0.03, 0, w * 0.9, 0.05, d * 0.9);
    for (let j = 0; j < 3; j++) {
      const icicle = k.cone(m.ice, -w / 3 + (w / 3) * j, -0.45, (j % 2 ? 0.25 : -0.25) * d, 0.12, 0.6 + ((i + j) % 3) * 0.2, 5);
      icicle.rotation.x = Math.PI;
      icicle.position.y = -0.45;
    }
  },
  bamboo(k, m, w, d) {
    const n = Math.round(w / 0.24);
    for (let j = 0; j < n; j++) {
      const pole = k.cyl(j % 3 ? m.step : m.step2, -w / 2 + (w / n) * (j + 0.5), -0.12, -d / 2, 0.11, d, { sides: 6 });
      pole.rotation.x = Math.PI / 2; // (lying from the back edge to the front)
    }
    k.box(m.rope, -w / 3, -0.25, 0, 0.05, 0.27, d * 0.98);
    k.box(m.rope, w / 3, -0.25, 0, 0.05, 0.27, d * 0.98);
  },
  ruin(k, m, w, d, i) {
    k.box(m.step, 0, -0.7, 0, w, 0.7, d);
    k.box(m.grass, -w * 0.15, -0.04, -d * 0.1, w * 0.6, 0.06, d * 0.7);
    if (i % 2) k.box(m.leaf, w / 2 - 0.05, -1.4, 0, 0.08, 1.2, d * 0.5);
  },
  log(k, m, w, d) {
    const r = Math.min(w, d) / 2;
    k.cyl(m.bark, 0, -0.55, 0, r, 0.5, { sides: 12 });
    k.cyl(m.step, 0, -0.06, 0, r * 0.92, 0.07, { sides: 12 });
    k.ring(m.bark, 0, 0.01, 0, r * 0.5, 0.03);
  },
  tile(k, m, w, d, i) {
    k.box(m.step, 0, -0.45, 0, w, 0.45, d);
    k.box(m.step2, 0, -0.03, 0, w * 0.5, 0.04, d * 0.5).rotation.y = Math.PI / 4 + i;
  },
  lily(k, m, w, d, i) {
    const pad = k.cyl(m.step, 0, -0.1, 0, Math.min(w, d) / 2 + 0.15, 0.1, { sides: 16 });
    pad.rotation.y = i;
    k.cyl(m.step2, 0, -0.6, 0, 0.05, 0.5, { sides: 5 });
    if (i % 3 === 0) {
      for (let j = 0; j < 5; j++) {
        const petal = k.ball(m.flower, w * 0.25 + Math.cos(j * 1.26) * 0.12, 0.1, Math.sin(j * 1.26) * 0.12, 0.12, 0.6);
        petal.position.y = 0.06;
      }
    }
  },
  gear(k, m, w, d, i) {
    const r = Math.min(w, d) / 2;
    const g = k.sub(0, 0, 0);
    g.cyl(m.metal, 0, -0.35, 0, r * 0.85, 0.35, { sides: 16 });
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2;
      g.box(m.metal, Math.cos(a) * r * 0.9, -0.35, Math.sin(a) * r * 0.9, 0.25, 0.35, 0.25).rotation.y = -a;
    }
    g.cyl(m.metal2, 0, -0.02, 0, 0.18, 0.06, { sides: 8 });
    k.spin(g.group, i % 2 ? 0.25 : -0.25);
  },
  hay(k, m, w, d) {
    k.box(m.step, 0, -0.55, 0, w, 0.55, d);
    for (const x of [-w / 4, w / 4]) k.box(m.rope, x, -0.56, 0, 0.06, 0.57, d + 0.02);
  },
  book(k, m, w, d, i) {
    const cover = [m.step, m.step2, m.accent][i % 3];
    k.box(cover, 0, -0.42, 0, w, 0.06, d);
    k.box(m.white, 0.03, -0.36, 0, w - 0.12, 0.3, d - 0.1);
    k.box(cover, 0, -0.06, 0, w, 0.06, d);
    k.box(cover, -w / 2, -0.42, 0, 0.08, 0.42, d);
  },
  barnacle(k, m, w, d, i) {
    const r = Math.min(w, d) / 2;
    k.box(m.step, 0, -0.45, 0, w * 0.96, 0.45, d * 0.96);
    k.blob(m.step2, 0, -0.55, 0, r * 0.9, 0.5);
    for (let j = 0; j < 3; j++) k.ball(m.shell, Math.cos(j * 2 + i) * r * 0.6, -0.02, Math.sin(j * 2 + i) * r * 0.6, 0.1, 0.5);
  },
  star(k, m, w, d, i) {
    const size = Math.max(w, d) * 1.2;
    k.box(m.step, 0, -0.35, 0, w * 0.7, 0.33, d * 0.7);
    const s = k.star(i % 2 ? m.glow : m.step2, 0, -0.3, 0, size, 0.3);
    s.rotation.y = i * 0.7;
  },
};
export function drawStep(styleId, k, w, d, i) {
  STEPS[SKY_LOOKS[styleId].step](k, k.mats, w, d, i);
}

// ---------- Decor ----------
// One thing standing about on an isle, at x, z (its ground at y 0). Trees and
// the like are in the way (solid); the small things aren't.
const DECOR = {
  flowers(k, m, x, z, i) {
    for (let j = 0; j < 5; j++) {
      const a = j * 2.4 + i;
      const fx = x + Math.cos(a) * 0.3;
      const fz = z + Math.sin(a) * 0.3;
      k.cyl(m.leaf, fx, 0, fz, 0.015, 0.3, { sides: 4 });
      k.ball(j % 2 ? m.flower : m.flower2, fx, 0.32, fz, 0.07);
    }
  },
  bush: (k, m, x, z) => {
    k.blob(m.leaf, x, 0.35, z, 0.5, 0.8);
    k.blob(m.leaf, x + 0.3, 0.25, z + 0.1, 0.32);
  },
  tree(k, m, x, z, i) {
    const h = 1.6 + (i % 3) * 0.3;
    k.cyl(m.bark, x, 0, z, 0.16, h, { top: 0.7, sides: 6, solid: true });
    k.blob(m.leaf, x, h + 0.4, z, 0.95, 0.85);
    k.blob(m.leaf, x + 0.45, h + 0.1, z + 0.2, 0.6);
  },
  blossom(k, m, x, z, i) {
    const h = 1.5 + (i % 2) * 0.4;
    k.cyl(m.bark, x, 0, z, 0.14, h, { top: 0.6, sides: 6, solid: true });
    k.blob(m.blossom, x, h + 0.35, z, 0.9, 0.8);
    k.blob(m.blossom2, x - 0.4, h + 0.1, z + 0.25, 0.55);
    k.blob(m.blossom, x + 0.45, h + 0.2, z - 0.2, 0.5);
  },
  appletree(k, m, x, z, i) {
    DECOR.tree(k, m, x, z, i);
    const h = 1.6 + (i % 3) * 0.3;
    for (let j = 0; j < 6; j++) {
      const a = j * 1.05;
      k.ball(m.fruit, x + Math.cos(a) * 0.75, h + 0.2 + (j % 2) * 0.35, z + Math.sin(a) * 0.75, 0.11);
    }
  },
  pine(k, m, x, z, i) {
    const s = 0.9 + (i % 3) * 0.15;
    k.cyl(m.bark, x, 0, z, 0.13, 0.7, { sides: 6, solid: true });
    for (let j = 0; j < 3; j++) {
      k.cone(m.leaf, x, 0.5 + j * 0.65 * s, z, (0.85 - j * 0.22) * s, 1.1 * s, 7);
      if (m.snow) k.cone(m.snow, x, 0.95 + j * 0.65 * s, z, (0.45 - j * 0.12) * s, 0.55 * s, 7);
    }
  },
  palm(k, m, x, z, i) {
    const lean = i % 2 ? 0.25 : -0.25;
    for (let j = 0; j < 5; j++) k.cyl(m.bark, x + lean * j * 0.12, j * 0.55, z, 0.15 - j * 0.015, 0.56, { sides: 6, solid: j === 0 });
    const tx = x + lean * 0.6;
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      const frond = k.box(m.leaf, tx + Math.cos(a) * 0.55, 2.55, z + Math.sin(a) * 0.55, 1.2, 0.05, 0.3);
      frond.rotation.set(0, -a, -0.35);
    }
    k.ball(m.fruit, tx, 2.6, z, 0.12);
  },
  lantern(k, m, x, z) {
    k.box(m.stone, x, 0, z, 0.35, 0.12, 0.35);
    k.cyl(m.stone, x, 0.12, z, 0.08, 0.6, { sides: 6 });
    k.box(m.glowLamp, x, 0.72, z, 0.28, 0.26, 0.28);
    k.pyramid(m.stone, x, 0.98, z, 0.5, 0.22, 0.5);
  },
  crystals(k, m, x, z, i) {
    for (let j = 0; j < 4; j++) {
      const c = k.cyl(m.glow, x + Math.cos(j * 1.6 + i) * 0.22, 0, z + Math.sin(j * 1.6 + i) * 0.22, 0.12, 0.5 + (j % 2) * 0.4, { top: 0.2, sides: 6 });
      c.rotation.set(Math.sin(j * 2) * 0.35, 0, Math.cos(j * 2) * 0.35);
    }
  },
  mushrooms(k, m, x, z, i) {
    for (let j = 0; j < 3; j++) {
      const s = 0.5 + ((i + j) % 3) * 0.25;
      const mx = x + Math.cos(j * 2.1) * 0.35;
      const mz = z + Math.sin(j * 2.1) * 0.35;
      k.cyl(m.stalk, mx, 0, mz, 0.08 * s, 0.5 * s, { sides: 6 });
      k.dome(m.cap, mx, 0.45 * s, mz, 0.28 * s, 0.7);
    }
  },
  rocks(k, m, x, z, i) {
    k.blob(m.rock, x, 0.15, z, 0.4 + (i % 3) * 0.1, 0.6);
    k.blob(m.rockDark, x + 0.4, 0.08, z + 0.2, 0.22, 0.6);
  },
  puffs(k, m, x, z, i) {
    for (let j = 0; j < 3; j++) k.blob(m.white, x + Math.cos(j * 2 + i) * 0.3, 0.15, z + Math.sin(j * 2 + i) * 0.3, 0.35 - j * 0.06, 0.6);
  },
  bamboo(k, m, x, z, i) {
    for (let j = 0; j < 5; j++) {
      const bx = x + Math.cos(j * 2.4 + i) * 0.25;
      const bz = z + Math.sin(j * 2.4 + i) * 0.25;
      const h = 1.8 + ((i + j) % 4) * 0.4;
      k.cyl(m.stalk, bx, 0, bz, 0.05, h, { sides: 6, solid: j === 0 });
      for (let y = 0.6; y < h; y += 0.6) k.cyl(m.stalk2, bx, y, bz, 0.06, 0.04, { sides: 6 });
      k.box(m.leaf, bx + 0.15, h - 0.2, bz, 0.35, 0.03, 0.1).rotation.z = -0.4;
    }
  },
  skep(k, m, x, z) {
    for (let j = 0; j < 4; j++) k.cyl(m.roof, x, j * 0.18, z, 0.32 - j * 0.06, 0.19, { top: 0.85, sides: 10 });
    k.dome(m.roof, x, 0.72, z, 0.12, 0.8);
    k.box(m.dark, x, 0.05, z + 0.27, 0.12, 0.08, 0.06);
    for (let j = 0; j < 3; j++) k.bob(k.ball(m.glowHoney, x + Math.cos(j * 2) * 0.5, 0.8 + j * 0.15, z + Math.sin(j * 2) * 0.5, 0.04), 0.12, 3 + j);
  },
  crates(k, m, x, z, i) {
    k.box(m.wood, x, 0, z, 0.55, 0.45, 0.55);
    k.box(m.wood, x + 0.3, 0, z + 0.45, 0.45, 0.4, 0.45).rotation.y = 0.3;
    if (m.fruit) for (let j = 0; j < 4; j++) k.ball(m.fruit, x - 0.12 + (j % 2) * 0.24, 0.5, z - 0.12 + (j >> 1) * 0.24, 0.1);
    if (i % 2) k.box(m.wood, x, 0.45, z, 0.4, 0.35, 0.4).rotation.y = 0.6;
  },
  hay(k, m, x, z, i) {
    k.box(m.hay, x, 0, z, 0.9, 0.5, 0.55).rotation.y = i * 0.7;
    k.box(m.hay, x + 0.1, 0.5, z, 0.8, 0.45, 0.5).rotation.y = i * 0.7 + 0.3;
  },
  gears(k, m, x, z, i) {
    const g = k.sub(x, 0.45, z, i);
    g.group.rotation.x = Math.PI / 2 - 0.3;
    g.cyl(m.metal, 0, -0.06, 0, 0.45, 0.12, { sides: 12 });
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      g.box(m.metal, Math.cos(a) * 0.48, -0.06, Math.sin(a) * 0.48, 0.14, 0.12, 0.14).rotation.y = -a;
    }
  },
  books(k, m, x, z, i) {
    const covers = [m.roof, m.accent, m.wall, m.trim];
    for (let j = 0; j < 4; j++) k.box(covers[(i + j) % 4], x, j * 0.12, z, 0.5 - j * 0.04, 0.12, 0.36).rotation.y = j * 0.3;
    k.bob(k.ball(m.glow, x, 1, z, 0.08), 0.2, 2);
  },
  shells(k, m, x, z, i) {
    for (let j = 0; j < 4; j++) k.dome(j % 2 ? m.shell : m.white, x + Math.cos(j * 1.7 + i) * 0.3, 0, z + Math.sin(j * 1.7 + i) * 0.3, 0.13, 0.6);
    k.blob(m.rock, x - 0.3, 0.1, z - 0.2, 0.25, 0.6);
  },
  snowman(k, m, x, z) {
    k.ball(m.white, x, 0.35, z, 0.38);
    k.ball(m.white, x, 0.9, z, 0.27);
    k.ball(m.white, x, 1.3, z, 0.19);
    k.cone(m.carrot, x, 1.3, z + 0.17, 0.04, 0.2, 5).rotation.x = Math.PI / 2;
    k.box(m.roof, x, 0.95, z, 0.56, 0.06, 0.1);
    k.solid(x, 0, z, 0.6, 1.4, 0.6);
  },
  column(k, m, x, z, i) {
    k.box(m.wall, x, 0, z, 0.55, 0.2, 0.55);
    k.cyl(m.wall, x, 0.2, z, 0.2, 0.8 + (i % 3) * 0.5, { sides: 8, solid: true });
    if (i % 2) k.box(m.leaf, x + 0.1, 0.4, z + 0.2, 0.1, 0.6, 0.05);
  },
  pond(k, m, x, z) {
    k.cyl(m.stone, x, 0, z, 0.75, 0.1, { sides: 12 });
    k.cyl(m.water, x, 0.03, z, 0.62, 0.1, { sides: 12 });
    k.cyl(m.leaf, x + 0.25, 0.14, z, 0.16, 0.02, { sides: 8 });
  },
  starlamp(k, m, x, z, i) {
    k.cyl(m.metal, x, 0, z, 0.05, 1.3, { sides: 6 });
    k.spin(k.star(m.glow, x, 1.35, z, 0.45, 0.1), 0.6 + (i % 3) * 0.2).rotation.x = Math.PI / 2;
  },
};
export const DECOR_KINDS = Object.keys(DECOR);
export function drawDecor(kind, k, x, z, i) {
  DECOR[kind](k, k.mats, x, z, i);
}

// ---------- The buildings ----------
// k: the kit, at the building's middle. w, d: its room. v: the variant.
const BUILDINGS = {
  // A round gazebo of white columns under a dome, a cone or an onion
  cloud(k, m, w, d, v) {
    const r = Math.min(w, d) * 0.42;
    k.cyl(m.stone, 0, 0, 0, r + 0.25, 0.25, { sides: 14 });
    k.solid(0, 0, 0, (r + 0.25) * 1.5, 0.25, (r + 0.25) * 1.5);
    const n = v === 1 ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      k.cyl(m.wall, cx, 0.25, cz, 0.13, 2.2, { sides: 8 });
      k.solid(cx, 0.25, cz, 0.3, 2.2, 0.3);
    }
    k.cyl(m.trim, 0, 2.45, 0, r + 0.25, 0.18, { sides: 16 });
    if (v === 0) k.dome(m.roof, 0, 2.62, 0, r + 0.3, 0.75);
    else if (v === 1) k.cone(m.roof, 0, 2.62, 0, r + 0.45, 1.5, 16);
    else {
      k.ball(m.roof, 0, 3.3, 0, r * 0.8, 1.1);
      k.cone(m.roof, 0, 3.9, 0, r * 0.35, 1, 12);
    }
    k.bob(k.ball(m.accent, 0, v === 1 ? 4.3 : 4.1, 0, 0.16), 0.08);
    for (let i = 0; i < 4; i++) k.bob(k.blob(m.white, Math.cos(i * 1.6) * (r + 0.9), 3 + (i % 2) * 0.6, Math.sin(i * 1.6) * (r + 0.9), 0.45, 0.6), 0.2, 0.7);
  },
  // A windmill: a tapering tower, a cap, and sails that turn
  windmill(k, m, w, d, v) {
    const rb = Math.min(w, d) * 0.36;
    const h = 4.6 + v * 0.7;
    k.cyl(m.wall, 0, 0, 0, rb, h, { top: 0.68, sides: 10 });
    k.solid(0, 0, 0, rb * 1.5, h, rb * 1.5);
    for (let y = 1.2; y < h - 0.6; y += 1.3) k.cyl(m.trim, 0, y, 0, rb * (1 - (0.32 * y) / h) + 0.04, 0.1, { top: 1, sides: 10 });
    k.cone(m.roof, 0, h, 0, rb * 0.8, 1.4, 10);
    k.door(m.trim, 0, 0, rb - 0.02);
    k.window(m.trim, 0, h * 0.55, rb * 0.82 + 0.02);
    const sails = k.sub(0, h - 0.4, rb * 0.72 + 0.35);
    sails.cyl(m.metal, 0, -0.3, 0, 0.16, 0.6, { sides: 8 }).rotation.x = Math.PI / 2;
    const arms = v === 2 ? 6 : 4;
    for (let i = 0; i < arms; i++) {
      const arm = sails.sub(0, 0, 0.1, 0);
      arm.group.rotation.set(0, 0, (i / arms) * Math.PI * 2);
      arm.box(m.wood, 0, 0, 0, 0.1, 2.7, 0.08);
      arm.box(m.sail, 0.32, 0.6, 0, 0.5, 2, 0.04);
    }
    k.spin(sails.group, 0.8, 'z');
  },
  // A shrine of glowing crystals on a hexagonal stone base
  crystal(k, m, w, d) {
    const r = Math.min(w, d) * 0.45;
    k.cyl(m.stone, 0, 0, 0, r, 0.45, { sides: 6 });
    k.solid(0, 0, 0, r * 1.5, 0.45, r * 1.5);
    k.cyl(m.glow, 0, 0.45, 0, 0.5, 2.4, { top: 0.55, sides: 6, solid: true });
    k.cone(m.glow, 0, 2.85, 0, 0.28, 1.1, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const c = k.cyl(i % 2 ? m.glow : m.glow2, Math.cos(a) * r * 0.62, 0.45, Math.sin(a) * r * 0.62, 0.22, 0.9 + (i % 3) * 0.4, { top: 0.25, sides: 6 });
      c.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    }
    for (let i = 0; i < 3; i++) {
      const shard = k.cyl(m.glow2, Math.cos(i * 2.1) * 1.1, 3.6 + i * 0.3, Math.sin(i * 2.1) * 1.1, 0.12, 0.5, { top: 0.1, sides: 6 });
      k.bob(shard, 0.25, 1.2);
      k.spin(shard, 0.8);
    }
  },
  // A pagoda: tiers under flared roofs, red posts, a spire
  pagoda(k, m, w, d, v) {
    const tiers = 2 + v;
    const base = Math.min(w, d) * 0.8;
    k.box(m.stone, 0, 0, 0, base + 0.3, 0.3, base + 0.3, true);
    let y = 0.3;
    for (let i = 0; i < tiers; i++) {
      const s = base * (1 - i * 0.16);
      const h = i ? 0.9 : 1.4;
      k.box(m.wall, 0, y, 0, s * 0.82, h, s * 0.82, i === 0);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(m.trim, (sx * s * 0.82) / 2, y, (sz * s * 0.82) / 2, 0.14, h, 0.14);
      if (i === 0) k.door(m.trim, 0, y, (s * 0.82) / 2 + 0.02, 0.7, 1.1);
      else k.window(m.trim, 0, y + 0.25, (s * 0.82) / 2 + 0.02, 0.4, 0.4, m.glowLamp);
      y += h;
      k.pyramid(m.roof, 0, y, 0, s + 0.8, 0.55, s + 0.8);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tip = k.cone(m.roof, (sx * (s + 0.6)) / 2, y + 0.05, (sz * (s + 0.6)) / 2, 0.1, 0.35, 4);
        tip.rotation.set(sz * 0.6, 0, -sx * 0.6);
      }
      y += 0.25;
    }
    k.cyl(m.metalGold, 0, y + 0.2, 0, 0.05, 1.1, { sides: 6 });
    for (let i = 0; i < 3; i++) k.ring(m.metalGold, 0, y + 0.45 + i * 0.22, 0, 0.14 - i * 0.03, 0.03);
  },
  // A mushroom to live in: a fat stalk with a door and round windows, a spotted cap
  mushroom(k, m, w, d, v) {
    const r = Math.min(w, d) * 0.34;
    k.cyl(m.stalk, 0, 0, 0, r, 2.4, { top: 0.85, sides: 12, solid: true });
    k.door(m.wood, 0, 0, r - 0.05, 0.7, 1.3);
    for (const a of [-0.9, 0.9]) {
      const win = k.cyl(m.wood, Math.sin(a) * r * 0.92, 1.4, Math.cos(a) * r * 0.92, 0.2, 0.08, { sides: 10 });
      win.rotation.set(Math.PI / 2, 0, -a);
      const glass = k.cyl(m.glowLamp, Math.sin(a) * r * 0.95, 1.4, Math.cos(a) * r * 0.95, 0.14, 0.06, { sides: 10 });
      glass.rotation.set(Math.PI / 2, 0, -a);
    }
    const cr = r * (v === 2 ? 2.1 : 1.85);
    k.dome(m.cap, 0, 2.2, 0, cr, v === 1 ? 0.95 : 0.7);
    k.cyl(m.gill, 0, 2.05, 0, cr * 0.95, 0.15, { top: 0.6, sides: 16 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const up = i % 3 === 0 ? 0.4 : 0.85;
      const dist = cr * (i % 3 === 0 ? 0.35 : 0.72);
      k.ball(m.dots, Math.cos(a) * dist, 2.2 + cr * (v === 1 ? 0.95 : 0.7) * Math.sqrt(1 - up * up) * 0.98, Math.sin(a) * dist, 0.18, 0.35);
    }
    k.cyl(m.stone, r + 0.3, 0, r * 0.3, 0.1, 0.05, { sides: 6 });
    k.dome(m.cap, r + 0.6, 0.4, -r * 0.4, 0.3, 0.7);
    k.cyl(m.stalk, r + 0.6, 0, -r * 0.4, 0.07, 0.42, { sides: 6 });
  },
  // A striped lighthouse with a glowing lantern and a turning beam
  lighthouse(k, m, w, d, v) {
    const rb = Math.min(w, d) * 0.3;
    const bands = 6 + v;
    const bh = 0.75;
    for (let i = 0; i < bands; i++) {
      const f0 = 1 - (0.3 * i) / bands;
      const f1 = 1 - (0.3 * (i + 1)) / bands;
      k.cyl(i % 2 ? m.stripe : m.wall, 0, i * bh, 0, rb * f0, bh, { top: f1 / f0, sides: 12 });
    }
    const h = bands * bh;
    const rt = rb * 0.7;
    k.solid(0, 0, 0, rb * 1.5, h, rb * 1.5);
    k.door(m.trim, 0, 0, rb - 0.02, 0.6, 1.2);
    k.cyl(m.trim, 0, h, 0, rt + 0.35, 0.14, { sides: 12 });
    k.ring(m.trim, 0, h + 0.5, 0, rt + 0.3, 0.035);
    k.cyl(m.glassLight, 0, h + 0.14, 0, rt * 0.75, 0.9, { sides: 8 });
    k.cone(m.roof, 0, h + 1.04, 0, rt * 0.95, 0.8, 8);
    k.ball(m.metalGold, 0, h + 1.9, 0, 0.1);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.9, 7, 8, 1, true).rotateZ(Math.PI / 2).translate(3.5, 0, 0), beamMat);
    beam.position.set(0, h + 0.6, 0);
    k.group.add(beam);
    k.spin(beam, 0.7);
    // a little boat pulled up by it
    const boat = k.sub(rb + 0.7, 0, rb * 0.4, 0.4);
    boat.box(m.wood, 0, 0, 0, 0.4, 0.25, 1.3);
    boat.box(m.stripe, 0, 0.25, 0, 0.44, 0.05, 1.32);
  },
  // An observatory: a round room, a dome with a slit, a telescope
  stargazer(k, m, w, d, v) {
    const r = Math.min(w, d) * 0.44;
    k.cyl(m.wall, 0, 0, 0, r, 2.2, { sides: 14, solid: true });
    k.cyl(m.trim, 0, 2.2, 0, r + 0.08, 0.15, { sides: 14 });
    const dome = k.sub(0, 2.35, 0, v * 0.6 - 0.6);
    dome.dome(m.metal, 0, 0, 0, r, 0.95);
    dome.box(m.dark, 0, r * 0.15, r * 0.35, 0.5, r * 0.75, r * 0.7).rotation.x = -0.6;
    const scope = dome.cyl(m.metal2, 0, r * 0.5, r * 0.35, 0.18, 2.2, { top: 0.75, sides: 8 });
    scope.rotation.x = 0.75;
    k.door(m.trim, 0, 0, r - 0.02, 0.7, 1.3);
    k.window(m.trim, -r * 0.6, 1.2, r * 0.78, 0.4, 0.4, m.glowLamp).rotation.y = -0.6;
    k.window(m.trim, r * 0.6, 1.2, r * 0.78, 0.4, 0.4, m.glowLamp).rotation.y = 0.6;
    for (let i = 0; i < 5; i++) {
      const s = k.star(m.glow, Math.cos(i * 1.25) * (r + 1.2), 3.6 + (i % 2) * 0.7, Math.sin(i * 1.25) * (r + 1.2) - 0.5, 0.35, 0.08);
      s.rotation.x = Math.PI / 2;
      k.bob(s, 0.2, 1.1);
    }
  },
  // A beekeeper's cottage, thatched, with skeps beside it and bees about
  apiary(k, m, w, d, v) {
    const cw = w * 0.62;
    const cd = d * 0.62;
    k.box(m.wall, 0, 0, -d * 0.1, cw, 1.7, cd, true);
    for (const sx of [-1, 1]) k.box(m.wood, (sx * cw) / 2, 0, -d * 0.1, 0.14, 1.7, cd + 0.02);
    k.gable(m.roof, 0, 1.7, -d * 0.1, cw + 0.5, 1.2, cd + 0.6);
    k.door(m.wood, -cw * 0.2, 0, -d * 0.1 + cd / 2 + 0.02, 0.6, 1.2);
    k.window(m.wood, cw * 0.22, 0.9, -d * 0.1 + cd / 2 + 0.02, 0.45, 0.4, m.glowLamp);
    k.box(m.stone, cw * 0.32, 1.7, -d * 0.2, 0.3, 1.1, 0.3);
    const skeps = v === 2 ? 3 : 2;
    for (let i = 0; i < skeps; i++) DECOR.skep(k, m, -w * 0.42 + i * 0.75, d * 0.38, i);
    k.box(m.wood, -w * 0.42 + 0.35, 0, d * 0.38, (skeps - 1) * 0.75 + 0.6, 0.06, 0.6);
  },
  // An orchard's loft barn: a wooden shed under a gable, a loft door, crates of fruit
  orchard(k, m, w, d, v) {
    const bw = w * 0.72;
    const bd = d * 0.7;
    k.box(m.wall, 0, 0, -d * 0.1, bw, 2.2, bd, true);
    for (let y = 0.4; y < 2.2; y += 0.45) k.box(m.wood, 0, y, -d * 0.1 + bd / 2 + 0.01, bw, 0.05, 0.03);
    k.gable(m.roof, 0, 2.2, -d * 0.1, bw + 0.4, 1.3 + v * 0.2, bd + 0.5);
    k.door(m.trim, 0, 0, -d * 0.1 + bd / 2 + 0.02, 1, 1.5);
    k.box(m.trim, 0, 2.35, -d * 0.1 + bd / 2 + 0.02, 0.6, 0.6, 0.06);
    k.box(m.hay, 0, 2.4, -d * 0.1 + bd / 2 + 0.04, 0.5, 0.45, 0.06);
    DECOR.crates(k, m, -w * 0.38, d * 0.36, v);
  },
  // A snowy log cabin with a chimney (or, one look, an igloo)
  frost(k, m, w, d, v) {
    if (v === 2) {
      const r = Math.min(w, d) * 0.45;
      k.dome(m.ice, 0, 0, -0.2, r, 0.85);
      k.solid(0, 0, -0.2, r * 1.5, r * 0.85, r * 1.5);
      for (let i = 1; i < 4; i++) k.ring(m.white, 0, (r * 0.85 * i) / 4, -0.2, r * Math.sqrt(1 - (i / 4) ** 2) + 0.01, 0.03);
      const tunnel = k.cyl(m.ice, 0, 0.55, r - 0.3, 0.55, 1, { sides: 10 });
      tunnel.rotation.x = Math.PI / 2;
      tunnel.scale.set(0.55, 1, 0.55);
      k.box(m.dark, 0, 0, r + 0.21, 0.6, 0.8, 0.05);
      return;
    }
    const cw = w * 0.68;
    const cd = d * 0.66;
    k.box(m.wall, 0, 0, -d * 0.1, cw, 1.8, cd, true);
    for (let y = 0.15; y < 1.8; y += 0.3) {
      const log = k.cyl(m.wood, -cw / 2 - 0.05, y, -d * 0.1 + cd / 2, 0.11, cw + 0.1, { sides: 6 });
      log.rotation.z = -Math.PI / 2;
    }
    k.gable(m.roof, 0, 1.8, -d * 0.1, cw + 0.5, 1.2, cd + 0.6);
    k.gable(m.white, 0, 2.15, -d * 0.1, cw + 0.55, 0.9, cd * 0.62);
    k.door(m.trim, -cw * 0.2, 0, -d * 0.1 + cd / 2 + 0.12, 0.6, 1.2);
    k.window(m.trim, cw * 0.22, 0.85, -d * 0.1 + cd / 2 + 0.12, 0.45, 0.4, m.glowLamp);
    k.box(m.stone, cw * 0.3, 1.6, -d * 0.25, 0.35, 1.4, 0.35);
    k.box(m.white, cw * 0.3, 3, -d * 0.25, 0.4, 0.1, 0.4);
    for (let i = 0; i < 3; i++) k.bob(k.blob(m.smoke, cw * 0.3 + i * 0.15, 3.4 + i * 0.4, -d * 0.25, 0.18 + i * 0.06), 0.15, 0.8 + i * 0.2);
  },
  // A tea house: a raised floor, paper walls, a wide low roof, lanterns
  teahouse(k, m, w, d, v) {
    const fw = w * 0.86;
    const fd = d * 0.8;
    k.box(m.wood, 0, 0, 0, fw, 0.4, fd, true);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(m.post, (sx * fw) / 2 - sx * 0.1, 0.4, (sz * fd) / 2 - sz * 0.1, 0.16, 1.7, 0.16);
    k.box(m.paper, 0, 0.4, -fd / 2 + 0.12, fw - 0.3, 1.5, 0.06, true);
    for (const sx of [-1, 1]) k.box(m.paper, (sx * fw) / 2 - sx * 0.12, 0.4, -fd * 0.1, 0.06, 1.5, fd * 0.7, true);
    for (let x = -fw / 2 + 0.5; x < fw / 2 - 0.3; x += 0.5) k.box(m.post, x, 0.4, -fd / 2 + 0.16, 0.04, 1.5, 0.03);
    k.box(m.post, 0, 2.1, 0, fw + 0.2, 0.15, fd + 0.2);
    k.pyramid(m.roof, 0, 2.25, 0, fw + 1.3, v === 1 ? 1.4 : 0.9, fd + 1.3);
    k.box(m.roof, 0, v === 1 ? 3.3 : 2.95, 0, fw * 0.4, 0.15, 0.2);
    for (const sx of [-1, 1]) {
      k.box(m.post, (sx * fw) / 2, 1.8, fd / 2, 0.03, 0.3, 0.03);
      k.bob(k.ball(m.glowLamp, (sx * fw) / 2, 1.75, fd / 2, 0.16, 1.3), 0.03, 1);
    }
    k.box(m.mat, 0, 0.4, 0, fw * 0.5, 0.03, fd * 0.4);
  },
  // An old chapel, part fallen in, with a bell tower
  chapel(k, m, w, d, v) {
    const cw = w * 0.7;
    const cd = d * 0.78;
    const z0 = -d * 0.08;
    const wallT = 0.25;
    const h = 2.4;
    // the back wall, the side walls (broken off to the front), the front around a doorway
    k.box(m.wall, 0, 0, z0 - cd / 2 + wallT / 2, cw, h, wallT, true);
    for (const sx of [-1, 1]) {
      k.box(m.wall, (sx * (cw - wallT)) / 2, 0, z0 - cd * 0.15, wallT, h, cd * 0.7, true);
      k.box(m.wall, (sx * (cw - wallT)) / 2, 0, z0 + cd * 0.35, wallT, 0.6 + (sx > 0 ? 0.6 : 0), cd * 0.3, true);
      k.window(m.trim, (sx * (cw + 0.02)) / 2, 1.3, z0 - cd * 0.15, 0.4, 0.8, m.glassStained).rotation.y = (sx * Math.PI) / 2;
    }
    for (const sx of [-1, 1]) k.box(m.wall, (sx * (cw / 2 + 0.6)) / 2, 0, z0 + cd / 2 - wallT / 2, cw / 2 - 0.6, h, wallT, true);
    k.box(m.wall, 0, 1.7, z0 + cd / 2 - wallT / 2, 1.2, h - 1.7, wallT);
    k.gable(m.wall, 0, h, z0 - cd / 2 + wallT / 2, cw, 1.2, wallT);
    if (v === 1) k.gable(m.roof, 0, h, z0 - cd * 0.15, cw + 0.3, 1.25, cd * 0.75);
    if (v !== 0) for (let i = 0; i < 6; i++) k.box(m.leaf, -cw / 2 + 0.3 + i * (cw / 6), h - 0.6 - (i % 3) * 0.3, z0 - cd / 2 + wallT + 0.03, 0.25, 0.9 + (i % 2) * 0.4, 0.04);
    // the bell tower, at the front left
    const tx = -cw / 2 + 0.1;
    const tz = z0 + cd / 2 + 0.1;
    k.box(m.wall, tx, 0, tz, 0.9, 3.2, 0.9, true);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(m.wall, tx + sx * 0.36, 3.2, tz + sz * 0.36, 0.16, 1, 0.16);
    k.pyramid(m.roof, tx, 4.2, tz, 1.15, 0.9, 1.15);
    k.cone(m.metal, tx, 3.35, tz, 0.26, 0.5, 10);
    k.ball(m.metal, tx, 3.35, tz, 0.06);
  },
  // A great tree with a hut up in it and a rope ladder
  treehouse(k, m, w, d, v) {
    k.cyl(m.bark, 0, 0, -0.2, 0.6, 5.2, { top: 0.75, sides: 9, solid: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const root = k.cone(m.bark, Math.cos(a) * 0.55, 0, -0.2 + Math.sin(a) * 0.55, 0.28, 1.1, 5);
      root.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    k.cyl(m.wood, 0, 3, -0.2, 1.6, 0.16, { sides: 10 });
    k.box(m.wall, 0.4, 3.16, -0.4, 1.4, 1.2, 1.2);
    k.gable(m.roof, 0.4, 4.36, -0.4, 1.7, 0.8, 1.5);
    k.window(m.wood, 0.4, 3.6, 0.21, 0.4, 0.35, m.glowLamp);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.box(m.wood, Math.cos(a) * 1.5, 3.16, -0.2 + Math.sin(a) * 1.5, 0.06, 0.5, 0.06);
    }
    k.ring(m.wood, 0, 3.62, -0.2, 1.5, 0.03);
    for (let y = 0.3; y < 3; y += 0.4) k.box(m.wood, -0.5, y, 1.35, 0.5, 0.05, 0.05);
    for (const sx of [-0.25, 0.25]) k.box(m.rope, -0.5 + sx, 0, 1.35, 0.03, 3, 0.03);
    const leaves = [m.leaf, m.leaf2, m.leaf];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      k.blob(leaves[i % 3], Math.cos(a) * 1.3, 5.4 + (i % 2) * 0.6, -0.2 + Math.sin(a) * 1.1, 1.1 + (i % 3) * 0.2, 0.8);
    }
    k.blob(m.leaf2, 0, 6.4, -0.2, 1.3, 0.8);
    if (v === 2) for (let i = 0; i < 4; i++) k.bob(k.ball(m.glowLamp, Math.cos(i * 1.6) * 1.6, 4.6, -0.2 + Math.sin(i * 1.6) * 1.6, 0.1), 0.06, 2);
  },
  // A sandstone house under a dome, by a palm
  oasis(k, m, w, d, v) {
    const cw = w * 0.62;
    const cd = d * 0.68;
    k.box(m.wall, -w * 0.08, 0, -d * 0.1, cw, 2, cd, true);
    k.box(m.trim, -w * 0.08, 2, -d * 0.1, cw + 0.1, 0.15, cd + 0.1);
    k.dome(m.roof, -w * 0.08, 2.15, -d * 0.1, Math.min(cw, cd) * 0.45, v === 1 ? 1.4 : 1);
    k.cone(m.metalGold, -w * 0.08, 2.15 + Math.min(cw, cd) * 0.45 * (v === 1 ? 1.4 : 1), -d * 0.1, 0.08, 0.5, 6);
    k.box(m.dark, -w * 0.08, 0, -d * 0.1 + cd / 2 + 0.01, 0.75, 1.3, 0.05);
    k.dome(m.dark, -w * 0.08, 1.3, -d * 0.1 + cd / 2 + 0.01, 0.375, 1).scale.z = 0.05;
    for (const sx of [-1, 1]) k.window(m.trim, -w * 0.08 + sx * cw * 0.3, 1.1, -d * 0.1 + cd / 2 + 0.02, 0.3, 0.45, m.glowLamp);
    k.box(m.wall, w * 0.34, 0, -d * 0.3, 0.6, 3.2 + v * 0.4, 0.6, true);
    k.dome(m.roof, w * 0.34, 3.2 + v * 0.4, -d * 0.3, 0.38, 1.3);
    DECOR.palm(k, m, w * 0.42, d * 0.25, v);
  },
  // An open pavilion on a lily pond
  lily(k, m, w, d, v) {
    const r = Math.min(w, d) * 0.48;
    k.cyl(m.stone, 0, 0, 0, r + 0.15, 0.12, { sides: 18 });
    k.cyl(m.water, 0, 0.02, 0, r, 0.12, { sides: 18 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      k.cyl(m.leaf, Math.cos(a) * r * 0.75, 0.15, Math.sin(a) * r * 0.75, 0.25, 0.02, { sides: 10 });
      if (i % 2) k.ball(m.flower, Math.cos(a) * r * 0.75, 0.22, Math.sin(a) * r * 0.75, 0.08);
    }
    const pr = r * 0.55;
    k.cyl(m.wood, 0, 0, 0, pr + 0.1, 0.35, { sides: 6 });
    k.solid(0, 0, 0, pr * 1.5, 0.35, pr * 1.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.cyl(m.post, Math.cos(a) * pr, 0.35, Math.sin(a) * pr, 0.08, 1.9, { sides: 6 });
      k.solid(Math.cos(a) * pr, 0.35, Math.sin(a) * pr, 0.2, 1.9, 0.2);
    }
    k.cone(m.roof, 0, 2.25, 0, pr + 0.7, v === 2 ? 1.6 : 1.1, 6);
    k.ball(m.glowLamp, 0, 2.05, 0, 0.18);
    k.cyl(m.post, 0, 2.05, 0, 0.02, 0.2, { sides: 4 });
  },
  // A clock tower: a clock face whose hands go round, gears turning on its sides
  clockwork(k, m, w, d, v) {
    const s = Math.min(w, d) * 0.55;
    const h = 4.6 + v * 0.6;
    k.box(m.wall, 0, 0, -0.2, s, h, s, true);
    for (let y = 0.8; y < h; y += 1.2) k.box(m.trim, 0, y, -0.2, s + 0.08, 0.12, s + 0.08);
    k.pyramid(m.roof, 0, h, -0.2, s + 0.35, 1.8, s + 0.35);
    k.door(m.trim, 0, 0, -0.2 + s / 2 + 0.02, 0.65, 1.3);
    const face = k.sub(0, h - 1, -0.2 + s / 2 + 0.05);
    face.cyl(m.metal, 0, 0, 0, s * 0.38, 0.06, { sides: 16 }).rotation.x = Math.PI / 2;
    face.cyl(m.face, 0, 0, 0.02, s * 0.33, 0.06, { sides: 16 }).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      face.box(m.dark, Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28 - 0.03, 0.06, 0.04, 0.06, 0.02);
    }
    const hand = (len, speed) => {
      const g = face.sub(0, 0, 0.07);
      g.box(m.dark, 0, 0, 0, 0.04, len, 0.02);
      k.spin(g.group, -speed, 'z');
    };
    hand(s * 0.25, 0.05);
    hand(s * 0.18, 0.004);
    for (const sx of [-1, 1]) {
      const gear = k.sub((sx * s) / 2 + sx * 0.05, h * 0.45, -0.2);
      gear.group.rotation.z = Math.PI / 2;
      gear.cyl(m.metal2, 0, -0.05, 0, s * 0.3, 0.1, { sides: 12 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        gear.box(m.metal2, Math.cos(a) * s * 0.32, -0.05, Math.sin(a) * s * 0.32, 0.12, 0.1, 0.12).rotation.y = -a;
      }
      k.spin(gear.group, sx * 0.6, 'x');
    }
  },
  // A red barn under a gambrel roof, with a silo
  barn(k, m, w, d, v) {
    const bw = w * 0.66;
    const bd = d * 0.78;
    const x0 = -w * 0.12;
    k.box(m.wall, x0, 0, -d * 0.05, bw, 2.3, bd, true);
    k.gambrel(m.roof, x0, 2.3, -d * 0.05, bd + 0.3, 1.9, bw + 0.35).rotation.y = Math.PI / 2;
    k.gambrel(m.wall, x0, 2.3, -d * 0.05 + bd / 2 - 0.01, 0.02, 1.75, bw * 0.95).rotation.y = Math.PI / 2;
    const front = -d * 0.05 + bd / 2 + 0.03;
    k.box(m.trim, x0, 0, front, 1.4, 1.7, 0.05);
    k.box(m.wall, x0, 0.08, front + 0.01, 1.25, 1.55, 0.05);
    for (const r of [0.85, -0.85]) k.box(m.trim, x0, 0.85, front + 0.03, 0.1, 1.9, 0.03).rotation.z = r;
    k.box(m.trim, x0, 2.6, front, 0.6, 0.6, 0.05);
    k.box(m.dark, x0, 2.66, front + 0.01, 0.45, 0.45, 0.05);
    const sx = w / 2 - 0.65;
    k.cyl(m.silo, sx, 0, -d * 0.2, 0.6, 3.6 + v * 0.4, { sides: 12, solid: true });
    for (let y = 0.6; y < 3.6 + v * 0.4; y += 0.6) k.ring(m.metal, sx, y, -d * 0.2, 0.61, 0.025);
    k.dome(m.roof, sx, 3.6 + v * 0.4, -d * 0.2, 0.62, 0.8);
    k.ball(m.metalGold, x0, 4.3, -d * 0.05 + bd / 2 - 0.2, 0.08);
    const vane = k.sub(x0, 4.25, -d * 0.05);
    vane.cyl(m.metal, 0, 0, 0, 0.03, 0.6, { sides: 4 });
    vane.box(m.metal, 0.2, 0.5, 0, 0.5, 0.15, 0.03);
    k.spin(vane.group, 0.3);
  },
  // A crooked wizard's tower under a tall starry hat, orbs going round it
  wizard(k, m, w, d, v) {
    const r = Math.min(w, d) * 0.34;
    let y = 0;
    let x = 0;
    for (let i = 0; i < 3; i++) {
      const rr = r * (1 - i * 0.14);
      const h = 1.7 - i * 0.2;
      const part = k.cyl(m.wall, x, y, 0, rr, h, { top: 0.95, sides: 9, solid: i === 0 });
      part.rotation.z = (i - 1) * 0.04;
      k.window(m.trim, x, y + h * 0.5, rr * 0.93, 0.32, 0.5, m.glowLamp);
      k.cyl(m.trim, x, y + h - 0.08, 0, rr + 0.06, 0.12, { sides: 9 });
      y += h;
      x += (i % 2 ? -1 : 1) * 0.12;
    }
    k.door(m.trim, 0, 0, r - 0.02, 0.6, 1.2);
    const hat = k.sub(x, y, 0);
    hat.cyl(m.roof, 0, 0, 0, r * 1.25, 0.12, { sides: 14 });
    hat.cone(m.roof, 0, 0.1, 0, r * 0.95, 1.6, 12);
    const tip = hat.sub(0, 1.6, 0);
    tip.group.rotation.z = v === 1 ? 0.6 : -0.5;
    tip.cone(m.roof, 0, -0.1, 0, r * 0.38, 1.1, 10);
    for (let i = 0; i < 4; i++) {
      const s = hat.star(m.glow, Math.cos(i * 1.6) * r * 0.75, 0.4 + i * 0.25, Math.sin(i * 1.6) * r * 0.75, 0.22, 0.04);
      s.rotation.set(Math.PI / 2, 0, i);
    }
    const orbit = k.sub(0, y * 0.6, 0);
    for (let i = 0; i < 3; i++) orbit.ball(i % 2 ? m.glow : m.glow2, Math.cos((i / 3) * Math.PI * 2) * (r + 1), i * 0.3, Math.sin((i / 3) * Math.PI * 2) * (r + 1), 0.16);
    k.spin(orbit.group, 0.5);
  },
};
export function drawBuilding(styleId, k, w, d, variant) {
  BUILDINGS[styleId](k, k.mats, w, d, variant);
}
const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });

// ---------- The styles ----------
// palettes: grass (its top), soil, rock and rockDark (under it), and what its
// steps, building and decor use. under: how deep it hangs, as a share of its
// radius. hang: what hangs under it. decor: [kind, how many] (DECOR above).
export const SKY_LOOKS = {
  cloud: {
    under: 0.8, hang: 'puffs', step: 'cloud',
    decor: [['flowers', 5], ['puffs', 4], ['bush', 2]],
    palettes: [
      { grass: 0x9fd88a, soil: 0xf2f6ff, rock: 0xe8f0fb, rockDark: 0xc8d6ea, step: 0xffffff, step2: 0xe8f0fb, wall: 0xffffff, trim: 0xd8c8a0, roof: 0x8fc4ff, accent: 0xffe14d, flower: 0xffc2dc, flower2: 0xfff1a8 },
      { grass: 0xb6e09a, soil: 0xfff4f8, rock: 0xffeaf2, rockDark: 0xe8c8d8, step: 0xfff4f8, step2: 0xffe0ec, wall: 0xfff8f0, trim: 0xe0b23a, roof: 0xf4a6c8, accent: 0xffffff, flower: 0xd7b8ff, flower2: 0xffffff },
      { grass: 0x8ccf9a, soil: 0xeef8ff, rock: 0xe0eef8, rockDark: 0xb8cce0, step: 0xf0f8ff, step2: 0xd8e8f8, wall: 0xf0f0ea, trim: 0x9ab0c8, roof: 0xb8a0e8, accent: 0x9fe8ff, flower: 0x7ec8ff, flower2: 0xffffff },
    ],
  },
  windmill: {
    under: 1.1, hang: 'roots', step: 'plank',
    decor: [['flowers', 4], ['hay', 2], ['bush', 2], ['crates', 1]],
    palettes: [
      { grass: 0x79b54c, soil: 0x7a5532, rock: 0x8a857b, rockDark: 0x6c6b66, step: 0xa8713f, step2: 0x8f6136, wall: 0xe8dcc0, trim: 0x6e4a2b, roof: 0x9c3a2e, sail: 0xf4efe4, wood: 0x8f6136, hay: 0xe0c060, flower: 0xffe14d, flower2: 0xff7eb6 },
      { grass: 0x86c055, soil: 0x6e4a2b, rock: 0x9c9a92, rockDark: 0x7a7a76, step: 0xb4703a, step2: 0x9c5a2c, wall: 0x9c9a92, trim: 0x5a3e22, roof: 0x3f6e9c, sail: 0xe8d6b0, wood: 0x6e4a2b, hay: 0xd9b84a, flower: 0xffffff, flower2: 0xb58cff },
      { grass: 0x9a9a3a, soil: 0x7a5532, rock: 0x918b80, rockDark: 0x6c6b66, step: 0x9c6a3a, step2: 0x7a5232, wall: 0xb08a5a, trim: 0x4a3420, roof: 0x5a3a2a, sail: 0xd8452f, wood: 0x5a3e22, hay: 0xe8c86a, flower: 0xff9f1c, flower2: 0xffe14d },
    ],
  },
  crystal: {
    under: 1.3, hang: 'crystals', step: 'crystal',
    decor: [['crystals', 6], ['rocks', 3]],
    palettes: [
      { grass: 0x6a8a9a, soil: 0x4a5a6a, rock: 0x5a6a7a, rockDark: 0x3a4656, step: 0x5a6a7a, stone: 0x7a8a9a, glow: 0x7fe0ff, glow2: 0xb8f4ff },
      { grass: 0x8a6a9a, soil: 0x5a4a6a, rock: 0x6a5a7a, rockDark: 0x46384f, step: 0x6a5a7a, stone: 0x8a7a9a, glow: 0xff8fd0, glow2: 0xffc8ec },
      { grass: 0x5a8a6a, soil: 0x3a5a4a, rock: 0x4f6a5a, rockDark: 0x334a3f, step: 0x4f6a5a, stone: 0x7a9a8a, glow: 0x7fffb0, glow2: 0xd0ffe0 },
    ],
  },
  pagoda: {
    under: 1, hang: 'roots', step: 'slab',
    decor: [['blossom', 3], ['lantern', 3], ['flowers', 2]],
    palettes: [
      { grass: 0x86c055, soil: 0x7a5532, rock: 0x8a857b, rockDark: 0x6c6b66, step: 0x9c9a92, wall: 0xf4e8d0, trim: 0xb8322a, roof: 0x3a4a5a, glowLamp: 0xffd890, blossom: 0xf4b6cf, blossom2: 0xeb94b8, flower: 0xffc2dc, flower2: 0xffffff },
      { grass: 0x79b54c, soil: 0x6e4a2b, rock: 0x9c9a92, rockDark: 0x7a7a76, step: 0x8f8d86, wall: 0xf0e0c0, trim: 0x2f6a4a, roof: 0x8a2a22, glowLamp: 0xffc860, blossom: 0xffffff, blossom2: 0xf9d3e2, flower: 0xffe14d, flower2: 0xffffff },
      { grass: 0x7ab060, soil: 0x5a4a3a, rock: 0x7a786f, rockDark: 0x5a5852, step: 0x86817a, wall: 0xe8d8b8, trim: 0x1f2a3a, roof: 0x5a2a6a, glowLamp: 0xffe0a0, blossom: 0xd7b8ff, blossom2: 0xb894e8, flower: 0xd7b8ff, flower2: 0xffffff },
    ],
  },
  mushroom: {
    under: 1.1, hang: 'roots', step: 'toadstool',
    decor: [['mushrooms', 6], ['bush', 2], ['flowers', 2]],
    palettes: [
      { grass: 0x4f8a3a, soil: 0x5a3e22, rock: 0x6a5a48, rockDark: 0x4a3e32, cap: 0xd8452f, dots: 0xfff8ec, stalk: 0xf1e6cc, gill: 0xe8d2b0, wood: 0x8f6136, glowLamp: 0xffd890, flower: 0xffffff, flower2: 0xffe14d },
      { grass: 0x5a7a3a, soil: 0x4a3420, rock: 0x6a5a48, rockDark: 0x4a3e32, cap: 0x8e5bb8, dots: 0xf4ecff, stalk: 0xf1e6cc, gill: 0xd8c8e8, wood: 0x6e4a2b, glowLamp: 0xc8a0ff, flower: 0xd7b8ff, flower2: 0xffffff },
      { grass: 0x5a8a3a, soil: 0x5a3e22, rock: 0x7a6a50, rockDark: 0x5a4a38, cap: 0x8a5a34, dots: 0xf1dcb4, stalk: 0xf6ecd8, gill: 0xe8d2b0, wood: 0x6e4a2b, glowLamp: 0xffe08a, flower: 0xff9f1c, flower2: 0xffe14d },
    ],
  },
  lighthouse: {
    under: 1.2, hang: 'drips', step: 'barnacle',
    decor: [['shells', 4], ['rocks', 3], ['flowers', 1]],
    palettes: [
      { grass: 0x8ab060, soil: 0xd9c188, rock: 0x7a8a8a, rockDark: 0x5a6a6a, step: 0x6a7a7a, step2: 0x8a9a8a, shell: 0xf2a7b0, wall: 0xffffff, stripe: 0xd8452f, trim: 0x2a3a4a, roof: 0xd8452f, glassLight: 0xfff1a8, wood: 0x8f6136 },
      { grass: 0x9ab870, soil: 0xe0c690, rock: 0x8a8a7a, rockDark: 0x6a6a5a, step: 0x7a7a6a, step2: 0x9a9a7a, shell: 0xfff1e2, wall: 0xf4efe4, stripe: 0x2f5a9c, trim: 0x2a2a2a, roof: 0x2f5a9c, glassLight: 0xd8f8ff, wood: 0x6e4a2b },
      { grass: 0x7aa060, soil: 0xd9c188, rock: 0x6a7a80, rockDark: 0x4a5a60, step: 0x5a6a70, step2: 0x7a8a80, shell: 0xf0d9c0, wall: 0xfff8e8, stripe: 0x2f7a4a, trim: 0x3a2a1a, roof: 0x3a3a3a, glassLight: 0xffd890, wood: 0x8f6136 },
    ],
  },
  stargazer: {
    under: 1.2, hang: 'crystals', step: 'star',
    decor: [['starlamp', 3], ['rocks', 2], ['flowers', 2]],
    palettes: [
      { grass: 0x4a6a7a, soil: 0x2a3a4a, rock: 0x3a4a5a, rockDark: 0x232f3c, step: 0x3a4a6a, step2: 0xe0d8ff, glow: 0xffe14d, glow2: 0xfff8c0, wall: 0xe8e0f0, trim: 0x4a3a6a, metal: 0x9aa8c8, metal2: 0xd0b060, glowLamp: 0xffe08a, flower: 0xb8a0ff, flower2: 0xffffff },
      { grass: 0x3a5a6a, soil: 0x1f2a3a, rock: 0x2f3a4a, rockDark: 0x1a2230, step: 0x2a3a5a, step2: 0xc0d0ff, glow: 0x9fd8ff, glow2: 0xe0f4ff, wall: 0xd8d8e8, trim: 0x2a3a5a, metal: 0x3a4a8a, metal2: 0xc0c8d8, glowLamp: 0xc8e0ff, flower: 0x7ec8ff, flower2: 0xffffff },
      { grass: 0x5a5a7a, soil: 0x2a2a4a, rock: 0x3a3a5a, rockDark: 0x24243a, step: 0x4a3a6a, step2: 0xffd8f0, glow: 0xff9fd8, glow2: 0xffe0f4, wall: 0xf0e8e0, trim: 0x6a3a5a, metal: 0xb0905a, metal2: 0x8a6a3a, glowLamp: 0xffc8e0, flower: 0xffc2dc, flower2: 0xffffff },
    ],
  },
  apiary: {
    under: 1, hang: 'drips', step: 'hex',
    decor: [['flowers', 6], ['skep', 2], ['bush', 1]],
    palettes: [
      { grass: 0x86c055, soil: 0x7a5532, rock: 0x9a8a5a, rockDark: 0x7a6a3a, step: 0xe0a830, glowHoney: 0xffc840, wall: 0xf2e2b8, wood: 0x6e4a2b, roof: 0xd9b84a, glowLamp: 0xffd890, flower: 0xffe14d, flower2: 0xb58cff },
      { grass: 0x79b54c, soil: 0x6e4a2b, rock: 0x8a7a5a, rockDark: 0x6a5a3a, step: 0xd99a20, glowHoney: 0xffb020, wall: 0xe8d0a8, wood: 0x5a3e22, roof: 0xc9a040, glowLamp: 0xffc860, flower: 0xff7eb6, flower2: 0xffffff },
      { grass: 0x9ab84a, soil: 0x7a5532, rock: 0xa08a50, rockDark: 0x806a38, step: 0xf2b830, glowHoney: 0xffd860, wall: 0xfff0d0, wood: 0x8f6136, roof: 0xe0c060, glowLamp: 0xffe8a0, flower: 0x7ec8ff, flower2: 0xffe14d },
    ],
  },
  orchard: {
    under: 1, hang: 'roots', step: 'leaf',
    decor: [['appletree', 4], ['crates', 1], ['flowers', 2]],
    palettes: [
      { grass: 0x79b54c, soil: 0x7a5532, rock: 0x8a857b, rockDark: 0x6c6b66, step: 0x5aa83f, step2: 0x4f9e3c, wall: 0xb4703a, wood: 0x6e4a2b, trim: 0xf4efe4, roof: 0x6e4a2b, hay: 0xe0c060, fruit: 0xd8344f, flower: 0xffffff, flower2: 0xff7eb6 },
      { grass: 0x86973c, soil: 0x6e4a2b, rock: 0x8a857b, rockDark: 0x6c6b66, step: 0xd9822b, step2: 0xc4502b, wall: 0xa8603a, wood: 0x5a3e22, trim: 0xe8d6b0, roof: 0x5a3a2a, hay: 0xe8c86a, fruit: 0xe8a832, leaf: 0xd9822b, flower: 0xffe14d, flower2: 0xff9f1c },
      { grass: 0x86c055, soil: 0x7a5532, rock: 0x918b80, rockDark: 0x6c6b66, step: 0x8ad06a, step2: 0x6ab84a, wall: 0x9c3a2e, wood: 0x6e4a2b, trim: 0xffffff, roof: 0x3a4a5a, hay: 0xe0c060, fruit: 0x9fd83f, flower: 0xffc2dc, flower2: 0xffffff },
    ],
  },
  frost: {
    under: 1.2, hang: 'icicles', step: 'ice',
    decor: [['pine', 4], ['snowman', 1], ['rocks', 2]],
    palettes: [
      { grass: 0xf4f8ff, soil: 0xd8e4f0, rock: 0x8a9aaa, rockDark: 0x6a7a8a, ice: 0xbfe8ff, wall: 0x8f6136, wood: 0x6e4a2b, trim: 0x4a3420, roof: 0x5a3e22, glowLamp: 0xffd890, leaf: 0x2c6b3f, snow: 0xffffff, smoke: 0xe0e0e0, carrot: 0xe8821e },
      { grass: 0xeef4ff, soil: 0xd0dcf0, rock: 0x7a8aa0, rockDark: 0x5a6a80, ice: 0xa8d8ff, wall: 0xa8713f, wood: 0x8f6136, trim: 0x8a2a22, roof: 0x8a2a22, glowLamp: 0xffc860, leaf: 0x24603a, snow: 0xffffff, smoke: 0xe8e8e8, carrot: 0xe8821e },
      { grass: 0xf8fbff, soil: 0xe0ecf8, rock: 0x9aaabb, rockDark: 0x7a8a9a, ice: 0xe8f6ff, wall: 0x6e4a2b, wood: 0x5a3e22, trim: 0x2f5a9c, roof: 0x2f5a9c, glowLamp: 0xbfe8ff, leaf: 0x34784a, snow: 0xffffff, smoke: 0xf0f0f0, carrot: 0xe8821e },
    ],
  },
  teahouse: {
    under: 1, hang: 'vines', step: 'bamboo',
    decor: [['bamboo', 4], ['lantern', 2], ['rocks', 2]],
    palettes: [
      { grass: 0x6aa84a, soil: 0x5a4a3a, rock: 0x7a786f, rockDark: 0x5a5852, step: 0x8ab04a, step2: 0x6a9a3a, rope: 0x9a7a4a, wood: 0x8f6136, post: 0x4a3420, paper: 0xf8f0dc, roof: 0x3a4a3a, mat: 0xc8b878, glowLamp: 0xffb060, stalk: 0x7aa04a, stalk2: 0x5a8a3a, stone: 0x8f8d86 },
      { grass: 0x5a9a4a, soil: 0x4a3a2a, rock: 0x6a6860, rockDark: 0x4a4842, step: 0x9ab85a, step2: 0x7aa04a, rope: 0x8a6a3a, wood: 0x6e4a2b, post: 0x2a1a10, paper: 0xfff8e8, roof: 0x2a2a3a, mat: 0xb8a868, glowLamp: 0xff8a60, stalk: 0x8ab04a, stalk2: 0x6a9a3a, stone: 0x9c9a92 },
      { grass: 0x7ab05a, soil: 0x5a4a3a, rock: 0x86817a, rockDark: 0x66615a, step: 0xa8c070, step2: 0x88a850, rope: 0xa88a5a, wood: 0xa8713f, post: 0x6a3a2a, paper: 0xf4ead4, roof: 0x7a2a22, mat: 0xd8c888, glowLamp: 0xffd890, stalk: 0x6a9a3a, stalk2: 0x4a7a2a, stone: 0x8a857b },
    ],
  },
  chapel: {
    under: 1.1, hang: 'vines', step: 'ruin',
    decor: [['column', 3], ['flowers', 3], ['bush', 2]],
    palettes: [
      { grass: 0x6a9a3a, soil: 0x5a4a3a, rock: 0x8a857b, rockDark: 0x6c6b66, step: 0x9c9a92, wall: 0xb8b2a4, trim: 0x8a857b, roof: 0x5a4a4a, glassStained: 0x7fb0ff, metal: 0xd8dde6, flower: 0xffffff, flower2: 0xffe14d },
      { grass: 0x5a8a3a, soil: 0x4a3a2a, rock: 0x7a786f, rockDark: 0x5a5852, step: 0x8f8d86, wall: 0xa8a090, trim: 0x6c6b66, roof: 0x3a3a4a, glassStained: 0xff8fb0, metal: 0xe0b23a, flower: 0xb58cff, flower2: 0xffffff },
      { grass: 0x7aa04a, soil: 0x5a4a3a, rock: 0x9c9a92, rockDark: 0x7a7a76, step: 0xa8a49a, wall: 0xd0c8b8, trim: 0x9c9a92, roof: 0x6a3a2a, glassStained: 0x8fffb0, metal: 0xc0c8d0, flower: 0xff7eb6, flower2: 0xffe14d },
    ],
  },
  treehouse: {
    under: 1.2, hang: 'roots', step: 'log',
    decor: [['tree', 2], ['bush', 3], ['mushrooms', 2], ['flowers', 2]],
    palettes: [
      { grass: 0x4f8a3a, soil: 0x5a3e22, rock: 0x6a5a48, rockDark: 0x4a3e32, step: 0xc49a6c, bark: 0x6b4423, wood: 0xa8713f, wall: 0xc49a6c, roof: 0x5a7a3a, rope: 0xc8a870, leaf: 0x3f8a3a, leaf2: 0x5aa83f, glowLamp: 0xffd890, cap: 0xd8452f, stalk: 0xf1e6cc, flower: 0xffffff, flower2: 0xffe14d },
      { grass: 0x86973c, soil: 0x6e4a2b, rock: 0x7a6a50, rockDark: 0x5a4a38, step: 0xd0a878, bark: 0x5a3a1a, wood: 0x8f6136, wall: 0xb4844a, roof: 0x9c3a2e, rope: 0xb89860, leaf: 0xd9822b, leaf2: 0xe3a832, glowLamp: 0xffc860, cap: 0x8a5a34, stalk: 0xf1dcb4, flower: 0xff9f1c, flower2: 0xffe14d },
      { grass: 0x5a9a4a, soil: 0x4a3420, rock: 0x6a5a48, rockDark: 0x4a3e32, step: 0xb48a5c, bark: 0x7a5432, wood: 0xa8713f, wall: 0xe8d6b0, roof: 0x3f6e9c, rope: 0xd0b080, leaf: 0x2f7a45, leaf2: 0xf4b6cf, glowLamp: 0xc8f0ff, cap: 0x8e5bb8, stalk: 0xf1e6cc, flower: 0xd7b8ff, flower2: 0xffffff },
    ],
  },
  oasis: {
    under: 1, hang: 'none', step: 'tile',
    decor: [['palm', 2], ['pond', 1], ['rocks', 2], ['flowers', 1]],
    palettes: [
      { grass: 0xe0c690, soil: 0xc9a46a, rock: 0xc9945a, rockDark: 0xa8743f, step: 0xd9b07a, step2: 0xb8743f, wall: 0xe8c890, trim: 0xb8743f, roof: 0x3a8a9a, leaf: 0x4f9e3c, bark: 0x8a6a45, glowLamp: 0xffc860, fruit: 0x6a4a2a, water: 0x3aa0a8, flower: 0xff6b4a, flower2: 0xffe14d },
      { grass: 0xd9c188, soil: 0xc09a60, rock: 0xd0a070, rockDark: 0xb0804a, step: 0xe0c090, step2: 0xc08a50, wall: 0xf0dcb0, trim: 0x9c5a2c, roof: 0xe0b23a, leaf: 0x5aa83f, bark: 0x7a5a38, glowLamp: 0xffd890, fruit: 0x6a4a2a, water: 0x4ab0b8, flower: 0xff7eb6, flower2: 0xffffff },
      { grass: 0xe8cfa0, soil: 0xd0aa70, rock: 0xb8845a, rockDark: 0x98643a, step: 0xc9a46a, step2: 0xa8743f, wall: 0xd8a878, trim: 0x6e4a2b, roof: 0xf4efe4, leaf: 0x3f8a3a, bark: 0x9a7a55, glowLamp: 0xffb060, fruit: 0x6a4a2a, water: 0x2a90a0, flower: 0xd8452f, flower2: 0xffe14d },
    ],
  },
  lily: {
    under: 1, hang: 'vines', step: 'lily',
    decor: [['flowers', 4], ['pond', 2], ['bush', 2]],
    palettes: [
      { grass: 0x6ab05a, soil: 0x5a4a3a, rock: 0x7a8a7a, rockDark: 0x5a6a5a, step: 0x4f9e3c, step2: 0x3f7a2f, flower: 0xff9fcf, flower2: 0xffffff, water: 0x3aa0a8, stone: 0x9c9a92, wood: 0xa8713f, post: 0xf4efe4, roof: 0x2f7a6a, glowLamp: 0xffe8c0, leaf: 0x4f9e3c },
      { grass: 0x5aa06a, soil: 0x4a3a2a, rock: 0x6a7a6a, rockDark: 0x4a5a4a, step: 0x5aa83f, step2: 0x4a8a2f, flower: 0xffffff, flower2: 0xfff1a8, water: 0x4a90b8, stone: 0x8f8d86, wood: 0x8f6136, post: 0xb8322a, roof: 0x3a2a4a, glowLamp: 0xffd890, leaf: 0x5aa83f },
      { grass: 0x7ab86a, soil: 0x5a4a3a, rock: 0x86918a, rockDark: 0x66716a, step: 0x6ab84a, step2: 0x4a9a3a, flower: 0xd7b8ff, flower2: 0xffffff, water: 0x3ab0a0, stone: 0xa8a49a, wood: 0xb4703a, post: 0x6a8aa0, roof: 0x8a4a8a, glowLamp: 0xe8d8ff, leaf: 0x6ab84a },
    ],
  },
  clockwork: {
    under: 1.1, hang: 'chains', step: 'gear',
    decor: [['gears', 3], ['crates', 1], ['rocks', 2]],
    palettes: [
      { grass: 0x7a9a5a, soil: 0x5a4a3a, rock: 0x7a7068, rockDark: 0x5a524a, metal: 0xc9933a, metal2: 0xa8741e, wall: 0x9c5a3a, trim: 0x6a3a22, roof: 0x4f8a7a, face: 0xfff8e0, wood: 0x8f6136 },
      { grass: 0x6a8a5a, soil: 0x4a3a2a, rock: 0x6a6460, rockDark: 0x4a4440, metal: 0xd8b060, metal2: 0x8a7a6a, wall: 0x7a7a80, trim: 0x3a3a40, roof: 0x8a5a3a, face: 0xf4f0e8, wood: 0x6e4a2b },
      { grass: 0x8aa06a, soil: 0x5a4a3a, rock: 0x8a7a6a, rockDark: 0x6a5a4a, metal: 0xb08050, metal2: 0xd0b070, wall: 0xc8b090, trim: 0x5a3a2a, roof: 0x3a5a8a, face: 0xfffbe8, wood: 0x8f6136 },
    ],
  },
  barn: {
    under: 1, hang: 'roots', step: 'hay',
    decor: [['hay', 3], ['flowers', 3], ['crates', 1]],
    palettes: [
      { grass: 0x86c055, soil: 0x9c5a2c, rock: 0xb8743f, rockDark: 0x8a5a2c, step: 0xe0c060, rope: 0x8a5a2c, hay: 0xe0c060, wall: 0xb8322a, trim: 0xf4efe4, roof: 0x5a4a4a, silo: 0xc0c8d0, metal: 0x8a8a8a, wood: 0x8f6136, flower: 0xffe14d, flower2: 0xffffff },
      { grass: 0x9a9a3a, soil: 0xa8603a, rock: 0xc0804a, rockDark: 0x98603a, step: 0xd9b84a, rope: 0x6e4a2b, hay: 0xd9b84a, wall: 0x9c3a2e, trim: 0xf8e8c8, roof: 0x2a3a4a, silo: 0xd8c8a0, metal: 0x6a6a6a, wood: 0x6e4a2b, flower: 0xff9f1c, flower2: 0xffe14d },
      { grass: 0x79b54c, soil: 0x9c5a2c, rock: 0xb07a50, rockDark: 0x8a5a3a, step: 0xe8c86a, rope: 0x9c6a3a, hay: 0xe8c86a, wall: 0x3f6e9c, trim: 0xffffff, roof: 0x8a2a22, silo: 0xe8e8e8, metal: 0x9a9a9a, wood: 0x8f6136, flower: 0xff7eb6, flower2: 0xffffff },
    ],
  },
  wizard: {
    under: 1.3, hang: 'crystals', step: 'book',
    decor: [['books', 3], ['crystals', 2], ['mushrooms', 2]],
    palettes: [
      { grass: 0x5a7a6a, soil: 0x3a3a4a, rock: 0x5a5a6a, rockDark: 0x3a3a4a, step: 0x5a2a8a, step2: 0x2a5a8a, accent: 0x8a2a3a, wall: 0x8a8a9a, trim: 0x4a3a6a, roof: 0x4a2a8a, glow: 0xffe14d, glow2: 0x9fd8ff, glowLamp: 0xffd890, cap: 0x8e5bb8, stalk: 0xf1e6cc },
      { grass: 0x4a6a5a, soil: 0x2a2a3a, rock: 0x4a4a5a, rockDark: 0x2a2a3a, step: 0x2a4a8a, step2: 0x8a2a5a, accent: 0x2a7a5a, wall: 0x6a6a7a, trim: 0x2a2a4a, roof: 0x1f3a8a, glow: 0x9fffd8, glow2: 0xff9fd8, glowLamp: 0xc8f0ff, cap: 0x2f5a9c, stalk: 0xe8e8f0 },
      { grass: 0x6a6a7a, soil: 0x3a2a3a, rock: 0x5a4a5a, rockDark: 0x3a2a3a, step: 0x8a3a2a, step2: 0x3a6a3a, accent: 0x6a4a2a, wall: 0x9a8a7a, trim: 0x5a2a4a, roof: 0x7a2a5a, glow: 0xff9fd8, glow2: 0xffe14d, glowLamp: 0xffc8e0, cap: 0xd8452f, stalk: 0xf1e6cc },
    ],
  },
};
