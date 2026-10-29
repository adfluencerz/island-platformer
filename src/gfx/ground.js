import { hook } from './shading.js';
import { use } from './uniforms.js';
import { patch, define } from './chunks.js';
import { NOISE, VORONOI } from './noise.js';

// ---------- Painted detail on the ground ----------
// groundDetail(material, kind): the 'ground' hook. Two soft octaves of value
// noise in world XZ (about ±8 % and ±4 %) break up the flat colors, and each
// kind of surface adds its own touch:
//   tiles  the island's ground (world.js): its gfxKind attribute holds how
//          much of each kind of ground a vertex is (green, stone, path, sand,
//          mixed at the tiles' edges as the colors are): a dark speckle on
//          the greens, moss in the gaps of stone next to grass, paths worn
//          lighter down their middles with a few pale pebbles, faint ripples
//          on the sand; darker under the grass carpet near the camera
//          and lighter past it (the tiers with one); the sand's edge with
//          the green wavered a metre either way (gfxShore's y, z: the sand
//          and the green round it, blurred); and (gfxShore's x: how near the
//          open sea) the sand dark and wet with a sheen by the water, damp
//          beyond, a faint tide line, then dry and pale (its slope on into
//          the sea is the cliffs': world.js);
//          the stone's own ground (world.js gives it its neighbors' color)
//          a warm mortar out to a crisp, wavering edge, moss in its joints
//   slab   a stone tile's slab: cracks (Voronoi edges, some of them; all of
//          them on a few slabs), each piece and each slab its own tint, a
//          worn pale middle and a darker rim, and moss creeping in from the
//          sides that face grass (gfxMoss, per slab: -x, +x, -z, +z) and
//          along its shaded north edge
//   turf   a platform's turf: the speckle where it is green
//   earth  the sides of the earth: a mottle, soft clods and pale stones
//   rough  the sides of rock: a mottle, cracks (some Voronoi edges) and
//          each piece its own tint
//   cliff  the cliffs round the shore and down to a lower floor (world.js),
//          their grassy lip, earth and wet rock: the mottle, strata in thin
//          wavering bands, cracks, moss hanging from under the lip (not
//          under sand) and a wet darker band just over the water
//          (gfxCliff, per vertex: metres under the lip, over the water;
//          and 1 on a beach's slope into the sea: none of that, its wet
//          sand in its vertex colors)
// The sand (tiles) has fine ripples across the wind (from the south-west,
// as the clouds drift and the trees lean), a steep dark lee to each, and
// shell flecks, pale or pink.
// In the rain, puddles (groundPuddle, GFX_PUDDLE: src/gfx/light.js wets
// them) lie in the hollows of the paths and the stone (tiles) and on the
// plaza's slabs, shrinking as the ground dries (uWet).
// The finer octaves fade as a pixel covers more of them (gfxShow), so
// nothing shimmers far off. All of it (groundK, what multiplies the color)
// is stronger by the tier's detailGain (uDetailGain: medium's, so it reads
// on a phone's small screen). Runs right after the vertex color is in, before
// the seasons' grass color (src/seasons.js, hooked earlier: code patched in
// later lands first), which keeps the brightness it finds, so the detail
// survives the season's green and the greens are still found.

const MOSS = 'vec3(0.075, 0.2, 0.04)'; // (linear)

// The beach (tiles): how far in from the sea (tiles) the ground's gfxShore
// reaches, and what the sand is multiplied by where it is wet at the
// waterline and damp beyond it (src/world.js colors the beach's slope into the
// sea and the lip over it the same), and the colors (linear) its edge with
// the green is pushed toward: the sand's own and the grass's
export const SHORE_REACH = 2.5;
export const BEACH_WET = [0.42, 0.36, 0.3];
const BEACH_DAMP = [0.76, 0.7, 0.62];
const BEACH = {
  SHORE_REACH: SHORE_REACH.toFixed(2),
  BEACH_WET: `vec3(${BEACH_WET.join(', ')})`,
  BEACH_DAMP: `vec3(${BEACH_DAMP.join(', ')})`,
  BEACH_SAND: 'vec3(0.76, 0.6, 0.3)',
  BEACH_GREEN: 'vec3(0.11, 0.33, 0.045)',
};
const MORTAR = 'vec3(0.15, 0.122, 0.088)'; // (the stone's ground: between and round the slabs)
const SOIL = 'vec3(0.14, 0.095, 0.055)';

// how much of a puddle at p (0..1): soft-edged patches of a slow noise, a
// finer one wobbling their shores, fewer and smaller as the ground dries
// (more: more of them, on the flat slabs); a damp shore round each, partly
// in (light.js darkens all of it and mirrors the sky in the core)
const PUDDLE = (p, seed, more = 0) => `smoothstep(-0.07, 0.04, 0.75 * gfxNoise(${p} * 0.55 + ${seed}) + 0.25 * gfxNoise(${p} * 1.7 + ${seed} * 0.3) - ${(0.76 - more).toFixed(2)} + 0.08 * uWet)`;

const VERTEX = {
  tiles: ['attribute vec4 gfxKind;\nattribute vec3 gfxShore;\nvarying vec4 vGroundKind;\nvarying vec3 vGroundShore;', 'vGroundKind = gfxKind;\nvGroundShore = gfxShore;'],
  slab: ['attribute vec4 gfxMoss;\nvarying vec4 vGroundMoss;', 'vGroundMoss = gfxMoss;'],
  cliff: ['attribute vec3 gfxCliff;\nvarying vec3 vGroundCliff;', 'vGroundCliff = gfxCliff;'],
};

const FRAGMENT = {
  tiles: `
    // the edge between the sand and the green (vGroundShore.y, .z: how much
    // plain sand and green is round here, each blurred over two tiles, so .z
    // is about a half on the edge the tiles have): wavered a metre or so
    // either way by two octaves of noise, a soft painted edge, the color
    // there pushed to the sand's own or the green's (the vertex colors only
    // blur a quarter of a tile): no straight band. Not where a path or stone
    // is in the mix, nor away from the sand.
    float groundSandW = vGroundKind.w;
    float groundEdgeAt = 1.08 - vGroundShore.z + (gfxNoise(groundP * 0.55 + 23.0) - 0.5) * 0.5
      + (gfxNoise(groundP * 1.9 + 5.0) - 0.5) * 0.22 * gfxShow(1.9, groundPx);
    float groundEdgeW = fwidth(groundEdgeAt) + 0.05;
    float groundSand = mix(groundSandW, smoothstep(0.5 - groundEdgeW, 0.5 + groundEdgeW, groundEdgeAt),
      smoothstep(0.03, 0.15, vGroundShore.y) * clamp((vGroundKind.x + groundSandW - 0.85) * 6.7, 0.0, 1.0));
    vec3 groundGreenC = mix(BEACH_GREEN, max(diffuseColor.rgb - groundSandW * BEACH_SAND, 0.0) / max(1.0 - groundSandW, 0.05), 1.0 - smoothstep(0.35, 0.7, groundSandW));
    diffuseColor.rgb = groundSand > groundSandW
      ? mix(diffuseColor.rgb, BEACH_SAND, (groundSand - groundSandW) / max(1.0 - groundSandW, 1e-3))
      : mix(diffuseColor.rgb, groundGreenC, (groundSandW - groundSand) / max(groundSandW, 1e-3));
    float groundGreen = clamp(vGroundKind.x + groundSandW - groundSand, 0.0, 1.0);
    // a dark speckle on the greens
    float groundSpeck = smoothstep(0.6, 0.85, gfxNoise(groundP * 3.7 + 7.1)) * gfxShow(3.7, groundPx);
    groundK *= 1.0 - 0.3 * groundSpeck * groundGreen;
    // paths: worn lighter down the middle, in patches, and a few pale pebbles
    float groundWorn = smoothstep(0.55, 0.95, vGroundKind.z) * smoothstep(0.35, 0.75, gfxNoise(groundP * 0.7 + 11.3));
    float groundPebble = smoothstep(0.78, 0.9, gfxNoise(groundP * 5.1 + 23.9)) * gfxShow(5.1, groundPx);
    groundK *= 1.0 + vGroundKind.z * (0.24 * groundWorn + 0.16 * groundPebble);
    // sand: fine ripples across the wind, wandering, each a gentle rise and
    // a steep darker lee; shell flecks, pale or pink
    float groundRf = fract(dot(groundP, vec2(0.92, 0.38)) * 2.9 + gfxNoise(groundP * 0.45 + 2.0) * 1.6 + (gfxNoise(groundP * 1.4 + 6.0) - 0.5) * 0.5);
    float groundRise = smoothstep(0.0, 0.75, groundRf) * (1.0 - smoothstep(0.75, 1.0, groundRf));
    float groundLee = smoothstep(0.76, 0.84, groundRf) * (1.0 - smoothstep(0.9, 1.0, groundRf));
    groundK *= 1.0 + groundSand * gfxShow(2.9, groundPx * 0.5) * (0.16 * (groundRise - 0.5) - 0.12 * groundLee);
    diffuseColor.rgb *= groundK;
    // under the grass carpet (src/world.js makeCarpet, the tiers that have
    // one): a little darker and cooler between its blades near the camera;
    // past where it thins, lighter and warmer, as its lit blade tips are
    // seen from afar, so no ring shows where it ends
    float groundCarpet = 1.0 - 0.5 * smoothstep(uCarpetFar.x - 3.0, uCarpetFar.x + 3.0, distance(vGfxWorld, cameraPosition))
      - 0.5 * smoothstep(uCarpetFar.y - 6.0, uCarpetFar.y, distance(vGfxWorld, cameraPosition));
    diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(1.05, 1.05, 0.99), vec3(0.84, 0.86, 0.9), groundCarpet), groundGreen * step(0.001, uCarpet));
    highp vec2 groundSc = groundP * 2.2;
    highp vec2 groundSi = floor(groundSc);
    vec2 groundSf = groundSc - groundSi - 0.5 - (gfxHash2(groundSi + 7.0) - 0.5) * 0.6;
    float groundShell = step(0.82, gfxHash(groundSi + 3.1)) * (1.0 - smoothstep(0.1, 0.15, length(groundSf * vec2(1.0, 1.6)))) * gfxShow(6.0, groundPx);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.92, 0.88, 0.8), vec3(0.92, 0.6, 0.55), gfxHash(groundSi + 11.0)), groundShell * smoothstep(0.5, 0.9, groundSand) * 0.85);
    // from the sea up (vGroundShore.x: 1 at a side facing the open sea, 0
    // SHORE_REACH in; the beach's slope on into the water is the cliffs',
    // as wet as this at its top): dark wet sand with a sheen of the sky by
    // the water, damp sand beyond, a faint tide line of drift at its top,
    // then dry and pale; its edges wavering, the wet's breathing with the swash
    float groundSwash = sin(uTime * 0.85 + dot(groundP, vec2(0.23, 0.31)));
    float groundD = (1.0 - vGroundShore.x) * SHORE_REACH + (gfxNoise(groundP * 0.8 + 41.0) - 0.5) * 0.6
      + (gfxNoise(groundP * 2.7 + 13.0) - 0.5) * 0.2 * gfxShow(2.7, groundPx);
    float groundWet = (1.0 - smoothstep(0.45, 1.05, groundD - 0.08 * groundSwash)) * groundSand;
    float groundDamp = (1.0 - smoothstep(1.0, 2.0, groundD)) * groundSand;
    float groundTide = smoothstep(1.9, 2.0, groundD) * (1.0 - smoothstep(2.04, 2.2, groundD)) * groundSand
      * mix(0.5, smoothstep(0.35, 0.6, gfxNoise(groundP * 3.3 + 2.0)), gfxShow(3.3, groundPx));
    diffuseColor.rgb *= mix(vec3(1.0), BEACH_DAMP, groundDamp) * mix(vec3(1.0), BEACH_WET / BEACH_DAMP, groundWet) * (1.0 - 0.22 * groundTide);
    diffuseColor.rgb *= 1.0 + vec3(0.1, 0.1, 0.13) * (1.0 - groundDamp) * groundSand; // (the dry sand pale)
    vec3 groundV = normalize(cameraPosition - vGfxWorld);
    float groundSheen = groundWet * (0.3 + 0.7 * pow(1.0 - groundV.y, 2.0)) * mix(0.7, 1.0, gfxNoise(groundP * 1.3 + vec2(uTime * 0.04, 2.0)));
    diffuseColor.rgb = mix(diffuseColor.rgb, uSkyHorizon * 0.5, groundSheen * 0.22);
    // the stone's own ground (world.js lends it no color, so it doesn't blur
    // out into the grass): a warm dark mortar between and round the slabs,
    // some of it soil, out to a crisp edge that wavers as if painted; moss
    // creeping in over it from the grass, and in the joints on each slab's
    // shaded (north) side
    float groundStoneAt = vGroundKind.y + (gfxNoise(groundP * 2.6 + 4.3) - 0.5) * 0.6 * gfxShow(2.6, groundPx)
      + (gfxNoise(groundP * 7.3 + 1.9) - 0.5) * 0.25 * gfxShow(7.3, groundPx);
    float groundStoneW = fwidth(groundStoneAt) * 0.75 + 0.01;
    float groundStone = smoothstep(0.64 - groundStoneW, 0.64 + groundStoneW, groundStoneAt);
    vec3 groundMortar = mix(${MORTAR}, ${SOIL}, smoothstep(0.3, 0.7, gfxNoise(groundP * 1.7 + 8.8)));
    diffuseColor.rgb = mix(diffuseColor.rgb, groundMortar * groundGain(groundK), groundStone);
    highp vec2 groundTile = groundP - floor(groundP + 0.5); // (where on its tile: a slab covers ±0.43)
    float groundNorth = mix(0.3, 1.0 - smoothstep(-0.46, -0.4, groundTile.y), gfxShow(8.0, groundPx));
    float groundMoss = groundStone * clamp(max(groundNorth * smoothstep(0.4, 0.7, gfxNoise(groundP * 3.1 + 3.3)),
      vGroundKind.x * 3.0 * smoothstep(0.35, 0.65, mix(0.5, gfxNoise(groundP * 1.9 + 3.3), gfxShow(1.9, groundPx)))), 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${MOSS} * groundGain(groundK), groundMoss * 0.75);
    // puddles in the hollows of the paths and the stone
    float groundPuddle = smoothstep(0.65, 0.95, vGroundKind.y + vGroundKind.z) * (1.0 - groundMoss) * ${PUDDLE('groundP', '31.7')};`,
  slab: `
    // pieces with cracks between (only some edges crack; on one slab in five
    // all of them, deeper), each its own tint, and the slab its own, a
    // little warmer or cooler, lighter or darker; worn smooth and pale in
    // its middle where feet go, darker and grimier round its rim
    highp vec2 groundCell = gfxVoronoi(groundP * 1.15);
    highp vec2 groundId = floor(groundP + 0.5);
    float groundSlab = gfxHash(groundId);
    float groundCracked = step(0.8, gfxHash(groundId + 17.3));
    vec2 groundAt = groundP - groundId; // (where on its slab: ±0.43)
    float groundMid = 1.0 - smoothstep(0.05, 0.36, length(groundAt));
    float groundRim = mix(0.3, smoothstep(0.3, 0.42, max(abs(groundAt.x), abs(groundAt.y))), gfxShow(8.0, groundPx));
    groundK = mix(groundK, 1.0, 0.5 * groundMid) * (0.96 + 0.08 * groundCell.y) * (1.0 + 0.14 * groundMid - 0.16 * groundRim);
    float groundCrack = 1.0 - smoothstep(0.025, 0.025 + fwidth(groundCell.x) * 1.5 + 0.01, groundCell.x);
    groundCrack *= max(smoothstep(0.4, 0.65, gfxNoise(groundP * 0.9 + 5.0)), groundCracked) * smoothstep(0.06, 0.03, groundPx);
    groundK *= 1.0 - (0.3 + 0.2 * groundCracked) * groundCrack;
    diffuseColor.rgb *= groundK * (1.0 + (mix(vec3(1.06, 1.0, 0.9), vec3(0.97, 0.98, 1.0), groundSlab) * (0.93 + 0.14 * gfxHash(groundId + 5.1)) - 1.0) * uDetailGain);
    // moss creeping in from a side that faces grass and along its shaded
    // (north) edge, into the cracks there, and the odd pocket of it
    vec4 groundSide = vGroundMoss * (1.0 - smoothstep(0.0, 0.3, vec4(groundAt.x + 0.43, 0.43 - groundAt.x, groundAt.y + 0.43, 0.43 - groundAt.y)));
    float groundEdge = max(max(groundSide.x, groundSide.y), max(groundSide.z, groundSide.w));
    groundEdge = max(groundEdge, 0.55 * (1.0 - smoothstep(0.0, 0.12, groundAt.y + 0.43)) * gfxShow(8.0, groundPx));
    float groundMoss = smoothstep(0.35, 0.75, groundEdge * (0.45 + 0.9 * mix(0.5, gfxNoise(groundP * 3.1 + 1.7), gfxShow(3.1, groundPx))));
    groundMoss = max(groundMoss, groundCrack * max(groundEdge, 0.5 * groundCracked));
    groundMoss = max(groundMoss, 0.6 * smoothstep(0.8, 0.92, gfxNoise(groundP * 1.4 + 9.0)));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${MOSS} * (1.0 + 0.4 * (gfxNoise(groundP * 4.7) - 0.5) * gfxShow(4.7, groundPx)), groundMoss * 0.8);
    // puddles
    float groundPuddle = (1.0 - groundMoss) * ${PUDDLE('groundP', '13.1', 0.05)};`,
  turf: `
    float groundGreen = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
    float groundSpeck = smoothstep(0.6, 0.85, gfxNoise(groundP * 3.7 + 7.1)) * gfxShow(3.7, groundPx);
    diffuseColor.rgb *= groundK * (1.0 - 0.3 * groundSpeck * groundGreen);`,
  earth: `
    float groundClod = (gfxNoise(groundP * 2.2 + 8.1) - 0.5) * gfxShow(2.2, groundPx);
    float groundStone = smoothstep(0.8, 0.9, gfxNoise(groundP * 4.3 + 3.7)) * gfxShow(4.3, groundPx);
    diffuseColor.rgb *= groundK * (1.0 + 0.18 * groundClod) * (1.0 + 0.3 * groundStone);`,
  rough: `
    highp vec2 groundCell = gfxVoronoi(groundP * 1.4);
    float groundCrack = 1.0 - smoothstep(0.025, 0.025 + fwidth(groundCell.x) * 1.5 + 0.01, groundCell.x);
    groundCrack *= smoothstep(0.4, 0.65, gfxNoise(groundP * 0.9 + 5.0)) * smoothstep(0.06, 0.03, groundPx);
    diffuseColor.rgb *= groundK * (0.94 + 0.12 * groundCell.y) * (1.0 - 0.35 * groundCrack);`,
  cliff: `
    vec3 cliffN = normalize(cross(dFdx(vGfxWorld), dFdy(vGfxWorld)));
    float cliffWall = 1.0 - smoothstep(0.55, 0.85, abs(cliffN.y)); // (a wall, not the lip's top)
    float cliffHas = step(1e-4, abs(vGroundCliff.x) + abs(vGroundCliff.y));
    float cliffLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    // strata: thin bands by height, wavering, each its own shade, a dark seam between
    highp float cliffY = vGfxWorld.y * 3.4 + (gfxNoise(groundP * 0.7 + 3.0) - 0.5) * 1.2;
    float cliffBand = gfxHash(vec2(floor(cliffY), 5.0));
    float cliffSeam = 1.0 - smoothstep(0.0, 0.12, min(fract(cliffY), 1.0 - fract(cliffY)));
    groundK *= 1.0 + cliffWall * gfxShow(3.4, groundPx * 0.5) * ((cliffBand - 0.5) * 0.16 - 0.14 * cliffSeam);
    // cracks: some of the Voronoi edges
    highp vec2 cliffC = gfxVoronoi(groundP * 1.5);
    float cliffCrack = 1.0 - smoothstep(0.022, 0.022 + fwidth(cliffC.x) * 1.5 + 0.01, cliffC.x);
    cliffCrack *= smoothstep(0.4, 0.62, gfxNoise(groundP * 0.8 + 2.0)) * smoothstep(0.06, 0.03, groundPx) * cliffWall;
    groundK *= (0.95 + 0.1 * cliffC.y) * (1.0 - 0.4 * cliffCrack);
    diffuseColor.rgb *= groundK;
    // moss hanging from under the lip in tongues (not under sand)
    float cliffAlong = vGfxWorld.x + vGfxWorld.z;
    float cliffTongue = 0.12 + 0.4 * gfxNoise(vec2(cliffAlong * 2.6, 0.5)) * gfxNoise(vec2(cliffAlong * 0.7, 3.5)) * 2.0;
    float cliffMoss = smoothstep(0.03, 0.05, vGroundCliff.x) * (1.0 - smoothstep(cliffTongue - 0.08, cliffTongue, vGroundCliff.x));
    cliffMoss *= cliffHas * (1.0 - vGroundCliff.z) * (1.0 - smoothstep(0.2, 0.3, cliffLum)) * mix(0.6, 1.0, gfxNoise(groundP * 3.3 + 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${MOSS} * groundK * (0.8 + 0.4 * gfxNoise(groundP * 5.1)), cliffMoss * 0.85);
    // wet and darker just over the water, its top edge wavering
    float cliffWet = 1.0 - smoothstep(0.12, 0.36, vGroundCliff.y + (gfxNoise(vec2(cliffAlong * 1.7, 4.0)) - 0.5) * 0.14);
    // (not on a beach's slope on into the sea, vGroundCliff.z: wet sand by its vertex colors)
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.55, 0.58), cliffWet * cliffHas * (1.0 - vGroundCliff.z));
    // and under the water (seen through a pond's), falling dark: the bank's contact shadow
    diffuseColor.rgb *= 1.0 - 0.6 * cliffHas * (1.0 - vGroundCliff.z) * (1.0 - smoothstep(-0.3, 0.0, vGroundCliff.y));`,
};

// where the noise is read: the ground's plane, or (for sides) slanted by the
// height, so a wall facing x or z, and a top, all get a mottle
const AT = {
  tiles: 'vGfxWorld.xz',
  slab: 'vGfxWorld.xz',
  turf: 'vGfxWorld.xz',
  earth: 'vGfxWorld.xz + vGfxWorld.y * vec2(0.83, -0.61)',
  rough: 'vGfxWorld.xz + vGfxWorld.y * vec2(0.83, -0.61)',
  cliff: 'vGfxWorld.xz + vGfxWorld.y * vec2(0.83, -0.61)',
};

export function groundDetail(material, kind) {
  return hook(material, `ground:${kind}`, (shader) => {
    define(shader, 'GFX_WORLD');
    define(shader, 'GFX_GROUND');
    if (kind === 'tiles' || kind === 'slab') define(shader, 'GFX_PUDDLE');
    if (kind === 'tiles') use(shader, ['uTime', 'uCarpet', 'uCarpetFar', 'uSkyHorizon'], 'f'); // (the swash on the wet sand, its sheen; the grass carpet over it)
    const vertex = VERTEX[kind];
    if (vertex) {
      shader.vertexShader = patch(shader.vertexShader, 'common', vertex[0], 'GFX_GROUND');
      shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', vertex[1], 'GFX_GROUND');
    }
    const varying = vertex ? vertex[0].split('\n').filter((line) => line.startsWith('varying')).join('\n') : '';
    use(shader, ['uDetailGain'], 'f'); // (the tier's: stronger on medium, for a phone's small screen)
    const beach = kind === 'tiles' ? Object.entries(BEACH).map(([k, v]) => `#define ${k} ${v}\n`).join('') : '';
    shader.fragmentShader = patch(shader.fragmentShader, 'common', `${NOISE}${['slab', 'rough', 'cliff'].includes(kind) ? VORONOI : ''}${beach}${varying}
    float groundGain(float k) { return 1.0 + (k - 1.0) * uDetailGain; }`, 'GFX_GROUND');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
    highp vec2 groundP = ${AT[kind]};
    float groundPx = gfxFootprint(groundP);
    float groundK = 1.0 + (gfxNoise(groundP * 0.31) - 0.5) * 0.16
      + (gfxNoise(groundP * 1.17 + 19.7) - 0.5) * 0.08 * gfxShow(1.17, groundPx);
    ${FRAGMENT[kind].replaceAll('diffuseColor.rgb *= groundK', 'diffuseColor.rgb *= groundGain(groundK)')}`, 'GFX_GROUND');
  });
}
