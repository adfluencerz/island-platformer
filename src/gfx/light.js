import * as THREE from 'three';
import { swap, define } from './chunks.js';
import { use } from './uniforms.js';
import { NOISE } from './noise.js';

// ---------- Painterly light ----------
// Every lit material's (a base hook, src/gfx/shading.js), in two parts a
// material can opt out of (userData.gfx):
//  - the wrap (noWrap): the sun (and any lamp) lights a face from a little
//    past side-on, smoothstep(-uWrap, 1, N.L), toward a two-step toon ramp
//    with a soft edge (uToon), so the terminator is soft and forms read painterly;
//  - the sky's shade (noCloud): the clouds' shadows drift over the land with
//    the sky's clouds (gfxCloudShadow: same drift, uCloudOffset, at about three
//    times the dome's density), more and darker as the weather clouds over; none
//    underground or on the low tier (uCloudShadows 0). And where the sun is
//    shaded (cast shadow, cloud, facing away) the sky's light is tinted cool
//    (uShadowTint), so shadows are blue, not grey.
// And at night, on the low tier (uNightGrey: no grade there, src/gfx/post.js),
// the light on its colors goes a little toward grey, as by moonlight.
// And in the rain (uWet, src/weather.js: lingering as it dries) the world is
// wet: its colors a little darker and richer (what faces up most, the grass
// less), a sheen of the sky's color on what faces up, more at a glancing
// view, and (GFX_PUDDLE: the ground's path and stone, src/gfx/ground.js, its
// groundPuddle) puddles, dark mirrors of the sky with drops ringing on them
// while it falls (uRain). Nothing of it when dry.
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
    float strength = uCloudShadows * (1.0 - uUnder) * (1.0 - 0.5 * uNight) * mix(0.8, 0.38, uCloudAmount); // (overcast: under cloud nearly everywhere, each patch less dark)
    if (strength <= 0.0) return 1.0;
    highp vec2 p = (xz - uCloudOffset) * ${CLOUD_SCALE.toFixed(4)} + vec2(5.5, 19.5); // (away from the noise's origin, a sunny hole)
    float n = (2.0 * gfxNoise(p) + gfxNoise(mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1)) / 3.0; // (two octaves)
    float edge = mix(0.6, 0.2, uCloudAmount); // (more of the land under cloud as it clouds over)
    return 1.0 - strength * smoothstep(edge - 0.1, edge + 0.12, n);
  }
`;

// GLSL: drops ringing on water (0..1 a ring), at p: a ring now and then in
// some cells of p (a ring as wide as a cell at most), each its own time
export const RIPPLE_GLSL = /* glsl */ `
#ifndef GFX_RIPPLES
#define GFX_RIPPLES
  float gfxRipples(highp vec2 p) {
    highp vec2 c = floor(p);
    vec2 at = p - c - 0.5 - (gfxHash2(c + 3.1) - 0.5) * 0.4;
    float h = gfxHash(c + 7.7);
    float t = fract(uTime * 0.9 + h * 5.0);
    return (1.0 - smoothstep(0.0, 0.07, abs(length(at) - 0.42 * t))) * (1.0 - t) * step(0.3, h);
  }
#endif
`;

const WRAP_GLSL = /* glsl */ `
  float gfxWrapNL(float d) {
    #ifdef GFX_WRAP
      float w = smoothstep(-uWrap * (1.0 - uNight), 1.0, d); // (none by moonlight: the night stays quiet)
      float band = smoothstep(0.1, 0.5, w); // (two steps, shade and light, the edge between them soft)
      return mix(w, band, uToon);
    #else
      return saturate(d);
    #endif
  }
`;

export const LIGHT_UNIFORMS = ['uWrap', 'uToon', 'uShadowTint', 'uCloudShadows', 'uCloudAmount', 'uCloudOffset', 'uUnder', 'uNight', 'uNightGrey', 'uWet', 'uRain', 'uTime', 'uSkyHorizon', 'uSkyZenith'];

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
        `IncidentLight directLight;\nfloat gfxSunLit = 1.0; // (how much of the sun reaches here: shadow, cloud, facing)\nfloat gfxCloud = 1.0; // (the cloud shadow here)\n${WET_GLSL}`,
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
          #ifdef GFX_SHADOW_LIFT
            gfxS = mix( gfxS, 1.0, gfxShadowLift ); // (a pine's rim, in the shade of the tier above: world.js hookTree)
          #endif
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

// In the rain: wet colors, darker and richer, the grass less; how wet and
// facing up a pixel is (gfxWetUp) and how much of a puddle (gfxPuddle) for
// the sheen (SHEEN_GLSL). Before the lights, on the material's color.
const WET_GLSL = /* glsl */ `
  float gfxWetUp = 0.0;
  float gfxPuddle = 0.0;
  // (not on water: it has its own sky, src/gfx/water.js)
  #ifndef GFX_WATER
  if ( uWet > 0.0 ) {
    float gfxUp = smoothstep( 0.35, 0.9, inverseTransformDirection( geometryNormal, viewMatrix ).y );
    float gfxK = uWet * ( 0.35 + 0.65 * gfxUp );
    #ifdef GFX_GRASS
      gfxK *= 0.7;
    #endif
    vec3 gfxC = material.diffuseColor;
    float gfxL = dot( gfxC, vec3( 0.2126, 0.7152, 0.0722 ) );
    material.diffuseColor = max( mix( vec3( gfxL ), gfxC, 1.0 + 0.3 * gfxK ), 0.0 ) * ( 1.0 - 0.28 * gfxK );
    gfxWetUp = uWet * gfxUp;
    #ifdef GFX_GRASS
      gfxWetUp *= 0.4;
    #endif
    #ifdef GFX_PUDDLE
      gfxPuddle = groundPuddle * gfxWetUp;
      material.diffuseColor *= 1.0 - 0.5 * gfxPuddle;
    #endif
  }
  #endif
`;

// The wet sheen: the sky's color (toward its zenith as the reflection looks
// up) on what faces up, more at a glancing view, much more in a puddle, and
// drops ringing in the puddles while it rains
const SHEEN_GLSL = /* glsl */ `
  #ifndef GFX_WATER
  if ( uWet > 0.0 ) {
    vec3 gfxWN = inverseTransformDirection( geometryNormal, viewMatrix );
    vec3 gfxWV = inverseTransformDirection( geometryViewDir, viewMatrix );
    vec3 gfxR = reflect( -gfxWV, gfxWN );
    vec3 gfxSky = mix( uSkyHorizon, uSkyZenith, smoothstep( 0.1, 0.8, gfxR.y ) );
    float gfxF = pow( 1.0 - saturate( dot( gfxWN, gfxWV ) ), 3.0 );
    float gfxSheen = gfxWetUp * ( 0.06 + 0.3 * gfxF ) + gfxPuddle * ( 0.28 + 0.3 * gfxF );
    #ifdef GFX_PUDDLE
      highp vec2 gfxDrop = vGfxWorld.xz * 1.6;
      gfxSheen += gfxPuddle * uRain * 0.45 * gfxRipples( gfxDrop ) * gfxShow( 1.6, gfxFootprint( gfxDrop ) );
    #endif
    reflectedLight.indirectDiffuse += gfxSky * gfxSheen;
  }
  #endif
`;

// Moonlight's grey: a little blue (its brightness the same), so what only the
// moon lights at night goes cool and what a lamp lights stays warm (here on
// the low tier, and in the grade on the others: src/gfx/post.js)
export const MOON = '0.78, 0.97, 1.45';

// At night (and underground) on the low tier: the diffuse light, toward grey (its brightness
// kept, as the grade does: greying the color it lights instead would let the
// blue moon light more of it), less where it is bright (a lamp's)
const GREY_GLSL = /* glsl */ `
  {
    float gfxGrey = uNightGrey * max( uNight * ( 1.0 - uUnder ), uUnder ); // (underground too: what no lamp lights, cool)
    if ( gfxGrey > 0.0 ) {
      const vec3 gfxLuma = vec3( 0.2126, 0.7152, 0.0722 );
      float gfxD = dot( reflectedLight.directDiffuse, gfxLuma );
      float gfxI = dot( reflectedLight.indirectDiffuse, gfxLuma );
      gfxGrey *= 1.0 - smoothstep( 0.08, 0.4, gfxD + gfxI );
      const vec3 gfxMoon = vec3( ${MOON} );
      reflectedLight.directDiffuse = mix( reflectedLight.directDiffuse, gfxD * gfxMoon, gfxGrey );
      reflectedLight.indirectDiffuse = mix( reflectedLight.indirectDiffuse, gfxI * gfxMoon, gfxGrey );
    }
  }
`;

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
  f = swap(f, pars, `${CLOUD_GLSL}\n${RIPPLE_GLSL}\n${WRAP_GLSL}\n${own[pars]}`, 'GFX_LIGHT');
  f = swap(f, 'lights_fragment_end', `${THREE.ShaderChunk.lights_fragment_end}\n${GREY_GLSL}\n${SHEEN_GLSL}`, 'GFX_LIGHT');
  shader.fragmentShader = f;
}
