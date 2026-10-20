// The lobbies running on this server. Each is a Room (shared/room.js) known by
// its code: 6 characters for a public lobby, 10 for an invite-only one (long
// enough that nobody finds it by guessing), from 32 characters that cannot be
// misread when a code is read out loud.
//
// Every lobby is on an island grown from its seed (shared/worldgen.js):
// whoever opens one may name the seed (the same seed, the same island),
// otherwise it gets a fresh one.
//
// Public lobbies are listed (Browse) and are where Quick join puts you;
// invite-only ones are reached only by their link. An empty lobby goes dormant
// after IDLE_MS (long enough for a reload, or for whoever made it to share the
// link before they join): it stops running and is no longer listed, but is
// kept for DORMANT_MS, and joining by its code (or looking at its invite card)
// wakes it up as it was, with whatever regrew in the meantime.
//
// Given a store (server/store.js), the lobbies, running and dormant, are saved
// every few seconds when something has changed (and by flush(), when the
// server stops), and put back when it starts: a restart is a short drop for
// everyone, whose seats are held for RESTART_HOLD_MS so the pages get back in.
import { randomInt } from 'node:crypto';
import { Room } from '../shared/room.js';
import { MAX_PLAYERS } from '../shared/constants.js';
import { cleanText } from '../shared/protocol.js';
import { normalizeSeed, randomSeed } from '../shared/worldgen.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // (no 0 / O, 1 / I)
const PUBLIC_CODE = 6;
const PRIVATE_CODE = 10;
export const CODE_RE = /^[A-Z2-9]{6,10}$/;
const IDLE_MS = 90_000;
const MAX_GAMES = 200;
const DORMANT_MS = 7 * 24 * 3600_000;
const MAX_DORMANT = 1000; // (past this the longest-dormant ones go)
const RESTART_HOLD_MS = 60_000;
const SAVE_EVERY = 2000;
// Per address: a few lobbies in a row, then one a minute
const CREATE_BURST = 3;
const CREATE_EVERY = 60;

export class Lobby {
  constructor({ log = console.log, store = null } = {}) {
    this.log = log;
    this.store = store;
    this.rooms = new Map(); // code -> Room
    this.dormant = new Map(); // code -> { room: its save, since }, the longest-dormant first
    this.changed = false; // (a room came or went; the rooms say for themselves what happened in them)
    this.creates = new Map(); // address -> { tokens, at }
    setInterval(() => this.reap(), 5000).unref();
    if (store) {
      this.restore(store.load());
      setInterval(() => this.save(), SAVE_EVERY).unref();
    }
  }

  newCode(length) {
    for (;;) {
      let code = '';
      for (let i = 0; i < length; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(code) && !this.dormant.has(code)) return code;
    }
  }

  add(room) {
    room.start();
    this.rooms.set(room.code, room);
    this.changed = true;
    return room;
  }

  // { name, seed, inviteOnly, maxPlayers } -> the Room, or { error, status }
  make({ name, seed, inviteOnly = false, maxPlayers = MAX_PLAYERS } = {}, address = null) {
    if (this.rooms.size >= MAX_GAMES) return { error: 'The server is full right now. Join a lobby that is already open.', status: 503 };
    if (address && !this.allowCreate(address)) return { error: 'You are making lobbies too fast. Try again in a minute.', status: 429 };
    const code = this.newCode(inviteOnly ? PRIVATE_CODE : PUBLIC_CODE);
    const room = new Room({
      code,
      name: cleanText(name, 32) || `Meadow ${code.slice(0, 3)}`,
      seed: normalizeSeed(seed) || randomSeed(),
      inviteOnly: !!inviteOnly,
      maxPlayers,
      log: this.log,
    });
    this.add(room);
    this.log(`lobby ${code} made (${room.inviteOnly ? 'invite-only' : 'public'}, ${room.maxPlayers} seats, island ${room.seed})`);
    return room;
  }

  // a lobby by its code; a dormant one wakes up
  find(code) {
    return this.rooms.get(code) ?? this.wake(code);
  }

  wake(code) {
    const d = this.dormant.get(code);
    if (!d) return null;
    this.dormant.delete(code);
    try {
      const room = this.add(Room.fromSave(d.room, { log: this.log }));
      this.log(`lobby ${code} woke up (dormant ${Math.round((Date.now() - d.since) / 60_000)} min)`);
      return room;
    } catch (e) {
      this.log(`lobby ${code} could not be woken: ${e.message}`);
      this.changed = true;
      return null;
    }
  }

  sleep(code, room, since = Date.now()) {
    room.close();
    this.rooms.delete(code);
    this.dormant.set(code, { room: room.toSave(), since });
    this.changed = true;
  }

  // Dev mode: create a lobby with a specific code for testing. Its island's
  // seed is the code, so a lobby the server opens again after a restart is
  // the same place.
  makeWithCode(code, { name, inviteOnly = false, maxPlayers = MAX_PLAYERS } = {}) {
    const known = this.find(code);
    if (known) return known;
    const room = new Room({
      code,
      name: cleanText(name, 32) || `Dev lobby ${code}`,
      seed: normalizeSeed(code),
      inviteOnly: !!inviteOnly,
      maxPlayers,
      log: this.log,
    });
    this.add(room);
    this.log(`lobby ${code} made (dev mode, ${room.inviteOnly ? 'invite-only' : 'public'}, ${room.maxPlayers} seats)`);
    return room;
  }

  // Quick join: the fullest public lobby with a seat free (more people to
  // meet); failing that, a new public one.
  quick() {
    let best = null;
    for (const r of this.rooms.values()) {
      if (r.inviteOnly || r.players.size >= r.maxPlayers) continue;
      if (!best || r.players.size > best.players.size) best = r;
    }
    return best ?? this.make({ name: 'Open meadow' });
  }

  list() {
    return [...this.rooms.values()].filter((r) => !r.inviteOnly).map((r) => r.info());
  }

  allowCreate(address) {
    const now = Date.now();
    const a = this.creates.get(address) ?? { tokens: CREATE_BURST, at: now };
    a.tokens = Math.min(CREATE_BURST, a.tokens + (now - a.at) / 1000 / CREATE_EVERY);
    a.at = now;
    this.creates.set(address, a);
    if (a.tokens < 1) return false;
    a.tokens--;
    return true;
  }

  reap() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.players.size || now - room.emptySince < IDLE_MS) continue;
      this.sleep(code, room, now);
      this.log(`lobby ${code} went dormant (empty)`);
    }
    for (const [code, d] of this.dormant) {
      if (now - d.since < DORMANT_MS && this.dormant.size <= MAX_DORMANT) break; // (oldest first: the rest are younger)
      this.dormant.delete(code);
      this.changed = true;
      this.log(`lobby ${code} closed (dormant ${Math.round((now - d.since) / 3600_000)} h)`);
    }
    for (const [address, a] of this.creates) {
      if (now - a.at > CREATE_BURST * CREATE_EVERY * 1000) this.creates.delete(address);
    }
  }

  // ---------- Keeping the lobbies ----------
  // Write them out if anything has changed (force: anyway)
  save(force = false) {
    if (!this.store) return;
    let dirty = this.changed;
    for (const room of this.rooms.values()) dirty ||= room.changed;
    if (!dirty && !force) return;
    const rooms = [];
    for (const room of this.rooms.values()) {
      rooms.push(room.toSave());
      room.changed = false;
    }
    const dormant = [...this.dormant].map(([, d]) => d);
    this.store.save({ savedAt: Date.now(), rooms, dormant });
    this.changed = false;
  }

  // The server is stopping: save now
  flush() {
    this.save(true);
  }

  // The lobbies as the store had them. Running ones with players in them run
  // again, their seats held for the players to come back; the rest lie dormant.
  restore(data) {
    if (!data) return;
    const now = Date.now();
    let running = 0;
    for (const d of data.dormant ?? []) {
      if (CODE_RE.test(d?.room?.code) && Number.isFinite(d.since) && now - d.since < DORMANT_MS) this.dormant.set(d.room.code, d);
    }
    for (const save of data.rooms ?? []) {
      if (!CODE_RE.test(save?.code)) continue;
      this.dormant.delete(save.code);
      if (!save.seats?.length) {
        this.dormant.set(save.code, { room: save, since: now });
        continue;
      }
      try {
        this.add(Room.fromSave(save, { log: this.log, holdUntil: now + RESTART_HOLD_MS }));
        running++;
      } catch (e) {
        this.log(`lobby ${save.code} could not be put back: ${e.message}`);
      }
    }
    this.changed = false;
    this.log(`lobbies put back: ${running} running, ${this.dormant.size} dormant`);
  }
}
