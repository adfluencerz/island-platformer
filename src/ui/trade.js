import './trade.css';
import { ITEMS, spriteURL } from '../items.js';
import { COLS, SLOT_COUNT, CATEGORIES } from '../inventory.js';
import { el, button, placeTip } from './dom.js';
import { TRADE, tradeable } from '../../shared/trade.js';

// ---------- Trading with another farmer, in a lobby ----------
// The lobby keeps the trade (shared/trade.js): what each puts up, and who is
// ready. This window shows it: what you give and what they give, your
// backpack to offer from, and the gold you put in. Changing an offer takes
// back both "ready"s; once both are ready the lobby says it's done, and
// main.js swaps the things over. Built from the backpack's pieces, like the
// chest (src/chest.js).
//
//   click a backpack slot    offer the stack (right click: one more)
//   click your offer         take it back (right click: one)
//   Ready                    happy with the swap as it stands (again: not)
//   × / Esc                  call it off
//
// And a note when someone asks to trade (asked), with Trade and No thanks.

// inventory: from createInventory. onOpenChange(open): the game pauses input.
// onOffer({ items, gold }), onReady(ready, v), onCancel(), onAnswer(id): say
// yes to farmer id's ask (TRADE_ASK them back)
export function createTrade({ inventory, onOpenChange, onOffer, onReady, onCancel, onAnswer, parent = document.body, active = () => true }) {
  let open = false;
  let name = ''; // whom with
  let state = null; // the lobby's TRADE: { with, v, n, mine, theirs, ready, theirsReady }
  let sent = 0; // offers we've made (TRADE's n says which the lobby has: till it has the last, ours stands)

  // ---------- The window ----------
  const menuEl = el('div', 'inv-menu trade-menu', parent);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame trade-window', menuEl);
  const tabEl = el('div', 'inv-tab inv-frame', windowEl);
  const closeBtn = button('inv-close', windowEl, '×', () => onCancel());
  closeBtn.title = 'Call it off (Esc)';
  const sides = el('div', 'trade-sides', windowEl);
  const mineSide = el('div', 'trade-side', sides);
  el('div', 'chest-heading', mineSide, 'You give');
  const mineEl = el('div', 'chest-items trade-offer', mineSide);
  const goldRow = el('label', 'trade-gold', mineSide);
  el('img', 'inv-icon', goldRow).src = spriteURL(ITEMS.coin);
  const goldIn = el('input', 'ui-input trade-gold-in', goldRow);
  goldIn.type = 'number';
  goldIn.min = '0';
  goldIn.step = '1';
  goldIn.placeholder = '0';
  el('span', 'ui-muted', goldRow, 'gold');
  const theirSide = el('div', 'trade-side', sides);
  const theirHeading = el('div', 'chest-heading', theirSide);
  const theirsEl = el('div', 'chest-items trade-offer', theirSide);
  const theirGold = el('div', 'trade-gold', theirSide);

  const bar = el('div', 'chest-bar', windowEl);
  const statusEl = el('div', 'trade-status', bar);
  const readyBtn = button('inv-button trade-ready', bar, 'Ready', () => {
    if (state && (state.ready || !problem())) onReady(!state.ready, state.v);
  });
  el('div', 'chest-heading', windowEl, 'Offer from your backpack');
  const gridEl = el('div', 'inv-grid', windowEl);
  const slotViews = Array.from({ length: SLOT_COUNT }, (_, i) => {
    if (i === COLS) el('div', 'inv-divider', gridEl);
    const slot = el('div', 'inv-slot', gridEl);
    slot.dataset.offer = i;
    const img = el('img', 'inv-icon', slot);
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'inv-count', slot);
    return { root: slot, img, count };
  });
  const hintEl = el('div', 'inv-hint chest-hint', windowEl);
  el('span', 'mouse-only', hintEl, 'Click your things: offer the stack (right click: one more) · Click your offer: take it back');
  el('span', 'touch-only', hintEl, 'Tap your things to offer them · Tap your offer to take it back');
  const tooltipEl = el('div', 'inv-tooltip inv-frame', parent);
  tooltipEl.hidden = true;

  // ---------- Someone asks ----------
  const askEl = el('div', 'trade-ask inv-frame', parent);
  askEl.hidden = true;
  const askText = el('span', '', askEl);
  let askFrom = 0;
  let askTimer = 0;
  button('ui-btn ui-btn-small', askEl, 'Trade', () => {
    askEl.hidden = true;
    onAnswer(askFrom);
  });
  button('ui-btn ui-btn-small ui-btn-ghost', askEl, 'No thanks', () => (askEl.hidden = true));

  // ---------- What it shows ----------
  const offered = (id) => state?.mine.items[id] ?? 0;

  // Why we can't say ready: what we offer isn't all in the backpack (any
  // more), or what we'd get wouldn't fit. '' when we can.
  function problem() {
    if (!state) return 'Nothing to trade yet';
    for (const [id, n] of Object.entries(state.mine.items)) if (inventory.count(id) < n) return `You don't have ${n} ${ITEMS[id]?.name ?? id}`;
    if (inventory.gold() < state.mine.gold) return `You don't have ${state.mine.gold} gold`;
    for (const [id, n] of Object.entries(state.theirs.items)) if (!inventory.canAdd(id, n)) return 'No room in your backpack for all that';
    if (!Object.keys(state.mine.items).length && !state.mine.gold && !Object.keys(state.theirs.items).length && !state.theirs.gold) return 'Nothing to trade yet';
    return '';
  }

  function cells(parent, offer, take) {
    parent.textContent = '';
    const ids = Object.keys(offer.items);
    if (!ids.length) el('div', 'chest-empty', parent, 'Nothing');
    for (const id of ids) {
      const cell = button('inv-slot chest-cell' + (take ? '' : ' chest-locked'), parent);
      if (take) cell.dataset.back = id;
      else cell.dataset.see = id;
      const img = el('img', 'inv-icon', cell);
      img.alt = '';
      if (ITEMS[id]) img.src = spriteURL(ITEMS[id]);
      el('span', 'inv-count', cell, offer.items[id] > 1 ? String(offer.items[id]) : '');
    }
  }

  function render() {
    if (!state) return;
    tabEl.textContent = `Trading with ${name}`;
    theirHeading.textContent = `${name} gives`;
    cells(mineEl, state.mine, true);
    cells(theirsEl, state.theirs, false);
    if (document.activeElement !== goldIn) goldIn.value = state.mine.gold || '';
    goldIn.max = String(Math.min(TRADE.gold, inventory.gold()));
    theirGold.textContent = state.theirs.gold ? `+ ${state.theirs.gold} gold` : '';
    const why = problem();
    readyBtn.textContent = state.ready ? 'Not ready' : 'Ready';
    readyBtn.disabled = !state.ready && !!why;
    readyBtn.title = why;
    statusEl.textContent = state.ready && state.theirsReady ? 'Swapping…'
      : state.ready ? `Waiting for ${name}…`
      : state.theirsReady ? `${name} is ready: are you?`
      : why || 'Say Ready when you are happy with it';
    windowEl.classList.toggle('trade-theirs-ready', state.theirsReady);
    slotViews.forEach((view, i) => {
      const stack = inventory.slot(i);
      view.img.hidden = !stack;
      if (stack) view.img.src = spriteURL(ITEMS[stack.id]);
      view.count.textContent = stack && stack.count > 1 ? stack.count : '';
      view.root.classList.toggle('chest-nokeep', !!stack && !tradeable(stack.id));
    });
  }

  // Our offer, changed: shown straight away (another click builds on it),
  // and the lobby hears it (and both "ready"s go back; its TRADE settles it)
  function offer(items, gold = state.mine.gold) {
    state = { ...state, mine: { items, gold }, ready: false, theirsReady: false };
    render();
    onOffer({ items, gold, n: ++sent });
  }

  function add(i, count) {
    const stack = inventory.slot(i);
    if (!stack || !state) return;
    if (!tradeable(stack.id)) return inventory.notify('That can\'t be traded');
    const items = { ...state.mine.items };
    if (!items[stack.id] && Object.keys(items).length >= TRADE.kinds) return inventory.notify(`${TRADE.kinds} kinds of thing at most`);
    const n = Math.min(TRADE.most, inventory.count(stack.id), offered(stack.id) + (count === Infinity ? stack.count : count));
    if (n === offered(stack.id)) return;
    items[stack.id] = n;
    offer(items);
  }

  function takeBack(id, count) {
    if (!state) return;
    const items = { ...state.mine.items };
    items[id] = Math.max(0, offered(id) - count);
    if (!items[id]) delete items[id];
    offer(items);
  }

  function showTooltip(target, x, y) {
    let def = null;
    let note = '';
    if (target?.dataset.back || target?.dataset.see) {
      const id = target.dataset.back || target.dataset.see;
      def = ITEMS[id];
      note = target.dataset.back ? `You give ${offered(id)}: click to take it back` : `${name} gives ${state?.theirs.items[id] ?? 0}`;
    } else if (target?.dataset.offer) {
      const stack = inventory.slot(Number(target.dataset.offer));
      def = stack && ITEMS[stack.id];
      note = def && (tradeable(stack.id) ? (offered(stack.id) ? `${offered(stack.id)} offered` : 'Click to offer it') : 'That can\'t be traded');
    }
    tooltipEl.hidden = !def;
    if (!def) return;
    tooltipEl.innerHTML = `
      <div class="inv-tt-name">${def.name}</div>
      <div class="inv-tt-cat" style="color:${CATEGORIES[def.category]}">${def.category}</div>
      <div class="inv-tt-meta">${note}</div>`;
    placeTip(tooltipEl, x, y);
  }

  gridEl.addEventListener('mousedown', (e) => {
    const slot = e.target.closest('[data-offer]');
    if (!slot || (e.button !== 0 && e.button !== 2)) return;
    add(Number(slot.dataset.offer), e.button === 2 ? 1 : Infinity);
  });
  mineEl.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('[data-back]');
    if (!cell || (e.button !== 0 && e.button !== 2)) return;
    takeBack(cell.dataset.back, e.button === 2 ? 1 : Infinity);
  });
  goldIn.addEventListener('change', () => {
    if (!state) return;
    const gold = Math.max(0, Math.min(Math.floor(Number(goldIn.value) || 0), inventory.gold(), TRADE.gold));
    goldIn.value = gold || '';
    if (gold !== state.mine.gold) offer(state.mine.items, gold);
  });
  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  menuEl.addEventListener('pointermove', (e) => showTooltip(e.target.closest('[data-offer], [data-back], [data-see]'), e.clientX, e.clientY));

  // Capture phase, like the chest's: while the window is open it has the
  // keyboard (the gold box still gets what is typed)
  window.addEventListener('keydown', (e) => {
    if (!open || !active()) return;
    if (e.code === 'Escape' && !e.repeat) onCancel();
    if (e.code === 'Enter' && e.target === goldIn) goldIn.blur();
    if (e.target !== goldIn) e.stopPropagation();
  }, true);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menuEl.hidden = !open;
    tooltipEl.hidden = true;
    if (!open) state = null;
    onOpenChange?.(open);
  }

  return {
    isOpen: () => open,
    // TRADE: how it stands (opens the window); withName: whom with
    show(next, withName) {
      if (!open) sent = 0;
      state = next.n < sent ? { ...next, mine: state.mine, ready: false } : next; // (an older offer of ours: the one we've made since stands)
      name = withName;
      askEl.hidden = true;
      setOpen(true);
      render();
    },
    close: () => setOpen(false),
    refresh: () => open && render(), // (the backpack changed)
    // TRADE_ASKED: farmer `from` (`who`) asks
    asked(from, who) {
      askFrom = from;
      askText.textContent = `${who} wants to trade`;
      askEl.hidden = false;
      clearTimeout(askTimer);
      askTimer = setTimeout(() => (askEl.hidden = true), TRADE.askFor);
    },
    // (out of the lobby: no asks)
    reset() {
      askEl.hidden = true;
      setOpen(false);
    },
  };
}
