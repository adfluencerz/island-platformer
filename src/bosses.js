import * as THREE from 'three';
import { BOSSES, BOSS_FIGHT, WEAPONS, MOUNTS } from '../shared/balance.js';
import { GROUND_STAND_Y } from '../shared/level.js';
import { C } from '../shared/protocol.js';
import {
  BossFight, BOSS_IDS, BODY_R, arenaAt, arenaStart, arenaExit, portalOf, portalBoss, bossFromWire,
  rollHits, swoopHits, waveHits, seedAt, seedHits, swarmAt, swarmHits,
} from '../shared/bosses.js';
import { ITEMS } from './items.js';
import { createArenas } from './arena.js';
import { createBossView, dizzyStars } from './bossview.js';
import { createMount } from './mounts.js';
import { damp } from './character.js';
import { TILE_SIZE } from './world.js';

// ---------- The bosses, on the page ----------
// A boss's portal on the farm (built from a full set of its key pieces: the
// Build tab) leads to its arena (src/arena.js), out past the sea on the
// farm's world; the portal at the arena's front leads home. In there, E with
// the wooden sword or the mallet in hand bops the boss (shared/bosses.js has
// how it fights). Its moves catch a farmer who isn't quick: knocked back and
// dizzy for a moment (slower, no bopping), and after BOSS_FIGHT.hitsOut of
// those, back at the arena's start to have another go. Nobody gets hurt.
//
// On a farm with helpers the farm's room runs the fight and says how it goes
// (BOSS, BOSS_FX, BOSS_WON); on a farm played alone this page runs it, by
// the same rules. Whether our own farmer got caught is always this page's.
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
  let rec = { won: {}, shinies: [], owed: [] }; // (record())
  let hits = 0; // times its boss caught us since we came into the arena (or were last sent back)
  let graceUntil = 0;
  let dizzyUntil = 0;
  let outAt = 0; // (sent back to the start at this time)
  let bopReady = 0;
  let payAt = 0;
  let now = 0; // (the clock, as of the last update)
  let riding = null; // the mount we are on (a boss's id)
  const stars = dizzyStars(3, 0.38, 0.28);
  stars.group.position.y = 1.15;
  stars.group.visible = false;
  farmer.root.add(stars.group);

  const name = (id) => BOSSES[id].name.toLowerCase();
  const here = () => (ctx.atHome() ? arenaAt(player.position.x, player.position.z) : null);
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

  function exitInReach() {
    const id = here();
    if (!id || player.position.y > 2.2) return null;
    const exit = arenaExit(id);
    return Math.hypot(player.position.x - exit.x, player.position.z - exit.z) < EXIT_REACH ? id : null;
  }

  function enter(id) {
    ctx.putDown({ ...arenaStart(id), y: GROUND_STAND_Y });
    farmer.anim.facing = Math.PI; // (into the arena)
    hits = 0;
    const b = bosses.get(id).s;
    if (b?.phase === 'friendly') inventory.notify(`The ${name(id)} is friendly now`);
    else if (!Object.keys(WEAPONS).some((w) => inventory.count(w))) inventory.notify(`Bop the ${name(id)} with a wooden sword or a mallet (made at a workbench) until it's dizzy`);
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
  function caught(fromX, fromZ) {
    hits++;
    graceUntil = now + BOSS_FIGHT.grace;
    dizzyUntil = now + BOSS_FIGHT.dizzy;
    let dx = player.position.x - fromX;
    let dz = player.position.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    ctx.knock(dx / d, dz / d, BOSS_FIGHT.knock);
    hud.flash('Bonk!');
    if (hits >= BOSS_FIGHT.hitsOut) outAt = now + OUT_DELAY;
  }

  function checkHazards(id, b) {
    if (b.phase !== 'fight' || now < graceUntil || outAt) return;
    const { x, y, z } = player.position;
    const def = BOSSES[id];
    if (rollHits(b, def, x, y, z) || swoopHits(b, def, x, y, z)) return caught(b.x, b.z);
    const { view } = bosses.get(id);
    for (const w of view.waves) if (waveHits(w.fx, w.age, x, y, z)) return caught(w.fx.x, w.fx.z);
    for (const s of view.seeds) {
      for (let i = 0; i < s.fx.n; i++) {
        if (seedHits(seedAt(s.fx, i, s.age, _seed), x, y, z)) return caught(s.fx.x, s.fx.z);
      }
    }
    for (const s of view.swarms) {
      for (let i = 0; i < s.fx.a.length; i++) {
        if (swarmHits(swarmAt(s.fx, i, s.age, _seed), x, y, z)) return caught(_seed.x - Math.sin(s.fx.a[i]), _seed.z - Math.cos(s.fx.a[i]));
      }
    }
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
    // Onto a farm's room (bosses: as its FARM has them), or off it (none)
    welcome(list = {}) {
      alone.clear();
      for (const id of BOSS_IDS) setState(id, bossFromWire(list?.[id]));
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
      const id = here();
      if (!id) return false;
      const weapon = ctx.weapon();
      if (!weapon) {
        inventory.notify(`Take a wooden sword or a mallet in hand to bop the ${name(id)}`);
        return true;
      }
      if (now < dizzyUntil || now < bopReady || outAt) return true;
      bopReady = now + WEAPONS[weapon].every / 1000;
      const b = bosses.get(id).s;
      if (b) farmer.anim.facing = Math.atan2(b.x - player.position.x, b.z - player.position.z);
      farmer.swing();
      if (b?.phase !== 'fight' || Math.hypot(b.x - player.position.x, b.z - player.position.z) > WEAPONS[weapon].reach + BODY_R) return true;
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
      const id = here();
      const b = id && bosses.get(id).s;
      if (!b) return '';
      if (b.phase === 'friendly') return `The ${name(id)} is your friend now`;
      if (!ctx.weapon()) return 'Take a sword or a mallet in hand';
      return b.phase === 'fight' ? `E  Bop the ${name(id)}` : '';
    },

    // Is a fight on through this piece (a portal)? (It can't be taken down meanwhile.)
    busy(piece) {
      const s = bosses.get(portalBoss(piece))?.s;
      return s?.phase === 'wake' || s?.phase === 'fight';
    },

    // Are we in an arena? (nothing else is done there)
    inArena: () => !!here(),

    // How fast our farmer walks (dizzy: slower)
    // How fast we go, and how high we jump (dizzy: slower; riding: quicker)
    speed: () => (now < dizzyUntil ? 0.45 : 1) * (MOUNTS[riding]?.speed ?? 1),
    jump: () => MOUNTS[riding]?.jump ?? 1, // (a mount not in MOUNTS: as on foot)

    // The mount we are on, for STATEF (1 + its boss's place in BOSS_IDS; 0: none)
    mountBits: () => (riding ? BOSS_IDS.indexOf(riding) + 1 : 0),

    // Every frame. t: seconds (the page's clock)
    update(dt, t) {
      now = t;
      const inArena = here();
      if (!inArena) {
        hits = 0;
        outAt = 0;
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
      // sent back to the start, after one catch too many
      if (outAt && t >= outAt) {
        outAt = 0;
        hits = 0;
        if (inArena) {
          ctx.putDown({ ...arenaStart(inArena), y: GROUND_STAND_Y });
          farmer.anim.facing = Math.PI;
          inventory.notify(`The ${name(inArena)} bounced you back to the start: have another go!`);
        }
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
