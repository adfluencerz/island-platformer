import { ITEMS } from './items.js';
import { REQUESTS } from '../shared/balance.js';
import { mulberry32, hashSeed } from '../shared/worldgen.js';

// ---------- The merchant's requests ----------
// Each game day the merchant at the stall asks for some of one thing (the
// same for everyone that day: it is rolled from the day), and pays well for
// it: REQUESTS in shared/balance.js. Handed over at the stall (src/shop.js);
// once a day. Which day's request was done is kept in this browser.
const STORE = 'tp.request';

// The request for game day `day`: { day, item, count, gold, bonus }
export function requestFor(day) {
  const rand = mulberry32(hashSeed(`request/${day}`));
  const wants = REQUESTS.wants.filter(([item]) => ITEMS[item]?.sell).slice(0, day <= REQUESTS.easy ? 1 : undefined);
  const [item, least, most] = wants[Math.floor(rand() * wants.length)];
  const count = least + Math.floor(rand() * (most - least + 1));
  const gold = Math.round((count * ITEMS[item].sell * REQUESTS.pays + REQUESTS.plus) / 10) * 10;
  return { day, item, count, gold, bonus: rand() < REQUESTS.bonus };
}

// day(): the game day now. inventory: the backpack (count, remove, earn, add).
export function createRequests({ day, inventory }) {
  let doneDay = null;
  try {
    doneDay = JSON.parse(localStorage.getItem(STORE))?.done ?? null;
  } catch {}

  return {
    // Today's request, and whether it is done
    today() {
      const d = day();
      return { ...requestFor(d), done: doneDay === d };
    },
    // Hand today's over: true if it was (enough in the backpack, not done yet)
    handOver() {
      const r = this.today();
      if (r.done || inventory.count(r.item) < r.count) return false;
      inventory.remove(r.item, r.count);
      inventory.earn(r.gold);
      if (r.bonus) inventory.add('golden_seeds', 1);
      doneDay = r.day;
      try {
        localStorage.setItem(STORE, JSON.stringify({ done: doneDay }));
      } catch {}
      return true;
    },
  };
}
