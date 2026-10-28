import * as THREE from 'three';
import { patch } from './chunks.js';
import { atmos } from './atmos.js';

// ---------- One way to change a material's shader ----------
// hook(material, key, fn): fn(shader, renderer, material) runs when the
// material's shader is compiled, after the base hooks (every lit material's,
// below) and the hooks added before it. The key names the change and its
// settings ('wind:0.250'): materials with the same keys, in the same order,
// share one shader program, so a key must say everything fn does differently.
// Hooking a key again replaces that hook where it was.
//
// Set once on THREE.Material's prototype, so no material needs its own
// onBeforeCompile (and nothing has to look for the ones that do).
// material.userData.gfx opts out of base looks a later phase adds:
// { noCloud, noWrap, noAtmos }.

const registry = new WeakMap(); // material -> [{ key, fn }]
const OPT_OUTS = ['noCloud', 'noWrap', 'noAtmos'];

const lit = (m) => !!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);

// Every lit material's, first: the fragment's world position as vGfxWorld,
// for a hook that defines GFX_WORLD (instancing-aware), then the atmosphere's
// fog (unless the material opts out: then it compiles as it did)
const BASE = [
  (shader) => {
    const declare = 'varying vec3 vGfxWorld;';
    shader.vertexShader = patch(shader.vertexShader, 'common', declare, 'GFX_WORLD');
    shader.fragmentShader = patch(shader.fragmentShader, 'common', declare, 'GFX_WORLD');
    shader.vertexShader = patch(shader.vertexShader, 'project_vertex', `
      vec4 gfxWorld = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        gfxWorld = batchingMatrix * gfxWorld;
      #endif
      #ifdef USE_INSTANCING
        gfxWorld = instanceMatrix * gfxWorld;
      #endif
      vGfxWorld = (modelMatrix * gfxWorld).xyz;`, 'GFX_WORLD');
  },
  atmos, // (the fog: the far land melts into the sky, a low haze over the sea: src/gfx/atmos.js)
];

export function hook(material, key, fn) {
  const list = registry.get(material) ?? [];
  const at = list.findIndex((h) => h.key === key);
  if (at >= 0) list[at] = { key, fn };
  else list.push({ key, fn });
  registry.set(material, list);
  material.needsUpdate = true;
  return material;
}

// Has the material a hook whose key matches (a RegExp, or a key)?
export function hasHook(material, match) {
  const list = registry.get(material) ?? [];
  return list.some(({ key }) => (match instanceof RegExp ? match.test(key) : key === match));
}

export const hookKeys = (material) => (registry.get(material) ?? []).map(({ key }) => key);

// The program cache key: the base looks it opts out of and its hooks' keys
export function cacheKey(material) {
  const flags = OPT_OUTS.filter((f) => material.userData?.gfx?.[f]).join(',');
  return `gfx1|${flags}|${hookKeys(material).join('+')}`;
}

// A copy of a material with its hooks (a plain clone() has none)
export function cloneHooked(material) {
  const copy = material.clone();
  const list = registry.get(material);
  if (list) registry.set(copy, list.slice());
  return copy;
}

const ownCompile = function onBeforeCompile(shader, renderer) {
  if (lit(this)) for (const fn of BASE) fn(shader, renderer, this);
  for (const { fn } of registry.get(this) ?? []) fn(shader, renderer, this);
};
THREE.Material.prototype.onBeforeCompile = ownCompile;
THREE.Material.prototype.customProgramCacheKey = function customProgramCacheKey() {
  const key = cacheKey(this);
  // (a material given its own onBeforeCompile, outside hook(): its code is part of the key)
  return this.onBeforeCompile === ownCompile ? key : `${key}|${this.onBeforeCompile.toString()}`;
};
