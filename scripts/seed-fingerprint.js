// A fingerprint of the island a seed grows: its shape, spots and every
// ground tile. The test pins these for old seeds (see GEN_1_SEEDS in
// scripts/test-multiplayer.js), so growing the world further can never change
// an island that players already know.
import { islandFor, hashSeed } from '../shared/worldgen.js';

export function fingerprint(seed) {
  const island = islandFor(seed, { cached: false });
  const { coast, pond, pondFloor, terraces, toadstools, woods, meadow, trails, stones, spots, spawn, theme, half } = island;
  const ground = [];
  for (let z = -half; z <= half; z++) for (let x = -half; x <= half; x++) ground.push(island.groundAt(x, z) ?? '-');
  return hashSeed(JSON.stringify([island.seed, theme, half, spawn, coast, pond, pondFloor, terraces, toadstools, woods, meadow, trails, stones, spots, ground.join(',')]));
}
