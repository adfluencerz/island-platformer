// `npm run island -- <seed> [<seed>...]`: a map of the island each seed grows
// (shared/worldgen.js), drawn in the terminal, without starting the game.
// No seed: a random one. North is up.
import { islandFor, checkIsland, randomSeed } from '../shared/worldgen.js';
import { SKY_STYLES, onIsle } from '../shared/skyisles.js';

const GROUND = { pond: '~', sand: '.', stone: 'o', path: ':', meadow: '"', moss: '&', grass: ',', heath: '^', marsh: '%', glade: '*', field: '+', patch: '=', glen: '\'', dune: '_' };
const SPOT = { ledge: 'L', meadow: '$', bush: 'B', mushroom: 'M', heather: 'H', cattail: 'C', bluebell: 'U', sunflower: 'S', pumpkin: 'P', fern: 'F', seashell: 'E', sky: '$', relic: 'R', sky_chest: 'K', sky_vault: 'V' };
const color = process.stdout.isTTY;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const INK = { '~': 36, '.': 33, o: 37, ':': 33, '"': 92, '&': 32, '^': 35, '%': 36, '*': 94, '+': 93, '=': 33, "'": 92, _: 93, '|': 96, '1': 96, R: 93, K: 33, V: 95, S: 93, P: 33, F: 32, E: 97, U: 94, C: 96, H: 95, ',': 32, '#': 90, T: 31, L: 95, $: 93, B: 91, M: 97, '@': 1 };

const seeds = process.argv.slice(2);
for (const asked of seeds.length ? seeds : [randomSeed()]) {
  const island = islandFor(asked);
  const H = island.half;
  const grid = [];
  for (let gz = -H; gz <= H; gz++) {
    const row = [];
    for (let gx = -H; gx <= H; gx++) row.push(GROUND[island.groundAt(gx, gz)] ?? ' ');
    grid.push(row);
  }
  const put = (x, z, ch) => {
    const row = grid[Math.round(z) + H];
    if (row && Math.round(x) + H in row) row[Math.round(x) + H] = ch;
  };
  const fill = (x, z, w, d, ch) => {
    for (let gz = Math.ceil(z - d / 2); gz <= Math.floor(z + d / 2); gz++) {
      for (let gx = Math.ceil(x - w / 2); gx <= Math.floor(x + w / 2); gx++) put(gx, gz, ch);
    }
  };
  for (const [x, z, w, d] of island.terraces) fill(x, z, w, d, '#');
  for (const [x, z, size] of island.toadstools) fill(x, z, size, size, 'T');
  // the sky isles overhead (generation 10), and the steps up to them, the first one 1
  for (const isle of island.sky ?? []) {
    for (let gz = Math.floor(isle.z - isle.r - 1); gz <= isle.z + isle.r + 1; gz++) {
      for (let gx = Math.floor(isle.x - isle.r - 1); gx <= isle.x + isle.r + 1; gx++) if (onIsle(isle, gx, gz)) put(gx, gz, '|');
    }
    isle.steps.forEach(([x, z, w, d], i) => fill(x, z, w, d, i ? '#' : '1'));
  }
  for (const [kind, x, , z] of island.spots) put(x, z, SPOT[kind]);
  put(island.spawn.x, island.spawn.z, '@');

  console.log(`\nisland "${island.seed}" (${island.theme}): ${island.terraces.length} terraces, ${island.toadstools.length} toadstools, ${island.spots.length} spots`);
  for (const isle of island.sky ?? []) console.log(`  sky isle at ${isle.x}, ${isle.z}, ${isle.top} up: ${SKY_STYLES[isle.style].name} (look ${isle.variant + 1}), ${isle.steps.length} steps`);
  // two characters a tile, so it comes out about square
  for (const row of grid) console.log(row.map((ch) => paint(INK[ch] ?? 0, ch + ch)).join('').trimEnd());
  const problems = checkIsland(island);
  if (problems.length) console.log(paint(31, `problems:\n  ${problems.join('\n  ')}`));
}
console.log(`\n@ arrival  # terraces  T toadstools  L ledge  $ treasure  B berries  M mushrooms  ~ pond  " meadow  & woods  : trail  | sky isle (R relic, K chest, V locked chest; 1 its stair's first step)`);
