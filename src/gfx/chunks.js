// ---------- Where shader hooks cut in ----------
// The lines of three's built-in lit shaders (Standard, Lambert, Phong) that a
// hook adds its code after. `npm test` checks every one is still in the
// installed three (scripts/test-multiplayer.js), so an upgrade that renames a
// chunk fails there, not as a blank material in the browser.

export const NEEDLES = {
  common: { needle: '#include <common>', stages: 'vf' },
  begin_vertex: { needle: '#include <begin_vertex>', stages: 'v' },
  project_vertex: { needle: '#include <project_vertex>', stages: 'v' },
  color_fragment: { needle: '#include <color_fragment>', stages: 'f' },
  normal_fragment_begin: { needle: '#include <normal_fragment_begin>', stages: 'f' },
  normal_fragment_maps: { needle: '#include <normal_fragment_maps>', stages: 'f' },
  emissivemap_fragment: { needle: '#include <emissivemap_fragment>', stages: 'f' },
  fog_pars_fragment: { needle: '#include <fog_pars_fragment>', stages: 'f' },
  fog_fragment: { needle: '#include <fog_fragment>', stages: 'f' },
  colorspace_fragment: { needle: '#include <colorspace_fragment>', stages: 'f' }, // (after tone mapping: src/gfx/water.js)
  lights_fragment_begin: { needle: '#include <lights_fragment_begin>', stages: 'f' },
  lights_fragment_end: { needle: '#include <lights_fragment_end>', stages: 'f' },
  // (one each: libs names the shaders that have it)
  lights_physical_pars_fragment: { needle: '#include <lights_physical_pars_fragment>', stages: 'f', libs: ['standard'] },
  lights_lambert_pars_fragment: { needle: '#include <lights_lambert_pars_fragment>', stages: 'f', libs: ['lambert'] },
  lights_phong_pars_fragment: { needle: '#include <lights_phong_pars_fragment>', stages: 'f', libs: ['phong'] },
};

// source with `code` after the chunk `name` (a key of NEEDLES), inside
// `#ifdef flag` (GFX_...) when one is given: a material that doesn't define
// it compiles exactly as before
export function patch(source, name, code, flag) {
  const { needle } = NEEDLES[name] ?? {};
  if (!needle || !source.includes(needle)) throw new Error(`gfx: no ${name} in this shader`);
  const body = flag ? `#ifdef ${flag}\n${code}\n#endif` : code;
  return source.replace(needle, `${needle}\n${body}`);
}

// source with the chunk `name` itself replaced by `code` where `flag` is
// defined (and left as it was where it isn't)
export function swap(source, name, code, flag) {
  const { needle } = NEEDLES[name] ?? {};
  if (!needle || !source.includes(needle)) throw new Error(`gfx: no ${name} in this shader`);
  return source.replace(needle, `#ifdef ${flag}\n${code}\n#else\n${needle}\n#endif`);
}

// #define flag in both of the shader's stages (once)
export function define(shader, flag) {
  const line = `#define ${flag}\n`;
  if (!shader.vertexShader.includes(line)) shader.vertexShader = line + shader.vertexShader;
  if (!shader.fragmentShader.includes(line)) shader.fragmentShader = line + shader.fragmentShader;
}
