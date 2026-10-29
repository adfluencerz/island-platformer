import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { detail, detailBaked, bakeDetail } from './gfx/detail.js';

// ---------- What the neighbours' homes are built from ----------
// The pieces src/npchomes.js, src/npcyards.js and src/nporooms.js share: the
// shapes and materials, `part` (a shape placed in a group), `bake` (a home's
// still parts as a few meshes, not hundreds), `makeStory` (parts that appear
// as you do things for a neighbour), and the small things a home is full of
// (jars, pictures, clocks, plants, bunting...).
//
// Positions are [x, y, z] and sizes [w, h, d] in the group they go in. Facing
// the camera is +z. A wall's decorations are built in `onWall`'s frame: x along
// the wall, y up, z out of the wall into the room.

export const box = new THREE.BoxGeometry(1, 1, 1);
export const ball = new THREE.IcosahedronGeometry(1, 1);
export const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
export const cone = new THREE.ConeGeometry(1, 1, 8);

// A plain material is `bake`able (its color goes into the merged mesh); one
// with `extra` (see-through, shiny, lit up) stays a mesh of its own. `look`:
// its painted detail (src/gfx/detail.js), else one by its color
export const mat = (color, extra, look) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
  m.userData.bake = !extra;
  return detail(m, look);
};

// A triangular prism along x, `w` long, its triangle `d` wide at the base
// and `h` high, standing on y = 0: the end of a gable roof
export function prismGeo(w, h, d) {
  const [x0, x1, z0, z1] = [-w / 2, w / 2, -d / 2, d / 2];
  const v = [
    [x0, 0, z1], [x0, 0, z0], [x0, h, 0], // the end at x0
    [x1, 0, z0], [x1, 0, z1], [x1, h, 0], // the end at x1
    [x0, 0, z1], [x1, 0, z1], [x1, h, 0], [x0, 0, z1], [x1, h, 0], [x0, h, 0], // the front slope
    [x1, 0, z0], [x0, 0, z0], [x0, h, 0], [x1, 0, z0], [x0, h, 0], [x1, h, 0], // the back slope
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

export function part(parent, geo, material, [x, y, z], [sx, sy, sz] = [1, 1, 1], rot) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
// Something that moves on its own: `bake` leaves it be
export const live = (obj) => ((obj.userData.live = true), obj);
// A group that only places things (a bar, a flag, a chair): `bake` merges what is in it with its parent's
export const flat = (obj) => ((obj.userData.flat = true), obj);
// A group that `bake` shouldn't go into (a model that poses its own parts)
export const model = (obj) => ((obj.userData.noBake = true), obj);

// ---------- Baking ----------
// Every `bake`able mesh sitting straight in a group (not in one that moves
// itself, and not one with parts of its own) is merged with its siblings into
// one mesh, its color in the vertices: a home of two hundred pieces is a few
// meshes. `material`: the one they share (a home's outside and its rooms have
// one each, so the winter's snow, src/seasons.js, reaches the one and not the other).
export function bakedMaterial(inside = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  if (inside) m.userData.noSnow = true;
  return detailBaked(m); // (each part's look in its vertices: bakeDetail)
}
export function bake(group, material) {
  for (const child of group.children) if (child.children.length && !child.userData.noBake && !child.userData.live && !child.userData.flat) bake(child, material);
  // what can be merged: this group's meshes, and those of the `flat` groups in it
  // (a bar, a flag, a chair: groups that only place things), at their places
  const found = [];
  const gather = (node, matrix) => {
    for (const c of node.children) {
      c.updateMatrix();
      if (c.isMesh && !c.children.length && !Array.isArray(c.material) && c.material.userData.bake && !c.userData.live) found.push([c, matrix.clone().multiply(c.matrix)]);
      else if (c.isGroup && c.userData.flat && !c.userData.live && !c.userData.noBake) gather(c, matrix.clone().multiply(c.matrix));
    }
  };
  gather(group, new THREE.Matrix4());
  for (const shadow of [true, false]) {
    const parts = found.filter(([mesh]) => mesh.castShadow === shadow);
    if (parts.length < 2) continue;
    const geos = parts.map(([mesh, matrix]) => {
      const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(matrix);
      geo.deleteAttribute('uv');
      const { r, g, b } = mesh.material.color;
      const n = geo.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([r, g, b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return bakeDetail(geo, mesh.geometry, mesh.material, matrix);
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), material);
    merged.castShadow = shadow;
    merged.receiveShadow = true;
    for (const [mesh] of parts) mesh.parent.remove(mesh);
    group.add(merged);
  }
}

// ---------- What shows as you do things ----------
// Parts that are there once something has happened, in a home or its yard:
// `when(group, test)`: the group shows while test(c) holds, where c is how you
// stand with its neighbour: { done(mission), hearts, chose(key) }
// (src/npcs.js). They are hidden till told (`show`).
export function makeStory() {
  const items = [];
  return {
    when(group, test) {
      group.visible = false;
      items.push({ group, test });
      return group;
    },
    // a new group in `parent`, shown when test(c) holds
    group(parent, test, at = [0, 0, 0]) {
      const g = new THREE.Group();
      g.position.set(...at);
      parent.add(g);
      return this.when(g, test);
    },
    show(c) {
      for (const { group, test } of items) group.visible = !!test(c);
    },
  };
}

// ---------- Shared materials ----------
export const woodMat = mat(0xa0682f, undefined, 'wood');
export const darkWoodMat = mat(0x6e4a2b, undefined, 'wood');
export const stoneMat = mat(0x9c9a92, undefined, 'stone');
export const ironMat = mat(0x3a3a3a, { roughness: 0.5, metalness: 0.5 }, 'metal');
export const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
export const hayMat = mat(0xd9b24a, undefined, 'thatch');
export const soilMat = mat(0x5b3a1e);
export const leafMat = mat(0x4f9e3c);
// lit at night (setNight in src/npchomes.js): lanterns, and windows, pale by day
export const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffe7a3, emissive: 0xffb84a, emissiveIntensity: 0 });
export const windowMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0xffb84a, emissiveIntensity: 0, roughness: 0.3 });
export const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
export const darkMat = new THREE.MeshBasicMaterial({ color: 0x1b140e }); // (the dark round a room, and inside an oven)

// ---------- Words and pictures, drawn ----------
export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const FONT = '"Trebuchet MS", system-ui, sans-serif';
// the biggest `bold` size of FONT that fits `text` in `width`
function fitText(c, text, width, size) {
  do c.font = `bold ${size--}px ${FONT}`;
  while (c.measureText(text).width > width && size > 8);
}

// A board with words on it, as the merchant's stall has (src/merchant.js)
export function signTexture(text, { paper = '#f4dcae', ink = '#5b2b0a', edge = '#5b3a1e' } = {}) {
  return canvasTexture(256, 80, (c) => {
    c.fillStyle = paper;
    c.fillRect(0, 0, 256, 80);
    c.strokeStyle = edge;
    c.lineWidth = 8;
    c.strokeRect(4, 4, 248, 72);
    c.fillStyle = ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitText(c, text, 220, 40);
    c.fillText(text, 128, 42);
  });
}

// A board for a wall: lines of chalk (or ink) on `board`
export function boardTexture(lines, { board = '#2f3d34', ink = '#f4f0e0', edge = '#7a5a3a', w = 256, h = 192, size = 30 } = {}) {
  return canvasTexture(w, h, (c) => {
    c.fillStyle = board;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = edge;
    c.lineWidth = 10;
    c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    lines.forEach((line, i) => {
      fitText(c, line, w - 40, i === 0 ? size + 4 : size);
      c.fillText(line, w / 2, ((i + 1) * h) / (lines.length + 1));
    });
  });
}

// ---------- A flat thing facing out of a wall ----------
// A group at `at` on a wall: x along it, y up, z out into the room. side: 'back',
// 'left' or 'right' (the room's walls: the room's coordinates are in src/npchomes.js)
export function onWall(parent, side, [x, y, z]) {
  const g = flat(new THREE.Group());
  g.position.set(x, y, z);
  g.rotation.y = side === 'left' ? Math.PI / 2 : side === 'right' ? -Math.PI / 2 : 0;
  parent.add(g);
  return g;
}

// A picture in a frame (a texture, or a color), on a wall group
export function frame(wall, [x, y], w, h, art, wood = 0x6e4a2b) {
  const wd = mat(wood);
  part(wall, box, wd, [x, y, 0.03], [w + 0.14, h + 0.14, 0.06]);
  const inner = typeof art === 'number'
    ? mat(art)
    : new THREE.MeshStandardMaterial({ map: art, roughness: 0.9 });
  const pic = part(wall, box, inner, [x, y, 0.065], [w, h, 0.03]);
  pic.castShadow = false;
  return pic;
}

// A round clock on a wall group: { setHour(hour) } turns its hands
export function clock(wall, [x, y], r = 0.22, rim = 0x6e4a2b) {
  part(wall, cyl, mat(rim), [x, y, 0.04], [r + 0.04, 0.08, r + 0.04], [Math.PI / 2, 0, 0]);
  part(wall, cyl, mat(0xfff6e0), [x, y, 0.085], [r, 0.04, r], [Math.PI / 2, 0, 0]).castShadow = false;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    part(wall, box, mat(0x3d1a04), [x + Math.sin(a) * r * 0.8, y + Math.cos(a) * r * 0.8, 0.11], [0.02, i % 3 ? 0.03 : 0.05, 0.01], [0, 0, -a]).castShadow = false;
  }
  const hand = (len, wd) => {
    const pivot = live(new THREE.Group());
    pivot.position.set(x, y, 0.12);
    wall.add(pivot);
    part(pivot, box, mat(0x2a1204), [0, len / 2, 0], [wd, len, 0.012]).castShadow = false;
    return pivot;
  };
  const hours = hand(r * 0.5, 0.03);
  const minutes = hand(r * 0.75, 0.02);
  return {
    setHour(hour) {
      hours.rotation.z = -((hour % 12) / 12) * Math.PI * 2;
      minutes.rotation.z = -(hour % 1) * Math.PI * 2;
    },
  };
}

// Curtains either side of a window on a wall group: its middle [x, y], the
// window w wide, curtains hanging h
export function curtains(wall, [x, y], w, h, color, rod = 0x6e4a2b) {
  part(wall, cyl, mat(rod), [x, y + h / 2 + 0.05, 0.1], [0.025, w + 0.3, 0.025], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) part(wall, box, mat(color), [x + s * (w / 2 + 0.02 - i * 0.07), y, 0.1 + (i % 2) * 0.025], [0.07, h, 0.05]);
  }
}

// A bar from a to b (thick t), in `parent`: a rope, a string, a pole
export function beam(parent, a, b, t, material = mat(0x6e5a42)) {
  const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(dx, dy, dz);
  const g = flat(new THREE.Group());
  g.position.set(...a);
  g.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
  parent.add(g);
  part(g, box, material, [0, 0, len / 2], [t, t, len]);
  return g;
}

// ---------- Small things ----------
export function jar(parent, [x, y, z], color, { r = 0.1, h = 0.2, lid = 0x8a6a3a } = {}) {
  part(parent, cyl, mat(color), [x, y + h / 2, z], [r, h, r]);
  part(parent, cyl, mat(lid), [x, y + h + 0.025, z], [r * 0.9, 0.05, r * 0.9]);
}

// A row of books standing on a shelf at [x, y, z], n of them
export function books(parent, [x, y, z], n, palette = [0xa8392f, 0x2f5a8a, 0x4f7a3a, 0xe2b860, 0x7a4a8a, 0xd8d0b8]) {
  let at = x;
  for (let i = 0; i < n; i++) {
    const w = 0.05 + ((i * 7) % 4) * 0.012;
    const h = 0.22 + ((i * 5) % 4) * 0.04;
    part(parent, box, mat(palette[i % palette.length]), [at + w / 2, y + h / 2, z], [w, h, 0.18]);
    at += w + 0.005;
  }
  return at;
}

// A pot of something growing: pot, soil, leaves and (bloom) flowers
export function plant(parent, [x, y, z], s = 1, { pot = 0xb5553a, leaf = 0x4f9e3c, bloom = null } = {}) {
  part(parent, cyl, mat(pot), [x, y + 0.13 * s, z], [0.13 * s, 0.26 * s, 0.13 * s]);
  part(parent, ball, mat(leaf), [x, y + 0.4 * s, z], [0.2 * s, 0.17 * s, 0.2 * s]);
  part(parent, ball, mat(leaf), [x + 0.07 * s, y + 0.5 * s, z - 0.03 * s], [0.14 * s, 0.14 * s, 0.14 * s]);
  if (bloom != null) for (const [dx, dy, dz] of [[0.1, 0.52, 0.06], [-0.08, 0.5, 0.08], [0.0, 0.62, -0.06]]) part(parent, ball, mat(bloom), [x + dx * s, y + dy * s, z + dz * s], [0.045 * s, 0.045 * s, 0.045 * s]);
}

// A cup (and, with `saucer`, its saucer) on something at [x, y, z]
export function mug(parent, [x, y, z], color = 0xf4efe4, saucer = true) {
  if (saucer) part(parent, cyl, mat(0xf4efe4), [x, y + 0.01, z], [0.11, 0.02, 0.11]);
  part(parent, cyl, mat(color), [x, y + 0.07, z], [0.06, 0.1, 0.06]);
  part(parent, box, mat(color), [x + 0.07, y + 0.07, z], [0.025, 0.06, 0.02]);
}

// A plate at [x, y, z] with something on it
export function plate(parent, [x, y, z], food = 0xc8843a, r = 0.14) {
  part(parent, cyl, mat(0xf4efe4), [x, y + 0.012, z], [r, 0.024, r]);
  if (food != null) part(parent, ball, mat(food), [x, y + 0.05, z], [r * 0.55, r * 0.35, r * 0.55]);
}

// A candle in a holder: [x, y, z], and the little flame that is the lantern's
export function candle(parent, [x, y, z]) {
  part(parent, cyl, mat(0x8a6a3a), [x, y + 0.02, z], [0.07, 0.04, 0.07]);
  part(parent, cyl, mat(0xf4efe4), [x, y + 0.12, z], [0.03, 0.16, 0.03]);
  const flame = part(parent, ball, lanternMat, [x, y + 0.24, z], [0.025, 0.04, 0.025]);
  flame.castShadow = false;
  return flame;
}

// Bunting from a to b, hanging in a curve, its flags the colors in turn
const flagGeo = prismGeo(0.02, 0.36, 0.24);
export function bunting(parent, a, b, colors, { sag = 0.35, n = 9 } = {}) {
  const at = (k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * sag, a[2] + (b[2] - a[2]) * k];
  const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const string = mat(0x6e5a42);
  for (let i = 0; i < 12; i++) beam(parent, at(i / 12), at((i + 1) / 12), 0.015, string);
  for (let i = 0; i < n; i++) {
    const g = flat(new THREE.Group());
    g.position.set(...at((i + 0.5) / n));
    g.rotation.y = yaw;
    parent.add(g);
    part(g, flagGeo, mat(colors[i % colors.length]), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI]); // (point down)
  }
}

// A sparkle of light for the night: a soft round glow at `at`, shown when
// the home's windows are lit (the home's `glows`)
let glowTexture = null;
export function glowSprite(parent, [x, y, z], size = 1.4, color = 0xffc870) {
  glowTexture ??= canvasTexture(64, 64, (c) => {
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  sprite.visible = false;
  parent.add(sprite);
  return sprite;
}

// ---------- A house ----------
// Walls w by d, wallH high; a gable roof, its ridge along x (across the
// front) or z (its gable to the front), rise high; a door in the middle of
// the front and a window either side. `base`: a band of another color round
// its foot. Solid all round.
export function house(g, home, { wallH = 2.4, rise = 1.6, ridge = 'x', wall, trim, roof, door, base = null, thick = 0.14, overhang = 0.35 }, addCollider) {
  const { w, d } = home;
  // (painted: pale walls plaster, darker ones boards; a straw-colored roof thatch, else tiles)
  const hsl = new THREE.Color(wall).getHSL({}, THREE.SRGBColorSpace);
  const roofHsl = new THREE.Color(roof).getHSL({}, THREE.SRGBColorSpace);
  const wallMat = mat(wall, undefined, hsl.l > 0.7 ? 'plaster' : 'plank');
  const trimMat = mat(trim, undefined, 'wood');
  const roofMat = mat(roof, undefined, roofHsl.h > 0.08 && roofHsl.h < 0.17 && roofHsl.s > 0.3 && roofHsl.l > 0.45 ? 'thatch' : 'tile');
  part(g, box, wallMat, [0, wallH / 2, 0], [w, wallH, d]);
  if (base) part(g, box, mat(base, undefined, 'stone'), [0, 0.3, 0], [w + 0.06, 0.6, d + 0.06]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, box, trimMat, [sx * (w / 2), wallH / 2, sz * (d / 2)], [0.16, wallH, 0.16]);
  part(g, box, trimMat, [0, wallH - 0.06, d / 2 + 0.02], [w + 0.1, 0.14, 0.06]);
  // the roof: the gable ends in the walls' color, the two slopes over them
  const roofG = new THREE.Group();
  roofG.position.y = wallH;
  if (ridge === 'z') roofG.rotation.y = Math.PI / 2;
  g.add(roofG);
  const [len, span] = ridge === 'z' ? [d, w] : [w, d];
  part(roofG, prismGeo(len, rise, span), wallMat, [0, 0, 0]);
  const slope = Math.atan2(rise, span / 2);
  const run = (span / 2 + overhang) / Math.cos(slope);
  for (const s of [-1, 1]) {
    part(roofG, box, roofMat, [0, rise - Math.sin(slope) * run / 2 + thick / 2, s * Math.cos(slope) * run / 2], [len + overhang * 2, thick, run], [s * slope, 0, 0]);
  }
  part(roofG, box, roofMat, [0, rise + thick * 0.6, 0], [len + overhang * 2 + 0.04, thick * 1.2, thick * 2.2]); // the ridge
  // the door, and a window either side of it
  const front = d / 2 + 0.03;
  part(g, box, trimMat, [0, 1.0, front], [1.2, 2.0, 0.06]);
  part(g, box, mat(door, undefined, 'plank'), [0, 0.95, front + 0.03], [0.96, 1.86, 0.06]);
  part(g, ball, ironMat, [0.32, 0.95, front + 0.08], [0.05, 0.05, 0.05]);
  part(g, box, stoneMat, [0, 0.06, front + 0.45], [1.4, 0.12, 0.7]); // a step
  const winX = Math.min(w / 2 - 0.9, 1.7);
  for (const sx of [-1, 1]) addWindow(g, sx * winX, 1.45, front, trimMat);
  addCollider({ x: home.x, y: (wallH + rise) / 2, z: home.z, w: w + 0.2, h: wallH + rise, d: d + 0.2 });
  return { wallMat, trimMat, roofMat, roofTop: wallH + rise, wallH, front };
}

export function addWindow(parent, x, y, z, trimMat, w = 0.9, h = 0.8) {
  part(parent, box, trimMat, [x, y, z], [w + 0.14, h + 0.14, 0.06]);
  part(parent, box, windowMat, [x, y, z + 0.03], [w, h, 0.04]).castShadow = false;
  part(parent, box, trimMat, [x, y, z + 0.06], [0.06, h, 0.03]);
  part(parent, box, trimMat, [x, y, z + 0.06], [w, 0.06, 0.03]);
}

// A sign on two posts, with the home's name on it, beside the road
export function roadSign(g, text, x, z, colors) {
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture(text, colors), roughness: 0.9 });
  for (const sx of [-0.7, 0.7]) part(g, box, darkWoodMat, [x + sx, 0.75, z], [0.1, 1.5, 0.1]);
  const board = part(g, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, signMat, darkWoodMat], [x, 1.35, z + 0.06], [1.7, 0.53, 0.06], [-0.25, 0, 0]);
  board.castShadow = false;
}

// A run of fence from (x0, z0) to (x1, z1) (local to g, at home.x, home.z): posts and two rails, solid
export function fence(g, home, addCollider, x0, z0, x1, z1, material = woodMat) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    part(g, box, material, [x0 + (x1 - x0) * k, 0.45, z0 + (z1 - z0) * k], [0.12, 0.9, 0.12]);
  }
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  for (const y of [0.35, 0.7]) part(g, box, material, [cx, y, cz], along ? [len, 0.08, 0.06] : [0.06, 0.08, len]);
  addCollider({ x: home.x + cx, y: 0.5, z: home.z + cz, w: along ? len : 0.2, h: 1, d: along ? 0.2 : len });
}

// Smoke curling up from [x, y, z] (in `parent`): puffs that grow and fade as
// they rise, drifting a little in the wind; `anims` moves them by time
export function smoke(parent, [x, y, z], anims, { rise = 2.2, puffs = 5 } = {}) {
  const base = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 });
  const list = Array.from({ length: puffs }, (_, i) => {
    const p = part(parent, ball, base.clone(), [x, y, z], [0.2, 0.2, 0.2]);
    p.castShadow = false;
    return { p, k: i / puffs };
  });
  anims.push((t) => {
    for (const { p, k } of list) {
      const a = (t * 0.25 + k) % 1;
      p.position.set(x + Math.sin(t + k * 6) * 0.15 + a * 0.4, y + a * rise, z - a * 0.2);
      p.scale.setScalar(0.18 + a * 0.4);
      p.material.opacity = 0.55 * (1 - a);
    }
  });
}

// A prize rosette on a flat thing (a wall group, a door): [x, y], its ribbons hanging
export function rosette(parent, [x, y], color, r = 0.09, tail = 0.26) {
  for (const dx of [-0.04, 0.04]) part(parent, box, mat(color), [x + dx, y - r - tail / 2 + 0.03, 0.075], [0.06, tail, 0.012], [0, 0, dx * 5]).castShadow = false;
  part(parent, cyl, mat(color), [x, y, 0.08], [r, 0.03, r], [Math.PI / 2, 0, 0]);
  part(parent, cyl, mat(0xfff6e0), [x, y, 0.1], [r * 0.45, 0.03, r * 0.45], [Math.PI / 2, 0, 0]);
}
