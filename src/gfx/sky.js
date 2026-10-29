import * as THREE from 'three';
import { U } from './uniforms.js';
import { HORIZON_GLSL } from './atmos.js';

// ---------- The sky ----------
// A dome round whichever camera draws it (its vertex shader puts it there, so
// every seat of a split screen, the lobby and the title each have their own),
// drawn first and behind everything: from the day's zenith overhead down to
// its horizon, which is the fog's color (warmer toward a low sun, the same as
// the fog's that way: src/gfx/atmos.js), so the far land melts into it. Dawn's
// and dusk's colors in bands over it, the sun's disc, glow and warm halo by
// day; the moon with a soft halo, stars of many sizes and a faint Milky Way at
// night; and three layers of cloud drifting with the wind (src/gfx/uniforms.js
// frame), each at its own pace: wisps high up, a heaped bank along the
// horizon, and the low cumulus over the land (their shadows drift under them,
// src/gfx/light.js), lit on the sun's side and shaded underneath; more of
// them, lower and greyer, as the weather clouds over. Underground (a boss's
// dungeon) it is the dark all round. Not tone mapped: the fog isn't either.
// Birds cross it by day: src/gfx/birds.js.
//
// All of it comes from the shared uniforms (daynight.js sets them, the season
// tints them), so it has nothing of its own to update.

const RADIUS = 50; // (inside the camera's far plane, at least 60: src/main.js lookFrom; drawn first, without depth, so its size shows nowhere)

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
  uniform float uRain;
  uniform float uFlash;
  uniform vec2 uCloudOffset;
  uniform float uTime;
  varying vec3 vDir;
${HORIZON_GLSL}
  // (hashes without sin, in highp: the same on every GPU and SwiftShader; the
  // value noise is gfxNoise's, src/gfx/noise.js, so the clouds' shadows match)
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
  // (each octave turned and shifted the way gfxCloudShadow's second one is:
  // its two octaves are this one's first two)
  float fbm5(highp vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1;
      amp *= 0.5;
    }
    return sum / 0.97;
  }
  float fbm3(highp vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      sum += amp * noise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1;
      amp *= 0.5;
    }
    return sum / 0.875;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;
    vec3 horizon = gfxHorizon(dir); // (warmer toward a low sun: the fog's color that way, src/gfx/atmos.js)
    vec3 col = horizon;
    if (y > 0.0) {
      // zenith to horizon, the horizon's haze a band along the bottom (most of
      // the way to the zenith's color by 30 degrees up: the view from low down,
      // src/main.js, sees that much of the sky over the horizon)
      float up = smoothstep(0.0, 0.14, y); // (what is in the sky fades out into the haze)
      float lift = smoothstep(0.0, 0.03, y); // (and nothing at all on the horizon's line: the ground's far color meets it there)
      // (in the rain, by day, the sky dark and heavy overhead, low cloud
      // dragging its undersides, the horizon's band left pale)
      float rain = uRain * (1.0 - smoothstep(0.0, 0.25, uNight));
      col = mix(horizon, uSkyZenith * (1.0 - 0.3 * rain), pow(smoothstep(0.0, 0.5, y), 0.7 - 0.25 * rain));

      vec3 sunDir = normalize(uSunDir);
      float mu = dot(dir, sunDir);
      float m = max(mu, 0.0);
      float sunW = 1.0 - smoothstep(0.02, 0.12, uNight); // (gone before it swaps sides with the moon at dusk)
      float moonW = smoothstep(0.7, 0.95, uNight);
      float clear = 1.0 - uCloudAmount;
      vec2 flatDir = normalize(dir.xz + vec2(1e-5));
      vec2 toSun = normalize(sunDir.xz + vec2(1e-4));
      float face = dot(flatDir, toSun); // (the sun's side of the sky, 1, to the far side, -1)
      // (a low sun, by day, clear: dawn's and dusk's colors)
      float lowSun = (1.0 - smoothstep(0.12, 0.6, sunDir.y)) * sunW * clear * (1.0 - uUnder);

      // dusk's (and dawn's) colors in bands over the horizon: a warm band low
      // down, brightest toward the sun, and a rose one above it toward the
      // zenith's violet (the horizon itself left as gfxHorizon: the ground's far color)
      float warmBand = exp(-pow((y - 0.06) / 0.07, 2.0)) * (0.35 + 0.65 * max(face, 0.0));
      float roseBand = exp(-pow((y - 0.15) / 0.08, 2.0)) * (0.7 + 0.3 * abs(face));
      col = mix(col, uSkyGlow * vec3(1.0, 0.8, 0.6) + horizon * 0.3, 0.4 * warmBand * lowSun * lift);
      col = mix(col, mix(horizon, vec3(0.78, 0.44, 0.56), 0.6), 0.25 * roseBand * lowSun);

      // the sun's glow, the sky lit round it, and a warm halo
      col += uSkyGlow * (0.18 * pow(m, 4.0) + 0.35 * pow(m, 48.0)) * sunW * up * (0.4 + 0.6 * clear);
      col += uSkyGlow * vec3(1.0, 0.82, 0.6) * 0.22 * pow(m, 14.0) * sunW * up * clear;

      // the night: stars of many sizes, twinkling (a few in each cell of a
      // grid round the sky), more of them along a faint, mottled Milky Way
      float nightSky = moonW * up * clear;
      if (nightSky > 0.0) {
        vec3 mwN = normalize(vec3(0.8, 0.5, -0.15)); // (its band across the sky the camera looks at, slanting)
        float across = dot(dir, mwN);
        float band = exp(-across * across / 0.03);
        highp vec2 q = vec2(dot(dir, normalize(cross(mwN, vec3(0.0, 1.0, 0.0)))), dir.y) * 9.0;
        float mott = noise(q) * 0.65 + noise(q * 2.7 + 3.0) * 0.35;
        col += vec3(0.5, 0.56, 0.78) * 0.24 * band * (0.25 + 0.75 * smoothstep(0.3, 0.75, mott)) * nightSky;

        highp vec3 cell = floor(dir * 95.0);
        float h = hash13(cell);
        float th = 0.93 - 0.04 * band;
        vec3 inCell = fract(dir * 95.0) - 0.5;
        float star = step(th, h) * smoothstep(0.34, 0.0, length(inCell - (vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.3)) - 0.5) * 0.5));
        star *= 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
        float k = (h - th) / (1.0 - th);
        col += mix(vec3(1.0, 0.86, 0.72), vec3(0.8, 0.88, 1.0), fract(h * 37.0)) * star * (0.35 + 1.8 * k * k) * nightSky;
      }

      // the sun's disc, the moon's (a little mottled), its glow and a soft halo
      float sunDisc = smoothstep(0.99935, 0.99965, mu);
      col = mix(col, uSkyGlow * 0.6 + vec3(0.55, 0.5, 0.45), sunDisc * sunW * up);
      float moonDisc = smoothstep(0.99955, 0.99975, mu);
      float mottle = 0.82 + 0.18 * noise(dir.xz * 900.0);
      col += (uSkyGlow * 0.12 * pow(m, 64.0) + vec3(0.42, 0.5, 0.72) * (0.05 * pow(m, 10.0) + 0.12 * pow(m, 160.0))) * moonW * up * (0.5 + 0.5 * clear);
      col = mix(col, vec3(0.86, 0.9, 1.0) * mottle, moonDisc * moonW * up);

      // the clouds' colors: lit (white, warmed by the sun) and shaded (a cool
      // blue-grey of the sky's; at dawn and dusk the undersides catch the low
      // sun's warm color), greyer all through as it clouds over
      float day = 1.0 - 0.9 * uNight;
      float grey = dot(uSkyHorizon, vec3(0.3, 0.59, 0.11));
      vec3 shade = mix(mix(uSkyHorizon, uSkyZenith, 0.3), vec3(grey), 0.5) * (0.86 + 0.25 * uCloudAmount) * (1.0 - 0.35 * uNight);
      vec3 bright = mix(vec3(1.0), uSkyGlow, 0.4) * day + uSkyHorizon * 0.22;
      bright = mix(bright, shade * 1.35, uCloudAmount * 0.6); // (rain clouds: grey all through)
      shade = mix(shade, mix(uSkyZenith, uSkyGlow * vec3(1.0, 0.55, 0.6), 0.5) * 1.1, 0.65 * lowSun); // (violet-rose undersides against the gold)
      shade *= 1.0 - 0.48 * rain;
      bright *= 1.0 - 0.4 * rain;
      vec3 flash = vec3(0.75, 0.8, 1.0) * uFlash;

      // three layers of cloud, each drifting at its own pace: thin wisps high
      // up, a heaped bank along the horizon, and the low cumulus over us
      // (1) the wisps: stretched with the wind, slow, far
      highp vec2 wq = dir.xz / (y + 0.05);
      wq = vec2(dot(wq, vec2(0.8, 0.6)), dot(wq, vec2(-0.6, 0.8))) * vec2(0.22, 1.3) - uCloudOffset * 0.0025;
      float wisp = smoothstep(0.56, 0.8, fbm3(wq + 51.0)) * smoothstep(0.04, 0.14, y) * (1.0 - 0.8 * uCloudAmount);
      col = mix(col, mix(bright, horizon, 0.25) + flash * 0.5, wisp * 0.45 * mix(1.0, 0.5, uNight));

      // (2) the bank: heaps along the horizon, their tops lit, their feet
      // melting into the haze (taller and closed up as it clouds over)
      highp vec2 ring = flatDir * 2.6 - uCloudOffset * 0.0012;
      float bn = fbm3(ring + 13.0);
      float lumps = noise(flatDir * 15.0 + vec2(0.0, y * 40.0) - uCloudOffset * 0.004);
      float top = mix(0.012, 0.12, smoothstep(0.3, 0.72, bn)) * mix(1.0, 1.6, uCloudAmount) + 0.02 * lumps;
      float bankD = smoothstep(top + 0.006, top - 0.014, y);
      float bankLit = smoothstep(top - 0.06, top, y) * (0.6 + 0.4 * lumps);
      vec3 bankCol = mix(shade, bright, 0.2 + 0.8 * bankLit);
      bankCol = mix(bankCol, horizon, 0.2 + 0.7 * (1.0 - smoothstep(0.0, max(top, 0.02), y)));
      col = mix(col, bankCol + flash * 0.5, bankD * lift * 0.9);

      // (3) the cumulus: heaps standing on a layer over us, anchored to the
      // land (gfxCloudShadow's drift and noise, src/gfx/light.js: a cloud's
      // shadow drifts under it). The noise is each heap's height over the
      // layer, and the view's ray, rising slowly as it goes, is followed a few
      // steps on beyond the layer, front to back: where it meets a heap's foot
      // on the layer it sees the flat underside, shaded; further on, a heap's
      // flank or top, lit more the higher up (and from a low sun, on the side
      // toward it), so each heap stands up off the layer, lit above and shaded
      // underneath, its thin edges glowing where the sun is behind it. Lower,
      // closer and heavier in the rain.
      highp vec2 world = cameraPosition.xz + dir.xz / (y + 0.12) * mix(40.0, 26.0, rain);
      highp vec2 p = (world - uCloudOffset) * 0.018 + vec2(5.5, 19.5);
      float tanE = max(y / max(length(dir.xz), 1e-3), 0.04);
      float edge = mix(0.56, 0.14, uCloudAmount) + 0.06 * uNight * (1.0 - uCloudAmount); // (a clearer night: the stars)
      float sunLow = 1.0 - smoothstep(0.3, 0.8, sunDir.y);
      float facing = mix(0.8, max(0.0, -dot(toSun, flatDir)), sunLow); // (their sides toward us lit: a high sun, or a low one behind us)
      vec4 acc = vec4(0.0);
      for (int i = 0; i < 4; i++) {
        float rise = float(i) * 13.0; // (how far over the layer the ray has climbed, units)
        highp vec2 pi = p + flatDir * (rise / tanE) * 0.018;
        float ni = i == 0 ? fbm5(pi) : fbm3(pi);
        float a;
        vec3 c;
        if (i == 0) {
          a = smoothstep(-0.05, 0.1, ni - edge);
          float core = smoothstep(0.04, 0.3, ni - edge);
          c = mix(bright, shade, 0.5 + 0.4 * core); // (the underside: its thin rims a little lighter)
        } else {
          float hgt = (ni - edge) * 200.0;
          a = smoothstep(0.0, 10.0, hgt - rise);
          float high = clamp(rise / max(hgt, 1.0), 0.0, 1.0); // (how far up the heap: its top lit most)
          float lit = smoothstep(0.1, 0.45, high) * 0.55 + smoothstep(0.55, 0.85, high) * 0.45; // (painterly: two soft steps)
          c = mix(shade, bright, mix(0.3, 1.0, lit) * (0.5 + 0.5 * facing));
        }
        c += uSkyGlow * (1.0 - a) * pow(m, 5.0) * sunW * 0.6; // (the silver lining)
        acc.rgb += (1.0 - acc.a) * a * c;
        acc.a += (1.0 - acc.a) * a;
      }
      if (acc.a > 0.0) {
        vec3 c = acc.rgb / acc.a;
        c = mix(c, horizon, 0.6 * (1.0 - smoothstep(0.0, 0.16, y))); // (the far ones melting into the haze: depth)
        col = mix(col, c + flash, acc.a * mix(0.95, 0.7, uNight) * lift); // (thinner at night: the stars between)
      }

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
      uRain: U.uRain,
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
