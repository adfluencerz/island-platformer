// A lobby's party game on screen (shared/minigame.js): a card at the top.
// While it gathers, how long until it starts and how many are in it; while it
// is on, the time left and the scores (in an arena, Head home); when it is
// over, who won and what you got, a few seconds, and then home.
import { el, button } from './dom.js';
import { LOBBY_GAMES as GAMES } from '../../shared/arenas.js';
import { weightText } from '../../shared/fishing.js';
import './party.css';

const RESULT_MS = 7000;
// A score as shown: coins picked up, seconds on the hill (GAMES' unit), in
// a fishing contest the weight landed, in a loot run points
function scoreText(kind, score) {
  if (kind === 'fishing_contest') return weightText(score);
  if (kind === 'loot_run') return `${score} pt${score === 1 ? '' : 's'}`;
  return `${score}${GAMES[kind]?.unit ?? ''}`;
}

export class PartyHud {
  // onLeave(): Head home (and once the results have been up a while). nameOf(id): a player's name.
  constructor({ onLeave, nameOf, parent = document.body }) {
    Object.assign(this, { onLeave, nameOf });
    this.root = el('div', 'ui-party inv-frame', parent);
    this.root.hidden = true;
    this.title = el('div', 'ui-party-title', this.root);
    this.line = el('div', 'ui-party-line', this.root);
    this.buttons = el('div', 'ui-row', this.root);
    this.game = null;
    this.myId = 0;
    this.endsAt = 0; // performance.now() when the phase is over
    this.resultTimer = 0;
  }

  // The game as the lobby has it (null: none), and who we are
  show(game, myId) {
    this.game = game;
    this.myId = myId;
    if (!game) {
      if (!this.resultTimer) this.root.hidden = true;
      return;
    }
    clearTimeout(this.resultTimer);
    this.resultTimer = 0;
    this.endsAt = performance.now() + game.ms;
    this.shownGame = null;
    this.root.hidden = false;
    this.root.classList.toggle('playing', game.phase !== 'gathering');
    this.buttons.textContent = '';
    // (off in an arena, the way out: home)
    if (game.phase !== 'gathering' && game.kind !== 'loot_run' && this.isIn()) button('ui-btn ui-btn-small ui-btn-ghost', this.buttons, 'Head home', () => this.onLeave());
    this.update();
  }

  isIn() {
    return !!this.game?.players.some(([id]) => id === this.myId);
  }

  // player id has score now
  score(id, score) {
    const entry = this.game?.players.find(([who]) => who === id);
    if (entry) entry[1] = score;
    this.shownGame = null;
    this.update();
  }

  // All the scores at once ([[id, score]])
  scores(list) {
    if (!this.game) return;
    this.game.players = list.map(([id, score]) => [id, score]);
    this.shownGame = null;
    this.update();
  }

  // Every frame or so: the time left
  update() {
    const g = this.game;
    if (!g) return;
    const s = Math.max(0, Math.ceil((this.endsAt - performance.now()) / 1000));
    if (s === this.shown && g === this.shownGame) return; // (nothing to change)
    this.shown = s;
    this.shownGame = g;
    const name = GAMES[g.kind]?.name ?? 'Party game';
    if (g.phase === 'gathering') {
      this.title.textContent = `${name} starts in ${s} s`;
      const n = g.players.length;
      this.line.textContent = `${n > 1 ? `${n} farmers` : 'Just you so far'} · ${GAMES[g.kind]?.blurb ?? ''}`;
      return;
    }
    const clock = g.phase === 'ready' ? 'Get ready…' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.title.textContent = `${name} · ${clock}`;
    const who = (id) => (id === this.myId ? 'You' : this.nameOf(id));
    if (g.kind === 'last_one' && g.phase === 'playing') {
      // who is still up, and how long the others lasted
      const up = g.players.filter(([id]) => g.top?.includes(id)).map(([id]) => who(id));
      const out = g.players.filter(([id]) => !g.top?.includes(id)).sort((a, b) => b[1] - a[1]).slice(0, 3);
      this.line.textContent = [`Up: ${up.join(', ') || 'nobody'}`, ...out.map(([id, score]) => `${who(id)} ${scoreText(g.kind, score)}`)].join(' · ');
      return;
    }
    if (g.kind === 'hop_race' && g.phase === 'playing') {
      // who has made it across, in order, and how many are still hopping
      const across = (g.top ?? []).filter((id) => g.players.some(([p]) => p === id)).map(who);
      const hopping = g.players.length - across.length;
      this.line.textContent = [across.length ? `Across: ${across.join(', ')}` : 'Nobody across yet', ...(hopping ? [`${hopping} still hopping`] : [])].join(' · ');
      return;
    }
    const ranked = [...g.players].sort((a, b) => b[1] - a[1]);
    const mine = ranked.find(([id]) => id === this.myId);
    const top = ranked.slice(0, 3).map(([id, score]) => `${id === this.myId ? 'You' : this.nameOf(id)} ${scoreText(g.kind, score)}`);
    if (mine && !ranked.slice(0, 3).includes(mine)) top.push(`You ${scoreText(g.kind, mine[1])}`);
    this.line.textContent = top.join(' · ');
  }

  // It is over (GAME_END): who won, and what we got ([[item, count], ...], or
  // null), and our new best's place on the leaderboard (records); a few
  // seconds, then home (onLeave)
  results({ game, winner, winners = [winner], scores, records = [] }, got, itemName) {
    this.game = null;
    this.root.hidden = false;
    this.root.classList.add('playing');
    this.buttons.textContent = '';
    const name = GAMES[game]?.name ?? 'Party game';
    const others = winners.filter((id) => id && id !== this.myId).map((id) => this.nameOf(id));
    this.title.textContent = winners.includes(this.myId)
      ? `You${others.length ? ` and ${others.join(', ')}` : ''} won the ${name.toLowerCase()}!`
      : others.length ? `${others.join(' and ')} won the ${name.toLowerCase()}` : `The ${name.toLowerCase()} is over`;
    const board = scores.slice(0, 4).map(([id, score]) => `${id === this.myId ? 'You' : this.nameOf(id)} ${scoreText(game, score)}`).join(' · ');
    const prize = got?.length ? ` · You got ${got.map(([item, count]) => `${count} ${itemName(item, count)}`).join(' and ')}` : '';
    const rank = records.find(([id]) => id === this.myId)?.[1];
    const best = rank ? ` · New best: #${rank} on the leaderboard!` : '';
    this.line.textContent = board + prize + best;
    const home = () => {
      this.hideResults();
      this.onLeave();
    };
    button('ui-btn ui-btn-small', this.buttons, 'Head home', home);
    clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(home, RESULT_MS);
  }

  hideResults() {
    clearTimeout(this.resultTimer);
    this.resultTimer = 0;
    if (!this.game) this.root.hidden = true;
  }

  clear() {
    this.game = null;
    this.hideResults();
    this.root.hidden = true;
  }
}
