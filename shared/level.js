// The parts of the world the server has to know about too: what the resource
// spots can turn up, where players are put down, and how long crops take. The
// wild islands the lobbies are on (their shape, and where their spots are)
// grow from seeds in shared/worldgen.js. What the worlds look like is the
// client's business (src/maps.js, src/world.js).

export const GROUND_STAND_Y = 0.8; // player center height standing on bare ground (height 1.6 / 2)
export const SPAWN = { x: 0, z: 4 }; // the middle of the home farm's stone plaza
export const FARM_CHEST = { x: -2.8, z: 7.4 }; // the farm's chest, on a farm with helpers (src/chest.js): on the grass by the plaza

// Seconds from planting to ripe (src/crops.js draws them)
export const CROP_GROW_TIME = { turnip: 20, carrot: 30, flax: 35, sunflower: 45, golden_turnip: 60 };
// what a ripe crop gives when it is harvested (on a farm with helpers the
// server hands it out, into the farm's chest)
export const CROP_PRODUCE = { turnip: 'turnip', carrot: 'carrot', flax: 'flax', sunflower: 'sunflower', golden_turnip: 'golden_turnip' };

// ---------- Lobby resources ----------
// What can stand on a spot (each island says where its spots are). `use`: 'gather' is picked with E from nearby,
// 'touch' is collected by walking into it. `regrow`: seconds [min, max] until
// an emptied spot has something again. `loot`: [item, weight, min, max]; one
// is rolled each time the spot regrows, so a spot is a little different every
// time.
export const SPOT_KINDS = {
  bush: { use: 'gather', regrow: [35, 50], loot: [['berries', 1, 2, 3]] },
  mushroom: {
    use: 'gather',
    regrow: [25, 40],
    loot: [['mushroom', 0.95, 1, 2], ['golden_seeds', 0.05, 1, 1]],
  },
  meadow: {
    use: 'touch',
    regrow: [30, 50],
    loot: [['coin', 0.72, 1, 1], ['turnip_seeds', 0.22, 2, 4], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.04, 1, 1], ['key', 0.02, 1, 1]],
  },
  ledge: {
    use: 'touch',
    regrow: [40, 60],
    loot: [['gem', 0.45, 1, 1], ['carrot_seeds', 0.25, 2, 4], ['sunflower_seeds', 0.2, 1, 3], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.06, 1, 1], ['key', 0.04, 1, 1]],
  },
};

// ---------- Trees ----------
// Every tree on a wild island can be chopped down for wood. Where the trees
// stand is the page's business (src/maps.js grows them from the seed, the same
// for everyone); the lobby only keeps which ones are down, by their number.
// `hits`: swings with the axe to fell one. `regrow`: seconds [min, max] until
// it stands again. `wood`: [min, max] logs for whoever felled it, from a tree
// of size 1; bigger trees give more (`size`: the smallest and biggest there are,
// so a page can't claim a giant).
export const TREE = { hits: 4, regrow: [60, 120], wood: [2, 4], size: [0.8, 1.6] };

const treeSize = (size) => Math.min(TREE.size[1], Math.max(TREE.size[0], Number.isFinite(size) ? size : 1));

// Logs from felling a tree of this size. rand: () => [0, 1)
export function woodFor(size, rand = Math.random) {
  const [lo, hi] = TREE.wood;
  return Math.max(1, Math.round((lo + Math.floor(rand() * (hi - lo + 1))) * treeSize(size)));
}

// The most a tree of this size can give (room to keep in the backpack)
export const mostWood = (size) => Math.round(TREE.wood[1] * treeSize(size));

// Finds rare enough that the whole lobby hears when one turns up
export const RARE = {
  golden_seeds: 'Golden seeds',
  key: 'An old key',
};

// Roll a spot's loot: [item, count]. rand: () => [0, 1)
export function rollLoot(kind, rand = Math.random) {
  const { loot } = SPOT_KINDS[kind];
  let r = rand() * loot.reduce((sum, [, w]) => sum + w, 0);
  for (const [item, w, min, max] of loot) {
    r -= w;
    if (r < 0) return [item, min + Math.floor(rand() * (max - min + 1))];
  }
  const [item, , min] = loot[loot.length - 1];
  return [item, min];
}

// Where player i of n arrives around center: a ring, so people arriving don't
// land inside each other.
export function spawnPoint(center, i, n) {
  if (n <= 1) return { x: center.x, y: GROUND_STAND_Y, z: center.z };
  const a = (i / n) * Math.PI * 2;
  const r = Math.min(1.2 + n * 0.15, 2.2);
  return { x: center.x + Math.cos(a) * r, y: GROUND_STAND_Y, z: center.z + Math.sin(a) * r };
}
