import * as THREE from 'three';

// ---------- Character model ----------
// A little farmer built from primitives, used for the local player and for
// everyone else in the game. Collision uses the simple box in main.js; this is
// purely visual. The model faces +Z (matching the atan2(x, z) facing) and
// `rig` has its origin at the feet, so squash & stretch scales from the ground
// up. `root` goes at the collision center, `height` above the feet.

const SKIN = 0xffcc99;
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
// Shared by every farmer; only the shirt is per player
const skinMat = mat(SKIN);
const sharedDenimMat = mat(0x3b5b92, { roughness: 0.85 });
const bootMat = mat(0x4a2f1b, { roughness: 0.9 });
const sharedStrawMat = mat(0xe8c66a, { roughness: 0.95 });
const darkMat = mat(0x1a1a1a, { roughness: 0.3 });
const noseMat = mat(0xffb380);
const cheekMat = mat(0xff9f8a);
const sharedBandMat = mat(0xc0392b);
const mustacheMat = mat(0x5a3a22, { roughness: 0.9 });
const handleMat = mat(0x8b5a2b);
const bladeMat = mat(0x9a9a9a, { metalness: 0.6, roughness: 0.4 });
const edgeMat = mat(0xdfe5ec, { metalness: 0.7, roughness: 0.3 });

const HOE_REST_ANGLE = 0.9; // handle tilted forward/up from the arm
const ROD_REST_ANGLE = 1.15; // a fishing rod, further forward
export const HOE_SWING_TIME = 0.4; // seconds

// Hoe swing keyframes: [time 0..1, arm angle, hoe angle relative to arm]
const SWING_KEYS = [
  [0, 0, HOE_REST_ANGLE],
  [0.35, -2.6, HOE_REST_ANGLE], // wind up over the head
  [0.6, -0.9, 3.0], // chop down in front
  [1, 0, HOE_REST_ANGLE],
];

function sampleSwing(t) {
  for (let i = 1; i < SWING_KEYS.length; i++) {
    const [t1, arm1, hoe1] = SWING_KEYS[i];
    if (t <= t1) {
      const [t0, arm0, hoe0] = SWING_KEYS[i - 1];
      const k = THREE.MathUtils.smoothstep(t, t0, t1);
      return [THREE.MathUtils.lerp(arm0, arm1, k), THREE.MathUtils.lerp(hoe0, hoe1, k)];
    }
  }
  return [0, HOE_REST_ANGLE];
}

// Exponential smoothing factor for frame-rate independent easing
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

function part(geo, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  return mesh;
}

// The merchant at the farm stall wears the same model in their own colors:
// `overalls`, `hat` and `band` swap those materials, `mustache` adds one.
// The neighbours (src/npcs.js) dress up more: `hatStyle` 'straw' (the
// usual), 'cap' (a flat cap), 'souwester' (a sailor's rain hat, brim down at
// the back), 'scarf' (a headscarf knotted at the back) or 'none'; `hair` a
// color (and `bun` or `ponytail` to tie it up); `beard` a color; `apron` a
// color, over the front.
export function createFarmer({ shirt = 0xff5533, height = 1.6, overalls, hat: hatColor, band, mustache = false, hatStyle = 'straw', hair = null, bun = false, ponytail = false, beard = null, apron = null } = {}) {
  const shirtMat = mat(shirt);
  const own = []; // materials made for this farmer alone, to dispose
  const ownMat = (color, shared, opts) => {
    if (color == null) return shared;
    const m = mat(color, opts);
    own.push(m);
    return m;
  };
  const denimMat = ownMat(overalls, sharedDenimMat, { roughness: 0.85 });
  const strawMat = ownMat(hatColor, sharedStrawMat, { roughness: 0.95 });
  const bandMat = ownMat(band, sharedBandMat);

  const root = new THREE.Group(); // positioned at the collision center

  const rig = new THREE.Group(); // origin at the feet
  rig.position.y = -height / 2;
  root.add(rig);

  // Body: denim overalls over a shirt, with a bib and straps on the front
  const torso = new THREE.Group();
  torso.position.y = 0.55; // hips
  rig.add(torso);
  torso.add(part(new THREE.CapsuleGeometry(0.27, 0.22, 4, 12), shirtMat, 0, 0.32, 0));
  torso.add(part(new THREE.CylinderGeometry(0.285, 0.29, 0.3, 12), denimMat, 0, 0.12, 0));
  torso.add(part(new THREE.BoxGeometry(0.3, 0.2, 0.06), denimMat, 0, 0.33, 0.24));
  if (apron != null) {
    // an apron over the front, from the chest to the knees, tied round the waist
    const apronMat = ownMat(apron, sharedDenimMat, { roughness: 0.9 });
    torso.add(part(new THREE.BoxGeometry(0.34, 0.5, 0.03), apronMat, 0, 0.1, 0.29));
    torso.add(part(new THREE.CylinderGeometry(0.295, 0.295, 0.04, 12), apronMat, 0, 0.2, 0));
  }
  for (const sx of [-1, 1]) {
    torso.add(part(new THREE.BoxGeometry(0.05, 0.26, 0.04), denimMat, sx * 0.12, 0.5, 0.235));
    torso.add(part(new THREE.SphereGeometry(0.025, 6, 6), strawMat, sx * 0.12, 0.42, 0.27));
  }

  // Head with face and a straw hat
  const head = new THREE.Group();
  head.position.y = 0.78; // relative to hips
  torso.add(head);
  head.add(part(new THREE.SphereGeometry(0.25, 16, 12), skinMat));
  head.add(part(new THREE.SphereGeometry(0.05, 8, 6), noseMat, 0, -0.02, 0.25));
  for (const sx of [-1, 1]) {
    head.add(part(new THREE.SphereGeometry(0.042, 8, 6), darkMat, sx * 0.09, 0.03, 0.22)); // eye
    head.add(part(new THREE.SphereGeometry(0.045, 8, 6), cheekMat, sx * 0.15, -0.06, 0.18)); // cheek
    if (mustache) {
      const whisker = part(new THREE.CapsuleGeometry(0.03, 0.08, 3, 6), mustacheMat, sx * 0.055, -0.075, 0.235);
      whisker.rotation.z = sx * 1.25; // curling up at the ends
      head.add(whisker);
    }
  }
  const hat = new THREE.Group();
  hat.position.set(0, 0.17, -0.05);
  hat.rotation.x = -0.4; // tipped well back so the face shows from the overhead camera
  head.add(hat);
  if (hatStyle === 'straw') {
    hat.add(part(new THREE.CylinderGeometry(0.38, 0.4, 0.035, 20), strawMat));
    hat.add(part(new THREE.CylinderGeometry(0.19, 0.23, 0.18, 16), strawMat, 0, 0.1, 0));
    hat.add(part(new THREE.CylinderGeometry(0.232, 0.232, 0.05, 16), bandMat, 0, 0.04, 0));
  } else if (hatStyle === 'cap') {
    // a flat cap: a soft crown, its peak out over the eyes
    hat.rotation.x = -0.15;
    const crown = part(new THREE.SphereGeometry(0.255, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), strawMat, 0, -0.06, 0.03);
    crown.scale.set(1, 0.55, 1);
    hat.add(crown);
    const peak = part(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 16, 1, false, -Math.PI / 2, Math.PI), strawMat, 0, -0.05, 0.2);
    peak.rotation.x = 0.15;
    hat.add(peak);
  } else if (hatStyle === 'souwester') {
    // a sailor's rain hat: a round crown, the brim long at the back
    hat.rotation.x = -0.25;
    hat.add(part(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), strawMat, 0, -0.04, 0));
    const brim = part(new THREE.CylinderGeometry(0.34, 0.36, 0.03, 20), strawMat, 0, -0.04, -0.06);
    brim.scale.set(1, 1, 1.15);
    brim.rotation.x = 0.25;
    hat.add(brim);
  } else if (hatStyle === 'scarf') {
    // a headscarf over the hair, knotted at the back
    hat.rotation.x = 0;
    hat.position.set(0, 0.04, -0.02);
    hat.add(part(new THREE.SphereGeometry(0.262, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), bandMat));
    hat.add(part(new THREE.SphereGeometry(0.06, 8, 6), bandMat, 0, 0.02, -0.27));
    for (const sx of [-1, 1]) {
      const tail = part(new THREE.BoxGeometry(0.06, 0.16, 0.03), bandMat, sx * 0.05, -0.08, -0.28);
      tail.rotation.z = sx * 0.3;
      hat.add(tail);
    }
  }
  if (hair != null) {
    // hair round the back and sides of the head (under any hat), tied up in a bun or a ponytail
    const hairMat = ownMat(hair, sharedStrawMat, { roughness: 0.9 });
    const back = part(new THREE.SphereGeometry(0.265, 16, 10, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.62), hairMat, 0, 0.01, -0.01);
    back.rotation.y = Math.PI;
    head.add(back);
    if (bun) head.add(part(new THREE.SphereGeometry(0.11, 10, 8), hairMat, 0, 0.2, -0.17));
    if (ponytail) {
      const tail = part(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), hairMat, 0, -0.08, -0.28);
      tail.rotation.x = 0.35;
      head.add(tail);
    }
  }
  if (beard != null) {
    // a full beard round the jaw, with a mustache in it
    const beardMat = ownMat(beard, mustacheMat, { roughness: 0.95 });
    const chin = part(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), beardMat, 0, -0.06, 0.07);
    chin.scale.set(1, 0.9, 0.85);
    head.add(chin);
    for (const sx of [-1, 1]) {
      const whisker = part(new THREE.CapsuleGeometry(0.03, 0.08, 3, 6), beardMat, sx * 0.055, -0.075, 0.235);
      whisker.rotation.z = sx * 1.25;
      head.add(whisker);
    }
  }

  // Limbs pivot at the shoulder/hip so they can swing; the mesh hangs below.
  function makeLimb(parent, x, y, length, radius, material, endGeo, endMat, endZ = 0) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    parent.add(pivot);
    pivot.add(part(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 8), material, 0, -length / 2, 0));
    const end = part(endGeo, endMat, 0, -length, endZ);
    pivot.add(end);
    return { pivot, end };
  }

  const legs = [-1, 1].map((sx) =>
    makeLimb(rig, sx * 0.13, 0.55, 0.5, 0.1, denimMat,
      new THREE.BoxGeometry(0.18, 0.12, 0.28), bootMat, 0.04)
  );
  // Lift boots so their soles sit on the ground plane
  for (const leg of legs) leg.end.position.y += 0.06;

  const arms = [-1, 1].map((sx) =>
    makeLimb(torso, sx * 0.34, 0.47, 0.42, 0.075, shirtMat,
      new THREE.SphereGeometry(0.08, 10, 8), skinMat)
  );
  for (const [i, arm] of arms.entries()) arm.pivot.rotation.z = (i === 0 ? -1 : 1) * 0.12; // slightly out from the body
  const rightArm = arms[1];

  // Hoe, gripped in the right hand near the bottom of its handle
  const hoe = new THREE.Group();
  hoe.position.copy(rightArm.end.position);
  hoe.rotation.x = HOE_REST_ANGLE;
  rightArm.pivot.add(hoe);
  hoe.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), handleMat, 0, 0.3, 0));
  hoe.add(part(new THREE.BoxGeometry(0.24, 0.05, 0.2), bladeMat, 0, 0.76, 0.08));

  // Axe, held the same way: a shorter handle with a wedge of a head
  const axe = new THREE.Group();
  axe.position.copy(rightArm.end.position);
  axe.rotation.x = HOE_REST_ANGLE;
  axe.visible = false;
  rightArm.pivot.add(axe);
  axe.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.8, 6), handleMat, 0, 0.25, 0));
  axe.add(part(new THREE.BoxGeometry(0.06, 0.2, 0.26), bladeMat, 0, 0.56, 0.12));
  axe.add(part(new THREE.BoxGeometry(0.03, 0.24, 0.05), edgeMat, 0, 0.56, 0.26));

  // Pickaxe, held the same way: a bar across the top of the handle, its two
  // points bent down a little
  const pick = new THREE.Group();
  pick.position.copy(rightArm.end.position);
  pick.rotation.x = HOE_REST_ANGLE;
  pick.visible = false;
  rightArm.pivot.add(pick);
  pick.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.8, 6), handleMat, 0, 0.25, 0));
  pick.add(part(new THREE.BoxGeometry(0.06, 0.07, 0.36), bladeMat, 0, 0.62, 0.02));
  for (const side of [-1, 1]) {
    const point = part(new THREE.BoxGeometry(0.045, 0.05, 0.16), edgeMat, 0, 0.58, side * 0.25);
    point.rotation.x = side * 0.45;
    pick.add(point);
  }

  // For bopping in lobbies, held and swung like the tools: a sword (a blade,
  // a crossguard, a grip: setSword makes it wood, steel or silver), and a
  // mallet with a padded stone head
  const sword = new THREE.Group();
  const swordMat = ownMat(0xd9a066, null);
  sword.add(part(new THREE.BoxGeometry(0.05, 0.62, 0.11), swordMat, 0, 0.5, 0));
  sword.add(part(new THREE.BoxGeometry(0.07, 0.05, 0.3), handleMat, 0, 0.18, 0));
  sword.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), handleMat, 0, 0.06, 0));
  const mallet = new THREE.Group();
  mallet.add(part(new THREE.CylinderGeometry(0.035, 0.04, 0.75, 6), handleMat, 0, 0.25, 0));
  mallet.add(part(new THREE.BoxGeometry(0.2, 0.2, 0.32), mat(0x9c9a92), 0, 0.64, 0));
  for (const side of [-1, 1]) mallet.add(part(new THREE.BoxGeometry(0.22, 0.22, 0.05), mat(0xe8c98f), 0, 0.64, side * 0.17)); // (the padding)
  for (const g of [sword, mallet]) {
    g.position.copy(rightArm.end.position);
    g.rotation.x = HOE_REST_ANGLE;
    g.visible = false;
    rightArm.pivot.add(g);
  }

  // A bow, held by its grip and kept upright whatever the arm does: an arc of
  // wood bowed out ahead, its string behind. A shot (swing()) holds it out
  // in front, aimed.
  const bow = new THREE.Group();
  const BOW_R = 0.45;
  const BOW_ARC = 2;
  const limbs = new THREE.TorusGeometry(BOW_R, 0.025, 5, 14, BOW_ARC).rotateZ(-BOW_ARC / 2).rotateY(-Math.PI / 2).translate(0, 0, -BOW_R);
  bow.add(part(limbs, handleMat, 0, 0, 0));
  const tipZ = BOW_R * (Math.cos(BOW_ARC / 2) - 1);
  bow.add(part(new THREE.CylinderGeometry(0.006, 0.006, 2 * BOW_R * Math.sin(BOW_ARC / 2), 4), ownMat(0xf4f0e6, null), 0, 0, tipZ));
  bow.add(part(new THREE.CylinderGeometry(0.034, 0.034, 0.12, 6), ownMat(0x6e3f1e, null), 0, 0, 0)); // (the grip)
  bow.position.copy(rightArm.end.position);
  bow.visible = false;
  rightArm.pivot.add(bow);

  // A fishing rod: a long pole held up and out, a reel by the grip; the
  // line hangs from `rodTip` (src/fishing.js draws it and the bobber)
  const rod = new THREE.Group();
  const poleMat = ownMat(0xb0743a, null);
  rod.add(part(new THREE.CylinderGeometry(0.012, 0.032, 1.7, 6), poleMat, 0, 0.7, 0));
  const reel = part(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), bladeMat, 0.06, 0.12, 0);
  reel.rotation.z = Math.PI / 2;
  rod.add(reel);
  const rodTip = new THREE.Object3D();
  rodTip.position.y = 1.55;
  rod.add(rodTip);
  rod.position.copy(rightArm.end.position);
  rod.rotation.x = ROD_REST_ANGLE;
  rod.visible = false;
  rightArm.pivot.add(rod);

  // A watering can, hanging from the hand by its handle, its spout forward;
  // a swing tips it up to pour (setCan: the plain can's green, or the big
  // one's steel)
  const can = new THREE.Group();
  const canMat = ownMat(0x5f9a63, null, { metalness: 0.4, roughness: 0.5 });
  can.add(part(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 10), canMat, 0, -0.19, 0.03));
  const spout = part(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), canMat, 0, -0.15, 0.2);
  spout.rotation.x = 1;
  can.add(spout);
  can.add(part(new THREE.CylinderGeometry(0.045, 0.028, 0.04, 8), canMat, 0, -0.07, 0.33).rotateX(1)); // the rose
  can.add(part(new THREE.TorusGeometry(0.08, 0.016, 6, 12, Math.PI), canMat, 0, -0.07, 0.03).rotateY(Math.PI / 2)); // the handle
  can.position.copy(rightArm.end.position);
  can.visible = false;
  rightArm.pivot.add(can);

  root.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  // Animation state for the model
  let mount = null; // what they ride (ride()), if anything
  const anim = {
    facing: 0, // current yaw, eased toward the movement direction
    walkPhase: 0,
    walkAmount: 0, // 0 = idle pose, 1 = full walk cycle
    squash: 0, // >0 squashes (landing), <0 stretches (jumping)
    swing: -1, // tool swing progress 0..1, or -1 when not swinging
    line: null, // the fishing line: null (not out), 'out' or 'bite' (the rod held out over the water)
  };

  // moving: walking (or steering in the air) this frame. targetYaw: where it
  // should face while moving. time: seconds, for idle breathing.
  function animate(dt, { moving, onGround, targetYaw, time }) {
    // Turn smoothly toward the movement direction, taking the short way around
    if (moving) {
      let diff = targetYaw - anim.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      anim.facing += diff * damp(14, dt);
    }
    root.rotation.y = anim.facing;

    const walking = moving && onGround;
    anim.walkAmount += ((walking ? 1 : 0) - anim.walkAmount) * damp(10, dt);
    if (walking) anim.walkPhase += dt * 11;

    const swingL = Math.sin(anim.walkPhase) * anim.walkAmount;

    if (onGround) {
      legs[0].pivot.rotation.x = swingL * 0.7;
      legs[1].pivot.rotation.x = -swingL * 0.7;
      arms[0].pivot.rotation.x = -swingL * 0.6;
      arms[1].pivot.rotation.x = swingL * 0.25; // the hoe arm swings less
    } else {
      // Airborne pose: one knee up, arms lifted
      const k = damp(12, dt);
      legs[0].pivot.rotation.x += (-0.6 - legs[0].pivot.rotation.x) * k;
      legs[1].pivot.rotation.x += (0.35 - legs[1].pivot.rotation.x) * k;
      arms[0].pivot.rotation.x += (-0.9 - arms[0].pivot.rotation.x) * k;
      arms[1].pivot.rotation.x += (-0.4 - arms[1].pivot.rotation.x) * k;
    }

    // With the line out the rod is held out over the water, twitching when something bites
    if (rod.visible && anim.line) {
      const twitch = anim.line === 'bite' ? Math.sin(time * 45) * 0.08 : Math.sin(time * 1.3) * 0.03;
      rightArm.pivot.rotation.x = -0.6 + twitch;
    }

    // A swing (hoe, axe or pickaxe, the same chop; a cast; a shot of the bow) overrides the right arm
    hoe.rotation.x = HOE_REST_ANGLE;
    axe.rotation.x = HOE_REST_ANGLE;
    pick.rotation.x = HOE_REST_ANGLE;
    sword.rotation.x = HOE_REST_ANGLE;
    mallet.rotation.x = HOE_REST_ANGLE;
    rod.rotation.x = ROD_REST_ANGLE;
    can.rotation.x = 0;
    if (bow.visible && anim.swing >= 0) {
      // (a shot: held out in front, aimed, and no chop)
      anim.swing += dt / HOE_SWING_TIME;
      if (anim.swing >= 1) anim.swing = -1;
      else rightArm.pivot.rotation.x = -1.45;
    } else if (anim.swing >= 0) {
      anim.swing += dt / HOE_SWING_TIME;
      if (anim.swing >= 1) {
        anim.swing = -1;
      } else {
        const [armAngle, hoeAngle] = sampleSwing(anim.swing);
        rightArm.pivot.rotation.x = armAngle;
        hoe.rotation.x = hoeAngle;
        axe.rotation.x = hoeAngle;
        pick.rotation.x = hoeAngle;
        sword.rotation.x = hoeAngle;
        mallet.rotation.x = hoeAngle;
        rod.rotation.x = hoeAngle - HOE_REST_ANGLE + ROD_REST_ANGLE;
        can.rotation.x = Math.sin(anim.swing * Math.PI) * 0.9; // (tipped to pour)
      }
    }
    bow.rotation.x = -rightArm.pivot.rotation.x; // (upright)

    // On a mount (ride()): sat up on it, legs either side, and it walks instead
    rig.position.y = -height / 2 + (mount ? mount.seat : 0);
    if (mount) {
      legs[0].pivot.rotation.set(-1.2, 0, -0.35);
      legs[1].pivot.rotation.set(-1.2, 0, 0.35);
      mount.animate(dt, anim.walkAmount, time);
    } else {
      legs[0].pivot.rotation.z = 0;
      legs[1].pivot.rotation.z = 0;
    }

    // Walk bob + idle breathing, and a slight forward lean while walking
    const bob = Math.abs(Math.sin(anim.walkPhase)) * 0.06 * anim.walkAmount;
    torso.position.y = 0.55 + bob;
    torso.rotation.x = 0.1 * anim.walkAmount;
    const breathe = Math.sin(time * 2.2) * 0.015 * (1 - anim.walkAmount);

    // Squash & stretch, volume-preserving-ish, easing back to neutral
    anim.squash += (0 - anim.squash) * damp(10, dt);
    const sy = 1 - anim.squash + breathe;
    const sxz = 1 + anim.squash * 0.5;
    rig.scale.set(sxz, sy, sxz);
  }

  return {
    root,
    hoe,
    axe,
    pick,
    sword,
    mallet,
    bow,
    rod,
    rodTip,
    can,
    anim,
    animate,
    swing() {
      if (anim.swing < 0) anim.swing = 0;
    },
    // the sword's color (wood, steel or silver)
    setSword(color) {
      swordMat.color.setHex(color);
    },
    // the pole's color (the plain, sturdy or golden rod)
    setRod(color) {
      poleMat.color.setHex(color);
    },
    // the watering can's color (the plain or the big one)
    setCan(color) {
      canMat.color.setHex(color);
    },
    // Up on a mount (src/mounts.js createMount()), or (null) down off it
    ride(next) {
      if (mount) {
        root.remove(mount.root);
        mount.dispose();
      }
      mount = next;
      if (mount) {
        mount.root.position.y = -height / 2;
        root.add(mount.root);
      }
    },
    setShirt(color) {
      shirtMat.color.setHex(color);
    },
    // drop the per-farmer GPU resources (the shared materials stay)
    dispose() {
      root.traverse((obj) => obj.isMesh && obj.geometry.dispose());
      shirtMat.dispose();
      mount?.dispose();
      for (const m of own) m.dispose();
    },
  };
}
