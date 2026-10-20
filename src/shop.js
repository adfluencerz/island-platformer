import './shop.css';
import { ITEMS, spriteURL } from './items.js';
import { COLS, SLOT_COUNT, CATEGORIES } from './inventory.js';
import { el, button } from './ui/dom.js';

// ---------- The merchant's shop ----------
// Opened with E at the stall on the home farm (merchant.js). Seeds and animals to
// buy up top; below, your backpack (toolbar row first), to sell from. Prices are the
// items' own `price` and `sell` (items.js).
//
//   click something to buy  buy one (shift: five)
//   click a backpack slot   sell the whole stack
//   right click a slot      sell one
//   E / Esc / ×             close

// What the merchant has for sale: every item with a price, cheapest first
const STOCK = Object.keys(ITEMS)
  .filter((id) => ITEMS[id].price)
  .sort((a, b) => ITEMS[a].price - ITEMS[b].price);

const BULK = 5;

const LINES = {
  hello: [
    'Morning, neighbour! Fresh seeds, fair prices.',
    'Ah, my favourite farmer! What can I do for you?',
    'Lovely day for planting, isn\'t it?',
    'Got anything good from the fields today?',
  ],
  bought: ['Plant them somewhere sunny!', 'Good choice. They grow like anything.', 'Happy growing!'],
  boughtAnimal: ['Look after her, now!', 'She\'ll be happy on your farm.', 'Off to her new home!'],
  sold: ['Lovely! Pleasure doing business.', 'Oh, these are beauties.', 'The townsfolk will love these.'],
  soldRare: ['My word, I haven\'t seen one of those in years!', 'Well I never! That\'s a rare find.'],
  poor: ['Ah, you\'re a little short for that one.', 'Come back when the harvest\'s in!'],
  full: ['Your bag\'s full to bursting, friend!'],
  noSale: ['Oh no, you hang on to that.', 'That\'s not something I can buy, I\'m afraid.'],
};
const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

const coinImg = (parent) => {
  const img = el('img', 'inv-icon shop-coin', parent);
  img.src = spriteURL(ITEMS.coin);
  img.alt = '';
  return img;
};

// inventory: from createInventory. onOpenChange(open): the game pauses input.
export function createShop({ inventory, onOpenChange }) {
  let open = false;

  const menuEl = el('div', 'inv-menu shop-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame shop-window', menuEl);
  el('div', 'inv-tab inv-frame', windowEl, 'Merchant');
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';

  const sayEl = el('div', 'shop-say', windowEl);

  el('div', 'shop-heading', windowEl, 'For sale');
  const stockEl = el('div', 'shop-stock', windowEl);
  const stockViews = STOCK.map((id) => {
    const def = ITEMS[id];
    const row = button('shop-item', stockEl);
    row.dataset.buy = id;
    const icon = el('img', 'inv-icon', row);
    icon.src = spriteURL(def);
    icon.alt = '';
    el('span', 'shop-item-name', row, def.name);
    const price = el('span', 'shop-price', row);
    coinImg(price);
    el('span', '', price, `${def.price}g`);
    return { id, row };
  });

  el('div', 'shop-heading', windowEl, 'Sell from your backpack');
  const gridEl = el('div', 'inv-grid', windowEl);
  const slotViews = Array.from({ length: SLOT_COUNT }, (_, i) => {
    if (i === COLS) el('div', 'inv-divider', gridEl);
    const root = el('div', 'inv-slot', gridEl);
    root.dataset.sell = i;
    const img = el('img', 'inv-icon', root);
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'inv-count', root);
    return { root, img, count };
  });

  const footerEl = el('div', 'inv-footer', windowEl);
  const fundsEl = el('div', 'shop-funds', footerEl);
  coinImg(fundsEl);
  const fundsText = el('span', '', fundsEl);
  const hintEl = el('div', 'inv-hint shop-hint', footerEl);
  el('span', 'mouse-only', hintEl, 'Click to buy one (Shift: five) · Click your items: sell the stack · Right click: sell one');
  el('span', 'touch-only', hintEl, 'Tap to buy one · Tap your items: sell the stack');

  const tooltipEl = el('div', 'inv-tooltip inv-frame', document.body);
  tooltipEl.hidden = true;

  // ---------- Rendering ----------
  function render() {
    const gold = inventory.gold();
    fundsText.textContent = `${gold.toLocaleString()}g`;
    for (const { id, row } of stockViews) row.classList.toggle('poor', gold < ITEMS[id].price);
    slotViews.forEach((view, i) => {
      const stack = inventory.slot(i);
      view.img.hidden = !stack;
      if (stack) view.img.src = spriteURL(ITEMS[stack.id]);
      view.count.textContent = stack && stack.count > 1 ? stack.count : '';
      view.root.classList.toggle('shop-nosell', !!stack && !ITEMS[stack.id].sell);
    });
  }

  function say(lines) {
    sayEl.textContent = pick(lines);
    sayEl.classList.remove('bump');
    void sayEl.offsetWidth; // restart the animation
    sayEl.classList.add('bump');
  }

  function bumpFunds() {
    fundsEl.classList.remove('bump');
    void fundsEl.offsetWidth;
    fundsEl.classList.add('bump');
  }

  function showTooltip(target, x, y) {
    let html = null;
    if (target?.dataset.buy) {
      const def = ITEMS[target.dataset.buy];
      html = tooltipHTML(def, `${def.price}g each · Shift+click: ${BULK} for ${def.price * BULK}g`);
    } else if (target?.dataset.sell) {
      const stack = inventory.slot(Number(target.dataset.sell));
      if (stack) {
        const def = ITEMS[stack.id];
        const offer = !def.sell
          ? 'The merchant won\'t buy this'
          : stack.count > 1
            ? `Sells for ${def.sell}g each · ${def.sell * stack.count}g for all ${stack.count}`
            : `Sells for ${def.sell}g`;
        html = tooltipHTML(def, offer);
      }
    }
    tooltipEl.hidden = !html;
    if (!html) return;
    tooltipEl.innerHTML = html;
    const r = tooltipEl.getBoundingClientRect();
    const left = x + 20 + r.width > window.innerWidth ? x - r.width - 12 : x + 20;
    const top = y + 20 + r.height > window.innerHeight ? y - r.height - 12 : y + 20;
    tooltipEl.style.transform = `translate(${Math.max(4, left)}px, ${Math.max(4, top)}px)`;
  }

  const tooltipHTML = (def, offer) => `
    <div class="inv-tt-name">${def.name}</div>
    <div class="inv-tt-cat" style="color:${CATEGORIES[def.category]}">${def.category}</div>
    <div class="inv-tt-desc">${def.description}</div>
    <div class="inv-tt-meta shop-tt-offer">${offer}</div>`;

  // ---------- Trading ----------
  function buy(id, count) {
    const cost = ITEMS[id].price * count;
    if (inventory.gold() < cost) return say(LINES.poor);
    if (!inventory.canAdd(id, count)) return say(LINES.full);
    inventory.spend(cost);
    inventory.add(id, count);
    say(ITEMS[id].category === 'Animal' ? LINES.boughtAnimal : LINES.bought);
    bumpFunds();
  }

  function sell(i, count) {
    const stack = inventory.slot(i);
    if (!stack) return;
    const def = ITEMS[stack.id];
    if (!def.sell) return say(LINES.noSale);
    const sold = inventory.take(i, count);
    inventory.earn(def.sell * sold);
    say(def.sell >= 150 ? LINES.soldRare : LINES.sold);
    bumpFunds();
  }

  stockEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-buy]');
    if (row) buy(row.dataset.buy, e.shiftKey ? BULK : 1);
    render();
  });

  gridEl.addEventListener('mousedown', (e) => {
    const slot = e.target.closest('[data-sell]');
    if (!slot) return;
    const i = Number(slot.dataset.sell);
    if (e.button === 0) sell(i, Infinity);
    else if (e.button === 2) sell(i, 1);
    render();
    showTooltip(slot, e.clientX, e.clientY);
  });

  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  menuEl.addEventListener('mousedown', (e) => e.target === menuEl && setOpen(false)); // click outside the window
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true }); // (no toolbar scrolling behind)
  menuEl.addEventListener('pointermove', (e) => {
    showTooltip(e.target.closest('[data-buy], [data-sell]'), e.clientX, e.clientY);
  });

  // Capture phase, registered after the HUD's: while the shop is open it has
  // the keyboard, and nothing behind it (backpack, toolbar, the farmer) sees keys
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    e.stopPropagation();
    if ((e.code === 'Escape' || e.code === 'KeyE') && !e.repeat) setOpen(false);
  }, true);

  // ---------- Open / close ----------
  function setOpen(next) {
    if (next === open) return;
    open = next;
    menuEl.hidden = !open;
    tooltipEl.hidden = true;
    if (open) {
      say(LINES.hello);
      render();
    }
    onOpenChange?.(open);
  }

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
