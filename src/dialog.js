import './dialog.css';
import { ITEMS, spriteURL } from './items.js';
import { PIECES } from '../shared/level.js';
import { NPCS, rewardText } from '../shared/npcs.js';
import { textOf, followUps } from '../shared/talk.js';
import { FRIENDSHIP } from '../shared/balance.js';
import { el, button } from './ui/dom.js';

// ---------- Talking to a neighbour ----------
// E at a neighbour (src/npcs.js) opens this: their face and how much they
// like you, what they say, and a list of what you can say back (numbered:
// click or tap one, or press its number). What is in it depends on what is on
// between you and them (shared/talk.js `hubOptions`):
//   a message you carry for them, a moment of theirs waiting (starred), their
//   request (ask what it is: accept it, ask what is in it for you, or put it
//   off; ask how it is going; say you have brought it, and pick your reward
//   if they offer a choice), and a chat: a menu of what you can ask about,
//   each answer leading to more, some of which they remember.
// Under it the request you have taken on, how far it has come, and Shop (once
// you have done them the good turn that opens it) and Bye.
//
//   1-9           the answer with that number
//   Up / Down     the answer before / after, Enter to say it
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
  if (need.items) return { text: need.label ?? ITEMS[need.items[0]].name, icon: spriteURL(ITEMS[need.items[0]]) };
  if (need.deed === 'pet') return { text: 'Animals petted', icon: spriteURL(ITEMS.hen) };
  if (need.deed === 'fish') return { text: 'Fish landed', icon: spriteURL(ITEMS.fishing_rod) };
  if (need.deed === 'harvest') return { text: 'Crops picked', icon: spriteURL(ITEMS.turnip) };
  if (need.deed === 'chop') return { text: 'Trees felled', icon: spriteURL(ITEMS.axe) };
  if (need.deed === 'mine') return { text: 'Rocks broken', icon: spriteURL(ITEMS.pickaxe) };
  if (need.deed === 'cook') return { text: 'Meals cooked', icon: spriteURL(ITEMS.fried_egg) };
  if (need.deed === 'tell') return { text: `Tell ${NPCS[need.who].name}`, icon: portraitURL(need.who) };
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
  let options = []; // what you can say now: [{ text, hot, isNew, run }]
  let said = new Set(); // (what you have asked in this topic: not offered again)
  let inHub = true; // (on the first list: the request you have taken on is shown there only)

  const menuEl = el('div', 'inv-menu talk-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame talk-window', menuEl);
  const tabEl = el('div', 'inv-tab inv-frame', windowEl);
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';

  // (what they say, their request and what you can answer scroll, on a screen
  // too short for it all; Shop and Bye stay in sight under it)
  const bodyEl = el('div', 'talk-body', windowEl);
  const headEl = el('div', 'talk-head', bodyEl);
  const faceEl = el('img', 'talk-face', headEl);
  faceEl.alt = '';
  const sayEl = el('div', 'talk-say', headEl);
  const heartsEl = el('div', 'talk-hearts', bodyEl);

  const askEl = el('div', 'talk-ask', bodyEl);
  const optionsEl = el('div', 'talk-options', bodyEl);
  const actionsEl = el('div', 'talk-actions', windowEl);
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
  function renderHeader() {
    const npc = NPCS[who];
    tabEl.textContent = `${npc.name} · ${npc.title}`;
    faceEl.src = portraitURL(who);
    heartsEl.textContent = heartText(npcs.hearts(who));
    heartsEl.title = 'How much they like you: a chat a day, what they tell you, and every request done';
    shopBtn.textContent = npcs.shopOpen(who) ? `Shop: ${npc.trade.toLowerCase()}` : 'Shop (locked)';
    shopBtn.classList.toggle('locked', !npcs.shopOpen(who));
  }

  // The request you have taken on, and how far it has come
  function renderCard() {
    askEl.replaceChildren();
    const st = npcs.status(who, ctx());
    askEl.hidden = !inHub || (!!st.mission && !st.heard);
    if (askEl.hidden) return;
    if (!st.mission) {
      askEl.className = 'talk-ask done';
      el('div', 'talk-ask-title', askEl, 'Nothing they need right now');
      el('div', 'talk-ask-text', askEl, `You have done everything ${NPCS[who].name} asked. Their thanks!`);
      return;
    }
    const { mission } = st;
    askEl.className = `talk-ask${st.ready ? ' ready' : ''}`;
    el('div', 'talk-ask-title', askEl, `${mission.title}${st.ready ? ' · ready!' : ''}`);
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
    el('div', 'talk-reward', askEl, `For it: ${rewardOf(mission)}`);
  }

  const rewardOf = (mission) => rewardText(mission, (item) => ITEMS[item].name);

  // What you can say now (hub: it is the first list). The first thing they are waiting on is starred.
  function setOptions(list, hub = false) {
    options = list;
    inHub = hub;
    optionsEl.replaceChildren();
    list.forEach((o, i) => {
      const b = button(`shop-item talk-option${o.hot ? ' hot' : ''}${o.isNew ? ' new' : ''}${o.back ? ' back' : ''}`, optionsEl, '', () => choose(i));
      el('span', 'talk-key', b, String(i + 1));
      el('span', 'talk-option-text', b, o.text);
    });
    renderCard();
  }

  // Say option i (and how it went: they may like you more for it)
  function choose(i) {
    const o = options[i];
    if (!o) return;
    const before = npcs.state(who).points;
    const hearts = npcs.hearts(who);
    o.run();
    if (!open) return; // (it was the shop: the window is shut)
    renderHeader();
    renderCard();
    if (npcs.state(who).points > before) {
      heartsEl.classList.remove('bump');
      void heartsEl.offsetWidth;
      heartsEl.classList.add('bump');
    }
    if (npcs.hearts(who) > hearts) notify(`${NPCS[who].name} likes you more ♥`);
  }

  // ---------- The first list ----------
  function showHub(line) {
    if (line) say(line);
    said = new Set();
    setOptions(npcs.hub(who, ctx()).map((o) => ({ text: o.text, hot: o.hot, run: () => runHub(o) })), true);
  }

  function runHub(o) {
    const npc = NPCS[who];
    if (o.kind === 'chat') return showChat(pick(npc.lines.open));
    if (o.kind === 'ask') return showAsk();
    if (o.kind === 'handover') return handOver();
    if (o.kind === 'moment') return talk(o.node);
    if (o.kind === 'progress') return say(npcs.status(who, ctx()).mission.waiting);
    if (o.kind === 'deliver') {
      const told = npcs.tell(who, o.from);
      if (told) notify(`You told ${npc.name}. Back to ${NPCS[o.from].name}!`);
      return showHub(told?.reply);
    }
  }

  // ---------- Their request ----------
  function showAsk() {
    const { mission } = npcs.status(who, ctx());
    const { lines } = NPCS[who];
    say(mission.intro);
    setOptions([
      { text: 'Happy to help.', hot: true, run: () => (npcs.listen(who), showHub(pick(lines.accepted))) },
      { text: 'What would I get for it?', run: () => say(pick(lines.reward).replace('%s', rewardText(mission, (item) => ITEMS[item].name, true))) },
      { text: 'Not right now.', back: true, run: () => showHub(pick(lines.later)) },
    ]);
  }

  function handOver() {
    const { mission } = npcs.status(who, ctx());
    if (!mission.gives.choose) return settle(0);
    // their reward is yours to pick from
    say(NPCS[who].lines.choose);
    setOptions([
      ...mission.gives.choose.map((c, i) => ({ text: c.label, hot: true, run: () => settle(i) })),
      { text: 'Let me think about it.', back: true, run: () => showHub() },
    ]);
  }

  function settle(picked) {
    const result = npcs.handOver(who, ctx(), picked);
    if (!result) return showHub();
    if (result.full) {
      say('Your bag\'s too full for what I have for you! Make some room first.');
      return showHub();
    }
    onDone?.(result);
    showHub(result.mission.thanks);
  }

  // ---------- A chat ----------
  function showChat(line) {
    if (line) say(line);
    said = new Set();
    setOptions([
      ...npcs.topics(who).map(({ node, isNew }) => ({ text: node.text, isNew, run: () => talk(node) })),
      { text: 'Just some small talk.', run: smallTalk },
      { text: 'Never mind.', back: true, run: () => showHub() },
    ]);
  }

  function smallTalk() {
    npcs.chat(who, day());
    say(pick(NPCS[who].lines.chat));
  }

  // You say node (a topic, or a follow-up): their answer, and what you can say next
  function talk(node) {
    const reward = npcs.hear(who, node);
    if (reward?.full) return say('Your bag\'s too full for what I\'d like to give you! Make some room, and ask me again.');
    npcs.chat(who, day());
    const c = npcs.view(who);
    say(textOf(node, c));
    if (!node.parent) said = new Set();
    said.add(node);
    const next = followUps(node, c);
    if (next.length) return setOptions(more(node, next));
    if (node.root.event) return showHub(); // (their moment is over: what they said stays)
    const left = node.parent ? followUps(node.parent, c).filter((n) => !said.has(n)) : [];
    if (left.length) return setOptions(more(node.parent, left));
    showChat();
  }

  // The follow-ups to a node, and a way back
  function more(node, list) {
    const out = list.map((n) => ({ text: n.text, run: () => talk(n) }));
    // (a moment of theirs: leave it for another time, or, if you have shared it, go back to the chat)
    if (!node.root.event) out.push({ text: 'Something else.', back: true, run: () => showChat() });
    else if (npcs.state(who).seen.includes(node.root.id)) out.push({ text: 'Something else.', back: true, run: () => showChat() });
    else out.push({ text: 'Another time.', back: true, run: () => showHub() });
    return out;
  }

  function shop() {
    if (!npcs.shopOpen(who)) return say(NPCS[who].lines.locked);
    const id = who;
    setOpen(false);
    onShop(id);
  }

  // ---------- Open / close ----------
  // Capture phase: while it is open it has the keyboard (as the shop does)
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    e.stopPropagation();
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyE') return setOpen(false);
    const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (n) return choose(Number(n[1]) - 1);
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      const rows = [...optionsEl.children];
      const step = e.code === 'ArrowDown' ? 1 : -1;
      const at = rows.indexOf(document.activeElement);
      rows[at < 0 ? (step > 0 ? 0 : rows.length - 1) : (at + step + rows.length) % rows.length]?.focus();
    }
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
      renderHeader();
      showHub(first ? NPCS[id].lines.intro : npcs.status(id, ctx()).mission ? greeting(id) : NPCS[id].lines.done);
      setOpen(true);
    },
    close: () => setOpen(false),
    isOpen: () => open,
    refresh() {
      if (!open) return;
      renderHeader();
      renderCard();
    },
  };
}
