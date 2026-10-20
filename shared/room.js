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
// A Room never touches a socket. A connection is anything with
// send(string) and close(code, reason); the transport calls join() with the
// first message, then message() and leave() for that player.
//
// Movement is the client's: each player simulates themselves and reports where
// they are. Who gets a spot is settled here, checked against the position the
// room last heard.
import {
  PROTOCOL_VERSION, TICK_RATE, MAX_PLAYERS, MAX_NAME, MAX_CHAT, HOLD_MS, PLAYER_COLORS, CLOSE, CLOSE_TEXT,
} from './constants.js';
import { C, S, STATEF, cleanText, finite } from './protocol.js';
import { SPOT_KINDS, RARE, TREE, rollLoot, woodFor, spawnPoint } from './level.js';
import { islandFor, CLASSIC_SEED } from './worldgen.js';

const TOUCH_REACH = 1.8; // the client collects at 0.6; the slack covers a position up to ~150 ms old
const GATHER_REACH = 2.4; // the client gathers within 1.6 (sideways)
const CHOP_REACH = 2.6; // the client chops within 1.5 of the trunk
const CHOP_EVERY = 1000; // ms: the fewest between two felled trees (felling one takes TREE.hits swings)
const MAX_TREES = 2000; // tree ids are below this (an island has a couple of hundred)
const CHAT_BURST = 5; // messages in a row...
const CHAT_EVERY = 2; // ...then one per this many seconds
const WHERE = { ledge: 'up on a ledge', meadow: 'out in the meadow', mushroom: 'among the mushrooms', bush: 'in a berry bush' };

export class Room {
  // seed: the island's (shared/worldgen.js). rand: () => [0, 1), for the loot
  // rolls and regrow times (tests pass their own)
  constructor({ code, name = 'Lobby', seed = CLASSIC_SEED, inviteOnly = false, maxPlayers = MAX_PLAYERS, rand = Math.random, log = () => {} }) {
    this.code = code;
    this.island = islandFor(seed);
    this.seed = this.island.seed;
    this.worldLimit = this.island.half + 40; // beyond this a reported position is nonsense
    this.name = name;
    this.inviteOnly = inviteOnly;
    this.maxPlayers = Math.max(1, Math.min(MAX_PLAYERS, maxPlayers | 0 || MAX_PLAYERS));
    this.rand = rand;
    this.log = log;
    this.players = new Map(); // id -> player (away ones too, while their seat is held)
    this.nextId = 1;
    // Every spot starts out full
    this.spots = this.island.spots.map(([kind, x, y, z], id) => {
      const [item, count] = rollLoot(kind, rand);
      return { id, kind, x, y, z, item, count, regrowAt: 0 };
    });
    this.felled = new Map(); // tree id -> when it grows back (ms)
    this.tick = 0;
    this.rosterDirty = false;
    this.emptySince = Date.now(); // (the lobby list closes a room that stays empty)
    this.createdAt = Date.now(); // the time of day everyone sees counts from here
    this.timer = null;
  }

  start() {
    this.timer ??= setInterval(() => this.update(), 1000 / TICK_RATE);
  }

  close(code = CLOSE.ENDED) {
    clearInterval(this.timer);
    this.timer = null;
    for (const p of this.players.values()) p.conn?.close(code, CLOSE_TEXT[code]);
    this.players.clear();
  }

  // ---------- Who is here ----------
  connected() {
    let n = 0;
    for (const p of this.players.values()) if (p.conn) n++;
    return n;
  }

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

  rosterList() {
    return [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, finds: p.finds, rares: p.rares, wood: p.wood, away: !p.conn,
    }));
  }

  // The first message on a connection. Returns the player it now speaks for,
  // or null when it was turned away (and closed).
  join(conn, msg) {
    if (msg?.t !== C.JOIN || msg.v !== PROTOCOL_VERSION) {
      conn.close(CLOSE.VERSION, CLOSE_TEXT[CLOSE.VERSION]);
      return null;
    }
    // A seat held for this browser (a reload, a dropped connection): take it
    // back. Another tab of the same browser is a player of its own unless it
    // says it is coming back, or the lobby is full and only the held seat is left.
    const key = typeof msg.key === 'string' ? msg.key.slice(0, 64) : '';
    if (key) {
      const full = this.players.size >= this.maxPlayers;
      let mine = null;
      for (const p of this.players.values()) {
        if (p.key !== key || (p.conn && !msg.back && !full)) continue;
        if (!mine || (!p.conn && mine.conn)) mine = p;
      }
      if (mine) {
        mine.conn?.close(CLOSE.REPLACED, CLOSE_TEXT[CLOSE.REPLACED]);
        mine.conn = conn;
        this.rosterDirty = true;
        this.welcome(mine, true);
        this.say(`${mine.name} is back.`);
        return mine;
      }
    }
    if (this.players.size >= this.maxPlayers) {
      conn.close(CLOSE.FULL, CLOSE_TEXT[CLOSE.FULL]);
      return null;
    }

    const names = new Set([...this.players.values()].map((p) => p.name));
    const base = cleanText(msg.name, MAX_NAME) || 'Farmer';
    let name = base;
    for (let k = 2; names.has(name); k++) name = `${base.slice(0, MAX_NAME - 3)}#${k}`;
    const worn = new Set([...this.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !worn.has(c)) ?? PLAYER_COLORS[0];

    const id = this.nextId++;
    const at = spawnPoint(this.island.spawn, id % 8, 8); // somewhere in the stone circle
    const p = {
      id, conn, key, name, color,
      x: at.x, y: at.y, z: at.z, yaw: Math.PI, f: STATEF.GROUND,
      finds: 0, // spots emptied this visit
      rares: 0, // ...of which rare finds
      wood: 0, // logs chopped this visit
      chopAt: 0, // when they last felled a tree
      awayAt: 0,
      chatTokens: CHAT_BURST, chatAt: Date.now(),
    };
    this.players.set(id, p);
    this.emptySince = 0;
    this.rosterDirty = true;
    this.welcome(p, false);
    this.say(`${name} wandered in.`);
    this.log(`${this.code}: ${name} joined (${this.players.size}/${this.maxPlayers})`);
    return p;
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

  // The connection went. hold: keep the seat a while for them to come back
  // (a reload or a drop, not someone who chose to go home).
  leave(p, { hold = true } = {}) {
    if (!this.players.has(p.id)) return;
    p.conn = null;
    if (hold) {
      p.awayAt = Date.now();
      this.rosterDirty = true;
    } else {
      this.remove(p);
    }
  }

  remove(p) {
    this.players.delete(p.id);
    this.rosterDirty = true;
    this.say(`${p.name} headed home.`);
    this.log(`${this.code}: ${p.name} left (${this.players.size}/${this.maxPlayers})`);
    if (!this.players.size) this.emptySince = Date.now();
  }

  // ---------- Messages ----------
  message(p, msg) {
    switch (msg?.t) {
      case C.STATE: {
        const { x, y, z, yaw } = msg;
        if (!finite(x, y, z, yaw)) return;
        if (Math.abs(x) > this.worldLimit || Math.abs(z) > this.worldLimit || y < -40 || y > 60) return;
        p.x = x;
        p.y = y;
        p.z = z;
        p.yaw = yaw;
        p.f = msg.f & 0xff;
        break;
      }
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
        this.broadcast({ t: S.FELLED, id, by: p.id, count });
        break;
      }
      case C.CHAT: {
        const text = cleanText(msg.text, MAX_CHAT);
        if (!text) return;
        const now = Date.now();
        p.chatTokens = Math.min(CHAT_BURST, p.chatTokens + (now - p.chatAt) / 1000 / CHAT_EVERY);
        p.chatAt = now;
        if (p.chatTokens < 1) {
          this.send(p, { t: S.CHAT, from: 0, text: 'Slow down: you are sending messages too fast.' });
          return;
        }
        p.chatTokens--;
        this.broadcast({ t: S.CHAT, from: p.id, name: p.name, color: p.color, text });
        break;
      }
      case C.PING:
        this.send(p, { t: S.PONG, c: msg.c });
        break;
    }
  }

  inReach(p, spot) {
    if (SPOT_KINDS[spot.kind].use === 'touch') return Math.hypot(spot.x - p.x, spot.y - p.y, spot.z - p.z) <= TOUCH_REACH;
    return Math.hypot(spot.x - p.x, spot.z - p.z) <= GATHER_REACH && Math.abs(p.y - spot.y) < 2;
  }

  // ---------- Every tick ----------
  update(now = Date.now()) {
    this.tick++;
    for (const p of [...this.players.values()]) {
      if (!p.conn && now - p.awayAt > HOLD_MS) this.remove(p);
    }

    for (const spot of this.spots) {
      if (spot.item || now < spot.regrowAt) continue;
      [spot.item, spot.count] = rollLoot(spot.kind, this.rand);
      this.broadcast({ t: S.SPOT, id: spot.id, item: spot.item, count: spot.count });
      if (RARE[spot.item]) {
        this.say(`Something sparkles ${WHERE[spot.kind]}... ${RARE[spot.item].toLowerCase()}!`);
      }
    }

    for (const [id, at] of this.felled) {
      if (now < at) continue;
      this.felled.delete(id);
      this.broadcast({ t: S.REGROWN, id });
    }

    if (this.rosterDirty) {
      this.rosterDirty = false;
      this.broadcast({ t: S.ROSTER, list: this.rosterList() });
    }
    // Positions every tick, when there is someone to show them to
    if (this.connected() > 1) {
      const list = [];
      for (const p of this.players.values()) list.push([p.id, round2(p.x), round2(p.y), round2(p.z), round2(p.yaw), p.f]);
      this.broadcast({ t: S.SNAP, tick: this.tick, p: list });
    }
  }

  // ---------- Sending ----------
  say(text) {
    this.broadcast({ t: S.CHAT, from: 0, text });
  }

  send(p, msg) {
    p.conn?.send(JSON.stringify(msg));
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) p.conn?.send(data);
  }
}

const round2 = (v) => Math.round(v * 100) / 100;
