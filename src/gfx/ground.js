import { hook } from './shading.js';
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
//          on the sand
//   slab   a stone tile's slab: cracks (Voronoi edges, some of them), each
//          piece and each slab its own tint, and moss creeping in from the
//          sides that face grass (gfxMoss, per slab: -x, +x, -z, +z)
//   turf   a platform's turf: the speckle where it is green
//   earth, rough  the sides of the earth and of rock: a soft mottle
//   cliff  the cliffs round the shore and down to a lower floor (world.js),
//          their grassy lip, earth and wet rock: the same mottle
// The finer octaves fade as a pixel covers more of them (gfxShow), so
// nothing shimmers far off. Runs right after the vertex color is in, before
// the seasons' grass color (src/seasons.js, hooked earlier: code patched in
// later lands first), which keeps the brightness it finds, so the detail
// survives the season's green and the greens are still found.

const MOSS = 'vec3(0.075, 0.2, 0.04)'; // (linear)

const VERTEX = {
  tiles: ['attribute vec4 gfxKind;\nvarying vec4 vGroundKind;', 'vGroundKind = gfxKind;'],
  slab: ['attribute vec4 gfxMoss;\nvarying vec4 vGroundMoss;', 'vGroundMoss = gfxMoss;'],
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
    // sand: faint ripples, wandering
    float groundRipple = sin(dot(groundP, vec2(0.6, 0.8)) * 7.0 + gfxNoise(groundP * 0.4 + 2.0) * 5.0);
    groundK *= 1.0 + groundRipple * 0.035 * vGroundKind.w * gfxShow(1.2, groundPx);
    diffuseColor.rgb *= groundK;
    // moss where stone meets grass
    float groundMoss = clamp(vGroundKind.y * vGroundKind.x * 4.0, 0.0, 1.0) * smoothstep(0.3, 0.7, mix(0.5, gfxNoise(groundP * 1.9 + 3.3), gfxShow(1.9, groundPx)));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${MOSS} * groundK, groundMoss * 0.7);`,
  slab: `
    // pieces with cracks between (only some edges crack), each its own tint,
    // and the slab its own, a little warmer or cooler
    highp vec2 groundCell = gfxVoronoi(groundP * 1.15);
    float groundSlab = gfxHash(floor(groundP + 0.5));
    groundK *= 0.96 + 0.08 * groundCell.y;
    float groundCrack = 1.0 - smoothstep(0.025, 0.025 + fwidth(groundCell.x) * 1.5 + 0.01, groundCell.x);
    groundCrack *= smoothstep(0.4, 0.65, gfxNoise(groundP * 0.9 + 5.0)) * smoothstep(0.06, 0.03, groundPx);
    groundK *= 1.0 - 0.3 * groundCrack;
    diffuseColor.rgb *= groundK * mix(vec3(1.04, 1.0, 0.94), vec3(0.95, 0.99, 1.05), groundSlab);
    // moss creeping in from a side that faces grass, into the cracks there,
    // and the odd pocket of it
    vec2 groundAt = groundP - floor(groundP + 0.5); // (where on its slab: ±0.43)
    vec4 groundSide = vGroundMoss * (1.0 - smoothstep(0.0, 0.3, vec4(groundAt.x + 0.43, 0.43 - groundAt.x, groundAt.y + 0.43, 0.43 - groundAt.y)));
    float groundEdge = max(max(groundSide.x, groundSide.y), max(groundSide.z, groundSide.w));
    float groundMoss = smoothstep(0.35, 0.75, groundEdge * (0.45 + 0.9 * mix(0.5, gfxNoise(groundP * 3.1 + 1.7), gfxShow(3.1, groundPx))));
    groundMoss = max(groundMoss, groundCrack * groundEdge);
    groundMoss = max(groundMoss, 0.6 * smoothstep(0.8, 0.92, gfxNoise(groundP * 1.4 + 9.0)));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${MOSS} * (1.0 + 0.4 * (gfxNoise(groundP * 4.7) - 0.5) * gfxShow(4.7, groundPx)), groundMoss * 0.8);`,
  turf: `
    float groundGreen = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
    float groundSpeck = smoothstep(0.6, 0.85, gfxNoise(groundP * 3.7 + 7.1)) * gfxShow(3.7, groundPx);
    diffuseColor.rgb *= groundK * (1.0 - 0.3 * groundSpeck * groundGreen);`,
  earth: `
    diffuseColor.rgb *= groundK;`,
};
FRAGMENT.rough = FRAGMENT.earth;
FRAGMENT.cliff = FRAGMENT.earth;

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
    const vertex = VERTEX[kind];
    if (vertex) {
      shader.vertexShader = patch(shader.vertexShader, 'common', vertex[0], 'GFX_GROUND');
      shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', vertex[1], 'GFX_GROUND');
    }
    const varying = vertex ? vertex[0].split('\n')[1] : '';
    shader.fragmentShader = patch(shader.fragmentShader, 'common', `${NOISE}${kind === 'slab' ? VORONOI : ''}${varying}`, 'GFX_GROUND');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
    highp vec2 groundP = ${AT[kind]};
    float groundPx = gfxFootprint(groundP);
    float groundK = 1.0 + (gfxNoise(groundP * 0.31) - 0.5) * 0.16
      + (gfxNoise(groundP * 1.17 + 19.7) - 0.5) * 0.08 * gfxShow(1.17, groundPx);
    ${FRAGMENT[kind]}`, 'GFX_GROUND');
  });
}
