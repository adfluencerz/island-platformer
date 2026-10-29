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
//          and lighter past it (the tiers with one); and (gfxShore: how near the open sea) the sand
//          wet and darker at the waterline, a lace of foam over its edge;
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
//          (gfxCliff, per vertex: metres under the lip, over the water)
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
const MORTAR = 'vec3(0.15, 0.122, 0.088)'; // (the stone's ground: between and round the slabs)
const SOIL = 'vec3(0.14, 0.095, 0.055)';

// how much of a puddle at p (0..1): soft-edged patches of a slow noise, a
// finer one wobbling their shores, fewer and smaller as the ground dries
// (more: more of them, on the flat slabs)
const PUDDLE = (p, seed, more = 0) => `smoothstep(0.0, 0.04, 0.75 * gfxNoise(${p} * 0.55 + ${seed}) + 0.25 * gfxNoise(${p} * 1.7 + ${seed} * 0.3) - ${(0.76 - more).toFixed(2)} + 0.08 * uWet)`;

const VERTEX = {
  tiles: ['attribute vec4 gfxKind;\nattribute float gfxShore;\nvarying vec4 vGroundKind;\nvarying float vGroundShore;', 'vGroundKind = gfxKind;\nvGroundShore = gfxShore;'],
  slab: ['attribute vec4 gfxMoss;\nvarying vec4 vGroundMoss;', 'vGroundMoss = gfxMoss;'],
  cliff: ['attribute vec2 gfxCliff;\nvarying vec2 vGroundCliff;', 'vGroundCliff = gfxCliff;'],
};

const FRAGMENT = {
  tiles: `
    // a dark speckle on the greens
    float groundSpeck = smoothstep(0.6, 0.85, gfxNoise(groundP * 3.7 + 7.1)) * gfxShow(3.7, groundPx);
    groundK *= 1.0 - 0.3 * groundSpeck * vGroundKind.x;
    // paths: worn lighter down the middle, in patches, and a few pale pebbles
    float groundWorn = smoothstep(0.55, 0.95, vGroundKind.z) * smoothstep(0.35, 0.75, gfxNoise(groundP * 0.7 + 11.3));
    float groundPebble = smoothstep(0.78, 0.9, gfxNoise(groundP * 5.1 + 23.9)) * gfxShow(5.1, groundPx);
    groundK *= 1.0 + vGroundKind.z * (0.24 * groundWorn + 0.16 * groundPebble);
    // sand: fine ripples across the wind, wandering, each a gentle rise and
    // a steep darker lee; shell flecks, pale or pink
    float groundRf = fract(dot(groundP, vec2(0.92, 0.38)) * 2.9 + gfxNoise(groundP * 0.45 + 2.0) * 1.6 + (gfxNoise(groundP * 1.4 + 6.0) - 0.5) * 0.5);
    float groundRise = smoothstep(0.0, 0.75, groundRf) * (1.0 - smoothstep(0.75, 1.0, groundRf));
    float groundLee = smoothstep(0.76, 0.84, groundRf) * (1.0 - smoothstep(0.9, 1.0, groundRf));
    groundK *= 1.0 + vGroundKind.w * gfxShow(2.9, groundPx * 0.5) * (0.16 * (groundRise - 0.5) - 0.12 * groundLee);
    diffuseColor.rgb *= groundK;
    // under the grass carpet (src/world.js makeCarpet, the tiers that have
    // one): a little darker and cooler between its blades near the camera;
    // past where it thins, lighter and warmer, as its lit blade tips are
    // seen from afar, so no ring shows where it ends
    float groundCarpet = 1.0 - 0.5 * smoothstep(uCarpetFar.x - 3.0, uCarpetFar.x + 3.0, distance(vGfxWorld, cameraPosition))
      - 0.5 * smoothstep(uCarpetFar.y - 6.0, uCarpetFar.y, distance(vGfxWorld, cameraPosition));
    diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(1.05, 1.05, 0.99), vec3(0.84, 0.86, 0.9), groundCarpet), vGroundKind.x * step(0.001, uCarpet));
    highp vec2 groundSc = groundP * 2.2;
    highp vec2 groundSi = floor(groundSc);
    vec2 groundSf = groundSc - groundSi - 0.5 - (gfxHash2(groundSi + 7.0) - 0.5) * 0.6;
    float groundShell = step(0.82, gfxHash(groundSi + 3.1)) * (1.0 - smoothstep(0.1, 0.15, length(groundSf * vec2(1.0, 1.6)))) * gfxShow(6.0, groundPx);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.92, 0.88, 0.8), vec3(0.92, 0.6, 0.55), gfxHash(groundSi + 11.0)), groundShell * smoothstep(0.5, 0.9, vGroundKind.w) * 0.85);
    // the waterline on sand (vGroundShore: 1 at a side facing the open sea):
    // wet, darker and a little cooler, its inner edge wavering and breathing
    // with the swash, a faint damp line at its top, and a lace of foam
    // washing in and out over its outer edge
    float groundSwash = sin(uTime * 0.85 + dot(groundP, vec2(0.23, 0.31)));
    float groundWetAt = vGroundShore + (gfxNoise(groundP * 1.1 + 41.0) - 0.5) * 0.24 + 0.05 * groundSwash;
    float groundWet = smoothstep(0.36, 0.58, groundWetAt) * vGroundKind.w;
    float groundDamp = smoothstep(0.2, 0.38, groundWetAt) * (1.0 - smoothstep(0.38, 0.5, groundWetAt)) * vGroundKind.w;
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.54, 0.44), groundWet) * (1.0 - 0.1 * groundDamp);
    float groundLaceAt = vGroundShore + 0.07 * groundSwash + (gfxNoise(groundP * 2.3 + vec2(uTime * 0.12, 7.0)) - 0.5) * 0.12;
    float groundLace = smoothstep(0.8, 0.9, groundLaceAt) * mix(0.55, smoothstep(0.3, 0.62, gfxNoise(groundP * 4.4 - vec2(0.0, uTime * 0.09))), gfxShow(4.4, groundPx));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.9), groundLace * 0.75 * vGroundKind.w);
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
    cliffMoss *= cliffHas * (1.0 - smoothstep(0.2, 0.3, cliffLum)) * mix(0.6, 1.0, gfxNoise(groundP * 3.3 + 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${MOSS} * groundK * (0.8 + 0.4 * gfxNoise(groundP * 5.1)), cliffMoss * 0.85);
    // wet and darker just over the water, its top edge wavering
    float cliffWet = 1.0 - smoothstep(0.12, 0.36, vGroundCliff.y + (gfxNoise(vec2(cliffAlong * 1.7, 4.0)) - 0.5) * 0.14);
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.55, 0.58), cliffWet * cliffHas);
    // and under the water (seen through a pond's), falling dark: the bank's contact shadow
    diffuseColor.rgb *= 1.0 - 0.6 * cliffHas * (1.0 - smoothstep(-0.3, 0.0, vGroundCliff.y));`,
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
    if (kind === 'tiles') use(shader, ['uTime', 'uCarpet', 'uCarpetFar'], 'f'); // (the swash on the wet sand; the grass carpet over it)
    const vertex = VERTEX[kind];
    if (vertex) {
      shader.vertexShader = patch(shader.vertexShader, 'common', vertex[0], 'GFX_GROUND');
      shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', vertex[1], 'GFX_GROUND');
    }
    const varying = vertex ? vertex[0].split('\n').filter((line) => line.startsWith('varying')).join('\n') : '';
    use(shader, ['uDetailGain'], 'f'); // (the tier's: stronger on medium, for a phone's small screen)
    shader.fragmentShader = patch(shader.fragmentShader, 'common', `${NOISE}${['slab', 'rough', 'cliff'].includes(kind) ? VORONOI : ''}${varying}
    float groundGain(float k) { return 1.0 + (k - 1.0) * uDetailGain; }`, 'GFX_GROUND');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
    highp vec2 groundP = ${AT[kind]};
    float groundPx = gfxFootprint(groundP);
    float groundK = 1.0 + (gfxNoise(groundP * 0.31) - 0.5) * 0.16
      + (gfxNoise(groundP * 1.17 + 19.7) - 0.5) * 0.08 * gfxShow(1.17, groundPx);
    ${FRAGMENT[kind].replaceAll('diffuseColor.rgb *= groundK', 'diffuseColor.rgb *= groundGain(groundK)')}`, 'GFX_GROUND');
  });
}
