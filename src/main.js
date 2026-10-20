import * as THREE from 'three';
import { ITEMS } from './items.js';
import { createInventory } from './inventory.js';
import { createShop } from './shop.js';
import { createMerchant, inReach as atStall } from './merchant.js';
import { createFarmer, damp, HOE_SWING_TIME } from './character.js';
import { Remotes } from './remotes.js';
import { Connection } from './net/connection.js';
import { showCodeInAddress } from './net/lobby.js';
import { Splash } from './ui/splash.js';
import { Hud } from './ui/hud.js';
import './ui/ui.css';
import { TICK_DT, PLAYER_COLORS } from '../shared/constants.js';
import { C, S, STATEF } from '../shared/protocol.js';
import { SPOT_KINDS, RARE, TREE, mostWood, GROUND_STAND_Y } from '../shared/level.js';
import { CROPS, createCropView } from './crops.js';
import { createDayNight, DAY_LENGTH_SECONDS } from './daynight.js';
import { buildWorld, tileKeyFor, TILE_SIZE, windTime, leafMats, blobGeo, addDecor } from './world.js';
import { HOME, wildMap } from './maps.js';
import { islandFor } from '../shared/worldgen.js';

// ---------- Renderer / Scene / Camera ----------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 90);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

// Angled follow camera. It keeps a constant offset from a look-at point that
// eases toward the player's feet each frame (see updateCamera). Vertically it
// tracks the last ground the player stood on rather than every jump, so the
// view doesn't bob. Adjust CAM_HEIGHT / CAM_TILT_DEG / CAM_FOLLOW_* to taste.
const CAM_HEIGHT = 9;
const CAM_TILT_DEG = 45;
const CAM_OFFSET = new THREE.Vector3(
  0,
  CAM_HEIGHT,
  CAM_HEIGHT * Math.tan(THREE.MathUtils.degToRad(CAM_TILT_DEG))
);
const CAM_FOLLOW_XZ = 6; // higher = snappier horizontal follow
const CAM_FOLLOW_Y = 3; // vertical follow is gentler
const camTarget = new THREE.Vector3(); // point the camera looks at, set once the player exists

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

// Day/night cycle (see daynight.js) drives the sun, hemisphere light, sky and
// fog over time. Start hour can be overridden for testing with ?hour=21.
const startHour = Number(new URLSearchParams(location.search).get('hour') ?? 6);
const dayNight = createDayNight({ scene, sun, hemi, startHour: Number.isFinite(startHour) ? startHour : 6 });

// ---------- Worlds ----------
// Two places to be (maps.js, built by world.js): your farm's island, and the
// wild island of the lobby you are in, grown from its seed
// (shared/worldgen.js). The farm is built once; a wild island when you first
// go to a lobby on it (the last one is kept, for going back). The one you are
// on is in the scene; `world` is the one under your feet.
const worlds = { home: buildWorld(HOME) };
let world = worlds.home;
scene.add(world.root);

// name: 'home' or 'wild' (seed: which wild island)
function enterWorld(name, seed) {
  let stale = null; // the wild island we will not be back on
  if (name === 'wild' && worlds.wild?.name !== `wild:${islandFor(seed).seed}`) {
    stale = worlds.wild;
    worlds.wild = buildWorld(wildMap(islandFor(seed)));
  }
  if (worlds[name] !== world) {
    scene.remove(world.root);
    world = worlds[name];
    scene.add(world.root);
  }
  stale?.dispose(); // (out of the scene by now)
}

// The sea around every island; it fades into the fog toward the horizon
const WATER_Y = -0.6;
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x2f8fbf, roughness: 0.25, metalness: 0.1 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_Y;
water.receiveShadow = true;
scene.add(water);

// ---------- Inventory ----------
// Toolbar + backpack UI (see inventory.js). Opening the backpack pauses
// player input, so drop any keys that were held at that moment. The backpack
// goes everywhere with you, and is saved with the farm (see Saving).
const inventory = createInventory({ onOpenChange: (open) => open && keys.clear() });

// ---------- The merchant ----------
// Behind the stall on the farm (merchant.js): E at the counter opens the shop
// (shop.js) to buy seeds and sell what you grew or found. They live on the
// farm's island, so they are only in the scene at home.
const merchant = createMerchant();
worlds.home.root.add(merchant.root);

// ---------- Farming: hoe tool + tillable soil ----------
const farmTiles = new Map(); // "gridX,gridZ" -> tilled tile mesh

function tillTileAt(x, z) {
  const key = tileKeyFor(x, z);
  if (farmTiles.has(key)) return false; // already tilled

  const [gx, gz] = key.split(',').map(Number);
  const geo = new THREE.BoxGeometry(TILE_SIZE * 0.92, 0.06, TILE_SIZE * 0.92);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(gx * TILE_SIZE, 0.03, gz * TILE_SIZE);
  mesh.receiveShadow = true;
  scene.add(mesh);
  farmTiles.set(key, mesh);
  worlds.home.clearFoliageOnTile(key);
  return true;
}

// Crops grow on tilled tiles in real time; see crops.js for the models.
const crops = new Map(); // "gridX,gridZ" -> { cropId, age, view, ripe, pop }

// age: seconds it has been growing already (a crop someone planted before we came)
function plantAt(x, z, cropId, age = 0) {
  const key = tileKeyFor(x, z);
  if (!farmTiles.has(key) || crops.has(key)) return false;

  const view = createCropView(cropId);
  view.group.position.copy(farmTiles.get(key).position).setY(0.06); // on top of the soil
  view.group.rotation.y = Math.random() * Math.PI * 2;
  if (cropId === 'sunflower') view.group.rotation.y = 0; // keep the bloom facing the camera
  scene.add(view.group);
  crops.set(key, { cropId, age, view, ripe: false, pop: 0 });
  return true;
}

function removeCrop(key) {
  const crop = crops.get(key);
  if (!crop) return;
  scene.remove(crop.view.group);
  crops.delete(key);
}

// Returns true if there was a ripe crop here (even if the bag was too full to take it)
function harvestAt(x, z) {
  const key = tileKeyFor(x, z);
  const crop = crops.get(key);
  if (!crop?.ripe) return false;
  if (inventory.add(CROPS[crop.cropId].produce)) removeCrop(key);
  return true;
}

// Bare ground: untilled, nothing growing (going out to a lobby, or before the
// saved farm is put back)
function resetFarm() {
  for (const key of [...crops.keys()]) removeCrop(key);
  for (const mesh of farmTiles.values()) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  farmTiles.clear();
  worlds.home.restoreFoliage();
}

// `growDt` is game-clock seconds (growth); `dt` is real seconds (animation)
function updateCrops(dt, growDt, t) {
  for (const crop of crops.values()) {
    if (!crop.ripe) {
      crop.age += growDt;
      const progress = Math.min(crop.age / CROPS[crop.cropId].growTime, 1);
      crop.view.setProgress(progress);
      if (progress >= 1) {
        crop.ripe = true;
        crop.pop = 1; // little bounce when it ripens
      }
    }
    // Ripe crops pop once, then sway gently so they're easy to spot
    crop.pop += (0 - crop.pop) * damp(6, dt);
    const s = 1 + Math.sin(crop.pop * Math.PI) * 0.25;
    crop.view.group.scale.set(s, s, s);
    crop.view.group.rotation.z = crop.ripe ? Math.sin(t * 2 + crop.view.group.position.x) * 0.04 : 0;
  }
}

// ---------- Lobby resource spots ----------
// In an online lobby the island has spots (shared/level.js) where things grow
// back: berry bushes and mushrooms to gather with E, and treasures out in the
// meadow and up on the ledges to walk into. The lobby rolls what is on each
// spot and decides who got there first; the page draws them and asks.
const spots = new Map(); // id -> { kind, use, x, y, z, item, count, view, pending, retryAt }
const TOUCH_RADIUS = 0.6;
const GATHER_REACH = 1.6;
const GATHER_VERB = { bush: 'Pick berries', mushroom: 'Pick mushrooms' };

const treasureGeo = new THREE.IcosahedronGeometry(0.35, 0);
const itemMats = new Map(); // item -> material, shared by every treasure showing it
function itemMat(item) {
  if (!itemMats.has(item)) {
    // A spot holding an item this page doesn't know yet (a newer server): draw
    // it as a plain treasure instead of losing every spot.
    const color = ITEMS[item]?.color ?? ITEMS.coin.color;
    itemMats.set(item, new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.4,
    }));
  }
  return itemMats.get(item);
}
const berryGeo = new THREE.SphereGeometry(0.085, 6, 5);
const berryMat = new THREE.MeshStandardMaterial({ color: 0xd8344f, roughness: 0.35 });
const stalkGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.28, 7).translate(0, 0.14, 0);
const capGeo = new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.25, 0);
const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.8 });
const capMat = new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.6 });
// A golden glint over a spot with something rare on it
const glintGeo = new THREE.OctahedronGeometry(0.13, 0);
const glintMat = new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffc400, emissiveIntensity: 1 });

function makeSpotView(spot) {
  const group = new THREE.Group();
  group.position.set(spot.x, spot.y, spot.z);
  let content; // what comes and goes: the berries, the mushrooms, the treasure
  if (spot.kind === 'bush') {
    // The bush always stands; only its berries come and go
    const leaf = leafMats[spot.id % leafMats.length];
    addDecor(blobGeo, leaf, 0, 0.42, 0, 0.55, 0.45, 0.55, group);
    addDecor(blobGeo, leaf, 0.38, 0.3, 0.12, 0.36, 0.3, 0.36, group);
    content = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4;
      const berry = new THREE.Mesh(berryGeo, berryMat);
      berry.position.set(Math.cos(a) * 0.5, 0.3 + (i % 3) * 0.17, Math.sin(a) * 0.45 + 0.05);
      content.add(berry);
    }
  } else if (spot.kind === 'mushroom') {
    content = new THREE.Group();
    for (const [x, z, k] of [[0, 0, 1], [0.28, 0.12, 0.65], [-0.2, 0.2, 0.5]]) {
      const shroom = new THREE.Group();
      shroom.add(new THREE.Mesh(stalkGeo, stalkMat), new THREE.Mesh(capGeo, capMat));
      shroom.position.set(x, 0, z);
      shroom.scale.setScalar(k);
      content.add(shroom);
    }
  } else {
    content = new THREE.Mesh(treasureGeo, itemMat('coin'));
  }
  group.add(content);
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.position.y = spot.use === 'touch' ? 0.75 : 1.05;
  group.add(glint);
  group.traverse((obj) => obj.isMesh && (obj.castShadow = true));
  scene.add(group);
  return { group, content, glint, glintY: glint.position.y };
}

function showSpot(spot) {
  const { content, glint } = spot.view;
  const has = !!spot.item && !spot.pending;
  content.visible = has;
  glint.visible = has && !!RARE[spot.item];
  if (spot.use === 'touch' && spot.item) {
    content.material = itemMat(spot.item);
    content.scale.setScalar(RARE[spot.item] ? 1.3 : 1);
  }
}

// the lobby's spots: [[id, kind, x, y, z, item, count], ...]
function setSpots(list) {
  clearSpots();
  for (const [id, kind, x, y, z, item, count] of list) {
    const use = SPOT_KINDS[kind]?.use; // a spot from a newer server: skip it, don't lose the island
    if (!use) continue;
    const spot = { id, kind, use, x, y, z, item, count, pending: false, retryAt: 0 };
    spot.view = makeSpotView(spot);
    showSpot(spot);
    spots.set(id, spot); // keyed by id, so the lobby's messages find the right spot
  }
}

function clearSpots() {
  for (const spot of spots.values()) scene.remove(spot.view.group);
  spots.clear();
}

// Ask the lobby for what is on a spot. It vanishes at once so it feels
// instant; TAKEN (into the backpack) or DENY (it comes back) settles it.
function takeSpot(spot) {
  if (!spot.item || spot.pending || performance.now() < spot.retryAt) return;
  if (!inventory.canAdd(spot.item, spot.count)) {
    inventory.add(spot.item, spot.count); // (says "Inventory full")
    spot.retryAt = performance.now() + 1000;
    return;
  }
  spot.pending = true;
  showSpot(spot);
  net?.send({ t: C.TAKE, id: spot.id });
}

// the bush or mushrooms within reach with something on them, nearest first
function gatherSpotInReach() {
  let best = null;
  let bestD = GATHER_REACH;
  for (const spot of spots.values()) {
    if (spot.use !== 'gather' || !spot.item || spot.pending) continue;
    const d = Math.hypot(spot.x - player.position.x, spot.z - player.position.z);
    if (d < bestD && Math.abs(player.position.y - GROUND_STAND_Y - spot.y) < 1.2) {
      best = spot;
      bestD = d;
    }
  }
  return best;
}

const _treasurePos = new THREE.Vector3();
function updateSpots(dt, t) {
  for (const spot of spots.values()) {
    const { content, glint, glintY } = spot.view;
    if (glint.visible) {
      glint.rotation.y += dt * 3;
      glint.position.y = glintY + Math.sin(t * 3 + spot.id) * 0.08;
    }
    if (spot.use !== 'touch') continue;
    // Treasures bob and spin, and are picked up by walking into them
    content.position.y = Math.sin(t * 2 + spot.x) * 0.15;
    content.rotation.y += dt * 1.5;
    _treasurePos.set(spot.x, spot.y + content.position.y, spot.z);
    if (content.visible && player.position.distanceTo(_treasurePos) < TOUCH_RADIUS) takeSpot(spot);
  }
  const tree = inventory.selectedId() === 'axe' ? treeInReach() : null;
  const near = gatherSpotInReach();
  if (tree) hud.setPrompt(`E  Chop${chop.id === tree.id && chop.hits ? `  ${chop.hits}/${TREE.hits}` : ' (hold to keep going)'}`);
  else hud.setPrompt(near ? `E  ${GATHER_VERB[near.kind]}` : '');
}

// ---------- Chopping trees (lobbies) ----------
// With the axe in hand, E next to a tree swings at it (hold E to keep
// swinging). Each swing shakes it; the last of TREE.hits asks the lobby,
// which says who felled it (FELLED: down for everyone, wood to whoever, more
// from a bigger tree) and
// when it has grown back (REGROWN). Trees are named by their number in the
// island's list (world.js), the same on every page.
const CHOP_REACH = 1.3; // from the bark
const SWING_GAP = 0.15; // seconds between swings, so everyone else sees each one
const chop = { id: -1, hits: 0, swingAt: -1, nextSwing: 0, pending: new Set() };

// the standing tree within reach, nearest first
function treeInReach() {
  if (!player.onGround || Math.abs(player.position.y - GROUND_STAND_Y) > 0.6) return null;
  let best = null;
  let bestD = CHOP_REACH;
  for (const tree of world.trees) {
    if (tree.state !== 'up' || chop.pending.has(tree.id)) continue;
    const d = Math.hypot(tree.x - player.position.x, tree.z - player.position.z) - 0.25 * tree.scale;
    if (d < bestD) {
      best = tree;
      bestD = d;
    }
  }
  return best;
}

// Swing at the tree in reach (if the last swing is done). False: no tree here.
function swingAxe() {
  const tree = treeInReach();
  if (!tree) return false;
  const now = clock.elapsedTime;
  if (anim.swing >= 0 || now < chop.nextSwing) return true;
  if (!inventory.canAdd('wood', mostWood(tree.scale))) {
    inventory.add('wood', mostWood(tree.scale)); // (says "Inventory full")
    chop.nextSwing = now + 1;
    return true;
  }
  if (chop.id !== tree.id) Object.assign(chop, { id: tree.id, hits: 0 });
  anim.facing = Math.atan2(tree.x - player.position.x, tree.z - player.position.z); // face the trunk
  farmer.swing();
  chop.swingAt = now;
  chop.nextSwing = now + HOE_SWING_TIME + SWING_GAP;
  return true;
}

function updateChopping() {
  // The blade bites partway through the swing, on the way down
  if (chop.swingAt >= 0 && clock.elapsedTime - chop.swingAt >= HOE_SWING_TIME * 0.6) {
    chop.swingAt = -1;
    const tree = world.trees[chop.id];
    if (tree?.state === 'up' && !chop.pending.has(tree.id)) {
      world.shakeTree(tree.id, player.position);
      if (++chop.hits >= TREE.hits) {
        chop.pending.add(tree.id);
        chop.hits = 0;
        const r = (v) => Math.round(v * 100) / 100;
        net?.send({ t: C.CHOP, id: tree.id, x: r(tree.x), z: r(tree.z), size: r(tree.scale) });
      }
    }
  }
  if (keys.has('KeyE') && inventory.selectedId() === 'axe') swingAxe(); // holding E keeps chopping
}

function resetChopping() {
  Object.assign(chop, { id: -1, hits: 0, swingAt: -1 });
  chop.pending.clear();
}

// ---------- Player ----------
const player = {
  radius: 0.5,
  height: 1.6,
  position: new THREE.Vector3(0, 2, 4),
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
};

// Ground level (top of the base ground box) is y = 0, so the player's
// resting height when standing on bare ground (GROUND_STAND_Y, shared/level.js)
// is half their collision height.

// ---------- Character model ----------
// The farmer (character.js). Collision still uses the simple box in `player`;
// the model is purely visual. Everyone else in the game wears the same model
// in their own shirt color (remotes.js).
const farmer = createFarmer({ height: player.height });
const playerMesh = farmer.root; // positioned at player.position (collision center)
const hoeGroup = farmer.hoe;
const anim = farmer.anim;
scene.add(playerMesh);

function animateCharacter(dt, moving) {
  farmer.animate(dt, {
    moving,
    onGround: player.onGround,
    targetYaw: Math.atan2(player.velocity.x, player.velocity.z),
    time: clock.elapsedTime,
  });
}

function startHoeSwing() {
  farmer.swing();
}

camTarget.set(player.position.x, player.position.y - player.height / 2, player.position.z);
let camGroundY = camTarget.y; // feet height the camera tracks vertically

function updateCamera(dt) {
  const feetY = player.position.y - player.height / 2;
  // Track the ground we last stood on; only chase the player downward if they
  // drop below it (falling off a ledge), so normal jumps don't move the view.
  if (player.onGround || feetY < camGroundY) camGroundY = feetY;

  const kXZ = damp(CAM_FOLLOW_XZ, dt);
  camTarget.x += (player.position.x - camTarget.x) * kXZ;
  camTarget.z += (player.position.z - camTarget.z) * kXZ;
  camTarget.y += (camGroundY - camTarget.y) * damp(CAM_FOLLOW_Y, dt);

  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
}
updateCamera(0);

// Jump the camera to the player at once (a teleport) instead of panning over
function snapCamera() {
  camGroundY = player.position.y - player.height / 2;
  camTarget.set(player.position.x, camGroundY, player.position.z);
  updateCamera(0);
}

// While the title screen is up the camera circles the island slowly
const MENU_CAM = { radius: 24, height: 13, speed: 0.06, look: new THREE.Vector3(0, 1.5, -5) };
function updateMenuCamera(t) {
  const a = t * MENU_CAM.speed;
  camera.position.set(
    MENU_CAM.look.x + Math.sin(a) * MENU_CAM.radius,
    MENU_CAM.height,
    MENU_CAM.look.z + Math.cos(a) * MENU_CAM.radius
  );
  camera.lookAt(MENU_CAM.look);
}

// ---------- Input ----------
// The keys drive the farmer only while nothing else has the keyboard: the
// title screen, the backpack, the chat line or the pause menu.
const keys = new Set();
const inputBlocked = () => !splash.hidden || inventory.isOpen() || shop.isOpen() || hud.isTyping() || hud.isPaused();
window.addEventListener('keydown', (e) => {
  if (inputBlocked()) return;
  keys.add(e.code);
  if (e.code === 'KeyE' && !e.repeat) useAction();
});

// E: in a lobby, chop the tree in reach with the axe in hand, else gather
// what is in reach. At home: trade at the merchant's counter, else harvest a
// ripe crop underfoot, otherwise use the selected toolbar item. Farming only
// works while standing on bare ground (not on a raised platform).
function useAction() {
  if (place === 'lobby') {
    if (inventory.selectedId() === 'axe' && swingAxe()) return;
    const spot = gatherSpotInReach();
    if (spot) {
      takeSpot(spot);
      anim.squash = 0.15; // little crouch to pick
    } else if (inventory.selectedId() === 'hoe' || ITEMS[inventory.selectedId()]?.plants) {
      inventory.notify('This is not your land: farm at home');
    }
    return;
  }
  if (atStall(player.position)) {
    shop.open();
    return;
  }
  if (!player.onGround || Math.abs(player.position.y - GROUND_STAND_Y) > 0.05) return;
  const { x, z } = player.position;
  if (harvestAt(x, z)) return;

  const held = inventory.selectedId();
  if (held === 'hoe') {
    tillTileAt(x, z);
    startHoeSwing();
  } else if (held === 'axe') {
    inventory.notify('Leave the farm\'s trees be: chop wood in a lobby');
  } else if (ITEMS[held]?.plants) {
    if (plantAt(x, z, ITEMS[held].plants)) {
      inventory.consumeSelected();
      anim.squash = 0.15; // little crouch to plant
    } else if (!farmTiles.has(tileKeyFor(x, z))) {
      inventory.notify('Seeds go on tilled soil');
    }
  }
}
window.addEventListener('keyup', (e) => keys.delete(e.code));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Physics constants ----------
const GRAVITY = -28;
const MOVE_SPEED = 7;
const JUMP_SPEED = 10;

// ---------- Collision helpers ----------
// Very simple AABB-vs-capsule (treated as a box) resolution, axis by axis.
// Walking into a ledge no higher than STEP_HEIGHT steps up onto it (out of the
// wild island's pond, say); anything taller takes a jump.
const STEP_HEIGHT = 0.5;
function resolveCollisions(prevY, wasOnGround) {
  player.onGround = false;
  const p = player.position;
  const r = player.radius;
  const halfH = player.height / 2;

  const pMin = new THREE.Vector3(p.x - r, p.y - halfH, p.z - r);
  const pMax = new THREE.Vector3(p.x + r, p.y + halfH, p.z + r);

  for (const box of world.platforms) {
    const overlapX = pMin.x < box.max.x && pMax.x > box.min.x;
    const overlapY = pMin.y < box.max.y && pMax.y > box.min.y;
    const overlapZ = pMin.z < box.max.z && pMax.z > box.min.z;

    if (overlapX && overlapY && overlapZ) {
      // Was the player above the box last frame? -> landing on top
      const prevBottom = prevY - halfH;
      const stepUp = wasOnGround && box.max.y - prevBottom <= STEP_HEIGHT;
      if ((prevBottom >= box.max.y - 0.05 || stepUp) && player.velocity.y <= 0) {
        p.y = box.max.y + halfH;
        player.velocity.y = 0;
        player.onGround = true;
        continue;
      }

      // Otherwise push out along the smallest overlap axis (simple resolution)
      const overlapXAmt = Math.min(pMax.x - box.min.x, box.max.x - pMin.x);
      const overlapZAmt = Math.min(pMax.z - box.min.z, box.max.z - pMin.z);

      if (overlapXAmt < overlapZAmt) {
        p.x += p.x < box.center.x ? -overlapXAmt : overlapXAmt;
      } else {
        p.z += p.z < box.center.z ? -overlapZAmt : overlapZAmt;
      }
    }
  }
}

// ---------- Places: the title screen, home, an online lobby ----------
// Home is your own farm, all in this page. A lobby is an online place
// (shared/room.js on the game server) where farmers drop in to gather what
// grows there; nothing of the farm comes along but the backpack.
let place = 'title'; // 'title' | 'home' | 'lobby'
let net = null; // the Connection while in (or on the way to) a lobby
let session = null; // { code, room } once a lobby has welcomed us
let myId = 0;
let sendTimer = 0;
let farmOnScreen = false; // the home farm's soil and crops are in the scene
const LOBBY_DAWN = 9; // a lobby's day starts mid-morning, in good light

const remotes = new Remotes(scene);
const hud = new Hud({
  onTravel: () => splash.show({ from: 'home' }),
  onHome: () => goHome(),
  onChat: (text) => net?.send({ t: C.CHAT, text }),
  isBlocked: () => inventory.isOpen() || shop.isOpen() || !splash.hidden,
});
// (after the HUD: its key handler goes first, see shop.js)
const shop = createShop({
  inventory,
  onOpenChange: (open) => (open ? keys.clear() : saveGame()), // a trade is saved as soon as you walk off
});
const splash = new Splash({ onPlay: joinLobby, onHome: () => goHome() });

function putDown({ x, y, z }) {
  player.position.set(x, y, z);
  player.velocity.set(0, 0, 0);
  snapCamera();
}
const arrival = () => ({ x: world.spawn.x, y: GROUND_STAND_Y, z: world.spawn.z });

function goHome() {
  if (net) {
    net.leave();
    net = null;
  }
  const from = place;
  if (from === 'lobby') leaveLobbyWorld();
  place = 'home';
  enterWorld('home');
  farmer.setShirt(PLAYER_COLORS[0]);
  if (!farmOnScreen) {
    showFarm(homeFarm);
    farmOnScreen = true;
  }
  splash.hide();
  hud.showHome();
  if (from !== 'home') putDown(arrival());
}

function leaveLobbyWorld() {
  session = null;
  myId = 0;
  clearSpots();
  resetChopping();
  remotes.clear();
  keys.clear();
  showCodeInAddress('');
}

function joinLobby({ name, code }) {
  net?.leave();
  splash.setStatus('Walking over…');
  const conn = (net = new Connection({ name, code }));
  // (a handler for a connection we have since left does nothing)
  const on = (type, fn) => conn.on(type, (m) => net === conn && fn(m));

  on(S.WELCOME, (m) => {
    if (place !== 'lobby') {
      // Off we go: the farm stays at home (saved, and growing while we are out)
      saveGame();
      resetFarm();
      farmOnScreen = false;
    } else {
      // (a lobby we were already in, after a reconnect: start its picture over)
      clearSpots();
      remotes.clear();
    }
    place = 'lobby';
    enterWorld('wild', m.seed);
    session = { code: m.code, seed: m.seed, room: m.room };
    myId = m.id;
    farmer.setShirt(m.color);
    putDown(m.pos);
    setSpots(m.spots);
    // the trees that are down right now (the rest stand, even on an island we were on before)
    resetChopping();
    world.standAllTrees();
    for (const id of m.felled ?? []) world.fellTree(id, null, { instant: true });
    remotes.setRoster(m.roster, myId);
    // one time of day for everyone in the lobby, counted from when it opened
    dayNight.setTime(LOBBY_DAWN + (m.clock / DAY_LENGTH_SECONDS) * 24);
    showCodeInAddress(m.code);
    splash.hide();
    hud.showLobby(session, myId);
    hud.setRoster(m.roster);
    if (m.resumed) hud.chat({ from: 0, text: 'Reconnected: you are back where you were.' });
  });
  on(S.ROSTER, (m) => {
    hud.setRoster(m.list);
    remotes.setRoster(m.list, myId);
  });
  on(S.SNAP, (m) => remotes.snapshot(m.tick, m.p));
  on(S.SPOT, (m) => {
    const spot = spots.get(m.id);
    if (!spot) return;
    Object.assign(spot, { item: m.item, count: m.count, pending: false });
    showSpot(spot);
  });
  on(S.TAKEN, (m) => {
    const spot = spots.get(m.id);
    if (spot) {
      Object.assign(spot, { item: null, count: 0, pending: false });
      showSpot(spot);
    }
    if (m.by === myId) {
      inventory.add(m.item, m.count);
      if (RARE[m.item]) hud.flash(`${RARE[m.item]}!`);
    }
  });
  on(S.DENY, (m) => {
    const spot = spots.get(m.id);
    if (!spot) return;
    spot.pending = false;
    spot.retryAt = performance.now() + 500; // (not again every frame while we stand in it)
    showSpot(spot);
  });
  on(S.FELLED, (m) => {
    chop.pending.delete(m.id);
    if (chop.id === m.id) Object.assign(chop, { id: -1, hits: 0 });
    // it falls away from whoever felled it
    world.fellTree(m.id, m.by === myId ? player.position : remotes.positionOf(m.by));
    if (m.by === myId) inventory.add('wood', m.count);
  });
  on(S.REGROWN, (m) => world.regrowTree(m.id));
  on(S.CHOP_DENY, (m) => chop.pending.delete(m.id)); // (it still stands: chop on)
  on(S.CHAT, (m) => hud.chat(m));
  on('ping', (ms) => hud.setPing(ms));
  on('reconnecting', (n) => hud.setConnStatus(`Connection lost: reconnecting (try ${n})…`));
  on('closed', ({ reason }) => {
    net = null;
    if (place === 'lobby') {
      // Turned out of the lobby: home, and say why
      goHome();
      splash.show({ from: 'home', message: reason });
    } else {
      splash.setStatus(reason, true);
    }
  });
}

// Where we are, for the lobby: spots are checked against it, and everyone
// else draws us there
function sendState(dt) {
  sendTimer += dt;
  if (sendTimer < TICK_DT) return;
  sendTimer %= TICK_DT;
  const p = player.position;
  const r = (v) => Math.round(v * 100) / 100;
  net.send({
    t: C.STATE,
    x: r(p.x), y: r(p.y), z: r(p.z), yaw: r(anim.facing),
    f: (player.onGround ? STATEF.GROUND : 0) | (hoeGroup.visible ? STATEF.HOE : 0) |
      (farmer.axe.visible ? STATEF.AXE : 0) | (anim.swing >= 0 ? STATEF.SWING : 0),
  });
}

// ---------- Saving ----------
// The home farm is yours alone and lives in this browser: the backpack, the
// tilled soil, the crops and the time of day. While you are away (in a lobby,
// or with the page closed) the crops keep growing and the clock keeps turning.
//
// A save is never written over unseen: one that can't be read is kept aside
// (tp.save.broken), an older one is kept as it was (tp.save.v<N>) before it
// is brought up to date, and one from a newer version of the game is left
// alone: nothing is saved until the page is reloaded with that version.
const SAVE_STORE = 'tp.save';
const SAVE_VERSION = 3; // v2: flax seeds joined the starter kit; v3: the axe
let homeFarm = null; // the farm as last seen at home (it is not on screen in a lobby)
let saving = true; // (false: the save is from a newer version of the game)

const keyXZ = (key) => key.split(',').map((n) => Number(n) * TILE_SIZE);

function captureFarm() {
  return {
    savedAt: Date.now(),
    hours: (dayNight.day() - 1) * 24 + dayNight.hour(),
    tilled: [...farmTiles.keys()],
    crops: [...crops].map(([key, c]) => [key, c.cropId, c.age]),
  };
}

function showFarm(farm) {
  resetFarm();
  if (!farm) return;
  const away = Math.max(0, (Date.now() - farm.savedAt) / 1000);
  dayNight.setTime(farm.hours + (away / DAY_LENGTH_SECONDS) * 24);
  for (const key of farm.tilled) tillTileAt(...keyXZ(key));
  for (const [key, cropId, age] of farm.crops) {
    if (CROPS[cropId]) plantAt(...keyXZ(key), cropId, age + away);
  }
}

function saveGame() {
  if (!saving) return;
  if (farmOnScreen) homeFarm = captureFarm();
  try {
    localStorage.setItem(SAVE_STORE, JSON.stringify({ v: SAVE_VERSION, farm: homeFarm, backpack: inventory.serialize() }));
  } catch {}
}

// A gift from the merchant: add() is all-or-nothing, so hand over as many
// as the bag has room for instead of dropping the whole gift when it's full.
function gift(id, count) {
  for (let n = count; n >= 1; n--) if (inventory.add(id, n, { quiet: true })) return;
}

// Keep a copy of a save under another name (it is not to be written over)
function keepAside(name, text) {
  try {
    localStorage.setItem(name, text);
  } catch {}
}

function loadGame() {
  let text = null;
  let save = null;
  try {
    text = localStorage.getItem(SAVE_STORE);
    save = JSON.parse(text);
  } catch {}
  if (text && !(save?.v >= 1)) keepAside(`${SAVE_STORE}.broken`, text); // (a fresh farm starts; the old one is kept)
  if (save?.v > SAVE_VERSION) {
    saving = false;
    hud.setConnStatus('This farm was saved by a newer version of the game. Reload the page to play it: nothing is saved until then.');
  }
  if (save?.v === SAVE_VERSION) {
    inventory.restore(save.backpack);
    homeFarm = save.farm;
  } else if (save?.v >= 1 && save.v < SAVE_VERSION) {
    // An older save: keep it as it was, and hand out what joined the kit since then
    keepAside(`${SAVE_STORE}.v${save.v}`, text);
    inventory.restore(save.backpack);
    homeFarm = save.farm;
    if (save.v < 2) gift('flax_seeds', 5);
    gift('axe', 1);
  } else {
    // A new farmer's starting kit
    inventory.add('hoe', 1, { quiet: true });
    inventory.add('axe', 1, { quiet: true });
    inventory.add('turnip_seeds', 10, { quiet: true });
    gift('flax_seeds', 5);
  }
  showFarm(homeFarm);
  farmOnScreen = true;
  if (new URLSearchParams(location.search).has('hour')) dayNight.setTime(startHour); // (testing: ?hour=21)
}

setInterval(saveGame, 5000);
addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => document.hidden && saveGame());

// ---------- Game loop ----------
const clock = new THREE.Clock();
const _chest = new THREE.Vector3(); // trees between the camera and here fade out
playerMesh.add(dayNight.glow); // night-time glow follows the player

function update(dt) {
  if (inputBlocked()) keys.clear();

  // Horizontal input -> world-space movement (camera-relative, simplified to world axes)
  let moveX = 0;
  let moveZ = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

  const moveVec = new THREE.Vector3(moveX, 0, moveZ);
  const moving = moveVec.lengthSq() > 0;
  if (moving) moveVec.normalize().multiplyScalar(MOVE_SPEED);
  player.velocity.x = moveVec.x;
  player.velocity.z = moveVec.z;

  // Jump
  if (keys.has('Space') && player.onGround) {
    player.velocity.y = JUMP_SPEED;
    player.onGround = false;
    anim.squash = -0.2; // stretch on takeoff
  }

  // Gravity
  player.velocity.y += GRAVITY * dt;

  const prevY = player.position.y;
  const wasOnGround = player.onGround;
  const fallSpeed = -player.velocity.y;
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  player.position.y += player.velocity.y * dt;

  resolveCollisions(prevY, wasOnGround);
  if (player.onGround && !wasOnGround) {
    anim.squash = Math.min(fallSpeed / 20, 1) * 0.3; // squash on landing
  }

  // Fell off the world -> respawn on the plaza
  if (player.position.y < -20) {
    player.position.set(world.spawn.x, GROUND_STAND_Y + 1, world.spawn.z);
    player.velocity.set(0, 0, 0);
  }

  playerMesh.position.copy(player.position);
  hoeGroup.visible = inventory.selectedId() === 'hoe'; // only hold a tool while it's selected
  farmer.axe.visible = inventory.selectedId() === 'axe';
  animateCharacter(dt, moving);

  const t = clock.elapsedTime;
  world.updateTrees(dt);
  if (place === 'lobby') {
    updateChopping();
    updateSpots(dt, t);
    sendState(dt);
    remotes.update(dt, t);
  } else {
    merchant.update(dt, t, player.position);
    if (place === 'home') hud.setPrompt(atStall(player.position) && !shop.isOpen() ? 'E  Trade with the merchant' : '');
  }

  windTime.value = t;
  _chest.set(player.position.x, player.position.y + 0.3, player.position.z);
  world.updateTreeFade(dt, _chest, camera);
  world.update(t);
  water.position.y = WATER_Y + Math.sin(t * 0.8) * 0.03;

  // At home, time stops while the backpack or the menu is open and holding T
  // fast-forwards it. In a lobby the time of day is everyone's, so it just runs.
  const atHome = place !== 'lobby';
  const hoursBefore = dayNight.day() * 24 + dayNight.hour();
  dayNight.update(dt, {
    paused: atHome && (inventory.isOpen() || shop.isOpen() || hud.isPaused()),
    fastForward: atHome && keys.has('KeyT'),
    focus: player.position,
  });
  // Crops grow on game time, so they pause and fast-forward with the clock
  const gameDt = ((dayNight.day() * 24 + dayNight.hour() - hoursBefore) * DAY_LENGTH_SECONDS) / 24;
  updateCrops(dt, gameDt, t);

  if (place === 'title') updateMenuCamera(t);
  else updateCamera(dt);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Dev builds only: a handle for poking at the game from the browser console
if (import.meta.env.DEV) {
  window.__game = { player, spots, remotes, inventory, shop, saveGame, get place() { return place; }, get net() { return net; }, get world() { return world; } };
}

loadGame();
splash.show({ from: 'title' });
animate();
