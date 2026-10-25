// Boss dungeons (DUNGEONS and DUNGEON in shared/balance.js). The way to each
// boss's arena (shared/bosses.js) is a dungeon, out in front of the arena
// (the way the camera looks: farmers walk in, away from it). MAIN rooms lead
// one after another to it, each a little to one side of the one before
// (LAYOUTS: each dungeon's own), and off a couple of them a door opens into a
// side room, with a chest in it. The boss's portal on the farm leads into the
// first room, and a way home stands by where farmers come in. Every room has
// foes, little ones of the boss's own kind: the gate at a main room's far end
// (and the doors to its side rooms) opens once its foes are all bopped down,
// the last one onto a bridge into the arena. A side room's foes guard its
// chest: once they are down, a farmer can open it for what is in it (a roll
// of DUNGEON.chest, and of the dungeon's own loot), once a day.
//
// A DungeonRun is one dungeon and its foes: a room's foes wake when a farmer
// comes into it, and go for whoever is nearest in there (a hop, a dash, a
// dart or a swoop at them) until they are bopped down. As with a BossFight,
// the farm's room keeps one for each boss on a farm with helpers
// (server/farmroom.js), and a farm played alone keeps its own on the page
// (src/bosses.js): the same rules either way. Whether a foe caught a farmer
// is that farmer's own page's (foeHits), as bops are. Left empty a while
// (nobody in it, nor in its arena), it is all as it was again.
import { DUNGEONS, DUNGEON, BOSSES, BOSS_FIGHT, WEAPONS } from './balance.js';
import { GROUND_STAND_Y, rollBundle } from './level.js';
import { ARENAS, ARENA_R, BOSS_IDS } from './bosses.js';

export const MAIN = 4; // the rooms on the way through
export const ROOM_W = 12; // a main room, across
export const ROOM_D = 11; // ...and deep (from the camera in)
export const SIDE_W = 8; // a side room, across
export const SIDE_D = 8; // ...and deep
export const WALL_T = 0.6; // a wall's thickness
export const DOOR_W = 2.4; // a gate's width (or a side door's)
const OUT = ARENA_R + 3; // from the arena's middle to the last room's far wall (a bridge between)
export const FOE_R = 0.45; // how wide a foe is, from its middle
export const FOE_H = 0.7; // ...and how tall
export const CHEST_REACH = 1.6; // (to open a chest)
const REACH_SLACK = 0.8; // (the room has a slightly older idea of where everyone is)
const EDGE = 0.7; // (foes keep this far in from a room's walls)
const ROUND = (v) => Math.round(v * 100) / 100;

// Each dungeon's rooms. `shift`: how far each main room, first to last, is to
// one side of the line to its arena (+x: right; the last one's gate is on the
// line, onto the bridge). `sides`: its side rooms, [the main room each is off,
// which side of it (-1: left, 1: right)]
export const LAYOUTS = {
  parsnip: { shift: [0, 2.5, -2.5, 0], sides: [[0, -1], [2, 1]] },
  lion: { shift: [0, -3, 0, 2], sides: [[1, 1], [3, -1]] },
  bee: { shift: [2, 2, -2, 0], sides: [[0, -1], [2, 1]] },
  crow: { shift: [0, -2.5, 2.5, -1], sides: [[1, -1], [2, 1]] },
  toad: { shift: [-2, 1, 3, 0], sides: [[0, 1], [3, -1]] },
};
export const sideCount = (id) => LAYOUTS[id].sides.length;
export const roomCount = (id) => MAIN + sideCount(id);
export const isSide = (room) => room >= MAIN;

// Room `room` of boss id's dungeon (0: the first main room, where farmers
// come in; MAIN - 1: the last, by the arena; MAIN + s: side room s): x0..x1
// across, z0 (its far side) to z1 (its near side), inside its walls
export function roomRect(id, room) {
  const { x, z } = ARENAS[id];
  const layout = LAYOUTS[id];
  if (room < MAIN) {
    const z0 = z + OUT + (MAIN - 1 - room) * ROOM_D;
    const cx = x + layout.shift[room];
    return { x0: cx - ROOM_W / 2, x1: cx + ROOM_W / 2, z0, z1: z0 + ROOM_D };
  }
  const [k, side] = layout.sides[room - MAIN];
  const m = roomRect(id, k);
  const zm = (m.z0 + m.z1) / 2;
  const x0 = side > 0 ? m.x1 + WALL_T : m.x0 - WALL_T - SIDE_W; // (past the main room's wall)
  return { x0, x1: x0 + SIDE_W, z0: zm - SIDE_D / 2, z1: zm + SIDE_D / 2 };
}

// The gate out of main room k, in its far wall: where it overlaps the next
// room (the last one's on the line to the arena, onto the bridge)
export function gateAt(id, k) {
  const r = roomRect(id, k);
  if (k >= MAIN - 1) return { x: ARENAS[id].x, z: r.z0 };
  const n = roomRect(id, k + 1);
  return { x: (Math.max(r.x0, n.x0) + Math.min(r.x1, n.x1)) / 2, z: r.z0 };
}

// The door into side room s, in the side wall of the main room it is off
export function sideDoorAt(id, s) {
  const [k, side] = LAYOUTS[id].sides[s];
  const m = roomRect(id, k);
  return { x: side > 0 ? m.x1 + WALL_T / 2 : m.x0 - WALL_T / 2, z: (m.z0 + m.z1) / 2, side, room: k };
}

// Is the way into room `room` open, with `cleared` main rooms cleared? (the
// first is; a main room's once the one before is cleared; a side room's
// once the main room it is off is)
export function roomOpen(id, room, cleared) {
  if (isSide(room)) return cleared > LAYOUTS[id].sides[room - MAIN][0];
  return cleared >= room;
}

// Where farmers come into a room (and are sent back to after one catch too
// many): the first, by its near wall; a main room, in through the gate from
// the one before; a side room, in through its door. And the way home, by
// the first room's near wall, and where a side room's chest stands (at its
// far side, facing in: `side` the way it faces away from)
export function roomEntry(id, room) {
  if (room === 0) return { x: (roomRect(id, 0).x0 + roomRect(id, 0).x1) / 2, z: roomRect(id, 0).z1 - 1.4 };
  if (!isSide(room)) return { x: gateAt(id, room - 1).x, z: roomRect(id, room).z1 - 1.4 };
  const door = sideDoorAt(id, room - MAIN);
  return { x: door.x + door.side * 1.5, z: door.z };
}
export const dungeonStart = (id) => roomEntry(id, 0);
export const dungeonExit = (id) => ({ x: roomRect(id, 0).x1 - 1.8, z: roomRect(id, 0).z1 - 1.1 });
export function chestAt(id, s) {
  const r = roomRect(id, MAIN + s);
  const side = LAYOUTS[id].sides[s][1];
  return { x: side > 0 ? r.x1 - 1.1 : r.x0 + 1.1, z: (r.z0 + r.z1) / 2, side };
}

// How far out the dungeon reaches (for the farm's room: where farmers may be)
export function dungeonFar(id) {
  let far = 0;
  for (let room = 0; room < roomCount(id); room++) {
    const r = roomRect(id, room);
    far = Math.max(far, ...[r.x0, r.x1, r.z0, r.z1].map((v) => Math.abs(v) + WALL_T));
  }
  return far;
}

// Which of boss id's rooms x, z is in (-1: none: on the bridge, or in a doorway between)
export function roomAt(id, x, z) {
  for (let room = 0; room < roomCount(id); room++) {
    const r = roomRect(id, room);
    if (x >= r.x0 - 0.3 && x <= r.x1 + 0.3 && z >= r.z0 && z <= r.z1) return room;
  }
  return -1;
}

// The boss whose dungeon x, z is in (its rooms, the doorways, or the bridge into its arena), or null
export function dungeonAt(x, z) {
  for (const id of BOSS_IDS) {
    const { x: ax, z: az } = ARENAS[id];
    if (Math.abs(x - ax) <= DOOR_W && z >= az + ARENA_R + 1.5 && z <= roomRect(id, MAIN - 1).z0 + 0.5) return id; // (the bridge)
    for (let room = 0; room < roomCount(id); room++) {
      const r = roomRect(id, room);
      if (x >= r.x0 - WALL_T - 0.1 && x <= r.x1 + WALL_T + 0.1 && z >= r.z0 - 0.5 && z <= r.z1 + 0.5) return id;
    }
  }
  return null;
}

// Which room each of a dungeon's foes is in: the main rooms' (DUNGEONS
// `foes`), then the side rooms' (`guards`)
export function foeRooms(id) {
  const { foes, guards } = DUNGEONS[id];
  return [...foes, ...guards].flatMap((n, room) => Array(n).fill(room));
}

// What a chest in boss id's dungeon has in it: [[item, count], ...] (coins as 'coin')
export function chestLoot(id, rand = Math.random) {
  const { rolls, loot, key } = DUNGEON.chest;
  return rollBundle({ rolls, loot: [...loot, ...DUNGEONS[id].loot, [BOSSES[id].key, key, 1, 1]] }, rand);
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

  // Every foe fresh and resting in its room, the gates shut (what each farmer
  // took from the chests is kept: a chest is theirs again the next day)
  reset() {
    this.cleared = 0; // main rooms cleared, in order: the gates of the first `cleared` are open
    this.emptyFor = 0;
    this.stirred = false; // (anything happened since it was last reset)
    this.looted ??= new Map(); // chest -> Map(farmer -> the day they opened it)
    this.foes = [];
    [...this.def.foes, ...this.def.guards].forEach((n, room) => {
      const r = roomRect(this.id, room);
      const cols = Math.min(n, isSide(room) ? 2 : 3);
      for (let i = 0; i < n; i++) {
        // spread over the far two thirds of the room, a little out of line
        // (the same on every page: drawn there before the room says where they are)
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (r.x0 + r.x1) / 2 + (col - (cols - 1) / 2) * (isSide(room) ? 2.6 : 3.2) + (((i * 7 + room) % 5) - 2) * 0.2;
        const z = r.z0 + 2.2 + row * 2.6 + (((i * 3 + room) % 4) - 1.5) * 0.25;
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
    while (this.cleared < MAIN && this.roomClear(this.cleared)) this.cleared++;
    return { hp: 0, ...(this.cleared > was && { opened: this.cleared - 1 }) };
  }

  // Are room `room`'s foes all down?
  roomClear(room) {
    return this.foes.every((g) => g.room !== room || g.state === 'down');
  }

  // Farmer `who` (their name) at x, z opening side room s's chest on game
  // day `day`: what is in it for them ([[item, count], ...]), or why not
  // ({ why }: not in that room by it, its foes still up, theirs already today)
  openChest(who, x, z, s, day) {
    if (!Number.isInteger(s) || s < 0 || s >= sideCount(this.id)) return { why: 'none' };
    const at = chestAt(this.id, s);
    if (roomAt(this.id, x, z) !== MAIN + s || Math.hypot(x - at.x, z - at.z) > CHEST_REACH + REACH_SLACK) return { why: 'far' };
    if (!this.roomClear(MAIN + s)) return { why: 'guarded' };
    const looted = this.looted.get(s) ?? new Map();
    if (looted.get(who) === day) return { why: 'empty' };
    looted.set(who, day);
    this.looted.set(s, looted);
    this.stirred = true;
    return { items: chestLoot(this.id, this.rand) };
  }

  // As sent to the pages: { c: rooms cleared, f: [[x, y, z, yaw, state, t, hp], ...] } (state as a number)
  toWire() {
    return { c: this.cleared, f: this.foes.map((f) => [ROUND(f.x), ROUND(f.y), ROUND(f.z), ROUND(f.yaw), STATES.indexOf(f.state), ROUND(f.t), ROUND(f.hp)]) };
  }
}

// A dungeon as a page has it from toWire(): { cleared, foes: [{ room, x, y,
// z, yaw, state, t, hp }] } (each foe's room: foeRooms()), or null
export function dungeonFromWire(id, w) {
  if (!DUNGEONS[id] || !w || !Number.isInteger(w.c) || !Array.isArray(w.f)) return null;
  const rooms = foeRooms(id);
  if (w.f.length !== rooms.length) return null;
  const foes = [];
  for (const [i, f] of w.f.entries()) {
    if (!Array.isArray(f) || f.length < 7 || !f.every(Number.isFinite)) return null;
    const [x, y, z, yaw, state, t, hp] = f;
    foes.push({ room: rooms[i], x, y, z, yaw, state: STATES[state] ?? 'idle', t, hp });
  }
  return { cleared: Math.max(0, Math.min(MAIN, w.c)), foes };
}

// ---------- What catches a farmer ----------
// A foe (as dungeonFromWire has it) going at the farmer at x, y, z (the
// collision centre), and touching them: they can jump over a dash, and a
// swoop high up passes over their head
export const foeHits = (f, x, y, z) => f.state === 'attack' && Math.hypot(x - f.x, z - f.z) < FOE_R + 0.45 &&
  f.y < y - GROUND_STAND_Y + 1.5 && f.y + FOE_H > y - GROUND_STAND_Y;
