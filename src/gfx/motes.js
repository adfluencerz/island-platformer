import * as THREE from 'three';
import { U } from './uniforms.js';

// ---------- Motes: pollen and dust in the sunlight ----------
// A few warm specks drifting round the player by day (the fireflies' pattern,
// src/daynight.js: a box that follows the player, wrapping, positions moved on
// the CPU, additive, no depth write). They ride the wind (uWind, plus a
// breeze), bob, and catch the light now and then; they fade with the night,
// the clouds and the rain, and underground. How many: the tier's particle knob.
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

let dot = null; // a soft round speck
function dotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createMotes(max = MOTES.count) {
  const { area, low, high } = MOTES;
  const tall = high - low;
  const base = new Float32Array(max * 3);
  const phase = new Float32Array(max);
  for (let i = 0; i < max; i++) {
    base[i * 3] = Math.random() * area;
    base[i * 3 + 1] = Math.random() * tall;
    base[i * 3 + 2] = Math.random() * area;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  if (typeof document !== 'undefined') dot ??= dotTexture();
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: MOTES.size,
      map: dot,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  points.frustumCulled = false; // (they move every frame round the player)
  points.visible = false;
  let count = max;
  const drift = new THREE.Vector2();

  // v in [0, size) from any v
  const wrap = (v, size) => ((v % size) + size) % size;
  return {
    points,
    update(t, dt, focus, sun) {
      points.visible = sun > 0.01 && count > 0;
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
        col[i * 3] = r * k;
        col[i * 3 + 1] = g * k;
        col[i * 3 + 2] = b * k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    setParticles(n) {
      count = Math.max(0, Math.min(max, Math.round((MOTES.count * n) / 900)));
      geo.setDrawRange(0, count);
    },
    dispose() {
      geo.dispose();
      points.material.dispose();
    },
  };
}
