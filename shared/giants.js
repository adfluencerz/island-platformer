// Giant trees and rocks (GIANT in shared/balance.js). Now and then, of a game
// morning, one standing tree of a lobby or farm grows huge, and likewise one
// rock. It takes everyone's swings together to bring one down, and what it
// gives is shared by how much each farmer did. A place has one giant tree at
// most, and once that is down never another (nor rocks).
//
// An online place keeps a Giants (shared/room.js, server/farmroom.js) and says
// how its giant is doing after every swing; a farm played alone keeps its own
// on the page (src/main.js). A giant is one of the place's trees or rocks, by
// its number (shared/wilds.js: the server's list, the same on every page).
import { GIANT, TREE, ROCK, TOOL_HITS, GROUND_STAND_Y, woodFor, stoneFor, mostWood, mostStone } from './level.js';
import { finite } from './protocol.js';

export const KINDS = ['tree', 'rock'];
export const MORNING = 6; // the game hour each day's roll comes at
export const LOBBY_DAWN = 9; // a lobby's clock starts at this hour, when it opens
const BASE = { tree: TREE.hits, rock: ROCK.hits };
const TOOL = { tree: '_axe', rock: '_pickaxe' }; // (the better tools' ids end so: TOOL_HITS)
const MOST = 2000; // tree and rock ids are below this (as in shared/room.js)
const SIZES = { tree: TREE.size, rock: ROCK.size };
const REACH = 2.6; // past the bark or the rock's edge (as for an ordinary one, in shared/room.js)
const HIT_EVERY = 450; // ms: the fewest between one farmer's swings (a swing and the gap after it take 550)
const round2 = (v) => Math.round(v * 100) / 100;

// The day it is at `hours` (game hours): a new one every MORNING
export const gameDay = (hours) => Math.floor((hours - MORNING) / 24);

// A giant's health: so many ordinary swings
export const giantMax = (kind) => GIANT.hits * BASE[kind];

// How much bigger a giant of this size is drawn
export const giantScale = (kind, size) => (kind === 'tree' ? GIANT.treeScale : Math.max(GIANT.rockScale, GIANT.rockMin / Math.max(size, 0.05)));

// What one swing with `tool` takes off: one, or more with a better one (as
// much more as it saves on an ordinary tree or rock)
export const swingDamage = (kind, tool) => (typeof tool === 'string' && tool.endsWith(TOOL[kind]) && TOOL_HITS[tool] ? BASE[kind] / TOOL_HITS[tool] : 1);

// The most a giant of this size can give (room to keep in the backpack)
export const mostGiantLoot = (kind, size) => GIANT.loot * (kind === 'tree' ? mostWood(size) : mostStone(size));

export class Giants {
  // rand: () => [0, 1)
  constructor(rand = Math.random) {
    this.rand = rand;
    this.tree = null; // the giant tree: { id, hp, dmg: player id -> how much they took off }
    this.rock = null;
    this.done = { tree: false, rock: false }; // its giant came down: no more
    this.day = null; // the day last rolled for
    this.counts = { tree: 0, rock: 0 }; // how many trees and rocks there are (0: not known yet)
  }

  // How many trees and rocks there are (shared/wilds.js; set once)
  setCounts(trees, rocks) {
    const ok = (n) => Number.isInteger(n) && n > 0 && n <= MOST;
    if (!this.counts.tree && ok(trees)) this.counts.tree = trees;
    if (!this.counts.rock && ok(rocks)) this.counts.rock = rocks;
  }

  // On a day not rolled for yet: maybe a giant tree, maybe a giant rock.
  // down: { tree, rock }, each with has(id) for the ones down right now (a
  // stump can't grow huge: no giant that day). Returns the new giants, [[kind, id]].
  roll(day, down) {
    if (day === this.day || (!this.counts.tree && !this.counts.rock)) return [];
    this.day = day;
    const born = [];
    for (const kind of KINDS) {
      if (this[kind] || this.done[kind] || !this.counts[kind] || this.rand() >= GIANT.chance) continue;
      const id = Math.floor(this.rand() * this.counts[kind]);
      if (down[kind].has(id)) continue;
      this[kind] = { id, hp: giantMax(kind), dmg: new Map() };
      born.push([kind, id]);
    }
    return born;
  }

  // (developer tools) kind's giant is id, now, whatever the day: [kind, id],
  // or null if there is one already or there is no such id
  grow(kind, id) {
    if (!KINDS.includes(kind) || this[kind] || !Number.isInteger(id) || id < 0 || id >= (this.counts[kind] || MOST)) return null;
    this[kind] = { id, hp: giantMax(kind), dmg: new Map() };
    this.done[kind] = false;
    return [kind, id];
  }

  is(kind, id) {
    return this[kind]?.id === id;
  }

  // A swing at tree or rock id by player `who`, with `tool` in hand. null: it
  // isn't a giant. Else { hp } (its health now), and once it is down, `loot`
  // (all it gives, for one of `size`) and `shares`: [[who, count]], by how
  // much each took off.
  hit(kind, id, who, tool, size) {
    const g = this[kind];
    if (!g || g.id !== id) return null;
    const dmg = Math.min(g.hp, swingDamage(kind, tool));
    g.hp -= dmg;
    g.dmg.set(who, (g.dmg.get(who) ?? 0) + dmg);
    if (g.hp > 1e-6) return { hp: round2(g.hp) };
    this[kind] = null;
    this.done[kind] = true;
    const loot = GIANT.loot * (kind === 'tree' ? woodFor(size, this.rand) : stoneFor(size, this.rand));
    return { hp: 0, loot, shares: shareOut(loot, g.dmg) };
  }

  // (a page keeping up with its place: how a giant is doing, as the place says)
  set(kind, id, hp) {
    if (this[kind]?.id === id) this[kind].hp = hp;
    else this[kind] = { id, hp, dmg: new Map() };
  }

  // (...and that it came down)
  felled(kind) {
    this[kind] = null;
    this.done[kind] = true;
  }

  // As plain JSON: { tree: [id, hp] or null, rock, done: [kind], day }. Who did
  // how much isn't kept: after a restart the shares count from there.
  toSave() {
    const one = (g) => g && [g.id, round2(g.hp)];
    return { tree: one(this.tree), rock: one(this.rock), done: KINDS.filter((kind) => this.done[kind]), day: this.day };
  }

  static fromSave(save, rand = Math.random) {
    const giants = new Giants(rand);
    if (!save || typeof save !== 'object') return giants;
    for (const kind of KINDS) {
      const [id, hp] = Array.isArray(save[kind]) ? save[kind] : [];
      if (Number.isInteger(id) && id >= 0 && id < MOST && Number.isFinite(hp) && hp > 0) {
        giants[kind] = { id, hp: Math.min(hp, giantMax(kind)), dmg: new Map() };
      }
      giants.done[kind] = Array.isArray(save.done) && save.done.includes(kind) && !giants[kind];
    }
    if (Number.isInteger(save.day)) giants.day = save.day;
    return giants;
  }
}

// A HIT from player p, checked against where the place last heard p is: the
// giant is there, p is beside it, down on the ground, and isn't swinging
// faster than a farmer can. null: it doesn't count. Else as Giants.hit, with
// the kind and id.
export function giantSwing(giants, p, msg, now = Date.now()) {
  const { kind, id, x, z } = msg ?? {};
  if (!KINDS.includes(kind) || !giants.is(kind, id) || !finite(x, z) || now - (p.hitAt ?? 0) < HIT_EVERY) return null;
  const [lo, hi] = SIZES[kind];
  const size = Math.min(hi, Math.max(lo, Number.isFinite(msg.size) ? msg.size : lo));
  const drawn = size * giantScale(kind, size);
  const reach = REACH + (kind === 'tree' ? 0.25 : 1.5) * drawn;
  if (Math.hypot(x - p.x, z - p.z) > reach || Math.abs(p.y - GROUND_STAND_Y) >= 2) return null;
  p.hitAt = now;
  return { kind, id, ...giants.hit(kind, id, p.id, msg.tool, size) };
}

// `loot` shared out by how much each took off (dmg: who -> how much), in whole
// counts that add up to it (the biggest remainders get the odd ones)
function shareOut(loot, dmg) {
  const total = [...dmg.values()].reduce((a, b) => a + b, 0) || 1;
  const shares = [...dmg].map(([who, d]) => {
    const exact = (loot * d) / total;
    return { who, count: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = loot - shares.reduce((a, s) => a + s.count, 0);
  for (const s of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    s.count++;
    left--;
  }
  return shares.filter((s) => s.count > 0).map((s) => [s.who, s.count]);
}
