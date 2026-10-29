import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEFAULT_LOOK } from '../shared/looks.js';
import { hook } from './gfx/shading.js';
import { patch, define } from './gfx/chunks.js';
import { knobs, onApply } from './gfx/quality.js';
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
const SHOULDER = [0.29, 0.49]; // torso: where the arms pivot (x, y)
const ARM_LEN = 0.42; // shoulder to the middle of the hand
const HAND = new THREE.Vector3(0, -ARM_LEN, 0); // (in the arm's pivot, where tools are held)
const DEPTH = 0.88; // the body is a little flatter front to back than across
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
// and the mounts: rimmed()), so they stand out from the grass under the
// overhead camera. main.js keeps it with the time of day (lightFarmers): the
// sky's color, warmed a little toward the sun's, so it reads as light on them
// and not as a blue haze. A narrow band right at the silhouette (tuned under
// the tone mapping and the wrap light: src/gfx/tonemap.js, light.js). As
// much as the surface would give back (its own color, lifted): light cloth
// and skin keep it all, dark hair only a faint edge, not a pale halo.
const RIM = { warm: new THREE.Color(1, 0.9, 0.76), warmth: 0.45, from: 0.35 };
const rim = { value: new THREE.Color(0.12, 0.12, 0.12) };
const _warm = new THREE.Color();
export function lightFarmers(color, strength) {
  const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b; // (as bright as the sky, in a warmer hue)
  rim.value.copy(color).lerp(_warm.copy(RIM.warm).multiplyScalar(luma), RIM.warmth).multiplyScalar(strength);
}
function rimShader(shader) {
  define(shader, 'GFX_RIM');
  shader.uniforms.uFarmerRim = rim;
  shader.fragmentShader = 'uniform vec3 uFarmerRim;\n' + patch(shader.fragmentShader, 'emissivemap_fragment', `
    float farmerEdge = smoothstep(${RIM.from.toFixed(2)}, 1.0, 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0));
    totalEmissiveRadiance += uFarmerRim * (farmerEdge * farmerEdge) * min(vec3(1.0), 0.2 + 1.6 * diffuseColor.rgb);`, 'GFX_RIM');
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
  const warp = threads(n / 2, rand, 246, 14);
  const weft = threads(n / 2, rand, 224, 18);
  shades(g, n, (x, y) => {
    const over = ((x >> 1) + (y >> 1)) % 2;
    const edge = (over ? x : y) % 2 ? 0.94 : 1; // (each thread rounded)
    return (over ? warp[x >> 1] : weft[y >> 1]) * edge + (rand() - 0.5) * 6;
  });
}, false, 0.25);
// denim's diagonal twill, the blue warp heathered up and down, paler streaks
const twillTex = () => texture('twill', 64, (g, n) => {
  const rand = seeded(11);
  const warp = threads(n / 2, rand, 200, 26);
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
    const ridge = lx > 0.8 ? 0.72 : 1;
    return (150 + (yarn[x >> 3] - 150) * leg) * ridge * (y % 8 === 0 ? 0.9 : 1) + (rand() - 0.5) * 8;
  });
}, false, 0.25);
// a buffalo check: bands across and down, darker where they cross, fine
// lines between, and a twill's diagonal through it all
const plaidTex = () => texture('plaid', 128, (g, n) => {
  const rand = seeded(3);
  shades(g, n, (x, y) => {
    const band = (x < n / 2 ? 0.62 : 1) * (y < n / 2 ? 0.62 : 1);
    const line = Math.abs(x - n * 0.74) < 3 || Math.abs(y - n * 0.74) < 3 ? 0.78 : 1;
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

// ---------- The outline ----------
// On the high tier (knobs().outline) a farmer has a thin dark edge, like the
// ink round a painted figure: a hull of their pieces pushed out along the
// normals and drawn inside out (its back faces only), so it shows just past
// the silhouette. It is one mesh for the whole farmer, each piece skinned to
// the part it moves with (the torso with the head, each arm, each leg) with
// those parts' groups for bones, so it follows the walk and the swings in one
// draw. The little bits (eyes, cheeks, glasses: noShadow) and the eyes'
// group are left out. It casts no shadow.
const OUTLINE = { push: 0.018, color: 0x3a281c };
const hullMat = new THREE.MeshBasicMaterial({ color: OUTLINE.color, side: THREE.BackSide });
hullMat.userData.noSnow = true;
let outlineOn = null; // (the tier's, once applied: src/gfx/quality.js)
onApply((k) => (outlineOn = k.outline));
const outlined = () => (outlineOn ??= knobs().outline);
const IDENTITY = new THREE.Matrix4();

// meshes: [[the part's meshes, its bone's index]]; bones: the parts' groups, in
// that order. In the rig's frame (it goes in the rig).
function buildHull(meshes, bones) {
  const pieces = [];
  for (const [list, bone] of meshes) {
    for (const mesh of list) {
      if (mesh.material.userData.noShadow || mesh.material.side !== THREE.FrontSide) continue;
      const src = mesh.geometry;
      const pos = src.attributes.position;
      const nrm = src.attributes.normal;
      const n = pos.count;
      const out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        out[i * 3] = pos.getX(i) + nrm.getX(i) * OUTLINE.push;
        out[i * 3 + 1] = pos.getY(i) + nrm.getY(i) * OUTLINE.push;
        out[i * 3 + 2] = pos.getZ(i) + nrm.getZ(i) * OUTLINE.push;
      }
      const skinIndex = new Uint16Array(n * 4);
      const skinWeight = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        skinIndex[i * 4] = bone;
        skinWeight[i * 4] = 1;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
      geo.setIndex(src.index ? Array.from(src.index.array) : [...Array(n).keys()]);
      pieces.push(geo);
    }
  }
  if (!pieces.length) return null;
  const geo = mergeGeometries(pieces);
  for (const g of pieces) g.dispose();
  const hull = new THREE.SkinnedMesh(geo, hullMat);
  hull.name = 'outline';
  hull.castShadow = hull.receiveShadow = false;
  hull.userData.noShadow = true;
  // (each bone's own frame is the pieces' frame, so nothing to undo: the pose is the groups' as they are)
  hull.bind(new THREE.Skeleton(bones, bones.map(() => IDENTITY.clone())), IDENTITY);
  hull.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.85, 0), 1.4); // (round the farmer, in the rig's frame: not re-skinned to cull)
  return hull;
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

// ---------- The body ----------
// The torso's outline, hips (y = 0) to shoulders; the head sits on it
const TORSO = [[0, -0.09], [0.16, -0.085], [0.24, -0.05], [0.262, 0.03], [0.26, 0.15], [0.252, 0.26], [0.266, 0.37], [0.262, 0.46], [0.236, 0.54], [0.18, 0.605], [0.1, 0.64], [0, 0.65]];
const torsoLine = new THREE.SplineCurve(TORSO.map(([r, y]) => V2(r, y))).getSpacedPoints(64);
// the torso's radius at height y
function torsoR(y) {
  for (let i = 1; i < torsoLine.length; i++) {
    const a = torsoLine[i - 1];
    const b = torsoLine[i];
    if (y >= a.y && y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
  }
  return 0;
}
// how far in front of (side 1) or behind (side -1) the middle the torso's surface is, at x, y
const torsoZ = (x, y, side) => side * DEPTH * Math.sqrt(Math.max(0, torsoR(y) ** 2 - x * x));

// A strap of the overalls: up from the bib (on side sx), over the shoulder
// and down the back, crossing the other
function strapCurve(sx) {
  const pts = [];
  for (const y of [0.44, 0.5, 0.56, 0.61]) pts.push(V3(sx * 0.11, y, torsoZ(0.11, y, 1) + 0.012));
  pts.push(V3(sx * 0.11, 0.655, 0));
  for (const y of [0.6, 0.52, 0.42, 0.32, 0.24]) {
    const x = sx * (0.11 - 0.15 * (0.6 - y) / 0.36);
    pts.push(V3(x, y, torsoZ(x, y, -1) - 0.012));
  }
  return new THREE.CatmullRomCurve3(pts);
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
export function createFarmer({ shirt = 0xff5533, height = 1.6, look = DEFAULT_LOOK } = {}) {
  // Their own materials, repainted (not remade) for a new look or color
  const own = {
    skin: detail(mat(0xffcc99, { roughness: 0.7 }), 'skin'),
    blush: noShadow(mat(0xff9f8a, { roughness: 0.7 })),
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
  const legs = [-1, 1].map((sx) => pivot(rig, sx * 0.12, HIP_Y));
  const arms = [-1, 1].map((sx) => pivot(torso, sx * SHOULDER[0], SHOULDER[1]));
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

    // -- The body: the shirt, its collar --
    const top = TOP_TRIM[L.top] ? L.top : 'shirt';
    T.add(wrap(lathe(TORSO, { segs: 22, n: 20 }), 0.26, 0.85, TOP_TILE[top]), own.shirt, 0, 0, 0, { sz: DEPTH });
    if (top === 'sweater') {
      T.add(ring(0.185, 0.04), own.shirt, 0, 0.585, 0, { sz: DEPTH }); // a rolled neck
    } else {
      T.add(ring(0.19, 0.022), own.trim, 0, 0.585, 0, { sz: DEPTH }); // the collar
    }

    // -- What is worn below: overalls (short or long), trousers or a skirt --
    const bottoms = ['overalls', 'shortalls', 'trousers', 'skirt'].includes(L.bottoms) ? L.bottoms : 'overalls';
    if (bottoms !== 'skirt') {
      // the seat of the trousers, up to the waist
      T.add(wrap(lathe([[0, -0.1], [0.17, -0.095], [0.25, -0.06], [0.276, 0.02], [0.277, 0.12], [0.272, 0.21]], { n: 14 }), 0.27, 0.36, 0.05), own.bottoms, 0, 0, 0, { sz: DEPTH });
    }
    if (bottoms === 'overalls' || bottoms === 'shortalls') {
      // the bib, its hem, a pocket, the straps and their buttons
      T.add(tile(new THREE.CylinderGeometry(0.279, 0.277, 0.26, 10, 1, true, -0.48, 0.96), 3, 5), own.bottoms, 0, 0.33, 0, { sz: DEPTH });
      T.add(new THREE.CylinderGeometry(0.282, 0.282, 0.02, 10, 1, true, -0.49, 0.98), own.bottomsTrim, 0, 0.455, 0, { sz: DEPTH });
      T.add(tile(new THREE.BoxGeometry(0.12, 0.085, 0.012), 2, 2), own.bottoms, 0, 0.32, 0.25, {});
      for (const sx of [-1, 1]) {
        T.add(tile(new THREE.TubeGeometry(strapCurve(sx), 20, 0.021, 5), 12, 1), own.bottoms);
        T.add(ball(0.024, 10, 8), brass, sx * 0.11, 0.44, torsoZ(0.11, 0.44, 1) + 0.022, { sz: 0.6 });
      }
    } else if (bottoms === 'trousers') {
      // a belt with a buckle
      T.add(lathe([[0.274, 0.165], [0.28, 0.17], [0.28, 0.215], [0.274, 0.22]], { n: 6 }), leather, 0, 0, 0, { sz: DEPTH });
      T.add(new THREE.BoxGeometry(0.06, 0.05, 0.014), brass, 0, 0.192, 0.248);
    } else {
      // a skirt flaring out over the knees, with a waistband and a hem
      T.add(wrap(lathe([[0.36, -0.2], [0.335, -0.1], [0.3, 0.02], [0.278, 0.14], [0.27, 0.22]], { n: 12 }), 0.3, 0.45, 0.05), own.bottoms, 0, 0, 0, { sz: DEPTH });
      T.add(lathe([[0.272, 0.17], [0.28, 0.175], [0.28, 0.225], [0.272, 0.23]], { n: 6 }), own.bottomsTrim, 0, 0, 0, { sz: DEPTH });
      T.add(ring(0.358, 0.012, 6, 36), own.bottomsTrim, 0, -0.2, 0, { sz: DEPTH });
    }

    // -- An apron over the front, from the chest to the knees, tied round the waist --
    if (L.apron === 'apron') {
      const flare = bottoms === 'skirt' ? 0.38 : 0.335; // (out over a skirt)
      T.add(tile(new THREE.CylinderGeometry(0.288, flare, 0.72, 12, 1, true, -0.62, 1.24), 4, 9), own.apron, 0, 0.13, 0, { sz: DEPTH });
      T.add(ring(0.283, 0.014, 6, 32), own.apronTrim, 0, 0.21, 0, { sz: DEPTH }); // its ties
      T.add(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 12, 1, true, -0.63, 1.26), own.apronTrim, 0, 0.485, 0, { sz: DEPTH }); // its hem at the top
      const rAt = (y) => 0.288 + ((0.49 - y) / 0.72) * (flare - 0.288); // (its radius at height y)
      T.add(tile(new THREE.BoxGeometry(0.2, 0.1, 0.012), 3, 2), own.apronTrim, 0, 0.04, DEPTH * rAt(0.04) + 0.008, { rx: -Math.atan((flare - 0.288) / 0.72) }); // a pocket
      for (const sx of [-1, 1]) {
        // a strap up from each corner, round the back of the neck
        const up = new THREE.CatmullRomCurve3([[0.15, 0.49], [0.14, 0.55], [0.12, 0.61]].map(([x, y]) => V3(sx * x, y, torsoZ(x, y, 1) + 0.014)).concat(V3(sx * 0.08, 0.66, -0.02)));
        T.add(new THREE.TubeGeometry(up, 10, 0.016, 5), own.apronTrim);
      }
    }

    // -- Round the neck --
    if (L.neck === 'neckerchief') {
      T.add(ring(0.2, 0.03), own.neck, 0, 0.575, 0, { sz: DEPTH });
      T.add(new THREE.ConeGeometry(0.11, 0.17, 3), own.neck, 0, 0.47, torsoZ(0, 0.5, 1) + 0.02, { rx: Math.PI - 0.25, sz: 0.25 }); // the point, down the chest
      T.add(ball(0.026, 10, 8), own.neck, 0.03, 0.555, torsoZ(0.03, 0.555, 1) + 0.03); // the knot
    } else if (L.neck === 'scarf') {
      T.add(tile(ring(0.2, 0.052, 10, 28), 8, 2), own.neck, 0, 0.58, 0, { sz: DEPTH });
      for (const [x, len, tilt] of [[0.06, 0.24, 0.12], [0.13, 0.2, 0.3]]) {
        const tail = tile(new THREE.CapsuleGeometry(0.042, len, 4, 8), 2, 4);
        T.add(tail, own.neck, x, 0.53 - len / 2, torsoZ(x, 0.45, 1) + 0.03, { rz: tilt, rx: -0.2, sz: 0.4 });
      }
    }

    // -- The head: skin, ears, nose, cheeks; the eyes, brows and a smile --
    onHeadAt(ball(HEAD_R, 26, 18), own.skin, V3(0, 0, 0));
    onHeadAt(ball(0.042, 12, 8), own.skin, onHead(-0.06, 0, 0.245), { sx: 1.1, sy: 0.85, sz: 0.9 });
    for (const sx of [-1, 1]) {
      onHeadAt(ball(0.058, 12, 8), own.skin, onHead(0.0, sx * Math.PI / 2, 0.238), { q: facing(0, sx * Math.PI / 2), sx: 0.8, sy: 0.95, sz: 0.5 });
      onHeadAt(ball(0.05, 12, 8), own.blush, onHead(-0.13, sx * 0.62, 0.242), { q: facing(-0.13, sx * 0.62), sy: 0.62, sz: 0.3 });
      const eye = inEyes(onHead(EYE.lat, sx * EYE.lon, 0.247));
      E.add(ball(0.043, 14, 10), ink, eye.x, eye.y, eye.z, { q: facing(EYE.lat, sx * EYE.lon), sx: 0.8, sy: 1.18, sz: 0.45 });
      const glint = inEyes(onHead(EYE.lat + 0.045, sx * EYE.lon - 0.035, 0.262)); // (up and to the same side in both eyes)
      E.add(ball(0.012, 8, 6), shine, glint.x, glint.y, glint.z);
      onHeadAt(new THREE.CapsuleGeometry(0.011, 0.05, 3, 6), own.hair, onHead(0.27, sx * EYE.lon, 0.252), { q: spun(facing(0.27, sx * EYE.lon), Math.PI / 2 - sx * 0.14) });
    }
    onHeadAt(new THREE.TorusGeometry(0.032, 0.0085, 6, 12, Math.PI), ink, onHead(-0.2, 0, 0.247), { q: spun(facing(-0.2, 0), Math.PI) });

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
      onHeadAt(new THREE.SphereGeometry(0.262, 24, 8, Math.PI / 2 - 1.65, 3.3, 1.88, 0.95), own.hair, V3(0, 0, 0));
      onHeadAt(ball(0.07, 12, 8), own.hair, onHead(-0.9, 0, 0.22), { sx: 1.3, sy: 0.8 });
    }

    // -- Hair --
    const hatOn = !['none', 'flowers'].includes(L.hat);
    const hair = L.hair;
    if (hair !== 'bald') {
      onHeadAt(new THREE.SphereGeometry(0.263, 22, 7, 0, Math.PI * 2, 0, 1.02), own.hair, V3(0, 0, 0)); // the crown
      const down = { short: 1.95, tousled: 1.9, bob: 2.28, long: 2.3, bun: 1.95, ponytail: 1.95, braids: 2.0 }[hair] ?? 1.95; // how far down the back and sides
      const r = hair === 'bob' ? 0.264 : 0.259;
      const open = hair === 'bob' || hair === 'long' ? 0.82 : 1.15; // round from the front to where the hair starts (a bob frames the face)
      onHeadAt(new THREE.SphereGeometry(r, 20, 9, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0.9, down - 0.9), own.hair, V3(0, 0, 0));
      // across the forehead: tufts, or straight bangs
      const tufts = hair === 'braids' ? [-0.62, -0.3, 0.3, 0.62] : [-0.5, -0.17, 0.17, 0.5];
      if (hair === 'bob') {
        onHeadAt(new THREE.SphereGeometry(0.268, 20, 4, Math.PI / 2 - 0.86, 1.72, 0.6, 0.5), own.hair, V3(0, 0, 0));
      } else {
        for (const [i, lon] of tufts.entries()) {
          const lat = 0.47 - (hair === 'braids' ? 0 : i * 0.018); // (swept a little to one side)
          onHeadAt(ball(0.068, 12, 8), own.hair, onHead(lat, lon, 0.252), { q: spun(facing(lat, lon), -0.25), sx: 1.25, sy: 0.6, sz: 0.55 });
        }
      }
      if (hair === 'tousled') {
        // flicks by the ears, and (with no hat over them) tufts sticking up
        for (const sx of [-1, 1]) onHeadAt(new THREE.ConeGeometry(0.04, 0.1, 6), own.hair, onHead(-0.12, sx * 1.05, 0.25), { q: facing(-0.5, sx * 1.4, Y_UP) });
        if (!hatOn) {
          for (const [lat, lon] of [[1.25, 0], [1.05, 0.7], [1.05, -0.7], [0.95, 2.2], [0.95, -2.2], [1.1, Math.PI]]) {
            onHeadAt(new THREE.ConeGeometry(0.05, 0.12, 6), own.hair, onHead(lat, lon, 0.24), { q: facing(lat, lon, Y_UP) });
          }
        }
      } else if (hair === 'long') {
        // a curtain of hair down the back
        T.add(lathe([[0.2, -0.53], [0.25, -0.48], [0.272, -0.38], [0.268, -0.22], [0.26, -0.08], [0.255, 0.02]], { segs: 16, n: 10, phiStart: Math.PI - 1.1, phiLength: 2.2 }), own.hair, 0, 0, 0, { frame: HEAD });
      } else if (hair === 'ponytail') {
        // tied at the back, and swinging down behind
        onHeadAt(ring(0.05, 0.02), ribbonMat, V3(0, -0.02, -0.255), { rx: Math.PI / 2 - 0.4 });
        onHeadAt(new THREE.CapsuleGeometry(0.06, 0.2, 4, 10), own.hair, V3(0, -0.15, -0.3), { rx: 0.4, sx: 1.1 });
        onHeadAt(ball(0.045, 10, 8), own.hair, V3(0, -0.27, -0.25));
      } else if (hair === 'bun') {
        const high = !hatOn;
        onHeadAt(ball(0.1, 16, 12), own.hair, high ? V3(0, 0.21, -0.16) : V3(0, -0.04, -0.28));
        onHeadAt(ring(0.07, 0.018), own.hair, high ? V3(0, 0.15, -0.12) : V3(0, -0.04, -0.235), { rx: high ? -0.7 : -Math.PI / 2 });
      } else if (hair === 'braids') {
        for (const sx of [-1, 1]) {
          const path = [[0.21, -0.06, -0.05, 0.05], [0.22, -0.16, 0.06, 0.048], [0.205, -0.25, 0.14, 0.044], [0.19, -0.33, 0.19, 0.04]];
          for (const [x, y, z, r] of path) onHeadAt(ball(r, 12, 8), own.hair, V3(sx * x, y, z));
          onHeadAt(ring(0.03, 0.012), ribbonMat, V3(sx * 0.186, -0.38, 0.205), { rx: 0.4 });
          onHeadAt(ball(0.032, 10, 8), own.hair, V3(sx * 0.183, -0.415, 0.212), { sy: 1.3 });
        }
      }
    }

    // -- A hat --
    buildHat(T, L.hat);

    // -- Arms: sleeves, maybe bare forearms, cuffs, hands --
    for (const [i, sx] of [-1, 1].entries()) {
      const P = A[i];
      const sleeve = (length, rTop, rBottom) => P.add(wrap(limb(rTop, rBottom, length), rTop, length, TOP_TILE[top]), own.shirt, 0, 0.045);
      const forearm = (from) => P.add(limb(0.064, 0.056, ARM_LEN - from - 0.02), own.skin, 0, -from);
      if (top === 'tee') {
        sleeve(0.22, 0.09, 0.086);
        P.add(ring(0.084, 0.014), own.trim, 0, -0.16);
        forearm(0.12);
      } else if (top === 'plaid') {
        sleeve(0.3, 0.082, 0.077);
        P.add(tile(ring(0.077, 0.026, 8, 20), 6, 1), own.shirt, 0, -0.235); // rolled up
        forearm(0.22);
      } else {
        sleeve(0.405, 0.082, 0.07);
        if (top === 'sweater') P.add(wrap(limb(0.074, 0.074, 0.08), 0.074, 0.08, 0.05), own.trim, 0, -0.3);
        else P.add(ring(0.07, 0.016), own.trim, 0, -0.335);
      }
      P.add(ball(0.068, 14, 10), own.skin, 0, -ARM_LEN, 0, { sx: 0.95, sy: 1.08, sz: 0.85 });
      P.add(ball(0.03, 8, 6), own.skin, -sx * 0.04, -ARM_LEN + 0.025, 0.035, { sy: 1.2 }); // a thumb
    }

    // -- Legs: trousers or bare, turn-ups, shoes --
    for (const P of G) {
      if (bottoms === 'overalls' || bottoms === 'trousers') {
        P.add(wrap(limb(0.105, 0.088, 0.46), 0.1, 0.46, 0.05), own.bottoms, 0, 0.04);
        if (L.shoes !== 'wellies') P.add(ring(0.09, 0.02, 6, 20), own.bottomsTrim, 0, -0.37); // turned up at the bottom (tucked into wellies)
      } else {
        P.add(limb(0.08, 0.06, 0.46), own.skin, 0, 0.02);
        if (bottoms === 'shortalls') {
          P.add(wrap(limb(0.112, 0.106, 0.2), 0.11, 0.2, 0.05), own.bottoms, 0, 0.04);
          P.add(ring(0.106, 0.02, 6, 20), own.bottomsTrim, 0, -0.145);
        }
      }
      buildShoe(P, L.shoes);
    }

    const parts = [T.build(torso), A[0].build(arms[0].pivot), A[1].build(arms[1].pivot), G[0].build(legs[0].pivot), G[1].build(legs[1].pivot)];
    meshes = [...parts.flat(), ...E.build(eyes)];
    hullParts = parts.map((list, bone) => [list, bone]);
    dropHull();
    if (outlined()) makeHull();
  }

  // ---- The outline (high tier): one skinned hull, made and dropped as the tier changes ----
  const bones = [torso, arms[0].pivot, arms[1].pivot, legs[0].pivot, legs[1].pivot];
  let hullParts = [];
  let hull = null;
  let hullOn = false;
  function makeHull() {
    hullOn = true;
    hull = buildHull(hullParts, bones);
    if (hull) rig.add(hull);
  }
  function dropHull() {
    hullOn = false;
    if (!hull) return;
    rig.remove(hull);
    hull.geometry.dispose();
    hull.skeleton.dispose();
    hull = null;
  }

  // A hat, in the torso's parts
  function buildHat(T, hat) {
    if (hat === 'straw') {
      const F = hatFrame(0.17, -0.05, -0.4);
      T.add(tile(brim(0.17, 0.4, { droop: 0.035 }), 40, 3), strawMat, 0, 0, 0, { frame: F });
      T.add(tile(lathe([[0.205, -0.01], [0.215, 0.06], [0.21, 0.13], [0.185, 0.175], [0.12, 0.19], [0, 0.192]]), 26, 6), strawMat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.214, 0.012], [0.222, 0.018], [0.222, 0.064], [0.214, 0.07]], { n: 6 }), own.hat, 0, 0, 0, { frame: F });
    } else if (hat === 'sunhat') {
      const F = hatFrame(0.15, -0.04, -0.45);
      T.add(tile(brim(0.17, 0.5, { droop: 0.06, wave: 5, waveH: 0.022 }), 50, 4), paleStrawMat, 0, 0, 0, { frame: F });
      T.add(tile(lathe([[0.2, -0.01], [0.21, 0.06], [0.18, 0.12], [0.1, 0.145], [0, 0.15]]), 26, 5), paleStrawMat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.206, 0.0], [0.214, 0.006], [0.214, 0.05], [0.206, 0.056]], { n: 6 }), own.hat, 0, 0, 0, { frame: F });
      flower(T, F.clone().multiply(new THREE.Matrix4().compose(V3(0.16, 0.035, 0.14), new THREE.Quaternion().setFromUnitVectors(Z_OUT, V3(0.75, 0.2, 0.62).normalize()), V3(1.2, 1.2, 1.2))), whiteMat);
    } else if (hat === 'cap') {
      const F = hatFrame(0.02, 0, -0.3);
      T.add(new THREE.SphereGeometry(0.268, 24, 10, 0, Math.PI * 2, 0, 1.42), own.hat, 0, 0, 0, { frame: F, sy: 0.95 });
      T.add(ball(0.026, 10, 8), own.hatTrim, 0, 0.258, 0, { frame: F });
      T.add(new THREE.CylinderGeometry(0.21, 0.21, 0.022, 20, 1, false, -Math.PI / 2, Math.PI), own.hat, 0, 0.05, 0.19, { frame: F, rx: -0.2, sz: 0.85 });
    } else if (hat === 'flatcap') {
      // a soft crown pulled forward, its short peak out over the eyes
      const F = hatFrame(0.095, 0.02, -0.1);
      T.add(new THREE.SphereGeometry(0.31, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), own.hat, 0, 0, 0.02, { frame: F, sy: 0.6, sz: 1.08 });
      T.add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18, 1, false, -Math.PI / 2, Math.PI), own.hat, 0, 0.0, 0.25, { frame: F, rx: 0.12, sz: 0.55 });
      T.add(ball(0.022, 8, 6), own.hatTrim, 0, 0.17, 0.17, { frame: F }); // its button
    } else if (hat === 'souwester') {
      // a sailor's rain hat: a round crown, the brim long and low at the back
      const F = hatFrame(0.1, -0.03, -0.25);
      T.add(lathe([[0.268, -0.01], [0.272, 0.06], [0.24, 0.15], [0.14, 0.205], [0, 0.215]]), own.hat, 0, 0, 0, { frame: F });
      T.add(brim(0.26, 0.42, { droop: 0.08, thick: 0.02 }), own.hat, 0, -0.005, -0.06, { frame: F, rx: -0.22, sz: 1.2 });
    } else if (hat === 'beanie') {
      const F = hatFrame(0, -0.01, -0.22);
      T.add(tile(new THREE.SphereGeometry(0.272, 24, 10, 0, Math.PI * 2, 0, 1.3), 36, 8), own.hat, 0, 0, 0, { frame: F, sy: 1.12 });
      T.add(tile(ring(0.262, 0.042, 8, 32), 36, 2), own.hat, 0, 0.272 * Math.cos(1.3) * 1.12, 0, { frame: F });
      T.add(ball(0.075, 14, 10), own.hatTrim, 0, 0.345, 0, { frame: F });
    } else if (hat === 'cowboy') {
      const F = hatFrame(0.16, -0.04, -0.32);
      T.add(brim(0.18, 0.45, { droop: 0.0, curl: 0.13, thick: 0.02 }), own.hat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.2, -0.01], [0.205, 0.08], [0.19, 0.17], [0.15, 0.21], [0.09, 0.2], [0.04, 0.185], [0, 0.19]]), own.hat, 0, 0, 0, { frame: F });
      T.add(lathe([[0.205, 0.012], [0.212, 0.018], [0.212, 0.055], [0.204, 0.06]], { n: 6 }), leather, 0, 0, 0, { frame: F });
    } else if (hat === 'bandana') {
      const F = hatFrame(0, 0, -0.08);
      T.add(tile(new THREE.SphereGeometry(0.273, 24, 10, 0, Math.PI * 2, 0, 1.18), 10, 3), own.hat, 0, 0, 0, { frame: F });
      T.add(tile(new THREE.SphereGeometry(0.271, 16, 6, Math.PI / 2 + 1.2, Math.PI * 2 - 2.4, 1.1, 0.75), 8, 2), own.hat, 0, 0, 0, { frame: F });
      T.add(ball(0.045, 10, 8), own.hat, 0, -0.03, -0.28, { frame: F });
      for (const sx of [-1, 1]) T.add(new THREE.ConeGeometry(0.05, 0.15, 6), own.hat, sx * 0.045, -0.1, -0.285, { frame: F, rz: sx * 0.45, sz: 0.35 }); // its ends
    } else if (hat === 'flowers') {
      const F = hatFrame(0.1, -0.02, -0.3);
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

  // A shoe at the bottom of a leg (the leg's pivot is HIP_Y over the ground)
  function buildShoe(P, shoes) {
    const ground = -HIP_Y;
    if (shoes === 'wellies') {
      P.add(limb(0.1, 0.096, 0.3), own.shoe, 0, ground + 0.36);
      P.add(ring(0.1, 0.014, 6, 20), own.shoe, 0, ground + 0.355);
    } else if (shoes === 'sneakers') {
      P.add(limb(0.072, 0.072, 0.1), whiteMat, 0, ground + 0.16); // a sock
    } else {
      P.add(limb(0.092, 0.09, 0.15), own.shoe, 0, ground + 0.19); // the boot's shaft
    }
    P.add(new THREE.CapsuleGeometry(0.075, 0.14, 4, 10), own.shoe, 0, ground + 0.07, 0.05, { rx: Math.PI / 2, sy: 1, sz: 0.85 });
    const soleMaterial = shoes === 'sneakers' ? whiteMat : soleMat;
    P.add(new THREE.CapsuleGeometry(0.082, 0.15, 4, 10), soleMaterial, 0, ground + 0.022, 0.05, { rx: Math.PI / 2, sz: 0.3 });
    if (shoes === 'sneakers') P.add(ball(0.06, 10, 8), whiteMat, 0, ground + 0.055, 0.15, { sx: 1.15, sy: 0.7 }); // the toe cap
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
    if (hullOn !== outlined()) outlined() ? makeHull() : dropHull(); // (the tier changed)

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
      const shapes = ['hat', 'hair', 'face', 'whiskers', 'top', 'bottoms', 'apron', 'shoes', 'neck'];
      if (shapes.some((part) => worn[part] !== was[part])) build();
    },
    // drop the per-farmer GPU resources (the shared materials and cloth stay)
    dispose() {
      dropHull();
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
