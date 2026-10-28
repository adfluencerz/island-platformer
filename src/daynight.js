import * as THREE from 'three';
import './daynight.css';

// Day/night cycle: a game clock that drives the sun/moon light, sky + fog
// colors and hemisphere light, plus night extras (a warm glow around the
// player and fireflies), and a clock panel in the top-right corner.
//
// Time is in game hours (0..24). A full day takes DAY_LENGTH_SECONDS of real
// time, so one game hour is DAY_LENGTH_SECONDS / 24 seconds.
import { DAY_LENGTH_SECONDS } from '../shared/constants.js';
import { light as shaderLight, U } from './gfx/uniforms.js';

export { DAY_LENGTH_SECONDS };

const FAST_FORWARD = 30; // time multiplier while fast-forwarding
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Lighting keyframes by hour; values are interpolated between neighbors and
// wrap around midnight. `light` is the sun by day and the moon by night.
// Set for the filmic tone mapping (src/gfx/tonemap.js, exposure 1.15): a warm
// sun a little stronger than the sky, a cool blue sky light and a blue-violet
// ground bounce, so lit sides are warm and shade is cool; dusk's sun and sky
// are lifted so a sunset glows, and night is moonlit blue. The sky (src/gfx/sky.js)
// runs from `zenith` overhead to `horizon`, which is the fog's color too (the
// far land melts into it); neither is tone mapped.
const KEYS = [
  { h: 0, horizon: 0x0b1026, zenith: 0x02040e, light: 0x94acff, lightI: 0.6, hemiSky: 0x3858b4, hemiGround: 0x18204a, hemiI: 0.6 },
  { h: 4.5, horizon: 0x111a3a, zenith: 0x040816, light: 0x94acff, lightI: 0.55, hemiSky: 0x3858b4, hemiGround: 0x18204a, hemiI: 0.6 },
  { h: 6, horizon: 0x8a6a9c, zenith: 0x2e3468, light: 0xff9a6a, lightI: 0.5, hemiSky: 0xb09ac8, hemiGround: 0x3a3458, hemiI: 0.75 },
  { h: 7, horizon: 0xf2b27a, zenith: 0x6a8cc4, light: 0xffc488, lightI: 1.25, hemiSky: 0xf0dce0, hemiGround: 0x464468, hemiI: 0.9 },
  { h: 8.5, horizon: 0x87ceeb, zenith: 0x3a86d4, light: 0xfff6ea, lightI: 1.45, hemiSky: 0xc4d8ff, hemiGround: 0x34487a, hemiI: 0.95 },
  { h: 17, horizon: 0x87ceeb, zenith: 0x3f88d2, light: 0xfff0dc, lightI: 1.4, hemiSky: 0xc4d8ff, hemiGround: 0x34487a, hemiI: 0.95 },
  { h: 18.3, horizon: 0xf0955a, zenith: 0x4c5c9e, light: 0xffa060, lightI: 1.9, hemiSky: 0xf4b8c0, hemiGround: 0x4a4070, hemiI: 1.25 },
  { h: 19, horizon: 0x8a5a86, zenith: 0x2a2a62, light: 0xff7458, lightI: 0.8, hemiSky: 0x9c80c0, hemiGround: 0x282660, hemiI: 0.85 },
  { h: 20.5, horizon: 0x1a2048, zenith: 0x060a20, light: 0x94acff, lightI: 0.6, hemiSky: 0x3858b4, hemiGround: 0x18204a, hemiI: 0.6 },
];

const COLOR_PROPS = ['horizon', 'zenith', 'light', 'hemiSky', 'hemiGround'];
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
      toneMapped: false, // (their own glow, as bright as it is)
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
const CAVE = { hemiI: 0.7, lightI: 0.32, glow: 16 };

export function createDayNight({ scene, sun, hemi, startHour = 6 }) {
  let hour = THREE.MathUtils.euclideanModulo(startHour, 24);
  let day = 1;
  let elapsed = 0;

  const ui = createClockUI();
  let shownLabel = '';
  let note = ''; // after the day (setNote: the farm's season)
  let cloud = 0; // how overcast it is, 0 to 1, and lightning's flash (setWeather: src/weather.js)
  let flash = 0;
  let flashOut = 0; // (lightning's flash out in the open: a split screen's views under a roof see none, view())
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

  // The sky's colors once the day's light is set (the shaders' own: the season
  // tints them in place, src/seasons.js)
  const sky = { horizon: U.uSkyHorizon.value, zenith: U.uSkyZenith.value };

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

  // clock: the clock's panel too (not for a split screen's other views: view())
  function apply(clock = true) {
    const s = sample(hour);
    if (cloud > 0) for (const p of COLOR_PROPS) overcast(s[p]);
    if (flash > 0) s.horizon.lerp(FLASH, flash * 0.7);
    // underground: no sky (black all round), a dim light of the cave's own color
    if (under > 0) {
      s.horizon.lerp(CAVE_DARK, under);
      s.zenith.lerp(CAVE_DARK, under);
      s.hemiSky.lerp(caveLight, under);
      s.hemiGround.lerp(CAVE_DARK, under);
      s.light.lerp(caveLight, under);
    }
    scene.background.copy(s.horizon);
    scene.fog.color.copy(s.horizon);
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
    shaderLight({ sunDir, sun, sky: s.horizon, zenith: s.zenith, glow: s.light, night, under, cloud, flash }); // (the shaders' copy: src/gfx/uniforms.js)
    glow.intensity = Math.max(night * 10, under * CAVE.glow); // (underground: a lamp's light round us)
    if (!clock) return night;

    // Clock panel: dial sky color and the sun/moon riding the arc
    const skyHex = `#${s.horizon.getHexString()}`;
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
    /** The sky's colors as drawn (horizon: the fog's too, zenith), after apply(): the season tints them. */
    sky,
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
    /** A split screen's farmer's own view (src/main.js): the light as far underground as they are (amount, color), the fireflies round them (focus), and no lightning seen under a roof (sheltered). */
    view(focus, amount, color = 0xffffff, sheltered = false) {
      under = amount;
      caveLight.setHex(color);
      flash = sheltered ? 0 : flashOut;
      const night = apply(false);
      fireflies.update(elapsed, focus, night * (1 - cloud) * (1 - under));
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
    /** How overcast it is (0 to 1) and lightning's flash (0 to 1; sheltered: none seen): from the next update. */
    setWeather(overcastBy, flashBy, sheltered = false) {
      cloud = overcastBy;
      flashOut = flashBy;
      flash = sheltered ? 0 : flashBy;
    },
  };
}
