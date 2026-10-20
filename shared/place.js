// What every online place has in common: an online lobby (shared/room.js) and
// a farm with helpers on it (server/farmroom.js). The players in it, their
// seats (held a while for a reload or a dropped connection), where they are,
// chat, pings, and the roster and position snapshots it sends out.
//
// A Place never touches a socket. A connection is anything with
// send(string) and close(code, reason); the transport calls join() with the
// first message, then message() and leave() for that player.
//
// Movement is the client's: each player simulates themselves and reports where
// they are. What they do is checked against the position the place last heard.
//
// A place says what it is through a few methods of its own:
//   spawnFor(id)          where a new player stands
//   welcome(p, resumed)   the WELCOME message
//   act(p, msg)           a message that isn't STATE, CHAT or PING
//   tickPlace(now)        every tick, before the roster and snapshots go out
//   playerExtra(p)        their part of the roster, past id, name, color, away
//   greet(p) / farewell(p)   what everyone hears when someone comes or goes
import {
  PROTOCOL_VERSION, TICK_RATE, MAX_PLAYERS, MAX_NAME, MAX_CHAT, HOLD_MS, PLAYER_COLORS, CLOSE, CLOSE_TEXT,
} from './constants.js';
import { C, S, STATEF, cleanText, finite } from './protocol.js';

const CHAT_BURST = 5; // messages in a row...
const CHAT_EVERY = 2; // ...then one per this many seconds

export class Place {
  constructor({ code, name, maxPlayers = MAX_PLAYERS, worldLimit = 100, rand = Math.random, log = () => {} }) {
    this.code = code;
    this.name = name;
    this.maxPlayers = Math.max(1, Math.min(MAX_PLAYERS, maxPlayers | 0 || MAX_PLAYERS));
    this.worldLimit = worldLimit; // beyond this a reported position is nonsense
    this.rand = rand;
    this.log = log;
    this.players = new Map(); // id -> player (away ones too, while their seat is held)
    this.nextId = 1;
    this.tick = 0;
    this.rosterDirty = false;
    this.changed = false; // something worth saving happened (whoever keeps the place looks)
    this.emptySince = Date.now(); // (an empty place is put away after a while)
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

  rosterList() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, ...this.playerExtra(p), away: !p.conn }));
  }

  // The first message on a connection. Returns the player it now speaks for,
  // or null when it was turned away (and closed). extra: the place's own
  // fields for a new player.
  join(conn, msg, extra = {}) {
    if (msg?.t !== C.JOIN || msg.v !== PROTOCOL_VERSION) {
      conn.close(CLOSE.VERSION, CLOSE_TEXT[CLOSE.VERSION]);
      return null;
    }
    // A seat held for this browser (a reload, a dropped connection): take it
    // back. Another tab of the same browser is a player of its own unless it
    // says it is coming back, or the place is full and only the held seat is left.
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
        mine.heldUntil = 0;
        Object.assign(mine, extra);
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

    const p = this.seat({ id: this.nextId++, conn, key, name, color, ...extra });
    this.welcome(p, false);
    this.greet(p);
    this.log(`${this.code}: ${name} joined (${this.players.size}/${this.maxPlayers})`);
    return p;
  }

  // A new player in a seat (or, from a save, an away one whose seat is held)
  seat({ id, conn = null, key, name, color, heldUntil = 0, ...extra }) {
    const at = this.spawnFor(id);
    const p = {
      id, conn, key, name, color,
      x: at.x, y: at.y, z: at.z, yaw: Math.PI, f: STATEF.GROUND,
      heldUntil, // away: when their seat is let go
      chatTokens: CHAT_BURST, chatAt: Date.now(),
      ...extra,
    };
    this.players.set(id, p);
    this.emptySince = 0;
    this.rosterDirty = true;
    this.changed = true;
    return p;
  }

  // The connection went. hold: keep the seat a while for them to come back
  // (a reload or a drop, not someone who chose to go home).
  leave(p, { hold = true } = {}) {
    if (!this.players.has(p.id)) return;
    p.conn = null;
    if (hold) {
      p.heldUntil = Date.now() + HOLD_MS;
      this.rosterDirty = true;
    } else {
      this.remove(p);
    }
  }

  remove(p) {
    this.players.delete(p.id);
    this.rosterDirty = true;
    this.changed = true;
    this.farewell(p);
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
      default:
        this.act(p, msg);
    }
  }

  // ---------- Every tick ----------
  update(now = Date.now()) {
    this.tick++;
    for (const p of [...this.players.values()]) {
      if (!p.conn && now > p.heldUntil) this.remove(p);
    }
    this.tickPlace(now);
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

  // ---------- What a place fills in ----------
  spawnFor() {
    return { x: 0, y: 0.8, z: 0 };
  }
  welcome() {}
  act() {}
  tickPlace() {}
  playerExtra() {
    return {};
  }
  greet(p) {
    this.say(`${p.name} wandered in.`);
  }
  farewell(p) {
    this.say(`${p.name} headed home.`);
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

export const round2 = (v) => Math.round(v * 100) / 100;
