import * as THREE from 'three';
import { HOUSE_ROOM, HOUSE_FIELD, HOUSE_DOOR_IN, inHouseRoom } from '../shared/level.js';
import { TILE_SIZE } from './world.js';
import { detailAll } from './gfx/detail.js';
import { cloneHooked } from './gfx/shading.js';

// ---------- Inside the house ----------
// The room the house's door leads to (HOUSE_ROOM in shared/level.js): out
// past the sea on the farm's own world, where nothing else is, so it is
// farmed, saved and shared like the rest of the farm (main.js). Its floor is
// boards, with a field of earth in the left half to till and plant (crops
// grow there as they do outside); the right half is for living in: a bed, a
// table, a fireplace, a rug, a shelf of books (the recipe book is among them),
// a wardrobe to change clothes at (the menu's Your farmer page, ui/wardrobe.js)
// and a kitchen, a stove and a counter, to cook at (src/cooking.js). The front wall is kept low so the
// camera sees in; the door in the middle of it goes back out.
//
// It is always there on the farm's world (a long way off): main.js puts the
// farmer in and out of it.

const WALL_H = 3.2;
const WALL_T = 0.4;
const FRONT_H = 0.5; // the front wall, as it is drawn (it stops the farmer at full height)
const DOOR_REACH = 1.3;

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const MATS = {
  floor: mat(0xb07a45),
  floorGap: mat(0x7a5230),
  wall: mat(0xe8d6b0),
  beam: mat(0x6e4a2b),
  earth: mat(0x7a5532),
  edging: mat(0x8f6136),
  stone: mat(0x9c9a92),
  stoneDark: mat(0x6c6b66),
  wood: mat(0xa8713f),
  woodDark: mat(0x6e4a2b),
  sheet: mat(0xf4efe4),
  blanket: mat(0x4f7fbf),
  rug: mat(0xb8473c),
  rugEdge: mat(0xe0b23a),
  book: [mat(0x9c3a2e), mat(0x3f6e9c), mat(0x5d8a3a), mat(0xd9a441)],
  window: mat(0xbfe3ff, { emissive: 0xffb84a, emissiveIntensity: 0 }),
  mirror: mat(0xcfe6f0, { roughness: 0.1, metalness: 0.6 }),
  straw: mat(0xe8c66a),
  brass: mat(0xd9a441, { roughness: 0.4, metalness: 0.5 }),
  lantern: mat(0xffe7a3, { emissive: 0xffc35a, emissiveIntensity: 0 }),
  fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  iron: mat(0x4a4f58, { roughness: 0.5, metalness: 0.4 }),
  ironDark: mat(0x33373e, { roughness: 0.5, metalness: 0.4 }),
  copper: mat(0xc0703a, { roughness: 0.4, metalness: 0.5 }),
  board: mat(0xd9b07a),
  honey: mat(0xf0a020),
  dark: new THREE.MeshBasicMaterial({ color: 0x1b140e }),
};
detailAll(MATS, { floorGap: 'none', window: 'glass' }); // (painted detail by name: boards, plaster, stone... src/gfx/detail.js)
const box = new THREE.BoxGeometry(1, 1, 1);

// world: the farm's (world.js buildWorld): the room goes on it, and its walls
// and furniture in its platforms
export function createHouseRoom(world) {
  const root = new THREE.Group();
  root.name = 'house-room';
  world.root.add(root);

  // the room's edges, in world units
  const left = HOUSE_ROOM.x0 * TILE_SIZE - TILE_SIZE / 2;
  const right = left + HOUSE_ROOM.w * TILE_SIZE;
  const back = HOUSE_ROOM.z0 * TILE_SIZE - TILE_SIZE / 2;
  const front = back + HOUSE_ROOM.d * TILE_SIZE;
  const midX = (left + right) / 2;
  const midZ = (back + front) / 2;

  function part(geo, material, x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  // something to bump into (or stand on): { x, y, z, w, h, d }
  function solid({ x, y, z, w, h, d }, extra = {}) {
    world.platforms.push({
      center: new THREE.Vector3(x, y, z),
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ...extra,
    });
  }
  const block = (material, x, y, z, w, h, d) => {
    part(box, material, x, y, z, w, h, d);
    solid({ x, y, z, w, h, d });
  };

  // ---------- Floor, walls and the dark round it ----------
  const around = new THREE.Mesh(new THREE.PlaneGeometry(90, 60).rotateX(-Math.PI / 2), MATS.dark);
  around.position.set(midX, -0.03, midZ);
  root.add(around);
  part(box, MATS.floor, midX, -0.2, midZ, right - left, 0.4, front - back).castShadow = false;
  solid({ x: midX, y: -0.2, z: midZ, w: right - left, h: 0.4, d: front - back }, { ground: true });
  // the gaps between the boards, a row to each tile, the joins staggered
  for (let gz = HOUSE_ROOM.z0; gz < HOUSE_ROOM.z0 + HOUSE_ROOM.d; gz++) {
    const z = gz * TILE_SIZE - TILE_SIZE / 2;
    if (z > back) part(box, MATS.floorGap, midX, 0.002, z, right - left, 0.004, 0.04).castShadow = false;
    for (let x = left + (gz % 2 ? 1.5 : 3); x < right; x += 3) part(box, MATS.floorGap, x, 0.002, z + 0.5, 0.04, 0.004, 1).castShadow = false;
  }
  block(MATS.wall, midX, WALL_H / 2, back - WALL_T / 2, right - left + 2 * WALL_T, WALL_H, WALL_T);
  for (const x of [left - WALL_T / 2, right + WALL_T / 2]) block(MATS.wall, x, WALL_H / 2, midZ, WALL_T, WALL_H, front - back);
  part(box, MATS.wall, midX, FRONT_H / 2, front + WALL_T / 2, right - left + 2 * WALL_T, FRONT_H, WALL_T);
  solid({ x: midX, y: WALL_H / 2, z: front + WALL_T / 2, w: right - left + 2 * WALL_T, h: WALL_H, d: WALL_T });
  // beams along the top of the walls, and posts in the corners and between the windows
  part(box, MATS.beam, midX, WALL_H - 0.1, back + 0.05, right - left, 0.2, 0.12);
  part(box, MATS.beam, midX, FRONT_H + 0.05, front + WALL_T / 2, right - left + 2 * WALL_T, 0.1, WALL_T + 0.04);
  for (const x of [left + 0.06, midX, right - 0.06]) part(box, MATS.beam, x, WALL_H / 2, back + 0.06, 0.16, WALL_H, 0.12);
  for (const x of [left + 0.06, right - 0.06]) part(box, MATS.beam, x, WALL_H - 0.1, midZ, 0.12, 0.2, front - back);
  // windows in the back wall, lit from outside by day and glowing at night
  for (const x of [left + 2.5, left + 6.5, midX + 3, right - 2.5]) {
    part(box, MATS.beam, x, 1.9, back + 0.04, 1.3, 1.1, 0.06);
    part(box, MATS.window, x, 1.9, back + 0.08, 1.1, 0.9, 0.04).castShadow = false;
    part(box, MATS.beam, x, 1.9, back + 0.11, 0.06, 0.9, 0.03);
    part(box, MATS.beam, x, 1.9, back + 0.11, 1.1, 0.06, 0.03);
  }
  // lanterns on the side walls
  for (const x of [left + 0.12, right - 0.12]) {
    for (const z of [back + 2.5, front - 2.5]) {
      part(box, MATS.beam, x, 2.2, z, 0.1, 0.1, 0.1);
      part(box, MATS.lantern, x + Math.sign(midX - x) * 0.1, 2.0, z, 0.2, 0.28, 0.2).castShadow = false;
    }
  }

  // ---------- The door out ----------
  const door = new THREE.Group();
  door.name = 'house-door-in';
  door.position.set(HOUSE_DOOR_IN.x * TILE_SIZE, 0, HOUSE_DOOR_IN.z * TILE_SIZE);
  root.add(door);
  // (its own materials: it fades while the farmer is just behind it, so they can be seen)
  const doorMats = new Map();
  const doorPart = (material, x, y, z, w, h, d) => {
    if (!doorMats.has(material)) doorMats.set(material, cloneHooked(material));
    const mesh = part(box, doorMats.get(material), 0, 0, 0, w, h, d);
    root.remove(mesh);
    mesh.position.set(x, y, z);
    door.add(mesh);
    return mesh;
  };
  for (const x of [-0.6, 0.6]) doorPart(MATS.beam, x, 1.1, 0.1, 0.16, 2.2, 0.3);
  doorPart(MATS.beam, 0, 2.25, 0.1, 1.36, 0.16, 0.3);
  doorPart(MATS.wood, 0, 1.05, 0.12, 1.04, 2.0, 0.08);
  for (const x of [-0.26, 0, 0.26]) doorPart(MATS.woodDark, x, 1.05, 0.06, 0.04, 2.0, 0.02);
  doorPart(MATS.lantern, 0.36, 1.05, 0.02, 0.08, 0.08, 0.06);
  part(box, MATS.rug, HOUSE_DOOR_IN.x, 0.012, front - 0.75, 1.4, 0.02, 0.8).castShadow = false; // a mat to wipe your boots on

  // ---------- The field ----------
  const fLeft = HOUSE_FIELD.x0 * TILE_SIZE - TILE_SIZE / 2;
  const fBack = HOUSE_FIELD.z0 * TILE_SIZE - TILE_SIZE / 2;
  const fW = HOUSE_FIELD.w * TILE_SIZE;
  const fD = HOUSE_FIELD.d * TILE_SIZE;
  part(box, MATS.earth, fLeft + fW / 2, 0.008, fBack + fD / 2, fW, 0.016, fD).castShadow = false;
  // a low board round it
  for (const [x, z, w, d] of [
    [fLeft + fW / 2, fBack - 0.05, fW + 0.2, 0.1],
    [fLeft + fW / 2, fBack + fD + 0.05, fW + 0.2, 0.1],
    [fLeft - 0.05, fBack + fD / 2, 0.1, fD],
    [fLeft + fW + 0.05, fBack + fD / 2, 0.1, fD],
  ]) {
    part(box, MATS.edging, x, 0.06, z, w, 0.12, d).castShadow = false;
  }

  // ---------- Living: the right half ----------
  // the bed, in the back corner
  const bedX = right - 1.4;
  const bedZ = back + 1.4;
  block(MATS.woodDark, bedX, 0.25, bedZ, 2, 0.5, 2.4);
  part(box, MATS.sheet, bedX, 0.56, bedZ + 0.15, 1.86, 0.14, 2.1);
  part(box, MATS.blanket, bedX, 0.62, bedZ + 0.45, 1.9, 0.1, 1.5);
  part(box, MATS.sheet, bedX, 0.7, bedZ - 0.75, 1.3, 0.16, 0.5);
  part(box, MATS.woodDark, bedX, 0.7, back + 0.15, 2, 0.9, 0.12);
  // the fireplace, in the back wall, with a fire that flickers
  const fireX = midX + 6;
  block(MATS.stone, fireX, 0.9, back + 0.45, 2, 1.8, 0.9);
  part(box, MATS.stoneDark, fireX, 1.85, back + 0.5, 2.2, 0.15, 1);
  part(box, MATS.stone, fireX, 2.6, back + 0.3, 1.2, 1.4, 0.6);
  part(box, MATS.dark, fireX, 0.55, back + 0.91, 1.1, 0.8, 0.02).castShadow = false;
  const fire = part(box, MATS.fire, fireX, 0.4, back + 0.93, 0.7, 0.4, 0.02);
  fire.castShadow = false;
  // the table, with a stool either side
  const tableX = midX + 5;
  const tableZ = midZ + 0.5;
  part(box, MATS.wood, tableX, 0.78, tableZ, 1.8, 0.1, 1.1);
  for (const [x, z] of [[-0.75, -0.42], [0.75, -0.42], [-0.75, 0.42], [0.75, 0.42]]) part(box, MATS.woodDark, tableX + x, 0.37, tableZ + z, 0.1, 0.74, 0.1);
  solid({ x: tableX, y: 0.42, z: tableZ, w: 1.8, h: 0.84, d: 1.1 });
  for (const s of [-1, 1]) {
    part(box, MATS.wood, tableX + s * 1.35, 0.45, tableZ, 0.5, 0.08, 0.5);
    part(box, MATS.woodDark, tableX + s * 1.35, 0.21, tableZ, 0.12, 0.42, 0.12);
  }
  part(box, MATS.lantern, tableX + 0.4, 0.92, tableZ - 0.1, 0.16, 0.2, 0.16).castShadow = false;
  // a rug in front of the fire
  part(box, MATS.rugEdge, fireX, 0.01, back + 2.3, 2.6, 0.02, 1.6).castShadow = false;
  part(box, MATS.rug, fireX, 0.015, back + 2.3, 2.3, 0.02, 1.3).castShadow = false;
  // a shelf of books on the right wall
  const shelfZ = front - 2.2;
  block(MATS.woodDark, right - 0.35, 1.1, shelfZ, 0.5, 2.2, 1.6);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const h = 0.32 + ((i * 7 + row * 3) % 4) * 0.04;
      part(box, MATS.book[(i + row) % 4], right - 0.62, 0.35 + row * 0.7 + h / 2, shelfZ - 0.6 + i * 0.24, 0.08, h, 0.18).castShadow = false;
    }
  }

  // a wardrobe against the right wall, between the bed and the shelf: two
  // doors (a mirror on one), little brass knobs, and a straw hat left on top
  const wardrobe = new THREE.Group();
  wardrobe.name = 'wardrobe';
  root.add(wardrobe);
  const wPart = (material, x, y, z, w, h, d) => {
    const mesh = part(box, material, x, y, z, w, h, d);
    root.remove(mesh);
    wardrobe.add(mesh);
    return mesh;
  };
  const wardZ = back + 4.6;
  const wardX = right - 0.42;
  wPart(MATS.wood, wardX, 1.12, wardZ, 0.7, 2.0, 1.4);
  wPart(MATS.woodDark, wardX, 2.17, wardZ, 0.8, 0.1, 1.5); // the top's lip
  for (const z of [-0.6, 0.6]) for (const x of [-0.26, 0.26]) wPart(MATS.woodDark, wardX + x, 0.06, wardZ + z, 0.1, 0.12, 0.1); // its feet
  wPart(MATS.woodDark, wardX - 0.36, 1.12, wardZ, 0.02, 1.9, 0.03); // the gap between the doors
  for (const s of [-1, 1]) {
    wPart(MATS.woodDark, wardX - 0.355, 1.12, wardZ + s * 0.34, 0.02, 1.74, 0.56); // a door's panel
    wPart(MATS.brass, wardX - 0.38, 1.15, wardZ + s * 0.08, 0.04, 0.07, 0.07).castShadow = false; // its knob
  }
  wPart(MATS.mirror, wardX - 0.37, 1.3, wardZ + 0.34, 0.01, 1.1, 0.4).castShadow = false;
  wPart(MATS.straw, wardX, 2.26, wardZ - 0.25, 0.5, 0.03, 0.5); // a hat: brim and crown
  wPart(MATS.straw, wardX, 2.34, wardZ - 0.25, 0.28, 0.14, 0.28);
  wPart(MATS.rug, wardX, 2.29, wardZ - 0.25, 0.3, 0.04, 0.3);
  solid({ x: wardX, y: 1.1, z: wardZ, w: 0.8, h: 2.2, d: 1.5 });
  const wardrobeAt = { x: wardX - 1.1, z: wardZ };

  // the kitchen, against the back wall between the field and the fire: a
  // black iron stove (a pot on it, its pipe up the wall, the fire glowing
  // through the little window in its door) and a counter with a chopping
  // board and jars on it
  const kitchen = new THREE.Group();
  kitchen.name = 'kitchen';
  root.add(kitchen);
  const kPart = (...args) => {
    const mesh = part(...args);
    root.remove(mesh);
    kitchen.add(mesh);
    return mesh;
  };
  const stoveX = midX + 1.2;
  const counterX = midX + 2.45;
  kPart(box, MATS.iron, stoveX, 0.45, back + 0.4, 1, 0.9, 0.7);
  kPart(box, MATS.ironDark, stoveX, 0.92, back + 0.4, 1.04, 0.05, 0.74);
  kPart(box, MATS.ironDark, stoveX, 0.04, back + 0.4, 1.04, 0.08, 0.74);
  kPart(box, MATS.ironDark, stoveX, 0.45, back + 0.76, 0.6, 0.42, 0.02);
  const glow = kPart(box, MATS.fire, stoveX, 0.45, back + 0.775, 0.3, 0.14, 0.01);
  glow.castShadow = false;
  kPart(box, MATS.ironDark, stoveX, 2.1, back + 0.2, 0.18, 2.4, 0.18); // the pipe
  kPart(box, MATS.copper, stoveX - 0.2, 1.06, back + 0.4, 0.36, 0.24, 0.36); // the pot
  const lid = kPart(box, MATS.copper, stoveX - 0.2, 1.19, back + 0.4, 0.4, 0.03, 0.4);
  const pot = { x: stoveX - 0.2, y: 1.22, z: back + 0.4 };
  let rattle = 0; // seconds left of the lid's rattle (something just cooked)
  let lastT = 0;
  kPart(box, MATS.ironDark, stoveX + 0.08, 1.12, back + 0.4, 0.3, 0.03, 0.03); // its handle
  solid({ x: stoveX, y: 0.45, z: back + 0.4, w: 1, h: 0.9, d: 0.7 });
  kPart(box, MATS.wood, counterX, 0.43, back + 0.4, 1.4, 0.86, 0.7);
  kPart(box, MATS.woodDark, counterX, 0.43, back + 0.76, 1.3, 0.76, 0.02);
  for (const x of [-0.35, 0.35]) kPart(box, MATS.wood, counterX + x, 0.43, back + 0.775, 0.56, 0.66, 0.02);
  kPart(box, MATS.floor, counterX, 0.89, back + 0.4, 1.46, 0.06, 0.74);
  kPart(box, MATS.board, counterX - 0.25, 0.94, back + 0.45, 0.5, 0.04, 0.34);
  kPart(box, MATS.honey, counterX + 0.3, 1.02, back + 0.3, 0.16, 0.2, 0.16);
  kPart(box, MATS.sheet, counterX + 0.52, 1.0, back + 0.36, 0.14, 0.16, 0.14);
  kPart(box, MATS.woodDark, counterX + 0.3, 1.13, back + 0.3, 0.17, 0.03, 0.17);
  solid({ x: counterX, y: 0.45, z: back + 0.4, w: 1.4, h: 0.9, d: 0.7 });
  const cookAt = { x: (stoveX + counterX) / 2, z: back + 1.35 };

  let doorFade = 1;

  // a warm light over the room at night
  const light = new THREE.PointLight(0xffc27a, 0, 22, 1.2);
  light.position.set(midX, 2.8, midZ);
  root.add(light);

  return {
    // Is pos (world units) in the room?
    inside: (pos) => inHouseRoom(pos.x / TILE_SIZE, pos.z / TILE_SIZE),
    // Where the farmer stands on coming in: just inside the door
    entry: () => ({ x: HOUSE_DOOR_IN.x * TILE_SIZE, z: front - 0.9 }),
    // the door out, to tap
    door,
    exitInReach: (pos) => pos.y < 2.2 && Math.hypot(pos.x - HOUSE_DOOR_IN.x * TILE_SIZE, pos.z - (front - 0.6)) < DOOR_REACH,
    // the kitchen (the stove and the counter, to tap), where to stand at it,
    // and is pos close enough to cook (or to the shelf, to read the recipe book)?
    kitchen,
    kitchenSpot: () => ({ ...cookAt }),
    kitchenInReach: (pos) => pos.y < 2.2 && Math.abs(pos.x - cookAt.x) < 1.6 && pos.z < cookAt.z + 0.6,
    shelfInReach: (pos) => pos.y < 2.2 && pos.x > right - 1.6 && Math.abs(pos.z - shelfZ) < 1.2,
    // something was just cooked: the pot's lid rattles (where its steam goes: potSpot)
    cooked() {
      rattle = 0.6;
    },
    potSpot: () => ({ ...pot }),
    // the wardrobe (to tap), where to stand at it, and is pos close enough to change clothes?
    wardrobe,
    wardrobeSpot: () => ({ ...wardrobeAt }),
    wardrobeInReach: (pos) => pos.y < 2.2 && pos.x > right - 2.2 && Math.abs(pos.z - wardZ) < 1.2,
    // night: 0 by day, 1 at night
    setNight(night) {
      MATS.lantern.emissiveIntensity = night * 2.5; // (for the night's bloom: src/gfx/post.js)
      doorMats.get(MATS.lantern).emissiveIntensity = night * 2.5;
      MATS.window.emissiveIntensity = night * 0.5;
      light.intensity = night * 6;
    },
    // t: seconds; pos: the farmer (or each farmer at the screen)
    update(t, pos) {
      const behind = [pos].flat().some((p) => p.z < door.position.z && p.z > door.position.z - 2.5 && Math.abs(p.x - door.position.x) < 1.5);
      doorFade += ((behind ? 0.3 : 1) - doorFade) * 0.15;
      for (const m of doorMats.values()) {
        m.opacity = doorFade;
        m.transparent = doorFade < 0.99;
        m.depthWrite = !m.transparent;
      }
      fire.scale.y = 0.4 * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3));
      glow.scale.y = 0.14 * (0.8 + 0.2 * Math.sin(t * 7.1) * Math.sin(t * 3.7));
      fire.position.y = 0.2 + fire.scale.y / 2;
      rattle = Math.max(0, rattle - Math.min(0.1, t - lastT));
      lastT = t;
      lid.position.y = pot.y - 0.03 + (rattle > 0 ? Math.abs(Math.sin(t * 40)) * 0.05 * (rattle / 0.6) : 0);
      lid.rotation.z = rattle > 0 ? Math.sin(t * 33) * 0.12 * (rattle / 0.6) : 0;
    },
  };
}
