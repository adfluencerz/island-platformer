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
// The look is a uniform (gfxDetailLook), so every material with it shares one
// program whatever its look; a home's baked mesh (homekit.js bake) carries it
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
// FRAGMENT, and a name pattern in BY_NAME if materials should get it on
// their own.

export const LOOKS = ['none', 'wood', 'plank', 'stone', 'brick', 'cobble', 'thatch', 'tile', 'cloth', 'metal', 'plaster', 'endgrain'];

// a material's look from its name (first match wins)
const BY_NAME = [
  [/end ?grain/i, 'endgrain'],
  [/thatch|straw|hay|reed/i, 'thatch'],
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
// names that stay plain (living things, water, food, light...)
const PLAIN = /leaf|hedge|moss|lichen|rock|grass|stalk|fruit|flower|snow|smoke|petal|soil|earth|water|grout|glass|window|lantern|flame|fire|portal|glow|hole|crow|bird|bee\b|dove|beak|cheese|mayo|honey|ash|book|mirror/i;

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

const FRAGMENT = /* glsl */ `
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
  } else if (dLook > 10.5) {
    // end grain: rings round the middle
    float rings = smoothstep(0.5, 0.95, abs(fract(length(dUV) * 14.0 + gfxNoise(dUV * 6.0 + dOff) * 1.2) * 2.0 - 1.0)) * gfxShow(14.0, dPx);
    dK *= 1.0 - 0.2 * rings;
  }
  if (dLook > 0.5) diffuseColor.rgb = dCol * dK;
}`;

function compile(from) {
  return (shader, renderer, material) => {
    define(shader, 'GFX_DETAIL');
    if (from === 'baked') define(shader, 'GFX_DETAIL_BAKED');
    else if (from === 'instanced') define(shader, 'GFX_DETAIL_INSTANCED');
    else shader.uniforms.gfxDetailLook = uniformOf(material);
    shader.vertexShader = patch(shader.vertexShader, 'common', VERTEX_COMMON, 'GFX_DETAIL');
    shader.vertexShader = patch(shader.vertexShader, 'project_vertex', VERTEX, 'GFX_DETAIL');
    shader.fragmentShader = patch(shader.fragmentShader, 'common', FRAGMENT_COMMON, 'GFX_DETAIL');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', FRAGMENT, 'GFX_DETAIL');
  };
}
const own = compile('uniform');
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
  return hook(material, 'detail', own);
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
