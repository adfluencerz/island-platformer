import * as THREE from 'three';
import { hook } from './shading.js';
import { patch, define } from './chunks.js';
import { NOISE, VORONOI } from './noise.js';

// ---------- Painted detail on what is built ----------
// detail(material, look?, name?): the 'detail' hook. A look painted over the
// material's color, hand-painted rather than photographic, chosen by
// material.userData.gfx.detail (or `look`), else by the material's name (or
// `name`: a key in a table of materials), else its color (defaultLook):
//   wood     grain along the piece's long side, streaks, the odd knot, its
//            end grain darker with rings
//   plank    wood in boards: seams across the grain, each board its own tint
//   stone    blocks fitted to the piece, mortar between, each its own tint,
//            softened edges, chips
//   brick    smaller blocks, redder each to each, pale mortar
//   cobble   round stones (Voronoi cells) with dark gaps
//   thatch   straw streaks down the slope, layers, darker at the eaves
//   tile     roof tiles in rows up the slope, each row shading the one below
//   cloth    weave and soft sun-faded blotches
//   metal    brushed streaks, rust spots on iron (not on tin or brass)
//   plaster  a soft mottle, a little grime at the foot of a wall
//   endgrain a log's cut end: rings
// and on what grows (the pieces' own y their axis, as a trunk stands):
//   bark     ridges up the trunk round its axis, darker furrows between, the
//            plates broken across now and then, moss round its foot
//   rock     cracks along Voronoi edges (some of them), each piece its own
//            tint, pale lichen on what faces up, moss on the shaded
//            underside and low down, near the ground
//   soil     clods (Voronoi cells) with dark gaps, a damp darker speckle,
//            pale grit
//   leaf     a soft blotchy canopy: leafy clumps with dark between, lighter
//            and warmer dapples on top (continuous over a round blob)
//   crop     leaves: a pale midrib and side veins, lighter to the tip;
//            fruit: a soft blush, lighter on top, fine speckle
//   reed     streaks along the blade, darker nodes, paler toward the tip
//   fern     a frond: a dark midrib and leaflets slanting off it
// and on what lives and what it holds (farmers, animals, mounts, tools;
// patterns over the piece's own 3D place, no seed, so nothing jumps as it walks):
//   skin     a soft warm and cool mottle, a fine speckle
//   hair     strands from the crown down (round the piece's y axis), clumps,
//            a soft sheen ring
//   garment  over a cloth texture: soft folds, a heathered streak, stitched
//            seams down the sides (z = 0 in a body's or a limb's frame), worn
//            paler in patches at the knees and elbows (a band about 0.25
//            under a limb's pivot, on its front and back)
//   straw    a hat's braid, round and round from the brim's edge to the
//            crown, each band its own tint, gaps between
//   leather  a pebbled grain (Voronoi cells), creases, pale scuffs
//   fur      a short-fur speckle and soft tufts, darker underneath, lighter
//            on the back (hide, feathers, a coat, a bee's fuzz)
//   wool     round curls (Voronoi cells), darker underneath
//   horn     beaks, hooves, horns: fine growth ridges, lighter to the tip
//   tool     by its color: wood grain along its y (brown), brushed metal
//            (grey or metallic), a dull sheen on painted metal
// The look is a uniform (gfxDetailLook), so every material with it shares one
// program whatever its look (one for built things' looks, one for nature's,
// one for what lives: 'detail', 'detail:nature', 'detail:living'); a home's baked mesh (homekit.js bake) carries it
// in its vertices instead (detailBaked, 'detail:baked'), with each part's own
// frame (bakeDetail), the vertex colors as the base; a dungeon's instanced
// pieces in an instanced attribute (detailInstanced, 'detail:instanced').
//
// Where the pattern lies: the piece's own frame (object space scaled to
// metres, src: the model and instance matrices), so it moves with a moving
// part and runs along a rotated one: a wall face's u is across, v up (up the
// slope on a roof), a top's u along its longer side. The piece's size picks
// the grain's way and fits blocks and boards to it. A piece's position gives
// it a seed (its tint, where its noise starts). The finer octaves fade as a
// pixel covers more of them (gfxShow), so nothing shimmers far off. Runs
// after the color (vertex colors and instance colors in), before snow (at
// normal_fragment_maps, src/seasons.js): the snow, light, clouds and rim all
// fall on top.
//
// To add a look: a name in LOOKS (its index is its number), a branch in
// FRAGMENT_BUILT, FRAGMENT_NATURE or FRAGMENT_LIVING (and its name in NATURE
// or LIVING if one of those), and a
// name pattern in BY_NAME if materials should get it on their own.

export const LOOKS = ['none', 'wood', 'plank', 'stone', 'brick', 'cobble', 'thatch', 'tile', 'cloth', 'metal', 'plaster', 'endgrain',
  'bark', 'rock', 'soil', 'leaf', 'crop', 'reed', 'fern',
  'skin', 'hair', 'garment', 'straw', 'leather', 'fur', 'wool', 'horn', 'tool'];

// a material's look from its name (first match wins)
const BY_NAME = [
  [/end ?grain/i, 'endgrain'],
  [/reed|rush|sedge/i, 'reed'],
  [/fern|frond/i, 'fern'],
  [/thatch|straw|hay/i, 'thatch'],
  [/rock|boulder|crag/i, 'rock'],
  [/leaf|leaves|hedge|moss|canopy|bush/i, 'leaf'],
  [/soil|earth|dirt|tilled/i, 'soil'],
  [/roof|tile/i, 'tile'],
  [/brick|chimney/i, 'brick'],
  [/cobble|gravel|pebble/i, 'cobble'],
  [/stone|flag(?!pole)|slab|pier|cairn|well/i, 'stone'],
  [/iron|tin\b|tin[A-Z]|brass|copper|metal|steel|hinge/i, 'metal'],
  [/cloth|linen|canvas|awning|sack|sheet|blanket|rug|banner/i, 'cloth'],
  [/plank|board|floor|crate(?!Dark)|door|deck|shelf/i, 'plank'],
  [/plaster|wall|render/i, 'plaster'],
  [/wood|post|rail|bark|stave|beam|bench|log|trim|picket|withy|frame|edging|crate|timber|stake/i, 'wood'],
];
// names that stay plain (grass and flowers, water, food, light...)
const PLAIN = /lichen|grass|stalk|fruit|flower|snow|smoke|petal|water|grout|glass|window|lantern|flame|fire|portal|glow|hole|crow|bird|bee\b|dove|beak|cheese|mayo|honey|ash|book|mirror/i;

const _hsl = { h: 0, s: 0, l: 0 };
// a look from a material's color, for one with no name: browns are wood,
// greys stone, dark reddish browns brick, the palest plaster
export function defaultLook(material, name = material.name) {
  const set = material.userData?.gfx?.detail;
  if (set) return set;
  if (material.transparent || material.map) return 'none';
  if (material.emissive && material.emissive.getHex() !== 0) return 'none';
  if (name) {
    if (PLAIN.test(name)) return 'none';
    for (const [re, look] of BY_NAME) if (re.test(name)) return look;
  }
  if ((material.metalness ?? 0) >= 0.3) return 'metal';
  if (!material.color) return 'none';
  material.color.getHSL(_hsl, THREE.SRGBColorSpace);
  const { h, s, l } = _hsl;
  const deg = h * 360;
  if (s < 0.14 && l > 0.25 && l < 0.8) return 'stone';
  if (deg >= 15 && deg <= 48 && s >= 0.2 && l >= 0.12 && l <= 0.62) return 'wood';
  if ((deg < 15 || deg > 345) && s >= 0.3 && s <= 0.75 && l >= 0.18 && l <= 0.42) return 'brick';
  if (l >= 0.82 && s < 0.6) return 'plaster';
  return 'none';
}

export const lookIndex = (look) => Math.max(0, LOOKS.indexOf(look));

// ---------- The shader ----------
const VERTEX_COMMON = /* glsl */ `
varying highp vec3 vDetailP;
varying vec3 vDetailUp;
varying vec4 vDetailSize;
#ifdef GFX_DETAIL_BAKED
attribute vec4 gfxPiece;
attribute vec4 gfxSize;
attribute vec3 gfxUp;
varying float vDetailLook;
#endif
#ifdef GFX_DETAIL_INSTANCED
attribute float gfxLook;
varying float vDetailLook;
#endif`;

const VERTEX = /* glsl */ `
#ifdef GFX_DETAIL_BAKED
  vDetailP = gfxPiece.xyz;
  vDetailLook = gfxPiece.w;
  vDetailSize = gfxSize;
  vDetailUp = gfxUp;
#else
  mat4 detailM = modelMatrix;
  #ifdef USE_INSTANCING
    detailM = modelMatrix * instanceMatrix;
  #endif
  vec3 detailS = max(vec3(length(detailM[0].xyz), length(detailM[1].xyz), length(detailM[2].xyz)), vec3(1e-4));
  vDetailP = transformed * detailS;
  vDetailUp = vec3(detailM[0].y, detailM[1].y, detailM[2].y) / detailS;
  highp vec3 detailAt = floor(detailM[3].xyz * 2.0 + 0.5) + floor(detailS * 37.0 + 0.5);
  vDetailSize = vec4(detailS, fract(dot(detailAt, vec3(0.1031, 0.1137, 0.0973)) * 13.7 + dot(detailAt, vec3(0.0371, 0.0613, 0.0519))));
  #ifdef GFX_DETAIL_INSTANCED
    vDetailLook = gfxLook;
  #endif
#endif`;

const FRAGMENT_COMMON = /* glsl */ `
varying highp vec3 vDetailP;
varying vec3 vDetailUp;
varying vec4 vDetailSize;
#if defined(GFX_DETAIL_BAKED) || defined(GFX_DETAIL_INSTANCED)
varying float vDetailLook;
#else
uniform float gfxDetailLook;
#endif
${NOISE}${VORONOI}
#ifndef GFX_DETAIL_FN
#define GFX_DETAIL_FN
#define GFX_DETAIL_MOSS vec3(0.075, 0.2, 0.04)
// how much of a line of half-width w (metres) covers a point d from it, for a pixel px wide
float gfxDetailLine(float d, float w, float px) {
  return (1.0 - smoothstep(w, w + px, d)) * min(1.0, 2.5 * w / px);
}
// blocks fitted to a face (ext: its size along u and v, at: where on it from
// its corner, both in metres), about size each, every other row half a
// block along. x: the distance to the block's edge (metres), y: the block's own 0..1
vec2 gfxDetailBlocks(highp vec2 at, vec2 ext, vec2 size, float known) {
  vec2 n = max(vec2(1.0), floor(ext / size + 0.5));
  vec2 cell = mix(size, ext / n, known);
  highp vec2 c = at / cell;
  float row = floor(c.y);
  c.x += (n.x > 1.5 || known < 0.5) ? 0.5 * mod(row, 2.0) : 0.0;
  highp vec2 ci = floor(c);
  vec2 cf = c - ci;
  vec2 d = min(cf, 1.0 - cf) * cell;
  float e = min(d.x, d.y);
  if (known > 0.5) e = min(e, min(min(at.x, ext.x - at.x), min(at.y, ext.y - at.y))); // (the piece's own edges)
  return vec2(max(e, 0.0), gfxHash(ci + 0.5));
}
#endif
`;

const FRAGMENT_HEAD = /* glsl */ `
{
  #if defined(GFX_DETAIL_BAKED) || defined(GFX_DETAIL_INSTANCED)
    float dLook = floor(vDetailLook + 0.5);
  #else
    float dLook = gfxDetailLook;
  #endif
  // the face in the piece's frame (before any branch: derivatives)
  highp vec3 dP = vDetailP;
  vec3 dN = normalize(cross(dFdx(dP), dFdy(dP)));
  vec3 dUp = normalize(vDetailUp);
  vec3 dS = vDetailSize.xyz;
  float dSeed = vDetailSize.w;
  vec3 dA = abs(dN);
  vec3 dV = dUp - dN * dot(dUp, dN);
  float dWall = step(0.3, length(dV)); // (a wall or a slope: 1; a top or an underside: 0)
  vec3 dE1 = vec3(1.0, 0.0, 0.0);
  vec3 dE2 = vec3(0.0, 0.0, 1.0);
  if (dA.x >= dA.y && dA.x >= dA.z) { dE1 = vec3(0.0, 0.0, 1.0); dE2 = vec3(0.0, 1.0, 0.0); }
  else if (dA.z > dA.y) { dE2 = vec3(0.0, 1.0, 0.0); }
  float dPick = step(dot(dE1, dS) * 1.05, dot(dE2, dS)); // (a top's u: its longer side)
  vec3 dTV = mix(mix(dE2, dE1, dPick), dV / max(length(dV), 1e-4), dWall);
  vec3 dTU = mix(mix(dE1, dE2, dPick), cross(dTV, dN), dWall);
  vec2 dExt = vec2(dot(abs(dTU), dS), dot(abs(dTV), dS));
  float dDeep = dot(dA, dS);
  float dKnown = step(0.02, max(max(abs(dS.x - 1.0), abs(dS.y - 1.0)), abs(dS.z - 1.0)));
  highp vec2 dUV = vec2(dot(dP, dTU), dot(dP, dTV));
  highp vec2 dAt = dUV + 0.5 * dExt * dKnown; // (from the face's corner, where the size is known)
  float dPx = gfxFootprint(dUV);
  highp vec2 dOff = vec2(dSeed * 61.7, dSeed * 23.3);
  vec3 dCol = diffuseColor.rgb;
  float dLum = dot(dCol, vec3(0.2126, 0.7152, 0.0722));
  float dK = 1.0 + (gfxNoise(dUV * 0.9 + dOff) - 0.5) * 0.1; // (a soft mottle under every look)
`;

const FRAGMENT_BUILT = /* glsl */ `
  if (dLook > 0.5 && dLook < 2.5) {
    // wood, plank: g.x along the grain, g.y across it
    float dAlongV = dWall * step(dExt.x * 1.15, dExt.y);
    highp vec2 g = mix(dUV, dUV.yx, dAlongV);
    highp vec2 gAt = mix(dAt, dAt.yx, dAlongV);
    vec2 gExt = mix(dExt, dExt.yx, dAlongV);
    float tint = 0.92 + 0.16 * dSeed;
    if (dLook > 1.5) {
      // boards across the grain, about 0.2 each, fitted to the piece; each its own tint and grain
      float n = max(1.0, floor(gExt.y / 0.2 + 0.5));
      float bw = mix(0.2, gExt.y / n, dKnown);
      float a = gAt.y / bw;
      float board = floor(a);
      float hb = gfxHash(vec2(board, dSeed * 97.0) + 3.7);
      float seam = gfxDetailLine(abs(fract(a + 0.5) - 0.5) * bw, 0.012, dPx);
      // and their ends, staggered, on a long run
      float runs = (gAt.x + hb * 1.7) / 1.7;
      float hr = gfxHash(vec2(board, floor(runs)) + 9.1);
      seam = max(seam, step(1.8, gExt.x) * gfxDetailLine(abs(fract(runs + 0.5) - 0.5) * 1.7, 0.01, dPx));
      tint *= 0.9 + 0.14 * hb + 0.06 * hr;
      g.x += hb * 7.0;
      g.y += hr * 3.0;
      dK *= 1.0 - 0.5 * seam * mix(0.5, 1.0, gfxShow(1.0 / bw, dPx * 0.5));
    }
    // long streaks, fine grain lines wandering, the odd knot
    float streak = gfxNoise(vec2(g.x * 0.7, g.y * 7.0) + dOff);
    float wv = g.y * 6.0 + gfxNoise(vec2(g.x * 1.3, g.y * 3.0) + dOff) * 2.2 + gfxNoise(vec2(g.x * 0.3, g.y) + dOff.yx) * 3.0;
    float lines = smoothstep(0.5, 0.95, abs(fract(wv) * 2.0 - 1.0)) * gfxShow(6.0, dPx);
    highp vec2 kc = (g + dOff) / vec2(0.8, 0.2);
    highp vec2 ki = floor(kc);
    vec2 kf = (kc - ki - 0.5 - (gfxHash2(ki) - 0.5) * 0.5) * vec2(0.8, 0.2);
    float kd = length(kf / vec2(0.09, 0.055));
    float knot = step(gfxHash(ki + 17.0), 0.25) * gfxShow(6.0, dPx);
    dK *= tint * (0.86 + 0.28 * streak) * (1.0 - 0.24 * lines) * (1.0 - knot * (0.45 * smoothstep(1.0, 0.35, kd) + 0.12 * smoothstep(1.9, 1.1, kd)));
    // end grain: a face across a long piece, darker, with rings
    float endg = dKnown * step(1.3 * max(dExt.x, dExt.y), dDeep);
    float rings = smoothstep(0.5, 0.95, abs(fract(length(dUV) * 14.0 + gfxNoise(dUV * 6.0 + dOff) * 1.2) * 2.0 - 1.0)) * gfxShow(14.0, dPx);
    dK *= mix(1.0, 0.8 * (1.0 - 0.18 * rings), endg);
  } else if (dLook > 2.5 && dLook < 4.5) {
    // stone, brick: blocks with mortar between
    float brick = step(3.5, dLook);
    vec2 size = brick > 0.5 ? mix(vec2(0.3, 0.15), vec2(0.3, 0.12), dWall) : mix(vec2(0.5), vec2(0.55, 0.32), dWall);
    vec2 bl = gfxDetailBlocks(dAt + dOff * (1.0 - dKnown), dExt, size, dKnown);
    float e = bl.x + (gfxNoise(dUV * 11.0 + dOff) - 0.5) * 0.016 * gfxShow(11.0, dPx);
    float mortar = gfxDetailLine(e, brick > 0.5 ? 0.011 : 0.013, dPx) * mix(0.55, 1.0, gfxShow(1.0 / size.y, dPx * 0.5));
    float hb = fract(bl.y + dSeed);
    vec3 tint = brick > 0.5
      ? mix(vec3(1.1, 0.94, 0.9), vec3(0.88, 0.95, 1.02), hb) * (0.84 + 0.26 * fract(hb * 7.31))
      : mix(vec3(1.04, 1.0, 0.94), vec3(0.95, 0.99, 1.05), fract(hb * 3.7)) * (0.86 + 0.24 * hb);
    float chips = smoothstep(0.62, 0.85, gfxNoise(dUV * 6.0 + hb * 13.0)) * gfxShow(6.0, dPx);
    dK *= (0.84 + 0.16 * smoothstep(0.0, 0.07, e)) * (1.0 + (gfxNoise(dUV * 4.0 + hb * 7.0) - 0.5) * 0.18 * gfxShow(4.0, dPx)) * (1.0 + 0.12 * chips);
    dCol *= tint;
    vec3 grout = brick > 0.5 ? vec3(0.42, 0.4, 0.36) * (0.6 + 0.6 * dLum) : dCol * 0.5;
    dCol = mix(dCol * dK, grout, mortar * 0.85);
    dK = 1.0;
  } else if (dLook > 4.5 && dLook < 5.5) {
    // cobble: rounded stones, gaps between
    highp vec2 vc = gfxVoronoi(dUV * 3.3 + dOff);
    float e = vc.x / 3.3;
    float gap = gfxDetailLine(e, 0.016, dPx) * mix(0.5, 1.0, gfxShow(3.3, dPx * 0.5));
    dK *= (0.82 + 0.26 * vc.y) * (0.82 + 0.18 * smoothstep(0.0, 0.09, e)) * (1.0 + (gfxNoise(dUV * 9.0) - 0.5) * 0.14 * gfxShow(9.0, dPx));
    dK *= 1.0 - 0.55 * gap;
  } else if (dLook > 5.5 && dLook < 6.5) {
    // thatch: straw down the slope, laid in layers, darker at the eaves
    float st = gfxNoise(vec2(dUV.x * 16.0, dUV.y * 1.3) + dOff);
    float bundle = gfxNoise(vec2(dUV.x * 4.5, dUV.y * 0.6) + dOff.yx);
    float layer = fract(dAt.y / 0.3 + (gfxNoise(vec2(dUV.x * 2.0, 3.1)) - 0.5) * 0.5);
    float eave = dKnown * dWall * (1.0 - smoothstep(0.0, 0.4, dAt.y));
    dK *= (0.84 + 0.3 * bundle) * (1.0 + (st - 0.5) * 0.32 * gfxShow(16.0, dPx));
    dK *= mix(1.06, 0.74, smoothstep(0.62, 1.0, layer) * gfxShow(3.3, dPx * 0.5)) * (1.0 - 0.22 * eave);
  } else if (dLook > 6.5 && dLook < 7.5) {
    // tile: rows up the slope, each tile rounded, each row in the shade of the one over it
    float rh = 0.2;
    float tw = 0.24;
    float r = dAt.y / rh;
    float row = floor(r);
    float f = r - row;
    float tx = dAt.x / tw + 0.5 * mod(row, 2.0);
    float ti = floor(tx);
    float tf = tx - ti;
    float ht = gfxHash(vec2(ti, row) + dSeed * 17.0);
    float show = gfxShow(1.0 / rh, dPx * 0.5);
    float gap = gfxDetailLine(min(tf, 1.0 - tf) * tw, 0.008, dPx);
    dK *= (0.86 + 0.24 * ht) * mix(1.0, mix(1.08, 0.6, smoothstep(0.55, 1.0, f)) * (0.84 + 0.2 * sin(3.14159 * tf)) * (1.0 - 0.35 * gap), show);
  } else if (dLook > 7.5 && dLook < 8.5) {
    // cloth: a weave, soft folds and fading
    float folds = gfxNoise(dUV * vec2(1.4, 0.7) + dOff);
    float weave = (gfxNoise(dUV * vec2(34.0, 3.0)) + gfxNoise(dUV * vec2(3.0, 34.0) + 5.0) - 1.0) * gfxShow(34.0, dPx);
    float speck = smoothstep(0.7, 0.9, gfxNoise(dUV * 13.0 + dOff)) * gfxShow(13.0, dPx);
    dK *= (0.84 + 0.3 * folds) * (1.0 + 0.16 * weave) * (1.0 - 0.1 * speck);
    dCol = mix(dCol, vec3(dLum) * 1.1 + 0.02, 0.12 * smoothstep(0.5, 0.8, folds)); // (faded in the sun)
  } else if (dLook > 8.5 && dLook < 9.5) {
    // metal: brushed, and rust where it is iron (dark and grey)
    float brushed = gfxNoise(vec2(dUV.x * 2.0, dUV.y * 40.0) + dOff) * gfxShow(40.0, dPx);
    float sheen = gfxNoise(dUV * vec2(1.0, 6.0) + dOff);
    dK *= (0.92 + 0.16 * sheen) * (1.0 + (brushed - 0.5) * 0.14);
    float sat = (max(dCol.r, max(dCol.g, dCol.b)) - min(dCol.r, min(dCol.g, dCol.b))) / max(max(dCol.r, max(dCol.g, dCol.b)), 1e-3);
    float rusty = (1.0 - smoothstep(0.12, 0.3, dLum)) * (1.0 - smoothstep(0.2, 0.45, sat));
    float rust = smoothstep(0.6, 0.78, gfxNoise(dUV * 4.5 + dOff) + 0.3 * (gfxNoise(dUV * 14.0 + dOff.yx) - 0.5) * gfxShow(14.0, dPx));
    dCol = mix(dCol, vec3(0.3, 0.1, 0.035), rust * rusty * 0.8);
  } else if (dLook > 9.5 && dLook < 10.5) {
    // plaster: a soft mottle, grime at a wall's foot
    float grime = dKnown * dWall * (1.0 - smoothstep(0.0, 0.45, dAt.y));
    dK *= 1.0 + (gfxNoise(dUV * 2.6 + dOff.yx) - 0.5) * 0.1 * gfxShow(2.6, dPx) + (gfxNoise(dUV * 8.0) - 0.5) * 0.06 * gfxShow(8.0, dPx);
    dK *= 1.0 - 0.1 * grime;
  } else if (dLook > 10.5 && dLook < 11.5) {
    // end grain: rings round the middle
    float rings = smoothstep(0.5, 0.95, abs(fract(length(dUV) * 14.0 + gfxNoise(dUV * 6.0 + dOff) * 1.2) * 2.0 - 1.0)) * gfxShow(14.0, dPx);
    dK *= 1.0 - 0.2 * rings;
  }`;

const FRAGMENT_NATURE = /* glsl */ `
  // for what grows: how high up the piece (metres above its middle, and in
  // its half-heights), which way the face looks (1 up, -1 down), and a place
  // that runs on over a round piece's facets (no seams on a canopy)
  float dHt = dot(dP, dUp);
  float dHRel = dHt / max(dot(abs(dUp), dS), 1e-3);
  float dFace = dot(dN, dUp);
  highp vec2 dQ = dP.xz + dP.y * vec2(0.83, -0.61);
  float dQPx = gfxFootprint(dQ);
  // one Voronoi for the looks of cells, each its own place and size: rock, soil, leaf
  highp vec2 dVc = gfxVoronoi((dLook > 14.5 ? dQ : dUV) * (dLook < 13.5 ? 2.2 : dLook < 14.5 ? 9.0 : 3.0) + dOff);
  if (dLook > 11.5 && dLook < 12.5) {
    // bark: five ridges round the piece's axis (its y), wandering, so they
    // meet all the way round; dark furrows between, the plates broken
    // across now and then, moss round the foot
    float bA = atan(dP.z, dP.x);
    float bR = length(dP.xz);
    float bWave = (gfxNoise(dP.xz * 6.0 + vec2(0.0, dP.y * 0.8) + dOff) - 0.5) * 0.9 + 0.12 * sin(bA * 2.0 + dP.y * 3.1);
    float bU = bA * 0.79577 + bWave; // (five ridges round)
    float bF = abs(fract(bU) - 0.5) * 2.0; // (0 a plate's middle, 1 a furrow)
    float bPlate = mod(floor(bU), 5.0);
    float bHp = gfxHash(vec2(bPlate, dSeed * 31.0) + 1.3);
    float bRow = dP.y * 2.4 + bHp * 5.0;
    float bBreak = smoothstep(0.86, 0.97, fract(bRow)) * step(0.45, gfxHash(vec2(bPlate, floor(bRow)) + 7.7));
    float bShow = gfxShow(5.0 / max(6.2832 * bR, 0.05), dPx);
    float bFur = smoothstep(0.5, 0.95, bF);
    float bStreak = gfxNoise(dP.xz * 14.0 + vec2(dP.y * 1.5, 0.0) + dOff.yx);
    dK *= (0.9 + 0.2 * bHp) * mix(0.88, (1.14 - 0.65 * bFur) * (1.0 - 0.4 * bBreak) * (0.86 + 0.28 * bStreak), bShow);
    float bMoss = 1.0 - smoothstep(0.05, 0.4, dHt + (gfxNoise(dP.xz * 5.0 + dP.y * 2.0 + dOff.yx) - 0.5) * 0.45 - 0.12 * bFur);
    dCol = mix(dCol, GFX_DETAIL_MOSS * (0.8 + 0.5 * bStreak), bMoss * 0.7);
  } else if (dLook > 12.5 && dLook < 13.5) {
    // rock: cracks along some of its Voronoi edges, each piece its own tint;
    // pale lichen on what faces up, moss on the shaded underside and low down
    highp vec2 rc = dVc;
    float re = rc.x / 2.2;
    float rSome = smoothstep(0.35, 0.6, gfxNoise(dUV * 1.1 + dOff.yx + 4.0));
    float rCrack = gfxDetailLine(re, 0.025, dPx) * rSome * mix(0.5, 1.0, gfxShow(2.2, dPx * 0.5));
    float rGrain = (gfxNoise(dUV * 5.0 + dOff) - 0.5) * gfxShow(5.0, dPx) + (gfxNoise(dUV * 13.0 + dOff.yx) - 0.5) * 0.5 * gfxShow(13.0, dPx);
    dK *= (0.82 + 0.3 * rc.y) * (1.0 + 0.3 * rGrain) * (1.0 - 0.7 * rCrack) * (1.0 - 0.2 * rSome * (1.0 - smoothstep(0.0, 0.08, re)));
    float rLich = smoothstep(0.56, 0.72, gfxNoise(dUV * 3.3 + dOff * 1.7) + 0.15 * (gfxNoise(dUV * 9.0) - 0.5) * gfxShow(9.0, dPx)) * smoothstep(0.0, 0.5, dFace) * gfxShow(3.3, dPx * 0.5);
    float rLow = 1.0 - smoothstep(-0.5, 0.25, dHRel + (gfxNoise(dUV * 2.4 + dOff.yx) - 0.5) * 0.7);
    float rMoss = smoothstep(0.3, 0.6, max(rLow, 0.75 * smoothstep(0.45, -0.3, dFace)) * (0.55 + 0.9 * gfxNoise(dUV * 2.9 + dOff + 9.0)));
    dCol = mix(dCol, vec3(0.55, 0.52, 0.26) * (0.5 + 1.5 * dLum), rLich * 0.7);
    dCol = mix(dCol, GFX_DETAIL_MOSS * (0.85 + 0.4 * gfxNoise(dUV * 7.0)), rMoss * 0.8);
  } else if (dLook > 13.5 && dLook < 14.5) {
    // soil: clods with dark gaps, a damp darker speckle, pale grit
    highp vec2 sc = dVc;
    float sShow = gfxShow(9.0, dPx * 0.5);
    float sGap = gfxDetailLine(sc.x / 9.0, 0.006, dPx) * sShow;
    float sDamp = smoothstep(0.58, 0.8, gfxNoise(dUV * 5.0 + dOff.yx)) * 0.6 + smoothstep(0.65, 0.85, gfxNoise(dUV * 17.0 + dOff)) * 0.4 * gfxShow(17.0, dPx);
    float sGrit = smoothstep(0.84, 0.94, gfxNoise(dUV * 26.0 + dOff.yx)) * gfxShow(26.0, dPx);
    dK *= mix(0.97, (0.88 + 0.24 * sc.y) * (0.88 + 0.16 * smoothstep(0.0, 0.25, sc.x)), sShow) * (1.0 - 0.35 * sGap) * (1.0 - 0.32 * sDamp) * (1.0 + 0.5 * sGrit);
  } else if (dLook > 14.5 && dLook < 15.5) {
    // leaf: leafy clumps (Voronoi cells) with dark between, a soft mottle,
    // lighter and warmer dapples on top
    highp vec2 lc = dVc;
    float lShow = gfxShow(3.0, dQPx * 0.5);
    float lTop = smoothstep(-0.3, 0.9, dHRel);
    float lClump = (0.88 + 0.2 * lc.y) * mix(0.8, 1.05, smoothstep(0.0, 0.42, lc.x));
    float lFine = (gfxNoise(dQ * 9.0 + dOff) - 0.5) * gfxShow(9.0, dQPx);
    dK *= mix(0.92, lClump, lShow) * (0.9 + 0.2 * gfxNoise(dQ * 1.3 + dOff.yx)) * (1.0 + 0.16 * lFine);
    float lDapple = smoothstep(0.55, 0.8, gfxNoise(dQ * 4.2 + dOff * 1.3)) * lTop * gfxShow(4.2, dQPx * 0.5);
    dCol *= mix(vec3(1.0), vec3(1.18, 1.22, 0.86), lDapple * 0.8 + lTop * 0.25);
  } else if (dLook > 15.5 && dLook < 16.5) {
    // crop: a leaf's pale midrib and side veins, lighter to the tip; a
    // fruit's blush low down and a fine speckle
    float cGreen = clamp((dCol.g - max(dCol.r, dCol.b)) / max(dCol.g, 1e-3) * 4.0, 0.0, 1.0);
    float cTip = smoothstep(-0.8, 0.9, dHRel);
    float cT = (dUV.x - 1.2 * abs(dUV.y)) * 14.0;
    float cSide = gfxDetailLine(abs(fract(cT + 0.5) - 0.5) / 18.0, 0.003, dPx) * gfxShow(14.0, dPx);
    float cVein = max(gfxDetailLine(abs(dUV.y), 0.005, dPx), 0.7 * cSide) * cGreen;
    float cSpeck = smoothstep(0.72, 0.9, gfxNoise(dUV * 34.0 + dOff.yx)) * gfxShow(34.0, dPx) * (1.0 - cGreen);
    dK *= (0.9 + 0.2 * dSeed) * mix(0.86, 1.1, cTip) * (1.0 + (gfxNoise(dUV * 12.0 + dOff) - 0.5) * 0.22 * gfxShow(12.0, dPx)) * (1.0 - 0.18 * cSpeck);
    dCol = mix(dCol, dCol * vec3(1.25, 1.3, 0.8) + 0.015, cVein * 0.55);
    dCol *= mix(vec3(1.0), vec3(1.06, 0.9, 0.86), (1.0 - cGreen) * (1.0 - cTip) * 0.6);
  } else if (dLook > 16.5) {
    // reed, fern: streaks along the blade, darker low down, paler to the
    // tip; a reed's nodes and its tip dried warmer; a frond's dark midrib
    // and the leaflets slanting off it
    float fern = step(17.5, dLook);
    float rTip = smoothstep(-0.2, 1.0, dHRel);
    float rStreak = gfxNoise(vec2(dUV.x * 30.0, dUV.y * 1.5) + dOff) - 0.5;
    float rNode = gfxDetailLine(abs(fract(dUV.y * 2.2 + dSeed) - 0.5) / 2.2, 0.008, dPx) * (1.0 - fern);
    dK *= (0.92 + 0.16 * dSeed) * mix(0.8, 1.12, rTip) * (1.0 + 0.26 * rStreak * gfxShow(30.0, dPx)) * (1.0 - 0.3 * rNode);
    dCol = mix(dCol, vec3(dLum) * vec3(1.6, 1.35, 0.8) + 0.02, (1.0 - fern) * smoothstep(0.55, 1.0, rTip) * 0.4);
    float fT = (dUV.y - 0.9 * abs(dUV.x)) * 16.0;
    float fGap = gfxDetailLine(abs(fract(fT + 0.5) - 0.5) / 16.0, 0.004, dPx) * gfxShow(16.0, dPx);
    float fRib = gfxDetailLine(abs(dUV.x), 0.004, dPx);
    dK *= 1.0 - fern * (0.35 * fGap + 0.3 * fRib);
  }`;

const FRAGMENT_LIVING = /* glsl */ `
  // for what lives and what it holds: two places that run on over a round
  // body (dQ, and dR across it, where dQ stretches), how high up the piece,
  // which way the face looks, how saturated the color; no seed (it moves)
  dK = 1.0;
  float dHRel = dot(dP, dUp) / max(dot(abs(dUp), dS), 1e-3);
  highp vec2 dQ = dP.xz + dP.y * vec2(0.83, -0.61);
  highp vec2 dR = dP.zy + dP.x * vec2(0.71, 0.53);
  float dQPx = gfxFootprint(dQ);
  // and one flat on the face (the plane its normal is nearest): cells and
  // strokes there, which a seam between faces doesn't spoil
  highp vec2 dW = dA.x > max(dA.y, dA.z) ? dP.zy + 3.1 : (dA.y > dA.z ? dP.xz + 7.3 : dP.xy);
  float dSat = (max(dCol.r, max(dCol.g, dCol.b)) - min(dCol.r, min(dCol.g, dCol.b))) / max(max(dCol.r, max(dCol.g, dCol.b)), 1e-3);
  float dBelly = smoothstep(0.15, -0.85, dHRel);
  // one Voronoi for leather's grain and wool's curls
  highp vec2 dVc = vec2(1.0, 0.5);
  if (abs(dLook - 23.0) < 0.5 || abs(dLook - 25.0) < 0.5) dVc = gfxVoronoi(dW * (dLook < 24.0 ? 22.0 : 11.0));
  if (dLook < 19.5) {
    // skin: a soft warm and cool mottle, a fine speckle
    float sM = gfxNoise(dQ * 7.0) + gfxNoise(dR * 7.0 + 3.1) - 1.0;
    dCol *= vec3(1.0) + vec3(0.06, -0.015, -0.04) * sM;
    dK = 1.0 + 0.07 * sM + 0.1 * (gfxNoise(dW * 24.0) - 0.5) * gfxShow(24.0, dQPx);
  } else if (dLook < 20.5) {
    // hair: strands from the crown down, clumps, a sheen ring round the top
    vec2 hDir = dP.xz / max(length(dP.xz), 1e-3);
    float hClump = gfxNoise(hDir * 3.0 + vec2(dP.y * 1.2, 0.0));
    float hStrand = gfxNoise(hDir * 7.0 + vec2(dP.y * 2.5, 7.0)) - 0.5;
    dK = (0.82 + 0.3 * hClump) * (1.0 + 0.45 * hStrand * gfxShow(28.0, dQPx)) * (1.0 + 0.14 * smoothstep(0.5, 0.68, dN.y) * smoothstep(0.93, 0.76, dN.y));
  } else if (dLook < 21.5) {
    // garment: soft folds; stitched seams down the sides; worn paler at the knees and elbows
    float gFold = gfxNoise(dQ * 4.0) + gfxNoise(dR * 4.0 + 5.0) - 1.0;
    float gHeather = (gfxNoise(dW * vec2(5.0, 18.0)) - 0.5) * gfxShow(18.0, dQPx);
    float gSeam = step(0.05, abs(dP.x));
    float gGroove = gfxDetailLine(abs(dP.z), 0.005, dQPx) * gSeam;
    float gStitch = gfxDetailLine(abs(abs(dP.z) - 0.014), 0.004, dQPx) * step(0.45, fract((dP.x + dP.y) * 45.0)) * gSeam;
    float gWorn = smoothstep(0.075, 0.025, abs(dP.y + 0.25)) * smoothstep(0.3, 0.6, abs(dN.z)) * smoothstep(0.35, 0.75, gfxNoise(dW * 9.0) + 0.3 * gFold);
    dK = (1.0 + 0.16 * gFold) * (1.0 + 0.22 * gHeather) * (1.0 - 0.45 * gGroove);
    dCol = mix(dCol, vec3(dLum) * 1.2 + 0.05, gWorn * 0.4);
    dCol = mix(dCol, dCol * 1.4 + 0.05, gStitch * 0.7);
  } else if (dLook < 22.5) {
    // straw: a braid round and round from the brim's edge up over the crown
    float sB = (dP.y - length(dP.xz)) * 24.0;
    float sBand = floor(sB);
    float sGap = gfxDetailLine((0.5 - abs(fract(sB) - 0.5)) / 24.0, 0.003, dQPx);
    float sFibre = gfxNoise(dP.xz * 30.0 + sBand * 3.7) - 0.5;
    dK = (0.88 + 0.2 * gfxHash(vec2(sBand, 3.0))) * (1.0 - 0.45 * sGap) * (1.0 + 0.24 * sFibre * gfxShow(30.0, dQPx));
    dCol = mix(dCol, vec3(dLum) * vec3(1.25, 1.15, 0.85) + 0.03, 0.18 * smoothstep(0.3, 0.9, dN.y)); // (bleached on top)
  } else if (dLook < 23.5) {
    // leather: a pebbled grain, creases, pale scuffs
    float lShow = gfxShow(22.0, dQPx * 0.5);
    float lScuff = smoothstep(0.6, 0.8, gfxNoise(dQ * 7.0 + 2.0) + 0.2 * (gfxNoise(dW * 20.0) - 0.5));
    dK = mix(1.0, (0.92 + 0.14 * dVc.y) * (0.9 + 0.1 * smoothstep(0.0, 0.2, dVc.x)), lShow) * (1.0 + 0.1 * (gfxNoise(dR * 5.0) - 0.5));
    dCol = mix(dCol, dCol * 1.45 + 0.04, lScuff * 0.45);
  } else if (dLook < 24.5) {
    // fur: a short-fur speckle and soft tufts, darker underneath
    float fS = (gfxNoise(dW * vec2(24.0, 8.0)) - 0.5) * gfxShow(24.0, dQPx); // (short strokes)
    float fT = gfxNoise(dQ * 6.0) + gfxNoise(dR * 6.0 + 4.0) - 1.0;
    dK = (1.0 + 0.26 * fT) * (1.0 + 0.5 * fS) * (1.0 - 0.34 * dBelly) * (1.0 + 0.1 * smoothstep(0.2, 1.0, dHRel));
    dCol *= vec3(1.0) - vec3(0.0, 0.025, 0.06) * (dBelly + max(-fT, 0.0)); // (warmer in the shade of the fur)
  } else if (dLook < 25.5) {
    // wool: round curls, darker underneath
    float wShow = gfxShow(12.0, dQPx * 0.5);
    float wFine = gfxNoise(dW * 26.0) - 0.5;
    dK = mix(0.92, (0.66 + 0.42 * smoothstep(0.0, 0.4, dVc.x)) * (0.9 + 0.16 * dVc.y), wShow) * (1.0 + 0.16 * wFine * gfxShow(26.0, dQPx)) * (1.0 - 0.32 * dBelly);
    dCol *= vec3(1.0) - vec3(0.0, 0.02, 0.05) * dBelly;
  } else if (dLook < 26.5) {
    // horn: fine growth ridges across, lighter toward the tip
    float hR = gfxNoise(vec2(dQ.x * 4.0, dP.y * 30.0)) - 0.5;
    dK = (1.0 + 0.2 * hR * gfxShow(30.0, dQPx)) * mix(0.88, 1.1, smoothstep(-0.7, 0.8, dHRel));
  } else {
    // tool: by its color, wood grain along its y, brushed metal, or a dull sheen on paint
    float tMetal = 1.0 - smoothstep(0.08, 0.16, dSat);
    #ifdef STANDARD
      tMetal = max(tMetal, step(0.3, metalness));
    #endif
    float tWood = (1.0 - tMetal) * step(0.2, dSat) * step(dCol.b, dCol.g) * step(dCol.g, dCol.r);
    highp float tAcross = (dP.x - dP.z) * 26.0;
    float tStreak = (gfxNoise(vec2(tAcross, dP.y * 2.0)) - 0.5) * gfxShow(26.0, dQPx);
    float tLine = smoothstep(0.55, 0.95, abs(fract(tAcross * 0.6 + gfxNoise(vec2(tAcross * 0.15, dP.y * 3.0)) * 1.5) * 2.0 - 1.0)) * gfxShow(16.0, dQPx);
    dK = (1.0 + (gfxNoise(dQ * 4.0) - 0.5) * 0.16) * (1.0 + tStreak * (tMetal * mix(0.22, 0.06, smoothstep(0.15, 0.4, dSat)) + tWood * 0.3)) * (1.0 - 0.22 * tLine * tWood);
  }`;

const FRAGMENT_TAIL = /* glsl */ `
  if (dLook > 0.5) diffuseColor.rgb = dCol * dK;
}`;

// (built things' looks and nature's in programs of their own, so each
// program carries only its family's code: smaller shaders, quicker to compile)
const FRAGMENT = {
  built: FRAGMENT_HEAD + FRAGMENT_BUILT + FRAGMENT_TAIL,
  nature: FRAGMENT_HEAD + FRAGMENT_NATURE + FRAGMENT_TAIL,
  living: FRAGMENT_HEAD + FRAGMENT_LIVING + FRAGMENT_TAIL,
};
const NATURE = new Set(['bark', 'rock', 'soil', 'leaf', 'crop', 'reed', 'fern']);
const LIVING = new Set(['skin', 'hair', 'garment', 'straw', 'leather', 'fur', 'wool', 'horn', 'tool']);
export const familyOf = (look) => (NATURE.has(look) ? 'nature' : LIVING.has(look) ? 'living' : 'built');

function compile(from, family = 'built') {
  return (shader, renderer, material) => {
    define(shader, 'GFX_DETAIL');
    if (from === 'baked') define(shader, 'GFX_DETAIL_BAKED');
    else if (from === 'instanced') define(shader, 'GFX_DETAIL_INSTANCED');
    else shader.uniforms.gfxDetailLook = uniformOf(material);
    shader.vertexShader = patch(shader.vertexShader, 'common', VERTEX_COMMON, 'GFX_DETAIL');
    shader.vertexShader = patch(shader.vertexShader, 'project_vertex', VERTEX, 'GFX_DETAIL');
    shader.fragmentShader = patch(shader.fragmentShader, 'common', FRAGMENT_COMMON, 'GFX_DETAIL');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', FRAGMENT[family], 'GFX_DETAIL');
  };
}
const own = compile('uniform');
const ownNature = compile('uniform', 'nature');
const ownLiving = compile('uniform', 'living');
const baked = compile('baked');
const instanced = compile('instanced');

const uniforms = new WeakMap(); // material -> { value: look's index }
function uniformOf(material) {
  let u = uniforms.get(material);
  if (!u) uniforms.set(material, (u = { value: 0 }));
  u.value = lookIndex(material.userData?.gfx?.detail);
  return u;
}

// Give a material its look (see above); 'none' leaves it as it is
export function detail(material, look, name) {
  if (!material || Array.isArray(material)) return material;
  if (!(material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial)) return material;
  const chosen = look ?? defaultLook(material, name ?? material.name);
  material.userData.gfx = { ...material.userData.gfx, detail: chosen };
  if (chosen === 'none' || !LOOKS.includes(chosen)) return material;
  uniformOf(material);
  const family = familyOf(chosen);
  if (family === 'nature') return hook(material, 'detail:nature', ownNature);
  return family === 'living' ? hook(material, 'detail:living', ownLiving) : hook(material, 'detail', own);
}

// What lives and what it holds, by a material's name in a table (a mount's,
// a boss's: { coat, mane, saddle, ... }): first match wins; the rest stay plain
const LIVING_BY_NAME = [
  [/^(eye|blush|smile|dark|wing|glow|seed|white|stripe|petal|leaf)/i, 'none'],
  [/mane|hair/i, 'hair'],
  [/coat|fuzz|plume|fur|feather|hide/i, 'fur'],
  [/wool|fleece/i, 'wool'],
  [/saddle|strap|belt|leather/i, 'leather'],
  [/cape|scarf|cloth|band/i, 'garment'],
  [/beak|horn|hoof|claw/i, 'horn'],
  [/gold|metal|brass|blade|iron/i, 'tool'],
  [/skin|belly|throat/i, 'skin'],
];
export function detailLiving(table) {
  for (const [name, m] of Object.entries(table)) {
    const hit = LIVING_BY_NAME.find(([re]) => re.test(name));
    if (hit && hit[1] !== 'none') for (const one of [m].flat()) detail(one, hit[1]);
  }
  return table;
}

// Every material in a table ({ name: material or [materials] }), each its look by its name
export function detailAll(table, looks = {}) {
  for (const [name, m] of Object.entries(table)) for (const one of [m].flat()) detail(one, looks[name], name);
  return table;
}

// A baked mesh's material: the looks are in its vertices (bakeDetail)
export const detailBaked = (material) => hook(material, 'detail:baked', baked);

// An instanced mesh's material whose instances each have a look: its
// geometry's gfxLook, an InstancedBufferAttribute of look indices (lookIndex)
export const detailInstanced = (material) => hook(material, 'detail:instanced', instanced);

// The attributes a baked part's geometry (already moved by `matrix`, `count`
// vertices, from `source`: its own geometry before baking) carries: its look
// (from `material`), where each vertex is in the part's frame, the part's
// size and seed, and the way up in its frame
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3();
const _v = new THREE.Vector3();
export function bakeDetail(geo, source, material, matrix) {
  const look = lookIndex(material.userData?.gfx?.detail ?? defaultLook(material));
  matrix.decompose(_p, _q, _s);
  _up.set(0, 1, 0).applyQuaternion(_q.invert());
  const seed = (Math.abs(Math.sin(_p.x * 12.9898 + _p.y * 78.233 + _p.z * 37.719) * 43758.5453) % 1);
  const pos = (source.index ? source.toNonIndexed() : source).attributes.position;
  const n = geo.attributes.position.count;
  const piece = new Float32Array(n * 4);
  const size = new Float32Array(n * 4);
  const up = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).multiply(_s);
    piece.set([_v.x, _v.y, _v.z, look], i * 4);
    size.set([Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z), seed], i * 4);
    up.set([_up.x, _up.y, _up.z], i * 3);
  }
  geo.setAttribute('gfxPiece', new THREE.BufferAttribute(piece, 4));
  geo.setAttribute('gfxSize', new THREE.BufferAttribute(size, 4));
  geo.setAttribute('gfxUp', new THREE.BufferAttribute(up, 3));
  return geo;
}
