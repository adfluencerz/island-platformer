import * as THREE from 'three';
import './chest.css';
import { ITEMS, spriteURL } from './items.js';
import { COLS, SLOT_COUNT, CATEGORIES } from './inventory.js';
import { foliageMat } from './world.js';
import { el, button, placeTip } from './ui/dom.js';
import { FARM_CHEST } from '../shared/level.js';

// ---------- The farm's chest ----------
// Built in build mode (the farm_chest piece, one to a farm), it stands where
// it was put; on a farm with helpers there is one on the grass by the plaza
// till then (main.js says where, moveTo). E next to it (or a tap) opens it.
// On a farm with helpers (server/farmroom.js) what anyone harvests goes in
// here: everyone sees what is in it and can put things in from their
// backpack; only the farm's owner takes things out. Its contents are the
// room's: this window asks (onPut, onTake) and draws what the room says
// (setItems). On a farm without helpers it is the farmer's own, to keep
// things in (main.js keeps what is in it, in the farm's save).
//
//   click a backpack slot     put the stack in (right click: one)
//   click something in it     take it out, the owner only (right click: one)
//   Put all in                everything in the backpack rows (not the toolbar, never tools)
//   Organize by kind          what is in it grouped by kind, as the backpack's Organize
//                             does (again: A to Z); this page remembers which
//   E / Esc / ×               close

const REACH = 1.6; // from the chest's middle
const KIND_ORDER = Object.keys(CATEGORIES);
const BY_KIND = 'tp.chestByKind'; // (localStorage: this page shows the chest by kind)
const loadByKind = () => {
  try {
    return localStorage.getItem(BY_KIND) === '1';
  } catch {
    return false;
  }
};
export const CHEST_W = 1.1;

// ---------- The chest itself ----------
const woodMat = foliageMat(0x9c5a2c);
const lidMat = foliageMat(0xb4703a);
const bandMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.5, metalness: 0.6, flatShading: true });
const latchMat = new THREE.MeshStandardMaterial({ color: 0xe0b23a, roughness: 0.35, metalness: 0.7, flatShading: true });

function box(parent, material, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// The chest, standing at the origin (build mode's see-through one is this too;
// a sky isle's locked one has its own materials: src/skyisles.js)
export function chestModel({ wood = woodMat, top = lidMat, band = bandMat } = {}) {
  const root = new THREE.Group();
  root.name = 'chest';
  box(root, wood, CHEST_W, 0.55, 0.7, 0, 0.275, 0);
  // the lid, a little rounded: a box with a half-cylinder on top
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.35); // hinged at the back
  root.add(lid);
  box(lid, top, 1.12, 0.12, 0.72, 0, 0.06, 0.35);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.12, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), top);
  dome.scale.set(1, 0.45, 1);
  dome.position.set(0, 0.12, 0.35);
  dome.castShadow = true;
  lid.add(dome);
  for (const x of [-0.38, 0.38]) {
    box(root, band, 0.08, 0.57, 0.72, x, 0.275, 0);
    box(lid, band, 0.08, 0.14, 0.74, x, 0.06, 0.35);
  }
  box(root, latchMat, 0.14, 0.16, 0.05, 0, 0.5, 0.37);
  return { root, lid };
}

// inventory: from createInventory. onOpenChange(open): the game pauses input.
// onPut(item, count): into the chest (already out of the backpack).
// onTake(item, count): ask for it out of the chest (the owner).
// The chest standing on the farm: one, whoever opens it (each farmer at a
// split screen has a window of their own: createChest's model)
export function createChestModel() {
  const { root, lid } = chestModel();
  root.position.set(FARM_CHEST.x, 0, FARM_CHEST.z);
  root.visible = false;
  let lidOpen = 0;
  return {
    root,
    show: (on) => (root.visible = on),
    shown: () => root.visible,
    moveTo: (x, z) => root.position.set(x, 0, z),
    at: () => root.position,
    inReach: (pos) => root.visible && pos.y < 2.2 && Math.hypot(pos.x - root.position.x, pos.z - root.position.z) < REACH,
    // the lid lifts while it is open (open: someone has it open)
    update(dt, open) {
      lidOpen += ((open ? 1 : 0) - lidOpen) * Math.min(1, dt * 10);
      lid.rotation.x = -lidOpen * 1.1;
    },
    // where it stands, for a collider: { x, y, z, w, h, d }
    box: () => ({ x: root.position.x, y: 0.4, z: root.position.z, w: CHEST_W, h: 0.8, d: 0.7 }),
  };
}

// model: the chest on the farm (createChestModel), when it is another window's too
export function createChest({ inventory, onOpenChange, onPut, onTake, parent = document.body, active = () => true, model = createChestModel() }) {
  const { root } = model;
  let open = false;
  let mine = false;
  let owner = '';
  let shared = true; // (false: a farm without helpers, the farmer's own chest)
  let items = {}; // item -> count, as the room says
  let byKind = loadByKind();

  // ---------- The window ----------
  const menuEl = el('div', 'inv-menu chest-menu', parent);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame chest-window', menuEl);
  el('div', 'inv-tab inv-frame', windowEl, 'Farm chest');
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';
  const noteEl = el('div', 'chest-note', windowEl);
  const itemsBar = el('div', 'chest-bar', windowEl);
  el('div', 'chest-heading', itemsBar, 'In the chest');
  const kindBtn = button('inv-button', itemsBar, '', () => {
    byKind = !byKind;
    try {
      localStorage.setItem(BY_KIND, byKind ? '1' : '0');
    } catch {}
    render();
  });
  const itemsEl = el('div', 'chest-items', windowEl);

  const putBar = el('div', 'chest-bar', windowEl);
  el('div', 'chest-heading', putBar, 'Put in from your backpack');
  const allBtn = button('inv-button', putBar, 'Put all in', () => putAll());
  allBtn.title = 'Everything in your backpack rows (the toolbar and your tools stay with you)';
  const gridEl = el('div', 'inv-grid', windowEl);
  const slotViews = Array.from({ length: SLOT_COUNT }, (_, i) => {
    if (i === COLS) el('div', 'inv-divider', gridEl);
    const slot = el('div', 'inv-slot', gridEl);
    slot.dataset.put = i;
    const img = el('img', 'inv-icon', slot);
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'inv-count', slot);
    return { root: slot, img, count };
  });
  const hintEl = el('div', 'inv-hint chest-hint', windowEl);
  const mouseHint = el('span', 'mouse-only', hintEl);
  const touchHint = el('span', 'touch-only', hintEl);

  const tooltipEl = el('div', 'inv-tooltip inv-frame', parent);
  tooltipEl.hidden = true;

  const keeps = (id) => ITEMS[id]?.category !== 'Tool'; // (your tools stay with you)

  function render() {
    noteEl.textContent = !shared
      ? 'Keep things here: put them in from your backpack, take them out any time.'
      : mine
      ? 'What your helpers harvest lands here. Take out what you like.'
      : `What anyone harvests lands here. ${owner || 'The farmer'} takes things out; you can put things in.`;
    mouseHint.textContent = mine
      ? 'Click: take the stack out (right click: one) · Click your items: put the stack in (right click: one)'
      : 'Click your items: put the stack in (right click: one)';
    touchHint.textContent = mine ? 'Tap: take the stack out · Tap your items: put them in' : 'Tap your items: put them in';
    kindBtn.textContent = byKind ? 'Sort A to Z' : 'Organize by kind';
    kindBtn.title = byKind ? 'List what is in the chest by name' : 'Group what is in the chest by kind, as the backpack is';
    itemsEl.textContent = '';
    const ids = Object.keys(items).filter((id) => items[id] > 0);
    if (!ids.length) el('div', 'chest-empty', itemsEl, 'Empty for now.');
    const name = (id) => ITEMS[id]?.name ?? id;
    const kind = (id) => {
      const at = KIND_ORDER.indexOf(ITEMS[id]?.category);
      return at < 0 ? KIND_ORDER.length : at; // (something this page doesn't know: last)
    };
    ids.sort((a, b) => (byKind && kind(a) - kind(b)) || name(a).localeCompare(name(b)));
    for (const id of ids) {
      const cell = button('inv-slot chest-cell' + (mine ? '' : ' chest-locked'), itemsEl);
      cell.dataset.take = id;
      const img = el('img', 'inv-icon', cell);
      img.alt = '';
      if (ITEMS[id]) img.src = spriteURL(ITEMS[id]);
      else img.hidden = true; // (something this page doesn't know: a newer version's)
      el('span', 'inv-count', cell, items[id] > 1 ? String(items[id]) : '');
    }
    slotViews.forEach((view, i) => {
      const stack = inventory.slot(i);
      view.img.hidden = !stack;
      if (stack) view.img.src = spriteURL(ITEMS[stack.id]);
      view.count.textContent = stack && stack.count > 1 ? stack.count : '';
      view.root.classList.toggle('chest-nokeep', !!stack && !keeps(stack.id));
    });
  }

  function showTooltip(target, x, y) {
    let def = null;
    let note = '';
    if (target?.dataset.take) {
      def = ITEMS[target.dataset.take];
      note = mine ? `${items[target.dataset.take]} in the chest` : `${owner || 'The farmer'} takes things out`;
    } else if (target?.dataset.put) {
      const stack = inventory.slot(Number(target.dataset.put));
      def = stack && ITEMS[stack.id];
      note = def && (keeps(stack.id) ? 'Click to put it in the chest' : 'Your tools stay with you');
    }
    tooltipEl.hidden = !def;
    if (!def) return;
    tooltipEl.innerHTML = `
      <div class="inv-tt-name">${def.name}</div>
      <div class="inv-tt-cat" style="color:${CATEGORIES[def.category]}">${def.category}</div>
      <div class="inv-tt-meta">${note}</div>`;
    placeTip(tooltipEl, x, y);
  }

  function put(i, count) {
    const stack = inventory.slot(i);
    if (!stack) return;
    if (!keeps(stack.id)) return inventory.notify('Your tools stay with you');
    const n = inventory.take(i, count);
    if (n) onPut(stack.id, n);
  }

  // Everything in the backpack rows that can go in (the toolbar is left alone)
  function putAll() {
    let any = false;
    for (let i = COLS; i < SLOT_COUNT; i++) {
      const stack = inventory.slot(i);
      if (!stack || !keeps(stack.id)) continue;
      put(i, Infinity);
      any = true;
    }
    if (!any) inventory.notify('Nothing in your backpack rows to put in');
    render();
  }

  function take(id, count) {
    if (!mine) return inventory.notify(`Only ${owner || 'the farmer'} takes things out of the chest`);
    const have = items[id] ?? 0;
    let n = Math.min(count, have);
    if (!inventory.canAdd(id, n)) n = inventory.canAdd(id, 1) ? 1 : 0; // (the whole stack doesn't fit: one at a time)
    if (!n) return inventory.add(id, 1); // (says "Inventory full")
    onTake(id, n);
  }

  itemsEl.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('[data-take]');
    if (!cell || (e.button !== 0 && e.button !== 2)) return;
    take(cell.dataset.take, e.button === 2 ? 1 : Infinity);
  });
  gridEl.addEventListener('mousedown', (e) => {
    const slot = e.target.closest('[data-put]');
    if (!slot || (e.button !== 0 && e.button !== 2)) return;
    put(Number(slot.dataset.put), e.button === 2 ? 1 : Infinity);
    render();
    showTooltip(slot, e.clientX, e.clientY);
  });
  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  menuEl.addEventListener('pointerdown', (e) => e.target === menuEl && setOpen(false)); // a press outside the window (a fresh one: not the mouse events a phone makes afterwards of the tap that opened it)
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  menuEl.addEventListener('pointermove', (e) => showTooltip(e.target.closest('[data-take], [data-put]'), e.clientX, e.clientY));

  // Capture phase, like the shop's: while the chest is open it has the keyboard
  window.addEventListener('keydown', (e) => {
    if (!open || !active()) return;
    e.stopPropagation();
    if ((e.code === 'Escape' || e.code === 'KeyE') && !e.repeat) setOpen(false);
  }, true);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menuEl.hidden = !open;
    tooltipEl.hidden = true;
    if (open) render();
    onOpenChange?.(open);
  }

  return {
    root,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
    // on a farm with helpers (or not: then it isn't there)
    show(on) {
      model.show(on);
      if (!on) setOpen(false);
    },
    shown: model.shown,
    // mine: our own farm (we take things out). ownerName: whose it is, for the
    // words. withHelpers: false on a farm without helpers
    setOwner(isMine, ownerName = '', withHelpers = true) {
      mine = isMine;
      owner = ownerName;
      shared = withHelpers;
      if (open) render();
    },
    // where it stands (x, z: the middle of it)
    moveTo: model.moveTo,
    at: model.at,
    setItems(next) {
      items = { ...next };
      if (open) render();
    },
    refresh: () => open && render(), // (the backpack changed)
    inReach: model.inReach,
    update: (dt) => model.update(dt, open),
    box: model.box,
  };
}
