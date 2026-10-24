import * as THREE from 'three';

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
// what drifts through the air (FALLING), and how much of it
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
    grass: 0xa39a4a,
    flowers: 0.35,
    snow: 0,
    light: { sun: 0xffd9a8, sky: 0xfff0dc, haze: 0xffecd2 },
    fall: ['leaf', 70],
  },
  {
    name: 'Winter',
    leaves: [0x4a6a50, 0x7a5e4c, 0x3f5f47, 0x8a6d55], // (dark and snowy, or bare and brown)
    pines: [0x2a5a3c, 0x244f36, 0x31644a],
    grass: 0x9aa585,
    flowers: 0,
    snow: 1,
    light: { sun: 0xe6eeff, sky: 0xe8f0ff, haze: 0xe6eef8 },
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
const DRIFTS = 18; // autumn's fallen leaves under a tree (with leaves: not a pine)
const DRIFTS_OUT = [0.35, 2.2]; // how far out from its trunk they lie
const GRASS = new THREE.Color(0x5d9b3a); // the farm's grass as it is made (src/maps.js)
const SNOW_SKIP = new Set(['house-room', 'boss-arenas', 'boss-dungeons', 'npc-room']); // (indoors, and the arenas and dungeons: their own looks)
const RESCAN = 3; // seconds between looks for new things for the snow to lie on (things built)

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
// Every material that is: how much snow lies (0 to 1), and the grass's color
// (the season's, as bright as the green it takes the place of is)
const uSnow = { value: 0 };
const uGrass = { value: new THREE.Color(GRASS) };
const seasoned = new WeakSet();

// A few lines in a material's shader: snow on its surfaces facing up and,
// with grass, its greens turned (a path's brown and stone's grey stay, and
// take less snow); sink: grass blades go down under the snow. Kept with any
// shader changes it had already (the grass's sway: world.js addWind).
function seasonal(material, { grass = false, sink = false } = {}) {
  if (seasoned.has(material)) return;
  seasoned.add(material);
  const before = material.onBeforeCompile;
  const beforeKey = material.customProgramCacheKey.call(material);
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.uSnow = uSnow;
    shader.uniforms.uGrass = uGrass;
    if (sink) {
      shader.vertexShader = 'uniform float uSnow;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y *= 1.0 - 0.8 * uSnow;`
      );
    }
    shader.fragmentShader = `uniform float uSnow;\nuniform vec3 uGrass;\nconst vec3 seasonLum = vec3(0.2126, 0.7152, 0.0722);\nconst float seasonGrassLum = ${GRASS.r * 0.2126 + GRASS.g * 0.7152 + GRASS.b * 0.0722};\n` + shader.fragmentShader
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float seasonCover = 1.0;
        ${grass ? `
        float seasonGreen = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uGrass * (dot(diffuseColor.rgb, seasonLum) / seasonGrassLum), seasonGreen * 0.9);
        seasonCover = mix(0.8, 1.0, seasonGreen);` : ''}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float seasonUp = inverseTransformDirection(normal, viewMatrix).y;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), uSnow * seasonCover * smoothstep(0.4, 0.85, seasonUp));`
      );
  };
  material.customProgramCacheKey = () => `season${grass ? '+grass' : ''}${sink ? '+sink' : ''}|${beforeKey}`;
  material.needsUpdate = true;
}

// Snow for everything under root that stays put: what a material's shader
// can take (lit, not see-through, not changed already) and isn't kept off
// (SNOW_SKIP by name, or userData.noSnow: the animals, the merchant)
function snowOn(obj) {
  if (obj.userData.noSnow || SNOW_SKIP.has(obj.name)) return; // (nor anything in it)
  if (obj.isMesh) {
    for (const m of [obj.material].flat()) {
      if (seasoned.has(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      if (m.transparent || m.userData.noSnow || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) continue;
      seasonal(m);
    }
  }
  for (const child of obj.children) snowOn(child);
}

// map: the farm's map (its leafMats, pineMats, tuftMat, groundMat, turfMat
// and flower materials)
export function createSeasons(map) {
  const a = new THREE.Color();
  const b = new THREE.Color();
  const tint = new THREE.Color();
  const mix = (from, to, t, out) => out.copy(a.setHex(from)).lerp(b.setHex(to), t);
  for (const m of [map.groundMat, map.turfMat]) if (m) seasonal(m, { grass: true });
  for (const m of [map.flowerHeadMat, map.flowerStemMat]) m?.userData && (m.userData.base = m.color.clone());

  let state = null; // the last update's: { now, next, blend, into, night }
  let copies = []; // [a tree's own copy of a leaf or needle material, the one it copies] (world.js: it fades on its own)
  let lit = null; // { root, trees, sun, hemi, scene } once attach()ed
  let scanIn = 0;
  let elapsed = 0;
  let drifts = null;
  let driftsAt = -1; // (how much of them shows now)
  let falling = null;

  const blendOf = (key) => THREE.MathUtils.lerp(state.now[key], state.next[key], state.blend);

  // Autumn's leaves, lying under the trees: as many as `amount` of them (0 to 1)
  function showDrifts(amount) {
    if (!drifts || Math.abs(amount - driftsAt) < 0.02) return;
    driftsAt = amount;
    const m = new THREE.Matrix4();
    drifts.mesh.userData.spots.forEach(([tree, ang, out, turn, k], i) => {
      const s = k * THREE.MathUtils.clamp(amount * DRIFTS - (i % DRIFTS), 0, 1); // (one by one, as the days go)
      const x = tree.x + Math.cos(ang) * out; // (under the tree where it stands now: one grows back elsewhere)
      const z = tree.z + Math.sin(ang) * out;
      m.makeRotationY(turn).scale(_s.set(s, 1, s)).setPosition(x, tree.group.position.y + 0.025 + (i % 3) * 0.004, z);
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

  return {
    // Once the farm is built: root, its world's root (snow on what is in it);
    // trees: its trees (world.js: autumn's leaves lie under them); sun, hemi,
    // scene: the light and the sky, for the season's
    attach({ root, trees = [], sun, hemi, scene }) {
      lit = { root, sun, hemi, scene };
      if (map.tuftMat) seasonal(map.tuftMat, { grass: true, sink: true }); // (once world.js has made it sway)
      const own = new Set([...map.leafMats, ...map.pineMats]);
      copies = trees.flatMap((t) => t.materials.filter((m) => own.has(m.userData.from)).map((m) => [m, m.userData.from]));
      snowOn(root);
      // (autumn's leaves, under the trees with leaves)
      const spots = [];
      const rand = mulberry(4242);
      for (const t of trees) {
        if (t.kind === 'pine') continue;
        for (let i = 0; i < DRIFTS; i++) {
          const ang = rand() * Math.PI * 2;
          const out = THREE.MathUtils.lerp(...DRIFTS_OUT, Math.sqrt(rand())) * t.scale;
          spots.push([t, ang, out, rand() * Math.PI * 2, 0.8 + rand() * 0.5]);
        }
      }
      const leafGeo = new THREE.PlaneGeometry(0.22, 0.15).rotateX(-Math.PI / 2);
      const mesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial(), Math.max(1, spots.length));
      const colors = FALLING.leaf.colors;
      spots.forEach((_, i) => mesh.setColorAt(i, _c.setHex(colors[(i * 7) % colors.length])));
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
      for (const [copy, from] of copies) copy.color.copy(from.color);
      mix(now.grass, next.grass, blend, uGrass.value);
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
      const on = home && !!state && !!lit;
      uSnow.value = on ? blendOf('snow') : 0;
      if (!lit) return;
      if (falling) falling.mesh.visible = on && !!focus;
      if (!on) return;
      // (new things to lie on: what was built)
      if ((scanIn -= dt) <= 0) {
        scanIn = RESCAN;
        snowOn(lit.root);
      }
      // the light
      const { now, next, blend } = state;
      const { sun, hemi, scene } = lit;
      sun.color.multiply(mix(now.light.sun, next.light.sun, blend, tint));
      hemi.color.multiply(mix(now.light.sky, next.light.sky, blend, tint));
      hemi.groundColor.multiplyScalar(1 + uSnow.value * 0.7); // (light off the snow)
      mix(now.light.haze, next.light.haze, blend, tint);
      scene.background.multiply(tint);
      scene.fog.color.multiply(tint);
      // autumn's leaves on the ground (more of them as it goes on), gone under the snow
      const autumn = now.name === 'Autumn' ? Math.min(1, (state.into + 1) / 4) : next.name === 'Autumn' ? blend * 0.25 : 0;
      showDrifts(autumn * (1 - uSnow.value));
      if (focus) drift(focus);
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
