// One online lobby: the players in it, its island and its resource spots. The server runs
// one Room per lobby code (server/lobby.js). Everyone's farm stays at home in
// their own browser; a lobby is where farmers meet to gather.
//
// Every lobby is on a wild island of its own, grown from the lobby's seed
// (shared/worldgen.js): the room needs its spots and where farmers arrive,
// the players' pages build the rest from the same seed.
//
// Lobbies are drop-in: no rounds, no start and no end. Berry bushes,
// mushrooms and treasure spots (shared/level.js) regrow a while after someone
// empties them, each time with a fresh roll of what is there, so now and then
// something rare turns up and the whole lobby hears about it. Whoever gets to a
// spot first takes it.
//
// The trees can be chopped down for wood. The room doesn't know where they
// stand (the pages grow them from the seed), only which are down: a page says
// which tree it felled, where and how big it is, and the room checks the player is next to
// that spot, that the tree is still standing, and that they haven't been
// felling trees faster than an axe can.
//
// The players, their seats, chat and position snapshots are shared/place.js;
// what is here is the lobby's own.
//
import { MAX_PLAYERS, MAX_NAME, HOLD_MS, PLAYER_COLORS } from './constants.js';
import { C, S, cleanText, finite } from './protocol.js';
import { Place } from './place.js';
import { SPOT_KINDS, RARE, TREE, rollLoot, woodFor, spawnPoint } from './level.js';
import { islandFor, CLASSIC_SEED } from './worldgen.js';

const TOUCH_REACH = 1.8; // the client collects at 0.6; the slack covers a position up to ~150 ms old
const GATHER_REACH = 2.4; // the client gathers within 1.6 (sideways)
const CHOP_REACH = 2.6; // the client chops within 1.5 of the trunk
const CHOP_EVERY = 1000; // ms: the fewest between two felled trees (felling one takes TREE.hits swings)
const MAX_TREES = 2000; // tree ids are below this (an island has a couple of hundred)
const WHERE = { ledge: 'up on a ledge', meadow: 'out in the meadow', mushroom: 'among the mushrooms', bush: 'in a berry bush' };

export class Room extends Place {
  // seed: the island's (shared/worldgen.js). rand: () => [0, 1), for the loot
  // rolls and regrow times (tests pass their own)
  constructor({ code, name = 'Lobby', seed = CLASSIC_SEED, inviteOnly = false, maxPlayers = MAX_PLAYERS, rand = Math.random, log = () => {} }) {
    const island = islandFor(seed);
    super({ code, name, maxPlayers, worldLimit: island.half + 40, rand, log });
    this.island = island;
    this.seed = island.seed;
    this.inviteOnly = inviteOnly;
    // Every spot starts out full
    this.spots = this.island.spots.map(([kind, x, y, z], id) => {
      const [item, count] = rollLoot(kind, rand);
      return { id, kind, x, y, z, item, count, regrowAt: 0 };
    });
    this.felled = new Map(); // tree id -> when it grows back (ms)
    this.createdAt = Date.now(); // the time of day everyone sees counts from here
  }

  // ---------- Who is here ----------
  info() {
    let rare = 0;
    for (const s of this.spots) if (RARE[s.item]) rare++;
    return {
      code: this.code,
      name: this.name,
      seed: this.seed,
      players: this.players.size,
      max: this.maxPlayers,
      full: this.players.size >= this.maxPlayers,
      inviteOnly: this.inviteOnly,
      rare, // rare finds lying about right now
    };
  }

  playerExtra(p) {
    return { finds: p.finds, rares: p.rares, wood: p.wood };
  }

  spawnFor(id) {
    return spawnPoint(this.island.spawn, id % 8, 8); // somewhere in the stone circle
  }

  // A new player in a seat (or, from a save, an away one whose seat is held)
  seat({ finds = 0, rares = 0, wood = 0, ...rest }) {
    return super.seat({
      ...rest,
      finds, // spots emptied this visit
      rares, // ...of which rare finds
      wood, // logs chopped this visit
      chopAt: 0, // when they last felled a tree
    });
  }

  welcome(p, resumed) {
    this.send(p, {
      t: S.WELCOME,
      id: p.id,
      name: p.name,
      color: p.color,
      code: this.code,
      seed: this.seed,
      room: { name: this.name, inviteOnly: this.inviteOnly, maxPlayers: this.maxPlayers },
      spots: this.spots.map(({ id, kind, x, y, z, item, count }) => [id, kind, x, y, z, item, count]),
      felled: [...this.felled.keys()],
      roster: this.rosterList(),
      pos: { x: p.x, y: p.y, z: p.z },
      clock: (Date.now() - this.createdAt) / 1000,
      resumed,
    });
  }

  // ---------- Messages ----------
  act(p, msg) {
    switch (msg?.t) {
      case C.TAKE: {
        const spot = this.spots[msg.id];
        if (!spot?.item || !this.inReach(p, spot)) {
          this.send(p, { t: S.DENY, id: msg.id });
          return;
        }
        const { item, count } = spot;
        const [lo, hi] = SPOT_KINDS[spot.kind].regrow;
        spot.item = null;
        spot.count = 0;
        spot.regrowAt = Date.now() + (lo + this.rand() * (hi - lo)) * 1000;
        p.finds++;
        if (RARE[item]) {
          p.rares++;
          this.say(`${p.name} found ${RARE[item].toLowerCase()}!`);
        }
        this.rosterDirty = true;
        this.changed = true;
        this.broadcast({ t: S.TAKEN, id: spot.id, by: p.id, item, count });
        break;
      }
      case C.CHOP: {
        const { id, x, z } = msg;
        const now = Date.now();
        const ok = Number.isInteger(id) && id >= 0 && id < MAX_TREES && finite(x, z) &&
          !this.felled.has(id) && now - p.chopAt >= CHOP_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= CHOP_REACH && Math.abs(p.y - 0.8) < 2;
        if (!ok) {
          this.send(p, { t: S.CHOP_DENY, id });
          return;
        }
        const [lo, hi] = TREE.regrow;
        this.felled.set(id, now + (lo + this.rand() * (hi - lo)) * 1000);
        const count = woodFor(msg.size, this.rand); // (the bigger the tree, the more wood)
        p.chopAt = now;
        p.wood += count;
        this.rosterDirty = true;
        this.changed = true;
        this.broadcast({ t: S.FELLED, id, by: p.id, count });
        break;
      }
    }
  }

  inReach(p, spot) {
    if (SPOT_KINDS[spot.kind].use === 'touch') return Math.hypot(spot.x - p.x, spot.y - p.y, spot.z - p.z) <= TOUCH_REACH;
    return Math.hypot(spot.x - p.x, spot.z - p.z) <= GATHER_REACH && Math.abs(p.y - spot.y) < 2;
  }

  // ---------- Every tick ----------
  tickPlace(now) {
    for (const spot of this.spots) {
      if (spot.item || now < spot.regrowAt) continue;
      [spot.item, spot.count] = rollLoot(spot.kind, this.rand);
      this.changed = true;
      this.broadcast({ t: S.SPOT, id: spot.id, item: spot.item, count: spot.count });
      if (RARE[spot.item]) {
        this.say(`Something sparkles ${WHERE[spot.kind]}... ${RARE[spot.item].toLowerCase()}!`);
      }
    }

    for (const [id, at] of this.felled) {
      if (now < at) continue;
      this.felled.delete(id);
      this.changed = true;
      this.broadcast({ t: S.REGROWN, id });
    }
  }

  // ---------- Saving ----------
  // What the lobby keeps of a room, as plain JSON. The island grows again from
  // the seed, so only what happened on it is kept: what is on each spot, which
  // trees are down, and who was here (for a restart while they were playing).
  // Times are the wall clock's, so regrowing carries on while a room is away.
  toSave() {
    return {
      code: this.code,
      name: this.name,
      seed: this.seed,
      inviteOnly: this.inviteOnly,
      maxPlayers: this.maxPlayers,
      createdAt: this.createdAt,
      nextId: this.nextId,
      spots: this.spots.map(({ id, kind, x, z, item, count, regrowAt }) => [id, kind, x, z, item, count, regrowAt]),
      felled: [...this.felled],
      seats: [...this.players.values()].map(({ id, key, name, color, finds, rares, wood }) => ({ id, key, name, color, finds, rares, wood })),
    };
  }

  // A room as it was saved. A spot keeps what was on it only if the island
  // still has that spot (the same kind, in the same place) and it can still
  // turn up there, so a save from before a change to shared/worldgen.js or
  // shared/level.js still loads: whatever changed starts out fresh. The players
  // who were here are away, their seats held until holdUntil.
  static fromSave(save, { holdUntil = Date.now() + HOLD_MS, ...options } = {}) {
    const { code, name, seed, inviteOnly, maxPlayers } = save;
    const room = new Room({ ...options, code, name, seed, inviteOnly, maxPlayers });
    if (Number.isFinite(save.createdAt)) room.createdAt = save.createdAt;
    for (const [id, kind, x, z, item, count, regrowAt] of save.spots ?? []) {
      const spot = Number.isInteger(id) ? room.spots[id] : null;
      if (!spot || spot.kind !== kind || !finite(x, z) || Math.hypot(spot.x - x, spot.z - z) > 0.01) continue;
      if (item === null) {
        Object.assign(spot, { item: null, count: 0, regrowAt: Number.isFinite(regrowAt) ? regrowAt : 0 });
      } else {
        const loot = SPOT_KINDS[kind].loot.find(([it]) => it === item);
        if (loot && Number.isInteger(count)) Object.assign(spot, { item, count: Math.max(loot[2], Math.min(loot[3], count)) });
      }
    }
    for (const [id, at] of save.felled ?? []) {
      if (Number.isInteger(id) && id >= 0 && id < MAX_TREES && Number.isFinite(at)) room.felled.set(id, at);
    }
    const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    for (const s of (save.seats ?? []).slice(0, room.maxPlayers)) {
      if (!Number.isInteger(s.id) || s.id < 1 || room.players.has(s.id) || typeof s.key !== 'string' || !s.key) continue;
      const color = PLAYER_COLORS.includes(s.color) ? s.color : PLAYER_COLORS[0];
      room.seat({
        id: s.id, key: s.key.slice(0, 64), name: cleanText(s.name, MAX_NAME) || 'Farmer', color,
        finds: n(s.finds), rares: n(s.rares), wood: n(s.wood), heldUntil: holdUntil,
      });
    }
    room.nextId = Math.max(n(save.nextId), ...[...room.players.keys()].map((id) => id + 1), 1);
    room.changed = false;
    return room;
  }
}
