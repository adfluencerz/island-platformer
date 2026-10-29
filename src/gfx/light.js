import * as THREE from 'three';
import { swap, define } from './chunks.js';
import { use } from './uniforms.js';
import { NOISE } from './noise.js';
import { DUSK_GLSL, DUSK_UNIFORMS } from './atmos.js';

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
    float day = gfxDay(); // (at a clear noon each patch's edge crisper, a little lighter: shadows drifting over the grass, not a blur)
    float strength = uCloudShadows * (1.0 - uUnder) * (1.0 - 0.5 * uNight) * mix(0.8, 0.38, uCloudAmount) * (1.0 - 0.2 * day); // (overcast: under cloud nearly everywhere, each patch less dark)
    if (strength <= 0.0) return 1.0;
    highp vec2 p = (xz - uCloudOffset) * ${CLOUD_SCALE.toFixed(4)} + vec2(5.5, 19.5); // (away from the noise's origin, a sunny hole)
    float n = (2.0 * gfxNoise(p) + gfxNoise(mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1)) / 3.0; // (two octaves)
    float edge = mix(0.6, 0.2, uCloudAmount) - 0.04 * day; // (more of the land under cloud as it clouds over)
    float soft = 1.0 - 0.75 * day;
    return 1.0 - strength * smoothstep(edge - 0.1 * soft, edge + 0.12 * soft, n);
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

// GLSL: under the trees (src/world.js coverCanopy, uCanopyMap): how far under
// the canopies (x, z) is, 0..1, with a high sun only (none at dusk, at night,
// underground: the shadow map does a low sun's long shadows), and how much of
// the sun gets through a gap in the leaves there, 0..1: soft spots, two
// octaves of the value noise, drifting slowly with the wind and the leaves' sway
const CANOPY_GLSL = /* glsl */ `
  float gfxCanopyCover(highp vec2 xz) {
    float k = smoothstep(0.45, 0.75, uSunDir.y) * (1.0 - smoothstep(0.0, 0.25, uNight)) * (1.0 - uUnder);
    highp vec2 uv = (xz - uCanopyBox.xy) * uCanopyBox.zw;
    if (k <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
    return k * texture(uCanopyMap, uv).r;
  }
  float gfxCanopyGap(highp vec2 xz) {
    highp vec2 p = xz * 0.62 - uCloudOffset * 0.03 + 0.12 * vec2(sin(uTime * 0.7), cos(uTime * 0.53)) + vec2(3.7, 11.3);
    float n = 0.62 * gfxNoise(p) + 0.38 * gfxNoise(mat2(1.6, 1.2, -1.2, 1.6) * p * 1.7 + 5.3);
    return smoothstep(0.52, 0.61, n);
  }
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

export const LIGHT_UNIFORMS = [...new Set(['uWrap', 'uToon', 'uShadowTint', 'uCloudShadows', 'uCloudAmount', 'uCloudOffset', 'uUnder', 'uNight', 'uNightGrey', 'uWet', 'uRain', 'uTime', 'uSkyHorizon', 'uSkyZenith', 'uCanopyMap', 'uCanopyBox', ...DUSK_UNIFORMS])];
const CANOPY_SKY = 'vec3(0.24, 0.4, 0.56)'; // (the sky's light under the canopies: dimmer, blue-green, not grey)
const CANOPY_GAP = 'vec3(1.45, 1.3, 0.92)'; // (and the sun in a gap: a little warm and bright, by the shade round it)
const DUSK_FILL = '0.55'; // (how much of the sky's light the near field loses at dusk, in the shade)
const MORNING_FILL = '0.5'; // (and in the misty morning)
const RAIN_FILL = '0.5'; // (and in the rain, in the shade or not: the overcast's flat light)
const DAY_FILL = '0.38'; // (and at a clear noon, in the shade most: the near field rich, not washed by the sky's blue)
const NIGHT_FILL = '0.6'; // (and on a moonlit night, in the moon's shade most: the near field dark and rich, the moon's key and rim reading on it)
const DAY_RICH = '0.22'; // (how much richer the near field's colors are at a clear noon)

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
        `IncidentLight directLight;\nfloat gfxSunLit = 1.0; // (how much of the sun reaches here: shadow, cloud, facing)\nfloat gfxCloud = 1.0; // (the cloud shadow here)\nfloat gfxCover = 0.0; // (how far under the trees' canopies, and how much of a gap in them: CANOPY_GLSL)\nfloat gfxGap = 0.0;\n${WET_GLSL}\n${NOON_GLSL}`,
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
            float gfxUnder = 1.0; // (the sun through the canopies)
            #if defined( GFX_CANOPY ) && !defined( GFX_WATER )
              gfxCover = gfxCanopyCover( vGfxWorld.xz );
              #ifdef GFX_TREE
                gfxCover *= 1.0 - step( 0.5, uTreeLeaf ); // (a trunk in the wood's shade, not the leaves over it)
              #endif
              if ( gfxCover > 0.002 ) {
                gfxGap = gfxCanopyGap( vGfxWorld.xz ) * ( 1.0 - 0.45 * smoothstep( 0.7, 1.0, gfxCover ) ); // (fewer in the heart of it)
                gfxUnder = 1.0 - gfxCover * ( 1.0 - gfxGap );
                directLight.color *= gfxUnder * mix( vec3( 1.0 ), ${CANOPY_GAP}, gfxCover * gfxGap );
              }
            #endif
            #ifdef GFX_SUN_GLOW
              directLight.color *= 1.0 + vGfxSunGlow; // (a grass tip, a crown's edge catching a low sun, dew: the hook's own color, shadowed as the sun is)
            #endif
            gfxCloud = gfxC;
            gfxSunLit = gfxC * gfxUnder * smoothstep( -0.05, 0.35, dot( geometryNormal, directLight.direction ) );
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
          irradiance *= mix( vec3( 1.0 ), ${CANOPY_SKY}, gfxCover * ( 1.0 - 0.5 * gfxGap ) ); // (and under the canopies, less of the sky)
          #if defined( USE_FOG ) && !defined( FOG_EXP2 )
            // (at dusk, less of the sky's light near the camera, back in full by the far field: a darker,
            // richer foreground the long shadows read across, the far one paler: atmos.js)
            // (more in the shade than in the sun: the shadows deep, the lit grass not dimmed much)
            // (in the morning less so, and the near shade cooler: clear, cool, the long shadows blue)
            float gfxNearShade = ( 1.0 - smoothstep( 0.7, 1.9, vFogDepth / max( fogNear, 1e-3 ) ) ) * ( 1.0 - 0.45 * gfxSunLit );
            float gfxMorn = gfxMorning() * gfxNearShade;
            // (in the rain the overcast's flat light: less of it near the camera
            // whatever the sun, so the wet foreground is dark and rich and the sheen reads on it)
            float gfxNearRain = gfxRain() * ( 1.0 - smoothstep( 0.6, 2.0, vFogDepth / max( fogNear, 1e-3 ) ) );
            float gfxNearNight = gfxNight() * ( 1.0 - smoothstep( 0.6, 1.9, vFogDepth / max( fogNear, 1e-3 ) ) ) * ( 1.0 - 0.4 * gfxSunLit );
            // (at a clear noon the same: less of the sky's flat fill near the camera, more in the
            // shade than in the sun, so the near greens are rich and the sun's and clouds' shadows read)
            float gfxNoon = gfxDay();
            float gfxNearDay = gfxNoon * ( 1.0 - smoothstep( 0.6, 1.9, vFogDepth / max( fogNear, 1e-3 ) ) ) * ( 1.0 - 0.5 * gfxSunLit );
            irradiance *= 1.0 - ${DUSK_FILL} * gfxDusk() * gfxNearShade - ${MORNING_FILL} * gfxMorn - ${RAIN_FILL} * gfxNearRain - ${NIGHT_FILL} * gfxNearNight - ${DAY_FILL} * gfxNearDay;
            irradiance *= mix( vec3( 1.0 ), vec3( 1.0, 1.0, 0.9 ), 0.6 * gfxNoon ); // (and by day the sky's light less blue: the greens hold)
            irradiance *= mix( vec3( 1.0 ), vec3( 0.9, 0.98, 1.12 ), gfxMorn );
            irradiance *= mix( vec3( 1.0 ), vec3( 0.96, 1.04, 0.78 ), gfxNearRain ); // (and less blue: the wet greens deep, not teal)
          #endif
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
  float gfxMirror = 0.0; // (the water itself, inside its damp, dark shore)
  // (not on water: it has its own sky, src/gfx/water.js)
  #ifndef GFX_WATER
  if ( uWet > 0.0 ) {
    float gfxUp = smoothstep( 0.35, 0.9, inverseTransformDirection( geometryNormal, viewMatrix ).y );
    float gfxK = uWet * ( 0.35 + 0.65 * gfxUp );
    #if defined( GFX_GRASS ) || defined( GFX_CARPET )
      gfxK *= 0.7; // (the grass: its blades less, and less of the sky's sheen on them, below)
    #endif
    vec3 gfxC = material.diffuseColor;
    float gfxL = dot( gfxC, vec3( 0.2126, 0.7152, 0.0722 ) );
    float gfxRich = 0.0;
    #if defined( USE_FOG ) && !defined( FOG_EXP2 )
      gfxRich = gfxRain() * ( 1.0 - smoothstep( 0.8, 2.0, vFogDepth / max( fogNear, 1e-3 ) ) ); // (the near field richer and darker while it falls)
    #endif
    material.diffuseColor = max( mix( vec3( gfxL ), gfxC, 1.0 + ( 0.3 + 0.5 * gfxRich ) * gfxK ), 0.0 ) * ( 1.0 - ( 0.28 + 0.1 * gfxRich ) * gfxK );
    gfxWetUp = uWet * gfxUp;
    #if defined( GFX_GRASS ) || defined( GFX_CARPET )
      gfxWetUp *= 0.4;
    #endif
    #ifdef GFX_PUDDLE
      gfxPuddle = groundPuddle * gfxWetUp;
      gfxMirror = smoothstep( 0.55, 1.0, groundPuddle ) * gfxWetUp;
      material.diffuseColor *= 1.0 - 0.65 * gfxPuddle;
    #endif
  }
  #endif
`;

// At a clear noon the near field's colors a little richer and deeper (gfxDay,
// src/gfx/atmos.js), back as they were by the far field, which lifts into the haze
const NOON_GLSL = /* glsl */ `
  #if defined( USE_FOG ) && !defined( FOG_EXP2 ) && !defined( GFX_WATER )
  {
    float gfxRichDay = gfxDay() * ( 1.0 - smoothstep( 0.7, 1.9, vFogDepth / max( fogNear, 1e-3 ) ) );
    #ifdef GFX_TREE
      gfxRichDay *= 0.4; // (the crowns' greens are rich already: deeper, not neon)
    #endif
    vec3 gfxC = material.diffuseColor;
    material.diffuseColor = max( mix( vec3( dot( gfxC, vec3( 0.2126, 0.7152, 0.0722 ) ) ), gfxC, 1.0 + ${DAY_RICH} * gfxRichDay ), 0.0 ) * ( 1.0 - 0.1 * gfxRichDay );
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
    // (little of it looking down on the near field, which stays dark and rich,
    // more toward the glancing far side; the puddles mirror it whatever the angle)
    // (from the wide camera's angle a puddle mirrors the sky a little above
    // the horizon, its pale band: lifted toward it, so the puddles read bright)
    gfxSky = mix( gfxSky, uSkyHorizon, 0.3 * gfxMirror );
    float gfxSheen = gfxWetUp * ( 0.025 + 0.45 * gfxF ) + gfxMirror * ( 0.32 + 0.35 * gfxF );
    #ifdef GFX_PUDDLE
      highp vec2 gfxDrop = vGfxWorld.xz * 1.2;
      gfxSheen += ( gfxMirror + 0.4 * gfxPuddle ) * uRain * 0.7 * gfxRipples( gfxDrop ) * gfxShow( 1.2, gfxFootprint( gfxDrop ) ); // (and a few on their damp shores)
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
  if (!opt.noCloud) define(shader, 'GFX_CANOPY');
  use(shader, LIGHT_UNIFORMS, 'f');
  let f = swap(shader.fragmentShader, 'lights_fragment_begin', own.lights_fragment_begin, 'GFX_LIGHT');
  const pars = PARS.find((name) => f.includes(`#include <${name}>`));
  f = swap(f, pars, `${DUSK_GLSL}\n${CLOUD_GLSL}\n${CANOPY_GLSL}\n${RIPPLE_GLSL}\n${WRAP_GLSL}\n${own[pars]}`, 'GFX_LIGHT');
  f = swap(f, 'lights_fragment_end', `${THREE.ShaderChunk.lights_fragment_end}\n${GREY_GLSL}\n${SHEEN_GLSL}`, 'GFX_LIGHT');
  shader.fragmentShader = f;
}
