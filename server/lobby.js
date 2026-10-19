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
// invite-only ones are reached only by their link. An empty lobby closes after
// IDLE_MS, long enough for a reload, or for whoever made it to share the link
// before they join.
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
// Per address: a few lobbies in a row, then one a minute
const CREATE_BURST = 3;
const CREATE_EVERY = 60;

export class Lobby {
  constructor({ log = console.log } = {}) {
    this.log = log;
    this.rooms = new Map(); // code -> Room
    this.creates = new Map(); // address -> { tokens, at }
    setInterval(() => this.reap(), 5000).unref();
  }

  newCode(length) {
    for (;;) {
      let code = '';
      for (let i = 0; i < length; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
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
    room.start();
    this.rooms.set(code, room);
    this.log(`lobby ${code} made (${room.inviteOnly ? 'invite-only' : 'public'}, ${room.maxPlayers} seats, island ${room.seed})`);
    return room;
  }

  find(code) {
    return this.rooms.get(code) ?? null;
  }

  // Dev mode: create a lobby with a specific code for testing. Its island's
  // seed is the code, so a lobby the server opens again after a restart is
  // the same place.
  makeWithCode(code, { name, inviteOnly = false, maxPlayers = MAX_PLAYERS } = {}) {
    if (this.rooms.has(code)) return this.rooms.get(code);
    const room = new Room({
      code,
      name: cleanText(name, 32) || `Dev lobby ${code}`,
      seed: normalizeSeed(code),
      inviteOnly: !!inviteOnly,
      maxPlayers,
      log: this.log,
    });
    room.start();
    this.rooms.set(code, room);
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
      room.close();
      this.rooms.delete(code);
      this.log(`lobby ${code} closed (empty)`);
    }
    for (const [address, a] of this.creates) {
      if (now - a.at > CREATE_BURST * CREATE_EVERY * 1000) this.creates.delete(address);
    }
  }
}
