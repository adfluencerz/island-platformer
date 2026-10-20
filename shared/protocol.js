// Messages between a client and the online place it is in: a lobby
// (shared/room.js) or a farm with helpers on it (server/farmroom.js). Every
// message is a JSON object whose `t` field is one of these; the comments list
// the other fields. JOIN, STATE, CHAT and PING (and ROSTER, SNAP, CHAT and
// PONG back) are the same in both.
import { PIN_LENGTH } from './constants.js';

// client -> lobby
export const C = {
  JOIN: 'join', // { v, name, key, back }: the first message on a socket
  STATE: 'state', // { x, y, z, yaw, f }: where the player is, ~TICK_RATE times a second (f: STATEF bits)
  TAKE: 'take', // { id }: gathered (or walked into) what is on spot id
  CHOP: 'chop', // { id, x, z, size }: the last swing at tree id, which the page has standing at x, z (size: its scale)
  MINE: 'mine', // { id, x, z, size }: the last swing at rock id, which the page has lying at x, z (size: its scale)
  CHAT: 'chat', // { text }
  PING: 'ping', // { c }: answered with PONG carrying the same c
  // on a farm (JOIN there also carries auth: "<farm id>.<token>", the joiner's own farm, see server/farms.js)
  TILL: 'till', // { key }: till tile key ("gx,gz") underfoot
  PLANT: 'plant', // { key, crop }: plant a seed from the backpack on tilled tile key
  HARVEST: 'harvest', // { key }: the ripe crop on tile key, into the farm's chest
  CHEST_PUT: 'chestPut', // { item, count }: from the backpack into the chest
  CHEST_TAKE: 'chestTake', // { item, count }: out of the chest into the backpack (the owner only)
  CLOCK: 'clock', // { hours }: the farm's clock (the owner only, alone on the farm: fast-forwarding)
  ANIMALS: 'animals', // { state }: the animals as the owner's page has them (src/animals.js capture())
};

// lobby -> client
export const S = {
  WELCOME: 'welcome', // { id, name, color, code, seed, room, spots, felled, mined, roster, pos, clock, resumed } (seed: the island's, shared/worldgen.js; felled: the ids of trees that are down; mined: of rocks that are broken)
  ROSTER: 'roster', // { list: [{ id, name, color, finds, rares, wood, stone, away }] }
  SNAP: 'snap', // { tick, p: [[id, x, y, z, yaw, f], ...] }
  SPOT: 'spot', // { id, item, count }: something grew back on spot id
  TAKEN: 'taken', // { id, by, item, count }: spot id was emptied by player `by`
  DENY: 'deny', // { id }: that did not count (someone got there first, or too far)
  FELLED: 'felled', // { id, by, count }: tree id came down; player `by` got count wood
  REGROWN: 'regrown', // { id }: tree id has grown back
  CHOP_DENY: 'chopDeny', // { id }: that chop did not count (already down, too far, too fast)
  MINED: 'mined', // { id, by, count }: rock id was broken up; player `by` got count stone
  RESURFACED: 'resurfaced', // { id }: rock id is back
  MINE_DENY: 'mineDeny', // { id }: that swing did not count (already broken, too far, too fast)
  CHAT: 'chat', // { from, name, color, text } (from 0: the lobby itself)
  PONG: 'pong', // { c }
  // on a farm
  FARM: 'farm', // { id, name, color, farm: { id, name, owner }, mine, tilled, crops, chest, hours, animals, roster, pos, resumed }
  //   (WELCOME on a farm. mine: this is your own farm. crops: [[key, crop, plantedAt], ...], plantedAt in the farm's game hours.
  //   chest: { item: count }. hours: the farm's clock, in game hours since it began)
  TILLED: 'tilled', // { key, by }
  PLANTED: 'planted', // { key, crop, at, by } (at: plantedAt)
  HARVESTED: 'harvested', // { key, by, item }
  FARM_DENY: 'farmDeny', // { op, key, crop }: that did not count (crop: a seed to give back)
  CHEST: 'chest', // { items: { item: count } }
  CHEST_GOT: 'chestGot', // { item, count }: out of the chest, for your backpack
  FARM_CLOCK: 'farmClock', // { hours }: the farm's clock, now and then (pages drift)
};

// spots in WELCOME: [[id, kind, x, y, z, item, count], ...] (item null: nothing there right now)

// bits of a player's state flags
export const STATEF = {
  GROUND: 1, // standing on something
  HOE: 2, // has the hoe in hand
  AXE: 4, // has the axe in hand
  SWING: 8, // swinging the tool in hand
  PICK: 16, // has the pickaxe in hand
};

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g;

export function cleanText(s, max) {
  return String(s ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export const finite = (...xs) => xs.every((x) => typeof x === 'number' && Number.isFinite(x));

// ---------- Farm names and PINs (server/farms.js: getting a farm back) ----------
// A farm's name is how it is found again, so it is one of a kind on a server,
// whatever the capitals, accents or punctuation: "Sunny Acres!" and
// "sunny-acres" are the same farm. '' for a name too short to be one.
export function farmNameKey(name) {
  const key = String(name ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return key.length >= 3 ? key : '';
}

// Why this PIN won't do, or '' when it will: PIN_LENGTH digits, and not one
// that is tried first (all the same, or counting up or down)
export function pinProblem(pin, length = PIN_LENGTH) {
  if (!new RegExp(`^\\d{${length}}$`).test(String(pin ?? ''))) return `A PIN is ${length} digits.`;
  const d = [...pin].map(Number);
  const steps = new Set(d.slice(1).map((n, i) => (n - d[i] + 10) % 10));
  if (steps.size === 1 && [0, 1, 9].includes([...steps][0])) return 'That PIN is too easy to guess.';
  return '';
}
