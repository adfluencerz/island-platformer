import './workbench.css';
import './cooking.css';
import { ITEMS, spriteURL } from './items.js';
import { el, button } from './ui/dom.js';
import { DISHES, CAMPFIRE_HOURS, BOOSTS, BOOST_SECONDS } from '../shared/balance.js';

// ---------- Cooking ----------
// Two places to cook (DISHES, shared/balance.js), one window:
// - a campfire built on the farm: pick a dish, what it needs comes out of the
//   backpack, and an hour (CAMPFIRE_HOURS) later it is ready to collect from
//   the fire (main.js keeps the fire's timer, shared/machines.js);
// - the kitchen in the house: the recipe book, cooked straight away from
//   what is in the backpack. The recipes not in the book yet show greyed,
//   with where they are to be had.
// Eating a dish (E with it in hand: main.js) gives a boost for a while.
//
//   Cook          cook one
//   E / Esc / ×   close

export const BOOST_NAMES = { quick: 'Quick feet', strong: 'Strong arms', bouncy: 'Bouncy' };
const LEARN_WHERE = {
  shop: 'Not in your recipe book yet: the merchant sells it',
  find: 'Not in your recipe book yet: found on old recipe cards in the lobbies',
};

// What a dish's boost is, in a few words ("Quick feet, 4 min")
export function boostText(dish) {
  const d = DISHES[dish];
  const minutes = Math.round(BOOST_SECONDS[d.cook] / 60);
  return `${d.boost.map((b) => BOOST_NAMES[b]).join(' + ')}${d.cook === 'kitchen' ? ' (strong)' : ''}, ${minutes} min`;
}

// inventory: from createInventory. known(dish): is it in the recipe book?
// onCampfire(key, dish): cook it on the campfire on tile key. onKitchen(dish):
// cook it in the kitchen. onOpenChange(open): the game pauses input.
export function createCooking({ inventory, known, onCampfire, onKitchen, onOpenChange }) {
  let open = false;
  let fire = null; // the campfire's tile key, or null: the kitchen

  const menuEl = el('div', 'inv-menu bench-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame bench-window', menuEl);
  const tabEl = el('div', 'inv-tab inv-frame', windowEl);
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';
  const noteEl = el('div', 'bench-note', windowEl);
  const listEl = el('div', 'bench-list', windowEl);
  const countEl = el('div', 'cook-count', windowEl);

  const dishes = () => Object.keys(DISHES).filter((id) => DISHES[id].cook === (fire ? 'campfire' : 'kitchen'));

  // Why this can't be cooked right now ('': it can)
  function problem(dish) {
    if (!fire && !known(dish)) return LEARN_WHERE[DISHES[dish].learn] ?? 'Not in your recipe book yet';
    for (const [id, n] of Object.entries(DISHES[dish].needs)) {
      if (inventory.count(id) < n) return `Not enough ${ITEMS[id].name.toLowerCase()}`;
    }
    if (!fire && !inventory.canAdd(dish)) return 'No room in the backpack';
    return '';
  }

  function render() {
    tabEl.textContent = fire ? 'Campfire' : 'Kitchen';
    noteEl.textContent = fire
      ? `Pick something to cook: it is ready ${CAMPFIRE_HOURS === 1 ? 'an hour' : `${CAMPFIRE_HOURS} hours`} later, to collect from the fire. Eat a dish (E with it in hand) for a little boost.`
      : 'Your recipe book: cook straight away from what is in your backpack. Kitchen dishes give the stronger boosts.';
    listEl.textContent = '';
    for (const dish of dishes()) {
      const def = ITEMS[dish];
      const unknown = !fire && !known(dish);
      const row = el('div', 'bench-row cook-row' + (unknown ? ' unknown' : ''), listEl);
      const slot = el('div', 'inv-slot bench-icon', row);
      el('img', 'inv-icon', slot).src = spriteURL(def);
      const text = el('div', 'bench-text', row);
      el('b', '', text, def.name);
      el('div', 'cook-boost', text, boostText(dish));
      const needs = el('div', 'bench-needs', text);
      for (const [id, n] of Object.entries(DISHES[dish].needs)) {
        const have = inventory.count(id);
        const need = el('span', 'bench-need' + (have < n ? ' short' : ''), needs);
        el('img', 'inv-icon', need).src = spriteURL(ITEMS[id]);
        need.append(`${n} (${have})`);
      }
      const why = problem(dish);
      const cook = button('ui-btn bench-make', row, 'Cook', () => cookIt(dish));
      cook.disabled = !!why;
      if (why) {
        cook.title = why;
        el('div', 'bench-why', text, why);
      }
    }
    const all = dishes();
    countEl.textContent = fire ? '' : `Recipe book: ${all.filter(known).length} of ${all.length}`;
  }

  function cookIt(dish) {
    if (problem(dish)) return;
    for (const [id, n] of Object.entries(DISHES[dish].needs)) inventory.remove(id, n);
    if (fire) {
      onCampfire(fire, dish);
      setOpen(false); // (it is on the fire now)
    } else {
      onKitchen(dish);
      render();
    }
  }

  menuEl.addEventListener('mousedown', (e) => e.target === menuEl && setOpen(false)); // click outside the window
  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  // Capture phase, like the workbench's: while it is open it has the keyboard
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    e.stopPropagation();
    if ((e.code === 'Escape' || e.code === 'KeyE') && !e.repeat) setOpen(false);
  }, true);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menuEl.hidden = !open;
    if (open) render();
    onOpenChange?.(open);
  }

  return {
    openCampfire(key) {
      fire = key;
      setOpen(true);
    },
    openKitchen() {
      fire = null;
      setOpen(true);
    },
    close: () => setOpen(false),
    isOpen: () => open,
  };
}

// What eating `dish` does: { kinds, level (0: a campfire dish's, 1: the
// kitchen's), left (seconds) }
export function boostFrom(dish) {
  const d = DISHES[dish];
  return { kinds: [...d.boost], level: d.cook === 'kitchen' ? 1 : 0, left: BOOST_SECONDS[d.cook] };
}

// The boost's effect of `what` ('speed', 'swings' or 'jump') now (boost: from
// boostFrom, or null): a factor (speed, jump) or a count (swings)
export function boostOf(boost, what) {
  const none = what === 'swings' ? 0 : 1;
  if (!boost) return none;
  for (const kind of boost.kinds) if (BOOSTS[kind]?.[what]) return BOOSTS[kind][what][boost.level];
  return none;
}
