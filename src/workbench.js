import './workbench.css';
import { ITEMS, PIECE_ICONS, spriteURL } from './items.js';
import { el, button } from './ui/dom.js';
import { RECIPES, BENCH_LEVELS, PEN_LEVELS } from '../shared/balance.js'; // (what can be made, and from what; the upgrades)

// ---------- The workbench ----------
// Built on the farm in build mode (src/build.js), and E next to it (or a tap)
// opens this: things to make from wood and stone. The decorations go in the
// backpack, to be put down from the Build tab; the better tools take the
// place of the ones they're made from in the backpack; the sword and the
// mallet are for bopping other farmers in lobbies. All of it is the page's
// own, like the backpack, so it works on a friend's farm too. What the
// backpack is short of comes out of the farm's chest, as in build mode (the
// farmer's own farm only: a helper has no say over its chest).
//
// Up top, the farm's upgrades, bought with gold and materials: the workbench
// itself (each level makes more: a recipe's `level`, and is drawn fancier),
// the hen yard and the pasture (bigger, with room for more animals that give
// more: src/animals.js). They are the farm's, so only its farmer buys them.
//
// A tool you have, or have made better already (a sturdy axe, with a silver
// one in the backpack), isn't listed: only the next one up its line is.
//
//   Make / Upgrade   make one / buy the next level
//   E / Esc / ×      close


const isTool = (id) => ITEMS[id]?.category === 'Tool';
const pct = (chance) => `${Math.round(chance * 100)}%`;
const gold = (n) => `${n.toLocaleString()}g`;
const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '');

// The tools made from this one, and from those (a better one than it)
const betterThan = (id) => RECIPES.filter((r) => r.needs[id] && isTool(r.makes)).flatMap((r) => [r.makes, ...betterThan(r.makes)]);

// What can be upgraded: its levels (the first is where a farm starts; each
// next one's `cost`), its picture (an item's, or a piece's), and what level
// n (from 2) brings
const UPGRADES = [
  {
    id: 'workbench', name: 'Workbench', icon: 'workbench', levels: BENCH_LEVELS,
    brings: (n) => `A finer workbench, that makes the ${list(RECIPES.filter((r) => r.level === n).map((r) => ITEMS[r.makes].name.toLowerCase()))}.`,
  },
  {
    id: 'yard', name: 'Hen yard', icon: 'hen', levels: PEN_LEVELS.yard,
    brings: (n, { room, largeEgg }) => `A bigger yard and coop: room for ${room.hen} hens, and ${pct(largeEgg)} of their eggs are large ones.`,
  },
  {
    id: 'pasture', name: 'Pasture', icon: 'cow', levels: PEN_LEVELS.pasture,
    brings: (n, { room, second }) => `A bigger pasture${n > 2 ? ', with a barn' : ', with a hay rack'}: room for ${room.cow} cows and ${room.sheep} sheep, ${second >= 1 ? 'and every one gives' : `and ${pct(second)} of the time one gives`} two milk or wool.`,
  },
];

// inventory: from createInventory. onOpenChange(open): the game pauses input.
// upgrades: { level(id): the farm's level of it, problem(id): why it can't
// be upgraded right now ('' if it can: the farm's side of it), upgrade(id) }
// chest: { stock(): { item: count } of what the chest has to make things
// with, spend({ item: count }): a promise of whether it was all there, and
// is used up now }
export function createWorkbench({ inventory, onOpenChange, upgrades, chest = { stock: () => ({}), spend: async () => false } }) {
  let open = false;
  let busy = false; // (waiting to hear whether the chest had it)

  const menuEl = el('div', 'inv-menu bench-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame bench-window', menuEl);
  el('div', 'inv-tab inv-frame', windowEl, 'Workbench');
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';
  const noteEl = el('div', 'bench-note', windowEl);
  const listEl = el('div', 'bench-list', windowEl);

  const stored = (id) => (id === 'gold' || isTool(id) ? 0 : chest.stock()[id] ?? 0); // (tools stay with you)
  const have = (id) => (id === 'gold' ? inventory.gold() : inventory.count(id)) + stored(id);
  // What's short of `needs` ({ item or gold: n }), as words ('': nothing)
  function short(needs) {
    for (const [id, n] of Object.entries(needs)) {
      if (have(id) >= n) continue;
      if (id === 'gold') return 'Not enough gold';
      return isTool(id) ? `Needs your ${ITEMS[id].name.toLowerCase()}` : `Not enough ${ITEMS[id].name.toLowerCase()}`;
    }
    return '';
  }
  // Pay `needs`, but for the tool among them (it is swapped, not used up):
  // from the backpack, and what it is short of from the chest. Resolves to
  // whether it was paid. (The chest first: the backpack only fills up while
  // we wait, and what it has is then still there to take.)
  async function pay(needs, tool) {
    const mine = {};
    const theirs = {};
    for (const [id, n] of Object.entries(needs)) {
      if (id === 'gold' || id === tool) continue;
      mine[id] = Math.min(n, inventory.count(id));
      if (n > mine[id]) theirs[id] = n - mine[id];
    }
    if (Object.keys(theirs).length && !(await chest.spend(theirs))) return false;
    for (const [id, n] of Object.entries(mine)) if (n) inventory.remove(id, n);
    if (needs.gold) inventory.spend(needs.gold);
    return true;
  }

  // A tool there is no making now: you have it, or a better one (made from it)
  const outgrown = (makes) => isTool(makes) && [makes, ...betterThan(makes)].some((id) => inventory.count(id));

  // Why this can't be made right now ('': it can)
  function problem({ makes, needs, level = 1 }) {
    if (upgrades.level('workbench') < level) return `Needs a level ${level} workbench`;
    if (isTool(makes) && inventory.count(makes)) return 'You have one';
    if (isTool(makes) && betterThan(makes).some((id) => inventory.count(id))) return 'You have a better one';
    const lacking = short(needs);
    if (lacking) return lacking;
    const tool = Object.keys(needs).find(isTool);
    if (!tool && !inventory.canAdd(makes)) return 'No room in the backpack';
    return '';
  }

  // Why the next level of this can't be bought right now ('': it can)
  function upgradeProblem({ id, levels }) {
    const next = levels[upgrades.level(id)];
    return upgrades.problem(id) || short(next.cost);
  }

  function needsRow(parent, needs) {
    const row = el('div', 'bench-needs', parent);
    for (const [id, n] of Object.entries(needs)) {
      const got = have(id);
      const need = el('span', 'bench-need' + (got < n ? ' short' : ''), row);
      el('img', 'inv-icon', need).src = spriteURL(ITEMS[id === 'gold' ? 'coin' : id]);
      const inChest = stored(id);
      need.append(id === 'gold' ? `${gold(n)} (${gold(got)})`
        : isTool(id) ? ITEMS[id].name
        : inChest ? `${n} (${got - inChest} + ${inChest} in chest)`
        : `${n} (${got})`);
    }
  }

  function rowFor(icon, title, desc, why, action, onClick, extraClass = '') {
    const row = el('div', 'bench-row' + extraClass, listEl);
    const slot = el('div', 'inv-slot bench-icon', row);
    el('img', 'inv-icon', slot).src = spriteURL(ITEMS[icon] ?? PIECE_ICONS[icon]);
    const text = el('div', 'bench-text', row);
    el('b', '', text, title);
    el('div', 'bench-desc', text, desc);
    if (action) {
      const btn = button('ui-btn bench-make', row, action, onClick);
      btn.disabled = !!why;
      if (why) btn.title = why;
    }
    return text;
  }

  function render() {
    noteEl.textContent = 'Make tools and things for the farm, and make the farm better. Put decorations down from the backpack\'s Build tab.'
      + (Object.keys(chest.stock()).length ? ' What your backpack is short of comes out of your farm\'s chest.' : '');
    listEl.textContent = '';
    el('div', 'bench-head', listEl, 'Upgrades');
    for (const up of UPGRADES) {
      const level = upgrades.level(up.id);
      const next = up.levels[level];
      if (!next) {
        rowFor(up.icon, `${up.name}: level ${level}`, 'As fine as it gets.', '', null, null, ' done');
        continue;
      }
      const why = upgradeProblem(up);
      const text = rowFor(up.icon, `${up.name}: level ${level} → ${level + 1}`, up.brings(level + 1, next), why, 'Upgrade', () => buy(up));
      needsRow(text, next.cost);
      if (why) el('div', 'bench-why', text, why);
    }
    el('div', 'bench-head', listEl, 'Make');
    for (const recipe of RECIPES) {
      if (outgrown(recipe.makes)) continue;
      const def = ITEMS[recipe.makes];
      const why = problem(recipe);
      const locked = upgrades.level('workbench') < (recipe.level ?? 1);
      const text = rowFor(recipe.makes, def.name, def.description, why, 'Make', () => craft(recipe), locked ? ' locked' : '');
      needsRow(text, recipe.needs);
      if (why) el('div', 'bench-why', text, why);
    }
  }

  async function craft(recipe) {
    if (busy || problem(recipe)) return;
    const tool = Object.keys(recipe.needs).find(isTool);
    busy = true;
    const paid = await pay(recipe.needs, tool);
    busy = false;
    if (!paid) {
      inventory.notify('The chest does not have that any more');
    } else if (tool) {
      inventory.upgrade(tool, recipe.makes);
      inventory.notify(`Your ${ITEMS[tool].name.toLowerCase()} is now a ${ITEMS[recipe.makes].name.toLowerCase()}`);
    } else {
      inventory.add(recipe.makes);
    }
    if (open) render();
  }

  async function buy(up) {
    if (busy || upgradeProblem(up)) return;
    busy = true;
    const paid = await pay(up.levels[upgrades.level(up.id)].cost);
    busy = false;
    if (paid) {
      upgrades.upgrade(up.id);
      inventory.notify(`The ${up.name.toLowerCase()} is level ${upgrades.level(up.id)} now`);
    } else {
      inventory.notify('The chest does not have that any more');
    }
    if (open) render();
  }

  menuEl.addEventListener('pointerdown', (e) => e.target === menuEl && setOpen(false)); // a press outside the window (a fresh one: not the mouse events a phone makes afterwards of the tap that opened it)
  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  // Capture phase, like the chest's: while the workbench is open it has the keyboard
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
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
