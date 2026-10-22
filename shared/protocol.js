// Messages between a client and the online place it is in: a lobby
// (shared/room.js) or a farm with helpers on it (server/farmroom.js). Every
// message is a JSON object whose `t` field is one of these; the comments list
// the other fields. JOIN, STATE, CHAT and PING (and ROSTER, SNAP, CHAT and
// PONG back) are the same in both.
import { PIN_LENGTH, MAX_NAME } from './constants.js';

// client -> lobby
export const C = {
  JOIN: 'join', // { v, name, key, back, color, auth }: the first message on a socket (auth: "<farm id>.<token>" of this browser's farm, its account's name and color are the ones that count; name, color: as the page has them)
  STATE: 'state', // { x, y, z, yaw, f }: where the player is, ~TICK_RATE times a second (f: STATEF bits)
  TAKE: 'take', // { id, key? }: gathered (or walked into) what is on spot id (key: true, an old key opens a sky_vault, and is used up)
  CHOP: 'chop', // { id, x, z, size }: the last swing at tree id, which the page has standing at x, z (size: its scale; the room goes by its own, shared/wilds.js)
  MINE: 'mine', // { id, x, z, size }: the last swing at rock id, which the page has lying at x, z (size: as for CHOP)
  BOP: 'bop', // { weapon, yaw }: a swing of the weapon in hand (WEAPONS in shared/level.js), facing yaw
  PICKUP: 'pickup', // { id }: walked into drop id
  HIT: 'hit', // { kind, id, x, z, size, tool }: a swing at the giant tree or rock (kind: 'tree' or 'rock') id, which the page has at x, z (size: as for CHOP; tool: the item in hand)
  DEV_GIANT: 'devGiant', // { kind, id }: developer tools (shared/constants.js DEV_TOOLS): tree or rock id grows into a giant now
  GAME_START: 'gameStart', // { game }: start a party game of this kind (GAMES in shared/arenas.js), at the signpost (shared/minigame.js)
  GAME_JOIN: 'gameJoin', // {}: into the party game gathering now
  GAME_LEAVE: 'gameLeave', // {}: out of the party game (gathering: not coming after all; in the arena: back to the lobby)
  GAME_COIN: 'gameCoin', // { id }: walked into coin id in the arena (coin rush)
  CHAT: 'chat', // { text }
  PING: 'ping', // { c }: answered with PONG carrying the same c
  // on a farm (JOIN there also carries auth: "<farm id>.<token>", the joiner's own farm, see server/farms.js)
  TILL: 'till', // { key }: till tile key ("gx,gz") underfoot
  PLANT: 'plant', // { key, crop }: plant a seed from the backpack on tilled tile key
  HARVEST: 'harvest', // { key }: the ripe crop on tile key, into the farm's chest
  CHEST_PUT: 'chestPut', // { item, count }: from the backpack into the chest
  CHEST_TAKE: 'chestTake', // { item, count }: out of the chest into the backpack (the owner only)
  CHEST_SPEND: 'chestSpend', // { id, items: { item: count } }: use up some of what is in the chest, for what the workbench makes (the owner only); answered with CHEST_SPENT
  CLOCK: 'clock', // { hours }: the farm's clock (the owner only, alone on the farm: fast-forwarding)
  ANIMALS: 'animals', // { state }: the animals as the owner's page has them (src/animals.js capture()), and the farm's upgrade `levels`
  CAST: 'cast', // { n, x, z, rod, level }: cast the line, the bobber landing on the water at x, z (n: the page's count of its casts, said back in BITE and CAUGHT; rod: the one in hand, RODS in shared/balance.js; level: our fishing skill's; in a lobby)
  REEL: 'reel', // {}: E with the line out: lands what bit if it is in time (BITE), else just reels in
  BUILD: 'build', // { key, piece, chest? }: build a piece (PIECES in shared/level.js) on tile key, paid from the backpack (the owner: what it is short of from the farm's chest, chest: { item: count })
  UNBUILD: 'unbuild', // { key }: take down the piece on tile key
  BOSS_BOP: 'bossBop', // { boss, weapon }: a bop at the boss (shared/bosses.js) in whose arena we are, with the weapon in hand
  LOAD: 'load', // { key, dish? }: put what the machine on tile key takes in, from the backpack (dish: what the campfire is to cook, DISHES in shared/balance.js)
  COLLECT: 'collect', // { key }: what the machine on tile key has ready, for the backpack
};

// lobby -> client
export const S = {
  WELCOME: 'welcome', // { id, name, color, code, seed, room, spots, wilds, felled, mined, drops, roster, pos, clock, giants, game, resumed } (game: as for GAME) (seed: the island's, shared/worldgen.js; wilds: where its trees and rocks stand, shared/wilds.js wildsToWire; felled: the ids of trees that are down; mined: of rocks that are broken; treeSites, rockSites: [[id, how often it grew back]] (shared/level.js nextSite); drops: [[id, item, count, x, y, z], ...]; giants: Giants toSave(), shared/giants.js)
  ROSTER: 'roster', // { list: [{ id, name, color, finds, rares, wood, stone, game, away }] } (game: the party game id they are off in, 0: in the lobby)
  SNAP: 'snap', // { tick, p: [[id, x, y, z, yaw, f], ...] }
  SPOT: 'spot', // { id, item, count }: something grew back on spot id
  TAKEN: 'taken', // { id, by, item, count, items? }: spot id was emptied by player `by` (items: a sky isle chest's [[item, count], ...]; its item is 'chest')
  DENY: 'deny', // { id }: that did not count (someone got there first, or too far)
  FELLED: 'felled', // { id, by, count, at, shares }: tree id came down; player `by` got count wood (at: on a farm, when it grows back, ms; shares: a giant's, [[player id, count]], each player's wood)
  REGROWN: 'regrown', // { id, n }: tree id has grown back, in its place n (shared/level.js nextSite)
  CHOP_DENY: 'chopDeny', // { id }: that chop did not count (already down, too far, too fast)
  MINED: 'mined', // { id, by, count, at, shares }: rock id was broken up; player `by` got count stone (at: on a farm, when it comes back, ms; shares: as for FELLED)
  GIANT: 'giant', // { kind, id, hp, max, by }: tree or rock id is a giant with hp of max health left (by: who just swung at it; 0: it has just grown huge)
  RESURFACED: 'resurfaced', // { id, n }: rock id is back, in its place n
  MINE_DENY: 'mineDeny', // { id }: that swing did not count (already broken, too far, too fast)
  BOPPED: 'bopped', // { by, id, dx, dz, knock, drop }: player `by` bopped player id, knocking them along dx, dz (a unit vector) at speed knock; drop: [item, count] they dropped, or null
  DROP: 'drop', // { id, item, count, x, y, z }: something dropped, for anyone to walk into
  GAME: 'game', // { game }: the lobby's party game as it is now (null: none; shared/minigame.js wire()), whenever that changes
  GAME_COIN: 'gameCoin', // { id, by, score }: coin id in the arena was picked up by player `by`, who has score now
  GAME_END: 'gameEnd', // { game, seed, scores: [[id, score]], winner, prizes: [[id, [[item, count], ...]]], pos: [[id, x, y, z]] }: it is over; everyone who played is back in the lobby at pos (winner: 0, nobody)
  PICKED: 'picked', // { id, by, item, count }: drop id was picked up by player `by` (0: it faded away)
  BITE: 'bite', // { n, window }: something bit our line (cast n): REEL within window ms
  CAUGHT: 'caught', // { n, item, count, items? }: what we landed on cast n (item null: nothing, it got away; 'chest': a little chest, its items [[item, count], ...])
  DROP_DENY: 'dropDeny', // { id }: that pickup did not count (someone was quicker, or too far)
  CHAT: 'chat', // { from, name, color, text } (from 0: the lobby itself)
  PONG: 'pong', // { c }
  // on a farm
  FARM: 'farm', // { id, name, color, farm: { id, name, owner }, mine, tilled, crops, built, machines, felled, mined, treeSites, rockSites, giants, chest, hours, animals, roster, pos, resumed } (felled, mined: [[tree or rock id, when it comes back]])
  //   (WELCOME on a farm. mine: this is your own farm. crops: [[key, crop, plantedAt], ...], plantedAt in the farm's game hours.
  //   tilled: [[key, bare, life], ...], bare: game seconds it has lain bare, life: how long it may. built: [[key, piece], ...].
  //   machines: [[key, item, at, takes], ...] (shared/machines.js). chest: { item: count }. hours: the farm's clock, in game hours since it began)
  TILLED: 'tilled', // { key, by }
  UNTILLED: 'untilled', // { key }: left bare too long (SOIL_BARE_HOURS), back to grass
  PLANTED: 'planted', // { key, crop, at, by } (at: plantedAt)
  HARVESTED: 'harvested', // { key, by, item }
  BUILT: 'built', // { key, piece, by }
  UNBUILT: 'unbuilt', // { key, piece, by, back? }: taken down; `by` gets the cost back (and back: { item: count }, what was in a machine)
  FARM_DENY: 'farmDeny', // { op, key, crop, piece }: that did not count (crop: a seed to give back; piece: a piece whose cost goes back; op 'load': what went in comes back)
  CHEST: 'chest', // { items: { item: count } }
  CHEST_GOT: 'chestGot', // { item, count }: out of the chest, for your backpack
  CHEST_SPENT: 'chestSpent', // { id, ok }: the answer to CHEST_SPEND (ok: it was all there, and is used up)
  FARM_CLOCK: 'farmClock', // { hours }: the farm's clock, now and then (pages drift)
  BOSS: 'boss', // { boss, s }: how a boss is doing (s: BossFight toWire(), shared/bosses.js), a few times a second while anyone is in its arena
  BOSS_FX: 'bossFx', // { boss, fx }: one of its moves (BossFight step()), or { e: 'bop', by, hp } a bop that landed
  BOSS_WON: 'bossWon', // { boss, by, won }: it turned friendly (by: who bopped it last; won: the player ids who took part)
  MACHINE: 'machine', // { key, state, by, got? }: what is in the machine on tile key now ([item, at, takes], or null: empty), after player `by` loaded or collected it (got: the item collected, for `by`'s backpack)
};

// Presence (server/presence.js): every logged in page keeps one more socket,
// /ws?presence, wherever it is, so friends can invite it to a lobby.
// page -> server
export const PC = {
  HELLO: 'hello', // { v, auth }: the first message (auth: "<farm id>.<token>", a farm with an account)
  WHERE: 'where', // { place }: 'home', 'lobby' or 'farm' (for the friends list)
  PARTY: 'party', // { invite: [friend farm ids] }: start a lobby, inviting them (the lobby opens PARTY_MS later)
  CANCEL: 'cancel', // {}: the party we started is called off
  ANSWER: 'answer', // { party, yes }: to an invitation
  INVITE: 'invite', // { code, invite: [friend farm ids] }: to the lobby we are in, now
};
// server -> page
export const PS = {
  READY: 'ready', // { id, name }: we are online (our farm id and name)
  INVITED: 'invited', // { party, from, color, ms, late }: friend `from` invites us; it lapses in ms (late: to a lobby already running)
  PARTY: 'party', // { party, ms, friends: [[id, name, state]] }: our party: it opens in ms; state 'waiting', 'yes' or 'no'
  GO: 'go', // { party, code }: off to lobby code
  GONE: 'gone', // { party }: that invitation is over for us (it lapsed, or another tab answered it)
  CALLED_OFF: 'calledOff', // { party, why }: the party was called off
  FRIENDS: 'friends', // {}: our friends changed (one came online, went off, moved, asked, said yes, or unfriended): ask for them again
};

// spots in WELCOME: [[id, kind, x, y, z, item, count], ...] (item null: nothing there right now)

// bits of a player's state flags
export const STATEF = {
  GROUND: 1, // standing on something
  HOE: 2, // has the hoe in hand
  AXE: 4, // has the axe in hand
  SWING: 8, // swinging the tool in hand
  PICK: 16, // has the pickaxe in hand
  SWORD: 32, // has the wooden sword in hand
  MALLET: 64, // has the mallet in hand
  ROD: 128, // has a fishing rod in hand
  CAST: 256, // ...with its line out
  BITE: 512, // ...and the bobber is dipping
  MOUNT: 1024, // riding: (f / MOUNT) & 7 is which mount, 1 + its boss's place in BOSS_IDS (shared/bosses.js); 0 on foot
};

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g;

export function cleanText(s, max) {
  return String(s ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export const finite = (...xs) => xs.every((x) => typeof x === 'number' && Number.isFinite(x));

// ---------- Accounts (server/farms.js) ----------
// A username is the farmer's name in lobbies too, and one of a kind on the
// server the way farm names are (usernameKey). A password is any 6 to 64
// characters. There is no getting a forgotten one back.
export const PASSWORD_LENGTH = [6, 64];
export const usernameKey = (name) => farmNameKey(name);

// Why this username won't do, or '' when it will
export function usernameProblem(name) {
  const clean = cleanText(name, MAX_NAME + 1);
  if (clean.length > MAX_NAME) return `A username is at most ${MAX_NAME} characters.`;
  if (!usernameKey(clean)) return 'A username needs at least 3 letters or digits.';
  return '';
}

// Why this password won't do, or '' when it will
export function passwordProblem(password) {
  const n = typeof password === 'string' ? password.length : 0;
  if (n < PASSWORD_LENGTH[0]) return `A password is at least ${PASSWORD_LENGTH[0]} characters.`;
  if (n > PASSWORD_LENGTH[1]) return `A password is at most ${PASSWORD_LENGTH[1]} characters.`;
  return '';
}

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
