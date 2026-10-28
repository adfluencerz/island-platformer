import * as THREE from 'three';
import { swap, define } from './chunks.js';
import { use } from './uniforms.js';
import { NOISE } from './noise.js';

// ---------- Painterly light ----------
// Every lit material's (a base hook, src/gfx/shading.js), in two parts a
// material can opt out of (userData.gfx):
//  - the wrap (noWrap): the sun (and any lamp) lights a face from a little
//    past side-on, smoothstep(-uWrap, 1, N.L), in a soft half-tone step
//    (uToon), so the terminator is soft and blocky shapes read painterly;
//  - the sky's shade (noCloud): the clouds' shadows drift over the land with
//    the sky's clouds (gfxCloudShadow: same drift, uCloudOffset, at about three
//    times the dome's density), more and darker as the weather clouds over; none
//    underground or on the low tier (uCloudShadows 0). And where the sun is
//    shaded (cast shadow, cloud, facing away) the sky's light is tinted cool
//    (uShadowTint), so shadows are blue, not grey.
// Before tone mapping, as three's lighting is.

// (the dome's low clouds are at (dir.xz / y) * 0.7 - offset * 0.006: these are three times as
// dense, so a patch is tens of units wide, about half a view, and drift the same way, with the wind)
export const CLOUD_SCALE = 0.018;
const CLOUD_SKY = '0.6'; // (how much of a cloud's shade the sky's light takes: painterly, not physical)

// GLSL: the cloud shadow at a world xz (1 in the sun, less under a cloud), on the
// shared value noise (src/gfx/noise.js):
// phase 07's grass can call it with its own world position
export const CLOUD_GLSL = /* glsl */ `
${NOISE}
  float gfxCloudShadow(highp vec2 xz) {
    float strength = uCloudShadows * (1.0 - uUnder) * (1.0 - 0.5 * uNight) * mix(0.7, 0.35, uCloudAmount); // (overcast: under cloud nearly everywhere, each patch less dark)
    if (strength <= 0.0) return 1.0;
    highp vec2 p = (xz - uCloudOffset) * ${CLOUD_SCALE.toFixed(4)} + vec2(5.5, 19.5); // (away from the noise's origin, a sunny hole)
    float n = (2.0 * gfxNoise(p) + gfxNoise(mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1)) / 3.0; // (two octaves)
    float edge = mix(0.6, 0.2, uCloudAmount); // (more of the land under cloud as it clouds over)
    return 1.0 - strength * smoothstep(edge - 0.1, edge + 0.12, n);
  }
`;

const WRAP_GLSL = /* glsl */ `
  float gfxWrapNL(float d) {
    #ifdef GFX_WRAP
      float w = smoothstep(-uWrap * (1.0 - uNight), 1.0, d); // (none by moonlight: the night stays quiet)
      float band = 0.5 * smoothstep(0.04, 0.22, w) + 0.5 * smoothstep(0.42, 0.85, w); // (dark, a half-tone, lit)
      return mix(w, band, uToon);
    #else
      return saturate(d);
    #endif
  }
`;

export const LIGHT_UNIFORMS = ['uWrap', 'uToon', 'uShadowTint', 'uCloudShadows', 'uCloudAmount', 'uCloudOffset', 'uUnder', 'uNight'];

const edit = (chunk, from, to, what) => {
  if (!chunk.includes(from)) throw new Error(`gfx: three's ${what} has changed (light.js)`);
  return chunk.replace(from, to);
};

const DIFFUSE = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
const WRAPPED = 'reflectedLight.directDiffuse += gfxWrapNL( dot( geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );';
const DIR_INFO = 'getDirectionalLightInfo( directionalLight, directLight );';
const DIR_SHADOW = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const INDIRECT_END = '#if defined( RE_IndirectSpecular )';

// three's chunks with ours in (made on first use; throws if three moved the lines they edit)
let chunks = null;
export function lightChunks() {
  const C = THREE.ShaderChunk;
  return (chunks ??= {
    // the diffuse from each light, wrapped (specular as it was)
    lights_physical_pars_fragment: edit(C.lights_physical_pars_fragment, DIFFUSE, WRAPPED, 'RE_Direct_Physical'),
    lights_lambert_pars_fragment: edit(C.lights_lambert_pars_fragment, DIFFUSE, WRAPPED, 'RE_Direct_Lambert'),
    lights_phong_pars_fragment: edit(C.lights_phong_pars_fragment, DIFFUSE, WRAPPED, 'RE_Direct_BlinnPhong'),
    lights_fragment_begin: [
      [
        'IncidentLight directLight;',
        'IncidentLight directLight;\nfloat gfxSunLit = 1.0; // (how much of the sun reaches here: shadow, cloud, facing)\nfloat gfxCloud = 1.0; // (the cloud shadow here)',
      ],
      [
        DIR_INFO,
        `${DIR_INFO}
        #if ( UNROLLED_LOOP_INDEX == 0 )
          { // (the first directional light is the sun, or the moon)
            float gfxC = 1.0;
            #ifdef GFX_CLOUD
              gfxC = gfxCloudShadow( vGfxWorld.xz );
            #endif
            directLight.color *= gfxC;
            gfxCloud = gfxC;
            gfxSunLit = gfxC * smoothstep( -0.05, 0.35, dot( geometryNormal, directLight.direction ) );
          }
        #endif`,
      ],
      [
        DIR_SHADOW,
        `{
          float gfxS = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
          // (a face turned from the light is in its own shadow anyway: the wrap darkens it, smoothly, not the map)
          gfxS = mix( gfxS, 1.0, smoothstep( 0.0, -0.12, dot( geometryNormal, directLight.direction ) ) );
          directLight.color *= gfxS;
          #if ( UNROLLED_LOOP_INDEX == 0 )
            gfxSunLit *= gfxS;
          #endif
        }`,
      ],
      [
        INDIRECT_END,
        `#if defined( RE_IndirectDiffuse )
          irradiance *= 1.0 - ${CLOUD_SKY} * ( 1.0 - gfxCloud ); // (under a cloud the sky's light is dimmer too)
          irradiance *= mix( vec3( 1.0 ), uShadowTint, ( 1.0 - gfxSunLit ) * ( 1.0 - uUnder ) ); // (cool where the sun is shaded)
        #endif
        ${INDIRECT_END}`,
      ],
    ].reduce((chunk, [from, to]) => edit(chunk, from, to, 'lights_fragment_begin'), C.lights_fragment_begin),
  });
}

const PARS = ['lights_physical_pars_fragment', 'lights_lambert_pars_fragment', 'lights_phong_pars_fragment'];

// The base hook (lit materials)
export function light(shader, renderer, material) {
  const opt = material?.userData?.gfx ?? {};
  const own = lightChunks();
  define(shader, 'GFX_WORLD');
  define(shader, 'GFX_LIGHT');
  if (!opt.noWrap) define(shader, 'GFX_WRAP');
  if (!opt.noCloud) define(shader, 'GFX_CLOUD');
  use(shader, LIGHT_UNIFORMS, 'f');
  let f = swap(shader.fragmentShader, 'lights_fragment_begin', own.lights_fragment_begin, 'GFX_LIGHT');
  const pars = PARS.find((name) => f.includes(`#include <${name}>`));
  f = swap(f, pars, `${CLOUD_GLSL}\n${WRAP_GLSL}\n${own[pars]}`, 'GFX_LIGHT');
  shader.fragmentShader = f;
}
