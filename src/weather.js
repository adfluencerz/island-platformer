import * as THREE from 'three';
import { weatherAt, spellOn, WEATHER } from '../shared/weather.js';
import * as sound from './sound.js';
import { U } from './gfx/uniforms.js';

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
const STREAK = 1.5; // a raindrop's length
const SLANT = 0.3; // how far a storm's wind leans a raindrop, for each unit a second of it
const DRIFT = 3; // how much faster than a glider the wind blows the drops along
// Even with no storm the rain leans a little, as the clouds drift (from the
// south-west: src/gfx/uniforms.js frame), and falls along its lean
const LEAN = 0.2; // (across, for each unit down)
const LEAN_DIR = new THREE.Vector2(0.92, 0.38);
// A few drops fall near the camera, between it and the farmer: longer, and
// drawn twice side by side, so they read as big drops close by (one in
// NEAR_EVERY of the tier's drops: the count stays the tier's)
const NEAR_EVERY = 22;
const NEAR_AREA = 8; // (a square this wide...)
const NEAR_AT = 0.4; // (...this far from the farmer toward the camera)
const NEAR_TOP = 8;
const NEAR_STREAK = 1.35; // (times a drop's length)
const NEAR_TWIN = 0.0018; // (the twin's offset to the side, for each unit from the camera: about a pixel)
// The rain's streaks take the sky's color (its horizon's, lighter, a
// little of a pale grey kept) so they sit in the light and the grade: silver
// by day, blue at night, warm at sunset; a bright head and a fading tail
const RAIN_TINT = { lift: 1.7, pale: new THREE.Color(0xd2deec), keep: 0.45, tail: 0.15 };
// How wet the world is (src/gfx/light.js, ground.js): soaked this long into
// a shower (game hours), dry again this long after it stops
const SOAK = 0.5;
const DRY = 2.5;

// The wetness at `hours` on the farm's clock (0 to 1): from today's spell or
// yesterday's (a late shower dries after midnight)
export function wetnessAt(hours) {
  let wet = 0;
  for (let day = Math.floor(hours / 24) - 1; day <= Math.floor(hours / 24); day++) {
    const spell = spellOn(day);
    if (!spell || hours < spell.from) continue;
    const soaked = Math.min(1, (Math.min(hours, spell.to) - spell.from) / SOAK);
    const drying = hours > spell.to ? Math.max(0, 1 - (hours - spell.to) / DRY) : 1;
    wet = Math.max(wet, soaked * drying * drying);
  }
  return wet;
}

export function createWeather({ scene, dayNight, count = 900 }) {
  // each drop: where in the square, and how far down its fall it starts
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() - 0.5) * AREA;
    base[i * 3 + 1] = Math.random();
    base[i * 3 + 2] = (Math.random() - 0.5) * AREA;
  }
  const twins = Math.ceil(count / NEAR_EVERY);
  const verts = (count + twins) * 2;
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  const fade = new Float32Array(verts * 4).fill(1); // (each streak: its head, then its tail, fading)
  for (let v = 1; v < verts; v += 2) fade[v * 4 + 3] = RAIN_TINT.tail;
  rainGeo.setAttribute('color', new THREE.BufferAttribute(fade, 4));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc4d2e4, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
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
  const leanDrift = new THREE.Vector2(); // (and the rain's own lean, the rain's alone)
  const near = new THREE.Vector3(); // (where the drops near the camera fall round, and the camera)
  const cam = new THREE.Vector3();
  let elapsed = 0;
  let flash = 0; // lightning, 1 as it strikes
  let nextFlash = 3; // seconds till the next, in a storm
  let thunderIn = -1; // seconds till its thunder
  let falling = 0; // drops (or flakes) coming down now, out of doors
  let snowing = false;
  let limit = count; // (the graphics tier's share of them: setParticles)

  const wrap = (v) => ((((v + AREA / 2) % AREA) + AREA) % AREA) - AREA / 2;
  const wrapNear = (v) => ((((v + NEAR_AREA / 2) % NEAR_AREA) + NEAR_AREA) % NEAR_AREA) - NEAR_AREA / 2;
  const fallen = (i, speed) => (base[i * 3 + 1] + (elapsed * speed) / (TOP + BELOW)) % 1; // (0 at the top, 1 at the bottom)

  function drawRain(n, focus) {
    const pos = rainGeo.attributes.position.array;
    // (the camera: this view's, or a wide view's place behind the farmer if it is not near)
    cam.copy(U.uCamPos.value);
    if (cam.distanceToSquared(focus) > 1600 || cam.distanceToSquared(focus) < 1) cam.set(focus.x, focus.y + 7, focus.z + 14);
    near.copy(focus).lerp(cam, NEAR_AT);
    const sideX = -(near.z - cam.z);
    const sideZ = near.x - cam.x;
    const side = NEAR_TWIN / Math.max(Math.hypot(sideX, sideZ), 1e-3);
    const leanX = LEAN_DIR.x * LEAN * STREAK;
    const leanZ = LEAN_DIR.y * LEAN * STREAK;
    let t = n * 6; // (the twins after the drops)
    for (let i = 0; i < n; i++) {
      const close = i % NEAR_EVERY === 0;
      let x, y, z;
      if (close) {
        x = near.x + wrapNear(base[i * 3] + leanDrift.x + drift.x - near.x);
        z = near.z + wrapNear(base[i * 3 + 2] + leanDrift.y + drift.y - near.z);
        y = focus.y + NEAR_TOP - fallen(i, (RAIN_SPEED * (TOP + BELOW)) / (NEAR_TOP + BELOW)) * (NEAR_TOP + BELOW);
      } else {
        x = focus.x + wrap(base[i * 3] + drift.x + leanDrift.x - focus.x);
        z = focus.z + wrap(base[i * 3 + 2] + drift.y + leanDrift.y - focus.z);
        y = focus.y + TOP - fallen(i, RAIN_SPEED) * (TOP + BELOW);
      }
      const k = close ? NEAR_STREAK : 1;
      const j = i * 6;
      pos[j] = x;
      pos[j + 1] = y;
      pos[j + 2] = z;
      pos[j + 3] = x - (wind.x * SLANT + leanX) * k; // (its top, upwind)
      pos[j + 4] = y + STREAK * k;
      pos[j + 5] = z - (wind.z * SLANT + leanZ) * k;
      if (close) {
        const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z) * side;
        for (let v = 0; v < 6; v += 3) {
          pos[t + v] = pos[j + v] + sideX * d;
          pos[t + v + 1] = pos[j + v + 1];
          pos[t + v + 2] = pos[j + v + 2] + sideZ * d;
        }
        t += 6;
      }
    }
    rainGeo.setDrawRange(0, t / 3);
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
      leanDrift.addScaledVector(LEAN_DIR, LEAN * RAIN_SPEED * dt);

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
      // (wet: not in the snow, nor in a lobby, which has no weather)
      const wet = hours === null || snowy ? 0 : wetnessAt(hours);
      dayNight.setWeather(amount * (storm ? 1 : 0.7), flash * (0.75 + 0.25 * Math.sin(elapsed * 60)), indoors, wet, snowy ? 0 : amount);
      if (amount > 0) rain.material.color.copy(U.uSkyHorizon.value).multiplyScalar(RAIN_TINT.lift).lerp(RAIN_TINT.pale, RAIN_TINT.keep);
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
