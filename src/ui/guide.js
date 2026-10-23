// ---------- The first-day guide ----------
// A new farmer's first steps, one at a time, in a little card under the place
// panel: till, plant, harvest, sell at the stall, then visit a lobby. Each is
// ticked off when the game shows it done (update(), a few times a second:
// nothing else has to call in), with a chime, and a cheer at the end. Shown
// once per browser: done or skipped (✕), it is gone for good. A farmer who
// already has a farm going (gold, or a skill past level 1) never sees it.
import { el, button } from './dom.js';
import { isTouch } from './touch.js';
import { play } from '../sound.js';
import './guide.css';

const STORE = 'tp.guide';
const DONE_SHOWN_MS = 6000; // how long "All done" stays up
const CHECK_EVERY = 0.5; // seconds between looks at the game

// Each step: what to do, how (keyboard, touch), and when it's done, from what
// update() is told (s) and what it was when the step came up (from)
const STEPS = [
  {
    id: 'till',
    title: 'Till the soil',
    keys: 'Pick the hoe (1) and press E on the grass.',
    touch: 'Pick the hoe and tap Use on the grass.',
    done: (s) => s.tilled > 0 || s.planted > 0,
  },
  {
    id: 'plant',
    title: 'Plant some seeds',
    keys: 'Pick the turnip seeds and press E on the tilled soil.',
    touch: 'Pick the turnip seeds and tap Use on the tilled soil.',
    done: (s) => s.planted > 0,
  },
  {
    id: 'harvest',
    title: 'Harvest',
    keys: 'Turnips are ripe in under two minutes (hold T to hurry the day). E on a ripe one picks it.',
    touch: 'Turnips are ripe in under two minutes (hold the clock to hurry the day). Tap a ripe one to pick it.',
    done: (s, from) => s.produce > from.produce,
  },
  {
    id: 'sell',
    title: 'Sell at the stall',
    keys: 'The merchant\'s stall is just east of the plaza. E at the counter, then sell what you grew.',
    touch: 'The merchant\'s stall is just east of the plaza. Tap it, then sell what you grew.',
    done: (s, from) => s.gold > from.gold,
  },
  {
    id: 'online',
    title: 'Meet other farmers',
    keys: 'Press L (or Menu, then Play online) and visit a lobby to gather and hunt for rare finds.',
    touch: 'Tap Menu, then Play online, and visit a lobby to gather and hunt for rare finds.',
    done: (s) => s.place === 'lobby',
  },
];

function stored() {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

function store(value) {
  try {
    localStorage.setItem(STORE, value);
  } catch {}
}

export class Guide {
  // parent: where the card goes (the HUD). anchor: what it sits under (the
  // place panel).
  constructor({ parent, anchor }) {
    this.anchor = anchor;
    this.over = !!stored(); // (done or skipped before, in this browser)
    this.step = -1; // the step showing (-1: not started)
    this.from = null; // the game as it was when this step came up
    this.wait = 0;

    this.card = el('div', 'ui-guide inv-frame', parent);
    this.card.hidden = true;
    const head = el('div', 'ui-guide-head', this.card);
    this.count = el('span', 'ui-guide-count', head);
    button('ui-btn ui-btn-small ui-btn-ghost ui-guide-skip', head, '✕', () => this.finish('skipped')).title = 'Skip the guide';
    this.title = el('b', 'ui-guide-title', this.card);
    this.how = el('div', 'ui-guide-how', this.card);
  }

  // A few times a second, with how the game is now: { place ('home', 'lobby',
  // 'farm', 'title'), tilled, planted (on the home farm), produce (crops in
  // the backpack), gold, seasoned (a farm already going) }
  update(dt, s) {
    if (this.over) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = CHECK_EVERY;
    if (this.step < 0) {
      if (s.place !== 'home') return; // (starts on the farm)
      if (s.seasoned) return this.finish('seasoned');
      this.show(0, s);
    }
    // tick off the steps done (a few at once, if they are)
    let ticked = false;
    while (this.step < STEPS.length && STEPS[this.step].done(s, this.from)) {
      ticked = true;
      if (this.step === STEPS.length - 1) return this.finish('done');
      this.show(this.step + 1, s);
    }
    if (ticked) play('pickup');
    this.card.hidden = s.place !== 'home';
    if (!this.card.hidden) this.place();
  }

  show(i, s) {
    this.step = i;
    this.from = { ...s };
    const step = STEPS[i];
    this.count.textContent = `First day · ${i + 1} of ${STEPS.length}`;
    this.title.textContent = step.title;
    this.how.textContent = isTouch() ? step.touch : step.keys;
    this.card.classList.remove('ticked');
    void this.card.offsetWidth; // (restart the pop)
    if (i > 0) this.card.classList.add('ticked');
  }

  // Under the place panel, however tall that is right now
  place() {
    const r = this.anchor.getBoundingClientRect();
    if (r.height) this.card.style.top = `${Math.round(r.bottom + 8)}px`;
  }

  // done: all the steps; skipped: ✕; seasoned: not a new farmer
  finish(why) {
    this.over = true;
    store(why);
    if (why !== 'done') {
      this.card.remove();
      return;
    }
    play('cheer');
    this.card.hidden = false;
    this.place();
    this.count.textContent = 'First day';
    this.title.textContent = 'All done!';
    this.how.textContent = 'That\'s the way of it. Have fun farming!';
    this.card.querySelector('.ui-guide-skip')?.remove();
    setTimeout(() => this.card.remove(), DONE_SHOWN_MS);
  }
}
