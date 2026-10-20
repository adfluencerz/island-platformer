// Numbers both the server and the client go by. Pure JS: no DOM, no three.js,
// no Node modules, so the same file runs in the browser and on the server.

export const PROTOCOL_VERSION = 5; // v4: chopping trees; v5: farms with helpers

export const TICK_RATE = 20; // room ticks (and snapshots) per second
export const TICK_DT = 1 / TICK_RATE;
export const INTERP_DELAY = 0.1; // seconds remote players are drawn in the past

// A full day on the game clock lasts this many real seconds (src/daynight.js
// draws it; a farm with helpers keeps its clock on the server)
export const DAY_LENGTH_SECONDS = 360;

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
};
export const CLOSE_TEXT = {
  [CLOSE.NO_GAME]: 'That lobby does not exist (any more).',
  [CLOSE.FULL]: 'That lobby is full.',
  [CLOSE.VERSION]: 'The server runs a newer version of the game. Reload the page.',
  [CLOSE.ENDED]: 'The lobby was closed.',
  [CLOSE.REPLACED]: 'You joined this lobby from another tab.',
  [CLOSE.NOT_HELPER]: 'You are not on that farm\'s helpers any more.',
};
