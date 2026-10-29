import { patch, swap, define } from './chunks.js';
import { use } from './uniforms.js';

// ---------- The air between us and the far land ----------
// Every lit material's fog (a base hook, src/gfx/shading.js; a material opts
// out with userData.gfx.noAtmos): three's linear fog as it was (lookFrom's
// near and far for each seat, and the dungeon's close dark, src/main.js), and
// on top of it, out in the open, a soft aerial haze that starts nearer, so
// the far side of the view already pales toward the sky, and a low haze that
// lies over the sea and thins going up (uFogHeight), thicker and nearer in
// the morning's mist (uMist). Its color is the sky's
// at the horizon in that direction: the day's horizon, warmer toward a low
// sun, the same as the sky dome's there (src/gfx/sky.js), so the far land
// melts into the sky. Not tone mapped, like three's fog and the dome.
// Unlit things (name tags, signs, glow sprites) keep three's plain fog.

// GLSL: the sky's color at the horizon looking along dir (world space,
// linear): the day's, tinted toward the sun's light round a low sun
export const HORIZON_GLSL = /* glsl */ `
  vec3 gfxHorizon(vec3 dir) {
    vec2 flatDir = dir.xz;
    vec2 sunFlat = uSunDir.xz;
    float face = dot(flatDir, sunFlat) / max(length(flatDir) * length(sunFlat), 1e-4);
    float low = 1.0 - smoothstep(0.12, 0.6, uSunDir.y); // (sunrise and sunset)
    float day = 1.0 - smoothstep(0.02, 0.12, uNight); // (as the sun's disc in the sky)
    float w = pow(max(face, 0.0), 3.0) * low * day * (1.0 - uUnder) * (1.0 - 0.75 * uCloudAmount);
    // (at night the horizon toward the moon paler, a silver-blue: the far land lifts into it)
    float moon = (0.35 + 0.65 * max(face, 0.0) * max(face, 0.0)) * smoothstep(0.5, 1.0, uNight) * (1.0 - uUnder) * (1.0 - 0.8 * uCloudAmount);
    return mix(uSkyHorizon, uSkyGlow, 0.4 * w) * (1.0 + vec3(0.25, 0.4, 0.55) * moon);
  }
`;

// GLSL: how much of a dusk it is, 0 to 1 (and of a misty morning: gfxMorning; rain, night, a clear noon: gfxRain, gfxNight, gfxDay): a low sun in the west (not the
// morning's, in the east), by day, out in the open, not overcast. What only
// a dusk changes (the near field's sky fill, src/gfx/light.js; the haze ramped
// by distance, below; the sun's glow on grass tips and crown edges,
// src/world.js) leaves the morning, noon, night and rain as they were.
// Needs uSunDir, uNight, uCloudAmount, uUnder.
export const DUSK_GLSL = /* glsl */ `
#ifndef GFX_DUSK_FN
#define GFX_DUSK_FN
  float gfxDusk() {
    return (1.0 - smoothstep(0.12, 0.6, uSunDir.y)) * smoothstep(0.1, 0.5, -uSunDir.x)
      * (1.0 - smoothstep(0.0, 0.25, uNight)) * (1.0 - uCloudAmount) * (1.0 - uUnder);
  }
  // (and the morning's, beside it: the mist (uMist) with the sun in the east,
  // by day, out in the open, not overcast: the mist held back to the middle
  // distance, a clear, cool foreground, dew catching the light; 0 after mid-morning)
  float gfxMorning() {
    return uMist * smoothstep(0.1, 0.5, uSunDir.x)
      * (1.0 - smoothstep(0.0, 0.25, uNight)) * (1.0 - uCloudAmount) * (1.0 - uUnder);
  }
  // (and the rain's: how hard it falls now (uRain), by day, out in the open:
  // the grey held back to the middle distance and the far field, a dark,
  // wet, rich foreground; 0 when dry, so the wet ground drying keeps its look)
  float gfxRain() {
    return uRain * (1.0 - smoothstep(0.0, 0.25, uNight)) * (1.0 - uUnder);
  }
  // (and the night's: a clear night out in the open, moonlit: the sky's fill
  // held back near the camera, a dark, rich near field, the haze held back to
  // the middle distance and lifting the far field into the horizon's blue;
  // 0 by day, in the rain and underground)
  float gfxNight() {
    return smoothstep(0.5, 1.0, uNight) * (1.0 - uCloudAmount) * (1.0 - uUnder);
  }
  // (and the day's: a high sun, out in the open, not overcast: the sky's
  // flat fill held back near the camera, a rich, saturated near field, the
  // haze held back to the middle distance and lifting the far field into a
  // pale blue-green; 0 at 8:00 and 18:30 (the sun below about 33 degrees),
  // in the rain, at night and underground)
  float gfxDay() {
    return smoothstep(0.55, 0.8, uSunDir.y) * (1.0 - smoothstep(0.0, 0.25, uNight)) * (1.0 - uCloudAmount) * (1.0 - uUnder);
  }
#endif
`;
export const DUSK_UNIFORMS = ['uSunDir', 'uNight', 'uCloudAmount', 'uUnder', 'uMist', 'uRain'];

export const ATMOS_UNIFORMS = ['uSkyHorizon', 'uSkyGlow', 'uSunDir', 'uNight', 'uUnder', 'uCloudAmount'];

const FOG_GLSL = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth ); // (three's, as it was)
    vec3 gfxView = vGfxWorld - cameraPosition;
    float gfxS = vFogDepth / max(fogNear, 1e-3); // (how far, in fog-nears: zoom and the cave's fog scale it)
    float gfxLow = 1.0 - smoothstep(0.12, 0.6, uSunDir.y);
    float gfxCave = smoothstep(0.0, 0.6, uUnder); // (well down in a dungeon: three's close dark fog alone)
    float gfxOpen = (1.0 - gfxCave) * (1.0 - 0.4 * uNight);
    // the air: the far side of the view pales a little, more round a low sun or in rain
    // (at dusk the haze starts further out and goes paler and more gold
    // toward the horizon: the near field clear and rich, the far one pale)
    // (in the morning the mist the same: held back to the middle distance and
    // the far field, a little thicker there, the foreground clear)
    // (in the rain the grey the same: the near field dark and wet, the veil
    // growing with distance, thicker and greyer far off)
    float gfxDk = gfxDusk();
    float gfxMn = gfxMorning();
    float gfxRn = gfxRain();
    float gfxNt = gfxNight();
    // (at night the same: the near field clear and dark, the far one lifting into the horizon's blue)
    // (and at noon: the near field clear and rich, the far one lifting into a pale blue-green)
    float gfxDy = gfxDay();
    float gfxAir = (0.24 + 0.12 * gfxLow + 0.15 * uCloudAmount + 0.04 * uMist + 0.1 * gfxDk + 0.06 * gfxMn + 0.15 * gfxRn + 0.7 * gfxNt + 0.14 * gfxDy) * smoothstep(0.4 - 0.1 * uMist + 0.5 * gfxDk + 0.5 * gfxMn + 0.35 * gfxRn + 0.15 * gfxNt + 0.45 * gfxDy, 1.35 + 0.2 * gfxDk + 0.1 * gfxMn - 0.05 * gfxRn + 0.1 * gfxNt + 0.1 * gfxDy, gfxS);
    // the low haze over the sea, thinning going up; in the morning's mist
    // thicker, nearer and lying higher
    float gfxAbove = max(vGfxWorld.y - uFogHeight.x, 0.0);
    float gfxHaze = (0.38 + 0.2 * gfxLow + 0.16 * uMist + 0.1 * gfxMn + 0.12 * gfxRn) * exp(-gfxAbove * uFogHeight.y * (1.0 - 0.3 * uMist - 0.3 * gfxRn))
      * smoothstep(0.3 - 0.1 * uMist + 0.5 * gfxDk + 0.45 * gfxMn + 0.35 * gfxRn + 0.45 * gfxNt + 0.45 * gfxDy, 1.2 - 0.25 * uMist + 0.25 * gfxDk + 0.3 * gfxMn + 0.05 * gfxRn + 0.25 * gfxNt + 0.2 * gfxDy, gfxS);
    float gfxFog = 1.0 - (1.0 - fogFactor) * (1.0 - gfxAir * gfxOpen) * (1.0 - gfxHaze * gfxOpen);
    vec3 gfxSky = gfxHorizon(normalize(gfxView));
    // (the mist pale and cool; toward the sun its warmth still burns through: gfxHorizon)
    gfxSky = mix(gfxSky, dot(gfxSky, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.94, 1.0, 1.1) * 1.06, 0.25 * uMist);
    // (at dusk the far land pale gold, not the horizon's orange laid over the green)
    gfxSky = mix(gfxSky, dot(gfxSky, vec3(0.2126, 0.7152, 0.0722)) * vec3(1.3, 1.08, 0.72), 0.45 * gfxDk);
    // (in the rain a cool blue-grey, not the grey-green of the land under it)
    gfxSky = mix(gfxSky, dot(gfxSky, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.9, 0.98, 1.12), 0.4 * gfxRn);
    // (at noon a pale blue-green, not the sky's blue bleaching the far grass)
    gfxSky = mix(gfxSky, dot(gfxSky, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.92, 1.06, 1.0) * 1.1, 0.4 * gfxDy);
    vec3 gfxColor = linearToOutputTexel(vec4(gfxSky, 1.0)).rgb;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(gfxColor, fogColor, gfxCave), gfxFog);
  #endif
#endif`;

// The base hook (lit materials)
export function atmos(shader, renderer, material) {
  if (material?.userData?.gfx?.noAtmos) return;
  define(shader, 'GFX_WORLD');
  define(shader, 'GFX_ATMOS');
  use(shader, [...ATMOS_UNIFORMS, ...DUSK_UNIFORMS, 'uFogHeight'], 'f');
  shader.fragmentShader = patch(shader.fragmentShader, 'fog_pars_fragment', HORIZON_GLSL + DUSK_GLSL, 'GFX_ATMOS');
  shader.fragmentShader = swap(shader.fragmentShader, 'fog_fragment', FOG_GLSL, 'GFX_ATMOS');
}
