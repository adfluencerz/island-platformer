// A farm with helpers, played together. A farm whose owner has let friends
// help (server/farms.js keeps who) is run here, on the server, whenever
// anyone is on it, the owner or a helper, so it can be tended while its owner
// is away. One FarmRoom per farm, made when the first farmer arrives and put
// away a little while after the last one leaves.
//
// The room owns the farm while it runs: the tilled soil, the crops, what is
// built, the farm's chest and its clock. Pages ask (TILL, PLANT, HARVEST,
// BUILD, UNBUILD) and the room says what happened to everyone. A piece's cost
// is paid from the builder's own backpack, and goes back to whoever takes it
// down (their pages see to that). What is harvested goes into the chest, which
// everyone can see and put things in, and only the owner takes things out of.
// The backpacks stay everyone's own (their own farm's save keeps them).
//
// The machines (shared/machines.js) are the room's too: whoever is next to
// one puts something in from their own backpack (LOAD), and whoever is next to
// it when it is ready collects it, into their own backpack (COLLECT).
//
// The farm's trees are chopped for wood and its rocks broken up for stone the
// way a lobby's are (CHOP, MINE: the wood or stone goes to whoever did it),
// and the room keeps when each comes back. A giant tree or rock (HIT) too,
// shared by how much each did (shared/giants.js).
//
// The animals are the owner's page's: it drives them (eggs, milk and wool go
// to the owner, as at home) and sends their state along (ANIMALS); everyone
// else's page draws them from that, for company. With the owner away they
// keep as they were, and the owner's page catches up on what they gave when
// it next has them (src/animals.js restore()). The farm's upgrades (`levels`:
// its workbench's and pens', bought by the owner) go along with them.
//
// What a farmer drops out of their backpack (THROW) lies where they stood,
// for anyone on the farm to walk into (PICKUP), not straight back to them
// (DROP_OWN_MS), as in a lobby; but it doesn't fade: it is kept with the farm
// (`dropped`), as the page keeps it when the farm is played alone (src/finds.js).
//
// The bosses' arenas are out past the sea on the farm's world (shared/bosses.js):
// the room keeps a BossFight for each, moving its boss while anyone is in its
// arena and counting the bops (BOSS_BOP). Beaten, its portal goes (UNBUILT,
// by nobody: the key pieces it was built from are used up), and everyone who
// fought hears they won (BOSS_WON): their own pages hand out what it gives.
// A fight isn't kept: the room goes, and the boss is asleep again.
//
// The farm is kept in the farm's own file, in the page's save format (the
// save's `farm`: { savedAt, hours, tilled: [[key, bare, life]], crops: [[key, crop, age]], built:
// [[key, piece]], machines: [[key, item, at, takes]], felled and mined: [[tree or rock id, when it comes back (ms)]],
// treeSites and rockSites: [[id, how often it grew back]], giants (shared/giants.js toSave()),
// ...the animals }), so the owner's page can always play it, alone, from there; the
// chest beside the save (farm.chest), where no page's save can write over it.
// Each time the room writes the farm, farm.roomRev goes up: a page that
// played the farm alone, offline, meanwhile knows its farm is out of date.
import { Place } from '../shared/place.js';
import { S, C, finite } from '../shared/protocol.js';
import { CLOSE, CLOSE_TEXT, DAY_LENGTH_SECONDS, MAX_NAME, SOIL_BARE_HOURS, devToolsOn } from '../shared/constants.js';
import { Giants, giantSwing, giantMax, gameDay } from '../shared/giants.js';
import { BossFight, BOSS_IDS, ARENAS, ARENA_R, arenaAt, portalOf, portalBoss } from '../shared/bosses.js';
import { wildsFromWire, standsAt } from '../shared/wilds.js';
import { HOME_WILDS } from '../shared/homewilds.js';
import { CROP_GROW_TIME, CROP_PRODUCE, SPAWN, GROUND_STAND_Y, PIECES, MAX_PIECES, mostPieces, TREE, ROCK, CHEST, HOUSE_ROOM, keptClear, chestHasRoom, pieceTiles, inHouseField, spawnPoint, woodFor, stoneFor, nextSite, siteMap } from '../shared/level.js';
import { unmake, BOSSES, WEAPONS, SHOP, DROP_OWN_MS } from '../shared/balance.js';
import { loadFor, fillsItself, collectFor, contentsBack, machinesFromSave, machinesToSave } from '../shared/machines.js';

const FARM_HALF = 28; // tiles reach this far from the middle (the home map's HOME_HALF, less the shore)
const REACH = 3.4; // the client farms the tile underfoot, or one tapped within 2.2 (and a golden hoe the tiles round it)
const SECONDS_PER_HOUR = DAY_LENGTH_SECONDS / 24;
const RIPE_SLACK = 1; // seconds: pages count growth on their own clocks
const MAX_STACK = CHEST.stack; // of one item in the chest
const MAX_ANIMALS = 16 * 1024; // bytes of the animals' state
const CLOCK_EVERY = 10_000; // ms between FARM_CLOCKs
const SOIL_EVERY = 1000; // ms between looks at the bare soil
// (as in a lobby: shared/room.js)
const CHOP_REACH = 2.6;
const CHOP_EVERY = 1000; // ms
const MINE_REACH = 2.6;
const MINE_EVERY = 900; // ms
const BOSS_EVERY = 0.8; // of a weapon's `every` (WEAPONS): the fewest ms between one farmer's bops at a boss that count
const BOSS_SEND = 2; // ticks between a boss's BOSSes
const ITEM_RE = /^[a-z][a-z0-9_]{0,31}$/;
const KEY_RE = /^-?\d{1,3},-?\d{1,3}$/;
const MAX_DROPS = 200; // things lying about on the farm at once
const THROW_EVERY = 200; // ms: the fewest between two things one farmer drops
const PICK_REACH = 2.2; // the page picks up within 1.4; the slack covers a position up to ~150 ms old
// where the farm's trees and rocks stand (shared/wilds.js), the same on every farm and every page
const WILDS = wildsFromWire(HOME_WILDS);
const MAX_TREES = WILDS.trees.length;
const MAX_ROCKS = WILDS.rocks.length;

export class FarmRoom extends Place {
  // farm: the farm (server/farms.js). admit(auth, name): who the joiner is,
  // { id, owner }, or null for someone who isn't the owner or a helper.
  // helpers(): how many helpers the farm has now (each lets it have one more house)
  constructor({ farm, admit, helpers = () => 0, log = () => {} }) {
    const far = Math.max(FARM_HALF, HOUSE_ROOM.x0 + HOUSE_ROOM.w, ...Object.values(ARENAS).map(({ x, z }) => Math.max(Math.abs(x), Math.abs(z)) + ARENA_R));
    super({ code: farm.id, name: farmTitle(farm), worldLimit: far + 40, log }); // (the house's room and the bosses' arenas are out past the sea)
    this.farmId = farm.id;
    this.admit = admit;
    this.helpers = helpers;
    const saved = farm.save?.farm ?? null;
    const now = Date.now();
    // the clock: game hours since the farm began, running on from when it was saved
    const savedHours = Number.isFinite(saved?.hours) ? saved.hours : 6;
    const away = Number.isFinite(saved?.savedAt) ? Math.max(0, now - saved.savedAt) / 1000 : 0;
    this.clockBase = savedHours + away / SECONDS_PER_HOUR;
    this.clockAt = now;
    // key -> { since: when it has lain bare from (game hours; it only counts
    // with nothing growing), life: how long it may (game hours) }
    // (a save from before soil went back to grass has just the keys)
    this.tilled = new Map();
    for (const t of saved?.tilled ?? []) {
      const [key, bare, life] = Array.isArray(t) ? t : [t];
      if (!KEY_RE.test(key)) continue;
      this.tilled.set(key, {
        since: savedHours - (Number.isFinite(bare) ? bare : 0) / SECONDS_PER_HOUR,
        life: Number.isFinite(life) ? life / SECONDS_PER_HOUR : this.soilLife(),
      });
    }
    this.crops = new Map(); // key -> { crop, plantedAt (game hours) }
    for (const [key, crop, age] of saved?.crops ?? []) {
      if (this.tilled.has(key) && CROP_GROW_TIME[crop] && Number.isFinite(age)) {
        this.crops.set(key, { crop, plantedAt: savedHours - age / SECONDS_PER_HOUR });
      }
    }
    this.built = new Map(); // key -> piece (PIECES), on the tile it was built on
    this.covered = new Map(); // every tile a piece stands on (a house: many) -> the key it was built on
    for (const [key, piece] of saved?.built ?? []) {
      const free = KEY_RE.test(key) && PIECES[piece] && pieceTiles(piece, key).every((k) => KEY_RE.test(k) && !this.tilled.has(k) && !this.covered.has(k));
      // (a house built while it had more helpers stays)
      if (free && this.built.size < MAX_PIECES && !(PIECES[piece].one && this.has(piece))) this.put(key, piece);
    }
    // key -> what is in the machine built there (shared/machines.js), in the farm's game hours
    this.machines = machinesFromSave(saved?.machines, (key) => this.built.get(key), this.built.keys(), this.clockBase);
    const comingBack = (list, most) => new Map((Array.isArray(list) ? list : []).filter(([id, at]) => Number.isInteger(id) && id >= 0 && id < most && Number.isFinite(at)));
    this.felled = comingBack(saved?.felled, MAX_TREES); // tree id -> when it grows back (ms)
    this.mined = comingBack(saved?.mined, MAX_ROCKS); // rock id -> when a new one surfaces (ms)
    // how often each grew back (which of its places it is in: shared/level.js nextSite)
    this.treeSites = siteMap(saved?.treeSites, MAX_TREES);
    this.rockSites = siteMap(saved?.rockSites, MAX_ROCKS);
    this.giants = Giants.fromSave(saved?.giants, this.rand); // (shared/giants.js)
    // id -> { id, item, count, x, y, z, from, ownAt }: dropped out of a backpack
    // (y: where a farmer standing there would be; the save keeps the ground's)
    this.drops = new Map();
    this.dropId = 0;
    for (const d of Array.isArray(saved?.dropped) ? saved.dropped : []) {
      const [item, count, x, y, z] = Array.isArray(d) ? d : [];
      if (this.drops.size < MAX_DROPS && droppable(item) && Number.isInteger(count) && count >= 1 && count <= 999 && [x, y, z].every(Number.isFinite)) {
        this.dropAt(item, count, x, y + GROUND_STAND_Y, z, 0, 0);
      }
    }
    this.giants.setCounts(MAX_TREES, MAX_ROCKS);
    // the rest of the farm is the animals', as the owner's page saved them
    // (and the chest the page keeps when it plays the farm alone: the owner's
    // page puts what is in it into this one when it comes)
    const { savedAt, hours, tilled, crops, built, machines, felled, mined, treeSites, rockSites, giants, chest, dropped, ...animals } = saved ?? {};
    this.animals = animals;
    this.chest = unmake(farm.chest); // (a lamp post or bench made at the workbench, back in wood and stone)
    this.ownerName = farm.ownerName ?? ''; // (for the words: "Ann takes things out of the chest")
    this.clockSentAt = now;
    this.soilAt = now;
    this.fights = new Map(BOSS_IDS.map((id) => [id, new BossFight(id, this.rand)])); // boss -> its fight (shared/bosses.js)
    this.bossAt = now;
  }

  // the farm's clock now, in game hours
  hours(now = Date.now()) {
    return this.clockBase + (now - this.clockAt) / 1000 / SECONDS_PER_HOUR;
  }

  // ---------- Who is here ----------
  join(conn, msg) {
    const who = this.admit(msg?.auth, msg?.name);
    if (!who) {
      conn.close(CLOSE.NOT_HELPER, CLOSE_TEXT[CLOSE.NOT_HELPER]);
      return null;
    }
    const p = super.join(conn, msg, { farmId: who.id, owner: who.owner });
    if (p?.owner) this.ownerName = p.name;
    return p;
  }

  spawnFor(id) {
    return spawnPoint(SPAWN, id % 8, 8); // around the plaza
  }

  playerExtra(p) {
    return { owner: p.owner };
  }

  greet(p) {
    this.say(p.owner ? `${p.name} is home.` : `${p.name} came to help.`);
  }

  welcome(p, resumed) {
    this.send(p, {
      t: S.FARM,
      id: p.id,
      name: p.name,
      color: p.color,
      farm: { id: this.farmId, name: this.name, owner: this.ownerName, helpers: this.helpers() },
      mine: p.owner,
      tilled: this.tilledList(this.hours()),
      crops: [...this.crops].map(([key, c]) => [key, c.crop, round3(c.plantedAt)]),
      built: [...this.built],
      machines: machinesToSave(this.machines),
      felled: [...this.felled],
      mined: [...this.mined],
      treeSites: [...this.treeSites],
      rockSites: [...this.rockSites],
      giants: this.giants.toSave(),
      drops: [...this.drops.values()].map((d) => [d.id, d.item, d.count, d.x, d.y, d.z, d.from, Math.max(0, d.ownAt - Date.now())]),
      bosses: Object.fromEntries([...this.fights].filter(([, f]) => f.phase !== 'sleep').map(([id, f]) => [id, f.toWire()])),
      chest: this.chest,
      hours: round3(this.hours()),
      animals: this.animals,
      roster: this.rosterList(),
      pos: { x: p.x, y: p.y, z: p.z },
      resumed,
    });
  }

  // The owner took them off the helpers: out they go
  turnOut(helperFarmId) {
    for (const p of [...this.players.values()]) {
      if (p.farmId !== helperFarmId || p.owner) continue;
      p.conn?.close(CLOSE.NOT_HELPER, CLOSE_TEXT[CLOSE.NOT_HELPER]);
      p.conn = null;
      this.remove(p);
    }
  }

  // ---------- What they do ----------
  // Close enough to the tile, and not far above it (a step or a platform is
  // fine: the client reaches 1.2 up or down, USE_HEIGHT in src/main.js)
  near(p, key) {
    const [gx, gz] = key.split(',').map(Number);
    return Math.hypot(gx - p.x, gz - p.z) <= REACH && Math.abs(p.y - GROUND_STAND_Y) < 1.4;
  }

  act(p, msg) {
    switch (msg?.t) {
      case C.THROW: {
        // Out of their backpack, at their feet (the page has taken it out
        // already: THROW_DENY hands it back)
        const now = Date.now();
        const count = Number.isInteger(msg.count) ? msg.count : 0;
        if (!droppable(msg.item) || count < 1 || count > 999 || now - (p.throwAt ?? 0) < THROW_EVERY || this.drops.size >= MAX_DROPS) {
          this.send(p, { t: S.THROW_DENY, item: typeof msg.item === 'string' ? msg.item : null, count });
          return;
        }
        p.throwAt = now;
        const drop = this.dropAt(msg.item, count, p.x, p.y, p.z, p.id, now + DROP_OWN_MS);
        this.changed = true;
        this.broadcast({ t: S.DROP, id: drop.id, item: drop.item, count, x: drop.x, y: drop.y, z: drop.z, from: p.id, wait: DROP_OWN_MS });
        break;
      }
      case C.PICKUP: {
        const drop = this.drops.get(msg.id);
        const mine = drop?.from === p.id && Date.now() < drop.ownAt; // (not straight back: they are still standing on it)
        if (!drop || mine || Math.hypot(drop.x - p.x, drop.y - p.y, drop.z - p.z) > PICK_REACH) {
          this.send(p, { t: S.DROP_DENY, id: msg.id });
          return;
        }
        this.drops.delete(drop.id);
        this.changed = true;
        this.broadcast({ t: S.PICKED, id: drop.id, by: p.id, item: drop.item, count: drop.count });
        break;
      }
      case C.TILL: {
        const { key } = msg;
        if (!this.farmable(key) || this.tilled.has(key) || this.covered.has(key) || !this.near(p, key)) return this.deny(p, 'till', key);
        this.tilled.set(key, { since: this.hours(), life: this.soilLife() });
        this.changed = true;
        this.broadcast({ t: S.TILLED, key, by: p.id });
        break;
      }
      case C.PLANT: {
        const { key, crop } = msg;
        if (!this.farmable(key) || !CROP_GROW_TIME[crop] || !this.tilled.has(key) || this.crops.has(key) || !this.near(p, key)) {
          return this.deny(p, 'plant', key, CROP_GROW_TIME[crop] ? crop : undefined);
        }
        const at = round3(this.hours());
        this.crops.set(key, { crop, plantedAt: at });
        this.changed = true;
        this.broadcast({ t: S.PLANTED, key, crop, at, by: p.id });
        break;
      }
      case C.HARVEST: {
        const { key } = msg;
        const c = this.farmable(key) && this.crops.get(key);
        const age = c && (this.hours() - c.plantedAt) * SECONDS_PER_HOUR;
        if (!c || age < CROP_GROW_TIME[c.crop] - RIPE_SLACK || !this.near(p, key)) return this.deny(p, 'harvest', key);
        const item = CROP_PRODUCE[c.crop];
        if (!this.canStore(item, 1)) {
          this.send(p, { t: S.CHAT, from: 0, text: 'The farm\'s chest is full: the owner needs to take some things out.' });
          return this.deny(p, 'harvest', key);
        }
        this.crops.delete(key);
        this.tilled.set(key, { since: this.hours(), life: this.soilLife() }); // (bare again from now)
        this.store(item, 1);
        this.changed = true;
        this.broadcast({ t: S.HARVESTED, key, by: p.id, item });
        this.broadcast({ t: S.CHEST, items: this.chest });
        break;
      }
      case C.BUILD: {
        // (paid from the builder's backpack; what it was short of, from the
        // chest, when the owner builds: msg.chest, { item: count })
        const { key, piece } = msg;
        const fromChest = Object.hasOwn(PIECES, piece) ? this.chestShare(p, piece, msg.chest) : null;
        const tiles = Object.hasOwn(PIECES, piece) ? pieceTiles(piece, key) : [];
        const free = (k) => onFarm(k) && !this.covered.has(k) && !this.tilled.has(k) && !keptClear(...k.split(',').map(Number));
        const ok = onFarm(key) && fromChest && tiles.every(free) && this.built.size < MAX_PIECES && this.count(piece) < mostPieces(piece, this.helpers()) && this.near(p, key);
        if (!ok) return this.deny(p, 'build', key, undefined, Object.hasOwn(PIECES, piece) ? piece : undefined);
        for (const [item, n] of fromChest) {
          this.chest[item] -= n;
          if (!this.chest[item]) delete this.chest[item];
        }
        this.put(key, piece);
        this.changed = true;
        this.broadcast({ t: S.BUILT, key, piece, by: p.id });
        if (fromChest.length) this.broadcast({ t: S.CHEST, items: this.chest });
        const full = fillsItself(piece, this.hours()); // (a beehive: honey on its way)
        if (full) this.setMachine(key, full, p);
        break;
      }
      case C.UNBUILD: {
        // (key: any tile the piece stands on, next to the one taking it down)
        const { key } = msg;
        const at = onFarm(key) && this.covered.get(key);
        const piece = at && this.built.get(at);
        if (!piece || !this.near(p, key) || this.fights.get(portalBoss(piece))?.awake) return this.deny(p, 'unbuild', key); // (not a portal with a fight on through it)
        const back = contentsBack(this.machines.get(at), this.hours()); // (what was in a machine goes back too)
        this.machines.delete(at);
        this.unput(at);
        this.changed = true;
        this.broadcast({ t: S.UNBUILT, key: at, piece, by: p.id, ...(Object.keys(back).length && { back }) });
        break;
      }
      case C.LOAD: {
        // (what goes in came out of the loader's backpack: on a deny it goes back)
        const { key } = msg;
        const at = onFarm(key) && this.covered.get(key);
        const state = at && this.near(p, key) && loadFor(this.built.get(at), this.hours(), msg.dish, this.machines.get(at));
        if (!state) return this.deny(p, 'load', key);
        this.setMachine(at, state, p);
        break;
      }
      case C.COLLECT: {
        const { key } = msg;
        const at = onFarm(key) && this.covered.get(key);
        const out = at && this.near(p, key) && collectFor(this.built.get(at), this.machines.get(at), this.hours(), msg.item);
        if (!out) return this.deny(p, 'collect', key);
        this.setMachine(at, out.state, p, out.got);
        break;
      }
      case C.CHOP: {
        // (as in a lobby: the page says where the tree stands, the room checks the chopper is by it)
        const { id, x, z } = msg;
        const now = Date.now();
        const tree = Number.isInteger(id) ? WILDS.trees[id] : null;
        const ok = tree && finite(x, z) && standsAt(tree, x, z) &&
          !this.felled.has(id) && !this.giants.is('tree', id) && now - (p.chopAt ?? 0) >= CHOP_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= CHOP_REACH && Math.abs(p.y - GROUND_STAND_Y) < 2;
        if (!ok) return this.send(p, { t: S.CHOP_DENY, id });
        const [lo, hi] = TREE.regrow;
        const at = Math.round(now + (lo + this.rand() * (hi - lo)) * 1000);
        this.felled.set(id, at);
        p.chopAt = now;
        this.changed = true;
        this.broadcast({ t: S.FELLED, id, by: p.id, count: woodFor(tree.scale, this.rand), at });
        break;
      }
      case C.MINE: {
        // (the same for a rock)
        const { id, x, z } = msg;
        const now = Date.now();
        const rock = Number.isInteger(id) ? WILDS.rocks[id] : null;
        const size = rock?.size ?? 0;
        const ok = rock && finite(x, z) && standsAt(rock, x, z) &&
          !this.mined.has(id) && !this.giants.is('rock', id) && now - (p.mineAt ?? 0) >= MINE_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= MINE_REACH + size * 1.5 && Math.abs(p.y - GROUND_STAND_Y) < 2;
        if (!ok) return this.send(p, { t: S.MINE_DENY, id });
        const [lo, hi] = ROCK.regrow;
        const at = Math.round(now + (lo + this.rand() * (hi - lo)) * 1000);
        this.mined.set(id, at);
        p.mineAt = now;
        this.changed = true;
        this.broadcast({ t: S.MINED, id, by: p.id, count: stoneFor(size, this.rand), at });
        break;
      }
      case C.DEV_GIANT: {
        // (developer tools: shared/constants.js DEV_TOOLS)
        const { kind, id } = msg;
        if (!devToolsOn(globalThis.process?.env?.GAME_DEV) || (kind === 'tree' ? this.felled : this.mined).has(id) || !this.giants.grow(kind, id)) return;
        this.changed = true;
        this.broadcast({ t: S.GIANT, kind, id, hp: giantMax(kind), max: giantMax(kind), by: 0 });
        this.say(`${p.name} grew a giant ${kind} (developer tools)`);
        break;
      }
      case C.HIT: {
        // (as in a lobby: shared/room.js)
        const thing = (msg.kind === 'tree' ? WILDS.trees : msg.kind === 'rock' ? WILDS.rocks : [])[msg.id];
        if (!thing || !finite(msg.x, msg.z) || !standsAt(thing, msg.x, msg.z)) return;
        const hit = giantSwing(this.giants, p, { ...msg, size: thing.scale ?? thing.size });
        if (!hit) return;
        const { kind, id } = hit;
        this.changed = true;
        this.broadcast({ t: S.GIANT, kind, id, hp: hit.hp, max: giantMax(kind), by: p.id });
        if (!hit.shares) break;
        const tree = kind === 'tree';
        const [lo, hi] = tree ? TREE.regrow : ROCK.regrow;
        const at = Math.round(Date.now() + (lo + this.rand() * (hi - lo)) * 1000);
        (tree ? this.felled : this.mined).set(id, at);
        const by = hit.shares.find(([who]) => who === p.id)?.[1] ?? 0;
        this.broadcast({ t: tree ? S.FELLED : S.MINED, id, by: p.id, count: by, at, shares: hit.shares });
        break;
      }
      case C.BOSS_BOP: {
        // (in its arena, close enough, not too fast: shared/bosses.js)
        const { boss, weapon } = msg;
        const fight = Object.hasOwn(BOSSES, boss) && this.fights.get(boss);
        const now = Date.now();
        if (!fight || !Object.hasOwn(WEAPONS, weapon) || arenaAt(p.x, p.z) !== boss || now - (p.bossBopAt ?? 0) < WEAPONS[weapon].every * BOSS_EVERY) return;
        const hit = fight.bop(p.id, weapon, p.x, p.y, p.z);
        if (!hit) return;
        p.bossBopAt = now;
        this.broadcast({ t: S.BOSS_FX, boss, fx: { e: 'bop', by: p.id, hp: hit.hp } });
        if (!hit.won) break;
        this.broadcast({ t: S.BOSS, boss, s: fight.toWire() });
        this.broadcast({ t: S.BOSS_WON, boss, by: p.id, won: hit.won });
        this.say(`The ${BOSSES[boss].name.toLowerCase()} is all dizzy, and friendly now!`);
        // its portal goes: the key pieces it was built from are used up
        const key = [...this.built].find(([, piece]) => piece === portalOf(boss))?.[0];
        if (key) {
          this.unput(key);
          this.changed = true;
          this.broadcast({ t: S.UNBUILT, key, piece: portalOf(boss), by: 0 });
        }
        break;
      }
      case C.CHEST_PUT: {
        const { item, count } = msg;
        if (!ITEM_RE.test(item) || !Number.isInteger(count) || count < 1 || !this.canStore(item, count)) {
          // (the page took it out of the backpack: it goes back)
          if (ITEM_RE.test(item) && Number.isInteger(count) && count >= 1 && count <= MAX_STACK) this.send(p, { t: S.CHEST_GOT, item, count });
          return;
        }
        this.store(item, count);
        this.changed = true;
        this.broadcast({ t: S.CHEST, items: this.chest });
        break;
      }
      case C.CHEST_TAKE: {
        const { item, count } = msg;
        if (!p.owner || !Number.isInteger(count) || count < 1 || !(this.chest[item] >= count)) return;
        this.chest[item] -= count;
        if (!this.chest[item]) delete this.chest[item];
        this.changed = true;
        this.send(p, { t: S.CHEST_GOT, item, count });
        this.broadcast({ t: S.CHEST, items: this.chest });
        break;
      }
      case C.CHEST_SPEND: {
        // (the workbench's materials, when the backpack is short: all of it or none)
        const { id, items } = msg;
        if (!Number.isInteger(id) || !p.owner) return;
        const asked = items && typeof items === 'object' && !Array.isArray(items) ? Object.entries(items) : [];
        const ok = asked.length >= 1 && asked.length <= 8 && asked.every(([item, n]) => Number.isInteger(n) && n >= 1 && this.chest[item] >= n);
        if (ok) {
          for (const [item, n] of asked) {
            this.chest[item] -= n;
            if (!this.chest[item]) delete this.chest[item];
          }
          this.changed = true;
          this.broadcast({ t: S.CHEST, items: this.chest });
        }
        this.send(p, { t: S.CHEST_SPENT, id, ok });
        break;
      }
      case C.CLOCK: {
        // The owner, alone on the farm, fast-forwarding (T): only ever forward, and not past a week
        const now = this.hours();
        if (!p.owner || this.connected() > 1 || !finite(msg.hours) || msg.hours < now - 0.05 || msg.hours > now + 24 * 7) return;
        this.clockBase = msg.hours;
        this.clockAt = Date.now();
        this.changed = true;
        break;
      }
      case C.ANIMALS: {
        const state = msg.state;
        if (!p.owner || !state || typeof state !== 'object' || Array.isArray(state)) return;
        if (JSON.stringify(state).length > MAX_ANIMALS) return;
        const { savedAt, hours, tilled, crops, built, machines, felled, mined, treeSites, rockSites, giants, chest, ...animals } = state; // (only the animals' part)
        this.animals = animals;
        this.changed = true;
        break;
      }
    }
  }

  // What is in the machine on tile key now (null: nothing), after p loaded or
  // collected it (got: what p collected)
  setMachine(key, state, p, got) {
    if (state) this.machines.set(key, state);
    else this.machines.delete(key);
    this.changed = true;
    const wire = state && [state.item, round3(state.at), state.takes];
    this.broadcast({ t: S.MACHINE, key, state: wire, by: p.id, ...(got && { got }) });
  }

  // (crop: a seed to give back; piece: the piece whose cost goes back)
  deny(p, op, key, crop, piece) {
    this.send(p, { t: S.FARM_DENY, op, key: typeof key === 'string' ? key.slice(0, 16) : '', crop, piece });
  }

  // [[key, game seconds it has lain bare (none, with something growing), how long it may]]
  tilledList(hours) {
    return [...this.tilled].map(([key, { since, life }]) => [
      key,
      this.crops.has(key) ? 0 : round3(Math.max(0, hours - since) * SECONDS_PER_HOUR),
      round3(life * SECONDS_PER_HOUR),
    ]);
  }

  // how long a tile may lie bare, in game hours
  soilLife() {
    const [lo, hi] = SOIL_BARE_HOURS;
    return lo + this.rand() * (hi - lo);
  }

  canStore(item, count) {
    return chestHasRoom(this.chest, item, count);
  }

  // What of a piece's cost p's page asks to take out of the chest
  // ([[item, count]]), or null if it can't: only the owner takes things out,
  // only what the piece costs, and only what is there
  chestShare(p, piece, asked) {
    if (asked === undefined) return [];
    if (!p.owner || !asked || typeof asked !== 'object' || Array.isArray(asked)) return null;
    const cost = PIECES[piece].cost;
    const share = Object.entries(asked);
    const fits = ([item, n]) => Object.hasOwn(cost, item) && Number.isInteger(n) && n >= 1 && n <= cost[item] && this.chest[item] >= n;
    return share.every(fits) ? share : null;
  }

  // A piece built on tile key, on every tile it stands on (and taken down again)
  put(key, piece) {
    this.built.set(key, piece);
    for (const k of pieceTiles(piece, key)) this.covered.set(k, key);
  }

  unput(key) {
    for (const k of pieceTiles(this.built.get(key), key)) this.covered.delete(k);
    this.built.delete(key);
  }

  // A tile that is farmed: on the farm's island, or in the house's field while there is a house
  farmable(key) {
    if (onFarm(key)) return true;
    if (typeof key !== 'string' || !KEY_RE.test(key) || !this.has('house')) return false;
    return inHouseField(...key.split(',').map(Number));
  }

  // is a `piece` built on the farm? (there is only `one` of some)
  has(piece) {
    for (const built of this.built.values()) if (built === piece) return true;
    return false;
  }

  // how many of `piece` are built on the farm
  count(piece) {
    let n = 0;
    for (const built of this.built.values()) if (built === piece) n++;
    return n;
  }

  store(item, count) {
    this.chest[item] = (this.chest[item] ?? 0) + count;
  }

  // ---------- Every tick ----------
  tickPlace(now) {
    this.tickBosses(now);
    for (const [list, sites, t] of [[this.felled, this.treeSites, S.REGROWN], [this.mined, this.rockSites, S.RESURFACED]]) {
      for (const [id, at] of list) {
        if (now < at) continue;
        list.delete(id);
        const n = nextSite(sites.get(id)); // (in the next of its places)
        if (n) sites.set(id, n);
        else sites.delete(id);
        this.changed = true;
        this.broadcast({ t, id, n });
      }
    }
    if (now - this.soilAt >= SOIL_EVERY) {
      this.soilAt = now;
      const hours = this.hours(now);
      // each morning, maybe a giant (shared/giants.js)
      for (const [kind, id] of this.giants.roll(gameDay(hours), { tree: this.felled, rock: this.mined })) {
        this.changed = true;
        this.broadcast({ t: S.GIANT, kind, id, hp: giantMax(kind), max: giantMax(kind), by: 0 });
        this.say(kind === 'tree' ? 'A giant tree has grown on the farm!' : 'A giant rock has surfaced on the farm!');
      }
      for (const [key, { since, life }] of this.tilled) {
        if (this.crops.has(key) || hours - since < life) continue;
        this.tilled.delete(key);
        this.changed = true;
        this.broadcast({ t: S.UNTILLED, key });
      }
    }
    if (now - this.clockSentAt < CLOCK_EVERY) return;
    this.clockSentAt = now;
    if (this.connected()) this.broadcast({ t: S.FARM_CLOCK, hours: round3(this.hours(now)) });
  }

  // The bosses, while anyone is in their arenas (or till they fall asleep again)
  tickBosses(now) {
    const dt = Math.min(0.25, (now - this.bossAt) / 1000);
    this.bossAt = now;
    for (const [boss, fight] of this.fights) {
      if (fight.phase === 'sleep' && !this.connected()) continue;
      const here = [...this.players.values()].filter((p) => p.conn && arenaAt(p.x, p.z) === boss);
      if (fight.phase === 'sleep' && !here.length) continue;
      for (const fx of fight.step(dt, here)) this.broadcast({ t: S.BOSS_FX, boss, fx });
      if (this.tick % BOSS_SEND === 0 || fight.phase === 'sleep') this.broadcast({ t: S.BOSS, boss, s: fight.toWire() });
    }
  }

  // ---------- Keeping it ----------
  // The farm as the page saves it (src/main.js captureFarm())
  toFarm(now = Date.now()) {
    const hours = round3(this.hours(now));
    return {
      ...this.animals,
      savedAt: now,
      hours,
      tilled: this.tilledList(hours),
      crops: [...this.crops].map(([key, c]) => [key, c.crop, round3((hours - c.plantedAt) * SECONDS_PER_HOUR)]),
      built: [...this.built],
      machines: machinesToSave(this.machines),
      felled: [...this.felled],
      mined: [...this.mined],
      treeSites: [...this.treeSites],
      rockSites: [...this.rockSites],
      giants: this.giants.toSave(),
      dropped: [...this.drops.values()].map((d) => [d.item, d.count, d.x, round3(d.y - GROUND_STAND_Y), d.z]),
    };
  }

  // count of item lying at x, y (where a farmer standing there would be), z,
  // from farmer `from` (0: nobody), who can't take it back till ownAt
  dropAt(item, count, x, y, z, from, ownAt) {
    const drop = { id: ++this.dropId, item, count, x: round3(x), y: round3(y), z: round3(z), from, ownAt };
    this.drops.set(drop.id, drop);
    return drop;
  }
}

// What can be dropped out of a backpack: what has a price (never a tool, coins or a key piece)
function droppable(item) {
  return typeof item === 'string' && ITEM_RE.test(item) && Object.hasOwn(SHOP, item) && item !== 'coin';
}

// What a farm is called to its helpers
export function farmTitle(farm) {
  if (farm.name) return farm.name;
  return farm.ownerName ? `${farm.ownerName}'s farm`.slice(0, MAX_NAME + 7) : 'A farm';
}

// A tile key on the farm's island: "gx,gz", whole tiles, inside the shore
function onFarm(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return false;
  const [gx, gz] = key.split(',').map(Number);
  return Math.abs(gx) <= FARM_HALF && Math.abs(gz) <= FARM_HALF;
}

const round3 = (v) => Math.round(v * 1000) / 1000;

// ---------- The farms being played together right now ----------
const SAVE_EVERY = 3000;
const IDLE_MS = 30_000; // an empty farm is put away after this (long enough for a reload)

export class FarmRooms {
  constructor({ farms, log = console.log }) {
    this.farms = farms;
    this.log = log;
    this.rooms = new Map(); // farm id -> FarmRoom
    setInterval(() => this.save(), SAVE_EVERY).unref();
    setInterval(() => this.reap(), 5000).unref();
  }

  has(id) {
    return this.rooms.has(id);
  }

  // The farm with this id, being played (made now if it isn't yet), or null
  open(id) {
    if (this.rooms.has(id)) return this.rooms.get(id);
    const farm = this.farms.get(id);
    if (!farm) return null;
    const room = new FarmRoom({
      farm,
      admit: (auth, name) => this.admit(farm, auth, name),
      helpers: () => this.farms.get(id)?.helpers?.length ?? 0,
      log: this.log,
    });
    room.start();
    this.rooms.set(id, room);
    this.log(`farm ${id} opened for helpers`);
    return room;
  }

  // Who is joining: the owner (their device's token for this farm), or a
  // helper (a token for a farm the owner has down as a helper)
  admit(farm, auth, name) {
    const theirs = typeof auth === 'string' ? this.farms.auth(`Bearer ${auth}`) : null;
    if (!theirs) return null;
    if (theirs.id === farm.id) {
      this.farms.seenOwner(farm, name);
      return { id: farm.id, owner: true };
    }
    if (!this.farms.seenHelper(farm, theirs.id, name)) return null;
    return { id: theirs.id, owner: false };
  }

  // Taken off a farm's helpers: out of it, if they are on it
  turnOut(farmId, helperId) {
    this.rooms.get(farmId)?.turnOut(helperId);
  }

  write(room) {
    const farm = this.farms.get(room.farmId);
    if (!farm) return;
    room.changed = false;
    farm.save = { ...farm.save, farm: room.toFarm() };
    farm.chest = { ...room.chest };
    farm.roomRev = (farm.roomRev ?? 0) + 1;
    this.farms.write(farm);
  }

  save() {
    for (const room of this.rooms.values()) if (room.changed) this.write(room);
  }

  reap() {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (room.players.size || now - room.emptySince < IDLE_MS) continue;
      if (room.changed) this.write(room);
      room.close();
      this.rooms.delete(id);
      this.log(`farm ${id} put away (nobody on it)`);
    }
  }

  // The server is stopping: write every farm being played
  flush() {
    for (const room of this.rooms.values()) this.write(room);
  }
}
