import './shop.css';
import { ITEMS, spriteURL } from './items.js';
import { COLS, SLOT_COUNT, CATEGORIES } from './inventory.js';
import { MERCHANT_STOCK } from '../shared/balance.js';
import { el, button, placeTip } from './ui/dom.js';

// ---------- A shop ----------
// Opened with E at the merchant's stall on the home farm (merchant.js), or
// from a neighbour's Shop button (src/dialog.js): one window, filled each
// time with whose shop it is (open(config)). The merchant has today's request
// first (src/requests.js: some of one thing, for good gold); then what is for
// sale, on its shelves (a neighbour's shelves may be locked till you have
// done more for them); below, your backpack (toolbar row first), to sell
// from: every shop buys what the merchant does. Prices are the items' own
// `price` and `sell` (items.js), less what a neighbour takes off for a
// friend (config.discount).
//
//   click something to buy  buy one (shift: five)
//   click a backpack slot   sell the whole stack
//   right click a slot      sell one
//   E / Esc / ×             close

// The merchant sells the basics now (MERCHANT_STOCK), on a shelf for each
// kind (its category in items.js), cheapest first; the neighbours have the
// rest (shared/npcs.js)
const SHELF_NAMES = { Seed: 'Seeds', Animal: 'Animals', Tool: 'Tools', Fishing: 'Fishing tackle', Recipe: 'Recipes' };
const MERCHANT_SHELVES = [...new Set(MERCHANT_STOCK.map((id) => ITEMS[id].category))].map((kind) => ({
  title: SHELF_NAMES[kind] ?? kind,
  items: MERCHANT_STOCK.filter((id) => ITEMS[id].category === kind).sort((a, b) => ITEMS[a].price - ITEMS[b].price),
}));

const BULK = 5;

const LINES = {
  hello: [
    'Morning, neighbour! Fresh seeds, fair prices.',
    'Ah, my favourite farmer! What can I do for you?',
    'Lovely day for planting, isn\'t it?',
    'Got anything good from the fields today?',
    'Just the basics here, friend. The neighbours have the rest: Rosa, Basil, Finn, Mabel and Bram.',
    'Rosa\'s the one for animals, out west. Basil sells every seed there is, east past the fields.',
    'Finn has the fishing tackle, down on the dunes. And Mabel, up at the woods, sells her recipes.',
    'Bram the carpenter, up past the meadow, builds for the whole valley. Bigger pens, a better workbench: he\'s your man.',
  ],
  bought: ['Plant them somewhere sunny!', 'Good choice. They grow like anything.', 'Happy growing!'],
  boughtAnimal: ['Look after her, now!', 'She\'ll be happy on your farm.', 'Off to her new home!'],
  sold: ['Lovely! Pleasure doing business.', 'Oh, these are beauties.', 'The townsfolk will love these.'],
  soldRare: ['My word, I haven\'t seen one of those in years!', 'Well I never! That\'s a rare find.'],
  poor: ['Ah, you\'re a little short for that one.', 'Come back when the harvest\'s in!'],
  full: ['Your bag\'s full to bursting, friend!'],
  noSale: ['Oh no, you hang on to that.', 'That\'s not something I can buy, I\'m afraid.'],
  thanks: ['Just what I needed! Thank you kindly.', 'Wonderful, you\'ve saved my day!', 'Perfect! Here, this is for you.'],
  known: ['You know that one already!'],
  locked: ['That\'s not for sale to you just yet.'],
};
const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];
// The merchant's shop (open() with nothing)
export const MERCHANT = { title: 'Merchant', shelves: MERCHANT_SHELVES, lines: LINES, request: true, discount: 0 };

const coinImg = (parent) => {
  const img = el('img', 'inv-icon shop-coin', parent);
  img.src = spriteURL(ITEMS.coin);
  img.alt = '';
  return img;
};

// inventory: from createInventory. onOpenChange(open): the game pauses input.
// requests: the merchant's request of the day (src/requests.js), or none.
// known(id): a recipe already in the book (not to be bought again).
export function createShop({ inventory, onOpenChange, requests = null, known = () => false, parent = document.body, active = () => true }) {
  let open = false;
  let shop = MERCHANT; // whose shop it is: { title, shelves: [{ title, items, locked, lockText }], lines, request, discount }
  const lines = (kind) => shop.lines[kind] ?? LINES[kind];
  const priceOf = (id) => Math.max(1, Math.round(ITEMS[id].price * (1 - (shop.discount ?? 0))));

  const menuEl = el('div', 'inv-menu shop-menu', parent);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame shop-window', menuEl);
  const tabEl = el('div', 'inv-tab inv-frame', windowEl, 'Merchant');
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';

  // (all but the tab and the close button: it scrolls in a frame too short for it)
  const bodyEl = el('div', 'shop-body', windowEl);
  const sayEl = el('div', 'shop-say', bodyEl);

  // Today's request: what, what it pays, and Hand over
  const askEl = el('div', 'shop-ask', bodyEl);
  askEl.hidden = !requests;
  const askIcon = el('img', 'inv-icon', askEl);
  askIcon.alt = '';
  const askText = el('div', 'shop-ask-text', askEl);
  const askBtn = button('shop-item shop-ask-btn', askEl, 'Hand over', () => {
    if (!requests?.handOver()) return;
    say(LINES.thanks);
    bumpFunds();
    render();
  });

  el('div', 'shop-heading', bodyEl, 'For sale');
  const stockEl = el('div', 'shop-stock', bodyEl);
  let stockViews = [];
  // (the shelves of whose shop it is, afresh each time it opens)
  function fillStock() {
    stockEl.replaceChildren();
    stockViews = shop.shelves.flatMap(({ title, items, locked, lockText }) => {
      const shelf = el('div', 'shop-shelf', stockEl, title);
      if (locked) el('span', 'shop-lock', shelf, lockText ?? 'not yet');
      return items.map((id) => stockRow(id, locked));
    });
  }
  function stockRow(id, locked) {
    const def = ITEMS[id];
    const row = button('shop-item', stockEl);
    row.dataset.buy = id;
    row.classList.toggle('locked', !!locked);
    const icon = el('img', 'inv-icon', row);
    icon.src = spriteURL(def);
    icon.alt = '';
    el('span', 'shop-item-name', row, def.name);
    const price = el('span', 'shop-price', row);
    coinImg(price);
    const cost = el('span', '', price, `${priceOf(id)}g`);
    if (priceOf(id) < def.price) cost.classList.add('shop-cheaper'); // (a friend's price)
    return { id, row, locked };
  }

  el('div', 'shop-heading', bodyEl, 'Sell from your backpack');
  const gridEl = el('div', 'inv-grid', bodyEl);
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

  const footerEl = el('div', 'inv-footer', bodyEl);
  const fundsEl = el('div', 'shop-funds', footerEl);
  coinImg(fundsEl);
  const fundsText = el('span', '', fundsEl);
  const hintEl = el('div', 'inv-hint shop-hint', footerEl);
  el('span', 'mouse-only', hintEl, 'Click to buy one (Shift: five) · Click your items: sell the stack · Right click: sell one');
  el('span', 'touch-only', hintEl, 'Tap to buy one · Tap your items: sell the stack');

  const tooltipEl = el('div', 'inv-tooltip inv-frame', parent);
  tooltipEl.hidden = true;

  // ---------- Rendering ----------
  function render() {
    renderAsk();
    const gold = inventory.gold();
    fundsText.textContent = `${gold.toLocaleString()}g`;
    for (const { id, row } of stockViews) {
      row.classList.toggle('poor', gold < priceOf(id));
      row.classList.toggle('known', known(id));
    }
    slotViews.forEach((view, i) => {
      const stack = inventory.slot(i);
      view.img.hidden = !stack;
      if (stack) view.img.src = spriteURL(ITEMS[stack.id]);
      view.count.textContent = stack && stack.count > 1 ? stack.count : '';
      view.root.classList.toggle('shop-nosell', !!stack && !ITEMS[stack.id].sell);
    });
  }

  function renderAsk() {
    askEl.hidden = !(requests && shop.request);
    if (askEl.hidden) return;
    const r = requests.today();
    const def = ITEMS[r.item];
    const have = inventory.count(r.item);
    askIcon.src = spriteURL(def);
    askEl.classList.toggle('done', r.done);
    askText.textContent = r.done
      ? 'That\'s today\'s request done. Thank you! Come back tomorrow.'
      : `Today I'm after ${r.count} × ${def.name.toLowerCase()}: ${r.gold}g for ${r.count > 1 ? 'them' : 'it'}${r.bonus ? ', and a golden seed' : ''}.`;
    askBtn.hidden = r.done;
    askBtn.disabled = have < r.count;
    askBtn.textContent = `Hand over (${Math.min(have, r.count)}/${r.count})`;
  }

  function say(said) {
    sayEl.textContent = pick(said);
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
      const id = target.dataset.buy;
      const def = ITEMS[id];
      const view = stockViews.find((v) => v.id === id);
      html = tooltipHTML(def, view?.locked ? 'Not for sale to you yet' : known(id) ? 'In your recipe book already' : `${priceOf(id)}g each · Shift+click: ${BULK} for ${priceOf(id) * BULK}g`);
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
    placeTip(tooltipEl, x, y);
  }

  const tooltipHTML = (def, offer) => `
    <div class="inv-tt-name">${def.name}</div>
    <div class="inv-tt-cat" style="color:${CATEGORIES[def.category]}">${def.category}</div>
    <div class="inv-tt-desc">${def.description}</div>
    <div class="inv-tt-meta shop-tt-offer">${offer}</div>`;

  // ---------- Trading ----------
  function buy(id, count) {
    if (stockViews.find((v) => v.id === id)?.locked) return say(lines('locked'));
    if (known(id)) return say(lines('known'));
    if (ITEMS[id].maxStack === 1 || ITEMS[id].category === 'Recipe') count = 1; // (a rod, a recipe: one at a time)
    const cost = priceOf(id) * count;
    if (inventory.gold() < cost) return say(lines('poor'));
    if (!inventory.canAdd(id, count)) return say(lines('full'));
    inventory.spend(cost);
    inventory.add(id, count);
    say(shop === MERCHANT && ITEMS[id].category === 'Animal' ? LINES.boughtAnimal : lines('bought'));
    bumpFunds();
  }

  function sell(i, count) {
    const stack = inventory.slot(i);
    if (!stack) return;
    const def = ITEMS[stack.id];
    if (!def.sell) return say(lines('noSale'));
    const sold = inventory.take(i, count);
    inventory.earn(def.sell * sold);
    say(def.sell >= 150 ? lines('soldRare') : lines('sold'));
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
  menuEl.addEventListener('pointerdown', (e) => e.target === menuEl && setOpen(false)); // a press outside the window (a fresh one: not the mouse events a phone makes afterwards of the tap that opened it)
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true }); // (no toolbar scrolling behind)
  menuEl.addEventListener('pointermove', (e) => {
    showTooltip(e.target.closest('[data-buy], [data-sell]'), e.clientX, e.clientY);
  });

  // Capture phase, registered after the HUD's: while the shop is open it has
  // the keyboard, and nothing behind it (backpack, toolbar, the farmer) sees keys
  window.addEventListener('keydown', (e) => {
    if (!open || !active()) return;
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
      tabEl.textContent = shop.title;
      fillStock();
      say(lines('hello'));
      render();
    }
    onOpenChange?.(open);
  }

  return {
    // config: whose shop (MERCHANT, the default, or a neighbour's: main.js)
    open: (config = MERCHANT) => {
      shop = config;
      setOpen(true);
    },
    close: () => setOpen(false),
    isOpen: () => open,
    whose: () => (open ? shop.title : null),
  };
}
