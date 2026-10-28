// ---------- What the renderer drew ----------
// renderer.info, counted over a whole frame: main.js resets it at the top of
// draw(), so a split screen's seats (and, later, post-processing passes) add
// up instead of each starting the count over.
//
//   reset()   at the start of a frame
//   stats()   { calls, triangles, programs, geometries, textures, tier, pixelRatio }
//             for the last frame drawn (window.__game.stats, the devtools' Info tab)
import { tier } from './quality.js';

export function createStats(renderer) {
  renderer.info.autoReset = false;
  return {
    reset: () => renderer.info.reset(),
    stats() {
      const { render, memory, programs } = renderer.info;
      return {
        calls: render.calls,
        triangles: render.triangles,
        programs: programs?.length ?? 0,
        geometries: memory.geometries,
        textures: memory.textures,
        tier: tier(),
        pixelRatio: renderer.getPixelRatio(),
      };
    },
  };
}
