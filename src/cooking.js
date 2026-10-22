import './workbench.css';
import './cooking.css';
import { ITEMS, spriteURL } from './items.js';
import { el, button } from './ui/dom.js';
import { DISHES, CAMPFIRE_HOURS, CAMPFIRE_MOST, KITCHEN_MOST, BOOSTS, BOOST_SECONDS, ANY } from '../shared/balance.js';

// ---------- Cooking ----------
// Two places to cook (DISHES, shared/balance.js), one window:
// - a campfire built on the farm: pick a dish (up to CAMPFIRE_MOST of it),
//   what it needs comes out of the backpack, and an hour (CAMPFIRE_HOURS)
//   later it is ready to collect from the fire (main.js keeps the fire's
//   timer, shared/machines.js);
// - the kitchen in the house: the recipe book, cooked straight away from
//   what is in the backpack. The recipes not in the book yet show greyed,
//   with where they are to be had.
// What can be cooked now comes first. A need of 'any_fish' takes the
// cheapest fish there are (ANY). Eating a dish (E with it in hand: main.js)
// gives a boost for a while.
//
//   Cook          cook one
//   ×n            cook as many as there is for (up to the most at once)
//   E / Esc / ×   close

export const BOOST_NAMES = { quick: 'Quick feet', strong: 'Strong arms', bouncy: 'Bouncy', lucky: 'Lucky rod' };
const LEARN_WHERE = {
  shop: 'Not in your recipe book yet: the merchant sells it',
  find: 'Not in your recipe book yet: found on old recipe cards in the lobbies',
};

// What a dish's boost is, in a few words ("Quick feet, 4 min")
export function boostText(dish) {
  const d = DISHES[dish];
  const minutes = Math.round(BOOST_SECONDS[d.cook] / 60);
  return `${d.boost.map((b) => BOOST_NAMES[b]).join(' + ')}${d.cook === 'kitchen' ? ' (strong)' : ''}, ${minutes} min${d.shared ? ', for the whole farm' : ''}`;
}

// A need's look: an item, or for a group (ANY) its first one's icon
export const needName = (id) => (ANY[id] ? 'Any fish' : ITEMS[id].name);
export const needIcon = (id) => spriteURL(ITEMS[ANY[id]?.[0] ?? id]);
// How many of a need the backpack has
export const haveOf = (inventory, id) => (ANY[id] ? ANY[id].reduce((sum, it) => sum + inventory.count(it), 0) : inventory.count(id));
// Take n of a need out of the backpack (a group's cheapest first): { item: count } taken
export function takeOf(inventory, id, n, took = {}) {
  for (const it of ANY[id] ?? [id]) {
    const k = Math.min(n, inventory.count(it));
    if (!k) continue;
    inventory.remove(it, k);
    took[it] = (took[it] ?? 0) + k;
    n -= k;
  }
  return took;
}

// inventory: from createInventory. known(dish): is it in the recipe book?
// onCampfire(key, dish, n, took): cook n of it on the campfire on tile key
// (took: what came out of the backpack). onKitchen(dish, n): cook n of it in
// the kitchen. onOpenChange(open): the game pauses input.
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

  // How many of it there is for in the backpack (up to the most at once)
  const most = () => (fire ? CAMPFIRE_MOST : KITCHEN_MOST);
  const howMany = (dish) => Math.min(most(), ...Object.entries(DISHES[dish].needs).map(([id, n]) => Math.floor(haveOf(inventory, id) / n)));

  // Why n of this can't be cooked right now ('': it can)
  function problem(dish, n = 1) {
    if (!fire && !known(dish)) return LEARN_WHERE[DISHES[dish].learn] ?? 'Not in your recipe book yet';
    for (const [id, k] of Object.entries(DISHES[dish].needs)) {
      if (haveOf(inventory, id) < k * n) return `Not enough ${needName(id).toLowerCase()}`;
    }
    if (!fire && !inventory.canAdd(dish, n)) return 'No room in the backpack';
    return '';
  }
  // (what can be cooked first, then what is short of something, then what isn't in the book)
  const rank = (dish) => (!fire && !known(dish) ? 2 : problem(dish) ? 1 : 0);

  function render() {
    tabEl.textContent = fire ? 'Campfire' : 'Kitchen';
    noteEl.textContent = fire
      ? `Pick something to cook: it is ready ${CAMPFIRE_HOURS === 1 ? 'an hour' : `${CAMPFIRE_HOURS} hours`} later, to collect from the fire. Eat a dish (E with it in hand) for a little boost.`
      : 'Your recipe book: cook straight away from what is in your backpack. Kitchen dishes give the stronger boosts.';
    listEl.textContent = '';
    for (const dish of dishes().sort((a, b) => rank(a) - rank(b))) {
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
        const have = haveOf(inventory, id);
        const need = el('span', 'bench-need' + (have < n ? ' short' : ''), needs);
        el('img', 'inv-icon', need).src = needIcon(id);
        need.title = needName(id);
        need.append(`${n} (${have})`);
      }
      const why = problem(dish);
      const buttons = el('div', 'cook-buttons', row);
      const cook = button('ui-btn bench-make', buttons, 'Cook', () => cookIt(dish, 1));
      cook.disabled = !!why;
      const many = !why && howMany(dish);
      if (many > 1 && !problem(dish, many)) {
        const more = button('ui-btn bench-make cook-more', buttons, `×${many}`, () => cookIt(dish, many));
        more.title = `Cook ${many} at once`;
      }
      if (why) {
        cook.title = why;
        el('div', 'bench-why', text, why);
      }
    }
    const all = dishes();
    countEl.textContent = fire ? '' : `Recipe book: ${all.filter(known).length} of ${all.length}`;
  }

  function cookIt(dish, n) {
    if (problem(dish, n)) return;
    const took = {};
    for (const [id, k] of Object.entries(DISHES[dish].needs)) takeOf(inventory, id, k * n, took);
    if (fire) {
      onCampfire(fire, dish, n, took);
      setOpen(false); // (it is on the fire now)
    } else {
      onKitchen(dish, n);
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
