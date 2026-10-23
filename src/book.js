import './book.css';
import { ITEMS, spriteURL } from './items.js';
import { RELICS } from './relics.js';
import { CROP_PRODUCE } from '../shared/level.js';
import { BOSSES, DISHES } from '../shared/balance.js';
import { FISH_LIST } from '../shared/fishing.js';

// ---------- The collection book ----------
// Everything there is to grow, gather, catch, cook and find, a page of it
// in the bag's Book tab (or O): what you have ever had in your backpack in
// color, the rest a shadow with ??? for a name, and how many of each part
// you have. Fish count once landed (the fishing journal, src/fishlog.js), and
// a boss once beaten (its statue). What you've had is saved with the
// backpack (`found`); a farm from before the book starts it from what is in
// the backpack now.

// The parts of the book: [title, item ids]
const PARTS = [
  ['Crops', [...new Set(Object.values(CROP_PRODUCE))]],
  ['From the wild islands', ['berries', 'mushroom', 'heather', 'cattail', 'bluebell', 'pumpkin', 'fern', 'seashell', 'strawberry']], // (an item the game doesn't have yet is left out)
  ['Rare finds', ['golden_seeds', 'gem', 'key', 'recipe_card']],
  ['From the animals and the machines', ['egg', 'large_egg', 'milk', 'wool', 'honey', 'cheese', 'mayonnaise', 'cloth']],
  ['Dishes', Object.keys(DISHES)],
  ['Fish', FISH_LIST.map((f) => f.id)],
  ['Relics of the sky isles', Object.keys(RELICS)],
  ['Bosses beaten', Object.values(BOSSES).map((b) => b.statue)],
].map(([title, ids]) => [title, ids.filter((id) => ITEMS[id])]);
const COLLECTED = new Set(PARTS.flatMap(([, ids]) => ids));
const FISH = new Set(FISH_LIST.map((f) => f.id));
const STATUES = new Map(Object.entries(BOSSES).map(([id, b]) => [b.statue, id]));

// fishLog: the fishing journal (count(id): how many landed). beaten(): the
// boss ids beaten so far.
export function createBook({ fishLog, beaten }) {
  const found = new Set(); // item ids ever had

  // Do we have this in the book?
  function has(id) {
    if (FISH.has(id)) return found.has(id) || fishLog.count(id) > 0;
    if (STATUES.has(id)) return beaten().includes(STATUES.get(id));
    return found.has(id);
  }

  // An item came into the backpack: true if it is new to the book
  function saw(id) {
    if (!COLLECTED.has(id) || STATUES.has(id) || has(id)) return false;
    found.add(id);
    return true;
  }

  function el(tag, className, parent, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    parent?.appendChild(node);
    return node;
  }

  const counts = () => {
    const parts = PARTS.map(([title, ids]) => [title, ids, ids.filter(has).length]);
    return { parts, got: parts.reduce((n, [, , got]) => n + got, 0), of: COLLECTED.size };
  };

  function render(root) {
    root.textContent = '';
    const { parts, got, of } = counts();
    const head = el('div', 'sk-head', root);
    el('b', 'sk-overall', head, `Collection: ${got} / ${of}`);
    el('span', 'sk-goal' + (got === of ? ' done' : ''), head, got === of ? 'Every last thing on the island!' : 'Everything you have ever had counts');
    const list = el('div', 'bk-list', root);
    for (const [title, ids, n] of parts) {
      const part = el('div', 'sk-card bk-part', list);
      const top = el('div', 'sk-top', part);
      el('b', 'sk-name', top, title);
      el('span', 'bk-count' + (n === ids.length ? ' done' : ''), top, `${n} / ${ids.length}`);
      const grid = el('div', 'bk-grid', part);
      for (const id of ids) {
        const got = has(id);
        const icon = el('img', 'bk-icon' + (got ? '' : ' unseen'), grid);
        icon.src = spriteURL(ITEMS[id]);
        icon.alt = got ? ITEMS[id].name : '???';
        icon.title = got ? ITEMS[id].name : '???';
      }
    }
  }

  return {
    saw,
    has,
    counts,
    render,
    // (everything in hand now: the backpack, the farm's chest)
    seed(ids) {
      for (const id of ids) if (id && COLLECTED.has(id) && !STATUES.has(id)) found.add(id);
    },
    serialize: () => [...found].sort(),
    restore(saved) {
      found.clear();
      for (const id of Array.isArray(saved) ? saved : []) if (COLLECTED.has(id)) found.add(id);
    },
  };
}
