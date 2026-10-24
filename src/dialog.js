import './dialog.css';
import { ITEMS, spriteURL } from './items.js';
import { PIECES } from '../shared/level.js';
import { NPCS } from '../shared/npcs.js';
import { FRIENDSHIP } from '../shared/balance.js';
import { el, button } from './ui/dom.js';

// ---------- Talking to a neighbour ----------
// E at a neighbour (src/npcs.js) opens this: their face and how much they
// like you, what they say, what they would like you to do for them (their
// mission now: Listen to hear it, how far it has come, Hand over once it is
// done), and Chat, Shop (once you have done them the good turn that opens
// it) and Bye.
//
//   E / Esc / ×   close

const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

// ---------- Their faces ----------
// 16x16 pixel art, as the items are (items.js spriteURL), drawn from how
// each dresses (shared/npcs.js `look`): a face, their hair, beard and hat,
// their shirt at the bottom, and an outline round it all
const SKIN = '#ffcc99';
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
function portraitOf(id) {
  const look = NPCS[id].look;
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
  };
  fill(2, 13, 13, 15, 't'); // shoulders
  fill(6, 11, 9, 12, 's'); // neck
  fill(4, 5, 11, 11, 's');
  fill(3, 6, 12, 10, 's');
  if (look.apron != null) fill(5, 13, 10, 15, 'a');
  if (look.hair != null) {
    fill(3, 4, 12, 5, 'r');
    fill(3, 6, 3, 9, 'r');
    fill(12, 6, 12, 9, 'r');
    if (look.ponytail) fill(13, 7, 14, 12, 'r');
    if (look.bun) fill(6, 1, 9, 3, 'r');
  }
  if (look.beard != null) {
    fill(4, 10, 11, 11, 'd');
    fill(5, 12, 10, 12, 'd');
    fill(3, 8, 3, 10, 'd');
    fill(12, 8, 12, 10, 'd');
  }
  g[8][5] = 'e';
  g[8][10] = 'e';
  g[9][4] = 'c';
  g[9][11] = 'c';
  g[10][7] = look.beard != null ? 'D' : 'm';
  g[10][8] = look.beard != null ? 'D' : 'm';
  const style = look.hatStyle ?? 'straw';
  if (style === 'straw') {
    fill(5, 1, 10, 3, 'h');
    fill(5, 3, 10, 3, 'b');
    fill(1, 4, 14, 4, 'h');
  } else if (style === 'cap') {
    fill(4, 2, 11, 4, 'h');
    fill(3, 5, 9, 5, 'h');
  } else if (style === 'souwester') {
    fill(5, 1, 10, 2, 'h');
    fill(4, 3, 11, 4, 'h');
    fill(2, 5, 13, 5, 'h');
    fill(2, 6, 3, 7, 'h');
    fill(12, 6, 13, 7, 'h');
  } else if (style === 'scarf') {
    fill(4, 2, 11, 4, 'b');
    fill(3, 4, 12, 5, 'b');
    fill(13, 4, 14, 6, 'b');
  }
  // an outline round everything drawn
  const out = g.map((row) => [...row]);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (g[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== '.')) out[y][x] = 'o';
    }
  }
  return {
    sprite: out.map((row) => row.join('')),
    palette: {
      o: '#3d1a04', s: SKIN, e: '#1a1a1a', c: '#ff9f8a', m: '#c0504a', t: hex(look.shirt),
      a: hex(look.apron ?? 0xffffff), r: hex(look.hair ?? 0x5a3a22), d: hex(look.beard ?? 0x5a3a22), D: '#7a7a72',
      h: hex(look.hat ?? 0xe8c66a), b: hex(look.band ?? 0xc0392b),
    },
  };
}
const portraits = {};
export const portraitURL = (id) => spriteURL((portraits[id] ??= portraitOf(id)));

// What a mission's need is, in words, with a picture: { text, icon }
export function needText(need) {
  if (need.item) return { text: ITEMS[need.item].name, icon: spriteURL(ITEMS[need.item]) };
  if (need.items) return { text: ITEMS[need.items[0]].name, icon: spriteURL(ITEMS[need.items[0]]) };
  if (need.deed === 'pet') return { text: 'Animals petted', icon: spriteURL(ITEMS.hen) };
  if (need.deed === 'fish') return { text: 'Fish landed', icon: spriteURL(ITEMS.fishing_rod) };
  if (need.built) return { text: `${PIECES[need.built].name} on your farm`, icon: spriteURL(ITEMS.wood) };
  return { text: '?', icon: '' };
}

// hearts as ♥ and ♡
export const heartText = (n) => '♥'.repeat(n) + '♡'.repeat(FRIENDSHIP.hearts - n);

// npcs: src/npcs.js. day(): the game day now. ctx(): what the missions are
// checked against ({ have(item), built(piece) }). onShop(id): open their
// shop. onOpenChange(open): the game pauses input. notify(text): a word in
// the corner. onDone(result): a mission was handed over.
export function createDialog({ npcs, day, hour, ctx, onShop, onOpenChange, notify, onDone }) {
  let open = false;
  let who = null;

  const menuEl = el('div', 'inv-menu talk-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame talk-window', menuEl);
  const tabEl = el('div', 'inv-tab inv-frame', windowEl);
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';

  const headEl = el('div', 'talk-head', windowEl);
  const faceEl = el('img', 'talk-face', headEl);
  faceEl.alt = '';
  const sayEl = el('div', 'talk-say', headEl);
  const heartsEl = el('div', 'talk-hearts', windowEl);

  const askEl = el('div', 'talk-ask', windowEl);
  const actionsEl = el('div', 'talk-actions', windowEl);
  const chatBtn = button('shop-item talk-btn', actionsEl, 'Chat', () => chat());
  const shopBtn = button('shop-item talk-btn', actionsEl, 'Shop', () => shop());
  const byeBtn = button('shop-item talk-btn', actionsEl, 'Bye', () => setOpen(false));
  byeBtn.title = 'Close (E / Esc)';

  function say(text) {
    sayEl.textContent = text;
    sayEl.classList.remove('bump');
    void sayEl.offsetWidth; // (restart the animation)
    sayEl.classList.add('bump');
  }

  function greeting(id) {
    const { lines } = NPCS[id];
    const h = hour();
    return pick(h < 12 ? lines.morning : h < 17 ? lines.day : lines.evening);
  }

  // ---------- Rendering ----------
  function render() {
    if (!who) return;
    const npc = NPCS[who];
    tabEl.textContent = `${npc.name} · ${npc.title}`;
    faceEl.src = portraitURL(who);
    heartsEl.textContent = heartText(npcs.hearts(who));
    heartsEl.title = 'How much they like you: a chat a day, and every request done';
    shopBtn.textContent = npcs.shopOpen(who) ? `Shop: ${npc.trade.toLowerCase()}` : 'Shop (locked)';
    shopBtn.classList.toggle('locked', !npcs.shopOpen(who));
    renderAsk();
  }

  function renderAsk() {
    askEl.replaceChildren();
    const st = npcs.status(who, ctx());
    const npc = NPCS[who];
    if (!st.mission) {
      askEl.className = 'talk-ask done';
      el('div', 'talk-ask-title', askEl, 'Nothing they need right now');
      el('div', 'talk-ask-text', askEl, `You have done everything ${npc.name} asked. Their thanks!`);
      return;
    }
    const { mission } = st;
    if (!st.heard) {
      askEl.className = 'talk-ask new';
      el('div', 'talk-ask-title', askEl, `${npc.name} has something to ask you`);
      button('shop-item talk-btn talk-listen', askEl, 'Listen', () => {
        npcs.listen(who);
        say(mission.intro);
        render();
      });
      return;
    }
    askEl.className = `talk-ask${st.ready ? ' ready' : ''}`;
    el('div', 'talk-ask-title', askEl, mission.title);
    const list = el('div', 'talk-needs', askEl);
    for (const n of st.needs) {
      const { text, icon } = needText(n.need);
      const row = el('div', `talk-need${n.ok ? ' ok' : ''}`, list);
      const img = el('img', 'inv-icon', row);
      img.src = icon;
      img.alt = '';
      el('span', 'talk-need-name', row, text);
      el('span', 'talk-need-count', row, `${Math.min(n.have, n.count)}/${n.count}`);
    }
    const reward = el('div', 'talk-reward', askEl);
    reward.textContent = `For it: ${rewardText(mission)}`;
    const hand = button('shop-item talk-btn talk-hand', askEl, 'Hand over', () => handOver());
    hand.disabled = !st.ready;
  }

  function rewardText(mission) {
    const g = mission.gives;
    const parts = [];
    if (g.gold) parts.push(`${g.gold}g`);
    for (const [item, n] of g.items ?? []) parts.push(`${n > 1 ? `${n} × ` : ''}${ITEMS[item].name.toLowerCase()}`);
    if (g.opens === 'shop') parts.push('their shop opens');
    else if (g.opens) parts.push(`the ${g.opens.toLowerCase()} shelf`);
    if (g.mends === 'dock') parts.push('the dock mended');
    return parts.join(', ');
  }

  // ---------- What you can do ----------
  function chat() {
    const { lines } = NPCS[who];
    const liked = npcs.chat(who, day());
    say(pick(lines.chat));
    if (liked) {
      heartsEl.classList.remove('bump');
      void heartsEl.offsetWidth;
      heartsEl.classList.add('bump');
    }
    render();
  }

  function shop() {
    if (!npcs.shopOpen(who)) return say(NPCS[who].lines.locked);
    const id = who;
    setOpen(false);
    onShop(id);
  }

  function handOver() {
    const result = npcs.handOver(who, ctx());
    if (!result) return;
    if (result.full) return say('Your bag\'s too full for what I have for you! Make some room first.');
    say(result.mission.thanks);
    onDone?.(result);
    render();
  }

  // ---------- Open / close ----------
  // Capture phase: while it is open it has the keyboard (as the shop does)
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    e.stopPropagation();
    if ((e.code === 'Escape' || e.code === 'KeyE') && !e.repeat) setOpen(false);
  }, true);
  menuEl.addEventListener('pointerdown', (e) => e.target === menuEl && setOpen(false)); // (a press outside the window: a fresh one, not the mouse events a phone makes afterwards of the tap that opened it)
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menuEl.hidden = !open;
    onOpenChange?.(open);
  }

  return {
    // Talk to id: their greeting (their introduction, the first time)
    open(id) {
      if (npcs.asleep(id)) return notify(NPCS[id].lines.asleep);
      who = id;
      const first = npcs.meet(id);
      say(first ? NPCS[id].lines.intro : greeting(id));
      render();
      setOpen(true);
    },
    close: () => setOpen(false),
    isOpen: () => open,
    refresh: () => open && render(),
  };
}
