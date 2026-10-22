// ---------- Machines ----------
// The cheese press, the mayonnaise machine, the loom, the beehive and the
// campfire: built on a farm (PIECES, shared/level.js), something goes in and
// a few game hours later something better comes out (MACHINES, CAMPFIRE_HOURS
// and DISHES in shared/balance.js). The farm keeps what is in each, by the
// tile it stands on: the page on a farm without helpers (src/machines.js),
// the room on one with them (server/farmroom.js); both go by this.
//
// What is in one: { item: what comes out, at: when it is ready (the farm's
// clock, game hours), takes: { item: count } what went in, n?: how many come
// out (the campfire: up to CAMPFIRE_MOST of a dish; else one) }. A beehive
// always has something in it (honey, on its way), and starts again once
// collected. In the farm's save: machines: [[key, item, at, takes, n?]].
//
// An aquarium goes by the same rules, though it makes nothing: the fish put
// in it (up to AQUARIUM.holds) are its `takes`, there to swim about and be
// looked at, and it is never ready (item: 'aquarium'). E with a fish in hand
// puts it in; otherwise E takes one back out.
import { MACHINES, CAMPFIRE_HOURS, CAMPFIRE_MOST, DISHES, ANY, AQUARIUM, FISH_WEIGHT } from './balance.js';

export const READY_SLACK = 0.02; // game hours: pages count on their own clocks
export const TANK = 'aquarium';
const TANK_AT = 1e9; // (never ready)
export const MACHINE_PIECES = new Set([...Object.keys(MACHINES), 'campfire', TANK]);
export const isMachine = (piece) => MACHINE_PIECES.has(piece);
export const isFish = (item) => Object.hasOwn(FISH_WEIGHT, item ?? '');
// How many fish are in an aquarium's state
export const fishIn = (state) => Object.values(state?.takes ?? {}).reduce((sum, n) => sum + n, 0);

// A dish's need, as an item: one of a group (ANY: 'any_fish') stands for the
// first of it (what comes back if it is taken down before it is done)
export const needItem = (id) => ANY[id]?.[0] ?? id;

// What a machine `piece` holds once loaded at `hours` (dish: what the campfire
// is to cook, n of it; or the fish going into an aquarium), or null if that
// doesn't go in it. now: what is in it already (only an aquarium takes more)
export function loadFor(piece, hours, dish, n = 1, now = null) {
  if (piece === TANK) {
    if (!isFish(dish) || fishIn(now) >= AQUARIUM.holds) return null;
    const takes = { ...now?.takes };
    takes[dish] = (takes[dish] ?? 0) + 1;
    return { item: TANK, at: TANK_AT, takes };
  }
  if (now) return null;
  const m = MACHINES[piece];
  if (piece === 'campfire') {
    const d = Object.hasOwn(DISHES, dish) && DISHES[dish];
    if (d?.cook !== 'campfire' || !Number.isInteger(n) || n < 1 || n > CAMPFIRE_MOST) return null;
    const takes = {};
    for (const [id, k] of Object.entries(d.needs)) takes[needItem(id)] = (takes[needItem(id)] ?? 0) + k * n;
    return { item: dish, at: hours + CAMPFIRE_HOURS, takes, ...(n > 1 && { n }) };
  }
  if (!m?.takes) return null;
  return { item: m.makes, at: hours + m.hours, takes: { [m.takes]: 1 } };
}

// What a beehive (a machine that takes nothing) holds from `hours`, or null:
// once built, and again each time it is collected
export function fillsItself(piece, hours) {
  const m = MACHINES[piece];
  return m && !m.takes ? { item: m.makes, at: hours + m.hours, takes: {} } : null;
}

export const isReady = (state, hours) => !!state && hours >= state.at - READY_SLACK;

// E at a machine with something in it at `hours`: what is in it after, and
// what comes out ({ state, got, n }), or null: nothing to collect yet. An
// aquarium gives back the fish `what` (else the last kind put in).
export function collectFor(piece, state, hours, what) {
  if (piece === TANK) {
    const takes = { ...state?.takes };
    const fish = takes[what] ? what : Object.keys(takes).at(-1);
    if (!fish) return null;
    if (--takes[fish] <= 0) delete takes[fish];
    return { state: Object.keys(takes).length ? { item: TANK, at: TANK_AT, takes } : null, got: fish, n: 1 };
  }
  return isReady(state, hours) ? { state: fillsItself(piece, hours), got: state.item, n: state.n ?? 1 } : null;
}

// Taken down at `hours`: what comes back, { item: count } (what is ready, or
// what went in; a beehive's honey only when it is ready)
export function contentsBack(state, hours) {
  if (!state) return {};
  return isReady(state, hours) ? { [state.item]: state.n ?? 1 } : { ...state.takes };
}

const KEY_RE = /^-?\d{1,3},-?\d{1,3}$/;
const ITEM_RE = /^[a-z][a-z0-9_]{0,31}$/;

// From a save's machines list, those on a tile a machine is built on
// (pieceAt(key): the piece built there). Beehives with nothing saved start
// from `hours`.
export function machinesFromSave(list, pieceAt, keys, hours) {
  const out = new Map();
  for (const entry of Array.isArray(list) ? list : []) {
    if (!Array.isArray(entry)) continue;
    const [key, item, at, takes, n] = entry;
    if (!KEY_RE.test(key) || !isMachine(pieceAt(key)) || !ITEM_RE.test(item) || !Number.isFinite(at)) continue;
    const back = {};
    for (const [id, n] of Object.entries(takes && typeof takes === 'object' ? takes : {})) {
      if (ITEM_RE.test(id) && Number.isInteger(n) && n > 0 && n < 100) back[id] = n;
    }
    out.set(key, { item, at, takes: back, ...(Number.isInteger(n) && n > 1 && n <= CAMPFIRE_MOST && { n }) });
  }
  for (const key of keys) {
    if (out.has(key)) continue;
    const full = fillsItself(pieceAt(key), hours);
    if (full) out.set(key, full);
  }
  return out;
}

export const machinesToSave = (machines) => [...machines].map(([key, s]) => [key, s.item, Math.round(s.at * 1000) / 1000, s.takes, ...(s.n > 1 ? [s.n] : [])]);
