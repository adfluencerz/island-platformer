import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEFAULT_LOOK } from '../shared/looks.js';
import { hook } from './gfx/shading.js';
import { patch, define } from './gfx/chunks.js';
import { use } from './gfx/uniforms.js';
import { detail } from './gfx/detail.js';

// ---------- Character model ----------
// A little farmer built from primitives, used for the local player, for
// everyone else in the game, for the merchant and in the wardrobe's preview.
// Collision uses the simple box in main.js; this is purely visual. The model
// faces +Z (matching the atan2(x, z) facing) and `rig` has its origin at the
// feet, so squash & stretch scales from the ground up. `root` goes at the
// collision center, `height` above the feet.
//
// What a farmer wears is their look (shared/looks.js) and their shirt's color.
// The pieces of each part that moves on its own (the body with the head, each
// arm, each leg, the eyes, which blink) are merged into one mesh per
// material, so a farmer is a couple of dozen draw calls however much they
// have on. A new look builds the pieces again; a new color only repaints.

const HIP_Y = 0.55; // rig: where the legs pivot, and the torso's origin
const HEAD_Y = 0.8; // torso: the middle of the head
const HEAD_R = 0.25;
const SHOULDER_Y = 0.49; // torso: where the arms pivot (and the body's shoulder, how far out)
const LEG_X = 0.13; // where the legs pivot, either side (his; hers a little closer)
const ARM_LEN = 0.42; // shoulder to the middle of the hand
const HAND = new THREE.Vector3(0, -ARM_LEN, 0); // (in the arm's pivot, where tools are held)
const EYE = { lat: 0.06, lon: 0.37 }; // up from the head's equator, and round from its front (radians)

const HOE_REST_ANGLE = 0.9; // handle tilted forward/up from the arm
const ROD_REST_ANGLE = 1.15; // a fishing rod, further forward
export const HOE_SWING_TIME = 0.4; // seconds

// Hoe swing keyframes: [time 0..1, arm angle, hoe angle relative to arm]
const SWING_KEYS = [
  [0, 0, HOE_REST_ANGLE],
  [0.35, -2.6, HOE_REST_ANGLE], // wind up over the head
  [0.6, -0.9, 3.0], // chop down in front
  [1, 0, HOE_REST_ANGLE],
];

function sampleSwing(t) {
  for (let i = 1; i < SWING_KEYS.length; i++) {
    const [t1, arm1, hoe1] = SWING_KEYS[i];
    if (t <= t1) {
      const [t0, arm0, hoe0] = SWING_KEYS[i - 1];
      const k = THREE.MathUtils.smoothstep(t, t0, t1);
      return [THREE.MathUtils.lerp(arm0, arm1, k), THREE.MathUtils.lerp(hoe0, hoe1, k)];
    }
  }
  return [0, HOE_REST_ANGLE];
}

// Exponential smoothing factor for frame-rate independent easing
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// ---------- Light ----------
// A soft light on the edges of the farmers (and the neighbours, the animals
// and the mounts: rimmed()), so they stand out from the grass under the low
// camera. Two parts. The sky's: main.js keeps it with the time of day
// (lightFarmers), the sky's color warmed a little toward the sun's, a narrow
// band right at the silhouette all round. The sun's (the moon's at night,
// src/gfx/uniforms.js uSunDir, uSunColor): on the edges that face it, and
// most when it is behind them, so at dusk a farmer walking into the low sun
// is outlined in warm light and at noon the hat and shoulders catch it. As
// much as the surface would give back (its own color, lifted): light cloth
// and skin keep it all, dark hair only a faint edge, not a pale halo.
// The same hook darkens what faces the ground (under a brim, a chin, an
// animal's belly), so a figure reads as a solid with a lit top and a shaded
// underside, and puts a small glint of the sun on metal (a blade, brass, a
// bell) that the bloom picks up.
const RIM = { warm: new THREE.Color(1, 0.9, 0.76), warmth: 0.45, from: 0.35, sunFrom: 0.1, sun: 0.55, under: 0.32, glint: 1.1 };
const rim = { value: new THREE.Color(0.12, 0.12, 0.12) };
const _warm = new THREE.Color();
export function lightFarmers(color, strength) {
  const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b; // (as bright as the sky, in a warmer hue)
  rim.value.copy(color).lerp(_warm.copy(RIM.warm).multiplyScalar(luma), RIM.warmth).multiplyScalar(strength);
}
const f2 = (v) => v.toFixed(2);
function rimShader(shader) {
  define(shader, 'GFX_RIM');
  shader.uniforms.uFarmerRim = rim;
  use(shader, ['uSunDir', 'uSunColor'], 'f');
  shader.fragmentShader = 'uniform vec3 uFarmerRim;\n' + patch(shader.fragmentShader, 'emissivemap_fragment', `
    vec3 rimV = normalize(vViewPosition);
    vec3 rimL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
    float farmerEdge = smoothstep(${f2(RIM.from)}, 1.0, 1.0 - max(dot(normal, rimV), 0.0));
    vec3 rimGive = min(vec3(1.0), 0.2 + 1.6 * diffuseColor.rgb);
    totalEmissiveRadiance += uFarmerRim * (farmerEdge * farmerEdge) * rimGive;
    float rimSun = smoothstep(-0.15, 0.55, dot(normal, rimL)) * (0.35 + 0.65 * smoothstep(0.3, -0.6, dot(rimV, rimL)));
    float sunEdge = smoothstep(${f2(RIM.sunFrom)}, 1.0, 1.0 - max(dot(normal, rimV), 0.0));
    totalEmissiveRadiance += uSunColor * (${f2(RIM.sun)} * sunEdge * sunEdge * rimSun) * rimGive;
    float rimDown = dot(normal, normalize((viewMatrix * vec4(0.0, -1.0, 0.0, 0.0)).xyz));
    diffuseColor.rgb *= 1.0 - ${f2(RIM.under)} * smoothstep(0.4, 1.0, rimDown); // (what faces well down: not a face seen from above)
    #ifdef STANDARD
      float rimGlint = pow(max(dot(reflect(-rimV, normal), rimL), 0.0), 36.0);
      totalEmissiveRadiance += uSunColor * (${f2(RIM.glint)} * rimGlint * metalnessFactor);
    #endif`, 'GFX_RIM');
}
// The rim on a lit material (the same for all: one shader program a kind of material)
export const rimmed = (m) => hook(m, 'rim', rimShader);

const mat = (color, opts = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts });
  m.userData.noSnow = true; // (snow keeps off the farmers: src/seasons.js)
  return rimmed(m);
};
// too small to cast a shadow worth drawing
const noShadow = (m) => ((m.userData.noShadow = true), m);

// ---------- The contact shadow ----------
// A soft dark blob on the ground under a farmer, an animal or a foe, so they
// sit in the grass instead of floating over it (the sun's own shadow falls
// long and to one side at dusk, and the low tier has none). One plane and
// one material shared by all of them: one draw each, no light, no shadow.
// Drawn after the ground, under the grass carpet's blades in front of it.
const CONTACT = { color: 0x10141c, opacity: 0.6, y: 0.06, r: 0.62 };
let contactMat = null;
const contactGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
function contactMaterial() {
  if (contactMat) return contactMat;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, v] of [[0, 1], [0.4, 0.85], [0.75, 0.35], [1, 0]]) grad.addColorStop(at, gray(Math.round(v * 255)));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const alphaMap = new THREE.CanvasTexture(canvas);
  alphaMap.colorSpace = THREE.NoColorSpace;
  contactMat = new THREE.MeshBasicMaterial({
    color: CONTACT.color, alphaMap, transparent: true, opacity: CONTACT.opacity,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  contactMat.userData.noSnow = contactMat.userData.contact = true;
  return contactMat;
}
// rx across, rz along (the +z the model faces), at y over the feet
export function contactShadow(rx, rz = rx, y = CONTACT.y) {
  const mesh = new THREE.Mesh(contactGeo, contactMaterial());
  mesh.name = 'contact';
  mesh.scale.set(rx, 1, rz);
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.noShadow = true;
  return mesh;
}

// ---------- Cloth ----------
// Little tiling pictures for the cloth, drawn once. Most are shades of gray
// that darken the material's own color (a weave, a twill, a knit, a check);
// stripes and dots are drawn in the color they go with (one picture per
// color). Thread by thread, each thread its own shade (slubs), so the weave
// reads up close; the knit's stitches and the plaid's check big enough to
// read from the play camera, past the light and the tone mapping. The plain
// weave, the twill and the knit span four of a shape's tiles (repeat), so a
// thread keeps its size and the picture its detail. The rest of the look
// (folds, seams, the worn knees) is the 'garment' detail (src/gfx/detail.js).
const textures = new Map();
function texture(key, size, draw, srgb = false, repeat = 1) {
  if (!textures.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 4;
    textures.set(key, tex);
  }
  return textures.get(key);
}
const gray = (v) => `rgb(${v},${v},${v})`;
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
// the same threads every time (a picture is drawn once, but alike on every page)
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
// a gray picture from shade(x, y) (0..255), pixel by pixel
function shades(g, n, shade) {
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = Math.max(0, Math.min(255, Math.round(shade(x, y))));
    const i = (y * n + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
// each of n threads its own shade, now and then a slub (a thicker, paler run)
const threads = (n, rand, base, spread) => Array.from({ length: n }, () => base + (rand() - 0.5) * spread + (rand() < 0.12 ? spread * 0.8 : 0));

// a plain weave, two pixels a thread: over, under
const clothTex = () => texture('cloth', 64, (g, n) => {
  const rand = seeded(7);
  const warp = threads(n / 2, rand, 248, 20);
  const weft = threads(n / 2, rand, 214, 26);
  shades(g, n, (x, y) => {
    const over = ((x >> 1) + (y >> 1)) % 2;
    const edge = (over ? x : y) % 2 ? 0.9 : 1; // (each thread rounded)
    const mottle = 1 + 0.06 * Math.sin((x / n) * Math.PI * 4 + 1.1) * Math.sin((y / n) * Math.PI * 2 + 0.4); // (a painterly unevenness that still reads from the play camera)
    return (over ? warp[x >> 1] : weft[y >> 1]) * edge * mottle + (rand() - 0.5) * 6;
  });
}, false, 0.25);
// denim's diagonal twill, the blue warp heathered up and down, paler streaks
const twillTex = () => texture('twill', 64, (g, n) => {
  const rand = seeded(11);
  const warp = threads(n / 2, rand, 186, 30);
  const fade = Array.from({ length: n }, (_, x) => 1 + 0.08 * Math.sin(x * 0.4 + 1.3) + (rand() < 0.08 ? 0.12 : 0));
  shades(g, n, (x, y) => {
    const over = ((x >> 1) + (y >> 1)) % 3 < 2;
    return (over ? warp[x >> 1] * fade[x] : 250) + (rand() - 0.5) * 8;
  });
}, false, 0.25);
// knitted stitches: columns of Vs, a dark ridge between, a row's edge faintly darker
const knitTex = () => texture('knit', 64, (g, n) => {
  const rand = seeded(5);
  const yarn = threads(n / 8, rand, 240, 16);
  shades(g, n, (x, y) => {
    const lx = Math.abs((x % 8) - 3.5) / 4; // (0 the column's middle, 0.9 its edge)
    const ly = (y % 8) / 8;
    const leg = 1 - Math.min(1, Math.abs(lx - 0.3 - (0.5 - ly) * 0.45) * 3.2);
    const ridge = lx > 0.8 ? 0.6 : 1;
    return (130 + (yarn[x >> 3] - 130) * leg) * ridge * (y % 8 === 0 ? 0.86 : 1) + (rand() - 0.5) * 8;
  });
}, false, 0.25);
// a buffalo check: bands across and down, darker where they cross, fine
// lines between, and a twill's diagonal through it all
const plaidTex = () => texture('plaid', 128, (g, n) => {
  const rand = seeded(3);
  shades(g, n, (x, y) => {
    const band = (x < n / 2 ? 0.52 : 1) * (y < n / 2 ? 0.52 : 1);
    const line = Math.abs(x - n * 0.74) < 3 || Math.abs(y - n * 0.74) < 3 ? 0.66 : 1;
    const twill = ((x >> 1) + (y >> 1)) % 4 < 2 ? 0.93 : 1;
    return 255 * band * line * twill + (rand() - 0.5) * 8;
  });
});
// woven straw, criss-cross, each strand its own shade, fibres along it
const strawTex = () => texture('straw', 64, (g, n) => {
  const rand = seeded(13);
  const strand = threads(n / 8, rand, 236, 26);
  shades(g, n, (x, y) => {
    const a = (x + y) % n;
    const b = (x - y + n) % n;
    const up = ((a >> 3) + (b >> 3)) % 2;
    const s = up ? strand[a >> 3] : strand[b >> 3] * 0.93;
    const edge = (up ? a : b) % 8 === 0 ? 0.8 : 1;
    return s * edge + (rand() - 0.5) * 18;
  });
});
const CREAM = 0xfaf5ea;
// a stripe and a cream one, the threads faintly through them
const threadsOver = (g, n, rand) => {
  for (let y = 0; y < n; y++) {
    g.fillStyle = `rgba(0,0,0,${(0.03 + rand() * 0.06).toFixed(3)})`;
    g.fillRect(0, y, n, 1);
  }
  g.fillStyle = 'rgba(0,0,0,0.04)';
  for (let x = 0; x < n; x += 2) g.fillRect(x, 0, 1, n);
};
const stripesTex = (color) => texture(`stripes:${color}`, 64, (g, n) => {
  g.fillStyle = css(color);
  g.fillRect(0, 0, n, n);
  g.fillStyle = css(CREAM);
  g.fillRect(0, n / 2, n, n / 2);
  threadsOver(g, n, seeded(17));
}, true);
const dotsTex = (color) => texture(`dots:${color}`, 64, (g, n) => {
  g.fillStyle = css(color);
  g.fillRect(0, 0, n, n);
  g.fillStyle = css(CREAM);
  for (const [x, y] of [[16, 16], [48, 48]]) {
    g.beginPath();
    g.arc(x, y, 8, 0, Math.PI * 2);
    g.fill();
  }
  threadsOver(g, n, seeded(19));
}, true);

// ---------- Materials every farmer shares ----------
// (each its painted look, src/gfx/detail.js: leather's grain, the straw's
// braid, wood grain on a handle, brushed steel, brass)
const ink = noShadow(mat(0x2b1d16, { roughness: 0.35 })); // eyes, the smile
const shine = noShadow(new THREE.MeshBasicMaterial({ color: 0xffffff })); // the glint in the eyes
const brass = detail(noShadow(mat(0xd9a441, { metalness: 0.55, roughness: 0.35 })), 'tool');
const leather = detail(mat(0x4a3020, { roughness: 0.8 }), 'leather');
const soleMat = detail(mat(0x2e2520, { roughness: 0.9 }), 'leather');
const whiteMat = detail(mat(0xf4f0e6, { roughness: 0.85 }), 'garment');
const strawMat = detail(mat(0xe8c66a, { roughness: 0.95, map: strawTex() }), 'straw');
const paleStrawMat = detail(mat(0xf5e2b0, { roughness: 0.95, map: strawTex() }), 'straw');
const leafMat = mat(0x4f8f3a, { roughness: 0.8 });
const yellowMat = noShadow(mat(0xf2c12e, { roughness: 0.6 }));
const ribbonMat = noShadow(mat(0xc0392b));
const frameMat = noShadow(mat(0x3a2a20, { roughness: 0.45 }));
const lensMat = noShadow(mat(0x1c2230, { roughness: 0.12, metalness: 0.4 }));
const handleMat = detail(mat(0x8b5a2b), 'tool');
const gripMat = detail(mat(0x6e3f1e), 'leather'); // (the bow's)
const bladeMat = detail(mat(0x9a9a9a, { metalness: 0.6, roughness: 0.4 }), 'tool');
const edgeMat = detail(mat(0xdfe5ec, { metalness: 0.7, roughness: 0.3 }), 'tool');

const WHITE = new THREE.Color(0xffffff);
const tint = (hex, toward, k) => new THREE.Color(hex).lerp(toward instanceof THREE.Color ? toward : new THREE.Color(toward), k);
const darker = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// ---------- Shapes ----------
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const Y_UP = V3(0, 1, 0);
const Z_OUT = V3(0, 0, 1);

// A smooth outline through [radius, y] points, evenly spaced along its
// length (so a pattern runs evenly over it), turned round the y axis. The
// points go up the outside (or out along the bottom, round and back in along
// the top): that way is out.
function lathe(points, { segs = 18, n = 14, phiStart = 0, phiLength = Math.PI * 2 } = {}) {
  const line = new THREE.SplineCurve(points.map(([r, y]) => V2(r, y))).getSpacedPoints(n);
  for (const p of line) p.x = Math.max(0, p.x);
  return new THREE.LatheGeometry(line, segs, phiStart, phiLength);
}

// An arm or a leg: rounded at both ends, rTop at the top (y = 0) narrowing
// to rBottom at the bottom (y = -length)
function limb(rTop, rBottom, length, segs = 10) {
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(V2(rBottom * Math.sin(a), -length + rBottom * (1 - Math.cos(a))));
  }
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(V2(rTop * Math.sin(a), -rTop * (1 + Math.cos(a))));
  }
  return new THREE.LatheGeometry(pts, segs);
}

// A ring lying flat (round the y axis)
const ring = (radius, tube, radial = 8, tubular = 28) => new THREE.TorusGeometry(radius, tube, radial, tubular).rotateX(Math.PI / 2);
const ball = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

// A hat's brim: a ring from rIn to rOut, thicker by the crown, its edge
// drooping (droop), waving up and down (wave times round, by waveH) or curled
// up at the sides (curl). The seam is at the back.
function brim(rIn, rOut, { droop = 0.03, wave = 0, waveH = 0, curl = 0, thick = 0.016 } = {}) {
  const mid = (rIn + rOut) / 2;
  const geo = lathe([
    [rIn, -thick * 0.5], [mid, -thick * 0.4 - droop * 0.3], [rOut - 0.012, -droop - thick * 0.2], [rOut, -droop + thick * 0.1],
    [rOut - 0.012, -droop + thick * 0.45], [mid, thick * 0.5 - droop * 0.3], [rIn, thick],
  ], { segs: 30, n: 10, phiStart: Math.PI });
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const f = THREE.MathUtils.clamp((Math.hypot(x, z) - rIn) / (rOut - rIn), 0, 1);
    const side = x / Math.max(1e-6, Math.hypot(x, z));
    pos.setY(i, pos.getY(i) + f * f * (waveH * Math.sin(wave * Math.atan2(x, z)) + curl * side * side));
  }
  geo.computeVertexNormals();
  return geo;
}

// Stretch a shape's texture coordinates, so its pattern tiles at the size it is drawn
function tile(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}
// tiles round a lathe or a limb of radius r (a whole number, so there is no seam), and along it
const wrap = (geo, r, length, size) => tile(geo, Math.max(1, Math.round((Math.PI * 2 * r) / size)), length / size);

// ---------- Merging ----------
// A shape placed (x, y, z), turned (q, or rx, ry, rz) and sized (sx, sy, sz: before it is turned)
function placed(geo, x = 0, y = 0, z = 0, { q = null, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _m.compose(_v.set(x, y, z), q ?? _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  return geo.applyMatrix4(_m);
}

// The pieces of one moving part, merged into a mesh per material when built
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
class Parts {
  constructor() {
    this.byMat = new Map();
  }

  // A shape, placed (x, y, z), turned (q, or rx, ry, rz), sized (sx, sy, sz:
  // before it is turned) and then put in frame (a Matrix4), if any
  add(geo, material, x = 0, y = 0, z = 0, { q = null, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, frame = null } = {}) {
    _m.compose(_v.set(x, y, z), q ?? _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    if (frame) _m.premultiply(frame);
    geo.applyMatrix4(_m);
    if (!this.byMat.has(material)) this.byMat.set(material, []);
    this.byMat.get(material).push(geo);
  }

  // The meshes, into group; returns them
  build(group) {
    const meshes = [];
    for (const [material, list] of this.byMat) {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list);
      if (list.length > 1) for (const g of list) g.dispose();
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = !material.userData.noShadow;
      group.add(mesh);
      meshes.push(mesh);
    }
    this.byMat.clear();
    return meshes;
  }
}

// ---------- The head ----------
const HEAD = new THREE.Matrix4().makeTranslation(0, HEAD_Y, 0); // (the torso's frame to the head's)
// A point on the head (or r out from its middle), lat up from its equator and
// lon round from its front, toward +x
const onHead = (lat, lon, r = HEAD_R) => V3(Math.sin(lon) * Math.cos(lat) * r, Math.sin(lat) * r, Math.cos(lon) * Math.cos(lat) * r);
// turned to face out of the head there (a shape's +z, or its +y with axis Y_UP)
const facing = (lat, lon, axis = Z_OUT) => new THREE.Quaternion().setFromUnitVectors(axis, onHead(lat, lon, 1));
const spun = (q, angle) => q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z_OUT, angle));
// The head's frame, moved and tipped back: where a hat sits
const hatFrame = (y, z, tilt) => HEAD.clone().multiply(new THREE.Matrix4().compose(V3(0, y, z), new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), tilt), V3(1, 1, 1)));
// Where each hat sits on the head: [up, back (z), tipped back by], and how
// far up its own frame its rim comes down to (cover): the hair over that is
// under the hat (tuck())
const HATS = {
  straw: [0.17, -0.05, -0.4, 0],
  sunhat: [0.15, -0.04, -0.45, 0],
  cap: [0.02, 0, -0.3, 0.05],
  flatcap: [0.095, 0.02, -0.1, 0],
  souwester: [0.1, -0.03, -0.25, 0],
  beanie: [0, -0.01, -0.22, 0.04],
  cowboy: [0.16, -0.04, -0.32, 0],
  bandana: [0, 0, -0.08, 0.09],
  flowers: [0.1, -0.02, -0.3, null], // (a ring on the hair: it covers none of it)
};
const hatAt = (hat) => hatFrame(...HATS[hat].slice(0, 3));

// ---------- The bodies ----------
// Two builds (shared/looks.js `body`), the same height, so the collision, the
// hand that holds the tools and the view from the eyes are the same in both.
// Each is its torso's outline, hips (y = 0) to the neck ([half width, y]),
// and how deep it is for its width up it, in front and behind ([y, depth /
// width]): a chest, the small of a back; at the hips no deeper than the
// thighs under them (a little more behind), so trousers run down into the
// legs instead of rounding out over them. Then how far out the arms
// hang and the legs stand, how thick the neck is; a sleeve's radius at the top and the bottom,
// a bare forearm's; a trouser leg's and a bare leg's; how big the hands and
// the shoes are; how much the jaw narrows to the chin; how big the eyes are.
// Him broad in the shoulders and the arms; her narrow in the shoulders and at
// the waist, fuller at the hips, slimmer in the arms and the ankles.
const BODIES = {
  male: {
    torso: [[0, -0.07], [0.12, -0.066], [0.205, -0.045], [0.245, 0], [0.255, 0.04], [0.248, 0.12], [0.252, 0.2], [0.268, 0.3], [0.278, 0.38], [0.268, 0.45], [0.235, 0.5], [0.17, 0.54], [0.1, 0.56], [0, 0.565]],
    front: [[-0.1, 0.52], [0.05, 0.56], [0.18, 0.8], [0.3, 0.82], [0.45, 0.76], [0.56, 0.8]],
    back: [[-0.1, 0.62], [0.05, 0.66], [0.18, 0.78], [0.3, 0.76], [0.45, 0.72], [0.56, 0.8]],
    shoulder: 0.285, legX: LEG_X, neck: 0.074, sleeve: [0.09, 0.078], forearm: [0.072, 0.062],
    leg: [0.135, 0.09], bare: [0.088, 0.064], hand: 1.1, shoe: 1.04, jaw: 0.12, eyes: 1,
  },
  female: {
    torso: [[0, -0.07], [0.11, -0.066], [0.185, -0.045], [0.218, 0], [0.226, 0.04], [0.21, 0.1], [0.175, 0.18], [0.17, 0.25], [0.188, 0.32], [0.198, 0.39], [0.19, 0.45], [0.165, 0.5], [0.125, 0.535], [0.07, 0.553], [0, 0.558]],
    front: [[-0.1, 0.55], [0.05, 0.58], [0.2, 0.72], [0.27, 0.84], [0.33, 0.97], [0.42, 0.9], [0.5, 0.8], [0.56, 0.85]],
    back: [[-0.1, 0.68], [0.05, 0.72], [0.2, 0.8], [0.35, 0.78], [0.5, 0.78], [0.56, 0.85]],
    shoulder: 0.215, legX: 0.12, neck: 0.058, sleeve: [0.07, 0.062], forearm: [0.058, 0.05],
    leg: [0.122, 0.066], bare: [0.08, 0.052], hand: 0.86, shoe: 0.88, jaw: 0.2, eyes: 1.06,
  },
};

// [y, k] keys, k at y (straight between them, flat past the ends)
function keyed(keys, y) {
  if (y <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [y1, k1] = keys[i];
    if (y <= y1) {
      const [y0, k0] = keys[i - 1];
      return k0 + ((k1 - k0) * (y - y0)) / (y1 - y0);
    }
  }
  return keys[keys.length - 1][1];
}

// A body's shape, worked out once: W(y) its half width at y (from the hips
// up: what hangs lower, a skirt, an apron, goes by the hips),
// depth(y, side) how far in front (side 1) or behind (-1) of its middle it is,
// z(x, y, side) its surface there, at(r) how high up it is r across (by the
// neck), and fit(geo): a shape made round the torso's axis (a lathe, a band,
// a ring) made as deep as the body is there, front and back, what stands off
// the body staying as far off it
const bodyShapes = new Map();
function bodyShape(kind) {
  if (bodyShapes.has(kind)) return bodyShapes.get(kind);
  const def = BODIES[kind] ?? BODIES.male;
  const line = new THREE.SplineCurve(def.torso.map(([r, y]) => V2(r, y))).getSpacedPoints(64);
  const top = def.torso[def.torso.length - 1][1];
  function W(y) {
    y = THREE.MathUtils.clamp(y, 0, top); // (below the hips: as wide as they are)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      if (y >= a.y && y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
    }
    return 0;
  }
  const depth = (y, side) => W(y) * keyed(side > 0 ? def.front : def.back, y);
  const z = (x, y, side) => side * depth(y, side) * Math.sqrt(Math.max(0, 1 - (x / Math.max(1e-6, W(y))) ** 2));
  function at(r) {
    for (let i = line.length - 1; i > 0; i--) if (line[i].x >= r) return line[i].y;
    return 0;
  }
  function fit(geo) {
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const zz = pos.getZ(i);
      const r = Math.hypot(x, zz);
      if (r < 1e-5 || Math.abs(zz) < 1e-7) continue;
      const w = Math.max(1e-4, W(y));
      const d = depth(y, Math.sign(zz));
      const k = (r <= w ? (r * d) / w : d + r - w) / r; // (how much deeper or shallower, here)
      pos.setZ(i, zz * k);
      if (nrm) _v.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i) / k).normalize(), nrm.setXYZ(i, _v.x, _v.y, _v.z);
    }
    return geo;
  }
  const shape = { def, W, depth, z, at, fit, top };
  bodyShapes.set(kind, shape);
  return shape;
}

// A strap of the overalls: up from the bib (on side sx, x out), over the
// shoulder and down the back, crossing the other
function strapCurve(S, sx, x) {
  const pts = [];
  const over = S.at(x) + 0.014; // (over the shoulder there)
  for (const y of [0.44, 0.48, over - 0.05, over - 0.02]) pts.push(V3(sx * x, y, S.z(x, y, 1) + 0.012));
  pts.push(V3(sx * x, over, 0));
  for (const y of [over - 0.04, 0.48, 0.4, 0.32, 0.24]) {
    const xx = sx * (x - (x + 0.04) * (over - 0.04 - y) / (over - 0.28));
    pts.push(V3(xx, y, S.z(xx, y, -1) - 0.012));
  }
  return new THREE.CatmullRomCurve3(pts);
}

// The head: round above its middle, narrowing toward the chin below it (jaw:
// how much); the beard too, so it keeps to the face
function jawed(geo, jaw) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const down = -pos.getY(i) / HEAD_R;
    if (down <= 0) continue;
    const t = down ** 1.5;
    const kx = 1 - jaw * t;
    const kz = 1 - jaw * 0.4 * t;
    pos.setX(i, pos.getX(i) * kx);
    pos.setZ(i, pos.getZ(i) * kz);
    if (nrm) _v.set(nrm.getX(i) / kx, nrm.getY(i), nrm.getZ(i) / kz).normalize(), nrm.setXYZ(i, _v.x, _v.y, _v.z);
  }
  return geo;
}

// ---------- Hair ----------
// Hair is one soft mass over the head, in a few big clumps from the crown
// down (a crease between each), its edge cut into points where the clumps
// end (the fringe, by the ears, at the nape), with a lip under the edge so
// the points have some thickness. Each style is its hairline: how far down
// it comes round the head (lat, by how far round from the front: |lon|), how
// deep the points are there, how many clumps go round, and how far the
// fringe is combed to one side; tousled hair's points are ragged.
const HAIRLINES = {
  short: { edge: [[0, 0.5], [0.85, 0.48], [1.15, 0.3], [1.45, 0.24], [1.8, 0.18], [2.2, -0.3], [2.6, -0.58], [3.15, -0.62]], tips: [[0, 0.15], [1, 0.07], [2, 0.08], [3.15, 0.1]], clumps: 14, sweep: 0.4 },
  tousled: { edge: [[0, 0.5], [0.85, 0.48], [1.15, 0.3], [1.45, 0.24], [1.8, 0.16], [2.2, -0.3], [2.6, -0.58], [3.15, -0.62]], tips: [[0, 0.2], [1, 0.12], [2, 0.14], [3.15, 0.16]], clumps: 13, sweep: 0.55, ragged: true },
  bob: { edge: [[0, 0.44], [0.72, 0.44], [0.84, 0.05], [0.94, -0.55], [1.3, -0.72], [3.15, -0.74]], tips: [[0, 0.045], [0.8, 0.045], [1, 0.07], [3.15, 0.07]], clumps: 20, sweep: 0 },
  long: { edge: [[0, 0.46], [0.72, 0.46], [0.84, 0.05], [0.94, -0.7], [1.3, -0.92], [3.15, -0.96]], tips: [[0, 0.05], [0.8, 0.05], [1, 0.08], [3.15, 0.08]], clumps: 18, sweep: 0 },
  back: { edge: [[0, 0.74], [0.6, 0.7], [1.0, 0.45], [1.45, 0.22], [1.85, 0.15], [2.3, -0.35], [3.15, -0.45]], tips: [[0, 0.015], [1.4, 0.02], [3.15, 0.035]], clumps: 12, sweep: 0 }, // (combed back and tied: ponytail, bun, braids; the forehead clear)
};
const hairline = (style) => HAIRLINES[style] ?? HAIRLINES.back;

// The hair's shell for a style, in the head's frame
function hairShell(style) {
  const H = hairline(style);
  const segs = 120;
  const rows = 16;
  const R = 0.262; // (out over the head: the clumps a little further, the crown fuller)
  const IN = 0.244; // (the lip under the edge)
  const pos = [];
  const uvs = [];
  const index = [];
  const hash = (k) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let j = 0; j <= rows + 1; j++) {
    for (let i = 0; i <= segs; i++) {
      const lon0 = -Math.PI + (i / segs) * Math.PI * 2;
      const a = Math.abs(lon0);
      const t = Math.min(j, rows) / rows;
      const s = Math.abs(Math.sin((H.clumps * lon0) / 2)); // (0 at a crease, 1 down a clump's middle)
      const ragged = H.ragged ? 0.55 + 0.9 * hash(Math.floor(((lon0 + Math.PI) * H.clumps) / (Math.PI * 2))) : 1;
      const edge = keyed(H.edge, a) - keyed(H.tips, a) * ragged * s ** 2.5;
      const lat = Math.PI / 2 - t * (Math.PI / 2 - edge);
      const lon = lon0 + H.sweep * t * t * Math.max(0, 1 - a / 1.2); // (the fringe combed aside toward its points)
      const r = j > rows ? IN : R + 0.009 * t * s + 0.006 * Math.sin(Math.PI * t);
      pos.push(Math.sin(lon) * Math.cos(lat) * r, Math.sin(lat) * r, Math.cos(lon) * Math.cos(lat) * r);
      uvs.push((i / segs) * 6, 1 - t);
    }
  }
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i;
      const b = a + segs + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // (one normal either side of the seam at the back, so it doesn't show)
  const nrm = geo.attributes.normal;
  for (let j = 0; j <= rows + 1; j++) {
    const a = j * (segs + 1);
    const b = a + segs;
    _v.set(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
    nrm.setXYZ(a, _v.x, _v.y, _v.z);
    nrm.setXYZ(b, _v.x, _v.y, _v.z);
  }
  return geo;
}

// A lock: its root at the origin, falling down -y, lying on +z; bent round a
// middle `bend` behind it (a ponytail's locks)
function lockGeo(len, w, thick = 0.42, bend = HEAD_R) {
  const geo = lathe([[0, 0.05], [0.4, 0.03], [0.5, -0.1], [0.46, -0.35], [0.3, -0.65], [0.12, -0.88], [0, -1]], { segs: 8, n: 9, phiStart: Math.PI / 2 });
  geo.scale(w, len, w * thick);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = bend + pos.getZ(i);
    const a = -pos.getY(i) / bend;
    pos.setY(i, -r * Math.sin(a));
    pos.setZ(i, r * Math.cos(a) - bend);
  }
  geo.computeVertexNormals();
  return geo;
}

// The turn that takes a lock's -y to `down` and its +z as near `out` as can be
function basis(down, out) {
  const y = down.clone().negate();
  const z = out.clone().sub(y.clone().multiplyScalar(out.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// Where a ponytail is tied: at the back of the head (lower, under a hat's rim)
const ponytailTie = (hatOn) => (hatOn ? V3(0, -0.08, -0.24) : V3(0, -0.02, -0.255));

// Hair under a hat: what is over the plane its rim comes down to (and a
// little under it, so none shows through a brim) pressed flat onto it, where
// the rim and the brim hide it (up top, that is inside the head); geo in the
// head's frame
const _n = new THREE.Vector3();
const _p0 = new THREE.Vector3();
function tuck(geo, hat) {
  const spec = HATS[hat];
  if (!spec || spec[3] === null) return geo;
  const [y, z, tilt, cover] = spec;
  _n.set(0, Math.cos(tilt), Math.sin(tilt));
  _p0.set(0, y, z).addScaledVector(_n, cover - 0.012);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const over = _v.clone().sub(_p0).dot(_n);
    if (over > 0) {
      _v.addScaledVector(_n, -over);
      pos.setXYZ(i, _v.x, _v.y, _v.z);
    }
  }
  return geo;
}

// How each top's trim (collar, cuffs) is colored, from the shirt's color
const TOP_TRIM = {
  shirt: (c) => darker(c, 0.82),
  tee: (c) => darker(c, 0.78),
  plaid: (c) => darker(c, 0.7),
  stripes: () => new THREE.Color(CREAM),
  sweater: (c) => darker(c, 0.82),
};
// how big a top's pattern is, in world units
const TOP_TILE = { shirt: 0.05, tee: 0.05, plaid: 0.22, stripes: 0.09, sweater: 0.05 };

// ---------- The farmer ----------
// shirt: the shirt's color. look: what they wear (shared/looks.js; any part
// left out is the default's). The merchant wears colors of their own, out of
// the wardrobe's palettes.
export function createFarmer({ shirt = 0xff5533, height = 1.6, look = DEFAULT_LOOK, shadow = true } = {}) {
  // Their own materials, repainted (not remade) for a new look or color
  const own = {
    skin: detail(mat(0xffcc99, { roughness: 0.7 }), 'skin'),
    blush: noShadow(mat(0xff9f8a, { roughness: 0.7 })),
    iris: noShadow(mat(0x7a4a2a, { roughness: 0.3 })), // (the eyes' color)
    freckle: noShadow(mat(0xb0704a, { roughness: 0.7 })),
    hair: detail(mat(0x5a3a22, { roughness: 0.65 }), 'hair'),
    shirt: mat(0xffffff, { roughness: 0.85, map: clothTex() }),
    trim: mat(0xffffff, { roughness: 0.85, map: clothTex() }),
    bottoms: mat(0xffffff, { roughness: 0.9, map: twillTex() }),
    bottomsTrim: mat(0xffffff, { roughness: 0.9, map: twillTex() }),
    shoe: mat(0xffffff, { roughness: 0.8 }),
    hat: mat(0xffffff, { roughness: 0.85, map: clothTex() }),
    hatTrim: mat(0xffffff, { roughness: 0.9, map: knitTex() }),
    neck: mat(0xffffff, { roughness: 0.85, map: clothTex() }),
    apron: mat(0xffffff, { roughness: 0.9, map: clothTex() }),
    apronTrim: mat(0xffffff, { roughness: 0.9, map: clothTex() }),
  };
  for (const k of ['shirt', 'trim', 'bottoms', 'bottomsTrim', 'hat', 'hatTrim', 'neck', 'apron', 'apronTrim']) detail(own[k], 'garment');
  const rod = { pole: detail(mat(0xb0743a), 'tool') };

  const root = new THREE.Group(); // positioned at the collision center

  const rig = new THREE.Group(); // origin at the feet
  rig.position.y = -height / 2;
  root.add(rig);
  // the contact shadow (not on the wardrobe's stage: it has its own), kept on
  // the ground under a jump: smaller the higher they go, gone past a fall
  const contact = shadow ? contactShadow(CONTACT.r) : null;
  if (contact) root.add(contact);
  let groundY = null; // root's y when last on the ground

  const torso = new THREE.Group();
  torso.position.y = HIP_Y;
  rig.add(torso);
  const eyes = new THREE.Group(); // (on their own, to blink: their middle is level with them)
  eyes.position.set(0, HEAD_Y + Math.sin(EYE.lat) * HEAD_R, 0);
  torso.add(eyes);
  const inEyes = (p) => p.add(V3(0, HEAD_Y, 0)).sub(eyes.position); // (a point on the head, in the eyes' group)

  // Limbs pivot at the shoulder/hip so they can swing; their pieces hang below
  const pivot = (parent, x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    parent.add(g);
    return { pivot: g };
  };
  const legs = [-1, 1].map((sx) => pivot(rig, sx * LEG_X, HIP_Y));
  const arms = [-1, 1].map((sx) => pivot(torso, sx * BODIES.male.shoulder, SHOULDER_Y)); // (out as far as the body's shoulder: build())
  for (const [i, arm] of arms.entries()) arm.pivot.rotation.z = (i === 0 ? -1 : 1) * 0.12; // slightly out from the body
  const rightArm = arms[1];

  let worn = { ...DEFAULT_LOOK, ...look };
  let shirtColor = shirt;
  let meshes = [];

  // ---- Paint: every color from the look and the shirt ----
  function paint() {
    const L = worn;
    own.skin.color.setHex(L.skin);
    own.blush.color.copy(tint(L.skin, 0xff6f6a, 0.38));
    own.freckle.color.copy(tint(L.skin, 0x6a3a1a, 0.45));
    own.hair.color.setHex(L.hairColor);
    // the shirt: a pattern drawn in its color (stripes), or one that shades it
    const top = TOP_TRIM[L.top] ? L.top : 'shirt';
    own.shirt.map = top === 'stripes' ? stripesTex(shirtColor) : top === 'plaid' ? plaidTex() : top === 'sweater' ? knitTex() : clothTex();
    own.shirt.color.set(top === 'stripes' ? 0xffffff : shirtColor);
    own.trim.color.copy(TOP_TRIM[top](shirtColor));
    own.trim.map = top === 'sweater' ? knitTex() : clothTex();
    own.bottoms.color.setHex(L.bottomsColor);
    own.bottomsTrim.color.copy(tint(L.bottomsColor, WHITE, 0.28));
    own.shoe.color.setHex(L.shoesColor);
    own.shoe.roughness = { wellies: 0.3, sneakers: 0.85 }[L.shoes] ?? 0.7;
    detail(own.shoe, { wellies: 'horn', sneakers: 'garment' }[L.shoes] ?? 'leather'); // (rubber's sheen, canvas, leather)
    own.hat.map = L.hat === 'bandana' ? dotsTex(L.hatColor) : L.hat === 'beanie' ? knitTex() : clothTex();
    own.hat.color.set(L.hat === 'bandana' ? 0xffffff : L.hatColor);
    own.hat.roughness = L.hat === 'souwester' ? 0.35 : 0.85; // (oilskin)
    own.hatTrim.color.copy(tint(L.hatColor, WHITE, 0.35));
    own.neck.map = L.neck === 'scarf' ? knitTex() : clothTex();
    own.neck.color.setHex(L.neckColor);
    own.apron.color.setHex(L.apronColor);
    own.apronTrim.color.copy(darker(L.apronColor, 0.82));
  }

  // ---- Build: the pieces for the look ----
  function build() {
    for (const mesh of meshes) {
      mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    }
    const L = worn;
    const T = new Parts(); // the torso, and the head and hat on it
    const E = new Parts(); // the eyes
    const A = [new Parts(), new Parts()];
    const G = [new Parts(), new Parts()];
    const onHeadAt = (geo, material, p, o = {}) => T.add(geo, material, p.x, p.y, p.z, { frame: HEAD, ...o });

    // -- The body (theirs: male or female) --
    const S = bodyShape(L.body);
    const B = S.def;
    const W = S.W;
    for (const [i, arm] of arms.entries()) arm.pivot.position.x = (i === 0 ? -1 : 1) * B.shoulder;
    for (const [i, leg] of legs.entries()) leg.pivot.position.x = (i === 0 ? -1 : 1) * B.legX;
    const fit = (geo) => S.fit(geo);

    // -- The shirt, its collar; a neck --
    const top = TOP_TRIM[L.top] ? L.top : 'shirt';
    T.add(fit(wrap(lathe(B.torso, { segs: 24, n: 22 }), 0.26, 0.85, TOP_TILE[top])), own.shirt);
    T.add(new THREE.CylinderGeometry(B.neck, B.neck * 1.12, 0.22, 14), own.skin, 0, S.top + 0.03, 0);
    if (top === 'sweater') {
      const r = B.neck + 0.05;
      T.add(ring(r, 0.042), own.shirt, 0, S.at(r) + 0.012, 0, { sz: 0.92 }); // a rolled neck
    } else {
      const r = B.neck + 0.034;
      const y = S.at(r);
      T.add(ring(r, 0.02), own.trim, 0, y, 0, { sz: 0.92 }); // the collar
      if (top === 'shirt' || top === 'plaid') {
        // its points, down over the chest; a placket down the front and its buttons (above the waist)
        for (const sx of [-1, 1]) T.add(ball(0.05, 10, 8), own.trim, sx * 0.042, y - 0.03, S.z(0.042, y - 0.03, 1) + 0.008, { rx: -1.1, rz: sx * 0.55, sx: 0.85, sy: 1.25, sz: 0.25 });
        const front = new THREE.CatmullRomCurve3([y - 0.05, 0.4, 0.32, 0.24, 0.16].map((yy) => V3(0, yy, S.z(0, yy, 1) + 0.003)));
        T.add(new THREE.TubeGeometry(front, 16, 0.009, 4), own.trim);
        for (const yy of [0.44, 0.36, 0.28]) T.add(ball(0.013, 8, 6), own.trim, 0.002, yy, S.z(0, yy, 1) + 0.011, { sz: 0.5 });
      }
    }

    // -- What is worn below: overalls (short or long), trousers or a skirt --
    const bottoms = ['overalls', 'shortalls', 'trousers', 'skirt'].includes(L.bottoms) ? L.bottoms : 'overalls';
    if (bottoms !== 'skirt') {
      // the seat of the trousers, up to the waist
      T.add(fit(wrap(lathe([[0, -0.08], [W(0) * 0.55, -0.076], [W(0) * 0.86 + 0.012, -0.048], [W(0.02) + 0.016, 0.02], [W(0.12) + 0.02, 0.12], [W(0.21) + 0.018, 0.21]], { n: 14 }), 0.27, 0.36, 0.05)), own.bottoms); // (tucked in at the bottom, into the legs)
    }
    if (bottoms === 'overalls' || bottoms === 'shortalls') {
      // the bib (straight down to the waist), its hem, a pocket, the straps and their buttons
      const bib = 0.5; // (radians either side of the front)
      T.add(fit(tile(lathe([0.2, 0.26, 0.33, 0.4, 0.46].map((y) => [W(y) + 0.02, y]), { segs: 10, n: 8, phiStart: -bib, phiLength: bib * 2 }), 3, 5)), own.bottoms);
      T.add(fit(lathe([[W(0.443) + 0.022, 0.443], [W(0.465) + 0.026, 0.465]], { segs: 10, n: 2, phiStart: -bib - 0.01, phiLength: bib * 2 + 0.02 })), own.bottomsTrim);
      T.add(tile(new THREE.BoxGeometry(0.12 * W(0.32) / 0.28, 0.085, 0.012), 2, 2), own.bottoms, 0, 0.33, S.z(0, 0.33, 1) + 0.024);
      const strapX = (W(0.44) + 0.02) * Math.sin(bib - 0.1);
      for (const sx of [-1, 1]) {
        T.add(tile(new THREE.TubeGeometry(strapCurve(S, sx, strapX), 24, 0.021, 5), 12, 1), own.bottoms);
        T.add(ball(0.024, 10, 8), brass, sx * strapX, 0.43, S.z(strapX, 0.43, 1) + 0.03, { sz: 0.6 });
      }
    } else if (bottoms === 'trousers') {
      // a belt with a buckle
      T.add(fit(lathe([[W(0.165) + 0.02, 0.165], [W(0.17) + 0.026, 0.17], [W(0.215) + 0.026, 0.215], [W(0.22) + 0.02, 0.22]], { n: 6 })), leather);
      T.add(new THREE.BoxGeometry(0.06, 0.05, 0.014), brass, 0, 0.192, S.z(0, 0.192, 1) + 0.03);
    } else {
      // a skirt flaring out over the knees, with a waistband and a hem
      const hem = W(0) + 0.12;
      T.add(fit(wrap(lathe([[hem, -0.2], [W(0) + 0.09, -0.1], [W(0.02) + 0.05, 0.02], [W(0.14) + 0.022, 0.14], [W(0.22) + 0.016, 0.22]], { n: 12 }), 0.3, 0.45, 0.05)), own.bottoms);
      T.add(fit(lathe([[W(0.17) + 0.018, 0.17], [W(0.175) + 0.026, 0.175], [W(0.225) + 0.026, 0.225], [W(0.23) + 0.018, 0.23]], { n: 6 })), own.bottomsTrim);
      T.add(fit(ring(hem - 0.002, 0.012, 6, 36)), own.bottomsTrim, 0, -0.2, 0);
    }

    // -- An apron over the front, from the chest to the knees, tied round the waist --
    if (L.apron === 'apron') {
      const flare = bottoms === 'skirt' ? 0.15 : 0.07; // (out over a skirt)
      const off = (y) => 0.03 + Math.max(0, 0.16 - y) / 0.39 * flare; // (how far off the body it hangs at y)
      const span = 0.62;
      T.add(fit(tile(lathe([-0.23, -0.1, 0.02, 0.14, 0.3, 0.49].map((y) => [W(y) + off(y), y]), { segs: 12, n: 10, phiStart: -span, phiLength: span * 2 }), 4, 9)), own.apron);
      T.add(fit(ring(W(0.21) + 0.026, 0.014, 6, 32)), own.apronTrim, 0, 0.21, 0); // its ties
      T.add(fit(lathe([[W(0.475) + 0.032, 0.475], [W(0.495) + 0.032, 0.495]], { segs: 12, n: 2, phiStart: -span - 0.01, phiLength: span * 2 + 0.02 })), own.apronTrim); // its hem at the top
      T.add(tile(new THREE.BoxGeometry(0.2, 0.1, 0.012), 3, 2), own.apronTrim, 0, 0.04, S.z(0, 0.04, 1) + off(0.04) + 0.008, { rx: -Math.atan(flare / 0.39) }); // a pocket
      const cornerX = (W(0.49) + 0.03) * Math.sin(span - 0.08);
      for (const sx of [-1, 1]) {
        // a strap up from each corner, round the back of the neck
        const up = new THREE.CatmullRomCurve3([[cornerX, 0.49], [(cornerX + B.neck) / 2 + 0.02, S.at((cornerX + B.neck) / 2 + 0.02) - 0.005]].map(([x, y]) => V3(sx * x, y, S.z(x, y, 1) + 0.014)).concat(V3(sx * (B.neck + 0.012), S.top + 0.03, 0), V3(sx * (B.neck * 0.5), S.top + 0.04, -B.neck - 0.01)));
        T.add(new THREE.TubeGeometry(up, 12, 0.016, 5), own.apronTrim);
      }
    }

    // -- Round the neck --
    if (L.neck === 'neckerchief') {
      const r = B.neck + 0.045;
      const y = S.at(r);
      T.add(ring(r, 0.03), own.neck, 0, y, 0, { sz: 0.92 });
      T.add(new THREE.ConeGeometry(0.11 * r / 0.12, 0.17, 3), own.neck, 0, y - 0.1, S.z(0, y - 0.07, 1) + 0.022, { rx: Math.PI - 0.25, sz: 0.25 }); // the point, down the chest
      T.add(ball(0.026, 10, 8), own.neck, 0.03, y - 0.02, S.z(0.03, y - 0.02, 1) + 0.03); // the knot
    } else if (L.neck === 'scarf') {
      const r = B.neck + 0.065;
      const y = S.at(r) + 0.01;
      T.add(tile(ring(r, 0.052, 10, 28), 8, 2), own.neck, 0, y, 0, { sz: 0.94 });
      for (const [x, len, tilt] of [[0.05, 0.24, 0.12], [0.11, 0.2, 0.3]]) {
        const tail = tile(new THREE.CapsuleGeometry(0.042, len, 4, 8), 2, 4);
        T.add(tail, own.neck, x, y - 0.05 - len / 2, S.z(x, y - 0.12, 1) + 0.03, { rz: tilt, rx: -0.2, sz: 0.4 });
      }
    }

    // -- The head: skin, ears, nose, cheeks; the eyes, brows and a smile --
    onHeadAt(jawed(ball(HEAD_R, 28, 20), B.jaw), own.skin, V3(0, 0, 0));
    const female = L.body === 'female';
    onHeadAt(ball(0.042, 12, 8), own.skin, onHead(-0.06, 0, 0.245), { sx: 1.1, sy: 0.85, sz: 0.9 });
    for (const sx of [-1, 1]) {
      onHeadAt(ball(0.058, 12, 8), own.skin, onHead(0.0, sx * Math.PI / 2, 0.238), { q: facing(0, sx * Math.PI / 2), sx: 0.8, sy: 0.95, sz: 0.5 });
      onHeadAt(ball(0.05, 12, 8), own.blush, onHead(-0.13, sx * 0.62, 0.242), { q: facing(-0.13, sx * 0.62), sy: 0.62, sz: 0.3 });
      // the eye: dark, an iris low in it and a pupil, two glints (up and to
      // the same side in both eyes, and a small one low on the other), the
      // lid over it; lashes at the outer corner (hers)
      const k = B.eyes;
      const at = (lat, lon, r) => inEyes(onHead(lat, lon, r));
      const front = facing(EYE.lat, sx * EYE.lon);
      const eye = at(EYE.lat, sx * EYE.lon, 0.247);
      E.add(ball(0.043 * k, 14, 10), ink, eye.x, eye.y, eye.z, { q: front, sx: 0.8, sy: 1.18, sz: 0.45 });
      const iris = at(EYE.lat - 0.025, sx * EYE.lon, 0.26);
      E.add(ball(0.03 * k, 14, 10), own.iris, iris.x, iris.y, iris.z, { q: front, sx: 0.8, sy: 1.12, sz: 0.3 });
      const pupil = at(EYE.lat - 0.03, sx * EYE.lon, 0.2655);
      E.add(ball(0.016 * k, 10, 8), ink, pupil.x, pupil.y, pupil.z, { q: front, sx: 0.85, sy: 1.1, sz: 0.3 });
      const glint = at(EYE.lat + 0.05, sx * EYE.lon - 0.04, 0.267);
      E.add(ball(0.0125 * k, 8, 6), shine, glint.x, glint.y, glint.z);
      const glint2 = at(EYE.lat - 0.075, sx * EYE.lon + 0.035, 0.268);
      E.add(ball(0.006 * k, 6, 4), shine, glint2.x, glint2.y, glint2.z);
      const lid = at(EYE.lat, sx * EYE.lon, 0.254);
      E.add(new THREE.TorusGeometry(0.038 * k, 0.0068, 5, 14, 2.3).rotateZ(Math.PI / 2 - 1.15), ink, lid.x, lid.y, lid.z, { q: front, sx: 0.95, sy: 1.38 });
      if (female) {
        for (const [lat, lon, tilt] of [[0.17, 0.11, 0.75], [0.1, 0.165, 1.25]]) {
          const lash = at(EYE.lat + lat * k, sx * (EYE.lon + lon * k), 0.256);
          E.add(new THREE.CapsuleGeometry(0.0048, 0.022, 2, 5), ink, lash.x, lash.y, lash.z, { q: spun(facing(EYE.lat + lat, sx * (EYE.lon + lon)), -sx * tilt) });
        }
      }
      // brows: thick and straight (his), thin and arched (hers)
      if (female) onHeadAt(new THREE.TorusGeometry(0.05, 0.0058, 5, 12, 1.4).rotateZ(Math.PI / 2 - 0.7 + sx * 0.08), own.hair, onHead(0.13, sx * EYE.lon, 0.246), { q: facing(0.13, sx * EYE.lon) });
      else onHeadAt(new THREE.CapsuleGeometry(0.0155, 0.05, 3, 6), own.hair, onHead(0.3, sx * EYE.lon, 0.251), { q: spun(facing(0.3, sx * EYE.lon), Math.PI / 2 - sx * 0.1), sz: 0.6 });
    }
    onHeadAt(new THREE.TorusGeometry(0.032, 0.0085, 6, 12, Math.PI), ink, onHead(-0.2, 0, 0.247), { q: spun(facing(-0.2, 0), Math.PI) });
    if (female) onHeadAt(ball(0.02, 10, 8), own.blush, onHead(-0.24, 0, 0.244), { q: facing(-0.24, 0), sx: 1.15, sy: 0.5, sz: 0.35 }); // (a little color on the lip)

    // -- On the face: freckles, glasses or shades; a mustache or a beard --
    if (L.face === 'freckles') {
      for (const sx of [-1, 1]) {
        for (const [lat, lon] of [[-0.03, 0.5], [-0.08, 0.58], [-0.025, 0.66], [-0.1, 0.46]]) {
          onHeadAt(ball(0.0095, 6, 4), own.freckle, onHead(lat, sx * lon, 0.249));
        }
      }
    } else if (L.face === 'glasses' || L.face === 'shades') {
      for (const sx of [-1, 1]) {
        onHeadAt(new THREE.TorusGeometry(0.056, 0.0075, 6, 20), frameMat, onHead(EYE.lat, sx * EYE.lon, 0.27), { q: facing(EYE.lat, sx * EYE.lon) });
        if (L.face === 'shades') {
          onHeadAt(new THREE.CylinderGeometry(0.054, 0.054, 0.008, 18).rotateX(Math.PI / 2), lensMat, onHead(EYE.lat, sx * EYE.lon, 0.268), { q: facing(EYE.lat, sx * EYE.lon) });
        }
        const arm = new THREE.CatmullRomCurve3([0.6, 0.9, 1.2, 1.5].map((lon) => onHead(EYE.lat + 0.02, sx * lon, 0.262)));
        onHeadAt(new THREE.TubeGeometry(arm, 8, 0.006, 4), frameMat, V3(0, 0, 0));
      }
      onHeadAt(new THREE.CylinderGeometry(0.006, 0.006, 0.075, 5), frameMat, onHead(EYE.lat + 0.03, 0, 0.268), { rz: Math.PI / 2 });
    }
    if (L.whiskers === 'mustache' || L.whiskers === 'beard') {
      for (const sx of [-1, 1]) {
        onHeadAt(new THREE.CapsuleGeometry(0.028, 0.075, 3, 8), own.hair, onHead(-0.125, sx * 0.12, 0.252), { q: spun(facing(-0.125, sx * 0.12), sx * 1.25) });
      }
    }
    if (L.whiskers === 'beard') {
      onHeadAt(jawed(new THREE.SphereGeometry(0.262, 24, 8, Math.PI / 2 - 1.65, 3.3, 1.88, 0.95), B.jaw), own.hair, V3(0, 0, 0));
      onHeadAt(ball(0.07, 12, 8), own.hair, onHead(-0.9, 0, 0.22), { sx: 1.3, sy: 0.8 });
    }

    // -- Hair: a smooth layer, the locks over it, and how it is worn; what is
    // under a hat tucked in under it (tuck()), so none shows through --
    const hatOn = !['none', 'flowers'].includes(L.hat);
    const hair = L.hair;
    const H = (geo, material, p = V3(0, 0, 0), o = {}) => T.add(tuck(placed(geo, p.x, p.y, p.z, o), L.hat), material, 0, 0, 0, { frame: HEAD });
    if (hair !== 'bald') {
      H(hairShell(hair), own.hair);
      if (hair === 'tousled' && !hatOn) {
        // (with no hat over them) tufts flicking up off the top
        for (const [lat, lon, len] of [[1.2, 0.25, 0.12], [1.05, 0.95, 0.1], [1.05, -0.7, 0.11], [0.95, 2.1, 0.1], [0.95, -2.3, 0.1], [1.15, Math.PI, 0.11]]) {
          const out = onHead(lat, lon, 1);
          const up = out.clone().multiplyScalar(0.75).add(V3(0, 0.66, 0)).normalize();
          H(lockGeo(len, 0.075, 0.55, 0.12), own.hair, onHead(lat, lon, 0.255), { q: basis(up, V3(0, 1, 0).sub(out).normalize()) });
        }
      } else if (hair === 'long') {
        // a curtain of hair down the back, under the locks
        H(lathe([[0.2, -0.53], [0.25, -0.48], [0.272, -0.38], [0.268, -0.22], [0.26, -0.08], [0.255, 0.02]], { segs: 16, n: 10, phiStart: Math.PI - 1.1, phiLength: 2.2 }), own.hair);
      } else if (hair === 'ponytail') {
        // tied at the back (lower under a hat), and a bunch of locks swinging down behind
        const tie = ponytailTie(hatOn);
        H(ring(0.05, 0.02), ribbonMat, tie, { rx: Math.PI / 2 - 0.4 });
        for (const [dx, dy, len, w, a] of [[0, 0, 0.33, 0.13, 0], [-0.03, 0.01, 0.27, 0.085, -0.3], [0.03, 0.01, 0.28, 0.085, 0.3]]) {
          const fall = V3(Math.sin(a) * 0.35, -0.88, -0.42).normalize();
          H(lockGeo(len, w, 0.8, 0.55), own.hair, tie.clone().add(V3(dx, dy, -0.02)), { q: basis(fall, V3(0, 0.3, -1).normalize()) });
        }
      } else if (hair === 'bun') {
        const high = !hatOn;
        H(ball(0.1, 16, 12), own.hair, high ? V3(0, 0.21, -0.16) : V3(0, -0.04, -0.28));
        H(ring(0.07, 0.018), own.hair, high ? V3(0, 0.15, -0.12) : V3(0, -0.04, -0.235), { rx: high ? -0.7 : -Math.PI / 2 });
      } else if (hair === 'braids') {
        for (const sx of [-1, 1]) {
          const path = [[0.21, -0.06, -0.05, 0.05], [0.22, -0.16, 0.06, 0.048], [0.205, -0.25, 0.14, 0.044], [0.19, -0.33, 0.19, 0.04]];
          for (const [x, y, z, r] of path) H(ball(r, 12, 8), own.hair, V3(sx * x, y, z));
          H(ring(0.03, 0.012), ribbonMat, V3(sx * 0.186, -0.38, 0.205), { rx: 0.4 });
          H(ball(0.032, 10, 8), own.hair, V3(sx * 0.183, -0.415, 0.212), { sy: 1.3 });
        }
      }
    }

    // -- A hat --
    buildHat(T, L.hat);

    // -- Arms: sleeves, maybe bare forearms, cuffs, hands --
    const [sTop, sBottom] = B.sleeve;
    const [fTop, fBottom] = B.forearm;
    for (const [i, sx] of [-1, 1].entries()) {
      const P = A[i];
      const sleeve = (length, rTop, rBottom) => P.add(wrap(limb(rTop, rBottom, length), rTop, length, TOP_TILE[top]), own.shirt, 0, 0.025); // (its round top the shoulder's)
      const forearm = (from) => P.add(limb(fTop, fBottom, ARM_LEN - from - 0.02), own.skin, 0, -from);
      if (top === 'tee') {
        sleeve(0.22, sTop + 0.008, sTop + 0.004);
        P.add(ring(sTop + 0.002, 0.014), own.trim, 0, -0.18);
        forearm(0.14);
      } else if (top === 'plaid') {
        sleeve(0.3, sTop, sTop - 0.005);
        P.add(tile(ring(sTop - 0.005, 0.026, 8, 20), 6, 1), own.shirt, 0, -0.255); // rolled up
        forearm(0.24);
      } else {
        sleeve(0.405, sTop, sBottom);
        if (top === 'sweater') P.add(wrap(limb(sBottom + 0.004, sBottom + 0.004, 0.08), sBottom, 0.08, 0.05), own.trim, 0, -0.3);
        else P.add(ring(sBottom, 0.016), own.trim, 0, -0.335);
      }
      // the hand: a mitten (the palm, the fingers together, a little forward
      // and down), a thumb in front, round the grip of whatever it holds (HAND)
      const h = B.hand;
      P.add(ball(0.062 * h, 14, 10), own.skin, 0, -ARM_LEN + 0.012 * h, 0, { sx: 0.95, sz: 0.8 });
      P.add(ball(0.054 * h, 12, 10), own.skin, 0, -ARM_LEN - 0.036 * h, 0.008 * h, { sx: 0.9, sy: 0.95, sz: 0.72 });
      P.add(new THREE.CapsuleGeometry(0.021 * h, 0.036 * h, 3, 8), own.skin, -sx * 0.044 * h, -ARM_LEN - 0.004 * h, 0.036 * h, { rx: 0.35, rz: sx * 0.55 }); // a thumb
    }

    // -- Legs: trousers or bare, turn-ups, shoes --
    for (const P of G) {
      if (bottoms === 'overalls' || bottoms === 'trousers') {
        P.add(wrap(limb(B.leg[0], B.leg[1], 0.52), 0.1, 0.52, 0.05), own.bottoms, 0, 0.1); // (up into the trousers' seat)
        if (L.shoes !== 'wellies') P.add(ring(B.leg[1] + 0.002, 0.02, 6, 20), own.bottomsTrim, 0, -0.37); // turned up at the bottom (tucked into wellies)
      } else {
        P.add(limb(B.bare[0], B.bare[1], 0.46), own.skin, 0, 0.02);
        if (bottoms === 'shortalls') {
          P.add(wrap(limb(B.leg[0] - 0.006, B.leg[0] - 0.012, 0.2), 0.11, 0.2, 0.05), own.bottoms, 0, 0.04);
          P.add(ring(B.leg[0] - 0.012, 0.02, 6, 20), own.bottomsTrim, 0, -0.145);
        }
      }
      buildShoe(P, L.shoes, B.shoe);
    }

    meshes = [T.build(torso), A[0].build(arms[0].pivot), A[1].build(arms[1].pivot), G[0].build(legs[0].pivot), G[1].build(legs[1].pivot), E.build(eyes)].flat();
  }

  // A hat, in the torso's parts
  function buildHat(T, hat) {
    if (hat === 'straw') {
      const F = hatAt('straw');
      T.add(tile(brim(0.17, 0.4, { droop: 0.035 }), 40, 3), strawMat, 0, 0, 0, { frame: F });
      T.add(tile(lathe([[0.205, -0.01], [0.215, 0.06], [0.21, 0.13], [0.185, 0.175], [0.12, 0.19], [0, 0.192]]), 26, 6), strawMat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.214, 0.012], [0.222, 0.018], [0.222, 0.064], [0.214, 0.07]], { n: 6 }), own.hat, 0, 0, 0, { frame: F });
    } else if (hat === 'sunhat') {
      const F = hatAt('sunhat');
      T.add(tile(brim(0.17, 0.5, { droop: 0.06, wave: 5, waveH: 0.022 }), 50, 4), paleStrawMat, 0, 0, 0, { frame: F });
      T.add(tile(lathe([[0.2, -0.01], [0.21, 0.06], [0.18, 0.12], [0.1, 0.145], [0, 0.15]]), 26, 5), paleStrawMat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.206, 0.0], [0.214, 0.006], [0.214, 0.05], [0.206, 0.056]], { n: 6 }), own.hat, 0, 0, 0, { frame: F });
      flower(T, F.clone().multiply(new THREE.Matrix4().compose(V3(0.16, 0.035, 0.14), new THREE.Quaternion().setFromUnitVectors(Z_OUT, V3(0.75, 0.2, 0.62).normalize()), V3(1.2, 1.2, 1.2))), whiteMat);
    } else if (hat === 'cap') {
      const F = hatAt('cap');
      T.add(new THREE.SphereGeometry(0.268, 24, 10, 0, Math.PI * 2, 0, 1.42), own.hat, 0, 0, 0, { frame: F, sy: 0.95 });
      T.add(ball(0.026, 10, 8), own.hatTrim, 0, 0.258, 0, { frame: F });
      T.add(new THREE.CylinderGeometry(0.21, 0.21, 0.022, 20, 1, false, -Math.PI / 2, Math.PI), own.hat, 0, 0.05, 0.19, { frame: F, rx: -0.2, sz: 0.85 });
    } else if (hat === 'flatcap') {
      // a soft crown pulled forward, its short peak out over the eyes
      const F = hatAt('flatcap');
      T.add(new THREE.SphereGeometry(0.31, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), own.hat, 0, 0, 0.02, { frame: F, sy: 0.6, sz: 1.08 });
      T.add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18, 1, false, -Math.PI / 2, Math.PI), own.hat, 0, 0.0, 0.25, { frame: F, rx: 0.12, sz: 0.55 });
      T.add(ball(0.022, 8, 6), own.hatTrim, 0, 0.17, 0.17, { frame: F }); // its button
    } else if (hat === 'souwester') {
      // a sailor's rain hat: a round crown, the brim long and low at the back
      const F = hatAt('souwester');
      T.add(lathe([[0.268, -0.01], [0.272, 0.06], [0.24, 0.15], [0.14, 0.205], [0, 0.215]]), own.hat, 0, 0, 0, { frame: F });
      T.add(brim(0.26, 0.42, { droop: 0.08, thick: 0.02 }), own.hat, 0, -0.005, -0.06, { frame: F, rx: -0.22, sz: 1.2 });
    } else if (hat === 'beanie') {
      const F = hatAt('beanie');
      T.add(tile(new THREE.SphereGeometry(0.272, 24, 10, 0, Math.PI * 2, 0, 1.3), 36, 8), own.hat, 0, 0, 0, { frame: F, sy: 1.12 });
      T.add(tile(ring(0.262, 0.042, 8, 32), 36, 2), own.hat, 0, 0.272 * Math.cos(1.3) * 1.12, 0, { frame: F });
      T.add(ball(0.075, 14, 10), own.hatTrim, 0, 0.345, 0, { frame: F });
    } else if (hat === 'cowboy') {
      const F = hatAt('cowboy');
      T.add(brim(0.18, 0.45, { droop: 0.0, curl: 0.13, thick: 0.02 }), own.hat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.2, -0.01], [0.205, 0.08], [0.19, 0.17], [0.15, 0.21], [0.09, 0.2], [0.04, 0.185], [0, 0.19]]), own.hat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.205, 0.012], [0.212, 0.018], [0.212, 0.055], [0.204, 0.06]], { n: 6 }), leather, 0, 0, 0, { frame: F });
    } else if (hat === 'bandana') {
      const F = hatAt('bandana');
      T.add(tile(new THREE.SphereGeometry(0.273, 24, 10, 0, Math.PI * 2, 0, 1.18), 10, 3), own.hat, 0, 0, 0, { frame: F });
      T.add(tile(new THREE.SphereGeometry(0.271, 16, 6, Math.PI / 2 + 1.2, Math.PI * 2 - 2.4, 1.1, 0.75), 8, 2), own.hat, 0, 0, 0, { frame: F });
      T.add(ball(0.045, 10, 8), own.hat, 0, -0.03, -0.28, { frame: F });
      for (const sx of [-1, 1]) T.add(new THREE.ConeGeometry(0.05, 0.15, 6), own.hat, sx * 0.045, -0.1, -0.285, { frame: F, rz: sx * 0.45, sz: 0.35 }); // its ends
    } else if (hat === 'flowers') {
      const F = hatAt('flowers');
      T.add(ring(0.24, 0.017, 6, 36), leafMat, 0, 0, 0, { frame: F });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const at = V3(Math.sin(a) * 0.245, 0.012, Math.cos(a) * 0.245);
        const turn = new THREE.Quaternion().setFromUnitVectors(Z_OUT, V3(Math.sin(a), 0.7, Math.cos(a)).normalize());
        flower(T, F.clone().multiply(new THREE.Matrix4().compose(at, turn, V3(1, 1, 1))), own.hat);
      }
    }
  }

  // Five petals round a yellow middle, facing the frame's +z
  function flower(T, frame, petals) {
    for (let k = 0; k < 5; k++) {
      const b = (k / 5) * Math.PI * 2;
      T.add(ball(0.03, 8, 6), petals, Math.cos(b) * 0.032, Math.sin(b) * 0.032, 0, { frame, rz: b, sy: 0.6, sz: 0.35 });
    }
    T.add(ball(0.02, 8, 6), yellowMat, 0, 0, 0.008, { frame, sz: 0.6 });
  }

  // A shoe at the bottom of a leg (the leg's pivot is HIP_Y over the ground),
  // k as big as the body's (across: the length stays, so the feet stand the same)
  function buildShoe(P, shoes, k) {
    const ground = -HIP_Y;
    if (shoes === 'wellies') {
      P.add(limb(0.1, 0.096, 0.3), own.shoe, 0, ground + 0.36, 0, { sx: k, sz: k });
      P.add(ring(0.1, 0.014, 6, 20), own.shoe, 0, ground + 0.355, 0, { sx: k, sz: k });
    } else if (shoes === 'sneakers') {
      P.add(limb(0.072, 0.072, 0.1), whiteMat, 0, ground + 0.16, 0, { sx: k, sz: k }); // a sock
    } else {
      P.add(limb(0.092, 0.09, 0.15), own.shoe, 0, ground + 0.19, 0, { sx: k, sz: k }); // the boot's shaft
      P.add(ring(0.094, 0.012, 6, 20), own.shoe, 0, ground + 0.185, 0, { sx: k, sz: k }); // its rolled top
      for (const [y, tilt] of [[0.13, 0.55], [0.13, -0.55], [0.09, 0.55], [0.09, -0.55]]) {
        P.add(new THREE.BoxGeometry(0.05 * k, 0.007, 0.006), whiteMat, 0, ground + y, 0.091 * k + 0.002, { rz: tilt }); // laced up the front
      }
    }
    P.add(new THREE.CapsuleGeometry(0.075, 0.14, 4, 10), own.shoe, 0, ground + 0.07, 0.05, { rx: Math.PI / 2, sx: k, sz: 0.85 });
    const soleMaterial = shoes === 'sneakers' ? whiteMat : soleMat;
    P.add(new THREE.CapsuleGeometry(0.082, 0.15, 4, 10), soleMaterial, 0, ground + 0.022, 0.05, { rx: Math.PI / 2, sx: k, sz: 0.3 });
    if (shoes === 'sneakers') P.add(ball(0.06, 10, 8), whiteMat, 0, ground + 0.055, 0.15, { sx: 1.15 * k, sy: 0.7 }); // the toe cap
  }

  paint();
  build();

  // ---- What they hold ----
  // Hoe, gripped in the right hand near the bottom of its handle
  const hoe = new THREE.Group();
  hoe.position.copy(HAND);
  hoe.rotation.x = HOE_REST_ANGLE;
  rightArm.pivot.add(hoe);
  hoe.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), handleMat, 0, 0.3, 0));
  hoe.add(part(new THREE.BoxGeometry(0.24, 0.05, 0.2), bladeMat, 0, 0.76, 0.08));

  // Axe, held the same way: a shorter handle with a wedge of a head
  const axe = new THREE.Group();
  axe.position.copy(HAND);
  axe.rotation.x = HOE_REST_ANGLE;
  axe.visible = false;
  rightArm.pivot.add(axe);
  axe.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.8, 6), handleMat, 0, 0.25, 0));
  axe.add(part(new THREE.BoxGeometry(0.06, 0.2, 0.26), bladeMat, 0, 0.56, 0.12));
  axe.add(part(new THREE.BoxGeometry(0.03, 0.24, 0.05), edgeMat, 0, 0.56, 0.26));

  // Pickaxe, held the same way: a bar across the top of the handle, its two
  // points bent down a little
  const pick = new THREE.Group();
  pick.position.copy(HAND);
  pick.rotation.x = HOE_REST_ANGLE;
  pick.visible = false;
  rightArm.pivot.add(pick);
  pick.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.8, 6), handleMat, 0, 0.25, 0));
  pick.add(part(new THREE.BoxGeometry(0.06, 0.07, 0.36), bladeMat, 0, 0.62, 0.02));
  for (const side of [-1, 1]) {
    const point = part(new THREE.BoxGeometry(0.045, 0.05, 0.16), edgeMat, 0, 0.58, side * 0.25);
    point.rotation.x = side * 0.45;
    pick.add(point);
  }

  // For bopping in lobbies, held and swung like the tools: a sword (a blade,
  // a crossguard, a grip: setSword makes it wood, steel or silver), and a
  // mallet with a padded stone head
  const sword = new THREE.Group();
  const swordMat = detail(mat(0xd9a066), 'tool');
  sword.add(part(new THREE.BoxGeometry(0.05, 0.62, 0.11), swordMat, 0, 0.5, 0));
  sword.add(part(new THREE.BoxGeometry(0.07, 0.05, 0.3), handleMat, 0, 0.18, 0));
  sword.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), handleMat, 0, 0.06, 0));
  const mallet = new THREE.Group();
  const stoneMat = detail(mat(0x9c9a92), 'tool');
  const padMat = detail(mat(0xe8c98f), 'leather');
  mallet.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.75, 6), handleMat, 0, 0.25, 0));
  mallet.add(part(new THREE.BoxGeometry(0.2, 0.2, 0.32), stoneMat, 0, 0.64, 0));
  for (const side of [-1, 1]) mallet.add(part(new THREE.BoxGeometry(0.22, 0.22, 0.05), padMat, 0, 0.64, side * 0.17)); // (the padding)
  for (const g of [sword, mallet]) {
    g.position.copy(HAND);
    g.rotation.x = HOE_REST_ANGLE;
    g.visible = false;
    rightArm.pivot.add(g);
  }

  // A bow, held by its grip and kept upright whatever the arm does: an arc of
  // wood bowed out ahead, its string behind. A shot (swing()) holds it out
  // in front, aimed.
  const bow = new THREE.Group();
  const BOW_R = 0.45;
  const BOW_ARC = 2;
  const limbs = new THREE.TorusGeometry(BOW_R, 0.025, 5, 14, BOW_ARC).rotateZ(-BOW_ARC / 2).rotateY(-Math.PI / 2).translate(0, 0, -BOW_R);
  bow.add(part(limbs, handleMat, 0, 0, 0));
  const tipZ = BOW_R * (Math.cos(BOW_ARC / 2) - 1);
  bow.add(part(new THREE.CylinderGeometry(0.006, 0.006, 2 * BOW_R * Math.sin(BOW_ARC / 2), 4), whiteMat, 0, 0, tipZ));
  bow.add(part(new THREE.CylinderGeometry(0.034, 0.034, 0.12, 6), gripMat, 0, 0, 0)); // (the grip)
  bow.position.copy(HAND);
  bow.visible = false;
  rightArm.pivot.add(bow);

  // A fishing rod: a long pole held up and out, a reel by the grip; the
  // line hangs from `rodTip` (src/fishing.js draws it and the bobber)
  const rodGroup = new THREE.Group();
  rodGroup.add(part(new THREE.CylinderGeometry(0.012, 0.032, 1.7, 6), rod.pole, 0, 0.7, 0));
  const reel = part(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), bladeMat, 0.06, 0.12, 0);
  reel.rotation.z = Math.PI / 2;
  rodGroup.add(reel);
  const rodTip = new THREE.Object3D();
  rodTip.position.y = 1.55;
  rodGroup.add(rodTip);
  rodGroup.position.copy(HAND);
  rodGroup.rotation.x = ROD_REST_ANGLE;
  rodGroup.visible = false;
  rightArm.pivot.add(rodGroup);

  // A watering can, hanging from the hand by its handle, its spout forward;
  // a swing tips it up to pour (setCan: the plain can's green, or the big
  // one's steel)
  const can = new THREE.Group();
  const canMat = detail(mat(0x5f9a63, { metalness: 0.4, roughness: 0.5 }), 'tool'); // (a dull sheen on the paint)
  can.add(part(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 10), canMat, 0, -0.19, 0.03));
  const spout = part(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), canMat, 0, -0.15, 0.2);
  spout.rotation.x = 1;
  can.add(spout);
  can.add(part(new THREE.CylinderGeometry(0.045, 0.028, 0.04, 8), canMat, 0, -0.07, 0.33).rotateX(1)); // the rose
  can.add(part(new THREE.TorusGeometry(0.08, 0.016, 6, 12, Math.PI), canMat, 0, -0.07, 0.03).rotateY(Math.PI / 2)); // the handle
  can.position.copy(HAND);
  can.visible = false;
  rightArm.pivot.add(can);

  const toolMats = [swordMat, stoneMat, padMat, rod.pole, canMat];
  for (const g of [hoe, axe, pick, sword, mallet, bow, rodGroup, can]) g.traverse((obj) => obj.isMesh && (obj.castShadow = true));

  // Animation state for the model
  let mount = null; // what they ride (ride()), if anything
  const anim = {
    facing: 0, // current yaw, eased toward the movement direction
    walkPhase: 0,
    walkAmount: 0, // 0 = idle pose, 1 = full walk cycle
    squash: 0, // >0 squashes (landing), <0 stretches (jumping)
    swing: -1, // tool swing progress 0..1, or -1 when not swinging
    line: null, // the fishing line: null (not out), 'out' or 'bite' (the rod held out over the water)
    blink: 1 + Math.random() * 3, // seconds to the next blink
  };

  // moving: walking (or steering in the air) this frame. targetYaw: where it
  // should face while moving. time: seconds, for idle breathing.
  function animate(dt, { moving, onGround, targetYaw, time }) {

    // Turn smoothly toward the movement direction, taking the short way around
    if (moving) {
      let diff = targetYaw - anim.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      anim.facing += diff * damp(14, dt);
    }
    root.rotation.y = anim.facing;

    const walking = moving && onGround;
    anim.walkAmount += ((walking ? 1 : 0) - anim.walkAmount) * damp(10, dt);
    if (walking) anim.walkPhase += dt * 11;

    const swingL = Math.sin(anim.walkPhase) * anim.walkAmount;

    if (onGround) {
      legs[0].pivot.rotation.x = swingL * 0.7;
      legs[1].pivot.rotation.x = -swingL * 0.7;
      arms[0].pivot.rotation.x = -swingL * 0.6;
      arms[1].pivot.rotation.x = swingL * 0.25; // the hoe arm swings less
    } else {
      // Airborne pose: one knee up, arms lifted
      const k = damp(12, dt);
      legs[0].pivot.rotation.x += (-0.6 - legs[0].pivot.rotation.x) * k;
      legs[1].pivot.rotation.x += (0.35 - legs[1].pivot.rotation.x) * k;
      arms[0].pivot.rotation.x += (-0.9 - arms[0].pivot.rotation.x) * k;
      arms[1].pivot.rotation.x += (-0.4 - arms[1].pivot.rotation.x) * k;
    }

    // With the line out the rod is held out over the water, twitching when something bites
    if (rodGroup.visible && anim.line) {
      const twitch = anim.line === 'bite' ? Math.sin(time * 45) * 0.08 : Math.sin(time * 1.3) * 0.03;
      rightArm.pivot.rotation.x = -0.6 + twitch;
    }

    // A swing (hoe, axe or pickaxe, the same chop; a cast; a shot of the bow) overrides the right arm
    hoe.rotation.x = HOE_REST_ANGLE;
    axe.rotation.x = HOE_REST_ANGLE;
    pick.rotation.x = HOE_REST_ANGLE;
    sword.rotation.x = HOE_REST_ANGLE;
    mallet.rotation.x = HOE_REST_ANGLE;
    rodGroup.rotation.x = ROD_REST_ANGLE;
    can.rotation.x = 0;
    if (bow.visible && anim.swing >= 0) {
      // (a shot: held out in front, aimed, and no chop)
      anim.swing += dt / HOE_SWING_TIME;
      if (anim.swing >= 1) anim.swing = -1;
      else rightArm.pivot.rotation.x = -1.45;
    } else if (anim.swing >= 0) {
      anim.swing += dt / HOE_SWING_TIME;
      if (anim.swing >= 1) {
        anim.swing = -1;
      } else {
        const [armAngle, hoeAngle] = sampleSwing(anim.swing);
        rightArm.pivot.rotation.x = armAngle;
        hoe.rotation.x = hoeAngle;
        axe.rotation.x = hoeAngle;
        pick.rotation.x = hoeAngle;
        sword.rotation.x = hoeAngle;
        mallet.rotation.x = hoeAngle;
        rodGroup.rotation.x = hoeAngle - HOE_REST_ANGLE + ROD_REST_ANGLE;
        can.rotation.x = Math.sin(anim.swing * Math.PI) * 0.9; // (tipped to pour)
      }
    }
    bow.rotation.x = -rightArm.pivot.rotation.x; // (upright)

    // On a mount (ride()): sat up on it, legs either side, and it walks instead
    rig.position.y = -height / 2 + (mount ? mount.seat : 0);
    if (mount) {
      legs[0].pivot.rotation.set(-1.2, 0, -0.35);
      legs[1].pivot.rotation.set(-1.2, 0, 0.35);
      mount.animate(dt, anim.walkAmount, time);
    } else {
      legs[0].pivot.rotation.z = 0;
      legs[1].pivot.rotation.z = 0;
    }

    // Walk bob + idle breathing, and a slight forward lean while walking
    const bob = Math.abs(Math.sin(anim.walkPhase)) * 0.06 * anim.walkAmount;
    torso.position.y = HIP_Y + bob;
    torso.rotation.x = 0.1 * anim.walkAmount;
    const breathe = Math.sin(time * 2.2) * 0.015 * (1 - anim.walkAmount);

    // A blink every few seconds: the eyes shut for a moment
    anim.blink -= dt;
    if (anim.blink < 0) anim.blink = 2 + Math.random() * 4;
    eyes.scale.y = anim.blink < 0.14 ? 0.12 + 0.88 * Math.abs(anim.blink - 0.07) / 0.07 : 1;

    // Squash & stretch, volume-preserving-ish, easing back to neutral
    anim.squash += (0 - anim.squash) * damp(10, dt);
    const sy = 1 - anim.squash + breathe;
    const sxz = 1 + anim.squash * 0.5;
    rig.scale.set(sxz, sy, sxz);

    if (contact) {
      if (onGround || groundY === null) groundY = root.position.y;
      const up = Math.max(0, root.position.y - groundY);
      const r = (mount ? mount.shadow ?? 0.85 : CONTACT.r) / (1 + up * 0.6);
      contact.visible = up < 3 && root.rotation.x === 0; // (not lying in bed: src/npcs.js)
      contact.position.y = -height / 2 + CONTACT.y - up;
      contact.scale.set(r, 1, mount ? r * 1.6 : r);
    }
  }

  return {
    root,
    hoe,
    axe,
    pick,
    sword,
    mallet,
    bow,
    rod: rodGroup,
    rodTip,
    toolArm: rightArm.pivot, // (the arm that holds the tools, its hand and whatever is in it)
    can,
    anim,
    animate,
    swing() {
      if (anim.swing < 0) anim.swing = 0;
    },
    // the sword's color (wood, steel or silver)
    setSword(color) {
      swordMat.color.setHex(color);
    },
    // the pole's color (the plain, sturdy or golden rod)
    setRod(color) {
      rod.pole.color.setHex(color);
    },
    // the watering can's color (the plain or the big one)
    setCan(color) {
      canMat.color.setHex(color);
    },
    // Up on a mount (src/mounts.js createMount()), or (null) down off it
    ride(next) {
      if (mount) {
        root.remove(mount.root);
        mount.dispose();
      }
      mount = next;
      if (mount) {
        mount.root.position.y = -height / 2;
        root.add(mount.root);
      }
    },
    setShirt(color) {
      shirtColor = color;
      paint();
    },
    // What they wear now (shared/looks.js; parts left out: the default's)
    setLook(next) {
      const was = worn;
      worn = { ...DEFAULT_LOOK, ...next };
      paint();
      const shapes = ['body', 'hat', 'hair', 'face', 'whiskers', 'top', 'bottoms', 'apron', 'shoes', 'neck'];
      if (shapes.some((part) => worn[part] !== was[part])) build();
    },
    // drop the per-farmer GPU resources (the shared materials and cloth stay)
    dispose() {
      root.traverse((obj) => obj.isMesh && obj.geometry.dispose());
      for (const m of [...Object.values(own), ...toolMats]) m.dispose();
      mount?.dispose();
    },
  };
}

function part(geo, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  return mesh;
}
