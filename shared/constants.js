// Numbers both the server and the client go by. Pure JS: no DOM, no three.js,
// no Node modules, so the same file runs in the browser and on the server.

export const PROTOCOL_VERSION = 11; // v4: chopping trees; v5: farms with helpers; v6: mining rocks; v7: building on farms, bopping in lobbies; v8: giant trees and rocks; v9: lobbies as matches, friends and invitations; v10: the server places the trees and rocks; v11: party games

// Starting a lobby with friends (server/presence.js): it opens PARTY_MS after
// the invitations go out, and each lapses unanswered after INVITE_MS
export const PARTY_MS = 30_000;
export const INVITE_MS = 25_000;

export const TICK_RATE = 20; // room ticks (and snapshots) per second
export const TICK_DT = 1 / TICK_RATE;
export const INTERP_DELAY = 0.1; // seconds remote players are drawn in the past

// How long a game day lasts, and how long tilled soil stays bare: shared/balance.js
export { DAY_LENGTH_SECONDS, SOIL_BARE_HOURS } from './balance.js';

// Developer tools (src/devtools.js: on a desktop, ` opens them): 'everyone'
// for now; 'local' keeps them to a game run with npm run dev (the page's
// import.meta.env.DEV, the server's GAME_DEV)
export const DEV_TOOLS = 'everyone';
export const devToolsOn = (local) => DEV_TOOLS === 'everyone' || !!local;

export const MAX_PLAYERS = 8;
export const MAX_NAME = 16;
export const MAX_CHAT = 160;
export const MAX_FARM_NAME = 24;
export const PIN_LENGTH = 6;

// A dropped player's seat (and what they found) is kept this long so a reload or a
// flaky connection puts them back where they were.
export const HOLD_MS = 20_000;

// Shirt colors handed out in join order (the lowest one nobody wears)
export const PLAYER_COLORS = [0xff5533, 0x3fa7ff, 0xffd23f, 0x7ed957, 0xc77dff, 0xff8fd1, 0xff9f1c, 0x2ec4b6];

// Close codes a room or the lobby ends a socket with; the client shows the reason
// instead of trying to reconnect.
export const CLOSE = {
  NO_GAME: 4004,
  FULL: 4005,
  VERSION: 4006,
  ENDED: 4007,
  REPLACED: 4008, // the same player came back on another socket
  NOT_HELPER: 4009, // a farm's owner hasn't (or no longer has) them down as a helper
  NO_ACCOUNT: 4010, // a lobby is for farmers logged in to an account
};
export const CLOSE_TEXT = {
  [CLOSE.NO_GAME]: 'That lobby does not exist (any more).',
  [CLOSE.FULL]: 'That lobby is full.',
  [CLOSE.VERSION]: 'The server runs a newer version of the game. Reload the page.',
  [CLOSE.ENDED]: 'The lobby was closed.',
  [CLOSE.REPLACED]: 'You joined this lobby from another tab.',
  [CLOSE.NOT_HELPER]: 'You are not on that farm\'s helpers any more.',
  [CLOSE.NO_ACCOUNT]: 'Log in to play online. (Your login may have run out: log out and in again.)',
};
