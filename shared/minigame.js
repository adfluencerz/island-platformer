// A lobby's party games (shared/room.js keeps one Party). One at a time:
//
//   gathering  someone pressed E at the signpost (shared/arenas.js signFor):
//              everyone in the lobby hears, and has MINIGAMES.gatherMs to join
//   ready      whoever joined is in the arena, grown from the game's seed
//              (shared/arenas.js), at their start, for readyMs: a look about
//   playing    the game, for its time (GAMES); coin rush: walking into a
//              coin (GAME_COIN) scores it, checked against where the room
//              last heard the player was, the way a lobby's spots are;
//              king of the hill: every tick a player's feet are up on the
//              hill's crown (where the room last heard they were) counts,
//              a point a second (GAME_SCORE, with who is up there now)
//   over       the scores to everyone, the prize to the winner (and a few
//              coins to everyone else who played), and all of them back in
//              the lobby, where they arrive. The next game can start
//              cooldownMs later.
//
// A player in the game has p.game (its id; 0 in the lobby): the room keeps
// them out of the lobby's own doings while they are away, and pages only
// draw the players where they are (the roster says). Whoever leaves the game
// (or the lobby) is out of it; once nobody is left in it, it is called off.
// A game isn't kept when the lobby is saved: a restart calls it off.
import { S } from './protocol.js';
import { GAMES, arenaFor, arenaSeed, signFor, SIGN_REACH } from './arenas.js';
import { GROUND_STAND_Y } from './level.js';
import { MINIGAMES } from './balance.js';

const COIN_REACH = 1.8; // the page picks a coin up within 0.6; the slack covers a position up to ~150 ms old
const round2 = (v) => Math.round(v * 100) / 100;

// One of loot ([item, weight, min, max], ...) by weight: [item, count]
function pick(loot, rand) {
  let r = rand() * loot.reduce((sum, [, w]) => sum + w, 0);
  for (const [item, w, min, max] of loot) {
    r -= w;
    if (r < 0) return [item, min + Math.floor(rand() * (max - min + 1))];
  }
  const [item, , min] = loot[loot.length - 1];
  return [item, min];
}

// What a game's players get: [[id, [[item, count], ...]], ...] (winner: 0, nobody)
export function prizesFor(ids, winner, rand = Math.random) {
  const { coins, perPlayer, loot, played: [lo, hi] } = MINIGAMES.prize;
  return ids.map((id) => {
    if (id !== winner) return [id, [['coin', lo + Math.floor(rand() * (hi - lo + 1))]]];
    const [item, count] = pick(loot, rand);
    return [id, [['coin', coins + perPlayer * (ids.length - 1)], [item, count]]];
  });
}

export class Party {
  // room: the lobby's Room (its players, island, rand, say and broadcast)
  constructor(room) {
    this.room = room;
    this.sign = signFor(room.island);
    this.game = null; // { id, kind, seed, arena, phase, until, players: Map id -> { score, at, held }, taken: Set of coin ids, top: ids on the crown, last }
    this.count = 0; // games so far (each one's id)
    this.nextAt = 0; // when the next one can start (ms)
  }

  // The game as pages hear of it (null: none). until is sent as `ms`, how long
  // the phase has left, so pages need not agree with the room on the time.
  wire(now = Date.now()) {
    const g = this.game;
    if (!g) return null;
    return {
      id: g.id, kind: g.kind, seed: g.seed, phase: g.phase, ms: Math.max(0, g.until - now),
      players: [...g.players].map(([id, { score }]) => [id, score]),
      taken: [...g.taken],
      top: g.top,
    };
  }

  tell(now = Date.now()) {
    this.room.broadcast({ t: S.GAME, game: this.wire(now) });
  }

  // ---------- What players do ----------
  // E at the signpost: a game of this kind starts gathering, with p in it.
  // Returns why not ('' : it did).
  start(p, kind, now = Date.now()) {
    if (!Object.hasOwn(GAMES, kind)) return 'There is no such game.';
    if (this.game) return 'A game is on already.';
    if (now < this.nextAt) return 'The next game can start in a few seconds.';
    if (Math.hypot(p.x - this.sign.x, p.z - this.sign.z) > SIGN_REACH + 0.6 || Math.abs(p.y - 0.8) > 1.5) return 'Start a game at the signpost.';
    const seed = arenaSeed(this.room.rand);
    this.game = {
      id: ++this.count, kind, seed, arena: arenaFor(kind, seed), phase: 'gathering', until: now + MINIGAMES.gatherMs,
      players: new Map(), taken: new Set(), top: [], last: 0,
    };
    this.game.players.set(p.id, { score: 0, at: 0, held: 0 });
    this.room.say(`${p.name} is starting a ${GAMES[kind].name.toLowerCase()}! Join at the signpost in the stone circle (${Math.round(MINIGAMES.gatherMs / 1000)} s).`);
    this.tell(now);
    return '';
  }

  join(p, now = Date.now()) {
    const g = this.game;
    if (!g || g.phase !== 'gathering' || g.players.has(p.id)) return;
    g.players.set(p.id, { score: 0, at: 0, held: 0 });
    this.tell(now);
  }

  // p is out of the game: not coming after all, back to the lobby from the
  // arena, or gone from the lobby (gone: no need to put them back)
  leave(p, { gone = false, now = Date.now() } = {}) {
    const g = this.game;
    if (!g?.players.has(p.id)) return;
    g.players.delete(p.id);
    g.top = g.top.filter((id) => id !== p.id);
    if (p.game) {
      p.game = 0;
      this.room.rosterDirty = true;
      if (!gone) Object.assign(p, this.room.spawnFor(p.id)); // (where they arrive: their page puts them there too)
    }
    if (!g.players.size) {
      this.game = null;
      this.nextAt = now + MINIGAMES.cooldownMs;
      if (g.phase !== 'gathering') this.room.say(`The ${GAMES[g.kind].name.toLowerCase()} was called off: everyone headed back.`);
      else this.room.say(`The ${GAMES[g.kind].name.toLowerCase()} was called off.`);
    }
    this.tell(now);
  }

  // Coin rush: p walked into coin id
  coin(p, id, now = Date.now()) {
    const g = this.game;
    const coin = g?.kind === 'coin_rush' && Number.isInteger(id) ? g.arena.coins[id] : null;
    const me = g?.players.get(p.id);
    if (!coin || !me || g.phase !== 'playing' || p.game !== g.id || g.taken.has(id)) return;
    const [x, y, z] = coin;
    if (Math.hypot(x - p.x, y - p.y, z - p.z) > COIN_REACH) return;
    g.taken.add(id);
    me.score++;
    me.at = now;
    this.room.broadcast({ t: S.GAME_COIN, id, by: p.id, score: me.score });
  }

  // King of the hill: the time everyone up on the crown has held it (ms
  // since the last tick, a few at most, so a stall gives nobody a lot)
  holdHill(g, now) {
    const dt = g.last ? Math.min(now - g.last, 250) : 0;
    g.last = now;
    const top = [];
    let changed = false;
    for (const [id, me] of g.players) {
      const p = this.room.players.get(id);
      if (!p || p.game !== g.id || !g.arena.onCrown(p.x, p.y - GROUND_STAND_Y, p.z)) continue;
      top.push(id);
      me.held += dt;
      const score = Math.floor(me.held / 1000);
      if (score !== me.score) {
        me.score = score;
        me.at = now;
        changed = true;
      }
    }
    if (!changed && top.length === g.top.length && top.every((id, i) => id === g.top[i])) return;
    g.top = top;
    this.room.broadcast({ t: S.GAME_SCORE, scores: [...g.players].map(([id, { score }]) => [id, score]), top });
  }

  // ---------- Every tick ----------
  tick(now) {
    const g = this.game;
    if (g?.phase === 'playing' && g.kind === 'king_of_hill') this.holdHill(g, now);
    if (!g || now < g.until) {
      // coin rush: over as soon as every coin is picked up
      if (g?.phase === 'playing' && g.kind === 'coin_rush' && g.taken.size >= g.arena.coins.length) this.end(now);
      return;
    }
    if (g.phase === 'gathering') {
      // Off to the arena, each to a start of their own
      g.phase = 'ready';
      g.until = now + MINIGAMES.readyMs;
      const ids = [...g.players.keys()];
      ids.forEach((id, i) => {
        const p = this.room.players.get(id);
        Object.assign(p, g.arena.start(i, ids.length), { game: g.id });
      });
      this.room.rosterDirty = true;
      this.room.say(`The ${GAMES[g.kind].name.toLowerCase()} is on: ${ids.map((id) => this.room.players.get(id).name).join(', ')}.`);
      this.tell(now);
    } else if (g.phase === 'ready') {
      g.phase = 'playing';
      g.until = now + GAMES[g.kind].ms;
      this.tell(now);
    } else {
      this.end(now);
    }
  }

  // It is over: the winner (the most, and of those whoever got there first),
  // the prizes, and everyone back in the lobby
  end(now) {
    const g = this.game;
    this.game = null;
    this.nextAt = now + MINIGAMES.cooldownMs;
    const scores = [...g.players].sort(([, a], [, b]) => b.score - a.score || a.at - b.at);
    const [best] = scores;
    const winner = best && best[1].score > 0 ? best[0] : 0;
    const ids = scores.map(([id]) => id);
    const prizes = prizesFor(ids, winner, this.room.rand);
    const pos = [];
    for (const id of ids) {
      const p = this.room.players.get(id);
      p.game = 0;
      const at = this.room.spawnFor(id);
      Object.assign(p, at);
      pos.push([id, round2(at.x), round2(at.y), round2(at.z)]);
    }
    this.room.rosterDirty = true;
    this.room.broadcast({
      t: S.GAME_END, game: g.kind, seed: g.seed, winner, prizes, pos,
      scores: scores.map(([id, { score }]) => [id, score]),
    });
    const { name, scored, nobody } = GAMES[g.kind];
    const won = this.room.players.get(winner);
    this.room.say(won ? `${won.name} won the ${name.toLowerCase()} with ${scored(best[1].score)}!` : `The ${name.toLowerCase()} is over: ${nobody}.`);
    this.tell(now);
  }
}
