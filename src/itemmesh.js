import * as THREE from 'three';
import { ITEMS } from './items.js';
import { hook } from './gfx/shading.js';
import { patch, define } from './gfx/chunks.js';

// ---------- Items out in the world ----------
// An item lying about (a treasure, a drop, a find on the farm) is its own
// backpack picture made solid: every pixel of the 16x16 sprite (items.js) a
// little block, so it reads as the same thing it will be in the backpack.
// One geometry per item, built the first time it is needed; one material for
// all, colored by the blocks.

const PX = 0.045; // a pixel, in world units (the sprite is 0.72 across)
const DEPTH = 1.5 * PX; // how thick it is
const SIDE_SHADE = 0.78; // the edges a little darker than the faces, so the shape reads

const geometries = new Map(); // item -> BufferGeometry

// A touch of each block's own color as glow, so a find still shows at dusk
export const itemMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
itemMaterial.userData.noSnow = true; // (src/seasons.js)
hook(itemMaterial, 'itemGlow', (shader) => {
  define(shader, 'GFX_ITEM_GLOW');
  shader.fragmentShader = patch(shader.fragmentShader, 'emissivemap_fragment', 'totalEmissiveRadiance += diffuseColor.rgb * 0.22;', 'GFX_ITEM_GLOW');
});

// The geometry for an item (an item this page doesn't know, from a newer server: a coin)
export function itemGeometry(item) {
  const def = ITEMS[item]?.sprite ? ITEMS[item] : ITEMS.coin;
  if (!geometries.has(def)) geometries.set(def, build(def));
  return geometries.get(def);
}

export function createItemMesh(item) {
  const mesh = new THREE.Mesh(itemGeometry(item), itemMaterial);
  mesh.castShadow = true;
  return mesh;
}

function build({ sprite, palette }) {
  const solid = (x, y) => {
    const ch = sprite[y]?.[x];
    return !!ch && ch !== '.' && !!palette[ch];
  };
  // centered on what is drawn, not on the 16x16 square
  let minX = 16, maxX = -1, minY = 16, maxY = -1;
  for (let y = 0; y < sprite.length; y++) {
    for (let x = 0; x < sprite[y].length; x++) {
      if (!solid(x, y)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const cx = (minX + maxX + 1) / 2;
  const cy = (minY + maxY + 1) / 2;

  const positions = [];
  const normals = [];
  const colors = [];
  const color = new THREE.Color();
  // a quad from four corners (in pixels, z in world units), facing n
  const quad = (corners, n, shade) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = corners[i];
      positions.push((x - cx) * PX, (cy - y) * PX, z);
      normals.push(...n);
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
  };
  const f = DEPTH / 2;
  for (let y = 0; y < sprite.length; y++) {
    for (let x = 0; x < sprite[y].length; x++) {
      if (!solid(x, y)) continue;
      color.setStyle(palette[sprite[y][x]]);
      // (y grows downward in the sprite, upward in the world)
      quad([[x, y + 1, f], [x + 1, y + 1, f], [x + 1, y, f], [x, y, f]], [0, 0, 1], 1);
      quad([[x + 1, y + 1, -f], [x, y + 1, -f], [x, y, -f], [x + 1, y, -f]], [0, 0, -1], 1);
      // the sides only where the picture ends
      if (!solid(x - 1, y)) quad([[x, y + 1, -f], [x, y + 1, f], [x, y, f], [x, y, -f]], [-1, 0, 0], SIDE_SHADE);
      if (!solid(x + 1, y)) quad([[x + 1, y + 1, f], [x + 1, y + 1, -f], [x + 1, y, -f], [x + 1, y, f]], [1, 0, 0], SIDE_SHADE);
      if (!solid(x, y - 1)) quad([[x, y, f], [x + 1, y, f], [x + 1, y, -f], [x, y, -f]], [0, 1, 0], SIDE_SHADE);
      if (!solid(x, y + 1)) quad([[x, y + 1, -f], [x + 1, y + 1, -f], [x + 1, y + 1, f], [x, y + 1, f]], [0, -1, 0], SIDE_SHADE);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}
