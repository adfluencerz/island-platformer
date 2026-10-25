import * as THREE from 'three';
import { animalModel } from './animals.js';
import { box, ball, cyl, cone, mat, part, live, model, beam, onWall, soilMat, canvasTexture, signTexture, boardTexture, frame, clock, curtains, jar, books, plant, mug, plate, candle, bunting, rosette, glowSprite, woodMat, darkWoodMat, ironMat, glassMat, hayMat, leafMat, lanternMat, fireMat, darkMat } from './homekit.js';

// ---------- What is inside the neighbours' homes ----------
// The room src/npchomes.js builds for each neighbour (a counter with shelves
// behind, a bed, a table, a rug...) and what makes it theirs: `look`, their
// colors, and `props(g, s, ctx)` which adds the rest to the room's group `g`.
// `s`: the room's spots (src/npchomes.js buildRoom). ctx: { addCollider,
// anims (what moves, by time), glows (what lights up at night), clocks,
// story (what shows as you do things for them) }.
// What makes each room theirs
// A light that flickers like a fire's, always on
function firelight(parent, at, size, anims, color = 0xff9a40) {
  const sprite = glowSprite(parent, at, size, color);
  sprite.visible = true;
  anims.push((t) => {
    sprite.material.opacity = 0.4 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 12.1) * 0.04;
  });
  return sprite;
}

// Pictures to hang, drawn with a few strokes (w by h pixels)
const PAINT = {
  // a red barn on a green hill under a blue sky
  ranch(c, w, h) {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8ec8ee');
    sky.addColorStop(1, '#dff1fa');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f9e27a';
    c.beginPath();
    c.arc(w * 0.82, h * 0.22, h * 0.11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6fae48';
    c.beginPath();
    c.ellipse(w * 0.4, h * 1.02, w * 0.75, h * 0.42, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#b8392b';
    c.fillRect(w * 0.3, h * 0.48, w * 0.26, h * 0.26);
    c.fillStyle = '#5a3a30';
    c.beginPath();
    c.moveTo(w * 0.27, h * 0.5);
    c.lineTo(w * 0.43, h * 0.34);
    c.lineTo(w * 0.59, h * 0.5);
    c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = w * 0.012;
    c.strokeRect(w * 0.37, h * 0.55, w * 0.1, h * 0.19);
    c.beginPath();
    c.moveTo(w * 0.37, h * 0.55);
    c.lineTo(w * 0.47, h * 0.74);
    c.moveTo(w * 0.47, h * 0.55);
    c.lineTo(w * 0.37, h * 0.74);
    c.stroke();
  },
  // a cow's face, black and white, with a pink nose
  cow(c, w, h) {
    c.fillStyle = '#cfe6c0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f0e8';
    c.beginPath();
    c.ellipse(w / 2, h * 0.5, w * 0.27, h * 0.38, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a2a2a';
    c.beginPath();
    c.ellipse(w * 0.4, h * 0.3, w * 0.1, h * 0.12, 0.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(w * 0.3, h * 0.2, w * 0.07, h * 0.1, -0.7, 0, Math.PI * 2);
    c.ellipse(w * 0.7, h * 0.2, w * 0.07, h * 0.1, 0.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f2a8b0';
    c.beginPath();
    c.ellipse(w / 2, h * 0.68, w * 0.17, h * 0.13, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a2a2a';
    for (const x of [0.45, 0.55]) c.fillRect(w * x - 2, h * 0.66, 4, 6);
    for (const x of [0.4, 0.6]) {
      c.beginPath();
      c.arc(w * x, h * 0.45, 4, 0, Math.PI * 2);
      c.fill();
    }
  },
};
// Marigold, in a straw hat among the flowers, smiling; and a sunflower print
PAINT.marigold = (c, w, h) => {
  c.fillStyle = '#cfe6a8';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#e8f4c0';
  c.fillRect(0, 0, w, h * 0.45);
  for (const [x, y, col] of [[0.1, 0.8, '#e0362c'], [0.22, 0.88, '#f2c230'], [0.82, 0.82, '#ff7eb6'], [0.92, 0.9, '#7fb3d5'], [0.7, 0.92, '#f2c230']]) {
    c.fillStyle = '#4f9e3c';
    c.fillRect(w * x - 1, h * y, 3, h * 0.2);
    c.fillStyle = col;
    c.beginPath();
    c.arc(w * x, h * y, 7, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#4a7ab8';
  c.beginPath();
  c.ellipse(w / 2, h * 1.02, w * 0.3, h * 0.28, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = '#ffd7ae';
  c.beginPath();
  c.arc(w / 2, h * 0.5, h * 0.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e8c26a';
  c.beginPath();
  c.ellipse(w / 2, h * 0.36, w * 0.28, h * 0.07, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(w / 2, h * 0.3, w * 0.15, h * 0.12, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = '#c0392b';
  c.fillRect(w * 0.37, h * 0.3, w * 0.26, h * 0.035);
  c.fillStyle = '#3a2a1a';
  for (const x of [0.43, 0.57]) c.fillRect(w * x - 1.5, h * 0.48, 3, 4);
  c.strokeStyle = '#a8392f';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(w / 2, h * 0.53, h * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
};
PAINT.sunflower = (c, w, h) => {
  c.fillStyle = '#f4ead0';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#4f9e3c';
  c.fillRect(w / 2 - 3, h * 0.45, 6, h * 0.55);
  c.beginPath();
  c.ellipse(w * 0.33, h * 0.72, w * 0.12, h * 0.06, -0.5, 0, Math.PI * 2);
  c.ellipse(w * 0.67, h * 0.66, w * 0.12, h * 0.06, 0.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f2b630';
  for (let i = 0; i < 12; i++) {
    c.beginPath();
    c.ellipse(w / 2 + Math.cos((i * Math.PI) / 6) * w * 0.17, h * 0.33 + Math.sin((i * Math.PI) / 6) * h * 0.2, w * 0.1, h * 0.06, (i * Math.PI) / 6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#6a3a14';
  c.beginPath();
  c.arc(w / 2, h * 0.33, h * 0.15, 0, Math.PI * 2);
  c.fill();
};
// Finn's old chart, with the cross past the dock; the big bass, on a plaque; Finn
// and his wife on the dunes
PAINT.chart = (c, w, h) => {
  c.fillStyle = '#e6d2a0';
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(120,160,190,0.35)';
  c.fillRect(w * 0.4, 0, w * 0.6, h);
  c.strokeStyle = '#6a5a3a';
  c.lineWidth = 2;
  c.fillStyle = '#c9b27a';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(w * 0.42, 0);
  c.bezierCurveTo(w * 0.34, h * 0.2, w * 0.5, h * 0.35, w * 0.38, h * 0.55);
  c.bezierCurveTo(w * 0.3, h * 0.7, w * 0.45, h * 0.85, w * 0.36, h);
  c.lineTo(0, h);
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(w * 0.74, h * 0.28, w * 0.1, h * 0.12, 0.4, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#6a8a3a';
  for (const [x, y] of [[0.1, 0.3], [0.2, 0.55], [0.14, 0.8], [0.74, 0.28]]) {
    c.beginPath();
    c.arc(w * x, h * y, 5, 0, Math.PI * 2);
    c.fill();
  }
  c.setLineDash([7, 5]);
  c.strokeStyle = '#a8392f';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(w * 0.32, h * 0.66);
  c.bezierCurveTo(w * 0.5, h * 0.76, w * 0.6, h * 0.86, w * 0.7, h * 0.74);
  c.stroke();
  c.setLineDash([]);
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(w * 0.67, h * 0.68);
  c.lineTo(w * 0.73, h * 0.8);
  c.moveTo(w * 0.73, h * 0.68);
  c.lineTo(w * 0.67, h * 0.8);
  c.stroke();
  c.strokeStyle = '#4a3a22';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(w * 0.86, h * 0.08);
  c.lineTo(w * 0.86, h * 0.26);
  c.moveTo(w * 0.8, h * 0.17);
  c.lineTo(w * 0.92, h * 0.17);
  c.stroke();
  c.strokeRect(2, 2, w - 4, h - 4);
};
PAINT.bass = (c, w, h) => {
  c.fillStyle = '#8a5a32';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#5f7f8a';
  c.beginPath();
  c.ellipse(w * 0.46, h * 0.5, w * 0.34, h * 0.2, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(w * 0.78, h * 0.5);
  c.lineTo(w * 0.95, h * 0.28);
  c.lineTo(w * 0.95, h * 0.72);
  c.fill();
  c.fillStyle = '#c9d8dc';
  c.beginPath();
  c.ellipse(w * 0.44, h * 0.6, w * 0.26, h * 0.08, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#3d4a50';
  c.beginPath();
  c.moveTo(w * 0.3, h * 0.32);
  c.lineTo(w * 0.5, h * 0.18);
  c.lineTo(w * 0.62, h * 0.34);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(w * 0.2, h * 0.46, 5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#111';
  c.beginPath();
  c.arc(w * 0.2, h * 0.46, 2.5, 0, Math.PI * 2);
  c.fill();
};
PAINT.couple = (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#9ed0f0');
  sky.addColorStop(1, '#f8ecd0');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#4a8aa8';
  c.fillRect(0, h * 0.5, w, h * 0.12);
  c.fillStyle = '#e6d098';
  c.fillRect(0, h * 0.62, w, h * 0.4);
  for (const [x, shirt, hair, tall] of [[0.38, '#2f4f7a', '#9a9a9a', 1], [0.6, '#e88aa8', '#b8662a', 0.88]]) {
    c.fillStyle = shirt;
    c.fillRect(w * x - 9, h * (0.74 - 0.14 * tall), 18, h * 0.2 * tall);
    c.fillStyle = '#ffd7ae';
    c.beginPath();
    c.arc(w * x, h * (0.7 - 0.14 * tall), 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hair;
    c.beginPath();
    c.arc(w * x, h * (0.68 - 0.14 * tall), 8, Math.PI, 0);
    c.fill();
  }
};
// Mabel's gran, in her apron; the old recipe card, in her hand
PAINT.gran = (c, w, h) => {
  c.fillStyle = '#f2d0d8';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#e8b8c4';
  for (let x = 6; x < w; x += 16) for (let y = 6; y < h; y += 16) c.fillRect(x, y, 3, 3);
  c.fillStyle = '#6a8ab8';
  c.beginPath();
  c.ellipse(w / 2, h * 1.05, w * 0.32, h * 0.34, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = '#fffaf0';
  c.fillRect(w * 0.4, h * 0.8, w * 0.2, h * 0.2);
  c.fillStyle = '#ffd7ae';
  c.beginPath();
  c.arc(w / 2, h * 0.46, h * 0.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#c8c8d0';
  c.beginPath();
  c.arc(w / 2, h * 0.3, h * 0.17, Math.PI, 0);
  c.arc(w / 2, h * 0.14, h * 0.08, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a4a3a';
  c.lineWidth = 2;
  for (const x of [0.42, 0.58]) {
    c.beginPath();
    c.arc(w * x, h * 0.46, 7, 0, Math.PI * 2);
    c.stroke();
  }
  c.strokeStyle = '#a8392f';
  c.beginPath();
  c.arc(w / 2, h * 0.53, h * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
};
PAINT.card = (c, w, h) => {
  c.fillStyle = '#f0e2bc';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#a8803f';
  c.lineWidth = 3;
  c.strokeRect(5, 5, w - 10, h - 10);
  c.fillStyle = '#5a3a14';
  c.textAlign = 'center';
  c.font = 'bold 22px "Trebuchet MS", system-ui, sans-serif';
  c.fillText('Gran\'s', w / 2, h * 0.3);
  c.fillText('Cheese Omelette', w / 2, h * 0.52);
  c.fillRect(w * 0.2, h * 0.62, w * 0.6, 3);
  c.fillRect(w * 0.28, h * 0.74, w * 0.44, 3);
};
const painting = (kind, w = 128, h = 96) => canvasTexture(w, h, PAINT[kind]);

// Rosa's: a farmhouse kitchen. Stone fireplace with the clock over it, and
// Clementine the hen in a basket by it; a spinning wheel; her rosettes; a quilt
// rack. What her requests and what you like in her show up where she lives.
function rosaRoom(g, s, { addCollider, anims, clocks, story }) {
  const { left, right, back, front, midX, counterZ } = s;
  const when = (test, at) => story.group(g, test, at);
  const wb = s.wall('back', 0, 0);

  // ---- the shelves, the counter: grain, preserves, eggs, milk
  const sack = mat(0xd8c49a);
  for (let i = 0; i < 4; i++) part(g, box, sack, s.shelf(-2.2 + i * 0.6, 1.08), [0.4, 0.32, 0.3]);
  const preserves = [0xb02a3a, 0xe2b860, 0x7a2a5a, 0x4f7a3a, 0xc8843a];
  for (let i = 0; i < 6; i++) jar(g, s.shelf(-2.45 + i * 0.32, 1.63), preserves[i % preserves.length], { r: 0.09, h: 0.2 });
  for (let i = 0; i < 6; i++) part(g, ball, mat(i % 3 ? 0xf6f1e4 : 0xd9a24a), s.shelf(0.5 + i * 0.3, 1.72), [0.08, 0.1, 0.08]); // eggs
  part(g, box, mat(0xc9a066), s.shelf(1.3, 1.7), [0.9, 0.12, 0.35]);
  for (let i = 0; i < 3; i++) part(g, cyl, mat(0xf4f4f0), s.shelf(-1.6 + i * 0.5, 2.5), [0.12, 0.34, 0.12]); // milk bottles
  part(g, box, mat(0xc9a066), [midX + 1.6, 1.12, counterZ], [0.5, 0.14, 0.36]);
  for (let i = 0; i < 4; i++) part(g, ball, mat(0xf6f1e4), [midX + 1.45 + (i % 2) * 0.3, 1.24, counterZ - 0.08 + Math.floor(i / 2) * 0.16], [0.07, 0.09, 0.07]);
  part(g, new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI * 1.3), ironMat, [midX, 2.55, front + 0.05], [1, 1, 1], [0, 0, -Math.PI * 0.15 + Math.PI]); // (a horseshoe over the door)
  // a string of garlic on either side of the shelves
  for (const x of [midX - 3.55, midX + 3.55]) {
    part(g, box, mat(0x6e5a42), [x, 2.55, back + 0.14], [0.015, 0.7, 0.015]);
    for (let i = 0; i < 4; i++) part(g, ball, mat(0xf2ead6), [x + (i % 2 ? 0.05 : -0.05), 2.82 - i * 0.18, back + 0.14], [0.07, 0.08, 0.07]);
  }
  // feed sacks in the back right corner
  for (const [dx, dz, h] of [[0, 0, 0.55], [0.55, 0.05, 0.5], [0.25, 0.3, 0.9]]) {
    part(g, box, sack, [right - 1.3 + dx, h / 2, back + 0.55 + dz], [0.5, h, 0.4]);
    part(g, ball, sack, [right - 1.3 + dx, h + 0.04, back + 0.55 + dz], [0.2, 0.1, 0.16]);
  }
  addCollider({ x: right - 1.0, y: 0.5, z: back + 0.7, w: 1.5, h: 1, d: 0.8 });

  // ---- the back wall: curtains, a picture of the ranch, a cow, her calf's name
  curtains(wb, [left + 1.6, 1.9], 1.0, 0.95, 0xc0392b);
  curtains(wb, [right - 1.6, 1.9], 1.0, 0.95, 0xc0392b);
  frame(wb, [left + 2.65, 1.95], 0.62, 0.46, painting('ranch'), 0x7a2a1a);
  frame(wb, [right - 2.65, 1.95], 0.5, 0.58, painting('cow', 96, 112), 0x7a2a1a);
  for (const [key, name] of [['buttercup', 'Buttercup'], ['clementine', 'Little Clementine'], ['beefcake', 'Beefcake']]) {
    const plaque = story.group(wb, (c) => c.chose('rosa_calf') === key, [left + 2.65, 1.42, 0]);
    part(plaque, box, new THREE.MeshStandardMaterial({ map: signTexture(`Calf: ${name}`, { paper: '#f4dcae', ink: '#7a2a1a' }), roughness: 0.9 }), [0, 0, 0.035], [0.74, 0.23, 0.05]);
  }

  // ---- the fireplace, on the right wall, the clock over it
  const fz = back + 4.3;
  const rock = mat(0xa09a8c);
  const rockDark = mat(0x8a857a);
  part(g, box, rock, [right - 1.1, 0.06, fz], [2.2, 0.12, 3.0]); // the hearth
  for (const dz of [-0.95, 0.95]) part(g, box, rock, [right - 0.4, 0.95, fz + dz], [0.8, 1.9, 0.5]);
  part(g, box, mat(0x5a3a22), [right - 0.8, 1.93, fz], [0.2, 0.2, 2.5]); // the mantel
  part(g, box, rock, [right - 0.4, 2.55, fz], [0.8, 1.1, 2.4]);
  part(g, box, rockDark, [right - 0.4, 3.3, fz], [0.6, 0.7, 1.1]); // the chimney
  part(g, box, darkMat, [right - 0.04, 0.95, fz], [0.06, 1.8, 1.4]).castShadow = false;
  for (const dz of [-0.28, 0.25]) part(g, cyl, mat(0x4a3220), [right - 0.5, 0.14, fz + dz], [0.09, 0.9, 0.09], [Math.PI / 2, 0, 0.3]);
  const fire = [
    part(g, box, fireMat, [right - 0.45, 0.42, fz], [0.3, 0.5, 0.75]),
    part(g, box, new THREE.MeshBasicMaterial({ color: 0xffd25a }), [right - 0.42, 0.34, fz + 0.05], [0.2, 0.32, 0.4]),
  ];
  for (const f of fire) f.castShadow = false;
  anims.push((t) => {
    fire[0].scale.set(0.3, 0.5 + Math.sin(t * 9) * 0.07, 0.75 + Math.sin(t * 7) * 0.04);
    fire[1].scale.set(0.2, 0.32 + Math.sin(t * 13) * 0.06, 0.4);
  });
  firelight(g, [right - 1.4, 0.9, fz], 3.4, anims);
  addCollider({ x: right - 0.4, y: 1.2, z: fz, w: 0.8, h: 2.4, d: 2.4 });
  candle(g, [right - 0.8, 2.03, fz - 0.85]);
  jar(g, [right - 0.8, 2.03, fz + 0.85], 0x9ec6e0, { r: 0.08, h: 0.16 });
  part(g, ball, mat(0xe0362c), [right - 0.8, 2.28, fz + 0.85], [0.05, 0.05, 0.05]);
  part(g, ball, mat(0xf2c230), [right - 0.76, 2.3, fz + 0.92], [0.05, 0.05, 0.05]);
  clocks.push(clock(onWall(g, 'right', [right - 0.8, 2.6, fz]), [0, 0], 0.26, 0x5a3a22));
  // a kettle on the hearth, and the round rug before it
  part(g, ball, ironMat, [right - 1.5, 0.28, fz + 1.15], [0.2, 0.16, 0.2]);
  part(g, cone, ironMat, [right - 1.3, 0.3, fz + 1.15], [0.05, 0.16, 0.05], [0, 0, -Math.PI / 2]);
  for (const [r, y, color] of [[1.05, 0.012, 0xe8dcc0], [0.85, 0.016, 0xa8392f], [0.6, 0.02, 0xe8dcc0], [0.38, 0.024, 0xa8392f]]) part(g, cyl, mat(color), [right - 2.7, y, fz + 0.2], [r, 0.02, r]).castShadow = false;

  // ---- Clementine, in her basket by the fire
  const bz = fz - 1.8;
  part(g, cyl, mat(0xc9a066), [right - 0.75, 0.2, bz], [0.42, 0.4, 0.42]);
  part(g, cyl, hayMat, [right - 0.75, 0.36, bz], [0.36, 0.06, 0.36]);
  part(g, new THREE.TorusGeometry(0.42, 0.035, 6, 14), mat(0xa8803f), [right - 0.75, 0.4, bz], [1, 1, 1], [Math.PI / 2, 0, 0]);
  const hen = animalModel('hen', 1);
  model(hen.root);
  hen.legs.forEach((leg) => (leg.pivot.visible = false));
  hen.root.position.set(right - 0.75, 0.2, bz);
  hen.root.rotation.y = -Math.PI / 2 - 0.3;
  g.add(hen.root);
  anims.push((t) => hen.pose({ state: 'idle', graze: 0, step: 0, walkPhase: 0, walkAmount: 0, look: Math.sin(t * 0.5) * 0.6, flap: Math.max(0, Math.sin(t * 0.37) - 0.92) * 10 }, t));

  // ---- her rosettes, on the left wall, and the ranch over the bed
  const rosettes = s.wall('left', back + 6.2, 1.7);
  part(rosettes, box, mat(0x8a5a32), [0, 0, 0.03], [2.0, 0.8, 0.06]);
  [0xc0392b, 0x2f5a8a, 0xf2c230, 0xffffff, 0x4f7a3a].forEach((color, i) => rosette(rosettes, [-0.75 + i * 0.375, 0.12], color));
  rosette(story.group(rosettes, (c) => c.done('rosa_fair'), [0, -0.02, 0]), [0, 0.05], 0xf2c230, 0.17, 0.34); // first prize, for the cheese
  frame(s.wall('left', back + 1.4, 1.95), [0, 0], 0.9, 0.62, painting('ranch', 144, 100), 0x7a2a1a);

  // ---- the bed's quilt, the nightstand, and a rack for the quilt she is given
  const nightstand = [left + 1.95, back + 0.4];
  part(g, box, darkWoodMat, [nightstand[0], 0.3, nightstand[1]], [0.5, 0.6, 0.45]);
  candle(g, [nightstand[0], 0.6, nightstand[1]]);
  mug(g, [nightstand[0] + 0.15, 0.6, nightstand[1] + 0.05], 0xc0392b);
  const patch = [0xc0392b, 0xf2c230, 0x2f5a8a, 0xf4efe4, 0x4f7a3a, 0xe88aa8];
  for (let i = 0; i < 6; i++) part(g, box, mat(patch[i]), [left + 0.9 + ((i % 2) - 0.5) * 0.62, 0.69, back + 1.1 + Math.floor(i / 2) * 0.5], [0.58, 0.02, 0.48]).castShadow = false; // (the patchwork over the bed)
  const rack = [left + 0.45, back + 3.7];
  for (const dz of [-0.5, 0.5]) part(g, box, woodMat, [rack[0], 0.55, rack[1] + dz], [0.06, 1.1, 0.06]);
  for (const y of [0.45, 0.8, 1.1]) part(g, box, woodMat, [rack[0], y, rack[1]], [0.05, 0.05, 1.1]);
  const quilt = when((c) => c.done('rosa_herd'), [rack[0], 0, rack[1]]);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const color = patch[(i + j * 2) % patch.length];
    part(quilt, box, mat(color), [-0.1, 1.0 - j * 0.14, -0.45 + i * 0.3], [0.03, 0.14, 0.3]);
    part(quilt, box, mat(color), [0.1, 1.0 - j * 0.14, -0.45 + i * 0.3], [0.03, 0.14, 0.3]);
  }
  part(quilt, box, mat(0xf4efe4), [0, 1.13, 0], [0.26, 0.03, 1.2]);

  // ---- a spinning wheel, and what she spins
  const sw = [left + 1.1, front - 3.4];
  const wheel = live(new THREE.Group());
  wheel.position.set(sw[0], 0.78, sw[1]);
  g.add(wheel);
  part(wheel, new THREE.TorusGeometry(0.5, 0.04, 6, 20), woodMat, [0, 0, 0]);
  for (let i = 0; i < 6; i++) part(wheel, box, woodMat, [0, 0, 0], [0.03, 1.0, 0.03], [0, 0, (i * Math.PI) / 6]);
  part(g, box, darkWoodMat, [sw[0], 0.38, sw[1] + 0.05], [0.08, 0.76, 0.08]);
  for (const dz of [-0.3, 0.3]) part(g, box, darkWoodMat, [sw[0], 0.04, sw[1] + dz], [0.1, 0.08, 0.45]);
  part(g, box, darkWoodMat, [sw[0] + 0.55, 0.58, sw[1] + 0.05], [0.9, 0.06, 0.12]);
  part(g, cone, mat(0xd8c8a0), [sw[0] + 1.05, 0.7, sw[1] + 0.05], [0.04, 0.2, 0.04], [0, 0, -Math.PI / 2]);
  part(g, ball, mat(0xf2ead6), [sw[0] + 1.05, 0.58, sw[1] + 0.05], [0.13, 0.1, 0.13]);
  addCollider({ x: sw[0] + 0.5, y: 0.5, z: sw[1], w: 1.8, h: 1, d: 0.6 });
  anims.push((t) => (wheel.rotation.z = -t * 0.45));
  const wool = when((c) => c.done('rosa_wool'), [sw[0] - 0.45, 0, sw[1] + 0.55]); // (the baskets of wool she was brought)
  part(wool, cyl, mat(0xc9a066), [0, 0.16, 0], [0.3, 0.32, 0.3]);
  for (const [dx, dz, color] of [[-0.08, 0, 0xf2ead6], [0.1, 0.05, 0xe88aa8], [0, -0.1, 0xb7d0e8]]) part(wool, ball, mat(color), [dx, 0.4, dz], [0.14, 0.12, 0.14]);

  // ---- milk churns by the door
  for (const dx of [-2.05, -1.55]) {
    part(g, cyl, mat(0xa6adb4), [midX + dx, 0.38, front - 0.75], [0.17, 0.76, 0.17]);
    part(g, cyl, mat(0x8a9198), [midX + dx, 0.8, front - 0.75], [0.12, 0.1, 0.12]);
  }

  // ---- the table, laid for what has happened
  const { x: tx, z: tz } = s.tableAt;
  part(g, box, mat(0xd8d0c0), [tx, 0.835, tz], [1.0, 0.012, 1.0]).castShadow = false;
  jar(g, [tx, 0.84, tz], 0x9ec6e0, { r: 0.06, h: 0.14 }); // a jug
  const breakfast = when((c) => c.done('rosa_breakfast'), [tx, 0.84, tz]); // (eggs and milk, the morning she was helped)
  plate(breakfast, [-0.3, 0, -0.28], 0xf2c230);
  plate(breakfast, [0.3, 0, -0.28], 0xf2c230);
  part(breakfast, box, mat(0xd9a24a), [0, 0.04, 0.3], [0.32, 0.07, 0.16]);
  const yours = when((c) => c.hearts >= 2, [tx, 0.84, tz]); // (a place laid for you)
  plate(yours, [0.3, 0, 0.28], 0xc8843a);
  mug(yours, [0.1, 0, 0.3], 0x4f7a3a, false);
  const flowers = when((c) => c.hearts >= 4, [tx, 0.84, tz]); // (and flowers on it)
  part(flowers, cyl, mat(0x9ec6e0), [-0.32, 0.08, 0.3], [0.06, 0.16, 0.06]);
  for (const [dx, dy, color] of [[-0.36, 0.22, 0xe0362c], [-0.3, 0.26, 0xf2c230], [-0.27, 0.2, 0xffffff], [-0.33, 0.3, 0xff7eb6]]) part(flowers, ball, mat(color), [dx, dy, 0.3], [0.05, 0.05, 0.05]);

  // ---- on the counter, what she is given
  const cheese = when((c) => c.done('rosa_fair'), [midX - 0.4, 1.06, counterZ]); // (the fair's cheeses)
  part(cheese, box, mat(0x8a5a32), [0, 0.02, 0], [0.8, 0.04, 0.4]);
  for (const [dx, dy] of [[-0.18, 0], [0.12, 0], [-0.03, 0.1]]) part(cheese, cyl, mat(0xf0cf5a), [dx, 0.1 + dy, 0], [0.14, 0.1, 0.14]);
  const cake = when((c) => c.done('rosa_note'), [midX - 1.5, 1.06, counterZ]); // (the honey cake, for Friday)
  part(cake, cyl, mat(0xe8c890), [0, 0.07, 0], [0.22, 0.14, 0.22]);
  part(cake, cyl, mat(0xe0a030), [0, 0.15, 0], [0.18, 0.03, 0.18]);
  part(cake, ball, mat(0xc88820), [0.13, 0.12, 0.1], [0.05, 0.06, 0.05]);
}

// Basil's: a potting-shed cottage. Seeds in drawers and on shelves, plants
// everywhere, an armchair under Marigold's portrait, a windowsill that grows
// what you told him to plant.
function basilRoom(g, s, { addCollider, glows, clocks, story }) {
  const { left, right, back, front, midX, midZ, counterZ } = s;
  const when = (test, at) => story.group(g, test, at);
  const wb = s.wall('back', 0, 0);

  // ---- the shelves and the counter: packets, pots, herbs
  const packets = [0xf2eef5, 0xff8c1a, 0xffd23f, 0x7fb3d5, 0xe0362c, 0x4f9e3c, 0xb58cff];
  for (const [row, y] of [[0, 1.08], [1, 1.78], [2, 2.48]]) {
    for (let i = 0; i < 9; i++) part(g, box, mat(packets[(i + row * 3) % packets.length]), s.shelf(-2.4 + i * 0.6, y), [0.32, 0.36, 0.06]);
  }
  for (const dx of [-1.8, 1.8]) {
    part(g, cyl, mat(0xb5553a), [midX + dx, 1.2, counterZ], [0.15, 0.3, 0.15]);
    part(g, ball, leafMat, [midX + dx, 1.5, counterZ], [0.22, 0.2, 0.22]);
  }
  for (let i = 0; i < 5; i++) part(g, cone, mat(i % 2 ? 0x6b8a3a : 0x8aa04a), [midX - 2 + i, 2.6, back + 0.7], [0.12, 0.4, 0.12], [Math.PI, 0, 0]); // herbs hung to dry
  // hanging pots, with vines trailing down, either side of the shelves
  for (const x of [midX - 3.55, midX + 3.55]) {
    for (const dx of [-0.12, 0.12]) part(g, box, mat(0x6e5a42), [x + dx, 2.62, back + 0.4], [0.012, 0.6, 0.012]);
    part(g, cyl, mat(0xb5553a), [x, 2.28, back + 0.4], [0.17, 0.2, 0.17]);
    part(g, ball, leafMat, [x, 2.4, back + 0.4], [0.22, 0.12, 0.22]);
    for (let i = 0; i < 4; i++) part(g, ball, mat(i % 2 ? 0x3f8a3c : 0x5aae48), [x + (i % 2 ? 0.1 : -0.1), 2.15 - i * 0.12, back + 0.4], [0.06, 0.07, 0.06]);
  }

  // ---- the back wall: curtains, a sunflower print, the clock
  curtains(wb, [left + 1.6, 1.9], 1.0, 0.95, 0x4f7a3a);
  curtains(wb, [right - 1.6, 1.9], 1.0, 0.95, 0x4f7a3a);
  frame(wb, [left + 2.65, 1.95], 0.5, 0.62, painting('sunflower', 96, 118), 0x5a4632);
  clocks.push(clock(wb, [right - 2.65, 1.95], 0.26, 0x5a4632));
  // the sill under the left window: a box of what he was told to plant
  part(g, box, darkWoodMat, [left + 1.6, 1.36, back + 0.22], [1.2, 0.14, 0.3]);
  part(g, box, soilMat, [left + 1.6, 1.45, back + 0.22], [1.1, 0.03, 0.24]);
  const sill = [left + 1.6, 1.47, back + 0.22];
  const sprouts = story.group(g, (c) => !c.chose('basil_plant'), sill);
  for (let i = 0; i < 5; i++) part(sprouts, ball, mat(0x6bbf4a), [-0.4 + i * 0.2, 0.06, 0], [0.04, 0.06, 0.04]);
  const sunflowers = story.group(g, (c) => c.chose('basil_plant') === 'sunflower', sill);
  for (let i = 0; i < 4; i++) {
    part(sunflowers, box, mat(0x3f8a3c), [-0.36 + i * 0.24, 0.3, 0], [0.025, 0.6, 0.025]);
    part(sunflowers, cyl, mat(0xf2b630), [-0.36 + i * 0.24, 0.64, 0.02], [0.1, 0.03, 0.1], [Math.PI / 2, 0, 0]);
    part(sunflowers, cyl, mat(0x6a3a14), [-0.36 + i * 0.24, 0.64, 0.045], [0.045, 0.03, 0.045], [Math.PI / 2, 0, 0]);
  }
  const bells = story.group(g, (c) => c.chose('basil_plant') === 'bluebell', sill);
  for (let i = 0; i < 6; i++) {
    part(bells, box, mat(0x3f8a3c), [-0.4 + i * 0.16, 0.18, 0], [0.015, 0.36, 0.015]);
    for (const dy of [0.34, 0.27]) part(bells, ball, mat(0x5a78e0), [-0.4 + i * 0.16, dy, 0.025], [0.035, 0.05, 0.035]);
  }
  const strange = story.group(g, (c) => c.chose('basil_plant') === 'new', sill);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x9ae8d0, emissive: 0x4fd8b0, emissiveIntensity: 0.8, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    part(strange, box, mat(0x3f8a6c), [-0.2 + i * 0.2, 0.15, 0], [0.02, 0.3, 0.02]);
    part(strange, ball, glowMat, [-0.2 + i * 0.2, 0.34, 0], [0.07, 0.07, 0.07]);
  }

  // ---- the potting bench in the back left corner: trays, pots, a trowel, a can
  const bench = [left + 1.5, back + 0.7];
  part(g, box, woodMat, [bench[0], 0.9, bench[1]], [2.4, 0.08, 0.7]);
  for (const dx of [-1.1, 1.1]) part(g, box, darkWoodMat, [bench[0] + dx, 0.43, bench[1]], [0.08, 0.86, 0.6]);
  part(g, box, darkWoodMat, [bench[0], 0.35, bench[1]], [2.2, 0.05, 0.55]);
  for (const [dx, h] of [[-0.9, 0.18], [-0.6, 0.24], [-0.3, 0.2]]) {
    part(g, cyl, mat(0xb5553a), [bench[0] + dx, 0.94 + h / 2, bench[1] - 0.1], [0.11, h, 0.11]);
    part(g, ball, leafMat, [bench[0] + dx, 0.98 + h, bench[1] - 0.1], [0.13, 0.1, 0.13]);
  }
  part(g, box, soilMat, [bench[0] + 0.35, 0.96, bench[1]], [0.6, 0.06, 0.4]);
  for (let i = 0; i < 4; i++) part(g, ball, mat(0x6bbf4a), [bench[0] + 0.15 + i * 0.15, 1.02, bench[1]], [0.04, 0.05, 0.04]);
  part(g, box, ironMat, [bench[0] + 0.95, 0.95, bench[1] + 0.2], [0.04, 0.02, 0.2]); // a trowel
  part(g, box, woodMat, [bench[0] + 0.95, 0.95, bench[1] + 0.36], [0.04, 0.03, 0.08]);
  const can = [bench[0] + 1.85, bench[1] + 0.2];
  part(g, cyl, mat(0x4f8a6a), [can[0], 0.22, can[1]], [0.17, 0.44, 0.17]);
  part(g, cone, mat(0x4f8a6a), [can[0] + 0.28, 0.4, can[1]], [0.04, 0.3, 0.04], [0, 0, -Math.PI * 0.4]);
  part(g, new THREE.TorusGeometry(0.1, 0.02, 5, 10, Math.PI), mat(0x4f8a6a), [can[0], 0.46, can[1]]);
  addCollider({ x: bench[0], y: 0.5, z: bench[1], w: 2.4, h: 1, d: 0.7 });
  const scarecrow = when((c) => c.done('basil_crows'), [bench[0] - 0.9, 0.98, bench[1] + 0.12]); // (a little one, for the crows he was freed of)
  part(scarecrow, box, mat(0x8a6a3a), [0, 0.2, 0], [0.025, 0.4, 0.025]);
  part(scarecrow, box, mat(0x8a6a3a), [0, 0.28, 0], [0.3, 0.025, 0.025]);
  part(scarecrow, ball, mat(0xe8c890), [0, 0.42, 0], [0.06, 0.06, 0.06]);
  part(scarecrow, cyl, mat(0xe2b860), [0, 0.5, 0], [0.09, 0.02, 0.09]);
  part(scarecrow, cyl, mat(0xe2b860), [0, 0.53, 0], [0.045, 0.05, 0.045]);

  // ---- the cabinet of drawers on the right wall
  const cz = back + 4.0;
  part(g, box, darkWoodMat, [right - 0.3, 0.95, cz], [0.6, 1.9, 2.5]);
  const wood = [0xa0682f, 0x8a5a2a, 0xb07a3a];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    const z = cz - 1.05 + col * 0.42;
    const y = 0.25 + row * 0.35;
    part(g, box, mat(wood[(row + col) % 3]), [right - 0.62, y, z], [0.04, 0.3, 0.38]);
    part(g, ball, mat(0xd8a838), [right - 0.66, y, z], [0.03, 0.03, 0.03]);
    part(g, box, mat(0xf4efe4), [right - 0.645, y + 0.08, z], [0.01, 0.07, 0.17]).castShadow = false; // (a label)
  }
  addCollider({ x: right - 0.3, y: 0.95, z: cz, w: 0.6, h: 1.9, d: 2.5 });
  plant(g, [right - 0.3, 1.9, cz - 0.8], 0.9, { bloom: 0xff7eb6 });
  plant(g, [right - 0.3, 1.9, cz + 0.8], 0.9);

  // ---- the armchair, the lamp, and Marigold, on the left wall
  const az = midZ + 0.2;
  const upholstery = mat(0x7a5a3a);
  part(g, box, upholstery, [left + 0.85, 0.28, az], [0.95, 0.4, 1.0]);
  part(g, box, upholstery, [left + 0.38, 0.75, az], [0.22, 0.95, 1.0]);
  for (const dz of [-0.5, 0.5]) part(g, box, upholstery, [left + 0.8, 0.52, az + dz], [0.85, 0.28, 0.16]);
  part(g, box, mat(0x9a7a52), [left + 0.9, 0.5, az], [0.7, 0.14, 0.76]); // a cushion
  for (let i = 0; i < 5; i++) part(g, box, mat(i % 2 ? 0xb8473c : 0xe2b860), [left + 0.62, 0.7 - i * 0.07, az + 0.5 + 0.0], [0.5, 0.06, 0.2]).castShadow = false; // (a knitted blanket over an arm)
  addCollider({ x: left + 0.7, y: 0.6, z: az, w: 1.2, h: 1.2, d: 1.1 });
  const cotton = when((c) => c.done('basil_cotton'), [left + 0.9, 0.58, az]); // (a throw of cloud cotton)
  for (const [dx, dz, r] of [[-0.12, -0.2, 0.17], [0.1, 0, 0.2], [-0.1, 0.22, 0.16], [0.14, -0.22, 0.14]]) part(cotton, ball, mat(0xfafaff), [dx, 0.06, dz], [r, r * 0.8, r]);
  const lamp = [left + 0.4, az + 1.0];
  part(g, cyl, mat(0x4a3220), [lamp[0], 0.7, lamp[1]], [0.025, 1.4, 0.025]);
  part(g, cyl, mat(0x4a3220), [lamp[0], 0.03, lamp[1]], [0.15, 0.06, 0.15]);
  part(g, cone, lanternMat, [lamp[0], 1.55, lamp[1]], [0.22, 0.28, 0.22]).castShadow = false;
  glows.push(glowSprite(g, [lamp[0] + 0.3, 1.5, lamp[1]], 2.2));
  // the side table, with the vase, under the portrait
  const tz = az - 1.35;
  part(g, cyl, darkWoodMat, [left + 0.6, 0.55, tz], [0.32, 0.05, 0.32]);
  part(g, cyl, darkWoodMat, [left + 0.6, 0.27, tz], [0.05, 0.54, 0.05]);
  part(g, cyl, darkWoodMat, [left + 0.6, 0.02, tz], [0.2, 0.04, 0.2]);
  jar(g, [left + 0.6, 0.575, tz], 0x9ec6e0, { r: 0.07, h: 0.18 });
  for (const [dx, dy, dz, color] of [[0, 0.3, 0, 0xf2c230], [0.05, 0.27, 0.03, 0xe0362c], [-0.04, 0.28, -0.04, 0xffffff]]) part(g, ball, mat(color), [left + 0.6 + dx, 0.6 + dy, tz + dz], [0.04, 0.04, 0.04]);
  const bluebells = when((c) => c.done('basil_bluebells'), [left + 0.6, 0.75, tz]); // (the ones you picked, by her picture)
  for (let i = 0; i < 5; i++) {
    part(bluebells, box, mat(0x3f8a3c), [(i - 2) * 0.03, 0.12, (i % 2) * 0.03], [0.012, 0.28 + (i % 3) * 0.04, 0.012], [0, 0, (i - 2) * 0.12]);
    part(bluebells, ball, mat(0x5a78e0), [(i - 2) * 0.05, 0.28 + (i % 3) * 0.04, (i % 2) * 0.03], [0.04, 0.05, 0.04]);
  }
  frame(s.wall('left', tz, 1.6), [0, 0], 0.62, 0.78, painting('marigold', 100, 124), 0xa0682f);

  // ---- the hat rack by the door: his straw hat, forever forgotten there
  const hr = [midX + 1.5, front - 0.9];
  part(g, cyl, darkWoodMat, [hr[0], 0.85, hr[1]], [0.04, 1.7, 0.04]);
  part(g, cyl, darkWoodMat, [hr[0], 0.03, hr[1]], [0.2, 0.06, 0.2]);
  for (const a of [0, 2.1, 4.2]) part(g, box, darkWoodMat, [hr[0] + Math.sin(a) * 0.1, 1.5, hr[1] + Math.cos(a) * 0.1], [0.04, 0.04, 0.2], [0, a, 0]);
  part(g, cyl, mat(0xe2b860), [hr[0], 1.74, hr[1]], [0.26, 0.03, 0.26]);
  part(g, cyl, mat(0xe2b860), [hr[0], 1.8, hr[1]], [0.13, 0.1, 0.13]);
  part(g, cyl, mat(0xa8392f), [hr[0], 1.77, hr[1]], [0.135, 0.03, 0.135]);
  // a crate of what you grew him, by the door
  const crate = when((c) => c.done('basil_harvest'), [midX - 1.9, 0, front - 0.85]);
  part(crate, box, woodMat, [0, 0.18, 0], [0.8, 0.36, 0.55]);
  for (const [dx, dz, color, shape] of [[-0.22, -0.1, 0xff8c1a, cone], [0.0, 0.12, 0xff8c1a, cone], [0.22, -0.08, 0xe8e0f0, ball], [-0.1, 0.1, 0xe0362c, ball], [0.25, 0.14, 0xff8c1a, ball]]) part(crate, shape, mat(color), [dx, shape === cone ? 0.42 : 0.4, dz], shape === cone ? [0.07, 0.2, 0.07] : [0.1, 0.09, 0.1], shape === cone ? [Math.PI, 0, 0] : undefined);

  // ---- a place for tea
  const { x: tx, z: tz2 } = s.tableAt;
  part(g, box, mat(0xe8f0d8), [tx, 0.835, tz2], [0.9, 0.012, 0.9]).castShadow = false;
  part(g, ball, mat(0xe8e0d0), [tx, 0.93, tz2], [0.12, 0.1, 0.12]); // the teapot
  part(g, cone, mat(0xe8e0d0), [tx + 0.14, 0.95, tz2], [0.025, 0.12, 0.025], [0, 0, -Math.PI / 2]);
  mug(g, [tx - 0.3, 0.84, tz2 + 0.2], 0x7fb3d5);
  books(g, [tx - 0.4, 0.84, tz2 - 0.3], 3);
  const second = when((c) => c.hearts >= 2, [tx, 0.84, tz2]); // (a second cup, for you)
  mug(second, [0.3, 0, 0.2], 0xe2b860);
  const sun = when((c) => c.hearts >= 4, [tx, 0.84, tz2]); // (sunflowers in a jar)
  part(sun, cyl, mat(0x9ec6e0), [0.2, 0.09, -0.25], [0.06, 0.18, 0.06]);
  for (const dx of [0.17, 0.23]) {
    part(sun, box, mat(0x3f8a3c), [dx, 0.3, -0.25], [0.015, 0.3, 0.015]);
    part(sun, cyl, mat(0xf2b630), [dx, 0.46, -0.23], [0.07, 0.025, 0.07], [Math.PI / 2, 0, 0]);
  }

  // ---- rugs, and plants wherever there is room
  for (const [r, y, color] of [[1.0, 0.012, 0xd8c08a], [0.82, 0.016, 0x4f7a3a], [0.55, 0.02, 0xd8c08a]]) part(g, cyl, mat(color), [left + 2.9, y, az + 0.2], [r, 0.02, r]).castShadow = false;
  for (const [x, z] of [[left + 0.6, front - 0.8], [right - 0.6, front - 0.9], [midX + 3.4, front - 2.2]]) {
    part(g, cyl, mat(0xb5553a), [x, 0.25, z], [0.25, 0.5, 0.25]);
    part(g, ball, leafMat, [x, 0.8, z], [0.4, 0.45, 0.4]);
    addCollider({ x, y: 0.5, z, w: 0.6, h: 1, d: 0.6 });
  }
}

// A hammock slung between two posts at x, from z0 to z1: striped, hanging low
// in the middle so whoever sleeps in it lies in the dip
function hammock(g, x, z0, z1) {
  const len = z1 - z0;
  const w = 0.95;
  const geo = new THREE.PlaneGeometry(w, len, 8, 20).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const [cream, blue] = [new THREE.Color(0xd8c8a0), new THREE.Color(0x4f6f8a)];
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getZ(i) + len / 2) / len;
    pos.setY(i, 1.0 - 0.42 * Math.sin(Math.PI * u) + 0.2 * (pos.getX(i) / (w / 2)) ** 2);
    const c = Math.floor(u * 10) % 2 ? blue : cream;
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95, flatShading: true }));
  cloth.position.set(x, 0, (z0 + z1) / 2);
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  g.add(cloth);
  for (const [z, away] of [[z0, -1], [z1, 1]]) {
    part(g, cyl, darkWoodMat, [x, 0.7, z + away * 0.25], [0.05, 1.4, 0.05]);
    part(g, ball, ironMat, [x, 1.4, z + away * 0.25], [0.05, 0.05, 0.05]);
    for (const dx of [-0.42, 0.42]) beam(g, [x + dx, 1.0 + 0.04, z], [x, 1.4, z + away * 0.25], 0.02);
  }
}

// Finn's: a fisherman's hut. A hammock to sleep in, a chart on the wall, a barrel
// stove, a parrot on the counter; and what you have done for him on the shelves.
function finnRoom(g, s, { addCollider, anims, glows, clocks, story }) {
  const { left, right, back, front, midX, counterZ } = s;
  const when = (test, at) => story.group(g, test, at);
  const wb = s.wall('back', 0, 0);

  // ---- the shelves and the counter: rods, a mounted swordfish, rope, a tackle box
  for (let i = 0; i < 5; i++) part(g, cyl, mat(i % 2 ? 0x5b84b1 : 0xb0743a), s.shelf(-2.4 + i * 0.25, 1.75), [0.025, 1.6, 0.025], [0, 0, 0.2]);
  const fish = new THREE.Group();
  fish.position.set(...s.shelf(1.4, 1.95));
  g.add(fish);
  part(fish, ball, mat(0x5a8ab0), [0, 0, 0.05], [0.7, 0.22, 0.1]);
  part(fish, cone, mat(0x5a8ab0), [0.8, 0, 0.05], [0.22, 0.4, 0.06], [0, 0, -Math.PI / 2]);
  part(fish, cone, mat(0xd9d9d9), [-0.85, 0.02, 0.05], [0.04, 0.6, 0.04], [0, 0, Math.PI / 2]); // its sword
  part(fish, box, darkWoodMat, [0, 0, -0.05], [1.6, 0.5, 0.05]);
  part(g, new THREE.TorusGeometry(0.22, 0.07, 6, 14), mat(0xd8c08a), s.shelf(-1, 1.12), [1, 1, 1], [Math.PI / 2, 0, 0]);
  part(g, box, mat(0x2f4f7a), [midX + 0.9, 1.15, counterZ + 0.05], [0.45, 0.16, 0.3]); // a tackle box, lid up
  part(g, box, mat(0x2f4f7a), [midX + 0.9, 1.3, counterZ - 0.1], [0.45, 0.02, 0.18], [0.5, 0, 0]);
  part(g, box, lanternMat, [midX - 1.8, 1.25, counterZ], [0.2, 0.34, 0.2]).castShadow = false; // a ship's lantern
  glows.push(glowSprite(g, [midX - 1.8, 1.4, counterZ + 0.3], 1.8));
  // the chain-hung lanterns by the shelves
  for (const x of [midX - 3.55, midX + 3.55]) {
    beam(g, [x, 2.9, back + 0.4], [x, 2.35, back + 0.4], 0.015, mat(0x3a3a3a));
    part(g, box, lanternMat, [x, 2.22, back + 0.4], [0.2, 0.28, 0.2]).castShadow = false;
    part(g, cone, ironMat, [x, 2.42, back + 0.4], [0.16, 0.1, 0.16]);
    glows.push(glowSprite(g, [x, 2.2, back + 0.8], 2.4));
  }

  // ---- the back wall: a ship's clock, a life ring
  clocks.push(clock(wb, [left + 2.65, 1.95], 0.27, 0xb08a3a));
  const ring = onWall(g, 'back', [right - 2.65, 1.95, back]);
  part(ring, new THREE.TorusGeometry(0.28, 0.08, 6, 18), mat(0xf4f4ee), [0, 0, 0.1]);
  for (let i = 0; i < 4; i++) part(ring, box, mat(0xd8452f), [Math.cos((i * Math.PI) / 2) * 0.28, Math.sin((i * Math.PI) / 2) * 0.28, 0.1], [0.12, 0.12, 0.18], [0, 0, (i * Math.PI) / 2]);

  // ---- the hammock, in the back left corner, and a pillow
  hammock(g, left + 0.9, back + 0.35, back + 2.85);
  part(g, box, mat(0xf4efe4), [left + 0.9, 0.7, back + 0.65], [0.5, 0.14, 0.32]);
  part(g, box, mat(0x2f4f7a), [left + 0.9, 0.62, back + 2.3], [0.7, 0.06, 0.5]);

  // ---- the chart on the right wall, the stove in the corner
  const chart = onWall(g, 'right', [right, 1.75, back + 2.9]);
  frame(chart, [0, 0], 1.9, 1.2, painting('chart', 380, 240), 0x5a3a22);
  const pin = story.group(chart, (c) => c.chose('finn_map') === 'seek', [0.38, -0.36, 0.1]); // (a pin in the cross, if you said you would look)
  part(pin, ball, mat(0xe0b020), [0, 0, 0.02], [0.05, 0.05, 0.05]);
  part(pin, cyl, mat(0x8a8a8a), [0, 0, 0], [0.012, 0.06, 0.012], [Math.PI / 2, 0, 0]);
  const wheel = part(g, new THREE.TorusGeometry(0.45, 0.05, 6, 16), woodMat, [right - 0.08, 1.7, front - 2], [1, 1, 1], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 4; i++) part(wheel, box, woodMat, [0, 0, 0], [0.04, 1.15, 0.04], [0, 0, (i * Math.PI) / 4]);
  const stove = [right - 0.95, back + 0.85];
  part(g, cyl, mat(0x4a5560), [stove[0], 0.45, stove[1]], [0.4, 0.9, 0.4]);
  for (const y of [0.15, 0.75]) part(g, cyl, mat(0x2f3840), [stove[0], y, stove[1]], [0.42, 0.06, 0.42]);
  part(g, box, darkMat, [stove[0] - 0.4, 0.45, stove[1] + 0.05], [0.04, 0.3, 0.26]).castShadow = false;
  const flame = part(g, box, fireMat, [stove[0] - 0.42, 0.4, stove[1] + 0.05], [0.02, 0.16, 0.18]);
  flame.castShadow = false;
  anims.push((t) => flame.scale.set(0.02, 0.16 + Math.sin(t * 11) * 0.04, 0.18));
  part(g, cyl, mat(0x2f3840), [stove[0], 2.2, stove[1]], [0.07, 2.6, 0.07]); // its pipe, up through the roof
  part(g, ball, ironMat, [stove[0] + 0.05, 1.04, stove[1]], [0.17, 0.13, 0.17]); // a kettle
  part(g, cone, ironMat, [stove[0] - 0.14, 1.07, stove[1]], [0.04, 0.14, 0.04], [0, 0, Math.PI * 0.4]);
  firelight(g, [stove[0] - 0.9, 0.6, stove[1] + 0.2], 2.6, anims);
  addCollider({ x: stove[0], y: 0.5, z: stove[1], w: 0.9, h: 1, d: 0.9 });

  // ---- a sea chest, a net with its floats, and what hangs on the left wall
  const chest = [left + 0.55, back + 3.8];
  part(g, box, mat(0x6e4a2b), [chest[0], 0.28, chest[1]], [0.8, 0.56, 1.2]);
  part(g, cyl, mat(0x6e4a2b), [chest[0], 0.56, chest[1]], [0.4, 1.2, 0.4], [Math.PI / 2, 0, 0]);
  for (const dz of [-0.4, 0.4]) part(g, box, mat(0xb0903a), [chest[0], 0.4, chest[1] + dz], [0.84, 0.82, 0.07]);
  part(g, box, mat(0xd8b040), [chest[0] + 0.4, 0.45, chest[1]], [0.04, 0.12, 0.1]);
  addCollider({ x: chest[0], y: 0.4, z: chest[1], w: 0.9, h: 0.8, d: 1.3 });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1, 10, 7), new THREE.MeshStandardMaterial({ color: 0x3a3a2a, wireframe: true }));
  const netWall = s.wall('left', back + 5.4, 1.8);
  net.position.set(0, 0, 0.06);
  netWall.add(net);
  for (let i = 0; i < 5; i++) part(netWall, ball, mat(0xf2e8c8), [-0.6 + i * 0.3, 0.56, 0.1], [0.045, 0.045, 0.045]); // floats
  part(netWall, box, darkWoodMat, [0, 0.57, 0.05], [1.6, 0.04, 0.05]);
  const bass = story.group(s.wall('left', back + 3.8, 2.0), (c) => c.done('finn_bass')); // (the one he asked for: as big as a dog)
  frame(bass, [0, 0], 1.3, 0.6, painting('bass', 260, 120), 0x5a3a22);
  const photo = story.group(s.wall('left', back + 2.2, 1.5), (c) => c.hearts >= 4); // (him and the missus: he shows you)
  frame(photo, [0, 0], 0.5, 0.4, painting('couple', 120, 96), 0x5a3a22);

  // ---- Barnacle, the parrot, on a perch on the counter
  const perch = [midX + 2.15, 1.06, counterZ];
  part(g, cyl, darkWoodMat, [perch[0], perch[1] + 0.2, perch[2]], [0.025, 0.4, 0.025]);
  part(g, cyl, darkWoodMat, [perch[0], perch[1] + 0.02, perch[2]], [0.12, 0.04, 0.12]);
  part(g, box, darkWoodMat, [perch[0], perch[1] + 0.42, perch[2]], [0.3, 0.025, 0.025]);
  const bird = live(new THREE.Group());
  bird.position.set(perch[0], perch[1] + 0.44, perch[2]);
  g.add(bird);
  part(bird, ball, mat(0xd8362c), [0, 0.11, 0], [0.075, 0.12, 0.065]);
  part(bird, ball, mat(0xf2c230), [0, 0.1, 0.04], [0.05, 0.08, 0.03]);
  part(bird, cone, mat(0x2f6fb8), [0, 0.0, -0.06], [0.04, 0.24, 0.03], [Math.PI + 0.25, 0, 0]);
  for (const sx of [-1, 1]) part(bird, ball, mat(0x2f9fb8), [sx * 0.07, 0.11, -0.01], [0.022, 0.1, 0.05]);
  const head = live(new THREE.Group());
  head.position.set(0, 0.24, 0.01);
  bird.add(head);
  part(head, ball, mat(0xd8362c), [0, 0, 0], [0.058, 0.058, 0.056]);
  part(head, cone, mat(0xf2e8c8), [0, -0.01, 0.06], [0.025, 0.07, 0.025], [Math.PI / 2 + 0.5, 0, 0]);
  for (const sx of [-1, 1]) part(head, ball, mat(0x111111), [sx * 0.042, 0.012, 0.03], [0.011, 0.011, 0.011]);
  anims.push((t) => {
    head.rotation.y = Math.sin(t * 0.7) * 0.7;
    head.rotation.x = Math.max(0, Math.sin(t * 2.3)) * 0.2;
    bird.position.y = perch[1] + 0.44 + Math.max(0, Math.sin(t * 0.9 + 1) - 0.95) * 1.2;
  });

  // ---- the table: a lantern, a chart, a mug; and a round rug
  const { x: tx, z: tz } = s.tableAt;
  part(g, cyl, mat(0xd8c8a0), [tx - 0.25, 0.86, tz - 0.2], [0.07, 0.5, 0.07], [0, 0, Math.PI / 2]); // a rolled-up chart
  part(g, box, lanternMat, [tx + 0.3, 0.97, tz - 0.2], [0.16, 0.22, 0.16]).castShadow = false;
  mug(g, [tx - 0.2, 0.84, tz + 0.25], 0x6e4a2b);
  const yours = when((c) => c.hearts >= 2, [tx, 0.84, tz]); // (a cup set out for you)
  mug(yours, [0.3, 0, 0.25], 0x2f4f7a);
  const carrot = when((c) => c.done('finn_note'), [tx, 0.84, tz]); // (the whole carrot, raw, that Rosa hears of)
  plate(carrot, [0.25, 0, -0.3], null, 0.15);
  part(carrot, cone, mat(0xff8c1a), [0.25, 0.05, -0.3], [0.04, 0.2, 0.04], [Math.PI / 2, 0, 0.4]);
  part(carrot, ball, mat(0x4f9e3c), [0.15, 0.06, -0.33], [0.04, 0.03, 0.04]);
  for (const [r, y, color] of [[1.15, 0.012, 0xe8e0d0], [0.95, 0.016, 0x2f4f7a], [0.7, 0.02, 0xe8e0d0], [0.45, 0.024, 0x2f4f7a]]) part(g, cyl, mat(color), [midX + 1.6, y, front - 3.4], [r, 0.02, r]).castShadow = false;
  // barrels of bait by the door, and a coil of rope
  for (const [dx, dz] of [[0, 0], [0.7, 0.15]]) part(g, cyl, woodMat, [midX - 2.3 + dx, 0.45, front - 0.8 + dz], [0.33, 0.9, 0.33]);
  addCollider({ x: midX - 1.95, y: 0.45, z: front - 0.7, w: 1.5, h: 0.9, d: 0.9 });

  // ---- what he has been given, and what he does with it
  const shelves = (_name, test, x, y) => story.group(g, test, s.shelf(x, y));
  const boat = shelves('boat', (c) => c.done('finn_driftwood'), 1.9, 2.33); // (the little boat he built from the planks)
  part(boat, box, mat(0x8a5a32), [0, 0.08, 0], [0.5, 0.12, 0.18]);
  part(boat, box, mat(0x8a5a32), [-0.28, 0.14, 0], [0.12, 0.2, 0.18], [0, 0, 0.5]);
  part(boat, box, mat(0xd8452f), [0, 0.15, 0], [0.5, 0.025, 0.2]);
  part(boat, box, darkWoodMat, [0, 0.34, 0], [0.02, 0.4, 0.02]);
  part(boat, new THREE.BoxGeometry(0.01, 0.3, 0.26), mat(0xf4efe4), [0.05, 0.36, 0]);
  const shells = shelves('shells', (c) => c.done('finn_shells'), -0.5, 1.65); // (the missus's)
  jar(shells, [0, 0, 0], 0xdfe9ee, { r: 0.1, h: 0.24 });
  for (const [dx, dy, color] of [[-0.03, 0.06, 0xf4d0c0], [0.03, 0.1, 0xe8e0d0], [0, 0.15, 0xf0b8a8], [0.04, 0.05, 0xd8c8b8]]) part(shells, ball, mat(color), [dx, dy, 0], [0.035, 0.03, 0.03]);
  const chime = story.group(g, (c) => c.done('finn_shells'), [right - 1.0, 2.85, back + 0.55]); // (and the chime she makes)
  part(chime, cyl, mat(0x6e4a2b), [0, 0, 0], [0.22, 0.03, 0.22]);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const x = Math.cos(a) * 0.14;
    const z = Math.sin(a) * 0.14;
    part(chime, box, mat(0xe8dcc8), [x, -0.2 - (i % 2) * 0.08, z], [0.008, 0.4 + (i % 2) * 0.16, 0.008]);
    part(chime, cone, mat([0xf4d0c0, 0xf0e8d8, 0xe8c0b0][i % 3]), [x, -0.42 - (i % 2) * 0.16, z], [0.04, 0.07, 0.04], [Math.PI, 0, 0]);
  }
  const lamp = story.group(g, (c) => c.done('finn_legend'), [midX - 0.9, 1.06, counterZ]); // (a lanternfish in a jar, lit: from the night he fished for it)
  const lit = new THREE.MeshStandardMaterial({ color: 0x9ae8f0, emissive: 0x3ac8e0, emissiveIntensity: 1.2, roughness: 0.4 });
  part(lamp, cyl, glassMat, [0, 0.14, 0], [0.12, 0.28, 0.12]);
  part(lamp, ball, lit, [0, 0.14, 0], [0.07, 0.04, 0.025]);
  part(lamp, cone, lit, [0.08, 0.14, 0], [0.025, 0.05, 0.02], [0, 0, -Math.PI / 2]);
  part(lamp, cyl, mat(0x6e4a2b), [0, 0.3, 0], [0.11, 0.04, 0.11]);
  const lampGlow = glowSprite(lamp, [0, 0.2, 0.15], 1.5, 0x60e0f0);
  lampGlow.visible = true;
}

// Mabel's: the bakery's kitchen. A floured work table, her oven and its
// woodpile, a chalkboard of today's bakes, bunting, copper pots, and Biscuit the
// kitten asleep on a cushion; and what you have baked and brought her.
function mabelRoom(g, s, { addCollider, anims, clocks, story }) {
  const { left, right, back, front, midX, midZ, counterZ } = s;
  const when = (test, at) => story.group(g, test, at);
  const wb = s.wall('back', 0, 0);

  // ---- the shelves and the counter: loaves, cakes, domes, a till, a cake stand
  const loaf = mat(0xc8843a);
  for (const y of [1.08, 1.78]) for (let i = 0; i < 7; i++) part(g, new THREE.CapsuleGeometry(0.1, 0.22, 3, 8), loaf, s.shelf(-2.3 + i * 0.75, y), [1, 1, 1], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 5; i++) part(g, cyl, mat([0xf4b6cf, 0xfff4e0, 0x8a4a2a][i % 3]), s.shelf(-2 + i, 2.42), [0.2, 0.18, 0.2]);
  for (const dx of [-1.6, 1.6]) {
    part(g, cyl, mat(dx < 0 ? 0xf4b6cf : 0x8a4a2a), [midX + dx, 1.15, counterZ], [0.22, 0.18, 0.22]);
    part(g, new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat, [midX + dx, 1.06, counterZ]).castShadow = false;
  }
  const till = [midX - 2.2, counterZ + 0.05];
  part(g, box, mat(0x8a5a32), [till[0], 1.14, till[1]], [0.42, 0.22, 0.32]);
  part(g, box, mat(0xd8b040), [till[0], 1.28, till[1] - 0.04], [0.36, 0.1, 0.22]);
  for (let i = 0; i < 6; i++) part(g, box, mat(0xf4efe4), [till[0] - 0.14 + (i % 3) * 0.14, 1.26, till[1] + 0.08 + Math.floor(i / 3) * 0.06], [0.1, 0.02, 0.05]).castShadow = false;
  const stand = [midX + 0.45, counterZ];
  part(g, cyl, mat(0xe8dcc8), [stand[0], 1.3, stand[1]], [0.025, 0.55, 0.025]);
  for (const [r, y, color] of [[0.26, 1.08, 0xf4b6cf], [0.2, 1.3, 0xfff4e0], [0.14, 1.5, 0xf4b6cf]]) {
    part(g, cyl, mat(0xe8dcc8), [stand[0], y, stand[1]], [r, 0.025, r]);
    part(g, cyl, mat(color), [stand[0], y + 0.05, stand[1]], [r * 0.8, 0.07, r * 0.8]);
    part(g, ball, mat(0xc0392b), [stand[0], y + 0.11, stand[1]], [0.03, 0.03, 0.03]);
  }
  // bread in a basket by the till, and the oven's bunting overhead
  part(g, cyl, mat(0xc9a066), [midX - 1.1, 1.12, counterZ], [0.26, 0.12, 0.26]);
  for (const dx of [-0.08, 0.1]) part(g, new THREE.CapsuleGeometry(0.06, 0.2, 3, 8), loaf, [midX - 1.1 + dx, 1.2, counterZ], [1, 1, 1], [0, 0.4, Math.PI / 2]);
  bunting(g, [left + 0.15, 2.8, midZ + 0.4], [right - 0.15, 2.8, midZ + 0.4], [0xd8452f, 0xfff4e0, 0xf4b6cf, 0x7fb3d5, 0xf2c230], { sag: 0.5, n: 14 });

  // ---- the oven in the back right, and a woodpile and a sleeping kitten by it
  const ox = right - 1.3;
  const oz = back + 0.8;
  part(g, box, mat(0x9a4a32), [ox, 0.9, oz], [1.8, 1.8, 1.2]);
  part(g, box, darkMat, [ox, 0.7, oz + 0.61], [0.9, 0.6, 0.02]).castShadow = false;
  const fire = part(g, box, fireMat, [ox, 0.55, oz + 0.62], [0.6, 0.25, 0.02]);
  fire.castShadow = false;
  part(g, box, mat(0x7a3a28), [ox, 2.4, oz - 0.2], [0.6, 1.2, 0.6]);
  addCollider({ x: ox, y: 0.9, z: oz, w: 1.8, h: 1.8, d: 1.2 });
  anims.push((t) => fire.scale.set(0.6 + Math.sin(t * 9) * 0.05, 0.25 + Math.sin(t * 13) * 0.05, 0.02));
  firelight(g, [ox, 0.8, oz + 1.1], 2.8, anims);
  for (const [dz, dy] of [[1.75, 0.12], [2.0, 0.12], [2.25, 0.12], [1.87, 0.32], [2.12, 0.32]]) part(g, cyl, mat(0x7a5a3a), [right - 0.45, dy, back + dz], [0.1, 0.5, 0.1], [0, 0, Math.PI / 2]); // (logs)
  addCollider({ x: right - 0.5, y: 0.25, z: back + 2.2, w: 0.6, h: 0.5, d: 0.8 });
  const bed = [right - 3.2, back + 1.5];
  part(g, cyl, mat(0xe8668a), [bed[0], 0.06, bed[1]], [0.34, 0.12, 0.34]);
  const kitten = live(new THREE.Group());
  kitten.position.set(bed[0], 0.16, bed[1]);
  kitten.rotation.y = 0.6;
  g.add(kitten);
  part(kitten, ball, mat(0xd9a060), [0, 0.07, 0], [0.19, 0.1, 0.14]);
  part(kitten, ball, mat(0xf4efe4), [0.06, 0.05, 0.1], [0.08, 0.05, 0.05]);
  part(kitten, ball, mat(0xd9a060), [0.18, 0.08, 0.04], [0.08, 0.07, 0.07]);
  for (const dz of [-0.03, 0.05]) part(kitten, cone, mat(0xd9a060), [0.21, 0.15, 0.04 + dz * 0.8], [0.025, 0.05, 0.02]);
  part(kitten, new THREE.TorusGeometry(0.16, 0.025, 5, 12, Math.PI * 1.2), mat(0xc88a4a), [-0.02, 0.05, 0.0], [1, 1, 1], [Math.PI / 2, 0, 3.4]);
  anims.push((t) => kitten.scale.set(1, 1 + Math.sin(t * 1.6) * 0.06, 1));

  // ---- the back wall: curtains, Gran, the clock
  curtains(wb, [left + 1.6, 1.9], 1.0, 0.95, 0xf4b6cf);
  curtains(wb, [right - 1.6, 1.9], 1.0, 0.95, 0xf4b6cf);
  frame(wb, [left + 2.65, 1.95], 0.52, 0.62, painting('gran', 104, 124), 0x6e4a2b);
  clocks.push(clock(wb, [right - 2.65, 1.95], 0.26, 0x9a3a2e));

  // ---- the left wall: a chalkboard of today's bakes, copper pots, the recipe card
  const board = s.wall('left', back + 6.0, 1.7);
  frame(board, [0, 0], 1.6, 1.1, boardTexture(['TODAY', 'Honey cake, loaves', 'Mushroom pie', 'Tea and tarts'], { w: 320, h: 220, size: 30 }), 0x6e4a2b);
  const racks = s.wall('left', back + 3.2, 2.35);
  part(racks, box, mat(0x6e4a2b), [0, 0, 0.1], [1.2, 0.04, 0.04]);
  for (let i = 0; i < 4; i++) {
    const x = -0.45 + i * 0.3;
    part(racks, box, mat(0x6e4a2b), [x, -0.06, 0.1], [0.01, 0.1, 0.01]);
    part(racks, cyl, mat(0xb8733a), [x, -0.22, 0.1], [0.1 + (i % 2) * 0.02, 0.14, 0.1 + (i % 2) * 0.02], [Math.PI / 2, 0, 0]);
    part(racks, cyl, mat(0x7a4a24), [x, -0.22, 0.17], [0.09, 0.02, 0.09], [Math.PI / 2, 0, 0]);
  }
  const card = story.group(s.wall('left', back + 1.6, 1.8), (c) => c.done('mabel_omelette')); // (Gran's card, framed, once you have cooked for her)
  frame(card, [0, 0], 0.5, 0.4, painting('card', 120, 96), 0x6e4a2b);

  // ---- a baker's floor in front of the oven, and the floured work table
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) part(g, box, mat((i + j) % 2 ? 0xf0e0c0 : 0xc87a58), [right - 4.4 + i * 0.42, 0.012, back + 1.75 + j * 0.4], [0.42, 0.02, 0.4]).castShadow = false;
  const wt = [left + 2.5, front - 3.3];
  part(g, box, woodMat, [wt[0], 0.9, wt[1]], [2.2, 0.1, 1.0]);
  for (const [dx, dz] of [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]]) part(g, box, darkWoodMat, [wt[0] + dx, 0.43, wt[1] + dz], [0.1, 0.86, 0.1]);
  part(g, box, darkWoodMat, [wt[0], 0.3, wt[1]], [1.9, 0.05, 0.8]);
  part(g, box, mat(0xf4f0e8), [wt[0] - 0.3, 0.955, wt[1]], [0.9, 0.012, 0.6]).castShadow = false; // flour
  part(g, ball, mat(0xf2e2c0), [wt[0] - 0.3, 1.0, wt[1]], [0.22, 0.08, 0.18]); // dough
  part(g, cyl, mat(0xc9a066), [wt[0] + 0.2, 0.975, wt[1] + 0.1], [0.04, 0.5, 0.04], [0, 0.3, Math.PI / 2]); // a rolling pin
  part(g, cyl, mat(0xe8e0d0), [wt[0] + 0.75, 1.0, wt[1] - 0.15], [0.15, 0.12, 0.15]);
  part(g, cyl, mat(0xf4f0e8), [wt[0] + 0.75, 1.07, wt[1] - 0.15], [0.12, 0.03, 0.12]);
  for (const dx of [-0.45, 0.45]) part(g, box, mat(0xf4efe4), [wt[0] + dx, 0.25, wt[1] + 0.7], [0.4, 0.5, 0.3]); // sacks of flour under it
  addCollider({ x: wt[0], y: 0.5, z: wt[1], w: 2.2, h: 1, d: 1.0 });
  const mushrooms = when((c) => c.done('mabel_mushrooms'), [wt[0] + 0.75, 0.96, wt[1] + 0.25]); // (the ones you found)
  part(mushrooms, cyl, mat(0xc9a066), [0, 0.06, 0], [0.18, 0.12, 0.18]);
  for (const [dx, dz, color] of [[-0.06, -0.03, 0xc8a070], [0.07, 0.02, 0xa87a50], [0, 0.07, 0xd8b888], [0.02, -0.07, 0xb88858]]) {
    part(mushrooms, cyl, mat(0xf4efe4), [dx, 0.15, dz], [0.025, 0.1, 0.025]);
    part(mushrooms, ball, mat(color), [dx, 0.2, dz], [0.06, 0.04, 0.06]);
  }
  const feast = when((c) => c.done('mabel_feast'), [wt[0], 0.96, wt[1]]); // (the farm feast: the table, laid, for the first time in thirty years)
  part(feast, box, mat(0xfffaf0), [0, 0.0, 0], [2.3, 0.012, 1.1]).castShadow = false;
  part(feast, box, mat(0xfffaf0), [0, -0.3, 0.56], [2.3, 0.7, 0.012]).castShadow = false;
  for (const dx of [-0.8, -0.3, 0.3, 0.8]) plate(feast, [dx, 0.01, 0.32], [0xc8843a, 0xe0362c, 0xf2c230, 0x6bbf4a][Math.abs(dx * 10) % 4]);
  part(feast, cyl, mat(0xe8e0d0), [-0.1, 0.05, -0.1], [0.3, 0.05, 0.3]);
  part(feast, ball, mat(0xb8662a), [-0.1, 0.17, -0.1], [0.24, 0.14, 0.2]); // the roast
  part(feast, cyl, mat(0xe8e0d0), [0.6, 0.04, -0.12], [0.18, 0.04, 0.18]);
  for (const [dx, dz, color] of [[0.55, -0.12, 0xf2c230], [0.65, -0.08, 0xff8c1a], [0.62, -0.18, 0xe0362c]]) part(feast, ball, mat(color), [dx, 0.1, dz], [0.06, 0.06, 0.06]);
  for (const dx of [-0.95, 0.95]) {
    const flame = candle(feast, [dx, 0.0, -0.2]);
    flame.castShadow = false;
  }

  // ---- by the door: what you have brought, what she is given
  const tarts = when((c) => c.done('mabel_berries'), [midX + 1.05, 1.06, counterZ]); // (berry tarts, cooling)
  part(tarts, box, mat(0xd8d0c0), [0, 0.01, 0], [0.6, 0.02, 0.3]);
  for (let i = 0; i < 4; i++) {
    part(tarts, cyl, mat(0xd8a060), [-0.21 + i * 0.14, 0.05, 0], [0.06, 0.05, 0.06]);
    part(tarts, ball, mat(i % 2 ? 0xc0392b : 0x7a2a5a), [-0.21 + i * 0.14, 0.085, 0], [0.04, 0.03, 0.04]);
  }
  const honey = when((c) => c.done('mabel_honey'), [midX - 0.4, 1.06, counterZ]); // (honey, from your hives)
  for (let i = 0; i < 3; i++) jar(honey, [(i - 1) * 0.2, 0, 0], 0xe0a030, { r: 0.07, h: 0.16, lid: 0xf4efe4 });
  const marrows = when((c) => c.done('mabel_note'), [midX + 2.4, 0, front - 0.8]); // (Basil's marrows, now; they were courgettes)
  for (const [dx, dz, ry] of [[0, 0, 0.4], [0.35, 0.1, -0.3]]) {
    part(marrows, ball, mat(0x5a8a3a), [dx, 0.13, dz], [0.32, 0.12, 0.12], [0, ry, 0]);
    part(marrows, ball, mat(0xc8d890), [dx, 0.15, dz], [0.3, 0.05, 0.1], [0, ry, 0]);
  }

  // ---- the table: tea, and a pie cooling; a cushion and a cup for you
  const { x: tx, z: tz } = s.tableAt;
  part(g, box, mat(0xf4b6cf), [tx, 0.835, tz], [1.0, 0.012, 1.0]).castShadow = false;
  part(g, ball, mat(0xf4efe4), [tx - 0.15, 0.93, tz - 0.2], [0.11, 0.1, 0.11]); // a teapot
  part(g, cone, mat(0xf4efe4), [tx - 0.01, 0.95, tz - 0.2], [0.025, 0.1, 0.025], [0, 0, -Math.PI / 2]);
  part(g, cyl, mat(0xe8dcc8), [tx + 0.25, 0.86, tz + 0.15], [0.2, 0.03, 0.2]);
  part(g, cyl, mat(0xc8843a), [tx + 0.25, 0.9, tz + 0.15], [0.17, 0.06, 0.17]); // a pie
  const yours = when((c) => c.hearts >= 2, [tx, 0.84, tz]);
  mug(yours, [-0.3, 0, 0.25], 0xe88aa8);
  const flowers = when((c) => c.hearts >= 4, [tx, 0.84, tz]);
  part(flowers, cyl, mat(0x9ec6e0), [-0.35, 0.08, -0.1], [0.06, 0.16, 0.06]);
  for (const [dx, dy, color] of [[-0.38, 0.22, 0xff7eb6], [-0.32, 0.26, 0xf2c230], [-0.3, 0.2, 0xffffff]]) part(flowers, ball, mat(color), [dx, dy, -0.1], [0.05, 0.05, 0.05]);
}

export const ROOMS = {
  rosa: { floor: 0x9a6a3a, wall: 0xf0e0c0, beam: 0x7a2a1a, blanket: 0xc0392b, door: 0x7a2a1a, props: rosaRoom },
  basil: { floor: 0x8a6a4a, wall: 0xe4ecd4, beam: 0x5a4632, blanket: 0x4f7a3a, door: 0x3f6b3a, rug: 0x4f7a3a, rugEdge: 0xd8c08a, bedSide: 'right', tableSide: 'left', props: basilRoom },
  finn: { floor: 0x7a6a5a, wall: 0xa8c0d0, beam: 0x3a4a5a, blanket: 0x2f4f7a, door: 0x3a4a5a, rug: 0x2f4f7a, rugEdge: 0xe8e0d0, counter: 0x5f7f9a, windows: 'round', bed: false, props: finnRoom },
  mabel: { floor: 0xb08a5a, wall: 0xfff2dc, beam: 0x6e4a2b, blanket: 0xe88aa8, door: 0x9c3a2e, rug: 0xe88aa8, rugEdge: 0xfff4e0, counterTop: 0xe8dcc8, props: mabelRoom },
};
