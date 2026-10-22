// One online lobby: the players in it, its island and its resource spots. The server runs
// one Room per lobby code (server/lobby.js). Everyone's farm stays at home in
// their own browser; a lobby is where farmers meet to gather.
//
// Every lobby is on a wild island of its own, grown from the lobby's seed
// (shared/worldgen.js): the room needs its spots and where farmers arrive,
// the players' pages build the rest from the same seed.
//
// A lobby is a match (server/lobby.js): farmers drop in while it runs, and
// nothing on its island grows back. Berry bushes, mushrooms and treasure spots
// (shared/level.js) each have one roll of what is there, so now and then
// something rare turns up and the whole lobby hears about it. Whoever gets to
// a spot first takes it, and it stays empty. Once everyone has left the lobby
// is thrown away.
//
// The rocks can be broken up for stone with the pickaxe, and stay broken (the
// room keeps which are, by their number; ROCK in shared/level.js).
//
// The trees can be chopped down for wood, and stay down. The room doesn't know where they
// stand (the pages grow them from the seed), only which are down: a page says
// which tree it felled, where and how big it is, and the room checks the player is next to
// that spot, that the tree is still standing, and that they haven't been
// felling trees faster than an axe can.
//
// With a wooden sword or a mallet in hand (WEAPONS in shared/level.js) a
// farmer can bop another: the room picks who is in front of them and in
// reach, knocks them back, and has them drop a little of what they gathered
// on this visit (it keeps count, in p.bag) for anyone to walk into. Drops
// fade after a while, and aren't kept when the lobby is saved.
//
// Now and then, as a lobby opens, one tree is a giant, or one rock (shared/giants.js):
// every swing at it comes here (HIT), so everyone's add up, and what it gives
// is shared by how much each farmer did.
//
// With a fishing rod a farmer casts into the sea or the pond (CAST): the
// room rolls what will bite and when (shared/fishing.js), says so when it
// does (BITE), and if REEL comes in time it is theirs (CAUGHT), the lobby
// hearing of a rare one. Casting goes on as long as anyone likes.
//
// At the signpost in the stone circle, a farmer can start a party game
// (shared/minigame.js): whoever joins is off to an arena of its own for a
// while, out of the lobby's doings, and back with a prize for the winner.
//
// The players, their seats, chat and position snapshots are shared/place.js;
// what is here is the lobby's own.
//
import { MAX_PLAYERS, MAX_NAME, HOLD_MS, PLAYER_COLORS, devToolsOn } from './constants.js';
import { C, S, cleanText, finite } from './protocol.js';
import { Place } from './place.js';
import { GROUND_STAND_Y, SPOT_KINDS, RARE, WEAPONS, BOP_GRACE, SAFE_CIRCLE, DROP_MS, DROP_OWN_MS, rollSpot, woodFor, stoneFor, spawnPoint, siteMap } from './level.js';
import { islandFor, CLASSIC_SEED } from './worldgen.js';
import { Giants, giantSwing, giantMax } from './giants.js';
import { growWilds, wildsToWire, standsAt } from './wilds.js';
import { RODS, CAST_EVERY, CAST_REACH, castLine, waterOn } from './fishing.js';
import { DAY_LENGTH_SECONDS, SKILLS } from './balance.js';
import { LOBBY_DAWN } from './giants.js';
import { Party } from './minigame.js';

const TOUCH_REACH = 2.2; // the client collects at 1 (a drop at 1.4); the slack covers a position up to ~150 ms old
const GATHER_REACH = 2.4; // the client gathers within 1.6 (sideways)
const CHOP_REACH = 2.6; // the client chops within 1.5 of the trunk
const CHOP_EVERY = 1000; // ms: the fewest between two felled trees (felling one takes TREE.hits swings)
const MINE_REACH = 2.6; // the client mines within 1.3 of the rock's edge (plus the rock itself: up to 1.5 times its size, as drawn)
const MINE_EVERY = 900; // ms: the fewest between two broken rocks (breaking one takes ROCK.hits swings)
const REEL_SLACK = 450; // ms: a REEL this late after the bite window still counts (the BITE took a while to get there, and the REEL back)
const MAX_DROPS = 60;
const round2 = (v) => Math.round(v * 100) / 100;
const KEEPS = new Set(['coin', ...Object.keys(RARE)]); // (never knocked loose)
const KEY_KINDS = new Set(['meadow', 'ledge', 'sky']); // where a lobby's one sure key can go (Room.hideKey)

export class Room extends Place {
  // seed: the island's (shared/worldgen.js). rand: () => [0, 1), for the loot
  // rolls and regrow times (tests pass their own)
  constructor({ code, name = 'Lobby', seed = CLASSIC_SEED, inviteOnly = false, maxPlayers = MAX_PLAYERS, rand = Math.random, log = () => {} }) {
    const island = islandFor(seed);
    super({ code, name, maxPlayers, worldLimit: island.half + 40, rand, log });
    this.island = island;
    this.seed = island.seed;
    // where its trees and rocks stand (shared/wilds.js): the room's, sent to every page
    this.wilds = growWilds(island);
    this.wildsWire = wildsToWire(this.wilds);
    this.inviteOnly = inviteOnly;
    // Every spot starts out full
    // (a chest up on a sky isle has a bundle of things in it: shared/level.js rollSpot)
    this.spots = this.island.spots.map(([kind, x, y, z], id) => ({ id, kind, x, y, z, ...rollSpot(this.island, kind, x, z, rand), regrowAt: 0 }));
    this.hideKey();
    this.felled = new Map(); // tree id -> when it grows back (ms)
    this.mined = new Map(); // rock id -> when a new one surfaces (ms)
    // how often each tree and rock grew back (so which of its places it is in: shared/level.js nextSite)
    this.treeSites = new Map(); // tree id -> count
    this.rockSites = new Map(); // rock id -> count
    this.drops = new Map(); // id -> { id, item, count, x, y, z, until, from, ownAt } (from: who it was knocked out of, who can't take it back till ownAt)
    this.dropId = 0;
    this.giants = new Giants(rand); // (shared/giants.js)
    this.giants.setCounts(this.wilds.trees.length, this.wilds.rocks.length);
    this.createdAt = Date.now(); // the time of day everyone sees counts from here
    this.party = new Party(this); // (its party games)
  }

  // Every lobby has at least one old key somewhere. If none was rolled, one
  // goes on a meadow, ledge or sky spot (they can turn one up, so a save keeps
  // it: fromSave), never on golden seeds, and never in a chest's bundle (those
  // aren't saved).
  hideKey() {
    if (this.spots.some((s) => s.item === 'key' || s.bundle?.some(([item]) => item === 'key'))) return;
    const can = this.spots.filter((s) => KEY_KINDS.has(s.kind));
    const plain = can.filter((s) => !RARE[s.item]);
    const spots = plain.length ? plain : can;
    if (!spots.length) return;
    Object.assign(spots[Math.floor(this.rand() * spots.length)], { item: 'key', count: 1 });
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
    return { finds: p.finds, rares: p.rares, wood: p.wood, stone: p.stone, game: p.game };
  }

  spawnFor(id) {
    return spawnPoint(this.island.spawn, id % 8, 8); // somewhere in the stone circle
  }

  // A new player in a seat (or, from a save, an away one whose seat is held)
  seat({ finds = 0, rares = 0, wood = 0, stone = 0, ...rest }) {
    return super.seat({
      ...rest,
      finds, // spots emptied this visit
      rares, // ...of which rare finds
      wood, // logs chopped this visit
      stone, // stone mined this visit
      chopAt: 0, // when they last felled a tree
      mineAt: 0, // when they last broke a rock
      hitAt: 0, // when they last swung at a giant
      bag: {}, // what they gathered on this visit: item -> count (what a bop can knock loose)
      bopAt: 0, // when they last swung a weapon
      boppedAt: 0, // when they were last bopped
      castAt: 0, // when they last cast a line
      line: null, // the line they have out: { n, item, count, items, window, x, z, biteAt, bit } (castLine, shared/fishing.js)
      game: 0, // the party game they are off in (0: here in the lobby)
    });
  }

  remove(p) {
    super.remove(p);
    this.party.leave(p, { gone: true });
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
      mined: [...this.mined.keys()],
      treeSites: [...this.treeSites],
      rockSites: [...this.rockSites],
      wilds: this.wildsWire,
      drops: [...this.drops.values()].map((d) => [d.id, d.item, d.count, d.x, d.y, d.z, d.from, Math.max(0, d.ownAt - Date.now())]),
      roster: this.rosterList(),
      pos: { x: p.x, y: p.y, z: p.z },
      clock: (Date.now() - this.createdAt) / 1000,
      giants: this.giants.toSave(),
      game: this.party.wire(),
      resumed,
    });
  }

  // ---------- Messages ----------
  act(p, msg) {
    switch (msg?.t) {
      case C.GAME_START: {
        const why = this.party.start(p, msg.game);
        if (why) this.send(p, { t: S.CHAT, from: 0, text: why });
        return;
      }
      case C.GAME_JOIN:
        return this.party.join(p);
      case C.GAME_LEAVE:
        return this.party.leave(p);
      case C.GAME_COIN:
        return this.party.coin(p, msg.id);
    }
    // (off in a party game's arena: nothing of the lobby's, bar a bop at whoever is there too)
    if (p.game && msg?.t !== C.BOP) {
      if (msg?.t === C.TAKE) this.send(p, { t: S.DENY, id: msg.id });
      return;
    }
    switch (msg?.t) {
      case C.TAKE: {
        const spot = this.spots[msg.id];
        // (the locked chest on a sky isle takes an old key, out of the page's backpack as on a farm)
        if (!spot?.item || !this.inReach(p, spot) || (spot.kind === 'sky_vault' && msg.key !== true)) {
          this.send(p, { t: S.DENY, id: msg.id });
          return;
        }
        const { item, count, bundle } = spot;
        spot.item = null; // (for good)
        spot.count = 0;
        p.finds++;
        for (const [it, n] of bundle ?? [[item, count]]) {
          this.gathered(p, it, n);
          if (RARE[it]) {
            p.rares++;
            this.say(`${p.name} found ${RARE[it].toLowerCase()}!`);
          }
        }
        if (spot.kind === 'sky_vault') this.say(`${p.name} unlocked a chest up on a sky isle!`);
        this.rosterDirty = true;
        this.changed = true;
        this.broadcast({ t: S.TAKEN, id: spot.id, by: p.id, item, count, ...(bundle && { items: bundle }) });
        break;
      }
      case C.CHOP: {
        const { id, x, z } = msg;
        const now = Date.now();
        const tree = Number.isInteger(id) ? this.wilds.trees[id] : null;
        const ok = tree && finite(x, z) && standsAt(tree, x, z) &&
          !this.felled.has(id) && !this.giants.is('tree', id) && now - p.chopAt >= CHOP_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= CHOP_REACH && Math.abs(p.y - 0.8) < 2;
        if (!ok) {
          this.send(p, { t: S.CHOP_DENY, id });
          return;
        }
        this.felled.set(id, 0); // (for good)
        const count = woodFor(tree.scale, this.rand); // (the bigger the tree, the more wood)
        p.chopAt = now;
        p.wood += count;
        this.gathered(p, 'wood', count);
        this.rosterDirty = true;
        this.changed = true;
        this.broadcast({ t: S.FELLED, id, by: p.id, count });
        break;
      }
      case C.MINE: {
        const { id, x, z } = msg;
        const now = Date.now();
        const rock = Number.isInteger(id) ? this.wilds.rocks[id] : null;
        const size = rock?.size ?? 0;
        const ok = rock && finite(x, z) && standsAt(rock, x, z) &&
          !this.mined.has(id) && !this.giants.is('rock', id) && now - p.mineAt >= MINE_EVERY &&
          Math.hypot(x - p.x, z - p.z) <= MINE_REACH + size * 1.5 && Math.abs(p.y - 0.8) < 2;
        if (!ok) {
          this.send(p, { t: S.MINE_DENY, id });
          return;
        }
        this.mined.set(id, 0); // (for good)
        const count = stoneFor(size, this.rand); // (the bigger the rock, the more stone)
        p.mineAt = now;
        p.stone += count;
        this.gathered(p, 'stone', count);
        this.rosterDirty = true;
        this.changed = true;
        this.broadcast({ t: S.MINED, id, by: p.id, count });
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
        const hit = giantSwing(this.giants, p, this.sized(msg));
        if (!hit) return;
        const { kind, id } = hit;
        this.changed = true;
        this.broadcast({ t: S.GIANT, kind, id, hp: hit.hp, max: giantMax(kind), by: p.id });
        if (!hit.shares) break;
        // down: for everyone the way an ordinary one goes, and the loot to whoever helped
        const tree = kind === 'tree';
        (tree ? this.felled : this.mined).set(id, 0); // (for good)
        const item = tree ? 'wood' : 'stone';
        for (const [who, count] of hit.shares) {
          const q = this.players.get(who);
          if (!q) continue;
          q[item] += count;
          this.gathered(q, item, count);
        }
        this.rosterDirty = true;
        const by = hit.shares.find(([who]) => who === p.id)?.[1] ?? 0;
        this.broadcast({ t: tree ? S.FELLED : S.MINED, id, by: p.id, count: by, shares: hit.shares });
        this.say(`${tree ? 'The giant tree came down' : 'The giant rock broke up'}: ${hit.loot} ${item} for ${hit.shares.length > 1 ? `the ${hit.shares.length} who helped` : p.name}!`);
        break;
      }
      case C.BOP: {
        const weapon = Object.hasOwn(WEAPONS, msg.weapon) ? WEAPONS[msg.weapon] : null;
        const now = Date.now();
        if (!weapon || now - p.bopAt < weapon.every - 150 || this.resting(p)) return;
        p.bopAt = now;
        if (finite(msg.yaw)) p.yaw = msg.yaw;
        const target = this.inFront(p, weapon.reach, now);
        if (!target) return;
        target.boppedAt = now;
        const d = Math.hypot(target.x - p.x, target.z - p.z);
        const dx = d > 0.01 ? (target.x - p.x) / d : Math.sin(p.yaw);
        const dz = d > 0.01 ? (target.z - p.z) / d : Math.cos(p.yaw);
        const drop = this.knockLoose(target, weapon.drops, now);
        this.broadcast({
          t: S.BOPPED, by: p.id, id: target.id, dx: round2(dx), dz: round2(dz), knock: weapon.knock,
          drop: drop && [drop.item, drop.count],
        });
        if (drop) this.broadcast({ t: S.DROP, id: drop.id, item: drop.item, count: drop.count, x: drop.x, y: drop.y, z: drop.z, from: drop.from, wait: DROP_OWN_MS });
        break;
      }
      case C.CAST: {
        const now = Date.now();
        const rod = Object.hasOwn(RODS, msg.rod ?? '') ? msg.rod : null;
        const ok = rod && finite(msg.x, msg.z) && now - p.castAt >= CAST_EVERY &&
          Math.hypot(msg.x - p.x, msg.z - p.z) <= CAST_REACH + 0.5 && waterOn(this.island, msg.x, msg.z);
        const n = Number.isInteger(msg.n) ? msg.n : 0;
        p.line = null;
        if (!ok) {
          this.send(p, { t: S.CAUGHT, n, item: null });
          return;
        }
        p.castAt = now;
        const level = Number.isInteger(msg.level) ? Math.max(1, Math.min(SKILLS.max, msg.level)) : 1; // (the page keeps the skills)
        const line = castLine('lobby', rod, this.hour(now), level, this.rand);
        p.line = { ...line, n, x: msg.x, z: msg.z, biteAt: now + line.bite * 1000, bit: false };
        break;
      }
      case C.REEL: {
        const line = p.line;
        p.line = null;
        if (!line?.bit) return; // (reeled in before anything bit)
        const late = Date.now() > line.biteAt + line.window + REEL_SLACK;
        if (late || Math.hypot(line.x - p.x, line.z - p.z) > CAST_REACH + 1.5) {
          this.send(p, { t: S.CAUGHT, n: line.n, item: null });
          return;
        }
        p.finds++;
        for (const [it, n] of line.items ?? [[line.item, line.count]]) {
          this.gathered(p, it, n);
          if (RARE[it]) {
            p.rares++;
            this.say(`${p.name} fished up ${RARE[it].toLowerCase()}!`);
          }
        }
        this.rosterDirty = true;
        this.changed = true;
        this.send(p, { t: S.CAUGHT, n: line.n, item: line.item, count: line.count, ...(line.items && { items: line.items }) });
        break;
      }
      case C.PICKUP: {
        const drop = this.drops.get(msg.id);
        // (not straight back into the bag it was knocked out of: they are still
        // standing on it, and the farmer who bopped them would never get a look in)
        const mine = drop?.from === p.id && Date.now() < drop.ownAt;
        if (!drop || mine || Math.hypot(drop.x - p.x, drop.y - p.y, drop.z - p.z) > TOUCH_REACH) {
          this.send(p, { t: S.DROP_DENY, id: msg.id });
          return;
        }
        this.drops.delete(drop.id);
        this.gathered(p, drop.item, drop.count);
        this.broadcast({ t: S.PICKED, id: drop.id, by: p.id, item: drop.item, count: drop.count });
        break;
      }
    }
  }

  // Something gathered on this visit, that a bop could knock loose again
  gathered(p, item, count) {
    if (!KEEPS.has(item)) p.bag[item] = (p.bag[item] ?? 0) + count;
  }

  // In the stone circle where farmers arrive: nobody bops or is bopped there
  // (an arena has none)
  resting(p) {
    return !p.game && Math.hypot(p.x - this.island.spawn.x, p.z - this.island.spawn.z) < SAFE_CIRCLE;
  }

  // The nearest farmer in front of p within reach who can be bopped (or null)
  inFront(p, reach, now) {
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    let best = null;
    let bestD = reach;
    for (const q of this.players.values()) {
      if (q === p || !q.conn || q.game !== p.game || now - q.boppedAt < BOP_GRACE || this.resting(q) || Math.abs(q.y - p.y) > 1.2) continue;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || (d > 0.4 && (dx * fx + dz * fz) / d < 0.3)) continue;
      best = q;
      bestD = d;
    }
    return best;
  }

  // Up to n of one thing q gathered on this visit, out of their bag and onto
  // the ground under them, even if they were in the air (or null: nothing to
  // drop, or nowhere: they are out over the sea, or off in a party game's arena)
  knockLoose(q, n, now) {
    const kinds = Object.entries(q.bag).filter(([item, count]) => count > 0 && !KEEPS.has(item));
    if (q.game || !kinds.length || this.drops.size >= MAX_DROPS || !this.island.isLand(q.x, q.z)) return null;
    const [item, have] = kinds[Math.floor(this.rand() * kinds.length)];
    const count = Math.min(n, have);
    q.bag[item] -= count;
    const y = this.groundUnder(q.x, q.y, q.z) + GROUND_STAND_Y; // (where a farmer standing there would be)
    const drop = { id: ++this.dropId, item, count, x: round2(q.x), y: round2(y), z: round2(q.z), until: now + DROP_MS, from: q.id, ownAt: now + DROP_OWN_MS };
    this.drops.set(drop.id, drop);
    return drop;
  }

  // How high the ground is under (x, z), below a farmer at height y: the
  // island's own (the pond is lower), or a terrace, a toadstool cap, a sky
  // isle or one of its steps they were over
  groundUnder(x, y, z) {
    const feet = y - GROUND_STAND_Y + 0.3;
    let ground = this.island.floorAt(x, z);
    for (const over of [this.island.topOver(x, z), this.island.skyOver(x, z)]) {
      if (over && over.top <= feet && over.top > ground) ground = over.top;
    }
    return ground;
  }

  inReach(p, spot) {
    if (SPOT_KINDS[spot.kind].use === 'touch') return Math.hypot(spot.x - p.x, spot.y - p.y, spot.z - p.z) <= TOUCH_REACH;
    return Math.hypot(spot.x - p.x, spot.z - p.z) <= GATHER_REACH && Math.abs(p.y - spot.y) < 2;
  }

  // A HIT as the page sent it, with the size the tree or rock is (shared/wilds.js), if it is one of ours there
  sized(msg) {
    const thing = (msg?.kind === 'tree' ? this.wilds.trees : msg?.kind === 'rock' ? this.wilds.rocks : [])[msg.id];
    if (!thing || !finite(msg.x, msg.z) || !standsAt(thing, msg.x, msg.z)) return null;
    return { ...msg, size: thing.scale ?? thing.size };
  }

  // The lobby's hour of the day at now (it opens at LOBBY_DAWN), as everyone's pages show it
  hour(now = Date.now()) {
    return (LOBBY_DAWN + ((now - this.createdAt) / 1000 / DAY_LENGTH_SECONDS) * 24) % 24;
  }

  // ---------- Every tick ----------
  tickPlace(now) {
    // a bite on someone's line, and one they let get away
    for (const p of this.players.values()) {
      const line = p.line;
      if (!line) continue;
      if (!p.conn) {
        p.line = null;
      } else if (!line.bit && now >= line.biteAt) {
        line.bit = true;
        this.send(p, { t: S.BITE, n: line.n, window: line.window });
      } else if (line.bit && now > line.biteAt + line.window + REEL_SLACK) {
        p.line = null;
        this.send(p, { t: S.CAUGHT, n: line.n, item: null });
      }
    }
    this.party.tick(now);

    // (nothing grows back) maybe a giant, the once: as soon as a page has said how many trees and rocks there are
    for (const [kind, id] of this.giants.roll(0, { tree: this.felled, rock: this.mined })) {
      this.changed = true;
      this.broadcast({ t: S.GIANT, kind, id, hp: giantMax(kind), max: giantMax(kind), by: 0 });
      this.say(kind === 'tree' ? 'A giant tree has grown somewhere on the island!' : 'A giant rock has surfaced somewhere on the island!');
    }

    for (const drop of this.drops.values()) {
      if (now < drop.until) continue;
      this.drops.delete(drop.id);
      this.broadcast({ t: S.PICKED, id: drop.id, by: 0, item: drop.item, count: drop.count });
    }
  }

  // ---------- Saving ----------
  // What the lobby keeps of a room, as plain JSON. The island grows again from
  // the seed, so only what happened on it is kept: what is on each spot, which
  // trees are down and rocks broken, and who was here (for a restart while they were playing).
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
      mined: [...this.mined],
      treeSites: [...this.treeSites],
      rockSites: [...this.rockSites],
      giants: this.giants.toSave(),
      seats: [...this.players.values()].map(({ id, key, name, color, finds, rares, wood, stone }) => ({ id, key, name, color, finds, rares, wood, stone })),
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
      if (Number.isInteger(id) && id >= 0 && id < room.wilds.trees.length && Number.isFinite(at)) room.felled.set(id, at);
    }
    for (const [id, at] of save.mined ?? []) {
      if (Number.isInteger(id) && id >= 0 && id < room.wilds.rocks.length && Number.isFinite(at)) room.mined.set(id, at);
    }
    room.treeSites = siteMap(save.treeSites, room.wilds.trees.length);
    room.rockSites = siteMap(save.rockSites, room.wilds.rocks.length);
    room.giants = Giants.fromSave(save.giants, room.rand);
    room.giants.setCounts(room.wilds.trees.length, room.wilds.rocks.length);
    const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    for (const s of (save.seats ?? []).slice(0, room.maxPlayers)) {
      if (!Number.isInteger(s.id) || s.id < 1 || room.players.has(s.id) || typeof s.key !== 'string' || !s.key) continue;
      const color = PLAYER_COLORS.includes(s.color) ? s.color : PLAYER_COLORS[0];
      room.seat({
        id: s.id, key: s.key.slice(0, 64), name: cleanText(s.name, MAX_NAME) || 'Farmer', color,
        finds: n(s.finds), rares: n(s.rares), wood: n(s.wood), stone: n(s.stone), heldUntil: holdUntil,
      });
    }
    room.nextId = Math.max(n(save.nextId), ...[...room.players.keys()].map((id) => id + 1), 1);
    room.changed = false;
    return room;
  }
}
