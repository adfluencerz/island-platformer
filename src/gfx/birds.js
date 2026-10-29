import * as THREE from 'three';
import { U } from './uniforms.js';

// ---------- Birds: a small flock crossing the sky by day ----------
// A loose V of a few birds, far off over the horizon, gliding across whatever
// the camera looks at and flapping now and then. All of it in the vertex
// shader (one mesh, one draw call, one program): each bird a thin V of two
// wings, turned to face the camera (seen from the side, far off, a flat bird
// would vanish edge-on), placed round the camera the way the sky's dome is
// (src/gfx/sky.js), so it never comes near. Dark against the sky, a little
// of the haze in it; none at night, in the rain or underground.
//
//   createBirds()          -> { mesh, update(show), dispose() }
//     show                 how much day there is for them, 0 to 1

export const BIRDS = {
  count: 9,
  dist: 44, // how far off (inside the dome, 50, and the camera's far plane)
  rise: [0.06, 0.11], // how high over the horizon the flock flies, its y going up and down
  span: 0.75, // a wing's length (units)
  period: 70, // seconds to cross the view (and come round again)
  sweep: 0.95, // radians either side of the view it crosses (out of sight at both ends)
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uShow;
  attribute vec4 aBird; // its place in the flock (nearer or further, behind the leader, up) and its own phase
  attribute vec3 aWing; // along the wing (0 at the body, 1 at the tip), which wing (-1, 1), which edge (-1, 1)
  varying float vFade;
  void main() {
    // the camera's heading on the ground: the flock crosses what it looks at
    vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    vec2 head = normalize(fwd.xz + vec2(1e-4, 0.0));
    float crossing = fract(uTime / ${BIRDS.period.toFixed(1)});
    float yaw = atan(head.y, head.x) + mix(-${BIRDS.sweep}, ${BIRDS.sweep}, crossing) + aBird.y;
    float rise = mix(${BIRDS.rise[0]}, ${BIRDS.rise[1]}, 0.5 + 0.5 * sin(uTime * 0.05)) + aBird.z + 0.004 * sin(uTime * 0.7 + aBird.w * 6.0);
    float dist = ${BIRDS.dist.toFixed(1)} + aBird.x;
    vec3 center = cameraPosition + vec3(cos(yaw), rise, sin(yaw)) * dist;
    vec4 mv = viewMatrix * vec4(center, 1.0);
    // the V, in the view's plane: wings raised and lowered as it flaps (a few
    // beats, then a glide), a little wider than tall
    float beat = uTime * 7.0 + aBird.w * 20.0;
    float flap = sin(beat) * step(0.45, fract(uTime * 0.11 + aBird.w));
    float span = ${BIRDS.span.toFixed(2)} * aWing.x;
    vec2 tip = vec2(aWing.y * span, span * (0.32 + 0.45 * flap));
    vec2 along = normalize(vec2(aWing.y, 0.32 + 0.45 * flap));
    vec2 side = vec2(-along.y, along.x);
    float thick = mix(0.11, 0.05, aWing.x) * aWing.z; // (thicker at the body)
    mv.xy += tip + side * thick;
    vFade = uShow;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSkyHorizon;
  varying float vFade;
  void main() {
    // dark against the sky, a little of its haze in them
    gl_FragColor = vec4(mix(uSkyHorizon, vec3(0.08, 0.08, 0.11), 0.72 * vFade), 1.0);
    #include <colorspace_fragment>
  }
`;

// the flock, a loose V trailing its leader: nearer or further (units),
// behind it (radians of the sky), up (radians), and a phase for each bird
function flock(count) {
  const birds = [];
  for (let i = 0; i < count; i++) {
    const rank = Math.ceil(i / 2);
    const side = i === 0 ? 0 : i % 2 ? -1 : 1;
    const r = () => Math.random() - 0.5;
    birds.push([side * rank * 1.4 + r(), -rank * 0.022 + r() * 0.008, side * rank * 0.005 + r() * 0.006, Math.random()]);
  }
  return birds;
}

export function createBirds(count = BIRDS.count) {
  // each bird: two wings, each a thin quad from the body to the tip
  const bird = [];
  const wing = [];
  const index = [];
  flock(count).forEach((b, i) => {
    for (let w = 0; w < 2; w++) {
      const base = (i * 2 + w) * 4;
      for (const [x, z] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
        bird.push(...b);
        wing.push(x, w ? 1 : -1, z);
      }
      index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(bird.length / 4 * 3), 3)); // (unused: the shader places them)
  geo.setAttribute('aBird', new THREE.Float32BufferAttribute(bird, 4));
  geo.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 3));
  geo.setIndex(index);
  const show = { value: 0 };
  const material = new THREE.ShaderMaterial({
    name: 'birds',
    uniforms: { uTime: U.uTime, uSkyHorizon: U.uSkyHorizon, uShow: show },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false, // (as the sky they fly in isn't)
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'birds';
  mesh.frustumCulled = false; // (wherever the camera is)
  mesh.renderOrder = -999; // (just after the sky, before the land in front of them)
  mesh.raycast = () => {};
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return {
    mesh,
    update(amount) {
      show.value = amount;
      mesh.visible = amount > 0.05;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
