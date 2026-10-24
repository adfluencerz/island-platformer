import * as THREE from 'three';
import { BOSSES, BOSS_FIGHT, WEAPONS, MOUNTS, DUNGEONS, DUNGEON } from '../shared/balance.js';
import { GROUND_STAND_Y } from '../shared/level.js';
import { C } from '../shared/protocol.js';
import {
  BossFight, BOSS_IDS, BODY_R, arenaAt, arenaStart, arenaExit, portalOf, portalBoss, bossFromWire,
  rollHits, swoopHits, waveHits, seedAt, seedHits, swarmAt, swarmHits,
} from '../shared/bosses.js';
import { DungeonRun, ROOMS, FOE_R, dungeonAt, roomAt, roomEntry, dungeonStart, dungeonExit, dungeonFromWire, foeHits } from '../shared/dungeons.js';
import { ITEMS } from './items.js';
import { createArenas } from './arena.js';
import { createDungeons } from './dungeon.js';
import { createBossView, dizzyStars } from './bossview.js';
import { createMount } from './mounts.js';
import { damp } from './character.js';
import { TILE_SIZE } from './world.js';

// ---------- The bosses, on the page ----------
// A boss's portal on the farm (built from a full set of its key pieces: the
// Build tab) leads to its dungeon (src/dungeon.js, shared/dungeons.js), out
// past the sea on the farm's world, and through that to its arena
// (src/arena.js); a portal by the dungeon's way in, and one in the arena,
// lead home. In the dungeon, E with a sword or the mallet in hand bops the
// nearest foe in the room, and the bow shoots at one further off; the gate
// on opens once the room's foes are all down, and the last one onto the
// bridge into the arena. In there, the same bops the boss (shared/bosses.js
// has how it fights). Its moves catch a farmer who isn't quick, and so do the
// foes: knocked back and dizzy for a moment (slower, no bopping), and after
// BOSS_FIGHT.hitsOut of those, back at the start of the arena (or of the
// room) to have another go. Nobody gets hurt.
//
// On a farm with helpers the farm's room runs the fights and the dungeons,
// and says how they go (BOSS, BOSS_FX, BOSS_WON, DUNGEON, DUNGEON_FX); on a
// farm played alone this page runs them, by the same rules. Whether our own
// farmer got caught is always this page's.
//
// Beating a boss gives everyone who fought (src/main.js keeps it in the save,
// record()): its statue and its mount the first time, into the backpack (or
// as soon as there is room), and a shiny animal every time, on our own farm
// (now, or the next time we are home). Riding a mount is quicker than walking
// (MOUNTS in shared/balance.js): E with it in hand gets on or off, anywhere,
// and picking anything else gets off.
//
// ctx (from main.js): world (the farm's), player, farmer, inventory, hud,
// giantBars, buildings, myId(), net() (the farm's room, null playing alone),
// atHome(), weapon() (the weapon in hand), putDown(pos), knock(dx, dz,
// speed), arrival(), removePortal(boss) (playing alone: it is used up),
// farmIsOurs() (our own farm, its animals ours to drive), addShiny(kind),
// save()

const PORTAL_REACH = 1.3;
const EXIT_REACH = 1.5;
const OUT_DELAY = 0.7; // seconds from the last catch to being back at the start
const PAY_EVERY = 2; // seconds between looks for room for what we are owed
const _top = new THREE.Vector3();
const _seed = {};

export function createBosses(ctx) {
  const { player, farmer, inventory, hud } = ctx;
  const arenas = createArenas(ctx.world);
  // boss -> { s: as the room (or our own fight) last had it, at: when, shown: where it is drawn, view }
  const bosses = new Map(BOSS_IDS.map((id) => [id, { s: null, at: 0, shown: null, view: createBossView(ctx.world.root, id) }]));
  const alone = new Map(); // boss -> its BossFight, on a farm played alone
  const dungeonView = createDungeons(ctx.world);
  // boss -> { s: its dungeon as the room (or our own run) last had it (dungeonFromWire), shown: where each foe is drawn }
  const dungeons = new Map(BOSS_IDS.map((id) => [id, { s: null, shown: [] }]));
  const aloneRuns = new Map(); // boss -> its DungeonRun, on a farm played alone
  let rec = { won: {}, shinies: [], owed: [] }; // (record())
  let hits = 0; // times its boss (or the foes) caught us since we came into the arena or the dungeon (or were last sent back)
  let graceUntil = 0;
  let dizzyUntil = 0;
  let outAt = 0; // (sent back to the start at this time)
  let sendBack = null; // (...by this)
  let lastArena = null; // (the arena we were in last frame, and the dungeon's room)
  let lastRoom = null;
  let bopReady = 0;
  let payAt = 0;
  const _to = new THREE.Vector3(); // (where an arrow of ours flies)
  let now = 0; // (the clock, as of the last update)
  let riding = null; // the mount we are on (a boss's id)
  const stars = dizzyStars(3, 0.38, 0.28);
  stars.group.position.y = 1.15;
  stars.group.visible = false;
  farmer.root.add(stars.group);

  const name = (id) => BOSSES[id].name.toLowerCase();
  const here = () => (ctx.atHome() ? arenaAt(player.position.x, player.position.z) : null);
  const inDungeon = () => (ctx.atHome() ? dungeonAt(player.position.x, player.position.z) : null);
  const me = () => ctx.myId() ?? 0;

  // the portal on the farm whose front we are at: its boss, or null
  function portalInReach() {
    if (!ctx.atHome() || player.position.y > 2.2) return null;
    for (const id of BOSS_IDS) {
      for (const key of ctx.buildings.findAll(portalOf(id))) {
        const [gx, gz] = key.split(',').map(Number);
        if (Math.hypot(player.position.x - gx * TILE_SIZE, player.position.z - (gz + 0.6) * TILE_SIZE) < PORTAL_REACH) return id;
      }
    }
    return null;
  }

  // the way home we are at (the arena's, or the dungeon's): its boss, or null
  function exitInReach() {
    const id = here() ?? inDungeon();
    if (!id || player.position.y > 2.2) return null;
    const exit = here() ? arenaExit(id) : dungeonExit(id);
    return Math.hypot(player.position.x - exit.x, player.position.z - exit.z) < EXIT_REACH ? id : null;
  }

  // Through its portal on the farm: into its dungeon
  function enter(id) {
    ctx.putDown({ ...dungeonStart(id), y: GROUND_STAND_Y });
    farmer.anim.facing = Math.PI; // (in, away from the camera)
    hits = 0;
    lastRoom = `${id}:0`; // (what to do is said here)
    const { name: where, foe } = DUNGEONS[id];
    if (bosses.get(id).s?.phase === 'friendly') inventory.notify(`The ${name(id)} is friendly now`);
    else if ((dungeons.get(id).s?.cleared ?? 0) >= ROOMS) inventory.notify(`The ${where}: the way to the ${name(id)} is open`);
    else if (!Object.keys(WEAPONS).some((w) => inventory.count(w))) inventory.notify(`The ${where}! Bop the ${foe[1]} with a sword, a mallet or a bow (made at a workbench) to get through to the ${name(id)}`);
    else inventory.notify(`The ${where}! Bop the ${foe[1]} in each room to open the way on to the ${name(id)}`);
  }

  // Over the bridge into its arena
  function intoArena(id) {
    hits = 0;
    const b = bosses.get(id).s;
    if (b?.phase === 'friendly') inventory.notify(`The ${name(id)} is friendly now`);
    else inventory.notify(`Bop the ${name(id)} until it's dizzy! Jump its shockwaves and seeds`);
  }

  // Out in front of its portal on the farm (or, gone, where farmers arrive)
  function leave(id) {
    const key = ctx.buildings.find(portalOf(id));
    if (!key) return ctx.putDown(ctx.arrival());
    const [gx, gz] = key.split(',').map(Number);
    ctx.putDown({ x: gx * TILE_SIZE, y: GROUND_STAND_Y, z: (gz + 1.3) * TILE_SIZE });
    farmer.anim.facing = 0;
  }

  // ---------- What the fight says ----------
  function setState(id, s) {
    const boss = bosses.get(id);
    boss.s = s;
    boss.at = now;
    if (!s) {
      boss.view.clearFx();
      ctx.giantBars.remove('boss', id);
    } else if (!boss.shown || Math.hypot(s.x - boss.shown.x, s.z - boss.shown.z) > 4) {
      boss.shown = { x: s.x, y: s.y, z: s.z };
    }
  }

  function onFx(id, fx) {
    const boss = bosses.get(id);
    const ours = here() === id;
    if (fx.e === 'wave' || fx.e === 'seeds' || fx.e === 'swarm') boss.view.addFx(fx);
    else if (fx.e === 'bop') {
      boss.view.flinch();
      if (fx.by === me()) hud.flash('Bop!');
      else if (fx.shot && boss.s) ctx.shotFrom(fx.by, _to.set(boss.s.x, boss.s.y + 1, boss.s.z)); // (someone else's arrow)
    } else if (fx.e === 'wake' && ours) inventory.notify(`The ${name(id)} wakes up, grumpy!`);
    else if (fx.e === 'sleep') {
      boss.view.clearFx();
      if (ours) inventory.notify(`The ${name(id)} yawns and dozes off again`);
    }
  }

  function onWon(id, won) {
    bosses.get(id).view.clearFx();
    ctx.giantBars.remove('boss', id);
    if (won.includes(me())) reward(id);
    else if (here() === id) inventory.notify(`The ${name(id)} is friendly now!`);
  }

  // ---------- Getting caught ----------
  // by something at fromX, fromZ, knocked back at `knock`; after one catch
  // too many, back(): back to the start
  function caught(fromX, fromZ, back, knock = BOSS_FIGHT.knock) {
    hits++;
    graceUntil = now + BOSS_FIGHT.grace;
    dizzyUntil = now + BOSS_FIGHT.dizzy;
    let dx = player.position.x - fromX;
    let dz = player.position.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    ctx.knock(dx / d, dz / d, knock);
    hud.flash('Bonk!');
    if (hits >= BOSS_FIGHT.hitsOut) {
      outAt = now + OUT_DELAY;
      sendBack = back;
    }
  }

  // ...back to the start of the arena
  function arenaBack(id) {
    return () => {
      ctx.putDown({ ...arenaStart(id), y: GROUND_STAND_Y });
      farmer.anim.facing = Math.PI;
      inventory.notify(`The ${name(id)} bounced you back to the start: have another go!`);
    };
  }

  // ...or of the room in its dungeon
  function roomBack(id, k) {
    return () => {
      ctx.putDown({ ...roomEntry(id, k), y: GROUND_STAND_Y });
      farmer.anim.facing = Math.PI;
      inventory.notify(`The ${DUNGEONS[id].foe[1]} bounced you back to the start of the room: have another go!`);
    };
  }

  function checkHazards(id, b) {
    if (b.phase !== 'fight' || now < graceUntil || outAt) return;
    const { x, y, z } = player.position;
    const def = BOSSES[id];
    const back = arenaBack(id);
    if (rollHits(b, def, x, y, z) || swoopHits(b, def, x, y, z)) return caught(b.x, b.z, back);
    const { view } = bosses.get(id);
    for (const w of view.waves) if (waveHits(w.fx, w.age, x, y, z)) return caught(w.fx.x, w.fx.z, back);
    for (const s of view.seeds) {
      for (let i = 0; i < s.fx.n; i++) {
        if (seedHits(seedAt(s.fx, i, s.age, _seed), x, y, z)) return caught(s.fx.x, s.fx.z, back);
      }
    }
    for (const s of view.swarms) {
      for (let i = 0; i < s.fx.a.length; i++) {
        if (swarmHits(swarmAt(s.fx, i, s.age, _seed), x, y, z)) return caught(_seed.x - Math.sin(s.fx.a[i]), _seed.z - Math.cos(s.fx.a[i]), back);
      }
    }
  }

  // ---------- The dungeons ----------
  // A foe of the room we are in going at us, and touching us (where it is drawn)
  function checkFoes(id) {
    if (now < graceUntil || outAt) return;
    const { s, shown } = dungeons.get(id);
    if (!s) return;
    const { x, y, z } = player.position;
    const k = roomAt(id, x, z);
    for (const [i, f] of s.foes.entries()) {
      const at = shown[i];
      if (f.room !== k || !at || !foeHits({ ...f, ...at }, x, y, z)) continue;
      return caught(at.x, at.z, roomBack(id, k), DUNGEON.bump);
    }
  }

  // The foe of the room we are in to bop now: the nearest in reach (the
  // bow's: one we are more or less facing), or null; its number
  function foeInReach(id, weapon) {
    const { s, shown } = dungeons.get(id);
    if (!s || !WEAPONS[weapon]) return null;
    const { x, z } = player.position;
    const k = roomAt(id, x, z);
    const fx = Math.sin(farmer.anim.facing);
    const fz = Math.cos(farmer.anim.facing);
    let best = null;
    let bestD = WEAPONS[weapon].reach * 0.9 + FOE_R;
    for (const [i, f] of s.foes.entries()) {
      const at = shown[i];
      if (f.room !== k || f.state === 'down' || !at) continue;
      const dx = at.x - x;
      const dz = at.z - z;
      const d = Math.hypot(dx, dz);
      if (WEAPONS[weapon].shoots && d > 0.6 && (dx * fx + dz * fz) / d < 0.5) continue;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  // E in a dungeon: a bop (or a shot) at the nearest foe in the room, or at the air
  function bopFoe(id, weapon) {
    const { shoots, every, reach } = WEAPONS[weapon];
    if (now < dizzyUntil || now < bopReady || outAt) return;
    if (shoots && !inventory.count(shoots)) return inventory.notify('No arrows left: make some at a workbench, from wood and steel');
    bopReady = now + every / 1000;
    const i = foeInReach(id, weapon);
    const at = i === null ? null : dungeons.get(id).shown[i];
    if (at) farmer.anim.facing = Math.atan2(at.x - player.position.x, at.z - player.position.z);
    farmer.swing();
    if (shoots) {
      inventory.remove(shoots, 1);
      const { x, y, z } = player.position;
      const yaw = farmer.anim.facing;
      ctx.shoot(at ? _to.set(at.x, at.y + 0.45, at.z) : _to.set(x + Math.sin(yaw) * reach, y, z + Math.cos(yaw) * reach));
    }
    if (i === null) return;
    if (ctx.net()) return ctx.net().send({ t: C.FOE_BOP, boss: id, foe: i, weapon });
    const run = aloneRuns.get(id);
    const hit = run?.bop(me(), weapon, player.position.x, player.position.y, player.position.z, i);
    if (!hit) return;
    dungeons.get(id).s = dungeonFromWire(id, run.toWire());
    onDungeonFx(id, { e: 'bop', foe: i, by: me(), hp: hit.hp });
    if (hit.opened !== undefined) onDungeonFx(id, { e: 'open', room: hit.opened, by: me() });
  }

  function onDungeonFx(id, fx) {
    const ours = inDungeon() === id || here() === id;
    if (fx.e === 'bop' && Number.isInteger(fx.foe)) {
      dungeonView.flinch(id, fx.foe);
      if (fx.by === me()) hud.flash(fx.hp > 0 ? 'Bop!' : 'Poof!');
      else if (fx.shot && dungeonView.top(id, fx.foe, _to)) ctx.shotFrom(fx.by, _to); // (someone else's arrow)
    } else if (fx.e === 'open' && Number.isInteger(fx.room) && ours) {
      const last = fx.room >= ROOMS - 1;
      hud.flash(last ? 'The way is open!' : 'The gate is open!');
      inventory.notify(last ? `The last gate is open: over the bridge to the ${name(id)}!` : `The gate is open: on to the next room!`);
    } else if (fx.e === 'reset') {
      const d = dungeons.get(id);
      d.s = null;
      d.shown = [];
    }
  }

  // Into room k of its dungeon: how many foes are up in it, and what to do
  function roomNotice(id, k) {
    const s = dungeons.get(id).s ?? freshOf(id);
    const up = s.foes.filter((f) => f.room === k && f.state !== 'down').length;
    if (!up || k < s.cleared) return;
    const { foe } = DUNGEONS[id];
    inventory.notify(`${up} ${up > 1 ? foe[1] : foe[0]}! Bop ${up > 1 ? 'them all' : 'it'} to open the ${k >= ROOMS - 1 ? `way to the ${name(id)}` : 'gate'}`);
  }

  // A dungeon as it is before anyone comes (its foes all resting where they start)
  const fresh = new Map();
  function freshOf(id) {
    if (!fresh.has(id)) fresh.set(id, dungeonFromWire(id, new DungeonRun(id).toWire()));
    return fresh.get(id);
  }

  // The foes drawn a little behind the room's word, smoothly (our own run's: where they are)
  function showFoes(id, dt) {
    const d = dungeons.get(id);
    if (!d.s) return;
    const k = ctx.net() ? damp(14, dt) : 1;
    d.s.foes.forEach((f, i) => {
      const at = d.shown[i];
      if (!at || Math.hypot(f.x - at.x, f.z - at.z) > 4) d.shown[i] = { x: f.x, y: f.y, z: f.z };
      else {
        at.x += (f.x - at.x) * k;
        at.y += (f.y - at.y) * k;
        at.z += (f.z - at.z) * k;
      }
    });
  }

  // ---------- What it gives ----------
  function reward(id) {
    const def = BOSSES[id];
    const first = !(rec.won[id] > 0);
    rec.won[id] = (rec.won[id] ?? 0) + 1;
    if (first) rec.owed.push([def.statue, 1], [def.mount, 1]);
    const kind = BOSS_FIGHT.shiny[Math.floor(Math.random() * BOSS_FIGHT.shiny.length)];
    rec.shinies.push(kind);
    hud.flash('Friends!');
    inventory.notify(first
      ? `You beat the ${name(id)}! Its statue and the ${ITEMS[def.mount].name.toLowerCase()} are yours, and a shiny golden ${kind} is off to your farm`
      : `You beat the ${name(id)} again! A shiny golden ${kind} is off to your farm`);
    payAt = now + 2.5; // (once that has been read)
    ctx.save();
  }

  // What we are owed: into the backpack as there is room, the shiny animals onto our own farm
  function pay() {
    let changed = false;
    rec.owed = rec.owed.filter(([item, n]) => {
      if (!ITEMS[item]) return false;
      if (!inventory.add(item, n)) return true;
      changed = true;
      return false;
    });
    if (rec.owed.length) inventory.notify(`Make room in your backpack for the ${ITEMS[rec.owed[0][0]].name.toLowerCase()}`);
    if (rec.shinies.length && ctx.farmIsOurs()) {
      rec.shinies = rec.shinies.filter((kind) => {
        if (!ctx.addShiny(kind)) return true;
        inventory.notify(`A shiny golden ${kind} has turned up on your farm!`);
        changed = true;
        return false;
      });
    }
    if (changed) ctx.save();
  }

  // ---------- Riding ----------
  function getOn(kind) {
    riding = kind;
    farmer.ride(createMount(kind));
    farmer.anim.squash = -0.2;
  }
  function getOff() {
    riding = null;
    farmer.ride(null);
    farmer.anim.squash = 0.15;
  }

  return {
    // The farm's room's news (src/main.js)
    onBoss: (m) => BOSSES[m.boss] && setState(m.boss, bossFromWire(m.s)),
    onFx: (m) => BOSSES[m.boss] && m.fx && onFx(m.boss, m.fx),
    onWon: (m) => BOSSES[m.boss] && Array.isArray(m.won) && onWon(m.boss, m.won),
    onDungeon: (m) => DUNGEONS[m.boss] && (dungeons.get(m.boss).s = dungeonFromWire(m.boss, m.s)),
    onDungeonFx: (m) => DUNGEONS[m.boss] && m.fx && onDungeonFx(m.boss, m.fx),
    // Onto a farm's room (bosses and dungeons: as its FARM has them), or off it (none)
    welcome(list = {}, ways = {}) {
      alone.clear();
      aloneRuns.clear();
      for (const id of BOSS_IDS) {
        setState(id, bossFromWire(list?.[id]));
        dungeons.get(id).s = dungeonFromWire(id, ways?.[id]);
        dungeons.get(id).shown = [];
      }
    },

    // E: through a portal, home, a bop, or on or off a mount. false: none of those here
    use() {
      const mount = ITEMS[inventory.selectedId()]?.mount;
      if (mount) {
        if (riding) getOff();
        else getOn(mount);
        return true;
      }
      const portal = portalInReach();
      if (portal) return enter(portal), true;
      const exit = exitInReach();
      if (exit) return leave(exit), true;
      const way = inDungeon();
      if (way) {
        const weapon = ctx.weapon();
        if (!weapon) inventory.notify(`Take a sword, a mallet or a bow in hand to bop the ${DUNGEONS[way].foe[1]}`);
        else bopFoe(way, weapon);
        return true;
      }
      const id = here();
      if (!id) return false;
      const weapon = ctx.weapon();
      if (!weapon) {
        inventory.notify(`Take a sword, a mallet or a bow in hand to bop the ${name(id)}`);
        return true;
      }
      const { shoots, every, reach } = WEAPONS[weapon];
      const b = bosses.get(id).s;
      if (now < dizzyUntil || now < bopReady || outAt || (shoots && b?.phase === 'friendly')) return true; // (no arrows wasted on a friend)
      if (shoots && !inventory.count(shoots)) {
        inventory.notify('No arrows left: make some at a workbench, from wood and steel');
        return true;
      }
      bopReady = now + every / 1000;
      if (b) farmer.anim.facing = Math.atan2(b.x - player.position.x, b.z - player.position.z);
      farmer.swing();
      const inReach = b?.phase === 'fight' && Math.hypot(b.x - player.position.x, b.z - player.position.z) <= reach + BODY_R;
      if (shoots) {
        // (an arrow each shot, at the boss if it is in reach, else straight on)
        inventory.remove(shoots, 1);
        const { x, y, z } = player.position;
        const yaw = farmer.anim.facing;
        ctx.shoot(inReach ? _to.set(b.x, b.y + 1, b.z) : _to.set(x + Math.sin(yaw) * reach, y, z + Math.cos(yaw) * reach));
      }
      if (!inReach) return true;
      if (ctx.net()) {
        ctx.net().send({ t: C.BOSS_BOP, boss: id, weapon });
        return true;
      }
      const fight = alone.get(id);
      const hit = fight?.bop(me(), weapon, player.position.x, player.position.y, player.position.z);
      if (!hit) return true;
      onFx(id, { e: 'bop', by: me(), hp: hit.hp });
      if (hit.won) {
        setState(id, bossFromWire(fight.toWire()));
        ctx.removePortal(id);
        onWon(id, hit.won);
      }
      return true;
    },

    // What E does here, for the prompt ('': nothing of ours)
    prompt() {
      if (ITEMS[inventory.selectedId()]?.mount) return riding ? 'E  Get off' : `E  Ride the ${ITEMS[inventory.selectedId()].name.toLowerCase()}`;
      const portal = portalInReach();
      if (portal) return `E  Go through the ${name(portal)} portal`;
      if (exitInReach()) return 'E  Go home through the portal';
      const way = inDungeon();
      if (way) {
        const weapon = ctx.weapon();
        if (!weapon) return 'Take a sword, a mallet or a bow in hand';
        if (foeInReach(way, weapon) === null) return '';
        return `E  ${WEAPONS[weapon].shoots ? 'Shoot at' : 'Bop'} the ${DUNGEONS[way].foe[0]}`;
      }
      const id = here();
      const b = id && bosses.get(id).s;
      if (!b) return '';
      if (b.phase === 'friendly') return `The ${name(id)} is your friend now`;
      if (!ctx.weapon()) return 'Take a sword, a mallet or a bow in hand';
      if (b.phase !== 'fight') return '';
      return WEAPONS[ctx.weapon()].shoots ? `E  Shoot at the ${name(id)}` : `E  Bop the ${name(id)}`;
    },

    // Is a fight on through this piece (a portal)? (It can't be taken down meanwhile.)
    busy(piece) {
      const s = bosses.get(portalBoss(piece))?.s;
      return s?.phase === 'wake' || s?.phase === 'fight';
    },

    // Are we in an arena, or a dungeon on the way to one? (nothing else is done there)
    inArena: () => !!here() || !!inDungeon(),

    // How fast our farmer walks (dizzy: slower)
    // How fast we go, and how high we jump (dizzy: slower; riding: quicker)
    speed: () => (now < dizzyUntil ? 0.45 : 1) * (MOUNTS[riding]?.speed ?? 1),
    jump: () => MOUNTS[riding]?.jump ?? 1, // (a mount not in MOUNTS: as on foot)

    // The mount we are on, for STATEF (1 + its boss's place in BOSS_IDS; 0: none)
    mountBits: () => (riding ? BOSS_IDS.indexOf(riding) + 1 : 0),

    // The boss as we last had it (bossFromWire), or null; its dungeon (dungeonFromWire, null: fresh): for tests
    seen: (id) => bosses.get(id)?.s ?? null,
    way: (id) => dungeons.get(id)?.s ?? null,

    // Every frame. t: seconds (the page's clock)
    update(dt, t) {
      now = t;
      const inArena = here();
      const way = inDungeon();
      const { x, y, z } = player.position;
      if (!inArena && !way) {
        hits = 0;
        outAt = 0;
      }
      if (inArena && inArena !== lastArena) intoArena(inArena);
      lastArena = inArena;
      // into a room with foes up: what to do
      const room = way ? roomAt(way, x, z) : -1;
      const roomKey = way && room >= 0 ? `${way}:${room}` : null;
      if (roomKey && roomKey !== lastRoom) roomNotice(way, room);
      if (roomKey || !way) lastRoom = roomKey;
      // a farm played alone: its dungeons are ours to run too
      if (!ctx.net()) {
        for (const id of BOSS_IDS) {
          let run = aloneRuns.get(id);
          const near = way === id || inArena === id;
          if (!run && way !== id) continue;
          if (!run) aloneRuns.set(id, (run = new DungeonRun(id)));
          for (const f of run.step(dt, way === id ? [{ id: me(), x, y, z }] : [], near)) onDungeonFx(id, f);
          if (!run.stirred && !near) aloneRuns.delete(id);
          else dungeons.get(id).s = dungeonFromWire(id, run.toWire());
        }
      }
      for (const [id, d] of dungeons) {
        const near = way === id || inArena === id;
        if (near) showFoes(id, dt);
        const fresh = d.s ? null : freshOf(id);
        dungeonView.update(dt, t, id, near, d.s ?? fresh, d.s ? d.shown : fresh.foes);
        if (way === id) checkFoes(id);
      }
      // a farm played alone: its fights are ours to run
      if (!ctx.net()) {
        for (const id of BOSS_IDS) {
          let fight = alone.get(id);
          if (!fight && inArena !== id) continue;
          if (!fight) alone.set(id, (fight = new BossFight(id)));
          const fx = fight.step(dt, inArena === id ? [{ id: me(), x: player.position.x, y: player.position.y, z: player.position.z }] : []);
          for (const f of fx) onFx(id, f);
          setState(id, fight.phase === 'sleep' && inArena !== id ? null : bossFromWire(fight.toWire()));
          if (fight.phase === 'sleep' && inArena !== id) alone.delete(id);
        }
      }
      for (const [id, boss] of bosses) {
        const s = boss.s;
        if (s) {
          // drawn a little behind the room's word, smoothly
          const k = ctx.net() ? damp(14, dt) : 1;
          boss.shown.x += (s.x - boss.shown.x) * k;
          boss.shown.y += (s.y - boss.shown.y) * k;
          boss.shown.z += (s.z - boss.shown.z) * k;
          const b = { ...s, x: boss.shown.x, y: boss.shown.y, z: boss.shown.z, mt: s.mt + (ctx.net() ? t - boss.at : 0) };
          boss.view.update(dt, t, b);
          if (s.phase === 'wake' || s.phase === 'fight') {
            _top.set(b.x, b.y + 4, b.z);
            ctx.giantBars.show('boss', id, s.hp, Math.round(s.max), _top, t, BOSSES[id].name);
          }
          if (inArena === id) checkHazards(id, b);
        } else {
          boss.view.update(dt, t, null);
        }
      }
      // sent back to the start (of the arena, or of the room), after one catch too many
      if (outAt && t >= outAt) {
        outAt = 0;
        hits = 0;
        if (inArena || way) sendBack?.();
        sendBack = null;
      }
      stars.group.visible = t < dizzyUntil;
      if (stars.group.visible) stars.spin(t);
      arenas.update(t);
      // riding: off it, to use anything else
      if (riding && ITEMS[inventory.selectedId()]?.mount !== riding) getOff();
      if (t >= payAt) {
        payAt = t + PAY_EVERY;
        if (rec.owed.length || rec.shinies.length) pay();
      }
    },

    // For the save (top level: it is ours, wherever we are): { won: { boss: times }, shinies, owed }
    record: () => rec,
    restore(saved) {
      const won = Object.fromEntries(Object.entries(saved?.won ?? {}).filter(([id, n]) => BOSSES[id] && Number.isInteger(n) && n > 0));
      const shinies = (Array.isArray(saved?.shinies) ? saved.shinies : []).filter((kind) => BOSS_FIGHT.shiny.includes(kind)).slice(0, 20);
      const owed = (Array.isArray(saved?.owed) ? saved.owed : []).filter((o) => Array.isArray(o) && ITEMS[o[0]] && Number.isInteger(o[1]) && o[1] > 0).slice(0, 20);
      rec = { won, shinies, owed };
    },
  };
}
