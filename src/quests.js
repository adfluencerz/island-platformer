import './quests.css';
import { NPCS, NPC_IDS } from '../shared/npcs.js';
import { HOME_HALF, NPC_HOMES, STALL, homeGround, LAKE } from '../shared/farmland.js';
import { portraitURL, needText, heartText } from './dialog.js';
import { el } from './ui/dom.js';

// ---------- The bag's Quests tab ----------
// The neighbours (src/npcs.js), each with how much they like you, whether
// their shop is open to you, and what they have asked you to do and how far
// it has come (or where to find them, if you haven't met).
// npcs: src/npcs.js; ctx: what missions are checked against (main.js)
export function renderQuests(root, npcs, ctx) {
  root.replaceChildren();
  el('div', 'quests-intro', root, 'Your neighbours in the valley, and what they have asked of you. Talk to them (E) to hand things over.');
  for (const id of NPC_IDS) {
    const npc = NPCS[id];
    const state = npcs.state(id);
    const card = el('div', 'quest-card', root);
    const face = el('img', 'quest-face', card);
    face.src = portraitURL(id);
    face.alt = '';
    const body = el('div', 'quest-body', card);
    const head = el('div', 'quest-head', body);
    el('span', 'quest-name', head, `${npc.name} · ${npc.title}`);
    el('span', 'quest-hearts', head, heartText(npcs.hearts(id)));
    const done = state.done.length;
    el('div', 'quest-meta', body, `${npc.trade}, ${npc.where} · shop ${npcs.shopOpen(id) ? 'open' : 'not open yet'} · ${done}/${npc.missions.length} requests done`);
    if (!state.met) {
      el('div', 'quest-text', body, `You haven't met ${npc.name} yet. Look ${npc.where} (the Map tab shows where).`);
      continue;
    }
    const st = npcs.status(id, ctx);
    if (!st.mission) {
      el('div', 'quest-text done', body, `Everything ${npc.name} asked is done.`);
      continue;
    }
    if (!st.heard) {
      el('div', 'quest-text', body, `${npc.name} has something to ask you: go and see them.`);
      continue;
    }
    el('div', `quest-title${st.ready ? ' ready' : ''}`, body, `${st.mission.title}: ${st.mission.ask}${st.ready ? ' (ready to hand over!)' : ''}`);
    const needs = el('div', 'quest-needs', body);
    for (const n of st.needs) {
      const { text, icon } = needText(n.need);
      const row = el('span', `quest-need${n.ok ? ' ok' : ''}`, needs);
      const img = el('img', 'inv-icon', row);
      img.src = icon;
      img.alt = '';
      el('span', '', row, `${text} ${Math.min(n.have, n.count)}/${n.count}`);
    }
  }
}

// ---------- The bag's Map tab ----------
// The farm's valley from above, a few pixels a tile: its ground (the old farm
// in the middle, the biomes round it, the lake, the roads), the neighbours'
// homes and the merchant's stall named, and you.
const PX = 3; // pixels a tile
const SIZE = (HOME_HALF * 2 + 1) * PX;
const GROUND_RGB = {
  grass: [93, 155, 58], path: [176, 138, 90], stone: [156, 154, 146], sand: [227, 204, 148], pond: [58, 160, 168],
  moss: [61, 107, 47], meadow: [121, 181, 76], heath: [125, 111, 138], marsh: [95, 107, 58], glade: [95, 138, 106],
  field: [196, 170, 58], patch: [176, 120, 58], glen: [61, 107, 58], dune: [217, 193, 136], bank: [95, 154, 62],
};
let groundImage = null; // (drawn once)
function drawGround(ctx) {
  if (!groundImage) {
    groundImage = ctx.createImageData(SIZE, SIZE);
    const d = groundImage.data;
    for (let gz = -HOME_HALF; gz <= HOME_HALF; gz++) {
      for (let gx = -HOME_HALF; gx <= HOME_HALF; gx++) {
        const rgb = GROUND_RGB[homeGround(gx, gz)] ?? [47, 143, 191];
        const shade = ((gx * 7 + gz * 13) & 3) * 3 - 4; // (a little texture)
        for (let py = 0; py < PX; py++) {
          for (let px = 0; px < PX; px++) {
            const i = (((gz + HOME_HALF) * PX + py) * SIZE + (gx + HOME_HALF) * PX + px) * 4;
            d[i] = rgb[0] + shade;
            d[i + 1] = rgb[1] + shade;
            d[i + 2] = rgb[2] + shade;
            d[i + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(groundImage, 0, 0);
}

// you: where the farmer is on the farm ({ x, z }), or null (not out on it)
export function renderMap(root, you) {
  root.replaceChildren();
  const canvas = el('canvas', 'valley-map', root);
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  drawGround(ctx);
  const at = (x, z) => [(x + HOME_HALF + 0.5) * PX, (z + HOME_HALF + 0.5) * PX];
  const label = (text, x, y, color = '#fff8e8') => {
    ctx.font = 'bold 13px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3d1a04';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  const house = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#3d1a04';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 6);
    ctx.lineTo(x - 7, y - 2);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 7, y - 2);
    ctx.lineTo(x + 7, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  for (const id of NPC_IDS) {
    const home = NPC_HOMES[id];
    const [x, y] = at(home.x, home.z);
    house(x, y, `#${NPCS[id].look.shirt.toString(16).padStart(6, '0')}`);
    label(`${NPCS[id].name}: ${NPCS[id].trade.toLowerCase()}`, x, y + 20);
  }
  const [sx, sy] = at(STALL.x, STALL.z);
  house(sx, sy, '#d8452f');
  label('Merchant', sx + 2, sy + 20);
  const [lx, ly] = at(LAKE.x, LAKE.z);
  label('Lake', lx, ly + 4, '#d8f4ff');
  for (const [text, x, z] of [['Forest', 0, -52], ['Fern glen', -46, -54], ['Bluebells', 44, -53], ['Meadow', -52, 14], ['Heath', -47, 40], ['Sunflowers', 57, 36], ['Dunes', 30, 62], ['Your farm', 0, -2]]) {
    const [x2, y2] = at(x, z);
    label(text, x2, y2, '#ffe9a8');
  }
  if (you) {
    const [x, y] = at(you.x, you.z);
    ctx.fillStyle = '#e0261b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label('You', x, y - 10);
  }
  el('div', 'quests-intro', root, you ? 'The red dot is you. The roads out of the old farm lead to each neighbour\'s door.' : 'You\'re not out on the farm just now.');
}
