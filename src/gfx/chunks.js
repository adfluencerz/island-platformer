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

// #define flag in both of the shader's stages (once)
export function define(shader, flag) {
  const line = `#define ${flag}\n`;
  if (!shader.vertexShader.includes(line)) shader.vertexShader = line + shader.vertexShader;
  if (!shader.fragmentShader.includes(line)) shader.fragmentShader = line + shader.fragmentShader;
}
