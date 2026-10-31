import { patch, define } from './chunks.js';
import { use } from './uniforms.js';
import { hook } from './shading.js';
import { NOISE } from './noise.js';

// ---------- The look of water ----------
// waterLook(material, kind): the hook 'water:<kind>' on a lit material, for
// the sea, the shallows strip over it along the shore (src/world.js), and the
// still water of the lake and the ponds (src/maps.js, src/build.js). After
// the ripples (world.js addRipples), whose rocking normal it reads:
//   - a fresnel: the more grazing the view, the more the water mirrors the
//     sky (its horizon color in that direction, warm toward a low sun, as the
//     dome and the fog have it: src/gfx/atmos.js gfxHorizon, toward the
//     zenith as the reflection looks higher). Mixed in after tone mapping,
//     like the dome, so the far sea meets the sky;
//   - sun glitter: a tight highlight (pow 180) on a finer shimmer of the
//     ripples, cut into sparkles by noise that drifts and twinkles, and on
//     little wave facets that catch the sun from any side, added
//     on top of the tone-mapped color, so its brightest sparkles pass the
//     bloom's threshold (src/gfx/post.js) and glow, without a white smear;
//     and a scatter of broad flashes on the swells' crests, big enough to
//     read from the play camera;
//   - the broad swells' shade (rippleWave), kept over the mirror;
//   - (the ponds' and the lake's, whose geometry knows how near the bank
//     each corner is: gfxBank) by the bank less mirror, and a dark wet band
//     where the water meets it;
//   - in the rain (uRain), drops ringing on it (gfxRipples, src/gfx/light.js);
//   - a slow mottle in the color (the sea's, deeper and lighter patches,
//     the lighter greener), or (the shallows') a nearly solid turquoise band
//     by the shore with the sandy floor in ripples showing through, and a
//     fainter, patchy shelf beyond it, its edge soft and broken.
// The sea stays opaque; translucent water grows a little more solid where
// it mirrors the sky. Cheap enough for every tier.

// Per kind: fresnel (how much sky at grazing), glint (sparkle strength),
// solid (how far the fresnel makes translucent water opaque), dusk (how much
// more of the sky it mirrors round a low sun, looking down on it: a golden
// hour's peach and mauve in the still water), shade (how much the broad
// swells light their crests and darken their troughs over the mirror)
export const WATER = {
  sea: { fresnel: 0.9, glint: 1.0, solid: 0, dusk: 0.15, shade: 0.12 },
  shallows: { fresnel: 0.7, glint: 0.8, solid: 0, dusk: 0, shade: 0.08 },
  // (bank: its geometry says how near the bank each corner is, gfxBank)
  pond: { fresnel: 0.85, glint: 0.9, solid: 0.5, dusk: 0.15, shade: 0.06, bank: true },
};

const f = (v) => v.toFixed(3);

const COLOR = {
  // big, slow patches of deeper and lighter water, a finer drift of them
  // over it, the lighter ones a little greener (the shallows' shelf, out from
  // the shore, lies over it: world.js)
  sea: `
    highp vec2 waterSeaP = vGfxWorld.xz;
    float waterPatch = gfxNoise(waterSeaP * 0.07 + vec2(uTime * 0.012, 0.0)) * 0.6
      + mix(0.5, gfxNoise(waterSeaP * 0.21 - vec2(0.0, uTime * 0.02) + 5.0), gfxShow(0.21, gfxFootprint(waterSeaP))) * 0.4;
    diffuseColor.rgb *= mix(vec3(0.74, 0.82, 0.96), vec3(1.05, 1.2, 1.08), smoothstep(0.25, 0.75, waterPatch));`,
  // vertex alpha: 1 at the shore, 0 out at sea (world.js shoreStrip). A
  // turquoise band by the shore, nearly solid, the sandy floor showing
  // through it in ripples; further out a fainter, patchy, paler shelf, its
  // edge soft and broken, fading into the sea.
  shallows: `
    float waterShore = vColor.a;
    highp vec2 waterSandP = vGfxWorld.xz;
    float waterSandPx = gfxFootprint(waterSandP);
    float waterEdge = waterShore + (gfxNoise(waterSandP * 0.9) - 0.5) * 0.25 * gfxShow(0.9, waterSandPx) + (gfxNoise(waterSandP * 0.23 + 9.0) - 0.5) * 0.3;
    diffuseColor.a = opacity * (0.4 * smoothstep(0.0, 0.2, waterEdge) + 0.6 * smoothstep(0.18, 0.45, waterEdge));
    // (clearer right by the waterline, where the beach's own slope shows
    // through: src/world.js; the band's hue wandering along the shore, here
    // greener and sandier, there bluer, not one even ribbon)
    float waterAlong = gfxNoise(waterSandP * 0.09 + 31.0);
    diffuseColor.a *= 1.0 - 0.5 * smoothstep(0.78, 1.0, waterShore + (gfxNoise(waterSandP * 0.7 + 4.0) - 0.5) * 0.12);
    diffuseColor.rgb *= mix(vec3(0.55, 0.8, 1.0), vec3(1.0), smoothstep(0.15, 0.55, waterShore));
    diffuseColor.rgb *= mix(mix(vec3(0.8, 0.95, 1.12), vec3(1.12, 0.98, 0.8), waterAlong), vec3(1.0), 0.35 + 0.35 * (1.0 - waterShore));
    diffuseColor.rgb *= 0.92 + 0.16 * gfxNoise(waterSandP * 0.35 + vec2(uTime * 0.03, 3.0));
    // the sandy floor showing through toward the shore, in ripples across the
    // wind (as the beach's: src/gfx/ground.js), and a light caustic net
    // drifting on it: the turquoise lighter over the crests, a touch sandy
    float waterRf = fract(dot(waterSandP, vec2(0.92, 0.38)) * 2.2 + gfxNoise(waterSandP * 0.45 + 2.0) * 1.6);
    float waterRipple = smoothstep(0.0, 0.7, waterRf) * (1.0 - smoothstep(0.7, 1.0, waterRf));
    float waterFloor = mix(0.5, waterRipple, gfxShow(2.2, waterSandPx * 0.5));
    float waterSand = smoothstep(0.3, 0.9, waterShore);
    float waterNet = smoothstep(0.62, 0.8, gfxNoise(waterSandP * 1.6 + vec2(uTime * 0.25, -uTime * 0.18)) + gfxNoise(waterSandP * 1.9 - vec2(uTime * 0.2, uTime * 0.23)) * 0.4) * gfxShow(1.9, waterSandPx * 0.5);
    diffuseColor.rgb *= 1.0 + waterSand * (0.8 * waterFloor - 0.25 + 0.3 * waterNet);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.78, 0.5), waterSand * (0.14 + 0.24 * waterFloor));`,
  pond: `diffuseColor.rgb *= 0.94 + 0.12 * gfxNoise(vGfxWorld.xz * 0.35);`,
};

const SURFACE = ({ fresnel, glint, solid, dusk, shade }) => `
  {
    vec3 waterN = normalize((vec4(normal, 0.0) * viewMatrix).xyz); // (view to world)
    vec3 waterV = normalize(cameraPosition - vGfxWorld);
    float waterNV = clamp(dot(waterN, waterV), 0.0, 1.0);
    // round a low sun (not at night, nor under rain clouds): more mirror, and the warm low sky in it
    float waterLow = (1.0 - smoothstep(0.12, 0.6, uSunDir.y)) * (1.0 - smoothstep(0.02, 0.3, uNight)) * (1.0 - uCloudAmount);
    float waterF = ${f(fresnel)} * (0.16 + ${f(dusk)} * waterLow + 0.84 * pow(1.0 - waterNV, 3.0));
    vec3 waterR = reflect(-waterV, waterN);
    #ifdef GFX_ATMOS
      vec3 waterSky = gfxHorizon(waterR);
    #else
      vec3 waterSky = uSkyHorizon;
    #endif
    waterSky = mix(waterSky, uSkyZenith, smoothstep(0.05, 0.8, waterR.y) * (1.0 - 0.4 * waterLow));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(waterSky, 1.0)).rgb, waterF);
    gl_FragColor.a = mix(gl_FragColor.a, 1.0, waterF * ${f(solid)});
    // the broad swells' shade, kept over the mirror: crests lighter, troughs darker
    #ifdef GFX_RIPPLES
      float waterWave = rippleWave;
    #else
      float waterWave = 0.0;
    #endif
    gl_FragColor.rgb *= 1.0 + ${f(shade)} * waterWave;
    #ifdef GFX_WATER_BANK
      // by the bank (vWaterBank: 1 there, 0 a metre and a half out, its edge
      // wavering): the shallows mirror less, so the water's own color and
      // its floor show, and a dark wet band where it meets the bank
      float waterBank = clamp(vWaterBank + (gfxNoise(vGfxWorld.xz * 1.3) - 0.5) * 0.25, 0.0, 1.0);
      gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.84, 0.78), smoothstep(0.15, 0.75, waterBank));
      float waterWet = smoothstep(0.62, 0.93, waterBank);
      gl_FragColor.rgb *= 1.0 - 0.48 * waterWet;
      gl_FragColor.a = max(gl_FragColor.a, 0.92 * waterWet);
    #endif

    // the glitter, on two scales, both a tight highlight (pow 180) of the sun:
    // the sun's own path, on a finer shimmer than the ripples, cut into
    // sparkles; and little facets of the waves, each tilted its own way and
    // dealt anew as they fade, so a few catch the sun from any side (this
    // game's camera has the sun behind it). Faded to their average where a
    // pixel covers too much water to show them: no shimmer far out.
    highp vec2 waterP = vGfxWorld.xz;
    float waterPx = gfxFootprint(waterP);
    vec3 waterL = normalize(uSunDir);
    vec3 waterH = normalize(waterL + waterV);
    float waterA = gfxNoise(waterP * 2.2 + vec2(uTime * 0.31, uTime * 0.17));
    float waterB = gfxNoise(waterP * 2.9 - vec2(uTime * 0.23, -uTime * 0.29) + 17.0);
    vec3 waterGN = normalize(waterN + vec3(waterA - 0.5, 0.0, waterB - 0.5) * 0.16);
    float waterC = gfxNoise(waterP * 6.0 + vec2(-uTime * 0.6, uTime * 0.45));
    float waterSparkle = mix(0.3, smoothstep(0.42, 0.62, waterA * waterB + waterC * 0.35), gfxShow(6.0, waterPx));
    float waterSpec = pow(max(dot(waterGN, waterH), 0.0), 180.0) * waterSparkle;

    highp vec2 waterCellP = waterP * WATER_FACETS;
    highp vec2 waterCell = floor(waterCellP);
    float waterLife = uTime * 1.3 + gfxHash(waterCell) * 9.0;
    float waterAge = fract(waterLife);
    highp vec2 waterDeal = waterCell + mod(floor(waterLife), 61.0) * vec2(7.31, 3.17);
    vec2 waterTilt = (gfxHash2(waterDeal) - 0.5) * WATER_TILT;
    vec3 waterFN = normalize(waterN + vec3(waterTilt.x, 0.0, waterTilt.y));
    vec2 waterAt = waterCellP - waterCell - 0.5 - (gfxHash2(waterDeal + 5.3) - 0.5) * 0.5;
    float waterDot = 1.0 - smoothstep(0.1, 0.34, length(waterAt));
    float waterFacet = pow(max(dot(waterFN, waterH), 0.0), 180.0) * waterDot * 4.0 * waterAge * (1.0 - waterAge);
    waterSpec += waterFacet * gfxShow(WATER_FACETS, waterPx);

    // and a scatter of broad flashes on the crests, a few pixels across from
    // the play camera: one cell in a few lit at a time, dealt anew as it fades
    highp vec2 waterBigP = waterP * WATER_BIG;
    highp vec2 waterBigCell = floor(waterBigP);
    float waterBigLife = uTime * 0.8 + gfxHash(waterBigCell + 3.7) * 7.0;
    float waterBigAge = fract(waterBigLife);
    highp vec2 waterBigDeal = waterBigCell + mod(floor(waterBigLife), 61.0) * vec2(5.17, 9.31);
    vec2 waterBigAt = waterBigP - waterBigCell - 0.5 - (gfxHash2(waterBigDeal) - 0.5) * 0.5;
    float waterBigDot = 1.0 - smoothstep(0.03, 0.2, length(waterBigAt * vec2(1.0, 1.6)));
    float waterBigOn = step(0.75, gfxHash(waterBigDeal + 11.0)) * smoothstep(-0.3, 0.6, waterWave);
    float waterBigLobe = 0.35 + 0.65 * smoothstep(0.55, 1.0, dot(waterN, waterH));
    waterSpec += waterBigDot * waterBigOn * waterBigLobe * 4.0 * waterBigAge * (1.0 - waterBigAge) * 1.1 * gfxShow(WATER_BIG, waterPx);

    float waterUp = smoothstep(0.0, 0.06, waterL.y) * (1.0 - 0.85 * uCloudAmount) * (1.0 - 0.6 * uNight) * (1.0 + 0.6 * waterLow);
    vec3 waterGlint = uSunColor * (waterSpec * waterUp * ${f(glint * 2.4)});
    gl_FragColor.rgb += min(waterGlint, vec3(1.6));
    // drops ringing on it while it rains (src/gfx/light.js gfxRipples)
    if (uRain > 0.0) {
      highp vec2 waterDrop = waterP * 1.3;
      float waterRing = gfxRipples(waterDrop) * gfxShow(1.3, gfxFootprint(waterDrop));
      gl_FragColor.rgb += linearToOutputTexel(vec4(mix(uSkyHorizon, vec3(1.0), 0.3), 1.0)).rgb * waterRing * uRain * 0.35;
    }
    gl_FragColor.a = max(gl_FragColor.a, min(dot(waterGlint, vec3(0.33)), 1.0));
  }`;

const UNIFORMS = ['uTime', 'uSunDir', 'uSunColor', 'uSkyHorizon', 'uSkyZenith', 'uSkyGlow', 'uNight', 'uUnder', 'uCloudAmount', 'uRain'];

export function waterLook(material, kind) {
  const look = WATER[kind];
  if (!look) throw new Error(`gfx: no water ${kind}`);
  return hook(material, `water:${kind}`, (shader) => {
    define(shader, 'GFX_WORLD');
    define(shader, 'GFX_WATER');
    use(shader, UNIFORMS, 'f');
    shader.fragmentShader = patch(shader.fragmentShader, 'common', `${NOISE}
#define WATER_FACETS 6.0
#define WATER_TILT 3.0
#define WATER_BIG 1.3`, 'GFX_WATER');
    if (look.bank) {
      define(shader, 'GFX_WATER_BANK');
      shader.vertexShader = patch(shader.vertexShader, 'common', 'attribute float gfxBank;\nvarying float vWaterBank;', 'GFX_WATER_BANK');
      shader.vertexShader = patch(shader.vertexShader, 'begin_vertex', 'vWaterBank = gfxBank;', 'GFX_WATER_BANK');
      shader.fragmentShader = patch(shader.fragmentShader, 'common', 'varying float vWaterBank;', 'GFX_WATER_BANK');
    }
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', COLOR[kind], 'GFX_WATER');
    shader.fragmentShader = patch(shader.fragmentShader, 'colorspace_fragment', SURFACE(look), 'GFX_WATER');
  });
}
