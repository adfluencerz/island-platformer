import * as THREE from 'three';
import { ITEMS, spriteURL } from './items.js';
import { createItemMesh, itemGeometry } from './itemmesh.js';
import { createFarmFinds } from './finds.js';
import { createInventory } from './inventory.js';
import { createShop } from './shop.js';
import { createNpcs } from './npcs.js';
import { createDialog } from './dialog.js';
import { renderQuests, renderMap } from './quests.js';
import { npcHomes } from './npchomes.js';
import { NPCS, NPC_IDS } from '../shared/npcs.js';
import { createRequests } from './requests.js';
import { createChest, createChestModel } from './chest.js';
import { createMerchant, inReach as atStall, TRADE_SPOT } from './merchant.js';
import { createAnimals, inPen, ANIMAL_KINDS, setPenLevels, penRect } from './animals.js';
import { createBuildings, POND_WATER_Y } from './build.js';
import { createFishing } from './fishing.js';
import { createFishLog } from './fishlog.js';
import { createBook } from './book.js';
import { createFishBoard } from './fishboard.js';
import { createFishShadows } from './fishshadows.js';
import { createRipples } from './ripples.js';
import { createArrows } from './arrows.js';
import { createHouseRoom } from './house.js';
import { createWorkbench } from './workbench.js';
import { createArcade } from './arcade.js';
import { createMachines } from './machines.js';
import { createCooking, boostFrom, boostOf, boostText, BOOST_NAMES } from './cooking.js';
import { createFarmer, damp, HOE_SWING_TIME, lightFarmers } from './character.js';
import { Remotes, makeNameTag } from './remotes.js';
import { Connection } from './net/connection.js';
import { showCodeInAddress } from './net/lobby.js';
import { FarmSync } from './net/farm.js';
import { PresenceLink } from './net/presence.js';
import { InvitePopups } from './ui/invite.js';
import { PartyHud } from './ui/party.js';
import { Splash } from './ui/splash.js';
import { Hud } from './ui/hud.js';
import { Guide } from './ui/guide.js';
import { TouchControls, isTouch, fitPart } from './ui/touch.js';
import * as quality from './gfx/quality.js';
import { createStats } from './gfx/stats.js';
import { toneMap } from './gfx/tonemap.js';
import { createSky } from './gfx/sky.js';
import { createPost } from './gfx/post.js';
import { waterLook } from './gfx/water.js';
import { detail } from './gfx/detail.js';
import * as gfx from './gfx/uniforms.js';
import { GamepadInput, padInUse } from './gamepad.js';
import { el, hexColor } from './ui/dom.js';
import { SeatPanel } from './ui/seatpanel.js';
import { PlayerSync, remembered as rememberedPlayers, logIn as logInPlayer, newGuest, forget as forgetPlayer, flushClosing } from './net/players.js';
import './seats.css';
import './ui/ui.css';
import { TICK_DT, PLAYER_COLORS, SOIL_BARE_HOURS, PROTOCOL_VERSION } from '../shared/constants.js';
import { DEFAULT_LOOK } from '../shared/looks.js';
import { C, S, STATEF, PC, PS } from '../shared/protocol.js';
import { STARTER_KIT, GIANT, UNMADE, unmake, SKILLS, DOUBLE_JUMP, GLIDE, BENCH_LEVELS, PEN_LEVELS, DISHES, MACHINES, AQUARIUM } from '../shared/balance.js';
import { isMachine, loadFor, collectFor, isReady, fishIn, isFish, TANK } from '../shared/machines.js';
import { SPOT_KINDS, RARE, TREE, ROCK, WEAPONS, SWORDS, SAFE_CIRCLE, mostWood, mostStone, woodFor, stoneFor, steelFor, GROUND_STAND_Y, FARM_CHEST, PIECES, MAX_PIECES, mostPieces, keptClear, chestHasRoom, pieceTiles, inHouseField, nextSite, siteMap, movedKey } from '../shared/level.js';
import { CROPS, createCropView, BEAN_LEDGES } from './crops.js';
import { createDayNight, DAY_LENGTH_SECONDS } from './daynight.js';
import { createSeasons } from './seasons.js';
import { createWeather } from './weather.js';
import { rainSince } from '../shared/weather.js';
import * as sound from './sound.js';
import * as viewMode from './view.js';
import { buildWorld, tileKeyFor, TILE_SIZE, leafMats, blobGeo, addDecor, addRipples, SEA_LEVEL } from './world.js';
import { HOME, wildMap, LOBBY_POND_Y } from './maps.js';
import { islandFor } from '../shared/worldgen.js';
import { arenaFor, GAMES } from '../shared/arenas.js';
import { arenaMap, buildCrown } from './arenas.js';
import { spawnPoint } from '../shared/level.js';
import { wildsFromWire } from '../shared/wilds.js';
import { CAST_REACH, waterOn } from '../shared/fishing.js';
import { HOME_HALF, OLD_HALF, farmBlocked, inLake, LAKE, DOCK } from '../shared/farmland.js';
import { HOME_WILDS } from '../shared/homewilds.js';
import { Giants, KINDS as GIANT_KINDS, giantMax, gameDay, mostGiantLoot, LOBBY_DAWN } from '../shared/giants.js';
import { createGiantBars } from './giantbar.js';
import { createBosses } from './bosses.js';
import { BOSSES, SHOP, MINIGAMES, WATERED_GROWTH, FARM_FORAGE } from '../shared/balance.js';
import { portalOf, BOSS_IDS } from '../shared/bosses.js';
import { dungeonStart } from '../shared/dungeons.js';
import { createSkills } from './skills.js';
import { SKILL_LIST } from '../shared/skills.js';
import { createPuffs } from './puff.js';
import { createGlider } from './glider.js';
import { createTrade } from './ui/trade.js';
import { createDevTools } from './devtools.js';
import { SKY_CHEST_KINDS, skyChestView, relicBeam, restyleNearest, stairFoot, updateSkyFade } from './skyisles.js';

// ---------- The farmers at this screen ----------
// One seat for each farmer playing at this screen. The first is the page's
// own: the keyboard, the mouse, a touch screen and its controller, the farm
// and the account it is saved with. On our own farm more can join (split
// screen), each on a controller of their own, with a farmer of their own
// (their account's, or a guest's: their backpack, skills and the rest come
// along, and are saved back to it), a camera and a part of the screen.
//
// The code below is written for one farmer: `player`, `inventory`, `camera`,
// `walk` and the rest. It works for a seat once that seat's own are in
// them (become): each frame for each seat in turn (update), and whenever a
// seat's own windows and buttons do something (seated, forSeat), so their
// callbacks work for their farmer. Between frames they are the first seat's
// (the keyboard and the mouse are its).
const seatsEl = el('div', 'seats', document.body);
const seats = [];
let me = null; // the seat the code works for now
// (each seat's own, in place for the seat the code works for: become)
let camera, camTarget, camOffset, inventory, skills, player, lastGoodSpot, farmer, playerMesh, hoeGroup, anim, keys, chop, mine, knock;
let glider, marker, tileCursor, touch, pad, hud, guide, fishLog, book, fishing, bosses, shop, npcs, dialog, chest, trade;
let workbench, arcade, cooking, readyNoted, learned, pettedOn;
let fitZoom, playerZoom, camZoom, camGroundY, underground, landedOn, bopReady, jumpPressed, jumpTapped, jumpTappedAt, jumpRising, lookYaw, lookPitch, lookWrote;
let airTime, stepTimer, airJumps, gliding, walk, chopping, mining, hoverAt, held, cameInBy, building, builtKey, mouseAt, buildShown;
let readyCheck, meal;

// A new seat's own values of those that change (as a farmer starts)
const freshSeat = () => ({
  fitZoom: 1,
  playerZoom: 1,
  camZoom: 1,
  camGroundY: 0, // feet height the camera tracks vertically
  underground: 0, // how far down in one we are (bosses.underground(), as of this frame)
  landedOn: null, // (the ledge we came down on last, while we stand on it)
  bopReady: 0, // (clock time the weapon can swing again)
  jumpPressed: false, // (a press shorter than a frame still jumps)
  jumpTapped: false, // a fresh press (not the key held down repeating): a jump in the air
  jumpTappedAt: -Infinity, // when Jump was last pressed (clock.elapsedTime)
  jumpRising: false, // on the way up from a jump of our own (not a bop's)
  lookYaw: null, // first person: the way the farmer looks (like anim.facing: 0 is +z), or null: seen from above
  lookPitch: 0, // ...and up (+) or down (-), in radians
  lookWrote: null, // (the facing it last gave the farmer: another is a turn from outside, a door's)
  airTime: 0, // seconds since the farmer was last on the ground
  stepTimer: 0,
  airJumps: 0, // jumps left in the air
  gliding: false,
  walk: null, // { kind: 'tile' | 'stall' | 'spot' | 'tree' | 'animal', x, y, z, farm, spot, tree, animal, best, stuck }
  chopping: null, // the tree a tap is chopping
  mining: null, // the rock a tap is mining
  hoverAt: null, // where the mouse is over the game (null: off it, or not a mouse)
  held: null, // { id, x, y }: the mouse button held down, and where it is
  cameInBy: null, // the house we went inside by (its tile): out through its door again
  building: null, // build mode: a PIECES id, or 'remove'
  builtKey: null, // the tile E last built on (holding E builds on each new one)
  mouseAt: null, // where the mouse is over the screen, while build mode aims with it
  buildShown: '', // (what the build bar says, so it is only set when it changes)
  readyCheck: 0,
  meal: null, // { dish, kinds, level, left (seconds) }, or null
});

// The code works for `seat` from here on: its own in place (the last one's put away)
function become(seat) {
  if (me === seat) return;
  if (me) {
    Object.assign(me.vals, { fitZoom, playerZoom, camZoom, camGroundY, underground, landedOn, bopReady, jumpPressed, jumpTapped, jumpTappedAt, jumpRising, lookYaw, lookPitch, lookWrote });
    Object.assign(me.vals, { airTime, stepTimer, airJumps, gliding, walk, chopping, mining, hoverAt, held, cameInBy, building, builtKey, mouseAt, buildShown });
    Object.assign(me.vals, { readyCheck, meal });
  }
  me = seat;
  ({ camera, camTarget, camOffset, inventory, skills, player, lastGoodSpot, farmer, playerMesh, hoeGroup, anim, keys, chop, mine, knock } = seat);
  ({ glider, marker, tileCursor, touch, pad, hud, guide, fishLog, book, fishing, bosses, shop, npcs, dialog, chest, trade } = seat);
  ({ workbench, arcade, cooking, readyNoted, learned, pettedOn } = seat);
  ({ fitZoom, playerZoom, camZoom, camGroundY, underground, landedOn, bopReady, jumpPressed, jumpTapped, jumpTappedAt, jumpRising, lookYaw, lookPitch, lookWrote } = seat.vals);
  ({ airTime, stepTimer, airJumps, gliding, walk, chopping, mining, hoverAt, held, cameInBy, building, builtKey, mouseAt, buildShown } = seat.vals);
  ({ readyCheck, meal } = seat.vals);
}

// fn(), as `seat`'s (and back to whoever's it was)
function within(seat, fn) {
  const was = me;
  become(seat);
  try {
    return fn();
  } finally {
    become(was);
  }
}

// fn, made to work for `seat` whenever it is called (a seat's windows and buttons call back)
const seated = (seat, fn) => (...args) => within(seat, () => fn(...args));
// A seat's own module's options: every callback in them seated (but active(),
// which asks whose the keys are now)
const forSeat = (seat, opts) => Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, typeof v === 'function' && k !== 'active' ? seated(seat, v) : v]));

// A seat (its own things are made as the code below gets to them, makeSeat)
function newSeat(index) {
  const root = index === 0 ? el('div', 'seat seat-0', seatsEl) : el('div', `seat seat-${index}`);
  // rect: its part of the screen (CSS pixels). eye: where its view's trees fade out of the way of.
  // padIndex: its controller (navigator.getGamepads()), once it has one of its own
  return { index, root, rect: { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }, vals: freshSeat(), eye: new THREE.Vector3(), padIndex: null, moving: false };
}
const first = newSeat(0); // (the page's own)
seats.push(first);
me = first;
({ fitZoom, playerZoom, camZoom, camGroundY, underground, landedOn, bopReady, jumpPressed, jumpTapped, jumpTappedAt, jumpRising, lookYaw, lookPitch, lookWrote } = first.vals);
({ airTime, stepTimer, airJumps, gliding, walk, chopping, mining, hoverAt, held, cameInBy, building, builtKey, mouseAt, buildShown } = first.vals);
({ readyCheck, meal } = first.vals);

// ---------- Renderer / Scene / Camera ----------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// How much is drawn is the graphics tier's (src/gfx/quality.js: the menu's
// Graphics setting; a phone's is medium, fewer pixels and a smaller shadow
// map: on its small screen it looks the same, and it runs cooler and lasts
// longer). (Testing: ?lowgfx is low, a quarter of the pixels and no shadows,
// for a headless browser without a GPU, scripts/browser.mjs; ?gfx=high...)
// It is applied below, once the sun and the weather are made, and again
// whenever it is changed.
renderer.setPixelRatio(quality.knobs().pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = quality.knobs().shadowMap > 0;
renderer.shadowMap.type = THREE.PCFShadowMap; // (soft edges by sun.shadow.radius, which PCFSoft ignores)
toneMap(renderer); // (filmic: src/gfx/tonemap.js)
// (what it drew, a frame at a time: __game.stats() and the devtools' Info tab)
const gfxStats = createStats(renderer);
// On medium and high, the views are drawn through a post chain (bloom, a color
// grade, anti-aliasing: src/gfx/post.js); on low, straight to the screen (draw())
const SPLIT_GAP = new THREE.Color(0x1d120a); // (between the views of a split screen)
const post = createPost(renderer, { seats: () => seats, view: seatView, gap: SPLIT_GAP });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const FOG_NEAR = 30;
const FOG_FAR = 90;
const CAVE_FOG = [15, 36]; // (near and far, down in a boss's dungeon)
scene.fog = new THREE.Fog(0x87ceeb, FOG_NEAR, FOG_FAR);
gfx.U.uFogHeight.value.x = SEA_LEVEL; // (the low haze over the sea lies on it: src/gfx/atmos.js)
// The sky round every view, its horizon the fog's color (src/gfx/sky.js; the
// background is what shows before it is drawn)
scene.add(createSky());

// (near: half a unit, not a tenth. The camera is never that close to anything
// it shows, and the depth buffer is five times finer for it: some phones' is
// coarse, and surfaces a little apart flickered there). Each seat has its own.
const newCamera = () => new THREE.PerspectiveCamera(60, 1, 0.5, 200);
camera = first.camera = newCamera();

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
camTarget = first.camTarget = new THREE.Vector3(); // point the camera looks at, set once the player exists

// On a screen taller than it is wide (a phone held upright) the view is
// narrow, so the camera pulls back to show more of the island to either side:
// partway toward the width a square screen shows, at most CAM_MAX_ZOOM.
const CAM_MAX_ZOOM = 1.6;
// On top of that the player zooms with the mouse wheel or a two-finger pinch,
// within CAM_ZOOM_NEAR..CAM_ZOOM_FAR all told; the camera eases to it.
const CAM_ZOOM_NEAR = 0.6;
const CAM_ZOOM_FAR = 2.2;
const CAM_ZOOM_EASE = 10;
camOffset = first.camOffset = new THREE.Vector3();
const zoomGoal = () => fitZoom * playerZoom;
// (to the seat's part of the screen)
function fitCamera() {
  // (a phone can start the page before the screen has a size: wait for the resize)
  if (!(me.rect.w > 0 && me.rect.h > 0)) return;
  camera.aspect = me.rect.w / me.rect.h;
  camera.updateProjectionMatrix();
  fitZoom = Math.min(Math.sqrt(Math.max(1, 1 / camera.aspect)), CAM_MAX_ZOOM);
  zoomBy(1); // keep the player's zoom inside the range for the new shape
}
function zoomBy(factor) {
  if (!Number.isFinite(factor)) return;
  playerZoom = THREE.MathUtils.clamp(playerZoom * factor, CAM_ZOOM_NEAR / fitZoom, CAM_ZOOM_FAR / fitZoom);
}
fitCamera();
camZoom = zoomGoal();

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
let shadowMap = quality.knobs().shadowMap || 2048; // (its size; set by the graphics tier, below)
sun.shadow.mapSize.set(shadowMap, shadowMap);
sun.shadow.camera.left = -SUN_REACH;
sun.shadow.camera.right = SUN_REACH;
sun.shadow.camera.top = SUN_REACH;
sun.shadow.camera.bottom = -SUN_REACH;
sun.shadow.camera.far = 100;
sun.shadow.normalBias = 0.035; // (the wrapped light shows faces near side-on to the sun: no acne on them)
sun.shadow.radius = 2.5; // (soft-edged, painterly shadows)
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
  const step = ((sunReach * 2) / shadowMap) * 4;
  const snap = (n) => Math.round(n / step) * step;
  _sunOffset.subVectors(sun.position, sun.target.position); // (the day/night cycle sets its direction)
  sun.target.position.set(snap(focus.x), 0, snap(focus.z - ahead));
  sun.position.copy(sun.target.position).add(_sunOffset);
}

// Day/night cycle (see daynight.js) drives the sun, hemisphere light, sky and
// fog over time. Start hour can be overridden for testing with ?hour=21.
const startHour = Number(new URLSearchParams(location.search).get('hour') ?? 6);
const dayNight = createDayNight({ scene, sun, hemi, startHour: Number.isFinite(startHour) ? startHour : 6 });
// The farm's seasons (seasons.js): its colors, by its clock
const seasons = createSeasons(HOME);
// ...and its weather (weather.js): rain, storms, snow in winter
const weather = createWeather({ scene, dayNight, count: quality.MAX_PARTICLES });

// The graphics tier, now and whenever it is changed in the menu
quality.onApply((k) => {
  renderer.setPixelRatio(k.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const shadows = k.shadowMap > 0;
  if (shadows && k.shadowMap !== shadowMap) {
    shadowMap = k.shadowMap;
    sun.shadow.mapSize.set(shadowMap, shadowMap);
    sun.shadow.map?.dispose(); // (made again at the new size, on the next frame)
    sun.shadow.map = null;
  }
  renderer.shadowMap.enabled = shadows;
  post.apply(k);
  gfx.U.uCloudShadows.value = k.cloudShadows ? 1 : 0; // (the clouds' shadows on the land: src/gfx/light.js)
  gfx.U.uNightGrey.value = post.on ? 0 : 0.35; // (the night's grey: the grade's on the post tiers, src/gfx/post.js; the light's without)
  sun.castShadow = shadows; // (which also has every lit material's shader made again, with or without them)
  weather.setParticles(k.particles);
  dayNight.setParticles(k.particles); // (the motes in the sunlight: src/gfx/motes.js)
});
quality.applyTier();

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
    if (session?.seed === seed && session.boardAt) fishBoard.placeIn(worlds.wild.root, session.boardAt); // (and the fishing board)
    wildsShown = wilds;
  }
  if (name === 'arena' && worlds.arena?.name !== `arena:${seed.kind}:${seed.seed}`) {
    stale = worlds.arena;
    const map = arenaMap(arenaFor(seed.kind, seed.seed));
    worlds.arena = buildWorld(map);
    worlds.arena.coins = map.coins; // (a view per coin, by id)
    worlds.arena.dropTiles = (ms) => map.dropTiles(ms); // (last one standing's tiles, as they are ms into the game)
  }
  if (worlds[name] !== world) {
    scene.remove(world.root);
    world = worlds[name];
    scene.add(world.root);
  }
  stale?.dispose(); // (out of the scene by now)
}

let wildIsland = null; // the wild island we are on, in a lobby (shared/worldgen.js: where its water is)

// The sea around every island, deep blue-green; it mirrors the sky as the
// view grazes it and fades into the fog toward the horizon
const WATER_Y = SEA_LEVEL;
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000), // (out to the bosses' arenas and the neighbours' rooms, and beyond)
  waterLook(addRipples(new THREE.MeshStandardMaterial({ color: 0x1f7f9e, roughness: 0.2, metalness: 0.1 })), 'sea') // (sky, glitter: src/gfx/water.js)
);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_Y;
water.receiveShadow = true;
scene.add(water);

// ---------- Inventory ----------
// Toolbar + backpack UI (see inventory.js). Opening the backpack pauses
// player input, so drop any keys that were held at that moment. The backpack
// goes everywhere with you, and is saved with the farm (see Saving). Each
// seat has its own, in its own part of the screen.
const newInventory = (seat) => createInventory(forSeat(seat, {
  parent: seat.root,
  active: () => me === seat,
  onOpenChange: (open) => open && keys.clear(),
  onBuild: (piece) => startBuilding(piece),
  onAdd: (id) => {
    readRecipe(id);
    if (book.saw(id)) inventory.notify(`New in your collection book: ${ITEMS[id].name}`);
  },
  onEat: (id) => eat(id, false),
  onDrop: ({ id, count }) => dropFromBackpack(id, count),
  buildProblem: () => (place !== 'home' ? 'You build on a farm: head home first.' : farmVisit?.visitor ? 'You\'re looking round: only the farm\'s helpers build here.' : indoors() ? 'You build outside: head out of the house first.' : ''),
  building: () => building,
  inChest: (item) => chestStock()[item] ?? 0,
  renderSkills: (el) => skills.render(el),
  renderFish: (el) => fishLog.render(el),
  renderBook: (el) => book.render(el),
  renderQuests: (el) => renderQuests(el, npcs, missionCtx()),
  renderMap: (el) => renderMap(el, whereOnFarm()),
}));
inventory = first.inventory = newInventory(first);

// ---------- Skills ----------
// Farming, animals, woodcutting and mining (and fishing, once there is
// fishing) level up by doing them (skills.js): each level a little more
// chance of one more of what they give, and the overall level unlocks the
// double jump. Yours wherever you farm: saved with the backpack.
const newSkills = (seat) => createSkills(forSeat(seat, {
  onLevelUp: (title, detail) => {
    sound.play('cheer');
    hud.flash(title);
    inventory.notify(detail);
  },
}));
skills = first.skills = newSkills(first);
// What a skill's work counts as, for the neighbours' requests (shared/npcs.js)
const DEED_OF = { farming: 'harvest', woodcutting: 'chop', mining: 'mine' };
// XP in skill for what was got, and now and then (the skill's bonus) one more of item
function skilled(skill, xp, item) {
  skills.gain(skill, xp);
  if (DEED_OF[skill]) npcs.did(DEED_OF[skill]);
  if (item && skills.extra(skill) && inventory.canAdd(item, 1)) inventory.add(item, 1);
}

// The tool in hand, by what it does ('hoe', 'axe' or 'pickaxe': plain or sturdy), or null
const holding = () => ITEMS[inventory.selectedId()]?.tool ?? null;
// Swings to fell a tree or break a rock with the tool in hand (a better one takes fewer)
const swingsWith = (base) => Math.max(1, (ITEMS[inventory.selectedId()]?.hits ?? base) - boostOf(meal, 'swings')); // (fewer after a hearty meal)
// The more a tree we felled or a rock we broke (m: FELLED or MINED) gives
// with the tool in hand, a golden one (not a giant: that is shared out)
const extraFrom = (tool, m) => (m.by === seatId() && !m.shares && holding() === tool ? ITEMS[inventory.selectedId()].extra ?? 0 : 0);

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
// (the seasons, on what stays put: snow on it, leaves under the trees, and their light: seasons.js)
merchant.root.userData.noSnow = true;
seasons.attach({ root: worlds.home.root, trees: worlds.home.trees, sun, hemi, scene, sky: dayNight.sky });
const farmHours = () => (dayNight.day() - 1) * 24 + dayNight.hour(); // the farm's clock, in game hours
// (on a friend's farm the eggs, milk and wool are the farmer's)
const collect = (item) => place === 'home' && !visiting() && inventory.add(item);
// an egg, milk or wool: into the backpack, with Animals XP
const collectProduce = (item) => collect(item) && (skilled('animals', SKILLS.xp[item] ?? 0, item), true);
pettedOn = first.pettedOn = new WeakMap(); // animal -> the game day she was last petted (Animals XP once a day: each seat's own)

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
// (painted clods, a damp speckle and grit on all of them: src/gfx/detail.js)
const soilMat = detail(new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 }), 'soil');
const soilRidgeMat = detail(new THREE.MeshStandardMaterial({ color: 0x6e4826, roughness: 1, flatShading: true }), 'soil');
// ...darker when watered, till its crop is picked
const wetSoilMat = detail(new THREE.MeshStandardMaterial({ color: 0x33200f, roughness: 0.95 }), 'soil');
const wetRidgeMat = detail(new THREE.MeshStandardMaterial({ color: 0x41291a, roughness: 0.95, flatShading: true }), 'soil');
function setWet(key, wet) {
  const mesh = farmTiles.get(key);
  if (!mesh) return;
  mesh.material = wet ? wetSoilMat : soilMat;
  for (const ridge of mesh.children) ridge.material = wet ? wetRidgeMat : soilRidgeMat;
}

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
const crops = new Map(); // "gridX,gridZ" -> { cropId, age, view, ripe, pop, watered }

// age: seconds it has been growing already (a crop someone planted before we came)
function plantAt(x, z, cropId, age = 0) {
  const key = tileKeyFor(x, z);
  if (!farmTiles.has(key) || crops.has(key)) return false;

  const view = createCropView(cropId);
  view.group.position.copy(farmTiles.get(key).position).setY(0.06); // on top of the soil
  view.group.rotation.y = Math.random() * Math.PI * 2;
  if (cropId === 'sunflower' || CROPS[cropId].climb) view.group.rotation.y = 0; // keep the bloom facing the camera (and a beanstalk's leaves where its ledges are)
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

// A ripe crop's ledges (a beanstalk's leaves, a platform plant's top) out of the world
function dropLedges(crop) {
  for (const box of crop.ledges ?? []) {
    const i = worlds.home.platforms.indexOf(box);
    if (i >= 0) worlds.home.platforms.splice(i, 1);
  }
  crop.ledges = null;
}

function removeCrop(key) {
  const crop = crops.get(key);
  if (!crop) return;
  dropLedges(crop);
  scene.remove(crop.view.group);
  crops.delete(key);
  setWet(key, false);
}

// The crop on tile key was watered: it grows faster from now (WATERED_GROWTH)
function markWatered(key) {
  const crop = crops.get(key);
  if (!crop) return;
  crop.watered = true;
  setWet(key, true);
}

// Rain from `from` to `to` (the farm's game hours) waters every crop growing
// out in it (shared/weather.js). On a farm with helpers the room does (WATERED).
function rainOnCrops(from, to) {
  if (farmNet || rainSince(from, to) === null) return;
  for (const [key, crop] of crops) if (!crop.ripe && !crop.watered && !crop.pending) markWatered(key);
}

// Returns true if there was a ripe crop here (even if the bag was too full to take it).
// On a farm with helpers it goes in the farm's chest: it vanishes now, and the
// room's HARVESTED (or FARM_DENY: it comes back) settles it.
function harvestAt(x, z) {
  const key = tileKeyFor(x, z);
  const crop = crops.get(key);
  if (!crop?.ripe || !CROPS[crop.cropId].produce) return false; // (a lily leaf: nothing to pick)
  if (crop.pending) return true;
  if (CROPS[crop.cropId].climb && stalkUnderfoot() !== key) {
    inventory.notify(CROPS[crop.cropId].climb);
    return true;
  }
  if (farmNet) {
    crop.pending = true;
    crop.view.group.visible = false;
    roomLine()?.send({ t: C.HARVEST, key });
    return true;
  }
  const { produce, gives = 1, again } = CROPS[crop.cropId];
  if (inventory.add(produce, gives)) {
    skilled('farming', SKILLS.xp.harvest[crop.cropId] ?? 0, produce);
    if (again) pickAgain(key);
    else removeCrop(key);
  }
  return true;
}

// A plant that stays when it's picked (`again`: a tomato plant, a berry
// bush): ripe again in a while, and dry again (on a farm with helpers, as the
// room has it: HARVESTED)
function pickAgain(key) {
  const crop = crops.get(key);
  const { growTime, again } = CROPS[crop.cropId];
  Object.assign(crop, { age: growTime - again, ripe: false, watered: false, pending: false, landings: 0 });
  dropLedges(crop); // (a bounce shroom's cap, a lily leaf: nothing to stand on till it's grown back)
  if (crop.plantedAt !== undefined) {
    crop.plantedAt = farmHours() - ((growTime - again) * 24) / DAY_LENGTH_SECONDS;
    crop.wateredAt = undefined;
  }
  crop.view.group.visible = true;
  crop.view.setProgress(crop.age / growTime);
  setWet(key, false);
}

// Dig one up with the hoe (it never comes up by being picked); on a farm with
// helpers the room says it's gone (UPROOTED)
function uproot(key) {
  const crop = crops.get(key);
  if (crop.pending) return;
  startHoeSwing();
  sound.play('till');
  if (!farmNet) return removeCrop(key);
  crop.pending = true;
  crop.view.group.visible = false;
  roomLine()?.send({ t: C.UPROOT, key });
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
  machines.clear();
}

// `growDt` is game-clock seconds (growth); `dt` is real seconds (animation)
// A ripe beanstalk's leaves (src/crops.js BEAN_LEDGES), as ledges in the
// farm's platforms: climbed to pick its beans from the crown at the top
// ...or a platform plant's top (PLATFORM_PLANTS: a bounce shroom's cap and a
// lily leaf stand on the ground, solid; cloud cotton floats, solid only from
// above), its one ledge (`plant`: the crop, for landing on it)
function stalkLedges(crop) {
  const { x, z } = crop.view.group.position;
  const plant = CROPS[crop.cropId].platform;
  return (plant ? [[0, 0, plant.top, plant.width]] : BEAN_LEDGES).map(([dx, dz, top, w]) => {
    const bottom = plant && !plant.oneWay ? 0 : top - 0.12;
    const box = {
      center: new THREE.Vector3(x + dx, (top + bottom) / 2, z + dz),
      min: new THREE.Vector3(x + dx - w / 2, bottom, z + dz - w / 2),
      max: new THREE.Vector3(x + dx + w / 2, top, z + dz + w / 2),
      ...(plant && { plant: crop, oneWay: !!plant.oneWay }),
    };
    worlds.home.platforms.push(box);
    return box;
  });
}

// The ripe crop picked from on top (`climb`: a beanstalk's crown, a cloud
// cotton) we stand on (its tile's key), if any
function stalkUnderfoot() {
  if (!player.onGround) return null;
  for (const [key, crop] of crops) {
    const top = CROPS[crop.cropId].climb && crop.ledges?.at(-1);
    if (!top || player.position.y - GROUND_STAND_Y < top.max.y - 0.3) continue;
    if (Math.hypot(player.position.x - top.center.x, player.position.z - top.center.z) < (top.max.x - top.min.x) / 2 + 0.4) return key;
  }
  return null;
}

// Landing on a platform plant: a bounce shroom's cap throws us up `bounce`
// times as high as a jump, and a lily leaf wilts after `wilts` landings, to
// grow back (on a farm with helpers the room hears it as a pick: HARVEST)
function landOnPlant(box) {
  const crop = box.plant;
  const key = tileKeyFor(crop.view.group.position.x, crop.view.group.position.z);
  if (crops.get(key) !== crop || !crop.ripe || crop.pending) return;
  crop.pop = 1; // (it gives under us)
  const { bounce, wilts } = CROPS[crop.cropId].platform;
  if (bounce) {
    player.velocity.y = JUMP_SPEED * Math.sqrt(bounce) * boostOf(meal, 'jump'); // (bounce times the height)
    player.onGround = false;
    airJumps = skills.canDoubleJump() ? 1 : 0;
    anim.squash = -0.25;
    sound.play('boing');
  }
  crop.landings = (crop.landings ?? 0) + 1;
  if (wilts && crop.landings >= wilts) {
    roomLine()?.send({ t: C.HARVEST, key });
    pickAgain(key);
    sound.play('wilt');
    inventory.notify(`The ${CROPS[crop.cropId].name} wilted: it grows back in a while`);
  }
}

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
      crop.age += growDt * (crop.watered ? WATERED_GROWTH : 1);
      const progress = Math.min(crop.age / CROPS[crop.cropId].growTime, 1);
      crop.view.setProgress(progress);
      if (progress >= 1) {
        crop.ripe = true;
        crop.pop = 1; // little bounce when it ripens
        if (CROPS[crop.cropId].climb || CROPS[crop.cropId].platform) crop.ledges = stalkLedges(crop);
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
const TOUCH_RADIUS = 1; // (walking into a treasure, or a drop: a little more for those)
const GATHER_REACH = 1.6;
const USE_HEIGHT = 1.2; // how far above or below the feet E reaches (from a step or a platform)
// Standing (not mid-jump) with the feet within USE_HEIGHT of y (crops, trees and rocks: the ground's 0)
const footReach = (y = 0) => player.onGround && Math.abs(player.position.y - GROUND_STAND_Y - y) < USE_HEIGHT;
const GATHER_VERB = { bush: 'Pick berries', mushroom: 'Pick mushrooms', heather: 'Pick heather', cattail: 'Cut cattails', bluebell: 'Pick bluebells', sunflower: 'Pick sunflowers', pumpkin: 'Pick pumpkins', fern: 'Pick ferns', seashell: 'Collect shells', sky_chest: 'Open the chest', sky_vault: 'Unlock the chest', strawberry: 'Pick strawberries' };
const CHEST_ROOM = 3; // free backpack slots a sky isle's chest asks for, since what is in it is a surprise

const berryGeo = new THREE.SphereGeometry(0.085, 6, 5);
const berryMat = new THREE.MeshStandardMaterial({ color: 0xd8344f, roughness: 0.35 });
// (wild strawberries, generation 11: a low clump of leaves, red berries)
const strawberryLeafGeo = new THREE.SphereGeometry(0.2, 6, 4);
const strawberryLeafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.8 });
const strawberryGeo = new THREE.ConeGeometry(0.07, 0.13, 6).rotateX(Math.PI);
const strawberryMat = new THREE.MeshStandardMaterial({ color: 0xe0303a, roughness: 0.45 });
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
  } else if (spot.kind === 'strawberry') {
    // A low leafy clump, ripe red berries peeping out
    content = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      const leaf = new THREE.Mesh(strawberryLeafGeo, strawberryLeafMat);
      leaf.position.set(Math.cos(a) * 0.2, 0.07, Math.sin(a) * 0.2);
      leaf.scale.set(1, 0.4, 1);
      content.add(leaf);
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.9 + 0.5;
      const berry = new THREE.Mesh(strawberryGeo, strawberryMat);
      berry.position.set(Math.cos(a) * 0.24, 0.1, Math.sin(a) * 0.24);
      content.add(berry);
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
  if (!canLoot()) {
    inventory.notify(partyGame ? 'Wait for the loot run to start' : 'The loot run is over');
    spot.retryAt = performance.now() + 1500;
    return;
  }
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
  const hint = useHint();
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
const newChop = () => ({ id: -1, hits: 0, swingAt: -1, nextSwing: 0, pending: new Set() }); // (each seat's own: chop, mine)
chop = first.chop = newChop();
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
  if (justLooking()) return true;
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
      sound.play('chop');
      if (tree.big > 1) hitGiant('tree', tree);
      else if (++chop.hits >= swingsWith(TREE.hits, 'woodcutting')) {
        chop.pending.add(tree.id);
        chop.hits = 0;
        const r = (v) => Math.round(v * 100) / 100;
        const conn = place === 'lobby' ? net : roomLine();
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
  // it falls away from whoever felled it
  const by = seatBy(m.by);
  wildsWorld().fellTree(m.id, by ? by.player.position : remotes.positionOf(m.by));
  if (by) sound.play('fell');
  // (each farmer at the screen: done swinging at it, and what they have of it)
  for (const seat of seats) within(seat, () => woodFrom(m));
}

// A farmer's own of a felled tree: their wood
function woodFrom(m) {
  chop.pending.delete(m.id);
  if (chop.id === m.id) Object.assign(chop, { id: -1, hits: 0 });
  const got = myShare(m) + extraFrom('axe', m);
  if (got) inventory.add('wood', got);
  if (m.shares) giantDown('tree', m.id, got, 'wood');
  if (got) skilled('woodcutting', m.shares ? SKILLS.xp.giant : SKILLS.xp.tree, 'wood'); // (after: a level up's notice goes over the giant's)
}

// On a farm played alone: the tree is ours to fell
function chopAlone(tree) {
  treeFelled({ id: tree.id, by: seatId(), count: woodFor(tree.scale) });
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
mine = first.mine = newChop();
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
  if (justLooking()) return true;
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
      sound.play('mine');
      if (rock.big > 1) hitGiant('rock', rock);
      else if (++mine.hits >= swingsWith(ROCK.hits, 'mining')) {
        mine.pending.add(rock.id);
        mine.hits = 0;
        const r = (v) => Math.round(v * 100) / 100;
        const conn = place === 'lobby' ? net : roomLine();
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
  wildsWorld().breakRock(m.id);
  for (const seat of seats) within(seat, () => stoneFrom(m)); // (as treeFelled)
}

// A farmer's own of a broken rock: their stone (and steel)
function stoneFrom(m) {
  mine.pending.delete(m.id);
  if (mine.id === m.id) Object.assign(mine, { id: -1, hits: 0 });
  const got = myShare(m) + extraFrom('pickaxe', m);
  if (got) inventory.add('stone', got);
  // (now and then a lump of steel in it too: for the one who broke it up, or each who helped with a giant)
  const steel = m.shares ? (got ? ROCK.giant : 0) : m.by === seatId() ? m.steel ?? 0 : 0;
  if (steel) inventory.add('steel', steel);
  if (m.shares) giantDown('rock', m.id, got, steel ? `stone, +${steel} steel` : 'stone');
  else if (steel) hud.flash(`+${steel} steel!`);
  if (got) skilled('mining', m.shares ? SKILLS.xp.giant : SKILLS.xp.rock, 'stone'); // (after: a level up's notice goes over the giant's)
}

// On a farm played alone: the rock is ours to break
function mineAlone(rock) {
  rockMined({ id: rock.id, by: seatId(), count: stoneFor(rock.scale), steel: steelFor(rock.scale) });
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

// Who a farmer at this screen is in what is said and shared out: the page's
// id (the lobby's or the farm room's) for the first farmer; for the others at
// a split screen, the id their own line to a farm's room gave them, else one
// of their own (never another's, even one who got up: seat.uid)
const idOf = (seat) => (seat === first ? myId : seat.netId ?? seat.uid);
const seatId = () => idOf(me);
// The farmer at this screen the room means by `id` (if it is one of them)
const seatBy = (id) => seats.find((seat) => idOf(seat) === id);

// Our share of a FELLED or MINED: all of it, if we did it alone
const myShare = (m) => (m.shares ? m.shares.find(([who]) => who === seatId())?.[1] ?? 0 : m.by === seatId() ? m.count : 0);

// A swing of ours landed on a giant
function hitGiant(kind, thing) {
  const r = (v) => Math.round(v * 100) / 100;
  const tool = inventory.selectedId();
  const conn = place === 'lobby' ? net : roomLine();
  if (conn) return conn.send({ t: C.HIT, kind, id: thing.id, x: r(thing.x), z: r(thing.z), size: r(thing.scale), tool });
  // (a farm played alone)
  const hit = farmGiants.hit(kind, thing.id, seatId(), tool, thing.scale);
  if (!hit) return;
  giantBars.show(kind, thing.id, hit.hp, giantMax(kind), world.giantTop(kind, thing.id), clock.elapsedTime);
  if (!hit.shares) return;
  const m = { id: thing.id, by: seatId(), count: hit.loot, shares: hit.shares };
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
  // (our own swing shook it already: a farmer at this screen's)
  if (!seatBy(m.by)) {
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
  if (place !== 'home' && place !== 'lobby') return 'Not on the title screen';
  if (giantsHere()[kind]) return `There is a giant ${kind} here already`;
  let best = null;
  let bestD = Infinity;
  for (const thing of kind === 'tree' ? world.trees : world.rocks) {
    const d = Math.hypot(thing.x - player.position.x, thing.z - player.position.z);
    if (thing.state === 'up' && d < bestD) [best, bestD] = [thing, d];
  }
  if (!best) return `No ${kind} standing here`;
  const conn = place === 'lobby' ? net : roomLine();
  if (conn) {
    conn.send({ t: C.DEV_GIANT, kind, id: best.id });
    return `A giant ${kind}, coming up`;
  }
  if (farmVisit) return 'Not here';
  farmGiants.setCounts(worlds.home.trees.length, worlds.home.rocks.length);
  if (!farmGiants.grow(kind, best.id)) return `No giant ${kind} here today`;
  worlds.home.makeGiant(kind, best.id);
  return `A giant ${kind} has grown on the farm!`;
}
// ...and on a lobby's sky isles (generation 10): hop to the foot of the
// nearest one's stair, or draw the nearest one in the next style
function devSkyFoot() {
  const foot = place === 'lobby' ? stairFoot(player.position.x, player.position.z) : null;
  if (!foot) return 'No sky isles here';
  player.position.set(foot.x, GROUND_STAND_Y + 0.5, foot.z);
  player.velocity.set(0, 0, 0);
  return 'At the foot of a stair';
}
function devSkyStyle() {
  const name = place === 'lobby' ? restyleNearest(player.position.x, player.position.z) : null;
  return name ? `Now a ${name.toLowerCase()}` : 'No sky isles here';
}
// ...and the rest of its buttons. The farm's ones are for our own farm played
// alone (on a farm with helpers, or in a lobby, the room has the say).
let devSpeed = 1; // how much faster we walk
let devJump = 0; // game hours the clock was just put on: the frame counts them as passed (crops grow, as they do fast-forwarded)
const soloFarm = () => place === 'home' && !farmVisit && farmOnScreen;
const NOT_SOLO = 'Only on your own farm, played alone';
const devGive = (id, n) => (inventory.add(id, n) ? `${n} × ${ITEMS[id].name}` : 'No room in the backpack');
function devLater(hours) {
  if (!soloFarm()) return NOT_SOLO;
  dayNight.setTime(farmHours() + hours);
  devJump += hours;
  saveGame();
  return `Day ${dayNight.day()}, ${String(Math.floor(dayNight.hour())).padStart(2, '0')}:${String(Math.floor((dayNight.hour() % 1) * 60)).padStart(2, '0')}`;
}
createDevTools({
  giant: devGiant,
  skyFoot: devSkyFoot,
  skyStyle: devSkyStyle,
  find: () => (!soloFarm() ? NOT_SOLO : farmFinds.spawnNow() ? 'Something turned up on the grass' : 'Nowhere free for one just now'),
  regrow() {
    if (!soloFarm()) return NOT_SOLO;
    const n = farmFelled.size + farmMined.size;
    for (const list of [farmFelled, farmMined]) for (const id of list.keys()) list.set(id, 0); // (regrowFarm, next frame)
    return n ? `${n} coming back` : 'Nothing is down';
  },
  items: () => Object.entries(ITEMS).filter(([, def]) => !def.currency).map(([id, def]) => [id, def.name]),
  give: devGive,
  gold(n) {
    inventory.earn(n);
    return `+${n.toLocaleString('en')} gold`;
  },
  seeds() {
    const seeds = Object.keys(ITEMS).filter((id) => ITEMS[id].plants);
    for (const id of seeds) if (!inventory.add(id, 20)) return 'No room for them all';
    return `Twenty each of ${seeds.length} seeds`;
  },
  oldKey: () => devGive('key', 1),
  bossKeys() {
    for (const { key, pieces } of Object.values(BOSSES)) if (!inventory.add(key, pieces)) return 'No room in the backpack';
    return 'A full set of each boss\'s key pieces';
  },
  speed: (n) => (n === undefined ? devSpeed : (devSpeed = n)),
  plaza() {
    if (place === 'title') return 'Not on the title screen';
    putDown(arrival());
    return 'Back at the plaza';
  },
  skills(xp) {
    for (const { id } of SKILL_LIST) skills.gain(id, xp === Infinity ? 1e9 : xp);
    saveGame();
    return `Overall level ${skills.overall()}${skills.canDoubleJump() ? ', with the double jump' : ''}`;
  },
  clock: (hour) => devLater((((hour - dayNight.hour()) % 24) + 24) % 24 || 24),
  later: devLater,
  places: () => [...NPC_IDS.map((id) => [id, NPCS[id].name]), ['lake', 'The lake'], ['dock', 'The dock']],
  goTo(id) {
    if (place !== 'home') return 'Head home first';
    const at = id === 'lake' ? { x: LAKE.x - LAKE.r - 2.5, z: LAKE.z } : id === 'dock' ? { x: DOCK.x, z: DOCK.z0 - 1 } : npcs.outside(id);
    putDown({ ...at, y: GROUND_STAND_Y });
    return `At ${id === 'lake' ? 'the lake' : id === 'dock' ? 'Finn\'s dock' : `${NPCS[id].name}'s door`}`;
  },
  neighbours: () => NPC_IDS.map((id) => [id, NPCS[id].name]),
  finish(id) {
    const done = npcs.finish(id);
    saveGame();
    return done ? `${NPCS[id].name}: "${done.title}" done` : `${NPCS[id].name} has nothing left to ask`;
  },
  hearts() {
    for (const id of NPC_IDS) npcs.befriend(id);
    saveGame();
    return 'Five hearts with all four';
  },
  forget() {
    npcs.reset();
    saveGame();
    return 'Nobody met yet';
  },
  forage: () => (!soloFarm() ? NOT_SOLO : farmFinds.forageNow() ? 'Something wild turned up out in the valley' : 'Nowhere free for it just now'),
  info: () => [
    ['Where', place === 'lobby' ? `Lobby ${session?.code ?? ''}${arenaId ? ' (a party game)' : ''}` : farmVisit ? `${farmVisit.name}${farmVisit.mine ? ' (yours, with helpers)' : ''}` : place === 'home' ? 'Your farm' : 'The title screen'],
    ['Position', ['x', 'y', 'z'].map((k) => player.position[k].toFixed(1)).join(', ')],
    ['Farmers here', place === 'title' ? '–' : remotes.players.size + 1],
    ['Time', `Day ${dayNight.day()}, ${String(Math.floor(dayNight.hour())).padStart(2, '0')}:${String(Math.floor((dayNight.hour() % 1) * 60)).padStart(2, '0')}`],
    ['Skills', `Overall level ${skills.overall()}`],
    ['Gold', inventory.gold().toLocaleString('en')],
    ['Things dropped', place === 'home' && !farmVisit ? farmFinds.dropped().length : drops.size],
    ['Walking speed', `${devSpeed}×`],
    ['Protocol', `v${PROTOCOL_VERSION}`],
    ...(({ calls, triangles, programs, geometries, textures, tier, pixelRatio }) => [
      ['Graphics', `${tier}, ${pixelRatio}× pixels`],
      ['Draw calls', calls.toLocaleString('en')],
      ['Triangles', triangles.toLocaleString('en')],
      ['Shaders', programs],
      ['Geometries, textures', `${geometries}, ${textures}`],
    ])(gfxStats.stats()),
  ],
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
// With a sword or the mallet in hand (WEAPONS in shared/level.js), E swings
// it at the nearest farmer in reach (turning to face them), and the lobby
// says who got bopped (BOPPED): they stumble back, and drop a little of what
// they gathered here (DROP), which anyone can walk into (PICKUP, PICKED). The
// bow shoots an arrow (one from the backpack) at the nearest farmer it is
// more or less pointed at, further off; everyone sees it fly (SHOT). Not in
// the stone circle where farmers arrive. Nobody gets hurt.
knock = first.knock = new THREE.Vector3(); // the stumble after a bop, added to walking while it fades
const drops = new Map(); // id -> { id, item, count, x, y, z, group, pending }
const lobbyNames = new Map(); // player id -> name (for "Ann bopped you")
const arrows = createArrows(scene);
const AIM = 0.5; // the bow picks a farmer this far from straight ahead at most (the cosine of it), and turns to them

const weaponInHand = () => (Object.hasOwn(WEAPONS, inventory.selectedId() ?? '') ? inventory.selectedId() : null);
// (in the arenas of games that say so, GAMES, empty hands shove: MINIGAMES.shove in shared/balance.js)
const shoving = () => !!arenaId && !!GAMES[partyGame?.kind]?.shove && !weaponInHand();
const bopWith = () => (shoving() ? 'shove' : weaponInHand());
const bopStats = (id) => (id === 'shove' ? MINIGAMES.shove : WEAPONS[id]);
const resting = (pos) => !arenaId && Math.hypot(pos.x - world.spawn.x, pos.z - world.spawn.z) < SAFE_CIRCLE;

// The nearest other farmer within reach (and not resting in the stone
// circle; for the bow, one it is more or less pointed at): { id, pos }, or null
function bopTarget() {
  const weapon = bopStats(bopWith());
  if (!weapon) return null;
  let best = null;
  let bestD = weapon.reach * 0.9; // (the lobby has a slightly older idea of where they are)
  const fx = Math.sin(anim.facing);
  const fz = Math.cos(anim.facing);
  for (const id of remotes.players.keys()) {
    const pos = remotes.positionOf(id);
    if (!pos || resting(pos) || Math.abs(pos.y - player.position.y) > (weapon.high ?? 1.2)) continue;
    const dx = pos.x - player.position.x;
    const dz = pos.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (weapon.aim && d > 0.4 && (dx * fx + dz * fz) / d < AIM) continue;
    if (d < bestD) {
      bestD = d;
      best = { id, pos };
    }
  }
  return best;
}

// Swing the weapon in hand (or shoot the bow): at the nearest farmer in reach, or at the air
function bop() {
  const id = bopWith();
  const now = clock.elapsedTime;
  if (!id || now < bopReady || anim.swing >= 0) return;
  if (resting(player.position)) return inventory.notify('The stone circle is for resting: no bopping here');
  const { shoots, every, reach } = bopStats(id);
  if (shoots && !inventory.count(shoots)) return inventory.notify('No arrows left: make some at a workbench, from wood and steel');
  const target = bopTarget();
  if (target) anim.facing = Math.atan2(target.pos.x - player.position.x, target.pos.z - player.position.z);
  farmer.swing();
  bopReady = now + every / 1000;
  if (shoots) {
    inventory.remove(shoots, 1);
    shootArrow(player.position, anim.facing, target?.pos ?? null, reach);
  }
  net?.send({ t: C.BOP, weapon: id, yaw: Math.round(anim.facing * 100) / 100 });
}

// An arrow flying from a farmer at `from` facing yaw: to `to` (a farmer's
// position), or `reach` on, at nobody
const arrowFrom = new THREE.Vector3();
const arrowTo = new THREE.Vector3();
function shootArrow(from, yaw, to, reach) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  arrowFrom.set(from.x + fx * 0.5, from.y + 0.25, from.z + fz * 0.5);
  if (to) arrowTo.set(to.x, to.y + 0.1, to.z);
  else arrowTo.set(arrowFrom.x + fx * reach, arrowFrom.y - 0.4, arrowFrom.z + fz * reach);
  arrows.shoot(arrowFrom, arrowTo);
}

// SHOT: someone else's arrow (ours flew as we shot it)
function shotFired(m) {
  if (m.by === myId) return;
  const from = remotes.positionOf(m.by);
  if (!from || !Number.isFinite(m.yaw)) return;
  remotes.swing(m.by);
  shootArrow(from, m.yaw, m.id === myId ? player.position : m.id ? remotes.positionOf(m.id) : null, WEAPONS.bow.reach);
}

function bopped(m) {
  if (m.by !== myId) remotes.swing(m.by);
  if (m.id === myId) {
    stopWalking();
    knock.set(m.dx * m.knock, 0, m.dz * m.knock);
    player.velocity.y = 5;
    player.onGround = false;
    anim.squash = -0.2;
    sound.play('bop');
    hud.flash('Bonk!');
    const [item, count] = m.drop ?? [];
    const lost = item ? Math.min(count, inventory.count(item)) : 0;
    if (lost) inventory.remove(item, lost);
    const who = lobbyNames.get(m.by) ?? 'Someone';
    inventory.notify(lost ? `${who} bopped you: you dropped ${lost} ${ITEMS[item].name.toLowerCase()}` : `${who} bopped you`);
  } else if (m.by === myId) {
    sound.play('bop');
    hud.flash('Bop!');
    // (only what they gathered on this visit can be knocked loose, never a rare find or coins)
    if (!m.drop) inventory.notify(`${lobbyNames.get(m.id) ?? 'They'} had nothing gathered here to drop`);
  }
}

// ---- What gets dropped: a little bobbing treasure, for anyone to walk into ----
// (in a lobby, or on a farm with helpers: its room keeps them. On our own
// farm, alone, what we drop is finds.js's)
function addDrop([id, item, count, x, y, z, from = 0, wait = 0]) {
  if (!ITEMS[item] || drops.has(id)) return;
  const group = new THREE.Group();
  group.position.set(x, y - GROUND_STAND_Y + 0.3, z);
  const gem = createItemMesh(item);
  gem.scale.setScalar(0.7);
  group.add(gem);
  group.visible = !arenaId; // (on the lobby's island: out of sight while we are in an arena)
  scene.add(group);
  // (knocked out of us, or dropped by us, or by a farmer at this screen: not
  // theirs to take straight back, and not till they have stepped off it, either)
  const ours = !!from && !!seatBy(from);
  drops.set(id, { id, item, count, x, y, z, group, from, pending: false, retryAt: ours ? performance.now() + wait : 0, away: !ours });
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

// What a room (a lobby's, or a farm's with helpers) says of its drops
function onDrops(on) {
  on(S.DROP, (m) => addDrop([m.id, m.item, m.count, m.x, m.y, m.z, m.from, m.wait]));
  on(S.PICKED, (m) => {
    removeDrop(m.id);
    const by = seatBy(m.by);
    if (by) within(by, () => inventory.add(m.item, m.count));
  });
  onOwnDrops(on);
}

// ...and what it says to a farmer alone of theirs
function onOwnDrops(on) {
  on(S.THROW_DENY, (m) => {
    if (!ITEMS[m.item] || !(m.count > 0)) return;
    inventory.notify(inventory.add(m.item, m.count) ? 'That couldn\'t be dropped here: it is back in your backpack' : 'That couldn\'t be dropped here, and your backpack is full');
  });
  on(S.DROP_DENY, (m) => {
    const drop = drops.get(m.id);
    if (drop) Object.assign(drop, { pending: false, retryAt: performance.now() + 500 });
  });
}

function updateDrops(dt, t) {
  for (const drop of drops.values()) {
    if (me === first) {
      // (once a frame, whoever is at the screen)
      const gem = drop.group.children[0];
      gem.position.y = Math.sin(t * 3 + drop.id) * 0.1;
      gem.rotation.y += dt * 2;
      drop.group.visible = !drop.pending;
    }
    const near = Math.hypot(drop.x - player.position.x, drop.y - player.position.y, drop.z - player.position.z) < TOUCH_RADIUS + 0.4;
    const theirs = !!drop.from && drop.from === seatId(); // (the farmer it came out of, not yet off it)
    if (theirs && !drop.away) drop.away = !near;
    if (!near || (theirs && !drop.away) || drop.pending || performance.now() < drop.retryAt || !inventory.canAdd(drop.item, drop.count) || farmVisit?.visitor) continue; // (a visitor leaves it be)
    drop.pending = true;
    (place === 'lobby' ? net : roomLine())?.send({ t: C.PICKUP, id: drop.id });
  }
}

// ---------- Player ----------
const newBody = () => ({
  radius: 0.5,
  height: 1.6,
  position: new THREE.Vector3(0, 2, 4),
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
});
player = first.player = newBody();
lastGoodSpot = first.lastGoodSpot = new THREE.Vector3().copy(player.position); // where the farmer last was, if a number ever goes bad (update)

// Ground level (top of the base ground box) is y = 0, so the player's
// resting height when standing on bare ground (GROUND_STAND_Y, shared/level.js)
// is half their collision height.

// ---------- Character model ----------
// The farmer (character.js). Collision still uses the simple box in `player`;
// the model is purely visual. Everyone else in the game wears the same model,
// in their own clothes and shirt color (remotes.js). A seat's farmer, its model's parts.
function makeFarmer(seat) {
  seat.farmer = createFarmer({ height: seat.player.height });
  seat.playerMesh = seat.farmer.root; // positioned at player.position (collision center)
  seat.hoeGroup = seat.farmer.hoe;
  seat.anim = seat.farmer.anim;
  scene.add(seat.playerMesh);
}
makeFarmer(first);
({ farmer, playerMesh, hoeGroup, anim } = first);

function animateCharacter(dt, moving) {
  if (lookYaw !== null) anim.facing = lookYaw; // (first person: the farmer faces where they look, standing or walking)
  farmer.animate(dt, {
    moving,
    onGround: player.onGround,
    targetYaw: lookYaw ?? Math.atan2(player.velocity.x, player.velocity.z),
    time: clock.elapsedTime,
  });
  lookWrote = lookYaw === null ? null : anim.facing;
}

function startHoeSwing() {
  farmer.swing();
}

camTarget.set(player.position.x, player.position.y - player.height / 2, player.position.z);
camGroundY = camTarget.y;

// First person (src/view.js): the camera is in the farmer's head, looking where
// lookYaw and lookPitch say; looking round turns the farmer too (their facing,
// which is what E farms in front of), and W is forward, not north.
const EYE_HEIGHT = 1.45; // above the feet
const LOOK_PITCH = 1.4; // radians, up or down at most
const LENS = { fov: 60, near: 0.5 }; // (from above)
const FIRST_LENS = { fov: 75, near: 0.2 }; // (nothing is closer than the farmer's radius to the eyes)
function setLens(first) {
  const { fov, near } = first ? FIRST_LENS : LENS;
  if (camera.fov === fov && camera.near === near) return;
  camera.fov = fov;
  camera.near = near;
  camera.updateProjectionMatrix();
}

// Looking in first person, or not: where the farmer looks as of now
function syncLook() {
  if (!viewMode.firstPerson() || place === 'title') return void (lookYaw = null);
  if (lookYaw === null) {
    lookPitch = 0;
    stopWalking(); // (tapping the ground to walk is for the view from above)
    held = null;
  }
  if (lookYaw === null || anim.facing !== lookWrote) lookYaw = anim.facing; // (and turned from outside: put down by a door, facing a tree to chop)
}

// Turn the view right and down by that many radians (the mouse, a finger, a stick)
function lookBy(right, down) {
  if (lookYaw === null || !Number.isFinite(right + down)) return;
  lookYaw -= right;
  lookPitch = THREE.MathUtils.clamp(lookPitch - down, -LOOK_PITCH, LOOK_PITCH);
}

function updateCamera(dt) {
  const feetY = player.position.y - player.height / 2;
  // Track the ground we last stood on; only chase the player downward if they
  // drop below it (falling off a ledge), so normal jumps don't move the view.
  if (player.onGround || feetY < camGroundY) camGroundY = feetY;

  setLens(lookYaw !== null);
  if (lookYaw !== null) {
    // (the follow point stays on the farmer, for the way back to the view from above)
    camTarget.set(player.position.x, feetY, player.position.z);
    const eyeY = feetY + EYE_HEIGHT;
    const flat = Math.cos(lookPitch);
    camera.position.set(player.position.x, eyeY, player.position.z);
    camera.lookAt(player.position.x + Math.sin(lookYaw) * flat, eyeY + Math.sin(lookPitch), player.position.z + Math.cos(lookYaw) * flat);
    return;
  }

  const kXZ = damp(CAM_FOLLOW_XZ, dt);
  camTarget.x += (player.position.x - camTarget.x) * kXZ;
  camTarget.z += (player.position.z - camTarget.z) * kXZ;
  camTarget.y += (camGroundY - camTarget.y) * damp(CAM_FOLLOW_Y, dt);
  if (![camTarget.x, camTarget.y, camTarget.z].every(Number.isFinite)) { // (nor following into nowhere: back on the farmer)
    camGroundY = feetY;
    camTarget.set(player.position.x, feetY, player.position.z);
  }

  camZoom += (zoomGoal() - camZoom) * damp(CAM_ZOOM_EASE, dt);
  if (!Number.isFinite(camZoom)) camZoom = zoomGoal(); // never leave the camera nowhere
  camOffset.copy(CAM_OFFSET).multiplyScalar(camZoom);
  camera.position.copy(camTarget).add(camOffset);
  camera.lookAt(camTarget);
}

// What the scene needs for a seat's view, just before it is drawn (draw):
// the fog and the shadows round where its camera looks. split: one of
// several views, which also each have their own light (down in a dungeon or
// not), rain and leaves in the air, and the night's glow round their farmer.
function lookFrom(split) {
  gfx.look(camera); // (the shaders' view: src/gfx/uniforms.js)
  if (place === 'title') return followSun(MENU_CAM.look, 0);
  if (split && place !== 'lobby') npcs.showSigns(npcs.signs(), player.position); // (the neighbours' signs: what they have for this farmer)
  for (const seat of seats) if (seat.nameTag) seat.nameTag.visible = seat !== me; // (the others' names: not your own)
  // Pushed back with the camera, so zooming out shows more island, not more fog
  // (underground, in a boss's dungeon, closer: the dark all round)
  const zoom = lookYaw !== null ? 1 : camZoom; // (in first person, there is no zooming out)
  scene.fog.near = THREE.MathUtils.lerp(FOG_NEAR, CAVE_FOG[0], underground) * Math.max(1, zoom);
  scene.fog.far = THREE.MathUtils.lerp(FOG_FAR, CAVE_FOG[1], underground) * Math.max(1, zoom);
  reachSun(zoom);
  if (split) {
    const cave = bosses.underground();
    const inside = indoors() || cave.k > 0.5;
    dayNight.view(player.position, cave.k, cave.light, inside);
    if (place !== 'lobby') seasons.relight();
    weather.place(player.position, inside);
    seasons.place(inside ? null : player.position);
    buildings.setNight(dayNight.night(), player.position);
    water.visible = cave.k < 0.5;
    playerMesh.add(dayNight.glow);
  }
  if (lookYaw === null) return followSun(camTarget, SUN_AHEAD * Math.max(1, camZoom));
  // (first person: the shadows' box reaches half its width ahead of where we look)
  followSun(_lookAhead.set(camera.position.x + Math.sin(lookYaw) * sunReach / 2, 0, camera.position.z + Math.cos(lookYaw) * sunReach / 2), 0);
}
const _lookAhead = new THREE.Vector3();
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
  lookYaw = null;
  setLens(false);
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
keys = first.keys = new Set(); // (each seat's own: what its farmer holds down)
// (a seat's menu, and the first seat's, the game's menu: splash.js; the title screen holds everyone up)
const menuOpen = () => inventory.isOpen() || shop.isOpen() || dialog.isOpen() || chest.isOpen() || workbench.isOpen() || arcade.isOpen() || cooking.isOpen() || trade.isOpen() || !!me.panel?.isOpen();
const inMenus = () => (me === first ? !splash.hidden : place === 'title') || menuOpen() || hud.isTyping(); // (the farmer's own keys aren't theirs: a controller moves its highlight)
const inputBlocked = () => inMenus() || partyFrozen();
window.addEventListener('keydown', (e) => {
  if (inputBlocked() || e.target.closest?.('input, textarea, select')) return; // (or a box being typed in: a farmer's login, at a split screen)
  keys.add(e.code);
  if (e.code === 'Space') jumpPressed = true;
  if (e.code === 'Space' && !e.repeat) {
    jumpTapped = true;
    jumpTappedAt = clock.elapsedTime;
  }
  if (e.code === 'KeyE' && !e.repeat) useAction();
  if (e.code === 'KeyM' && !e.repeat) inventory.notify(sound.toggle() ? 'Sound on' : 'Sound off');
  if (e.code === 'KeyV' && !e.repeat) inventory.notify(viewMode.toggle() ? 'First person' : 'Overhead view');
});

// E: in a lobby, chop the tree in reach with the axe in hand, else gather
// what is in reach. At home: trade at the merchant's counter, else harvest a
// ripe crop on the tile in front, otherwise use the selected toolbar item. Farming,
// chopping and mining reach USE_HEIGHT up or down (from a step or a platform).
function useAction() {
  if (place === 'home' && farmVisit?.visitor) return lookRound();
  if (!building && bosses.use()) return; // (a boss's portal or arena, or a mount in hand)
  if (place === 'lobby' && (!arenaId || (inContest() && partyGame.phase === 'playing')) && fishing.use()) return;
  if (place === 'lobby') {
    if (arenaId) return bopWith() && bop(); // (off in a party game's arena)
    if (weaponInHand() && (bopTarget() || !gatherSpotInReach())) return bop();
    if (holding() === 'axe' && swingAxe()) return;
    if (holding() === 'pickaxe' && swingPick()) return;
    const spot = gatherSpotInReach();
    if (spot) {
      takeSpot(spot);
      anim.squash = 0.15; // little crouch to pick
    } else if (ITEMS[inventory.selectedId()]?.dish) {
      eat();
    } else if (holding() === 'hoe' || ITEMS[inventory.selectedId()]?.plants) {
      inventory.notify('This is not your land: farm at home');
    }
    return;
  }
  if (building) return buildHere();
  if (useNpc()) return;
  if (fishing.use()) return;
  if (houseDoorInReach()) return goInside();
  if (houseRoom.exitInReach(player.position)) return goOutside();
  if (chest.inReach(player.position)) return chest.open();
  if (buildings.nearest('workbench', player.position, BENCH_REACH)) return workbench.open();
  if (buildings.nearest('arcade', player.position, BENCH_REACH)) return arcade.open();
  if (houseRoom.wardrobeInReach(player.position)) return openWardrobe();
  if (houseRoom.kitchenInReach(player.position) || houseRoom.shelfInReach(player.position)) return cooking.openKitchen();
  const machine = machines.nearest(player.position);
  if (machine) return useMachine(machine);
  if (atStall(player.position)) {
    shop.open();
    return;
  }
  if (ANIMAL_KINDS.includes(inventory.selectedId())) return letOutAnimal(inventory.selectedId());
  const animal = animals.inReach(player.position);
  if (animal) return tendAnimal(animal);
  if (holding() === 'axe' && swingAxe()) return;
  if (holding() === 'pickaxe' && swingPick()) return;
  if (ITEMS[inventory.selectedId()]?.dish && !crops.get(frontTile())?.ripe) return eat();
  const stalk = stalkUnderfoot(); // (up on a beanstalk's crown: its beans)
  if (stalk) return harvestAt(...keyXZ(stalk)) && sound.play('harvest');
  farmHere();
}

// Harvest the ripe crop on the tile at x, z (E: the one in front), else till
// or plant it with what is in hand
function tendAnimal(animal) {
  if (justLooking()) return;
  let asked = false; // (she was ready: milked or sheared, or the backpack was full)
  animals.tend(animal, player.position, (item) => ((asked = true), collectProduce(item)));
  const day = Math.floor(farmHours() / 24);
  if (!asked && pettedOn.get(animal) !== day) {
    pettedOn.set(animal, day);
    skills.gain('animals', SKILLS.xp.pet);
    npcs.did('pet'); // (Rosa likes to hear of it: shared/npcs.js)
  }
  anim.squash = 0.15;
}

// (in the house, just its field)
const offField = (tx, tz) => houseRoom.inside(player.position) && !inHouseField(...keyXZ(tileKeyFor(tx, tz)));
// Why the tile at x, z out on the farm isn't farmed ('': it is): in the lake,
// on a neighbour's place, in a neighbour's room, or out on the shore
function notFarmland(x, z) {
  if (place !== 'home' || houseRoom.inside(player.position)) return '';
  if (npcs.inside(player.position)) return 'Farm on your own land, not in a neighbour\'s house';
  const [gx, gz] = tileKeyFor(x, z).split(',').map(Number);
  if (Math.max(Math.abs(gx), Math.abs(gz)) > FARM_EDGE + 1) return 'Too close to the water';
  const blocked = farmBlocked(gx, gz);
  return blocked === 'lake' ? 'That\'s the lake' : blocked ? 'That\'s a neighbour\'s place: farm on your own land' : '';
}

// The tiles the hoe in hand tills from x, z: a better hoe more round it,
// `tills` [across, ahead] of the way the farmer faces (where there is room).
// (And the watering can's, `waters`.)
const hoeTiles = (x, z) => tilesAhead(x, z, ITEMS[inventory.selectedId()]?.tills);
const canTiles = (x, z) => tilesAhead(x, z, ITEMS[inventory.selectedId()]?.waters);
function tilesAhead(x, z, [wide, deep] = [1, 1]) {
  const sideways = Math.abs(Math.sin(anim.facing)) > Math.abs(Math.cos(anim.facing));
  const across = sideways ? [0, 1] : [1, 0];
  const ahead = sideways ? [Math.sign(Math.sin(anim.facing)), 0] : [0, Math.sign(Math.cos(anim.facing))];
  const span = (n) => Array.from({ length: n }, (_, i) => i - Math.floor(n / 2));
  const tiles = [];
  for (const j of span(deep)) for (const k of span(wide)) {
    const tx = x + (across[0] * k + ahead[0] * j) * TILE_SIZE;
    const tz = z + (across[1] * k + ahead[1] * j) * TILE_SIZE;
    if (!(k || j) || (!buildings.get(tileKeyFor(tx, tz)) && !inPen(tx, tz) && !offField(tx, tz) && !notFarmland(tx, tz))) tiles.push([tx, tz]);
  }
  return tiles;
}

function farmHere(x, z) {
  if (!footReach() || justLooking()) return;
  if (x === undefined) [x, z] = keyXZ(frontTile());
  if (harvestAt(x, z)) return sound.play('harvest');

  const held = inventory.selectedId();
  if (inPen(x, z) && (holding() === 'hoe' || ITEMS[held]?.plants)) {
    inventory.notify('That\'s the animals\' pen: farm outside the fence');
    return;
  }
  if (offField(x, z) && (holding() === 'hoe' || ITEMS[held]?.plants)) {
    inventory.notify('Farm in the field: the earth on the left');
    return;
  }
  if (notFarmland(x, z) && (holding() === 'hoe' || ITEMS[held]?.plants)) {
    inventory.notify(notFarmland(x, z));
    return;
  }
  if (holding() === 'can') {
    waterHere(x, z);
  } else if (holding() === 'hoe' && buildings.get(tileKeyFor(x, z))) {
    inventory.notify('Something is built here: take it down to till');
  } else if (holding() === 'hoe' && CROPS[crops.get(tileKeyFor(x, z))?.cropId]?.again) {
    uproot(tileKeyFor(x, z));
  } else if (holding() === 'hoe') {
    for (const [tx, tz] of hoeTiles(x, z)) {
      if (tillTileAt(tx, tz) && farmNet) {
        pendingTills.add(tileKeyFor(tx, tz));
        roomLine()?.send({ t: C.TILL, key: tileKeyFor(tx, tz) });
      }
    }
    startHoeSwing();
    sound.play('till');
  } else if (ITEMS[held]?.plants) {
    if (plantAt(x, z, ITEMS[held].plants)) {
      sound.play('plant');
      inventory.consumeSelected();
      skills.gain('farming', SKILLS.xp.plant);
      anim.squash = 0.15; // little crouch to plant
      if (farmNet) {
        const key = tileKeyFor(x, z);
        crops.get(key).pending = true; // (till the room says so; if it says no, the seed comes back)
        roomLine()?.send({ t: C.PLANT, key, crop: ITEMS[held].plants });
      }
    } else if (!farmTiles.has(tileKeyFor(x, z))) {
      inventory.notify('Seeds go on tilled soil');
    }
  }
}

// ---------- Watering ----------
// With a watering can in hand, E waters the crops in front (the big can's
// `waters`: a patch round it): watered, a crop grows the rest of the way
// WATERED_GROWTH times as fast, on dark wet soil till it's picked. On a farm
// with helpers the room keeps it (WATER; WATERED, or FARM_DENY: it isn't).
const needsWater = (key) => {
  const crop = crops.get(key);
  return !!crop && !crop.ripe && !crop.watered && !crop.pending;
};

function waterHere(x, z) {
  const keys = canTiles(x, z).map(([tx, tz]) => tileKeyFor(tx, tz)).filter(needsWater);
  if (!keys.length) {
    const crop = crops.get(tileKeyFor(x, z));
    inventory.notify(crop?.watered ? 'Watered already: it\'s growing as fast as it can' : 'Water what you planted: seeds on tilled soil');
    return;
  }
  farmer.swing();
  sound.play('water');
  for (const key of keys) {
    markWatered(key);
    const at = farmTiles.get(key).position;
    ripples.splash(at.x, at.y + 0.05, at.z, 5);
    roomLine()?.send({ t: C.WATER, key });
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
    if (target && !resting(player.position)) return `${bopStats(bopWith()).shoots ? 'Shoot at' : 'Bop'} ${lobbyNames.get(target.id) ?? 'them'}`;
  }
  const tree = holding() === 'axe' ? treeInReach() : null;
  if (tree) return chopPrompt(tree);
  const rock = holding() === 'pickaxe' ? rockInReach() : null;
  if (rock) return minePrompt(rock);
  if (place === 'lobby') {
    const near = gatherSpotInReach();
    return near && !(near.kind === 'sky_vault' && !inventory.count('key')) ? GATHER_VERB[near.kind] : eatHint();
  }
  const top = stalkUnderfoot(); // (up on a beanstalk's crown, or a cloud cotton)
  if (top) return `Pick the ${ITEMS[CROPS[crops.get(top).cropId].produce].name.toLowerCase()}`;
  if (!footReach()) return eatHint();
  const [x, z] = keyXZ(frontTile());
  const key = tileKeyFor(x, z);
  const crop = crops.get(key);
  if (crop?.ripe && CROPS[crop.cropId].produce) return crop.pending || CROPS[crop.cropId].climb ? '' : `Harvest ${ITEMS[CROPS[crop.cropId].produce].name.toLowerCase()}`; // (a beanstalk's from the top)
  const held = inventory.selectedId();
  if (inPen(x, z) || offField(x, z) || notFarmland(x, z)) return '';
  if (holding() === 'can') return canTiles(x, z).some(([tx, tz]) => needsWater(tileKeyFor(tx, tz))) ? 'Water' : '';
  if (holding() === 'hoe' && crop && CROPS[crop.cropId].again) return crop.pending ? '' : `Dig up the ${CROPS[crop.cropId].name}`;
  if (holding() === 'hoe') return !buildings.get(key) && hoeTiles(x, z).some(([tx, tz]) => !farmTiles.has(tileKeyFor(tx, tz))) ? 'Till' : '';
  if (ITEMS[held]?.plants && farmTiles.has(key) && !crops.has(key)) return `Plant ${ITEMS[held].name.toLowerCase()}`;
  return eatHint();
}

// With a dish in hand: E eats it
const eatHint = () => (ITEMS[inventory.selectedId()]?.dish ? `Eat ${ITEMS[inventory.selectedId()].name.toLowerCase()}` : '');
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  // let go of Jump on the way up: a lower jump
  if (e.code === 'Space' && jumpRising && player.velocity.y > 0) player.velocity.y *= JUMP_CUT;
  if (e.code === 'Space') jumpRising = false;
});

window.addEventListener('resize', () => layout());

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
  player.velocity.y = JUMP_SPEED * boostOf(meal, 'jump') * (arenaId ? 1 : bosses.jump()); // (after a meal, or riding, maybe higher: not in a party game's arena)
  player.onGround = false;
  anim.squash = -0.2; // stretch on takeoff
  jumpRising = true;
  jumpTappedAt = -Infinity;
  sound.play('jump');
}

// Just off a ledge you can still jump for a moment (COYOTE_TIME), and with
// the double jump unlocked (skills.js) once more in the air, off a puff of air.
// Jump pressed just before landing still jumps as the farmer lands
// (JUMP_BUFFER), and letting go of it on the way up jumps lower (JUMP_CUT).
const COYOTE_TIME = 0.1; // seconds
const JUMP_BUFFER = 0.12; // seconds
const JUMP_CUT = 0.5; // what is left of the speed up when Jump is let go early
const STEP_EVERY = 0.32; // seconds between footsteps at a walk
const puffs = createPuffs(scene);

// With a glider leaf in the backpack (made at the workbench), Jump held on
// the way down opens it over the farmer's head, and they float down no
// faster than GLIDE.fall (src/glider.js draws it)
glider = first.glider = createGlider(farmer);

function airJump() {
  airJumps--;
  player.velocity.y = DOUBLE_JUMP.speed;
  anim.squash = -0.25;
  jumpRising = true;
  jumpTappedAt = -Infinity;
  sound.play('airJump');
  puffs.puff(new THREE.Vector3(player.position.x, player.position.y - player.height / 2, player.position.z));
}

// ---------- Collision helpers ----------
// Very simple AABB-vs-capsule (treated as a box) resolution, axis by axis.
// Walking into a ledge no higher than STEP_HEIGHT steps up onto it (out of the
// wild island's pond, say); anything taller takes a jump.
const STEP_HEIGHT = 0.5;
function resolveCollisions(prevY, wasOnGround) {
  player.onGround = false;
  player.standingOn = null; // (the ledge under us, landed on)
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
        player.standingOn = box;
        continue;
      }
      if (box.oneWay) continue; // (solid only from above: cloud cotton)

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

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
// The ray from the seat's camera through x, y on the screen (in its part of it)
function aimAt(x, y) {
  const { rect } = me;
  _ndc.set(((x - rect.x) / rect.w) * 2 - 1, -((y - rect.y) / rect.h) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
}
// Is x, y on the screen in the seat's own part of it?
const onMyScreen = (x, y) => x >= me.rect.x && x < me.rect.x + me.rect.w && y >= me.rect.y && y < me.rect.y + me.rect.h;

// The tile marker: a square outline on the tile being walked to (each seat's own)
function newMarker() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.67, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })
  );
  ring.visible = false;
  scene.add(ring);
  return ring;
}
marker = first.marker = newMarker();

// The tile cursor: at home with the hoe or seeds in hand, standing still, a
// faint square on the tile in front, the one E farms (see updateTileCursor)
function newTileCursor() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.64, 0.7, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.5, depthWrite: false })
  );
  ring.visible = false;
  scene.add(ring);
  return ring;
}
tileCursor = first.tileCursor = newTileCursor();

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
const hoverMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
const hoverTile = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), hoverMat);
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 32).rotateX(-Math.PI / 2), hoverMat);
hoverTile.visible = hoverRing.visible = false;
scene.add(hoverTile, hoverRing);
canvas.addEventListener('pointermove', (e) => (hoverAt = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null));
canvas.addEventListener('pointerleave', () => (hoverAt = null));

const _base = new THREE.Vector3();
function updateHover() {
  if (me !== first) return; // (the mouse is the first seat's)
  hoverTile.visible = hoverRing.visible = false;
  if (!hoverAt || held || building || lookYaw !== null || place === 'title' || inputBlocked() || !onMyScreen(hoverAt.x, hoverAt.y)) return;
  aimAt(hoverAt.x, hoverAt.y);
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
  if (e.pointerType === 'mouse' && e.button === 0 && place !== 'title' && !building && lookYaw === null && !inputBlocked() && onMyScreen(e.clientX, e.clientY)) {
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
  looks.delete(e.pointerId);
  presses.delete(e.pointerId);
  pinch.delete(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId === held?.id) held = null;
  if (e.pointerType === 'mouse' && e.button === 0 && mouseUsing) letGoUse();
  looks.delete(e.pointerId);
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
  if (place === 'title' || inputBlocked() || !onMyScreen(e.clientX, e.clientY)) return;
  const lines = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  if (lookYaw !== null) { // (first person: no zooming, the toolbar instead, a notch at a time)
    wheeled += lines;
    if (Math.abs(wheeled) >= 50) {
      inventory.cycle(Math.sign(wheeled));
      wheeled = 0;
    }
    return;
  }
  zoomBy(Math.exp(THREE.MathUtils.clamp(lines, -100, 100) * 0.002));
}, { passive: false });
let wheeled = 0;

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
  if (pinchGap > 0 && gap > 0 && place !== 'title' && lookYaw === null && !inputBlocked()) zoomBy(pinchGap / gap);
  pinchGap = gap;
});

// Looking round in first person. The mouse is captured by a click on the game
// (Esc gives it back, and opens the menu, as it always does); a finger on the
// screen turns the view too, and a controller's right stick (gamepad.js).
// With the mouse not captured (the browser said no), dragging looks round.
const MOUSE_LOOK = 0.0025; // radians a pixel
const TOUCH_LOOK = 0.005;
const looks = new Map(); // pointerId -> where a finger that looks round is
let mouseUsing = false; // a click is holding E
const mouseLocked = () => document.pointerLockElement === canvas;
function letGoUse() {
  mouseUsing = false;
  keys.delete('KeyE');
}
canvas.addEventListener('pointerdown', (e) => {
  if (lookYaw === null || place === 'title' || inputBlocked() || !onMyScreen(e.clientX, e.clientY)) return;
  if (e.pointerType === 'touch') return void looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  if (!mouseLocked()) return void canvas.requestPointerLock?.()?.catch?.(() => {}); // (this click only takes the mouse)
  mouseUsing = true; // a click is E: use, and hold to keep on
  keys.add('KeyE');
  useAction();
});
canvas.addEventListener('pointermove', (e) => {
  if (lookYaw === null || inputBlocked()) return;
  const clamp = (n) => THREE.MathUtils.clamp(n, -200, 200); // (some browsers jump the mouse a long way as they take it)
  if (e.pointerType === 'mouse') {
    if (mouseLocked() || e.buttons & 1) lookBy(clamp(e.movementX) * MOUSE_LOOK, clamp(e.movementY) * MOUSE_LOOK);
  } else if (looks.has(e.pointerId) && pinch.size < 2) {
    const finger = looks.get(e.pointerId);
    lookBy((e.clientX - finger.x) * TOUCH_LOOK, (e.clientY - finger.y) * TOUCH_LOOK);
    finger.x = e.clientX;
    finger.y = e.clientY;
  }
});
// Esc, or the mouse taken another way (another window), while looking round: the menu
document.addEventListener('pointerlockchange', () => {
  if (mouseLocked()) return;
  if (mouseUsing) letGoUse();
  if (!viewMode.firstPerson() || place === 'title' || within(first, inMenus)) return;
  splash.show();
});

function tapAt(x, y) {
  if (!onMyScreen(x, y) || lookYaw !== null) return; // (another farmer's part of a split screen; or in first person, where a finger looks round)
  aimAt(x, y);
  stopWalking();
  if (building) return tapToBuild();
  const target = tappedThing() ?? tappedGround();
  if (!target) return;
  const built = target.kind === 'tile' && buildings.get(tileKeyFor(target.x, target.z));
  if (built === 'workbench' || built === 'arcade') target.kind = built;
  if (target.kind === 'tile' && isMachine(buildings.get(tileKeyFor(target.x, target.z)))) Object.assign(target, { kind: 'machine', key: buildings.anchor(tileKeyFor(target.x, target.z)) });
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
    things.set(houseRoom.kitchen, { kind: 'kitchen', ...houseRoom.kitchenSpot() });
    things.set(houseRoom.wardrobe, { kind: 'wardrobe', ...houseRoom.wardrobeSpot() });
    things.set(merchant.root, stall);
    things.set(world.root.getObjectByName('stall'), stall);
    // the neighbours (to talk to), their homes (to go in) and their rooms' doors (to come out)
    for (const [id, root] of npcs.roots()) if (!npcs.asleep(id)) things.set(root, { kind: 'npc', id, x: root.position.x, z: root.position.z });
    for (const [id, home] of Object.entries(npcHomes.outside)) {
      const at = npcs.outside(id);
      things.set(home, { kind: 'npcdoor', id, x: at.x, z: at.z - 0.3 });
    }
    for (const [id, room] of Object.entries(npcHomes.rooms)) things.set(room.door, { kind: 'npcexit', id, x: room.exit.x, z: room.exit.z - 0.3 });
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
    case 'npc': return npcs.talkable(player.position) === walk.id;
    case 'npcdoor': return npcs.doorInReach(player.position) === walk.id;
    case 'npcexit': return npcs.exitInReach(player.position) === walk.id;
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
    case 'machine': return machines.nearest(player.position) === walk.key;
    case 'kitchen': return houseRoom.kitchenInReach(player.position);
    case 'wardrobe': return houseRoom.wardrobeInReach(player.position);
    default: return d < ARRIVE;
  }
}

// Then do what the tap was for
function arrive() {
  const { kind, farm, spot, tree, rock, animal, key, x, z, id: walk_id } = walk;
  stopWalking();
  if (['build', 'workbench', 'machine', 'chest', 'animal', 'tree', 'rock'].includes(kind) || (kind === 'tile' && farm)) {
    if (justLooking()) return; // (a visitor)
  }
  if (kind === 'build') {
    if (building) buildAt(key);
  } else if (kind === 'workbench') workbench.open();
  else if (kind === 'arcade') arcade.open();
  else if (kind === 'machine') useMachine(key);
  else if (kind === 'kitchen') cooking.openKitchen();
  else if (kind === 'wardrobe') openWardrobe();
  else if (kind === 'stall') shop.open();
  else if (kind === 'npc') dialog.open(walk_id);
  else if (kind === 'npcdoor') goIntoHome(walk_id);
  else if (kind === 'npcexit') goOutOfHome(walk_id);
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

// ---------- Visiting a friend's farm ----------
// A friend come to look round (not a helper: server/farmroom.js lets them in
// as a visitor) farms nothing here: no tilling, planting or picking, no
// building, chopping or mining, nothing in or out of the chest, the machines
// or the workbench, nothing done for the animals, no bosses. They walk about,
// go in the house, fish, eat what they brought, trade with the merchant, play
// at the arcade and cook in the kitchen (with their own things).
function justLooking() {
  if (!(place === 'home' && farmVisit?.visitor)) return false;
  inventory.notify(`Just looking round: only ${farmVisit.owner || 'the farmer'} and their helpers farm here`);
  return true;
}

// E, looking round
function lookRound() {
  if (useNpc()) return;
  if (fishing.use()) return;
  if (houseDoorInReach()) return goInside();
  if (houseRoom.exitInReach(player.position)) return goOutside();
  if (buildings.nearest('arcade', player.position, BENCH_REACH)) return arcade.open();
  if (houseRoom.kitchenInReach(player.position) || houseRoom.shelfInReach(player.position)) return cooking.openKitchen();
  if (atStall(player.position)) return shop.open();
  if (ITEMS[inventory.selectedId()]?.dish) return eat();
  justLooking();
}

// What E does for a visitor, for the prompt
function lookRoundPrompt() {
  const npc = npcPrompt();
  if (npc) return npc;
  const fish = fishing.prompt();
  if (fish) return fish;
  if (houseDoorInReach()) return 'E  Go inside';
  if (houseRoom.exitInReach(player.position)) return 'E  Go outside';
  if (buildings.nearest('arcade', player.position, BENCH_REACH)) return 'E  Play at the arcade';
  if (houseRoom.kitchenInReach(player.position)) return 'E  Cook in the kitchen';
  if (atStall(player.position)) return 'E  Trade with the merchant';
  return eatHint() ? `E  ${eatHint()}` : '';
}

// Holding the left mouse button down walks toward wherever it points, for as
// long as it is held: the farmer heads for the spot on the ground (at their
// own feet' height) under the mouse, every frame, so the mouse steers. Let go
// quickly and it was a click after all (above).
const _feet = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const FOLLOW_CLOSE = 0.3; // the mouse this close to the farmer: stand still

function followMouse(dt) {
  aimAt(held.x, held.y);
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
  if (walk.kind === 'npc') ({ x: walk.x, z: walk.z } = npcs.roots().find(([id]) => id === walk.id)[1].position); // (so might they)
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
  // (right on the spot but not there, e.g. standing on top of the rock tapped, too high to reach it: nowhere to go, and dividing by 0 would lose the farmer)
  const k = d > 1e-6 ? Math.min(1, d / (MOVE_SPEED * dt)) / d : 0;
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
buildings.addLamps(npcHomes.lamps); // (the neighbours' lanterns light the ground round them at night too)

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
const FARM_EDGE = HOME_HALF - 3; // tiles out to here (the farm's room allows one more)
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
  buildings.preview(null, null, false, me.index);
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
  if (mouseAt && lookYaw === null) {
    aimAt(mouseAt.x, mouseAt.y);
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
  if (farmersHere().some((seat) => seat !== me && near(seat.player.position))) return 'someone'; // (another farmer at the screen)
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
  if (indoors()) return 'Build outside the house';
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
  if (farmBlocked(gx, gz)) return farmBlocked(gx, gz) === 'lake' ? 'That\'s the lake' : 'That\'s a neighbour\'s place: build on your own land';
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
      roomLine()?.send({ t: C.UNBUILD, key }); // (the room says which piece that was)
    } else {
      const at = buildings.anchor(key);
      giveBack(buildings.remove(key));
      if (at) giveItems(machines.removed(at, farmHours())); // (what was in a machine)
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
  if (!farmNet) machines.built(key, building, farmHours()); // (a beehive gets going: on a farm with helpers, the room says)
  placeChest();
  if (farmNet) {
    // (the room takes the chest's share, and says what is left in it)
    pendingBuilds.set(key, carried);
    roomLine()?.send({ t: C.BUILD, key, piece: building, ...(Object.keys(fromChest).length && { chest: fromChest }) });
  }
  return true;
}

const buildHere = () => buildAt(buildTarget());

// What a piece cost, back into the backpack (paid: just what came out of it)
function giveBack(piece, paid = PIECES[piece]?.cost ?? {}) {
  giveItems(paid);
}
const giveItems = (items) => {
  for (const [item, n] of Object.entries(items ?? {})) if (n) gift(item, n);
};

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
  if (building && e.pointerType === 'mouse' && lookYaw === null) mouseAt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => (mouseAt = null));
const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => WALK_KEYS.has(e.code) && (mouseAt = null));

// Each frame in build mode: the see-through piece, holding E, the build bar.
// Returns the prompt.
function updateBuilding() {
  const key = buildTarget();
  const problem = buildProblemAt(key);
  buildings.preview(key, building, !problem, me.index);
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
// ...the page's own. A farmer at a split screen has a line of their own to our farm's room (seat.room)
// The line to the farm's room for the farmer the code works for now
function roomLine() {
  return (me === first ? farmNet : me.room) ?? null;
}
let farmVisit = null; // on a farm's room: { id, name, owner, mine, alone, helpers }
let farmJoining = 0; // (each joinFarm's number: a newer one wins)
const pendingTills = new Set(); // tiles we tilled that the farm's room hasn't said yes to yet
const visiting = () => !!farmVisit && !farmVisit.mine; // on a friend's farm
let session = null; // { code, seed, room, wilds, boardAt } once a lobby has welcomed us (room.game: the party game it is for)
let myId = 0;
let partyGame = null; // the lobby's party game as it last said (shared/minigame.js wire()), or null
let arenaId = 0; // the party game whose arena we are in (0: on the lobby's island)
let lastFarm = null; // the friend's farm we were on before the lobby (its id; null: our own), to go back to after its game
let lobbyRoster = []; // (as the lobby last sent it: remotes shows those where we are)
let farmOnScreen = false; // the home farm's soil and crops are in the scene
// (a lobby's day starts mid-morning, in good light: LOBBY_DAWN, shared/giants.js)

const remotes = new Remotes(scene, { waterFrom });
touch = first.touch = new TouchControls({ parent: first.root }); // (only shown on a touch screen; the first seat's)
// (the seats after it: no touch screen)
const NO_TOUCH = { direction: () => ({ x: 0, z: 0 }), setReady() {}, setBite() {}, setPlace() {} };
// A controller plays as the keyboard does; in a menu it moves a highlight about
// (gamepad.js). Each seat reads its own (pickPad).
const newPad = (seat) => new GamepadInput({
  ...forSeat(seat, {
    inMenu: () => inMenus(),
    onCycle: (dir) => inventory.cycle(dir),
    onZoom: (factor) => zoomBy(factor),
    looking: () => lookYaw !== null,
    onLook: (right, down) => lookBy(right, down),
    onConnect: () => seat === first && seats.length === 1 && inventory.notify('Controller ready: A jump, X use, Y backpack, Menu for the menu'),
  }),
  choosePad: (pads) => pickPad(seat, pads),
  root: seat.root,
  keyboard: seat === first,
});
pad = first.pad = newPad(first);

// The water at x, z, to fish in: { water, y } (which FISHING table, and its
// surface), or null: land. In a lobby, its sea and its pond; on a farm, the
// sea past its edge and a fish pond built on it.
function waterAt(x, z) {
  if (inContest()) {
    const arena = arenaFor(partyGame.kind, partyGame.seed);
    return arena && !arena.isLand(x, z) ? { water: 'contest', y: WATER_Y } : null;
  }
  if (place === 'lobby') {
    const what = wildIsland && waterOn(wildIsland, x, z);
    return what && { water: 'lobby', y: what === 'sea' ? WATER_Y : LOBBY_POND_Y };
  }
  if (Math.max(Math.abs(x), Math.abs(z)) > HOME_HALF + 0.5) return { water: 'sea', y: WATER_Y };
  if (inLake(x, z)) return { water: 'pond', y: LOBBY_POND_Y }; // (the valley's lake: a pond's fish, shared/fishing.js)
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
// The HUD (src/ui/hud.js): each seat's, in its part of the screen. The first
// seat's has the game's menu (splash.js); another's, its own (src/ui/seatpanel.js).
const newHud = (seat) => new Hud({
  ...forSeat(seat, seat === first ? {
    onTravel: () => splash.show({ page: 'online' }),
    onMenu: () => splash.show(),
    isMenuOpen: () => !splash.hidden,
    onMenuEscape: () => splash.escape(),
    onHome: () => goHome(),
    onChat: (text) => (place === 'lobby' ? net : roomLine())?.send({ t: C.CHAT, text }),
    isBlocked: () => menuOpen() || !splash.hidden,
    onPrompt: (text) => touch.setReady(!!text),
    onStopBuilding: () => stopBuilding(),
    onTrade: (id) => askTrade(id),
  } : {
    onTravel: () => inventory.notify(`Only ${seatName(first)} can head online from here`),
    onMenu: () => seat.panel.openMenu(seatName(seat)),
    isMenuOpen: () => seat.panel.isOpen(),
    onMenuEscape: () => seat.panel.escape(),
    onHome: () => {},
    onChat: () => {},
    isBlocked: () => menuOpen(),
    onPrompt: () => {},
    onStopBuilding: () => stopBuilding(),
    onTrade: () => {},
  }),
  parent: seat.root,
  active: () => me === seat,
  usesPad: seat === first ? padInUse : () => true,
});
hud = first.hud = newHud(first);

// A new farmer's first steps, ticked off as they're done (src/ui/guide.js; the first seat's)
guide = first.guide = new Guide({ parent: hud.root, anchor: hud.panel });
const NO_GUIDE = { update() {} };
const guideState = () => ({
  place: place === 'home' && farmVisit ? 'farm' : place,
  tilled: farmVisit ? 0 : farmTiles.size,
  planted: farmVisit ? 0 : crops.size,
  produce: Object.values(CROPS).reduce((n, crop) => n + inventory.count(crop.produce), 0),
  gold: inventory.gold(),
  seasoned: inventory.gold() > 0 || skills.overall() > SKILL_LIST.length,
});

// ---------- Fishing ----------
// With a rod in hand, E facing the sea or a pond casts (src/fishing.js; in
// a lobby the room rolls the catch, on a farm the page does). What we land
// goes in the fishing journal (fishlog.js, the bag's Fish tab), kept in the
// save beside the backpack. Fish swim about under the water near us
// (fishshadows.js), coming up now and then with a ripple (ripples.js). In a
// lobby's fishing contest everyone fishes, a rod lent to anyone without one.
fishLog = first.fishLog = createFishLog();
// What we have ever had, for the collection book (book.js, the bag's Book
// tab): saved with the backpack
const newBook = (seat) => createBook({ fishLog: seat.fishLog, beaten: seated(seat, () => Object.keys(bosses.record().won).filter((id) => bosses.record().won[id] > 0)) });
book = first.book = newBook(first);
const ripples = createRipples(scene);
const inContest = () => place === 'lobby' && !!arenaId && partyGame?.kind === 'fishing_contest';
// (each seat's own line and bobber)
const newFishing = (seat) => createFishing({
  scene, ripples, farmer: seat.farmer, player: seat.player, inventory: seat.inventory, hud: seat.hud, touch: seat.touch,
  ...forSeat(seat, {
    waterAhead: () => (player.onGround && !menuOpen() && !indoors() ? waterFrom(player.position.x, player.position.z, anim.facing) : null),
    hour: () => dayNight.hour(),
    lobby: () => (place === 'lobby' ? net : null),
    rodInHand: () => (holding() === 'rod' ? inventory.selectedId() : inContest() && !weaponInHand() ? 'fishing_rod' : null),
    skill: () => skills.level('fishing'),
    landed(item, grams) {
      skills.gain('fishing', SKILLS.xp.fish);
      if (isFish(item)) npcs.did('fish'); // (and Finn: shared/npcs.js)
      return fishLog.landed(item, grams);
    },
    sooner: () => boostOf(meal, 'bite'),
  }),
});
fishing = first.fishing = newFishing(first);
// (round the first seat's farmer)
const fishShadows = createFishShadows({ scene, ripples, player: { get position() { return first.player.position; } }, regions: fishRegions });

// Where the fish under the water swim now (fishshadows.js): along the shore
// of the island we are on (near us), and in its ponds
function fishRegions() {
  if (place === 'title' || indoors() || bosses.inArena()) return [];
  const near = (inside, y) => ({
    inside,
    y,
    near: true,
    sample(around) {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 4 + Math.random() * 14;
        const x = around.x + Math.cos(a) * d;
        const z = around.z + Math.sin(a) * d;
        if (inside(x, z)) return [x, z];
      }
      return null;
    },
  });
  const inBox = (cx, cz, hw, hd) => (x, z) => Math.abs(x - cx) < hw && Math.abs(z - cz) < hd;
  const boxRegion = (key, cx, cz, hw, hd, y, n) => ({
    key, inside: inBox(cx, cz, hw, hd), y, n,
    sample: () => [cx + (Math.random() * 2 - 1) * hw * 0.8, cz + (Math.random() * 2 - 1) * hd * 0.8],
  });
  // the shallows: sea, with land within a few steps
  const shore = (isLand) => (x, z) => !isLand(x, z) && [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dz]) => isLand(x + dx, z + dz));
  if (place === 'lobby' && arenaId) {
    const arena = partyGame && arenaFor(partyGame.kind, partyGame.seed);
    return arena ? [{ key: `arena:${arena.seed}`, n: 12, ...near(shore(arena.isLand), WATER_Y) }] : [];
  }
  if (place === 'lobby') {
    const island = wildIsland; // (this one, even once we are off it)
    if (!island) return [];
    const { pond } = island;
    const inside = (x, z) => [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].every(([dx, dz]) => island.inPond(x + dx, z + dz));
    return [
      { key: `sea:${island.seed}`, n: 8, ...near(shore(island.isLand), WATER_Y) },
      { key: `pond:${island.seed}`, inside, y: LOBBY_POND_Y, n: 4, sample: () => [pond.x + (Math.random() - 0.5) * pond.r, pond.z + (Math.random() - 0.5) * pond.r] },
    ];
  }
  // the farm: the sea along its edge, and each fish pond built on it
  const edge = (x, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    return m > HOME_HALF + 0.8 && m < HOME_HALF + 4;
  };
  const lake = (x, z) => [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].every(([dx, dz]) => inLake(x + dx, z + dz));
  const list = [{ key: 'farm-sea', n: 6, ...near(edge, WATER_Y) }, { key: 'farm-lake', n: 4, ...near(lake, LOBBY_POND_Y) }];
  for (const [key, piece] of buildings.list()) {
    if (piece !== 'pond') continue;
    const [px, pz] = keyXZ(key);
    list.push(boxRegion(`pond:${key}`, px, pz - 1, 1, 1, POND_WATER_Y, 2));
  }
  return list;
}

// ---------- The bosses ----------
// Their portals on the farm, their arenas out past the sea, the fights and
// what they give (bosses.js; shared/bosses.js has the rules). The farm's
// bosses and dungeons are one (bossWorld); each seat has its part of them
// (`bosses`: what happens to its farmer, what they have won).
const bossWorld = createBosses({
  world: worlds.home,
  giantBars,
  buildings,
  net: () => roomLine(),
  atHome: () => place === 'home',
  day: () => dayNight.day(),
  // (another farmer's arrow)
  shotFrom(by, to) {
    const from = remotes.positionOf(by);
    if (from) arrows.shoot(arrowFrom.set(from.x, from.y + 0.25, from.z), to);
  },
  // (played alone, a beaten boss's portal goes: its key pieces are used up)
  removePortal(boss) {
    const key = buildings.find(portalOf(boss));
    if (!key) return;
    buildings.remove(key);
    placeChest();
  },
});
const newBosses = (seat) => ({
  ...bossWorld,
  ...bossWorld.seat({
    player: seat.player,
    farmer: seat.farmer,
    inventory: seat.inventory,
    hud: seat.hud,
    present: () => seat === first || !!seat.profile,
    ...forSeat(seat, {
      id: () => seatId(), // (a fight or a dungeon's chests remember it)
      weapon: () => weaponInHand(),
      // (a bow's arrow at the boss)
      shoot: (to) => arrows.shoot(arrowFrom.set(player.position.x + Math.sin(anim.facing) * 0.5, player.position.y + 0.25, player.position.z + Math.cos(anim.facing) * 0.5), to),
      putDown,
      arrival: () => arrival(),
      knock(dx, dz, speed) {
        stopWalking();
        knock.set(dx * speed, 0, dz * speed);
        player.velocity.y = 5;
        player.onGround = false;
        anim.squash = -0.2;
      },
      // (their own farm: for a farmer who joined at the screen, not this one)
      farmIsOurs: () => seat === first && place === 'home' && farmOnScreen && (!farmVisit || farmVisit.mine),
      addShiny: (kind) => !!animals.addShiny(kind),
      save: () => saveGame(),
    }),
  }),
});
bosses = first.bosses = newBosses(first);
// (after the HUD: its key handler goes first, see shop.js). The merchant
// asks for something each game day (requests.js), handed over at the stall.
const newShop = (seat) => createShop({
  inventory: seat.inventory,
  requests: createRequests({ day: () => dayNight.day(), inventory: seat.inventory, store: seat === first ? undefined : () => `tp.request.${seat.profile?.id}` }),
  ...forSeat(seat, {
    parent: seat.root,
    active: () => me === seat,
    onOpenChange: (open) => (open ? keys.clear() : saveGame()), // a trade is saved as soon as you walk off
    known: (id) => !!ITEMS[id]?.recipe && learned.has(ITEMS[id].recipe), // (a recipe in the book already)
  }),
});
shop = first.shop = newShop(first);

// ---------- The neighbours ----------
// Rosa, Basil, Finn and Mabel (shared/npcs.js), in and about their homes out
// in the valley (src/npcs.js, src/npchomes.js), on the farm's world. E (or a
// tap) at one talks to them (src/dialog.js): a chat, their shop (once you
// have done what opens it) and what they would like you to do. E at their
// door goes in (their room is out past the sea, as the house's is), and E at
// the door inside comes back out. Where you stand with them is yours, saved
// with your backpack: each seat's own (`npcs`, the neighbours with where its
// farmer stands with them; the first seat's, the farm's, is what shows of
// their homes and yards).
const npcWorld = createNpcs({ parent: worlds.home.root });
const newNpcs = (seat) => ({
  ...npcWorld,
  ...npcWorld.standing({ inventory: seat.inventory, ctx: seated(seat, () => missionCtx()), onMends: () => showMends(), story: seat === first }),
});
// Finn's dock is mended if it is for anyone at the screen
const showMends = () => npcHomes.dock.mend(seats.some((seat) => seat.npcs?.mended()));
npcs = first.npcs = newNpcs(first);
const missionCtx = () => ({
  have: (item) => inventory.count(item),
  built: (piece) => (place === 'home' && !(farmVisit && !farmVisit.mine) ? buildings.findAll(piece).length : 0), // (not what stands on a friend's farm we are visiting)
});
const newDialog = (seat) => createDialog({
  npcs: seat.npcs,
  ...forSeat(seat, {
    parent: seat.root,
    active: () => me === seat,
    day: () => dayNight.day(),
    hour: () => dayNight.hour(),
    ctx: missionCtx,
    onShop: (id) => openNpcShop(id),
    onOpenChange: (open) => (open ? keys.clear() : saveGame()),
    notify: (text) => inventory.notify(text),
    onDone: ({ mission, gold, items }) => {
      sound.play('cheer');
      hud.flash(`${NPCS[mission.npc].name}: ${mission.title}!`);
      const got = [gold && `${gold}g`, ...items.map(([item, n]) => `${n > 1 ? `${n} × ` : ''}${ITEMS[item].name}`)].filter(Boolean);
      if (got.length) inventory.notify(`From ${NPCS[mission.npc].name}: ${got.join(', ')}`);
      if (mission.gives.opens === 'shop') inventory.notify(`${NPCS[mission.npc].title} is open to you now`);
      readyNoted.delete(mission.id);
      saveGame();
    },
  }),
});
dialog = first.dialog = newDialog(first);
// A neighbour's shop (src/shop.js): their shelves, those not open to you
// yet locked, at their prices less a friend's discount
function openNpcShop(id) {
  const npc = NPCS[id];
  shop.open({
    title: npc.title,
    shelves: npc.shop.shelves.map(({ title, items }) => ({ title, items, locked: !npcs.shopOpen(id, title), lockText: `do more for ${npc.name}` })),
    lines: { hello: npc.lines.shop, bought: npc.lines.bought },
    request: false,
    discount: npcs.discount(id),
  });
}
// E at a neighbour (or their door, outside or in): true if it did something
// (not with a line out: E is for the fish then)
function useNpc() {
  if (place !== 'home' || fishing.state()) return false;
  const door = npcs.doorInReach(player.position);
  if (door) return goIntoHome(door), true;
  const out = npcs.exitInReach(player.position);
  if (out) return goOutOfHome(out), true;
  const who = npcs.talkable(player.position);
  if (who) return dialog.open(who), true;
  return false;
}
// ...and what it does, for the prompt ('': nothing of theirs)
function npcPrompt() {
  if (place !== 'home' || fishing.state()) return '';
  const door = npcs.doorInReach(player.position);
  if (door) return `E  Go into ${NPCS[door].title}`;
  if (npcs.exitInReach(player.position)) return 'E  Go outside';
  const who = npcs.talkable(player.position);
  if (who) return npcs.asleep(who) ? `${NPCS[who].name} is asleep` : `E  Talk to ${NPCS[who].name}`;
  return '';
}
function goIntoHome(id) {
  const { x, z } = npcs.entry(id);
  putDown({ x, y: GROUND_STAND_Y, z });
  anim.facing = Math.PI; // (into the room)
  if (npcs.asleep(id)) inventory.notify(NPCS[id].lines.asleep);
}
function goOutOfHome(id) {
  const { x, z } = npcs.outside(id);
  putDown({ x, y: GROUND_STAND_Y, z });
  anim.facing = 0; // (toward the camera)
}
// in the house's room or a neighbour's
const indoors = () => houseRoom.inside(player.position) || !!npcs.inside(player.position);
// Where we are out on the farm, for the map: in a neighbour's room, at
// their door; in the house, at its door; null away from the farm
function whereOnFarm() {
  if (place !== 'home') return null;
  const room = npcs.inside(player.position);
  if (room) return npcs.outside(room);
  if (houseRoom.inside(player.position)) {
    const house = buildings.find('house');
    return house ? houseDoorAt(house) : null;
  }
  const { x, z } = player.position;
  return Math.max(Math.abs(x), Math.abs(z)) <= HOME_HALF + 2 ? { x, z } : null;
}

// A word when a request you have heard is ready to hand over (once, till it is)
readyNoted = first.readyNoted = new Set();
function watchRequests(dt) {
  if ((readyCheck -= dt) > 0) return;
  readyCheck = 1;
  for (const id of NPC_IDS) {
    const st = npcs.status(id, missionCtx());
    if (!st.mission || !st.heard) continue;
    if (st.ready && !readyNoted.has(st.mission.id)) {
      readyNoted.add(st.mission.id);
      inventory.notify(`Ready for ${NPCS[id].name}: ${st.mission.title}`);
    } else if (!st.ready) readyNoted.delete(st.mission.id);
  }
}
// Now and then something turns up on the farm, to walk into (finds.js):
// out on the grass, with nothing tilled, fenced in or standing there (the
// stall, a platform, a tree, something built), and not right underfoot
function freeFarmSpot() {
  const edge = OLD_HALF - 2; // (on the old farm: out in the valley there is forage, below)
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
// ...and out in the valley, forage: on a biome's ground (FARM_FORAGE), out
// past the old farm, clear of what stands there, not right underfoot
function forageSpot() {
  const h = 0.45;
  for (let tries = 0; tries < 40; tries++) {
    const x = (Math.random() * 2 - 1) * (HOME_HALF - 1);
    const z = (Math.random() * 2 - 1) * (HOME_HALF - 1);
    if (Math.max(Math.abs(x), Math.abs(z)) < OLD_HALF) continue;
    const ground = HOME.tileType(Math.round(x), Math.round(z));
    if (!FARM_FORAGE.loot[ground] || farmTiles.has(tileKeyFor(x, z)) || buildings.get(tileKeyFor(x, z))) continue;
    if (world.platforms.some((box) => !box.ground && box.min.y < 2.2 && box.min.x < x + h && box.max.x > x - h && box.min.z < z + h && box.max.z > z - h)) continue;
    if (world.rocks.some((rock) => rock.state === 'up' && Math.hypot(rock.x - x, rock.z - z) < rock.radius + 0.6)) continue;
    if (Math.hypot(x - player.position.x, z - player.position.z) < 4) continue;
    return { x, y: 0, z, ground };
  }
  return null;
}
// (picked up by whichever farmer at the screen walks into it: i, their seat)
const farmFinds = createFarmFinds({ scene, freeSpot: freeFarmSpot, forageSpot, onPickUp: (item, count, i = 0) => within(farmersHere()[i] ?? first, () => inventory.add(item, count)), isItem: (id) => !!ITEMS[id] });

// Put down what the backpack's window carries (inventory.js onDrop), at our
// feet: in a lobby, or on a farm with helpers, its room has it, for anyone to
// walk into (THROW); on our own farm, alone, it lies there (finds.js). On a
// farm either way it is kept with the farm. Only what has a price (never a
// tool). True if it went.
function dropFromBackpack(id, count) {
  const def = ITEMS[id];
  const no = (text) => (inventory.notify(text), false);
  if (!def || def.trashable === false || !Object.hasOwn(SHOP, id) || def.currency) return no(`${def?.name ?? 'That'} can't be dropped`);
  if (place === 'home' && farmVisit?.visitor) return no('You\'re looking round: keep your things with you');
  if (!player.onGround) return no('Land first, then drop it');
  if (place === 'lobby' && net && !arenaId) {
    net.send({ t: C.THROW, item: id, count });
    return true;
  }
  if (place === 'home' && farmVisit && farmNet) {
    roomLine()?.send({ t: C.THROW, item: id, count });
    return true;
  }
  if (place === 'home' && !farmVisit && farmOnScreen) {
    farmFinds.drop(id, count, player.position.x, player.position.y - player.height / 2, player.position.z);
    return true;
  }
  return no('You can\'t drop things here');
}
// The farm's chest (chest.js): where its piece is built; on a farm with
// helpers, by the plaza till one is. On a farm with helpers what is in it is
// the room's; on our own farm without them, ours (ownChest, kept in the
// farm's save). It is a thing to bump into while it is there.
let ownChest = {}; // item -> count
let roomChest = {}; // what the room's chest has, as it last said
// The chest on the farm is one; each seat has a window onto it (`chest`:
// what is in it, whose it is and whether it is there are everyone's)
const chestModel = createChestModel();
// (whose it is and what is in it, as last said: a window made later, for a farmer who joins, starts from it)
const chestSaid = { owner: null, items: null };
function newChest(seat) {
  const view = createChest({
    inventory: seat.inventory,
    model: chestModel,
    ...forSeat(seat, {
      parent: seat.root,
      active: () => me === seat,
      onOpenChange: (open) => (open ? keys.clear() : saveGame()),
      onPut: (item, count) => {
        if (farmVisit) return roomLine()?.send({ t: C.CHEST_PUT, item, count });
        if (!chestHasRoom(ownChest, item, count)) {
          inventory.add(item, count, { quiet: true }); // (back where it came from)
          return inventory.notify('The chest is full');
        }
        ownChest[item] = (ownChest[item] ?? 0) + count;
        chest.setItems(ownChest);
      },
      onTake: (item, count) => {
        if (farmVisit) return roomLine()?.send({ t: C.CHEST_TAKE, item, count });
        const n = Math.min(count, ownChest[item] ?? 0);
        if (!n || !inventory.add(item, n)) return;
        ownChest[item] -= n;
        if (!ownChest[item]) delete ownChest[item];
        chest.setItems(ownChest);
        chest.refresh();
      },
    }),
  });
  seat.chestWindow = view;
  if (chestSaid.owner) view.setOwner(...chestSaid.owner);
  if (chestSaid.items) view.setItems(chestSaid.items);
  const everyone = (what) => (...args) => seats.forEach((s) => s.chestWindow[what](...args));
  return {
    ...view,
    show: everyone('show'),
    setOwner: (...args) => (chestSaid.owner = args) && everyone('setOwner')(...args),
    setItems: (items) => (chestSaid.items = items) && everyone('setItems')(items),
    refresh: everyone('refresh'),
  };
}
chest = first.chest = newChest(first);
worlds.home.root.add(chestModel.root);

// ---------- Trading, in a lobby ----------
// (shared/trade.js keeps the trade; src/ui/trade.js shows it.) Ask a farmer
// standing near (their Trade button in the list), or say yes when one asks.
const TRADE_ASK_REACH = 4.5; // (the lobby lets it be from 5)
const newTrade = (seat) => createTrade({
  inventory: seat.inventory,
  ...forSeat(seat, {
    parent: seat.root,
    active: () => me === seat,
    onOpenChange: (open) => (open ? keys.clear() : saveGame()),
    onOffer: (offer) => net?.send({ t: C.TRADE_OFFER, ...offer }),
    onReady: (ready, v) => net?.send({ t: C.TRADE_READY, ready, v }),
    onCancel: () => {
      net?.send({ t: C.TRADE_CANCEL });
      trade.close();
    },
    onAnswer: (id) => askTrade(id),
  }),
});
trade = first.trade = newTrade(first);

function askTrade(id) {
  if (place !== 'lobby' || !net) return;
  const at = remotes.positionOf(id);
  const name = lobbyNames.get(id) ?? 'them';
  if (!at || Math.hypot(at.x - player.position.x, at.z - player.position.z) > TRADE_ASK_REACH) return inventory.notify(`Walk up to ${name} to trade`);
  net.send({ t: C.TRADE_ASK, id });
}

// Done: out of the backpack with what we gave, in with what we got (what
// won't fit is dropped at our feet)
function tradeDone({ give, get, with: id }) {
  for (const [item, n] of Object.entries(give.items)) inventory.remove(item, Math.min(n, inventory.count(item)));
  if (give.gold) inventory.spend(Math.min(give.gold, inventory.gold()));
  for (const [item, n] of Object.entries(get.items)) if (!inventory.add(item, n)) dropFromBackpack(item, n);
  if (get.gold) inventory.earn(get.gold);
  trade.close();
  sound.play('cheer');
  hud.chat({ from: 0, text: `You traded with ${lobbyNames.get(id) ?? 'a farmer'}.` });
}

const TRADE_ENDS = {
  cancelled: (who, mine) => (mine ? 'You called the trade off.' : `${who} called the trade off.`),
  gone: (who) => `${who} went away: the trade is off.`,
  far: () => 'You walked too far apart: the trade is off.',
  game: (who, mine) => (mine ? 'Off to a party game: the trade is off.' : `${who} went off to a party game: the trade is off.`),
};

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
    roomLine()?.send({ t: C.CHEST_PUT, item, count });
    delete ownChest[item];
  }
}

// The workbench (workbench.js): built in build mode, and E next to one opens it
const BENCH_REACH = 1.7; // from its middle
const newWorkbench = (seat) => createWorkbench({
  inventory: seat.inventory,
  ...forSeat(seat, {
    parent: seat.root,
    active: () => me === seat,
    onOpenChange: (open) => (open ? keys.clear() : saveGame()),
  }),
  upgrades: forSeat(seat, { level: (id) => farmLevels[id], problem: upgradeProblem, upgrade }),
  chest: forSeat(seat, { stock: chestStock, spend: spendFromChest }),
});
workbench = first.workbench = newWorkbench(first);

// What the workbench uses of the chest ({ item: count }, what the backpack is
// short of): from our own chest at once, or on our farm with helpers from the
// room's, which says whether it was all there. Resolves to whether it was.
const SPEND_WAIT = 8000; // ms to wait for the room's word
let spendId = 0;
const spending = new Map(); // id -> resolve
function spendFromChest(items) {
  const entries = Object.entries(items);
  if (!farmNet) {
    if (!entries.every(([item, n]) => (ownChest[item] ?? 0) >= n)) return Promise.resolve(false);
    for (const [item, n] of entries) {
      ownChest[item] -= n;
      if (!ownChest[item]) delete ownChest[item];
    }
    chest.setItems(ownChest);
    return Promise.resolve(true);
  }
  if (!farmVisit?.mine || !entries.every(([item, n]) => (roomChest[item] ?? 0) >= n)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const id = ++spendId;
    const done = (ok) => {
      clearTimeout(timer);
      spending.delete(id);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), SPEND_WAIT);
    spending.set(id, done);
    roomLine()?.send({ t: C.CHEST_SPEND, id, items });
  });
}

// The arcade (arcade.js): built in build mode too, and E next to it opens
// it; every game won or lost is saved
const newArcade = (seat) => createArcade({ inventory: seat.inventory, ...forSeat(seat, { parent: seat.root, active: () => me === seat, onOpenChange: (open) => (open ? keys.clear() : saveGame()), onChange: () => saveGame() }) });
arcade = first.arcade = newArcade(first);

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

// ---------- Machines and cooking ----------
// The machines built on the farm (machines.js; what each takes and makes:
// MACHINES in shared/balance.js): E next to one puts in what it takes, from
// the backpack, and once it is done (its bubble bobs) collects what it made.
// A campfire is one too: E opens its dishes (cooking.js), one of which goes
// on the fire. The kitchen in the house (or the shelf there: the recipe book)
// cooks straight away from the recipes in the book: the 'start' ones, and
// those read off recipe cards (`learned`, kept in the save beside the
// backpack, so they come along to a friend's farm). On a farm with helpers the
// room keeps what is in each machine (LOAD, COLLECT, and MACHINE says what
// happened), and what anyone collects goes into their own backpack.
const machines = createMachines({ buildings, root: worlds.home.root });
const pendingLoads = new Map(); // tiles we loaded a machine on that the farm's room hasn't said yes to yet -> what came out of the backpack for it
learned = first.learned = new Set(); // the kitchen's recipes read into the recipe book (each seat's own)
const known = (dish) => DISHES[dish]?.learn === 'start' || learned.has(dish);
const newCooking = (seat) => createCooking({
  inventory: seat.inventory,
  ...forSeat(seat, {
    parent: seat.root,
    active: () => me === seat,
    known,
    onCampfire: (key, dish, n, took) => loadMachine(key, dish, n, took) && npcs.did('cook'), // (Mabel likes to hear of it: shared/npcs.js)
    onKitchen: (dish, n) => {
      inventory.add(dish, n);
      npcs.did('cook');
      houseRoom.cooked();
      puffs.puff(new THREE.Vector3().copy(houseRoom.potSpot()), { rise: true });
    },
    onOpenChange: (open) => (open ? keys.clear() : saveGame()),
  }),
});
cooking = first.cooking = newCooking(first);

// game hours, in words
function timeLeft(hours) {
  if (hours < 0.75) return 'less than an hour';
  const n = Math.round(hours);
  return `about ${n} hour${n === 1 ? '' : 's'}`;
}

// An aquarium (shared/machines.js): E with a fish in hand puts it in, if
// there is room; otherwise E takes the last kind put in back out
const fishToShow = () => (isFish(inventory.selectedId()) ? inventory.selectedId() : null);
function tankPrompt(state) {
  const fish = fishToShow();
  const n = fishIn(state);
  if (fish && n < AQUARIUM.holds) return `E  Put the ${ITEMS[fish].name.toLowerCase()} in the aquarium (${n}/${AQUARIUM.holds})`;
  const last = Object.keys(state?.takes ?? {}).at(-1);
  if (last) return `E  Take the ${ITEMS[last].name.toLowerCase()} out${fish ? ' (it is full)' : ''}`;
  return 'Hold a fish to put it in the aquarium';
}

function machinePrompt(key) {
  const piece = buildings.get(key);
  const state = machines.get(key);
  if (state?.pending) return '';
  if (piece === TANK) return tankPrompt(state);
  if (state && isReady(state, farmHours())) return `E  Collect ${state.n > 1 ? `${state.n} ` : ''}${ITEMS[state.item].name.toLowerCase()}`;
  if (state) return `${ITEMS[state.item].name} in ${timeLeft(state.at - farmHours())}`;
  if (piece === 'campfire') return 'E  Cook on the campfire';
  const takes = MACHINES[piece]?.takes;
  return takes ? `E  Put ${ITEMS[takes].name.toLowerCase()} in the ${PIECES[piece].name.toLowerCase()}` : '';
}

// E (or a tap) at the machine on tile key
function useMachine(key) {
  if (justLooking()) return;
  const piece = buildings.get(key);
  const state = machines.get(key);
  const hours = farmHours();
  if (state?.pending) return;
  if (piece === TANK) {
    const fish = fishToShow();
    if (fish && fishIn(state) < AQUARIUM.holds) {
      inventory.remove(fish, 1);
      return loadMachine(key, fish);
    }
    return state ? collectMachine(key, state) : inventory.notify('Hold a fish to put it in the aquarium');
  }
  if (state && isReady(state, hours)) return collectMachine(key, state);
  if (state) return inventory.notify(`${ITEMS[state.item].name} in ${timeLeft(state.at - hours)}`);
  if (piece === 'campfire') return cooking.openCampfire(key);
  const takes = MACHINES[piece]?.takes;
  if (!takes) return;
  if (!inventory.count(takes)) return inventory.notify(`The ${PIECES[piece].name.toLowerCase()} takes ${ITEMS[takes].name.toLowerCase()}: you have none`);
  inventory.remove(takes, 1);
  loadMachine(key);
}

// Into the machine on tile key (what it takes is out of the backpack already:
// took, else what the machine takes; dish: what goes on the campfire, n of it,
// or the fish into an aquarium). False if it couldn't (it is all given back)
function loadMachine(key, dish, n = 1, took) {
  const was = machines.get(key);
  const state = loadFor(buildings.get(key), farmHours(), dish, n, was);
  if (!state) {
    if (isFish(dish)) inventory.add(dish, 1, { quiet: true }); // (the aquarium is full after all)
    giveItems(took); // (it can't: back it goes)
    return false;
  }
  anim.squash = 0.15;
  steamAt(key);
  if (farmNet) {
    pendingLoads.set(key, state.item === TANK ? { [dish]: 1 } : took ?? state.takes);
    machines.set(key, { ...state, pending: true, was }); // (was: what it goes back to, if the room says no)
    roomLine()?.send({ t: C.LOAD, key, ...(dish && { dish }), ...(n > 1 && { n }) });
  } else {
    machines.set(key, took ? { ...state, takes: took } : state); // (the very fish that went in)
  }
  if (state.item === TANK) inventory.notify(`In swims the ${ITEMS[dish].name.toLowerCase()}`);
  else inventory.notify(`${n > 1 ? `${n} × ` : ''}${ITEMS[state.item].name.toLowerCase()} in ${timeLeft(state.at - farmHours())}`);
  return true;
}

// A curl of steam off the machine on tile key (the campfire's dishes)
function steamAt(key) {
  if (buildings.get(key) !== 'campfire') return;
  const [gx, gz] = key.split(',').map(Number);
  puffs.puff(new THREE.Vector3(gx * TILE_SIZE, 0.7, gz * TILE_SIZE), { rise: true });
}

function collectMachine(key, state) {
  const out = collectFor(buildings.get(key), state, farmHours());
  if (!out) return;
  if (!inventory.canAdd(out.got, out.n)) return inventory.notify('No room in your backpack');
  anim.squash = 0.15;
  steamAt(key);
  if (farmNet) {
    machines.set(key, { ...state, pending: true });
    return roomLine()?.send({ t: C.COLLECT, key, ...(state.item === TANK && { item: out.got }) });
  }
  inventory.add(out.got, out.n);
  machines.set(key, out.state); // (a beehive starts on the next jar)
}

// A recipe card into the backpack is read: into the recipe book it goes. One
// from the merchant is its recipe (one we have already: the merchant gives
// the gold back); an old one from a lobby is one of the 'find' recipes we
// haven't got yet (with all of those, it stays a card, to sell).
function readRecipe(id) {
  const def = ITEMS[id];
  let dish = def?.recipe;
  if (id === 'recipe_card') {
    const unknown = Object.keys(DISHES).filter((d) => DISHES[d].learn === 'find' && !learned.has(d));
    if (!unknown.length) return inventory.notify('You know every recipe on the old cards already');
    dish = unknown[Math.floor(Math.random() * unknown.length)];
  }
  if (!dish) return;
  inventory.remove(id, 1);
  if (learned.has(dish)) {
    if (def.price) inventory.earn(def.price);
    return inventory.notify(`You know how to cook ${ITEMS[dish].name.toLowerCase()} already: here's your gold back`);
  }
  learned.add(dish);
  hud.flash('New recipe!');
  inventory.notify(`${ITEMS[dish].name} is in your recipe book: cook it in your kitchen`);
}

// ---------- Eating ----------
// E with a dish in hand eats it: a boost for a while (cooking.js boostFrom;
// BOOSTS in shared/balance.js), counting down while you play. One meal at a
// time: another puts the last one's out. A dish double-clicked in the
// backpack is eaten too. A `shared` one (the farm feast) eaten on a farm with
// helpers: the room tells everyone there (FEAST), and it is theirs as well.
function eat(dish = inventory.selectedId(), fromSlot = true) {
  if (!DISHES[dish] || !(fromSlot ? inventory.consumeSelected(1) : inventory.remove(dish, 1))) return;
  meal = { dish, ...boostFrom(dish) };
  anim.squash = 0.15;
  sound.play('eat');
  inventory.notify(`Mmm, ${ITEMS[dish].name.toLowerCase()}! ${boostText(dish)}`);
  if (DISHES[dish].shared && farmNet) roomLine()?.send({ t: C.FEAST, dish });
}

function updateMeal(dt) {
  if (meal && !inputBlocked()) meal.left -= dt;
  if (meal && meal.left <= 0) {
    meal = null;
    inventory.notify('That meal has worn off');
  }
  if (!meal) return hud.setBoost('', '');
  const left = Math.ceil(meal.left);
  hud.setBoost(spriteURL(ITEMS[meal.dish]), `${meal.kinds.map((k) => BOOST_NAMES[k]).join(' + ')}  ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
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
  parent: first.root,
  onAddPlayer: () => startJoin(),
  players: () => seats.length,
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
    dressMe(); // (and the farm with helpers, if it has some, waits for us at home)
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
  onTryOn: (look, color) => dress(color, look),
  onDress: async (look, color) => {
    const account = await farmSync.setLook(look, color);
    // (everyone where we are sees the new clothes: the room reads them off the account)
    net?.dress(account.color, account.look);
    farmNet?.dress(account.color, account.look);
    return account;
  },
  onFriends: () => farmSync.friends(),
  onAddFriend: (username) => farmSync.addFriend(username),
  onAnswerFriend: (id, yes) => farmSync.answerFriend(id, yes),
  onRemoveFriend: (id) => farmSync.removeFriend(id),
  onStartParty: (ids, game) => presence.ready && (presence.send({ t: PC.PARTY, invite: ids, game }), true),
  onCancelParty: () => presence.send({ t: PC.CANCEL }),
  onInviteToLobby: (ids) => session && presence.send({ t: PC.INVITE, code: session.code, invite: ids }),
});

// ---------- Friends online ----------
// The page keeps a line to the server open for its friends (net/presence.js,
// server/presence.js): an invitation to a lobby pops up the moment it comes
// (ui/invite.js), wherever we are, and when a lobby we said yes to (or
// started) opens, off we go to it.
const invites = new InvitePopups({ parent: first.root, onAnswer: (party, yes) => presence.send({ t: PC.ANSWER, party, yes }) });
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

// What we wear: the account's shirt color and clothes (src/net/farm.js), at
// home; in a lobby or on a farm with helpers its room says (it goes by the
// account's too)
const myColor = () => farmSync.account()?.color ?? PLAYER_COLORS[0];
const myLook = () => farmSync.account()?.look ?? DEFAULT_LOOK;
function dress(color, look) {
  farmer.setShirt(color);
  farmer.setLook(look);
}
function dressMe() {
  if (place === 'home' && !farmNet) dress(myColor(), myLook());
}

// The wardrobe in the house: the menu's Your farmer page (what we wear is kept with the account)
function openWardrobe() {
  if (me !== first) return inventory.notify(me.profile?.kind === 'account' ? 'Your clothes are kept with your account: change them in your own game' : 'A guest wears what they came in');
  if (!farmSync.account()) return inventory.notify('Log in to change clothes: they are kept with your account');
  keys.clear();
  splash.show({ page: 'farmer', direct: true });
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
  dress(myColor(), myLook());
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
  if (!mine) endCoop('Off online: everyone else at the screen got up, their farmers saved'); // (a friend's farm is for the farmer of this page alone: our own, with its helpers, has the screen's farmers on it too)
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
  const conn = (farmNet = new Connection({ name: splash.name(), color: myColor(), look: myLook(), farm: id, auth: farmSync.auth() }));
  const on = (type, fn) => conn.on(type, (m) => farmNet === conn && fn(m));

  on(S.FARM, (m) => {
    if (!m.mine) endCoop('Off online: everyone else at the screen got up, their farmers saved'); // (a friend's farm: for the farmer of this page alone)
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
    farmVisit = { id: m.farm.id, name: m.farm.name, owner: m.farm.owner, mine: m.mine, visitor: !!m.visitor, alone: true, helpers: m.farm.helpers ?? 0 };
    myId = m.id;
    dress(m.color, m.look);
    showRoomFarm(m);
    bosses.welcome(m.bosses, m.dungeons);
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
    connectSeats(); // (our own farm: the farmers at this screen are on it with us)
  });
  on(S.ROSTER, (m) => {
    hud.setRoster(m.list);
    setFarmRoster(m.list);
  });
  on(S.SNAP, (m) => remotes.snapshot(m.tick, m.p));
  onDrops(on);
  on(S.TILLED, (m) => {
    pendingTills.delete(m.key);
    tillTileAt(...keyXZ(m.key)); // (ours is there already)
  });
  on(S.UNTILLED, (m) => {
    pendingTills.delete(m.key);
    removeCrop(m.key);
    untillTile(m.key);
  });
  on(S.UPROOTED, (m) => removeCrop(m.key));
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
    machines.set(m.key, null);
    placeChest();
    const by = seatBy(m.by);
    if (by) {
      within(by, () => {
        giveBack(m.piece);
        giveItems(m.back); // (what was in a machine)
      });
    }
  });
  on(S.MACHINE, (m) => {
    const by = seatBy(m.by);
    if (by) within(by, () => pendingLoads.delete(m.key));
    const [item, at, takes, n] = Array.isArray(m.state) ? m.state : [];
    machines.set(m.key, item && (ITEMS[item] || item === TANK) ? { item, at, takes: takes ?? {}, ...(n > 1 && { n }) } : null);
    if (!by) steamAt(m.key);
    // (collected: ours, into the backpack; no room after all, into the chest)
    const got = Number.isInteger(m.n) && m.n > 0 ? m.n : 1;
    if (m.got && by) within(by, () => !inventory.add(m.got, got) && roomLine()?.send({ t: C.CHEST_PUT, item: m.got, count: got }));
  });
  on(S.FEAST, (m) => {
    if (!DISHES[m.dish]?.shared) return;
    // (everyone but who shared it, at this screen too)
    const sharer = seatBy(m.by);
    const who = sharer ? seatName(sharer) : remotes.players.get(m.by)?.name || 'A friend';
    for (const seat of seats) {
      if (idOf(seat) === m.by) continue;
      within(seat, () => {
        meal = { dish: m.dish, ...boostFrom(m.dish) };
        hud.flash('A feast!');
        inventory.notify(`${who} shared a ${ITEMS[m.dish].name.toLowerCase()}! ${boostText(m.dish)}`);
      });
    }
  });
  on(S.WATERED, (m) => {
    const crop = crops.get(m.key);
    if (!crop) return;
    crop.wateredAt = m.at;
    markWatered(m.key);
    if (crop.plantedAt !== undefined) crop.age = ageAt(crop.plantedAt, m.at);
  });
  on(S.HARVESTED, (m) => {
    const crop = crops.get(m.key);
    if (crop && CROPS[crop.cropId].again) pickAgain(m.key);
    else removeCrop(m.key);
    const by = seatBy(m.by);
    if (!by || !m.item) return; // (no item: a lily leaf wilted)
    within(by, () => {
      inventory.notify(`${ITEMS[m.item]?.name ?? 'That'} went in the farm's chest`);
      skilled('farming', SKILLS.xp.harvest[crop?.cropId] ?? 0, m.item); // (a bonus one comes to the backpack)
    });
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
  on(S.MINED, (m) => {
    farmMined.set(m.id, m.at);
    rockMined(m);
  });
  on(S.RESURFACED, (m) => {
    farmMined.delete(m.id);
    setSite(farmRockSites, m.id, m.n);
    world.regrowRock(m.id, { n: m.n ?? 0 });
  });
  on(S.GIANT, giantNews);
  farmPrivate(on);
  on(S.CHEST, (m) => {
    roomChest = m.items;
    chest.setItems(m.items);
  });
  on(S.FARM_CLOCK, (m) => syncFarmClock(m.hours));
  on(S.BOSS, bosses.onBoss);
  on(S.BOSS_FX, bosses.onFx);
  on(S.BOSS_WON, bosses.onWon);
  on(S.DUNGEON, bosses.onDungeon);
  on(S.DUNGEON_FX, bosses.onDungeonFx);
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

// What a farm's room says to one farmer alone (not to everyone on it): each
// farmer at a split screen has a line of their own, and these go to them
function farmPrivate(on) {
  on(S.FARM_DENY, (m) => {
    const crop = crops.get(m.key);
    if (m.op === 'till' && pendingTills.delete(m.key)) untillTile(m.key);
    else if (m.op === 'plant' && crop?.pending) {
      removeCrop(m.key);
      const seed = Object.keys(ITEMS).find((id) => ITEMS[id].plants === m.crop);
      if (seed) inventory.add(seed, 1, { quiet: true }); // (the seed back)
    } else if ((m.op === 'harvest' || m.op === 'uproot') && crop) {
      crop.pending = false;
      crop.view.group.visible = true;
    } else if (m.op === 'water' && crop && crop.wateredAt === undefined) {
      crop.watered = false; // (it didn't take)
      setWet(m.key, false);
    } else if (m.op === 'build' && pendingBuilds.has(m.key)) {
      const carried = pendingBuilds.get(m.key);
      pendingBuilds.delete(m.key);
      giveBack(buildings.remove(m.key), carried); // (it wasn't built after all: the chest's share never left it)
      placeChest();
    } else if (m.op === 'unbuild') {
      pendingUnbuilds.delete(buildings.anchor(m.key) ?? m.key);
    } else if (m.op === 'load' && pendingLoads.has(m.key)) {
      giveItems(pendingLoads.get(m.key)); // (it didn't go in after all)
      pendingLoads.delete(m.key);
      const state = machines.get(m.key);
      if (state?.pending) machines.set(m.key, state.was ?? null);
    } else if (m.op === 'collect') {
      const state = machines.get(m.key);
      if (state?.pending) machines.set(m.key, { ...state, pending: false });
    }
  });
  on(S.CHOP_DENY, (m) => chop.pending.delete(m.id));
  on(S.MINE_DENY, (m) => mine.pending.delete(m.id));
  on(S.CHEST_SPENT, (m) => spending.get(m.id)?.(!!m.ok));
  on(S.CHEST_GOT, (m) => {
    // (no room for it after all: back in the chest)
    if (!inventory.add(m.item, m.count)) roomLine()?.send({ t: C.CHEST_PUT, item: m.item, count: m.count });
    chest.refresh();
  });
  on(S.DUNGEON_LOOT, (m) => bosses.onLoot(m));
  onOwnDrops(on);
}

// Off the farm's room. Our own farm stays on screen (it plays on in this
// page); a friend's goes.
function leaveFarm() {
  const was = farmVisit;
  // (on our own farm, what lies about on it is ours to keep from here: finds.js)
  if (was?.mine) farmFinds.restoreDropped([...drops.values()].map((d) => [d.item, d.count, d.x, d.y - GROUND_STAND_Y, d.z]));
  clearDrops();
  if (was?.mine) saveGame(); // (the animals, to the room)
  for (const done of [...spending.values()]) done(false); // (nobody left to ask)
  farmNet?.leave();
  farmNet = null;
  disconnectSeats(); // (the farmers at this screen play on in the page, as the farm does)
  farmVisit = null;
  pendingTills.clear();
  pendingBuilds.clear();
  pendingUnbuilds.clear();
  pendingLoads.clear();
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
  const others = list.filter((p) => !seatBy(p.id)); // (the farmers at this screen are drawn as ours, not as someone coming)
  remotes.setRoster(others, myId);
  if (farmVisit) farmVisit.alone = !others.some((p) => !p.away);
}

// game seconds a crop planted at `plantedAt` (the farm's game hours) has been growing
// (and faster from when it was watered)
const ageAt = (plantedAt, wateredAt) =>
  Math.max(0, ((farmHours() - plantedAt + (wateredAt === undefined ? 0 : Math.max(0, farmHours() - wateredAt) * (WATERED_GROWTH - 1))) * DAY_LENGTH_SECONDS) / 24);

// The farm as its room has it (FARM)
function showRoomFarm(m) {
  resetFarm();
  farmFinds.restoreDropped(null); // (what is dropped on it is the room's)
  clearDrops();
  for (const drop of m.drops ?? []) addDrop(drop);
  dayNight.setTime(m.hours);
  for (const t of m.tilled) {
    const [key, bare, life] = Array.isArray(t) ? t : [t, 0];
    tillTileAt(...keyXZ(key), bare, life);
  }
  buildings.placeAll(m.built ?? []);
  machines.restore(m.machines, m.hours);
  placeChest();
  showFarmWilds(m);
  for (const [key, cropId, at, wateredAt] of m.crops) {
    if (!CROPS[cropId] || !plantAt(...keyXZ(key), cropId, ageAt(at, wateredAt))) continue;
    Object.assign(crops.get(key), { plantedAt: at, wateredAt });
    if (wateredAt !== undefined) markWatered(key);
  }
  useLevels(m.animals?.levels);
  animals.restore(Object.keys(m.animals ?? {}).length ? m.animals : null, farmHours());
}

// The room's clock, now and then: pages drift (not while we fast-forward it ourselves)
function syncFarmClock(hours) {
  if (keys.has('KeyT') || Math.abs(hours - farmHours()) < 0.05) return;
  dayNight.setTime(hours);
  for (const crop of crops.values()) if (crop.plantedAt !== undefined) crop.age = ageAt(crop.plantedAt, crop.wateredAt);
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
  trade.reset();
  session = null;
  myId = 0;
  partyGame = null;
  arenaId = 0;
  partyHud.clear();
  showCrowns([]);
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
// A lobby is opened for one party game (shared/minigame.js), picked by
// whoever started it, and everyone there is in it: the card at the top
// (src/ui/party.js) counts down to it. For an arena game, off to its arena
// (src/arenas.js) once it has gathered, a moment to look about (standing
// still), then the game; a loot run is played on the lobby's own island, from
// the stone circle. While we are in the arena the lobby's island is kept as it
// was (its spots and drops out of sight), and only the farmers in the same
// place as us are drawn. Once it is over, the results (and the prize) a
// moment, and home: to the farm we were on before (backToFarm).
const partyHud = new PartyHud({
  parent: first.root,
  onLeave: () => backToFarm(),
  nameOf: (id) => lobbyNames.get(id) ?? 'Someone',
});
const coinPending = new Map(); // coin id -> when we said we picked it up (performance.now())
const crowns = new Map(); // king of the hill: player id -> the crown over their head, while they hold the hill
let readyCount = 0; // the last number of the countdown shown
const inParty = () => !!partyGame?.players.some(([id]) => id === myId);
const lootRun = () => partyGame?.kind === 'loot_run' && inParty();
const partyFrozen = () => partyGame?.phase === 'ready' && (!!arenaId || lootRun());
// Whether the lobby's spots can be emptied now: a loot run's only while it is on
const canLoot = () => session?.room.game !== 'loot_run' || (lootRun() && partyGame.phase === 'playing');

// The board of the biggest catches by the lobby's pond (fishboard.js, where
// the lobby says it stands)
const fishBoard = createFishBoard();

// The farmers drawn: the ones where we are (the lobby's island, or our arena)
function showRemotes() {
  remotes.setRoster(lobbyRoster.filter((p) => (p.game ?? 0) === arenaId), myId);
}

// The lobby's party game as it is now (null: none). pos: where the lobby has
// us (a WELCOME's: back in the arena after a reload)
function showParty(game, pos = null) {
  const was = game && partyGame?.id === game.id ? partyGame.phase : null;
  partyGame = game;
  partyHud.show(game, myId);
  // a loot run: everyone off from the stone circle together
  if (lootRun() && game.phase === 'ready' && was === 'gathering') {
    putDown(spawnPoint(islandFor(session.seed).spawn, myId % 8, 8)); // (where the lobby has us: shared/room.js spawnFor)
    readyCount = 0;
  }
  if (lootRun() && game.phase === 'playing' && was === 'ready') hud.flash('Go!');
  const playing = game && GAMES[game.kind] && game.phase !== 'gathering' && inParty();
  if (playing && arenaId !== game.id) {
    fishing.reset(); // (a line out in the lobby comes in)
    enterWorld('arena', game);
    arenaId = game.id;
    coinPending.clear();
    world.coins.forEach((coin, id) => (coin.visible = !game.taken.includes(id)));
    world.dropTiles(0);
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
  if (playing && game.kind === 'king_of_hill') showCrowns(game.top ?? []);
  if (!playing && arenaId) backFromArena(); // (it was called off, or we are out of it)
}

// Out of the arena, onto the lobby's island (pos: where; else where farmers arrive)
function backFromArena(pos = null) {
  arenaId = 0;
  fishing.reset(); // (a line out in a fishing contest comes in)
  coinPending.clear();
  showCrowns([]);
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

// Off home from the lobby: to the farm we were on before it (ours, or the
// friend's we were helping on or looking round)
function backToFarm() {
  if (place !== 'lobby') return;
  const friend = lastFarm;
  goHome();
  if (friend) joinFarm(friend);
}

// King of the hill: a crown over the head of each farmer up on the hill (ids)
function showCrowns(ids) {
  for (const [id, crown] of crowns) {
    if (ids.includes(id)) continue;
    scene.remove(crown);
    crowns.delete(id);
  }
  for (const id of ids) {
    if (crowns.has(id)) continue;
    const crown = buildCrown();
    scene.add(crown);
    crowns.set(id, crown);
  }
}

// GAME_SCORE: the scores, and who holds the hill now (last one standing: who
// is still up; the hop race: who has made it across)
function partyScores(m) {
  if (!partyGame) return;
  const across = partyGame.kind === 'hop_race' && !partyGame.top?.includes(myId) && m.top.includes(myId);
  partyGame.top = m.top;
  partyHud.scores(m.scores);
  if (across) {
    sound.play('cheer');
    hud.flash(m.top[0] === myId ? 'First across!' : 'Across!');
  }
  if (!arenaId || partyGame.kind !== 'king_of_hill') return;
  const had = crowns.has(myId);
  showCrowns(m.top);
  if (!had && crowns.has(myId)) hud.flash('King of the hill!');
}

// What to say at the bottom in the arena
function arenaPrompt() {
  if (partyGame?.phase !== 'playing') return '';
  if (inContest()) return fishing.prompt();
  const shove = shoving() ? 'E: shove' : 'E: bop';
  if (partyGame.kind === 'king_of_hill') return crowns.has(myId) ? 'You hold the hill!' : `Up the hill! ${shove}`;
  if (partyGame.kind === 'last_one') return partyGame.top?.includes(myId) ? `Stay up! ${shove}` : 'Splash! Watching from the islet';
  if (partyGame.kind === 'hop_race') return partyGame.top?.includes(myId) ? 'You made it across!' : 'Hop across to the flag!';
  return '';
}

// Every frame in the arena: the countdown, coins we walk into, crowns,
// tiles dropping (or in a fishing contest, what the line is doing)
function updateArena() {
  partyHud.update();
  hud.setPrompt(arenaPrompt());
  if (partyGame?.kind === 'last_one') {
    const arena = arenaFor(partyGame.kind, partyGame.seed);
    world.dropTiles(partyGame.phase === 'playing' ? GAMES.last_one.ms - (partyHud.endsAt - performance.now()) : 0);
    // fell in: wash up on the islet (and out, once the lobby hears)
    if (player.position.y < GROUND_STAND_Y - 1.5) {
      const i = Math.max(0, partyGame.players.findIndex(([id]) => id === myId));
      putDown(arena.watch(i, partyGame.players.length));
      if (partyGame.phase === 'playing') hud.flash('Splash!');
    }
  }
  // the hop race: fell in, back to the start (on the meadow) for another go
  if (partyGame?.kind === 'hop_race' && player.position.y < GROUND_STAND_Y - 1.5) {
    const arena = arenaFor(partyGame.kind, partyGame.seed);
    const i = Math.max(0, partyGame.players.findIndex(([id]) => id === myId));
    putDown(arena.start(i, partyGame.players.length));
    hud.flash('Splash! Back to the start');
  }
  const t = performance.now() / 1000;
  for (const [id, crown] of crowns) {
    const pos = id === myId ? player.position : remotes.positionOf(id);
    if (!pos) continue;
    crown.position.set(pos.x, pos.y + 0.95 + Math.sin(t * 3) * 0.04, pos.z);
    crown.rotation.y = t;
  }
  if (countDown() || partyGame?.phase !== 'playing') return;
  const now = performance.now();
  world.coins.forEach((coin, id) => {
    const at = coinPending.get(id);
    if (at !== undefined) {
      if (now - at < 1500) return;
      coinPending.delete(id); // (the lobby never said: it didn't count, it is still there)
      coin.visible = !partyGame.taken.includes(id);
    }
    if (!coin.visible || player.position.distanceTo(coin.position) > 0.9) return; // (a race: kept tight)
    coin.visible = false; // (at once, so it feels instant: GAME_COIN settles it)
    coinPending.set(id, now);
    net?.send({ t: C.GAME_COIN, id });
  });
}

// The seconds before a game starts, as they go (in its arena, or a loot
// run's stone circle). Whether it is about to.
function countDown() {
  if (partyGame?.phase !== 'ready' || !inParty()) return false;
  const left = Math.ceil((partyHud.endsAt - performance.now()) / 1000);
  if (left > 0 && left !== readyCount) {
    readyCount = left;
    hud.flash(String(left));
  }
  return true;
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

// GAME_END: it is over. Our prize into the backpack, back to the lobby from
// the arena, and (once the results have been up a moment) home.
function partyOver(m) {
  const at = m.pos.find(([id]) => id === myId);
  const played = m.scores.some(([id]) => id === myId);
  const got = m.prizes.find(([id]) => id === myId)?.[1] ?? null;
  partyGame = null;
  if (arenaId) backFromArena(at && { x: at[1], y: at[2], z: at[3] });
  for (const [item, count] of got ?? []) if (ITEMS[item]) inventory.add(item, count);
  if (played) {
    const named = (item, count) => {
      const name = (ITEMS[item]?.name ?? item).toLowerCase();
      return count > 1 && !name.endsWith('s') ? `${name}s` : name;
    };
    partyHud.results(m, got, named); // (then onLeave: home)
    if ((m.winners ?? [m.winner]).includes(myId)) {
      sound.play('cheer');
      hud.flash('You won!');
    } else if (m.records?.some(([id]) => id === myId)) {
      hud.flash('New best!'); // (onto its leaderboard: server/leaderboards.js)
    }
  } else {
    backToFarm();
  }
}

function joinLobby({ name, code }) {
  endCoop('Off online: everyone else at the screen got up, their farmers saved'); // (a lobby too)
  net?.leave();
  splash.setStatus('Walking over…');
  const conn = (net = new Connection({ name, color: myColor(), look: myLook(), code, auth: farmSync.auth() }));
  // (a handler for a connection we have since left does nothing)
  const on = (type, fn) => conn.on(type, (m) => net === conn && fn(m));

  on(S.WELCOME, (m) => {
    endCoop('Off online: everyone else at the screen got up, their farmers saved'); // (one who joined on the way, say)
    if (place !== 'lobby') lastFarm = farmVisit && !farmVisit.mine ? farmVisit.id : null; // (to go back to after the game)
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
    session = { code: m.code, seed: m.seed, room: m.room, wilds: m.wilds, boardAt: m.boardAt ?? null };
    fishBoard.placeIn(worlds.wild.root, session.boardAt);
    fishBoard.show(m.board ?? []);
    arenaId = 0;
    myId = m.id;
    dress(m.color, m.look);
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
  on(S.GAME_SCORE, (m) => (m.scores ? partyScores(m) : partyHud.score(m.by, m.score)));
  on(S.BOARD, (m) => fishBoard.show(m.board));
  on(S.TRADE_ASKED, (m) => trade.asked(m.from, m.name));
  on(S.TRADE, (m) => trade.show(m, lobbyNames.get(m.with) ?? 'a farmer'));
  on(S.TRADE_DONE, (m) => tradeDone(m));
  on(S.TRADE_END, (m) => {
    if (!trade.isOpen()) return;
    trade.close();
    hud.chat({ from: 0, text: (TRADE_ENDS[m.why] ?? TRADE_ENDS.cancelled)(lobbyNames.get(m.by) ?? 'The other farmer', m.by === myId) });
  });
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
  on(S.SHOT, shotFired);
  on(S.BITE, (m) => fishing.bit(m));
  on(S.CAUGHT, (m) => fishing.caught(m));
  onDrops(on);
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
  if (!conn) return;
  conn.stateTimer = (conn.stateTimer ?? 0) + dt; // (each line's own: a farmer at a split screen has one)
  if (conn.stateTimer < TICK_DT) return;
  conn.stateTimer %= TICK_DT;
  const p = player.position;
  const r = (v) => Math.round(v * 100) / 100;
  conn.send({
    t: C.STATE,
    x: r(p.x), y: r(p.y), z: r(p.z), yaw: r(anim.facing),
    f: (player.onGround ? STATEF.GROUND : 0) | (hoeGroup.visible ? STATEF.HOE : 0) |
      (farmer.axe.visible ? STATEF.AXE : 0) | (farmer.pick.visible ? STATEF.PICK : 0) | (anim.swing >= 0 ? STATEF.SWING : 0) |
      (farmer.sword.visible ? STATEF.SWORD + Math.max(0, SWORDS.indexOf(inventory.selectedId())) * STATEF.BLADE : 0) |
      (farmer.mallet.visible ? STATEF.MALLET : 0) | (farmer.bow.visible ? STATEF.BOW : 0) |
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
    crops: [...crops].map(([key, c]) => [key, c.cropId, c.age, ...(c.watered ? [1] : [])]),
    built: buildings.list(),
    dropped: farmFinds.dropped(), // (what we dropped, lying about)
    machines: machines.capture(),
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
  farmFinds.restoreDropped(farm?.dropped);
  ownChest = Object.fromEntries(Object.entries(unmake(farm?.chest)).filter(([id, n]) => ITEMS[id] && Number.isInteger(n) && n > 0));
  useLevels(farm?.levels);
  if (!farm) return animals.restore(null, farmHours());
  const away = Math.max(0, (Date.now() - farm.savedAt) / 1000);
  dayNight.setTime(farm.hours + (away / DAY_LENGTH_SECONDS) * 24);
  // (soil left bare while we were away may have gone back to grass; a save
  // from before it did that has just the keys)
  const growing = new Set(farm.crops.filter(([, cropId]) => CROPS[cropId]).map(([key]) => movedKey(key)));
  for (const t of farm.tilled) {
    const [was, bare, life = soilLife()] = Array.isArray(t) ? t : [t, 0];
    const key = movedKey(was); // (the house's field, where it was before the farm grew)
    const bareNow = growing.has(key) ? 0 : (bare || 0) + away;
    if (bareNow < life) tillTileAt(...keyXZ(key), bareNow, life);
  }
  buildings.placeAll(farm.built ?? []);
  machines.restore(farm.machines, farmHours()); // (what was in them, done or not by now)
  placeChest();
  showFarmWilds(farm);
  // (rain while we were away watered what was growing then: shared/weather.js)
  const rained = rainSince(farm.hours, farmHours());
  const hour = DAY_LENGTH_SECONDS / 24;
  for (const [was, cropId, age, watered] of farm.crops) {
    const key = movedKey(was);
    if (!CROPS[cropId]) continue;
    const wet = watered || (rained !== null && age + (rained - farm.hours) * hour < CROPS[cropId].growTime);
    const rainy = wet && !watered ? (farmHours() - rained) * hour * (WATERED_GROWTH - 1) : 0; // (growing faster from when it came)
    if (plantAt(...keyXZ(key), cropId, age + away * (watered ? WATERED_GROWTH : 1) + rainy) && wet) markWatered(key);
  }
  animals.restore(farm, farmHours()); // (the eggs due while we were away are in the nest)
}

// The first seat's save: the farm, and its farmer's own (character)
function currentSave() {
  if (farmOnScreen) homeFarm = captureFarm();
  return { v: SAVE_VERSION, farm: homeFarm, ...within(first, character) };
}

// What a farmer carries wherever they go, for their save: the backpack and the rest (the seat's)
function character() {
  return { backpack: inventory.serialize(), skills: skills.serialize(), fishlog: fishLog.serialize(), found: book.serialize(), bosses: bosses.record(), recipes: [...learned], meal: meal && [meal.dish, Math.round(meal.left)], npcs: npcs.serialize() };
}

// Everyone's at the screen: the farm and the first seat's farmer, and each
// farmer who joined them (to their own account, or this browser: saveSeat)
function saveGame() {
  for (const seat of seats) if (seat !== first && seat.profile) saveSeat(seat);
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
    first.hud.setConnStatus('This farm was saved by a newer version of the game. Reload the page to play it: nothing is saved until then.');
    return false;
  }
  homeFarm = save.farm ?? null;
  within(first, () => useCharacter(save));
  if (farmOnScreen) showFarm(homeFarm);
  return true;
}

// A farmer's own out of their save, into the seat (its backpack and the rest;
// what joined the kit since, for an older save)
function useCharacter(save) {
  // (a lamp post or bench made at the workbench before they were built
  // straight from wood and stone comes back as what it cost)
  const unmade = {};
  for (const slot of save.backpack?.slots ?? []) if (slot && UNMADE[slot.id]) unmade[slot.id] = (unmade[slot.id] ?? 0) + Math.max(1, slot.count | 0);
  inventory.restore(save.backpack ?? {});
  skills.restore(save.skills); // (none before v8: everything at level 1)
  fishLog.restore(save.fishlog); // (none before the journal: nothing landed yet)
  book.restore(save.found); // (none before the book: what is in the backpack, below)
  npcs.restore(save.npcs); // (none before the neighbours: nobody met yet)
  for (const [item, n] of Object.entries(unmake(unmade))) gift(item, n);
  bosses.restore(save.bosses); // (the bosses we beat, and what we are still owed for it)
  learned.clear();
  for (const dish of Array.isArray(save.recipes) ? save.recipes : []) if (DISHES[dish]?.cook === 'kitchen') learned.add(dish);
  const [dish, left] = Array.isArray(save.meal) ? save.meal : [];
  meal = DISHES[dish] && Number.isFinite(left) && left > 0 ? { dish, ...boostFrom(dish), left: Math.min(left, boostFrom(dish).left) } : null;
  if (save.v < 2) gift('flax_seeds', 5);
  if (save.v < 3) gift('axe', 1);
  if (save.v < 6) gift('pickaxe', 1);
  book.seed([...inventory.serialize().slots.map((s) => s?.id), ...Object.keys(save.farm?.chest ?? {})]);
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
  dressMe();
  if (!splash.hidden) splash.showHelping(); // (the farms we help on: the server knows who we are now)
  // a farm with helpers, already home (the page was quick): onto its room
  if (place === 'home' && farmSync.shared() && farmSync.ready && !farmNet && !farmJoining) joinFarm(farmSync.id());
}

function leavePage() {
  saveGame();
  farmSync.flush({ leaving: true });
  for (const seat of seats) seat.sync?.flush({ leaving: true }); // (the farmers who joined at the screen too)
  flushClosing(); // (and who got up just now)
}

setInterval(saveGame, 5000);
addEventListener('pagehide', leavePage);
document.addEventListener('visibilitychange', () => document.hidden && leavePage());

// ---------- More farmers at the screen: a split screen ----------
// On our own farm, played in this page (not with its online helpers, nor in
// a lobby), up to MAX_SEATS farmers play at once, each on a controller of
// their own. The menu's Add a player waits for A (or Start) on a controller
// nobody has; once two are playing, Start on another joins straight away.
// The new farmer's panel asks who they are (src/ui/seatpanel.js): a farmer
// played here before, their account (logging in), or a guest
// (src/net/players.js). Their backpack, gold, skills and the rest come
// along, and are saved back to them (saveSeat) as the farm is saved, and
// when they get up from the screen. The farm is the first seat's: what they
// grow, build or put in the chest stays on it. Heading online (a lobby, a
// farm's room) is the first seat's alone: everyone else gets up first.
const MAX_SEATS = 4;
const JOIN_WAIT = 30_000; // ms the menu's Add a player waits for a controller
const JOIN_BUTTONS = [0, 9]; // A, and Start (Menu): its press joins
let joining = null; // waiting for a new farmer's controller: { until } (performance.now())
const padsDown = []; // which controllers had a join button down, last frame (by index)
let seatsEver = 0; // (each farmer who joins: an id of their own, seat.uid)
const joinEl = el('div', 'seats-join', seatsEl);
joinEl.hidden = true;

// Why no one else can join now ('': they can)
function coopProblem() {
  // (our own farm, in the page, or in its room with its helpers; not on a friend's, nor on the way online)
  const inRoom = !!farmNet && !!farmVisit?.mine;
  if (place !== 'home' || (farmVisit && !inRoom) || (farmNet && !inRoom) || net || farmJoining || !farmOnScreen) return 'Farmers join at the screen on your own farm';
  if (farmSync.shared() && !inRoom) return 'Your farm is played with its online helpers, on the game server: wait for it to open (is the server away?)';
  if (seats.length >= MAX_SEATS) return `${MAX_SEATS} farmers at one screen is as many as fit`;
  return '';
}

// The menu's Add a player: wait for a controller of the new farmer's own. Why not ('' : waiting)
function startJoin() {
  const problem = coopProblem();
  if (problem) return problem;
  if (padInUse() && navigator.getGamepads?.()[first.pad.index]?.connected) first.padIndex = first.pad.index; // (the controller the first farmer plays with stays theirs)
  joining = { until: performance.now() + JOIN_WAIT };
  showJoinHint();
  return '';
}

function stopJoin() {
  joining = null;
  showJoinHint();
}

// Each frame: a press of A or Start on a controller nobody has, while the
// menu's Add a player waits (or Start, once two play): a new farmer
function watchJoin() {
  const pads = [...(navigator.getGamepads?.() ?? [])];
  if (joining && (performance.now() > joining.until || !splash.hidden || coopProblem())) stopJoin();
  for (const p of pads) {
    if (!p?.connected) continue;
    const down = JOIN_BUTTONS.some((b) => p.buttons[b]?.pressed);
    const fresh = down && !padsDown[p.index];
    padsDown[p.index] = down;
    if (!fresh || seats.some((seat) => seat.padIndex === p.index)) continue;
    // (a farmer whose controller went, and is back as another: theirs again;
    // the first farmer's, but not while a new one is waited for)
    const lost = seats.find((seat) => seat.padIndex !== null && !pads[seat.padIndex]?.connected && !(seat === first && joining));
    if (lost) {
      lost.padIndex = p.index;
      lost.pad.ignoreHeld();
      continue;
    }
    if (!joining && !p.buttons[9]?.pressed) continue;
    if (joining || (seats.length > 1 && !coopProblem())) {
      stopJoin();
      return addSeat(p.index);
    }
  }
}

// What the screen says of joining: waiting for a controller, or, three at
// it, how a fourth joins (in the empty part)
function showJoinHint() {
  const n = freeIndex() + 1;
  joinEl.hidden = !joining && seats.length !== 3;
  joinEl.classList.toggle('waiting', !!joining);
  joinEl.textContent = '';
  if (joining) {
    joinEl.append(`Player ${n}: press A on your controller`);
    el('small', '', joinEl, 'Esc or the menu: not now');
  } else if (seats.length === 3) {
    joinEl.append('Another farmer?');
    el('small', '', joinEl, 'Press Start on a controller to join');
  }
}

// (a new seat's: the first free one)
function freeIndex() {
  return [1, 2, 3].find((i) => !seats.some((seat) => seat.index === i));
}

// A new seat, on controller padIndex: its farmer waits (hidden) till they
// have said who they are
function addSeat(padIndex) {
  const seat = newSeat(freeIndex());
  seat.uid = ++seatsEver;
  seat.padIndex = padIndex;
  seat.root.classList.add('choosing');
  seatsEl.append(seat.root);
  makeSeat(seat);
  seat.pad.ignoreHeld(); // (the press it joined with: not one on its window)
  seats.push(seat);
  seats.sort((a, b) => a.index - b.index);
  layout();
  within(seat, () => {
    playerMesh.visible = false;
    hud.showHome();
    putDown(besideFirst(seat));
  });
  placeChest(); // (its window onto the chest: what is in it, and whose it is)
  seat.panel.choose(playerChoices());
  return seat;
}

// Everything a seat has of its own (the first seat's are made as the code gets to them)
function makeSeat(seat) {
  seat.camera = newCamera();
  seat.camTarget = new THREE.Vector3();
  seat.camOffset = new THREE.Vector3();
  seat.inventory = newInventory(seat);
  seat.skills = newSkills(seat);
  seat.pettedOn = new WeakMap();
  seat.chop = newChop();
  seat.mine = newChop();
  seat.knock = new THREE.Vector3();
  seat.player = newBody();
  seat.lastGoodSpot = new THREE.Vector3().copy(seat.player.position);
  makeFarmer(seat);
  seat.keys = new Set();
  seat.glider = createGlider(seat.farmer);
  seat.marker = newMarker();
  seat.tileCursor = newTileCursor();
  seat.touch = NO_TOUCH;
  seat.pad = newPad(seat);
  seat.hud = newHud(seat);
  seat.guide = NO_GUIDE;
  seat.fishLog = createFishLog();
  seat.book = newBook(seat);
  seat.fishing = newFishing(seat);
  seat.bosses = newBosses(seat);
  seat.shop = newShop(seat);
  seat.npcs = newNpcs(seat);
  seat.dialog = newDialog(seat);
  seat.readyNoted = new Set();
  seat.chest = newChest(seat);
  seat.trade = newTrade(seat);
  seat.workbench = newWorkbench(seat);
  seat.arcade = newArcade(seat);
  seat.learned = new Set();
  seat.cooking = newCooking(seat);
  seat.tag = el('div', 'seat-tag', seat.root);
  seat.panel = new SeatPanel({
    parent: seat.root,
    n: seat.index + 1,
    onPick: (profile) => seatFarmer(seat, profile),
    onLogin: async ({ username, password }) => {
      // (the first farmer's own account: turned down before this browser gets another token for it)
      if (username.toLowerCase() === farmSync.account()?.username.toLowerCase()) throw new Error(`That is ${seatName(first)}'s own farmer, playing already`);
      return seatFarmer(seat, await logInPlayer(username, password));
    },
    onGuest: ({ name, color }) => seatFarmer(seat, newGuest(name, color)),
    onForget: (profile) => forgetPlayer(profile.id),
    onLeave: () => dropSeat(seat),
  });
}

// The seats whose farmers are out on the farm (not one still saying who they are, hidden)
const farmersHere = () => seats.filter((seat) => seat === first || seat.profile);

// The farmers played here before, who aren't at the screen now (nor the first seat's own)
const playerChoices = () => rememberedPlayers().filter((p) => p.id !== farmSync.id() && !seats.some((seat) => seat.profile?.id === p.id));

// Where a new farmer stands: beside the first one
const besideFirst = (seat) => ({ x: first.player.position.x + 0.8 * seat.index, y: first.player.position.y, z: first.player.position.z + 0.6 });

// Who a seat's farmer is, by name
function seatName(seat) {
  if (seat === first) return farmSync.account()?.username ?? 'Player 1';
  return seat.profile?.name ?? `Player ${seat.index + 1}`;
}

// A seat's farmer is `profile`'s (src/net/players.js): theirs out of their
// save (a new guest: a starter kit), on the farm beside the first farmer.
// Throws with why not.
async function seatFarmer(seat, profile) {
  if (profile.kind === 'account' && profile.farm.id === farmSync.id()) throw new Error(`That is ${seatName(first)}'s own farmer, playing already`);
  // (one farmer in one seat: two at once would each save over the other's)
  if (seats.some((other) => other.profile?.id === profile.id || (other !== seat && other.fetching === profile.id))) throw new Error(`${profile.name} is playing already`);
  if (seat.fetching) throw new Error('One farmer at a time: still fetching the last one');
  seat.fetching = profile.id;
  const sync = new PlayerSync(profile, { onLost: (why) => within(seat, () => inventory.notify(why)) });
  let save;
  try {
    save = await sync.open();
  } finally {
    seat.fetching = null;
  }
  if (save?.v > SAVE_VERSION || !seats.includes(seat)) {
    sync.close(); // (nothing of theirs is saved from here)
    if (seats.includes(seat)) throw new Error(`${profile.name}'s farmer was saved by a newer version of the game: reload the page to play them`);
    return; // (they got up meanwhile)
  }
  try {
    within(seat, () => {
      if (save?.v >= 1) useCharacter(save);
      else {
        inventory.restore({ slots: [], gold: 0, selected: 0 }); // (a new guest: nothing from an attempt before)
        for (const [item, count] of STARTER_KIT) gift(item, count);
      }
      dress(profile.color ?? PLAYER_COLORS[seat.index], profile.look ?? DEFAULT_LOOK);
    });
  } catch (e) {
    console.error(e);
    sync.close(); // (their save as it is: not this one, half loaded)
    throw new Error(`${profile.name}'s farmer couldn't be loaded here`);
  }
  // (on a farm played in its room: on it with their line, before they play)
  try {
    await connectSeat(seat, profile);
  } catch (e) {
    sync.close();
    throw e;
  }
  if (!seats.includes(seat)) return void sync.close(); // (they got up meanwhile)
  Object.assign(seat, { profile, sync, ownFarm: save?.farm ?? null }); // (from here on, saved back to them)
  within(seat, () => {
    playerMesh.visible = true;
    putDown(besideFirst(seat));
    inventory.notify(`Welcome to the farm, ${profile.name}!`);
  });
  seat.root.classList.remove('choosing');
  seat.panel.hide();
  showMends();
  showTags();
  saveSeat(seat);
}

// A farmer at this screen on a farm played with its helpers (in its room on
// the server): a player on it of their own, as the page's own is, with a line
// of their own to it. The room has them as the owner's guest: the owner's say,
// not a helper of the farm (shared/protocol.js JOIN local). The page's own
// line says the farm; theirs is for what they do and what is said to them.
// Resolves once the room has them, or throws with why not.
function connectSeat(seat, profile = seat.profile) {
  if (seat === first || seat.room || !profile || !farmNet || !farmVisit?.mine) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const conn = (seat.room = new Connection({ name: profile.name, color: profile.color, look: profile.look, farm: farmVisit.id, auth: farmSync.auth(), seat: seat.uid }));
    let welcomed = false;
    const timer = setTimeout(() => !welcomed && conn.end('The farm is not answering.'), 8000);
    const on = (type, fn) => conn.on(type, (m) => seat.room === conn && within(seat, () => fn(m)));
    on(S.FARM, (m) => {
      seat.netId = m.id; // (what the room calls them: its BUILT, FELLED and the rest are by this)
      if (welcomed) return;
      welcomed = true;
      clearTimeout(timer);
      resolve();
    });
    farmPrivate(on);
    conn.on('closed', ({ reason }) => {
      clearTimeout(timer);
      if (seat.room === conn) {
        seat.room = null;
        seat.netId = undefined;
      }
      if (!welcomed) {
        welcomed = true;
        reject(new Error(reason));
      } else if (seats.includes(seat)) dropSeat(seat, `${seatName(seat)} got up: ${reason}`);
    });
  });
}

// Every farmer at this screen with a farmer of their own: onto the room's farm
function connectSeats() {
  for (const seat of seats) connectSeat(seat).catch((e) => seats.includes(seat) && dropSeat(seat, `${seatName(seat)} got up: ${e.message}`));
}

// ...and, off it, off their lines
function disconnectSeats() {
  for (const seat of seats) {
    seat.room?.leave();
    seat.room = null;
    seat.netId = undefined;
  }
}

// A seat's farmer, saved back to them (their farm as it was: theirs stays where it is)
function saveSeat(seat) {
  seat.sync?.push({ v: SAVE_VERSION, farm: seat.ownFarm, ...within(seat, character) });
}

// A farmer gets up from the screen (why: what everyone is told, if they are)
function dropSeat(seat, why = '') {
  if (seat === first || !seats.includes(seat)) return;
  seat.room?.leave(); // (their line to the farm's room: they are not on it any more)
  seat.room = null;
  const save = seat.profile && { v: SAVE_VERSION, farm: seat.ownFarm, ...within(seat, character) };
  within(seat, () => {
    if (building) stopBuilding();
    fishing.dispose();
    bosses.leave();
  });
  seats.splice(seats.indexOf(seat), 1);
  scene.remove(seat.playerMesh, seat.marker, seat.tileCursor);
  seat.nameTag?.material.map.dispose();
  seat.nameTag?.material.dispose();
  clearInterval(seat.hud.tipTimer); // (its HUD's hints, going round)
  if (dayNight.glow.parent === seat.playerMesh) first.playerMesh.add(dayNight.glow);
  seat.root.remove();
  layout();
  showMends();
  if (seat.profile) first.inventory.notify(why || `${seat.profile.name} got up from the screen: their farmer is saved`);
  seat.sync?.close(save);
}

// Everyone but the first farmer gets up (heading online, say)
function endCoop(why) {
  for (const seat of [...seats]) dropSeat(seat, why);
  stopJoin();
}

// Whose each part of a split screen is (a name in its corner), and the name
// over each farmer (seen in everyone's view but their own: lookFrom)
function showTags() {
  const split = seats.length > 1;
  for (const seat of seats) {
    const color = seat === first ? myColor() : seat.profile?.color ?? 0xffffff;
    if (!seat.tag) seat.tag = el('div', 'seat-tag', seat.root);
    seat.tag.textContent = '';
    el('i', 'ui-dot', seat.tag).style.background = hexColor(color);
    seat.tag.append(seatName(seat));
    const name = split && (seat === first || seat.profile) ? `${seatName(seat)}:${color}` : '';
    if (seat.nameTag?.userData.name === name) continue;
    if (seat.nameTag) {
      seat.playerMesh.remove(seat.nameTag);
      seat.nameTag.material.map.dispose();
      seat.nameTag.material.dispose();
      seat.nameTag = null;
    }
    if (!name) continue;
    seat.nameTag = makeNameTag(seatName(seat), color);
    seat.nameTag.userData.name = name;
    seat.playerMesh.add(seat.nameTag);
  }
}

// The controller a seat reads: its own (padIndex); the first seat's, playing
// alone without one of its own (or with it gone), the first connected (as it always was)
function pickPad(seat, pads) {
  const own = seat.padIndex !== null && pads[seat.padIndex];
  if (own?.connected) return own;
  if (seat !== first || seats.length > 1 || joining) return null;
  return pads.find((p) => p?.connected) ?? null; // (alone, without one of their own: any)
}

// Each seat's part of the screen: all of it, alone; two side by side (one
// over the other on a screen taller than wide); three or four, its quarters
function layout() {
  const { innerWidth: w, innerHeight: h } = window;
  const n = seats.length;
  const wide = w >= h;
  const cells = n === 1 ? [[0, 0, 1, 1]]
    : n === 2 ? (wide ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]])
    : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
  // (a line of the gap's color between the parts: each loses a pixel at an edge it shares)
  const px = ([cx, cy, cw, ch]) => {
    const [x0, y0, x1, y1] = [Math.round(cx * w), Math.round(cy * h), Math.round((cx + cw) * w), Math.round((cy + ch) * h)];
    const [l, t, r, b] = [x0 + (x0 > 0), y0 + (y0 > 0), x1 - (x1 < w), y1 - (y1 < h)];
    return { x: l, y: t, w: r - l, h: b - t };
  };
  // (three or four: each in their own quarter, by their seat, so no one's moves when another gets up)
  const cellOf = (seat, i) => (n > 2 ? seat.index : i);
  const part = px(cells[0]);
  fitPart(n > 1 ? part : null); // (small parts: laid out as a small screen is, html.compact)
  seats.forEach((seat, i) => {
    seat.rect = px(cells[cellOf(seat, i)]);
    Object.assign(seat.root.style, { left: `${seat.rect.x}px`, top: `${seat.rect.y}px`, width: `${seat.rect.w}px`, height: `${seat.rect.h}px` });
    seat.root.classList.toggle('by-clock', seat.rect.y === 0 && seat.rect.x + seat.rect.w === w); // (the clock is over its top right: daynight.js)
    within(seat, fitCamera);
  });
  const spare = n === 3 && px(cells[[0, 1, 2, 3].find((c) => !seats.some((seat, i) => cellOf(seat, i) === c))]);
  Object.assign(joinEl.style, spare ? { left: `${spare.x}px`, top: `${spare.y}px`, width: `${spare.w}px`, height: `${spare.h}px` } : { left: '', top: '', width: '', height: '' });
  seatsEl.classList.toggle('split', n > 1);
  renderer.setSize(w, h);
  post.setSize();
  showJoinHint();
  showTags();
}

// ---------- Game loop ----------
const clock = new THREE.Clock();
playerMesh.add(dayNight.glow); // night-time glow follows the player (in a split screen, each one's in their own view: lookFrom)

// Each frame: each seat's farmer, then the world they are all in
function update(dt) {
  watchJoin();
  for (const seat of [...seats]) if (seats.includes(seat)) within(seat, () => updateSeat(dt)); // (one may get up meanwhile: their menu's button)
  updateWorld(dt);
}

// A seat's farmer, each frame: its input, its moving about, what it is doing
function updateSeat(dt) {
  pad.poll(dt); // (its buttons press their keys, before the keys are read)
  if (!seats.includes(me)) return; // (they got up from the screen with it, from their menu: saved as they were)
  if (inputBlocked()) keys.clear();
  syncLook();

  // Horizontal input -> world-space movement (camera-relative, simplified to world axes)
  let moveX = 0;
  let moveZ = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
  if (!inputBlocked()) {
    for (const stick of [touch.direction(), pad.direction()]) {
      // (part way over: a slower walk)
      moveX += stick.x;
      moveZ += stick.z;
    }
  }
  if (lookYaw !== null && (moveX || moveZ)) {
    // (first person: up is the way they look, not north)
    const [fx, fz] = [Math.sin(lookYaw), Math.cos(lookYaw)];
    [moveX, moveZ] = [-fz * moveX - fx * moveZ, fx * moveX - fz * moveZ];
  }
  if (moveX || moveZ || inputBlocked()) stopWalking(); // the stick or the keys take over from a tap
  else if (held && !building) ({ x: moveX, z: moveZ } = followMouse(dt));
  else ({ x: moveX, z: moveZ } = steer(dt));

  const moveVec = new THREE.Vector3(moveX, 0, moveZ);
  const moving = moveVec.lengthSq() > 0;
  me.moving = moving; // (the animals scurry off from a farmer on the move)
  if (moving) moveVec.multiplyScalar((MOVE_SPEED * devSpeed * (arenaId ? 1 : bosses.speed()) * boostOf(meal, 'speed') * Math.min(moveVec.length(), 1)) / moveVec.length()); // (dizzy from a boss: slower; riding, or after a meal, maybe faster; in a party game's arena everyone runs alike)
  player.velocity.x = moveVec.x + knock.x;
  player.velocity.z = moveVec.z + knock.z;
  knock.multiplyScalar(Math.exp(-dt * 5)); // (a bop's stumble fades)

  if (player.onGround) {
    airTime = 0;
    airJumps = skills.canDoubleJump() ? 1 : 0;
  } else airTime += dt;
  if (!inputBlocked()) {
    const offLedge = airTime < COYOTE_TIME && player.velocity.y <= 0;
    const buffered = clock.elapsedTime - jumpTappedAt < JUMP_BUFFER;
    if ((keys.has('Space') || jumpPressed || buffered) && (player.onGround || offLedge)) jump();
    else if (jumpTapped && airJumps > 0) airJump();
  }
  jumpPressed = false;
  jumpTapped = false;

  // Gravity (gently, gliding)
  player.velocity.y += GRAVITY * dt;
  const glide = !player.onGround && player.velocity.y < 0 && keys.has('Space') && !inputBlocked() && inventory.count('glider_leaf') > 0;
  if (glide && !gliding) sound.play('glide');
  gliding = glide;
  if (gliding) {
    player.velocity.y = Math.max(player.velocity.y, -GLIDE.fall);
    player.velocity.x += weather.wind.x; // (a storm's wind takes a glider with it: src/weather.js)
    player.velocity.z += weather.wind.z;
  }
  glider.update(dt, gliding, clock.elapsedTime);

  const prevY = player.position.y;
  const wasOnGround = player.onGround;
  const fallSpeed = -player.velocity.y;
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  player.position.y += player.velocity.y * dt;

  resolveCollisions(prevY, wasOnGround);
  const under = player.onGround ? player.standingOn : null;
  if (under?.plant && under !== landedOn) landOnPlant(under); // (a bounce shroom, a lily leaf)
  landedOn = under;
  if (player.onGround && !wasOnGround) {
    anim.squash = Math.min(fallSpeed / 20, 1) * 0.3; // squash on landing
    jumpRising = false;
    if (fallSpeed > 4) sound.play('land');
  }
  // footsteps, walking on something
  stepTimer -= dt;
  if (moving && player.onGround && stepTimer <= 0) {
    sound.play('step');
    stepTimer = STEP_EVERY / THREE.MathUtils.clamp(moveVec.length() / MOVE_SPEED, 0.5, 1.5);
  }

  // Fell off the world -> respawn on the plaza
  if (player.position.y < -20) {
    player.position.set(world.spawn.x, GROUND_STAND_Y + 1, world.spawn.z);
    player.velocity.set(0, 0, 0);
  }
  // Lost (a position or speed that isn't a number: the camera follows it into
  // nowhere and only the sky shows, for good) -> back where they last were
  const p = player.position;
  const v = player.velocity;
  if (![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) {
    player.position.copy(lastGoodSpot);
    player.velocity.set(0, 0, 0);
    knock.set(0, 0, 0);
    stopWalking();
    snapCamera();
  } else lastGoodSpot.copy(player.position);

  playerMesh.position.copy(player.position);
  const lent = inContest() && holding() !== 'rod' && !weaponInHand(); // (a rod lent for a fishing contest, in place of a tool in hand; a sword still bops)
  hoeGroup.visible = !lent && holding() === 'hoe'; // only hold a tool while it's selected
  farmer.axe.visible = !lent && holding() === 'axe';
  farmer.pick.visible = !lent && holding() === 'pickaxe';
  farmer.sword.visible = !lent && SWORDS.includes(inventory.selectedId());
  if (farmer.sword.visible) farmer.setSword(ITEMS[inventory.selectedId()].color);
  farmer.mallet.visible = !lent && inventory.selectedId() === 'mallet';
  farmer.bow.visible = !lent && inventory.selectedId() === 'bow';
  farmer.rod.visible = lent || holding() === 'rod';
  if (farmer.rod.visible) farmer.setRod(ITEMS[lent ? 'fishing_rod' : inventory.selectedId()].color);
  farmer.can.visible = !lent && holding() === 'can';
  if (farmer.can.visible) farmer.setCan(ITEMS[inventory.selectedId()].color);
  animateCharacter(dt, moving);
  updateTileCursor(moving);
  updateHover();

  const t = clock.elapsedTime;
  fishing.update(t);
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
    countDown(); // (a loot run's, in the stone circle)
    sendState(dt);
    remotes.update(dt, t);
  } else {
    npcs.updateSigns(dt); // (what the neighbours have for this farmer, over their heads)
    if (place === 'home') {
      watchRequests(dt);
      updateChopping();
      updateMining();
      hud.setPrompt(building ? updateBuilding() : homePrompt());
    }
    if (farmVisit) {
      updateDrops(dt, t);
      sendState(dt, roomLine());
    }
  }
  bosses.update(dt, t); // (what the bosses and the dungeons mean for this farmer)
  if (me === first ? splash.hidden : true) guide.update(dt, guideState());
  underground = bosses.underground().k;
  updateMeal(dt);
  if (place === 'title') updateMenuCamera(t);
  else updateCamera(dt);
  showCrosshair();
  // (where its view's trees fade out of the way, between the camera and here)
  me.eye.set(player.position.x, player.position.y + 0.3, player.position.z);
}

// First person: a dot in the middle of the view; the first farmer, with the
// mouse, also told how to take it. The mouse is given back to a menu.
function showCrosshair() {
  if (!me.cross) {
    me.cross = el('div', 'view-cross', me.root);
    me.crossHint = el('div', 'view-hint', me.cross, 'Click to look round');
  }
  me.cross.hidden = lookYaw === null || inMenus();
  me.crossHint.hidden = me !== first || isTouch() || padInUse() || mouseLocked();
  if (me === first && mouseLocked() && (lookYaw === null || inMenus())) document.exitPointerLock();
}

// The world, each frame (after each seat's farmer: the first seat's own are in place)
function updateWorld(dt) {
  const t = clock.elapsedTime;
  ripples.update(dt);
  puffs.update(dt);
  arrows.update(dt);
  fishShadows.update(dt, fishing.bobber());
  world.updateTrees(dt);
  if (place !== 'lobby') {
    merchant.update(dt, t, nearestFarmer(merchant.root.position));
    npcs.update(dt, t, farmersHere().map((seat) => seat.player.position), dayNight.hour(), npcs.signs());
    npcHomes.animate(t);
    chestModel.update(dt, seats.some((seat) => seat.chestWindow.isOpen()));
  }

  if (farmVisit) remotes.update(dt, t); // (the helpers on the farm: once a frame, whoever is at the screen)
  const playing = seats.some((seat) => within(seat, () => !inputBlocked())); // (anyone, not behind a menu)
  farmFinds.update(dt, t, { active: place === 'home' && !farmVisit && farmOnScreen, counting: playing, at: farmersHere().map((seat) => seat.player.position) });
  regrowFarm();
  rollFarmGiants();
  bossWorld.update(dt, t);
  giantBars.update(t);
  gfx.frame(dt, { wind: weather.wind, players: seats.map((seat) => seat.player.position) }); // (the shaders' clock: the grass sways harder in a storm's wind)
  world.updateTreeFade(dt, me.eye, camera, seats.map((seat) => [seat.eye, seat.camera]));
  if (place === 'lobby') updateSkyFade(dt, me.eye, camera); // (and sky isles over us: src/skyisles.js)
  world.update(t);
  water.position.y = WATER_Y + Math.sin(t * 0.8) * 0.03;

  // At home, time stops while the backpack or the menu is open and holding T
  // fast-forwards it. In a lobby the time of day is everyone's, so it just
  // runs; so it does on a farm with helpers (the owner, alone on it, may
  // still fast-forward it).
  const atHome = place !== 'lobby' && !farmVisit;
  presence.where(place === 'lobby' ? 'lobby' : farmVisit ? 'farm' : 'home'); // (for friends' lists)
  // (anyone at the screen holding T; and the clock stops only while everyone is in a menu)
  const fastForward = seats.some((seat) => seat.keys.has('KeyT')) && place !== 'lobby' && (!farmVisit || (farmVisit.mine && farmVisit.alone));
  const allInMenus = seats.every((seat) => within(seat, () => menuOpen() || (seat === first && !splash.hidden)));
  const hoursBefore = dayNight.day() * 24 + dayNight.hour() - devJump; // (and the developer tools' jump, as if it passed now)
  devJump = 0;
  // down in a boss's dungeon: no sky, no sea, a dim light of its own
  const cave = bosses.underground();
  dayNight.setUnderground(cave.k, cave.light);
  water.visible = cave.k < 0.5;
  dayNight.update(dt, {
    paused: atHome && allInMenus,
    fastForward,
    focus: player.position,
  });
  sound.music(dayNight.isNight() ? 'night' : 'day'); // (sound.js: the tune, by the time of day)
  if (farmVisit?.mine) sendFarmClock(fastForward, t);
  // Crops grow on game time, so they pause and fast-forward with the clock
  const gameDt = ((dayNight.day() * 24 + dayNight.hour() - hoursBefore) * DAY_LENGTH_SECONDS) / 24;
  updateCrops(dt, gameDt, t);
  if (place === 'home') rainOnCrops(hoursBefore - 24, farmHours()); // (hoursBefore counts from day 1's end)
  buildings.setNight(dayNight.night(), player.position);
  const season = place !== 'lobby' ? seasons.update(dayNight.day(), dayNight.hour(), dayNight.night()) : null; // (a lobby's island keeps its own)
  const sky = weather.update(dt, { hours: place !== 'lobby' ? farmHours() : null, focus: player.position, snowy: season === 'Winter', indoors: indoors() || cave.k > 0.5 });
  dayNight.setNote(season && (sky ? `${season} · ${sky}` : season));
  machines.update(farmHours(), t, dt);
  houseRoom.setNight(dayNight.night());
  npcHomes.setNight(dayNight.night());
  houseRoom.update(t, farmersHere().map((seat) => seat.player.position));
  seasons.frame(dt, { home: place !== 'lobby', focus: indoors() || cave.k > 0.5 ? null : player.position });
  lightFarmers(hemi.color, 0.3 * hemi.intensity); // (their edges catch the sky's light)
  if (place !== 'lobby') {
    animals.update(dt, t, {
      hours: farmHours(),
      players: farmersHere().map((seat) => ({
        pos: seat.player.position,
        moving: seat.moving,
        onGround: seat.player.onGround,
        collect: seated(seat, collectProduce), // (the eggs)
      })),
    });
  }
}

// The farmer at the screen nearest `at` (where they are)
const nearestFarmer = (at) => farmersHere().map((seat) => seat.player.position).reduce((a, b) => (Math.hypot(b.x - at.x, b.z - at.z) < Math.hypot(a.x - at.x, a.z - at.z) ? b : a));

// What E does here at home, for the prompt
function homePrompt() {
  if (menuOpen()) return '';
  if (farmVisit?.visitor) return lookRoundPrompt();
  const boss = bosses.prompt();
  if (boss || bosses.inArena()) return boss;
  const npc = npcPrompt();
  if (npc) return npc;
  const fish = fishing.prompt();
  if (fish) return fish;
  if (buildings.nearest('workbench', player.position, BENCH_REACH)) return 'E  Use the workbench';
  if (buildings.nearest('arcade', player.position, BENCH_REACH)) return 'E  Play at the arcade';
  if (houseRoom.wardrobeInReach(player.position)) return 'E  Change clothes';
  if (houseRoom.kitchenInReach(player.position)) return 'E  Cook in the kitchen';
  if (houseRoom.shelfInReach(player.position)) return 'E  Read your recipe book';
  const machine = machines.nearest(player.position);
  if (machine) return machinePrompt(machine);
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

let frozen = false; // (testing: the game moves only by __game.step, below)
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!frozen) {
    update(dt);
    draw();
  }
  requestAnimationFrame(animate);
}

// Each seat's view, in its part of the screen (alone: all of it): through the
// post chain (src/gfx/post.js, which sets each seat's part of its target and
// calls seatView), or on the low tier straight to the screen
function draw() {
  gfxStats.reset(); // (the frame's count starts here: every seat's view and every post pass adds to it)
  if (post.on) return post.render();
  const split = seats.length > 1;
  const { innerWidth: w, innerHeight: h } = window;
  renderer.setScissorTest(split);
  renderer.setViewport(0, 0, w, h);
  if (split) {
    renderer.setScissor(0, 0, w, h);
    renderer.setClearColor(SPLIT_GAP);
    renderer.clear();
  }
  for (const seat of seats) {
    const { x, y, w: vw, h: vh } = seat.rect;
    if (split) {
      renderer.setViewport(x, h - y - vh, vw, vh);
      renderer.setScissor(x, h - y - vh, vw, vh);
    }
    seatView(seat, split);
  }
}

// One seat's view, into the part of the screen (or of the post chain's target) set for it
function seatView(seat, split) {
  within(seat, () => {
    lookFrom(split);
    // (first person: not their own body in their eyes; its night light stays)
    const body = lookYaw === null ? [] : playerMesh.children.filter((part) => part.visible && !part.isLight);
    for (const part of body) part.visible = false;
    renderer.render(scene, camera);
    for (const part of body) part.visible = true;
  });
}

// Testing: `seconds` of game time, in steps of `dt`, as fast as they compute
// (nothing is drawn: draw() for a screenshot), whatever the frame rate.
// Freezes the game between steps, so what a test sees is what its steps did.
function step(seconds, dt = 1 / 30) {
  frozen = true;
  clock.getDelta(); // (the time spent frozen doesn't count)
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    clock.elapsedTime += dt;
    update(dt);
  }
}

// Testing: hold a key (a KeyboardEvent code: 'Space', 'KeyD', ...) for
// `seconds` of game time
function hold(code, seconds) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  step(seconds);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

// Testing (scripts/shots.mjs): the farmer somewhere on the farm at once, the
// camera with them: 'plaza', 'lake' (on its south shore, looking over it),
// 'house' (in front of its door; with none built yet, the nearest
// neighbour's), 'forest' (the thickest trees near the plaza, to the north),
// 'dungeon' (the first boss's first room), or { x, z }. Returns where, or
// null off the farm.
function warp(where) {
  if (place !== 'home') return null;
  const house = buildings.find('house');
  const neighbour = () => {
    const dist = (id) => Math.hypot(npcs.outside(id).x - world.spawn.x, npcs.outside(id).z - world.spawn.z);
    const { x, z } = npcs.outside(NPC_IDS.reduce((a, id) => (dist(id) < dist(a) ? id : a)));
    return { x, z: z + 1.5 };
  };
  const forest = () => {
    const north = world.trees.filter((t) => t.z < world.spawn.z - 6 && Math.hypot(t.x - world.spawn.x, t.z - world.spawn.z) < 45);
    const around = (t) => north.filter((o) => Math.hypot(o.x - t.x, o.z - t.z) < 6).length;
    const best = north.reduce((a, t) => (!a || around(t) > around(a) ? t : a), null);
    return best ? { x: best.x, z: best.z + 5 } : arrival();
  };
  const at = typeof where === 'object' ? where
    : where === 'dungeon' ? dungeonStart(BOSS_IDS[0])
    : where === 'lake' ? { x: LAKE.x, z: LAKE.z + LAKE.r + 3 }
    : where === 'house' ? (house ? (({ x, z }) => ({ x, z: z + 2.5 }))(houseDoorAt(house)) : neighbour())
    : where === 'forest' ? forest()
    : arrival();
  putDown({ x: at.x, y: GROUND_STAND_Y, z: at.z });
  return { x: at.x, z: at.z };
}

// Built pages: installable, and the farm opens without a connection (public/sw.js).
// (Not under Vite's dev server, where a cached page would hide every change.)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Dev builds only: a handle for poking at the game from the browser console
if (import.meta.env.DEV) {
  window.__game = { npcs, dialog, npcHomes, farmFinds, useAction, bosses, farmer, goHome, arrows, step, hold, freeze: (on = true) => (frozen = on), draw, sound, get inGame() { return splash.hidden; }, player, spots, drops, remotes, inventory, shop, chest, animals, buildings, workbench, upgrade, machines, learned, useMachine, cooking, fishLog, joinLobby, get partyGame() { return partyGame; }, get meal() { return meal; }, dayNight, fishing, saveGame, camera, farmSync, get farmLevels() { return farmLevels; }, get place() { return place; }, get net() { return net; }, get farmNet() { return farmNet; }, get farmVisit() { return farmVisit; }, get world() { return world; }, crops, farmTiles, weather, tradeSpot: TRADE_SPOT, seats, addSeat, dropSeat, seatFarmer, newGuest, startJoin, within, layout, snapCamera, warp, stats: gfxStats.stats, post, view: viewMode, lookBy, get look() { return { yaw: lookYaw, pitch: lookPitch }; } };
}

loadGame();
layout();
splash.show({ from: 'title' });
openFarm();
animate();
