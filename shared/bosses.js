// Boss fights (BOSSES and BOSS_FIGHT in shared/balance.js). Each boss lives
// in an arena of its own, a round meadow out past the sea on the farm's world
// (like the house's room: shared/level.js HOUSE_ROOM), so the friends on a
// farm walk in together and see each other there. Its portal, built on the
// farm from a full set of its key pieces, leads in; a way home at the arena's
// front leads back out.
//
// A BossFight is one boss and its arena: asleep till a farmer comes in, then
// awake, moving (hops, rolls, seeds...) and bopped by everyone there until
// its health runs out and it turns friendly. The farm's room keeps one for
// each arena on a farm with helpers (server/farmroom.js), and a farm played
// alone keeps its own on the page (src/bosses.js): the same rules either way.
// Moving it is the keeper's; whether a farmer got caught by one of its moves
// is each farmer's own page's (the hazards below), as bops are.
//
// Nobody gets hurt: a farmer the boss catches is knocked back and dizzy for
// a moment, and after BOSS_FIGHT.hitsOut of those is back at the arena's
// start, to carry on.
import { BOSSES, BOSS_FIGHT, WEAPONS } from './balance.js';
import { GROUND_STAND_Y } from './level.js';

export const BOSS_IDS = Object.keys(BOSSES);
export const ARENA_R = 12; // the arena's meadow, from its middle (a hedge runs round it)
const ARENA_SPOTS = [[-120, 0], [-120, 60], [-120, -60], [0, -130]]; // (out past the sea, one to a boss, away from the house's room)
export const ARENAS = Object.fromEntries(BOSS_IDS.map((id, i) => [id, { x: ARENA_SPOTS[i][0], z: ARENA_SPOTS[i][1] }]));
export const BODY_R = 1; // how wide a boss is, from its middle
const REACH_SLACK = 0.8; // (the room has a slightly older idea of where everyone is)
const WAKE = 2.2; // seconds it takes to wake up
const ROUND = (v) => Math.round(v * 100) / 100;

// Where farmers start in an arena (and are sent back to), and its way home
export const arenaStart = (id) => ({ x: ARENAS[id].x, z: ARENAS[id].z + ARENA_R - 3 });
export const arenaExit = (id) => ({ x: ARENAS[id].x, z: ARENAS[id].z + ARENA_R - 1 });

// The boss whose arena x, z is in, or null
export function arenaAt(x, z) {
  for (const id of BOSS_IDS) if (Math.hypot(x - ARENAS[id].x, z - ARENAS[id].z) < ARENA_R + 1.5) return id;
  return null;
}

// The portal piece of a boss on the farm (PIECES, shared/level.js), and which boss a piece is the portal of
export const portalOf = (id) => `${id}_portal`;
export const portalBoss = (piece) => (typeof piece === 'string' && piece.endsWith('_portal') && BOSSES[piece.slice(0, -7)] ? piece.slice(0, -7) : null);

const PHASES = ['sleep', 'wake', 'fight', 'friendly'];
const MOVES = ['rest', 'hop', 'roll', 'dizzy', 'seeds', 'pounce', 'roar']; // (as numbers on the wire: only ever added to)

export class BossFight {
  // rand: () => [0, 1)
  constructor(id, rand = Math.random) {
    this.id = id;
    this.def = BOSSES[id];
    this.rand = rand;
    this.reset();
  }

  // Asleep in the middle of its arena, fresh
  reset() {
    const { x, z } = ARENAS[this.id];
    this.phase = 'sleep';
    this.phaseT = 0; // seconds in this phase
    this.x = x;
    this.z = z;
    this.y = 0; // off the ground (a hop)
    this.yaw = 0;
    this.max = this.def.hp;
    this.hp = this.max;
    this.players = 1; // how many farmers its health is for
    this.move = 'rest';
    this.mt = 0; // seconds into the move
    this.m = { dur: 0 }; // the move's own: how long it lasts, where to, ...
    this.last = 'rest'; // (not the same move twice running)
    this.seen = new Set(); // everyone who was in the arena while it was awake
    this.emptyFor = 0;
  }

  get awake() {
    return this.phase === 'wake' || this.phase === 'fight';
  }

  // Tougher with more farmers: health for n of them (what is left of it, in proportion)
  scale(n) {
    if (n === this.players || this.phase === 'friendly') return;
    const max = this.def.hp * (1 + this.def.perPlayer * (n - 1));
    this.hp *= max / this.max;
    this.max = max;
    this.players = n;
  }

  // One step of dt seconds. here: the farmers in the arena now, [{ id, x, y,
  // z }]. Returns what happened, for the pages ([fx]): { e: 'wake' }, { e:
  // 'sleep' } (back to sleep, fresh: the arena stood empty), { e: 'wave', x,
  // z, speed, max } (a shockwave), { e: 'seeds', x, z, a0, n, speed } (n
  // seeds flying out, the first at angle a0)
  step(dt, here) {
    const fx = [];
    if (!here.length) {
      if (this.phase !== 'sleep' && (this.emptyFor += dt) >= BOSS_FIGHT.sleep) {
        if (this.awake) fx.push({ e: 'sleep' });
        this.reset();
      }
      return fx;
    }
    this.emptyFor = 0;
    this.phaseT += dt;
    if (this.awake) for (const p of here) this.seen.add(p.id);
    if (this.phase !== 'friendly') this.scale(here.length);
    if (this.phase === 'sleep') {
      this.phase = 'wake';
      this.phaseT = 0;
      fx.push({ e: 'wake' });
    } else if (this.phase === 'wake') {
      this.face(this.nearest(here));
      if (this.phaseT >= WAKE) {
        this.phase = 'fight';
        this.rest(here);
      }
    } else if (this.phase === 'fight') {
      this.fight(dt, here, fx);
    } else {
      this.mt += dt; // (how long it has been friendly: dizzy at first)
      this.face(this.nearest(here));
    }
    return fx;
  }

  fight(dt, here, fx) {
    const d = this.def;
    const m = this.m;
    this.mt += dt;
    switch (this.move) {
      case 'rest': {
        // ambling after someone, between moves
        const t = this.nearest(here);
        const dist = Math.hypot(t.x - this.x, t.z - this.z);
        this.face(t);
        if (dist > BODY_R + 1.5) this.goTo(this.x + ((t.x - this.x) / dist) * d.walk * dt, this.z + ((t.z - this.z) / dist) * d.walk * dt);
        if (this.mt >= m.dur) this.pick(here);
        break;
      }
      case 'hop':
      case 'pounce': {
        // (a hop and a pounce are the same leap, at different heights and speeds)
        const leap = d[this.move];
        const { windup, air, height } = leap;
        if (this.mt < windup) break;
        const k = Math.min(1, (this.mt - windup) / air);
        this.x = m.from.x + (m.to.x - m.from.x) * k;
        this.z = m.from.z + (m.to.z - m.from.z) * k;
        this.y = 4 * height * k * (1 - k);
        if (k < 1) break;
        this.y = 0;
        fx.push({ e: 'wave', x: ROUND(this.x), z: ROUND(this.z), speed: leap.wave, max: leap.waveMax });
        if (--m.left > 0) this.hopAt(here, m.left, this.move);
        else this.rest(here);
        break;
      }
      case 'roll': {
        if (this.mt < d.roll.windup) {
          this.face(this.nearest(here)); // (aiming)
          m.dir = this.yaw;
          break;
        }
        // rolling along dir; off the edge it bounces back in
        let nx = this.x + Math.sin(m.dir) * d.roll.speed * dt;
        let nz = this.z + Math.cos(m.dir) * d.roll.speed * dt;
        const { x: ax, z: az } = ARENAS[this.id];
        const edge = ARENA_R - BODY_R - 0.3;
        const out = Math.hypot(nx - ax, nz - az);
        if (out > edge) {
          const n = [(nx - ax) / out, (nz - az) / out];
          const v = [Math.sin(m.dir), Math.cos(m.dir)];
          const dot = v[0] * n[0] + v[1] * n[1];
          m.dir = Math.atan2(v[0] - 2 * dot * n[0], v[1] - 2 * dot * n[1]);
          nx = ax + n[0] * edge;
          nz = az + n[1] * edge;
        }
        this.x = nx;
        this.z = nz;
        this.yaw = m.dir;
        if (this.mt >= d.roll.windup + d.roll.time) this.start('dizzy', { dur: d.roll.dizzy });
        break;
      }
      case 'dizzy':
        if (this.mt >= m.dur) this.rest(here);
        break;
      case 'roar': {
        // rings of shockwave, one after another, out to the arena's edge
        const { windup, count, gap, speed, max } = d.roar;
        if (this.mt < windup) this.face(this.nearest(here));
        while (m.fired < count && this.mt >= windup + m.fired * gap) {
          fx.push({ e: 'wave', x: ROUND(this.x), z: ROUND(this.z), speed, max, roar: true });
          m.fired++;
        }
        if (this.mt >= windup + count * gap + 0.3) this.rest(here);
        break;
      }
      case 'seeds': {
        const { windup, volleys, gap, count, perPlayer, speed } = d.seeds;
        while (m.fired < volleys && this.mt >= windup + m.fired * gap) {
          const n = count + perPlayer * (here.length - 1);
          fx.push({ e: 'seeds', x: ROUND(this.x), z: ROUND(this.z), a0: ROUND(m.a0 + (m.fired * Math.PI) / n), n, speed });
          m.fired++;
        }
        if (this.mt >= windup + volleys * gap) this.rest(here);
        break;
      }
    }
  }

  // The next of its moves (BOSSES `moves`), not the last one again
  pick(here) {
    const moves = this.def.moves.filter((move) => move !== this.last || this.def.moves.length === 1);
    const move = moves[Math.floor(this.rand() * moves.length)];
    this.last = move;
    if (move === 'hop' || move === 'pounce') {
      const [lo, hi] = this.def[move].hops;
      this.hopAt(here, lo + Math.floor(this.rand() * (hi - lo + 1)), move);
    } else if (move === 'roar') {
      this.start('roar', { fired: 0 });
    } else if (move === 'roll') {
      this.start('roll', { dir: this.yaw });
    } else {
      this.start('seeds', { fired: 0, a0: this.rand() * Math.PI * 2 });
    }
  }

  // A hop (or a pounce) at one of them (left: hops to go, this one too)
  hopAt(here, left, move = 'hop') {
    const t = here[Math.floor(this.rand() * here.length)];
    const from = { x: this.x, z: this.z };
    let dx = t.x - from.x;
    let dz = t.z - from.z;
    const d = Math.hypot(dx, dz);
    const reach = this.def[move].reach;
    if (d > reach) {
      dx *= reach / d;
      dz *= reach / d;
    }
    this.face(t);
    this.start(move, { from, to: this.inside(from.x + dx, from.z + dz), left });
  }

  rest(here) {
    const [lo, hi] = this.def.pause;
    const dur = (lo + this.rand() * (hi - lo)) / (1 + this.def.quicken * (here.length - 1));
    this.start('rest', { dur });
  }

  start(move, m) {
    this.move = move;
    this.mt = 0;
    this.m = m;
    this.y = 0;
  }

  nearest(here) {
    let best = here[0];
    for (const p of here) if (Math.hypot(p.x - this.x, p.z - this.z) < Math.hypot(best.x - this.x, best.z - this.z)) best = p;
    return best;
  }

  face(p) {
    if (Math.hypot(p.x - this.x, p.z - this.z) > 0.05) this.yaw = Math.atan2(p.x - this.x, p.z - this.z);
  }

  goTo(x, z) {
    const at = this.inside(x, z);
    this.x = at.x;
    this.z = at.z;
  }

  // x, z, kept inside the arena's edge
  inside(x, z) {
    const { x: ax, z: az } = ARENAS[this.id];
    const edge = ARENA_R - BODY_R - 0.3;
    const d = Math.hypot(x - ax, z - az);
    return d <= edge ? { x, z } : { x: ax + ((x - ax) / d) * edge, z: az + ((z - az) / d) * edge };
  }

  // A bop from farmer `who`, standing at x, y, z with `weapon` in hand.
  // null: it didn't count (not fighting, out of reach, up in the air). Else
  // { hp } (its health now); at 0 it has turned friendly, and `won` is
  // everyone who took part (in the arena while it was awake).
  bop(who, weapon, x, y, z) {
    if (this.phase !== 'fight' || !WEAPONS[weapon]) return null;
    if (Math.hypot(x - this.x, z - this.z) > WEAPONS[weapon].reach + BODY_R + REACH_SLACK) return null;
    if (this.y - (y - GROUND_STAND_Y) > 1.6) return null; // (over their head)
    this.hp = Math.max(0, this.hp - (BOSS_FIGHT.damage[weapon] ?? 1));
    this.seen.add(who);
    if (this.hp > 1e-6) return { hp: ROUND(this.hp) };
    this.phase = 'friendly';
    this.phaseT = 0;
    this.start('rest', { dur: 0 });
    return { hp: 0, won: [...this.seen] };
  }

  // As sent to the pages: [x, y, z, yaw, move, mt, hp, max, phase] (move and phase as numbers)
  toWire() {
    return [ROUND(this.x), ROUND(this.y), ROUND(this.z), ROUND(this.yaw), MOVES.indexOf(this.move), ROUND(this.mt), ROUND(this.hp), ROUND(this.max), PHASES.indexOf(this.phase)];
  }
}

// A boss as a page has it from toWire(): { x, y, z, yaw, move, mt, hp, max, phase }, or null
export function bossFromWire(w) {
  if (!Array.isArray(w) || w.length < 9 || !w.slice(0, 8).every(Number.isFinite)) return null;
  const [x, y, z, yaw, move, mt, hp, max, phase] = w;
  return { x, y, z, yaw, move: MOVES[move] ?? 'rest', mt, hp, max, phase: PHASES[phase] ?? 'sleep' };
}

// ---------- What catches a farmer ----------
// Each page checks its own farmer (x, y, z: the collision centre) against the
// boss's moves. A jump clears a shockwave and the seeds.
const low = (y, over) => y - GROUND_STAND_Y < over;

// The boss itself, rolling at them (b: as bossFromWire gives it; def: BOSSES[id])
export const rollHits = (b, def, x, y, z) => b.phase === 'fight' && b.move === 'roll' && b.mt >= def.roll.windup &&
  Math.hypot(x - b.x, z - b.z) < BODY_R + 0.45 && low(y, 1.6);

// A shockwave (as its fx), `age` seconds after it went out. Over: it has gone as far as it goes.
export const waveOver = (w, age) => w.speed * age > w.max + 0.6;
export const waveHits = (w, age, x, y, z) => !waveOver(w, age) && low(y, 0.35) &&
  Math.abs(Math.hypot(x - w.x, z - w.z) - Math.min(w.max, w.speed * age)) < 0.6;

// Seed i of a volley (as its fx), `age` seconds after it went out: where it is
export function seedAt(s, i, age, out = {}) {
  const a = s.a0 + (i / s.n) * Math.PI * 2;
  out.x = s.x + Math.sin(a) * s.speed * age;
  out.z = s.z + Math.cos(a) * s.speed * age;
  return out;
}
export const seedsOver = (s, age) => s.speed * age > ARENA_R * 2;
export const SEED_Y = 0.55; // how high the seeds fly
export const seedHits = (at, x, y, z) => Math.hypot(x - at.x, z - at.z) < 0.55 && low(y, 0.9);
