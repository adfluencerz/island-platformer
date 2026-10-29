import * as THREE from 'three';
import { damp } from './character.js';
import { mulberry32 } from '../shared/worldgen.js';
import { giantScale } from '../shared/giants.js';
import { hook } from './gfx/shading.js';
import { patch, define } from './gfx/chunks.js';
import { use, U } from './gfx/uniforms.js';
import { groundDetail } from './gfx/ground.js';
import { detail } from './gfx/detail.js';
import { waterLook } from './gfx/water.js';
import { NOISE } from './gfx/noise.js';
import { knobs, onApply } from './gfx/quality.js';

// (the islands' geometry helpers live with the islands, for the server too)
export { mulberry32, distToSegment, distToPaths } from '../shared/worldgen.js';

// ---------- Worlds ----------
// An island built from a map definition (maps.js): the ground as a grid of
// 1x1 tiles (the same grid the hoe tills on), the earth under them, platforms,
// grass and flowers, trees, bushes and rocks, plus anything special the map
// builds itself. The trees and rocks are where the server says (wilds:
// shared/wilds.js), the same for everyone; the rest is placed with a seeded
// RNG so a map looks the same on every load, and steers clear of them.
//
// buildWorld() returns everything the game needs from a world: its root group
// (added to the scene while you are there), its colliders, its tiles, its
// trees (which can be felled and grow back), its rocks (which can be broken up
// and surface again), and the per-frame bits (tree fading and falling, the
// map's own animation).

export const TILE_SIZE = 1;

export function tileKeyFor(x, z) {
  return `${Math.round(x / TILE_SIZE)},${Math.round(z / TILE_SIZE)}`;
}

// Cheap smooth "noise" for meadow patches (lush grass, flower fields)
const meadowNoise = (x, z) =>
  Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin((x + z) * 0.11 + 1.3) * 0.4;

// The grass's wind, done in the vertex shader so thousands of instances cost
// nothing on the CPU (hook 'grass'): gusts, as a value noise that travels
// across the field the way the clouds drift (uCloudOffset: the breeze plus a
// storm's uWind, five times as fast), so a wave of bending runs over the
// meadow; a fine flutter on top; and every blade leaning away from the feet
// of a farmer or an animal walking through it (uPlayers). On the tiers with
// the grass carpet the tufts are not drawn (makeCarpet), and the flowers
// stand taller, over its blades. The bend grows with height
// squared (height: the tallest point of the mesh, its tip), and a bent blade
// dips a little so it doesn't stretch. The flowers sway in the same wind.
// Drawn from both sides, the back of a blade keeps its normal up (lit as the
// ground is). (noSnow: the flowers keep their color in the snow; the farm's
// grass is given its own, src/seasons.js)
const MAX_FEET = 8; // (uPlayers, the feet of the farmers and the animals nearest: src/gfx/uniforms.js)
export const GRASS_WIND_GLSL = /* glsl */ `
  highp float gfxGrassHash(highp vec2 p) {
    highp vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float gfxGrassNoise(highp vec2 p) {
    highp vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gfxGrassHash(i), gfxGrassHash(i + vec2(1.0, 0.0)), u.x),
               mix(gfxGrassHash(i + vec2(0.0, 1.0)), gfxGrassHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }`;
// (spread: the tufts, which the tier may draw wider, uGrassSpread: fewer of
// them still cover the ground; not the flowers)
// Further from the camera, fewer: to half by uGrassFar.x, to none by .y
// (src/main.js viewFrom). A tuft goes, shrinking away, at its own distance:
// the tufts by aRank, their place in their patch's shuffled order, so the
// patch can stop drawing the ones past where the nearest of it keeps them
// (viewFrom, below); the flowers by a hash of where they stand.
const GRASS_KEEP_GLSL = /* glsl */ `
  float gfxGrassKeep(float d) {
    return 1.0 - 0.5 * smoothstep(uGrassFar.x - 3.0, uGrassFar.x + 3.0, d) - 0.5 * smoothstep(uGrassFar.y - 6.0, uGrassFar.y, d);
  }`;
const grassKeep = (d, [near, end]) => 1 - 0.5 * smooth(near - 3, near + 3, d) - 0.5 * smooth(end - 6, end, d); // (the same)
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
function addGrassWind(material, height, spread = false) {
  material.userData.noSnow = true;
  hook(material, `grass:${height.toFixed(3)}${spread ? ':spread' : ''}`, (shader) => {
    define(shader, 'GFX_GRASS');
    use(shader, ['uTime', 'uWind', 'uCloudOffset', 'uPlayers', 'uMist', 'uGrassFar', ...(spread ? ['uGrassSpread', 'uGrassDensity'] : ['uCarpet'])], 'v');
    shader.vertexShader = patch(shader.vertexShader, 'common', GRASS_WIND_GLSL + GRASS_KEEP_GLSL + (spread ? 'attribute float aRank;' : ''), 'GFX_GRASS');
    shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', `
      #ifdef USE_INSTANCING
        highp vec3 grassRoot = (modelMatrix * instanceMatrix[3]).xyz;
        // (further off, fewer: GRASS_KEEP_GLSL)
        float grassR = ${spread ? 'aRank / uGrassDensity' : 'gfxGrassHash(grassRoot.xz * 3.1 + 0.7)'};
        transformed *= smoothstep(grassR, grassR + 0.05, gfxGrassKeep(distance(grassRoot, cameraPosition)));
        ${spread ? 'transformed.xz *= uGrassSpread;' : 'transformed.y += 0.2 * step(0.001, uCarpet) * clamp(transformed.y / 0.245, 0.0, 1.0); // (a flower over the carpet\'s blades, where there is one: its stem longer)'}
        float grassH = clamp(transformed.y / ${height.toFixed(3)}, 0.0, 1.2); // (0 at the root, 1 at the tip; after the snow's sink)
        vec2 grassDrift = uWind + vec2(0.6, 0.25); // (as the clouds drift: src/gfx/uniforms.js frame)
        vec2 grassDir = normalize(grassDrift);
        float grassStorm = clamp(length(uWind) / 6.0, 0.0, 1.0);
        highp vec2 grassP = (grassRoot.xz - uCloudOffset * 5.0) * 0.07;
        float grassGust = 0.65 * gfxGrassNoise(grassP) + 0.35 * gfxGrassNoise(grassP * 2.3 + 3.7);
        grassGust = smoothstep(0.3, 0.8, grassGust);
        float grassFine = sin(uTime * 2.2 + dot(grassRoot.xz, vec2(0.9, 0.7)) + (position.x - position.z) * 4.0);
        vec2 grassBend = grassDir * (0.08 + 0.42 * grassGust + 0.3 * grassStorm) + vec2(grassFine, -0.6 * grassFine) * (0.06 + 0.05 * grassGust);
        for (int i = 0; i < ${MAX_FEET}; i++) {
          vec4 feet = uPlayers[i];
          vec2 away = grassRoot.xz - feet.xz;
          float d = length(away);
          float near = step(0.001, feet.w) * (1.0 - smoothstep(0.2, 0.9, d / max(feet.w, 0.01))) * (1.0 - smoothstep(0.3, 0.9, abs(feet.y - grassRoot.y)));
          grassBend += away / max(d, 0.05) * near * 1.1;
        }
        float grassLen = length(grassBend);
        grassBend *= min(1.0, 1.1 / max(grassLen, 1e-3));
        vec3 grassOff = vec3(grassBend.x, 0.0, grassBend.y) * grassH * grassH * ${height.toFixed(3)};
        // (into the instance's own space: its columns are a turn about y and a scale)
        vec3 grassC0 = instanceMatrix[0].xyz;
        vec3 grassC2 = instanceMatrix[2].xyz;
        grassOff *= length(instanceMatrix[1].xyz); // (as tall as this one is)
        transformed.x += dot(grassOff, grassC0) / max(dot(grassC0, grassC0), 1e-8);
        transformed.z += dot(grassOff, grassC2) / max(dot(grassC2, grassC2), 1e-8);
        transformed.y *= 1.0 - 0.45 * dot(grassBend, grassBend) * grassH;
        #if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
          vColor.rgb *= 1.0 + 0.22 * grassGust * grassH; // (a gust's wave shows as a sheen running over the field)
          // (dew on the tips in the morning's mist: a cool, bright lift at the top of the blade)
          float grassDew = uMist * grassH * grassH * (0.7 + 0.3 * gfxGrassHash(grassRoot.xz * 7.3));
          vColor.rgb = vColor.rgb * (1.0 + 0.6 * grassDew) + vec3(0.02, 0.04, 0.05) * grassDew;
        #endif
      #endif`, 'GFX_GRASS');
    shader.fragmentShader = patch(shader.fragmentShader, 'normal_fragment_begin', `
      #ifdef DOUBLE_SIDED
        normal *= faceDirection; // (back as it was: up)
        nonPerturbedNormal = normal;
      #endif`, 'GFX_GRASS');
  });
}
// ---------- Trees' looks: a dithered fade, a soft shade, a sway ----------
// Hook 'tree' on a tree's materials (shared by every tree: they are drawn
// instanced, makeInstancer below). aFade, per instance: how far it is faded
// out, 0 solid to 1 gone, by throwing away that share of its pixels in a fixed
// screen pattern (no transparency: nothing to sort or recompile). Only an
// InstancedMesh reads it (it must have the attribute: makeInstancer gives it);
// the same material on a plain mesh (a bush, a stump) is never faded.
// Each part is lit brighter on top and darker underneath: a trunk by its own
// height; the leaves (uTreeLeaf, the material's own) painted per vertex, a
// crown bright and warm on the sun's side (uSunDir, lifted toward up), cool
// in its shade, a soft rim toward the sky, a few lobes, a pine's tiers lit
// at their tops and edges, a slow mottle of needle clumps (GFX_PINE:
// hookTree's pine; every tree is smooth-shaded, src/gfx/smooth.js),
// and sways with the grass's gusts (sampled
// where the instance stands, GRASS_WIND_GLSL) when the tier's treeSway is on:
// the higher up, the further it leans. (One hook for trunks and leaves alike,
// so they share one shader.)
const treeLooks = new Map(); // material -> a pine's? (re-hooked when the tier changes)
let treeSway = null; // (the tier's, once asked)
function hookTree(material, pine = false) {
  treeSway ??= knobs().treeSway;
  const sway = treeSway;
  treeLooks.set(material, pine);
  const leaf = { value: material === trunkMat ? 0 : 1 };
  return hook(material, `tree:${sway ? 'sway' : ''}${pine ? 'pine' : ''}`, (shader) => {
    define(shader, 'GFX_TREE');
    define(shader, 'GFX_SHADOW_LIFT');
    if (pine) define(shader, 'GFX_PINE');
    if (sway) define(shader, 'GFX_SWAY');
    if (sway) use(shader, ['uTime', 'uWind', 'uCloudOffset'], 'v');
    use(shader, ['uSunDir', 'uNight'], 'v');
    shader.uniforms.uTreeLeaf = leaf; // (its own: leaves and bark share the program)
    shader.vertexShader = patch(shader.vertexShader, 'common', `
      #ifdef USE_INSTANCING
        attribute float aFade;
      #endif
      varying float vTreeFade;
      varying vec4 vCanopyShade;
      uniform float uTreeLeaf;
      #ifdef GFX_SWAY
        ${GRASS_WIND_GLSL}
      #endif`, 'GFX_TREE');
    shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', `
      vTreeFade = 0.0;
      #ifdef USE_INSTANCING
        vTreeFade = aFade;
      #endif
      // (the crown's light, per vertex: where it faces in the world, how
      // much it faces the sun lifted toward up, a rim toward the sky by the
      // view, and a seed by where the piece stands, for its own lobes)
      #ifdef USE_INSTANCING
        mat4 crownM = modelMatrix * instanceMatrix;
      #else
        mat4 crownM = modelMatrix;
      #endif
      vec3 crownN = normalize(mat3(crownM) * objectNormal);
      vec3 crownAt = (crownM * vec4(transformed, 1.0)).xyz;
      float crownLit = dot(crownN, normalize(uSunDir + vec3(0.0, 0.8, 0.0)));
      float crownRim = pow(1.0 - clamp(dot(crownN, normalize(cameraPosition - crownAt)), 0.0, 1.0), 2.0)
        * smoothstep(-0.1, 0.7, crownN.y) * (1.0 - 0.8 * uNight);
      vec3 crownH = fract(floor(crownM[3].xyz * 2.0 + 0.5) * vec3(0.1031, 0.1030, 0.0973));
      crownH += dot(crownH, crownH.yzx + 33.33);
      float crownSeed = fract((crownH.x + crownH.y) * crownH.z);
      #ifdef GFX_PINE
        // (a pine's tier, pineGeo: light at the tip and on its sun side,
        // its skirt's edge lighter and warm, catching the sun, the hollow
        // under the skirt dark and cool, a slow mottle by where it is, as
        // clumps of needles; and the sun gets through to its rim and top a
        // little, though the tier above shades it: light.js, GFX_SHADOW_LIFT)
        float canopyTop = smoothstep(-0.5, 0.7, position.y);
        float canopyRim = smoothstep(0.62, 0.95, length(position.xz));
        // (the inner skirt, just outside the rim of the tier above: a darker
        // collar under each rim, so the tiers read layered from above)
        float tierCollar = smoothstep(0.4, 0.55, length(position.xz)) * (1.0 - smoothstep(0.62, 0.82, length(position.xz)));
        float tierUnder = smoothstep(0.05, -0.3, objectNormal.y); // (the face's own normal)
        float tierLit = smoothstep(-0.4, 0.8, crownLit);
        float tierFacet = 0.5 + 0.5 * sin(position.x * 2.6 + crownSeed * 6.28) * sin(position.z * 2.3 - position.y * 1.7 + crownSeed * 9.0); // (a slow mottle, no facet its own shade)
        float tierK = (mix(1.15, 1.95, canopyTop) * mix(0.8, 1.32, tierLit) + 1.15 * canopyRim)
          * (0.9 + 0.16 * tierFacet) * mix(1.0, 0.5, tierUnder) * (1.0 - 0.28 * tierCollar);
        vCanopyShade.rgb = tierK
          * mix(vec3(0.86, 0.95, 1.04), vec3(1.18, 1.1, 0.7), max(0.6 * canopyTop, tierLit)) // (a pine's blue-green warmed a little, even in shade)
          * mix(vec3(1.0), vec3(1.16, 1.1, 0.74), canopyRim * (1.0 - tierUnder))
          + crownRim * vec3(0.3, 0.42, 0.4);
        vCanopyShade.a = (0.3 + 0.5 * max(canopyRim, canopyTop * canopyTop)) * (1.0 - tierUnder);
      #else
        if (uTreeLeaf > 0.5) {
          // (a round canopy's blob, a bush: a bright, warm crown on the sun's
          // side, a touch yellow-green, cooler blue-green in its shade, the
          // underside dark and warm; a few lobes lighter and darker, from its
          // corners pushed out or in (canopyGeo) and a slow pattern of its
          // own; a soft rim toward the sky)
          float crownTop = smoothstep(-0.55, 0.85, crownLit);
          float crownUnder = smoothstep(0.0, -0.75, crownN.y);
          float crownBump = smoothstep(0.9, 1.08, length(position));
          float crownLobe = sin(position.x * 2.7 + crownSeed * 6.28) * sin(position.z * 2.4 - position.y * 1.6 + crownSeed * 11.0);
          float crownK = mix(0.62, 1.45, crownTop) * (0.84 + 0.26 * crownBump + 0.16 * crownLobe);
          crownK = mix(crownK, 0.95, 0.5 * uNight);
          vec3 crownCol = mix(vec3(0.82, 0.93, 1.12), vec3(1.16, 1.1, 0.7), crownTop * crownTop);
          crownCol = mix(crownCol, vec3(1.0, 0.9, 0.74), 0.6 * crownUnder);
          vCanopyShade = vec4(crownK * crownCol + crownRim * vec3(0.28, 0.38, 0.36), 0.0);
        } else {
          // (a trunk: warm on top, cool underneath)
          float canopyTop = smoothstep(-0.9, 0.5, position.y);
          vCanopyShade = vec4(mix(0.72, 1.15, canopyTop) * mix(vec3(0.9, 0.95, 1.08), vec3(1.04, 1.02, 0.94), canopyTop), 0.0);
        }
      #endif
      #if defined(GFX_SWAY) && defined(USE_INSTANCING)
        highp vec3 swayRoot = (modelMatrix * instanceMatrix[3]).xyz;
        float swayH = clamp((instanceMatrix * vec4(transformed, 1.0)).y, 0.0, 5.0); // (how high above the ground)
        vec2 swayDir = normalize(uWind + vec2(0.6, 0.25)); // (as the clouds drift, and the grass bends)
        float swayStorm = clamp(length(uWind) / 6.0, 0.0, 1.0);
        highp vec2 swayP = (swayRoot.xz - uCloudOffset * 5.0) * 0.07;
        float swayGust = smoothstep(0.3, 0.8, 0.65 * gfxGrassNoise(swayP) + 0.35 * gfxGrassNoise(swayP * 2.3 + 3.7));
        float swayFine = sin(uTime * 1.6 + dot(swayRoot.xz, vec2(0.9, 0.7)));
        vec2 swayBend = swayDir * (0.05 + 0.4 * swayGust + 0.5 * swayStorm) + vec2(swayFine, -0.6 * swayFine) * (0.04 + 0.04 * swayGust);
        vec3 swayOff = vec3(swayBend.x, 0.0, swayBend.y) * swayH * swayH * 0.025;
        // (into the instance's own space: its columns are turns and scales)
        vec3 swayC0 = instanceMatrix[0].xyz;
        vec3 swayC1 = instanceMatrix[1].xyz;
        vec3 swayC2 = instanceMatrix[2].xyz;
        transformed += vec3(dot(swayOff, swayC0) / max(dot(swayC0, swayC0), 1e-8),
                            dot(swayOff, swayC1) / max(dot(swayC1, swayC1), 1e-8),
                            dot(swayOff, swayC2) / max(dot(swayC2, swayC2), 1e-8));
      #endif`, 'GFX_TREE');
    shader.fragmentShader = patch(shader.fragmentShader, 'common', `
      varying float vTreeFade;
      varying vec4 vCanopyShade;`, 'GFX_TREE');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
      if (vTreeFade > 0.001) {
        // (interleaved gradient noise: an even scatter of the pixels to drop)
        highp float treeDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (treeDither < vTreeFade) discard;
      }
      diffuseColor.rgb *= vCanopyShade.rgb;
      float gfxShadowLift = vCanopyShade.a;`, 'GFX_TREE');
  });
}
onApply((k) => {
  if (treeSway === null || k.treeSway === treeSway) return;
  treeSway = k.treeSway;
  for (const [material, pine] of treeLooks) hookTree(material, pine);
});

// ---------- Instanced decor ----------
// Many things made of a few (geometry, material) pairs, each pair drawn as
// one InstancedMesh, so a forest is a handful of draws. A thing is still a
// Group of plain meshes (its own children, placed as it is drawn), or a
// single mesh, for its transform and for a raycast to hit, but the thing
// itself is never drawn (visible false): its meshes are slots in the
// instanced meshes, written from its matrix when it moves. Things in
// different squares of the ground (chunk tiles across, where they were
// adopted) go in different instanced meshes, so what is out of view (the
// camera's, or the sun's for shadows) isn't drawn; an instanced mesh with
// every slot hidden isn't drawn at all.
//   const decor = makeInstancer(parent, chunk)  (parent: where the things are, too)
//   parts = decor.adopt(thing, color)    its meshes' slots (color: times the material's)
//   decor.build()                        once all are adopted: the instanced meshes (each slot where it was then)
//   decor.show(thing, parts, shown)      where the thing puts them now (shown false: hidden)
//   decor.fade(parts, f)                 how far faded out, 0 to 1 (aFade: the 'tree' hook)
// (A mesh with several materials, by its geometry's groups, is fine too.)
const _im = new THREE.Matrix4();
const WHITE = new THREE.Color(1, 1, 1);
export function makeInstancer(parent, chunk = GROUND_CHUNK) {
  const sets = new Map(); // `${materials' uuids}|${geometry.uuid}|${square}` -> { material, geometry, slots, mesh, shown }
  const write = (part, thing, shown) => {
    const { set, index, obj } = part;
    if (!set.mesh) return;
    if (shown) set.mesh.setMatrixAt(index, obj === thing ? obj.matrix : _im.multiplyMatrices(thing.matrix, obj.matrix));
    else set.mesh.setMatrixAt(index, _im.makeScale(0, 0, 0).setPosition(thing.position)); // (where it stands: its square's bounds stay snug)
    set.mesh.instanceMatrix.needsUpdate = true;
    set.mesh.boundingSphere = null; // (worked out again when next culled)
    if (part.shown !== shown) {
      set.shown += shown ? 1 : -1;
      part.shown = shown;
      set.mesh.visible = set.shown > 0;
    }
  };
  return {
    adopt(thing, color = WHITE) {
      thing.visible = false;
      thing.updateMatrix();
      const parts = [];
      const square = `${Math.floor(thing.position.x / chunk)},${Math.floor(thing.position.z / chunk)}`;
      for (const obj of thing.isMesh ? [thing] : thing.children) {
        if (!obj.isMesh) continue;
        obj.updateMatrix();
        const key = `${[obj.material].flat().map((m) => m.uuid).join(',')}|${obj.geometry.uuid}|${square}`;
        if (!sets.has(key)) sets.set(key, { material: obj.material, geometry: obj.geometry, slots: [], mesh: null, shown: 0, shadow: obj.castShadow, square });
        const set = sets.get(key);
        const part = { obj, thing, set, index: set.slots.length, color: obj.userData.tint ?? color, shown: true };
        set.slots.push(part);
        parts.push(part);
      }
      return parts;
    },
    build() {
      for (const set of sets.values()) {
        const n = set.slots.length;
        const geo = set.geometry.clone(); // (its own, for its own aFade)
        geo.setAttribute('aFade', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
        if (set.geometry === canopyGeo || set.geometry === pineGeo) {
          const [sx, sz] = set.square.split(',').map(Number);
          geo.userData.box = [sx * chunk, sz * chunk, (sx + 1) * chunk, (sz + 1) * chunk]; // (its square, seen from above: viewFrom)
          canopies.add(geo);
          canopyRange(geo, knobs());
        }
        const mesh = new THREE.InstancedMesh(geo, set.material, n);
        mesh.castShadow = set.shadow;
        mesh.receiveShadow = true;
        set.mesh = mesh;
        set.shown = n;
        set.slots.forEach((part, i) => {
          mesh.setColorAt(i, part.color);
          write(part, part.thing, true); // (where it was adopted)
        });
        parent.add(mesh);
      }
    },
    show(thing, parts, shown = true) {
      thing.updateMatrix();
      for (const part of parts) write(part, thing, shown);
    },
    fade(parts, f) {
      for (const { set, index } of parts) {
        const attr = set.mesh?.geometry.attributes.aFade;
        if (!attr) continue;
        attr.array[index] = f;
        attr.needsUpdate = true;
      }
    },
    meshes: () => [...sets.values()].map((set) => set.mesh).filter(Boolean),
  };
}

// How far x, z is from a box [x0, z0, x1, z1] seen from above (0 inside it)
function boxDistance([x0, z0, x1, z1], x, z) {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dz = Math.max(z0 - z, 0, z - z1);
  return Math.sqrt(dx * dx + dz * dz);
}

// A repeatable 0..1 value for a point: the same point always gets the same
// value, so vertices that two meshes share agree on it
export const hash2 = (x, z) => {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

// Ripples for still or open water, in the fragment shader: the surface normal
// rocks to and fro (so the sun glints off it) and the color drifts a little.
// Under the fine ripples, broad slow swells a few metres long, crossing
// (warped a little, so they don't march in rows): they tilt the normal
// enough that the sky's gradient in the mirror shifts over them, and shade
// the color, crests lighter and troughs darker. Their height (-1..1) is
// rippleWave, for the water's look (src/gfx/water.js).
export function addRipples(material) {
  material.userData.noSnow = true;
  return hook(material, 'ripples', (shader) => {
    define(shader, 'GFX_WORLD');
    define(shader, 'GFX_RIPPLES');
    use(shader, ['uTime'], 'f');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
      float rippleA = vGfxWorld.x * 1.3 + uTime * 1.1;
      float rippleB = vGfxWorld.z * 1.7 - uTime * 0.9;
      float rippleC = (vGfxWorld.x - vGfxWorld.z) * 2.6 + uTime * 1.7;
      vec2 swellP = vGfxWorld.xz + 0.7 * sin(vGfxWorld.zx * vec2(0.37, 0.29) + uTime * vec2(0.11, 0.08));
      float swell1 = dot(swellP, vec2(0.91, 0.68)) - uTime * 0.42;
      float swell2 = dot(swellP, vec2(-0.78, 1.47)) - uTime * 0.55;
      float swell3 = dot(swellP, vec2(2.2, -0.75)) - uTime * 0.8;
      float rippleWave = (sin(swell1) + 0.75 * sin(swell2) + 0.45 * sin(swell3)) * 0.45;
      vec2 swellSlope = (vec2(0.91, 0.68) * cos(swell1) + 0.75 * vec2(-0.78, 1.47) * cos(swell2) + 0.45 * vec2(2.2, -0.75) * cos(swell3)) * 0.45;
      diffuseColor.rgb *= (0.95 + 0.07 * sin(rippleA * 0.4 + rippleB * 0.3)) * (1.0 + 0.16 * rippleWave);`, 'GFX_RIPPLES');
    shader.fragmentShader = patch(shader.fragmentShader, 'normal_fragment_begin', `
      vec3 rippleNormal = normalize(vec3(cos(rippleA) * 0.07 + cos(rippleC) * 0.04 - swellSlope.x * 0.16, 1.0, cos(rippleB) * 0.07 - cos(rippleC) * 0.04 - swellSlope.y * 0.16));
      normal = normalize((viewMatrix * vec4(rippleNormal, 0.0)).xyz);`, 'GFX_RIPPLES');
  });
}

// The sea around every island (main.js puts it there), lighter in the
// shallows along the shore, and the foam where it meets the shore
export const SEA_LEVEL = -0.6;
const SHALLOWS_WIDTH = 4.5; // (the turquoise band the inner half, a fainter shelf the outer: src/gfx/water.js)
const SHALLOWS_COLOR = new THREE.Color(0x2fe2b6);
const shallowsMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
waterLook(addRipples(shallowsMat), 'shallows'); // (rocking with the sea, mirroring the sky as it does: src/gfx/water.js)
const FOAM_WIDTH = 1.1; // (its solid line wider than the cliffs reach out over it: The cliffs)
const FOAM_COLOR = new THREE.Color(0xffffff);
const foamMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false });
foamMat.userData.noSnow = true;
// vertex alpha: 1 at the shore, 0 at the foam's outer edge. A line hugs the
// shore, reaching out and drawing back with the swash (as the wet sand's
// lace does: src/gfx/ground.js), and bands of foam wash in and out beyond
// it; both broken into lace by a drifting noise, faded to its average where
// a pixel covers too much of it.
hook(foamMat, 'foam', (shader) => {
  define(shader, 'GFX_WORLD');
  define(shader, 'GFX_FOAM');
  use(shader, ['uTime'], 'f');
  shader.fragmentShader = patch(shader.fragmentShader, 'common', NOISE, 'GFX_FOAM');
  shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
    float shore = vColor.a;
    highp vec2 foamP = vGfxWorld.xz;
    float foamShow = gfxShow(3.6, gfxFootprint(foamP));
    float drift = sin(vGfxWorld.x * 0.8 + vGfxWorld.z * 0.6) * 1.5;
    float swash = sin(uTime * 0.85 + dot(foamP, vec2(0.23, 0.31)));
    float wave = sin(shore * 11.0 + uTime * 1.6 + drift);
    float lace = mix(0.6, smoothstep(0.28, 0.6, gfxNoise(foamP * 3.6 + vec2(uTime * 0.11, -uTime * 0.07))), foamShow);
    float line = smoothstep(0.5 - 0.12 * swash, 0.82 - 0.08 * swash, shore + (gfxNoise(foamP * 1.7 + 5.0) - 0.5) * 0.25);
    diffuseColor.a = max(line * mix(0.55, 1.0, lace), smoothstep(0.45, 0.9, wave) * shore * 0.8 * lace);`, 'GFX_FOAM');
});

// ---------- The decor kit: a few shared geometries/materials, many meshes ----------
export const foliageMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
const trunkMat = foliageMat(0x6b4423);
export const leafMats = [0x3f8a3a, 0x4f9e3c, 0x2f7a45, 0x5aa83f].map(foliageMat);
export const pineMats = [0x2c6b3f, 0x24603a, 0x34784a].map(foliageMat);
export const rockMats = [0x8d8d88, 0x7a7a76, 0x9e9a90].map((c) => detail(foliageMat(c), 'rock')); // (cracks, lichen, moss low down: src/gfx/detail.js)

const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6, 1, true).translate(0, 0.5, 0); // (no ends: in the canopy, and in the ground)
export const blobGeo = new THREE.IcosahedronGeometry(1, 0);
// A round tree's canopy blob: an icosahedron, once subdivided (80
// triangles), its corners pushed in or out a little (by where they are, so
// the faces stay joined) and its normals a ball's, so it lights softly round.
// After it, the same blob not subdivided (20), for the tiers whose
// treeDetail is 0: which one is drawn is the geometry's draw range
// (canopyRange, as the tier changes).
const CANOPY_HI = 240; // (vertices: not indexed)
export const canopyGeo = (() => {
  const pos = [];
  const normal = [];
  const q = (v) => Math.round(v * 1000);
  for (const detail of [1, 0]) {
    const p = new THREE.IcosahedronGeometry(1, detail).attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + (mulberry32((q(x) * 73856093) ^ (q(y) * 19349663) ^ (q(z) * 83492791))() - 0.5) * 0.24;
      pos.push(x * k, y * k, z * k);
      normal.push(x, y, z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  return geo;
})();
// A pine's tier, in place of a plain cone (its tip where the cone's was, as wide, 1):
// round from the tip down a steep top to a shoulder, out over a flatter, drooping
// skirt to the rim, and back in under it, hollow, to the trunk. Its rim
// serrated (tips out and down, notches in and up) where the tier's
// treeDetail is on: ten sides, 60 triangles; else seven, plain, 28 (by draw
// range, as the round canopy). Smooth-shaded round, its rim a crease
// (src/gfx/smooth.js); the tree hook lights the rim and
// shades the underside by where a vertex is (hookTree).
// (each profile: [radius, y] from the tip down, and a rim's [radius, y] for notches)
const pineTier = (n, profile, notch) => {
  const rings = profile.map(([r, y], k) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const [rr, yy] = notch && k === notch.ring && i % 2 ? notch.at : [r, y];
    return [Math.cos(a) * rr, yy, Math.sin(a) * rr];
  }));
  const pos = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const P = rings[k];
    const Q = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (profile[k][0] > 0) pos.push(...P[i], ...P[j], ...Q[j]);
      if (profile[k + 1][0] > 0) pos.push(...P[i], ...Q[j], ...Q[i]);
    }
  }
  return pos;
};
const PINE_HI = pineTier(10, [[0, 0.7], [0.45, -0.05], [1, -0.5], [0.3, -0.3], [0, -0.24]], { ring: 2, at: [0.8, -0.36] }).length / 3;
export const pineGeo = (() => {
  const pos = [
    ...pineTier(10, [[0, 0.7], [0.45, -0.05], [1, -0.5], [0.3, -0.3], [0, -0.24]], { ring: 2, at: [0.8, -0.36] }),
    ...pineTier(7, [[0, 0.7], [0.45, -0.05], [1, -0.46], [0, -0.3]]),
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals(); // (not indexed: each face's own, smoothed where it is set on a mesh: src/gfx/smooth.js)
  geo.userData.hi = PINE_HI;
  return geo;
})();
canopyGeo.userData.hi = CANOPY_HI;
// (a square of them far from the view, userData.far: the plain one whatever the tier: viewFrom)
const canopyRange = (geo, k) => (k.treeDetail && !geo.userData.far ? geo.setDrawRange(0, geo.userData.hi) : geo.setDrawRange(geo.userData.hi, Infinity));
const canopies = new Set(); // (each world's copies of it: makeInstancer)
onApply((k) => canopies.forEach((geo) => canopyRange(geo, k)));
export const rockGeo = new THREE.DodecahedronGeometry(1, 0);
rockGeo.userData.crease = THREE.MathUtils.degToRad(75); // (its faces meet at 63 degrees: smoothed round, src/gfx/smooth.js)

export function addDecor(geo, material, x, y, z, sx, sy = sx, sz = sx, parent) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.decor = true; // (still: put straight in a world's root, it is drawn instanced)
  parent.add(mesh);
  return mesh;
}

// Turf on top of a platform. It overhangs a little and its top sits just
// above the collider top so it doesn't z-fight.
const CAP_COLORS = { grass: 0x5d9b3a, moss: 0x4f8a3a };
const roughMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
const turfMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

// A box with rough sides, for rock and earth: subdivided, the vertices on its
// sides pushed in or out a little (by their position alone, so faces that
// share an edge move it together and the box stays closed), and colored
// darker toward the bottom, in layers, with a mottle.
// push: how far the sides wander; dark: how much darker the bottom is.
function roughBox(x, y, z, w, h, d, color, { push = 0.07, dark = 0.3, layers = 0.05 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, Math.ceil(w * 2), Math.max(1, Math.round(h * 2.5)), Math.ceil(d * 2));
  const p = geo.attributes.position;
  const base = new THREE.Color(color);
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i), ly = p.getY(i), lz = p.getZ(i);
    const n = hash2(x + lx * 1.7 + ly * 0.9, z + lz * 1.3 - ly * 1.1) - 0.5;
    const onX = Math.abs(Math.abs(lx) - w / 2) < 1e-4;
    const onZ = Math.abs(Math.abs(lz) - d / 2) < 1e-4;
    if (onX) p.setX(i, lx + Math.sign(lx) * n * push * 2);
    if (onZ) p.setZ(i, lz + Math.sign(lz) * n * push * 2);
    const up = (ly + h / 2) / h; // 0 at the bottom, 1 at the top
    const k = 1 - dark * (1 - up) + Math.sin((y + ly) * 7) * layers + n * 0.12;
    tint.copy(base).multiplyScalar(k);
    colors.push(tint.r, tint.g, tint.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// The earth under the island's tiles: lighter just under the turf, darker down by the sea
const earthMat = new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.9, vertexColors: true });
const earthGeo = new THREE.BoxGeometry(1, 1, 1);
earthGeo.setAttribute('color', new THREE.Float32BufferAttribute(
  Array.from({ length: earthGeo.attributes.position.count }, (_, i) => {
    const k = 0.7 + 0.3 * (earthGeo.attributes.position.getY(i) + 0.5);
    return [k, k, k];
  }).flat(), 3));

// The cliffs round the island's shore, and down from a higher floor to a
// lower one (the lake's bank): see The cliffs, in buildWorld. Flat shaded,
// colored by its vertices: a grassy lip, earth, and wet rock by the water.
const cliffMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
const CLIFF_EARTH = new THREE.Color(0x8a6646);
const CLIFF_ROCK = new THREE.Color(0x4f4b47);

// The decor's instancers are in squares this many tiles across (makeInstancer),
// and the ground's surface and its cliffs in smaller ones (the whole island is
// most of a view's triangles: the squares out of view are not drawn)
const GROUND_CHUNK = 47;
// (the rocks and the still decor in bigger ones: small things, many kinds of
// them, few a square: a view from low down sees most of the island's
// squares, and each kind in each square is a draw)
const DECOR_CHUNK = 71;
const SURFACE_CHUNK = 24;
// The ground's surface sits this far above its floor (tilled soil is above it)
const GROUND_LIFT = 0.012;
const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
const slabGeo = new THREE.BoxGeometry(0.86, 0.06, 0.86);
const slabMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
// (painted detail on all of them: src/gfx/ground.js; a map's own ground and
// turf get it in buildWorld)
groundDetail(groundMat, 'tiles');
groundDetail(turfMat, 'turf');
groundDetail(slabMat, 'slab');
groundDetail(earthMat, 'earth');
groundDetail(roughMat, 'rough');
groundDetail(cliffMat, 'cliff');
// which of the ground's detail a kind of ground takes (its gfxKind, see
// src/gfx/ground.js): 0 green, 1 stone, 2 path, 3 sand; -1 just the noise
const detailOf = (type, style) =>
  type === 'stone' ? 1 : type === 'sand' || type === 'dune' ? 3 : style.lush ? 0 : type === 'path' ? 2 : -1;

// A felled tree topples away from whoever chopped it, then shrinks away and
// leaves a stump (low enough to step onto) until it grows back.
const TREE_FALL = 1; // seconds to topple
const TREE_GONE = 0.4; // then to shrink away
const TREE_GROW = 1.2; // growing back
const STUMP_H = 0.28;
const stumpGeo = new THREE.CylinderGeometry(0.16, 0.2, STUMP_H, 7).translate(0, STUMP_H / 2, 0);
const stumpMats = [trunkMat, detail(foliageMat(0xd9b48a), 'endgrain'), trunkMat]; // side, cut top (its rings), bottom
const ROCK_BREAK = 0.3; // seconds to crumble away
const ROCK_GROW = 0.9; // a new one surfacing
const CHIPS = 5; // bits that fly off a breaking rock
const CHIP_LIFE = 0.7;
const _q = new THREE.Quaternion();
const easeOutBack = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;
const _rb = new THREE.Vector3();

// A tree's or rock's collider, w wide and deep, round where it stands
function fitBox(box, x, z, w) {
  box.min.x = x - w / 2;
  box.max.x = x + w / 2;
  box.min.z = z - w / 2;
  box.max.z = z + w / 2;
  box.center.x = x;
  box.center.z = z;
}

// Fade trees whose canopy sits on the line of sight from the camera to the
// player. Canopies are treated as upright cylinders round the trunk:
// CANOPY_RADIUS wide and spanning CANOPY_BOTTOM..CANOPY_TOP above its foot
// (all times tree scale). The sight line is the real one, eye to camera, from
// whichever way and at whatever angle the camera looks (wide or classic).
const CANOPY_RADIUS = 1.3;
const CANOPY_BOTTOM = 0.8;
const CANOPY_TOP = 3.4;

function blocksView(tree, eye, camera) {
  const { x: tx, y: ty, z: tz } = tree.group.position;
  const k = tree.scale * tree.big;
  const r = CANOPY_RADIUS * k + 0.4; // a little margin around the player
  const cam = camera.position;
  // the part of the line (s: 0 at the eye, 1 at the camera) at the canopy's height
  const lo = ty + CANOPY_BOTTOM * k;
  const hi = ty + CANOPY_TOP * k;
  const dy = cam.y - eye.y;
  let s0 = 0;
  let s1 = 1;
  if (Math.abs(dy) < 1e-6) {
    if (eye.y < lo || eye.y > hi) return false;
  } else {
    const a = (lo - eye.y) / dy;
    const b = (hi - eye.y) / dy;
    s0 = Math.max(0, Math.min(a, b));
    s1 = Math.min(1, Math.max(a, b));
    if (s0 >= s1) return false;
  }
  // ...and the nearest it comes to the trunk there, seen from above
  const dx = cam.x - eye.x;
  const dz = cam.z - eye.z;
  const len2 = dx * dx + dz * dz;
  const s = THREE.MathUtils.clamp(len2 > 1e-9 ? ((tx - eye.x) * dx + (tz - eye.z) * dz) / len2 : s0, s0, s1);
  const px = eye.x + dx * s - tx;
  const pz = eye.z + dz * s - tz;
  return px * px + pz * pz < r * r;
}

// Grass tufts: up to seven blades, of which the tier draws its grassBlades
// (src/gfx/quality.js: 3, 5 or 7; the first three spread round the tuft, the
// rest fill in between, so fewer still look whole). Each blade is a tapering
// strip of two segments, three triangles, splaying out and curving a little,
// drawn from both sides (the grass hook keeps the back's normal up, so both
// light as the ground they stand in does). Dark at the root, bright at the
// tip. Every world's tufts are the same shape, from a fixed stream of their own.
const TUFT_BLADES = 7;
const TUFT_HEIGHT = 0.6; // (the tallest a blade is, before its instance's scale)
const BLADE_INDICES = 9;
const MORE_GRASS = 1.5; // (the extra tufts, as a share of a tile's own: see Grass and flowers)
const GRASS_PATCH = 24; // (the grass is drawn in patches this many tiles a side, out of view ones not at all)
function makeTuftGeometry() {
  const r = mulberry32(0x7af7);
  const rand = (min, max) => min + r() * (max - min);
  const pos = [];
  const col = [];
  const index = [];
  for (let b = 0; b < TUFT_BLADES; b++) {
    const around = b * 2.39996 + rand(-0.25, 0.25); // (the golden angle: each next blade in the widest gap)
    const out = 0.04 + 0.19 * Math.sqrt((b + 0.5) / TUFT_BLADES);
    const [rx, rz] = [Math.cos(around), Math.sin(around)];
    const face = around + Math.PI / 2 + rand(-0.5, 0.5); // (the blade's width runs across its splay, roughly)
    const width = rand(0.04, 0.06);
    const [wx, wz] = [Math.cos(face) * width, Math.sin(face) * width];
    const h = b < 3 ? rand(0.48, TUFT_HEIGHT) : rand(0.35, 0.55);
    const lean = rand(0.05, 0.16);
    const ox = rx * out;
    const oz = rz * out;
    const first = pos.length / 3;
    pos.push(ox - wx, 0, oz - wz, ox + wx, 0, oz + wz);
    const mx = ox + rx * lean * 0.3;
    const mz = oz + rz * lean * 0.3;
    pos.push(mx - wx * 0.7, h * 0.5, mz - wz * 0.7, mx + wx * 0.7, h * 0.5, mz + wz * 0.7);
    pos.push(ox + rx * lean, h, oz + rz * lean);
    const warm = rand(1, 1.08); // (some tips a touch yellower)
    col.push(0.5, 0.55, 0.42, 0.5, 0.55, 0.42, 0.88, 0.9, 0.68, 0.88, 0.9, 0.68, 1.2 * warm, 1.15, 0.75);
    index.push(first, first + 1, first + 3, first, first + 3, first + 2, first + 2, first + 3, first + 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  return geo;
}

// The grass of every world built, drawn as the tier says: its share of the
// tufts (they are in a shuffled order, so fewer thin out evenly) and of each
// tuft's blades. Again whenever the tier is changed.
const grassMeshes = new Set();
function grassTier(mesh, k = knobs()) {
  // (none where the tier has the carpet instead: makeCarpet)
  mesh.count = mesh.userData.drawn = k.carpet > 0 ? 0 : Math.round(mesh.userData.tufts * k.grassDensity); // (and fewer far from the view: viewFrom)
  mesh.geometry.setDrawRange(0, Math.min(k.grassBlades, TUFT_BLADES) * BLADE_INDICES);
}
onApply((k) => {
  U.uGrassDensity.value = k.grassDensity;
  U.uCarpet.value = k.carpet;
  grassMeshes.forEach((mesh) => grassTier(mesh, k));
  carpets.forEach((carpet) => carpet.tier(k));
});

// ---------- The grass carpet ----------
// On the tiers that have one (src/gfx/quality.js carpet), the grass round the
// camera is a carpet of blades instead of the tufts: each tile of grass in
// view is one instance of a cell of CARPET_BLADES blades (one layout for all
// of them, turned one of eight ways by where it is, so no grid shows), put
// in by the CPU when the view moves (makeCarpet's view: only the tiles the
// camera sees, no further than the grass reaches), in three meshes by how
// many of its blades a tile still needs at its distance (CARPET_LODS).
// A blade's root takes the ground's own color there (its tile's corners, as
// the ground's vertices have it, the canopies' shade too), its tip lighter
// and warmer; a few dark ones, a few pale. They thin with the distance as the
// tufts did (by rank: the first ones are spread evenly over the tile and stay
// longest), shorter and fewer into the edge of a path or tilled soil, and
// none where something stands (each third of a tile asked once, isOpenGround).
// The wind (hook 'carpet'): big slow waves rolling across the field, the
// gusts' noise as the tufts have it, a fine shimmer, and every farmer and
// animal pushing them aside. No rng of the island's: nothing else moves.
const CARPET_BLADES = 96;
const CARPET_LODS = [1, 0.5, 0.25]; // (the share of its blades each mesh draws a tile with)
const CARPET_CAP = 2400; // (tiles a mesh holds at most)
const CARPET_REACH = 1.15; // (its rings, as a share of the view's grass's: uGrassFar)
const CARPET_FAR = [26, 40]; // (and at their widest, whatever the view's grass: uCarpetFar)
const CARPET_HEIGHT = 0.62; // (a tile's tallest blades, before its kind's own height: the farm's grass)
const carpets = new Set();
let carpetBase = null;
function carpetGeometry() {
  if (carpetBase) return carpetBase;
  const r = mulberry32(0xca7e);
  const rand = (min, max) => min + r() * (max - min);
  const pos = [];
  const col = [];
  const blade = [];
  const index = [];
  const edge = (v) => Math.min(0.49, Math.max(-0.49, v));
  for (let b = 0; b < CARPET_BLADES; b++) {
    // (an R2 sequence: any first share of them is spread evenly over the tile)
    const x = edge(((0.5 + b * 0.7548776662) % 1) - 0.5 + rand(-0.03, 0.03));
    const z = edge(((0.5 + b * 0.5698402910) % 1) - 0.5 + rand(-0.03, 0.03));
    const face = rand(0, Math.PI);
    const w = rand(0.024, 0.036); // (half its width at the root)
    const [wx, wz] = [Math.cos(face) * w, Math.sin(face) * w];
    const h = rand(0.55, 1);
    const lean = rand(0.06, 0.28) * h;
    const turn = rand(0, Math.PI * 2);
    const [lx, lz] = [Math.cos(turn) * lean, Math.sin(turn) * lean];
    const pick = r();
    const shade = pick < 0.1 ? 0.7 : pick > 0.9 ? 1.2 : rand(0.93, 1.07); // (a few dark, a few pale)
    const first = pos.length / 3;
    pos.push(x - wx, 0, z - wz, x + wx, 0, z + wz);
    pos.push(x + lx * 0.3 - wx * 0.62, h * 0.5, z + lz * 0.3 - wz * 0.62, x + lx * 0.3 + wx * 0.62, h * 0.5, z + lz * 0.3 + wz * 0.62);
    pos.push(x + lx, h, z + lz);
    for (const [k, [cr, cg, cb]] of [[0, [0.8, 0.8, 0.8]], [0, [0.8, 0.8, 0.8]], [0.5, [1, 1, 0.96]], [0.5, [1, 1, 0.96]], [1, [1.3, 1.24, 0.98]]]) {
      col.push(cr * shade, cg * shade, cb * shade);
      blade.push(x, z, b / CARPET_BLADES, k);
    }
    index.push(first, first + 1, first + 3, first, first + 3, first + 2, first + 2, first + 3, first + 4);
  }
  carpetBase = {
    position: new THREE.Float32BufferAttribute(pos, 3),
    normal: new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3),
    color: new THREE.Float32BufferAttribute(col, 3),
    aBlade: new THREE.Float32BufferAttribute(blade, 4),
    index: new THREE.Uint16BufferAttribute(index, 1),
  };
  return carpetBase;
}
// Per tile (instanced): aCell (its tile x, z; its blades' height, m; how
// thick it grows, 0..1), aBits (which ninths of it are open, bits 0-8, x
// then z; its sides that face no carpet, bits 9-12: -x, +x, -z, +z), aC0..3
// (the ground's color at its corners: -x-z, +x-z, -x+z, +x+z)
const CARPET_ATTRS = { aCell: 4, aBits: 1, aC0: 3, aC1: 3, aC2: 3, aC3: 3 };
const CARPET_GLSL = /* glsl */ `
  attribute vec4 aBlade;
  attribute vec4 aCell;
  attribute float aBits;
  attribute vec3 aC0;
  attribute vec3 aC1;
  attribute vec3 aC2;
  attribute vec3 aC3;
  float gfxCarpetKeep(float d) {
    return 1.0 - 0.5 * smoothstep(uCarpetFar.x - 3.0, uCarpetFar.x + 3.0, d) - 0.5 * smoothstep(uCarpetFar.y - 6.0, uCarpetFar.y, d);
  }`;
function addCarpet(material) {
  material.userData.noSnow = true; // (the farm's own snow: src/seasons.js)
  hook(material, 'carpet', (shader) => {
    define(shader, 'GFX_CARPET');
    use(shader, ['uTime', 'uWind', 'uCloudOffset', 'uPlayers', 'uMist', 'uCarpet', 'uCarpetFar', 'uGrassSpread'], 'v');
    shader.vertexShader = patch(shader.vertexShader, 'common', GRASS_WIND_GLSL + CARPET_GLSL, 'GFX_CARPET');
    shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', `
      // (the tile's turn of the one layout: mirrored, then a quarter turn or more)
      highp vec2 cId = aCell.xy;
      float cTurn = floor(gfxGrassHash(cId * 0.731 + 4.1) * 8.0);
      vec2 cR = aBlade.xy;
      vec2 cP = transformed.xz;
      if (cTurn >= 4.0) { cR.x = -cR.x; cP.x = -cP.x; }
      if (mod(cTurn, 4.0) >= 2.0) { cR = -cR; cP = -cP; }
      if (mod(cTurn, 2.0) >= 1.0) { cR = vec2(-cR.y, cR.x); cP = vec2(-cP.y, cP.x); }
      // (open where it stands? shorter and fewer toward a side with no carpet)
      int cBits = int(aBits + 0.5);
      ivec2 cSub = clamp(ivec2(floor((cR + 0.5) * 3.0)), 0, 2);
      float cOpen = float((cBits >> (cSub.x + 3 * cSub.y)) & 1);
      float cEdge = 1.0;
      if ((cBits & 512) != 0) cEdge = min(cEdge, cR.x + 0.5);
      if ((cBits & 1024) != 0) cEdge = min(cEdge, 0.5 - cR.x);
      if ((cBits & 2048) != 0) cEdge = min(cEdge, cR.y + 0.5);
      if ((cBits & 4096) != 0) cEdge = min(cEdge, 0.5 - cR.y);
      cEdge = smoothstep(0.0, 0.5, cEdge);
      highp vec3 grassRoot = (modelMatrix * vec4(cId.x + cR.x, 0.02, cId.y + cR.y, 1.0)).xyz;
      // (fewer further off: the blades past this tile's share at its distance shrink away)
      float cKeep = gfxCarpetKeep(distance(grassRoot, cameraPosition)) * aCell.w * uCarpet * mix(0.3, 1.0, cEdge) * cOpen;
      float cShow = smoothstep(aBlade.z, aBlade.z + 0.04, cKeep);
      float cTall = aCell.z * (0.8 + 0.4 * gfxGrassHash(cId * 1.37 + aBlade.z * 91.0)) * mix(0.45, 1.0, cEdge) * cShow;
      vec2 cAt = cR + (cP - cR) * uGrassSpread * cShow;
      transformed = vec3(cId.x + cAt.x, 0.02 + transformed.y * cTall, cId.y + cAt.y);
      float grassH = aBlade.w; // (0 at the root, 1 at the tip)
      vec2 grassDir = normalize(uWind + vec2(0.6, 0.25)); // (as the clouds drift)
      float grassStorm = clamp(length(uWind) / 6.0, 0.0, 1.0);
      highp vec2 grassP = (grassRoot.xz - uCloudOffset * 5.0) * 0.07;
      float grassGust = smoothstep(0.3, 0.8, 0.65 * gfxGrassNoise(grassP) + 0.35 * gfxGrassNoise(grassP * 2.3 + 3.7));
      // the big slow waves rolling downwind over the field (about 19 m apart), wavering
      float cWave = 0.5 + 0.5 * sin(dot(grassRoot.xz, grassDir) * 0.33 - uTime * 1.25 + 2.5 * gfxGrassNoise(grassRoot.xz * 0.06));
      cWave *= cWave;
      // and the fine shimmer, each blade its own
      float grassFine = sin(uTime * 3.4 + aBlade.z * 41.0 + dot(grassRoot.xz, vec2(1.3, 0.9)));
      vec2 grassBend = grassDir * (0.1 + 0.3 * grassGust + 0.32 * cWave + 0.3 * grassStorm) + vec2(-grassDir.y, grassDir.x) * grassFine * (0.05 + 0.04 * grassGust);
      for (int i = 0; i < ${MAX_FEET}; i++) {
        vec4 feet = uPlayers[i];
        vec2 away = grassRoot.xz - feet.xz;
        float d = length(away);
        float near = step(0.001, feet.w) * (1.0 - smoothstep(0.2, 0.9, d / max(feet.w, 0.01))) * (1.0 - smoothstep(0.3, 0.9, abs(feet.y - grassRoot.y)));
        grassBend += away / max(d, 0.05) * near * 1.3;
      }
      grassBend *= min(1.0, 1.2 / max(length(grassBend), 1e-3));
      float cUp = transformed.y - 0.02;
      transformed.xz += grassBend * grassH * cUp;
      transformed.y = 0.02 + cUp * (1.0 - 0.42 * dot(grassBend, grassBend) * grassH);
      #ifdef USE_COLOR
        vec2 cUV = cR + 0.5;
        vColor.rgb *= mix(mix(aC0, aC1, cUV.x), mix(aC2, aC3, cUV.x), cUV.y); // (the ground's color under it)
        vColor.rgb *= 1.0 + (0.14 * grassGust + 0.14 * cWave) * grassH; // (a wave's sheen running over the field)
        float grassDew = uMist * grassH * grassH * (0.7 + 0.3 * gfxGrassHash(grassRoot.xz * 7.3));
        vColor.rgb = vColor.rgb * (1.0 + 0.6 * grassDew) + vec3(0.02, 0.04, 0.05) * grassDew;
      #endif`, 'GFX_CARPET');
    shader.fragmentShader = patch(shader.fragmentShader, 'normal_fragment_begin', `
      #ifdef DOUBLE_SIDED
        normal *= faceDirection; // (back as it was: up, lit as the ground is)
        nonPerturbedNormal = normal;
      #endif`, 'GFX_CARPET');
  });
  return material;
}

const FLOWER_COLORS = [0xffffff, 0xffe14d, 0xff7eb6, 0xb58cff, 0xff6b4a];

// wilds: where the trees and rocks stand (shared/wilds.js growWilds, as the
// server sent them)
export function buildWorld(map, wilds = { trees: [], rocks: [] }) {
  const rng = mulberry32(map.seed);
  const rand = (min, max) => min + rng() * (max - min);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const H = map.half;
  const root = new THREE.Group();
  const grassPatches = []; // (its grass's InstancedMeshes, a patch each: viewFrom)
  const surfaceChunks = []; // (its ground's surface, a geometry a square: viewFrom)
  const platforms = []; // AABBs the player can stand on / bump into
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  if (map.groundMat) groundDetail(map.groundMat, 'tiles');
  if (map.turfMat) groundDetail(map.turfMat, 'turf');
  if (map.cliffMat) groundDetail(map.cliffMat, 'cliff');

  // What stands in the way of decorations while the world is built (not the
  // ground, nor the trees and rocks, which move as they grow back), by
  // BOX_CELL-sized squares, so a big island doesn't test every spot against
  // every box: "cx,cz" -> [box]
  const BOX_CELL = 4;
  const boxCells = new Map();
  function cellsOf(box, margin, each) {
    for (let cx = Math.floor((box.min.x - margin) / BOX_CELL); cx <= Math.floor((box.max.x + margin) / BOX_CELL); cx++) {
      for (let cz = Math.floor((box.min.z - margin) / BOX_CELL); cz <= Math.floor((box.max.z + margin) / BOX_CELL); cz++) each(`${cx},${cz}`);
    }
  }

  function addCollider({ x, y, z, w, h, d }, extra = {}) {
    const box = {
      center: new THREE.Vector3(x, y, z),
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ...extra,
    };
    platforms.push(box);
    if (!box.ground && !box.grows) {
      cellsOf(box, 0, (key) => {
        if (!boxCells.has(key)) boxCells.set(key, []);
        boxCells.get(key).push(box);
      });
    }
    return box;
  }

  // (a set piece's, when it is built afresh: the pens, when they grow)
  function removeCollider(box) {
    const i = platforms.indexOf(box);
    if (i >= 0) platforms.splice(i, 1);
    cellsOf(box, 0, (key) => {
      const list = boxCells.get(key);
      const j = list?.indexOf(box) ?? -1;
      if (j >= 0) list.splice(j, 1);
    });
  }

  function addBox({ x, y, z, w, h, d, color = 0x6b8e23, cap = null }) {
    const mesh = new THREE.Mesh(roughBox(x, y, z, w, h, d, color), roughMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (cap) {
      const top = new THREE.Mesh(
        roughBox(x, y, z, w + 0.12, 0.2, d + 0.12, CAP_COLORS[cap], { push: 0.03, dark: 0.3, layers: 0 }),
        map.turfMat ?? turfMat // (a map may bring its own: the farm's seasons color it)
      );
      top.position.set(x, y + h / 2 - 0.095, z);
      top.castShadow = true;
      top.receiveShadow = true;
      root.add(top);
    }
    return addCollider({ x, y, z, w, h, d });
  }

  // ---------- Ground ----------
  const tileGrid = new Map(); // "gx,gz" -> tile type, land only
  for (let gx = -H; gx <= H; gx++) {
    for (let gz = -H; gz <= H; gz++) {
      const type = map.tileType(gx, gz);
      if (type) tileGrid.set(`${gx},${gz}`, type);
    }
  }
  const tileAt = (x, z) => tileGrid.get(tileKeyFor(x, z));
  const floorOf = (type) => map.floors?.[type] ?? 0;

  // The earth under the tiles, and what you stand on: one box per run of
  // land tiles at the same height along each row
  const runs = [];
  for (let gz = -H; gz <= H; gz++) {
    let start = null;
    let floor = 0;
    for (let gx = -H; gx <= H + 1; gx++) {
      const type = tileGrid.get(`${gx},${gz}`);
      const f = type ? floorOf(type) : null;
      if (start !== null && f !== floor) {
        runs.push([start, gx - 1, gz, floor]);
        start = null;
      }
      if (type && start === null) {
        start = gx;
        floor = f;
      }
    }
  }
  const earth = new THREE.InstancedMesh(earthGeo, earthMat, runs.length);
  earth.receiveShadow = true;
  runs.forEach(([a, b, gz, floor], i) => {
    const w = (b - a + 1) * TILE_SIZE;
    const x = ((a + b) / 2) * TILE_SIZE;
    m.compose(v.set(x, floor - 0.5, gz * TILE_SIZE), q.identity(), s.set(w, 1, TILE_SIZE));
    earth.setMatrixAt(i, m);
    addCollider({ x, y: floor - 0.5, z: gz * TILE_SIZE, w, h: 1, d: TILE_SIZE }, { ground: true });
  });
  root.add(earth);

  // Each tile's own color, a little varied, and how high it sits: what a
  // stone slab on it looks like (see The ground's surface)
  const tileLook = new Map(); // "gx,gz" -> { color, top }
  for (const [key, type] of tileGrid) {
    const style = map.tileStyles[type];
    const top = rand(...style.top);
    const color = new THREE.Color(style.color).offsetHSL(0, 0, rand(-style.jitter, style.jitter));
    tileLook.set(key, { color, top });
  }

  for (const p of map.platforms ?? []) addBox(p);

  // Every place a tree or rock may stand in, by 4x4 squares: [x, z, r]
  const WILD_CELL = 4;
  const wildCell = (x, z) => `${Math.floor(x / WILD_CELL)},${Math.floor(z / WILD_CELL)}`;
  const wildPlaces = new Map();
  for (const [list, room] of [[wilds.trees, (t) => 0.35 * t.scale], [wilds.rocks, (r) => 0.9 * r.size]]) {
    for (const thing of list) {
      for (const [x, z] of thing.sites) {
        const key = wildCell(x, z);
        if (!wildPlaces.has(key)) wildPlaces.set(key, []);
        wildPlaces.get(key).push([x, z, room(thing)]);
      }
    }
  }
  function nearWild(x, z, margin) {
    const cx = Math.floor(x / WILD_CELL);
    const cz = Math.floor(z / WILD_CELL);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        for (const [px, pz, r] of wildPlaces.get(`${i},${j}`) ?? []) if (Math.hypot(x - px, z - pz) < r + margin) return true;
      }
    }
    return false;
  }

  // Is this spot a good place for decoration? On a tile where things grow,
  // clear of platforms' footprints, the places the map keeps clear, and
  // every place a tree or rock may stand in (by margin, or wildMargin from
  // those: less than 0 for grass right up to a trunk).
  function isOpenGround(x, z, margin = 0, wildMargin = margin) {
    if (!map.decorTypes.has(tileAt(x, z))) return false;
    for (let cx = Math.floor((x - margin) / BOX_CELL); cx <= Math.floor((x + margin) / BOX_CELL); cx++) {
      for (let cz = Math.floor((z - margin) / BOX_CELL); cz <= Math.floor((z + margin) / BOX_CELL); cz++) {
        for (const box of boxCells.get(`${cx},${cz}`) ?? []) {
          if (x > box.min.x - margin && x < box.max.x + margin && z > box.min.z - margin && z < box.max.z + margin) return false;
        }
      }
    }
    for (const [kx, kz, r] of map.keepClear) {
      if (Math.hypot(x - kx, z - kz) < r + margin) return false;
    }
    return !nearWild(x, z, wildMargin);
  }

  // Scatter by rejection sampling: random spots, kept only if far enough
  // from earlier placements and the rule for that kind of decoration passes.
  function scatter(count, minDist, accept, place, tries = count * 40) {
    const placed = [];
    for (let n = 0; n < tries && placed.length < count; n++) {
      const x = rand(-H, H);
      const z = rand(-H, H);
      if (!accept(x, z)) continue;
      if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < minDist)) continue;
      placed.push([x, z]);
      place(x, z);
    }
  }

  const ctx = { root, rng, rand, pick, tileAt, isOpenGround, scatter, addBox, addCollider, removeCollider };

  // The map's own set pieces (they claim their ground before anything grows)
  const animate = map.build?.(ctx);

  // ---------- Grass and flowers ----------
  // Instanced ground foliage per tile, so tilling a tile can clear what grows on it
  const foliageByTile = new Map(); // "gx,gz" -> [{ mesh, index }]
  function trackFoliage(x, z, mesh, index) {
    const key = tileKeyFor(x, z);
    if (!foliageByTile.has(key)) foliageByTile.set(key, []);
    foliageByTile.get(key).push({ mesh, index });
  }

  {
    // Gather placements first so each InstancedMesh is allocated at its exact size
    const tufts = []; // [x, z, foliage, lush]
    const flowers = [];
    for (const [key, type] of tileGrid) {
      const f = map.foliage[type];
      if (!f) continue;
      const [gx, gz] = key.split(',').map(Number);
      const lush = meadowNoise(gx, gz);
      const tuftCount = Math.floor(rand(0, f.tufts + lush * f.lushTufts));
      for (let n = 0; n < tuftCount; n++) {
        const x = gx + rand(-0.45, 0.45);
        const z = gz + rand(-0.45, 0.45);
        if (isOpenGround(x, z)) tufts.push([x, z, f, lush]);
      }
      if (lush > f.flowerLush && rng() < f.flowerChance) {
        const x = gx + rand(-0.4, 0.4);
        const z = gz + rand(-0.4, 0.4);
        if (isOpenGround(x, z)) flowers.push([x, z]);
      }
    }

    // Each tuft: [x, z, turn, scale, height, hue, lightness]. The first ones
    // take their draws from rng as the grass always has (after the 15 the old
    // tuft's shape took), so all that is placed after grows where it did.
    const tuftLook = (draw, [x, z, f, lush]) => {
      const turn = draw(0, Math.PI * 2);
      const k = draw(0.7, 1.3);
      const hue = draw(...(f.hue ?? [0.24, 0.3]));
      const light = draw(...(f.light ?? [0.38, 0.5]));
      return [x, z, turn, k, k * (f.tall ?? 1) * (0.9 + 0.2 * lush), hue, light];
    };
    for (let n = 0; n < 15; n++) rng();
    const grass = tufts.map((t) => tuftLook(rand, t));
    // ...and more again (MORE_GRASS), from a stream of their own: the
    // meadows thick, with nothing else moved
    const more = mulberry32(map.seed ^ 0x51a7);
    const moreRand = (min, max) => min + more() * (max - min);
    for (const [key, type] of tileGrid) {
      const f = map.foliage[type];
      if (!f) continue;
      const [gx, gz] = key.split(',').map(Number);
      const lush = meadowNoise(gx, gz);
      const count = Math.floor(moreRand(0, Math.max(f.tufts, f.tufts + lush * f.lushTufts) * MORE_GRASS)); // (thick in the lush patches, never bare between)
      for (let n = 0; n < count; n++) {
        const x = gx + moreRand(-0.5, 0.5);
        const z = gz + moreRand(-0.5, 0.5);
        if (isOpenGround(x, z, 0, -0.15)) grass.push(tuftLook(moreRand, [x, z, f, lush])); // (closer in round where a tree may stand: still clear of its trunk)
      }
    }
    // shuffled, so that drawing the first share of them thins them evenly
    for (let i = grass.length - 1; i > 0; i--) {
      const j = Math.floor(more() * (i + 1));
      [grass[i], grass[j]] = [grass[j], grass[i]];
    }
    // ...and a few creeping in over the edges of the stone slabs that face
    // grass, lower, from a stream of their own (each put in at a place of
    // its own in the shuffled list, so the tiers thin them as the rest and
    // nothing else moves)
    const edge = mulberry32(map.seed ^ 0x3d6e);
    const edgeRand = (min, max) => min + edge() * (max - min);
    for (const [key, type] of tileGrid) {
      if (type !== 'stone') continue;
      const [gx, gz] = key.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = tileGrid.get(`${gx + dx},${gz + dz}`);
        const f = map.foliage[next];
        if (!f || !map.tileStyles[next]?.lush) continue;
        const lush = meadowNoise(gx + dx, gz + dz);
        for (let n = Math.floor(edgeRand(2, 4.5)); n > 0; n--) {
          const along = edgeRand(-0.5, 0.5);
          const out = edgeRand(0.3, 0.48);
          const x = gx + dx * out + dz * along;
          const z = gz + dz * out + dx * along;
          if (!isOpenGround(x + dx * 0.3, z + dz * 0.3)) continue; // (as the grass beside it)
          const tuft = tuftLook(edgeRand, [x, z, f, lush]);
          tuft[3] *= 0.75; // (lower, spread over the stone)
          tuft[4] *= 0.6;
          grass.splice(Math.floor(edge() * grass.length), 0, tuft);
        }
      }
    }

    const tuftMat = map.tuftMat ?? new THREE.MeshStandardMaterial({ color: 0x8cc04f, roughness: 1, vertexColors: true }); // (a map may bring its own: the farm's seasons color it)
    tuftMat.side = THREE.DoubleSide;
    addGrassWind(tuftMat, TUFT_HEIGHT, true);
    // In square patches (GRASS_PATCH tiles a side), each its own InstancedMesh,
    // so the ones out of view are not drawn: a view sees about a fifth of the
    // island's grass. (Each keeps the shuffled order, so the tier thins every
    // patch evenly, and so does the distance: aRank, each tuft's place in it;
    // one tuft shape for them all, each patch its own copy for its aRank.)
    const tuftGeo = makeTuftGeometry();
    const patches = new Map(); // "px,pz" -> its tufts
    for (const tuft of grass) {
      const key = `${Math.floor(tuft[0] / GRASS_PATCH)},${Math.floor(tuft[1] / GRASS_PATCH)}`;
      if (!patches.has(key)) patches.set(key, []);
      patches.get(key).push(tuft);
    }
    for (const patch of patches.values()) {
      const geo = tuftGeo.clone();
      geo.setAttribute('aRank', new THREE.InstancedBufferAttribute(Float32Array.from(patch, (_, i) => i / patch.length), 1));
      const tuftMesh = new THREE.InstancedMesh(geo, tuftMat, patch.length);
      tuftMesh.receiveShadow = true;
      patch.forEach(([x, z, turn, k, tall, hue, light], i) => {
        m.compose(v.set(x, 0.02, z), q.setFromAxisAngle(up, turn), s.set(k, tall, k));
        tuftMesh.setMatrixAt(i, m);
        tuftMesh.setColorAt(i, c.setHSL(hue, 0.5, light));
        trackFoliage(x, z, tuftMesh, i);
      });
      tuftMesh.computeBoundingSphere(); // (now, while every tuft stands: one tilled away is scaled to nothing at the origin)
      tuftMesh.boundingSphere.radius += 0.5; // (and room for them to sway)
      tuftMesh.userData.tufts = patch.length;
      tuftMesh.userData.box = patch.reduce(([x0, z0, x1, z1], [x, z]) => [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)], [Infinity, Infinity, -Infinity, -Infinity]);
      grassTier(tuftMesh);
      grassMeshes.add(tuftMesh);
      grassPatches.push(tuftMesh);
      root.add(tuftMesh);
    }

    // Flowers: green stems plus colored heads, two InstancedMeshes sharing matrices
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4).translate(0, 0.15, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.065, 0).translate(0, 0.31, 0);
    const stemMat = map.flowerStemMat ?? new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 1 }); // (the farm's: its seasons)
    const headMat = map.flowerHeadMat ?? new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true });
    addGrassWind(stemMat, 0.37);
    addGrassWind(headMat, 0.37);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowers.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, flowers.length);
    const colors = map.flowerColors ?? FLOWER_COLORS;
    flowers.forEach(([x, z], i) => {
      const k = rand(0.8, 1.25);
      m.compose(v.set(x, 0.02, z), q.setFromAxisAngle(up, rand(0, Math.PI * 2)), s.set(k, k, k));
      stems.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      heads.setColorAt(i, c.setHex(pick(colors)));
      trackFoliage(x, z, stems, i);
      trackFoliage(x, z, heads, i);
    });
    root.add(stems, heads);
  }

  // Tilling (or building) hides a tile's foliage (scaled to nothing); its
  // matrices are kept in hiddenFoliage so the ground can grow back
  // (restoreFoliage(), or restoreFoliage(key) for one tile).
  let hiddenFoliage = [];
  let carpet = null; // (the grass carpet, once the ground is laid: makeCarpet)
  function clearFoliageOnTile(key) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const entry of foliageByTile.get(key) || []) {
      entry.key = key;
      entry.matrix = new THREE.Matrix4();
      entry.mesh.getMatrixAt(entry.index, entry.matrix);
      entry.mesh.setMatrixAt(entry.index, zero);
      entry.mesh.instanceMatrix.needsUpdate = true;
      hiddenFoliage.push(entry);
    }
    foliageByTile.delete(key);
    carpet?.hide(key, true);
  }

  function restoreFoliage(key = null) {
    const back = key === null ? hiddenFoliage : hiddenFoliage.filter((entry) => entry.key === key);
    for (const entry of back) {
      entry.mesh.setMatrixAt(entry.index, entry.matrix);
      entry.mesh.instanceMatrix.needsUpdate = true;
      // (tracked again so it can be tilled away again)
      const e = new THREE.Vector3().setFromMatrixPosition(entry.matrix);
      trackFoliage(e.x, e.z, entry.mesh, entry.index);
    }
    hiddenFoliage = key === null ? [] : hiddenFoliage.filter((entry) => entry.key !== key);
    if (key === null) carpet?.showAll();
    else carpet?.hide(key, false);
  }

  // ---------- Trees, bushes, rocks ----------
  // { id, group, scale, parts, fade, x, z, collider, state, ... } — group:
  // where it is drawn (never drawn itself: its parts are slots in treeDecor's
  // instanced meshes); fade drives see-through when blocking the player
  // (dithered away); state is 'up', 'falling',
  // 'down' or 'growing' (see Felling trees). id: its place in this list, the
  // same for everyone on the island, which is how a lobby names a tree.
  const trees = [];

  // The floor under a standing tree's canopy (the ground's vertices and the
  // grass tufts' colors, on every tier alike): darker and cooler toward the
  // trunk, as the canopy shuts out the sky, broken by dappled patches where
  // the sun gets through. It follows the trees: a felled one's goes with it
  // (and a growing one's comes once it stands), a giant's is wider, and one
  // that grows back elsewhere takes it along (drawTree marks, shadeCanopy
  // does it, each frame, for what changed).
  const groundTiles = new Map(); // "gx,gz" -> { chunk, first }: the ground's 5x5 vertices of a tile (below)
  const canopyAt = new Map(); // tree -> [x, z, reach] it shades now, or null
  const canopyDirty = []; // [x, z, reach]: spots to shade again
  const canopyOf = (tree) => (tree.state === 'down' || tree.state === 'growing' ? null
    : [tree.x, tree.z, (tree.kind === 'pine' ? 1.6 : 1.9) * tree.scale * tree.big]);
  function markCanopy(tree) {
    const now = canopyOf(tree);
    const was = canopyAt.get(tree) ?? null;
    if (String(now) === String(was)) return;
    if (was) canopyDirty.push(was);
    if (now) canopyDirty.push(now);
    canopyAt.set(tree, now);
  }

  // One of wilds.trees (shared/wilds.js): kind 'pine' | 'round', scale its
  // size, look what its details are drawn from (the same on every page).
  // A map may dress its trees and bushes in its own leaves (a season, say)
  const leaves = map.leafMats ?? leafMats;
  const needles = map.pineMats ?? pineMats;
  // (all of them drawn instanced, in a few draws: makeInstancer; their
  // materials shared, the 'tree' hook fading one at a time)
  // (and their painted detail, src/gfx/detail.js: bark up the trunks, a
  // leafy mottle on the canopies and bushes)
  for (const m of [trunkMat, ...leaves]) if (!treeLooks.has(m)) hookTree(detail(m, m === trunkMat ? 'bark' : 'leaf'));
  for (const m of needles) if (!treeLooks.has(m)) hookTree(detail(m, 'leaf'), true);
  const treeDecor = makeInstancer(root, DECOR_CHUNK);
  // a tree drawn where its group says (or not at all, down), and its stump
  // (while it is felled)
  const drawTree = (tree) => {
    treeDecor.show(tree.group, tree.parts, tree.state !== 'down');
    treeDecor.show(tree.stump, tree.stumpParts, tree.stumpUp);
    markCanopy(tree);
  };
  function addTree({ x, z, kind, scale, look, sites }) {
    const lr = mulberry32(look);
    const pickOwn = (arr) => arr[Math.floor(lr() * arr.length)];
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.rotation.y = lr() * Math.PI * 2;
    const k = scale;
    tree.scale.setScalar(k);
    root.add(tree);

    if (kind === 'pine') {
      // Pine: stacked cones
      const leaf = pickOwn(needles);
      addDecor(trunkGeo, trunkMat, 0, 0, 0, 1, 1.1, 1, tree);
      addDecor(pineGeo, leaf, 0, 1.3, 0, 1.05, 1, 1.05, tree);
      addDecor(pineGeo, leaf, 0, 2.0, 0, 0.8, 0.9, 0.8, tree).rotation.y = 0.33; // (each tier's tips between the last's)
      addDecor(pineGeo, leaf, 0, 2.6, 0, 0.55, 0.8, 0.55, tree).rotation.y = 0.9;
    } else {
      // Round tree: a cluster of soft leafy blobs
      const leaf = pickOwn(leaves);
      addDecor(trunkGeo, trunkMat, 0, 0, 0, 1.1, 1.5, 1.1, tree);
      addDecor(canopyGeo, leaf, 0, 2.1, 0, 1.0, 0.9, 1.0, tree);
      addDecor(canopyGeo, leaf, 0.55, 1.8, 0.3, 0.7, 0.65, 0.7, tree);
      addDecor(canopyGeo, leaf, -0.45, 1.85, -0.35, 0.75, 0.7, 0.75, tree);
    }
    // (each tree a shade of its own: lighter or darker, a touch warmer or cooler)
    const shade = 0.95 + hash2(x, z) * 0.17;
    const warm = (hash2(z + 3.1, x - 7.7) - 0.5) * 0.08;
    for (const obj of tree.children) if (obj.material !== trunkMat) obj.userData.tint = new THREE.Color(shade + warm, shade, shade - warm);
    const parts = treeDecor.adopt(tree);
    // its stump, for when it is felled (a slot of its own, hidden till then)
    const stump = new THREE.Mesh(stumpGeo, stumpMats);
    stump.position.set(x, 0, z);
    stump.castShadow = stump.receiveShadow = true;
    root.add(stump);
    const stumpParts = treeDecor.adopt(stump);
    // Trunk collider; tall enough that you can't jump up into the canopy
    const collider = addCollider({ x, y: 3, z, w: 0.5 * k, h: 6, d: 0.5 * k }, { grows: true });
    trees.push({
      id: trees.length, kind, group: tree, scale: k, parts, fade: 1,
      x, z, collider, trunk: kind === 'pine' ? 1 : 1.1, base: tree.quaternion.clone(),
      state: 'up', t: 0, shake: 0, axis: new THREE.Vector3(1, 0, 0), stump, stumpParts, stumpUp: false,
      big: 1, from: 0.01, // (a giant is drawn `big` times its scale; growing: from this scale)
      sites: sites.map(([sx, sz]) => [sx, sz]), // (where it may grow back: see place())
    });
  }

  // (drawn instanced with the rest of the decor, each a shade of its own as
  // the trees are)
  function addBush(x, z) {
    const leaf = pick(leaves);
    const k = rand(0.35, 0.6);
    const shade = 0.95 + hash2(x, z) * 0.12;
    const warm = (hash2(z + 3.1, x - 7.7) - 0.5) * 0.06;
    const tint = new THREE.Color(shade + warm, shade, shade - warm);
    addDecor(blobGeo, leaf, x, k * 0.6, z, k, k * 0.8, k, root).userData.tint = tint;
    addDecor(blobGeo, leaf, x + k * 0.7, k * 0.45, z + rand(-0.3, 0.3), k * 0.7, k * 0.6, k * 0.7, root).userData.tint = tint;
    if (rng() < 0.5) addDecor(blobGeo, leaf, x - k * 0.6, k * 0.4, z + rand(-0.3, 0.3), k * 0.6, k * 0.5, k * 0.6, root).userData.tint = tint;
  }

  // { id, mesh, parts, x, z, scale, radius, collider, state, ... }: mesh:
  // where it is drawn (never drawn itself: its slot in rockDecor's instanced
  // meshes, written whenever it moves: drawRock); radius is how far
  // it reaches out sideways as drawn (it is stretched, so more than its scale
  // says); state is 'up',
  // 'breaking', 'gone' or 'growing' (see Breaking rocks). id: its place in
  // this list, the same for everyone on the island, which is how a lobby
  // names a rock.
  const rocks = [];
  const rockDecor = makeInstancer(root, DECOR_CHUNK);
  const drawRock = (rock) => rockDecor.show(rock.mesh, rock.parts, rock.state !== 'gone');

  // One of wilds.rocks (shared/wilds.js): size (big ones are boulders and
  // get a collider), look (its shape, the same on every page)
  function addRock({ x, z, size, look, sites }) {
    const lr = mulberry32(look);
    const own = (min, max) => min + lr() * (max - min);
    const k = size;
    const rock = addDecor(rockGeo, rockMats[Math.floor(lr() * rockMats.length)], x, k * 0.3, z, k * own(1, 1.5), k * own(0.5, 0.8), k, root);
    rock.rotation.set(own(0, 0.4), own(0, Math.PI * 2), own(0, 0.4));
    rock.userData.decor = false; // (not still: its own instancer)
    const shade = 0.96 + hash2(x + 1.7, z) * 0.08;
    rock.userData.tint = new THREE.Color(shade, shade, shade);
    const parts = rockDecor.adopt(rock);
    const collider = k > 0.6 ? addCollider({ x, y: k * 0.35, z, w: k * 1.4, h: k * 0.7, d: k * 1.4 }, { grows: true }) : null;
    rocks.push({
      id: rocks.length, mesh: rock, parts, x, z, scale: k, radius: Math.max(rock.scale.x, rock.scale.z) * 0.85,
      collider, base: rock.scale.clone(), baseY: rock.position.y,
      state: 'up', t: 0, shake: 0, chips: null,
      big: 1, from: 0, baseRadius: 0, // (as for trees; growing: from this much of its size)
      sites: sites.map(([sx, sz]) => [sx, sz]),
    });
  }

  for (const tree of wilds.trees) addTree(tree);
  treeDecor.build();
  for (const tree of trees) drawTree(tree);
  for (const rock of wilds.rocks) addRock(rock);
  rockDecor.build();
  for (const rock of rocks) rock.baseRadius = rock.radius;
  // (the bushes and anything else the map scatters steer clear of them: isOpenGround)
  Object.assign(ctx, { addBush });
  map.decorate(ctx);

  // Everything still that the map and the bushes put down with addDecor (and
  // the map's own still things, userData.decor): drawn instanced, in a few
  // draws. (The meshes stay in root, never drawn, for their transforms.)
  const stillDecor = makeInstancer(root, DECOR_CHUNK);
  for (const obj of [...root.children]) if (obj.isMesh && obj.userData.decor) stillDecor.adopt(obj);
  stillDecor.build();

  // ---------- Growing back elsewhere ----------
  // A felled tree or a broken rock grows back somewhere else: each has a few
  // places (sites, from the server: the first is where it grew at the start).
  // Which place it stands in is its lobby's or farm's count of how often it
  // grew back (see place()).

  // Put a tree or rock in its place number n (a count of how often it grew
  // back; it goes round its places), or the next one canGrow(x, z) allows,
  // if the map has that rule (the farm: not on tilled soil or anything built).
  function place(thing, n) {
    const { sites } = thing;
    let [x, z] = sites[0];
    for (let i = 0; i < sites.length; i++) {
      const site = sites[(n + i) % sites.length];
      if (!map.canGrow || map.canGrow(site[0], site[1])) {
        [x, z] = site;
        break;
      }
    }
    const dx = x - thing.x;
    const dz = z - thing.z;
    if (!dx && !dz) return;
    thing.x = x;
    thing.z = z;
    for (const box of [thing.collider].filter(Boolean)) {
      for (const v of [box.min, box.max, box.center]) {
        v.x += dx;
        v.z += dz;
      }
    }
    const obj = thing.group ?? thing.mesh;
    obj.position.x = x;
    obj.position.z = z;
    thing.stump?.position.set(x, 0, z);
    if (thing.group) drawTree(thing);
    else drawRock(thing);
  }

  // ---------- The ground's surface ----------
  // Every tile (in a few meshes), colored by what the map says the ground is at
  // each vertex rather than per tile, so a path winds along its own curve
  // instead of in grid steps, and grass meets it and the sand without hard
  // tile lines. Each tile is a 5x5 patch of vertices, a quarter tile apart;
  // a vertex mixes the kinds of ground at it and the eight points around it
  // (a quarter tile away), which softens the edges. A point the map puts on
  // another floor (or in the sea) counts as its tile's own kind. The ground
  // is shaded a little darker right around whatever stands on it, which is
  // why it is laid after the decorations.
  // Stone tiles get a slab each on top: a plaza should look paved.
  {
    const kindColors = {}; // the plain color of each kind of ground
    const kindDetail = {}; // and which detail it takes (detailOf)
    for (const [type, style] of Object.entries(map.tileStyles)) {
      kindDetail[type] = detailOf(type, style);
      kindColors[type] = new THREE.Color(style.color);
      if (type === 'stone') kindColors[type].offsetHSL(0, -0.03, -0.07); // (its ground is painted by the shader: this is for the cliffs' lip)
    }
    const kinds = new Map(); // "qx,qz" (in quarter tiles) -> the map's kind of ground there
    const kindAt = (qx, qz) => {
      const key = `${qx},${qz}`;
      if (!kinds.has(key)) kinds.set(key, map.tileType(qx / 4, qz / 4));
      return kinds.get(key);
    };

    // (what stands on the ground, by BOX_CELL-sized squares, each in every
    // square its shade reaches into: at most SHADE_REACH out)
    const SHADE_REACH = 0.35 + 0.25 * 1.6;
    const standing = new Map();
    for (const box of platforms) {
      if (box.ground) continue;
      cellsOf(box, SHADE_REACH, (key) => {
        if (!standing.has(key)) standing.set(key, []);
        standing.get(key).push(box);
      });
    }
    // how much the things standing at (x, z) shade the ground there, 0..1
    const contactShade = (x, y, z) => {
      let shade = 0;
      for (const box of standing.get(`${Math.floor(x / BOX_CELL)},${Math.floor(z / BOX_CELL)}`) ?? []) {
        if (box.min.y > y + 0.2 || box.max.y < y) continue;
        const r = 0.35 + 0.25 * Math.min(box.max.x - box.min.x, box.max.z - box.min.z, 1.6);
        const dx = Math.max(box.min.x - x, 0, x - box.max.x);
        if (dx >= r) continue;
        const dz = Math.max(box.min.z - z, 0, z - box.max.z);
        if (dz >= r) continue;
        const near = 1 - Math.min(Math.hypot(dx, dz) / r, 1);
        shade = Math.max(shade, near * near);
      }
      return shade;
    };

    // (in squares of SURFACE_CHUNK tiles, a mesh each, so the ones out of
    // view aren't drawn: the whole island is most of a view's triangles)
    // (a tile's side has a cliff down from it where the sea or a lower
    // floor is next to it: dropAt gives -Infinity for the sea, the floor it
    // drops to, or null; the tiles that have one keep their vertices' colors,
    // for the cliff's lip)
    const dropAt = (gx, gz, floor) => {
      const next = tileGrid.get(`${gx},${gz}`);
      if (next === undefined) return -Infinity;
      return floorOf(next) < floor - 1e-3 ? floorOf(next) : null;
    };
    const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const lipColors = new Map(); // "gx,gz" -> its 5x5 vertices' colors (rgb)
    for (const [key, type] of tileGrid) {
      const [gx, gz] = key.split(',').map(Number);
      if (SIDES.some(([dx, dz]) => dropAt(gx + dx, gz + dz, floorOf(type)) !== null)) lipColors.set(key, new Float32Array(75));
    }

    // (how near the open sea a point is, for the wet sand at the waterline:
    // 1 on a side that faces it, 0 SHORE_REACH tiles in; src/gfx/ground.js)
    const SHORE_REACH = 1.5;
    const shoreAt = (x, z, gx, gz) => {
      let d = SHORE_REACH;
      for (let sz = gz - 2; sz <= gz + 2; sz++) {
        for (let sx = gx - 2; sx <= gx + 2; sx++) {
          if (tileGrid.has(`${sx},${sz}`)) continue;
          d = Math.min(d, Math.hypot(Math.max(sx - 0.5 - x, 0, x - sx - 0.5), Math.max(sz - 0.5 - z, 0, z - sz - 0.5)));
        }
      }
      return 1 - d / SHORE_REACH;
    };
    const nearSea = (gx, gz) => {
      for (let sz = gz - 2; sz <= gz + 2; sz++) for (let sx = gx - 2; sx <= gx + 2; sx++) if (!tileGrid.has(`${sx},${sz}`)) return true;
      return false;
    };

    const chunks = new Map(); // "cx,cz" -> { pos, col, kind, shore, index }
    const tint = new THREE.Color();
    const slabs = [];
    for (const [key, type] of tileGrid) {
      const [gx, gz] = key.split(',').map(Number);
      const floor = floorOf(type);
      const chunkKey = `${Math.floor((gx + H) / SURFACE_CHUNK)},${Math.floor((gz + H) / SURFACE_CHUNK)}`;
      if (!chunks.has(chunkKey)) chunks.set(chunkKey, { pos: [], col: [], kind: [], shore: [], index: [] });
      const { pos, col, kind: kindOf, shore: shoreOf, index } = chunks.get(chunkKey);
      const first = pos.length / 3;
      groundTiles.set(key, { chunk: chunks.get(chunkKey), first });
      const lip = lipColors.get(key);
      const coast = nearSea(gx, gz);
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const ox = (j - 2) / 4;
          const oz = (i - 2) / 4;
          const x = (gx + ox) * TILE_SIZE;
          const z = (gz + oz) * TILE_SIZE;
          const qx = gx * 4 + j - 2;
          const qz = gz * 4 + i - 2;
          tint.setRGB(0, 0, 0);
          let lush = 0;
          let jitter = 0;
          let open = 0; // (the share of it that isn't stone)
          const detail = [0, 0, 0, 0];
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              let kind = kindAt(qx + dj, qz + di);
              if (!kind || floorOf(kind) !== floor) kind = type;
              const w = (di ? 1 : 2) * (dj ? 1 : 2) / 16;
              if (kindDetail[kind] >= 0) detail[kindDetail[kind]] += w;
              if (kindDetail[kind] === 1) continue; // (stone lends no color: see below)
              open += w;
              tint.add(c.copy(kindColors[kind]).multiplyScalar(w));
              if (map.tileStyles[kind].lush) lush += w;
              jitter += map.tileStyles[kind].jitter * w;
            }
          }
          // The stone's own ground (its mortar, between and round the slabs)
          // is painted by the shader out to a crisp, wavering edge (its
          // share, gfxKind's y: src/gfx/ground.js), so its grey doesn't blur
          // out into the grass round it: the colors here are of the rest
          // (the plain stone's where there is nothing else)
          if (open > 0) {
            tint.multiplyScalar(1 / open);
            lush /= open;
            jitter /= open;
          } else {
            tint.copy(kindColors[type]);
            jitter = map.tileStyles[type].jitter;
          }
          const shade = 1 - meadowNoise(x, z) * 0.1 * lush + (hash2(x, z) - 0.5) * jitter * 5;
          tint.multiplyScalar(shade * (1 - 0.4 * contactShade(x, floor, z)));
          pos.push(x, floor + GROUND_LIFT, z);
          col.push(tint.r, tint.g, tint.b);
          const shore = coast ? shoreAt(gx + ox, gz + oz, gx, gz) : 0;
          shoreOf.push(Math.round(shore * 255));
          // (the lip over the sea as wet as the sand at its edge: the tiles' look)
          const wet = 1 - 0.42 * detail[3] * Math.min(Math.max((shore - 0.35) / 0.25, 0), 1);
          lip?.set([tint.r * wet, tint.g * wet, tint.b * wet * 0.96], (i * 5 + j) * 3);
          for (const d of detail) kindOf.push(Math.round(d * 255));
        }
      }
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const a = first + i * 5 + j;
          index.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
        }
      }
      if (type === 'stone') slabs.push([gx, gz, floor]);
    }
    for (const chunk of chunks.values()) {
      const { pos, col, kind, shore, index } = chunk;
      // (and after its own triangles, the same tiles coarser, 2x2 quads a
      // tile on every other vertex: drawn instead far from the view, viewFrom)
      const fine = index.length;
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      for (let first = 0; first < pos.length / 3; first += 25) {
        box[0] = Math.min(box[0], pos[first * 3]);
        box[1] = Math.min(box[1], pos[first * 3 + 2]);
        box[2] = Math.max(box[2], pos[(first + 24) * 3]);
        box[3] = Math.max(box[3], pos[(first + 24) * 3 + 2]);
        for (const i of [0, 2]) {
          for (const j of [0, 2]) {
            const a = first + i * 5 + j;
            index.push(a, a + 10, a + 2, a + 2, a + 10, a + 12);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('gfxKind', new THREE.Uint8BufferAttribute(kind, 4, true)); // (src/gfx/ground.js)
      geo.setAttribute('gfxShore', new THREE.Uint8BufferAttribute(shore, 1, true));
      geo.setIndex(index);
      geo.setDrawRange(0, fine);
      Object.assign(geo.userData, { fine, box });
      surfaceChunks.push(geo);
      chunk.geo = geo; // (for its shade under the trees: shadeCanopy)
      const ground = new THREE.Mesh(geo, map.groundMat ?? groundMat); // (as the grass tufts)
      ground.receiveShadow = true;
      root.add(ground);
    }

    // (each slab's sides that face grass, for its moss: -x, +x, -z, +z)
    const lushAt = (gx, gz) => (map.tileStyles[tileGrid.get(`${gx},${gz}`)]?.lush ? 255 : 0);
    const moss = new Uint8Array(slabs.length * 4);
    slabs.forEach(([gx, gz], i) => moss.set([lushAt(gx - 1, gz), lushAt(gx + 1, gz), lushAt(gx, gz - 1), lushAt(gx, gz + 1)], i * 4));
    const stoneGeo = slabGeo.clone();
    stoneGeo.setAttribute('gfxMoss', new THREE.InstancedBufferAttribute(moss, 4, true));
    const stones = new THREE.InstancedMesh(stoneGeo, slabMat, slabs.length);
    stones.receiveShadow = true;
    // (each a warm stone of its own, and one in six or so sunk a little into
    // the earth, tipped and darker: by a hash of its tile, so nothing that
    // the island's random stream places moves)
    const tip = new THREE.Quaternion();
    const warm = new THREE.Color();
    slabs.forEach(([gx, gz, floor], i) => {
      const { color, top } = tileLook.get(`${gx},${gz}`);
      const nx = hash2(gx, gz) - 0.5;
      const nz = hash2(gz, gx) - 0.5;
      const sunk = hash2(gx * 1.7 + 3.1, gz * 0.9 - 7.3) < 0.17;
      const lean = hash2(gx - 11.2, gz + 4.7) * Math.PI * 2;
      q.setFromAxisAngle(up, nx * 0.16);
      if (sunk) q.multiply(tip.setFromAxisAngle(v.set(Math.cos(lean), 0, Math.sin(lean)), 0.03));
      const y = sunk ? GROUND_LIFT + 0.006 + (top - 0.012) * 0.3 : top;
      m.compose(v.set((gx + nx * 0.05) * TILE_SIZE, floor + y - 0.03, (gz + nz * 0.05) * TILE_SIZE), q, s.set(1, 1, 1));
      stones.setMatrixAt(i, m);
      const h = hash2(gx * 0.7 + 2.3, gz * 1.3 + 5.9);
      warm.copy(color).offsetHSL(-0.045 + (hash2(gz + 9.1, gx - 1.7) - 0.5) * 0.05, 0.2 + 0.1 * h, 0.1 + (h - 0.5) * 0.08);
      stones.setColorAt(i, sunk ? warm.multiplyScalar(0.88) : warm);
    });
    root.add(stones);

    // (the shade under the trees standing now: The floor under a canopy)
    shadeCanopy();

    // ---------- The cliffs ----------
    // Down every side of a tile that the sea or a lower floor is next to: a
    // strip four quads along and three down, from just under a lip of the
    // tile's own ground to below the water (to the lower floor, for a bank),
    // its corners pushed out from the side by 0.05 to 0.25 (by their place
    // alone, so neighbors agree and it stays closed; round a corner of the
    // coast, out along the corner's own way). The lip leans out over it: the
    // tile's last row of vertices (its colors too), out a little and down,
    // and back in under to the cliff. The earth boxes stay, behind (they are
    // what you stand on), and the shallows and foam start at the tile's side,
    // so they meet the rock wherever it is. A mesh a chunk of the ground.
    const CLIFF_ROWS = [0, 0.38, 0.72, 1]; // (down the strip, from its top to its foot)
    const solidAt = (gx, gz, level) => {
      const type = tileGrid.get(`${gx},${gz}`);
      return type !== undefined && floorOf(type) >= level - 1e-3;
    };
    // which way a point on a tile's side is pushed: straight out, or at a
    // corner the way the four tiles round it say (away from the higher ones)
    const outAt = (px, pz, level, dx, dz, corner) => {
      if (!corner) return [dx, dz];
      const ax = Math.floor(px);
      const az = Math.floor(pz);
      let ox = 0;
      let oz = 0;
      for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const k = solidAt(ax + i, az + j, level) ? -1 : 1;
        ox += k * (i - 0.5);
        oz += k * (j - 0.5);
      }
      const len = Math.hypot(ox, oz);
      return len < 1e-6 ? [dx, dz] : [ox / len, oz / len];
    };
    const cliffChunks = new Map(); // "cx,cz" -> { pos, col, at }
    const earthTint = new THREE.Color();
    const shade = new THREE.Color();
    for (const [key, type] of tileGrid) {
      const lip = lipColors.get(key);
      if (!lip) continue;
      const [gx, gz] = key.split(',').map(Number);
      const floor = floorOf(type);
      const chunkKey = `${Math.floor((gx + H) / SURFACE_CHUNK)},${Math.floor((gz + H) / SURFACE_CHUNK)}`;
      if (!cliffChunks.has(chunkKey)) cliffChunks.set(chunkKey, { pos: [], col: [], at: [] });
      const { pos, col, at: cliffAt } = cliffChunks.get(chunkKey);
      // the earth under sand is sandier
      earthTint.copy(CLIFF_EARTH);
      if (kindDetail[type] === 3) earthTint.lerp(kindColors[type], 0.45);
      for (const [dx, dz] of SIDES) {
        const drop = dropAt(gx + dx, gz + dz, floor);
        if (drop === null) continue;
        const sea = drop === -Infinity;
        const lipDrop = sea ? 0.1 : 0.06;
        const top = floor - lipDrop;
        const foot = sea ? Math.min(floor - 1, SEA_LEVEL - 0.4) : drop - 0.05;
        const water = sea ? SEA_LEVEL : drop + 0.33; // (a pond's water, over its floor)
        const [tx, tz] = [-dz, dx]; // along the side
        // the points: rows (lip, lip's edge, under it, then the cliff's rows) by five along
        const rows = [[], [], [], [], [], [], []];
        const rowColor = [[], [], []];
        for (let k = 0; k <= 4; k++) {
          const along = k / 4 - 0.5;
          const px = gx + dx / 2 + tx * along;
          const pz = gz + dz / 2 + tz * along;
          const [ox, oz] = outAt(px, pz, floor, dx, dz, k === 0 || k === 4);
          const at = (out, y) => [(px + ox * out) * TILE_SIZE, y, (pz + oz * out) * TILE_SIZE];
          const pushOf = (y, min, range) => min + range * hash2(px * 3.17 + y * 1.73, pz * 2.31 - y * 1.37);
          const d0 = pushOf(top, 0.04, 0.08);
          const lean = d0 + 0.1 + 0.06 * hash2(pz * 5.3 + 1.1, px * 4.7 - 2.3);
          // the tile's own vertex here (its 5x5, j along x, i along z)
          const j = Math.round((px - gx) * 4 + 2);
          const i = Math.round((pz - gz) * 4 + 2);
          const r = lip[(i * 5 + j) * 3];
          const g = lip[(i * 5 + j) * 3 + 1];
          const b = lip[(i * 5 + j) * 3 + 2];
          rows[0].push(at(0, floor + GROUND_LIFT));
          rows[1].push(at(lean, floor + GROUND_LIFT - 0.015));
          rows[2].push(at(lean - 0.02, top + 0.02));
          for (let row = 0; row < 4; row++) {
            const y = top + (foot - top) * CLIFF_ROWS[row];
            rows[3 + row].push(at(row === 0 ? d0 : pushOf(y, 0.05, 0.2), y));
          }
          rowColor[0].push([r, g, b]);
          rowColor[1].push([r * 0.9, g * 0.9, b * 0.9]);
          rowColor[2].push([r * 0.7, g * 0.72, b * 0.66]);
        }
        for (let row = 0; row < 6; row++) {
          for (let k = 0; k < 4; k++) {
            const A = rows[row][k];
            const B = rows[row][k + 1];
            const C = rows[row + 1][k];
            const D = rows[row + 1][k + 1];
            // (the quad's diagonal one way or the other, so the facets don't saw along in step)
            const split = hash2(gx * 7.1 + k * 1.9, gz * 5.3 + row * 3.7 + dx * 2.1 + dz * 1.3) < 0.5;
            for (const tri of split ? [[A, B, C], [B, D, C]] : [[A, B, D], [A, D, C]]) {
              for (const p of tri) pos.push(...p);
              for (const p of tri) cliffAt.push(floor - p[1], p[1] - water); // (how far under the lip, how high over the water: gfxCliff)
              if (row < 2) {
                // the lip: its vertices' colors, as the ground's
                for (const p of tri) {
                  const [ri, ki] = p === A ? [row, k] : p === B ? [row, k + 1] : p === C ? [row + 1, k] : [row + 1, k + 1];
                  col.push(...rowColor[ri][ki]);
                }
                continue;
              }
              // under the lip and the cliff: a color a face, by how high it is
              const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
              const n = hash2(tri[0][0] * 1.9 + tri[1][2] * 0.7, tri[2][2] * 1.3 - tri[0][0] * 0.4 + cy);
              if (row === 2) shade.copy(earthTint).multiplyScalar(0.62);
              else if (cy < water + 0.12) shade.copy(CLIFF_ROCK).multiplyScalar(0.85 + 0.25 * n);
              else {
                const down = Math.min(1, (top - cy) / Math.max(0.3, top - water));
                shade.copy(earthTint).multiplyScalar(1.02 - 0.25 * down + Math.sin(cy * 9) * 0.04 + (n - 0.5) * 0.16);
              }
              for (let v3 = 0; v3 < 3; v3++) col.push(shade.r, shade.g, shade.b);
            }
          }
        }
      }
    }
    for (const { pos, col, at } of cliffChunks.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('gfxCliff', new THREE.Float32BufferAttribute(at, 2)); // (moss under the lip, wet by the water: src/gfx/ground.js)
      geo.computeVertexNormals(); // (one a face, smoothed where it is set on the mesh: src/gfx/smooth.js)
      const cliff = new THREE.Mesh(geo, map.cliffMat ?? cliffMat);
      cliff.receiveShadow = true;
      root.add(cliff);
    }
  }

  // ---------- The grass carpet (see makeCarpet's notes, up top) ----------
  carpet = makeCarpet();
  function makeCarpet() {
    const N = 2 * H + 1;
    const at = (gx, gz) => (gx + H) * N + (gz + H);
    const thick = new Float32Array(N * N); // (how thick it grows on each tile, 0: none)
    const tall = new Float32Array(N * N); // (its blades' height there, m)
    const bits = new Int16Array(N * N).fill(-1); // (which ninths are open: asked the first time it is in view)
    const hidden = new Uint8Array(N * N); // (tilled, or built on: clearFoliageOnTile)
    let any = false;
    for (const [key, type] of tileGrid) {
      const f = map.foliage[type];
      if (!f || floorOf(type) !== 0 || !groundTiles.has(key)) continue;
      const [gx, gz] = key.split(',').map(Number);
      const lush = meadowNoise(gx, gz);
      const i = at(gx, gz);
      thick[i] = Math.min(1, Math.max(0.3, (f.tufts + 0.5 * f.lushTufts) / 2.9));
      tall[i] = CARPET_HEIGHT * (f.tall ?? 1) * (0.9 + 0.2 * lush) * (0.88 + 0.24 * hash2(gx * 0.37, gz * 0.41));
      any = true;
    }
    if (!any) return null;
    const isOn = (gx, gz) => Math.abs(gx) <= H && Math.abs(gz) <= H && thick[at(gx, gz)] > 0 && !hidden[at(gx, gz)];
    const openBits = (gx, gz, i) => {
      if (bits[i] < 0) {
        let b = 0;
        for (let n = 0; n < 9; n++) if (isOpenGround(gx + ((n % 3) - 1) / 3, gz + (Math.floor(n / 3) - 1) / 3, 0, -0.15)) b |= 1 << n;
        bits[i] = b;
      }
      return bits[i];
    };
    const material = map.carpetMat ?? new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true }); // (a map may bring its own: the farm's seasons color it)
    material.side = THREE.DoubleSide;
    addCarpet(material);
    const base = carpetGeometry();
    const meshes = CARPET_LODS.map((share) => {
      const geo = new THREE.InstancedBufferGeometry();
      for (const name of ['position', 'normal', 'color', 'aBlade']) geo.setAttribute(name, base[name]);
      geo.setIndex(base.index);
      for (const [name, size] of Object.entries(CARPET_ATTRS)) {
        geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(CARPET_CAP * size), size).setUsage(THREE.DynamicDrawUsage));
      }
      geo.instanceCount = 0;
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false; // (what is in view is chosen here)
      mesh.receiveShadow = true;
      mesh.userData.share = share;
      mesh.visible = false;
      root.add(mesh);
      return mesh;
    });
    const frustum = new THREE.Frustum();
    const sphere = new THREE.Sphere();
    const eye = new THREE.Vector3();
    const view = new THREE.Matrix4();
    let last = '';
    const self = {
      tier(k) {
        for (const mesh of meshes) mesh.geometry.setDrawRange(0, Math.ceil(CARPET_BLADES * k.carpet * mesh.userData.share) * BLADE_INDICES);
        last = '';
      },
      hide(key, on) {
        const [gx, gz] = key.split(',').map(Number);
        if (Math.abs(gx) > H || Math.abs(gz) > H) return;
        hidden[at(gx, gz)] = on ? 1 : 0;
        last = '';
      },
      showAll() {
        hidden.fill(0);
        last = '';
      },
      // Before a view is drawn: the tiles its camera sees, out to rings
      // ([full to, none by], as uCarpetFar), each in the mesh with just
      // enough of its blades (a little more than enough: the view is put in
      // again only once the camera has moved half a step, or turned)
      view(camera, rings) {
        const share = U.uCarpet.value;
        if (!share) {
          for (const mesh of meshes) mesh.visible = false;
          return;
        }
        camera.updateMatrixWorld();
        eye.setFromMatrixPosition(camera.matrixWorld);
        root.updateWorldMatrix(true, false);
        const e = camera.matrixWorld.elements;
        const key = [eye.x * 2, eye.y * 2, eye.z * 2, e[8] * 60, e[9] * 60, e[10] * 60, camera.projectionMatrix.elements[0] * 60, camera.projectionMatrix.elements[5] * 60, rings[0], rings[1]].map(Math.round).join();
        if (key === last) return;
        last = key;
        frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const local = root.worldToLocal(eye.clone());
        const dy = Math.max(0, Math.abs(local.y - 0.4) - 0.4);
        const reach = Math.sqrt(Math.max(0, rings[1] * rings[1] - dy * dy)) + 1;
        const counts = [0, 0, 0];
        const x0 = Math.max(-H, Math.floor(local.x - reach));
        const x1 = Math.min(H, Math.ceil(local.x + reach));
        const z0 = Math.max(-H, Math.floor(local.z - reach));
        const z1 = Math.min(H, Math.ceil(local.z + reach));
        for (let gx = x0; gx <= x1; gx++) {
          for (let gz = z0; gz <= z1; gz++) {
            const i = at(gx, gz);
            if (!thick[i] || hidden[i]) continue;
            const dx = Math.max(Math.abs(local.x - gx) - 0.5, 0);
            const dz = Math.max(Math.abs(local.z - gz) - 0.5, 0);
            const keep = grassKeep(Math.sqrt(dx * dx + dz * dz + dy * dy) - 0.8, rings) * thick[i];
            if (keep <= 0.002) continue;
            sphere.center.set(gx, 0.35, gz).applyMatrix4(root.matrixWorld);
            sphere.radius = 1.1;
            if (!frustum.intersectsSphere(sphere)) continue;
            const lod = keep > CARPET_LODS[1] ? 0 : keep > CARPET_LODS[2] ? 1 : 2;
            const n = counts[lod];
            if (n >= CARPET_CAP) continue;
            const ground = groundTiles.get(`${gx},${gz}`);
            const color = ground?.chunk.geo?.attributes.color.array;
            if (!color) continue;
            counts[lod]++;
            const a = meshes[lod].geometry.attributes;
            a.aCell.array.set([gx, gz, tall[i], thick[i]], n * 4);
            a.aBits.array[n] = openBits(gx, gz, i) | (isOn(gx - 1, gz) ? 0 : 512) | (isOn(gx + 1, gz) ? 0 : 1024) | (isOn(gx, gz - 1) ? 0 : 2048) | (isOn(gx, gz + 1) ? 0 : 4096);
            for (const [c, v] of [['aC0', 0], ['aC1', 4], ['aC2', 20], ['aC3', 24]]) {
              const k = (ground.first + v) * 3;
              a[c].array.set([color[k], color[k + 1], color[k + 2]], n * 3);
            }
          }
        }
        meshes.forEach((mesh, lod) => {
          const geo = mesh.geometry;
          geo.instanceCount = counts[lod];
          mesh.visible = counts[lod] > 0;
          for (const [name, size] of Object.entries(CARPET_ATTRS)) {
            const attr = geo.attributes[name];
            attr.clearUpdateRanges();
            attr.addUpdateRange(0, counts[lod] * size);
            attr.needsUpdate = true;
          }
        });
      },
      dispose() {
        carpets.delete(self);
      },
    };
    self.tier(knobs());
    carpets.add(self);
    return self;
  }

  // ---------- Shallows and foam along the shore ----------
  // Strips on the sea along every tile edge that faces open water, with a
  // corner piece round each outside corner of the coast: lighter water
  // reaching out from the island, and foam over it. Vertex alpha: 1 at the
  // shore, 0 out at sea.
  const sea = (gx, gz) => !tileGrid.has(`${gx},${gz}`);
  function shoreStrip(width, color, y, material) {
    const pos = [];
    const col = [];
    const quad = (corners) => {
      // corners: four [x, z, alpha] going round
      for (const k of [0, 2, 1, 0, 3, 2]) {
        const [x, z, a] = corners[k];
        pos.push(x * TILE_SIZE, y, z * TILE_SIZE);
        col.push(color.r, color.g, color.b, a);
      }
    };
    const W = width;
    for (const key of tileGrid.keys()) {
      const [gx, gz] = key.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!sea(gx + dx, gz + dz)) continue;
        // the edge runs along (tx, tz), from -0.5 to 0.5 of the tile
        const [tx, tz] = [-dz, dx];
        const ex = gx + dx / 2;
        const ez = gz + dz / 2;
        quad([
          [ex - tx / 2, ez - tz / 2, 1],
          [ex - tx / 2 + dx * W, ez - tz / 2 + dz * W, 0],
          [ex + tx / 2 + dx * W, ez + tz / 2 + dz * W, 0],
          [ex + tx / 2, ez + tz / 2, 1],
        ]);
        // round the corner, where the coast turns away
        if (sea(gx + tx, gz + tz) && sea(gx + dx + tx, gz + dz + tz)) {
          const cx = ex + tx / 2;
          const cz = ez + tz / 2;
          quad([
            [cx, cz, 1],
            [cx + dx * W, cz + dz * W, 0],
            [cx + (dx + tx) * W * 0.7, cz + (dz + tz) * W * 0.7, 0],
            [cx + tx * W, cz + tz * W, 0],
          ]);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    return new THREE.Mesh(geo, material);
  }
  const shallows = shoreStrip(SHALLOWS_WIDTH, SHALLOWS_COLOR, SEA_LEVEL + 0.035, shallowsMat);
  const foam = shoreStrip(FOAM_WIDTH, FOAM_COLOR, SEA_LEVEL + 0.04, foamMat);
  shallows.renderOrder = 1; // over the sea
  foam.renderOrder = 2; // and over the shallows
  root.add(shallows, foam);

  // ---------- Felling trees ----------
  const moving = new Set(); // trees in the middle of shaking, falling or growing

  // the way a tree tips: away from `from` (a position), or any way at all
  function tipAway(tree, from) {
    let dx = from ? tree.x - from.x : rand(-1, 1);
    let dz = from ? tree.z - from.z : rand(-1, 1);
    const len = Math.hypot(dx, dz) || 1;
    // rotating about (dz, 0, -dx) tips the top toward (dx, dz)
    tree.axis.set(dz / len, 0, -dx / len);
  }

  function setTrunk(tree, standing) {
    const box = tree.collider;
    box.max.y = standing ? 6 : STUMP_H * tree.scale * tree.big;
    box.center.y = (box.min.y + box.max.y) / 2;
  }

  // a hit with the axe: a shiver up the trunk
  function shakeTree(id, from) {
    const tree = trees[id];
    if (tree?.state !== 'up') return;
    tipAway(tree, from);
    tree.shake = 1;
    tree.t = 0;
    moving.add(tree);
  }

  // instant: it is simply down already (it was felled before we came)
  function fellTree(id, from, { instant = false } = {}) {
    const tree = trees[id];
    if (!tree || tree.state === 'falling' || tree.state === 'down') return;
    const k = tree.scale * tree.big; // (a giant leaves a giant stump)
    tree.stump.scale.set(k * tree.trunk, k, k * tree.trunk);
    tree.stumpUp = true;
    setTrunk(tree, false);
    tipAway(tree, from);
    tree.state = instant ? 'down' : 'falling';
    tree.t = 0;
    drawTree(tree);
    if (instant) moving.delete(tree);
    else moving.add(tree);
  }

  // n: how often it has grown back (which of its places it is in; see
  // Growing back elsewhere)
  function regrowTree(id, { instant = false, n = 0 } = {}) {
    const tree = trees[id];
    if (!tree || tree.state === 'up' || tree.state === 'growing') return;
    place(tree, n);
    tree.big = 1; // (a giant comes back as itself)
    tree.from = 0.01;
    fitBox(tree.collider, tree.x, tree.z, 0.5 * tree.scale);
    setTrunk(tree, true);
    tree.stumpUp = false;
    tree.group.quaternion.copy(tree.base);
    tree.group.scale.setScalar(instant ? tree.scale : 0.01);
    tree.state = instant ? 'up' : 'growing';
    tree.t = 0;
    tree.shake = 0;
    drawTree(tree);
    if (instant) moving.delete(tree);
    else moving.add(tree);
  }

  // ---------- Breaking rocks ----------
  const crumbling = new Set(); // rocks shaking, breaking or surfacing

  function setBoulder(rock, standing) {
    const box = rock.collider;
    if (!box) return;
    const k = rock.scale * rock.big;
    box.max.y = standing && k > 0.6 ? k * 0.7 : box.min.y; // (broken, or a small one: nothing to bump into)
    box.center.y = (box.min.y + box.max.y) / 2;
  }

  // a hit with the pickaxe: a jolt
  function shakeRock(id) {
    const rock = rocks[id];
    if (rock?.state !== 'up') return;
    rock.shake = 1;
    rock.t = 0;
    crumbling.add(rock);
  }

  // instant: it is simply gone already (it was broken before we came)
  function breakRock(id, { instant = false } = {}) {
    const rock = rocks[id];
    if (!rock || rock.state === 'breaking' || rock.state === 'gone') return;
    setBoulder(rock, false);
    rock.state = instant ? 'gone' : 'breaking';
    rock.t = 0;
    drawRock(rock);
    if (instant) return crumbling.delete(rock);
    // chips fly off it
    if (!rock.chips) {
      rock.chips = Array.from({ length: CHIPS }, () => {
        const chip = new THREE.Mesh(rockGeo, rock.mesh.material);
        chip.castShadow = true;
        root.add(chip);
        return { mesh: chip, v: new THREE.Vector3() };
      });
    }
    for (const chip of rock.chips) {
      const a = Math.random() * Math.PI * 2;
      const out = 1.2 + Math.random() * 1.6;
      chip.v.set(Math.cos(a) * out, 3 + Math.random() * 2.5, Math.sin(a) * out);
      chip.mesh.position.set(rock.x, (rock.baseY + rock.scale * 0.3) * rock.big, rock.z);
      chip.mesh.scale.setScalar(Math.max(0.05, rock.scale * rock.big * (0.18 + Math.random() * 0.14)));
      chip.mesh.visible = true;
    }
    crumbling.add(rock);
  }

  function regrowRock(id, { instant = false, n = 0 } = {}) {
    const rock = rocks[id];
    if (!rock || rock.state === 'up' || rock.state === 'growing') return;
    place(rock, n);
    rock.big = 1;
    rock.from = 0;
    rock.radius = rock.baseRadius;
    fitRock(rock);
    for (const chip of rock.chips ?? []) chip.mesh.visible = false;
    rock.mesh.scale.copy(rock.base).multiplyScalar(instant ? 1 : 0.01);
    rock.mesh.position.y = rock.baseY;
    rock.state = instant ? 'up' : 'growing';
    rock.t = 0;
    rock.shake = 0;
    drawRock(rock);
    if (instant) crumbling.delete(rock);
    else crumbling.add(rock);
  }

  // A rock's collider as big as it is drawn (a giant one gets one, even a pebble's)
  function fitRock(rock) {
    const k = rock.scale * rock.big;
    if (!rock.collider) {
      if (k <= 0.6) return;
      rock.collider = addCollider({ x: rock.x, y: 0, z: rock.z, w: 0, h: 0, d: 0 }, { grows: true });
    }
    fitBox(rock.collider, rock.x, rock.z, k * 1.4);
    setBoulder(rock, rock.state === 'up' || rock.state === 'growing');
  }

  // ---------- Giants ----------
  // A standing tree or rock grows into a giant (shared/giants.js): it is drawn
  // giantScale times its size, and stays that till it comes down. instant:
  // it is simply a giant already (it was before we came).
  function makeGiant(kind, id, { instant = false } = {}) {
    if (kind === 'tree') {
      const tree = trees[id];
      if (!tree || tree.big > 1 || (tree.state !== 'up' && tree.state !== 'growing')) return;
      const was = tree.scale;
      tree.big = giantScale('tree', tree.scale);
      fitBox(tree.collider, tree.x, tree.z, 0.5 * tree.scale * tree.big);
      if (instant) {
        tree.state = 'up';
        tree.group.scale.setScalar(tree.scale * tree.big);
        drawTree(tree);
        moving.delete(tree);
      } else if (tree.state === 'up') {
        Object.assign(tree, { state: 'growing', from: was, t: 0, shake: 0 });
        tree.group.quaternion.copy(tree.base);
        moving.add(tree);
      }
    } else {
      const rock = rocks[id];
      if (!rock || rock.big > 1 || (rock.state !== 'up' && rock.state !== 'growing')) return;
      rock.big = giantScale('rock', rock.scale);
      rock.radius = rock.baseRadius * rock.big;
      rock.mesh.position.set(rock.x, rock.baseY * rock.big, rock.z);
      fitRock(rock);
      if (instant) {
        rock.state = 'up';
        rock.mesh.scale.copy(rock.base).multiplyScalar(rock.big);
        crumbling.delete(rock);
      } else if (rock.state === 'up') {
        Object.assign(rock, { state: 'growing', from: 1 / rock.big, t: 0, shake: 0 });
        crumbling.add(rock);
      }
      drawRock(rock);
    }
  }

  // A giant standing as itself again, at once (starting the island's picture over)
  function unGiant(kind, thing) {
    if (thing.big <= 1) return;
    const standing = thing.state === 'up' || thing.state === 'growing';
    thing.big = 1;
    if (kind === 'tree') {
      thing.from = 0.01;
      fitBox(thing.collider, thing.x, thing.z, 0.5 * thing.scale);
      if (!standing) return;
      thing.state = 'up';
      thing.group.scale.setScalar(thing.scale);
      drawTree(thing);
      moving.delete(thing);
    } else {
      thing.from = 0;
      thing.radius = thing.baseRadius;
      if (standing) {
        thing.state = 'up';
        thing.mesh.scale.copy(thing.base);
        thing.mesh.position.set(thing.x, thing.baseY, thing.z);
        crumbling.delete(thing);
      }
      fitRock(thing);
      drawRock(thing);
    }
  }

  // Where a giant's health bar goes (null: it isn't standing)
  function giantTop(kind, id) {
    const thing = kind === 'tree' ? trees[id] : rocks[id];
    if (!thing || thing.big <= 1 || thing.state === 'down' || thing.state === 'gone') return null;
    return new THREE.Vector3(thing.x, kind === 'tree' ? 3.4 : thing.scale * thing.big * 0.75 + 0.6, thing.z);
  }

  function updateRocks(dt) {
    for (const rock of crumbling) {
      rock.t += dt;
      const { mesh } = rock;
      const base = _rb.copy(rock.base).multiplyScalar(rock.big);
      if (rock.state === 'up') {
        rock.shake *= Math.exp(-9 * dt);
        mesh.position.x = rock.x + Math.sin(rock.t * 55) * 0.04 * rock.shake * Math.min(1, rock.scale * 2);
        if (rock.shake < 0.01) {
          mesh.position.x = rock.x;
          crumbling.delete(rock);
        }
      } else if (rock.state === 'breaking') {
        const p = Math.min(rock.t / ROCK_BREAK, 1);
        mesh.scale.copy(base).multiplyScalar(Math.max(0.01, 1 - p * p));
        mesh.position.set(rock.x, (rock.baseY - p * rock.scale * 0.2) * rock.big, rock.z);
        for (const chip of rock.chips) {
          chip.v.y -= 22 * dt;
          chip.mesh.position.addScaledVector(chip.v, dt);
          if (chip.mesh.position.y < 0.03) {
            chip.mesh.position.y = 0.03;
            chip.v.multiplyScalar(0.4);
            chip.v.y = Math.abs(chip.v.y) * 0.3;
          }
          chip.mesh.rotation.x += dt * 9;
          chip.mesh.rotation.z += dt * 7;
          if (rock.t > CHIP_LIFE - 0.2) chip.mesh.scale.multiplyScalar(Math.exp(-14 * dt));
        }
        if (p >= 1 && rock.t >= CHIP_LIFE) {
          rock.state = 'gone';
          for (const chip of rock.chips) chip.mesh.visible = false;
          crumbling.delete(rock);
        }
      } else if (rock.state === 'growing') {
        const p = Math.min(rock.t / ROCK_GROW, 1);
        mesh.scale.copy(base).multiplyScalar(Math.max(0.01, rock.from + (1 - rock.from) * easeOutBack(p)));
        if (p >= 1) {
          rock.state = 'up';
          crumbling.delete(rock);
        }
      } else {
        crumbling.delete(rock);
      }
      drawRock(rock);
    }
  }

  function updateTrees(dt) {
    updateRocks(dt);
    for (const tree of moving) {
      tree.t += dt;
      const { group, base, axis } = tree;
      const k = tree.scale * tree.big;
      if (tree.state === 'falling') {
        // Slow at first, then faster, with a little bounce as it lands
        const p = Math.min(tree.t / TREE_FALL, 1);
        const landed = tree.t - TREE_FALL;
        const bounce = landed > 0 ? Math.sin(Math.min(landed / 0.25, 1) * Math.PI) * 0.12 : 0;
        group.quaternion.setFromAxisAngle(axis, (Math.PI / 2 - 0.1) * p * p - bounce).multiply(base);
        if (landed > 0.25) {
          const q = Math.min((landed - 0.25) / TREE_GONE, 1);
          group.scale.setScalar(k * (1 - q * q));
          if (q >= 1) {
            tree.state = 'down';
            moving.delete(tree);
          }
        }
      } else if (tree.state === 'growing') {
        const p = Math.min(tree.t / TREE_GROW, 1);
        group.scale.setScalar(Math.max(0.01, tree.from + (k - tree.from) * easeOutBack(p)));
        if (p >= 1) {
          tree.state = 'up';
          moving.delete(tree);
        }
      } else if (tree.state === 'up') {
        tree.shake *= Math.exp(-6 * dt);
        group.quaternion.copy(base);
        if (tree.shake < 0.01) {
          moving.delete(tree);
        } else {
          group.quaternion.premultiply(_q.setFromAxisAngle(axis, Math.sin(tree.t * 32) * 0.05 * tree.shake));
        }
      } else {
        moving.delete(tree);
      }
      drawTree(tree);
    }
    shadeCanopy();
  }

  // The floor under a canopy, shaded again where canopyDirty says: each
  // ground vertex and grass tuft there, from its own color (kept the first
  // time), by the canopies over it now
  function shadeCanopy() {
    if (!canopyDirty.length || !groundTiles.size) return;
    const CANOPY_CELL = 4;
    const UNDER_CANOPY = [0.5, 0.42, 0.24]; // (how much darker, r g b, right under one: cooler)
    const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
    const cells = new Map(); // "cx,cz" -> the spots reaching into it
    for (const spot of canopyAt.values()) {
      if (!spot) continue;
      const [x, z, reach] = spot;
      for (let cx = Math.floor((x - reach) / CANOPY_CELL); cx <= Math.floor((x + reach) / CANOPY_CELL); cx++) {
        for (let cz = Math.floor((z - reach) / CANOPY_CELL); cz <= Math.floor((z + reach) / CANOPY_CELL); cz++) {
          const key = `${cx},${cz}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(spot);
        }
      }
    }
    // how far under a canopy (x, z) is, 0..1, with a dapple of sun
    const under = (x, z) => {
      let u = 0;
      for (const [sx, sz, reach] of cells.get(`${Math.floor(x / CANOPY_CELL)},${Math.floor(z / CANOPY_CELL)}`) ?? []) {
        const d = Math.hypot(x - sx, z - sz) / reach;
        if (d < 1) u = Math.max(u, 1 - smooth(0.3, 1, d));
      }
      if (!u) return 0;
      const dapple = 0.5 + 0.5 * Math.sin(x * 1.9 + z * 0.7) * Math.sin(z * 1.6 - x * 0.9 + 1.3);
      return u * (1 - 0.55 * smooth(0.55, 0.9, dapple));
    };
    const touched = new Set();
    for (const [x, z, reach] of canopyDirty.splice(0)) {
      for (let gx = Math.floor(x - reach - 1); gx <= Math.ceil(x + reach + 1); gx++) {
        for (let gz = Math.floor(z - reach - 1); gz <= Math.ceil(z + reach + 1); gz++) {
          const key = `${gx},${gz}`;
          const tile = groundTiles.get(key);
          if (tile?.chunk.geo) {
            const { geo } = tile.chunk;
            const p = geo.attributes.position.array;
            const col = geo.attributes.color;
            const base = (geo.userData.canopyBase ??= col.array.slice());
            for (let i = tile.first * 3; i < (tile.first + 25) * 3; i += 3) {
              const u = under(p[i], p[i + 2]);
              for (let k = 0; k < 3; k++) col.array[i + k] = base[i + k] * (1 - u * UNDER_CANOPY[k]);
            }
            touched.add(col);
          }
          for (const { mesh, index } of foliageByTile.get(key) ?? []) {
            const col = mesh.instanceColor;
            if (!col) continue;
            const base = (mesh.userData.canopyBase ??= col.array.slice());
            const m = mesh.instanceMatrix.array;
            const u = under(m[index * 16 + 12], m[index * 16 + 14]);
            for (let k = 0; k < 3; k++) col.array[index * 3 + k] = base[index * 3 + k] * (1 - u * UNDER_CANOPY[k] * 0.9);
            touched.add(col);
          }
        }
      }
    }
    for (const col of touched) col.needsUpdate = true;
  }

  const _eye = new THREE.Vector3();
  let farCanopies = null; // (its trees' canopies, by their squares: viewFrom)
  return {
    name: map.name,
    root,
    platforms,
    tileGrid,
    spawn: map.spawn,
    trees,
    shakeTree,
    fellTree,
    regrowTree,
    updateTrees, // (and the rocks)
    rocks,
    shakeRock,
    breakRock,
    regrowRock,
    makeGiant,
    giantTop,
    // every rock whole again, at once (arriving on an island we were on
    // before), each in its place as counted in moved ([[id, n]], see Growing back elsewhere)
    restoreAllRocks(moved = []) {
      const at = new Map(moved);
      for (const rock of rocks) {
        unGiant('rock', rock);
        regrowRock(rock.id, { instant: true });
        place(rock, at.get(rock.id) ?? 0);
      }
    },
    // every tree standing again, at once (the same way)
    standAllTrees(moved = []) {
      const at = new Map(moved);
      for (const tree of trees) {
        unGiant('tree', tree);
        regrowTree(tree.id, { instant: true });
        place(tree, at.get(tree.id) ?? 0);
      }
    },
    tileAt,
    clearFoliageOnTile,
    restoreFoliage,
    // eye: the player's chest; trees in front of it fade out, all the way
    // and quickly (gone in about 0.25 s: a tree half dithered away read as a
    // see-through green ghost on a phone), and back in a little slower; its
    // shadow stays (the shadow pass draws it whole)
    // views: [[eye, camera], ...] (a split screen: a tree in the way of any of them fades)
    updateTreeFade(dt, eye, camera, views = [[eye, camera]]) {
      const out = damp(20, dt);
      const back = damp(9, dt);
      for (const tree of trees) {
        const blocking = tree.state === 'up' && views.some(([at, cam]) => blocksView(tree, _eye.copy(at), cam));
        const was = tree.fade;
        tree.fade += ((blocking ? 0 : 1) - tree.fade) * (blocking ? out : back);
        if (tree.fade < 0.01) tree.fade = 0;
        if (tree.fade > 0.995) tree.fade = 1;
        if (tree.fade !== was) treeDecor.fade(tree.parts, 1 - tree.fade); // (dithered away: the 'tree' hook)
      }
    },
    // Before a view is drawn, from its camera (at, a Vector3): each patch of
    // grass draws only the tufts the grass hook keeps at its nearest to the
    // camera (grassFar: [half by, none by], as uGrassFar; none past the end),
    // the trees' canopies in squares further than canopyFar are the plain
    // ones (20 triangles a blob), and the ground's surface in squares further
    // than groundFar its coarse triangles (8 a tile, not 32): far off, in the
    // haze, they look the same (the ground's painted detail is per pixel)
    viewFrom(at, { grassFar, canopyFar, groundFar, camera = null }) {
      const carpetFar = [Math.min(grassFar[0] * CARPET_REACH, CARPET_FAR[0]), Math.min(grassFar[1] * CARPET_REACH, CARPET_FAR[1])];
      U.uCarpetFar.value.set(...carpetFar);
      if (camera) carpet?.view(camera, carpetFar);
      for (const geo of surfaceChunks) {
        const start = boxDistance(geo.userData.box, at.x, at.z) > groundFar ? geo.userData.fine : 0;
        if (geo.drawRange.start !== start) geo.setDrawRange(start, start ? Infinity : geo.userData.fine);
      }
      for (const mesh of grassPatches) {
        const keep = grassKeep(boxDistance(mesh.userData.box, at.x, at.z), grassFar);
        mesh.count = Math.min(mesh.userData.drawn, Math.ceil(mesh.userData.drawn * keep));
        mesh.visible = mesh.count > 0;
      }
      farCanopies ??= [treeDecor, rockDecor, stillDecor].flatMap((decor) => decor.meshes()).map((mesh) => mesh.geometry).filter((geo) => geo.userData.box);
      for (const geo of farCanopies) {
        const far = boxDistance(geo.userData.box, at.x, at.z) > canopyFar;
        if (far === !!geo.userData.far) continue;
        geo.userData.far = far;
        canopyRange(geo, knobs());
      }
    },
    update(t) {
      animate?.(t);
    },
    // Let go of its GPU buffers and shaders, once it is out of the scene for
    // good. (Some geometries and materials are shared between worlds: three.js
    // uploads those again the next time they are drawn.)
    dispose() {
      carpet?.dispose();
      root.traverse((obj) => {
        if (!obj.isMesh) return;
        grassMeshes.delete(obj);
        canopies.delete(obj.geometry);
        obj.geometry.dispose();
        for (const mat of [obj.material].flat()) mat.dispose();
        if (obj.isInstancedMesh) obj.dispose();
      });
    },
  };
}
