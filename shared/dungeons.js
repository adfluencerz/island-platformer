// Boss dungeons (DUNGEONS and DUNGEON in shared/balance.js). The way to each
// boss's arena (shared/bosses.js) is a dungeon of ROOMS rooms in a row, out
// in front of the arena (the way the camera looks: farmers walk in, away
// from it, room after room). The boss's portal on the farm leads into the
// first room, and a way home stands by where farmers come in. Each room has
// foes, little ones of the boss's own kind; the gate at its far end opens
// once they are all bopped down, the last one onto a bridge into the arena.
//
// A DungeonRun is one dungeon and its foes: a room's foes wake when a farmer
// comes into it, and go for whoever is nearest in there (a hop, a dash, a
// dart or a swoop at them) until they are bopped down. As with a BossFight,
// the farm's room keeps one for each boss on a farm with helpers
// (server/farmroom.js), and a farm played alone keeps its own on the page
// (src/bosses.js): the same rules either way. Whether a foe caught a farmer
// is that farmer's own page's (foeHits), as bops are. Left empty a while
// (nobody in it, nor in its arena), it is all as it was again.
import { DUNGEONS, DUNGEON, BOSS_FIGHT, WEAPONS } from './balance.js';
import { GROUND_STAND_Y } from './level.js';
import { ARENAS, ARENA_R, BOSS_IDS } from './bosses.js';

export const ROOMS = 3;
export const ROOM_W = 12; // a room, across
export const ROOM_D = 11; // ...and deep (from the camera in)
export const DOOR_W = 2.4; // a gate's width, in the middle of a room's far wall
const OUT = ARENA_R + 3; // from the arena's middle to the last room's far wall (a bridge between)
export const FOE_R = 0.45; // how wide a foe is, from its middle
export const FOE_H = 0.7; // ...and how tall
const REACH_SLACK = 0.8; // (the room has a slightly older idea of where everyone is)
const EDGE = 0.7; // (foes keep this far in from a room's walls)
const ROUND = (v) => Math.round(v * 100) / 100;

// Room k (0: the first, where farmers come in; ROOMS - 1: the last, by the
// arena) of boss id's dungeon: x0..x1 across, z0 (its far side, with the
// gate) to z1 (the near side)
export function roomRect(id, k) {
  const { x, z } = ARENAS[id];
  const z0 = z + OUT + (ROOMS - 1 - k) * ROOM_D;
  return { x0: x - ROOM_W / 2, x1: x + ROOM_W / 2, z0, z1: z0 + ROOM_D };
}

// Where farmers come in (and are sent back to the start of a room after one
// catch too many), and the way home, by the first room's near wall
export const roomEntry = (id, k) => ({ x: ARENAS[id].x, z: roomRect(id, k).z1 - 1.4 });
export const dungeonStart = (id) => roomEntry(id, 0);
export const dungeonExit = (id) => ({ x: ARENAS[id].x + ROOM_W / 2 - 1.8, z: roomRect(id, 0).z1 - 1.1 });
// The gate out of room k, in the middle of its far wall
export const gateAt = (id, k) => ({ x: ARENAS[id].x, z: roomRect(id, k).z0 });
// How far out the dungeon reaches (for the farm's room: where farmers may be)
export const dungeonFar = (id) => Math.max(Math.abs(ARENAS[id].x) + ROOM_W / 2, Math.abs(roomRect(id, 0).z1));

// The boss whose dungeon x, z is in (its rooms, or the bridge into its arena), or null
export function dungeonAt(x, z) {
  for (const id of BOSS_IDS) {
    const { x: ax, z: az } = ARENAS[id];
    if (Math.abs(x - ax) <= ROOM_W / 2 + 0.5 && z >= az + ARENA_R + 1.5 && z <= roomRect(id, 0).z1 + 0.5) return id;
  }
  return null;
}

// Which of boss id's rooms x, z is in (-1: none, on the bridge)
export function roomAt(id, x, z) {
  const last = roomRect(id, ROOMS - 1);
  if (z < last.z0 || Math.abs(x - ARENAS[id].x) > ROOM_W / 2 + 0.5) return -1;
  return Math.max(0, ROOMS - 1 - Math.floor((z - last.z0) / ROOM_D));
}

const STATES = ['idle', 'roam', 'windup', 'attack', 'hurt', 'down']; // (as numbers on the wire: only ever added to)

export class DungeonRun {
  // rand: () => [0, 1)
  constructor(id, rand = Math.random) {
    this.id = id;
    this.def = DUNGEONS[id];
    this.rand = rand;
    this.reset();
  }

  // Every foe fresh and resting in its room, the gates shut
  reset() {
    this.cleared = 0; // rooms cleared, in order: the gates of the first `cleared` are open
    this.emptyFor = 0;
    this.stirred = false; // (anything happened since it was last reset)
    this.foes = [];
    this.def.foes.forEach((n, room) => {
      const r = roomRect(this.id, room);
      const cols = Math.min(n, 3);
      for (let i = 0; i < n; i++) {
        // spread over the far two thirds of the room, a little out of line
        // (the same on every page: drawn there before the room says where they are)
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (r.x0 + r.x1) / 2 + (col - (cols - 1) / 2) * 3.2 + (((i * 7 + room) % 5) - 2) * 0.2;
        const z = r.z0 + 2.4 + row * 2.8 + (((i * 3 + room) % 4) - 1.5) * 0.25;
        this.foes.push({ room, x, y: this.restY, z, yaw: 0, hp: this.def.hp, state: 'idle', t: 0, m: {} });
      }
    });
  }

  // how high a foe is when it isn't going at anyone (a bee flies)
  get restY() {
    return this.def.move === 'dart' ? this.def.fly : 0;
  }

  // One step of dt seconds. here: the farmers in the dungeon now, [{ id, x,
  // y, z }]; near: whether anyone is in it or its arena (while nobody is, it
  // counts down to being as it was). Returns what happened, for the pages
  // ([fx]): { e: 'reset' } (all as it was again).
  step(dt, here, near = here.length > 0) {
    const fx = [];
    if (!near) {
      if (this.stirred && (this.emptyFor += dt) >= DUNGEON.reset) {
        this.reset();
        fx.push({ e: 'reset' });
      }
      for (const f of this.foes) this.rest(f);
      return fx;
    }
    this.emptyFor = 0;
    for (const f of this.foes) {
      if (f.state === 'down') continue;
      const inRoom = here.filter((p) => roomAt(this.id, p.x, p.z) === f.room);
      if (inRoom.length) this.foeStep(f, dt, inRoom);
      else this.rest(f);
    }
    return fx;
  }

  // A foe with nobody in its room: where it is, as it was (one in the air comes down)
  rest(f) {
    if (f.state === 'down' || f.state === 'idle') return;
    f.state = 'idle';
    f.t = 0;
    f.y = this.restY;
  }

  foeStep(f, dt, inRoom) {
    const d = this.def;
    f.t += dt;
    const t = this.nearest(f, inRoom);
    switch (f.state) {
      case 'idle':
        // (woken: someone came into its room)
        this.stirred = true;
        this.roam(f);
        break;
      case 'hurt':
        if (f.t >= DUNGEON.flinch) this.roam(f);
        break;
      case 'roam': {
        // closing in on them, to `keep` away, till its next go
        this.face(f, t);
        const dist = Math.hypot(t.x - f.x, t.z - f.z);
        if (dist > d.keep) this.goTo(f, f.x + ((t.x - f.x) / dist) * d.walk * dt, f.z + ((t.z - f.z) / dist) * d.walk * dt);
        // (and out of each other's way)
        for (const g of this.foes) {
          if (g === f || g.room !== f.room || g.state === 'down') continue;
          const gap = Math.hypot(f.x - g.x, f.z - g.z);
          if (gap >= 2 * FOE_R + 0.2) continue;
          const a = gap > 1e-3 ? Math.atan2(f.x - g.x, f.z - g.z) : this.rand() * Math.PI * 2;
          this.goTo(f, f.x + Math.sin(a) * 2 * dt, f.z + Math.cos(a) * 2 * dt);
        }
        if (d.move === 'dart') f.y = d.fly + Math.sin(f.t * 5) * 0.1;
        if (f.t >= f.m.dur) this.start(f, 'windup', {});
        break;
      }
      case 'windup':
        // aiming at them (a rook rising to swoop)
        this.face(f, t);
        if (d.move === 'swoop') f.y = d.height * Math.min(1, f.t / d.windup);
        if (f.t >= d.windup) this.attack(f, t);
        break;
      case 'attack': {
        const { from, to, dur } = f.m;
        const k = Math.min(1, f.t / dur);
        f.x = from.x + (to.x - from.x) * k;
        f.z = from.z + (to.z - from.z) * k;
        if (d.move === 'hop') f.y = 4 * d.height * k * (1 - k);
        else if (d.move === 'swoop') f.y = k < 0.5 ? 0.4 + (d.height - 0.4) * (1 - 2 * k) ** 2 : 0.4 * (2 - 2 * k);
        else if (d.move === 'dart') f.y = d.fly - 0.25 * Math.sin(Math.PI * k);
        if (k >= 1) {
          f.y = this.restY;
          this.roam(f);
        }
        break;
      }
    }
  }

  // Closing in, for a while ([min, max] pause), before its next go
  roam(f) {
    const [lo, hi] = this.def.pause;
    this.start(f, 'roam', { dur: lo + this.rand() * (hi - lo) });
  }

  // Its go at farmer t: from where it is to where the move takes it (kept in its room)
  attack(f, t) {
    const d = this.def;
    const from = { x: f.x, z: f.z };
    const dx = t.x - f.x;
    const dz = t.z - f.z;
    const dist = Math.hypot(dx, dz) || 1;
    let to;
    if (d.move === 'hop') {
      const k = Math.min(1, d.reach / dist);
      to = { x: f.x + dx * k, z: f.z + dz * k };
    } else if (d.move === 'swoop') {
      to = { x: f.x + 2 * dx, z: f.z + 2 * dz }; // (down through where they stand, and on)
    } else {
      to = { x: f.x + (dx / dist) * d.speed * d.time, z: f.z + (dz / dist) * d.speed * d.time };
    }
    this.start(f, 'attack', { from, to: this.inside(f.room, to.x, to.z), dur: d.move === 'hop' ? d.air : d.move === 'swoop' ? d.dive : d.time });
  }

  start(f, state, m) {
    f.state = state;
    f.t = 0;
    f.m = m;
  }

  nearest(f, list) {
    let best = list[0];
    for (const p of list) if (Math.hypot(p.x - f.x, p.z - f.z) < Math.hypot(best.x - f.x, best.z - f.z)) best = p;
    return best;
  }

  face(f, p) {
    if (Math.hypot(p.x - f.x, p.z - f.z) > 0.05) f.yaw = Math.atan2(p.x - f.x, p.z - f.z);
  }

  goTo(f, x, z) {
    const at = this.inside(f.room, x, z);
    f.x = at.x;
    f.z = at.z;
  }

  // x, z, kept inside room k
  inside(k, x, z) {
    const r = roomRect(this.id, k);
    return { x: Math.min(r.x1 - EDGE, Math.max(r.x0 + EDGE, x)), z: Math.min(r.z1 - EDGE, Math.max(r.z0 + EDGE, z)) };
  }

  // A bop at foe i from farmer `who`, standing at x, y, z with `weapon` in
  // hand. null: it didn't count (no such foe up, not in the room they are in,
  // out of reach). Else { hp } (what it has left); at 0 it is down, and
  // `opened`: the room whose gate that opened, if it did.
  bop(who, weapon, x, y, z, i) {
    const f = Number.isInteger(i) ? this.foes[i] : null;
    if (!f || f.state === 'down' || !WEAPONS[weapon]) return null;
    if (roomAt(this.id, x, z) !== f.room) return null; // (only the foes of the room they are in)
    const dist = Math.hypot(x - f.x, z - f.z);
    if (dist > WEAPONS[weapon].reach + FOE_R + REACH_SLACK) return null;
    if (Math.abs(f.y - (y - GROUND_STAND_Y)) > (WEAPONS[weapon].high ?? 1.6)) return null; // (up out of reach, but for an arrow)
    this.stirred = true;
    f.hp = Math.max(0, f.hp - (BOSS_FIGHT.damage[weapon] ?? 1));
    if (f.hp > 1e-6) {
      // knocked back, reeling
      if (dist > 0.01) this.goTo(f, f.x + ((f.x - x) / dist) * DUNGEON.knock, f.z + ((f.z - z) / dist) * DUNGEON.knock);
      f.y = this.restY;
      this.start(f, 'hurt', {});
      return { hp: ROUND(f.hp) };
    }
    this.start(f, 'down', {});
    f.y = 0;
    const was = this.cleared;
    while (this.cleared < ROOMS && this.foes.every((g) => g.room !== this.cleared || g.state === 'down')) this.cleared++;
    return { hp: 0, ...(this.cleared > was && { opened: this.cleared - 1 }) };
  }

  // As sent to the pages: { c: rooms cleared, f: [[x, y, z, yaw, state, t, hp], ...] } (state as a number)
  toWire() {
    return { c: this.cleared, f: this.foes.map((f) => [ROUND(f.x), ROUND(f.y), ROUND(f.z), ROUND(f.yaw), STATES.indexOf(f.state), ROUND(f.t), ROUND(f.hp)]) };
  }
}

// A dungeon as a page has it from toWire(): { cleared, foes: [{ room, x, y,
// z, yaw, state, t, hp }] } (each foe's room from the boss's DUNGEONS), or null
export function dungeonFromWire(id, w) {
  const counts = DUNGEONS[id]?.foes;
  if (!counts || !w || !Number.isInteger(w.c) || !Array.isArray(w.f) || w.f.length !== counts.reduce((a, b) => a + b, 0)) return null;
  const rooms = counts.flatMap((n, room) => Array(n).fill(room));
  const foes = [];
  for (const [i, f] of w.f.entries()) {
    if (!Array.isArray(f) || f.length < 7 || !f.every(Number.isFinite)) return null;
    const [x, y, z, yaw, state, t, hp] = f;
    foes.push({ room: rooms[i], x, y, z, yaw, state: STATES[state] ?? 'idle', t, hp });
  }
  return { cleared: Math.max(0, Math.min(ROOMS, w.c)), foes };
}

// ---------- What catches a farmer ----------
// A foe (as dungeonFromWire has it) going at the farmer at x, y, z (the
// collision centre), and touching them: they can jump over a dash, and a
// swoop high up passes over their head
export const foeHits = (f, x, y, z) => f.state === 'attack' && Math.hypot(x - f.x, z - f.z) < FOE_R + 0.45 &&
  f.y < y - GROUND_STAND_Y + 1.5 && f.y + FOE_H > y - GROUND_STAND_Y;
