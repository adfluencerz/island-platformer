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
// The farm's trees are chopped for wood and its rocks broken up for stone the
// way a lobby's are (CHOP, MINE: the wood or stone goes to whoever did it),
// and the room keeps when each comes back.
//
// The animals are the owner's page's: it drives them (eggs, milk and wool go
// to the owner, as at home) and sends their state along (ANIMALS); everyone
// else's page draws them from that, for company. With the owner away they
// keep as they were, and the owner's page catches up on what they gave when
// it next has them (src/animals.js restore()).
//
// The farm is kept in the farm's own file, in the page's save format (the
// save's `farm`: { savedAt, hours, tilled: [[key, bare, life]], crops: [[key, crop, age]], built:
// [[key, piece]], felled and mined: [[tree or rock id, when it comes back (ms)]],
// treeSites and rockSites: [[id, how often it grew back]],
// ...the animals }), so the owner's page can always play it, alone, from there; the
// chest beside the save (farm.chest), where no page's save can write over it.
// Each time the room writes the farm, farm.roomRev goes up: a page that
// played the farm alone, offline, meanwhile knows its farm is out of date.
import { Place } from '../shared/place.js';
import { S, C, finite } from '../shared/protocol.js';
import { CLOSE, CLOSE_TEXT, DAY_LENGTH_SECONDS, MAX_NAME, SOIL_BARE_HOURS } from '../shared/constants.js';
import { CROP_GROW_TIME, CROP_PRODUCE, SPAWN, GROUND_STAND_Y, PIECES, MAX_PIECES, TREE, ROCK, CHEST, HOUSE_ROOM, keptClear, chestHasRoom, pieceTiles, inHouseField, spawnPoint, woodFor, stoneFor, nextSite, siteMap } from '../shared/level.js';

const FARM_HALF = 28; // tiles reach this far from the middle (the home map's HOME_HALF, less the shore)
const REACH = 2.6; // the client farms the tile underfoot, or one tapped within 2.2
const SECONDS_PER_HOUR = DAY_LENGTH_SECONDS / 24;
const RIPE_SLACK = 1; // seconds: pages count growth on their own clocks
const MAX_STACK = CHEST.stack; // of one item in the chest
const MAX_ANIMALS = 16 * 1024; // bytes of the animals' state
const CLOCK_EVERY = 10_000; // ms between FARM_CLOCKs
const SOIL_EVERY = 1000; // ms between looks at the bare soil
// (as in a lobby: shared/room.js)
const CHOP_REACH = 2.6;
const CHOP_EVERY = 1000; // ms
const MAX_TREES = 2000;
const MINE_REACH = 2.6;
const MINE_EVERY = 900; // ms
const MAX_ROCKS = 2000;
const ITEM_RE = /^[a-z][a-z0-9_]{0,31}$/;
const KEY_RE = /^-?\d{1,3},-?\d{1,3}$/;

export class FarmRoom extends Place {
  // farm: the farm (server/farms.js). admit(auth, name): who the joiner is,
  // { id, owner }, or null for someone who isn't the owner or a helper.
  constructor({ farm, admit, log = () => {} }) {
    super({ code: farm.id, name: farmTitle(farm), worldLimit: Math.max(FARM_HALF, HOUSE_ROOM.x0 + HOUSE_ROOM.w) + 40, log }); // (the house's room is out past the sea)
    this.farmId = farm.id;
    this.admit = admit;
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
      if (free && this.built.size < MAX_PIECES && !(PIECES[piece].one && this.has(piece))) this.put(key, piece);
    }
    const comingBack = (list, most) => new Map((Array.isArray(list) ? list : []).filter(([id, at]) => Number.isInteger(id) && id >= 0 && id < most && Number.isFinite(at)));
    this.felled = comingBack(saved?.felled, MAX_TREES); // tree id -> when it grows back (ms)
    this.mined = comingBack(saved?.mined, MAX_ROCKS); // rock id -> when a new one surfaces (ms)
    // how often each grew back (which of its places it is in: shared/level.js nextSite)
    this.treeSites = siteMap(saved?.treeSites, MAX_TREES);
    this.rockSites = siteMap(saved?.rockSites, MAX_ROCKS);
    // the rest of the farm is the animals', as the owner's page saved them
    // (and the chest the page keeps when it plays the farm alone: the owner's
    // page puts what is in it into this one when it comes)
    const { savedAt, hours, tilled, crops, built, felled, mined, treeSites, rockSites, chest, ...animals } = saved ?? {};
    this.animals = animals;
    this.chest = { ...(farm.chest ?? {}) };
    this.ownerName = farm.ownerName ?? ''; // (for the words: "Ann takes things out of the chest")
    this.clockSentAt = now;
    this.soilAt = now;
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
      farm: { id: this.farmId, name: this.name, owner: this.ownerName },
      mine: p.owner,
      tilled: this.tilledList(this.hours()),
      crops: [...this.crops].map(([key, c]) => [key, c.crop, round3(c.plantedAt)]),
      built: [...this.built],
      felled: [...this.felled],
      mined: [...this.mined],
      treeSites: [...this.treeSites],
      rockSites: [...this.rockSites],
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
  // Close enough to the tile, and down on the ground (not up on a platform)
  near(p, key) {
    const [gx, gz] = key.split(',').map(Number);
    return Math.hypot(gx - p.x, gz - p.z) <= REACH && Math.abs(p.y - GROUND_STAND_Y) < 0.6;
  }

  act(p, msg) {
    switch (msg?.t) {
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
        const ok = onFarm(key) && fromChest && tiles.every(free) && this.built.size < MAX_PIECES && !(PIECES[piece].one && this.has(piece)) && this.near(p, key);
        if (!ok) return this.deny(p, 'build', key, undefined, Object.hasOwn(PIECES, piece) ? piece : undefined);
        for (const [item, n] of fromChest) {
          this.chest[item] -= n;
          if (!this.chest[item]) delete this.chest[item];
        }
        this.put(key, piece);
        this.changed = true;
        this.broadcast({ t: S.BUILT, key, piece, by: p.id });
        if (fromChest.length) this.broadcast({ t: S.CHEST, items: this.chest });
        break;
      }
      case C.UNBUILD: {
        // (key: any tile the piece stands on, next to the one taking it down)
        const { key } = msg;
        const at = onFarm(key) && this.covered.get(key);
        const piece = at && this.built.get(at);
        if (!piece || !this.near(p, key)) return this.deny(p, 'unbuild', key);
        this.unput(at);
        this.changed = true;
        this.broadcast({ t: S.UNBUILT, key: at, piece, by: p.id });
        break;
      }
      case C.CHOP: {
        // (as in a lobby: the page says where the tree stands, the room checks the chopper is by it)
        const { id, x, z } = msg;
        const now = Date.now();
        const ok = Number.isInteger(id) && id >= 0 && id < MAX_TREES && finite(x, z) &&
          !this.felled.has(id) && now - (p.chopAt ?? 0) >= CHOP_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= CHOP_REACH && Math.abs(p.y - GROUND_STAND_Y) < 2;
        if (!ok) return this.send(p, { t: S.CHOP_DENY, id });
        const [lo, hi] = TREE.regrow;
        const at = Math.round(now + (lo + this.rand() * (hi - lo)) * 1000);
        this.felled.set(id, at);
        p.chopAt = now;
        this.changed = true;
        this.broadcast({ t: S.FELLED, id, by: p.id, count: woodFor(msg.size, this.rand), at });
        break;
      }
      case C.MINE: {
        // (the same for a rock)
        const { id, x, z } = msg;
        const now = Date.now();
        const size = Math.min(ROCK.size[1], Number.isFinite(msg.size) ? msg.size : 0);
        const ok = Number.isInteger(id) && id >= 0 && id < MAX_ROCKS && finite(x, z) &&
          !this.mined.has(id) && now - (p.mineAt ?? 0) >= MINE_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= MINE_REACH + size * 1.5 && Math.abs(p.y - GROUND_STAND_Y) < 2;
        if (!ok) return this.send(p, { t: S.MINE_DENY, id });
        const [lo, hi] = ROCK.regrow;
        const at = Math.round(now + (lo + this.rand() * (hi - lo)) * 1000);
        this.mined.set(id, at);
        p.mineAt = now;
        this.changed = true;
        this.broadcast({ t: S.MINED, id, by: p.id, count: stoneFor(msg.size, this.rand), at });
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
        const { savedAt, hours, tilled, crops, built, felled, mined, treeSites, rockSites, chest, ...animals } = state; // (only the animals' part)
        this.animals = animals;
        this.changed = true;
        break;
      }
    }
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

  store(item, count) {
    this.chest[item] = (this.chest[item] ?? 0) + count;
  }

  // ---------- Every tick ----------
  tickPlace(now) {
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
      felled: [...this.felled],
      mined: [...this.mined],
      treeSites: [...this.treeSites],
      rockSites: [...this.rockSites],
    };
  }
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
    const room = new FarmRoom({ farm, admit: (auth, name) => this.admit(farm, auth, name), log: this.log });
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
