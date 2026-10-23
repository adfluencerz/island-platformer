// ---------- Sky isles (generation 10) ----------
// Landmasses floating high over a lobby's island, each reached by its own
// stair of floating steps winding up round it. On each one: a building in
// the isle's style, a relic (one to a style: collect them all), a chest
// whoever gets there first opens, a locked one an old key opens, and a few
// things lying about. The steps have a find or two on the way up as well.
//
// Every isle has a style (SKY_STYLES): what its land, steps and building look
// like (src/skystyles.js draws them) and which relic it holds. An island's
// isles each get another style, by a shuffle of its own, so lobby after lobby
// goes round them all; `variant` picks one of the style's looks.
//
// Pure JS: the server needs where the spots are and which relic is on each
// isle (shared/room.js), the pages draw the rest (src/skyisles.js).
import { SKY_ISLES } from './balance.js';

// id: the style (src/skystyles.js). relic: the item on its pedestal (src/items.js); found: what the lobby hears
export const SKY_STYLES = [
  { id: 'cloud', name: 'Cloud meadow', relic: 'cloud_feather', found: 'A cloud feather' },
  { id: 'windmill', name: 'Windmill heights', relic: 'brass_cog', found: 'A brass cog' },
  { id: 'crystal', name: 'Crystal grotto', relic: 'sky_crystal', found: 'A sky crystal' },
  { id: 'pagoda', name: 'Blossom pagoda', relic: 'jade_blossom', found: 'A jade blossom' },
  { id: 'mushroom', name: 'Mushroom hollow', relic: 'glowing_spore', found: 'A glowing spore' },
  { id: 'lighthouse', name: 'Lighthouse rock', relic: 'sea_glass_lens', found: 'A sea-glass lens' },
  { id: 'stargazer', name: "Stargazer's dome", relic: 'fallen_star', found: 'A fallen star' },
  { id: 'apiary', name: "Beekeeper's bluff", relic: 'royal_honeycomb', found: 'A royal honeycomb' },
  { id: 'orchard', name: 'Orchard loft', relic: 'golden_apple', found: 'A golden apple' },
  { id: 'frost', name: 'Frost peak', relic: 'snow_globe', found: 'A snow globe' },
  { id: 'teahouse', name: 'Bamboo tea house', relic: 'jade_teacup', found: 'A jade teacup' },
  { id: 'chapel', name: 'Old chapel', relic: 'silver_bell', found: 'A silver bell' },
  { id: 'treehouse', name: 'Treehouse grove', relic: 'ancient_acorn', found: 'An ancient acorn' },
  { id: 'oasis', name: 'Sandstone oasis', relic: 'desert_rose', found: 'A desert rose' },
  { id: 'lily', name: 'Lily pavilion', relic: 'moon_pearl', found: 'A moon pearl' },
  { id: 'clockwork', name: 'Clockwork tower', relic: 'pocket_watch', found: 'A pocket watch' },
  { id: 'barn', name: 'Red barn mesa', relic: 'golden_horseshoe', found: 'A golden horseshoe' },
  { id: 'wizard', name: "Wizard's spire", relic: 'crystal_ball', found: 'A crystal ball' },
];
export const SKY_VARIANTS = 3; // looks to a style

// The spots up there: `sky` finds (walked into), the `relic` on its pedestal
// (walked into), the `sky_chest` and the locked `sky_vault` (opened with E)
export const SKY_KINDS = ['sky', 'relic', 'sky_chest', 'sky_vault'];
export const RELIC_LIFT = 1.1; // a relic floats this high over the isle (its pedestal is PEDESTAL_H)
export const PEDESTAL_H = 0.4; // (walked up onto, like a step)

const round1 = (v) => Math.round(v * 10) / 10;
const waves = (a, list) => list.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * a + phase), 0);

// How far an isle's edge is from its middle, by direction
export const rimAt = (isle, angle) => isle.r + waves(angle, isle.waves);
const rimMin = (isle) => isle.r - isle.waves.reduce((sum, [amp]) => sum + amp, 0);
export const rimMax = (isle) => isle.r + isle.waves.reduce((sum, [amp]) => sum + amp, 0); // (as far out as its rim goes)
export const onIsle = (isle, x, z, margin = 0) => Math.hypot(x - isle.x, z - isle.z) < rimAt(isle, Math.atan2(z - isle.z, x - isle.x)) + margin;

// The isle, or the step, over (x, z), give or take margin: { x, z, w, d, top } (an isle's w and d are its widest)
export function skyOver(sky, x, z, margin = 0) {
  for (const isle of sky) {
    if (onIsle(isle, x, z, margin)) return { x: isle.x, z: isle.z, w: rimMax(isle) * 2, d: rimMax(isle) * 2, top: isle.top };
    for (const [sx, sz, w, d, top] of isle.steps) {
      if (Math.abs(x - sx) < w / 2 + margin && Math.abs(z - sz) < d / 2 + margin) return { x: sx, z: sz, w, d, top };
    }
  }
  return null;
}

// Which relic is on the isle nearest (x, z)
export function relicAt(island, x, z) {
  let best = null;
  for (const isle of island.sky ?? []) {
    if (!best || Math.hypot(x - isle.x, z - isle.z) < Math.hypot(x - best.x, z - best.z)) best = isle;
  }
  return best ? SKY_STYLES[best.style].relic : null;
}

// The isles of an island being grown (shared/worldgen.js growIsland), and the
// spots on them. Streams of their own ('sky', 'skystyle'), so nothing older
// moves. An island with no room for one goes without.
//   stream(part): the island's randomness for a part; draft: the island so far
//   shoreDist(x, z): how far inland; inland(angle, frac): a point that far in
//   taken: [[x, z]] the spots so far; onTrail(x, z); spawn; circle: the stone circle's radius
export function growSkyIsles({ stream, draft, shoreDist, inland, taken, onTrail, spawn, circle }) {
  const g = stream('sky');
  const look = stream('skystyle');
  const styles = SKY_STYLES.map((_, i) => i);
  for (let i = styles.length - 1; i > 0; i--) {
    const j = Math.floor(look.rng() * (i + 1));
    [styles[i], styles[j]] = [styles[j], styles[i]];
  }
  const want = g.int(...SKY_ISLES.count);
  const sky = [];
  const spots = [];
  const room = (isle) => rimMax(isle) + SKY_ISLES.stepSize[1] * 0.75 + 1.4; // its stair goes round it this far out
  for (let n = 0; n < 300 && sky.length < want; n++) {
    const r = round1(g.rand(...SKY_ISLES.radius));
    const top = round1(g.rand(...SKY_ISLES.top));
    const at = inland(g.rand(0, Math.PI * 2), Math.sqrt(g.rng()) * 0.8);
    const isle = {
      x: round1(at.x), z: round1(at.z), r, top,
      waves: [[round1(g.rand(0.2, 0.45)), g.int(3, 5), round1(g.rand(0, 6))], [round1(g.rand(0.1, 0.25)), g.int(6, 8), round1(g.rand(0, 6))]],
      style: 0, variant: 0, steps: [], house: null,
    };
    const out = room(isle);
    if (shoreDist(isle.x, isle.z) < out + 4) continue;
    if (Math.hypot(isle.x - spawn.x, isle.z - spawn.z) < out + circle + 3) continue;
    if (sky.some((o) => Math.hypot(isle.x - o.x, isle.z - o.z) < out + room(o) + 4)) continue;
    if (draft.topOver(isle.x, isle.z, out + 1)) continue; // (clear of the terraces and toadstools)
    const steps = growStair(g, isle, { draft, shoreDist, taken, onTrail, spawn, circle });
    if (!steps) continue;
    isle.steps = steps;
    isle.style = styles[sky.length];
    isle.variant = look.int(0, SKY_VARIANTS - 1);
    spots.push(...furnish(g, isle));
    sky.push(isle);
  }
  return sky.length ? { sky, spots } : null;
}

// The stair up to an isle: [[x, z, w, d, top], ...], from just off the ground
// to a hop below its edge, winding round it outside its edge (from the south,
// the camera's side, round to the east or the west), every step within a
// jump of the last; or null if there is no room for one
function growStair(g, isle, { draft, shoreDist, taken, onTrail, spawn, circle }) {
  const size = g.rand(...SKY_ISLES.stepSize);
  const out = rimMax(isle) + size * 0.75 + 0.4; // how far out the steps go round
  const first = g.rand(...SKY_ISLES.firstStep);
  const last = isle.top - g.rand(1, 1.3);
  const n = Math.ceil((last - first) / SKY_ISLES.rise) + 1;
  const rise = (last - first) / (n - 1);
  let apart = size + g.rand(0.6, 1.3); // middle to middle
  let turn = 2 * Math.asin(Math.min(1, apart / (2 * out)));
  if (turn * (n - 1) > Math.PI * 1.3) {
    // (a tall isle: closer steps, so the stair doesn't come back round on itself)
    turn = (Math.PI * 1.3) / (n - 1);
    apart = 2 * out * Math.sin(turn / 2);
    if (apart < size + 0.2) return null;
  }
  const start = Math.PI / 2 + g.rand(-0.6, 0.6); // (south)
  const way = g.rng() < 0.5 ? 1 : -1;
  const rest = n >= 7 ? g.int(Math.floor(n / 3), Math.floor((2 * n) / 3)) : -1; // a wider step half way, with a find on it
  const steps = [];
  for (let i = 0; i < n; i++) {
    const a = start + way * i * turn;
    const wide = i === rest ? 0.8 : 0;
    // (hugging the edge, so the last one is a hop from it)
    const d = rimAt(isle, a) + size * 0.75 + 0.4 + (i < n - 1 ? g.rand(0, 0.4) : 0) + wide * 0.6;
    const x = round1(isle.x + Math.cos(a) * d);
    const z = round1(isle.z + Math.sin(a) * d);
    const w = round1(size + wide);
    const dd = round1(size * g.rand(0.85, 1.1) + wide);
    const top = round1(first + i * rise);
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [x + (sx * w) / 2, z + (sz * dd) / 2]);
    if (!corners.every(([cx, cz]) => draft.isLand(cx, cz) && !draft.inPond(cx, cz) && shoreDist(cx, cz) > 2)) return null;
    if (draft.topOver(x, z, Math.max(w, dd) / 2 + 1)) return null;
    if (Math.hypot(x - spawn.x, z - spawn.z) < circle + 2 + w) return null;
    // the low steps are in the way down there: off the trails, and clear of the spots
    if (top < 2.6 && (onTrail(x, z) || taken.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < Math.max(w, dd) / 2 + 1.2))) return null;
    steps.push([x, z, w, dd, top]);
  }
  return steps;
}

// The building, and the spots on an isle and its stair
function furnish(g, isle) {
  const { x, z, top } = isle;
  const inner = rimMin(isle) - 0.8; // what is on the isle stays this far in
  // the building at the back (north), facing the camera
  let w = Math.min(5, Math.max(3.4, isle.r * 0.75));
  const hz = -isle.r * 0.28;
  while (w > 2.6 && Math.hypot(w / 2, hz - w * 0.45) > inner) w -= 0.2;
  isle.house = { x: round1(x), z: round1(z + hz), w: round1(w), d: round1(w * 0.85) };
  const { house } = isle;
  const spots = [];
  const at = (dx, dz) => [round1(x + dx), round1(z + dz)];
  const [rx, rz] = at(0, isle.r * 0.38);
  spots.push(['relic', rx, round1(top + RELIC_LIFT), rz]);
  const [cx, cz] = at(-isle.r * 0.5, isle.r * 0.12);
  spots.push(['sky_chest', cx, top, cz]);
  const vx = round1(house.x + house.w / 2 + 0.2);
  const vz = round1(house.z + house.d / 2 + 0.9);
  spots.push(['sky_vault', vx, top, vz]);
  // a few finds lying about, clear of the rest
  const clear = [[rx, rz], [cx, cz], [vx, vz]];
  const finds = g.int(...SKY_ISLES.finds);
  for (let n = 0, found = 0; n < 80 && found < finds; n++) {
    const a = g.rand(0, Math.PI * 2);
    const d = Math.sqrt(g.rng()) * inner;
    const [fx, fz] = at(Math.cos(a) * d, Math.sin(a) * d);
    if (Math.hypot(fx - x, fz - z) > inner) continue;
    if (Math.abs(fx - house.x) < house.w / 2 + 0.8 && Math.abs(fz - house.z) < house.d / 2 + 0.8) continue;
    if (clear.some(([ox, oz]) => Math.hypot(fx - ox, fz - oz) < 1.5)) continue;
    spots.push(['sky', fx, round1(top + 0.7), fz]);
    clear.push([fx, fz]);
    found++;
  }
  // and one on the wide step half way up
  const rest = isle.steps.reduce((best, s) => (s[2] * s[3] > best[2] * best[3] ? s : best), isle.steps[0]);
  if (rest[2] > isle.steps[0][2] + 0.5) spots.push(['sky', rest[0], round1(rest[4] + 0.7), rest[1]]);
  return spots;
}

// Is the stair up to each isle a climb a farmer can make? Problems, as for checkIsland (shared/worldgen.js)
export function checkSky(island) {
  const problems = [];
  for (const isle of island.sky ?? []) {
    const { steps } = isle;
    if (!steps.length) {
      problems.push(`the isle at ${isle.x}, ${isle.z} has no stair`);
      continue;
    }
    if (steps[0][4] > 1.6) problems.push(`the stair to ${isle.x}, ${isle.z} starts out of reach`);
    for (let i = 0; i < steps.length; i++) {
      const [x, z, w, d, top] = steps[i];
      if (![[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => island.isLand(x + (sx * w) / 2, z + (sz * d) / 2))) problems.push(`the step at ${x}, ${z} hangs over the sea`);
      if (onIsle(isle, x, z, 0.3)) problems.push(`the step at ${x}, ${z} is under its isle`);
      if (!i) continue;
      const [px, pz, pw, pd, ptop] = steps[i - 1];
      const gapX = Math.abs(x - px) - (w + pw) / 2;
      const gapZ = Math.abs(z - pz) - (d + pd) / 2;
      if (top - ptop > 1.6 || Math.hypot(Math.max(0, gapX), Math.max(0, gapZ)) > 2.2) problems.push(`the step at ${x}, ${z} is out of reach`);
    }
    // from the last step onto the isle
    const [x, z, w, d, top] = steps[steps.length - 1];
    const edge = rimAt(isle, Math.atan2(z - isle.z, x - isle.x));
    if (isle.top - top > 1.6 || Math.hypot(x - isle.x, z - isle.z) - Math.max(w, d) / 2 - edge > 2.2) problems.push(`the isle at ${isle.x}, ${isle.z} is out of reach of its stair`);
    if (!island.isLand(isle.x, isle.z)) problems.push(`the isle at ${isle.x}, ${isle.z} floats over the sea`);
  }
  return problems;
}
