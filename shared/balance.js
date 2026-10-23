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
// the animals (src/animals.js), the farm's finds (src/finds.js), fishing
// (shared/fishing.js), the arcade's games (shared/arcade.js) and a new
// farmer's backpack (src/main.js).

// ---------- Time ----------
export const DAY_LENGTH_SECONDS = 1440; // a whole game day, in real seconds
export const SOIL_BARE_HOURS = [1.5, 2.5]; // game hours until tilled soil left empty goes back to grass

// The relics, one on each style of sky isle (shared/skyisles.js): rare finds,
// sold, or put on show on the farm (each is its own decoration: BUILD_COSTS)
const RELICS = ['cloud_feather', 'brass_cog', 'sky_crystal', 'jade_blossom', 'glowing_spore', 'sea_glass_lens', 'fallen_star', 'royal_honeycomb', 'golden_apple',
  'snow_globe', 'jade_teacup', 'silver_bell', 'ancient_acorn', 'desert_rose', 'moon_pearl', 'pocket_watch', 'golden_horseshoe', 'crystal_ball'];

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
  pumpkin: { sell: 50 },
  fern: { sell: 40 },
  seashell: { sell: 40 },
  gem: { sell: 200 },
  ...Object.fromEntries(RELICS.map((relic) => [relic, { sell: 400 }])), // (the sky isles' relics)
  wood: { sell: 6 },
  stone: { sell: 4 },
  // animals, and what they give
  hen: { price: 150, sell: 20 },
  cow: { price: 500, sell: 100},
  sheep: { price: 350, sell: 70 },
  egg: { sell: 25 },
  large_egg: { sell: 45 },
  milk: { sell: 60 },
  wool: { sell: 120 },
  // fished up (see Fishing)
  sardine: { sell: 18 },
  mackerel: { sell: 30 },
  sea_bass: { sell: 55 },
  pufferfish: { sell: 130 },
  moonfish: { sell: 160 },
  seaweed: { sell: 8 },
  minnow: { sell: 15 },
  perch: { sell: 28 },
  sunfish: { sell: 50 },
  catfish: { sell: 65 },
  koi: { sell: 150 },
  trout: { sell: 40 },
  salmon: { sell: 70 },
  rainbow_trout: { sell: 110 },
  glowfish: { sell: 220 },
  golden_carp: { sell: 450 },
  herring: { sell: 22 },
  lanternfish: { sell: 75 },
  tuna: { sell: 260 },
  swordfish: { sell: 600 },
  bream: { sell: 35 },
  goldfish: { sell: 60 },
  pike: { sell: 190 },
  carp: { sell: 55 },
  grayling: { sell: 85 },
  starfin: { sell: 280 },
  sturgeon: { sell: 650 },
  old_boot: { sell: 2 },
  // for the line (TACKLE)
  bait: { price: 4 },
  lure: { price: 60, sell: 20 },
  // made by the machines (MACHINES)
  cheese: { sell: 150 },
  mayonnaise: { sell: 65 },
  cloth: { sell: 260 },
  honey: { sell: 100 },
  // cooked (DISHES): each sells for more than what went into it
  fried_egg: { sell: 45 },
  roasted_mushrooms: { sell: 75 },
  baked_turnip: { sell: 55 },
  berry_skewer: { sell: 70 },
  roast_carrot: { sell: 90 },
  pancakes: { sell: 280 },
  cheese_omelette: { sell: 300 },
  pumpkin_soup: { sell: 250 },
  honey_carrots: { sell: 330 },
  mushroom_pie: { sell: 290 },
  carrot_cake: { sell: 420 },
  berry_tart: { sell: 300 },
  golden_pie: { sell: 700 },
  grilled_fish: { sell: 50 },
  fish_stew: { sell: 260 },
  sushi_rolls: { sell: 150 },
  farm_feast: { sell: 850 },
  // the kitchen's recipes the merchant sells (read, one goes in your recipe
  // book), and the old recipe card found in lobbies (its recipe is a surprise;
  // with all of those in the book already, it is only worth selling)
  recipe_pumpkin_soup: { price: 400 },
  recipe_honey_carrots: { price: 500 },
  recipe_mushroom_pie: { price: 600 },
  recipe_sushi_rolls: { price: 450 },
  recipe_farm_feast: { price: 1200 },
  recipe_card: { sell: 150 },
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

// ---------- Upgrades ----------
// Bought at the workbench by the farmer, for the whole farm (a helper works
// with what the farm has). Each list is the levels in order: a farm starts on
// the first, and `cost` is what the next one up costs (`gold`, and items).
// The pens: `room`, how many of each kind live there (the fence goes out a
// little each level: shared/farmland.js), and what they give: `largeEgg`,
// the chance an egg is a large one; `second`, the chance a cow or sheep gives
// two milk or wool instead of one.
export const PEN_LEVELS = {
  yard: [
    { room: { hen: 8 }, largeEgg: 0 },
    { room: { hen: 12 }, largeEgg: 0.35, cost: { gold: 1200, wood: 80, stone: 40 } },
    { room: { hen: 16 }, largeEgg: 0.7, cost: { gold: 3000, wood: 160, stone: 100 } },
  ],
  pasture: [
    { room: { cow: 4, sheep: 6 }, second: 0 },
    { room: { cow: 6, sheep: 9 }, second: 0.5, cost: { gold: 2500, wood: 120, stone: 60 } },
    { room: { cow: 8, sheep: 12 }, second: 1, cost: { gold: 6000, wood: 240, stone: 150 } },
  ],
};
// The workbench: each level makes what the ones below it do and more (a
// recipe's `level`, in RECIPES)
export const BENCH_LEVELS = [
  {},
  { cost: { gold: 2000, wood: 100, stone: 100 } },
  { cost: { gold: 5000, wood: 200, stone: 200, gem: 3 } },
];

// ---------- Trees and rocks ----------
// `hits`: swings to fell one or break one up (TOOL_HITS with a better tool).
// `regrow`: seconds until it is back (somewhere else; see shared/level.js).
// `wood`: logs from a tree of size 1 (bigger trees give more). `stone`: from
// a rock of size `per` (a fist-sized one; the big boulders give the most).
export const TREE_BALANCE = { hits: 4, regrow: [600, 600], wood: [2, 4] };
export const ROCK_BALANCE = { hits: 3, regrow: [900, 900], stone: [1, 2], per: 0.4 };
// The workbench's tools, a tier to each of its levels (sturdy, silver,
// golden): swings to fell a tree or break a rock with each; `TOOL_EXTRA`: one
// more log or stone a tree or rock gives with it; `HOE_TILLS`: the tiles a hoe
// tills in one go, [across, ahead] (centred on the one in front, the plain
// hoe's: [1, 1]).
export const TOOL_HITS = { sturdy_axe: 3, silver_axe: 2, golden_axe: 1, sturdy_pickaxe: 2, silver_pickaxe: 1, golden_pickaxe: 1 };
export const TOOL_EXTRA = { golden_axe: 1, golden_pickaxe: 1 };
export const HOE_TILLS = { wide_hoe: [3, 1], silver_hoe: [5, 1], golden_hoe: [3, 3] };

// ---------- Giant trees and rocks ----------
// Each game morning a lobby or farm without a giant tree may get one (one
// standing tree grows huge): `chance` of it. The same, apart, for a giant
// rock. Once its giant tree is down a place never gets another (nor rocks).
// A giant takes `hits` times the swings of an ordinary one, from everyone
// together, and gives `loot` times what it would, shared by how much each
// farmer did. `treeScale`, `rockScale`: how much bigger it is drawn
// (`rockMin`: a giant rock is at least this big, even a pebble's). The health
// bar over it shows `barSeconds` after the last swing.
export const GIANT = { chance: 0.05, hits: 35, loot: 50, treeScale: 2.5, rockScale: 2.5, rockMin: 1.6, barSeconds: 4 };

// ---------- Bosses ----------
// Four big grumps live out past the sea, each behind a portal: fought in any
// order, alone or with the friends on your farm (shared/bosses.js). Nobody
// gets hurt: a boss is bopped (WEAPONS) until it is dizzy and turns friendly.
// Each needs its own set of `pieces` key pieces (the `key` item), found in
// lobbies (LOBBY_SPOTS, a whole set's worth of luck) and up on the sky isles
// (SKY_CHESTS): a full set builds its portal on a farm (BUILD_COSTS), and it
// is used up when the boss is beaten. `hp`: its health with one farmer, and
// `perPlayer` times that more for each farmer past the first. `pause`:
// seconds it takes between moves ([min, max]; `quicken` shorter for each
// farmer past the first). The rest are its moves' (shared/bosses.js).
// Beating one gives everyone who fought: its statue and its mount the first
// time (`statue`, `mount`: items), and a shiny animal for the farm every time.
// (All four are in: the parsnip, the lion, the bee queen and the crow.)
export const BOSSES = {
  parsnip: {
    name: 'Evil Parsnip', key: 'parsnip_seal', pieces: 3, hp: 40, perPlayer: 0.7, pause: [1.3, 2.1], quicken: 0.12,
    hop: { windup: 0.5, air: 0.8, height: 4, reach: 7, hops: [2, 3], wave: 7, waveMax: 4.5 }, // a hop at someone, and a shockwave where it lands
    roll: { windup: 0.8, speed: 10, time: 1.8, dizzy: 1.4 }, // a roll at someone, bouncing off the arena's edge, then a moment's dizzy
    seeds: { windup: 0.6, count: 10, perPlayer: 2, speed: 6, volleys: 2, gap: 0.6 }, // seeds shot all round
    walk: 1.6, // its pace, between moves
    moves: ['hop', 'roll', 'seeds'], // (one after another, never the same twice running)
    statue: 'parsnip_statue', mount: 'parsnip_mount',
  },
  lion: {
    name: 'Super Lion', key: 'mane_tuft', pieces: 3, hp: 50, perPlayer: 0.7, pause: [1.1, 1.8], quicken: 0.12,
    pounce: { windup: 0.55, air: 0.6, height: 2.2, reach: 9, hops: [1, 3], wave: 9, waveMax: 2.4 }, // a pounce at someone, and a puff of dust where it lands
    roar: { windup: 0.8, count: 3, gap: 0.55, speed: 6.5, max: 10 }, // rings of shockwave, out to the arena's edge
    walk: 2.2,
    moves: ['pounce', 'roar'],
    statue: 'lion_statue', mount: 'lion_mount',
  },
  bee: {
    name: 'Bee Queen', key: 'honey_drop', pieces: 3, hp: 45, perPlayer: 0.7, pause: [1.3, 2.0], quicken: 0.12,
    swarm: { windup: 0.8, count: 3, perPlayer: 1, spread: 0.35, speed: 4.5, life: 3.5 }, // little swarms zig-zagging off at farmers
    roll: { windup: 0.7, speed: 11, time: 1.1, dizzy: 1.8 }, // a buzzing dash across the arena (as the parsnip's roll), then a sit-down, dizzy
    walk: 2.4,
    moves: ['swarm', 'roll'],
    statue: 'bee_statue', mount: 'bee_mount',
  },
  crow: {
    name: 'Giant Crow', key: 'crow_feather', pieces: 3, hp: 55, perPlayer: 0.7, pause: [1.2, 1.9], quicken: 0.12,
    // up into the sky (`rise` s), a moment's aim (`aim`), then a swoop down through
    // where someone stood and on along the grass (`dive` s), `swoops` times running
    swoop: { rise: 0.6, aim: 0.8, dive: 1.2, height: 5, swoops: [1, 3] },
    gust: { windup: 0.7, count: 2, gap: 0.6, speed: 7, max: 8 }, // its wings beat up rings of wind
    walk: 1.8,
    moves: ['swoop', 'gust'],
    statue: 'crow_statue', mount: 'crow_mount',
  },
};
// Riding a boss's mount (once it is beaten): `speed` times as fast as on
// foot, and `jump` times as high
export const MOUNTS = {
  parsnip: { speed: 1.3, jump: 1.2 }, // (a springy one)
  lion: { speed: 1.7, jump: 1 },
  bee: { speed: 1.45, jump: 1.1 },
  crow: { speed: 1.5, jump: 1.25 },
};
// What every boss fight shares. `hitsOut`: a farmer the boss bops this many
// times is sent back to the arena's start (and can go again). `dizzy`:
// seconds a bopped farmer wobbles (slower, no swinging); `knock`: how hard
// they are knocked back; `grace`: seconds after a bop before the next can
// land. `damage`: what one bop of each weapon takes off. `sleep`: seconds an
// empty arena waits before its boss goes back to sleep, fresh. `shiny`: the
// kinds a shiny animal can be.
export const BOSS_FIGHT = { hitsOut: 3, dizzy: 1.2, knock: 9, grace: 1.5, damage: { wooden_sword: 1, mallet: 2 }, sleep: 4, shiny: ['hen', 'cow', 'sheep'] };

// [[key item, weight, 1, 1], ...]: one of each boss's key pieces, for a loot list
function bossPieces(weight) {
  return Object.values(BOSSES).map((boss) => [boss.key, weight, 1, 1]);
}

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
  pumpkin: { regrow: [30, 45], loot: [['pumpkin', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 7)
  fern: { regrow: [30, 45], loot: [['fern', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 8)
  seashell: { regrow: [30, 45], loot: [['seashell', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 9)
  meadow: {
    regrow: [30, 50],
    loot: [['coin', 0.72, 1, 1], ['turnip_seeds', 0.22, 2, 4], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.04, 1, 1], ['key', 0.04, 1, 1], ...bossPieces(0.025)],
  },
  // up on the sky isles (generation 10): finds lying about, and on the steps up
  sky: {
    regrow: [40, 60],
    loot: [['coin', 0.5, 2, 4], ['gem', 0.22, 1, 1], ['sunflower_seeds', 0.12, 2, 3], ['carrot_seeds', 0.1, 2, 4], ['golden_seeds', 0.05, 1, 1], ['key', 0.1, 1, 1], ...bossPieces(0.07)],
  },
  // (the relic and the chests up there: what is on them is rolled their own way, SKY_CHESTS)
  relic: { regrow: [0, 0], loot: [] },
  sky_chest: { regrow: [0, 0], loot: [] },
  sky_vault: { regrow: [0, 0], loot: [] },
  ledge: {
    regrow: [40, 60],
    loot: [['gem', 0.45, 1, 1], ['carrot_seeds', 0.25, 2, 4], ['sunflower_seeds', 0.2, 1, 3], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.06, 1, 1], ['key', 0.08, 1, 1], ...bossPieces(0.05)],
  },
};

// ---------- Sky isles (generation 10) ----------
// Landmasses floating over a lobby's island, each up its own stair of floating
// steps (shared/skyisles.js). `count`: how many an island has. `radius`, `top`:
// how wide each is and how high up. `firstStep`: how high the lowest step is;
// `rise`: about how much higher each next one is (a jump reaches ~1.8);
// `stepSize`: how wide a step is. `finds`: sky spots lying about on each.
export const SKY_ISLES = { count: [1, 3], radius: [5, 7.5], top: [9, 15], firstStep: [0.9, 1.2], rise: 1.15, stepSize: [1.6, 2], finds: [2, 3] };
// The chests up there: a sky_chest whoever gets to first opens, and a locked
// sky_vault an old key opens (the key is used up). `rolls`: how many things
// are in one, each from `loot` ([item, weight, min, max], as for the spots;
// the same thing twice is one stack).
export const SKY_CHESTS = {
  sky_chest: { rolls: [3, 5], loot: [['coin', 0.45, 2, 5], ['gem', 0.15, 1, 1], ['carrot_seeds', 0.12, 2, 4], ['sunflower_seeds', 0.12, 2, 3], ['flax_seeds', 0.1, 2, 3], ['golden_seeds', 0.04, 1, 1], ['key', 0.06, 1, 1], ...bossPieces(0.06)] },
  sky_vault: { rolls: [4, 6], loot: [['coin', 0.35, 4, 8], ['gem', 0.3, 1, 2], ['golden_seeds', 0.15, 1, 2], ['sunflower_seeds', 0.1, 3, 5], ['carrot_seeds', 0.1, 3, 5], ...bossPieces(0.2)] },
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
// The flower planter costs the one made at the workbench (see RECIPES).
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
  straw_step: { flax: 2 },
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
  torch: { wood: 1, flax: 1 },
  log_fence: { wood: 3 },
  mailbox: { wood: 2 },
  birdhouse: { wood: 2 },
  flagpole: { wood: 3, flax: 2 },
  stone_cairn: { stone: 3 },
  clothesline: { wood: 2, flax: 2 },
  rope_fence: { wood: 2, flax: 1 },
  boulder: { stone: 3 },
  log_bench: { wood: 3 },
  compost_bin: { wood: 4 },
  milk_churns: { wood: 1, stone: 3 },
  dovecote: { wood: 5, stone: 1 },
  workbench: { wood: 10, stone: 5 },
  arcade: { wood: 30, stone: 10, flax: 6 },
  farm_chest: { wood: 8, stone: 2 },
  house: { wood: 500, stone: 200 },
  lamp_post: { wood: 3, stone: 2 },
  ...Object.fromEntries(RELICS.map((relic) => [relic, { [relic]: 1 }])), // (a relic on its pedestal: the relic itself)
  garden_bench: { wood: 6 },
  planter: { planter: 1 },
  pond: { stone: 30 },
  aquarium: { wood: 12, stone: 8, seashell: 2 },
  ...Object.fromEntries(Object.entries(BOSSES).flatMap(([id, boss]) => [
    [`${id}_portal`, { [boss.key]: boss.pieces }], // (a boss's portal: a full set of its key pieces)
    [boss.statue, { [boss.statue]: 1 }], // (its statue: the one it gave)
  ])),
  // the machines: the one made at the workbench (RECIPES)
  cheese_press: { cheese_press: 1 },
  mayo_machine: { mayo_machine: 1 },
  loom: { loom: 1 },
  campfire: { wood: 6, stone: 6 },
  // woven at the loom
  bunting: { wood: 2, cloth: 1 },
  market_awning: { wood: 4, cloth: 2 },
};

// ---------- The workbench ----------
// What can be made, in the order it is listed. `needs`: items used up (a
// tool among them is swapped for the one made, in its slot), and `gold` paid.
// `level`: the workbench level it takes (BENCH_LEVELS; none: the first).
export const RECIPES = [
  { makes: 'planter', needs: { stone: 4, wood: 1 } },
  { makes: 'sturdy_axe', needs: { axe: 1, wood: 12, stone: 8 } },
  { makes: 'sturdy_pickaxe', needs: { pickaxe: 1, wood: 8, stone: 12 } },
  { makes: 'wide_hoe', needs: { hoe: 1, wood: 10, stone: 10 } },
  { makes: 'wooden_sword', needs: { wood: 8 } },
  { makes: 'mallet', needs: { wood: 4, stone: 6 } },
  { makes: 'cheese_press', needs: { wood: 20, stone: 10 } },
  { makes: 'mayo_machine', needs: { wood: 15, stone: 15 } },
  { makes: 'loom', needs: { wood: 25, flax: 10 } },
  // level 2
  { makes: 'silver_axe', level: 2, needs: { sturdy_axe: 1, gold: 400, wood: 20, stone: 30, gem: 1 } },
  { makes: 'silver_pickaxe', level: 2, needs: { sturdy_pickaxe: 1, gold: 400, wood: 30, stone: 20, gem: 1 } },
  { makes: 'silver_hoe', level: 2, needs: { wide_hoe: 1, gold: 400, wood: 25, stone: 25, gem: 1 } },
  // level 3
  { makes: 'golden_axe', level: 3, needs: { silver_axe: 1, gold: 1000, wood: 40, stone: 40, gem: 3 } },
  { makes: 'golden_pickaxe', level: 3, needs: { silver_pickaxe: 1, gold: 1000, wood: 40, stone: 40, gem: 3 } },
  { makes: 'golden_hoe', level: 3, needs: { silver_hoe: 1, gold: 1000, wood: 40, stone: 40, gem: 3 } },
  // fishing rods (shared/fishing.js), each from the one before
  { makes: 'fishing_rod', needs: { wood: 5, flax: 2 } },
  { makes: 'sturdy_rod', needs: { fishing_rod: 1, wood: 15, stone: 10, flax: 4 } },
  { makes: 'golden_rod', level: 2, needs: { sturdy_rod: 1, gold: 500, wood: 20, gem: 2 } },
];

// ---------- Machines ----------
// Made at the workbench (RECIPES) and put down on the farm from the Build
// tab (shared/machines.js keeps what is in each). `takes`: one goes in, and
// `hours` (game hours) later `makes` is ready to collect. A beehive takes
// nothing: it makes `makes` every `hours` on its own, one jar at a time.
export const MACHINES = {
  cheese_press: { takes: 'milk', makes: 'cheese', hours: 4 },
  mayo_machine: { takes: 'egg', makes: 'mayonnaise', hours: 3 },
  loom: { takes: 'wool', makes: 'cloth', hours: 6 },
  beehive: { makes: 'honey', hours: 24 },
};

// ---------- Cooking ----------
// `cook`: where a dish is cooked: on a campfire built on the farm (it takes
// CAMPFIRE_HOURS, game hours), or in the house's kitchen (straight away,
// from the recipes in your recipe book). `needs`: what goes in. `boost`: what
// eating one does (BOOSTS; a kitchen dish does it better, and for longer).
// `learn` (the kitchen's): 'start', known from the start; 'shop', the
// merchant sells the recipe (recipe_<dish>, SHOP); 'find', on an old recipe
// card found in the lobbies. `shared`: eaten on a farm with helpers, everyone
// there gets its boost too. A need of 'any_fish' is any of ANY.any_fish
// (the first ones first: the cheapest).
export const CAMPFIRE_HOURS = 1;
export const CAMPFIRE_MOST = 3; // dishes on the fire at once (all the same)
export const KITCHEN_MOST = 5; // dishes the kitchen's "×5" cooks at once
export const ANY = { any_fish: ['minnow', 'sardine', 'perch', 'mackerel', 'trout'] };
export const DISHES = {
  fried_egg: { cook: 'campfire', needs: { egg: 1 }, boost: ['quick'] },
  roasted_mushrooms: { cook: 'campfire', needs: { mushroom: 2 }, boost: ['strong'] },
  baked_turnip: { cook: 'campfire', needs: { turnip: 1 }, boost: ['bouncy'] },
  berry_skewer: { cook: 'campfire', needs: { berries: 3 }, boost: ['quick'] },
  roast_carrot: { cook: 'campfire', needs: { carrot: 1 }, boost: ['strong'] },
  grilled_fish: { cook: 'campfire', needs: { any_fish: 1 }, boost: ['lucky'] },
  pancakes: { cook: 'kitchen', needs: { egg: 1, milk: 1, honey: 1 }, boost: ['quick'], learn: 'start' },
  cheese_omelette: { cook: 'kitchen', needs: { egg: 2, cheese: 1 }, boost: ['strong'], learn: 'start' },
  pumpkin_soup: { cook: 'kitchen', needs: { pumpkin: 2, milk: 1 }, boost: ['bouncy'], learn: 'shop' },
  honey_carrots: { cook: 'kitchen', needs: { carrot: 2, honey: 1 }, boost: ['quick'], learn: 'shop' },
  mushroom_pie: { cook: 'kitchen', needs: { mushroom: 3, egg: 1, flax: 1 }, boost: ['strong'], learn: 'shop' },
  fish_stew: { cook: 'kitchen', needs: { any_fish: 2, carrot: 1, milk: 1 }, boost: ['lucky', 'strong'], learn: 'start' },
  sushi_rolls: { cook: 'kitchen', needs: { any_fish: 2, seaweed: 2 }, boost: ['lucky', 'quick'], learn: 'shop' },
  farm_feast: { cook: 'kitchen', needs: { pumpkin: 2, carrot: 2, cheese: 1, honey: 1, any_fish: 2 }, boost: ['quick', 'bouncy', 'lucky'], learn: 'shop', shared: true },
  carrot_cake: { cook: 'kitchen', needs: { carrot: 2, egg: 2, honey: 1 }, boost: ['bouncy', 'quick'], learn: 'find' },
  berry_tart: { cook: 'kitchen', needs: { berries: 4, egg: 1, honey: 1 }, boost: ['quick', 'strong'], learn: 'find' },
  golden_pie: { cook: 'kitchen', needs: { golden_turnip: 1, egg: 1, cheese: 1, honey: 1 }, boost: ['quick', 'strong', 'bouncy'], learn: 'find' },
};
// What eating a dish does, for a while: [a campfire dish's, a kitchen dish's].
// `speed`: walking goes this much faster. `swings`: this many fewer swings
// fell a tree or break up a rock (one at the least; not a giant). `jump`:
// jumping goes this much higher. `bite`: fish bite this much sooner (the
// wait till one does, times this). `seconds`: how long it lasts (seconds of
// play). One meal at a time: eating another puts the last one's out.
export const BOOSTS = {
  quick: { speed: [1.1, 1.2] },
  strong: { swings: [1, 2] },
  bouncy: { jump: [1.06, 1.12] },
  lucky: { bite: [0.8, 0.65] },
};
export const BOOST_SECONDS = { campfire: 240, kitchen: 480 };

// Made at the workbench once, built straight from wood and stone now: what
// one is worth, for a backpack or a chest that still has some
export const UNMADE = { lamp_post: { wood: 3, stone: 2 }, garden_bench: { wood: 6 } };

// items ({ item: count }), with any of those turned back into what they cost
export function unmake(items) {
  const out = {};
  for (const [item, n] of Object.entries(items ?? {})) {
    for (const [what, k] of Object.entries(UNMADE[item] ?? { [item]: 1 })) out[what] = (out[what] ?? 0) + k * n;
  }
  return out;
}

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
export const DROP_OWN_MS = 3000; // the farmer a bop knocked it out of can't take it straight back: for this long it is for anyone else (ms)

// ---------- Fishing ----------
// With a rod in hand, E facing water casts; a while later the bobber dips,
// and E again in time lands what bit (in a lobby the server rolls it). `bite`:
// seconds [min, max] from the cast till something bites, with each rod.
// `luck`: how much likelier a rarer catch is with it (for each step of rarity,
// times this). The rods are made at the workbench, each from the one before.
export const RODS = {
  fishing_rod: { bite: [6, 13], luck: 1 },
  sturdy_rod: { bite: [4, 9], luck: 1.5 },
  golden_rod: { bite: [2.5, 6], luck: 2 },
};
// ms to press E once the bobber dips, by how rare what bit is (0 common .. 3 the rarest)
export const BITE_WINDOW = [1300, 1000, 750, 550];
export const CAST_EVERY = 1200; // ms: the fewest between two casts
// What bites where: the sea round your farm, a pond built on it, and any
// water in a lobby (its sea and its pond: rarer things). Each [item, weight,
// rarity, { rod, hours, count }]: `rod` the least rod it bites for (1: a
// sturdy one, 2: golden), `hours` [from, to] of game time it bites in (past
// midnight if from > to), `count` [min, max] of it (else one). 'chest': a
// little chest of loot (FISHED_CHEST); wood is driftwood.
export const FISHING = {
  sea: [
    ['sardine', 30, 0], ['herring', 20, 0], ['mackerel', 22, 0], ['sea_bass', 12, 1],
    ['lanternfish', 7, 1, { hours: [18, 23] }], ['pufferfish', 4, 2, { rod: 1 }], ['moonfish', 5, 2, { hours: [20, 5] }],
    ['tuna', 3, 2, { rod: 1, hours: [5, 12] }], ['swordfish', 1, 3, { rod: 2 }],
    ['seaweed', 6, 0], ['old_boot', 5, 0], ['wood', 4, 0, { count: [2, 4] }],
    ['key', 0.8, 2], ['chest', 1.5, 2],
  ],
  pond: [
    ['minnow', 30, 0], ['perch', 22, 0], ['bream', 16, 0], ['goldfish', 9, 1],
    ['sunfish', 10, 1, { hours: [9, 17] }], ['catfish', 10, 1, { hours: [18, 6] }],
    ['koi', 4, 2, { rod: 1 }], ['pike', 3, 2, { rod: 1, hours: [5, 11] }],
    ['old_boot', 4, 0], ['key', 0.6, 2], ['chest', 1, 2],
  ],
  lobby: [
    ['trout', 26, 0], ['carp', 18, 0], ['salmon', 18, 1], ['grayling', 9, 1, { hours: [6, 12] }], ['rainbow_trout', 9, 1],
    ['glowfish', 4, 2, { hours: [21, 4] }], ['starfin', 3, 2, { rod: 1, hours: [5, 8] }],
    ['golden_carp', 1.2, 3, { rod: 1 }], ['sturgeon', 0.8, 3, { rod: 2 }],
    ['old_boot', 4, 0], ['key', 1.5, 2], ['chest', 3, 2],
  ],
  // a lobby's fishing contest (MINIGAMES): fish only, any time, the same for every rod
  contest: [
    ['trout', 26, 0], ['carp', 20, 0], ['salmon', 16, 1], ['grayling', 8, 1], ['rainbow_trout', 8, 1], ['golden_carp', 1, 3],
  ],
};
// How heavy each fish comes, in grams: [lightest, heaviest] (the big ones
// rarer: FISH_HEAVY). Kept in the fishing journal, on a lobby's board of
// the biggest catches, and the score in a fishing contest.
export const FISH_WEIGHT = {
  sardine: [40, 160], herring: [100, 450], mackerel: [200, 900], sea_bass: [800, 4500], lanternfish: [30, 140],
  pufferfish: [300, 1600], moonfish: [600, 3200], tuna: [4000, 32000], swordfish: [18000, 90000],
  minnow: [5, 30], perch: [100, 900], bream: [300, 2600], goldfish: [20, 160], sunfish: [100, 650],
  catfish: [1000, 8500], koi: [500, 5200], pike: [1500, 9500],
  trout: [300, 2600], carp: [1000, 9000], salmon: [1500, 9500], grayling: [200, 1500], rainbow_trout: [400, 3600],
  glowfish: [100, 900], starfin: [200, 1300], golden_carp: [1500, 12500], sturgeon: [8000, 65000],
};
export const FISH_HEAVY = 2.2; // the higher, the rarer a fish near its heaviest
// Bait and lures, from the merchant: each cast with one in the backpack uses
// one up once something is landed. Bait: bites come sooner (`bite`, times
// the wait). A lure: rarer fish (`luck`, times the rod's).
export const TACKLE = { bait: { bite: 0.6 }, lure: { luck: 1.6 } };
// An aquarium built on the farm holds this many fish, to show off
export const AQUARIUM = { holds: 6 };
// What is in a little chest fished up: `rolls` things, each from `loot`
// ([item, weight, min, max], as for the sky isle chests)
export const FISHED_CHEST = { rolls: [2, 3], loot: [['coin', 0.5, 2, 5], ['gem', 0.15, 1, 1], ['carrot_seeds', 0.12, 2, 4], ['sunflower_seeds', 0.1, 1, 3], ['golden_seeds', 0.05, 1, 1], ['key', 0.03, 1, 1], ['lure', 0.1, 1, 2]] };
// ---------- Skills ----------
// Five skills that level up by doing (shared/skills.js, src/skills.js), from
// level 1 to SKILLS.max. `next`: XP from each level to the one after (1 -> 2
// first). `xp`: what each thing done is worth (`harvest` by crop). `bonus`:
// the chance, for each level past 1, of one more of what it gives (an extra
// crop, egg, milk, wool, log or stone; fishing's: bites that much sooner).
// From level `fewerSwings` a tree or rock takes one
// swing less (never under `leastSwings`: a lobby turns down two felled within
// a second). The overall level is all five added up; at DOUBLE_JUMP.level it
// unlocks one jump more in the air, at `speed`.
export const SKILLS = {
  max: 10,
  next: [40, 100, 170, 245, 325, 415, 505, 605, 705],
  xp: {
    plant: 1,
    harvest: { turnip: 3, carrot: 4, flax: 5, sunflower: 5, golden_turnip: 10 },
    pet: 3, // (once a game day for each animal)
    egg: 6,
    milk: 10,
    wool: 12,
    tree: 8,
    rock: 7,
    giant: 40, // (a giant tree or rock you helped bring down)
    fish: 6,
  },
  bonus: { farming: 0.04, animals: 0.03, fishing: 0.04, woodcutting: 0.05, mining: 0.05 },
  fewerSwings: 5,
  leastSwings: 2,
};
export const DOUBLE_JUMP = { level: 15, speed: 9.5 };
// ---------- The arcade (shared/arcade.js) ----------
// Games against the house for gold, built on the farm. Stakes have no limit
// (whatever is in the backpack). Payouts are what comes back for each 1g
// staked, the stake included (2: double; 0: lost). The house keeps a small
// edge, a gentle gold sink.
export const COINFLIP = { pays: 2 }; // heads or tails, even odds
// Blackjack: the dealer draws to 17 and stands on any 17; a blackjack (an ace
// and a ten in the first two cards) pays 3 to 2. A hand can be doubled on its
// first two cards; there is no splitting. A shoe of `decks` is shuffled for
// every hand. (Played well, about 97% comes back.)
export const BLACKJACK = { decks: 6, natural: 2.5, win: 2, push: 1 };
// Lucky Hand: a short card game after Balatro. Draw `hand` cards; `plays`
// times, play up to five as a poker hand, which scores (chips) x (mult): the
// hand's own (LUCKY_HANDS), plus each scoring card's chips (LUCKY_CARD_CHIPS),
// then whatever the jokers add. `discards` times, swap cards instead. A
// joker is picked from `offer` before the first play, and another after it.
// The total after the last play pays by `tiers`: [score, payout], the highest
// one reached. (Played as well as can be, about 97% of what is staked comes
// back; half the games reach the 1x tier.)
export const LUCKY = {
  hand: 8, plays: 3, discards: 3, offer: 3, picks: 2,
  tiers: [[1250, 0.5], [1850, 1], [2450, 1.5], [3000, 2.5], [4000, 5], [6000, 15]],
};
// [chips, mult] for each poker hand (shared/cards.js HANDS, in order)
export const LUCKY_HANDS = [[5, 1], [10, 2], [20, 2], [30, 3], [30, 4], [35, 4], [40, 4], [60, 7], [100, 8]];
// what a scoring card adds to the chips: its number, 10 for a face, 11 for an ace
export const LUCKY_CARD_CHIPS = { T: 10, J: 10, Q: 10, K: 10, A: 11 };
// The jokers. `needs`: only when the hand played has a rank 2 or 3 times
// (a pair, a three of a kind; in a bigger hand too), or is a 'straight' or a
// 'flush'. `suit`, `face`: for each scoring card of that suit, or that is a
// jack, queen or king. Then +chips, +mult, and last x`times` the mult.
export const LUCKY_JOKERS = {
  sunflower: { name: 'Sunflower', mult: 4 },
  twin_turnips: { name: 'Twin turnips', needs: 2, mult: 8 },
  hay_bale: { name: 'Hay bale', needs: 2, chips: 50 },
  scarecrow: { name: 'Scarecrow', needs: 3, times: 2 },
  garden_path: { name: 'Garden path', needs: 'straight', mult: 12 },
  bouquet: { name: 'Bouquet', needs: 'flush', mult: 10 },
  rosy_heart: { name: 'Rosy heart', suit: 'h', mult: 3 },
  dewdrop: { name: 'Dewdrop', suit: 'd', mult: 3 },
  clover: { name: 'Four-leaf clover', suit: 'c', mult: 3 },
  trowel: { name: 'Garden trowel', suit: 's', mult: 3 },
  royal_hen: { name: 'Royal hen', face: true, chips: 20 },
  golden_goose: { name: 'Golden goose', times: 1.5 },
};

// ---------- Party games (lobbies: shared/minigame.js, shared/arenas.js) ----------
// E at the signpost in the stone circle starts one: everyone in the lobby
// hears, and has gatherMs to join (at the sign, or from the pop-up). Then
// whoever joined is off to an arena grown from a seed, readyMs to look about
// before it starts, and back to the lobby once it is over. The next game can
// start cooldownMs later. (ms throughout)
export const MINIGAMES = {
  gatherMs: 20_000,
  readyMs: 3000,
  cooldownMs: 10_000,
  // Coin rush: the most coins picked up before the time runs out (the coins
  // are the game's, only for the score; the prize is real ones)
  coin_rush: { ms: 60_000, coins: [36, 48], high: 0.3 }, // high: the share of coins up on the hay bales
  // King of the hill: the most seconds stood on top of the hill
  king_of_hill: { ms: 60_000 },
  // Last one standing: the tiles drop one by one after graceMs, each warnMs
  // after it starts to wobble, the first ones `slowdown` times further apart
  // than the last; all but `keep` are down quietMs before the end. Whoever
  // falls in is out. Last up wins; if a few are still up at the end, they
  // all win. startR: how far round the middle everyone starts.
  last_one: { ms: 60_000, graceMs: 4000, warnMs: 1200, slowdown: 3, quietMs: 8000, keep: 2, startR: 3 },
  // In the arenas of the games that say so (GAMES), empty hands shove (as
  // WEAPONS, a little weaker than the wooden sword); a sword or mallet in
  // hand bops as ever
  shove: { reach: 1.7, knock: 6, every: 900 },
  // Fishing contest: the most weight of fish landed (FISHING.contest, a rod
  // lent to anyone without one), off the shore of a little island. `bite`:
  // seconds till a bite, for every rod alike
  fishing_contest: { ms: 180_000, bite: [2.5, 6] },
  // The prize: the winner's coins (more for each other farmer who played) and
  // one roll of loot ([item, weight, min, max]); everyone else who played
  // gets a few coins for joining in
  prize: {
    coins: 12,
    perPlayer: 3,
    loot: [['carrot_seeds', 0.35, 2, 4], ['sunflower_seeds', 0.3, 2, 3], ['gem', 0.25, 1, 1], ['golden_seeds', 0.1, 1, 1]],
    played: [1, 2],
  },
};

// ---------- Room to keep things ----------
export const CHEST = { stack: 999, kinds: 64 }; // the most of one item in a farm chest, and of different items
