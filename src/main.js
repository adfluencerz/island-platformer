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

// Fixed top-down-angled camera. Doesn't move as the player moves — it's
// set once here and left alone. Adjust CAM_TARGET / CAM_HEIGHT / CAM_TILT_DEG
// below to reframe the view.
const CAM_HEIGHT = 14;
const CAM_TILT_DEG = 45;
const CAM_OFFSET = CAM_HEIGHT * Math.tan(THREE.MathUtils.degToRad(CAM_TILT_DEG));
const CAM_TARGET = new THREE.Vector3(0, 0, -2); // point on the ground the camera looks at

camera.position.set(CAM_TARGET.x, CAM_TARGET.y + CAM_HEIGHT, CAM_TARGET.z + CAM_OFFSET);
camera.lookAt(CAM_TARGET);

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

// Simple hoe model, held out to the player's side so it's visible while playing
const hoeGroup = new THREE.Group();

const hoeHandleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
const hoeHandleMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
const hoeHandle = new THREE.Mesh(hoeHandleGeo, hoeHandleMat);
hoeHandle.rotation.z = Math.PI / 2.4;
hoeHandle.position.set(0.55, 0.25, 0);
hoeHandle.castShadow = true;
hoeGroup.add(hoeHandle);

const hoeBladeGeo = new THREE.BoxGeometry(0.28, 0.05, 0.16);
const hoeBladeMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.6, roughness: 0.4 });
const hoeBlade = new THREE.Mesh(hoeBladeGeo, hoeBladeMat);
hoeBlade.position.set(0.95, -0.15, 0);
hoeBlade.castShadow = true;
hoeGroup.add(hoeBlade);

// ---------- Player ----------
const player = {
  radius: 0.5,
  height: 1.6,
  position: new THREE.Vector3(0, 2, 4),
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
};

const playerGeo = new THREE.CapsuleGeometry(player.radius, player.height - player.radius * 2, 4, 8);
const playerMat = new THREE.MeshStandardMaterial({ color: 0xff5533, roughness: 0.5 });
const playerMesh = new THREE.Mesh(playerGeo, playerMat);
playerMesh.castShadow = true;
scene.add(playerMesh);
playerMesh.add(hoeGroup); // hoe now moves and rotates with the player

// Ground level (top of the base ground box) is y = 0, so the player's
// resting height when standing on bare ground is half their capsule height.
const GROUND_STAND_Y = player.height / 2;

// ---------- Input ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyI') toggleInventory();
  if (e.code === 'KeyE') {
    // Till only works while standing on bare ground (not on a raised platform)
    if (player.onGround && Math.abs(player.position.y - GROUND_STAND_Y) < 0.05) {
      tillTileAt(player.position.x, player.position.z);
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
  if (moveVec.lengthSq() > 0) {
    moveVec.normalize().multiplyScalar(MOVE_SPEED);
    // face movement direction
    playerMesh.rotation.y = Math.atan2(moveVec.x, moveVec.z);
  }
  player.velocity.x = moveVec.x;
  player.velocity.z = moveVec.z;

  // Jump
  if (keys.has('Space') && player.onGround) {
    player.velocity.y = JUMP_SPEED;
    player.onGround = false;
  }

  // Gravity
  player.velocity.y += GRAVITY * dt;

  const prevY = player.position.y;
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  player.position.y += player.velocity.y * dt;

  resolveCollisions(prevY);

  // Fell off the world -> respawn
  if (player.position.y < -20) {
    player.position.set(0, 2, 4);
    player.velocity.set(0, 0, 0);
  }

  playerMesh.position.copy(player.position);

  // Animate items (gentle bob + spin) and check for pickup
  const t = clock.elapsedTime;
  for (const item of [...items]) {
    item.mesh.position.y = item.baseY + Math.sin(t * 2 + item.mesh.position.x) * 0.15;
    item.mesh.rotation.y += dt * 1.5;

    if (player.position.distanceTo(item.mesh.position) < item.radius) {
      collectItem(item);
    }
  }

  // Camera is fixed (set once above) — nothing to update here each frame.
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
