import * as THREE from 'three';
import './daynight.css';

// Day/night cycle: a game clock that drives the sun/moon light, sky + fog
// colors and hemisphere light, plus night extras (a warm glow around the
// player and fireflies), and a clock panel in the top-right corner.
//
// Time is in game hours (0..24). A full day takes DAY_LENGTH_SECONDS of real
// time, so one game hour is DAY_LENGTH_SECONDS / 24 seconds.
import { DAY_LENGTH_SECONDS } from '../shared/constants.js';

export { DAY_LENGTH_SECONDS };

const FAST_FORWARD = 30; // time multiplier while fast-forwarding
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Lighting keyframes by hour; values are interpolated between neighbors and
// wrap around midnight. `light` is the sun by day and the moon by night.
const KEYS = [
  { h: 0, sky: 0x0b1026, light: 0x9fb4ff, lightI: 0.5, hemiSky: 0x4060a0, hemiGround: 0x1a1a34, hemiI: 0.6 },
  { h: 4.5, sky: 0x111a3a, light: 0x9fb4ff, lightI: 0.45, hemiSky: 0x4060a0, hemiGround: 0x1a1a34, hemiI: 0.6 },
  { h: 6, sky: 0x8a6a9c, light: 0xffa070, lightI: 0.35, hemiSky: 0xb09ac8, hemiGround: 0x3a2f3a, hemiI: 0.75 },
  { h: 7, sky: 0xf2b27a, light: 0xffc890, lightI: 0.95, hemiSky: 0xffe0c0, hemiGround: 0x4a3f3a, hemiI: 0.95 },
  { h: 8.5, sky: 0x87ceeb, light: 0xffffff, lightI: 1.2, hemiSky: 0xffffff, hemiGround: 0x444466, hemiI: 1.0 },
  { h: 17, sky: 0x87ceeb, light: 0xfff2d6, lightI: 1.15, hemiSky: 0xffffff, hemiGround: 0x444466, hemiI: 1.0 },
  { h: 18.3, sky: 0xf0955a, light: 0xffa060, lightI: 0.95, hemiSky: 0xffd0a0, hemiGround: 0x4a3a3a, hemiI: 0.9 },
  { h: 19, sky: 0x8a5a86, light: 0xff7a50, lightI: 0.35, hemiSky: 0x9a7aaa, hemiGround: 0x2a2030, hemiI: 0.7 },
  { h: 20.5, sky: 0x1a2048, light: 0x9fb4ff, lightI: 0.45, hemiSky: 0x4060a0, hemiGround: 0x1a1a34, hemiI: 0.6 },
];

const COLOR_PROPS = ['sky', 'light', 'hemiSky', 'hemiGround'];
const NUMBER_PROPS = ['lightI', 'hemiI'];

// Pre-convert keyframe colors once
for (const key of KEYS) for (const p of COLOR_PROPS) key[p] = new THREE.Color(key[p]);

const SUNRISE = 6;
const SUNSET = 19;

// 0 during the day, 1 at night, easing over dawn and dusk
function nightAmount(hour) {
  const ramp = (h, start, end) => THREE.MathUtils.smoothstep(h, start, end);
  if (hour < 12) return 1 - ramp(hour, 5, 7.5);
  return ramp(hour, 18.5, 20.5);
}

function formatTime(hour) {
  const totalMinutes = Math.floor((hour * 60) / 10) * 10; // ticks in 10-minute steps
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 < 12 ? 'am' : 'pm'}`;
}

function createClockUI() {
  const root = document.createElement('div');
  root.className = 'dn-clock';
  root.innerHTML = `
    <svg class="dn-dial" viewBox="0 0 64 36" aria-hidden="true">
      <path class="dn-sky" d="M4 34 A28 28 0 0 1 60 34 Z" />
      <path class="dn-track" d="M8 34 A24 24 0 0 1 56 34" />
      <g class="dn-body">
        <circle class="dn-sun" r="5" />
        <g class="dn-moon"><circle r="4.5" /><circle class="dn-moon-cut" r="4" cx="2.2" cy="-1.4" /></g>
      </g>
      <path class="dn-horizon" d="M2 34 H62" />
    </svg>
    <div class="dn-text">
      <div class="dn-day"></div>
      <div class="dn-time"></div>
    </div>
    <div class="dn-ff" title="Fast-forwarding (hold T)">&#9654;&#9654;</div>
  `;
  document.body.appendChild(root);
  // How wide it is, for the HUD beside it (touch.css keeps the place panel clear of it)
  new ResizeObserver(() => document.documentElement.style.setProperty('--clock-w', `${root.offsetWidth}px`)).observe(root);
  return {
    root,
    sky: root.querySelector('.dn-sky'),
    body: root.querySelector('.dn-body'),
    sun: root.querySelector('.dn-sun'),
    moon: root.querySelector('.dn-moon'),
    moonCut: root.querySelector('.dn-moon-cut'),
    day: root.querySelector('.dn-day'),
    time: root.querySelector('.dn-time'),
  };
}

function createFireflies(count) {
  const AREA = 36; // fireflies live in a square this wide that follows the player
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() - 0.5) * AREA;
    base[i * 3 + 1] = 0.3 + Math.random() * 1.4;
    base[i * 3 + 2] = (Math.random() - 0.5) * AREA;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  points.frustumCulled = false; // positions move every frame around the player

  const wrap = (v) => ((((v + AREA / 2) % AREA) + AREA) % AREA) - AREA / 2;
  function update(t, focus, night) {
    points.visible = night > 0.01;
    if (!points.visible) return;
    const pos = geo.attributes.position.array;
    const col = geo.attributes.color.array;
    for (let i = 0; i < count; i++) {
      const p = phase[i];
      const bx = base[i * 3] + Math.sin(t * 0.3 + p) * 1.5;
      const bz = base[i * 3 + 2] + Math.cos(t * 0.25 + p * 1.3) * 1.5;
      pos[i * 3] = focus.x + wrap(bx - focus.x);
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 1.1 + p * 2) * 0.25;
      pos[i * 3 + 2] = focus.z + wrap(bz - focus.z);
      const glow = night * Math.max(0, Math.sin(t * 2.3 + p * 3)) ** 2;
      col[i * 3] = 0.85 * glow;
      col[i * 3 + 1] = 1.0 * glow;
      col[i * 3 + 2] = 0.45 * glow;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return { points, update };
}

// Underground (a boss's dungeon): black all round, the hemisphere and the sun
// down low in the cave's color, and the warm light round the farmer up
const CAVE_DARK = new THREE.Color(0x040306);
const CAVE = { hemiI: 0.62, lightI: 0.32, glow: 16 };

export function createDayNight({ scene, sun, hemi, startHour = 6 }) {
  let hour = THREE.MathUtils.euclideanModulo(startHour, 24);
  let day = 1;
  let elapsed = 0;

  const ui = createClockUI();
  let shownLabel = '';
  let note = ''; // after the day (setNote: the farm's season)
  let cloud = 0; // how overcast it is, 0 to 1, and lightning's flash (setWeather: src/weather.js)
  let flash = 0;
  let under = 0; // how far underground we are, 0 to 1, and the light down there (setUnderground: a boss's dungeon)
  const caveLight = new THREE.Color(0xffffff);

  // Warm light around the player at night so the world stays readable. It
  // always exists (intensity 0 by day) so the scene's light count never
  // changes, which would force every material's shader to recompile.
  // It hangs above and in front of the player so it lights the face, not the hat.
  const glow = new THREE.PointLight(0xffb36b, 0, 14, 1.4);
  glow.position.set(0, 2.2, 1.2);

  const fireflies = createFireflies(90);
  scene.add(fireflies.points);

  const lerped = {};
  for (const p of COLOR_PROPS) lerped[p] = new THREE.Color();
  const sunDir = new THREE.Vector3();

  function sample(h) {
    let i = KEYS.findIndex((k) => k.h > h);
    if (i === -1) i = KEYS.length; // past the last key: blend toward the first key + 24h
    const a = KEYS[i - 1];
    const b = KEYS[i % KEYS.length];
    const bh = i === KEYS.length ? b.h + 24 : b.h;
    const k = (h - a.h) / (bh - a.h);
    for (const p of COLOR_PROPS) lerped[p].lerpColors(a[p], b[p], k);
    for (const p of NUMBER_PROPS) lerped[p] = THREE.MathUtils.lerp(a[p], b[p], k);
    return lerped;
  }

  // Rain clouds: the sky and the light greyer and dimmer (as bright as they
  // were, less a quarter, so a rainy night is no lighter)
  function overcast(color) {
    const grey = (color.r * 0.3 + color.g * 0.59 + color.b * 0.11) * 0.75;
    color.lerp(_grey.setRGB(grey * 0.92, grey * 0.97, grey * 1.08), cloud * 0.8);
  }
  const _grey = new THREE.Color();
  const FLASH = new THREE.Color(0xe6ecff);

  function apply() {
    const s = sample(hour);
    if (cloud > 0) for (const p of COLOR_PROPS) overcast(s[p]);
    if (flash > 0) s.sky.lerp(FLASH, flash * 0.7);
    // underground: no sky (black all round), a dim light of the cave's own color
    if (under > 0) {
      s.sky.lerp(CAVE_DARK, under);
      s.hemiSky.lerp(caveLight, under);
      s.hemiGround.lerp(CAVE_DARK, under);
      s.light.lerp(caveLight, under);
    }
    scene.background.copy(s.sky);
    scene.fog.color.copy(s.sky);
    hemi.color.copy(s.hemiSky);
    hemi.groundColor.copy(s.hemiGround);
    hemi.intensity = THREE.MathUtils.lerp(s.hemiI * (1 - cloud * 0.25) + flash * 2.5, CAVE.hemiI, under);
    sun.color.copy(s.light);
    sun.intensity = THREE.MathUtils.lerp(s.lightI * (1 - cloud * 0.65), CAVE.lightI, under);

    // The sun arcs east (+X) to west (-X) between sunrise and sunset; at
    // night the same light becomes the moon on the opposite side. It never
    // drops below ~20° up, so low light still reaches flat ground and shadows
    // don't stretch to infinity at the horizon.
    const angle = ((hour - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI;
    const isDay = hour >= SUNRISE && hour < SUNSET;
    const sign = isDay ? 1 : -1;
    sunDir.set(Math.cos(angle) * sign, 0.4 + 0.6 * Math.abs(Math.sin(angle)), 0.45).normalize();
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 40); // (main.js moves the target)

    const night = nightAmount(hour);
    glow.intensity = Math.max(night * 10, under * CAVE.glow); // (underground: a lamp's light round us)

    // Clock panel: dial sky color and the sun/moon riding the arc
    const skyHex = `#${s.sky.getHexString()}`;
    ui.sky.style.fill = skyHex;
    ui.moonCut.style.fill = skyHex;
    const progress = isDay
      ? (hour - SUNRISE) / (SUNSET - SUNRISE)
      : THREE.MathUtils.euclideanModulo(hour - SUNSET, 24) / (24 - (SUNSET - SUNRISE));
    const x = 32 - 24 * Math.cos(progress * Math.PI);
    const y = 34 - 24 * Math.sin(progress * Math.PI);
    ui.body.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    ui.sun.style.display = isDay ? '' : 'none';
    ui.moon.style.display = isDay ? 'none' : '';

    const label = `${DAY_NAMES[(day - 1) % 7]}. ${day}${note ? ` · ${note}` : ''}|${formatTime(hour)}`;
    if (label !== shownLabel) {
      shownLabel = label;
      const [dayText, timeText] = label.split('|');
      ui.day.textContent = dayText;
      ui.time.textContent = timeText;
      ui.root.classList.toggle('late', hour < SUNRISE); // past midnight
    }
    return night;
  }

  apply();

  return {
    glow,
    /** Advance the clock and update lighting. `focus` is the player position. */
    update(dt, { paused = false, fastForward = false, focus }) {
      elapsed += dt;
      if (!paused) {
        hour += (dt * 24 * (fastForward ? FAST_FORWARD : 1)) / DAY_LENGTH_SECONDS;
        if (hour >= 24) {
          hour -= 24;
          day += 1;
        }
      }
      ui.root.classList.toggle('fast', fastForward && !paused);
      const night = apply();
      fireflies.update(elapsed, focus, night * (1 - cloud) * (1 - under)); // (not out in the rain, nor underground)
    },
    /** Jump to `hours` after midnight of day 1 (a multiplayer game's shared clock). */
    setTime(hours) {
      day = 1 + Math.floor(hours / 24);
      hour = THREE.MathUtils.euclideanModulo(hours, 24);
      apply();
    },
    hour: () => hour,
    day: () => day,
    isNight: () => nightAmount(hour) > 0.5,
    /** A word after the day (the farm's season), or none. */
    setNote(text) {
      if ((text ?? '') === note) return;
      note = text ?? '';
      apply();
    },
    night: () => nightAmount(hour), // 0 by day, 1 at night
    /** How far underground we are (0 to 1), and the cave's light (a color): from the next update. */
    setUnderground(amount, color = 0xffffff) {
      under = amount;
      caveLight.setHex(color);
    },
    /** How overcast it is (0 to 1) and lightning's flash (0 to 1): from the next update. */
    setWeather(overcastBy, flashBy) {
      cloud = overcastBy;
      flash = flashBy;
    },
  };
}
