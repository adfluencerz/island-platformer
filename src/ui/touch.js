// On-screen controls for touch screens: a thumbstick (bottom left) to walk,
// and buttons (bottom right) for the keys a phone doesn't have: Use (E), Jump
// (Space), the backpack (I) and, in a lobby, chat (Enter). Holding the clock
// fast-forwards time at home, like T. The buttons press those keys for real
// (a keydown, and a keyup when let go), so the game, the backpack and the
// menus treat them just like the keyboard.
//
// They show on touch screens only: html.touch, set as soon as the page knows
// it is on one (a phone or tablet, a phone's browser, or the first touch on a
// laptop's screen). Any small screen, touch or not, also gets html.compact: a
// smaller HUD with the place panel folded up. touch.css has both layouts.
// Tapping the world itself (walk there, farm a tile, gather) is in main.js.
import './touch.css';
import { el } from './dom.js';

const html = document.documentElement;
export const isTouch = () => html.classList.contains('touch');
const small = matchMedia('(max-width: 700px), (max-height: 500px)');
const fit = () => html.classList.toggle('compact', isTouch() || small.matches);
const touchOn = () => {
  html.classList.add('touch');
  fit();
};
const phone = navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobi/.test(navigator.userAgent);
if (phone || matchMedia('(pointer: coarse)').matches) touchOn();
addEventListener('pointerdown', (e) => e.pointerType === 'touch' && !isTouch() && touchOn(), { capture: true, passive: true });
small.addEventListener('change', fit);
fit();

// Safari on iOS ignores user-scalable=no: two fingers anywhere (the game's own
// pinch zooms the camera) zoomed the whole page instead, and left it stuck
// there. Its gesture events are what start that zoom.
for (const type of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });

const STICK_RADIUS = 46; // px the knob travels from the middle
const DEAD_ZONE = 0.18;

function key(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
}

// A button that holds `code` down while a finger is on it
function holdButton(node, code) {
  let pointer = null;
  const up = () => {
    if (pointer === null) return;
    pointer = null;
    node.classList.remove('down');
    key('keyup', code);
  };
  node.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // (no mouse events after it, no double-tap zoom)
    if (pointer !== null) return;
    pointer = e.pointerId;
    node.setPointerCapture(e.pointerId);
    node.classList.add('down');
    key('keydown', code);
  });
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('lostpointercapture', up);
  return node;
}

export class TouchControls {
  constructor() {
    this.stick = { x: 0, y: 0 }; // where the thumbstick points: -1..1, y down the screen
    const root = (this.root = el('div', 'tc', document.body));

    // ---- the thumbstick ----
    const base = el('div', 'tc-stick', root);
    const knob = el('div', 'tc-knob', base);
    let pointer = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > STICK_RADIUS) {
        dx *= STICK_RADIUS / d;
        dy *= STICK_RADIUS / d;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.min(d / STICK_RADIUS, 1);
      const live = k < DEAD_ZONE ? 0 : (k - DEAD_ZONE) / (1 - DEAD_ZONE); // past the dead zone, 0..1
      this.stick.x = d ? (dx / Math.min(d, STICK_RADIUS)) * live : 0;
      this.stick.y = d ? (dy / Math.min(d, STICK_RADIUS)) * live : 0;
    };
    const release = () => {
      pointer = null;
      base.classList.remove('down');
      knob.style.transform = '';
      this.stick.x = this.stick.y = 0;
    };
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointer !== null) return;
      pointer = e.pointerId;
      base.setPointerCapture(e.pointerId);
      base.classList.add('down');
      move(e);
    });
    base.addEventListener('pointermove', (e) => e.pointerId === pointer && move(e));
    base.addEventListener('pointerup', (e) => e.pointerId === pointer && release());
    base.addEventListener('pointercancel', (e) => e.pointerId === pointer && release());

    // ---- the buttons ----
    const pad = el('div', 'tc-pad', root);
    this.useBtn = holdButton(el('button', 'tc-btn tc-use', pad, 'Use'), 'KeyE');
    holdButton(el('button', 'tc-btn tc-jump', pad, 'Jump'), 'Space');
    holdButton(el('button', 'tc-btn tc-small tc-bag', pad, 'Bag'), 'KeyI');
    // (on click, not as the finger lands: iOS only brings up the keyboard for the chat line then)
    this.chatBtn = el('button', 'tc-btn tc-small tc-chat', pad, 'Chat');
    this.chatBtn.addEventListener('click', () => {
      key('keydown', 'Enter');
      key('keyup', 'Enter');
    });
    for (const b of pad.children) b.type = 'button';

    // ---- hold the clock: fast-forward (T) ----
    const clock = document.querySelector('.dn-clock');
    if (clock) holdButton(clock, 'KeyT');

    this.setPlace(null);
  }

  // 'home' | 'lobby' | 'farm' (a farm with helpers: chat, as in a lobby) | null (the title screen: no controls)
  setPlace(place) {
    this.root.hidden = !place;
    this.chatBtn.hidden = place !== 'lobby' && place !== 'farm';
  }

  // Something to use within reach (the HUD's prompt): the Use button lights up
  setReady(on) {
    this.useBtn.classList.toggle('ready', on);
  }

  // The stick as the world's x and z (the camera looks north, so up the screen is -z)
  direction() {
    return { x: this.stick.x, z: this.stick.y };
  }
}
