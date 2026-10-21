// ---------- Balancing ----------
// Every number that decides how the game plays out, in one place: how long
// things take to grow back, what things cost, what they give and what they
// sell for. Change a number here and both the page and the server go by it
// (this file is plain JS, so it runs in both).
//
// Times are real seconds unless they say game hours (a game day lasts
// DAY_LENGTH_SECONDS, so a game hour is DAY_LENGTH_SECONDS / 24 seconds).
// [min, max] means a roll somewhere between the two, each time.
//
// What uses each part: the item catalog (src/items.js), the world and its
// lobbies (shared/level.js, shared/room.js), the workbench (src/workbench.js),
// the animals (src/animals.js), the farm's finds (src/finds.js) and a new
// farmer's backpack (src/main.js).

// ---------- Time ----------
export const DAY_LENGTH_SECONDS = 1440; // a whole game day, in real seconds
export const SOIL_BARE_HOURS = [1.5, 2.5]; // game hours until tilled soil left empty goes back to grass

// ---------- Money ----------
// The merchant at the farm stall: `price` is what they ask for one (no price:
// they don't sell it), `sell` what they pay for one (no sell: they won't buy it).
export const SHOP = {
  // seeds
  turnip_seeds: { price: 20, sell: 10 },
  carrot_seeds: { price: 35, sell: 17 },
  flax_seeds: { price: 45, sell: 22 },
  sunflower_seeds: { price: 60, sell: 30 },
  golden_seeds: { sell: 100 },
  // crops
  turnip: { sell: 35 },
  carrot: { sell: 60 },
  flax: { sell: 80 },
  sunflower: { sell: 45 }, // (the crop and the lobby's wild sunflower are one item)
  golden_turnip: { sell: 150 },
  // gathered in lobbies
  berries: { sell: 15 },
  mushroom: { sell: 25 },
  heather: { sell: 30 },
  cattail: { sell: 35 },
  bluebell: { sell: 40 },
  gem: { sell: 200 },
  wood: { sell: 6 },
  stone: { sell: 4 },
  // animals, and what they give
  hen: { price: 150, sell: 20 },
  cow: { price: 500, sell: 100},
  sheep: { price: 350, sell: 70 },
  egg: { sell: 25 },
  milk: { sell: 60 },
  wool: { sell: 120 },
};
export const COIN_VALUE = 10; // gold for picking up one coin

// What a new farmer starts with in the backpack: [item, count]
export const STARTER_KIT = [['hoe', 1], ['axe', 1], ['pickaxe', 1], ['turnip_seeds', 10], ['flax_seeds', 5], ['stone', 200], ['wood', 500]];

// ---------- Crops ----------
// Seconds from planting to ripe (real seconds: a farm left alone grows on too)
export const CROP_GROW_TIME = { turnip: 100, carrot: 150, flax: 175, sunflower: 225, golden_turnip: 300 };

// ---------- Animals ----------
// `regrow`: game hours until a cow or sheep has more to give ('morning': the
// next morning). A hen lays one egg a day, at some hour in LAY_HOURS, and
// stops while EGGS_PER_HEN of hers lie about uncollected.
export const ANIMALS = {
  cow: { product: 'milk', regrow: 'morning' },
  sheep: { product: 'wool', regrow: 48 },
};
export const LAY_HOURS = [8, 16];
export const EGGS_PER_HEN = 3;

// ---------- Trees and rocks ----------
// `hits`: swings to fell one or break one up (STURDY_HITS with a sturdy tool).
// `regrow`: seconds until it is back (somewhere else; see shared/level.js).
// `wood`: logs from a tree of size 1 (bigger trees give more). `stone`: from
// a rock of size `per` (a fist-sized one; the big boulders give the most).
export const TREE_BALANCE = { hits: 4, regrow: [600, 600], wood: [2, 4] };
export const ROCK_BALANCE = { hits: 3, regrow: [900, 900], stone: [1, 2], per: 0.4 };
export const STURDY_HITS = { sturdy_axe: 3, sturdy_pickaxe: 2 };

// ---------- Lobby spots ----------
// What a lobby's resource spots turn up. `regrow`: seconds until an emptied
// spot has something again. `loot`: [item, weight, min, max]: each time it
// regrows one is picked (the higher the weight, the likelier) with min..max of it.
export const LOBBY_SPOTS = {
  bush: { regrow: [35, 50], loot: [['berries', 1, 2, 3]] },
  mushroom: { regrow: [25, 40], loot: [['mushroom', 0.95, 1, 2], ['golden_seeds', 0.05, 1, 1]] },
  heather: { regrow: [30, 45], loot: [['heather', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 2 islands)
  cattail: { regrow: [30, 45], loot: [['cattail', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 4)
  bluebell: { regrow: [30, 45], loot: [['bluebell', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 5)
  sunflower: { regrow: [30, 45], loot: [['sunflower', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 6)
  meadow: {
    regrow: [30, 50],
    loot: [['coin', 0.72, 1, 1], ['turnip_seeds', 0.22, 2, 4], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.04, 1, 1], ['key', 0.02, 1, 1]],
  },
  ledge: {
    regrow: [40, 60],
    loot: [['gem', 0.45, 1, 1], ['carrot_seeds', 0.25, 2, 4], ['sunflower_seeds', 0.2, 1, 3], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.06, 1, 1], ['key', 0.04, 1, 1]],
  },
};

// ---------- Finds on the farm ----------
// Now and then something turns up on your own farm while you play it alone.
export const FARM_FINDS = {
  every: 60, // seconds of play between rolls
  chance: 0.15, // that a roll turns something up
  two: 0.3, // that it is two finds, not one
  most: 2, // on the farm at once
  loot: [ // [item, weight, min, max], as for lobby spots
    ['coin', 0.5, 1, 2],
    ['turnip_seeds', 0.16, 2, 3],
    ['carrot_seeds', 0.12, 1, 3],
    ['flax_seeds', 0.1, 1, 2],
    ['sunflower_seeds', 0.07, 1, 2],
    ['gem', 0.04, 1, 1],
    ['golden_seeds', 0.01, 1, 1],
  ],
};

// ---------- Building ----------
// What each piece costs to build (it all goes back when it is taken down).
// The decorations cost the one made at the workbench (see RECIPES).
export const BUILD_COSTS = {
  wood_fence: { wood: 2 },
  stone_wall: { stone: 3 },
  wood_path: { wood: 1 },
  stone_path: { stone: 1 },
  wood_gate: { wood: 3 },
  wood_crate: { wood: 3 },
  stone_step: { stone: 2 },
  stone_block: { stone: 3 },
  wood_step: { wood: 2 },
  log_pile: { wood: 4 },
  wood_scaffold: { wood: 5 },
  tall_stone_block: { stone: 5 },
  stone_pillar: { stone: 8 },
  low_stone_wall: { stone: 2 },
  wood_palisade: { wood: 4 },
  wood_barrel: { wood: 4 },
  straw_bale: { flax: 3 },
  straw_stack: { flax: 6 },
  log_tower: { wood: 8 },
  stone_arch: { stone: 5 },
  cobble_path: { stone: 2 },
  rail_fence: { wood: 3 },
  wood_arbor: { wood: 5 },
  gravel_path: { stone: 1 },
  mossy_stone_block: { stone: 4 },
  stone_well: { stone: 6, wood: 3 },
  box_hedge: { wood: 1, flax: 2 },
  stepping_stones: { stone: 1 },
  tree_stump: { wood: 2 },
  crate_stack: { wood: 6 },
  stone_lantern: { stone: 5 },
  scarecrow: { wood: 3, flax: 2 },
  picket_fence: { wood: 3 },
  grain_sacks: { flax: 4 },
  hay_cart: { wood: 6, flax: 3 },
  beehive: { wood: 2, flax: 3 },
  birdbath: { stone: 3 },
  signpost: { wood: 2 },
  wattle_fence: { wood: 3 },
  water_trough: { wood: 4 },
  stone_bench: { stone: 4 },
  sundial: { stone: 4 },
  wheelbarrow: { wood: 3, stone: 1 },
  barrel_stack: { wood: 8 },
  workbench: { wood: 10, stone: 5 },
  farm_chest: { wood: 8, stone: 2 },
  house: { wood: 500, stone: 200 },
  lamp_post: { lamp_post: 1 },
  garden_bench: { garden_bench: 1 },
  planter: { planter: 1 },
};

// ---------- The workbench ----------
// What can be made, in the order it is listed. `needs`: items used up (a
// tool among them is swapped for the one made, in its slot).
export const RECIPES = [
  { makes: 'lamp_post', needs: { wood: 3, stone: 2 } },
  { makes: 'garden_bench', needs: { wood: 6 } },
  { makes: 'planter', needs: { stone: 4, wood: 1 } },
  { makes: 'sturdy_axe', needs: { axe: 1, wood: 12, stone: 8 } },
  { makes: 'sturdy_pickaxe', needs: { pickaxe: 1, wood: 8, stone: 12 } },
  { makes: 'wide_hoe', needs: { hoe: 1, wood: 10, stone: 10 } },
  { makes: 'wooden_sword', needs: { wood: 8 } },
  { makes: 'mallet', needs: { wood: 4, stone: 6 } },
];

// ---------- Bopping (lobbies) ----------
// With one in hand, E bops the farmer in front within `reach`: knocked back
// (at `knock`), they drop up to `drops` of something gathered this visit.
// `every`: ms between swings that count.
export const WEAPONS = {
  wooden_sword: { reach: 1.9, knock: 7, every: 700, drops: 1 },
  mallet: { reach: 2, knock: 11, every: 1100, drops: 2 },
};
export const BOP_GRACE = 2500; // ms a farmer who was just bopped can't be again
export const SAFE_CIRCLE = 3.5; // nobody bops or is bopped this close to where farmers arrive
export const DROP_MS = 45_000; // a drop nobody picks up fades after this (ms)

// ---------- Room to keep things ----------
export const CHEST = { stack: 999, kinds: 64 }; // the most of one item in a farm chest, and of different items
