import * as THREE from 'three';
import { weatherAt, WEATHER } from '../shared/weather.js';
import * as sound from './sound.js';

// ---------- The weather, to see and hear ----------
// shared/weather.js says when it rains on the farm; this shows it: rain
// falling round the farmer (snow, in winter), the sky clouding over
// (daynight.js setWeather), and in a storm lightning, thunder and a wind that
// slants the rain (main.js lets it push a glider too). And the hiss of rain,
// muffled in the house, where none falls. A lobby has the weather of nobody's
// farm: none.
const AREA = 30; // drops fall in a square this wide round the farmer...
const TOP = 12; // ...from this high over them, to a little under their feet
const BELOW = 2;
const RAIN_SPEED = 16; // units a second
const SNOW_SPEED = 1.3;
const STREAK = 0.55; // a raindrop's length
const SLANT = 0.3; // how far a storm's wind leans a raindrop, for each unit a second of it
const DRIFT = 3; // how much faster than a glider the wind blows the drops along

export function createWeather({ scene, dayNight, count = 900 }) {
  // each drop: where in the square, and how far down its fall it starts
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() - 0.5) * AREA;
    base[i * 3 + 1] = Math.random();
    base[i * 3 + 2] = (Math.random() - 0.5) * AREA;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb8c6d8, transparent: true, opacity: 0.5, depthWrite: false }));
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.17, transparent: true, opacity: 0.9, depthWrite: false }));
  for (const drops of [rain, snow]) {
    drops.frustumCulled = false; // (they move every frame round the farmer)
    drops.visible = false;
    scene.add(drops);
  }

  const wind = new THREE.Vector3(); // a storm's, now (units a second)
  const drift = new THREE.Vector2(); // how far it has blown the drops
  let elapsed = 0;
  let flash = 0; // lightning, 1 as it strikes
  let nextFlash = 3; // seconds till the next, in a storm
  let thunderIn = -1; // seconds till its thunder
  let falling = 0; // drops (or flakes) coming down now, out of doors
  let snowing = false;
  let limit = count; // (the graphics tier's share of them: setParticles)

  const wrap = (v) => ((((v + AREA / 2) % AREA) + AREA) % AREA) - AREA / 2;
  const fallen = (i, speed) => (base[i * 3 + 1] + (elapsed * speed) / (TOP + BELOW)) % 1; // (0 at the top, 1 at the bottom)

  function drawRain(n, focus) {
    const pos = rainGeo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const x = focus.x + wrap(base[i * 3] + drift.x - focus.x);
      const z = focus.z + wrap(base[i * 3 + 2] + drift.y - focus.z);
      const y = focus.y + TOP - fallen(i, RAIN_SPEED) * (TOP + BELOW);
      const j = i * 6;
      pos[j] = x;
      pos[j + 1] = y;
      pos[j + 2] = z;
      pos[j + 3] = x - wind.x * SLANT; // (its top, upwind)
      pos[j + 4] = y + STREAK;
      pos[j + 5] = z - wind.z * SLANT;
    }
    rainGeo.setDrawRange(0, n * 2);
    rainGeo.attributes.position.needsUpdate = true;
  }

  function drawSnow(n, focus) {
    const pos = snowGeo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      // (flakes drift to and fro as they fall)
      pos[i * 3] = focus.x + wrap(base[i * 3] + drift.x + Math.sin(elapsed * 0.9 + i) * 0.4 - focus.x);
      pos[i * 3 + 1] = focus.y + TOP - fallen(i, SNOW_SPEED) * (TOP + BELOW);
      pos[i * 3 + 2] = focus.z + wrap(base[i * 3 + 2] + drift.y + Math.cos(elapsed * 0.7 + i * 1.3) * 0.4 - focus.z);
    }
    snowGeo.setDrawRange(0, n);
    snowGeo.attributes.position.needsUpdate = true;
  }

  function place(focus, indoors = false) {
    const n = indoors ? 0 : falling;
    rain.visible = n > 0 && !snowing;
    snow.visible = n > 0 && snowing;
    if (rain.visible) drawRain(n, focus);
    if (snow.visible) drawSnow(n, focus);
  }

  return {
    wind,
    // Every frame: the farm's weather at `hours` (its game hours; null in a
    // lobby). snowy: it's winter on the farm; indoors: in the house. Says
    // what's coming down, for the clock ('Rain', 'Storm', 'Snow',
    // 'Snowstorm'), or null.
    update(dt, { hours, focus, snowy = false, indoors = false }) {
      elapsed += dt;
      const now = hours === null ? null : weatherAt(hours);
      const amount = now?.amount ?? 0;
      const storm = now?.kind === 'storm';
      wind.set(Math.cos(now?.wind ?? 0), 0, Math.sin(now?.wind ?? 0)).multiplyScalar(storm ? WEATHER.wind * amount : 0);
      drift.x += wind.x * DRIFT * dt;
      drift.y += wind.z * DRIFT * dt;

      // lightning now and then in a storm, and its thunder a moment after
      flash = Math.max(0, flash - dt * 3);
      if (storm && amount > 0.6) {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flash = 1;
          nextFlash = 6 + Math.random() * 12;
          thunderIn = 0.4 + Math.random() * 1.6;
        }
      }
      if (thunderIn >= 0 && (thunderIn -= dt) < 0) sound.play('thunder');
      dayNight.setWeather(amount * (storm ? 1 : 0.7), flash * (0.75 + 0.25 * Math.sin(elapsed * 60)), indoors);
      sound.rain(indoors ? amount * 0.25 : amount);

      falling = Math.round(limit * amount);
      snowing = snowy;
      place(focus, indoors);
      return now && (snowy ? (storm ? 'Snowstorm' : 'Snow') : storm ? 'Storm' : 'Rain');
    },
    // What comes down round focus (indoors: none): a split screen's farmers
    // each have it round them, in their own view (src/main.js)
    place,

    // How many may fall at most (the graphics tier's: src/gfx/quality.js), up to `count`
    setParticles(n) {
      limit = Math.max(0, Math.min(count, Math.round(n)));
    },
  };
}
