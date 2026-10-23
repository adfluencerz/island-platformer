import './fishlog.css';
import { ITEMS, spriteURL } from './items.js';
import { FISH_LIST, ROD_NAMES, cleanLog, weightText } from '../shared/fishing.js';

// ---------- The fishing journal ----------
// Every fish there is (shared/fishing.js FISH_LIST), and of those we have
// landed how many and the heaviest: saved with the backpack (it is yours,
// wherever you fish), and shown in the bag's Fish tab. One not landed yet is
// a shadow, with where and when it bites, so there is something to go after.

const WHERE = { sea: 'The sea', pond: 'A fish pond', lobby: 'The wild islands' };
const hourText = (h) => `${String(h).padStart(2, '0')}:00`;

export function createFishLog() {
  let log = cleanLog(null); // { fish: [landed, heaviest grams] }

  // A fish landed: { first, record } (record: heavier than any before)
  function landed(item, grams = 0) {
    if (!FISH_LIST.some((f) => f.id === item)) return { first: false, record: false };
    const [n, best] = log[item] ?? [0, 0];
    log[item] = [n + 1, Math.max(best, grams)];
    return { first: !n, record: n > 0 && grams > best };
  }

  function el(tag, className, parent, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    parent?.appendChild(node);
    return node;
  }

  function render(root) {
    root.textContent = '';
    const found = FISH_LIST.filter((f) => log[f.id]).length;
    const head = el('div', 'sk-head', root);
    el('b', 'sk-overall', head, `Fish found: ${found} / ${FISH_LIST.length}`);
    el('span', 'sk-goal' + (found === FISH_LIST.length ? ' done' : ''), head,
      found === FISH_LIST.length ? 'Every fish there is!' : 'Bait makes bites come sooner, a lure brings rarer fish');
    const list = el('div', 'sk-list fl-list', root);
    for (const { id, water, rod, hours } of FISH_LIST) {
      const got = log[id];
      const card = el('div', 'sk-card fl-card' + (got ? '' : ' unseen'), list);
      const icon = el('img', 'fl-icon', card);
      icon.src = spriteURL(ITEMS[id]);
      icon.alt = '';
      const text = el('div', 'fl-text', card);
      el('b', 'sk-name', text, got ? ITEMS[id].name : '???');
      const when = hours ? `${hourText(hours[0])} to ${hourText(hours[1])}` : 'any time';
      el('div', 'fl-hint', text, `${WHERE[water]}, ${when}${rod ? ` · ${ITEMS[ROD_NAMES[rod]].name.toLowerCase()} or better` : ''}`);
      if (got) el('div', 'sk-xp', text, `Landed ${got[0]}${got[1] ? ` · heaviest ${weightText(got[1])}` : ''}`);
    }
  }

  return {
    landed,
    best: (item) => log[item]?.[1] ?? 0,
    render,
    serialize: () => structuredClone(log),
    restore(saved) {
      log = cleanLog(saved);
    },
  };
}
