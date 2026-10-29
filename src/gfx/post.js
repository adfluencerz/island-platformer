import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U } from './uniforms.js';

// ---------- Post-processing: bloom, a color grade, anti-aliasing ----------
// On medium and high (the tier's `post` knob, src/gfx/quality.js); low draws
// straight to the screen as it always has (src/main.js draw()).
//
//   seats -> bloom -> grade (to the screen), each frame, through an EffectComposer:
//   - SeatsPass: every seat's view into its part of one half-float target
//     (multisampled on high: the canvas's own antialias doesn't reach a
//     target), with the split screen's gap line between them. Drawn exactly
//     as it would be on the screen: tone mapped, in the screen's color space,
//     the fog and the sky dome (not tone mapped, mixed in after) and every
//     transparent thing blended as they are there (the target says it is
//     the screen's: see SeatsPass). So every tier looks the same before its
//     post, and the far land still meets the sky.
//   - bloom (three's UnrealBloomPass) on what is near white: the sun, the
//     glints, bright cloud tops; at night and underground its threshold falls,
//     so the lamps, the windows and the torches glow. Half-res on medium.
//   - grade: a touch of saturation (less at night, in the dark), a soft
//     vignette (round each seat's own view), a tint warm by day and cool at
//     night, leaning toward the sky;
//     written to the screen as it is (the target is in its color space already:
//     no OutputPass, which would tone map and encode a second time).
//
//   createPost(renderer, { seats, view, gap })
//     seats()            the seats now ({ rect } in CSS pixels, as layout() sets them)
//     view(seat, split)  draws `seat`'s view into the target bound now
//     gap                the split screen's line color
//   -> { on, apply(knobs), setSize(), render(), dispose() }

// The look (uniforms: tweak live through window.__game.post.grade.uniforms)
export const POST = {
  bloom: { strength: 0.22, radius: 0.35, threshold: 0.92, nightThreshold: 0.72, underThreshold: 0.8 }, // (thresholds: the screen's brightness, 0..1; underground a little higher, so the glows bloom and the room stays dark)
  saturation: 1.08,
  nightSaturation: 0.62, // (at night the dark parts go grey-blue, as the eye sees by moonlight; what a lamp lights keeps its color. The low tier: src/gfx/light.js)
  vignette: 0.2,
  warm: new THREE.Color(1.02, 1.0, 0.97), // (the day's tint)
  cool: new THREE.Color(0.95, 0.98, 1.05), // (the night's)
  skyTint: 0.08, // (how far the tint leans toward the sky's horizon color)
};

const MAX_SEATS = 4;
const WHITE = new THREE.Color(1, 1, 1);

// Every seat's view, into its part of the target (in the target's own pixels:
// renderer.setViewport would multiply by the pixel ratio again)
class SeatsPass extends Pass {
  constructor(seats, view, gap) {
    super();
    Object.assign(this, { seats, view, gap, needsSwap: false, samples: 0 });
    this.empty = new THREE.Scene(); // (a render of nothing: clears to the gap and resolves the whole target)
    this.eye = new THREE.Camera();
  }

  render(renderer, writeBuffer, readBuffer) {
    const target = readBuffer;
    if (target.samples !== this.samples) {
      target.samples = this.samples; // (made again, on its next use)
      target.dispose();
    }
    const seats = this.seats();
    const split = seats.length > 1;
    const { width: tw, height: th } = target;
    const { innerWidth: w, innerHeight: h } = window;
    const sx = tw / w;
    const sy = th / h;
    const full = () => {
      target.viewport.set(0, 0, tw, th);
      target.scissor.set(0, 0, tw, th);
      target.scissorTest = false;
    };
    // As the screen is drawn: three tone maps, and writes in the screen's
    // color space, only what is drawn to the screen or to an XR target (whose
    // texture's color space it takes), so for the seats the target says it is
    // one (a half-float target: no sRGB format, the values are stored as written)
    target.texture.colorSpace = renderer.outputColorSpace;
    target.isXRRenderTarget = true;
    try {
      if (split) {
        full();
        renderer.setRenderTarget(target);
        renderer.setClearColor(this.gap);
        renderer.render(this.empty, this.eye);
      }
      for (const seat of seats) {
        const { x, y, w: vw, h: vh } = seat.rect;
        if (split) {
          const x0 = Math.round(x * sx);
          const y0 = Math.round((h - y - vh) * sy);
          target.viewport.set(x0, y0, Math.round((x + vw) * sx) - x0, Math.round((h - y) * sy) - y0);
          target.scissor.copy(target.viewport);
          target.scissorTest = true;
        } else full();
        renderer.setRenderTarget(target);
        this.view(seat, split);
      }
    } finally {
      target.isXRRenderTarget = false;
      target.texture.colorSpace = THREE.NoColorSpace; // (what is read from it is used as it is)
      full(); // (bloom, grade and output: the whole of it)
      renderer.setRenderTarget(target);
    }
  }

  dispose() {}
}

const gradeMaterial = () => new THREE.ShaderMaterial({
  name: 'GfxGrade',
  toneMapped: false, // (done already, as the scene was drawn)
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: POST.saturation },
    uNightSaturation: { value: POST.nightSaturation },
    uNight: { value: 0 }, // (how much night there is to see: none underground)
    uVignette: { value: POST.vignette },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uSeats: { value: Array.from({ length: MAX_SEATS }, () => new THREE.Vector4(0, 0, 1, 1)) }, // (each view: x, y, w, h in 0..1, from the bottom left)
    uSeatCount: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uNightSaturation;
    uniform float uNight;
    uniform float uVignette;
    uniform vec3 uTint;
    uniform vec4 uSeats[${MAX_SEATS}];
    uniform int uSeatCount;
    varying vec2 vUv;
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      float sat = uSaturation * mix(1.0, uNightSaturation, uNight * (1.0 - smoothstep(0.25, 0.7, luma))); // (dark: by moonlight)
      col.rgb = max(mix(vec3(luma), col.rgb, sat), 0.0) * uTint;
      // the vignette, round the view this pixel is in
      vec4 part = uSeats[0];
      for (int i = 1; i < ${MAX_SEATS}; i++) {
        vec4 s = uSeats[i];
        if (i < uSeatCount && vUv.x >= s.x && vUv.y >= s.y && vUv.x < s.x + s.z && vUv.y < s.y + s.w) part = s;
      }
      vec2 p = (vUv - part.xy) / part.zw * 2.0 - 1.0;
      col.rgb *= 1.0 - uVignette * smoothstep(0.45, 1.45, length(p));
      gl_FragColor = col;
    }
  `,
});

export function createPost(renderer, { seats, view, gap }) {
  let composer = null;
  let seatsPass, bloom, grade;
  let knobs = null;
  const size = new THREE.Vector2();
  const tint = new THREE.Color();
  const sky = new THREE.Color();

  function make() {
    renderer.getDrawingBufferSize(size);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: true });
    composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(1); // (sized in the canvas's own pixels: setSize)
    seatsPass = new SeatsPass(seats, view, gap);
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), POST.bloom.strength, POST.bloom.radius, POST.bloom.threshold);
    const bloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => {
      const s = knobs?.post === 'half' ? 0.5 : 1;
      bloomSize(Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s)));
    };
    grade = new ShaderPass(gradeMaterial());
    for (const pass of [seatsPass, bloom, grade]) composer.addPass(pass);
    post.grade = grade;
    post.bloom = bloom;
  }

  function drop() {
    if (!composer) return;
    for (const pass of composer.passes) pass.dispose();
    grade.material.dispose();
    composer.dispose();
    composer = null;
    post.grade = post.bloom = null;
  }

  // The seats' parts for the grade's vignette (0..1, from the bottom left)
  function seatParts() {
    const list = seats();
    const { innerWidth: w, innerHeight: h } = window;
    const u = grade.uniforms;
    u.uSeatCount.value = Math.min(list.length, MAX_SEATS);
    list.slice(0, MAX_SEATS).forEach((seat, i) => {
      const { x, y, w: vw, h: vh } = seat.rect;
      u.uSeats.value[i].set(x / w, (h - y - vh) / h, vw / w, vh / h);
    });
  }

  const post = {
    get on() {
      return composer !== null;
    },
    grade: null,
    bloom: null,
    // the tier's knobs (post 'off' | 'half' | 'full', msaa)
    apply(k) {
      knobs = k;
      if (k.post === 'off') return drop();
      if (!composer) make();
      seatsPass.samples = k.msaa;
      post.setSize();
    },
    // after the canvas is resized (layout()) or its pixel ratio changes
    setSize() {
      if (!composer) return;
      renderer.getDrawingBufferSize(size);
      composer.setSize(size.x, size.y);
    },
    render() {
      const { threshold, nightThreshold, underThreshold } = POST.bloom;
      bloom.threshold = THREE.MathUtils.lerp(THREE.MathUtils.lerp(threshold, nightThreshold, U.uNight.value), underThreshold, U.uUnder.value);
      // the tint: warm by day, cool at night, leaning toward the sky's own color
      // (its hue: the horizon over its brightness), none underground
      sky.copy(U.uSkyHorizon.value);
      const luma = Math.max(0.2126 * sky.r + 0.7152 * sky.g + 0.0722 * sky.b, 1e-3);
      sky.multiplyScalar(1 / luma);
      sky.r = Math.min(sky.r, 1.6);
      sky.g = Math.min(sky.g, 1.6);
      sky.b = Math.min(sky.b, 1.6);
      tint.copy(POST.warm).lerp(POST.cool, U.uNight.value).lerp(sky, POST.skyTint).lerp(WHITE, U.uUnder.value);
      grade.uniforms.uTint.value.copy(tint);
      grade.uniforms.uNight.value = U.uNight.value * (1 - U.uUnder.value);
      seatParts();
      renderer.setScissorTest(false); // (the screen's own, for the output: a split screen drawn straight leaves it on)
      renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      composer.render(0);
    },
    dispose: drop,
  };
  return post;
}
