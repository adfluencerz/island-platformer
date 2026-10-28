# 09 Bushes, rocks, biome decor instanced

Goal: Bushes, rocks and biome decor instanced: farm draw calls under 900.

- Same per-material instancing for static bushes and `maps.js:95-109` decor;
  rocks keep per-slot matrix writes for break/regrow.
- Done when: rock break/regrow works; farm calls ≤ 900. Proof: `plaza-noon`, stats.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- trees `world.js` :569-615 (cloned materials for fading, :1220-1237)
