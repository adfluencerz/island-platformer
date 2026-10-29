import * as THREE from 'three';
import { hook, hasHook } from './gfx/shading.js';
import { patch, define } from './gfx/chunks.js';
import { U } from './gfx/uniforms.js';

// ---------- Seasons on the farm ----------
// The farm's year goes round in four seasons of SEASON_DAYS game days each,
// and on a season's last day it turns, a little at a time, into the next:
//
//   Spring   fresh green grass, trees in pink and white blossom among the
//            green ones, flowers out, petals on the breeze, a soft light
//   Summer   deep green under a warm, golden sun, bits of fluff drifting
//   Autumn   the grass gone gold, the leaves orange and red and falling,
//            lying in drifts under the trees; the flowers fading; amber light
//   Winter   snow on all that faces up (the ground, the trees' tops, rocks,
//            roofs, fences, platforms), the grass sunk under it, bare trees,
//            no flowers, flakes in the air and a cool, clear light
//
// The farm's own materials take the colors (src/maps.js HOME: its leaves,
// needles, ground, grass tufts, turf and flowers, so a lobby's island keeps
// its own), and the grass and the snow are drawn by a few lines added to the
// shaders of the farm's materials (seasonal(), below): the green of the
// ground turns, and a surface turned up whitens with snow (a path, or stone,
// less: it was walked on). Snow keeps off what moves (the animals, the
// merchant), the house's room and the bosses' arenas. The clock says which
// season it is. Just for looks: crops grow the same all year.
export const SEASON_DAYS = 7;

// leaves: the farm's four leaf colors (a tree or bush wears one); pines: its
// three needle colors; grass: how its grass looks; flowers: how much its
// flowers show (1: out, 0: gone); snow: how much lies (0 to 1); light: the
// sunlight, the sky's light, and the sky and haze, each times this; fall:
// what drifts through the air (FALLING), and how much of it; patches: the
// grass's color in patches across the farm (the grass's own where none);
// sky: the sky, its haze and the fog drawn toward this color, this much,
// after the light's tint (a winter's pale, an autumn's warm haze; none in
// spring and summer)
export const SEASONS = [
  {
    name: 'Spring',
    leaves: [0x6cbf4a, 0xf4b6cf, 0x5aa83f, 0xfbe0ea],
    pines: [0x2c6b3f, 0x24603a, 0x34784a],
    grass: 0x6db345,
    flowers: 1,
    snow: 0,
    light: { sun: 0xfffaf2, sky: 0xf4faff, haze: 0xffffff },
    fall: ['petal', 36],
  },
  {
    name: 'Summer',
    leaves: [0x3a8034, 0x2f7a45, 0x4a9038, 0x357a30],
    pines: [0x285f38, 0x215634, 0x306c42],
    grass: 0x5e9a32,
    flowers: 1,
    snow: 0,
    light: { sun: 0xfff0d2, sky: 0xffffff, haze: 0xfffaf0 },
    fall: ['fluff', 24],
  },
  {
    name: 'Autumn',
    leaves: [0xe0892d, 0xc4502b, 0xeab038, 0xa8512e],
    pines: [0x2a5a38, 0x245034, 0x33663f],
    grass: 0xb39c46,
    patches: 0xa8743a,
    flowers: 0.35,
    snow: 0,
    light: { sun: 0xffd9a8, sky: 0xfff0dc, haze: 0xffecd2 },
    sky: [0xf2d6a2, 0.2],
    fall: ['leaf', 70],
    turn: 1, // (the leaves: AUTUMN_LEAVES)
  },
  {
    name: 'Winter',
    leaves: [0x3c5a48, 0x6a5a4e, 0x34523f, 0x5e5a48], // (dark under the snow: evergreen, or bare and brown)
    pines: [0x24503a, 0x1f4733, 0x2b5a42],
    grass: 0x8a9a74,
    flowers: 0,
    snow: 1,
    // (the sun warm on the snow's lit tops, the sky's light blue in its shade)
    light: { sun: 0xfff1de, sky: 0xd2deff, haze: 0xe8eef6 },
    sky: [0xdce6f0, 0.55],
    fall: ['flake', 100],
  },
];

// What drifts down (or about): its size (m), how fast it falls (m a
// second: below 0 rises), how far it sways and how fast it turns, its colors
const FALLING = {
  petal: { size: [0.1, 0.07], speed: 0.45, sway: 0.8, spin: 2.2, colors: [0xfbe0ea, 0xf4b6cf, 0xffffff] },
  fluff: { size: [0.05, 0.05], speed: -0.08, sway: 0.5, spin: 0.6, colors: [0xfffbe8, 0xfff2c4] },
  leaf: { size: [0.16, 0.11], speed: 0.75, sway: 1.1, spin: 3, colors: [0xe0892d, 0xc4502b, 0xeab038, 0xa8512e] },
  flake: { size: [0.07, 0.07], speed: 0.6, sway: 0.35, spin: 1, colors: [0xffffff, 0xeef4ff] },
};
const MOST_FALLING = 100;
const AREA = 26; // they drift in a square this wide round the farmer...
const HIGH = 9; // ...from this high over them, down to their feet
const DRIFTS = 34; // autumn's fallen leaves under a tree (with leaves: not a pine)
const DRIFTS_OUT = [0.4, 3]; // how far out from its trunk they lie
const GRASS = new THREE.Color(0x5d9b3a); // the farm's grass as it is made (src/maps.js)
const SNOW_SKIP = new Set(['house-room', 'boss-arenas', 'boss-dungeons', 'npc-room']); // (indoors, and the arenas and dungeons: their own looks)
// The farm's own autumn: each tree and bush with leaves one of these, by
// where it stands (as a wild autumn island's, src/maps.js THEMES.autumn: here
// more gold and amber, fewer deep reds, a few still green), over the season's
// leaf colors while it is autumn (the leaf hook, seasonal() below)
export const AUTUMN_LEAVES = [0xb83a20, 0xd0532a, 0xe0782c, 0xea962e, 0xeeb234, 0xf2c640, 0xc8962e, 0x93a03a];
const RESCAN = 3;
const NO_SKY = [0xffffff, 0];
// The snow (linear, past white: it lies brighter than anything round it, and
// the light makes it warm on top and blue in its shade), and trodden snow
// (packed down on the paths and the plaza, a little of the ground showing)
const SNOW = 'vec3(1.42, 1.42, 1.46)';
const TROD = 'vec3(1.08, 1.08, 1.16)';
const luma = (c) => Math.max(1e-4, c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722); // seconds between looks for new things for the snow to lie on (things built)

// The season on game day `day` (1, 2, ...) at `hour`: { now, next, blend, into }
// (blend: how far it has turned into the next one, 0 till its last day;
// into: how many days into it, 0 to SEASON_DAYS)
export function seasonAt(day, hour) {
  const days = day - 1 + hour / 24;
  const i = Math.floor(days / SEASON_DAYS);
  const into = days - i * SEASON_DAYS; // (days into this one)
  return {
    now: SEASONS[i % SEASONS.length],
    next: SEASONS[(i + 1) % SEASONS.length],
    blend: THREE.MathUtils.clamp(into - (SEASON_DAYS - 1), 0, 1),
    into,
  };
}

// ---------- The farm's materials, seasonal ----------
// Every material that is: how much snow lies (0 to 1), the grass's color
// (the season's, as bright as the green it takes the place of is) and its
// patches' (autumn's: russet among the gold), and how far the leaves have
// turned to AUTUMN_LEAVES (0 to 1)
const uSnow = { value: 0 };
const uGrass = { value: new THREE.Color(GRASS) };
const uGrassPatch = { value: new THREE.Color(GRASS) };
const uLeafTurn = { value: 0 };
const uLeafPalette = { value: AUTUMN_LEAVES.map((hex) => new THREE.Color(hex)) };

// Which of AUTUMN_LEAVES a tree or bush standing at x, z wears: a hash of
// where it stands, the same in the leaf hook's vertex shader (so the leaves
// lying under a tree are its own colors)
const LEAF_HASH = `
  highp float seasonHash(highp vec2 p) {
    highp vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }`;
const fract = (v) => v - Math.floor(v);
export function leafPick(x, z) {
  let [a, b, c] = [fract(x * 0.1031), fract(z * 0.1031), fract(x * 0.1031)];
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  [a, b, c] = [a + d, b + d, c + d];
  return Math.min(AUTUMN_LEAVES.length - 1, Math.floor(fract((a + b) * c) * AUTUMN_LEAVES.length));
}

// A few lines in a material's shader: snow on its surfaces facing up (more
// of them, the edge soft and wavering, so it lies thick on the crowns, the
// pines' skirts and the roofs) and, with grass, its greens turned, in patches
// (a path's brown and stone's grey stay, and the snow on them is trodden:
// greyer, packed, a little of the ground showing; where a path meets the
// grass, the grass shows at its edge); trod: all of it trodden (the plaza's
// slabs); sink: grass blades go down under the snow; leaf: a tree's or
// bush's leaves turn to its own of AUTUMN_LEAVES (uLeafTurn). After any hooks
// it had already (the grass's sway: world.js addWind).
function seasonal(material, { grass = false, sink = false, trod = false, leaf = false } = {}) {
  if (hasHook(material, /^season/)) return;
  const options = [grass && 'grass', sink && 'sink', trod && 'trod', leaf && 'leaf'].filter(Boolean);
  hook(material, `season${options.length ? `:${options.join(',')}` : ''}`, (shader) => {
    define(shader, 'GFX_SEASON');
    Object.assign(shader.uniforms, { uSnow, uGrass, uGrassPatch, uLeafTurn, uLeafPalette });
    if (sink) {
      shader.vertexShader = 'uniform float uSnow;\n' + patch(shader.vertexShader, 'begin_vertex', 'transformed.y *= 1.0 - 0.85 * uSnow;', 'GFX_SEASON');
    }
    if (leaf) {
      shader.vertexShader = `uniform vec3 uLeafPalette[${AUTUMN_LEAVES.length}];\nvarying vec3 vSeasonLeaf;\n${LEAF_HASH}\n` + patch(shader.vertexShader, 'begin_vertex', `
        #ifdef USE_INSTANCING
          highp vec2 seasonAt = (modelMatrix * instanceMatrix[3]).xz;
        #else
          highp vec2 seasonAt = modelMatrix[3].xz;
        #endif
        vSeasonLeaf = uLeafPalette[int(min(seasonHash(seasonAt) * ${AUTUMN_LEAVES.length.toFixed(1)}, ${(AUTUMN_LEAVES.length - 1).toFixed(1)}))];`, 'GFX_SEASON');
    }
    shader.fragmentShader = `uniform float uSnow;\nuniform vec3 uGrass;\nuniform vec3 uGrassPatch;\n${leaf ? 'uniform float uLeafTurn;\nvarying vec3 vSeasonLeaf;\n' : ''}const vec3 seasonLum = vec3(0.2126, 0.7152, 0.0722);\n#define SEASON_SNOW ${SNOW}\n#define SEASON_TROD ${TROD}\nconst float seasonGrassLum = ${GRASS.r * 0.2126 + GRASS.g * 0.7152 + GRASS.b * 0.0722};\n` + shader.fragmentShader;
    shader.fragmentShader = patch(shader.fragmentShader, 'color_fragment', `
        float seasonCover = 1.0;
        float seasonTrod = ${trod ? '1.0' : '0.0'};
        ${grass ? `
        float seasonGreen = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
        // (how green it was, for its brightness: a path's brown and stone's grey not at all)
        float seasonGrassy = smoothstep(0.08, 0.3, (diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) / max(diffuseColor.g, 0.01));
        vec3 seasonGrass = uGrass;
        #ifdef GFX_WORLD
          float seasonPatch = smoothstep(-0.3, 0.6, sin(vGfxWorld.x * 0.21 + sin(vGfxWorld.z * 0.17) * 2.3) * sin(vGfxWorld.z * 0.23 + sin(vGfxWorld.x * 0.13) * 1.9));
          seasonGrass = mix(uGrass, uGrassPatch, seasonPatch);
        #endif
        diffuseColor.rgb = mix(diffuseColor.rgb, seasonGrass * (dot(diffuseColor.rgb, seasonLum) / seasonGrassLum), seasonGreen * 0.9);
        seasonTrod = 1.0 - seasonGrassy;
        seasonCover = 1.0 - 0.5 * smoothstep(0.1, 0.4, seasonGrassy) * (1.0 - smoothstep(0.45, 0.8, seasonGrassy));` : ''}
        ${leaf ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vSeasonLeaf * diffuseColor.rgb / max(diffuse, vec3(1e-3)), uLeafTurn);' : ''}`, 'GFX_SEASON');
    shader.fragmentShader = patch(shader.fragmentShader, 'normal_fragment_maps', `
        float seasonUp = inverseTransformDirection(normal, viewMatrix).y;
        #ifdef GFX_WORLD
          seasonUp += 0.07 * (sin(vGfxWorld.x * 3.1 + sin(vGfxWorld.z * 2.3) * 1.5) + sin(vGfxWorld.z * 2.7 + vGfxWorld.y * 3.3));
        #endif
        #ifdef GFX_WORLD
          seasonTrod *= 0.8 + 0.2 * sin(vGfxWorld.x * 1.3 + sin(vGfxWorld.z * 1.1) * 2.0) * sin(vGfxWorld.z * 1.7 + vGfxWorld.x * 0.4); // (packed down in patches)
        #endif
        vec3 seasonWhite = mix(SEASON_SNOW, mix(SEASON_TROD, diffuseColor.rgb, 0.18), seasonTrod);
        diffuseColor.rgb = mix(diffuseColor.rgb, seasonWhite, uSnow * seasonCover * smoothstep(0.12, 0.62, seasonUp));`, 'GFX_SEASON');
  });
}

// Snow for everything under root that stays put: what a material's shader
// can take (lit, not see-through, not snowed on already) and isn't kept off
// (SNOW_SKIP by name, or userData.noSnow: the animals, the merchant, the
// water, the items, the farmers)
function snowOn(obj) {
  if (obj.userData.noSnow || SNOW_SKIP.has(obj.name)) return; // (nor anything in it)
  if (obj.isMesh) {
    for (const m of [obj.material].flat()) {
      if (hasHook(m, /^season/) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      if (m.transparent || m.userData.noSnow) continue;
      seasonal(m, { trod: hasHook(m, 'ground:slab') }); // (the plaza's slabs: walked on)
    }
  }
  for (const child of obj.children) snowOn(child);
}

// map: the farm's map (its leafMats, pineMats, tuftMat, carpetMat, groundMat, turfMat, cliffMat
// and flower materials)
export function createSeasons(map) {
  const a = new THREE.Color();
  const b = new THREE.Color();
  const tint = new THREE.Color();
  const mix = (from, to, t, out) => out.copy(a.setHex(from)).lerp(b.setHex(to), t);
  for (const m of [map.groundMat, map.turfMat, map.cliffMat]) if (m) seasonal(m, { grass: true });
  for (const m of [map.flowerHeadMat, map.flowerStemMat]) m?.userData && (m.userData.base = m.color.clone());

  let state = null; // the last update's: { now, next, blend, into, night }
  let lit = null; // { root, trees, sun, hemi, scene } once attach()ed
  let scanIn = 0;
  let elapsed = 0;
  let drifts = null;
  let driftsAt = -1; // (how much of them shows now)
  let driftsLift = 0;
  let falling = null;

  const blendOf = (key) => THREE.MathUtils.lerp(state.now[key] ?? 0, state.next[key] ?? 0, state.blend);

  // Autumn's leaves, lying under the trees: as many as `amount` of them (0 to 1)
  function showDrifts(amount) {
    const lift = U.uCarpet.value > 0 ? 0.16 : 0; // (on the grass carpet's blades, where the tier has one: not hidden under them)
    if (!drifts || (Math.abs(amount - driftsAt) < 0.02 && lift === driftsLift)) return;
    driftsAt = amount;
    driftsLift = lift;
    const m = new THREE.Matrix4();
    drifts.mesh.userData.spots.forEach(([tree, ang, out, turn, k], i) => {
      const s = k * THREE.MathUtils.clamp(amount * DRIFTS - (i % DRIFTS), 0, 1); // (one by one, as the days go)
      const x = tree.x + Math.cos(ang) * out; // (under the tree where it stands now: one grows back elsewhere)
      const z = tree.z + Math.sin(ang) * out;
      m.makeRotationFromEuler(_e.set(((i % 5) - 2) * 0.12, turn, 0)).scale(_s.set(s, 1, s)).setPosition(x, tree.group.position.y + 0.025 + (i % 3) * 0.004 + lift * (1 + (i % 4) * 0.12), z);
      drifts.mesh.setMatrixAt(i, m);
    });
    drifts.mesh.instanceMatrix.needsUpdate = true;
    drifts.mesh.visible = amount > 0;
  }

  // What drifts in the air round the farmer: the season's, turning into
  // the next's on its last day; fewer at night
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();
  const wrap = (v) => ((((v + AREA / 2) % AREA) + AREA) % AREA) - AREA / 2;
  function drift(focus) {
    const { mesh, seeds } = falling;
    const fewer = 1 - state.night * 0.6;
    const [kindA, countA] = state.now.fall;
    const [kindB, countB] = state.next.fall;
    const nA = Math.round(countA * (1 - state.blend) * fewer);
    const nB = Math.min(MOST_FALLING - nA, Math.round(countB * state.blend * fewer));
    for (let i = 0; i < nA + nB; i++) {
      const f = FALLING[i < nA ? kindA : kindB];
      const [bx, bz, phase, turn] = seeds[i];
      const t = elapsed + phase * 50;
      const y = ((((phase * HIGH - t * f.speed) % HIGH) + HIGH) % HIGH) - 0.3; // (from HIGH down to the feet, again and again)
      _p.set(
        focus.x + wrap(bx + Math.sin(t * 0.7 + turn) * f.sway - focus.x),
        focus.y - 0.8 + y,
        focus.z + wrap(bz + Math.cos(t * 0.5 + turn * 2) * f.sway - focus.z),
      );
      _q.setFromEuler(_e.set(t * f.spin + turn, t * f.spin * 0.7, turn));
      _m.compose(_p, _q, _s.set(f.size[0], f.size[1], 1));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.setHex(f.colors[i % f.colors.length]));
    }
    mesh.count = nA + nB;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // The season's light, over the day's (daynight.js sets that first)
  function light() {
    const { now, next, blend } = state;
    const { sun, hemi, scene, sky } = lit;
    sun.color.multiply(mix(now.light.sun, next.light.sun, blend, tint));
    hemi.color.multiply(mix(now.light.sky, next.light.sky, blend, tint));
    hemi.groundColor.multiplyScalar(1 + uSnow.value * 0.7); // (light off the snow)
    mix(now.light.haze, next.light.haze, blend, tint);
    scene.background.multiply(tint);
    scene.fog.color.multiply(tint);
    if (sky) for (const c of [sky.horizon, sky.zenith]) c.multiply(tint); // (the sky dome's, so it still meets the fog)
    // (a winter's pale sky, an autumn's warm haze: the colors drawn toward
    // the season's, as bright as they are, so a night stays dark)
    const [hexA, amountA] = now.sky ?? NO_SKY;
    const [hexB, amountB] = next.sky ?? NO_SKY;
    const amount = THREE.MathUtils.lerp(amountA, amountB, blend);
    if (amount <= 0) return;
    mix(amountA > 0 ? hexA : hexB, amountB > 0 ? hexB : hexA, blend, tint);
    const toward = (c, k) => c.lerp(_c.copy(tint).multiplyScalar(luma(c) / luma(tint)), k);
    toward(scene.background, amount);
    toward(scene.fog.color, amount);
    if (sky) {
      toward(sky.horizon, amount);
      toward(sky.zenith, amount * 0.8);
    }
  }
  let shown = false; // (on the farm, lit: frame())

  return {
    // Once the farm is built: root, its world's root (snow on what is in it);
    // trees: its trees (world.js: autumn's leaves lie under them); sun, hemi,
    // scene: the light and the sky, for the season's (sky: dayNight.sky, the
    // sky dome's colors)
    attach({ root, trees = [], sun, hemi, scene, sky }) {
      lit = { root, sun, hemi, scene, sky };
      if (map.tuftMat) seasonal(map.tuftMat, { grass: true, sink: true }); // (once world.js has made it sway)
      if (map.carpetMat) seasonal(map.carpetMat, { grass: true, sink: true });
      for (const m of map.leafMats) seasonal(m, { leaf: true }); // (their trees' and bushes' own autumn colors)
      snowOn(root);
      // (autumn's leaves, under the trees with leaves)
      const spots = [];
      const rand = mulberry(4242);
      for (const t of trees) {
        if (t.kind === 'pine') continue;
        for (let i = 0; i < DRIFTS; i++) {
          const ang = rand() * Math.PI * 2;
          const out = THREE.MathUtils.lerp(...DRIFTS_OUT, Math.sqrt(rand())) * t.scale;
          spots.push([t, ang, out, rand() * Math.PI * 2, 0.8 + rand() * 0.6]);
        }
      }
      const leafGeo = new THREE.PlaneGeometry(0.5, 0.34).rotateX(-Math.PI / 2); // (a little drift of them: read from the play camera)
      const mesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial(), Math.max(1, spots.length));
      // (the tree's own color, as its crown has turned, a few its neighbors' in the palette, each a shade of its own)
      spots.forEach(([t], i) => {
        const pick = (leafPick(t.x, t.z) + (i % 4 === 3 ? 1 : 0)) % AUTUMN_LEAVES.length;
        mesh.setColorAt(i, _c.setHex(AUTUMN_LEAVES[pick]).multiplyScalar(0.72 + ((i * 37) % 11) / 30));
      });
      mesh.userData.spots = spots;
      mesh.userData.noSnow = true; // (the snow covers them up: they're gone by then)
      mesh.receiveShadow = true;
      mesh.visible = false;
      root.add(mesh);
      drifts = { mesh };
      // (what drifts in the air)
      const air = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x2a2a2a }), MOST_FALLING);
      air.frustumCulled = false; // (they move round the farmer every frame)
      air.userData.noSnow = true;
      air.count = 0;
      air.setColorAt(0, _c.setHex(0xffffff));
      root.add(air);
      falling = { mesh: air, seeds: Array.from({ length: MOST_FALLING }, () => [(rand() - 0.5) * AREA, (rand() - 0.5) * AREA, rand(), rand() * Math.PI * 2]) };
    },

    // Every frame on the farm: the colors for game day `day` at `hour`
    // (night: 0 by day, 1 at night). The season's name.
    update(day, hour, night) {
      state = { ...seasonAt(day, hour), night };
      const { now, next, blend } = state;
      map.leafMats.forEach((m, i) => mix(now.leaves[i % now.leaves.length], next.leaves[i % next.leaves.length], blend, m.color));
      map.pineMats.forEach((m, i) => mix(now.pines[i % now.pines.length], next.pines[i % next.pines.length], blend, m.color));
      mix(now.grass, next.grass, blend, uGrass.value);
      mix(now.patches ?? now.grass, next.patches ?? next.grass, blend, uGrassPatch.value);
      uLeafTurn.value = blendOf('turn');
      // the flowers: out, fading (browner, warmer), or gone
      const flowers = blendOf('flowers');
      const heads = map.flowerHeadMat;
      const stems = map.flowerStemMat;
      if (heads && stems) {
        heads.visible = stems.visible = flowers > 0.05;
        heads.color.copy(heads.userData.base).lerp(tint.setRGB(1, 0.62, 0.38), 1 - flowers);
        stems.color.copy(stems.userData.base).lerp(tint.setHex(0x8a7a3a), 1 - flowers);
      }
      return blend < 0.5 ? now.name : next.name;
    },

    // Every frame, after the day's light is set (daynight.js): on the farm
    // (focus: where the farmer is, or null in the house), the season's light,
    // snow, fallen leaves and what drifts in the air; off it (home false: a
    // lobby), none of them
    frame(dt, { home, focus }) {
      elapsed += dt;
      shown = home && !!state && !!lit;
      uSnow.value = shown ? blendOf('snow') : 0;
      if (!lit) return;
      if (falling) falling.mesh.visible = shown && !!focus;
      if (!shown) return;
      // (new things to lie on: what was built)
      if ((scanIn -= dt) <= 0) {
        scanIn = RESCAN;
        snowOn(lit.root);
      }
      light();
      // autumn's leaves on the ground (more of them as it goes on), gone under the snow
      const { now, next, blend } = state;
      const autumn = now.name === 'Autumn' ? Math.min(1, (state.into + 1) / 4) : next.name === 'Autumn' ? blend * 0.25 : 0;
      showDrifts(autumn * (1 - uSnow.value));
      if (focus) drift(focus);
    },

    // A split screen's farmers each see their own (src/main.js): the
    // season's light over the day's again (after daynight.js lit it for
    // them), and what drifts in the air round focus (null: none, in the house)
    relight: () => shown && light(),
    place(focus) {
      if (!falling) return;
      falling.mesh.visible = shown && !!focus;
      if (falling.mesh.visible) drift(focus);
    },
  };
}

// (the same leaves in the same places on every page)
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
