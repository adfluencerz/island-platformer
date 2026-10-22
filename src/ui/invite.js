// A friend's invitation to a lobby (server/presence.js), the moment it comes:
// a card at the top of the screen, over everything (the menu too), with Join
// and Decline and a bar running out for the time left to answer. A yes waits
// there until the lobby opens (or the friend calls it off).
import { el, button, hexColor } from './dom.js';
import './invite.css';

export class InvitePopups {
  // onAnswer(party, yes)
  constructor({ onAnswer }) {
    this.onAnswer = onAnswer;
    this.root = el('div', 'ui-invites', document.body);
    this.cards = new Map(); // party -> { card, text, buttons, timer, from, late }
  }

  // { party, from, color, ms, late }
  show({ party, from, color, ms, late }) {
    this.remove(party);
    const card = el('div', 'ui-invite-pop inv-frame', this.root);
    const text = el('div', 'ui-invite-pop-text', card);
    const dot = el('span', 'ui-dot', text);
    dot.style.background = hexColor(color ?? 0xffffff);
    el('b', '', text, from);
    el('span', '', text, late ? ' invites you to their lobby!' : ' is starting a lobby and invites you!');
    const buttons = el('div', 'ui-row', card);
    const entry = { card, text, buttons, from, late, timer: 0 };
    button('ui-btn', buttons, 'Join', () => this.answer(party, true));
    button('ui-btn ui-btn-ghost', buttons, 'Decline', () => this.answer(party, false));
    const bar = el('div', 'ui-invite-pop-bar', el('div', 'ui-invite-pop-time', card));
    bar.style.transitionDuration = `${ms}ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = '0%'))); // (runs out over ms)
    entry.bar = bar;
    entry.timer = setTimeout(() => this.remove(party), ms + 500); // (the server says so too: gone())
    this.cards.set(party, entry);
  }

  answer(party, yes) {
    const entry = this.cards.get(party);
    if (!entry) return;
    this.onAnswer(party, yes);
    if (!yes) return this.remove(party);
    clearTimeout(entry.timer);
    entry.buttons.remove();
    entry.bar.parentNode.remove();
    entry.text.textContent = entry.late ? `Joining ${entry.from}'s lobby…` : `Going to ${entry.from}'s lobby when it opens…`;
    entry.timer = setTimeout(() => this.remove(party), 40_000); // (in case nothing more is heard)
  }

  // that invitation is over for us (it lapsed, or another tab answered)
  gone(party) {
    this.remove(party);
  }

  // the party was called off: say why, a moment
  calledOff(party, why) {
    const entry = this.cards.get(party);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.buttons.remove();
    entry.bar.parentNode?.remove();
    entry.text.textContent = why;
    entry.timer = setTimeout(() => this.remove(party), 4000);
  }

  remove(party) {
    const entry = this.cards.get(party);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.card.remove();
    this.cards.delete(party);
  }
}
