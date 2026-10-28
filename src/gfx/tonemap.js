import * as THREE from 'three';

// ---------- Tone mapping ----------
// AgX (filmic: bright light rolls off softly instead of clipping, dusk and
// night keep their color), with half of its hue skew undone: plain AgX bends
// greens toward yellow, reds toward orange and greys out what it brightens.
// Mixed with the same light at AgX's brightness but the scene's own hue, the
// grass stays green and rich, and highlights still roll off.
// It is three's CustomToneMapping, so it lives on the renderer: every tier
// gets it, drawn straight to the screen or through a post chain's OutputPass,
// which includes the same chunk. The day's lights (src/daynight.js KEYS) are
// set for this exposure.

export const TONE = { exposure: 1.15, keepHue: 0.5 };

const PLACEHOLDER = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const CUSTOM = `vec3 CustomToneMapping( vec3 color ) {
	const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );
	vec3 agx = AgXToneMapping( color );
	vec3 lit = color * toneMappingExposure;
	vec3 kept = clamp( lit * ( dot( agx, LUMA ) / max( dot( lit, LUMA ), 1e-5 ) ), 0.0, 1.0 );
	return mix( agx, kept, ${TONE.keepHue.toFixed(3)} );
}`;

// (once, before anything is drawn: the chunk is read as each program is made)
export function patchToneChunk() {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes(CUSTOM)) return;
  if (!chunk.includes(PLACEHOLDER)) throw new Error('gfx: no CustomToneMapping in this three');
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(PLACEHOLDER, CUSTOM);
}

export function toneMap(renderer) {
  patchToneChunk();
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = TONE.exposure;
}
