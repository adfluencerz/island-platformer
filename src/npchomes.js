import * as THREE from 'three';
import { NPC_HOMES, NPC_ROOMS, DOCK, SIGNPOSTS } from '../shared/farmland.js';
import { box, ball, cyl, mat, part, bake, bakedMaterial, makeStory, onWall, signTexture, addWindow, glowSprite, woodMat, darkWoodMat, ironMat, lanternMat, windowMat, darkMat } from './homekit.js';
import { YARDS } from './npcyards.js';
import { ROOMS } from './nporooms.js';

// ---------- The neighbours' homes ----------
// Each neighbour (shared/npcs.js) lives in a home of their own out in the
// farm's valley (NPC_HOMES in shared/farmland.js): a house and its yard
// (src/npcyards.js), with a room inside of its own (NPC_ROOMS), out past the
// sea on the farm's world, where nothing else is, as the farmer's own house's
// room is (src/house.js): a counter across it with their wares on shelves
// behind, a bed, a table, a rug, and a low front wall so the camera sees in
// (the shell is built here; src/nporooms.js makes each theirs). src/npcs.js
// puts the neighbours in and out of them. The rooms and yards have things
// that show as you do things for their neighbour, or they like you more
// (`show`), a clock that tells the farm's hour (`setHour`), and lit windows
// at night (`setNight`).
//
// What main.js and src/npcs.js need of them (the doors, the spots inside,
// the dock) is in `npcHomes`, from the farm's last build.

export const npcHomes = {
  outside: {}, // id -> the home's group on the farm (tapping it goes in)
  rooms: {}, // id -> { root, entry, exit, counter, customer, bed, table, door (its group) }
  dock: { mend() {} }, // Finn's dock: mend(true) puts its missing planks back
  lamps: [], // where the yards' lanterns hang, in the farm (Vector3s)
  setNight() {},
  setHour() {},
  animate() {},
  // what shows of id's yard and room, for how you stand with them: { done(mission),
  // hearts, chose(key) } (src/npcs.js); remembered for a farm built after
  show(id, c) {
    stories[id]?.forEach((story) => story.show(c));
    last[id] = c;
  },
};
const stories = {}; // id -> [their yard's story, their room's] (src/homekit.js makeStory)
const last = {}; // id -> what show() was last told

// Finn's dock: a deck of planks on posts from the front of his hut out over
// the sea. Before Finn has the wood to mend it (his first mission) the
// middle of it is gone, a rope across where it stops; mended, it runs all
// the way out, with a lantern at its end.
const DECK_Y = 0.3; // its top (a step up from the ground)
function buildDock(root, { addCollider, removeCollider }) {
  const g = new THREE.Group();
  g.name = 'dock';
  root.add(g);
  const plankMat = mat(0x9a7a52);
  const postMat = mat(0x6e5a42);
  const { x, z0, z1, w } = DOCK;
  const BROKEN_AT = z0 + 5; // the deck stops here, till it is mended
  const broken = new THREE.Group();
  const mended = new THREE.Group();
  g.add(broken, mended);
  const plank = (parent, z) => part(parent, box, plankMat, [x, DECK_Y - 0.06, z], [w, 0.12, 0.3]);
  for (let z = z0; z < z1; z += 0.34) {
    if (z < BROKEN_AT) plank(g, z);
    else {
      plank(mended, z);
      if (z > BROKEN_AT + 4 && z < BROKEN_AT + 6.5) plank(broken, z); // (a few still there, out past the gap)
    }
  }
  // posts down into the sand and the sea, every couple of steps
  for (let z = z0 + 0.3; z < z1; z += 2) {
    for (const s of [-1, 1]) {
      const post = part(g, cyl, postMat, [x + (s * w) / 2, -0.4, z], [0.1, 1.6 + DECK_Y, 0.1]);
      post.position.y = (DECK_Y - 1.3) / 2;
    }
  }
  // a rope across where the deck stops, and a little sign
  for (const s of [-1, 1]) part(broken, box, postMat, [x + s * (w / 2 - 0.1), DECK_Y + 0.45, BROKEN_AT - 0.2], [0.1, 0.9, 0.1]);
  part(broken, box, mat(0xd8c08a), [x, DECK_Y + 0.75, BROKEN_AT - 0.2], [w - 0.2, 0.05, 0.05]);
  const noteMat = new THREE.MeshStandardMaterial({ map: signTexture('Closed!', { paper: '#fff4e0', ink: '#a8392f' }), roughness: 0.9 });
  part(broken, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, noteMat, darkWoodMat], [x, DECK_Y + 0.6, BROKEN_AT - 0.17], [0.8, 0.26, 0.03]);
  addCollider({ x, y: DECK_Y - 0.25, z: (z0 + BROKEN_AT) / 2, w, h: 0.5, d: BROKEN_AT - z0 });
  let ropeStop = addCollider({ x, y: DECK_Y + 0.5, z: BROKEN_AT - 0.2, w, h: 1, d: 0.2 });
  // mended: a lantern at the end, and bollards to tie a boat to
  part(mended, box, postMat, [x + w / 2 - 0.15, DECK_Y + 0.9, z1 - 0.4], [0.12, 1.8, 0.12]);
  const lamp = part(mended, ball, lanternMat, [x + w / 2 - 0.15, DECK_Y + 1.7, z1 - 0.25], [0.13, 0.17, 0.13]);
  lamp.castShadow = false;
  for (const zz of [z1 - 3, z1 - 7]) part(mended, cyl, ironMat, [x - w / 2 + 0.25, DECK_Y + 0.15, zz], [0.12, 0.3, 0.12]);
  let rest = null; // the mended deck's collider, while it is mended
  function mend(on) {
    mended.visible = on;
    broken.visible = !on;
    if (on && !rest) {
      rest = addCollider({ x, y: DECK_Y - 0.25, z: (BROKEN_AT + z1) / 2, w, h: 0.5, d: z1 - BROKEN_AT });
      removeCollider(ropeStop);
    } else if (!on && rest) {
      removeCollider(rest);
      rest = null;
      ropeStop = addCollider({ x, y: DECK_Y + 0.5, z: BROKEN_AT - 0.2, w, h: 1, d: 0.2 });
    }
  }
  mend(false);
  return { mend, deckY: DECK_Y, group: g };
}

// A signpost where a road leaves the old farm: a board on a post with the
// way to a neighbour's, and an arrow
function arrowTexture(text, dir) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8c890';
  ctx.fillRect(0, 0, 256, 72);
  ctx.strokeStyle = '#6e4a2b';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 66);
  ctx.fillStyle = '#5b2b0a';
  // the arrow, at the end it points to (or the start, pointing down or up)
  const [tip, ...rest] = {
    left: [[12, 36], [42, 14], [42, 58]],
    right: [[244, 36], [214, 14], [214, 58]],
    down: [[30, 60], [12, 26], [48, 26]],
    up: [[30, 12], [12, 46], [48, 46]],
  }[dir];
  ctx.beginPath();
  ctx.moveTo(...tip);
  for (const p of rest) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mid = dir === 'right' ? 116 : 140;
  let size = 34;
  do ctx.font = `bold ${size--}px "Trebuchet MS", system-ui, sans-serif`;
  while (ctx.measureText(text).width > 180);
  ctx.fillText(text, mid, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function buildSignposts(root) {
  for (const { x, z, text, dir } of SIGNPOSTS) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    part(g, box, darkWoodMat, [0, 0.95, -0.05], [0.12, 1.9, 0.12]);
    const face = new THREE.MeshStandardMaterial({ map: arrowTexture(text, dir), roughness: 0.9 });
    part(g, box, [darkWoodMat, darkWoodMat, darkWoodMat, darkWoodMat, face, darkWoodMat], [0, 1.45, 0.03], [1.8, 0.5, 0.06], [-0.2, 0, 0]).castShadow = false;
  }
}

// ---------- Inside ----------
// A room at NPC_ROOMS[id]: boards, walls (the front one low, with a door in
// its middle), a dark round it; a counter across its back half, shelves on
// the back wall, a bed, a table and stools, a rug, a lantern either side.
// `look` (src/nporooms.js ROOMS) has their colors, and `bedSide` ('left' or
// 'right'), `tableSide`, `windows` ('round'), and `props` that adds what
// makes it theirs.
const ROOM_WALL_H = 3;
const ROOM_FRONT_H = 0.5;
function buildRoom(root, id, look, { addCollider, glows }) {
  const r = NPC_ROOMS[id];
  const g = new THREE.Group();
  g.name = 'npc-room'; // (no snow in here: src/seasons.js)
  root.add(g);
  const left = r.x0 - 0.5;
  const right = left + r.w;
  const back = r.z0 - 0.5;
  const front = back + r.d;
  const midX = (left + right) / 2;
  const midZ = (back + front) / 2;
  const floorMat = mat(look.floor);
  const wallMat = mat(look.wall);
  const beamMat = mat(look.beam ?? 0x6e4a2b);
  const solid = (x, y, z, w, h, d) => addCollider({ x, y, z, w, h, d });
  const block = (material, x, y, z, w, h, d) => {
    part(g, box, material, [x, y, z], [w, h, d]);
    solid(x, y, z, w, h, d);
  };
  part(g, new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2), darkMat, [midX, -0.03, midZ - 10]).castShadow = false; // (the camera looks a long way north)
  part(g, box, floorMat, [midX, -0.2, midZ], [r.w, 0.4, r.d]).castShadow = false;
  addCollider({ x: midX, y: -0.2, z: midZ, w: r.w, h: 0.4, d: r.d }, { ground: true });
  // the boards' gaps
  const gapMat = mat(new THREE.Color(look.floor).multiplyScalar(0.7).getHex());
  for (let z = back + 1; z < front; z++) part(g, box, gapMat, [midX, 0.002, z], [r.w, 0.004, 0.04]).castShadow = false;
  block(wallMat, midX, ROOM_WALL_H / 2, back - 0.2, r.w + 0.8, ROOM_WALL_H, 0.4);
  for (const x of [left - 0.2, right + 0.2]) block(wallMat, x, ROOM_WALL_H / 2, midZ, 0.4, ROOM_WALL_H, r.d);
  part(g, box, wallMat, [midX, ROOM_FRONT_H / 2, front + 0.2], [r.w + 0.8, ROOM_FRONT_H, 0.4]);
  solid(midX, ROOM_WALL_H / 2, front + 0.2, r.w + 0.8, ROOM_WALL_H, 0.4);
  part(g, box, beamMat, [midX, ROOM_WALL_H - 0.1, back + 0.05], [r.w, 0.2, 0.12]);
  part(g, box, beamMat, [midX, ROOM_FRONT_H + 0.05, front + 0.2], [r.w + 0.8, 0.1, 0.44]);
  for (const x of [left + 0.06, right - 0.06]) part(g, box, beamMat, [x, ROOM_WALL_H / 2, back + 0.06], [0.16, ROOM_WALL_H, 0.12]);
  // windows in the back wall, by the corners (square, or round like a ship's)
  for (const x of [left + 1.6, right - 1.6]) {
    if (look.windows === 'round') porthole(g, x, 1.9, back + 0.02, beamMat);
    else addWindow(g, x, 1.9, back + 0.02, beamMat, 1.0, 0.9);
    glows.push(glowSprite(g, [x, 1.5, back + 0.7], 2.6, 0xffe0a8)); // (the light they let in, or out: at night)
  }
  // lanterns on the side walls
  for (const x of [left + 0.12, right - 0.12]) {
    part(g, box, lanternMat, [x, 2.1, midZ], [0.2, 0.28, 0.2]).castShadow = false;
    glows.push(glowSprite(g, [x + (x < midX ? 0.5 : -0.5), 2.0, midZ], 2.4));
  }
  // the door out, in the front wall, and a mat before it
  const door = new THREE.Group();
  door.name = 'npc-door-in';
  door.position.set(midX, 0, front);
  g.add(door);
  for (const x of [-0.6, 0.6]) part(door, box, beamMat, [x, 1.1, 0.1], [0.16, 2.2, 0.3]);
  part(door, box, beamMat, [0, 2.25, 0.1], [1.36, 0.16, 0.3]);
  part(door, box, mat(look.door ?? 0xa8713f), [0, 1.05, 0.12], [1.04, 2.0, 0.08]);
  part(g, box, mat(look.rug ?? 0xb8473c), [midX, 0.012, front - 0.75], [1.4, 0.02, 0.8]).castShadow = false;
  // the counter across the back half, the neighbour behind it
  const counterZ = back + 3.2;
  const counterW = 5.2;
  const topMat = mat(look.counterTop ?? 0xc48a4a);
  block(mat(look.counter ?? 0xa0682f), midX, 0.5, counterZ, counterW, 1, 0.8);
  part(g, box, topMat, [midX, 1.03, counterZ], [counterW + 0.12, 0.06, 0.92]);
  // the shelves on the back wall behind it
  const shelfMat = mat(0x6e4a2b);
  for (const y of [0.9, 1.6, 2.3]) part(g, box, shelfMat, [midX, y, back + 0.25], [counterW + 0.6, 0.06, 0.45]);
  for (const sx of [-1, 1]) part(g, box, shelfMat, [midX + sx * (counterW / 2 + 0.3), 1.3, back + 0.25], [0.08, 2.6, 0.45]);
  // the bed, in a back corner (their props make a bed of their own, with `bed: false`)
  const bedX = look.bedSide === 'right' ? right - 0.9 : left + 0.9;
  const bedZ = back + 1.4;
  if (look.bed !== false) {
    block(darkWoodMat, bedX, 0.25, bedZ, 1.4, 0.5, 2.4);
    part(g, box, mat(0xf4efe4), [bedX, 0.56, bedZ + 0.15], [1.3, 0.14, 2.1]);
    part(g, box, mat(look.blanket ?? 0x4f7fbf), [bedX, 0.62, bedZ + 0.45], [1.36, 0.1, 1.5]);
    part(g, box, mat(0xf4efe4), [bedX, 0.7, bedZ - 0.75], [1.0, 0.16, 0.5]);
    part(g, box, darkWoodMat, [bedX, 0.7, back + 0.15], [1.4, 0.9, 0.12]);
  }
  // the table and two stools, in a front corner
  const west = look.tableSide === 'left';
  const tableX = west ? left + 2.2 : right - 2.2;
  const tableZ = front - 2.4;
  part(g, box, woodMat, [tableX, 0.78, tableZ], [1.4, 0.1, 1]);
  for (const [x, z] of [[-0.55, -0.38], [0.55, -0.38], [-0.55, 0.38], [0.55, 0.38]]) part(g, box, darkWoodMat, [tableX + x, 0.37, tableZ + z], [0.1, 0.74, 0.1]);
  solid(tableX, 0.42, tableZ, 1.4, 0.84, 1);
  for (const s of [-1, 1]) {
    part(g, box, woodMat, [tableX + s * 1.1, 0.45, tableZ], [0.45, 0.08, 0.45]);
    part(g, box, darkWoodMat, [tableX + s * 1.1, 0.21, tableZ], [0.12, 0.42, 0.12]);
  }
  // a rug in the middle
  const rugX = west ? midX + 1 : midX - 1;
  part(g, box, mat(look.rugEdge ?? 0xe0b23a), [rugX, 0.01, front - 2.4], [2.6, 0.02, 1.6]).castShadow = false;
  part(g, box, mat(look.rug ?? 0xb8473c), [rugX, 0.015, front - 2.4], [2.3, 0.02, 1.3]).castShadow = false;
  return {
    root: g,
    door,
    entry: { x: midX, z: front - 1.1 }, // where you come in
    exit: { x: midX, z: front - 0.6 }, // stand near this to go out
    counter: { x: midX, z: counterZ - 1, yaw: 0 }, // behind the counter, facing the shop
    customer: { x: midX, z: counterZ + 1 },
    bed: { x: bedX, z: bedZ + 0.1 },
    table: { x: west ? tableX + 1.1 : tableX - 1.1, z: tableZ - 0.9, yaw: west ? -Math.PI / 2 : Math.PI / 2 },
    tableAt: { x: tableX, z: tableZ },
    shelf: (x, y) => [midX + x, y, back + 0.25], // a spot on the shelves, for the wares
    // a place on a wall, for what hangs there: { back: x, left: z, right: z } along it, y up
    wall: (side, along, y) => onWall(g, side, side === 'back' ? [along, y, back] : side === 'left' ? [left, y, along] : [right, y, along]),
    left, right, back, front, midX, midZ, counterZ, counterW,
  };
}

// A round window with a frame, like a ship's
function porthole(parent, x, y, z, trim) {
  part(parent, new THREE.TorusGeometry(0.46, 0.07, 6, 16), trim, [x, y, z + 0.04]);
  part(parent, cyl, windowMat, [x, y, z + 0.03], [0.44, 0.04, 0.44], [Math.PI / 2, 0, 0]).castShadow = false;
  part(parent, box, trim, [x, y, z + 0.07], [0.06, 0.9, 0.03]);
  part(parent, box, trim, [x, y, z + 0.07], [0.9, 0.06, 0.03]);
}


// (a lantern's light hangs a little out from it and below, off the wall it is
// on, so the wall by it doesn't burn white and the ground under it gets more)
const OFF_WALL = new THREE.Vector3(0, -0.2, 0.4);

// ctx: world.js's set piece kit, for the farm (src/maps.js HOME.build)
export function buildNpcHomes(ctx) {
  const { root, addCollider } = ctx;
  const anims = [];
  const glows = []; // (lit at night)
  const lamps = npcHomes.lamps = []; // where the yards' lanterns are, in the farm (they get real lights at night: src/build.js addLamps)
  const clocks = []; // (told the hour)
  const outsideMat = bakedMaterial(false);
  const insideMat = bakedMaterial(true);
  for (const [id, home] of Object.entries(NPC_HOMES)) {
    const g = new THREE.Group();
    g.name = `home-${id}`;
    g.position.set(home.x, 0, home.z);
    root.add(g);
    const yard = makeStory();
    const before = glows.length;
    YARDS[id](g, home, { addCollider, anims, glows, story: yard });
    g.updateMatrixWorld(true);
    for (const glow of glows.slice(before)) if (glow.userData.lamp) lamps.push(glow.getWorldPosition(new THREE.Vector3()).add(OFF_WALL));
    bake(g, outsideMat);
    npcHomes.outside[id] = g;
    const look = ROOMS[id];
    const spots = buildRoom(root, id, look, { addCollider, glows });
    const room = makeStory();
    look.props(spots.root, spots, { addCollider, anims, glows, clocks, story: room });
    bake(spots.root, insideMat);
    npcHomes.rooms[id] = spots;
    stories[id] = [yard, room];
    if (last[id]) npcHomes.show(id, last[id]);
  }
  npcHomes.dock = buildDock(root, ctx);
  bake(npcHomes.dock.group, outsideMat);
  buildSignposts(root);
  // night: 0 by day to 1 at night (dayNight.night()): the lights come on as it falls
  npcHomes.setNight = (night) => {
    windowMat.emissiveIntensity = night ? 2.0 * Math.min(1, night * 2) : 0; // (bright enough for the night's bloom: src/gfx/post.js)
    lanternMat.emissiveIntensity = night ? 0.15 + 2.35 * Math.min(1, night * 2) : 0.15;
    for (const glow of glows) {
      glow.visible = night > 0.02;
      glow.material.opacity = 0.55 * Math.min(1, night);
    }
  };
  let hour = -1;
  npcHomes.setHour = (h) => {
    if (Math.abs(h - hour) < 1 / 120) return;
    hour = h;
    for (const clock of clocks) clock.setHour(h);
  };
  npcHomes.animate = (t) => anims.forEach((fn) => fn(t));
}

// The room x, z is in (its neighbour's id), or null
export function roomAt(x, z) {
  for (const [id, r] of Object.entries(NPC_ROOMS)) {
    if (x > r.x0 - 0.5 && x < r.x0 + r.w - 0.5 && z > r.z0 - 0.5 && z < r.z0 + r.d - 0.5) return id;
  }
  return null;
}
