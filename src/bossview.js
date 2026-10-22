import * as THREE from 'three';
import { BOSSES } from '../shared/balance.js';
import { seedAt, seedsOver, waveOver, SEED_Y, ARENA_R, ARENAS } from '../shared/bosses.js';
import { damp } from './character.js';

// ---------- A boss, as it is drawn ----------
// Each boss (shared/bosses.js has what it does; src/bosses.js says where it
// is and what it is up to) has a model of its own (MODELS), which poses
// itself from what it is up to. The evil parsnip: a big grumpy parsnip on little feet,
// leaves on top. Asleep it snores; awake it waddles, squashes down to hop,
// tips over to roll, spins its leaves to shoot seeds, and wobbles when
// dizzy. Beaten, it smiles and blushes, and hearts float up. Its moves'
// shockwaves and seeds are drawn here too, and kept (`waves`, `seeds`) for
// the page to see whether they caught its farmer.

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });
const ballGeo = new THREE.IcosahedronGeometry(0.5, 1);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const seedGeo = new THREE.IcosahedronGeometry(0.5, 0);
const waveGeo = new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2);
const shadowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
const seedMat = mat(0x8a5a32);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });

function part(parent, geo, material, [x, y, z], [sx, sy, sz], rotation) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// A glyph on a sprite (stars, hearts, a snore)
const glyphMats = new Map();
function glyph(text, color) {
  const key = text + color;
  if (!glyphMats.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '700 52px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(40, 20, 10, 0.7)';
    ctx.strokeText(text, 32, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 32, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    glyphMats.set(key, new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  }
  return new THREE.Sprite(glyphMats.get(key));
}

// Stars going round over a dizzy head (the boss's, or a farmer's): add
// `group` where the head is, and spin(t) each frame
export function dizzyStars(count = 3, radius = 0.4, size = 0.3) {
  const group = new THREE.Group();
  const stars = Array.from({ length: count }, () => {
    const star = glyph('★', '#ffe14a');
    star.scale.setScalar(size);
    group.add(star);
    return star;
  });
  return {
    group,
    spin(t) {
      stars.forEach((star, i) => {
        const a = t * 4 + (i / count) * Math.PI * 2;
        star.position.set(Math.cos(a) * radius, Math.sin(t * 6 + i) * 0.06, Math.sin(a) * radius);
      });
    },
  };
}

// The evil parsnip. parent: where it goes (the farm's world)
function buildParsnip() {
  const skin = mat(0xf0e2b0);
  const skinDark = mat(0xd4bd84);
  const leaf = mat(0x4f9e3c);
  const leafLight = mat(0x7cc95a);
  const white = mat(0xffffff, { roughness: 0.4 });
  const dark = mat(0x2a1a10, { roughness: 0.4 });
  const blushMat = mat(0xf28cb1);

  const root = new THREE.Group(); // at its feet; moves with its hop
  const pivot = new THREE.Group(); // its middle: tips over to roll
  pivot.position.y = 1.3;
  root.add(pivot);
  const body = new THREE.Group(); // spins as it rolls
  pivot.add(body);
  part(body, new THREE.ConeGeometry(0.95, 2.2, 14), skin, [0, 0, 0], [1, 1, 1], [Math.PI, 0, 0]);
  for (const y of [-0.55, -0.1, 0.4]) {
    const r = (0.95 * (y + 1.1)) / 2.2;
    part(body, new THREE.CylinderGeometry(1, 1, 1, 14), skinDark, [0, y, 0], [r * 1.03, 0.035, r * 1.03]);
  }
  part(body, ballGeo, skin, [0, 1.1, 0], [1.9, 0.6, 1.9]);
  // leaves on top
  const leaves = new THREE.Group();
  leaves.position.y = 1.3;
  body.add(leaves);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const stem = new THREE.Group();
    stem.rotation.set(0, a, 0.45);
    leaves.add(stem);
    part(stem, ballGeo, i % 2 ? leaf : leafLight, [0, 0.55, 0], [0.32, 1.2, 0.1]);
  }
  part(leaves, ballGeo, leaf, [0, 0.15, 0], [0.5, 0.4, 0.5]);
  // the face, on the front
  const face = new THREE.Group();
  body.add(face);
  const eyes = [-1, 1].map((sx) => {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.26, 0.55, 0.66);
    face.add(eye);
    part(eye, ballGeo, white, [0, 0, 0], [0.28, 0.3, 0.12]);
    part(eye, ballGeo, dark, [sx * -0.02, -0.02, 0.06], [0.13, 0.15, 0.06]);
    return eye;
  });
  const brows = [-1, 1].map((sx) => part(face, boxGeo, dark, [sx * 0.27, 0.8, 0.7], [0.34, 0.08, 0.06]));
  const mouth = part(face, new THREE.TorusGeometry(0.16, 0.035, 6, 14, Math.PI), dark, [0, 0.22, 0.76], [1, 1, 1]);
  const blush = [-1, 1].map((sx) => part(face, ballGeo, blushMat, [sx * 0.45, 0.36, 0.62], [0.2, 0.1, 0.06]));
  // little feet
  const feet = [-1, 1].map((sx) => part(root, ballGeo, skinDark, [sx * 0.32, 0.12, 0.1], [0.34, 0.22, 0.48]));
  const skins = [skin, skinDark];
  // How it stands, moves and looks (b: as createBossView's update() has it)
  let tilt = 0; // 0 standing .. 1 lying on its side
  let spin = 0;
  function pose(dt, t, b, def, { asleep, friendly, dizzy, flash }) {
    const rolling = b.phase === 'fight' && b.move === 'roll';
    // lying over to roll, and back up after
    const lie = rolling ? Math.min(1, b.mt / (def.roll.windup * 0.7)) : 0;
    tilt += (lie - tilt) * damp(14, dt);
    pivot.rotation.z = (tilt * Math.PI) / 2;
    pivot.position.y = 1.3 - tilt * 0.4;
    if (rolling && b.mt >= def.roll.windup) spin += (dt * def.roll.speed) / 0.8;
    body.rotation.y = rolling ? spin : 0;
    body.rotation.x = 0;
    for (const foot of feet) foot.visible = tilt < 0.5;
    // squash and stretch, and a waddle
    let sy = 1;
    let wobble = 0;
    if (asleep) sy = 1 + Math.sin(t * 1.8) * 0.03;
    else if (b.phase === 'wake') wobble = Math.sin(t * 30) * 0.08;
    else if (b.move === 'hop' && !friendly) {
      const k = b.mt / def.hop.windup;
      sy = k < 1 ? 1 - 0.25 * k : 1.12;
    } else if (b.move === 'seeds' && !friendly) sy = b.mt < def.seeds.windup ? 0.85 : 1 + Math.sin(t * 20) * 0.04;
    else if (dizzy) wobble = Math.sin(t * 7) * 0.22;
    else if (!rolling) wobble = Math.sin(t * 8) * (friendly ? 0.05 : 0.1);
    if (friendly) sy *= 1 + Math.abs(Math.sin(t * 3)) * 0.06;
    sy *= 1 - flash * 0.12;
    root.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
    if (!rolling) pivot.rotation.z += wobble;
    feet.forEach((foot, i) => (foot.position.y = 0.12 + (b.move === 'rest' && !asleep ? Math.max(0, Math.sin(t * 8 + i * Math.PI)) * 0.12 : 0)));
    // the leaves spin up to shoot
    leaves.rotation.y += dt * (b.move === 'seeds' && b.phase === 'fight' ? 14 : 0.6);
    // the face: asleep, grumpy, dizzy or friendly
    for (const eye of eyes) eye.scale.y = asleep ? 0.12 : dizzy ? 0.5 : 1;
    brows.forEach((brow, i) => {
      const s = i ? 1 : -1;
      brow.visible = !asleep;
      brow.rotation.z = friendly ? s * -0.2 : s * 0.4;
      brow.position.y = friendly ? 0.9 : 0.8;
    });
    mouth.rotation.z = friendly ? Math.PI : 0;
    mouth.position.y = friendly ? 0.32 : 0.22;
    for (const b2 of blush) b2.visible = friendly;
  }
  return { root, skins, top: 3.1, pose };
}

// The super lion: a big golden lion in a little red cape, a mane all round
// its head. It walks on four paws, crouches and pounces, rears up to roar
// (its mane puffing out), lies down to sleep, and wags its tail once friendly.
function buildLion() {
  const coat = mat(0xe8a83e);
  const coatLight = mat(0xf6d08a);
  const mane = mat(0xb85c1e);
  const maneLight = mat(0xd9792b);
  const cape = mat(0xd6453a);
  const white = mat(0xffffff, { roughness: 0.4 });
  const dark = mat(0x2a1a10, { roughness: 0.4 });
  const blushMat = mat(0xf28cb1);

  const root = new THREE.Group(); // at its paws; moves with its pounce
  const rig = new THREE.Group(); // crouches, rears up, lies down
  root.add(rig);
  const torso = new THREE.Group();
  torso.position.y = 1.05;
  rig.add(torso);
  part(torso, ballGeo, coat, [0, 0, 0], [1.5, 1.05, 2.1]);
  part(torso, ballGeo, coatLight, [0, -0.25, 0.1], [1.1, 0.6, 1.6]);
  // the cape, over its back
  const capeSheet = part(torso, boxGeo, cape, [0, 0.5, -0.35], [1.2, 0.05, 1.3]);
  part(torso, boxGeo, mat(0xffd84a), [0, 0.55, 0.32], [0.9, 0.08, 0.1]); // (its clasp)
  // legs
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.45, 0.9, sz * 0.62);
    rig.add(pivot);
    part(pivot, ballGeo, coat, [0, -0.42, 0], [0.36, 0.95, 0.38]);
    part(pivot, ballGeo, coatLight, [0, -0.86, 0.08], [0.4, 0.2, 0.46]);
    return { pivot, front: sz > 0, phase: i === 0 || i === 3 ? 0 : Math.PI };
  });
  // the tail, with a tuft
  const tail = new THREE.Group();
  tail.position.set(0, 1.25, -1.0);
  rig.add(tail);
  part(tail, ballGeo, coat, [0, 0.25, -0.35], [0.14, 0.14, 0.9]).rotation.x = -0.6;
  part(tail, ballGeo, mane, [0, 0.55, -0.7], [0.3, 0.3, 0.3]);
  // the head, in its mane
  const head = new THREE.Group();
  head.position.set(0, 1.75, 1.0);
  rig.add(head);
  const maneRing = new THREE.Group();
  maneRing.position.z = -0.15;
  head.add(maneRing);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    part(maneRing, ballGeo, i % 2 ? mane : maneLight, [Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0], [0.55, 0.55, 0.5]);
  }
  part(maneRing, ballGeo, mane, [0, 0, -0.15], [1.4, 1.4, 0.6]);
  part(head, ballGeo, coat, [0, 0, 0.05], [1.05, 0.98, 0.9]);
  for (const sx of [-1, 1]) part(head, ballGeo, coat, [sx * 0.38, 0.45, -0.02], [0.22, 0.22, 0.14]); // ears
  part(head, ballGeo, coatLight, [0, -0.2, 0.42], [0.6, 0.42, 0.36]); // muzzle
  part(head, ballGeo, dark, [0, -0.04, 0.6], [0.18, 0.12, 0.1]); // nose
  const eyes = [-1, 1].map((sx) => {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.22, 0.14, 0.4);
    head.add(eye);
    part(eye, ballGeo, white, [0, 0, 0], [0.2, 0.22, 0.1]);
    part(eye, ballGeo, dark, [-sx * 0.015, -0.01, 0.05], [0.1, 0.12, 0.05]);
    return eye;
  });
  const brows = [-1, 1].map((sx) => part(head, boxGeo, dark, [sx * 0.22, 0.32, 0.42], [0.26, 0.06, 0.05]));
  const jaw = part(head, boxGeo, dark, [0, -0.36, 0.5], [0.3, 0.06, 0.05]); // (opens wide to roar)
  const smile = part(head, new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), dark, [0, -0.3, 0.55], [1, 1, 1]);
  smile.rotation.z = Math.PI;
  const blush = [-1, 1].map((sx) => part(head, ballGeo, blushMat, [sx * 0.36, -0.08, 0.36], [0.16, 0.08, 0.05]));

  function pose(dt, t, b, def, { asleep, friendly, dizzy, flash }) {
    const fighting = b.phase === 'fight' && !dizzy;
    const pouncing = fighting && b.move === 'pounce';
    const roaring = fighting && b.move === 'roar';
    const crouch = pouncing && b.mt < def.pounce.windup ? b.mt / def.pounce.windup : 0;
    const flying = pouncing && b.mt >= def.pounce.windup;
    // how low it is: lying asleep, crouched to pounce
    rig.position.y = asleep ? -0.5 : -0.3 * crouch;
    rig.rotation.x = roaring && b.mt < def.roar.windup ? -0.25 * (b.mt / def.roar.windup) : 0;
    rig.rotation.z = dizzy ? Math.sin(t * 7) * 0.2 : b.phase === 'wake' ? Math.sin(t * 30) * 0.05 : 0;
    // the legs: walking, tucked in asleep, stretched out mid-pounce
    const walking = b.move === 'rest' && !asleep && !friendly ? 1 : friendly ? 0.4 : 0;
    for (const leg of legs) {
      leg.pivot.rotation.x = asleep ? (leg.front ? -1.4 : 1.4)
        : flying ? (leg.front ? -1.1 : 1.0)
        : Math.sin(t * 8 + leg.phase) * 0.5 * walking + crouch * (leg.front ? -0.5 : 0.6);
    }
    // the head: low and watchful to pounce, up to roar
    head.rotation.x = asleep ? 0.35 : crouch ? 0.3 : roaring && b.mt >= def.roar.windup ? -0.15 : 0;
    head.position.y = asleep ? 1.35 : 1.75;
    const roarOpen = roaring && b.mt >= def.roar.windup ? 1 : 0;
    maneRing.scale.setScalar(1 + roarOpen * (0.2 + Math.sin(t * 25) * 0.05));
    jaw.scale.y = 1 + roarOpen * 4;
    jaw.visible = !friendly;
    smile.visible = friendly;
    for (const eye of eyes) eye.scale.y = asleep ? 0.12 : dizzy ? 0.5 : friendly ? 0.6 : 1;
    brows.forEach((brow, i) => {
      const s = i ? 1 : -1;
      brow.visible = !asleep;
      brow.rotation.z = friendly ? s * -0.2 : s * 0.4;
    });
    for (const b2 of blush) b2.visible = friendly;
    // the tail swishes (fast, about to pounce; wagging, once friendly); the cape flaps in the air
    tail.rotation.y = Math.sin(t * (crouch || friendly ? 14 : 3)) * (friendly ? 0.6 : 0.35);
    capeSheet.rotation.x = flying ? -0.5 + Math.sin(t * 30) * 0.1 : Math.sin(t * 2) * 0.04;
    const sy = (1 + (friendly ? Math.abs(Math.sin(t * 3)) * 0.05 : asleep ? Math.sin(t * 1.8) * 0.03 : 0)) * (1 - flash * 0.12);
    root.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
  }
  return { root, skins: [coat, coatLight], top: 2.8, pose };
}

const MODELS = { parsnip: buildParsnip, lion: buildLion };

export function createBossView(parent, id) {
  const def = BOSSES[id];
  const group = new THREE.Group();
  group.name = `boss-${id}`;
  parent.add(group);
  const p = MODELS[id]();
  group.add(p.root);
  // (over its head: stars when it is dizzy, a snore when it sleeps)
  const stars = dizzyStars(4, 0.7, 0.4);
  stars.group.position.y = p.top + 0.2;
  p.root.add(stars.group);
  const snore = glyph('z', '#dfe8ff');
  p.root.add(snore);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.03;
  group.add(shadow);

  const waves = []; // { fx, age, mesh }
  const seeds = []; // { fx, age, meshes }
  const hearts = []; // { sprite, age }
  let flash = 0;
  let heartAt = 0;
  const _at = {};

  return {
    group,
    waves,
    seeds,
    // A shockwave or a volley of seeds (its fx: shared/bosses.js step())
    addFx(fx) {
      if (fx.e === 'wave') {
        const mesh = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: fx.roar ? 0xffb35a : 0xf3e6c0, transparent: true, opacity: 0.85, depthWrite: false }));
        mesh.position.set(fx.x, 0.05, fx.z);
        parent.add(mesh);
        waves.push({ fx, age: 0, mesh });
      } else if (fx.e === 'seeds') {
        const meshes = Array.from({ length: fx.n }, (_, i) => {
          const mesh = part(parent, seedGeo, seedMat, [fx.x, SEED_Y, fx.z], [0.2, 0.14, 0.3]);
          mesh.rotation.y = fx.a0 + (i / fx.n) * Math.PI * 2;
          return mesh;
        });
        seeds.push({ fx, age: 0, meshes });
      }
    },

    // a bop landed on it
    flinch() {
      flash = 1;
    },

    // b: where it is and what it is doing ({ x, y, z, yaw, move, mt, phase }, src/bosses.js)
    update(dt, t, b) {
      group.visible = !!b;
      if (b) {
        p.root.position.set(b.x, b.y, b.z);
        p.root.rotation.y = b.yaw;
        shadow.position.set(b.x, 0.03, b.z);
        shadow.scale.setScalar(Math.max(0.4, 1.1 - b.y * 0.12));
        const asleep = b.phase === 'sleep';
        const friendly = b.phase === 'friendly';
        const dizzy = (b.phase === 'fight' && b.move === 'dizzy') || (friendly && b.mt < 2.5);
        flash = Math.max(0, flash - dt * 5);
        p.pose(dt, t, b, def, { asleep, friendly, dizzy, flash });
        for (const skin of p.skins) skin.emissive.setScalar(flash * 0.6);
        stars.group.visible = dizzy;
        if (dizzy) stars.spin(t);
        snore.visible = asleep;
        if (asleep) {
          const k = (t * 0.5) % 1;
          snore.position.set(0.6 + k * 0.4, p.top - 0.1 + k * 0.8, 0);
          snore.material.opacity = 1 - k;
          snore.scale.setScalar(0.3 + k * 0.3);
        }
        // hearts, once it is friendly
        if (friendly && t > heartAt) {
          heartAt = t + 0.7;
          const heart = glyph('♥', '#ff6b9a');
          heart.position.set(b.x + (Math.random() - 0.5) * 1.4, p.top, b.z + (Math.random() - 0.5) * 1.4);
          heart.scale.setScalar(0.5);
          parent.add(heart);
          hearts.push({ sprite: heart, age: 0 });
        }
      }
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        h.age += dt;
        h.sprite.position.y += dt * 0.8;
        if (h.age > 2) {
          parent.remove(h.sprite);
          hearts.splice(i, 1);
        }
      }

      // shockwaves spread and fade; seeds fly out
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.age += dt;
        const r = Math.min(w.fx.max, w.fx.speed * w.age);
        w.mesh.scale.setScalar(Math.max(0.1, r));
        w.mesh.material.opacity = 0.85 * (1 - r / (w.fx.max + 0.6));
        if (waveOver(w.fx, w.age)) {
          parent.remove(w.mesh);
          w.mesh.material.dispose();
          waves.splice(i, 1);
        }
      }
      const { x: ax, z: az } = ARENAS[id];
      for (let i = seeds.length - 1; i >= 0; i--) {
        const s = seeds[i];
        s.age += dt;
        s.meshes.forEach((mesh, k) => {
          seedAt(s.fx, k, s.age, _at);
          mesh.position.set(_at.x, SEED_Y + Math.sin(s.age * 9 + k) * 0.05, _at.z);
          mesh.visible = Math.hypot(_at.x - ax, _at.z - az) < ARENA_R + 0.2;
        });
        if (seedsOver(s.fx, s.age)) {
          for (const mesh of s.meshes) parent.remove(mesh);
          seeds.splice(i, 1);
        }
      }
    },

    // its moves' shockwaves and seeds go (it went back to sleep, or we left)
    clearFx() {
      for (const w of waves) {
        parent.remove(w.mesh);
        w.mesh.material.dispose();
      }
      for (const s of seeds) for (const mesh of s.meshes) parent.remove(mesh);
      for (const h of hearts) parent.remove(h.sprite);
      waves.length = seeds.length = hearts.length = 0;
    },
  };
}
