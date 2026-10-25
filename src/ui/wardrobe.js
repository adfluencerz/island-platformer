import * as THREE from 'three';
import { createFarmer } from '../character.js';
import { LOOK_PARTS, DEFAULT_LOOK, cleanLook, sameLook, hatColorLabel, randomLook } from '../../shared/looks.js';
import { PLAYER_COLORS } from '../../shared/constants.js';
import { el, button, hexColor } from './dom.js';

// ---------- The wardrobe ----------
// The menu's Your farmer page (ui/splash.js): the farmer turning slowly on a
// little stage (drag to turn them yourself), and what they could wear, a tab
// for each part of them (shared/looks.js). A pick shows at once, on the stage
// and on our farmer in the game, and is kept with the account a moment after
// the last one (and on the way out of the page), so other farmers see it too.
// The stage has a renderer of its own, made the first time the page opens
// and drawing only while it is open; it shows once its shaders are ready, so
// opening the page never waits on them.

// [tab, [[part, label], ...]] ('shirt': the shirt's color, which is the account's color)
const TABS = [
  ['Hat', [['hat', 'Style'], ['hatColor', null]]],
  ['Hair', [['hair', 'Style'], ['hairColor', 'Color']]],
  ['Face', [['skin', 'Skin'], ['face', 'Extras'], ['whiskers', 'Whiskers']]],
  ['Top', [['top', 'Style'], ['shirt', 'Color'], ['neck', 'Round the neck'], ['neckColor', 'Its color']]],
  ['Bottoms', [['bottoms', 'Style'], ['bottomsColor', 'Color'], ['apron', 'Over the front'], ['apronColor', 'Its color']]],
  ['Shoes', [['shoes', 'Style'], ['shoesColor', 'Color']]],
];
// Where the stage's camera looks for each tab: the height it looks at, and how far back it is
const FOCUS = {
  Hat: [1.3, 2.9], Hair: [1.25, 2.6], Face: [1.3, 2.2], Top: [0.95, 3.2], Bottoms: [0.7, 3.1], Shoes: [0.45, 2.7],
};
const SAVE_AFTER = 700; // ms after the last pick
const SPIN = 0.45; // radians a second, while nobody is turning them

export class Wardrobe {
  // onTryOn(look, color): wear it now (our farmer in the game). onSave(look,
  // color): keep it with the account; resolves to the account ({ look, color }),
  // or throws, with why. onStatus(text, isError): a word on how that went.
  constructor(parent, { onTryOn, onSave, onStatus }) {
    Object.assign(this, { onTryOn, onSave, onStatus });
    this.look = { ...DEFAULT_LOOK };
    this.color = PLAYER_COLORS[0];
    this.saved = null; // what the account has, as far as we know
    this.tab = 0;

    const stage = el('div', 'ui-stage', parent);
    this.canvas = el('canvas', 'ui-stage-canvas', stage);
    el('div', 'ui-stage-hint', stage, 'Drag to turn');
    const tabs = el('div', 'ui-tabs', parent);
    this.tabButtons = TABS.map(([name], i) => button('ui-btn ui-btn-small ui-btn-ghost', tabs, name, () => this.showTab(i)));
    this.panel = el('div', 'ui-wardrobe', parent);
    const row = el('div', 'ui-row', parent);
    button('ui-btn ui-btn-small ui-btn-ghost', row, 'Surprise me', () => this.pick(randomLook(Math.random, this.look), this.color));
    button('ui-btn ui-btn-small ui-btn-ghost', row, 'Classic farmer', () => {
      const { skin, hair, hairColor } = this.look;
      this.pick({ ...DEFAULT_LOOK, skin, hair, hairColor }, this.color);
    });

    // Turning them: drag across the stage
    this.yaw = 0;
    this.heldUntil = 0; // (the stage waits a little after a drag before it turns them again)
    let dragX = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      dragX = e.clientX;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      this.yaw += (e.clientX - dragX) * 0.012;
      dragX = e.clientX;
      this.heldUntil = performance.now() + 2500;
    });
    const release = () => (dragX = null);
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
  }

  // The page opens, on what they wear now (look, and the shirt's color)
  show(look, color) {
    this.saved = { look: cleanLook(look), color };
    this.look = { ...this.saved.look };
    this.color = color;
    this.showTab(this.tab);
    // (the stage starts once the page is up: the first time, getting it ready takes a moment)
    this.open = true;
    requestAnimationFrame(() => setTimeout(() => this.open && this.startStage()));
  }

  // The page closes: what was picked is kept (if it isn't yet)
  hide() {
    this.open = false;
    this.running = false;
    this.flush();
  }

  // Wear this now; it is kept a moment later
  pick(look, color) {
    this.look = cleanLook(look);
    this.color = color;
    this.dressStage(true);
    this.onTryOn(this.look, this.color);
    this.showTab(this.tab);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_AFTER);
  }

  async flush() {
    clearTimeout(this.saveTimer);
    if (!this.saved || (sameLook(this.look, this.saved.look) && this.color === this.saved.color)) return;
    if (this.saving) {
      this.again = true; // (once this one is in)
      return;
    }
    this.saving = true;
    try {
      const account = await this.onSave(this.look, this.color);
      this.saved = { look: cleanLook(account?.look), color: account?.color ?? this.color };
      this.onStatus('');
    } catch (e) {
      // back into what the account has
      this.onStatus(e.message, true);
      this.look = { ...this.saved.look };
      this.color = this.saved.color;
      this.dressStage(false);
      this.onTryOn(this.look, this.color);
      this.showTab(this.tab);
    } finally {
      this.saving = false;
      if (this.again) {
        this.again = false;
        this.flush();
      }
    }
  }

  // ---------- The choices ----------
  showTab(i) {
    this.tab = i;
    this.tabButtons.forEach((b, k) => b.classList.toggle('ui-btn-ghost', k !== i));
    const box = this.panel;
    box.textContent = '';
    const [, parts] = TABS[i];
    for (const [part, label] of parts) {
      const none = { hatColor: 'hat', neckColor: 'neck', apronColor: 'apron' }[part]; // (no color for what isn't worn)
      if (none && this.look[none] === 'none') continue;
      el('div', 'ui-wardrobe-label', box, part === 'hatColor' ? hatColorLabel(this.look.hat) : label);
      const wear = (value) => (part === 'shirt' ? this.pick(this.look, value) : this.pick({ ...this.look, [part]: value }, this.color));
      if (part === 'shirt') {
        this.swatches(box, PLAYER_COLORS, this.color, wear);
        el('div', 'ui-muted ui-small', box, 'Your shirt’s color is your color online too: by your name, in chat and in the player list.');
      } else if (LOOK_PARTS[part].styles) this.chips(box, LOOK_PARTS[part].styles, this.look[part], wear);
      else this.swatches(box, LOOK_PARTS[part].colors, this.look[part], wear);
    }
  }

  chips(parent, styles, current, pick) {
    const row = el('div', 'ui-chips', parent);
    for (const [id, label] of styles) {
      const b = button(`ui-btn ui-btn-small${id === current ? '' : ' ui-btn-ghost'}`, row, label, () => pick(id));
      b.setAttribute('aria-pressed', String(id === current));
    }
  }

  swatches(parent, colors, current, pick) {
    const row = el('div', 'ui-swatches', parent);
    for (const color of colors) {
      const b = button(`ui-swatch${color === current ? ' on' : ''}`, row, '', () => pick(color));
      b.style.background = hexColor(color);
      b.setAttribute('aria-label', hexColor(color));
      b.setAttribute('aria-pressed', String(color === current));
    }
  }

  // ---------- The stage ----------
  startStage() {
    if (!this.renderer) {
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      } catch {
        this.canvas.parentNode.hidden = true; // (no WebGL to spare: the choices still work)
        return;
      }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = (this.scene = new THREE.Scene());
      scene.add(new THREE.HemisphereLight(0xfff6e6, 0x7a5a3a, 1.15));
      const key = new THREE.DirectionalLight(0xfff2dc, 1.35);
      key.position.set(1.6, 4, 3);
      scene.add(key);
      // a round of grass to stand on, with an earthy edge, and a soft shadow on it
      const grass = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.1, 40), new THREE.MeshLambertMaterial({ color: 0x7cb35a }));
      grass.position.y = -0.05;
      const earth = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.72, 0.16, 40), new THREE.MeshLambertMaterial({ color: 0x9a6b3e }));
      earth.position.y = -0.14;
      const shade = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
      shade.rotation.x = -Math.PI / 2;
      shade.position.y = 0.002;
      scene.add(grass, earth, shade);
      this.farmer = createFarmer({ shirt: this.color, look: this.look });
      this.farmer.hoe.visible = false;
      this.farmer.root.position.y = 0.8; // (feet on the grass)
      scene.add(this.farmer.root);
      this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
      this.focus = [...FOCUS[TABS[this.tab][0]]];
    }
    this.dressStage(false);
    if (!this.ready) {
      // (the first time: its shaders first, then it shows)
      this.ready = this.renderer.compileAsync(this.scene, this.camera).catch(() => {}).then(() => {
        this.compiled = true;
        this.canvas.classList.add('ready');
      });
    }
    if (this.running) return;
    this.running = true;
    const run = (this.runs = (this.runs ?? 0) + 1); // (a loop from before a quick close and open stops)
    let last = performance.now();
    const frame = (now) => {
      if (!this.running || run !== this.runs) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.drawStage(dt, now / 1000);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // hop: a little hop, for something new on
  dressStage(hop) {
    if (!this.farmer) return;
    this.farmer.setShirt(this.color);
    this.farmer.setLook(this.look);
    if (hop) this.farmer.anim.squash = -0.18;
  }

  drawStage(dt, time) {
    const { canvas, renderer, camera, farmer } = this;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || !this.compiled) return;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (performance.now() > this.heldUntil) this.yaw += SPIN * dt;
    farmer.anim.facing = this.yaw;
    farmer.animate(dt, { moving: false, onGround: true, targetYaw: this.yaw, time });
    // the camera eases to what the tab is about
    const [y, dist] = FOCUS[TABS[this.tab][0]];
    const k = 1 - Math.exp(-6 * dt);
    this.focus[0] += (y - this.focus[0]) * k;
    this.focus[1] += (dist - this.focus[1]) * k;
    camera.position.set(0, this.focus[0] + this.focus[1] * 0.28, this.focus[1]);
    camera.lookAt(0, this.focus[0], 0);
    renderer.render(this.scene, camera);
  }
}

// A soft dark round, darkest in the middle: the farmer's shadow on the stage
function blobTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(20, 40, 10, 0.55)');
  grad.addColorStop(1, 'rgba(20, 40, 10, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
