import './workbench.css';
import { ITEMS, spriteURL } from './items.js';
import { el, button } from './ui/dom.js';

// ---------- The workbench ----------
// Built on the farm in build mode (src/build.js), and E next to it (or a tap)
// opens this: things to make from wood and stone. The decorations go in the
// backpack, to be put down from the Build tab; the sturdy tools take the
// place of the plain ones in the backpack; the sword and the mallet are for
// bopping other farmers in lobbies. All of it is the page's own, like
// the backpack, so it works on a friend's farm too.
//
//   Make          make one
//   E / Esc / ×   close

// What can be made, in the order it is listed. `needs`: items used up (a
// tool among them is swapped for the one made, in its slot).
export const RECIPES = [
  { makes: 'lamp_post', needs: { wood: 3, stone: 2 } },
  { makes: 'garden_bench', needs: { wood: 6 } },
  { makes: 'planter', needs: { stone: 4, wood: 1 } },
  { makes: 'sturdy_axe', needs: { axe: 1, wood: 12, stone: 8 } },
  { makes: 'sturdy_pickaxe', needs: { pickaxe: 1, wood: 8, stone: 12 } },
  { makes: 'wide_hoe', needs: { hoe: 1, wood: 10, stone: 10 } },
  { makes: 'wooden_sword', needs: { wood: 8 } },
  { makes: 'mallet', needs: { wood: 4, stone: 6 } },
];

const isTool = (id) => ITEMS[id]?.category === 'Tool';

// inventory: from createInventory. onOpenChange(open): the game pauses input.
export function createWorkbench({ inventory, onOpenChange }) {
  let open = false;

  const menuEl = el('div', 'inv-menu bench-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame bench-window', menuEl);
  el('div', 'inv-tab inv-frame', windowEl, 'Workbench');
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';
  el('div', 'bench-note', windowEl, 'Make things for the farm from wood and stone. Put decorations down from the backpack\'s Build tab.');
  const listEl = el('div', 'bench-list', windowEl);

  // Why this can't be made right now ('': it can)
  function problem({ makes, needs }) {
    if (isTool(makes) && inventory.count(makes)) return 'You have one';
    for (const [id, n] of Object.entries(needs)) {
      if (inventory.count(id) < n) return isTool(id) ? `Needs your ${ITEMS[id].name.toLowerCase()}` : `Not enough ${ITEMS[id].name.toLowerCase()}`;
    }
    const tool = Object.keys(needs).find(isTool);
    if (!tool && !inventory.canAdd(makes)) return 'No room in the backpack';
    return '';
  }

  function render() {
    listEl.textContent = '';
    for (const recipe of RECIPES) {
      const def = ITEMS[recipe.makes];
      const row = el('div', 'bench-row', listEl);
      const slot = el('div', 'inv-slot bench-icon', row);
      el('img', 'inv-icon', slot).src = spriteURL(def);
      const text = el('div', 'bench-text', row);
      el('b', '', text, def.name);
      el('div', 'bench-desc', text, def.description);
      const needs = el('div', 'bench-needs', text);
      for (const [id, n] of Object.entries(recipe.needs)) {
        const have = inventory.count(id);
        const need = el('span', 'bench-need' + (have < n ? ' short' : ''), needs);
        el('img', 'inv-icon', need).src = spriteURL(ITEMS[id]);
        need.append(isTool(id) ? ITEMS[id].name : `${n} (${have})`);
      }
      const why = problem(recipe);
      const make = button('ui-btn bench-make', row, 'Make', () => craft(recipe));
      make.disabled = !!why;
      if (why) make.title = why;
      if (why) el('div', 'bench-why', text, why);
    }
  }

  function craft(recipe) {
    if (problem(recipe)) return;
    const tool = Object.keys(recipe.needs).find(isTool);
    for (const [id, n] of Object.entries(recipe.needs)) if (id !== tool) inventory.remove(id, n);
    if (tool) {
      inventory.upgrade(tool, recipe.makes);
      inventory.notify(`Your ${ITEMS[tool].name.toLowerCase()} is now a ${ITEMS[recipe.makes].name.toLowerCase()}`);
    } else {
      inventory.add(recipe.makes);
    }
    render();
  }

  menuEl.addEventListener('mousedown', (e) => e.target === menuEl && setOpen(false)); // click outside the window
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
