// The leaderboards of the lobbies' party games (shared/minigame.js): for every
// game (LOBBY_GAMES in shared/arenas.js), each farmer's best score, how many
// times they won and how many they played, by account (its farm's id, with
// the name it had last). Every game's score is better the higher it is
// (coins, points, seconds on the hill or still up, seconds to spare, grams).
// The board goes by the best score; level ones by wins, then by who got
// there first.
//
// Given a store (server/store.js), kept in data/leaderboards.json: written a
// moment after a game ends (and by flush(), when the server stops), read when
// it starts.
import { LOBBY_GAMES } from '../shared/arenas.js';

const SAVE_EVERY = 2000;
export const BOARD_SIZE = 10;

export class Leaderboards {
  constructor({ store = null, log = console.log } = {}) {
    this.store = store;
    this.log = log;
    this.boards = new Map(Object.keys(LOBBY_GAMES).map((kind) => [kind, new Map()])); // kind -> farm id -> { name, best, at, wins, played }
    this.changed = false;
    if (store) {
      this.restore(store.load());
      setInterval(() => this.save(), SAVE_EVERY).unref();
    }
  }

  // A game of `kind` is over. results: [{ id, farm, name, score, won }] (id:
  // the player's in the lobby; farm: their account's). Returns [[id, rank]]
  // for those who beat their best (rank: their place on the board now).
  record(kind, results, now = Date.now()) {
    const board = this.boards.get(kind);
    if (!board) return [];
    const better = [];
    for (const { id, farm, name, score, won } of results) {
      if (!farm) continue;
      const me = board.get(farm) ?? { name, best: 0, at: 0, wins: 0, played: 0 };
      me.name = name;
      me.played++;
      if (won) me.wins++;
      if (score > me.best) {
        Object.assign(me, { best: score, at: now });
        better.push([id, farm]);
      }
      board.set(farm, me);
    }
    this.changed = true;
    const ranked = this.ranked(kind);
    return better.map(([id, farm]) => [id, ranked.findIndex(([f]) => f === farm) + 1]);
  }

  // [[farm id, entry], ...] best first (only those with a score or a win)
  ranked(kind) {
    return [...(this.boards.get(kind) ?? [])]
      .filter(([, e]) => e.best > 0 || e.wins > 0)
      .sort(([, a], [, b]) => b.best - a.best || b.wins - a.wins || a.at - b.at);
  }

  // Every game's top `n`: { kind: [{ rank, name, best, wins, played }] }, and,
  // for farmer `name` (if given), where they are on each: you: { kind: entry }
  list(n = BOARD_SIZE, name = '') {
    const games = {};
    const you = {};
    const key = name.toLowerCase();
    for (const kind of this.boards.keys()) {
      const ranked = this.ranked(kind).map(([, { name: who, best, wins, played }], i) => ({ rank: i + 1, name: who, best, wins, played }));
      games[kind] = ranked.slice(0, n);
      const mine = key && ranked.find((e) => e.name.toLowerCase() === key);
      if (mine) you[kind] = mine;
    }
    return { games, ...(key && { you }) };
  }

  // ---------- Keeping them ----------
  save(force = false) {
    if (!this.store || (!this.changed && !force)) return;
    const boards = {};
    for (const [kind, board] of this.boards) boards[kind] = [...board].map(([farm, e]) => [farm, e.name, e.best, e.at, e.wins, e.played]);
    if (this.store.save({ boards })) this.changed = false;
  }

  flush() {
    this.save(true);
  }

  restore(data) {
    const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    for (const [kind, rows] of Object.entries(data?.boards ?? {})) {
      const board = this.boards.get(kind);
      if (!board || !Array.isArray(rows)) continue; // (a game there is no more)
      for (const [farm, name, best, at, wins, played] of rows) {
        if (typeof farm === 'string' && typeof name === 'string') board.set(farm, { name, best: n(best), at: n(at), wins: n(wins), played: n(played) });
      }
    }
    this.changed = false;
  }
}
