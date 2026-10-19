import * as THREE from 'three';

// ---------- Renderer / Scene / Camera ----------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 90);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

// Angled follow camera. It keeps a constant offset from a look-at point that
// eases toward the player's feet each frame (see updateCamera). Vertically it
// tracks the last ground the player stood on rather than every jump, so the
// view doesn't bob. Adjust CAM_HEIGHT / CAM_TILT_DEG / CAM_FOLLOW_* to taste.
const CAM_HEIGHT = 9;
const CAM_TILT_DEG = 45;
const CAM_OFFSET = new THREE.Vector3(
  0,
  CAM_HEIGHT,
  CAM_HEIGHT * Math.tan(THREE.MathUtils.degToRad(CAM_TILT_DEG))
);
const CAM_FOLLOW_XZ = 6; // higher = snappier horizontal follow
const CAM_FOLLOW_Y = 3; // vertical follow is gentler
const camTarget = new THREE.Vector3(); // point the camera looks at, set once the player exists

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

// ---------- World: ground + platforms ----------
// Each platform is an AABB the player can stand on / bump into.
const platforms = [];

function addBox({ x, y, z, w, h, d, color = 0x6b8e23 }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const box = {
    mesh,
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
  };
  platforms.push(box);
  return box;
}

// Ground
addBox({ x: 0, y: -0.5, z: 0, w: 60, h: 1, d: 60, color: 0x4a6b2a });

// A simple staggered set of platforms to jump between
addBox({ x: -6, y: 1, z: -4, w: 4, h: 1, d: 4, color: 0x8b5a2b });
addBox({ x: 0, y: 2.5, z: -8, w: 4, h: 1, d: 4, color: 0x8b5a2b });
addBox({ x: 6, y: 4, z: -12, w: 4, h: 1, d: 4, color: 0x8b5a2b });
addBox({ x: 12, y: 5.5, z: -16, w: 4, h: 1, d: 4, color: 0x8b5a2b });
addBox({ x: -10, y: 3, z: -14, w: 3, h: 1, d: 3, color: 0xa0522d });

// ---------- Collectible items ----------
// Each item type has a display name, color, and a simple icosahedron mesh.
const ITEM_TYPES = {
  coin: { label: 'Coins', color: 0xffd700 },
  gem: { label: 'Gems', color: 0x33ccff },
  key: { label: 'Keys', color: 0xff44aa },
};

const items = []; // { mesh, type, position, radius }

function spawnItem(type, x, y, z) {
  const def = ITEM_TYPES[type];
  const geo = new THREE.IcosahedronGeometry(0.35, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);

  items.push({ mesh, type, radius: 0.6, baseY: y });
}

// Scatter a few items around/above the platforms so the player has to
// explore and jump to collect them.
spawnItem('coin', -6, 2.2, -4);
spawnItem('coin', 0, 3.7, -8);
spawnItem('coin', 6, 5.2, -12);
spawnItem('coin', 2, 0.5, 2);
spawnItem('gem', 12, 6.7, -16);
spawnItem('gem', -10, 4.2, -14);
spawnItem('key', -6, 2.7, -6);

// ---------- Inventory ----------
const inventory = {}; // { coin: 3, gem: 1, ... }

const itemCounterEl = document.getElementById('item-counter');
const inventoryPanelEl = document.getElementById('inventory-panel');
const inventoryListEl = document.getElementById('inventory-list');

function renderHUD() {
  // Top-right running counter, one entry per item type ever collected
  itemCounterEl.innerHTML = Object.entries(ITEM_TYPES)
    .map(([type, def]) => {
      const count = inventory[type] || 0;
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      return `<span class="stat"><span class="swatch" style="background:${hex}"></span>${count}</span>`;
    })
    .join('');

  // Bottom-right detailed panel (only when open)
  inventoryListEl.innerHTML = Object.entries(ITEM_TYPES)
    .map(([type, def]) => {
      const count = inventory[type] || 0;
      return `<li><span>${def.label}</span><span>${count}</span></li>`;
    })
    .join('');
}

function collectItem(item) {
  inventory[item.type] = (inventory[item.type] || 0) + 1;
  scene.remove(item.mesh);
  item.mesh.geometry.dispose();
  item.mesh.material.dispose();
  const idx = items.indexOf(item);
  if (idx !== -1) items.splice(idx, 1);
  renderHUD();
}

let inventoryOpen = false;
function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  inventoryPanelEl.classList.toggle('open', inventoryOpen);
}

renderHUD();

// ---------- Farming: hoe tool + tillable soil ----------
const farmTiles = new Map(); // "gridX,gridZ" -> tilled tile mesh
const TILE_SIZE = 1;

function tileKeyFor(x, z) {
  return `${Math.round(x / TILE_SIZE)},${Math.round(z / TILE_SIZE)}`;
}

function tillTileAt(x, z) {
  const key = tileKeyFor(x, z);
  if (farmTiles.has(key)) return false; // already tilled

  const [gx, gz] = key.split(',').map(Number);
  const geo = new THREE.BoxGeometry(TILE_SIZE * 0.92, 0.06, TILE_SIZE * 0.92);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(gx * TILE_SIZE, 0.03, gz * TILE_SIZE);
  mesh.receiveShadow = true;
  scene.add(mesh);
  farmTiles.set(key, mesh);
  return true;
}

// ---------- Player ----------
const player = {
  radius: 0.5,
  height: 1.6,
  position: new THREE.Vector3(0, 2, 4),
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
};

// Ground level (top of the base ground box) is y = 0, so the player's
// resting height when standing on bare ground is half their collision height.
const GROUND_STAND_Y = player.height / 2;

// ---------- Character model ----------
// A little farmer built from primitives. Collision still uses the simple box
// in `player`; this is purely visual. The model faces +Z (matching the
// atan2(x, z) facing in update) and `rig` has its origin at the feet, so
// squash & stretch scales from the ground up.
const SKIN = 0xffcc99;
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
const skinMat = mat(SKIN);
const shirtMat = mat(0xff5533);
const denimMat = mat(0x3b5b92, { roughness: 0.85 });
const bootMat = mat(0x4a2f1b, { roughness: 0.9 });
const strawMat = mat(0xe8c66a, { roughness: 0.95 });
const darkMat = mat(0x1a1a1a, { roughness: 0.3 });

function part(geo, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  return mesh;
}

const playerMesh = new THREE.Group(); // positioned at player.position (collision center)
scene.add(playerMesh);

const rig = new THREE.Group(); // origin at the feet
rig.position.y = -player.height / 2;
playerMesh.add(rig);

// Body: denim overalls over a shirt, with a bib and straps on the front
const torso = new THREE.Group();
torso.position.y = 0.55; // hips
rig.add(torso);
torso.add(part(new THREE.CapsuleGeometry(0.27, 0.22, 4, 12), shirtMat, 0, 0.32, 0));
torso.add(part(new THREE.CylinderGeometry(0.285, 0.29, 0.3, 12), denimMat, 0, 0.12, 0));
torso.add(part(new THREE.BoxGeometry(0.3, 0.2, 0.06), denimMat, 0, 0.33, 0.24));
for (const sx of [-1, 1]) {
  torso.add(part(new THREE.BoxGeometry(0.05, 0.26, 0.04), denimMat, sx * 0.12, 0.5, 0.235));
  torso.add(part(new THREE.SphereGeometry(0.025, 6, 6), strawMat, sx * 0.12, 0.42, 0.27));
}

// Head with face and a straw hat
const head = new THREE.Group();
head.position.y = 0.78; // relative to hips
torso.add(head);
head.add(part(new THREE.SphereGeometry(0.25, 16, 12), skinMat));
head.add(part(new THREE.SphereGeometry(0.05, 8, 6), mat(0xffb380), 0, -0.02, 0.25)); // nose
for (const sx of [-1, 1]) {
  head.add(part(new THREE.SphereGeometry(0.042, 8, 6), darkMat, sx * 0.09, 0.03, 0.22)); // eye
  head.add(part(new THREE.SphereGeometry(0.045, 8, 6), mat(0xff9f8a), sx * 0.15, -0.06, 0.18)); // cheek
}
const hat = new THREE.Group();
hat.position.set(0, 0.17, -0.05);
hat.rotation.x = -0.4; // tipped well back so the face shows from the overhead camera
head.add(hat);
hat.add(part(new THREE.CylinderGeometry(0.38, 0.4, 0.035, 20), strawMat));
hat.add(part(new THREE.CylinderGeometry(0.19, 0.23, 0.18, 16), strawMat, 0, 0.1, 0));
hat.add(part(new THREE.CylinderGeometry(0.232, 0.232, 0.05, 16), mat(0xc0392b), 0, 0.04, 0));

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
const HOE_REST_ANGLE = 0.9; // handle tilted forward/up from the arm
const hoeGroup = new THREE.Group();
hoeGroup.position.copy(rightArm.end.position);
hoeGroup.rotation.x = HOE_REST_ANGLE;
rightArm.pivot.add(hoeGroup);
hoeGroup.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), mat(0x8b5a2b), 0, 0.3, 0));
hoeGroup.add(part(
  new THREE.BoxGeometry(0.24, 0.05, 0.2),
  mat(0x9a9a9a, { metalness: 0.6, roughness: 0.4 }),
  0, 0.76, 0.08
));

playerMesh.traverse((obj) => {
  if (obj.isMesh) obj.castShadow = true;
});

// Animation state for the model
const anim = {
  facing: 0, // current yaw, eased toward the movement direction
  walkPhase: 0,
  walkAmount: 0, // 0 = idle pose, 1 = full walk cycle
  squash: 0, // >0 squashes (landing), <0 stretches (jumping)
  swing: -1, // hoe swing progress 0..1, or -1 when not swinging
};
const HOE_SWING_TIME = 0.4; // seconds

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
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

function animateCharacter(dt, moving) {
  // Turn smoothly toward the movement direction, taking the short way around
  if (moving) {
    const targetYaw = Math.atan2(player.velocity.x, player.velocity.z);
    let diff = targetYaw - anim.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    anim.facing += diff * damp(14, dt);
  }
  playerMesh.rotation.y = anim.facing;

  const walking = moving && player.onGround;
  anim.walkAmount += ((walking ? 1 : 0) - anim.walkAmount) * damp(10, dt);
  if (walking) anim.walkPhase += dt * 11;

  const swingL = Math.sin(anim.walkPhase) * anim.walkAmount;
  const t = clock.elapsedTime;

  if (player.onGround) {
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

  // Hoe swing overrides the right arm
  hoeGroup.rotation.x = HOE_REST_ANGLE;
  if (anim.swing >= 0) {
    anim.swing += dt / HOE_SWING_TIME;
    if (anim.swing >= 1) {
      anim.swing = -1;
    } else {
      const [armAngle, hoeAngle] = sampleSwing(anim.swing);
      rightArm.pivot.rotation.x = armAngle;
      hoeGroup.rotation.x = hoeAngle;
    }
  }

  // Walk bob + idle breathing, and a slight forward lean while walking
  const bob = Math.abs(Math.sin(anim.walkPhase)) * 0.06 * anim.walkAmount;
  torso.position.y = 0.55 + bob;
  torso.rotation.x = 0.1 * anim.walkAmount;
  const breathe = Math.sin(t * 2.2) * 0.015 * (1 - anim.walkAmount);

  // Squash & stretch, volume-preserving-ish, easing back to neutral
  anim.squash += (0 - anim.squash) * damp(10, dt);
  const sy = 1 - anim.squash + breathe;
  const sxz = 1 + anim.squash * 0.5;
  rig.scale.set(sxz, sy, sxz);
}

function startHoeSwing() {
  if (anim.swing < 0) anim.swing = 0;
}

camTarget.set(player.position.x, player.position.y - player.height / 2, player.position.z);
let camGroundY = camTarget.y; // feet height the camera tracks vertically

function updateCamera(dt) {
  const feetY = player.position.y - player.height / 2;
  // Track the ground we last stood on; only chase the player downward if they
  // drop below it (falling off a ledge), so normal jumps don't move the view.
  if (player.onGround || feetY < camGroundY) camGroundY = feetY;

  const kXZ = damp(CAM_FOLLOW_XZ, dt);
  camTarget.x += (player.position.x - camTarget.x) * kXZ;
  camTarget.z += (player.position.z - camTarget.z) * kXZ;
  camTarget.y += (camGroundY - camTarget.y) * damp(CAM_FOLLOW_Y, dt);

  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
}
updateCamera(0);

// ---------- Input ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyI') toggleInventory();
  if (e.code === 'KeyE') {
    // Till only works while standing on bare ground (not on a raised platform)
    if (player.onGround && Math.abs(player.position.y - GROUND_STAND_Y) < 0.05) {
      tillTileAt(player.position.x, player.position.z);
      startHoeSwing();
    }
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Physics constants ----------
const GRAVITY = -28;
const MOVE_SPEED = 7;
const JUMP_SPEED = 10;

// ---------- Collision helpers ----------
// Very simple AABB-vs-capsule (treated as a box) resolution, axis by axis.
function resolveCollisions(prevY) {
  player.onGround = false;
  const p = player.position;
  const r = player.radius;
  const halfH = player.height / 2;

  const pMin = new THREE.Vector3(p.x - r, p.y - halfH, p.z - r);
  const pMax = new THREE.Vector3(p.x + r, p.y + halfH, p.z + r);

  for (const box of platforms) {
    const overlapX = pMin.x < box.max.x && pMax.x > box.min.x;
    const overlapY = pMin.y < box.max.y && pMax.y > box.min.y;
    const overlapZ = pMin.z < box.max.z && pMax.z > box.min.z;

    if (overlapX && overlapY && overlapZ) {
      // Was the player above the box last frame? -> landing on top
      const prevBottom = prevY - halfH;
      if (prevBottom >= box.max.y - 0.05 && player.velocity.y <= 0) {
        p.y = box.max.y + halfH;
        player.velocity.y = 0;
        player.onGround = true;
        continue;
      }

      // Otherwise push out along the smallest overlap axis (simple resolution)
      const overlapXAmt = Math.min(pMax.x - box.min.x, box.max.x - pMin.x);
      const overlapZAmt = Math.min(pMax.z - box.min.z, box.max.z - pMin.z);

      if (overlapXAmt < overlapZAmt) {
        p.x += p.x < box.mesh.position.x ? -overlapXAmt : overlapXAmt;
      } else {
        p.z += p.z < box.mesh.position.z ? -overlapZAmt : overlapZAmt;
      }
    }
  }
}

// ---------- Game loop ----------
const clock = new THREE.Clock();

function update(dt) {
  // Horizontal input -> world-space movement (camera-relative, simplified to world axes)
  let moveX = 0;
  let moveZ = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

  const moveVec = new THREE.Vector3(moveX, 0, moveZ);
  const moving = moveVec.lengthSq() > 0;
  if (moving) moveVec.normalize().multiplyScalar(MOVE_SPEED);
  player.velocity.x = moveVec.x;
  player.velocity.z = moveVec.z;

  // Jump
  if (keys.has('Space') && player.onGround) {
    player.velocity.y = JUMP_SPEED;
    player.onGround = false;
    anim.squash = -0.2; // stretch on takeoff
  }

  // Gravity
  player.velocity.y += GRAVITY * dt;

  const prevY = player.position.y;
  const wasOnGround = player.onGround;
  const fallSpeed = -player.velocity.y;
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  player.position.y += player.velocity.y * dt;

  resolveCollisions(prevY);
  if (player.onGround && !wasOnGround) {
    anim.squash = Math.min(fallSpeed / 20, 1) * 0.3; // squash on landing
  }

  // Fell off the world -> respawn
  if (player.position.y < -20) {
    player.position.set(0, 2, 4);
    player.velocity.set(0, 0, 0);
  }

  playerMesh.position.copy(player.position);
  animateCharacter(dt, moving);

  // Animate items (gentle bob + spin) and check for pickup
  const t = clock.elapsedTime;
  for (const item of [...items]) {
    item.mesh.position.y = item.baseY + Math.sin(t * 2 + item.mesh.position.x) * 0.15;
    item.mesh.rotation.y += dt * 1.5;

    if (player.position.distanceTo(item.mesh.position) < item.radius) {
      collectItem(item);
    }
  }

  updateCamera(dt);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
