// `npm run island -- <seed> [<seed>...]`: a map of the island each seed grows
// (shared/worldgen.js), drawn in the terminal, without starting the game.
// No seed: a random one. North is up.
import { islandFor, checkIsland, randomSeed } from '../shared/worldgen.js';

const GROUND = { pond: '~', sand: '.', stone: 'o', path: ':', meadow: '"', moss: '&', grass: ',', heath: '^', marsh: '%', glade: '*' };
const SPOT = { ledge: 'L', meadow: '$', bush: 'B', mushroom: 'M', heather: 'H', cattail: 'C', bluebell: 'U' };
const color = process.stdout.isTTY;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const INK = { '~': 36, '.': 33, o: 37, ':': 33, '"': 92, '&': 32, '^': 35, '%': 36, '*': 94, U: 94, C: 96, H: 95, ',': 32, '#': 90, T: 31, L: 95, $: 93, B: 91, M: 97, '@': 1 };

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
  for (const [kind, x, , z] of island.spots) put(x, z, SPOT[kind]);
  put(island.spawn.x, island.spawn.z, '@');

  console.log(`\nisland "${island.seed}" (${island.theme}): ${island.terraces.length} terraces, ${island.toadstools.length} toadstools, ${island.spots.length} spots`);
  // two characters a tile, so it comes out about square
  for (const row of grid) console.log(row.map((ch) => paint(INK[ch] ?? 0, ch + ch)).join('').trimEnd());
  const problems = checkIsland(island);
  if (problems.length) console.log(paint(31, `problems:\n  ${problems.join('\n  ')}`));
}
console.log(`\n@ arrival  # terraces  T toadstools  L ledge  $ treasure  B berries  M mushrooms  ~ pond  " meadow  & woods  : trail`);
