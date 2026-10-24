// A lobby's party game (shared/room.js keeps one Party). Whoever opens a
// lobby picks its game (LOBBY_GAMES in shared/arenas.js), and the lobby plays
// that one game, with everyone in it:
//
//   gathering  the lobby is open: everyone who gets there is in the game. It
//              starts MINIGAMES.gatherMs after the first farmer arrives
//   ready      everyone is in the arena, grown from the game's seed
//              (shared/arenas.js), at their start, for readyMs: a look about
//              (a loot run: back in the lobby's stone circle, where it starts)
//   playing    the game, for its time (LOBBY_GAMES); a loot run: every spot
//              emptied on the lobby's island scores (rare finds more: the
//              room's TAKE, shared/room.js); farmers may still drop in, and
//              play from then on. It is over early once the island is
//              picked clean;
//              coin rush: walking into a
//              coin (GAME_COIN) scores it, checked against where the room
//              last heard the player was, the way a lobby's spots are;
//              king of the hill: every tick a player's feet are up on the
//              hill's crown (where the room last heard they were) counts,
//              a point a second (GAME_SCORE, with who is up there now);
//              last one standing: the tiles drop on the arena's schedule,
//              and whoever the room hears has fallen in (or is on the islet
//              where fallen farmers wash up) is out, scoring the seconds they
//              lasted (GAME_SCORE, with who is still up). It is over once
//              one is left (or none);
//              hop race: whoever the room hears is on the goal has made it,
//              scoring the seconds left (GAME_SCORE, with who has made it,
//              in order); it is over once everyone has;
//              fishing contest: every fish landed off the arena's shore
//              scores its weight (the room's CAST and REEL, shared/room.js)
//   over       the scores to everyone, the prize to the winner (and a few
//              coins to everyone else who played), and all of them back on
//              the lobby's island, from where their pages take them home.
//              The lobby is over: it takes nobody new (server/lobby.js
//              closes it).
//
// A player in an arena has p.game (its id; 0 in the lobby): the room keeps
// them out of the lobby's own doings while they are away, and pages only
// draw the players where they are (the roster says). Whoever leaves the lobby
// is out of the game; once nobody is left in it, it is called off (and the
// lobby is over; before it starts, it waits for whoever comes next). Once an
// arena game is under way, nobody new gets in.
// A game isn't kept when the lobby is saved: a restart starts it over.
import { S } from './protocol.js';
import { LOBBY_GAMES as GAMES, arenaFor, arenaSeed } from './arenas.js';
import { GROUND_STAND_Y } from './level.js';
import { MINIGAMES } from './balance.js';
import { boardFor } from './fishing.js';
import { STONE_CIRCLE } from './worldgen.js';

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

// What a game's players get: [[id, [[item, count], ...]], ...] (winners: ids, [] for nobody)
export function prizesFor(ids, winners, rand = Math.random) {
  const { coins, perPlayer, loot, played: [lo, hi] } = MINIGAMES.prize;
  return ids.map((id) => {
    if (!winners.includes(id)) return [id, [['coin', lo + Math.floor(rand() * (hi - lo + 1))]]];
    const [item, count] = pick(loot, rand);
    return [id, [['coin', coins + perPlayer * (ids.length - 1)], [item, count]]];
  });
}

export class Party {
  // room: the lobby's Room (its players, island, rand, say and broadcast; its
  // game: the kind it was opened for, null for none)
  constructor(room) {
    this.room = room;
    // the board of the biggest catches by the pond: clear of the trees,
    // rocks and spots, and out of the stone circle
    const { island, wilds, spots } = room;
    const sites = [...wilds.trees, ...wilds.rocks].flatMap((w) => w.sites);
    this.board = boardFor(island, (x, z) =>
      Math.hypot(x - island.spawn.x, z - island.spawn.z) < STONE_CIRCLE + 1.5 ||
      sites.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 1.7) || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.3) ||
      island.terraces.some(([tx, tz, w, d]) => Math.abs(x - tx) < w / 2 + 0.9 && Math.abs(z - tz) < d / 2 + 0.9));
    this.game = null; // { id, kind, seed, arena, phase, until, players: Map id -> { score, at, held, out }, taken: Set of coin ids, top: ids on the crown (still up; across the hop race, in order), last }
    this.count = 0; // games so far (each one's id)
    this.over = false; // the lobby's game is over (or was called off): nobody new comes in
    this.overAt = 0; // ...since when (ms)
    if (room.game) this.open(room.game);
  }

  // The game as pages hear of it (null: none). until is sent as `ms`, how long
  // the phase has left, so pages need not agree with the room on the time
  // (gathering, before anyone is there: ms -1).
  wire(now = Date.now()) {
    const g = this.game;
    if (!g) return null;
    return {
      id: g.id, kind: g.kind, seed: g.seed, phase: g.phase, ms: Number.isFinite(g.until) ? Math.max(0, g.until - now) : -1,
      players: [...g.players].map(([id, { score }]) => [id, score]),
      taken: [...g.taken],
      top: g.top,
    };
  }

  tell(now = Date.now()) {
    this.room.broadcast({ t: S.GAME, game: this.wire(now) });
  }

  // ---------- The lobby's game ----------
  // The lobby opens for a game of this kind (LOBBY_GAMES): it gathers till
  // gatherMs after the first farmer gets there (arrive)
  open(kind) {
    const seed = arenaSeed(this.room.rand);
    this.game = {
      id: ++this.count, kind, seed, arena: arenaFor(kind, seed), phase: 'gathering', until: Infinity,
      players: new Map(), taken: new Set(), top: [], last: 0,
    };
  }

  // p is here (new, or back): in the game, if it can still be joined. (Their
  // page hears the game in its WELCOME; the room tells everyone else.)
  arrive(p, now = Date.now()) {
    const g = this.game;
    if (!g || g.players.has(p.id) || !this.joinable()) return;
    g.players.set(p.id, { score: 0, at: 0, held: 0, out: 0 });
    if (g.phase === 'gathering' && !Number.isFinite(g.until)) {
      g.until = now + MINIGAMES.gatherMs;
      this.room.say(`${GAMES[g.kind].name} starts in ${Math.round(MINIGAMES.gatherMs / 1000)} s: ${GAMES[g.kind].blurb.toLowerCase()}.`);
    }
  }

  // Whether someone new can come into the lobby: not once it is over, nor
  // once an arena game is under way (a loot run they can drop in on)
  joinable() {
    if (this.over) return false;
    const g = this.game;
    return !g || g.phase === 'gathering' || g.kind === 'loot_run';
  }

  // Whether p can empty the lobby's spots now: not in a loot run that hasn't
  // started (nor, its lobby, once it is over)
  canLoot() {
    const g = this.game;
    if (this.room.game !== 'loot_run') return true;
    return g?.kind === 'loot_run' && g.phase === 'playing';
  }

  // p is out of the game: gone from the lobby
  leave(p, now = Date.now()) {
    const g = this.game;
    if (!g?.players.has(p.id)) return;
    g.players.delete(p.id);
    g.top = g.top.filter((id) => id !== p.id);
    p.line = null; // (a line out in the arena, or for the contest, comes in)
    p.game = 0;
    if (!g.players.size && g.phase === 'gathering') {
      this.open(g.kind); // (nobody waiting: it waits for whoever comes next)
    } else if (!g.players.size) {
      this.game = null;
      this.over = true;
      this.overAt = now;
      this.room.say(`The ${GAMES[g.kind].name.toLowerCase()} was called off: everyone headed home.`);
    }
    this.tell(now);
  }

  // Loot run: p emptied a spot, with `rares` rare finds in it
  looted(p, rares, now = Date.now()) {
    const g = this.game;
    const me = g?.kind === 'loot_run' && g.phase === 'playing' ? g.players.get(p.id) : null;
    if (!me) return;
    const { find, rare } = MINIGAMES.loot_run;
    me.score += find + rare * rares;
    me.at = now;
    this.room.broadcast({ t: S.GAME_SCORE, by: p.id, score: me.score });
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

  // Last one standing: who has fallen in since the last tick (their feet
  // well under the tiles, or washed up on the islet); over once one is left
  standOrFall(g, now) {
    const lasted = Math.floor((now - (g.until - GAMES[g.kind].ms)) / 1000);
    const fell = g.top.filter((id) => {
      const p = this.room.players.get(id);
      return p?.game === g.id && (p.y - GROUND_STAND_Y < -1.2 || g.arena.isLand(p.x, p.z));
    });
    for (const id of fell) Object.assign(g.players.get(id), { out: now, score: lasted, at: -now });
    if (fell.length) {
      g.top = g.top.filter((id) => !fell.includes(id));
      this.room.broadcast({ t: S.GAME_SCORE, scores: [...g.players].map(([id, { score }]) => [id, score]), top: g.top });
    }
    if (!g.top.length || (g.players.size > 1 && g.top.length < 2)) this.end(now);
  }

  // Hop race: who has got to the goal since the last tick (in `top`, in the
  // order they got there); over once everyone has
  reachGoal(g, now) {
    const left = Math.max(1, Math.ceil((g.until - now) / 1000));
    const there = [...g.players.keys()].filter((id) => {
      const p = this.room.players.get(id);
      return !g.top.includes(id) && p?.game === g.id && g.arena.onGoal(p.x, p.y - GROUND_STAND_Y, p.z);
    });
    if (!there.length) return;
    for (const id of there) {
      Object.assign(g.players.get(id), { score: left, at: now });
      g.top.push(id);
      const place = ['first', 'second', 'third'][g.top.length - 1] ?? `number ${g.top.length}`;
      this.room.say(`${this.room.players.get(id).name} made it across, ${place}!`);
    }
    this.room.broadcast({ t: S.GAME_SCORE, scores: [...g.players].map(([id, { score }]) => [id, score]), top: g.top });
    if (g.top.length >= g.players.size) this.end(now);
  }

  // Fishing contest: the game p is fishing in (null: none, or not now)
  fishingFor(p) {
    const g = this.game;
    return g?.kind === 'fishing_contest' && g.phase === 'playing' && p.game === g.id && g.players.has(p.id) ? g : null;
  }

  // Fishing contest: p landed a fish of `grams`
  landed(p, grams, now = Date.now()) {
    const me = this.fishingFor(p) && this.game.players.get(p.id);
    if (!me || !(grams > 0)) return;
    me.score += Math.round(grams);
    me.at = now;
    this.room.broadcast({ t: S.GAME_SCORE, by: p.id, score: me.score });
  }

  // ---------- Every tick ----------
  tick(now) {
    const g = this.game;
    if (g?.phase === 'playing' && g.kind === 'king_of_hill') this.holdHill(g, now);
    if (g?.phase === 'playing' && g.kind === 'last_one') {
      this.standOrFall(g, now);
      if (!this.game) return;
    }
    if (g?.phase === 'playing' && g.kind === 'hop_race') {
      this.reachGoal(g, now);
      if (!this.game) return;
    }
    if (!g || now < g.until) {
      // coin rush: over as soon as every coin is picked up (a loot run: the island picked clean)
      if (g?.phase === 'playing' && g.kind === 'coin_rush' && g.taken.size >= g.arena.coins.length) this.end(now);
      if (g?.phase === 'playing' && g.kind === 'loot_run' && this.room.spots.every((s) => !s.item)) this.end(now);
      return;
    }
    if (g.phase === 'gathering') {
      // Off to the arena, each to a start of their own (a loot run: to the stone circle)
      g.phase = 'ready';
      g.until = now + MINIGAMES.readyMs;
      const ids = [...g.players.keys()];
      ids.forEach((id, i) => {
        const p = this.room.players.get(id);
        if (g.arena) Object.assign(p, g.arena.start(i, ids.length), { game: g.id });
        else Object.assign(p, this.room.spawnFor(id));
      });
      if (g.kind === 'last_one') g.top = ids; // (all up, to begin with)
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

  // It is over: the winner (the most, and of those whoever got there first;
  // last one standing: whoever is still up, or else fell in last, a few if
  // they are level), the prizes, and everyone back in the lobby, and on home
  end(now) {
    const g = this.game;
    this.game = null;
    this.over = true;
    this.overAt = now;
    if (g.kind === 'last_one') {
      const lasted = Math.floor((now - (g.until - GAMES[g.kind].ms)) / 1000);
      for (const id of g.top) Object.assign(g.players.get(id), { score: lasted, at: -Number.MAX_SAFE_INTEGER });
    }
    const scores = [...g.players].sort(([, a], [, b]) => b.score - a.score || a.at - b.at);
    const [best] = scores;
    let winners = best && best[1].score > 0 ? scores.filter(([, me]) => me.score === best[1].score && me.at === best[1].at).map(([id]) => id) : [];
    if (g.kind === 'last_one' && g.players.size === 1 && !g.top.length) winners = []; // (alone, and fell in)
    const winner = winners[0] ?? 0;
    const ids = scores.map(([id]) => id);
    const prizes = prizesFor(ids, winners, this.room.rand);
    // onto the leaderboards (server/leaderboards.js): who beat their best, and their place now
    const records = this.room.onGameEnd(g.kind, scores.map(([id, { score }]) => {
      const p = this.room.players.get(id);
      return { id, farm: p.farm, name: p.account ?? p.name, score, won: winners.includes(id) };
    }));
    const pos = [];
    for (const id of ids) {
      const p = this.room.players.get(id);
      p.game = 0;
      p.line = null;
      if (!g.arena) continue; // (a loot run: they are on the island already)
      const at = this.room.spawnFor(id);
      Object.assign(p, at);
      pos.push([id, round2(at.x), round2(at.y), round2(at.z)]);
    }
    this.room.rosterDirty = true;
    this.room.broadcast({
      t: S.GAME_END, game: g.kind, seed: g.seed, winner, winners, prizes, pos, records,
      scores: scores.map(([id, { score }]) => [id, score]),
    });
    const { name, scored, nobody } = GAMES[g.kind];
    const names = winners.map((id) => this.room.players.get(id)?.name ?? 'Someone');
    const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    this.room.say(who ? `${who} won the ${name.toLowerCase()} with ${scored(best[1].score)}!` : `The ${name.toLowerCase()} is over: ${nobody}.`);
    this.tell(now);
  }
}
