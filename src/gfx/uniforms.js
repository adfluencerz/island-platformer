import * as THREE from 'three';

// ---------- The shaders' shared uniforms ----------
// One object per uniform, shared by every material that uses it (a hook adds
// it with use()), so a value set here reaches them all with no per-material
// work. Kept up to date by frame() (once a frame: src/main.js updateWorld),
// look() (once a view: lookFrom) and the day's light (src/daynight.js apply).

const MAX_PUSH = 8; // (the farmers here, up to four, then the animals nearest the first)
const FEET_UP = 0.8; // (a farmer's position is this far above their feet: GROUND_STAND_Y, shared/level.js)

export const U = {
  uTime: { value: 0 }, // the wind's clock (seconds, faster in a storm): the grass's sway, the water's ripples
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, // toward the sun (or the moon at night), world space
  uSunColor: { value: new THREE.Color(1, 1, 1) }, // its light, times its intensity
  uSkyZenith: { value: new THREE.Color(0x87ceeb) }, // the sky overhead
  uSkyHorizon: { value: new THREE.Color(0x87ceeb) }, // and at the horizon: the fog's color (both after the season's tint)
  uSkyGlow: { value: new THREE.Color(1, 1, 1) }, // round the sun
  uNight: { value: 0 }, // 0 by day, 1 at night
  uUnder: { value: 0 }, // how far underground this view is, 0 to 1
  uCloudAmount: { value: 0 }, // how overcast, 0 to 1
  uFlash: { value: 0 }, // lightning's flash, 0 to 1 (none seen under a roof)
  uWet: { value: 0 }, // how wet the world is, 0 to 1: up in a shower, drying after (src/weather.js; none under a roof or underground)
  uRain: { value: 0 }, // how hard it is raining now, 0 to 1 (drops ringing on water and puddles; likewise)
  uMist: { value: 0 }, // the morning's mist, 0 to 1: from dawn, gone by mid-morning (the haze lower and thicker, dew on the grass)
  uCloudOffset: { value: new THREE.Vector2() }, // how far the clouds have drifted (world units)
  uWind: { value: new THREE.Vector2() }, // a storm's wind, xz (units a second)
  uPlayers: { value: Array.from({ length: MAX_PUSH }, () => new THREE.Vector4(0, -1e4, 0, 0)) }, // what pushes the grass aside: the farmers' and the animals' feet, xyz, w how far round (0: none)
  uCamPos: { value: new THREE.Vector3() }, // this view's camera, world space
  uFogHeight: { value: new THREE.Vector2(0, 0.35) }, // the haze's: x the sea's level, y how fast it thins going up (a unit)
  uShadowTint: { value: new THREE.Color(0.8, 0.86, 1.0) }, // the sky's light where the sun is shaded: cool, not grey (src/gfx/light.js)
  uWrap: { value: 0.6 }, // how far past side-on the sun still lights a face
  uToon: { value: 0.4 }, // how much of a two-step, soft-edged toon ramp the light's falloff has
  uCloudShadows: { value: 1 }, // the clouds' shadows on the land, 0 to 1 (0 on the low tier)
  uGrassDensity: { value: 1 }, // the share of the grass's tufts drawn (the tier's grassDensity)
  uGrassFar: { value: new THREE.Vector2(18, 30) }, // this view's grass thins to half from x away from the camera, to none by y (src/world.js viewFrom)
  uCarpet: { value: 0 }, // the share of the grass carpet's blades drawn (the tier's carpet: 0, none)
  uCarpetFar: { value: new THREE.Vector2(18, 30) }, // and as uGrassFar, for the carpet (src/world.js viewFrom: no further than it reaches)
  uGrassSpread: { value: 1 }, // how much wider each grass tuft is (the tier's grassSpread: src/gfx/quality.js)
  uDetailGain: { value: 1 }, // how much stronger the ground's painted detail is (the tier's detailGain)
  uNightGrey: { value: 0 }, // how far the lit colors go toward grey at night (the low tier's 0.35: the others' grade does it, src/gfx/post.js)
};

const TYPES = {
  uTime: 'float', uSunDir: 'vec3', uSunColor: 'vec3', uSkyZenith: 'vec3', uSkyHorizon: 'vec3', uSkyGlow: 'vec3',
  uNight: 'float', uUnder: 'float', uCloudAmount: 'float', uFlash: 'float', uWet: 'float', uRain: 'float', uMist: 'float', uCloudOffset: 'vec2', uWind: 'vec2',
  uPlayers: `vec4[${MAX_PUSH}]`, uCamPos: 'vec3', uFogHeight: 'vec2', uShadowTint: 'vec3', uWrap: 'float', uToon: 'float', uCloudShadows: 'float', uNightGrey: 'float',
  uGrassSpread: 'float', uGrassDensity: 'float', uGrassFar: 'vec2', uCarpet: 'float', uCarpetFar: 'vec2', uDetailGain: 'float',
};

const declaration = (name) => {
  const type = TYPES[name];
  if (!type) throw new Error(`gfx: no uniform ${name}`);
  const [base, count] = type.split(/[[\]]/);
  return `uniform ${base} ${name}${count ? `[${count}]` : ''};\n`;
};

// The shared uniforms `names` in a shader being compiled (a hook's onBeforeCompile):
// set, and declared in the stages asked for ('v', 'f' or 'vf'), once (two
// hooks may both use one)
export function use(shader, names, stages = 'vf') {
  const declare = (source) => names.map(declaration).filter((line) => !source.includes(line)).join('') + source;
  for (const name of names) shader.uniforms[name] = U[name];
  if (stages.includes('v')) shader.vertexShader = declare(shader.vertexShader);
  if (stages.includes('f')) shader.fragmentShader = declare(shader.fragmentShader);
}

// Once a frame: the clock (wind: a storm's, a Vector3), the clouds' drift
// and where the farmers are (Vector3s, up to four) and the animals
// ([{ pos, kind }], the four nearest the first farmer: they push the grass too)
const _near = [];
export function frame(dt, { wind, players = [], animals = [] } = {}) {
  const speed = wind ? wind.length() : 0;
  U.uTime.value += dt * (1 + speed * 0.6); // (the grass sways harder in a storm's wind)
  if (wind) U.uWind.value.set(wind.x, wind.z);
  U.uCloudOffset.value.addScaledVector(U.uWind.value, dt).add({ x: dt * 0.6, y: dt * 0.25 }); // (a breeze when there's no storm)
  const push = U.uPlayers.value;
  push.forEach((p) => p.set(0, -1e4, 0, 0));
  players.slice(0, 4).forEach((at, i) => push[i].set(at.x, at.y - FEET_UP, at.z, 1));
  if (animals.length && players.length) {
    const me = players[0];
    _near.length = 0;
    for (const a of animals) {
      const d = (a.pos.x - me.x) ** 2 + (a.pos.z - me.z) ** 2;
      if (d < 900) _near.push([d, a]);
    }
    _near.sort((p, q) => p[0] - q[0]);
    _near.slice(0, MAX_PUSH - 4).forEach(([, a], i) => push[4 + i].set(a.pos.x, a.pos.y, a.pos.z, a.kind === 'hen' ? 0.55 : 0.9));
  }
}

// Once a view, before it is drawn
export function look(camera) {
  camera.getWorldPosition(U.uCamPos.value);
}

// The day's light (src/daynight.js), for the view being drawn (sky, zenith:
// the sky's colors, copied before the season tints them in place:
// dayNight.sky, src/seasons.js)
export function light({ sunDir, sun, sky, zenith, glow, night, under, cloud, flash = 0, wet = 0, rain = 0, mist = 0 }) {
  U.uSunDir.value.copy(sunDir);
  U.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity);
  U.uSkyHorizon.value.copy(sky);
  U.uSkyZenith.value.copy(zenith);
  U.uSkyGlow.value.copy(glow);
  U.uNight.value = night;
  U.uUnder.value = under;
  U.uCloudAmount.value = cloud;
  U.uFlash.value = flash;
  U.uWet.value = wet * (1 - under);
  U.uRain.value = rain * (1 - under);
  U.uMist.value = mist;
  // round a low sun (sunrise, sunset) the shade goes cooler, so long shadows read blue against the gold
  const low = (1 - THREE.MathUtils.smoothstep(sunDir.y, 0.12, 0.6)) * (1 - night) * (1 - cloud);
  U.uShadowTint.value.copy(SHADE).lerp(SHADE_LOW, low);
}
const SHADE = new THREE.Color(0.8, 0.86, 1.0);
const SHADE_LOW = new THREE.Color(0.7, 0.8, 1.08);
