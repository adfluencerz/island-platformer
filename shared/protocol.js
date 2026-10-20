// Messages between a client and its lobby. Every message is a JSON object
// whose `t` field is one of these; the comments list the other fields.

// client -> lobby
export const C = {
  JOIN: 'join', // { v, name, key, back }: the first message on a socket
  STATE: 'state', // { x, y, z, yaw, f }: where the player is, ~TICK_RATE times a second (f: STATEF bits)
  TAKE: 'take', // { id }: gathered (or walked into) what is on spot id
  CHOP: 'chop', // { id, x, z, size }: the last swing at tree id, which the page has standing at x, z (size: its scale)
  CHAT: 'chat', // { text }
  PING: 'ping', // { c }: answered with PONG carrying the same c
};

// lobby -> client
export const S = {
  WELCOME: 'welcome', // { id, name, color, code, seed, room, spots, felled, roster, pos, clock, resumed } (seed: the island's, shared/worldgen.js; felled: the ids of trees that are down)
  ROSTER: 'roster', // { list: [{ id, name, color, finds, rares, wood, away }] }
  SNAP: 'snap', // { tick, p: [[id, x, y, z, yaw, f], ...] }
  SPOT: 'spot', // { id, item, count }: something grew back on spot id
  TAKEN: 'taken', // { id, by, item, count }: spot id was emptied by player `by`
  DENY: 'deny', // { id }: that did not count (someone got there first, or too far)
  FELLED: 'felled', // { id, by, count }: tree id came down; player `by` got count wood
  REGROWN: 'regrown', // { id }: tree id has grown back
  CHOP_DENY: 'chopDeny', // { id }: that chop did not count (already down, too far, too fast)
  CHAT: 'chat', // { from, name, color, text } (from 0: the lobby itself)
  PONG: 'pong', // { c }
};

// spots in WELCOME: [[id, kind, x, y, z, item, count], ...] (item null: nothing there right now)

// bits of a player's state flags
export const STATEF = {
  GROUND: 1, // standing on something
  HOE: 2, // has the hoe in hand
  AXE: 4, // has the axe in hand
  SWING: 8, // swinging the tool in hand
};

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g;

export function cleanText(s, max) {
  return String(s ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export const finite = (...xs) => xs.every((x) => typeof x === 'number' && Number.isFinite(x));
