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
//   - a slow mottle in the color (the sea's), or (the shallows') a soft,
//     broken edge out at sea, turquoise deepening away from the shore, and
//     toward the shore the sandy floor in ripples showing through.
// The sea stays opaque; translucent water grows a little more solid where
// it mirrors the sky. Cheap enough for every tier.

// Per kind: fresnel (how much sky at grazing), glint (sparkle strength),
// solid (how far the fresnel makes translucent water opaque)
export const WATER = {
  sea: { fresnel: 0.9, glint: 1.0, solid: 0 },
  shallows: { fresnel: 0.7, glint: 0.8, solid: 0 },
  pond: { fresnel: 0.85, glint: 0.9, solid: 0.5 },
};

const f = (v) => v.toFixed(3);

const COLOR = {
  // big, slow patches of lighter and deeper water
  sea: `diffuseColor.rgb *= 0.9 + 0.2 * gfxNoise(vGfxWorld.xz * 0.05 + vec2(uTime * 0.012, 0.0));`,
  // vertex alpha: 1 at the shore, 0 out at sea (world.js shoreStrip). A
  // softer, broken outer edge, deeper turquoise away from the shore.
  shallows: `
    float waterShore = vColor.a;
    float waterEdge = waterShore + (gfxNoise(vGfxWorld.xz * 0.9) - 0.5) * 0.45;
    diffuseColor.a = opacity * smoothstep(0.0, 0.7, waterEdge);
    diffuseColor.rgb *= mix(vec3(0.62, 0.86, 0.95), vec3(1.06), smoothstep(0.2, 1.0, waterShore));
    // the sandy floor showing through toward the shore, in ripples across the
    // wind (as the beach's: src/gfx/ground.js), and a light caustic net drifting on it
    highp vec2 waterSandP = vGfxWorld.xz;
    float waterSandPx = gfxFootprint(waterSandP);
    float waterRf = fract(dot(waterSandP, vec2(0.92, 0.38)) * 2.2 + gfxNoise(waterSandP * 0.45 + 2.0) * 1.6);
    float waterRipple = smoothstep(0.0, 0.75, waterRf) * (1.0 - smoothstep(0.75, 1.0, waterRf));
    float waterSand = smoothstep(0.25, 0.95, waterShore) * (0.45 + 0.55 * mix(0.5, waterRipple, gfxShow(2.2, waterSandPx * 0.5)));
    float waterNet = smoothstep(0.62, 0.8, gfxNoise(waterSandP * 1.6 + vec2(uTime * 0.25, -uTime * 0.18)) + gfxNoise(waterSandP * 1.9 - vec2(uTime * 0.2, uTime * 0.23)) * 0.4) * gfxShow(1.9, waterSandPx * 0.5);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.8, 0.56) * (1.0 + 0.25 * waterNet), waterSand * 0.55);`,
  pond: `diffuseColor.rgb *= 0.94 + 0.12 * gfxNoise(vGfxWorld.xz * 0.35);`,
};

const SURFACE = ({ fresnel, glint, solid }) => `
  {
    vec3 waterN = normalize((vec4(normal, 0.0) * viewMatrix).xyz); // (view to world)
    vec3 waterV = normalize(cameraPosition - vGfxWorld);
    float waterNV = clamp(dot(waterN, waterV), 0.0, 1.0);
    float waterF = ${f(fresnel)} * (0.16 + 0.84 * pow(1.0 - waterNV, 3.0));
    vec3 waterR = reflect(-waterV, waterN);
    #ifdef GFX_ATMOS
      vec3 waterSky = gfxHorizon(waterR);
    #else
      vec3 waterSky = uSkyHorizon;
    #endif
    waterSky = mix(waterSky, uSkyZenith, smoothstep(0.05, 0.8, waterR.y));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(waterSky, 1.0)).rgb, waterF);
    gl_FragColor.a = mix(gl_FragColor.a, 1.0, waterF * ${f(solid)});

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

    float waterUp = smoothstep(0.0, 0.06, waterL.y) * (1.0 - 0.85 * uCloudAmount) * (1.0 - 0.6 * uNight);
    vec3 waterGlint = uSunColor * (waterSpec * waterUp * ${f(glint * 2.4)});
    gl_FragColor.rgb += min(waterGlint, vec3(1.6));
    gl_FragColor.a = max(gl_FragColor.a, min(dot(waterGlint, vec3(0.33)), 1.0));
  }`;

const UNIFORMS = ['uTime', 'uSunDir', 'uSunColor', 'uSkyHorizon', 'uSkyZenith', 'uSkyGlow', 'uNight', 'uUnder', 'uCloudAmount'];

export function waterLook(material, kind) {
  const look = WATER[kind];
  if (!look) throw new Error(`gfx: no water ${kind}`);
  return hook(material, `water:${kind}`, (shader) => {
    define(shader, 'GFX_WORLD');
    define(shader, 'GFX_WATER');
    use(shader, UNIFORMS, 'f');
    shader.fragmentShader = patch(shader.fragmentShader, 'common', `${NOISE}
#define WATER_FACETS 6.0
#define WATER_TILT 3.0`, 'GFX_WATER');
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', COLOR[kind], 'GFX_WATER');
    shader.fragmentShader = patch(shader.fragmentShader, 'colorspace_fragment', SURFACE(look), 'GFX_WATER');
  });
}
