// Numbers both the server and the client go by. Pure JS: no DOM, no three.js,
// no Node modules, so the same file runs in the browser and on the server.

export const PROTOCOL_VERSION = 26; // v4: chopping trees; v5: farms with helpers; v6: mining rocks; v7: building on farms, bopping in lobbies; v8: giant trees and rocks; v9: lobbies as matches, friends and invitations; v10: the server places the trees and rocks; v11: bosses, and riding; v12: party games; v13: fishing; v14: machines and cooking; v15: dropping things out of the backpack; v16: and on a farm with helpers; v17: weighed fish, a lobby's board of its biggest catches, fishing contests, aquariums; v18: king of the hill; v19: last one standing; v20: watering cans; v21: tomatoes, pumpkins and berry bushes (UPROOT); v22: bounce shrooms, lily leaves, cloud cotton; v23: trading in lobbies; v24: the bow (SHOT), and which sword a farmer holds (STATEF.BLADE); v25: boss dungeons (FOE_BOP, DUNGEON, DUNGEON_FX); v26: their side rooms and chests (DUNGEON_CHEST, DUNGEON_LOOT)

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
  STARTED: 4003, // a lobby whose game is under way (or over) takes nobody new
  NO_GAME: 4004,
  FULL: 4005,
  VERSION: 4006,
  ENDED: 4007,
  REPLACED: 4008, // the same player came back on another socket
  NOT_HELPER: 4009, // a farm's owner hasn't (or no longer has) them down as a helper, or as a friend to look round
  NO_ACCOUNT: 4010, // a lobby is for farmers logged in to an account
  AT_HOME: 4011, // a friend come to look round, while the farmer plays their farm (without helpers) on their own (or once they are home)
};
export const CLOSE_TEXT = {
  [CLOSE.STARTED]: 'That lobby’s game has started: start a lobby of your own, or try Quick join.',
  [CLOSE.NO_GAME]: 'That lobby does not exist (any more).',
  [CLOSE.FULL]: 'That lobby is full.',
  [CLOSE.VERSION]: 'The server runs a newer version of the game. Reload the page.',
  [CLOSE.ENDED]: 'The lobby was closed.',
  [CLOSE.REPLACED]: 'You joined this lobby from another tab.',
  [CLOSE.NOT_HELPER]: 'You are not on that farm\'s helpers or friends (any more).',
  [CLOSE.NO_ACCOUNT]: 'Log in to play online. (Your login may have run out: log out and in again.)',
  [CLOSE.AT_HOME]: 'They are home, farming on their own: come and look round when they are out (or ask to help).',
};
