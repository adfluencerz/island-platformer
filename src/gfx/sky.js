import * as THREE from 'three';
import { U } from './uniforms.js';

// ---------- The sky ----------
// A dome round whichever camera draws it (its vertex shader puts it there, so
// every seat of a split screen, the lobby and the title each have their own),
// drawn first and behind everything: from the day's zenith overhead down to
// its horizon, which is the fog's color, so the far land melts into it. A haze
// band along the horizon, the sun's disc and glow by day, the moon and stars at
// night, and two layers of clouds drifting with the wind (src/gfx/uniforms.js
// frame), more of them as the weather clouds over. Underground (a boss's
// dungeon) it is the dark all round. Not tone mapped: the fog isn't either.
//
// All of it comes from the shared uniforms (daynight.js sets them, the season
// tints them), so it has nothing of its own to update.

const RADIUS = 150; // (inside the camera's far plane, 200)

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uSunDir;
  uniform vec3 uSkyZenith;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyGlow;
  uniform float uNight;
  uniform float uUnder;
  uniform float uCloudAmount;
  uniform float uFlash;
  uniform vec2 uCloudOffset;
  uniform float uTime;
  varying vec3 vDir;

  // (hashes without sin, in highp: the same on every GPU and SwiftShader)
  highp float hash12(highp vec2 p) {
    highp vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  highp float hash13(highp vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(highp vec2 p) {
    highp vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(highp vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1;
      amp *= 0.5;
    }
    return sum / 0.97;
  }

  // a layer of cloud at p (on its plane), how much of the sky it covers:
  // its density and how lit it is from the sun's side
  vec2 clouds(highp vec2 p, vec2 toSun, float cover, float soft) {
    float n = fbm(p);
    float edge = 1.0 - cover;
    float d = smoothstep(edge - soft, edge + soft, n);
    float toward = fbm(p + toSun * 0.35); // (the cloud a little way toward the sun: thinner there, the side it lights)
    float lit = clamp(0.62 + (n - toward) * 3.0, 0.0, 1.0);
    return vec2(d, lit);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;
    vec3 col = uSkyHorizon;
    if (y > 0.0) {
      // zenith to horizon, the horizon's haze a band along the bottom
      float up = smoothstep(0.0, 0.14, y); // (what is in the sky fades out into the haze)
      col = mix(uSkyHorizon, uSkyZenith, pow(smoothstep(0.02, 0.75, y), 0.75));

      vec3 sunDir = normalize(uSunDir);
      float mu = dot(dir, sunDir);
      float sunW = 1.0 - smoothstep(0.02, 0.12, uNight); // (gone before it swaps sides with the moon at dusk)
      float moonW = smoothstep(0.7, 0.95, uNight);
      float clear = 1.0 - uCloudAmount;

      // the sun's glow, and the sky lit round it
      float m = max(mu, 0.0);
      col += uSkyGlow * (0.18 * pow(m, 4.0) + 0.35 * pow(m, 48.0)) * sunW * up * (0.4 + 0.6 * clear);

      // stars, twinkling (a few in each cell of a grid round the sky)
      highp vec3 cell = floor(dir * 110.0);
      float h = hash13(cell);
      vec3 inCell = fract(dir * 110.0) - 0.5;
      float star = step(0.982, h) * smoothstep(0.3, 0.0, length(inCell - (vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.3)) - 0.5) * 0.5));
      star *= 0.55 + 0.45 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
      col += vec3(0.85, 0.9, 1.0) * star * (0.35 + (h - 0.982) * 60.0) * moonW * up * clear;

      // the sun's disc, the moon's (a little mottled) and its pale glow
      float sunDisc = smoothstep(0.99935, 0.99965, mu);
      col = mix(col, uSkyGlow * 0.6 + vec3(0.55, 0.5, 0.45), sunDisc * sunW * up);
      float moonDisc = smoothstep(0.99955, 0.99975, mu);
      float mottle = 0.82 + 0.18 * noise(dir.xz * 900.0);
      col += uSkyGlow * 0.12 * pow(m, 64.0) * moonW * up;
      col = mix(col, vec3(0.86, 0.9, 1.0) * mottle, moonDisc * moonW * up);

      // two layers of cloud, drifting: low soft heaps and a thin high layer
      // above them, on planes over us (stretched toward the horizon)
      highp vec2 plane = dir.xz / (y + 0.12);
      vec2 toSun = normalize(sunDir.xz + vec2(1e-4));
      float cover = mix(0.38, 1.0, uCloudAmount);
      vec2 low = clouds(plane * 0.7 + uCloudOffset * 0.006, toSun, cover, 0.12);
      vec2 high = clouds(plane * vec2(0.35, 0.9) + uCloudOffset * 0.0035 + 31.0, toSun, cover * 0.75, 0.22);
      float fade = smoothstep(0.03, 0.3, y); // (thinning into the haze)

      float day = 1.0 - 0.9 * uNight;
      float grey = dot(uSkyHorizon, vec3(0.3, 0.59, 0.11));
      vec3 shade = mix(mix(uSkyHorizon, uSkyZenith, 0.35), vec3(grey), 0.4) * (0.9 + 0.3 * uCloudAmount) * (1.0 - 0.35 * uNight);
      vec3 bright = mix(vec3(1.0), uSkyGlow, 0.45) * day + uSkyHorizon * 0.25;
      bright = mix(bright, shade * 1.35, uCloudAmount * 0.6); // (rain clouds: grey all through)
      vec3 flash = vec3(0.75, 0.8, 1.0) * uFlash;

      vec3 highCol = mix(shade, bright, high.y * 0.6 + 0.4) + flash * 0.5;
      col = mix(col, highCol, high.x * 0.55 * fade);
      // (painterly: the lit side in two soft steps, not a smooth ramp)
      float lit = smoothstep(0.25, 0.45, low.y) * 0.6 + smoothstep(0.6, 0.8, low.y) * 0.4;
      vec3 lowCol = mix(shade, bright, lit) + flash;
      col = mix(col, lowCol, low.x * mix(0.92, 0.7, uNight) * fade); // (thinner at night: the stars between)

      // and lightning's flash in the sky (the horizon has it already)
      col += flash * 0.35 * up;
    }
    // underground: the dark all round (the horizon is the cave's color there)
    col = mix(col, uSkyHorizon, uUnder);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSky() {
  const material = new THREE.ShaderMaterial({
    name: 'sky',
    uniforms: {
      uSunDir: U.uSunDir,
      uSkyZenith: U.uSkyZenith,
      uSkyHorizon: U.uSkyHorizon,
      uSkyGlow: U.uSkyGlow,
      uNight: U.uNight,
      uUnder: U.uUnder,
      uCloudAmount: U.uCloudAmount,
      uFlash: U.uFlash,
      uCloudOffset: U.uCloudOffset,
      uTime: U.uTime,
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false, // (the fog it meets isn't)
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 16), material);
  mesh.name = 'sky';
  mesh.renderOrder = -1000; // (first, under everything)
  mesh.frustumCulled = false; // (it is wherever the camera is)
  mesh.raycast = () => {}; // (nothing picks the sky)
  mesh.matrixAutoUpdate = false;
  return mesh;
}
