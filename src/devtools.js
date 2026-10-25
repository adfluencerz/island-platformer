import './devtools.css';
import { el, button } from './ui/dom.js';
import { devToolsOn } from '../shared/constants.js';

// ---------- Developer tools ----------
// A panel of things for trying the game out, in tabs: the world (giants, the
// sky isles, finds, regrowing), items (anything, by name), the player (speed,
// skills, getting about), the farm (the time of day) and a live readout.
// ` opens and closes it on a keyboard; on a touch screen, holding the coin
// counter does. It can be dragged by its title, and keeps where it was and
// the tab it was on (in this browser). Who gets it is DEV_TOOLS in
// shared/constants.js (everyone, for now).
//
// api (main.js): each action does its thing and returns what to say about it
// (or nothing). giant(kind), skyFoot(), skyStyle(), find(), regrow();
// items(): [[id, name]] of everything there is; give(id, count), gold(n),
// oldKey(), bossKeys(); speed(n) (1: normal; and speed() what it is),
// plaza(), skills(xp) (to each skill; Infinity: the top); clock(hour) (on to
// the next time it is that hour), later(hours); info(): [[label, value]].
// The valley: places(): [[id, name]] to go to, goTo(id); neighbours():
// [[id, name]], finish(id) (their request now, done), hearts() (all five, with
// all of them), forget() (nobody met); forage() (something wild, now).
const STORE = 'tp.dev';
const TABS = ['World', 'Items', 'Player', 'Farm', 'Valley', 'Info'];
const HOLD_MS = 1500; // holding the coin counter this long opens it on a touch screen

export function createDevTools(api) {
  if (!devToolsOn(import.meta.env.DEV)) return;
  let kept = {};
  try {
    kept = JSON.parse(localStorage.getItem(STORE)) ?? {};
  } catch {}
  const keep = (more) => {
    kept = { ...kept, ...more };
    try {
      localStorage.setItem(STORE, JSON.stringify(kept));
    } catch {}
  };

  const panel = el('div', 'dev inv-frame', document.body);
  panel.hidden = true;
  const head = el('div', 'dev-head', panel);
  el('b', 'dev-title', head, 'Developer tools');
  button('dev-x', head, '×', () => setOpen(false)).title = 'Close (`)';
  const tabsEl = el('div', 'dev-tabs', panel);
  const body = el('div', 'dev-body', panel);
  const status = el('div', 'dev-status', panel);

  // ---- what each tab has ----
  const say = (text) => {
    status.textContent = text ?? '';
    status.classList.remove('flash');
    void status.offsetWidth;
    if (text) status.classList.add('flash');
  };
  const act = (fn) => () => say(fn());
  const section = (parent, title, note) => {
    const s = el('div', 'dev-section', parent);
    el('div', 'dev-h', s, title);
    if (note) el('div', 'dev-note', s, note);
    return el('div', 'dev-row', s);
  };
  const btn = (row, label, fn, title) => {
    const b = button('dev-btn', row, label, act(fn));
    if (title) b.title = title;
    return b;
  };

  const pages = {};
  const page = (name) => (pages[name] = el('div', 'dev-page', body));

  // World
  {
    const p = page('World');
    let row = section(p, 'Giants', 'The nearest standing one grows into a giant (on the farm, or in a lobby)');
    btn(row, 'Giant tree', () => api.giant('tree'));
    btn(row, 'Giant rock', () => api.giant('rock'));
    row = section(p, 'Sky isles', 'In a lobby');
    btn(row, 'Go to a stair', () => api.skyFoot());
    btn(row, 'Next style', () => api.skyStyle());
    row = section(p, 'Your farm', 'Played alone');
    btn(row, 'A find, now', () => api.find(), 'Something turns up on the grass, as now and then it does');
    btn(row, 'Regrow everything', () => api.regrow(), 'Every felled tree and broken rock comes back');
  }

  // Items
  {
    const p = page('Items');
    const row = section(p, 'Give', 'Any item, by name or id');
    const list = el('datalist', '', p);
    list.id = 'dev-items';
    for (const [id, name] of api.items()) el('option', '', list).value = `${name} (${id})`;
    const what = el('input', 'dev-input dev-what', row);
    what.setAttribute('list', 'dev-items');
    what.placeholder = 'Wood, golden seeds, koi…';
    const count = el('input', 'dev-input dev-count', row);
    count.type = 'number';
    count.min = '1';
    count.max = '999';
    count.value = '1';
    const give = () => {
      const text = what.value.trim().toLowerCase();
      const found = api.items().find(([id, name]) => text === id || text === name.toLowerCase() || text === `${name} (${id})`.toLowerCase())
        ?? api.items().find(([id, name]) => name.toLowerCase().startsWith(text) || id.startsWith(text));
      if (!text || !found) return say('No such item');
      say(api.give(found[0], Math.max(1, Math.min(999, Math.floor(Number(count.value)) || 1))));
    };
    button('dev-btn dev-go', row, 'Give', give);
    what.addEventListener('keydown', (e) => e.key === 'Enter' && give());
    const quick = section(p, 'Quick');
    btn(quick, '+1,000 gold', () => api.gold(1000));
    btn(quick, '+10,000 gold', () => api.gold(10000));
    btn(quick, '99 wood', () => api.give('wood', 99));
    btn(quick, '99 stone', () => api.give('stone', 99));
    btn(quick, '50 flax', () => api.give('flax', 50));
    btn(quick, 'Seeds', () => api.seeds(), 'Twenty of every seed');
    btn(quick, 'An old key', () => api.oldKey(), 'For the locked chests on the sky isles');
    btn(quick, 'Boss keys', () => api.bossKeys(), 'A full set of each boss\'s key pieces');
  }

  // Player
  let speedBtns = [];
  {
    const p = page('Player');
    const row = section(p, 'Walking speed');
    speedBtns = [1, 2, 4].map((n) => {
      const b = button('dev-btn', row, `${n}×`, () => {
        api.speed(n);
        showSpeed();
        say(n === 1 ? 'Walking at the usual speed' : `Walking ${n}× as fast`);
      });
      b.dataset.n = n;
      return b;
    });
    const go = section(p, 'Getting about');
    btn(go, 'Back to the plaza', () => api.plaza(), 'Where farmers arrive');
    const sk = section(p, 'Skills', 'Two of each skill\'s levels up, or all the way');
    btn(sk, '+250 XP each', () => api.skills(250));
    btn(sk, 'Top every skill', () => api.skills(Infinity), 'And the double jump with it');
  }
  const showSpeed = () => speedBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === api.speed()));

  // Farm
  {
    const p = page('Farm');
    const row = section(p, 'Time of day', 'On your farm played alone: on to the next one (crops grow and machines work meanwhile)');
    for (const [label, hour] of [['Morning', 6], ['Noon', 12], ['Evening', 18], ['Night', 22]]) btn(row, label, () => api.clock(hour));
    const skip = section(p, 'Skip ahead');
    btn(skip, '+1 hour', () => api.later(1));
    btn(skip, '+6 hours', () => api.later(6));
    btn(skip, '+1 day', () => api.later(24));
  }

  // The valley round the farm, and the neighbours
  {
    const p = page('Valley');
    const go = section(p, 'Go to', 'On your farm');
    for (const [id, name] of api.places()) btn(go, name, () => api.goTo(id));
    const who = section(p, 'Requests', 'The neighbour\'s request now, done (what it gives, given; nothing taken)');
    for (const [id, name] of api.neighbours()) btn(who, name, () => api.finish(id));
    btn(who, 'Five hearts with them all', () => api.hearts(), 'Met, and as fond of you as can be: what they tell you at 2 and 4 hearts is open to you');
    btn(who, 'Forget them all', () => api.forget(), 'Nobody met, nothing asked, no shops open, nothing they have told you');
    const wild = section(p, 'Forage', 'On your farm played alone');
    btn(wild, 'Something wild, now', () => api.forage(), 'In a biome out in the valley, as now and then it turns up');
  }

  // Info
  const infoEl = el('div', 'dev-info', page('Info'));
  let frames = 0;
  let fps = 0;
  let fpsAt = performance.now();
  const countFrames = () => {
    frames++;
    const now = performance.now();
    if (now - fpsAt >= 1000) {
      fps = Math.round((frames * 1000) / (now - fpsAt));
      frames = 0;
      fpsAt = now;
    }
    if (!panel.hidden) requestAnimationFrame(countFrames);
  };
  const showInfo = () => {
    if (panel.hidden || tab !== 'Info') return;
    infoEl.replaceChildren();
    for (const [label, value] of [['Frames a second', fps], ...api.info()]) {
      el('span', 'dev-label', infoEl, label);
      el('span', '', infoEl, String(value));
    }
  };
  setInterval(showInfo, 500);

  // ---- tabs ----
  let tab = TABS.includes(kept.tab) ? kept.tab : TABS[0];
  const tabBtns = TABS.map((name) => button('dev-tab', tabsEl, name, () => setTab(name)));
  function setTab(name) {
    tab = name;
    keep({ tab });
    tabBtns.forEach((b) => b.classList.toggle('on', b.textContent === name));
    for (const [n, pg] of Object.entries(pages)) pg.hidden = n !== name;
    say('');
    showInfo();
  }
  setTab(tab);

  // ---- open, close, and dragging it about ----
  function place(x, y) {
    const w = panel.offsetWidth || 300;
    const h = panel.offsetHeight || 200;
    const px = Math.max(0, Math.min(window.innerWidth - w, x));
    const py = Math.max(0, Math.min(window.innerHeight - h, y));
    panel.style.left = `${px}px`;
    panel.style.top = `${py}px`;
    return [px, py];
  }
  function setOpen(open) {
    panel.hidden = !open;
    if (!open) return;
    place(kept.x ?? 12, kept.y ?? Math.round(window.innerHeight / 2 - panel.offsetHeight / 2));
    showSpeed();
    showInfo();
    requestAnimationFrame(countFrames);
  }
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { id: e.pointerId, dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (drag?.id === e.pointerId) place(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = (e) => {
    if (drag?.id !== e.pointerId) return;
    drag = null;
    keep({ x: panel.offsetLeft, y: panel.offsetTop });
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => !panel.hidden && place(panel.offsetLeft, panel.offsetTop));
  // (keys typed into its inputs are its own, not the game's)
  panel.addEventListener('keydown', (e) => e.target.closest('input') && e.key !== 'Escape' && e.stopPropagation());

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.repeat || e.target.closest?.('input, textarea, select')) return;
    setOpen(panel.hidden);
  });
  // a touch screen: hold the coin counter
  let holdTimer = 0;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !e.target.closest?.('.inv-funds')) return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => setOpen(panel.hidden), HOLD_MS);
  });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, () => clearTimeout(holdTimer));
}
