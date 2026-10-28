import * as THREE from 'three';

// ---------- The shaders' shared uniforms ----------
// One object per uniform, shared by every material that uses it (a hook adds
// it with use()), so a value set here reaches them all with no per-material
// work. Kept up to date by frame() (once a frame: src/main.js updateWorld),
// look() (once a view: lookFrom) and the day's light (src/daynight.js apply).

const MAX_PLAYERS = 4;

export const U = {
  uTime: { value: 0 }, // the wind's clock (seconds, faster in a storm): the grass's sway, the water's ripples
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, // toward the sun (or the moon at night), world space
  uSunColor: { value: new THREE.Color(1, 1, 1) }, // its light, times its intensity
  uSkyZenith: { value: new THREE.Color(0x87ceeb) },
  uSkyHorizon: { value: new THREE.Color(0x87ceeb) },
  uSkyGlow: { value: new THREE.Color(1, 1, 1) }, // round the sun
  uNight: { value: 0 }, // 0 by day, 1 at night
  uUnder: { value: 0 }, // how far underground this view is, 0 to 1
  uCloudAmount: { value: 0 }, // how overcast, 0 to 1
  uCloudOffset: { value: new THREE.Vector2() }, // how far the clouds have drifted (world units)
  uWind: { value: new THREE.Vector2() }, // a storm's wind, xz (units a second)
  uPlayers: { value: Array.from({ length: MAX_PLAYERS }, () => new THREE.Vector4(0, -1e4, 0, 0)) }, // the farmers here: xyz, w 1 (0: none)
  uCamPos: { value: new THREE.Vector3() }, // this view's camera, world space
  uFogHeight: { value: 0 },
  uShadowTint: { value: new THREE.Color(0.62, 0.7, 0.92) },
  uWrap: { value: 0 },
  uToon: { value: 0 },
};

const TYPES = {
  uTime: 'float', uSunDir: 'vec3', uSunColor: 'vec3', uSkyZenith: 'vec3', uSkyHorizon: 'vec3', uSkyGlow: 'vec3',
  uNight: 'float', uUnder: 'float', uCloudAmount: 'float', uCloudOffset: 'vec2', uWind: 'vec2',
  uPlayers: `vec4[${MAX_PLAYERS}]`, uCamPos: 'vec3', uFogHeight: 'float', uShadowTint: 'vec3', uWrap: 'float', uToon: 'float',
};

const declaration = (name) => {
  const type = TYPES[name];
  if (!type) throw new Error(`gfx: no uniform ${name}`);
  const [base, count] = type.split(/[[\]]/);
  return `uniform ${base} ${name}${count ? `[${count}]` : ''};\n`;
};

// The shared uniforms `names` in a shader being compiled (a hook's onBeforeCompile):
// set, and declared in the stages asked for ('v', 'f' or 'vf')
export function use(shader, names, stages = 'vf') {
  let head = '';
  for (const name of names) {
    shader.uniforms[name] = U[name];
    head += declaration(name);
  }
  if (stages.includes('v')) shader.vertexShader = head + shader.vertexShader;
  if (stages.includes('f')) shader.fragmentShader = head + shader.fragmentShader;
}

// Once a frame: the clock (wind: a storm's, a Vector3), the clouds' drift
// and where the farmers are (Vector3s, up to four)
export function frame(dt, { wind, players = [] } = {}) {
  const speed = wind ? wind.length() : 0;
  U.uTime.value += dt * (1 + speed * 0.6); // (the grass sways harder in a storm's wind)
  if (wind) U.uWind.value.set(wind.x, wind.z);
  U.uCloudOffset.value.addScaledVector(U.uWind.value, dt).add({ x: dt * 0.6, y: dt * 0.25 }); // (a breeze when there's no storm)
  U.uPlayers.value.forEach((p, i) => (players[i] ? p.set(players[i].x, players[i].y, players[i].z, 1) : p.set(0, -1e4, 0, 0)));
}

// Once a view, before it is drawn
export function look(camera) {
  camera.getWorldPosition(U.uCamPos.value);
}

// The day's light (src/daynight.js), for the view being drawn
export function light({ sunDir, sun, sky, zenith, glow, night, under, cloud }) {
  U.uSunDir.value.copy(sunDir);
  U.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity);
  U.uSkyHorizon.value.copy(sky);
  U.uSkyZenith.value.copy(zenith);
  U.uSkyGlow.value.copy(glow);
  U.uNight.value = night;
  U.uUnder.value = under;
  U.uCloudAmount.value = cloud;
}
