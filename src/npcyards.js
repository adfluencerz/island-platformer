import * as THREE from 'three';
import { NPCS } from '../shared/npcs.js';
import { animalModel } from './animals.js';
import { box, ball, cyl, cone, mat, part, live, flat, model, beam, prismGeo, house, roadSign, fence, signTexture, boardTexture, canvasTexture, bunting, smoke, rosette, glowSprite, woodMat, darkWoodMat, stoneMat, ironMat, glassMat, hayMat, soilMat, leafMat, lanternMat } from './homekit.js';

// ---------- The neighbours' homes, from outside ----------
// Each neighbour (shared/npcs.js) lives in a home of their own out in the
// farm's valley (NPC_HOMES in shared/farmland.js), drawn here as one of the
// farm's set pieces (src/maps.js): Rosa's red ranch house with its porch,
// paddock and coop; Basil's whitewashed cottage with its greenhouse, arbor
// and vegetable beds; Finn's fishing hut on the dunes with his lighthouse and
// his dock out over the sea; Mabel's timbered bakery with its terrace and
// oven; and Bram's joinery, by the wood, with its lean-to of planks. Each
// faces south, a sign by the road, its door in the middle of its front.
// Each takes the group `g` it is drawn in (at the home's middle), the
// home (shared/farmland.js), and what src/npchomes.js gives them: { addCollider,
// anims (what moves, by time), story (what shows as you do things for them, or
// they like you more: src/homekit.js), glows (what lights up at night) }.

// ---------- Things most of them have ----------
// A pole from the ground, h high
const pole = (g, [x, z], h, material = darkWoodMat, w = 0.1) => part(g, box, material, [x, h / 2, z], [w, h, w]);
// A lantern hanging at [x, y, z], and its glow for the night
function lantern(g, glows, [x, y, z], size = 2) {
  part(g, box, lanternMat, [x, y, z], [0.2, 0.26, 0.2]).castShadow = false;
  part(g, cone, ironMat, [x, y + 0.2, z], [0.16, 0.1, 0.16]);
  glows.push(glowSprite(g, [x, y, z + 0.15], size));
}
// A chair at [x, z] facing yaw
function chair(g, [x, z], yaw, color = 0xa0682f) {
  const c = flat(new THREE.Group());
  c.position.set(x, 0, z);
  c.rotation.y = yaw;
  g.add(c);
  const wood = mat(color);
  part(c, box, wood, [0, 0.42, 0], [0.42, 0.06, 0.42]);
  part(c, box, wood, [0, 0.75, -0.2], [0.42, 0.62, 0.05]);
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) part(c, box, wood, [dx, 0.2, dz], [0.05, 0.4, 0.05]);
}
// A round café table at [x, z], r across
function roundTable(g, [x, z], r = 0.5, color = 0xf4efe4) {
  part(g, cyl, mat(color), [x, 0.78, z], [r, 0.05, r]);
  part(g, cyl, darkWoodMat, [x, 0.39, z], [0.06, 0.78, 0.06]);
  part(g, cyl, darkWoodMat, [x, 0.02, z], [r * 0.5, 0.04, r * 0.5]);
}
// A big striped parasol over [x, z], h up: a canopy of wedges in turn colors
function parasol(g, [x, z], h, colors) {
  part(g, cyl, darkWoodMat, [x, h / 2, z], [0.03, h, 0.03]);
  const r = 1.0;
  const rise = 0.4;
  const pos = [];
  const col = [];
  for (let i = 0; i < 8; i++) {
    const [a0, a1] = [(i * Math.PI) / 4, ((i + 1) * Math.PI) / 4];
    pos.push(0, rise, 0, Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r);
    const c = new THREE.Color(colors[i % colors.length]);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, flatShading: true }));
  canopy.position.set(x, h, z);
  canopy.castShadow = true;
  g.add(canopy);
}
// A crate with something in it, at [x, z]
function crate(g, [x, z], color, shape = ball) {
  part(g, box, woodMat, [x, 0.18, z], [0.8, 0.36, 0.55]);
  for (const [dx, dz] of [[-0.22, -0.1], [0.0, 0.12], [0.22, -0.08], [-0.1, 0.1], [0.25, 0.14]]) {
    part(g, shape, mat(color), [x + dx, shape === cone ? 0.45 : 0.4, z + dz], shape === cone ? [0.07, 0.2, 0.07] : [0.12, 0.1, 0.12], shape === cone ? [Math.PI, 0, 0] : undefined);
  }
}
// A flower bed at [x, z], w long, its blooms the colors in turn
function flowerBed(g, [x, z], w, colors) {
  part(g, box, darkWoodMat, [x, 0.13, z], [w, 0.26, 0.5]);
  part(g, box, soilMat, [x, 0.27, z], [w - 0.1, 0.03, 0.4]);
  const n = Math.round(w / 0.28);
  for (let i = 0; i < n; i++) {
    part(g, ball, leafMat, [x - w / 2 + 0.2 + i * ((w - 0.4) / Math.max(1, n - 1)), 0.34, z], [0.1, 0.08, 0.1]);
    part(g, ball, mat(colors[i % colors.length]), [x - w / 2 + 0.2 + i * ((w - 0.4) / Math.max(1, n - 1)), 0.44, z + (i % 2 ? 0.04 : -0.04)], [0.07, 0.07, 0.07]);
  }
}
// A barrel at [x, z]
const barrel = (g, [x, z], r = 0.35, h = 0.9) => {
  part(g, cyl, woodMat, [x, h / 2, z], [r, h, r]);
  for (const y of [0.2, h - 0.2]) part(g, cyl, mat(0x4a3a2a), [x, y, z], [r * 1.03, 0.05, r * 1.03]);
};
// A little bird on a post at [x, y, z], bobbing (anims)
function bird(g, anims, [x, y, z], color = 0xf4f4f0, phase = 0) {
  const b = live(new THREE.Group());
  b.position.set(x, y, z);
  g.add(b);
  part(b, ball, mat(color), [0, 0.1, 0], [0.09, 0.08, 0.14]);
  part(b, ball, mat(color), [0, 0.2, 0.09], [0.06, 0.06, 0.06]);
  part(b, cone, mat(0xf2a516), [0, 0.2, 0.17], [0.025, 0.06, 0.025], [Math.PI / 2, 0, 0]);
  part(b, cone, mat(0x7a7a7a), [0, 0.1, -0.14], [0.05, 0.14, 0.03], [-Math.PI / 2 + 0.3, 0, 0]);
  anims.push((t) => {
    b.rotation.y = Math.sin(t * 0.4 + phase) * 1.2;
    b.position.y = y + Math.max(0, Math.sin(t * 2.4 + phase * 3)) * 0.015;
  });
}

// A pose for a standing animal in a paddock: it grazes a while, looks about
function graze(a, anims, seedX, seedZ, kind) {
  const state = { state: 'graze', graze: 0, step: 0, walkPhase: 0, walkAmount: 0, look: 0, flap: 0, growth: 1, seed: seedX };
  anims.push((t) => {
    state.graze = Math.max(0, Math.sin(t * 0.5 + seedX)) * (kind === 'hen' ? (t * 0.7 + seedX) % 1 : 1);
    state.look = Math.sin(t * 0.3 + seedZ) * 0.4;
    a.pose(state, t);
  });
}

// ---------- Rosa ----------
// A red ranch house, its gable to the front with a hayloft door in it, a
// porch, a chimney with smoke and a weathervane, and a paddock beside it with a
// cow, sheep and hens grazing; a coop, a well, laundry on the line
function rosaHome(g, home, { addCollider, anims, glows, story }) {
  const { trimMat } = house(g, home, { ridge: 'z', wall: 0xa8392f, trim: 0xf2efe6, roof: 0x4a3b36, door: 0x7a2a1a, rise: 1.8 }, addCollider);
  const front = home.d / 2 + 0.03;
  // the hayloft door up in the gable, crossed with white
  const z = home.d / 2 + 0.05;
  part(g, box, mat(0x7a2a1a), [0, 3.1, z], [0.8, 0.7, 0.04]);
  for (const r of [0.72, -0.72]) part(g, box, trimMat, [0, 3.1, z + 0.03], [0.06, 1.0, 0.03], [0, 0, r]);
  // a brick chimney on the roof, and its smoke
  part(g, box, mat(0x8a3a2a), [2.1, 3.9, -0.8], [0.7, 1.7, 0.7]);
  part(g, box, mat(0x5a2a1a), [2.1, 4.8, -0.8], [0.85, 0.12, 0.85]);
  smoke(g, [2.1, 4.95, -0.8], anims, { rise: 2.4 });
  // the weathervane at the ridge: a rooster that turns with the wind
  part(g, cyl, ironMat, [0, 4.85, 1.4], [0.02, 1.1, 0.02]);
  const vane = live(new THREE.Group());
  vane.position.set(0, 5.45, 1.4);
  g.add(vane);
  part(vane, box, ironMat, [0, 0, 0], [0.9, 0.03, 0.03]);
  part(vane, cone, ironMat, [0.5, 0, 0], [0.07, 0.16, 0.07], [0, 0, -Math.PI / 2]);
  part(vane, box, ironMat, [-0.5, 0, 0], [0.04, 0.24, 0.02]);
  part(vane, box, ironMat, [0.05, 0.14, 0], [0.26, 0.2, 0.02]);
  part(vane, box, ironMat, [0.2, 0.28, 0], [0.1, 0.1, 0.02]);
  part(vane, box, mat(0xc0392b), [0.22, 0.36, 0], [0.04, 0.06, 0.02]);
  anims.push((t) => (vane.rotation.y = 0.9 + Math.sin(t * 0.5) * 0.6 + Math.sin(t * 1.7) * 0.1));
  // the porch: a deck, two posts, a roof sloping down off the wall, lanterns, a churn
  part(g, box, woodMat, [0, 0.03, front + 0.85], [2.6, 0.06, 1.5]);
  for (const sx of [-1.2, 1.2]) pole(g, [sx, front + 1.5], 2.25, mat(0xf2efe6), 0.14);
  part(g, box, mat(0x4a3b36), [0, 2.38, front + 0.82], [3.0, 0.1, 1.8], [0.12, 0, 0]);
  part(g, box, mat(0xf2efe6), [0, 2.17, front + 1.48], [2.6, 0.14, 0.08]);
  for (const sx of [-0.9, 0.9]) lantern(g, glows, [sx, 1.85, front + 1.25]);
  part(g, cyl, mat(0xa6adb4), [1.0, 0.4, front + 0.55], [0.17, 0.8, 0.17]);
  part(g, cyl, mat(0x8a9198), [1.0, 0.84, front + 0.55], [0.12, 0.1, 0.12]);
  // flower beds under the windows
  for (const sx of [-1, 1]) flowerBed(g, [sx * 2.5, front + 0.45], 1.6, [0xe0362c, 0xf2c230, 0xff7eb6, 0xffffff]);
  // a rain barrel at the corner, and what the washing is
  barrel(g, [3.05, -1.9], 0.34, 0.8);
  part(g, box, mat(0xd8d8d0), [3.52, 1.2, -1.9], [0.06, 2.4, 0.06]);
  pole(g, [5.0, -4.0], 1.9); // (two poles, a line, and the laundry)
  pole(g, [5.0, -0.6], 1.9);
  beam(g, [5.0, 1.8, -4.0], [5.0, 1.75, -0.6], 0.02, mat(0xd8c8a0));
  const laundry = [0xf4efe4, 0x2f5a8a, 0xe88aa8, 0xf4efe4, 0xf2c230].map((color, i) => live(part(g, box, mat(color), [5.0, 1.42, -3.7 + i * 0.7], [0.03, 0.62, 0.45])));
  anims.push((t) => laundry.forEach((c, i) => (c.rotation.x = Math.sin(t * 1.6 + i) * 0.12)));
  // the paddock, west of the house
  const [x0, x1, z0, z1] = [-8.6, -4.6, -2.6, 3.4];
  fence(g, home, addCollider, x0, z0, x1, z0);
  fence(g, home, addCollider, x0, z1, x1, z1);
  fence(g, home, addCollider, x0, z0, x0, z1);
  fence(g, home, addCollider, x1, z0, x1, z1);
  part(g, cyl, hayMat, [x1 - 0.6, 0.3, z0 + 0.6], [0.45, 0.6, 0.45], [Math.PI / 2, 0, 0]);
  part(g, box, woodMat, [x0 + 0.5, 0.25, z1 - 0.9], [0.6, 0.4, 1.4]); // a trough
  part(g, box, mat(0x6fb6d8, { roughness: 0.2 }), [x0 + 0.5, 0.43, z1 - 0.9], [0.5, 0.04, 1.3]).castShadow = false;
  const herd = [['cow', 0, -6.6, 1.2, 0.6], ['sheep', 0, -5.6, -1.2, -0.8], ['sheep', 1, -7.6, -0.6, 2.2], ['hen', 1, -5.4, 2.4, 3], ['hen', 2, -6.2, 2.7, -2]];
  for (const [kind, color, x, zz, yaw] of herd) {
    const a = animalModel(kind, color);
    a.root.position.set(x, 0, zz);
    a.root.rotation.y = yaw;
    g.add(model(a.root));
    graze(a, anims, x, zz, kind);
  }
  // the calf she has named, with its name on the fence
  const calf = story.group(g, (c) => !!c.chose('rosa_calf'));
  const little = animalModel('cow', 1);
  little.root.scale.setScalar(0.6);
  little.root.position.set(-7.5, 0, -1.9);
  little.root.rotation.y = 0.9;
  calf.add(model(little.root));
  graze(little, anims, -7.5, -1.9, 'cow');
  for (const [key, name] of [['buttercup', 'Buttercup'], ['clementine', 'Little Clementine'], ['beefcake', 'Beefcake']]) {
    const plaque = story.group(g, (c) => c.chose('rosa_calf') === key);
    part(plaque, box, new THREE.MeshStandardMaterial({ map: signTexture(name, { paper: '#f4dcae', ink: '#7a2a1a' }), roughness: 0.9 }), [-6.6, 0.72, z1 + 0.06], [0.95, 0.3, 0.04]);
  }
  // a coop to the west of the paddock, with its hens out
  const cx = -10.9;
  const cz = 0.6;
  part(g, box, mat(0xb8392f), [cx, 0.75, cz], [1.6, 1.0, 1.2]);
  part(g, prismGeo(1.8, 0.6, 1.4), mat(0x4a3b36), [cx, 1.25, cz]);
  part(g, box, darkWoodMat, [cx + 0.3, 0.9, cz + 0.61], [0.4, 0.5, 0.03]);
  part(g, box, woodMat, [cx + 0.3, 0.3, cz + 1.0], [0.4, 0.04, 0.8], [0.35, 0, 0]);
  for (const dx of [-0.5, 0.0]) part(g, box, mat(0xf4efe4), [cx + dx - 0.25, 0.75, cz + 0.61], [0.2, 0.2, 0.03]);
  addCollider({ x: home.x + cx, y: 0.6, z: home.z + cz, w: 1.7, h: 1.2, d: 1.3 });
  for (const [kind, color, x, zz, yaw] of [['hen', 0, cx + 1.5, cz + 1.3, 1.2], ['hen', 3, cx - 0.6, cz + 1.6, -0.5]]) {
    const a = animalModel(kind, color);
    a.root.position.set(x, 0, zz);
    a.root.rotation.y = yaw;
    g.add(model(a.root));
    graze(a, anims, x, zz, kind);
  }
  // a well, and a wheelbarrow of hay, east of the house
  const well = [6.4, 1.4];
  part(g, cyl, stoneMat, [well[0], 0.35, well[1]], [0.65, 0.7, 0.65]);
  part(g, cyl, mat(0x3a5a6a), [well[0], 0.62, well[1]], [0.5, 0.06, 0.5]).castShadow = false;
  for (const dz of [-0.6, 0.6]) pole(g, [well[0], well[1] + dz], 1.7);
  part(g, prismGeo(1.0, 0.5, 1.7), mat(0x4a3b36), [well[0], 1.7, well[1]], [1, 1, 1], [0, Math.PI / 2, 0]);
  part(g, cyl, woodMat, [well[0], 1.35, well[1]], [0.05, 1.3, 0.05], [0, 0, Math.PI / 2]);
  part(g, box, woodMat, [well[0], 1.0, well[1]], [0.02, 0.6, 0.02]);
  part(g, cyl, woodMat, [well[0], 0.72, well[1]], [0.1, 0.15, 0.1]);
  addCollider({ x: home.x + well[0], y: 0.5, z: home.z + well[1], w: 1.4, h: 1, d: 1.4 });
  part(g, box, woodMat, [4.6, 0.38, 1.6], [0.7, 0.05, 0.5]);
  part(g, box, hayMat, [4.6, 0.55, 1.6], [0.6, 0.3, 0.4]);
  part(g, cyl, darkWoodMat, [4.4, 0.2, 1.6], [0.2, 0.06, 0.2], [0, 0, Math.PI / 2]);
  // hay bales stacked by the house
  for (const [x, y, zz] of [[3.4, 0.3, 2.6], [4.2, 0.3, 2.6], [3.8, 0.9, 2.6]]) part(g, box, hayMat, [x, y, zz], [0.75, 0.6, 0.5]);
  addCollider({ x: home.x + 3.8, y: 0.6, z: home.z + 2.6, w: 1.6, h: 1.2, d: 0.6 });
  // a rosette on her door: first prize for the cheese
  const prize = story.group(g, (c) => c.done('rosa_fair'), [0, 1.62, front + 0.07]);
  rosette(prize, [0, 0], 0xf2c230, 0.14, 0.34);
  // the sign by the road, and a mailbox
  roadSign(g, NPCS.rosa.title, 2.6, 5.2, { paper: '#fbe6c8', ink: '#7a2a1a' });
  pole(g, [4.5, 5.4], 1.0, darkWoodMat, 0.08);
  part(g, box, mat(0xd8452f), [4.5, 1.08, 5.4], [0.34, 0.24, 0.5]);
  part(g, box, mat(0xf2c230), [4.7, 1.25, 5.3], [0.03, 0.2, 0.03]);
}

// ---------- Basil ----------
// A whitewashed cottage on a stone footing, thatched, with flower boxes
// under its windows, a greenhouse to the east, an arbor over the door and
// vegetable beds to the west; a beehive, a gnome, a row of sunflowers
function basilHome(g, home, { addCollider, anims, glows, story }) {
  house(g, home, { wall: 0xeee6d6, trim: 0x8a6a4a, roof: 0xc9a45a, door: 0x3f6b3a, base: 0x9c9a92, rise: 1.7, thick: 0.32, overhang: 0.45 }, addCollider);
  const z = home.d / 2 + 0.18;
  const flowers = [0xe0362c, 0xf2c230, 0xff7eb6, 0xffffff];
  for (const sx of [-1, 1]) {
    part(g, box, darkWoodMat, [sx * 1.7, 0.92, z], [1, 0.2, 0.25]);
    for (let i = 0; i < 5; i++) part(g, ball, mat(flowers[(i + (sx > 0 ? 2 : 0)) % 4]), [sx * 1.7 - 0.4 + i * 0.2, 1.08, z], [0.08, 0.08, 0.08]);
  }
  // the greenhouse: a frame of white bars round glass, plants inside
  const gx = 6;
  const gz = -0.3;
  const [gw, gd, gh] = [3, 3.4, 2.2];
  const frameMat = mat(0xf4f4f0);
  part(g, box, glassMat, [gx, gh / 2, gz], [gw, gh, gd]).castShadow = false;
  part(g, prismGeo(gd, 0.9, gw), glassMat, [gx, gh, gz], [1, 1, 1], [0, Math.PI / 2, 0]).castShadow = false;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, box, frameMat, [gx + sx * gw / 2, gh / 2, gz + sz * gd / 2], [0.08, gh, 0.08]);
  for (const sz of [-1, 0, 1]) part(g, box, frameMat, [gx, gh, gz + sz * gd / 2], [gw, 0.08, 0.08]);
  part(g, box, frameMat, [gx, gh + 0.9, gz], [0.08, 0.08, gd]);
  for (let i = 0; i < 6; i++) {
    const px = gx - 0.9 + (i % 3) * 0.9;
    const pz = gz - 0.8 + Math.floor(i / 3) * 1.6;
    part(g, box, darkWoodMat, [px, 0.35, pz], [0.6, 0.7, 0.6]);
    part(g, ball, leafMat, [px, 0.9, pz], [0.32, 0.28, 0.32]);
    if (i % 2) part(g, ball, mat(0xe0362c), [px + 0.12, 0.98, pz + 0.12], [0.07, 0.07, 0.07]);
  }
  addCollider({ x: home.x + gx, y: 1.5, z: home.z + gz, w: gw + 0.1, h: 3, d: gd + 0.1 });
  // vegetable beds to the west, edged with planks: poles for beans, a gnome
  for (const bz of [1.2, 3.2]) {
    part(g, box, woodMat, [-5, 0.09, bz], [2.8, 0.18, 1.4]);
    part(g, box, soilMat, [-5, 0.19, bz], [2.6, 0.04, 1.2]);
    for (let i = 0; i < 4; i++) part(g, ball, leafMat, [-6 + i * 0.66, 0.32, bz], [0.2, 0.16, 0.2]);
  }
  for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) beam(g, [-4.2 + dx * 1.6, 0.2, 1.2 + dz * 1.4], [-4.2, 1.9, 1.2], 0.04, darkWoodMat); // (a teepee of bean poles)
  for (let i = 0; i < 6; i++) part(g, ball, mat(i % 2 ? 0x3f8a3c : 0x5aae48), [-4.2 + Math.sin(i * 1.5) * (0.35 - i * 0.04), 0.5 + i * 0.22, 1.2 + Math.cos(i * 1.5) * (0.35 - i * 0.04)], [0.12, 0.14, 0.12]);
  const gnome = [-3.75, 3.2];
  part(g, cyl, mat(0x2f5a8a), [gnome[0], 0.34, gnome[1]], [0.09, 0.28, 0.09]);
  part(g, ball, mat(0xffd7ae), [gnome[0], 0.56, gnome[1]], [0.07, 0.07, 0.07]);
  part(g, ball, mat(0xf4f4f0), [gnome[0], 0.5, gnome[1] + 0.05], [0.07, 0.08, 0.04]);
  part(g, cone, mat(0xd8362c), [gnome[0], 0.76, gnome[1]], [0.09, 0.3, 0.09]);
  // an arbor over the path to the door, with roses and beans climbing it
  const az = z + 1.55;
  for (const sx of [-0.85, 0.85]) {
    pole(g, [sx, az], 2.2, mat(0x8a6a4a), 0.1);
    for (let i = 0; i < 5; i++) part(g, ball, mat(i % 2 ? 0x3f8a3c : 0x5aae48), [sx + (i % 2 ? 0.05 : -0.05), 0.4 + i * 0.4, az], [0.14, 0.18, 0.14]);
  }
  part(g, box, mat(0x8a6a4a), [0, 2.25, az], [1.9, 0.1, 0.12]);
  for (let i = 0; i < 8; i++) part(g, ball, mat(i % 3 ? 0x3f8a3c : 0xe05a8a), [-0.8 + i * 0.23, 2.3 + (i % 2) * 0.05, az], [0.1, 0.09, 0.1]);
  lantern(g, glows, [0.0, 1.95, az + 0.1], 2.2);
  // the scarecrow he has in his bed, since the crows were seen off
  const crow = story.group(g, (c) => c.done('basil_crows'), [-5.6, 0.2, 1.2]);
  pole(crow, [0, 0], 1.5, mat(0x8a6a3a), 0.07);
  part(crow, box, mat(0x8a6a3a), [0, 1.1, 0], [1.0, 0.06, 0.06]);
  part(crow, box, mat(0xb8473c), [0, 0.95, 0], [0.5, 0.5, 0.2]);
  for (const sx of [-0.4, 0.4]) part(crow, cone, mat(0xe2b860), [sx, 1.05, 0], [0.06, 0.2, 0.06], [0, 0, sx > 0 ? -1.2 : 1.2]);
  part(crow, ball, mat(0xe8c890), [0, 1.45, 0], [0.16, 0.16, 0.16]);
  part(crow, cyl, mat(0xe2b860), [0, 1.58, 0], [0.3, 0.03, 0.3]);
  part(crow, cyl, mat(0xe2b860), [0, 1.66, 0], [0.16, 0.14, 0.16]);
  // a row of sunflowers between the house and the greenhouse, facing the sun
  for (let i = 0; i < 5; i++) {
    const sz = -2.1 + i * 0.95;
    part(g, box, mat(0x3f8a3c), [3.75, 1.0, sz], [0.05, 2.0, 0.05]);
    part(g, ball, mat(0x3f8a3c), [3.75, 0.8, sz + 0.12], [0.2, 0.05, 0.12]);
    part(g, cyl, mat(0xf2b630), [3.75, 2.05 + (i % 2) * 0.1, sz + 0.05], [0.22, 0.05, 0.22], [Math.PI / 2 - 0.25, 0, 0]);
    part(g, cyl, mat(0x6a3a14), [3.75, 2.06 + (i % 2) * 0.1, sz + 0.09], [0.1, 0.05, 0.1], [Math.PI / 2 - 0.25, 0, 0]);
  }
  // a hive, with its bees, and a compost bin, behind the beds
  const hive = [-4.2, -2.4];
  part(g, box, darkWoodMat, [hive[0], 0.3, hive[1]], [0.7, 0.12, 0.7]);
  for (let i = 0; i < 3; i++) part(g, box, mat(i % 2 ? 0xf2e2b0 : 0xf4c850), [hive[0], 0.52 + i * 0.26, hive[1]], [0.55, 0.24, 0.55]);
  part(g, box, mat(0x8a6a4a), [hive[0], 1.3, hive[1]], [0.68, 0.08, 0.68]);
  const bees = Array.from({ length: 4 }, (_, i) => part(g, ball, mat(0xf2c230), [hive[0], 0.7, hive[1]], [0.025, 0.02, 0.025]));
  bees.forEach(live);
  anims.push((t) => bees.forEach((b, i) => b.position.set(hive[0] + Math.sin(t * 2.2 + i * 1.7) * (0.5 + i * 0.12), 0.8 + Math.sin(t * 3.1 + i) * 0.2, hive[1] + Math.cos(t * 1.9 + i * 2.1) * (0.5 + i * 0.1))));
  addCollider({ x: home.x + hive[0], y: 0.6, z: home.z + hive[1], w: 0.8, h: 1.2, d: 0.8 });
  const bin = [3.2, -2.9];
  for (let i = 0; i < 5; i++) part(g, box, woodMat, [bin[0], 0.15 + i * 0.16, bin[1] + 0.3], [0.9, 0.12, 0.04]);
  for (const [dx, dz] of [[-0.45, 0.3], [0.45, 0.3], [-0.45, -0.3], [0.45, -0.3]]) part(g, box, darkWoodMat, [bin[0] + dx, 0.45, bin[1] + dz], [0.06, 0.9, 0.06]);
  part(g, box, mat(0x5a4632), [bin[0], 0.35, bin[1]], [0.8, 0.5, 0.55]);
  addCollider({ x: home.x + bin[0], y: 0.45, z: home.z + bin[1], w: 1.0, h: 0.9, d: 0.8 });
  // a bird bath, a wheelbarrow of seedlings, and a crate of what he grows, by the road
  part(g, cyl, stoneMat, [-1.7, 0.4, 6.6], [0.1, 0.8, 0.1]);
  part(g, cyl, stoneMat, [-1.7, 0.85, 6.6], [0.4, 0.1, 0.4]);
  part(g, cyl, mat(0x7fb3d5, { roughness: 0.2 }), [-1.7, 0.9, 6.6], [0.34, 0.03, 0.34]).castShadow = false;
  bird(g, anims, [-1.75, 0.92, 6.6], 0x4a7ab8, 0.5);
  part(g, box, woodMat, [1.9, 0.4, 3.6], [0.8, 0.06, 0.5]);
  for (const sx of [-0.4, 0.4]) part(g, box, woodMat, [1.9 + sx, 0.54, 3.6], [0.04, 0.28, 0.5]);
  part(g, box, soilMat, [1.9, 0.5, 3.6], [0.7, 0.1, 0.4]);
  for (let i = 0; i < 4; i++) part(g, ball, leafMat, [1.65 + i * 0.17, 0.62, 3.6], [0.06, 0.1, 0.06]);
  part(g, cyl, darkWoodMat, [1.5, 0.2, 3.6], [0.2, 0.06, 0.2], [0, 0, Math.PI / 2]);
  const harvest = story.group(g, (c) => c.done('basil_harvest'));
  crate(harvest, [2.6, 3.9], 0xff8c1a, cone);
  crate(harvest, [3.5, 3.9], 0xe8e0f0);
  // bluebells at the foot of the wall, from the glade, once you have picked him some
  const bells = story.group(g, (c) => c.done('basil_bluebells'), [0, 0, z + 0.15]);
  for (let i = 0; i < 7; i++) {
    part(bells, box, mat(0x3f8a3c), [-2.6 + i * 0.27, 0.2, 0], [0.015, 0.4, 0.015]);
    part(bells, ball, mat(0x5a78e0), [-2.6 + i * 0.27, 0.42, 0], [0.04, 0.06, 0.04]);
  }
  roadSign(g, NPCS.basil.title, -2.8, 5.2, { paper: '#e8f2d8', ink: '#2f5a2a' });
}

// ---------- Finn ----------
// A weathered blue fishing hut, its gable to the sea, a life ring on the wall,
// barrels and crates, an upturned boat on the sand, a drying rack, his
// lighthouse on the dunes, and his dock; a boat tied up at it when it is fit to float
function finnHome(g, home, { addCollider, anims, glows, story }) {
  house(g, home, { ridge: 'z', wall: 0x5f7f9a, trim: 0xe8e0d0, roof: 0x2f4f5a, door: 0x3a4a5a, rise: 1.4, wallH: 2.3 }, addCollider);
  const front = home.d / 2 + 0.03;
  // planks down the walls
  const plankMat = mat(0x4f6f8a);
  for (const x of [-2.6, -0.9, 0.9, 2.6]) part(g, box, plankMat, [x, 1.15, home.d / 2 + 0.005], [0.04, 2.2, 0.01]);
  // a life ring by the door
  const ring = part(g, new THREE.TorusGeometry(0.28, 0.08, 6, 16), mat(0xe8e8e0), [-1.75, 1.45, home.d / 2 + 0.1]);
  for (let i = 0; i < 4; i++) part(ring, box, mat(0xd8452f), [Math.cos((i * Math.PI) / 2) * 0.28, Math.sin((i * Math.PI) / 2) * 0.28, 0], [0.12, 0.12, 0.18], [0, 0, (i * Math.PI) / 2]);
  // the stove's pipe out of the roof, and its smoke; a lantern by the door
  part(g, cyl, mat(0x2f3840), [1.7, 3.1, -0.6], [0.12, 1.4, 0.12]);
  part(g, cyl, mat(0x2f3840), [1.7, 3.85, -0.6], [0.2, 0.08, 0.2]);
  smoke(g, [1.7, 3.95, -0.6], anims, { rise: 2.0 });
  lantern(g, glows, [1.2, 1.9, front + 0.2], 2.0);
  // barrels and crates by the side
  for (const [x, zz] of [[3.6, 1.2], [4.3, 0.6]]) barrel(g, [x, zz]);
  part(g, box, woodMat, [3.8, 0.3, -0.8], [0.6, 0.6, 0.6], [0, 0.4, 0]);
  addCollider({ x: home.x + 3.95, y: 0.45, z: home.z + 0.4, w: 1.4, h: 0.9, d: 2.4 });
  // lobster pots stacked, with their buoys, west of the hut (the road comes in from the east)
  for (const [x, zz, y] of [[-5.6, 6.0, 0.0], [-4.8, 5.8, 0.0], [-5.2, 5.9, 0.55]]) {
    part(g, new THREE.CylinderGeometry(0.5, 0.5, 0.55, 10, 1, false, 0, Math.PI), mat(0xb89a5a), [x, y + 0.27, zz], [1, 1, 1], [0, 0, Math.PI / 2]);
    part(g, box, mat(0x6e5a3a), [x, y + 0.04, zz], [1.0, 0.05, 0.5]);
  }
  for (const [x, zz, color] of [[-4.0, 6.2, 0xd8452f], [-4.3, 6.5, 0xf2c230]]) part(g, ball, mat(color), [x, 0.18, zz], [0.17, 0.17, 0.17]);
  addCollider({ x: home.x - 5.2, y: 0.5, z: home.z + 5.9, w: 2.0, h: 1, d: 0.9 });
  // an upturned boat on the sand to the west
  part(g, new THREE.CylinderGeometry(0.7, 0.7, 3, 12, 1, false, 0, Math.PI), mat(0x8a5a32), [-4.4, 0.02, 1.6], [0.6, 1, 1], [0, Math.PI / 2, Math.PI / 2]);
  part(g, box, mat(0xd8452f), [-4.4, 0.44, 1.6], [0.16, 0.04, 3.02]);
  addCollider({ x: home.x - 4.4, y: 0.3, z: home.z + 1.6, w: 1.5, h: 0.6, d: 3 });
  // nets drying on two poles
  for (const nz of [-1.6, 0.6]) part(g, box, darkWoodMat, [-3.2, 0.9, nz], [0.08, 1.8, 0.08]);
  const net = part(g, new THREE.PlaneGeometry(2.2, 1.2, 8, 4), new THREE.MeshStandardMaterial({ color: 0x3a3a2a, wireframe: true }), [-3.2, 1.1, -0.5], [1, 1, 1], [0, Math.PI / 2, 0]);
  net.castShadow = false;
  // a rack of fish drying, and gulls on the posts
  for (const sx of [-1, 1]) {
    beam(g, [-7.3 + sx * 0.9, 0.0, 4.2], [-7.3 + sx * 0.4, 1.7, 4.2], 0.08, darkWoodMat);
  }
  part(g, box, darkWoodMat, [-7.3, 1.62, 4.2], [1.4, 0.06, 0.06]);
  for (let i = 0; i < 5; i++) {
    const x = -7.85 + i * 0.28;
    part(g, box, mat(0xc8c0a8), [x, 1.5, 4.2], [0.012, 0.18, 0.012]);
    part(g, ball, mat(i % 2 ? 0xa8b0b8 : 0xb8a888), [x, 1.28, 4.2], [0.05, 0.14, 0.03]);
    part(g, cone, mat(i % 2 ? 0xa8b0b8 : 0xb8a888), [x, 1.08, 4.2], [0.04, 0.1, 0.02], [Math.PI, 0, 0]);
  }
  addCollider({ x: home.x - 7.3, y: 0.8, z: home.z + 4.2, w: 1.8, h: 1.6, d: 0.4 });
  // a flagpole by the start of the dock, and buoys on posts
  pole(g, [2.6, 5.0], 4.2, mat(0xf4f4f0), 0.08);
  const flag = live(new THREE.Group());
  flag.position.set(2.6, 3.8, 5.0);
  g.add(flag);
  for (let i = 0; i < 3; i++) part(flag, box, mat([0x2f4f7a, 0xf4f4f0, 0xd8452f][i]), [0.4, 0.1 - i * 0.2 + 0.1, 0], [0.8, 0.2, 0.02]);
  anims.push((t) => (flag.rotation.y = Math.sin(t * 2.0) * 0.18));
  for (const sx of [-1.8, 1.8]) {
    pole(g, [sx, 6.5], 1.3, darkWoodMat, 0.1);
    part(g, ball, mat(sx < 0 ? 0xd8452f : 0xf4f4f0), [sx, 1.45, 6.5], [0.2, 0.2, 0.2]);
  }
  bird(g, anims, [-1.8, 1.55, 6.5], 0xf4f4f0, 1.0);
  bird(g, anims, [1.8, 1.55, 6.5], 0xe8e8ee, 2.4);
  // the lighthouse on the dunes: a tapering tower in red and white, a gallery,
  // a lamp room whose beam sweeps round all night
  const lh = [9.5, 1.0];
  const rings = [0xd8452f, 0xf4f4f0, 0xd8452f, 0xf4f4f0, 0xd8452f];
  rings.forEach((color, i) => part(g, new THREE.CylinderGeometry(1.1 - (i + 1) * 0.1, 1.1 - i * 0.1, 1.3, 12), mat(color), [lh[0], 0.65 + i * 1.3, lh[1]]));
  part(g, cyl, mat(0x6e6a60), [lh[0], 0.12, lh[1]], [1.3, 0.24, 1.3]);
  part(g, cyl, mat(0x2f3840), [lh[0], 6.62, lh[1]], [0.85, 0.12, 0.85]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    part(g, box, mat(0x2f3840), [lh[0] + Math.cos(a) * 0.82, 6.95, lh[1] + Math.sin(a) * 0.82], [0.04, 0.5, 0.04]);
  }
  part(g, cyl, glassMat, [lh[0], 7.2, lh[1]], [0.46, 0.8, 0.46]);
  const lamp = part(g, cyl, lanternMat, [lh[0], 7.2, lh[1]], [0.2, 0.3, 0.2]);
  lamp.castShadow = false;
  part(g, cone, mat(0xd8452f), [lh[0], 7.95, lh[1]], [0.62, 0.7, 0.62]);
  part(g, ball, ironMat, [lh[0], 8.35, lh[1]], [0.07, 0.07, 0.07]);
  part(g, box, mat(0x3a4a5a), [lh[0], 0.5, lh[1] + 0.95], [0.5, 0.9, 0.06]);
  for (const y of [2.2, 3.6, 5.0]) part(g, box, mat(0x2f3840), [lh[0], y, lh[1] + 0.82 - (y - 2.2) * 0.04], [0.16, 0.3, 0.05]);
  addCollider({ x: home.x + lh[0], y: 4, z: home.z + lh[1], w: 2.4, h: 8, d: 2.4 });
  glows.push(glowSprite(g, [lh[0], 7.2, lh[1]], 4.0, 0xfff0b0));
  // (the beam: two soft wedges lying flat, turning, at night)
  const beamTex = canvasTexture(128, 32, (c, w, h) => {
    const grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,240,170,0.75)');
    grad.addColorStop(0.5, 'rgba(255,240,170,0.2)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(0, h * 0.45);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h * 0.55);
    c.fill();
  });
  const sweep = live(new THREE.Group());
  sweep.position.set(lh[0], 7.2, lh[1]);
  g.add(sweep);
  for (const a of [0, Math.PI]) {
    const wedge = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.6).translate(9.5, 0, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    wedge.rotation.y = a;
    sweep.add(wedge);
    glows.push(wedge);
  }
  anims.push((t) => (sweep.rotation.y = -t * 0.5));
  // the rowboat tied up at the dock, now it is mended (the planks you felled)
  const boat = story.group(g, (c) => c.done('finn_driftwood'));
  const bobber = live(new THREE.Group());
  bobber.position.set(-2.1, -0.55, 15.5);
  boat.add(bobber);
  part(bobber, box, mat(0xf4efe4), [0, 0.1, 0], [0.9, 0.34, 2.4]);
  part(bobber, box, mat(0xd8452f), [0, 0.28, 0], [0.96, 0.06, 2.46]);
  part(bobber, prismGeo(0.9, 0.34, 0.9), mat(0xf4efe4), [0, 0.1, 1.5], [1, 1, 1], [0, Math.PI / 2, 0]);
  part(bobber, prismGeo(0.9, 0.34, 0.9), mat(0xf4efe4), [0, 0.1, -1.5], [1, 1, 1], [0, -Math.PI / 2, 0]);
  part(bobber, box, woodMat, [0, 0.3, 0.2], [0.85, 0.05, 0.3]);
  for (const sx of [-1, 1]) {
    part(bobber, box, woodMat, [sx * 0.6, 0.4, 0.2], [0.04, 0.04, 1.2], [0, sx * 0.4, 0.3 * sx]);
  }
  beam(boat, [-1.2, 0.2, 14.3], [-1.9, -0.3, 14.9], 0.03, mat(0xd8c08a)); // its rope to the dock
  anims.push((t) => {
    bobber.position.y = -0.55 + Math.sin(t * 1.1) * 0.04;
    bobber.rotation.z = Math.sin(t * 0.9) * 0.04;
    bobber.rotation.x = Math.sin(t * 0.7 + 1) * 0.025;
  });
  // a wind chime of shells by the door: made for him, and hung when you have found them
  const chime = story.group(g, (c) => c.done('finn_shells'), [-1.1, 2.1, front + 0.5]);
  const swing = live(new THREE.Group());
  chime.add(swing);
  part(swing, cyl, mat(0x6e4a2b), [0, 0, 0], [0.18, 0.03, 0.18]);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    part(swing, box, mat(0xe8dcc8), [Math.cos(a) * 0.11, -0.2 - (i % 2) * 0.07, Math.sin(a) * 0.11], [0.008, 0.4 + (i % 2) * 0.14, 0.008]);
    part(swing, cone, mat([0xf4d0c0, 0xf0e8d8, 0xe8c0b0][i % 3]), [Math.cos(a) * 0.11, -0.42 - (i % 2) * 0.14, Math.sin(a) * 0.11], [0.04, 0.07, 0.04], [Math.PI, 0, 0]);
  }
  anims.push((t) => {
    swing.rotation.z = Math.sin(t * 1.3) * 0.08;
    swing.rotation.x = Math.sin(t * 1.0 + 1) * 0.06;
  });
  roadSign(g, NPCS.finn.title, 3.2, 3.2, { paper: '#e8eef4', ink: '#2f4f7a' });
}

// ---------- Mabel ----------
// A cream bakery, timbered, with a terracotta roof, a striped awning over its
// windows, bunting, a hanging sign, a terrace with tables under a parasol, an
// oven for bread out the side, a herb bed and smoke from its chimney; a table
// laid for a feast, when you have cooked one for her
function mabelHome(g, home, { addCollider, anims, glows, story }) {
  const { roofTop } = house(g, home, { wall: 0xf2e2c0, trim: 0x6e4a2b, roof: 0xb5553a, door: 0x9c3a2e, rise: 1.8 }, addCollider);
  const { w, d } = home;
  const beamMat = mat(0x6e4a2b);
  const front = d / 2 + 0.02;
  // timbers across the front
  part(g, box, beamMat, [0, 2.0, front], [w, 0.12, 0.04]);
  for (const x of [-2.6, -0.8, 0.8, 2.6]) part(g, box, beamMat, [x, 1.2, front], [0.12, 2.4, 0.04]);
  // a striped awning over each window
  const stripes = [mat(0xd8452f), mat(0xfff4e0)];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) part(g, box, stripes[i % 2], [sx * 1.7 - 0.5 + i * 0.25, 2.05, front + 0.35], [0.25, 0.05, 0.75], [0.45, 0, 0]);
  }
  // the chimney, brick, out of the roof's back, and its smoke
  const chimX = 1.8;
  part(g, box, mat(0x8a3a2a), [chimX, roofTop - 0.2, -0.9], [0.6, 1.8, 0.6]);
  part(g, box, mat(0x5a2a1a), [chimX, roofTop + 0.75, -0.9], [0.7, 0.12, 0.7]);
  smoke(g, [chimX, roofTop + 1, -0.9], anims);
  // a bench, and pots of flowers by the door
  part(g, box, woodMat, [-2.6, 0.45, front + 1.2], [1.6, 0.08, 0.5]);
  for (const sx of [-0.65, 0.65]) part(g, box, darkWoodMat, [-2.6 + sx, 0.22, front + 1.2], [0.1, 0.44, 0.4]);
  addCollider({ x: home.x - 2.6, y: 0.25, z: home.z + front + 1.2, w: 1.6, h: 0.5, d: 0.5 });
  for (const sx of [-1, 1]) {
    part(g, cyl, mat(0xb5553a), [sx * 0.95, 0.2, front + 0.35], [0.18, 0.4, 0.18]);
    part(g, ball, mat(sx > 0 ? 0xff7eb6 : 0xf2c230), [sx * 0.95, 0.5, front + 0.35], [0.2, 0.16, 0.2]);
  }
  // window boxes of flowers, and baskets of bread on the sills
  for (const sx of [-1, 1]) {
    part(g, box, darkWoodMat, [sx * 1.7, 0.9, front + 0.12], [1.0, 0.18, 0.2]);
    for (let i = 0; i < 5; i++) part(g, ball, mat([0xff7eb6, 0xf2c230, 0xffffff, 0xe0362c][(i + (sx > 0 ? 1 : 0)) % 4]), [sx * 1.7 - 0.4 + i * 0.2, 1.04, front + 0.12], [0.07, 0.07, 0.07]);
  }
  // the bread sign hanging over the door on an iron arm, and a lantern
  part(g, box, ironMat, [1.5, 2.65, front + 0.35], [0.05, 0.05, 0.7]);
  part(g, box, ironMat, [1.5, 2.45, front + 0.7], [0.02, 0.4, 0.02]);
  part(g, box, new THREE.MeshStandardMaterial({ map: canvasTexture(128, 96, (c, cw, ch) => {
    c.fillStyle = '#f4dcae';
    c.fillRect(0, 0, cw, ch);
    c.strokeStyle = '#5b3a1e';
    c.lineWidth = 8;
    c.strokeRect(4, 4, cw - 8, ch - 8);
    c.fillStyle = '#c8843a';
    c.beginPath();
    c.ellipse(cw / 2, ch / 2, 36, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8a5a22';
    c.lineWidth = 4;
    for (const x of [-16, 0, 16]) {
      c.beginPath();
      c.moveTo(cw / 2 + x - 5, ch / 2 - 10);
      c.lineTo(cw / 2 + x + 5, ch / 2 + 10);
      c.stroke();
    }
  }), roughness: 0.9 }), [1.5, 2.1, front + 0.72], [0.02, 0.6, 0.5]);
  lantern(g, glows, [-1.4, 2.35, front + 0.3], 2.2);
  // bunting from the eaves to posts out in front
  for (const sx of [-1, 1]) {
    pole(g, [sx * 5.0, 5.4], 2.3, darkWoodMat, 0.1);
    bunting(g, [sx * 3.1, 2.55, front + 0.1], [sx * 5.0, 2.2, 5.4], [0xd8452f, 0xfff4e0, 0xf4b6cf, 0x7fb3d5, 0xf2c230], { sag: 0.45, n: 9 });
  }
  // the terrace: flagstones, two tables with chairs, a parasol
  for (const [x, zz] of [[-4.2, 3.4], [-3.0, 3.8], [-4.2, 4.2], [-3.0, 4.6], [-4.6, 5.0], [-3.4, 5.4]]) part(g, box, mat(0xb8b4a8), [x - 0.1, 0.02, zz], [1.1, 0.05, 0.8], [0, (x + zz) * 0.3, 0]).castShadow = false;
  roundTable(g, [-4.0, 4.1], 0.5);
  roundTable(g, [-2.7, 5.1], 0.45, 0xf4b6cf);
  for (const [x, zz, yaw] of [[-4.7, 4.1, Math.PI / 2], [-3.3, 4.1, -Math.PI / 2], [-2.7, 5.7, Math.PI], [-2.0, 5.1, -Math.PI / 2]]) chair(g, [x, zz], yaw);
  parasol(g, [-4.0, 4.1], 2.1, [0xd8452f, 0xfff4e0]);
  for (const [x, zz, color] of [[-4.1, 4.05, 0xe8dcc8], [-2.7, 5.05, 0xf4b6cf]]) part(g, cyl, mat(color), [x, 0.84, zz], [0.14, 0.05, 0.14]);
  addCollider({ x: home.x - 4.0, y: 0.4, z: home.z + 4.1, w: 1.2, h: 0.8, d: 1.2 });
  addCollider({ x: home.x - 2.7, y: 0.4, z: home.z + 5.1, w: 1.0, h: 0.8, d: 1.0 });
  // the oven for bread, out the east side: a stone dome and its woodpile
  const ov = [4.6, 0.8];
  part(g, box, stoneMat, [ov[0], 0.35, ov[1]], [1.7, 0.7, 1.5]);
  part(g, new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb8a888), [ov[0], 0.7, ov[1]]);
  part(g, box, mat(0x1b140e), [ov[0], 0.62, ov[1] + 0.78], [0.5, 0.4, 0.06]).castShadow = false;
  part(g, cyl, mat(0x5a2a1a), [ov[0] - 0.2, 1.7, ov[1] - 0.2], [0.16, 0.9, 0.16]);
  smoke(g, [ov[0] - 0.2, 2.2, ov[1] - 0.2], anims, { rise: 1.6, puffs: 4 });
  for (let i = 0; i < 6; i++) part(g, cyl, mat(0x7a5a3a), [ov[0] + 1.3, 0.1 + Math.floor(i / 3) * 0.2, ov[1] - 0.4 + (i % 3) * 0.22], [0.09, 0.7, 0.09], [Math.PI / 2, 0, 0.2]);
  part(g, box, woodMat, [ov[0] + 1.3, 0.8, ov[1] + 0.9], [0.08, 1.6, 0.05], [0.1, 0, 0.3]); // (the peel, leaning)
  addCollider({ x: home.x + ov[0] + 0.3, y: 0.5, z: home.z + ov[1], w: 3.0, h: 1, d: 1.6 });
  // a raised bed of herbs, a chalkboard sign
  const hb = [-5.6, -0.2];
  part(g, box, woodMat, [hb[0], 0.2, hb[1]], [2.6, 0.4, 1.0]);
  part(g, box, soilMat, [hb[0], 0.4, hb[1]], [2.4, 0.04, 0.8]);
  for (let i = 0; i < 6; i++) {
    const x = hb[0] - 1.0 + i * 0.4;
    part(g, ball, mat([0x4f9e3c, 0x8a6aae, 0x6bbf4a, 0xe8e0f0, 0x3f8a3c, 0x9a7acc][i]), [x, 0.52, hb[1] + (i % 2 ? 0.12 : -0.12)], [0.16, 0.14, 0.16]);
    part(g, box, mat(0xe8dcc8), [x, 0.5, hb[1] + 0.46], [0.02, 0.2, 0.02]);
  }
  addCollider({ x: home.x + hb[0], y: 0.3, z: home.z + hb[1], w: 2.6, h: 0.6, d: 1.0 });
  const sign = new THREE.Group();
  sign.position.set(-1.7, 0, front + 1.5);
  g.add(sign);
  const chalk = new THREE.MeshStandardMaterial({ map: boardTexture(['Fresh bread!', 'Honey cake today'], { w: 256, h: 192, size: 28 }), roughness: 0.9 });
  for (const s of [-1, 1]) part(sign, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, s > 0 ? chalk : darkWoodMat, s > 0 ? darkWoodMat : chalk], [0, 0.45, s * 0.2], [0.7, 0.9, 0.05], [s * -0.2, 0, 0]);
  // a hive, with its honey, from the one you built for her
  const hive = story.group(g, (c) => c.done('mabel_honey'), [-6.8, 0, 2.2]);
  part(hive, box, darkWoodMat, [0, 0.3, 0], [0.6, 0.12, 0.6]);
  for (let i = 0; i < 3; i++) part(hive, box, mat(i % 2 ? 0xf2e2b0 : 0xf4c850), [0, 0.5 + i * 0.24, 0], [0.5, 0.22, 0.5]);
  part(hive, box, mat(0x8a6a4a), [0, 1.2, 0], [0.62, 0.08, 0.62]);
  const bees = Array.from({ length: 3 }, () => part(hive, ball, mat(0xf2c230), [0, 0.7, 0], [0.025, 0.02, 0.025]));
  bees.forEach(live);
  anims.push((t) => bees.forEach((b, i) => b.position.set(Math.sin(t * 2.4 + i * 2) * (0.45 + i * 0.1), 0.8 + Math.sin(t * 3 + i) * 0.2, Math.cos(t * 2.1 + i * 1.3) * 0.45)));
  // a crate of marrows by the door, now Basil has sent marrows, not courgettes
  const marrows = story.group(g, (c) => c.done('mabel_note'), [1.9, 0, front + 1.0]);
  part(marrows, box, woodMat, [0, 0.18, 0], [0.9, 0.36, 0.55]);
  for (const [dx, dz, ry] of [[-0.2, 0, 0.3], [0.2, 0.05, -0.3]]) {
    part(marrows, ball, mat(0x5a8a3a), [dx, 0.42, dz], [0.36, 0.14, 0.14], [0, ry, 0]);
    part(marrows, ball, mat(0xc8d890), [dx, 0.45, dz], [0.34, 0.06, 0.12], [0, ry, 0]);
  }
  // the feast, laid out front for the whole valley, for the first time in thirty years
  const feast = story.group(g, (c) => c.done('mabel_feast'), [7.9, 0, 2.6]);
  part(feast, box, woodMat, [0, 0.78, 0], [4.6, 0.08, 1.1]);
  part(feast, box, mat(0xfffaf0), [0, 0.835, 0], [4.7, 0.014, 1.2]).castShadow = false;
  for (const dx of [-2.1, -0.7, 0.7, 2.1]) for (const dz of [-0.4, 0.4]) part(feast, box, darkWoodMat, [dx, 0.38, dz], [0.1, 0.76, 0.1]);
  for (let i = 0; i < 6; i++) {
    const x = -1.9 + i * 0.76;
    chair(feast, [x, -0.95], 0, 0xa0682f);
    chair(feast, [x, 0.95], Math.PI, 0xa0682f);
    part(feast, cyl, mat(0xf4efe4), [x, 0.855, 0.3], [0.17, 0.02, 0.17]);
    part(feast, cyl, mat(0xf4efe4), [x, 0.855, -0.3], [0.17, 0.02, 0.17]);
  }
  part(feast, cyl, mat(0xe8e0d0), [-0.6, 0.87, 0], [0.34, 0.04, 0.34]);
  part(feast, ball, mat(0xb8662a), [-0.6, 0.98, 0], [0.28, 0.14, 0.22]);
  part(feast, cyl, mat(0xe8e0d0), [0.7, 0.87, 0], [0.26, 0.04, 0.26]);
  for (const [dx, dz, color] of [[0.62, -0.05, 0xf2c230], [0.78, 0.05, 0xff8c1a], [0.7, -0.12, 0xe0362c], [0.74, 0.12, 0xf2c230]]) part(feast, ball, mat(color), [dx, 0.95, dz], [0.07, 0.07, 0.07]);
  for (const x of [-1.8, 0, 1.8]) {
    part(feast, cyl, mat(0xf4efe4), [x, 0.95, 0.0], [0.03, 0.2, 0.03]);
    part(feast, ball, lanternMat, [x, 1.08, 0.0], [0.03, 0.05, 0.03]).castShadow = false;
  }
  bunting(feast, [-2.3, 2.5, -1.2], [2.3, 2.5, -1.2], [0xd8452f, 0xfff4e0, 0xf4b6cf, 0x7fb3d5, 0xf2c230], { sag: 0.35, n: 10 });
  for (const sx of [-2.3, 2.3]) pole(feast, [sx, -1.2], 2.5, darkWoodMat, 0.1);
  roadSign(g, NPCS.mabel.title, 3.4, 5.2, { paper: '#fff0e0', ink: '#9c3a2e' });
}

// Bram's joinery: a timber workshop of dark boards, a lean-to of seasoned
// planks along its west side, a sawhorse with a plank half cut, a chopping
// block with its axe in it. What he makes with you shows: an anvil, once
// there's steel; a run of picket fence; a barn's frame going up out the back;
// bunting for the fair.
function bramHome(g, home, { addCollider, anims, glows, story }) {
  const { trimMat } = house(g, home, { wall: 0x8a6a48, trim: 0x4a3626, roof: 0x3f4a3a, door: 0x5a3a22, rise: 1.6 }, addCollider);
  const front = home.d / 2 + 0.03;
  // boards up the front, and a sign of a saw over the door
  for (const x of [-2.6, -2.0, 2.0, 2.6]) part(g, box, trimMat, [x, 1.2, front], [0.08, 2.4, 0.03]);
  part(g, box, mat(0xd8c8a0), [0, 2.25, front + 0.06], [1.2, 0.3, 0.04]);
  part(g, box, ironMat, [0, 2.25, front + 0.09], [0.8, 0.08, 0.02]);
  for (let i = 0; i < 6; i++) part(g, cone, ironMat, [-0.35 + i * 0.14, 2.18, front + 0.09], [0.04, 0.06, 0.02], [Math.PI, 0, 0]);
  lantern(g, glows, [1.1, 2.1, front + 0.25]);
  // a stove pipe, and its smoke
  part(g, cyl, ironMat, [-1.6, 3.2, -0.8], [0.14, 1.8, 0.14]);
  smoke(g, [-1.6, 4.15, -0.8], anims, { rise: 1.8, puffs: 4 });
  // the lean-to of seasoned planks along the west wall
  const lx = -home.w / 2 - 0.8;
  part(g, box, mat(0x3f4a3a), [lx, 1.9, 0], [1.8, 0.08, home.d + 0.4], [0, 0, -0.25]);
  for (const z of [-2.2, 2.2]) pole(g, [lx - 0.75, z], 1.7);
  for (let i = 0; i < 7; i++) part(g, box, mat([0xc89a62, 0xb8864e, 0xd8aa72][i % 3]), [lx - 0.1 + (i % 2) * 0.12, 0.2 + i * 0.16, 0], [0.9, 0.12, home.d - 0.2]);
  addCollider({ x: home.x + lx, y: 0.7, z: home.z, w: 1.8, h: 1.4, d: home.d });
  // a sawhorse with a plank on it, half cut, and the saw in it
  const sh = [4.2, 0.4];
  for (const dz of [-0.45, 0.45]) {
    for (const dx of [-0.25, 0.25]) part(g, box, darkWoodMat, [sh[0] + dx, 0.35, sh[1] + dz], [0.07, 0.75, 0.07], [0, 0, dx > 0 ? -0.3 : 0.3]);
    part(g, box, darkWoodMat, [sh[0], 0.7, sh[1] + dz], [0.6, 0.08, 0.08]);
  }
  part(g, box, mat(0xd8aa72), [sh[0], 0.79, sh[1]], [0.3, 0.06, 2.0]);
  part(g, box, ironMat, [sh[0], 0.92, sh[1] + 0.5], [0.02, 0.22, 0.7], [0.4, 0, 0]);
  part(g, box, woodMat, [sh[0], 1.08, sh[1] + 0.85], [0.06, 0.14, 0.2]);
  addCollider({ x: home.x + sh[0], y: 0.4, z: home.z + sh[1], w: 0.7, h: 0.8, d: 2.0 });
  // a chopping block with its axe in it, and shavings round it
  const cb = [-3.8, 3.0];
  part(g, cyl, mat(0x8a6a4a), [cb[0], 0.3, cb[1]], [0.38, 0.6, 0.38]);
  part(g, cyl, mat(0xd8c8a0), [cb[0], 0.61, cb[1]], [0.34, 0.02, 0.34]);
  part(g, box, woodMat, [cb[0] + 0.1, 0.95, cb[1]], [0.05, 0.7, 0.05], [0, 0, -0.5]);
  part(g, box, ironMat, [cb[0] - 0.05, 0.66, cb[1]], [0.2, 0.12, 0.03], [0, 0, -0.5]);
  for (let i = 0; i < 8; i++) part(g, box, mat(0xe8d4a8), [cb[0] + Math.sin(i * 2.3) * 0.7, 0.012, cb[1] + Math.cos(i * 1.7) * 0.6], [0.14, 0.02, 0.06], [0, i, 0]).castShadow = false;
  addCollider({ x: home.x + cb[0], y: 0.3, z: home.z + cb[1], w: 0.8, h: 0.6, d: 0.8 });
  // a log pile out the east side, for the stove
  for (let i = 0; i < 9; i++) part(g, cyl, mat(0x7a5a3a), [3.9 + (i % 3) * 0.32 - Math.floor(i / 3) * 0.0, 0.16 + Math.floor(i / 3) * 0.28, -1.9], [0.15, 1.1, 0.15], [Math.PI / 2, 0, 0]);
  addCollider({ x: home.x + 4.2, y: 0.45, z: home.z - 1.9, w: 1.1, h: 0.9, d: 1.1 });
  // an anvil by the door, once there's steel to work
  const anvil = story.group(g, (c) => c.done('bram_steel'), [2.3, 0, front + 1.3]);
  part(anvil, box, mat(0x6e5a42), [0, 0.22, 0], [0.4, 0.44, 0.4]);
  part(anvil, box, ironMat, [0, 0.52, 0], [0.6, 0.16, 0.26]);
  part(anvil, cone, ironMat, [0.4, 0.55, 0], [0.09, 0.22, 0.09], [0, 0, -Math.PI / 2]);
  // a run of picket fence, the way he showed you
  const pickets = story.group(g, (c) => c.done('bram_fence'), [-5.0, 0, 1.0]);
  part(pickets, box, mat(0xf4efe4), [0, 0.45, 0], [0.06, 0.08, 2.4]);
  part(pickets, box, mat(0xf4efe4), [0, 0.75, 0], [0.06, 0.08, 2.4]);
  for (let i = 0; i < 8; i++) {
    part(pickets, box, mat(0xf4efe4), [0, 0.5, -1.05 + i * 0.3], [0.06, 1.0, 0.12]);
    part(pickets, cone, mat(0xf4efe4), [0, 1.06, -1.05 + i * 0.3], [0.06, 0.12, 0.06]);
  }
  // the barn's frame, going up out the back, for Rosa
  const barn = story.group(g, (c) => c.done('bram_barn'), [0, 0, -4.4]);
  for (const x of [-2.2, 0, 2.2]) for (const z of [-0.6, 0.6]) part(barn, box, mat(0xc89a62), [x, 1.3, z], [0.16, 2.6, 0.16]);
  for (const z of [-0.6, 0.6]) part(barn, box, mat(0xc89a62), [0, 2.6, z], [4.6, 0.16, 0.16]);
  for (const x of [-2.2, 0, 2.2]) {
    part(barn, box, mat(0xb8864e), [x - 0.35, 3.0, 0], [0.12, 0.12, 1.5], [0.6, 0, 0]);
    part(barn, box, mat(0xb8864e), [x, 3.0, 0], [0.12, 1.0, 0.12]);
  }
  // bunting for the fair, from the eaves out to two poles
  const fair = story.group(g, (c) => c.done('bram_fair'), [0, 0, 0]);
  for (const sx of [-1, 1]) {
    pole(fair, [sx * 4.6, 5.0], 2.3, darkWoodMat, 0.1);
    bunting(fair, [sx * 2.9, 2.35, front + 0.1], [sx * 4.6, 2.2, 5.0], [0xd8452f, 0xf2c230, 0x3f8a46, 0xfff4e0, 0x2f6fb5], { sag: 0.4, n: 8 });
  }
  // a chair out front, for you, once he's glad of the company
  const seat = story.group(g, (c) => c.hearts >= 2, [-1.6, 0, front + 1.0]);
  chair(seat, [0, 0], Math.PI * 0.1, 0xb8864e);
  roadSign(g, NPCS.bram.title, -3.4, 5.4, { paper: '#f4e4c4', ink: '#4a3626' });
}

export const YARDS = { rosa: rosaHome, basil: basilHome, finn: finnHome, mabel: mabelHome, bram: bramHome };
