import './inventory.css';
import { ITEMS, spriteURL } from './items.js';

// ---------- Slot-based inventory (Stardew Valley style) ----------
// 3 rows x 12 slots. The first row doubles as the always-visible toolbar; the
// selected toolbar slot is the item in hand. The full backpack opens with I.
//
// In the backpack menu:
//   left click        pick up / place / swap / merge a stack
//   right click       take one (shift: take half), or drop one into a slot
//   shift + click     move a stack between the toolbar and the backpack
//   trash slot        destroy the carried stack (tools refuse)

export const COLS = 12;
const ROWS = 3;
export const SLOT_COUNT = COLS * ROWS;
const HOTBAR = [...Array(COLS).keys()];
const BACKPACK = [...Array(COLS * (ROWS - 1)).keys()].map((i) => i + COLS);
const ALL = [...HOTBAR, ...BACKPACK];

const HOTBAR_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
  'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
const HOTBAR_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export const CATEGORIES = {
  Tool: '#6b5a45',
  Seed: '#3f7f24',
  Produce: '#c25a12',
  Forage: '#9a1b33',
  Material: '#7a4a22',
  Mineral: '#7b3fb0',
  'Key Item': '#b8257a',
  Currency: '#a86e00',
};
const CATEGORY_ORDER = Object.keys(CATEGORIES);

const FUNDS_DIGITS = 7;
const TOAST_TIME = 3000; // ms a pickup notice stays up after the last pickup

const TRASH_ICON = spriteURL({
  palette: { o: '#3a3f47', L: '#d7dde5', M: '#9aa3ae', m: '#6c7480' },
  sprite: [
    '................',
    '......oooo......',
    '......o..o......',
    '..oooooooooooo..',
    '..oLLLLLLLLLLo..',
    '..oooooooooooo..',
    '...oMLmMLmMmo...',
    '...oMLmMLmMmo...',
    '...oMLmMLmMmo...',
    '...oMLmMLmMmo...',
    '...oMLmMLmMmo...',
    '...oMLmMLmMmo...',
    '...oMLmMLmMmo...',
    '...oMmmMmmMmo...',
    '...oooooooooo...',
    '................',
  ],
});

function el(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

function iconImg(parent) {
  const img = el('img', 'inv-icon', parent);
  img.alt = '';
  img.draggable = false;
  return img;
}

export function createInventory({ onOpenChange } = {}) {
  const slots = new Array(COLS * ROWS).fill(null); // { id, count } | null
  let selected = 0;
  let gold = 0;
  let open = false;
  let held = null; // stack carried on the cursor while the menu is open
  let lastFullNotice = 0;

  // ---------- DOM ----------
  function makeSlot(parent, index, label) {
    const root = el('div', 'inv-slot', parent);
    root.dataset.index = index;
    if (label) el('span', 'inv-key', root).textContent = label;
    const img = iconImg(root);
    const count = el('span', 'inv-count', root);
    return { root, img, count };
  }

  // Toolbar, bottom center
  const hotbarEl = el('div', 'inv-hotbar inv-frame', document.body);
  const hotbarViews = HOTBAR.map((i) => makeSlot(hotbarEl, i, HOTBAR_LABELS[i]));

  // Gold counter, top right
  const fundsEl = el('div', 'inv-funds inv-frame', document.body);
  iconImg(fundsEl).src = spriteURL(ITEMS.coin);
  const digitEls = Array.from({ length: FUNDS_DIGITS }, () => el('span', 'inv-digit', fundsEl));

  // Pickup notices, bottom left
  const toastsEl = el('div', 'inv-toasts', document.body);

  // Backpack menu
  const menuEl = el('div', 'inv-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame', menuEl);
  el('div', 'inv-tab inv-frame', windowEl).textContent = 'Backpack';
  const closeBtn = el('button', 'inv-close', windowEl);
  closeBtn.textContent = '×';
  closeBtn.title = 'Close (I / Esc)';

  const gridEl = el('div', 'inv-grid', windowEl);
  const gridViews = ALL.map((i) => {
    if (i === COLS) el('div', 'inv-divider', gridEl); // gap between toolbar row and backpack
    return makeSlot(gridEl, i);
  });

  const footerEl = el('div', 'inv-footer', windowEl);
  const statsEl = el('div', 'inv-stats', footerEl);
  const organizeBtn = el('button', 'inv-button', footerEl);
  organizeBtn.textContent = 'Organize';
  organizeBtn.title = 'Sort and stack the backpack rows (the toolbar is left alone)';
  const trashEl = el('div', 'inv-slot inv-trash', footerEl);
  trashEl.title = 'Trash';
  iconImg(trashEl).src = TRASH_ICON;

  const hintEl = el('div', 'inv-hint', windowEl);
  el('span', 'mouse-only', hintEl).textContent = 'Click: pick up / place · Right click: take one (Shift: half) · Shift+click: move to/from toolbar';
  el('span', 'touch-only', hintEl).textContent = 'Tap: pick up / place · The top row is your toolbar';

  const heldEl = el('div', 'inv-held', document.body);
  const heldImg = iconImg(heldEl);
  const heldCount = el('span', 'inv-count', heldEl);
  heldEl.hidden = true;

  const tooltipEl = el('div', 'inv-tooltip inv-frame', document.body);
  tooltipEl.hidden = true;

  // ---------- Rendering ----------
  function paintSlot(view, stack) {
    view.img.hidden = !stack;
    if (stack) view.img.src = spriteURL(ITEMS[stack.id]);
    view.count.textContent = stack && stack.count > 1 ? stack.count : '';
  }

  function render() {
    HOTBAR.forEach((i) => {
      paintSlot(hotbarViews[i], slots[i]);
      hotbarViews[i].root.classList.toggle('selected', i === selected);
    });
    ALL.forEach((i) => paintSlot(gridViews[i], slots[i]));

    const digits = String(Math.min(gold, 10 ** FUNDS_DIGITS - 1)).padStart(FUNDS_DIGITS, ' ');
    digitEls.forEach((d, i) => (d.textContent = digits[i]));
    const used = slots.filter(Boolean).length;
    statsEl.innerHTML = `<span>Current funds: <b>${gold.toLocaleString()}g</b></span><span>Slots used: <b>${used}/${slots.length}</b></span>`;

    heldEl.hidden = !held;
    if (held) {
      heldImg.src = spriteURL(ITEMS[held.id]);
      heldCount.textContent = held.count > 1 ? held.count : '';
    }
  }

  function showTooltip(stack, x, y) {
    if (!stack) {
      tooltipEl.hidden = true;
      return;
    }
    const def = ITEMS[stack.id];
    const stackLine = def.maxStack > 1 ? `<div class="inv-tt-meta">Stack ${stack.count} / ${def.maxStack}</div>` : '';
    const sellLine = def.sell ? `<div class="inv-tt-meta">The merchant pays ${def.sell}g</div>` : '';
    tooltipEl.innerHTML = `
      <div class="inv-tt-name">${def.name}</div>
      <div class="inv-tt-cat" style="color:${CATEGORIES[def.category]}">${def.category}</div>
      <div class="inv-tt-desc">${def.description}</div>
      ${stackLine}${sellLine}`;
    tooltipEl.hidden = false;
    // Sit below-right of the cursor, flipping when it would leave the screen
    const r = tooltipEl.getBoundingClientRect();
    const left = x + 20 + r.width > window.innerWidth ? x - r.width - 12 : x + 20;
    const top = y + 20 + r.height > window.innerHeight ? y - r.height - 12 : y + 20;
    tooltipEl.style.transform = `translate(${Math.max(4, left)}px, ${Math.max(4, top)}px)`;
  }

  // ---------- Toasts ----------
  const toasts = new Map(); // key -> { node, text, amount, timer }

  function toast(key, iconUrl, format, amount = 1) {
    let t = toasts.get(key);
    if (!t) {
      const node = el('div', 'inv-toast inv-frame', toastsEl);
      if (iconUrl) iconImg(node).src = iconUrl;
      t = { node, text: el('span', '', node), amount: 0, timer: 0 };
      toasts.set(key, t);
    }
    t.amount += amount;
    t.text.textContent = format(t.amount);
    t.node.classList.remove('bump');
    void t.node.offsetWidth; // restart the bump animation
    t.node.classList.add('bump');
    clearTimeout(t.timer);
    t.timer = setTimeout(() => {
      toasts.delete(key);
      t.node.classList.add('out');
      t.node.addEventListener('animationend', () => t.node.remove(), { once: true });
    }, TOAST_TIME);
  }

  // ---------- Stack logic ----------
  function roomFor(id, indices) {
    const max = ITEMS[id].maxStack;
    return indices.reduce((room, i) => {
      const s = slots[i];
      if (!s) return room + max;
      return s.id === id ? room + (max - s.count) : room;
    }, 0);
  }

  // Pour `stack` into `indices`: top up matching stacks first, then fill empty
  // slots. Mutates stack.count and returns what didn't fit.
  function insert(stack, indices) {
    const max = ITEMS[stack.id].maxStack;
    for (const i of indices) {
      const s = slots[i];
      if (stack.count && s && s.id === stack.id && s.count < max) {
        const n = Math.min(max - s.count, stack.count);
        s.count += n;
        stack.count -= n;
      }
    }
    for (const i of indices) {
      if (stack.count && !slots[i]) {
        const n = Math.min(max, stack.count);
        slots[i] = { id: stack.id, count: n };
        stack.count -= n;
      }
    }
    return stack.count;
  }

  // Add items from the world. All-or-nothing: returns false if they don't fit,
  // so the pickup can stay where it is. `quiet` skips the pickup notice.
  function add(id, count = 1, { quiet = false } = {}) {
    const def = ITEMS[id];
    if (!def) return false; // an item this page doesn't know (a newer server): leave it alone
    if (def.currency) {
      earn(def.currency * count);
      return true;
    }
    if (roomFor(id, ALL) < count) {
      const now = performance.now();
      if (now - lastFullNotice > 2000) {
        lastFullNotice = now;
        toast('full', null, () => 'Inventory full', 0);
      }
      return false;
    }
    insert({ id, count }, ALL);
    if (!quiet) toast(id, spriteURL(def), (n) => `${def.name} ×${n}`, count);
    render();
    return true;
  }

  function earn(amount) {
    gold += amount;
    toast('gold', spriteURL(ITEMS.coin), (n) => `+${n}g`, amount);
    fundsEl.classList.remove('bump');
    void fundsEl.offsetWidth;
    fundsEl.classList.add('bump');
    render();
  }

  // Pay for something; false (and nothing spent) if there isn't enough
  function spend(amount) {
    if (gold < amount) return false;
    gold -= amount;
    render();
    return true;
  }

  // Use up items from the selected toolbar slot (e.g. planting a seed)
  function consumeSelected(count = 1) {
    const s = slots[selected];
    if (!s || s.count < count) return false;
    takeFrom(selected, count);
    render();
    return true;
  }

  function notify(text) {
    toast(`notice:${text}`, null, () => text, 0);
  }

  function takeFrom(i, n) {
    const s = slots[i];
    const taken = { id: s.id, count: n };
    s.count -= n;
    if (!s.count) slots[i] = null;
    return taken;
  }

  function leftClick(i, shift) {
    const s = slots[i];
    if (shift && !held && s) {
      // Quick-move between the toolbar row and the backpack rows
      const target = HOTBAR.includes(i) ? BACKPACK : HOTBAR;
      slots[i] = null;
      const left = insert(s, target);
      if (left) slots[i] = s; // whatever didn't fit stays put
      return;
    }
    if (!held) {
      held = s;
      slots[i] = null;
    } else if (!s) {
      slots[i] = held;
      held = null;
    } else if (s.id === held.id && s.count < ITEMS[s.id].maxStack) {
      const n = Math.min(ITEMS[s.id].maxStack - s.count, held.count);
      s.count += n;
      held.count -= n;
      if (!held.count) held = null;
    } else {
      slots[i] = held;
      held = s;
    }
  }

  function rightClick(i, shift) {
    const s = slots[i];
    if (!s) {
      // Drop a single item from the carried stack
      if (held) {
        slots[i] = { id: held.id, count: 1 };
        if (!--held.count) held = null;
      }
      return;
    }
    if (!held) {
      held = takeFrom(i, shift ? Math.ceil(s.count / 2) : 1);
    } else if (held.id === s.id && held.count < ITEMS[s.id].maxStack) {
      held.count += takeFrom(i, 1).count;
    }
  }

  function trashHeld() {
    if (!held) return;
    if (ITEMS[held.id].trashable === false) {
      trashEl.classList.remove('deny');
      void trashEl.offsetWidth;
      trashEl.classList.add('deny');
      return;
    }
    held = null;
  }

  function organize() {
    const stacks = BACKPACK.map((i) => slots[i]).filter(Boolean);
    for (const i of BACKPACK) slots[i] = null;
    stacks.sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(ITEMS[a.id].category);
      const cb = CATEGORY_ORDER.indexOf(ITEMS[b.id].category);
      return ca - cb || ITEMS[a.id].name.localeCompare(ITEMS[b.id].name) || b.count - a.count;
    });
    for (const s of stacks) insert(s, BACKPACK);
  }

  // ---------- Open / close ----------
  function setOpen(next) {
    if (next === open) return;
    if (!next && held) {
      // Put the carried stack back before closing; it always came from here,
      // but if a split somehow can't fit, keep the menu open rather than lose it.
      if (insert(held, ALL)) {
        toast('noroom', null, () => 'No room to put that back', 0);
        render();
        return;
      }
      held = null;
    }
    open = next;
    menuEl.hidden = !open;
    hotbarEl.hidden = open;
    tooltipEl.hidden = true;
    render();
    onOpenChange?.(open);
  }

  function select(i) {
    selected = i;
    render();
  }

  // ---------- Input ----------
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select')) return; // typing a name or a chat line
    if (e.code === 'KeyI' && !e.repeat) setOpen(!open);
    else if (e.code === 'Escape') setOpen(false);
    else if (!open && HOTBAR_KEYS.includes(e.code)) select(HOTBAR_KEYS.indexOf(e.code));
  });

  window.addEventListener('wheel', (e) => {
    if (open || !e.deltaY) return;
    select((selected + Math.sign(e.deltaY) + COLS) % COLS);
  }, { passive: true });

  hotbarEl.addEventListener('mousedown', (e) => {
    const slot = e.target.closest('[data-index]');
    if (slot) select(Number(slot.dataset.index));
  });

  gridEl.addEventListener('mousedown', (e) => {
    const slot = e.target.closest('[data-index]');
    if (!slot) return;
    const i = Number(slot.dataset.index);
    if (e.button === 0) leftClick(i, e.shiftKey);
    else if (e.button === 2) rightClick(i, e.shiftKey);
    render();
    showTooltip(held ? null : slots[i], e.clientX, e.clientY);
  });

  trashEl.addEventListener('mousedown', () => {
    trashHeld();
    render();
  });
  organizeBtn.addEventListener('click', () => {
    organize();
    render();
  });
  closeBtn.addEventListener('click', () => setOpen(false));
  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('pointermove', (e) => {
    heldEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const slot = e.target.closest?.('[data-index]');
    showTooltip(slot && !held ? slots[Number(slot.dataset.index)] : null, e.clientX, e.clientY);
  });

  render();

  // The backpack as plain data, for saving; restore() puts it back
  function serialize() {
    return { slots: slots.map((s) => s && { ...s }), gold, selected };
  }

  function restore(data) {
    slots.fill(null);
    (data.slots || []).forEach((s, i) => {
      if (s && ITEMS[s.id] && i < slots.length) slots[i] = { id: s.id, count: Math.max(1, s.count | 0) };
    });
    gold = Math.max(0, Number(data.gold) || 0);
    selected = HOTBAR.includes(data.selected) ? data.selected : 0;
    render();
  }

  // Would add(id) succeed? (Pickups ask before claiming an item from the game.)
  function canAdd(id, count = 1) {
    const def = ITEMS[id];
    if (!def) return false; // an item this page doesn't know: don't claim it
    return !!def.currency || roomFor(id, ALL) >= count;
  }

  // Take up to n items out of slot i (selling them, say); returns how many
  function take(i, n) {
    const s = slots[i];
    if (!s) return 0;
    const count = Math.min(n, s.count);
    takeFrom(i, count);
    render();
    return count;
  }

  return {
    add,
    canAdd,
    earn,
    spend,
    take,
    gold: () => gold,
    slot: (i) => slots[i] && { ...slots[i] },
    serialize,
    restore,
    consumeSelected,
    notify,
    isOpen: () => open,
    selectedId: () => slots[selected]?.id ?? null,
  };
}
