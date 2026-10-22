import * as THREE from 'three';
import { ITEMS } from './items.js';
import { createItemMesh, itemGeometry } from './itemmesh.js';
import { createFarmFinds } from './finds.js';
import { createInventory } from './inventory.js';
import { createShop } from './shop.js';
import { createChest } from './chest.js';
import { createMerchant, inReach as atStall, TRADE_SPOT } from './merchant.js';
import { createAnimals, inPen, ANIMAL_KINDS, setPenLevels, penRect } from './animals.js';
import { createBuildings, POND_WATER_Y } from './build.js';
import { createFishing } from './fishing.js';
import { createHouseRoom } from './house.js';
import { createWorkbench } from './workbench.js';
import { createArcade } from './arcade.js';
import { createFarmer, damp, HOE_SWING_TIME } from './character.js';
import { Remotes } from './remotes.js';
import { Connection } from './net/connection.js';
import { showCodeInAddress } from './net/lobby.js';
import { FarmSync } from './net/farm.js';
import { PresenceLink } from './net/presence.js';
import { InvitePopups } from './ui/invite.js';
import { PartyHud } from './ui/party.js';
import { Splash } from './ui/splash.js';
import { Hud } from './ui/hud.js';
import { TouchControls, isTouch } from './ui/touch.js';
import './ui/ui.css';
import { TICK_DT, PLAYER_COLORS, SOIL_BARE_HOURS } from '../shared/constants.js';
import { C, S, STATEF, PC, PS } from '../shared/protocol.js';
import { STARTER_KIT, GIANT, UNMADE, unmake, SKILLS, DOUBLE_JUMP, BENCH_LEVELS, PEN_LEVELS } from '../shared/balance.js';
import { SPOT_KINDS, RARE, TREE, ROCK, WEAPONS, SAFE_CIRCLE, mostWood, mostStone, woodFor, stoneFor, GROUND_STAND_Y, FARM_CHEST, PIECES, MAX_PIECES, mostPieces, keptClear, chestHasRoom, pieceTiles, inHouseField, nextSite, siteMap } from '../shared/level.js';
import { CROPS, createCropView } from './crops.js';
import { createDayNight, DAY_LENGTH_SECONDS } from './daynight.js';
import { buildWorld, tileKeyFor, TILE_SIZE, windTime, leafMats, blobGeo, addDecor, addRipples, SEA_LEVEL } from './world.js';
import { HOME, wildMap, LOBBY_POND_Y } from './maps.js';
import { islandFor } from '../shared/worldgen.js';
import { arenaFor, signFor, SIGN_REACH, GAMES } from '../shared/arenas.js';
import { arenaMap, buildSignpost } from './arenas.js';
import { wildsFromWire } from '../shared/wilds.js';
import { CAST_REACH, waterOn } from '../shared/fishing.js';
import { HOME_HALF } from '../shared/farmland.js';
import { HOME_WILDS } from '../shared/homewilds.js';
import { Giants, KINDS as GIANT_KINDS, giantMax, gameDay, mostGiantLoot, LOBBY_DAWN } from '../shared/giants.js';
import { createGiantBars } from './giantbar.js';
import { createBosses } from './bosses.js';
import { BOSSES } from '../shared/balance.js';
import { portalOf } from '../shared/bosses.js';
import { createSkills } from './skills.js';
import { createPuffs } from './puff.js';
import { createDevTools } from './devtools.js';
import { SKY_CHEST_KINDS, skyChestView, relicBeam, restyleNearest, stairFoot, updateSkyFade } from './skyisles.js';

// ---------- Renderer / Scene / Camera ----------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// A phone draws fewer pixels (and a smaller shadow map, below): on its small
// screen it looks the same, and it runs cooler and lasts longer
const PHONE = isTouch();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PHONE ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const FOG_NEAR = 30;
const FOG_FAR = 90;
scene.fog = new THREE.Fog(0x87ceeb, FOG_NEAR, FOG_FAR);

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

// On a screen taller than it is wide (a phone held upright) the view is
// narrow, so the camera pulls back to show more of the island to either side:
// partway toward the width a square screen shows, at most CAM_MAX_ZOOM.
const CAM_MAX_ZOOM = 1.6;
// On top of that the player zooms with the mouse wheel or a two-finger pinch,
// within CAM_ZOOM_NEAR..CAM_ZOOM_FAR all told; the camera eases to it.
const CAM_ZOOM_NEAR = 0.6;
const CAM_ZOOM_FAR = 2.2;
const CAM_ZOOM_EASE = 10;
const camOffset = new THREE.Vector3();
let fitZoom = 1;
let playerZoom = 1;
const zoomGoal = () => fitZoom * playerZoom;
function fitCamera() {
  // (a phone can start the page before the screen has a size: wait for the resize)
  if (!(window.innerWidth > 0 && window.innerHeight > 0)) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  fitZoom = Math.min(Math.sqrt(Math.max(1, 1 / camera.aspect)), CAM_MAX_ZOOM);
  zoomBy(1); // keep the player's zoom inside the range for the new shape
}
function zoomBy(factor) {
  if (!Number.isFinite(factor)) return;
  playerZoom = THREE.MathUtils.clamp(playerZoom * factor, CAM_ZOOM_NEAR / fitZoom, CAM_ZOOM_FAR / fitZoom);
}
fitCamera();
let camZoom = zoomGoal();

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(10, 20, 10);
sun.castShadow = true;
// The shadows cover the view, not the whole island: the light (and its
// shadow box) follows the camera's look-at point (see followSun), which keeps
// them sharp. The box reaches further north, up the screen, than south.
const SUN_REACH = 26;
const SUN_AHEAD = 8;
const SHADOW_MAP = PHONE ? 1024 : 2048;
sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
sun.shadow.camera.left = -SUN_REACH;
sun.shadow.camera.right = SUN_REACH;
sun.shadow.camera.top = SUN_REACH;
sun.shadow.camera.bottom = -SUN_REACH;
sun.shadow.camera.far = 100;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// Moved in steps of a few shadow-map texels, so the shadows' edges don't crawl as it pans
// Zoomed out, the box grows with the view (in steps, so it isn't rebuilt every frame)
let sunReach = SUN_REACH;
function reachSun(zoom) {
  const reach = SUN_REACH * Math.max(1, Math.ceil(zoom * 4) / 4);
  if (reach === sunReach) return;
  sunReach = reach;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
  sun.shadow.camera.updateProjectionMatrix();
}
const _sunOffset = new THREE.Vector3();
function followSun(focus, ahead = SUN_AHEAD) {
  const step = ((sunReach * 2) / SHADOW_MAP) * 4;
  const snap = (n) => Math.round(n / step) * step;
  _sunOffset.subVectors(sun.position, sun.target.position); // (the day/night cycle sets its direction)
  sun.target.position.set(snap(focus.x), 0, snap(focus.z - ahead));
  sun.position.copy(sun.target.position).add(_sunOffset);
}

// Day/night cycle (see daynight.js) drives the sun, hemisphere light, sky and
// fog over time. Start hour can be overridden for testing with ?hour=21.
const startHour = Number(new URLSearchParams(location.search).get('hour') ?? 6);
const dayNight = createDayNight({ scene, sun, hemi, startHour: Number.isFinite(startHour) ? startHour : 6 });

// ---------- Worlds ----------
// Two places to be (maps.js, built by world.js): your farm's island, and the
// wild island of the lobby you are in, grown from its seed
// (shared/worldgen.js). The farm is built once; a wild island when you first
// go to a lobby on it (the last one is kept, for going back). The one you are
// on is in the scene; `world` is the one under your feet. Their trees and
// rocks stand where the server says (shared/wilds.js): the farm's are the
// same for every farm (shared/homewilds.js), a lobby's island's come with
// its WELCOME.
const worlds = { home: buildWorld(HOME, wildsFromWire(HOME_WILDS)) };
let wildsShown = null; // (the wild island's trees and rocks, as its lobby sent them)
let world = worlds.home;
scene.add(world.root);

// name: 'home', 'wild' (seed: which wild island; wire: its trees and
// rocks, as its lobby sent them) or 'arena' (seed: a party game's { kind,
// seed }, shared/arenas.js; the lobby's island is kept, for going back)
function enterWorld(name, seed, wire) {
  wildIsland = name === 'wild' ? islandFor(seed) : null;
  let stale = null; // the wild island (or arena) we will not be back on
  const wilds = name === 'wild' ? JSON.stringify(wire ?? null) : null;
  if (name === 'wild' && (worlds.wild?.name !== `wild:${islandFor(seed).seed}` || wilds !== wildsShown)) {
    stale = worlds.wild;
    const island = islandFor(seed);
    worlds.wild = buildWorld(wildMap(island), wildsFromWire(wire) ?? undefined);
    worlds.wild.root.add(buildSignpost(signFor(island))); // (where party games start)
    wildsShown = wilds;
  }
  if (name === 'arena' && worlds.arena?.name !== `arena:${seed.kind}:${seed.seed}`) {
    stale = worlds.arena;
    const map = arenaMap(arenaFor(seed.kind, seed.seed));
    worlds.arena = buildWorld(map);
    worlds.arena.coins = map.coins; // (a view per coin, by id)
  }
  if (worlds[name] !== world) {
    scene.remove(world.root);
    world = worlds[name];
    scene.add(world.root);
  }
  stale?.dispose(); // (out of the scene by now)
}

let wildIsland = null; // the wild island we are on, in a lobby (shared/worldgen.js: where its water is)

// The sea around every island; it fades into the fog toward the horizon
const WATER_Y = SEA_LEVEL;
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  addRipples(new THREE.MeshStandardMaterial({ color: 0x2f8fbf, roughness: 0.2, metalness: 0.1 }))
);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_Y;
water.receiveShadow = true;
scene.add(water);

// ---------- Inventory ----------
// Toolbar + backpack UI (see inventory.js). Opening the backpack pauses
// player input, so drop any keys that were held at that moment. The backpack
// goes everywhere with you, and is saved with the farm (see Saving).
const inventory = createInventory({
  onOpenChange: (open) => open && keys.clear(),
  onBuild: (piece) => startBuilding(piece),
  buildProblem: () => (place !== 'home' ? 'You build on a farm: head home first.' : houseRoom.inside(player.position) ? 'You build outside: head out of the house first.' : ''),
  building: () => building,
  inChest: (item) => chestStock()[item] ?? 0,
  renderSkills: (el) => skills.render(el),
});

// ---------- Skills ----------
// Farming, animals, woodcutting and mining (and fishing, once there is
// fishing) level up by doing them (skills.js): each level a little more
// chance of one more of what they give, and the overall level unlocks the
// double jump. Yours wherever you farm: saved with the backpack.
const skills = createSkills({
  onLevelUp: (title, detail) => {
    hud.flash(title);
    inventory.notify(detail);
  },
});
// XP in skill for what was got, and now and then (the skill's bonus) one more of item
function skilled(skill, xp, item) {
  skills.gain(skill, xp);
  if (item && skills.extra(skill) && inventory.canAdd(item, 1)) inventory.add(item, 1);
}

// The tool in hand, by what it does ('hoe', 'axe' or 'pickaxe': plain or sturdy), or null
const holding = () => ITEMS[inventory.selectedId()]?.tool ?? null;
// Swings to fell a tree or break a rock with the tool in hand (a better one takes fewer)
const swingsWith = (base) => ITEMS[inventory.selectedId()]?.hits ?? base;
// The more a tree we felled or a rock we broke (m: FELLED or MINED) gives
// with the tool in hand, a golden one (not a giant: that is shared out)
const extraFrom = (tool, m) => (m.by === myId && !m.shares && holding() === tool ? ITEMS[inventory.selectedId()].extra ?? 0 : 0);

// ---------- The merchant ----------
// Behind the stall on the farm (merchant.js): E at the counter opens the shop
// (shop.js) to buy seeds and sell what you grew or found. They live on the
// farm's island, so they are only in the scene at home.
const merchant = createMerchant();
worlds.home.root.add(merchant.root);

// ---------- The animals ----------
// Hens in their yard by the coop, cows and sheep in the pasture
// (animals.js): they wander and graze and sleep at night. The hens lay an
// egg a day, which you pick up by walking over it; E milks the cow or shears
// the sheep in reach when she's ready, else pets her, or lets out the animal
// in hand (one bought from the merchant) in her pen. They're saved with the
// farm, and keep on while you're away.
const animals = createAnimals();
worlds.home.root.add(animals.root);
const farmHours = () => (dayNight.day() - 1) * 24 + dayNight.hour(); // the farm's clock, in game hours
// (on a friend's farm the eggs, milk and wool are the farmer's)
const collect = (item) => place === 'home' && !visiting() && inventory.add(item);
// an egg, milk or wool: into the backpack, with Animals XP
const collectProduce = (item) => collect(item) && (skilled('animals', SKILLS.xp[item] ?? 0, item), true);
const pettedOn = new WeakMap(); // animal -> the game day she was last petted (Animals XP once a day)

function letOutAnimal(kind) {
  if (visiting()) return inventory.notify('Only the farmer lets animals out here');
  const problem = animals.letOut(kind, player.position.x, player.position.z);
  if (problem) return inventory.notify(problem);
  inventory.consumeSelected();
  anim.squash = 0.15; // a crouch to set her down
}

// ---------- Farming: hoe tool + tillable soil ----------
// (userData.bare: game seconds with nothing growing in it; userData.life: how
// long it may lie bare before it goes back to grass)
const farmTiles = new Map(); // "gridX,gridZ" -> tilled tile mesh
const soilLife = () => ((SOIL_BARE_HOURS[0] + Math.random() * (SOIL_BARE_HOURS[1] - SOIL_BARE_HOURS[0])) * DAY_LENGTH_SECONDS) / 24;

// Tilled soil: a dark bed with three furrows ridged across it
const soilBedGeo = new THREE.BoxGeometry(TILE_SIZE * 0.92, 0.06, TILE_SIZE * 0.92);
const soilRidgeGeo = new THREE.CylinderGeometry(0.075, 0.075, TILE_SIZE * 0.84, 6, 1)
  .rotateZ(Math.PI / 2)
  .scale(1, 0.45, 1);
const soilMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 });
const soilRidgeMat = new THREE.MeshStandardMaterial({ color: 0x6e4826, roughness: 1, flatShading: true });

// bare: game seconds it has lain bare already, life: how long it may (soil tilled before we came)
function tillTileAt(x, z, bare = 0, life = soilLife()) {
  const key = tileKeyFor(x, z);
  if (farmTiles.has(key)) return false; // already tilled

  const [gx, gz] = key.split(',').map(Number);
  const mesh = new THREE.Mesh(soilBedGeo, soilMat);
  mesh.position.set(gx * TILE_SIZE, 0.03, gz * TILE_SIZE);
  mesh.receiveShadow = true;
  mesh.userData.bare = bare;
  mesh.userData.life = life;
  for (const rz of [-0.27, 0, 0.27]) {
    const ridge = new THREE.Mesh(soilRidgeGeo, soilRidgeMat);
    ridge.position.set(0, 0.03, rz * TILE_SIZE);
    ridge.receiveShadow = true;
    mesh.add(ridge);
  }
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
  const soil = farmTiles.get(key).userData;
  soil.bare = 0; // (bare again from when it's pulled, for a while of its own)
  soil.life = soilLife();
  return true;
}

// Back to grass: a tile the farm's room turned down (a farm with helpers), or
// soil left bare too long
function untillTile(key) {
  const mesh = farmTiles.get(key);
  if (!mesh) return;
  scene.remove(mesh);
  farmTiles.delete(key);
}

function removeCrop(key) {
  const crop = crops.get(key);
  if (!crop) return;
  scene.remove(crop.view.group);
  crops.delete(key);
}

// Returns true if there was a ripe crop here (even if the bag was too full to take it).
// On a farm with helpers it goes in the farm's chest: it vanishes now, and the
// room's HARVESTED (or FARM_DENY: it comes back) settles it.
function harvestAt(x, z) {
  const key = tileKeyFor(x, z);
  const crop = crops.get(key);
  if (!crop?.ripe) return false;
  if (crop.pending) return true;
  if (farmNet) {
    crop.pending = true;
    crop.view.group.visible = false;
    farmNet.send({ t: C.HARVEST, key });
    return true;
  }
  if (inventory.add(CROPS[crop.cropId].produce)) {
    skilled('farming', SKILLS.xp.harvest[crop.cropId] ?? 0, CROPS[crop.cropId].produce);
    removeCrop(key);
  }
  return true;
}

// Bare ground: untilled, nothing growing (going out to a lobby, or before the
// saved farm is put back)
function resetFarm() {
  for (const key of [...crops.keys()]) removeCrop(key);
  buildings.clear();
  placeChest();
  for (const mesh of farmTiles.values()) scene.remove(mesh);
  farmTiles.clear();
  worlds.home.restoreFoliage();
  worlds.home.standAllTrees();
  worlds.home.restoreAllRocks();
  farmFelled.clear();
  farmMined.clear();
  farmTreeSites.clear();
  farmRockSites.clear();
  farmGiants = new Giants();
  giantBars.clear();
  resetChopping();
  resetMining();
  animals.clear();
}

// `growDt` is game-clock seconds (growth); `dt` is real seconds (animation)
function updateCrops(dt, growDt, t) {
  // Bare soil goes back to grass in a while (on a farm with helpers the room says when: UNTILLED)
  if (!farmNet) {
    for (const [key, mesh] of farmTiles) {
      if (crops.has(key)) continue;
      mesh.userData.bare += growDt;
      if (mesh.userData.bare >= mesh.userData.life) untillTile(key);
    }
  }
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
const USE_HEIGHT = 1.2; // how far above or below the feet E reaches (from a step or a platform)
// Standing (not mid-jump) with the feet within USE_HEIGHT of y (crops, trees and rocks: the ground's 0)
const footReach = (y = 0) => player.onGround && Math.abs(player.position.y - GROUND_STAND_Y - y) < USE_HEIGHT;
const GATHER_VERB = { bush: 'Pick berries', mushroom: 'Pick mushrooms', heather: 'Pick heather', cattail: 'Cut cattails', bluebell: 'Pick bluebells', sunflower: 'Pick sunflowers', pumpkin: 'Pick pumpkins', fern: 'Pick ferns', seashell: 'Collect shells', sky_chest: 'Open the chest', sky_vault: 'Unlock the chest' };
const CHEST_ROOM = 3; // free backpack slots a sky isle's chest asks for, since what is in it is a surprise

const berryGeo = new THREE.SphereGeometry(0.085, 6, 5);
const berryMat = new THREE.MeshStandardMaterial({ color: 0xd8344f, roughness: 0.35 });
const stalkGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.28, 7).translate(0, 0.14, 0);
const capGeo = new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.25, 0);
const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.8 });
const capMat = new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.6 });
const sprigGeo = new THREE.ConeGeometry(0.05, 0.42, 5).translate(0, 0.21, 0);
const bellGeo = new THREE.SphereGeometry(0.07, 6, 5);
const sprigMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.8 });
const reedGeo = new THREE.CylinderGeometry(0.015, 0.03, 0.9, 5).translate(0, 0.45, 0);
const spikeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.2, 7).translate(0, 0.85, 0);
const spikeMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
const bluebellMat = new THREE.MeshStandardMaterial({ color: 0x4a62d0, roughness: 0.5 });
const pumpkinMat = new THREE.MeshStandardMaterial({ color: 0xe8821e, roughness: 0.6 });
const pumpkinGeo = new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.8, 1);
const pumpkinStemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.1, 5);
const frondGeo = new THREE.ConeGeometry(0.07, 0.7, 4).translate(0, 0.35, 0);
const frondMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3e, roughness: 0.8 });
const shellGeo = new THREE.SphereGeometry(0.14, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 0.8);
const shellMats = [0xf0d9c0, 0xf2a7b0, 0xfff1e2].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
const sunflowerPetalMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 });
const sunflowerHeartMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });
const sunflowerPetalGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10).rotateX(Math.PI / 2);
const sunflowerHeartGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8).rotateX(Math.PI / 2);
const bellMat = new THREE.MeshStandardMaterial({ color: 0x9a6fc0, roughness: 0.5 });
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
  } else if (spot.kind === 'cattail') {
    // A stand of tall reeds, each with a brown velvet head
    content = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      const reed = new THREE.Group();
      reed.add(new THREE.Mesh(reedGeo, sprigMat), new THREE.Mesh(spikeGeo, spikeMat));
      reed.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
      reed.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      reed.scale.setScalar(0.85 + (i % 3) * 0.15);
      content.add(reed);
    }
  } else if (spot.kind === 'bluebell') {
    // A clump of stems, each nodding with blue bells
    content = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const stem = new THREE.Group();
      stem.add(new THREE.Mesh(sprigGeo, sprigMat));
      for (let b = 0; b < 3; b++) {
        const bell = new THREE.Mesh(bellGeo, bluebellMat);
        bell.position.set(0.05 * (b - 1), 0.36 - b * 0.04, 0);
        stem.add(bell);
      }
      stem.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
      stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      content.add(stem);
    }
  } else if (spot.kind === 'fern') {
    // A rosette of leaning fronds
    content = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
      frond.scale.set(1, 0.8 + (i % 3) * 0.15, 1);
      content.add(frond);
    }
  } else if (spot.kind === 'seashell') {
    // A few shells half sunk in the sand
    content = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      const shell = new THREE.Mesh(shellGeo, shellMats[i % 3]);
      shell.position.set(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3);
      shell.rotation.y = a * 3;
      shell.scale.multiplyScalar(0.8 + (i % 3) * 0.25);
      content.add(shell);
    }
  } else if (spot.kind === 'pumpkin') {
    // A couple of round orange pumpkins with little green stems
    content = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const a = i * 3.4;
      const pumpkin = new THREE.Mesh(pumpkinGeo, pumpkinMat);
      pumpkin.position.set(Math.cos(a) * 0.22, 0.16, Math.sin(a) * 0.22);
      pumpkin.scale.setScalar(0.9 + i * 0.25);
      const stalk = new THREE.Mesh(pumpkinStemGeo, sprigMat);
      stalk.position.set(0, 0.2, 0);
      pumpkin.add(stalk);
      content.add(pumpkin);
    }
  } else if (spot.kind === 'sunflower') {
    // A few tall stems, each nodding a yellow head with a brown heart
    content = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const stem = new THREE.Group();
      const pole = new THREE.Mesh(reedGeo, sprigMat);
      pole.scale.y = 0.9 + i * 0.1;
      stem.add(pole);
      const top = 0.9 * (0.9 + i * 0.1);
      const petals = new THREE.Mesh(sunflowerPetalGeo, sunflowerPetalMat);
      petals.position.set(0, top, 0.02);
      const heart = new THREE.Mesh(sunflowerHeartGeo, sunflowerHeartMat);
      heart.position.set(0, top, 0.04);
      stem.add(petals, heart);
      stem.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
      stem.rotation.y = a;
      content.add(stem);
    }
  } else if (spot.kind === 'heather') {
    // A low clump of purple sprigs
    content = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const sprig = new THREE.Group();
      sprig.add(new THREE.Mesh(sprigGeo, sprigMat));
      for (let b = 0; b < 3; b++) {
        const bell = new THREE.Mesh(bellGeo, bellMat);
        bell.position.set(0.03 * (b % 2 ? 1 : -1), 0.2 + b * 0.09, 0);
        sprig.add(bell);
      }
      sprig.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
      sprig.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      content.add(sprig);
    }
  } else if (SKY_CHEST_KINDS.has(spot.kind)) {
    content = skyChestView(spot); // (up on a sky isle: it stays once it is emptied, its lid open)
  } else {
    content = createItemMesh('coin'); // (a treasure: the item itself, made solid, itemmesh.js)
    if (spot.kind === 'relic') content.add(relicBeam(spot.item)); // (a sky isle's: seen from far off)
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
  content.visible = has || !!content.userData.stays;
  content.userData.open?.(!has);
  glint.visible = has && !!RARE[spot.item];
  if (spot.use === 'touch' && spot.item) {
    content.geometry = itemGeometry(spot.item);
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
  const vault = spot.kind === 'sky_vault';
  if (vault && !inventory.count('key')) {
    inventory.notify("It's locked. An old key might fit");
    spot.retryAt = performance.now() + 1000;
    return;
  }
  if (spot.item === 'chest' ? inventory.serialize().slots.filter((slot) => !slot).length < CHEST_ROOM : !inventory.canAdd(spot.item, spot.count)) {
    if (spot.item === 'chest') inventory.notify('Make some room in your backpack first');
    else inventory.add(spot.item, spot.count); // (says "Inventory full")
    spot.retryAt = performance.now() + 1000;
    return;
  }
  spot.pending = true;
  showSpot(spot);
  net?.send({ t: C.TAKE, id: spot.id, ...(vault && { key: true }) }); // (the key is used up once it has opened it: TAKEN)
}

// We opened a chest up on a sky isle: what was in it into the backpack (the
// locked one took an old key)
function openedChest(spot, items) {
  if (spot?.kind === 'sky_vault') inventory.remove('key', 1);
  for (const [item, count] of items) inventory.add(item, count);
  const rare = items.find(([item]) => RARE[item]);
  hud.flash(rare ? `${RARE[rare[0]]}!` : spot?.kind === 'sky_vault' ? 'Unlocked!' : 'Treasure!');
}

// the bush or mushrooms within reach with something on them, nearest first
function gatherSpotInReach() {
  let best = null;
  let bestD = GATHER_REACH;
  for (const spot of spots.values()) {
    if (spot.use !== 'gather' || !spot.item || spot.pending) continue;
    const d = Math.hypot(spot.x - player.position.x, spot.z - player.position.z);
    if (d < bestD && Math.abs(player.position.y - GROUND_STAND_Y - spot.y) < USE_HEIGHT) {
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
  const hint = atSign() ? signHint() : useHint();
  if (hint) hud.setPrompt(`E  ${hint}`);
  else hud.setPrompt(gatherSpotInReach()?.kind === 'sky_vault' ? 'Locked: an old key would open it' : '');
}

// ---------- Chopping trees ----------
// With the axe in hand, E next to a tree swings at it (hold E to keep
// swinging). Each swing shakes it; the last of TREE.hits (fewer with a sturdy axe) asks the lobby,
// which says who felled it (FELLED: down for everyone, wood to whoever, more
// from a bigger tree) and
// when it has grown back (REGROWN). Trees are named by their number in the
// island's list (world.js), the same on every page. The farm's trees too, as
// its rocks are (see Mining rocks): farmFelled.
const CHOP_REACH = 1.3; // from the bark
const SWING_GAP = 0.15; // seconds between swings, so everyone else sees each one
const chop = { id: -1, hits: 0, swingAt: -1, nextSwing: 0, pending: new Set() };
const farmFelled = new Map(); // the farm's felled trees: id -> when it grows back (wall clock ms)
const farmTreeSites = new Map(); // how often each grew back: id -> count (which of its places it is in: shared/level.js nextSite)

const chopPrompt = (tree) => (tree.big > 1 ? giantPrompt('tree', tree) : `Chop${chop.id === tree.id && chop.hits ? `  ${chop.hits}/${swingsWith(TREE.hits, 'woodcutting')}` : ' (hold to keep going)'}`);

// the standing tree within reach, nearest first
function treeInReach() {
  if (!footReach()) return null;
  let best = null;
  let bestD = CHOP_REACH;
  for (const tree of world.trees) {
    if (tree.state !== 'up' || chop.pending.has(tree.id)) continue;
    const d = Math.hypot(tree.x - player.position.x, tree.z - player.position.z) - 0.25 * tree.scale * tree.big;
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
  const most = tree.big > 1 ? mostGiantLoot('tree', tree.scale) : mostWood(tree.scale);
  if (!inventory.canAdd('wood', most)) {
    inventory.add('wood', most); // (says "Inventory full")
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
      if (tree.big > 1) hitGiant('tree', tree);
      else if (++chop.hits >= swingsWith(TREE.hits, 'woodcutting')) {
        chop.pending.add(tree.id);
        chop.hits = 0;
        const r = (v) => Math.round(v * 100) / 100;
        const conn = place === 'lobby' ? net : farmNet;
        if (conn) conn.send({ t: C.CHOP, id: tree.id, x: r(tree.x), z: r(tree.z), size: r(tree.scale) });
        else chopAlone(tree);
      }
    }
  }
  if (keys.has('KeyE') && holding() === 'axe') swingAxe(); // holding E keeps chopping
  // a tree tapped with the axe in hand: chop on until it falls (or the farmer walks off)
  if (chopping && (holding() !== 'axe' || treeInReach() !== chopping || !swingAxe())) chopping = null;
}

function resetChopping() {
  chopping = null;
  Object.assign(chop, { id: -1, hits: 0, swingAt: -1 });
  chop.pending.clear();
}

// The world a lobby's or a farm room's trees and rocks are in: the one under
// our feet, but in a lobby its island even while we are off in a party game's arena
const wildsWorld = () => (place === 'lobby' ? worlds.wild : world);

// FELLED, from a lobby or a farm's room
function treeFelled(m) {
  chop.pending.delete(m.id);
  if (chop.id === m.id) Object.assign(chop, { id: -1, hits: 0 });
  // it falls away from whoever felled it
  wildsWorld().fellTree(m.id, m.by === myId ? player.position : remotes.positionOf(m.by));
  const got = myShare(m) + extraFrom('axe', m);
  if (got) inventory.add('wood', got);
  if (m.shares) giantDown('tree', m.id, got, 'wood');
  if (got) skilled('woodcutting', m.shares ? SKILLS.xp.giant : SKILLS.xp.tree, 'wood'); // (after: a level up's notice goes over the giant's)
}

// On a farm played alone: the tree is ours to fell
function chopAlone(tree) {
  treeFelled({ id: tree.id, by: myId, count: woodFor(tree.scale) });
  farmFelled.set(tree.id, comeBackAt(TREE.regrow));
}

// When a felled tree or a broken rock is back: [min, max] seconds from now
const comeBackAt = ([lo, hi]) => Math.round(Date.now() + (lo + Math.random() * (hi - lo)) * 1000);

// ---------- Mining rocks ----------
// With the pickaxe in hand, E next to a rock swings at it (hold E to keep
// swinging). Each swing jolts it; the last of ROCK.hits (fewer with a sturdy pickaxe) asks the lobby, which
// says who broke it (MINED: gone for everyone, stone to whoever, more from a
// bigger rock) and when a new one has surfaced (RESURFACED). Rocks are named
// by their number in the island's list (world.js), the same on every page.
// The farm's rocks too: its room says so the same way, and on a farm played
// alone the page breaks the rock itself and keeps when it comes back
// (farmMined, saved with the farm).
const MINE_REACH = 1.3; // from the rock's edge, as it is drawn
const mine = { id: -1, hits: 0, swingAt: -1, nextSwing: 0, pending: new Set() };
const farmMined = new Map(); // the farm's broken rocks: id -> when a new one surfaces (wall clock ms)
const farmRockSites = new Map(); // (as farmTreeSites)

const minePrompt = (rock) => (rock.big > 1 ? giantPrompt('rock', rock) : `Mine${mine.id === rock.id && mine.hits ? `  ${mine.hits}/${swingsWith(ROCK.hits, 'mining')}` : ' (hold to keep going)'}`);

// the whole rock within reach, nearest first
function rockInReach() {
  if (!footReach()) return null;
  let best = null;
  let bestD = MINE_REACH;
  for (const rock of world.rocks) {
    if (rock.state !== 'up' || mine.pending.has(rock.id)) continue;
    const d = Math.hypot(rock.x - player.position.x, rock.z - player.position.z) - rock.radius;
    if (d < bestD) {
      best = rock;
      bestD = d;
    }
  }
  return best;
}

// Swing at the rock in reach (if the last swing is done). False: no rock here.
function swingPick() {
  const rock = rockInReach();
  if (!rock) return false;
  const now = clock.elapsedTime;
  if (anim.swing >= 0 || now < mine.nextSwing) return true;
  const most = rock.big > 1 ? mostGiantLoot('rock', rock.scale) : mostStone(rock.scale);
  if (!inventory.canAdd('stone', most)) {
    inventory.add('stone', most); // (says "Inventory full")
    mine.nextSwing = now + 1;
    return true;
  }
  if (mine.id !== rock.id) Object.assign(mine, { id: rock.id, hits: 0 });
  anim.facing = Math.atan2(rock.x - player.position.x, rock.z - player.position.z); // face the rock
  farmer.swing();
  mine.swingAt = now;
  mine.nextSwing = now + HOE_SWING_TIME + SWING_GAP;
  return true;
}

function updateMining() {
  // The point bites partway through the swing, on the way down
  if (mine.swingAt >= 0 && clock.elapsedTime - mine.swingAt >= HOE_SWING_TIME * 0.6) {
    mine.swingAt = -1;
    const rock = world.rocks[mine.id];
    if (rock?.state === 'up' && !mine.pending.has(rock.id)) {
      world.shakeRock(rock.id);
      if (rock.big > 1) hitGiant('rock', rock);
      else if (++mine.hits >= swingsWith(ROCK.hits, 'mining')) {
        mine.pending.add(rock.id);
        mine.hits = 0;
        const r = (v) => Math.round(v * 100) / 100;
        const conn = place === 'lobby' ? net : farmNet;
        if (conn) conn.send({ t: C.MINE, id: rock.id, x: r(rock.x), z: r(rock.z), size: r(rock.scale) });
        else mineAlone(rock);
      }
    }
  }
  if (keys.has('KeyE') && holding() === 'pickaxe') swingPick(); // holding E keeps mining
  // a rock tapped with the pickaxe in hand: mine on until it breaks (or the farmer walks off)
  if (mining && (holding() !== 'pickaxe' || rockInReach() !== mining || !swingPick())) mining = null;
}

function resetMining() {
  mining = null;
  Object.assign(mine, { id: -1, hits: 0, swingAt: -1 });
  mine.pending.clear();
}

// MINED, from a lobby or a farm's room
function rockMined(m) {
  mine.pending.delete(m.id);
  if (mine.id === m.id) Object.assign(mine, { id: -1, hits: 0 });
  wildsWorld().breakRock(m.id);
  const got = myShare(m) + extraFrom('pickaxe', m);
  if (got) inventory.add('stone', got);
  if (m.shares) giantDown('rock', m.id, got, 'stone');
  if (got) skilled('mining', m.shares ? SKILLS.xp.giant : SKILLS.xp.rock, 'stone'); // (after: a level up's notice goes over the giant's)
}

// On a farm played alone: the rock is ours to break
function mineAlone(rock) {
  rockMined({ id: rock.id, by: myId, count: stoneFor(rock.scale) });
  farmMined.set(rock.id, comeBackAt(ROCK.regrow));
}

// ---------- Giants ----------
// Now and then of a morning a tree grows into a giant, or a rock
// (shared/giants.js), on a lobby's island or a farm. Every swing at one goes
// to the lobby or farm's room (HIT), which says how it is doing (GIANT: a
// health bar over it, for everyone, giantbar.js) and, when it comes down, who
// gets how much of what it gives (FELLED or MINED with shares). On a farm
// played alone the page keeps its giants itself (farmGiants, saved with the
// farm), and rolls for one each morning.
let farmGiants = new Giants(); // the farm's (on a farm with helpers, as its room has them)
let lobbyGiants = new Giants(); // the lobby's, as it has them
const giantsHere = () => (place === 'lobby' ? lobbyGiants : farmGiants);
const giantBars = createGiantBars(scene);
if (new URLSearchParams(location.search).has('giant')) GIANT.chance = 1; // (testing: ?giant grows them on a farm played alone, now)

function giantPrompt(kind, thing) {
  const hp = giantsHere()[kind]?.hp ?? giantMax(kind);
  return `${kind === 'tree' ? 'Chop' : 'Mine'} the giant  ${Math.ceil(hp)}/${giantMax(kind)}`;
}

// Our share of a FELLED or MINED: all of it, if we did it alone
const myShare = (m) => (m.shares ? m.shares.find(([who]) => who === myId)?.[1] ?? 0 : m.by === myId ? m.count : 0);

// A swing of ours landed on a giant
function hitGiant(kind, thing) {
  const r = (v) => Math.round(v * 100) / 100;
  const tool = inventory.selectedId();
  const conn = place === 'lobby' ? net : farmNet;
  if (conn) return conn.send({ t: C.HIT, kind, id: thing.id, x: r(thing.x), z: r(thing.z), size: r(thing.scale), tool });
  // (a farm played alone)
  const hit = farmGiants.hit(kind, thing.id, myId, tool, thing.scale);
  if (!hit) return;
  giantBars.show(kind, thing.id, hit.hp, giantMax(kind), world.giantTop(kind, thing.id), clock.elapsedTime);
  if (!hit.shares) return;
  const m = { id: thing.id, by: myId, count: hit.loot, shares: hit.shares };
  if (kind === 'tree') {
    treeFelled(m);
    farmFelled.set(thing.id, comeBackAt(TREE.regrow));
  } else {
    rockMined(m);
    farmMined.set(thing.id, comeBackAt(ROCK.regrow));
  }
}

// GIANT, from a lobby or a farm's room: one has grown (by 0), or someone swung at it
function giantNews(m) {
  if (!GIANT_KINDS.includes(m.kind)) return;
  giantsHere().set(m.kind, m.id, m.hp);
  const here = wildsWorld();
  if (!m.by) {
    here.makeGiant(m.kind, m.id);
    return;
  }
  // (our own swing shook it already)
  if (m.by !== myId) {
    if (m.kind === 'tree') here.shakeTree(m.id, remotes.positionOf(m.by));
    else here.shakeRock(m.id);
  }
  if (here === world) giantBars.show(m.kind, m.id, m.hp, m.max, world.giantTop(m.kind, m.id), clock.elapsedTime);
}

// A giant came down: no more giants of its kind here
function giantDown(kind, id, got, item) {
  giantsHere().felled(kind);
  giantBars.remove(kind, id);
  if (got) hud.flash(`+${got} ${item}!`);
}

// The giants as a lobby or farm has them (Giants toSave()), drawn on its island
function showGiants(giants, save, island) {
  const loaded = Giants.fromSave(save);
  for (const kind of GIANT_KINDS) {
    giants[kind] = loaded[kind];
    giants.done[kind] = loaded.done[kind];
    if (loaded[kind]) island.makeGiant(kind, loaded[kind].id, { instant: true });
  }
  giants.day = loaded.day;
}

// Developer tools (devtools.js): the standing tree or rock nearest us grows
// into a giant now (its lobby or farm's room says so to everyone)
function devGiant(kind) {
  if (place !== 'home' && place !== 'lobby') return;
  if (giantsHere()[kind]) return inventory.notify(`There is a giant ${kind} here already`);
  let best = null;
  let bestD = Infinity;
  for (const thing of kind === 'tree' ? world.trees : world.rocks) {
    const d = Math.hypot(thing.x - player.position.x, thing.z - player.position.z);
    if (thing.state === 'up' && d < bestD) [best, bestD] = [thing, d];
  }
  if (!best) return inventory.notify(`No ${kind} standing here`);
  const conn = place === 'lobby' ? net : farmNet;
  if (conn) return conn.send({ t: C.DEV_GIANT, kind, id: best.id });
  if (farmVisit) return;
  farmGiants.setCounts(worlds.home.trees.length, worlds.home.rocks.length);
  if (!farmGiants.grow(kind, best.id)) return;
  worlds.home.makeGiant(kind, best.id);
  inventory.notify(`A giant ${kind} has grown on the farm!`);
}
// ...and on a lobby's sky isles (generation 10): hop to the foot of the
// nearest one's stair, or draw the nearest one in the next style
function devSkyFoot() {
  const foot = place === 'lobby' ? stairFoot(player.position.x, player.position.z) : null;
  if (!foot) return inventory.notify('No sky isles here');
  player.position.set(foot.x, GROUND_STAND_Y + 0.5, foot.z);
  player.velocity.set(0, 0, 0);
}
function devSkyStyle() {
  const name = place === 'lobby' ? restyleNearest(player.position.x, player.position.z) : null;
  inventory.notify(name ? `Now a ${name.toLowerCase()}` : 'No sky isles here');
}
createDevTools({
  onGiant: devGiant, onSkyFoot: devSkyFoot, onSkyStyle: devSkyStyle, onKey: () => inventory.add('key', 1),
  onBossKeys: () => Object.values(BOSSES).forEach(({ key, pieces }) => inventory.add(key, pieces)), // (a full set of each boss's key pieces)
});

// Each morning, on a farm played alone: maybe a giant
function rollFarmGiants() {
  if (place !== 'home' || farmNet || farmVisit || !farmOnScreen) return;
  farmGiants.setCounts(worlds.home.trees.length, worlds.home.rocks.length);
  for (const [kind, id] of farmGiants.roll(gameDay(farmHours()), { tree: farmFelled, rock: farmMined })) {
    worlds.home.makeGiant(kind, id);
    inventory.notify(kind === 'tree' ? 'A giant tree has grown on the farm!' : 'A giant rock has surfaced on the farm!');
  }
}

// ...and the farm's trees grow back and its rocks surface again when it's
// time, each somewhere else (a farm's room says so itself)
function regrowFarm() {
  if (farmNet) return;
  const now = Date.now();
  for (const [list, sites, regrow] of [[farmFelled, farmTreeSites, worlds.home.regrowTree], [farmMined, farmRockSites, worlds.home.regrowRock]]) {
    for (const [id, at] of list) {
      if (now < at) continue;
      list.delete(id);
      setSite(sites, id, nextSite(sites.get(id)));
      regrow(id, { n: sites.get(id) ?? 0 });
    }
  }
}

function setSite(sites, id, n) {
  if (n) sites.set(id, n);
  else sites.delete(id);
}

// Nothing grows back on tilled soil or where something is built
HOME.canGrow = (x, z) => [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].every(([dx, dz]) => {
  const key = tileKeyFor(x + dx, z + dz);
  return !farmTiles.has(key) && !buildings.get(key);
});

// The farm's felled trees and broken rocks as saved, or as its room has them:
// [[id, when it comes back]], and where each stands (treeSites, rockSites:
// [[id, how often it grew back]])
function showFarmWilds({ felled, mined, treeSites, rockSites, giants }) {
  const now = Date.now();
  for (const [id, n] of siteMap(treeSites, worlds.home.trees.length)) farmTreeSites.set(id, n);
  for (const [id, n] of siteMap(rockSites, worlds.home.rocks.length)) farmRockSites.set(id, n);
  worlds.home.standAllTrees([...farmTreeSites]);
  worlds.home.restoreAllRocks([...farmRockSites]);
  for (const [id, at] of felled ?? []) {
    if (!(at > now) || !worlds.home.trees[id]) continue;
    worlds.home.fellTree(id, null, { instant: true });
    farmFelled.set(id, at);
  }
  for (const [id, at] of mined ?? []) {
    if (!(at > now) || !worlds.home.rocks[id]) continue;
    worlds.home.breakRock(id, { instant: true });
    farmMined.set(id, at);
  }
  showGiants(farmGiants, giants, worlds.home);
}

// ---------- Bopping (lobbies) ----------
// With the wooden sword or the mallet in hand (WEAPONS in shared/level.js),
// E swings it at the nearest farmer in reach (turning to face them), and the
// lobby says who got bopped (BOPPED): they stumble back, and drop a little
// of what they gathered here (DROP), which anyone can walk into (PICKUP,
// PICKED). Not in the stone circle where farmers arrive. Nobody gets hurt.
const knock = new THREE.Vector3(); // the stumble after a bop, added to walking while it fades
const drops = new Map(); // id -> { id, item, count, x, y, z, group, pending }
const lobbyNames = new Map(); // player id -> name (for "Ann bopped you")
let bopReady = 0; // (clock time the weapon can swing again)

const weaponInHand = () => (Object.hasOwn(WEAPONS, inventory.selectedId() ?? '') ? inventory.selectedId() : null);
const resting = (pos) => !arenaId && Math.hypot(pos.x - world.spawn.x, pos.z - world.spawn.z) < SAFE_CIRCLE;

// The nearest other farmer within reach (and not resting in the stone circle): { id, pos }, or null
function bopTarget() {
  const weapon = WEAPONS[weaponInHand()];
  if (!weapon) return null;
  let best = null;
  let bestD = weapon.reach * 0.9; // (the lobby has a slightly older idea of where they are)
  for (const id of remotes.players.keys()) {
    const pos = remotes.positionOf(id);
    if (!pos || resting(pos) || Math.abs(pos.y - player.position.y) > 1.2) continue;
    const d = Math.hypot(pos.x - player.position.x, pos.z - player.position.z);
    if (d < bestD) {
      bestD = d;
      best = { id, pos };
    }
  }
  return best;
}

// Swing the weapon in hand: at the nearest farmer in reach, or at the air
function bop() {
  const id = weaponInHand();
  const now = clock.elapsedTime;
  if (!id || now < bopReady || anim.swing >= 0) return;
  if (resting(player.position)) return inventory.notify('The stone circle is for resting: no bopping here');
  const target = bopTarget();
  if (target) anim.facing = Math.atan2(target.pos.x - player.position.x, target.pos.z - player.position.z);
  farmer.swing();
  bopReady = now + WEAPONS[id].every / 1000;
  net?.send({ t: C.BOP, weapon: id, yaw: Math.round(anim.facing * 100) / 100 });
}

function bopped(m) {
  if (m.by !== myId) remotes.swing(m.by);
  if (m.id === myId) {
    stopWalking();
    knock.set(m.dx * m.knock, 0, m.dz * m.knock);
    player.velocity.y = 5;
    player.onGround = false;
    anim.squash = -0.2;
    hud.flash('Bonk!');
    const [item, count] = m.drop ?? [];
    const lost = item ? Math.min(count, inventory.count(item)) : 0;
    if (lost) inventory.remove(item, lost);
    const who = lobbyNames.get(m.by) ?? 'Someone';
    inventory.notify(lost ? `${who} bopped you: you dropped ${lost} ${ITEMS[item].name.toLowerCase()}` : `${who} bopped you`);
  } else if (m.by === myId) {
    hud.flash('Bop!');
  }
}

// ---- What gets dropped: a little bobbing treasure, for anyone to walk into ----
function addDrop([id, item, count, x, y, z]) {
  if (!ITEMS[item] || drops.has(id)) return;
  const group = new THREE.Group();
  group.position.set(x, y - GROUND_STAND_Y + 0.3, z);
  const gem = createItemMesh(item);
  gem.scale.setScalar(0.7);
  group.add(gem);
  group.visible = !arenaId; // (on the lobby's island: out of sight while we are in an arena)
  scene.add(group);
  drops.set(id, { id, item, count, x, y, z, group, pending: false, retryAt: 0 });
}

function removeDrop(id) {
  const drop = drops.get(id);
  if (!drop) return;
  scene.remove(drop.group);
  drops.delete(id);
}

function clearDrops() {
  for (const id of [...drops.keys()]) removeDrop(id);
  knock.set(0, 0, 0);
}

function updateDrops(dt, t) {
  for (const drop of drops.values()) {
    const gem = drop.group.children[0];
    gem.position.y = Math.sin(t * 3 + drop.id) * 0.1;
    gem.rotation.y += dt * 2;
    drop.group.visible = !drop.pending;
    const near = Math.hypot(drop.x - player.position.x, drop.y - player.position.y, drop.z - player.position.z) < TOUCH_RADIUS + 0.4;
    if (!near || drop.pending || performance.now() < drop.retryAt || !inventory.canAdd(drop.item, drop.count)) continue;
    drop.pending = true;
    net?.send({ t: C.PICKUP, id: drop.id });
  }
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

  camZoom += (zoomGoal() - camZoom) * damp(CAM_ZOOM_EASE, dt);
  if (!Number.isFinite(camZoom)) camZoom = zoomGoal(); // never leave the camera nowhere
  camOffset.copy(CAM_OFFSET).multiplyScalar(camZoom);
  // Pushed back with the camera, so zooming out shows more island, not more fog
  scene.fog.near = FOG_NEAR * Math.max(1, camZoom);
  scene.fog.far = FOG_FAR * Math.max(1, camZoom);
  reachSun(camZoom);

  camera.position.copy(camTarget).add(camOffset);
  camera.lookAt(camTarget);
  followSun(camTarget, SUN_AHEAD * Math.max(1, camZoom));
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
  followSun(MENU_CAM.look, 0);
}

// ---------- Input ----------
// The keys drive the farmer only while nothing else has the keyboard: the
// title screen, the backpack, the chat line or the pause menu.
const keys = new Set();
let jumpPressed = false; // (a press shorter than a frame still jumps)
let jumpTapped = false; // a fresh press (not the key held down repeating): a jump in the air
const menuOpen = () => inventory.isOpen() || shop.isOpen() || chest.isOpen() || workbench.isOpen() || arcade.isOpen();
const inputBlocked = () => !splash.hidden || menuOpen() || hud.isTyping() || partyFrozen();
window.addEventListener('keydown', (e) => {
  if (inputBlocked()) return;
  keys.add(e.code);
  if (e.code === 'Space') jumpPressed = true;
  if (e.code === 'Space' && !e.repeat) jumpTapped = true;
  if (e.code === 'KeyE' && !e.repeat) useAction();
});

// E: in a lobby, chop the tree in reach with the axe in hand, else gather
// what is in reach. At home: trade at the merchant's counter, else harvest a
// ripe crop on the tile in front, otherwise use the selected toolbar item. Farming,
// chopping and mining reach USE_HEIGHT up or down (from a step or a platform).
function useAction() {
  if (!building && bosses.use()) return; // (a boss's portal or arena, or a mount in hand)
  if (place === 'lobby' && !arenaId && fishing.use()) return;
  if (place === 'lobby') {
    if (arenaId) return weaponInHand() && bop(); // (off in a party game's arena)
    if (atSign()) return useSign();
    if (weaponInHand() && (bopTarget() || !gatherSpotInReach())) return bop();
    if (holding() === 'axe' && swingAxe()) return;
    if (holding() === 'pickaxe' && swingPick()) return;
    const spot = gatherSpotInReach();
    if (spot) {
      takeSpot(spot);
      anim.squash = 0.15; // little crouch to pick
    } else if (holding() === 'hoe' || ITEMS[inventory.selectedId()]?.plants) {
      inventory.notify('This is not your land: farm at home');
    }
    return;
  }
  if (building) return buildHere();
  if (fishing.use()) return;
  if (houseDoorInReach()) return goInside();
  if (houseRoom.exitInReach(player.position)) return goOutside();
  if (chest.inReach(player.position)) return chest.open();
  if (buildings.nearest('workbench', player.position, BENCH_REACH)) return workbench.open();
  if (buildings.nearest('arcade', player.position, BENCH_REACH)) return arcade.open();
  if (atStall(player.position)) {
    shop.open();
    return;
  }
  if (ANIMAL_KINDS.includes(inventory.selectedId())) return letOutAnimal(inventory.selectedId());
  const animal = animals.inReach(player.position);
  if (animal) return tendAnimal(animal);
  if (holding() === 'axe' && swingAxe()) return;
  if (holding() === 'pickaxe' && swingPick()) return;
  farmHere();
}

// Harvest the ripe crop on the tile at x, z (E: the one in front), else till
// or plant it with what is in hand
function tendAnimal(animal) {
  let asked = false; // (she was ready: milked or sheared, or the backpack was full)
  animals.tend(animal, player.position, (item) => ((asked = true), collectProduce(item)));
  const day = Math.floor(farmHours() / 24);
  if (!asked && pettedOn.get(animal) !== day) {
    pettedOn.set(animal, day);
    skills.gain('animals', SKILLS.xp.pet);
  }
  anim.squash = 0.15;
}

// (in the house, just its field)
const offField = (tx, tz) => houseRoom.inside(player.position) && !inHouseField(...keyXZ(tileKeyFor(tx, tz)));

// The tiles the hoe in hand tills from x, z: a better hoe more round it,
// `tills` [across, ahead] of the way the farmer faces (where there is room)
function hoeTiles(x, z) {
  const sideways = Math.abs(Math.sin(anim.facing)) > Math.abs(Math.cos(anim.facing));
  const across = sideways ? [0, 1] : [1, 0];
  const ahead = sideways ? [Math.sign(Math.sin(anim.facing)), 0] : [0, Math.sign(Math.cos(anim.facing))];
  const [wide, deep] = ITEMS[inventory.selectedId()]?.tills ?? [1, 1];
  const span = (n) => Array.from({ length: n }, (_, i) => i - Math.floor(n / 2));
  const tiles = [];
  for (const j of span(deep)) for (const k of span(wide)) {
    const tx = x + (across[0] * k + ahead[0] * j) * TILE_SIZE;
    const tz = z + (across[1] * k + ahead[1] * j) * TILE_SIZE;
    if (!(k || j) || (!buildings.get(tileKeyFor(tx, tz)) && !inPen(tx, tz) && !offField(tx, tz))) tiles.push([tx, tz]);
  }
  return tiles;
}

function farmHere(x, z) {
  if (!footReach()) return;
  if (x === undefined) [x, z] = keyXZ(frontTile());
  if (harvestAt(x, z)) return;

  const held = inventory.selectedId();
  if (inPen(x, z) && (holding() === 'hoe' || ITEMS[held]?.plants)) {
    inventory.notify('That\'s the animals\' pen: farm outside the fence');
    return;
  }
  if (offField(x, z) && (holding() === 'hoe' || ITEMS[held]?.plants)) {
    inventory.notify('Farm in the field: the earth on the left');
    return;
  }
  if (holding() === 'hoe' && buildings.get(tileKeyFor(x, z))) {
    inventory.notify('Something is built here: take it down to till');
  } else if (holding() === 'hoe') {
    for (const [tx, tz] of hoeTiles(x, z)) {
      if (tillTileAt(tx, tz) && farmNet) {
        pendingTills.add(tileKeyFor(tx, tz));
        farmNet.send({ t: C.TILL, key: tileKeyFor(tx, tz) });
      }
    }
    startHoeSwing();
  } else if (ITEMS[held]?.plants) {
    if (plantAt(x, z, ITEMS[held].plants)) {
      inventory.consumeSelected();
      skills.gain('farming', SKILLS.xp.plant);
      anim.squash = 0.15; // little crouch to plant
      if (farmNet) {
        const key = tileKeyFor(x, z);
        crops.get(key).pending = true; // (till the room says so; if it says no, the seed comes back)
        farmNet.send({ t: C.PLANT, key, crop: ITEMS[held].plants });
      }
    } else if (!farmTiles.has(tileKeyFor(x, z))) {
      inventory.notify('Seeds go on tilled soil');
    }
  }
}

// What E would do here (as useAction and farmHere ask, doing nothing), for the
// prompt and the touch Use button: '' (nothing). In a lobby: bop, chop, mine
// or gather; at home: chop, mine, then harvest, till or plant the tile in front.
function useHint() {
  const fish = fishing.prompt();
  if (fish) return fish.replace(/^E {2}/, '');
  if (place === 'lobby') {
    const target = bopTarget();
    if (target && !resting(player.position)) return `Bop ${lobbyNames.get(target.id) ?? 'them'}`;
  }
  const tree = holding() === 'axe' ? treeInReach() : null;
  if (tree) return chopPrompt(tree);
  const rock = holding() === 'pickaxe' ? rockInReach() : null;
  if (rock) return minePrompt(rock);
  if (place === 'lobby') {
    const near = gatherSpotInReach();
    return near && !(near.kind === 'sky_vault' && !inventory.count('key')) ? GATHER_VERB[near.kind] : '';
  }
  if (!footReach()) return '';
  const [x, z] = keyXZ(frontTile());
  const key = tileKeyFor(x, z);
  const crop = crops.get(key);
  if (crop?.ripe) return crop.pending ? '' : `Harvest ${ITEMS[CROPS[crop.cropId].produce].name.toLowerCase()}`;
  const held = inventory.selectedId();
  if (inPen(x, z) || offField(x, z)) return '';
  if (holding() === 'hoe') return !buildings.get(key) && hoeTiles(x, z).some(([tx, tz]) => !farmTiles.has(tileKeyFor(tx, tz))) ? 'Till' : '';
  if (ITEMS[held]?.plants && farmTiles.has(key) && !crops.has(key)) return `Plant ${ITEMS[held].name.toLowerCase()}`;
  return '';
}
window.addEventListener('keyup', (e) => keys.delete(e.code));

window.addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// A phone can take the GPU back from a page in the background (Safari often
// does, after a while in another app). three.js picks up again if the browser
// gives it back; if it doesn't soon after the page is in view, start afresh
// (the farm is saved) rather than show a frozen screen.
let contextLost = false;
let lostInView = 0; // seconds in view since, without it back
canvas.addEventListener('webglcontextlost', () => (contextLost = true));
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  lostInView = 0;
});
setInterval(() => {
  if (!contextLost || document.hidden) return;
  if (++lostInView >= 3) {
    leavePage();
    location.reload();
  }
}, 1000);

// ---------- Physics constants ----------
const GRAVITY = -28;
const MOVE_SPEED = 7;
const JUMP_SPEED = 10;

function jump() {
  player.velocity.y = JUMP_SPEED;
  player.onGround = false;
  anim.squash = -0.2; // stretch on takeoff
}

// Just off a ledge you can still jump for a moment (COYOTE_TIME), and with
// the double jump unlocked (skills.js) once more in the air, off a puff of air.
const COYOTE_TIME = 0.1; // seconds
let airTime = 0; // seconds since the farmer was last on the ground
let airJumps = 0; // jumps left in the air
const puffs = createPuffs(scene);

function airJump() {
  airJumps--;
  player.velocity.y = DOUBLE_JUMP.speed;
  anim.squash = -0.25;
  puffs.puff(new THREE.Vector3(player.position.x, player.position.y - player.height / 2, player.position.z));
}

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

// ---------- Tapping the world ----------
// Tap (or click) somewhere and the farmer walks there, then does what that
// place is for: at home, harvest the ripe crop tapped, farm a tile next to
// you (till or plant it with what is in hand: a tile further off is just
// somewhere to go), tend the animal tapped or trade at the stall; in a lobby, gather from the bush or
// mushrooms tapped, or chop the tree tapped with the axe in hand, until it
// falls. The stick or the keys take over at once.
const TAP_MS = 600; // a press longer than this, or that moves further, is not a tap
const TAP_PX = 14;
const ARRIVE = 0.1; // how close to the middle of a tile counts as there
const FARM_REACH = 2.2; // tapping a tile within this farms it
const STUCK_TIME = 0.3; // seconds without getting closer: hop, and if that does no good, stop
let walk = null; // { kind: 'tile' | 'stall' | 'spot' | 'tree' | 'animal', x, y, z, farm, spot, tree, animal, best, stuck }
let chopping = null; // the tree a tap is chopping
let mining = null; // the rock a tap is mining

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();

// The tile marker: a square outline on the tile being walked to
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.56, 0.67, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })
);
marker.visible = false;
scene.add(marker);

// The tile cursor: at home with the hoe or seeds in hand, standing still, a
// faint square on the tile in front, the one E farms (see updateTileCursor)
const tileCursor = new THREE.Mesh(
  new THREE.RingGeometry(0.64, 0.7, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.5, depthWrite: false })
);
tileCursor.visible = false;
scene.add(tileCursor);

// The tile the farmer faces (the next one over, the way they look)
const frontTile = () => tileKeyFor(player.position.x + Math.sin(anim.facing) * 0.95, player.position.z + Math.cos(anim.facing) * 0.95);

function updateTileCursor(moving) {
  const held = inventory.selectedId();
  tileCursor.visible = place === 'home' && !building && !moving && player.onGround &&
    footReach() && (holding() === 'hoe' || !!ITEMS[held]?.plants);
  if (!tileCursor.visible) return;
  const [x, z] = keyXZ(frontTile());
  tileCursor.position.set(x, 0.1, z);
}

// The hover outline: with a mouse, a white line round what it points at, a
// tree or a rock, else (at home) the tile
let hoverAt = null; // where the mouse is over the game (null: off it, or not a mouse)
const hoverMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
const hoverTile = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), hoverMat);
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 32).rotateX(-Math.PI / 2), hoverMat);
hoverTile.visible = hoverRing.visible = false;
scene.add(hoverTile, hoverRing);
canvas.addEventListener('pointermove', (e) => (hoverAt = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null));
canvas.addEventListener('pointerleave', () => (hoverAt = null));

const _base = new THREE.Vector3();
function updateHover() {
  hoverTile.visible = hoverRing.visible = false;
  if (!hoverAt || held || building || place === 'title' || inputBlocked()) return;
  _ndc.set((hoverAt.x / window.innerWidth) * 2 - 1, -(hoverAt.y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const things = new Map(); // object -> [where its foot is, how wide the ring round it]
  for (const tree of world.trees) if (tree.state === 'up') things.set(tree.group, [tree.group, 0, 0.45 + tree.scale * 0.35]);
  for (const rock of world.rocks) if (rock.state === 'up') things.set(rock.mesh, [rock.mesh, rock.scale * 0.3, rock.radius + 0.2]);
  const hits = raycaster.intersectObjects([...things.keys()], true);
  for (let obj = hits[0]?.object; obj; obj = obj.parent) {
    if (!things.has(obj)) continue;
    const [at, sink, r] = things.get(obj);
    at.getWorldPosition(_base);
    hoverRing.position.set(_base.x, _base.y - sink + 0.08, _base.z);
    hoverRing.scale.setScalar(r);
    hoverRing.visible = true;
    return;
  }
  if (place === 'lobby') return;
  const tile = tappedGround();
  if (!tile) return;
  hoverTile.position.set(tile.x, tile.y + 0.1, tile.z);
  hoverTile.visible = true;
}

// The right mouse button cancels what we are in the middle of: build mode,
// or walking (and chopping, mining) to something clicked, or steering with
// the left button held down
function cancelAction() {
  if (building) {
    stopBuilding();
  } else if (walk || chopping || mining || held) {
    stopWalking();
    held = null;
  }
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // (no browser menu over the game)

const presses = new Map(); // pointerId -> where and when it went down
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button === 2) {
    if (place !== 'title' && !inputBlocked()) cancelAction();
    return;
  }
  if (e.pointerType !== 'mouse' || e.button === 0) presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
  if (e.pointerType === 'mouse' && e.button === 0 && place !== 'title' && !building && !inputBlocked()) {
    stopWalking();
    held = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId); // (keeps steering over the HUD)
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== held?.id) return;
  held.x = e.clientX;
  held.y = e.clientY;
});
canvas.addEventListener('lostpointercapture', (e) => e.pointerId === held?.id && (held = null));
addEventListener('blur', () => (held = null));
canvas.addEventListener('pointercancel', (e) => {
  presses.delete(e.pointerId);
  pinch.delete(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId === held?.id) held = null;
  const press = presses.get(e.pointerId);
  presses.delete(e.pointerId);
  pinch.delete(e.pointerId);
  if (!press || e.timeStamp - press.t > TAP_MS || Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_PX) return;
  if (place !== 'title' && !inputBlocked()) tapAt(e.clientX, e.clientY);
});

// Zoom: the mouse wheel (a trackpad pinch arrives as a wheel too), or two
// fingers pinched on the screen. Spreading them, or wheeling up, comes closer.
canvas.addEventListener('wheel', (e) => {
  e.preventDefault(); // or a trackpad pinch zooms the page
  if (place === 'title' || inputBlocked()) return;
  const lines = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomBy(Math.exp(THREE.MathUtils.clamp(lines, -100, 100) * 0.002));
}, { passive: false });

const pinch = new Map(); // pointerId -> where each finger on the canvas is now
let pinchGap = 0;
const fingerGap = () => {
  const [a, b] = pinch.values();
  return Math.hypot(a.x - b.x, a.y - b.y);
};
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch.size !== 2) return;
  pinchGap = fingerGap();
  presses.clear(); // a pinch is not a tap
});
canvas.addEventListener('pointermove', (e) => {
  const finger = pinch.get(e.pointerId);
  if (!finger) return;
  finger.x = e.clientX;
  finger.y = e.clientY;
  if (pinch.size !== 2) return;
  const gap = fingerGap();
  if (pinchGap > 0 && gap > 0 && place !== 'title' && !inputBlocked()) zoomBy(pinchGap / gap);
  pinchGap = gap;
});

function tapAt(x, y) {
  _ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  stopWalking();
  if (building) return tapToBuild();
  const target = tappedThing() ?? tappedGround();
  if (!target) return;
  const built = target.kind === 'tile' && buildings.get(tileKeyFor(target.x, target.z));
  if (built === 'workbench' || built === 'arcade') target.kind = built;
  walk = { best: Infinity, stuck: 0, hopped: false, ...target };
  if (walk.kind === 'tile') {
    marker.position.set(walk.x, walk.y + 0.08, walk.z);
    marker.visible = true;
  }
}

// A bush, mushrooms or a tree in a lobby; the merchant, the stall or an animal at home
function tappedThing() {
  const things = new Map(); // object -> what tapping it means
  if (place === 'lobby') {
    for (const spot of spots.values()) if (spot.use === 'gather') things.set(spot.view.group, { kind: 'spot', spot, x: spot.x, z: spot.z });
    for (const tree of world.trees) if (tree.state === 'up') things.set(tree.group, { kind: 'tree', tree, x: tree.x, z: tree.z });
    for (const rock of world.rocks) if (rock.state === 'up') things.set(rock.mesh, { kind: 'rock', rock, x: rock.x, z: rock.z });
    // (with a weapon in hand: another farmer, to go and bop)
    if (weaponInHand()) {
      for (const [id, r] of remotes.players) {
        const pos = remotes.positionOf(id);
        if (pos) things.set(r.farmer.root, { kind: 'farmer', id, x: pos.x, z: pos.z });
      }
    }
  } else {
    const stall = { kind: 'stall', x: TRADE_SPOT.x, z: TRADE_SPOT.z };
    if (chest.shown()) things.set(chest.root, { kind: 'chest', x: chest.at().x, z: chest.at().z + 0.9 });
    for (const house of buildings.findAll('house')) {
      const door = houseDoorAt(house);
      things.set(buildings.groupOf(house), { kind: 'door', x: door.x, z: door.z + 0.6 });
    }
    things.set(houseRoom.door, { kind: 'exit', ...houseRoom.entry() });
    things.set(merchant.root, stall);
    things.set(world.root.getObjectByName('stall'), stall);
    for (const animal of animals.list()) if (animal.root.visible) things.set(animal.root, { kind: 'animal', animal, x: animal.pos.x, z: animal.pos.z });
    // (the farm's trees with the axe in hand, its rocks with the pickaxe: otherwise a tap there is for the tile)
    if (holding() === 'axe') for (const tree of world.trees) if (tree.state === 'up') things.set(tree.group, { kind: 'tree', tree, x: tree.x, z: tree.z });
    if (holding() === 'pickaxe') for (const rock of world.rocks) if (rock.state === 'up') things.set(rock.mesh, { kind: 'rock', rock, x: rock.x, z: rock.z });
  }
  const hits = raycaster.intersectObjects([...things.keys()].filter(Boolean), true);
  for (let obj = hits[0]?.object; obj; obj = obj.parent) if (things.has(obj)) return things.get(obj);
  return null;
}

// The ground (or the platform) tapped. At home, the middle of its tile.
function tappedGround() {
  const trunks = new Set(world.trees.map((tree) => tree.collider));
  let best = null;
  let bestD = Infinity;
  for (const box of world.platforms) {
    if (trunks.has(box) || !raycaster.ray.intersectBox(box, _hit)) continue;
    const d = _hit.distanceToSquared(raycaster.ray.origin);
    if (d < bestD) {
      bestD = d;
      best = { x: _hit.x, y: box.max.y, z: _hit.z };
    }
  }
  if (!best) return null;
  if (place === 'lobby') return { kind: 'ground', ...best };
  const [gx, gz] = tileKeyFor(best.x, best.z).split(',').map(Number);
  const tile = { kind: 'tile', x: gx * TILE_SIZE, y: best.y, z: gz * TILE_SIZE };
  const crop = crops.get(tileKeyFor(tile.x, tile.z));
  tile.farm = crop?.ripe || (!inPen(tile.x, tile.z) && Math.hypot(tile.x - player.position.x, tile.z - player.position.z) < FARM_REACH);
  return tile;
}

function stopWalking() {
  walk = null;
  chopping = null;
  mining = null;
  marker.visible = false;
}

// Are we there? (what counts as there depends on what was tapped)
function arrived(d) {
  switch (walk.kind) {
    case 'stall': return atStall(player.position);
    case 'chest': return chest.inReach(player.position);
    case 'door': return houseDoorInReach();
    case 'exit': return houseRoom.exitInReach(player.position);
    case 'spot': return d < GATHER_REACH * 0.8 && Math.abs(player.position.y - GROUND_STAND_Y - walk.spot.y) < 1.2;
    case 'tree': return treeInReach() === walk.tree;
    case 'rock': return rockInReach() === walk.rock;
    case 'animal': return animals.canReach(walk.animal, player.position);
    case 'farmer': return bopTarget()?.id === walk.id;
    case 'build': return inBuildReach(walk.key) && d < BUILD_REACH - 0.3;
    case 'workbench': return !!buildings.nearest('workbench', player.position, BENCH_REACH);
    case 'arcade': return !!buildings.nearest('arcade', player.position, BENCH_REACH);
    default: return d < ARRIVE;
  }
}

// Then do what the tap was for
function arrive() {
  const { kind, farm, spot, tree, rock, animal, key, x, z } = walk;
  stopWalking();
  if (kind === 'build') {
    if (building) buildAt(key);
  } else if (kind === 'workbench') workbench.open();
  else if (kind === 'arcade') arcade.open();
  else if (kind === 'stall') shop.open();
  else if (kind === 'chest') chest.open();
  else if (kind === 'door') goInside();
  else if (kind === 'exit') goOutside();
  else if (kind === 'animal') tendAnimal(animal);
  else if (kind === 'farmer') bop();
  else if (kind === 'tile' && farm) farmHere(x, z);
  else if (kind === 'spot' && spot.item && !spot.pending) {
    takeSpot(spot);
    anim.squash = 0.15;
  } else if (kind === 'tree') {
    if (holding() !== 'axe') inventory.notify('Take the axe in hand to chop');
    else if (swingAxe()) chopping = tree;
  } else if (kind === 'rock') {
    if (holding() !== 'pickaxe') inventory.notify('Take the pickaxe in hand to mine');
    else if (swingPick()) mining = rock;
  }
}

// Holding the left mouse button down walks toward wherever it points, for as
// long as it is held: the farmer heads for the spot on the ground (at their
// own feet' height) under the mouse, every frame, so the mouse steers. Let go
// quickly and it was a click after all (above).
let held = null; // { id, x, y }: the mouse button held down, and where it is
const _feet = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const FOLLOW_CLOSE = 0.3; // the mouse this close to the farmer: stand still

function followMouse(dt) {
  _ndc.set((held.x / window.innerWidth) * 2 - 1, -(held.y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  _feet.constant = -(player.position.y - player.height / 2);
  if (!raycaster.ray.intersectPlane(_feet, _hit)) return { x: 0, z: 0 };
  const dx = _hit.x - player.position.x;
  const dz = _hit.z - player.position.z;
  const d = Math.hypot(dx, dz);
  if (d < FOLLOW_CLOSE) return { x: 0, z: 0 };
  const k = Math.min(1, (d - FOLLOW_CLOSE) / (MOVE_SPEED * dt)) / d;
  return { x: dx * k, z: dz * k };
}

// Which way to walk this frame for a tap ({0, 0}: not walking), slowing down
// at the end so as not to overshoot. Hops once when something is in the way
// (a ledge, a step up onto a platform).
function steer(dt) {
  const none = { x: 0, z: 0 };
  if (!walk) return none;
  if (walk.kind === 'animal') ({ x: walk.x, z: walk.z } = walk.animal.pos); // (she wanders off)
  if (walk.kind === 'farmer') {
    const pos = remotes.positionOf(walk.id); // (they run off)
    if (!pos) {
      stopWalking();
      return none;
    }
    ({ x: walk.x, z: walk.z } = pos);
  }
  const dx = walk.x - player.position.x;
  const dz = walk.z - player.position.z;
  const d = Math.hypot(dx, dz);
  if (arrived(d)) {
    arrive();
    return none;
  }
  if (d < walk.best - 0.02) {
    walk.best = d;
    walk.stuck = 0;
    walk.hopped = false;
  } else if ((walk.stuck += dt) > STUCK_TIME) {
    if (walk.hopped || !player.onGround) {
      // As far as we get: a tile is still farmed if we are standing on it
      if (walk.kind === 'tile' && tileKeyFor(player.position.x, player.position.z) === tileKeyFor(walk.x, walk.z)) arrive();
      else stopWalking();
      return none;
    }
    jump();
    walk.hopped = true;
    walk.stuck = 0;
  }
  const k = Math.min(1, d / (MOVE_SPEED * dt)) / d;
  return { x: dx * k, z: dz * k };
}

// ---------- Building (build mode, at home) ----------
// The backpack's Build tab (or B) picks a piece (PIECES in shared/level.js),
// or taking pieces down. A see-through one shows where it would go (red
// where it can't, src/build.js): the tile the mouse is over (until the
// farmer walks with the keys), else the tile in front of the farmer. E puts
// it there, paid for with the backpack's wood and stone (hold E and walk
// along to lay a path); a click or a tap builds on the tile clicked, walking
// over first if it is far. Taking a piece
// down gives back what it cost. Esc or Done ends it. On a farm with helpers
// the room says yes (BUILT) or no (FARM_DENY: it goes, and the cost comes back).
const buildings = createBuildings(worlds.home);

// ---------- The house ----------
// Built in build mode (the house piece, one to a farm, 5 tiles by 4). E at
// its door (or a tap on it) goes inside: a room of its own (house.js), with a
// field to farm, out past the sea on the farm's world; E at the door in there
// comes back out, in front of the house.
const houseRoom = createHouseRoom(worlds.home);
const DOOR_REACH = 1.3;
// the middle of the house's door, on its front (the house built on tile key)
const houseDoorAt = (key) => {
  const [x, z] = keyXZ(key);
  return { x, z: z + 0.4 * TILE_SIZE };
};
// The house whose door is in reach (its tile), or null. (A farm has a house
// for each helper, and one: every door goes into the same room.)
function houseDoorInReach() {
  if (place !== 'home' || player.position.y > 2.2) return null;
  return buildings.findAll('house').find((key) => {
    const door = houseDoorAt(key);
    return Math.hypot(player.position.x - door.x, player.position.z - (door.z + 0.6)) < DOOR_REACH;
  }) ?? null;
}
let cameInBy = null; // the house we went inside by (its tile): out through its door again

function goInside() {
  cameInBy = houseDoorInReach() ?? buildings.find('house');
  const { x, z } = houseRoom.entry();
  putDown({ x, y: GROUND_STAND_Y, z });
  anim.facing = Math.PI; // (into the room)
}

// In front of the door we came in by (or another house's, if that one was
// taken down meanwhile; with none, the plaza)
function goOutside() {
  const key = buildings.get(cameInBy ?? '') === 'house' && buildings.anchor(cameInBy) === cameInBy ? cameInBy : buildings.find('house');
  if (!key) return putDown(arrival());
  const door = houseDoorAt(key);
  putDown({ x: door.x, y: GROUND_STAND_Y, z: door.z + 0.9 });
  anim.facing = 0; // (toward the camera)
}
const BUILD_REACH = 2.4; // a tile this close is built on from where you stand (the farm's room allows 2.6)
const FARM_EDGE = 27; // tiles out to here (the farm's room allows 28)
let building = null; // build mode: a PIECES id, or 'remove'
let builtKey = null; // the tile E last built on (holding E builds on each new one)
let mouseAt = null; // where the mouse is over the screen, while build mode aims with it
let buildShown = ''; // (what the build bar says, so it is only set when it changes)
const pendingBuilds = new Map(); // tiles we built on that the farm's room hasn't said yes to yet -> what came out of the backpack for it
const pendingUnbuilds = new Set(); // and pieces we asked it to take down

function startBuilding(piece) {
  if (place !== 'home') return;
  stopWalking();
  building = piece;
  builtKey = null;
}

function stopBuilding() {
  building = null;
  mouseAt = null;
  buildShown = '';
  buildings.preview(null);
  hud.setBuilding(null);
}

const onOwnTile = (key) => tileKeyFor(player.position.x, player.position.z) === key;
function inBuildReach(key) {
  const [x, z] = keyXZ(key);
  return Math.hypot(x - player.position.x, z - player.position.z) <= BUILD_REACH && !(PIECES[building]?.solid && onOwnTile(key));
}

// The tile to build on: the one under the mouse, else the one in front
// (taking down: the piece in front, else the path underfoot)
function buildTarget() {
  if (mouseAt) {
    _ndc.set((mouseAt.x / window.innerWidth) * 2 - 1, -(mouseAt.y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(_ndc, camera);
    const tile = tappedGround();
    if (tile) return tileKeyFor(tile.x, tile.z);
  }
  const { x, z } = player.position;
  const front = tileKeyFor(x + Math.sin(anim.facing) * 0.95, z + Math.cos(anim.facing) * 0.95);
  if (building !== 'remove' || buildings.get(front)) return front;
  const here = tileKeyFor(x, z);
  return buildings.get(here) ? here : front;
}

// Who is standing on (or half on) the tile at x, z: 'you', 'someone' or ''
function standingAt(x, z) {
  const near = (p, r = 0.85) => p && Math.abs(p.x - x) < r && Math.abs(p.z - z) < r;
  if (near(player.position, 0.75)) return 'you';
  if ([...remotes.players.keys()].some((id) => near(remotes.positionOf(id)))) return 'someone';
  return animals.list().some((animal) => animal.root.visible && near(animal.pos)) ? 'someone' : '';
}

// Anything of the island's in the way on the tile at x, z (the stall, a
// platform, a tree, the pens' fences)
function blockedTile(x, z) {
  const h = 0.45;
  return world.platforms.some((box) => !box.ground && !box.piece && box.min.y < 2.2 &&
    box.min.x < x + h && box.max.x > x - h && box.min.z < z + h && box.max.z > z - h);
}

// How many helpers the farm we are on has (each lets it have one more house)
const farmHelpers = () => (farmVisit ? farmVisit.helpers : farmSync.farm?.helpers ?? 0);

// Why the piece in hand can't go on (or come off) tile key ('': it can)
function buildProblemAt(key) {
  if (!player.onGround || Math.abs(player.position.y - GROUND_STAND_Y) > 0.05) return 'Stand on the ground to build';
  if (houseRoom.inside(player.position)) return 'Build outside the house';
  if (!inBuildReach(key)) return onOwnTile(key) ? 'Step off it first' : 'Too far: click it to walk over';
  if (building === 'remove') {
    const piece = buildings.get(key);
    if (!piece || pendingUnbuilds.has(buildings.anchor(key))) return 'Nothing to take down there';
    if (piece === 'farm_chest' && !farmVisit && Object.keys(ownChest).length) return 'Empty the chest first';
    if (bosses.busy(piece)) return 'Someone is in there, fighting: wait till they are back';
    if (!Object.entries(PIECES[piece].cost).every(([item, n]) => inventory.canAdd(item, n))) return 'No room in the backpack for what it gives back';
    return '';
  }
  const piece = PIECES[building];
  if (piece.one && buildings.find(building)) return `The farm has a ${piece.name.toLowerCase()}: take it down to move it`;
  if (buildings.findAll(building).length >= mostPieces(building, farmHelpers())) return `One house, and one more for each helper: invite a friend to build another`;
  // (every tile it would stand on: a house has 20)
  for (const k of pieceTiles(building, key)) {
    const problem = tileProblem(k, piece);
    if (problem) return problem;
  }
  if (buildings.size() >= MAX_PIECES) return 'The farm can\'t hold any more';
  const short = Object.entries(piece.cost).find(([item, n]) => buildStock(item) < n);
  if (short && piece.portal) return `Its portal takes ${piece.cost[short[0]]} ${ITEMS[short[0]].name.toLowerCase()}s: find them in lobbies and on sky isles`;
  if (short && PIECES[short[0]]?.relic) return `Find another ${ITEMS[short[0]].name.toLowerCase()} on a sky isle first`;
  if (short) return ITEMS[short[0]].piece ? `Make a ${ITEMS[short[0]].name.toLowerCase()} at a workbench first` : `Not enough ${ITEMS[short[0]].name.toLowerCase()}`;
  return '';
}

// Why `piece` can't stand on tile key ('': it can)
function tileProblem(key, piece) {
  const [x, z] = keyXZ(key);
  const [gx, gz] = key.split(',').map(Number);
  if (buildings.get(key)) return 'Something is built there';
  if (farmTiles.has(key)) return 'That soil is tilled';
  if (Math.max(Math.abs(gx), Math.abs(gz)) > FARM_EDGE) return 'Too close to the water';
  if (keptClear(gx, gz)) return 'Keep that spot clear for farmers arriving';
  if (inPen(x, z)) return 'That\'s the animals\' pen';
  if (piece.solid && Math.hypot(x - TRADE_SPOT.x, z - TRADE_SPOT.z) < 1.2) return 'Keep the way to the stall clear';
  if (blockedTile(x, z)) return 'Something is in the way';
  const standing = piece.solid && standingAt(x, z);
  if (standing) return standing === 'you' ? 'Step back a little first' : 'Someone is standing there';
  return '';
}

// Build (or take down) on tile key; false (and a word why) if it can't be done
function buildAt(key, { quiet = false } = {}) {
  const problem = buildProblemAt(key);
  if (problem) {
    if (!quiet) inventory.notify(problem);
    return false;
  }
  const [x, z] = keyXZ(key);
  if (!onOwnTile(key)) anim.facing = Math.atan2(x - player.position.x, z - player.position.z);
  anim.squash = 0.15;
  builtKey = key;
  if (building === 'remove') {
    if (farmNet) {
      pendingUnbuilds.add(buildings.anchor(key)); // (a house: by the tile it was built on, whichever of its tiles this is)
      farmNet.send({ t: C.UNBUILD, key }); // (the room says which piece that was)
    } else {
      giveBack(buildings.remove(key));
      placeChest();
    }
    return true;
  }
  // (out of the backpack first; what it is short of, out of the chest)
  const carried = {};
  const fromChest = {};
  for (const [item, n] of Object.entries(PIECES[building].cost)) {
    carried[item] = Math.min(n, inventory.count(item));
    if (carried[item]) inventory.remove(item, carried[item]);
    if (n > carried[item]) fromChest[item] = n - carried[item];
  }
  if (!farmNet) {
    for (const [item, n] of Object.entries(fromChest)) {
      ownChest[item] -= n;
      if (!ownChest[item]) delete ownChest[item];
    }
  }
  buildings.place(key, building);
  placeChest();
  if (farmNet) {
    // (the room takes the chest's share, and says what is left in it)
    pendingBuilds.set(key, carried);
    farmNet.send({ t: C.BUILD, key, piece: building, ...(Object.keys(fromChest).length && { chest: fromChest }) });
  }
  return true;
}

const buildHere = () => buildAt(buildTarget());

// What a piece cost, back into the backpack (paid: just what came out of it)
function giveBack(piece, paid = PIECES[piece]?.cost ?? {}) {
  for (const [item, n] of Object.entries(paid)) if (n) gift(item, n);
}

// What there is to build with besides the backpack: our own chest, or on our
// farm with helpers the room's (only its owner takes things out of it)
const chestStock = () => (farmNet ? (farmVisit?.mine ? roomChest : {}) : ownChest);
const buildStock = (item) => inventory.count(item) + (chestStock()[item] ?? 0);

// A tap in build mode: build on the tile tapped, walking over first if it is far
function tapToBuild() {
  const tile = tappedGround();
  if (!tile) return;
  const key = tileKeyFor(tile.x, tile.z);
  if (inBuildReach(key)) return buildAt(key);
  walk = { kind: 'build', key, x: tile.x, z: tile.z, best: Infinity, stuck: 0, hopped: false };
  marker.position.set(tile.x, tile.y + 0.08, tile.z);
  marker.visible = true;
}

// Build mode aims with the mouse once it moves over the ground, and with the
// farmer again once they walk with the keys
canvas.addEventListener('pointermove', (e) => {
  if (building && e.pointerType === 'mouse') mouseAt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => (mouseAt = null));
const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => WALK_KEYS.has(e.code) && (mouseAt = null));

// Each frame in build mode: the see-through piece, holding E, the build bar.
// Returns the prompt.
function updateBuilding() {
  const key = buildTarget();
  const problem = buildProblemAt(key);
  buildings.preview(key, building, !problem);
  // (holding E lays a path, or takes pieces down, as you go: a fence, a gate, a wall or a block at a time)
  if (keys.has('KeyE') && key !== builtKey && !problem && !PIECES[building]?.solid && !PIECES[building]?.joins) buildAt(key, { quiet: true });
  const piece = PIECES[building];
  const what = piece ? `Building: ${piece.name}` : 'Taking down';
  const note = problem || (piece
    ? Object.entries(piece.cost).map(([item, n]) => {
      const stored = chestStock()[item] ?? 0;
      return `${n} ${ITEMS[item].name.toLowerCase()} (you have ${inventory.count(item)}${stored ? `, ${stored} in the chest` : ''})`;
    }).join(' · ')
    : 'Gives back what it cost');
  if (buildShown !== what + note) {
    buildShown = what + note;
    hud.setBuilding(what, note);
  }
  if (problem) return '';
  return piece ? `E  Build ${piece.name.toLowerCase()}` : 'E  Take it down';
}

// ---------- Places: the title screen, home, an online lobby ----------
// Home is your own farm, all in this page. A lobby is an online place
// (shared/room.js on the game server) where farmers drop in to gather what
// grows there; nothing of the farm comes along but the backpack.
//
// A farm with helpers (friends its owner invited, server/farms.js) is played
// together, through its room on the server (server/farmroom.js): your own,
// whenever the server is there, and a friend's when you go and help. Place
// is 'home' on any farm; farmVisit says whose, and farmNet is the line to its
// room. The room has the soil, the crops, the chest and the clock; this page
// farms as it does at home, asks the room, and draws what it says.
let place = 'title'; // 'title' | 'home' | 'lobby'
let net = null; // the Connection while in (or on the way to) a lobby
let farmNet = null; // the Connection to a farm's room (ours with its helpers, or a friend's), on it or on the way
let farmVisit = null; // on a farm's room: { id, name, owner, mine, alone, helpers }
let farmJoining = 0; // (each joinFarm's number: a newer one wins)
const pendingTills = new Set(); // tiles we tilled that the farm's room hasn't said yes to yet
const visiting = () => !!farmVisit && !farmVisit.mine; // on a friend's farm
let session = null; // { code, seed, room, wilds, sign } once a lobby has welcomed us (sign: where its signpost stands)
let myId = 0;
let partyGame = null; // the lobby's party game as it last said (shared/minigame.js wire()), or null
let arenaId = 0; // the party game whose arena we are in (0: on the lobby's island)
let lobbyRoster = []; // (as the lobby last sent it: remotes shows those where we are)
let sendTimer = 0;
let farmOnScreen = false; // the home farm's soil and crops are in the scene
// (a lobby's day starts mid-morning, in good light: LOBBY_DAWN, shared/giants.js)

const remotes = new Remotes(scene, { waterFrom });
const touch = new TouchControls(); // (only shown on a touch screen)

// The water at x, z, to fish in: { water, y } (which FISHING table, and its
// surface), or null: land. In a lobby, its sea and its pond; on a farm, the
// sea past its edge and a fish pond built on it.
function waterAt(x, z) {
  if (place === 'lobby') {
    const what = wildIsland && waterOn(wildIsland, x, z);
    return what && { water: 'lobby', y: what === 'sea' ? WATER_Y : LOBBY_POND_Y };
  }
  if (Math.max(Math.abs(x), Math.abs(z)) > HOME_HALF + 0.5) return { water: 'sea', y: WATER_Y };
  const pond = buildings.get(tileKeyFor(x, z)) === 'pond' && buildings.anchor(tileKeyFor(x, z));
  if (!pond) return null;
  const [px, pz] = keyXZ(pond);
  return Math.abs(x - px) < 1.1 && Math.abs(z - (pz - 1)) < 1.1 ? { water: 'pond', y: POND_WATER_Y } : null; // (the water, inside its stones)
}

// Where a bobber cast from x, z facing yaw lands: a little way out on the
// first water in front, within CAST_REACH ({ x, y, z, water }), or null
function waterFrom(x0, z0, yaw) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (let d = 1; d <= CAST_REACH; d += 0.25) {
    if (!waterAt(x0 + fx * d, z0 + fz * d)) continue;
    const out = Math.min(d + 1.2, CAST_REACH);
    for (const at of [out, d]) {
      const x = x0 + fx * at;
      const z = z0 + fz * at;
      const w = waterAt(x, z);
      if (w) return { x, z, ...w };
    }
  }
  return null;
}
const hud = new Hud({
  onTravel: () => splash.show({ page: 'online' }),
  onMenu: () => splash.show(),
  isMenuOpen: () => !splash.hidden,
  onMenuEscape: () => splash.escape(),
  onHome: () => goHome(),
  onChat: (text) => (place === 'lobby' ? net : farmNet)?.send({ t: C.CHAT, text }),
  isBlocked: () => menuOpen() || !splash.hidden,
  onPrompt: (text) => touch.setReady(!!text),
  onStopBuilding: () => stopBuilding(),
});

// ---------- Fishing ----------
// With a rod in hand, E facing the sea or a pond casts (src/fishing.js; in
// a lobby the room rolls the catch, on a farm the page does).
const fishing = createFishing({
  scene, farmer, player, inventory, hud, touch,
  waterAhead: () => (player.onGround && !menuOpen() && !houseRoom.inside(player.position) ? waterFrom(player.position.x, player.position.z, anim.facing) : null),
  hour: () => dayNight.hour(),
  lobby: () => (place === 'lobby' ? net : null),
  rodInHand: () => (holding() === 'rod' ? inventory.selectedId() : null),
  skill: () => skills.level('fishing'),
  landed: () => skills.gain('fishing', SKILLS.xp.fish),
});

// ---------- The bosses ----------
// Their portals on the farm, their arenas out past the sea, the fights and
// what they give (bosses.js; shared/bosses.js has the rules)
const bosses = createBosses({
  world: worlds.home,
  player,
  farmer,
  inventory,
  hud,
  giantBars,
  buildings,
  myId: () => myId,
  net: () => farmNet,
  atHome: () => place === 'home',
  weapon: () => weaponInHand(),
  putDown,
  arrival: () => arrival(),
  knock(dx, dz, speed) {
    stopWalking();
    knock.set(dx * speed, 0, dz * speed);
    player.velocity.y = 5;
    player.onGround = false;
    anim.squash = -0.2;
  },
  // (played alone, a beaten boss's portal goes: its key pieces are used up)
  removePortal(boss) {
    const key = buildings.find(portalOf(boss));
    if (!key) return;
    buildings.remove(key);
    placeChest();
  },
  farmIsOurs: () => place === 'home' && farmOnScreen && (!farmVisit || farmVisit.mine),
  addShiny: (kind) => !!animals.addShiny(kind),
  save: () => saveGame(),
});
// (after the HUD: its key handler goes first, see shop.js)
const shop = createShop({
  inventory,
  onOpenChange: (open) => (open ? keys.clear() : saveGame()), // a trade is saved as soon as you walk off
});
// Now and then something turns up on the farm, to walk into (finds.js):
// out on the grass, with nothing tilled, fenced in or standing there (the
// stall, a platform, a tree, something built), and not right underfoot
function freeFarmSpot() {
  const edge = HOME.half - 4;
  const h = 0.45;
  for (let tries = 0; tries < 40; tries++) {
    const x = (Math.random() * 2 - 1) * edge;
    const z = (Math.random() * 2 - 1) * edge;
    if (HOME.tileType(x, z) !== 'grass' || farmTiles.has(tileKeyFor(x, z)) || inPen(x, z, 0.5)) continue;
    if (world.platforms.some((box) => !box.ground && box.min.y < 2.2 && box.min.x < x + h && box.max.x > x - h && box.min.z < z + h && box.max.z > z - h)) continue;
    if (world.rocks.some((rock) => rock.state === 'up' && Math.hypot(rock.x - x, rock.z - z) < rock.radius + 0.6)) continue;
    if (Math.hypot(x - player.position.x, z - player.position.z) < 4) continue;
    return { x, y: 0, z };
  }
  return null;
}
const farmFinds = createFarmFinds({ scene, freeSpot: freeFarmSpot, onPickUp: (item, count) => inventory.add(item, count) });
// The farm's chest (chest.js): where its piece is built; on a farm with
// helpers, by the plaza till one is. On a farm with helpers what is in it is
// the room's; on our own farm without them, ours (ownChest, kept in the
// farm's save). It is a thing to bump into while it is there.
let ownChest = {}; // item -> count
let roomChest = {}; // what the room's chest has, as it last said
const chest = createChest({
  inventory,
  onOpenChange: (open) => (open ? keys.clear() : saveGame()),
  onPut: (item, count) => {
    if (farmVisit) return farmNet?.send({ t: C.CHEST_PUT, item, count });
    if (!chestHasRoom(ownChest, item, count)) {
      inventory.add(item, count, { quiet: true }); // (back where it came from)
      return inventory.notify('The chest is full');
    }
    ownChest[item] = (ownChest[item] ?? 0) + count;
    chest.setItems(ownChest);
  },
  onTake: (item, count) => {
    if (farmVisit) return farmNet?.send({ t: C.CHEST_TAKE, item, count });
    const n = Math.min(count, ownChest[item] ?? 0);
    if (!n || !inventory.add(item, n)) return;
    ownChest[item] -= n;
    if (!ownChest[item]) delete ownChest[item];
    chest.setItems(ownChest);
    chest.refresh();
  },
});
worlds.home.root.add(chest.root);

// Where the chest stands now, and whose it is (after the farm's pieces change)
function placeChest() {
  const key = buildings.find('farm_chest');
  const byPlaza = !key && !!farmVisit;
  if (key) chest.moveTo(...keyXZ(key));
  else chest.moveTo(FARM_CHEST.x, FARM_CHEST.z);
  showChest(!!key || byPlaza, byPlaza); // (a built one is in the way as a piece already)
  if (farmVisit) return; // (the room says what is in it)
  chest.setOwner(true, '', false);
  chest.setItems(ownChest);
}

// What we kept in our chest while playing our farm without its room goes
// into the room's, as much as there is room for (the rest stays ours for now).
// theirs: what the room's chest has.
function pourOwnChest(theirs) {
  const room = { ...theirs };
  for (const [item, count] of Object.entries(ownChest)) {
    if (!chestHasRoom(room, item, count)) continue;
    room[item] = (room[item] ?? 0) + count;
    farmNet.send({ t: C.CHEST_PUT, item, count });
    delete ownChest[item];
  }
}

// The workbench (workbench.js): built in build mode, and E next to one opens it
const BENCH_REACH = 1.7; // from its middle
const workbench = createWorkbench({
  inventory,
  onOpenChange: (open) => (open ? keys.clear() : saveGame()),
  upgrades: { level: (id) => farmLevels[id], problem: upgradeProblem, upgrade },
});

// The arcade (arcade.js): built in build mode too, and E next to it opens
// it; every game won or lost is saved
const arcade = createArcade({ inventory, onOpenChange: (open) => (open ? keys.clear() : saveGame()), onChange: () => saveGame() });

// ---------- The farm's upgrades ----------
// Bought at the workbench (workbench.js), and saved with the farm (`levels`):
// the workbench's level, and the hen yard's and the pasture's
// (PEN_LEVELS, BENCH_LEVELS in shared/balance.js). On a farm with helpers
// they go to the room with the animals (ANIMALS), and come with the farm
// (FARM) to whoever arrives.
const FIRST_LEVELS = { workbench: 1, yard: 1, pasture: 1 };
const LEVELS_OF = { workbench: BENCH_LEVELS, yard: PEN_LEVELS.yard, pasture: PEN_LEVELS.pasture };
let farmLevels = { ...FIRST_LEVELS };

// The farm's levels as saved (missing or odd: the first). The animals are let
// out again after, by whoever calls this, if the pens changed.
function useLevels(saved) {
  farmLevels = Object.fromEntries(Object.entries(FIRST_LEVELS).map(([id, first]) => {
    const level = Math.floor(saved?.[id]);
    return [id, level >= 1 && level <= LEVELS_OF[id].length ? level : first];
  }));
  setPenLevels(farmLevels);
  buildings.setBenchLevel(farmLevels.workbench);
}

// Why the farm can't have the next level of id right now ('': it can, what it costs aside)
function upgradeProblem(id) {
  if (visiting()) return 'Only the farmer can upgrade their farm';
  if (id === 'workbench') return '';
  // a bigger pen: nothing built or farmed where its fence goes out to
  const [now, next] = [penRect(id, farmLevels[id]), penRect(id, farmLevels[id] + 1)];
  const within = (r, x, z) => x > r.minX - 0.55 && x < r.maxX + 0.55 && z > r.minZ - 0.55 && z < r.maxZ + 0.55;
  for (let gx = Math.floor(next.minX - 1); gx <= Math.ceil(next.maxX + 1); gx++) {
    for (let gz = Math.floor(next.minZ - 1); gz <= Math.ceil(next.maxZ + 1); gz++) {
      const [x, z] = [gx * TILE_SIZE, gz * TILE_SIZE];
      if (!within(next, x, z) || within(now, x, z)) continue;
      const key = tileKeyFor(x, z);
      const piece = buildings.get(key);
      const where = id === 'yard' ? 'the bigger yard' : 'the bigger pasture';
      if (piece) return `Take down the ${PIECES[piece].name.toLowerCase()} where ${where} goes first`;
      if (farmTiles.has(key)) return `There's farmed soil where ${where} goes: let it go back to grass first`;
    }
  }
  return '';
}

function upgrade(id) {
  if (upgradeProblem(id)) return;
  const animalsNow = animals.capture();
  useLevels({ ...farmLevels, [id]: farmLevels[id] + 1 });
  if (id !== 'workbench') animals.restore(animalsNow, farmHours()); // (out in the bigger pen)
  saveGame();
}
let chestCollider = null;
// on: is it there. collider: does it need one of its own (not built as a piece)
function showChest(on, collider = on) {
  chest.show(on);
  const list = worlds.home.platforms;
  if (chestCollider) {
    list.splice(list.indexOf(chestCollider), 1);
    chestCollider = null;
  }
  if (on && collider) {
    const { x, y, z, w, h, d } = chest.box();
    chestCollider = { center: new THREE.Vector3(x, y, z), min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2) };
    list.push(chestCollider);
  }
}
const splash = new Splash({
  onPlay: joinLobby,
  onHome: () => goHome(),
  onHelping: () => farmSync.helping(),
  onVisitFarm: (id) => joinFarm(id),
  onInvited: (code) => farmSync.invited(code),
  onHelp: (code, name) => farmSync.help(code, name),
  onHelpers: () => farmSync.helpers(),
  onRemoveHelper: (id) => farmSync.removeHelper(id),
  onInvite: () => farmSync.inviteHelper(splash.name()),
  where: () => hud.here(),
  account: () => farmSync.account(),
  onRegister: async ({ username, password, color }) => {
    saveGame();
    await farmSync.register(username, password, color, currentSave());
    presence.start();
    myShirt(); // (and the farm with helpers, if it has some, waits for us at home)
  },
  // (the account's farm: the page reloads to play it)
  onLogin: async ({ username, password }) => {
    await farmSync.login(username, password);
    forgetLocalFarm();
    location.reload();
    await new Promise(() => {}); // (the page is going)
  },
  onLogout: () => {
    saveGame();
    farmSync.flush({ leaving: true });
    farmSync.forget();
    forgetLocalFarm();
    location.reload();
  },
  onColor: async (color) => {
    await farmSync.setColor(color);
    myShirt();
  },
  onFriends: () => farmSync.friends(),
  onAddFriend: (username) => farmSync.addFriend(username),
  onAnswerFriend: (id, yes) => farmSync.answerFriend(id, yes),
  onRemoveFriend: (id) => farmSync.removeFriend(id),
  onStartParty: (ids) => presence.ready && (presence.send({ t: PC.PARTY, invite: ids }), true),
  onCancelParty: () => presence.send({ t: PC.CANCEL }),
  onInviteToLobby: (ids) => session && presence.send({ t: PC.INVITE, code: session.code, invite: ids }),
});

// ---------- Friends online ----------
// The page keeps a line to the server open for its friends (net/presence.js,
// server/presence.js): an invitation to a lobby pops up the moment it comes
// (ui/invite.js), wherever we are, and when a lobby we said yes to (or
// started) opens, off we go to it.
const invites = new InvitePopups({ onAnswer: (party, yes) => presence.send({ t: PC.ANSWER, party, yes }) });
const presence = new PresenceLink({
  auth: () => (farmSync.account() ? farmSync.auth() : null),
  onMessage: (m) => {
    if (m.t === PS.INVITED) invites.show(m);
    else if (m.t === PS.FRIENDS) splash.friendsChanged();
    else if (m.t === PS.GONE) invites.gone(m.party);
    else if (m.t === PS.PARTY) splash.partyStatus(m);
    else if (m.t === PS.CALLED_OFF) {
      invites.calledOff(m.party, m.why);
      splash.partyOver(m.why);
    } else if (m.t === PS.GO) {
      invites.remove(m.party);
      splash.partyOver();
      joinLobby({ name: splash.name(), code: m.code });
    }
  },
});

// Our shirt: the account's color (src/net/farm.js), at home; in a lobby or on a
// farm with helpers its room says what we wear (it goes by ours too)
const myColor = () => farmSync.account()?.color ?? PLAYER_COLORS[0];
function myShirt() {
  if (place === 'home' && !farmNet) farmer.setShirt(myColor());
}

// This browser's copy of the farm goes (logging in to another, or out):
// nothing of it is saved again before the page reloads
function forgetLocalFarm() {
  saving = false;
  try {
    localStorage.removeItem(SAVE_STORE);
  } catch {}
}

function putDown({ x, y, z }) {
  stopWalking();
  fishing.reset();
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
  const fromFriend = visiting();
  if (from === 'lobby') leaveLobbyWorld();
  if (fromFriend) leaveFarm(); // (a friend's farm: back to ours)
  place = 'home';
  enterWorld('home');
  splash.hide();
  if (farmVisit) return; // (on our own farm with its helpers already)
  farmer.setShirt(myColor());
  if (!farmOnScreen) {
    showFarm(homeFarm);
    farmOnScreen = true;
  }
  hud.showHome();
  touch.setPlace('home');
  if (from !== 'home' || fromFriend) putDown(arrival());
  // A farm with helpers is played with them, on the server, whenever it is there
  // (this farm stays on screen meanwhile: the room's is the same, or newer)
  if (farmSync.shared() && farmSync.ready && !farmNet && !farmJoining) joinFarm(farmSync.id());
}

// ---------- A farm with helpers ----------
// Onto a farm's room: ours (its helpers may be on it) or a friend's
async function joinFarm(id) {
  const mine = id === farmSync.id();
  if (farmVisit) leaveFarm();
  farmNet?.leave();
  farmNet = null;
  if (!mine) splash.setStatus('Walking over…');
  const ticket = ++farmJoining;
  if (mine) {
    // (so a room that starts now starts from the farm as we have it)
    saveGame();
    await farmSync.flush();
    if (ticket !== farmJoining) return; // (another farm meanwhile)
    if (net) {
      farmJoining = 0; // (off to a lobby meanwhile)
      return;
    }
  }
  farmJoining = 0;
  const conn = (farmNet = new Connection({ name: splash.name(), color: myColor(), farm: id, auth: farmSync.auth() }));
  const on = (type, fn) => conn.on(type, (m) => farmNet === conn && fn(m));

  on(S.FARM, (m) => {
    const from = place;
    if (net) {
      net.leave(); // (a lobby we were on the way to)
      net = null;
    }
    if (from === 'lobby') leaveLobbyWorld();
    if (!m.mine && farmOnScreen) {
      // Off to help: our own farm stays at home (saved, and growing while we are out)
      saveGame();
      farmSync.flush();
      farmOnScreen = false;
    }
    place = 'home';
    enterWorld('home');
    farmVisit = { id: m.farm.id, name: m.farm.name, owner: m.farm.owner, mine: m.mine, alone: true, helpers: m.farm.helpers ?? 0 };
    myId = m.id;
    farmer.setShirt(m.color);
    showRoomFarm(m);
    bosses.welcome(m.bosses);
    farmOnScreen = m.mine;
    if (m.mine) farmSync.handedToRoom();
    chest.setOwner(m.mine, m.farm.owner);
    roomChest = m.chest;
    chest.setItems(m.chest);
    placeChest();
    if (m.mine) pourOwnChest(m.chest);
    remotes.clear();
    setFarmRoster(m.roster);
    if (!m.resumed && !(m.mine && from === 'home')) putDown(m.pos);
    splash.hide();
    splash.setStatus('');
    hud.showFarm(farmVisit, myId);
    hud.setRoster(m.roster);
    touch.setPlace('farm');
    if (m.resumed) hud.chat({ from: 0, text: 'Reconnected: you are back where you were.' });
  });
  on(S.ROSTER, (m) => {
    hud.setRoster(m.list);
    setFarmRoster(m.list);
  });
  on(S.SNAP, (m) => remotes.snapshot(m.tick, m.p));
  on(S.TILLED, (m) => {
    pendingTills.delete(m.key);
    tillTileAt(...keyXZ(m.key)); // (ours is there already)
  });
  on(S.UNTILLED, (m) => {
    pendingTills.delete(m.key);
    removeCrop(m.key);
    untillTile(m.key);
  });
  on(S.PLANTED, (m) => {
    const crop = crops.get(m.key);
    if (crop?.cropId === m.crop) {
      crop.pending = false;
      crop.plantedAt = m.at;
      return;
    }
    removeCrop(m.key);
    tillTileAt(...keyXZ(m.key));
    if (plantAt(...keyXZ(m.key), m.crop, ageAt(m.at))) crops.get(m.key).plantedAt = m.at;
  });
  on(S.BUILT, (m) => {
    if (pendingBuilds.delete(m.key) && buildings.get(m.key) === m.piece) return; // (ours: there already)
    buildings.place(m.key, m.piece);
    placeChest();
  });
  on(S.UNBUILT, (m) => {
    pendingUnbuilds.delete(m.key);
    buildings.remove(m.key);
    placeChest();
    if (m.by === myId) giveBack(m.piece);
  });
  on(S.HARVESTED, (m) => {
    const crop = crops.get(m.key);
    removeCrop(m.key);
    if (m.by !== myId) return;
    inventory.notify(`${ITEMS[m.item]?.name ?? 'That'} went in the farm's chest`);
    skilled('farming', SKILLS.xp.harvest[crop?.cropId] ?? 0, m.item); // (a bonus one comes to the backpack)
  });
  on(S.FARM_DENY, (m) => {
    const crop = crops.get(m.key);
    if (m.op === 'till' && pendingTills.delete(m.key)) untillTile(m.key);
    else if (m.op === 'plant' && crop?.pending) {
      removeCrop(m.key);
      const seed = Object.keys(ITEMS).find((id) => ITEMS[id].plants === m.crop);
      if (seed) inventory.add(seed, 1, { quiet: true }); // (the seed back)
    } else if (m.op === 'harvest' && crop) {
      crop.pending = false;
      crop.view.group.visible = true;
    } else if (m.op === 'build' && pendingBuilds.has(m.key)) {
      const carried = pendingBuilds.get(m.key);
      pendingBuilds.delete(m.key);
      giveBack(buildings.remove(m.key), carried); // (it wasn't built after all: the chest's share never left it)
      placeChest();
    } else if (m.op === 'unbuild') {
      pendingUnbuilds.delete(buildings.anchor(m.key) ?? m.key);
    }
  });
  on(S.FELLED, (m) => {
    farmFelled.set(m.id, m.at); // (so the page knows, should it play on alone)
    treeFelled(m);
  });
  on(S.REGROWN, (m) => {
    farmFelled.delete(m.id);
    setSite(farmTreeSites, m.id, m.n);
    world.regrowTree(m.id, { n: m.n ?? 0 });
  });
  on(S.CHOP_DENY, (m) => chop.pending.delete(m.id));
  on(S.MINED, (m) => {
    farmMined.set(m.id, m.at);
    rockMined(m);
  });
  on(S.RESURFACED, (m) => {
    farmMined.delete(m.id);
    setSite(farmRockSites, m.id, m.n);
    world.regrowRock(m.id, { n: m.n ?? 0 });
  });
  on(S.MINE_DENY, (m) => mine.pending.delete(m.id));
  on(S.GIANT, giantNews);
  on(S.CHEST, (m) => {
    roomChest = m.items;
    chest.setItems(m.items);
  });
  on(S.CHEST_GOT, (m) => {
    // (no room for it after all: back in the chest)
    if (!inventory.add(m.item, m.count)) farmNet.send({ t: C.CHEST_PUT, item: m.item, count: m.count });
    chest.refresh();
  });
  on(S.FARM_CLOCK, (m) => syncFarmClock(m.hours));
  on(S.BOSS, bosses.onBoss);
  on(S.BOSS_FX, bosses.onFx);
  on(S.BOSS_WON, bosses.onWon);
  on(S.CHAT, (m) => hud.chat(m));
  on('ping', (ms) => hud.setPing(ms));
  on('reconnecting', (n) => hud.setConnStatus(`Connection lost: reconnecting (try ${n})…`));
  on('closed', ({ reason }) => {
    const was = farmVisit;
    farmNet = null;
    if (!was) {
      // (never got there: our own farm is played here, alone; a friend's, say why)
      if (!mine) splash.setStatus(reason, true);
      return;
    }
    leaveFarm();
    if (was.mine) {
      // On our own farm still, alone: it carries on in this page
      hud.showHome();
      touch.setPlace('home');
      hud.setConnStatus(`${reason} Your farm carries on here.`);
      setTimeout(() => hud.setConnStatus(''), 6000);
    } else {
      goHome();
      splash.show({ from: 'home', message: reason });
    }
  });
}

// Off the farm's room. Our own farm stays on screen (it plays on in this
// page); a friend's goes.
function leaveFarm() {
  const was = farmVisit;
  if (was?.mine) saveGame(); // (the animals, to the room)
  farmNet?.leave();
  farmNet = null;
  farmVisit = null;
  pendingTills.clear();
  pendingBuilds.clear();
  pendingUnbuilds.clear();
  resetChopping();
  resetMining();
  bosses.welcome(); // (a fight there was the room's: any from here on is ours)
  remotes.clear();
  keys.clear();
  myId = 0;
  for (const crop of crops.values()) crop.pending = false;
  if (was && !was.mine) {
    resetFarm();
    farmOnScreen = false;
  }
  placeChest();
}

function setFarmRoster(list) {
  remotes.setRoster(list, myId);
  if (farmVisit) farmVisit.alone = list.filter((p) => !p.away).length <= 1;
}

// game seconds a crop planted at `plantedAt` (the farm's game hours) has been growing
const ageAt = (plantedAt) => Math.max(0, ((farmHours() - plantedAt) * DAY_LENGTH_SECONDS) / 24);

// The farm as its room has it (FARM)
function showRoomFarm(m) {
  resetFarm();
  dayNight.setTime(m.hours);
  for (const t of m.tilled) {
    const [key, bare, life] = Array.isArray(t) ? t : [t, 0];
    tillTileAt(...keyXZ(key), bare, life);
  }
  for (const [key, piece] of m.built ?? []) buildings.place(key, piece);
  placeChest();
  showFarmWilds(m);
  for (const [key, cropId, at] of m.crops) {
    if (CROPS[cropId] && plantAt(...keyXZ(key), cropId, ageAt(at))) crops.get(key).plantedAt = at;
  }
  useLevels(m.animals?.levels);
  animals.restore(Object.keys(m.animals ?? {}).length ? m.animals : null, farmHours());
}

// The room's clock, now and then: pages drift (not while we fast-forward it ourselves)
function syncFarmClock(hours) {
  if (keys.has('KeyT') || Math.abs(hours - farmHours()) < 0.05) return;
  dayNight.setTime(hours);
  for (const crop of crops.values()) if (crop.plantedAt !== undefined) crop.age = ageAt(crop.plantedAt);
}

// Holding T on our own farm, alone on it: the room's clock goes along
let clockSentAt = 0;
let fastForwarding = false;
function sendFarmClock(ff, t) {
  if (!ff && !fastForwarding) return;
  if (ff && t - clockSentAt < 0.25) return;
  fastForwarding = ff;
  clockSentAt = t;
  farmNet.send({ t: C.CLOCK, hours: farmHours() });
}

function leaveLobbyWorld() {
  session = null;
  myId = 0;
  partyGame = null;
  arenaId = 0;
  partyHud.clear();
  lobbyRoster = [];
  clearSpots();
  clearDrops();
  resetChopping();
  resetMining();
  lobbyGiants = new Giants();
  giantBars.clear();
  remotes.clear();
  keys.clear();
  showCodeInAddress('');
}

// ---------- Party games ----------
// At the signpost in a lobby's stone circle (shared/arenas.js signFor), E
// starts a party game (shared/minigame.js), or joins the one gathering; the
// card at the top (src/ui/party.js) has Join too. Whoever is in it goes off
// to its arena (src/arenas.js) once it has gathered, a moment to look about
// (standing still), then the game; and back on the lobby's island when it is
// over, with the prize. While we are in the arena the lobby's island is kept
// as it was (its spots and drops out of sight), and only the farmers in the
// same place as us are drawn.
const PARTY_KIND = 'coin_rush'; // (the one game there is so far)
const partyHud = new PartyHud({
  onJoin: () => net?.send({ t: C.GAME_JOIN }),
  onLeave: () => leaveParty(),
  nameOf: (id) => lobbyNames.get(id) ?? 'Someone',
});
const coinPending = new Map(); // coin id -> when we said we picked it up (performance.now())
let readyCount = 0; // the last number of the countdown shown
const inParty = () => !!partyGame?.players.some(([id]) => id === myId);
const partyFrozen = () => !!arenaId && partyGame?.phase === 'ready';
const atSign = () => place === 'lobby' && !arenaId && !!session && footReach() &&
  Math.hypot(player.position.x - session.sign.x, player.position.z - session.sign.z) < SIGN_REACH;

function signHint() {
  if (!partyGame) return `Start a ${GAMES[PARTY_KIND].name.toLowerCase()}`;
  const name = GAMES[partyGame.kind]?.name.toLowerCase() ?? 'party game';
  if (partyGame.phase !== 'gathering') return '';
  return inParty() ? `Not coming to the ${name} after all` : `Join the ${name}`;
}

function useSign() {
  if (!partyGame) net?.send({ t: C.GAME_START, game: PARTY_KIND });
  else if (partyGame.phase === 'gathering') net?.send({ t: inParty() ? C.GAME_LEAVE : C.GAME_JOIN });
  else inventory.notify('A game is on: wait for the next one');
}

// The farmers drawn: the ones where we are (the lobby's island, or our arena)
function showRemotes() {
  remotes.setRoster(lobbyRoster.filter((p) => (p.game ?? 0) === arenaId), myId);
}

// The lobby's party game as it is now (null: none). pos: where the lobby has
// us (a WELCOME's: back in the arena after a reload)
function showParty(game, pos = null) {
  partyGame = game;
  partyHud.show(game, myId);
  const playing = game && game.phase !== 'gathering' && inParty();
  if (playing && arenaId !== game.id) {
    enterWorld('arena', game);
    arenaId = game.id;
    coinPending.clear();
    world.coins.forEach((coin, id) => (coin.visible = !game.taken.includes(id)));
    showLobbyThings(false);
    showRemotes();
    const i = game.players.findIndex(([id]) => id === myId);
    putDown(pos ?? arenaFor(game.kind, game.seed).start(i, game.players.length));
    readyCount = 0;
    hud.setPrompt('');
  }
  if (playing && game.phase === 'playing' && readyCount !== -1) {
    readyCount = -1;
    hud.flash('Go!');
  }
  if (!playing && arenaId) backFromArena(); // (it was called off, or we are out of it)
}

// Out of the arena, onto the lobby's island (pos: where; else where farmers arrive)
function backFromArena(pos = null) {
  arenaId = 0;
  coinPending.clear();
  enterWorld('wild', session.seed, session.wilds);
  showLobbyThings(true);
  showRemotes();
  putDown(pos ?? arrival());
}

// The lobby's spots and drops (in the scene, not the island's world): out of sight in an arena
function showLobbyThings(on) {
  for (const spot of spots.values()) spot.view.group.visible = on;
  for (const drop of drops.values()) drop.group.visible = on && !drop.pending;
}

// Not playing after all: out of the gathering, or back to the lobby from the arena
function leaveParty() {
  net?.send({ t: C.GAME_LEAVE });
  if (arenaId) backFromArena();
}

// Every frame in the arena: the countdown, and coins we walk into
function updateArena() {
  partyHud.update();
  hud.setPrompt('');
  if (partyGame?.phase === 'ready') {
    const left = Math.ceil((partyHud.endsAt - performance.now()) / 1000);
    if (left > 0 && left !== readyCount) {
      readyCount = left;
      hud.flash(String(left));
    }
    return;
  }
  if (partyGame?.phase !== 'playing') return;
  const now = performance.now();
  world.coins.forEach((coin, id) => {
    const at = coinPending.get(id);
    if (at !== undefined) {
      if (now - at < 1500) return;
      coinPending.delete(id); // (the lobby never said: it didn't count, it is still there)
      coin.visible = !partyGame.taken.includes(id);
    }
    if (!coin.visible || player.position.distanceTo(coin.position) > TOUCH_RADIUS + 0.3) return;
    coin.visible = false; // (at once, so it feels instant: GAME_COIN settles it)
    coinPending.set(id, now);
    net?.send({ t: C.GAME_COIN, id });
  });
}

// GAME_COIN: someone picked a coin up
function partyCoin(m) {
  if (!partyGame) return;
  partyGame.taken.push(m.id);
  partyHud.score(m.by, m.score);
  if (arenaId) {
    coinPending.delete(m.id);
    if (world.coins[m.id]) world.coins[m.id].visible = false;
    if (m.by === myId) hud.flash(`${m.score}`);
  }
}

// GAME_END: it is over. Our prize into the backpack, and back to the lobby if we played.
function partyOver(m) {
  const played = m.pos.find(([id]) => id === myId);
  const got = m.prizes.find(([id]) => id === myId)?.[1] ?? null;
  partyGame = null;
  if (played && arenaId) backFromArena({ x: played[1], y: played[2], z: played[3] });
  for (const [item, count] of got ?? []) if (ITEMS[item]) inventory.add(item, count);
  if (played) {
    const named = (item, count) => {
      const name = (ITEMS[item]?.name ?? item).toLowerCase();
      return count > 1 && !name.endsWith('s') ? `${name}s` : name;
    };
    partyHud.results(m, got, named);
    if (m.winner === myId) hud.flash('You won!');
  } else {
    partyHud.show(null, myId);
  }
}

function joinLobby({ name, code }) {
  net?.leave();
  splash.setStatus('Walking over…');
  const conn = (net = new Connection({ name, color: myColor(), code, auth: farmSync.auth() }));
  // (a handler for a connection we have since left does nothing)
  const on = (type, fn) => conn.on(type, (m) => net === conn && fn(m));

  on(S.WELCOME, (m) => {
    if (farmVisit || farmNet) leaveFarm(); // (off a farm with helpers)
    if (place !== 'lobby') {
      // Off we go: the farm stays at home (saved, and growing while we are out)
      saveGame();
      farmSync.flush();
      resetFarm();
      farmOnScreen = false;
    } else {
      // (a lobby we were already in, after a reconnect: start its picture over)
      clearSpots();
      remotes.clear();
    }
    place = 'lobby';
    enterWorld('wild', m.seed, m.wilds);
    session = { code: m.code, seed: m.seed, room: m.room, wilds: m.wilds, sign: signFor(islandFor(m.seed)) };
    arenaId = 0;
    myId = m.id;
    farmer.setShirt(m.color);
    putDown(m.pos);
    setSpots(m.spots);
    // the trees that are down right now (the rest stand, even on an island we were on before)
    resetChopping();
    world.standAllTrees(siteMap(m.treeSites, world.trees.length)); // (each where it grew back last)
    for (const id of m.felled ?? []) world.fellTree(id, null, { instant: true });
    // and the rocks that are broken
    resetMining();
    world.restoreAllRocks(siteMap(m.rockSites, world.rocks.length));
    for (const id of m.mined ?? []) world.breakRock(id, { instant: true });
    lobbyGiants = new Giants();
    giantBars.clear();
    showGiants(lobbyGiants, m.giants, world);
    clearDrops();
    for (const drop of m.drops ?? []) addDrop(drop);
    lobbyNames.clear();
    for (const p of m.roster) lobbyNames.set(p.id, p.name);
    lobbyRoster = m.roster;
    showRemotes();
    // one time of day for everyone in the lobby, counted from when it opened
    dayNight.setTime(LOBBY_DAWN + (m.clock / DAY_LENGTH_SECONDS) * 24);
    showCodeInAddress(m.code);
    splash.hide();
    hud.showLobby(session, myId);
    touch.setPlace('lobby');
    hud.setRoster(m.roster);
    showParty(m.game, m.pos);
    if (m.resumed) hud.chat({ from: 0, text: 'Reconnected: you are back where you were.' });
  });
  on(S.ROSTER, (m) => {
    hud.setRoster(m.list);
    lobbyRoster = m.list;
    showRemotes();
    for (const p of m.list) lobbyNames.set(p.id, p.name);
  });
  on(S.GAME, (m) => showParty(m.game));
  on(S.GAME_COIN, (m) => partyCoin(m));
  on(S.GAME_END, (m) => partyOver(m));
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
    if (m.by === myId && m.items) openedChest(spot, m.items);
    else if (m.by === myId) {
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
  on(S.FELLED, treeFelled);
  on(S.REGROWN, (m) => wildsWorld().regrowTree(m.id, { n: m.n ?? 0 }));
  on(S.CHOP_DENY, (m) => chop.pending.delete(m.id)); // (it still stands: chop on)
  on(S.MINED, rockMined);
  on(S.RESURFACED, (m) => wildsWorld().regrowRock(m.id, { n: m.n ?? 0 }));
  on(S.MINE_DENY, (m) => mine.pending.delete(m.id)); // (it is still there: mine on)
  on(S.GIANT, giantNews);
  on(S.BOPPED, (m) => bopped(m));
  on(S.BITE, (m) => fishing.bit(m));
  on(S.CAUGHT, (m) => fishing.caught(m));
  on(S.DROP, (m) => addDrop([m.id, m.item, m.count, m.x, m.y, m.z]));
  on(S.PICKED, (m) => {
    removeDrop(m.id);
    if (m.by === myId) inventory.add(m.item, m.count);
  });
  on(S.DROP_DENY, (m) => {
    const drop = drops.get(m.id);
    if (drop) Object.assign(drop, { pending: false, retryAt: performance.now() + 500 });
  });
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

// Where we are, for the lobby (or a farm's room): what we do is checked
// against it, and everyone else draws us there
function sendState(dt, conn = net) {
  sendTimer += dt;
  if (sendTimer < TICK_DT) return;
  sendTimer %= TICK_DT;
  const p = player.position;
  const r = (v) => Math.round(v * 100) / 100;
  conn.send({
    t: C.STATE,
    x: r(p.x), y: r(p.y), z: r(p.z), yaw: r(anim.facing),
    f: (player.onGround ? STATEF.GROUND : 0) | (hoeGroup.visible ? STATEF.HOE : 0) |
      (farmer.axe.visible ? STATEF.AXE : 0) | (farmer.pick.visible ? STATEF.PICK : 0) | (anim.swing >= 0 ? STATEF.SWING : 0) |
      (farmer.sword.visible ? STATEF.SWORD : 0) | (farmer.mallet.visible ? STATEF.MALLET : 0) |
      (farmer.rod.visible ? STATEF.ROD : 0) | (fishing.state() ? STATEF.CAST : 0) | (fishing.state() === 'bite' ? STATEF.BITE : 0) |
      bosses.mountBits() * STATEF.MOUNT,
  });
}

// ---------- Saving ----------
// The home farm is yours alone: the backpack, the tilled soil, the crops and
// the time of day. While you are away (in a lobby, or with the page closed)
// the crops keep growing and the clock keeps turning. The page plays from its
// own copy in this browser, and keeps the game server's copy up to date
// (src/net/farm.js), so the farm can be played from another device too: a
// pairing code from the menu (Esc) brings it over. Whichever device opened
// the farm last holds it.
//
// A save is never written over unseen: one that can't be read is kept aside
// (tp.save.broken), an older one is kept as it was (tp.save.v<N>) before it
// is brought up to date, and one from a newer version of the game is left
// alone: nothing is saved until the page is reloaded with that version.
const SAVE_STORE = 'tp.save';
const SAVE_VERSION = 8; // v2: flax seeds joined the starter kit; v3: the axe; v4: hens and eggs; v5: cows and sheep; v6: the pickaxe; v7: building; v8: the farm's upgrades
let homeFarm = null; // the farm as last seen at home (it is not on screen in a lobby)
let saving = true; // (false: the save is from a newer version of the game, or the farm is open on another device)
const farmSync = new FarmSync({
  onTakenOver: () => {
    saving = false;
    hud.setConnStatus('Your farm is open on another device now. Reload the page to carry on here.');
  },
  // the farm got its first helper: from now on it is played with them, on the server
  onShared: () => {
    if (place === 'home' && !farmNet && !farmJoining) joinFarm(farmSync.id());
  },
});

const keyXZ = (key) => key.split(',').map((n) => Number(n) * TILE_SIZE);

function captureFarm() {
  return {
    savedAt: Date.now(),
    hours: farmHours(),
    tilled: [...farmTiles].map(([key, mesh]) => [key, crops.has(key) ? 0 : mesh.userData.bare, mesh.userData.life]),
    crops: [...crops].map(([key, c]) => [key, c.cropId, c.age]),
    built: buildings.list(),
    felled: [...farmFelled],
    mined: [...farmMined],
    treeSites: [...farmTreeSites],
    rockSites: [...farmRockSites],
    giants: farmGiants.toSave(),
    chest: { ...ownChest }, // (on a farm with helpers, what didn't fit in the room's)
    levels: { ...farmLevels }, // (its upgrades)
    ...animals.capture(), // hens, cows, sheep, eggs
  };
}

// (a farm from before there were animals gets the ones a new farm comes with)
function showFarm(farm) {
  resetFarm();
  ownChest = Object.fromEntries(Object.entries(unmake(farm?.chest)).filter(([id, n]) => ITEMS[id] && Number.isInteger(n) && n > 0));
  useLevels(farm?.levels);
  if (!farm) return animals.restore(null, farmHours());
  const away = Math.max(0, (Date.now() - farm.savedAt) / 1000);
  dayNight.setTime(farm.hours + (away / DAY_LENGTH_SECONDS) * 24);
  // (soil left bare while we were away may have gone back to grass; a save
  // from before it did that has just the keys)
  const growing = new Set(farm.crops.filter(([, cropId]) => CROPS[cropId]).map(([key]) => key));
  for (const t of farm.tilled) {
    const [key, bare, life = soilLife()] = Array.isArray(t) ? t : [t, 0];
    const bareNow = growing.has(key) ? 0 : (bare || 0) + away;
    if (bareNow < life) tillTileAt(...keyXZ(key), bareNow, life);
  }
  for (const [key, piece] of farm.built ?? []) buildings.place(key, piece);
  placeChest();
  showFarmWilds(farm);
  for (const [key, cropId, age] of farm.crops) {
    if (CROPS[cropId]) plantAt(...keyXZ(key), cropId, age + away);
  }
  animals.restore(farm, farmHours()); // (the eggs due while we were away are in the nest)
}

function currentSave() {
  if (farmOnScreen) homeFarm = captureFarm();
  return { v: SAVE_VERSION, farm: homeFarm, backpack: inventory.serialize(), skills: skills.serialize(), bosses: bosses.record() };
}

function saveGame() {
  if (!saving) return;
  // (on our farm with its helpers: the animals are ours to keep, the rest is the room's)
  if (farmVisit?.mine) farmNet?.send({ t: C.ANIMALS, state: { ...animals.capture(), levels: { ...farmLevels } } });
  const save = currentSave();
  try {
    localStorage.setItem(SAVE_STORE, JSON.stringify(save));
  } catch {}
  farmSync.push(save);
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

// Play a save: the backpack, and the farm (shown, if it is on screen). An
// older save gets what joined the kit since; one from a newer version of the
// game is left alone (false).
function useSave(save) {
  if (save.v > SAVE_VERSION) {
    saving = false;
    hud.setConnStatus('This farm was saved by a newer version of the game. Reload the page to play it: nothing is saved until then.');
    return false;
  }
  // (a lamp post or bench made at the workbench before they were built
  // straight from wood and stone comes back as what it cost)
  const unmade = {};
  for (const slot of save.backpack?.slots ?? []) if (slot && UNMADE[slot.id]) unmade[slot.id] = (unmade[slot.id] ?? 0) + Math.max(1, slot.count | 0);
  inventory.restore(save.backpack ?? {});
  skills.restore(save.skills); // (none before v8: everything at level 1)
  for (const [item, n] of Object.entries(unmake(unmade))) gift(item, n);
  homeFarm = save.farm ?? null;
  bosses.restore(save.bosses); // (the bosses we beat, and what we are still owed for it)
  if (save.v < 2) gift('flax_seeds', 5);
  if (save.v < 3) gift('axe', 1);
  if (save.v < 6) gift('pickaxe', 1);
  if (farmOnScreen) showFarm(homeFarm);
  return true;
}

function loadGame() {
  let text = null;
  let save = null;
  try {
    text = localStorage.getItem(SAVE_STORE);
    save = JSON.parse(text);
  } catch {}
  if (text && !(save?.v >= 1)) keepAside(`${SAVE_STORE}.broken`, text); // (a fresh farm starts; the old one is kept)
  if (save?.v >= 1 && save.v < SAVE_VERSION) keepAside(`${SAVE_STORE}.v${save.v}`, text); // (kept as it was)
  if (!(save?.v >= 1 && useSave(save))) {
    // A new farmer's starting kit (or, beside a save from a newer version, one to play this time)
    for (const [item, count] of STARTER_KIT) gift(item, count); // (shared/balance.js)
  }
  showFarm(homeFarm);
  farmOnScreen = true;
  if (new URLSearchParams(location.search).has('hour')) dayNight.setTime(startHour); // (testing: ?hour=21)
}

// Then the server's copy: made from this one, or the one to play when the
// farm was played on another device since
async function openFarm() {
  hud.setFarmName(farmSync.name());
  if (!saving) return; // (a save from a newer version: leave every copy alone)
  const theirs = await farmSync.open(currentSave());
  hud.setFarmName(farmSync.name());
  if (theirs && useSave(theirs)) saveGame();
  splash.accountChanged(); // (the server knows whether we have an account now)
  presence.start();
  myShirt();
  if (!splash.hidden) splash.showHelping(); // (the farms we help on: the server knows who we are now)
  // a farm with helpers, already home (the page was quick): onto its room
  if (place === 'home' && farmSync.shared() && farmSync.ready && !farmNet && !farmJoining) joinFarm(farmSync.id());
}

function leavePage() {
  saveGame();
  farmSync.flush({ leaving: true });
}

setInterval(saveGame, 5000);
addEventListener('pagehide', leavePage);
document.addEventListener('visibilitychange', () => document.hidden && leavePage());

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
  if (!inputBlocked()) {
    const stick = touch.direction(); // (part way over: a slower walk)
    moveX += stick.x;
    moveZ += stick.z;
  }
  if (moveX || moveZ || inputBlocked()) stopWalking(); // the stick or the keys take over from a tap
  else if (held && !building) ({ x: moveX, z: moveZ } = followMouse(dt));
  else ({ x: moveX, z: moveZ } = steer(dt));

  const moveVec = new THREE.Vector3(moveX, 0, moveZ);
  const moving = moveVec.lengthSq() > 0;
  if (moving) moveVec.multiplyScalar((MOVE_SPEED * bosses.speed() * Math.min(moveVec.length(), 1)) / moveVec.length()); // (dizzy from a boss: slower)
  player.velocity.x = moveVec.x + knock.x;
  player.velocity.z = moveVec.z + knock.z;
  knock.multiplyScalar(Math.exp(-dt * 5)); // (a bop's stumble fades)

  if (player.onGround) {
    airTime = 0;
    airJumps = skills.canDoubleJump() ? 1 : 0;
  } else airTime += dt;
  if (!inputBlocked()) {
    const offLedge = airTime < COYOTE_TIME && player.velocity.y <= 0;
    if ((keys.has('Space') || jumpPressed) && (player.onGround || offLedge)) jump();
    else if (jumpTapped && airJumps > 0) airJump();
  }
  jumpPressed = false;
  jumpTapped = false;

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
  puffs.update(dt);
  hoeGroup.visible = holding() === 'hoe'; // only hold a tool while it's selected
  farmer.axe.visible = holding() === 'axe';
  farmer.pick.visible = holding() === 'pickaxe';
  farmer.sword.visible = inventory.selectedId() === 'wooden_sword';
  farmer.mallet.visible = inventory.selectedId() === 'mallet';
  farmer.rod.visible = holding() === 'rod';
  if (farmer.rod.visible) farmer.setRod(ITEMS[inventory.selectedId()].color);
  animateCharacter(dt, moving);
  updateTileCursor(moving);
  updateHover();

  const t = clock.elapsedTime;
  fishing.update(t);
  world.updateTrees(dt);
  if (building && place !== 'home') stopBuilding();
  if (place === 'lobby' && arenaId) {
    updateArena(dt);
    sendState(dt);
    remotes.update(dt, t);
  } else if (place === 'lobby') {
    updateChopping();
    updateMining();
    updateSpots(dt, t);
    updateDrops(dt, t);
    partyHud.update();
    sendState(dt);
    remotes.update(dt, t);
  } else {
    merchant.update(dt, t, player.position);
    chest.update(dt);
    if (place === 'home') {
      updateChopping();
      updateMining();
      hud.setPrompt(building ? updateBuilding() : homePrompt());
    }
    if (farmVisit) {
      sendState(dt, farmNet);
      remotes.update(dt, t);
    }
  }

  farmFinds.update(dt, t, { active: place === 'home' && !farmVisit && farmOnScreen, counting: !inputBlocked(), at: player.position });
  regrowFarm();
  rollFarmGiants();
  bosses.update(dt, t);
  giantBars.update(t);
  windTime.value = t;
  _chest.set(player.position.x, player.position.y + 0.3, player.position.z);
  world.updateTreeFade(dt, _chest, camera);
  if (place === 'lobby') updateSkyFade(dt, _chest, camera); // (and sky isles over us: src/skyisles.js)
  world.update(t);
  water.position.y = WATER_Y + Math.sin(t * 0.8) * 0.03;

  // At home, time stops while the backpack or the menu is open and holding T
  // fast-forwards it. In a lobby the time of day is everyone's, so it just
  // runs; so it does on a farm with helpers (the owner, alone on it, may
  // still fast-forward it).
  const atHome = place !== 'lobby' && !farmVisit;
  presence.where(place === 'lobby' ? 'lobby' : farmVisit ? 'farm' : 'home'); // (for friends' lists)
  const fastForward = keys.has('KeyT') && place !== 'lobby' && (!farmVisit || (farmVisit.mine && farmVisit.alone));
  const hoursBefore = dayNight.day() * 24 + dayNight.hour();
  dayNight.update(dt, {
    paused: atHome && (menuOpen() || !splash.hidden),
    fastForward,
    focus: player.position,
  });
  if (farmVisit?.mine) sendFarmClock(fastForward, t);
  // Crops grow on game time, so they pause and fast-forward with the clock
  const gameDt = ((dayNight.day() * 24 + dayNight.hour() - hoursBefore) * DAY_LENGTH_SECONDS) / 24;
  updateCrops(dt, gameDt, t);
  buildings.setNight(dayNight.night(), player.position);
  houseRoom.setNight(dayNight.night());
  houseRoom.update(t, player.position);
  if (place !== 'lobby') {
    animals.update(dt, t, {
      hours: farmHours(),
      player: { pos: player.position, moving, onGround: player.onGround },
      collect: collectProduce, // (the eggs)
    });
  }

  if (place === 'title') updateMenuCamera(t);
  else updateCamera(dt);
}

// What E does here at home, for the prompt
function homePrompt() {
  if (menuOpen()) return '';
  const boss = bosses.prompt();
  if (boss || bosses.inArena()) return boss;
  const fish = fishing.prompt();
  if (fish) return fish;
  if (buildings.nearest('workbench', player.position, BENCH_REACH)) return 'E  Use the workbench';
  if (buildings.nearest('arcade', player.position, BENCH_REACH)) return 'E  Play at the arcade';
  if (houseDoorInReach()) return 'E  Go inside';
  if (houseRoom.exitInReach(player.position)) return 'E  Go outside';
  if (chest.inReach(player.position)) return 'E  Open the farm chest';
  if (atStall(player.position)) return 'E  Trade with the merchant';
  const held = inventory.selectedId();
  if (ANIMAL_KINDS.includes(held) && animals.inPenFor(held, player.position.x, player.position.z, 0.5)) return `E  Let the ${ITEMS[held].name.toLowerCase()} out`;
  const animal = animals.inReach(player.position);
  if (animal) return `E  ${animals.verbFor(animal)}`;
  const hint = useHint();
  return hint ? `E  ${hint}` : '';
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Built pages: installable, and the farm opens without a connection (public/sw.js).
// (Not under Vite's dev server, where a cached page would hide every change.)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Dev builds only: a handle for poking at the game from the browser console
if (import.meta.env.DEV) {
  window.__game = { player, spots, remotes, inventory, shop, chest, animals, buildings, workbench, upgrade, dayNight, fishing, saveGame, camera, farmSync, get farmLevels() { return farmLevels; }, get place() { return place; }, get net() { return net; }, get farmNet() { return farmNet; }, get farmVisit() { return farmVisit; }, get world() { return world; } };
}

loadGame();
splash.show({ from: 'title' });
openFarm();
animate();
