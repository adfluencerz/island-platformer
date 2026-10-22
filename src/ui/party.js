// A lobby's party game on screen (shared/minigame.js): a card at the top.
// At the signpost with no game on, which game to start; while it gathers, how long until it starts and who is in, with Join (or Not
// coming); while it is on, the time left and the scores; when it is over, who
// won and what you got, a few seconds.
import { el, button } from './dom.js';
import { GAMES } from '../../shared/arenas.js';
import './party.css';

const RESULT_MS = 7000;

export class PartyHud {
  // onJoin(), onLeave(): the buttons. nameOf(id): a player's name.
  constructor({ onJoin, onLeave, nameOf }) {
    Object.assign(this, { onJoin, onLeave, nameOf });
    this.root = el('div', 'ui-party inv-frame', document.body);
    this.root.hidden = true;
    this.title = el('div', 'ui-party-title', this.root);
    this.line = el('div', 'ui-party-line', this.root);
    this.buttons = el('div', 'ui-row', this.root);
    this.game = null;
    this.myId = 0;
    this.endsAt = 0; // performance.now() when the phase is over
    this.resultTimer = 0;
    this.choosing = false; // the games to pick from are up
  }

  // At the signpost: a button for each game (GAMES), onPick(kind)
  choose(onPick) {
    if (this.game) return;
    this.hideResults();
    this.choosing = true;
    this.root.hidden = false;
    this.root.classList.remove('playing');
    this.title.textContent = 'Party games';
    this.line.textContent = 'Which game? Whoever is in the lobby can join.';
    this.buttons.textContent = '';
    for (const [kind, { name }] of Object.entries(GAMES)) button('ui-btn ui-btn-small', this.buttons, name, () => onPick(kind));
  }

  // Walked away from the signpost (or picked)
  stopChoosing() {
    if (!this.choosing) return;
    this.choosing = false;
    if (!this.game && !this.resultTimer) this.root.hidden = true;
  }

  // The game as the lobby has it (null: none), and who we are
  show(game, myId) {
    if (game) this.choosing = false;
    else if (this.choosing) return;
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
    if (game.phase === 'gathering') {
      if (this.isIn()) button('ui-btn ui-btn-small ui-btn-ghost', this.buttons, 'Not coming', () => this.onLeave());
      else button('ui-btn ui-btn-small', this.buttons, 'Join', () => this.onJoin());
    } else if (this.isIn()) {
      button('ui-btn ui-btn-small ui-btn-ghost', this.buttons, 'Back to the lobby', () => this.onLeave());
    }
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
    const unit = GAMES[g.kind]?.unit ?? '';
    if (g.phase === 'gathering') {
      this.title.textContent = `${name} starts in ${s} s`;
      const n = g.players.length;
      this.line.textContent = `${n} joined${this.isIn() ? ' (you too)' : ''} · ${GAMES[g.kind]?.blurb ?? ''}`;
      return;
    }
    const clock = g.phase === 'ready' ? 'Get ready…' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.title.textContent = `${name} · ${clock}`;
    const ranked = [...g.players].sort((a, b) => b[1] - a[1]);
    const mine = ranked.find(([id]) => id === this.myId);
    const top = ranked.slice(0, 3).map(([id, score]) => `${id === this.myId ? 'You' : this.nameOf(id)} ${score}${unit}`);
    if (mine && !ranked.slice(0, 3).includes(mine)) top.push(`You ${mine[1]}${unit}`);
    this.line.textContent = top.join(' · ');
  }

  // It is over (GAME_END): who won, and what we got ([[item, count], ...], or null)
  results({ game, winner, scores }, got, itemName) {
    this.game = null;
    this.choosing = false;
    this.root.hidden = false;
    this.root.classList.add('playing');
    this.buttons.textContent = '';
    const name = GAMES[game]?.name ?? 'Party game';
    const unit = GAMES[game]?.unit ?? '';
    this.title.textContent = winner === this.myId ? `You won the ${name.toLowerCase()}!` : winner ? `${this.nameOf(winner)} won the ${name.toLowerCase()}` : `The ${name.toLowerCase()} is over`;
    const board = scores.slice(0, 4).map(([id, score]) => `${id === this.myId ? 'You' : this.nameOf(id)} ${score}${unit}`).join(' · ');
    const prize = got?.length ? ` · You got ${got.map(([item, count]) => `${count} ${itemName(item, count)}`).join(' and ')}` : '';
    this.line.textContent = board + prize;
    button('ui-btn ui-btn-small', this.buttons, 'OK', () => this.hideResults());
    clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => this.hideResults(), RESULT_MS);
  }

  hideResults() {
    clearTimeout(this.resultTimer);
    this.resultTimer = 0;
    if (!this.game) this.root.hidden = true;
  }

  clear() {
    this.game = null;
    this.choosing = false;
    this.hideResults();
    this.root.hidden = true;
  }
}
