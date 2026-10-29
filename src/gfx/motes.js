import * as THREE from 'three';
import { U } from './uniforms.js';
import { hook } from './shading.js';

// ---------- Motes: pollen and dust in the sunlight, leaves and seeds in the air ----------
// A few warm specks drifting round the player by day (the fireflies' pattern,
// src/daynight.js: a box that follows the player, wrapping, positions moved on
// the CPU, no depth write). They ride the wind (uWind, plus a breeze), bob,
// and catch the light now and then; they fade with the night, the clouds and
// the rain, and underground. How many: the tier's particle knob.
// On the high tier a few leaves, petals and seeds tumble through the air too,
// between the player and the camera (uCamPos), bigger and slower, falling: in
// the same points (one draw call), each point's own size and shape, a leaf an
// oval turning as it tumbles, lit by the day's light. The pollen glows (its
// color added, alpha 0), a leaf covers what is behind it (premultiplied alpha
// 1): one blend does both.
//
//   createMotes(max)        -> { points, update(t, dt, focus, sun), setParticles(n), dispose() }
//     sun                   how much sunlight there is for them, 0 to 1
//     setParticles(n)       the tier's `particles` (src/gfx/quality.js): MOTES.count at 900

export const MOTES = {
  count: 160, // (at the high tier's 900 particles; fewer on the others)
  area: 24, // the box's width, round the player...
  low: -0.6, // ...and from this far under their feet...
  high: 4.4, // ...to this high over them
  size: 0.13,
  color: new THREE.Color(1.0, 0.93, 0.74), // warm white
  bright: 0.6, // (not tone mapped: added to the screen as it is, under the day's bloom threshold)
  breeze: new THREE.Vector2(0.22, 0.09), // (units a second, when there's no storm)
  wind: 0.35, // how much of a storm's wind carries them
};

// The leaves, petals and seeds: how many (on the high tier only), how big
// (times the motes' size), how fast they fall, and their colors
export const LEAVES = {
  count: 22,
  area: 12, // their box's width, round a point between the player and the camera...
  toCamera: 0.55, // ...this far of the way to the camera
  low: 0,
  high: 6,
  size: [2.2, 3.4],
  fall: [0.25, 0.55], // (units a second)
  colors: [0x7fb247, 0xa9c95a, 0xf2a7c3, 0xfff3e0, 0xe0b04a].map((c) => new THREE.Color(c)), // green, yellow-green, a petal, a seed's fluff, a dry leaf
};

const vertexPars = /* glsl */ `
attribute vec3 aLeaf; // its size (times the material's), turn (radians), how flat it is seen (0 to 1)
varying vec3 vLeaf;
`;
const fragmentShape = /* glsl */ `
  {
    vec2 c = gl_PointCoord - 0.5;
    if (vLeaf.x < 1.5) {
      // pollen: a soft round speck, its color added (alpha 0)
      float r = length(c) * 2.0;
      float s = clamp(1.0 - r, 0.0, 1.0);
      diffuseColor = vec4(vec3(s * s * (0.5 + 0.5 * s)), 0.0);
    } else {
      // a leaf, petal or seed: an oval, turned, narrower as it tumbles edge-on,
      // a little darker down its middle
      float ca = cos(vLeaf.y);
      float sa = sin(vLeaf.y);
      vec2 q = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y);
      q.y /= max(vLeaf.z, 0.15);
      float e = length(q * vec2(4.6, 2.3));
      float s = 1.0 - smoothstep(0.75, 1.0, e);
      if (s <= 0.0) discard;
      diffuseColor = vec4(vec3(s * (0.8 + 0.2 * smoothstep(0.0, 0.08, abs(q.y)))), s);
    }
  }
`;

export function createMotes(max = MOTES.count) {
  const { area, low, high } = MOTES;
  const tall = high - low;
  const leaves = LEAVES.count;
  const all = max + leaves;
  const base = new Float32Array(all * 3);
  const phase = new Float32Array(all);
  for (let i = 0; i < all; i++) {
    const leaf = i >= max;
    base[i * 3] = Math.random() * (leaf ? LEAVES.area : area);
    base[i * 3 + 1] = Math.random() * (leaf ? LEAVES.high - LEAVES.low : tall);
    base[i * 3 + 2] = Math.random() * (leaf ? LEAVES.area : area);
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(all * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(all * 4), 4)); // (rgb premultiplied, and how much it covers)
  const shape = new Float32Array(all * 3);
  const leafColor = [];
  const leafFall = new Float32Array(leaves);
  for (let i = 0; i < all; i++) shape[i * 3] = 1;
  for (let j = 0; j < leaves; j++) {
    const r = Math.random();
    shape[(max + j) * 3] = THREE.MathUtils.lerp(LEAVES.size[0], LEAVES.size[1], r);
    leafFall[j] = THREE.MathUtils.lerp(LEAVES.fall[0], LEAVES.fall[1], Math.random());
    leafColor.push(LEAVES.colors[j % LEAVES.colors.length]);
  }
  geo.setAttribute('aLeaf', new THREE.BufferAttribute(shape, 3));
  const material = new THREE.PointsMaterial({
    size: MOTES.size,
    vertexColors: true,
    transparent: true,
    blending: THREE.CustomBlending, // (premultiplied: the pollen's alpha 0 adds its glow, a leaf's 1 covers)
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthWrite: false,
    toneMapped: false,
  });
  hook(material, 'motes', (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexPars}`)
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aLeaf.x;\n\tvLeaf = aLeaf;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeaf;')
      .replace('#include <map_particle_fragment>', fragmentShape);
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false; // (they move every frame round the player)
  points.visible = false;
  let count = max;
  let leafCount = 0;
  const drift = new THREE.Vector2();
  const light = new THREE.Color();

  // v in [0, size) from any v
  const wrap = (v, size) => ((v % size) + size) % size;
  return {
    points,
    update(t, dt, focus, sun) {
      points.visible = sun > 0.01 && count + leafCount > 0;
      if (!points.visible) return;
      drift.x += (MOTES.breeze.x + U.uWind.value.x * MOTES.wind) * dt;
      drift.y += (MOTES.breeze.y + U.uWind.value.y * MOTES.wind) * dt;
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      const half = area / 2;
      const { r, g, b } = MOTES.color;
      for (let i = 0; i < count; i++) {
        const p = phase[i];
        // the box's corner sits at focus - half: each mote wraps inside it
        const x = wrap(base[i * 3] + drift.x + Math.sin(t * 0.21 + p) * 0.8 - focus.x + half, area) - half;
        const z = wrap(base[i * 3 + 2] + drift.y + Math.cos(t * 0.17 + p * 1.7) * 0.8 - focus.z + half, area) - half;
        const y = wrap(base[i * 3 + 1] + Math.sin(t * 0.13 + p * 2.3) * 0.6 + t * 0.04, tall) + low;
        pos[i * 3] = focus.x + x;
        pos[i * 3 + 1] = focus.y + y + Math.sin(t * 0.9 + p * 3) * 0.12;
        pos[i * 3 + 2] = focus.z + z;
        // fade out toward the box's edges (no popping as they wrap) and its
        // top and bottom; glint now and then as they turn in the light
        const edge = Math.min(1, (half - Math.max(Math.abs(x), Math.abs(z))) / 4, (y - low) / 0.8, (high - y) / 1.2);
        const glint = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + p * 5)) ** 3;
        const k = MOTES.bright * sun * Math.max(0, edge) * glint;
        col[i * 4] = r * k;
        col[i * 4 + 1] = g * k;
        col[i * 4 + 2] = b * k;
        col[i * 4 + 3] = 0;
      }
      if (leafCount > 0) {
        // the leaves: in a box between the player and the camera, falling,
        // swinging side to side as they fall, tumbling; lit by the day's
        // light (the sun's color, src/daynight.js), dimmer as the sun goes
        const cam = U.uCamPos.value;
        const cx = THREE.MathUtils.lerp(focus.x, cam.x, LEAVES.toCamera);
        const cz = THREE.MathUtils.lerp(focus.z, cam.z, LEAVES.toCamera);
        const lh = LEAVES.high - LEAVES.low;
        const lhalf = LEAVES.area / 2;
        light.copy(U.uSkyGlow.value).lerp(MOTES.color, 0.5).multiplyScalar(0.45 + 0.55 * sun);
        const shape = geo.attributes.aLeaf.array;
        for (let j = 0; j < leafCount; j++) {
          const i = max + j;
          const p = phase[i];
          const swing = Math.sin(t * 0.8 + p) * 0.9;
          const x = wrap(base[i * 3] + drift.x * 1.6 + swing - cx + lhalf, LEAVES.area) - lhalf;
          const z = wrap(base[i * 3 + 2] + drift.y * 1.6 + Math.cos(t * 0.6 + p * 1.3) * 0.5 - cz + lhalf, LEAVES.area) - lhalf;
          const y = wrap(base[i * 3 + 1] - t * leafFall[j], lh) + LEAVES.low;
          pos[i * 3] = cx + x;
          pos[i * 3 + 1] = focus.y + y;
          pos[i * 3 + 2] = cz + z;
          shape[i * 3 + 1] = p + t * (0.6 + (p % 1)) + swing * 0.6; // (turning)
          shape[i * 3 + 2] = Math.abs(Math.cos(t * (1.1 + (p % 0.7)) + p)); // (tumbling: edge-on now and then)
          const edge = Math.max(0, Math.min(1, (lhalf - Math.max(Math.abs(x), Math.abs(z))) / 2, (y - LEAVES.low) / 0.8, (LEAVES.high - y) / 1.2));
          const c = leafColor[j];
          col[i * 4] = c.r * light.r * edge;
          col[i * 4 + 1] = c.g * light.g * edge;
          col[i * 4 + 2] = c.b * light.b * edge;
          col[i * 4 + 3] = edge;
        }
        geo.attributes.aLeaf.needsUpdate = true;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    setParticles(n) {
      count = Math.max(0, Math.min(max, Math.round((MOTES.count * n) / 900)));
      leafCount = n >= 900 ? leaves : 0; // (the high tier's)
      // (the leaves sit after all the motes: the ones not drawn are clear)
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      for (let i = count; i < max; i++) {
        col.fill(0, i * 4, i * 4 + 4);
        pos.fill(0, i * 3, i * 3 + 3);
      }
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, leafCount ? all : count);
    },
    dispose() {
      geo.dispose();
      points.material.dispose();
    },
  };
}
