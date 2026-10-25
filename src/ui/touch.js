// On-screen controls for touch screens: a thumbstick (bottom left) to walk,
// buttons (bottom right) for Use (E) and Jump (Space), and a column of small
// ones top right, under the coin counter, for the other keys a phone doesn't
// have: the backpack (I), building (B, on a farm) and, with others about,
// chat (Enter). Holding the clock
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

// The on-screen keyboard covers the bottom of the page without resizing it:
// --kb is how much of it it covers, so the chat being typed in can sit just
// above it (html.kb while it is up). Safari also scrolls the page to show the
// field typed in, and doesn't scroll it back: that's done here when typing ends.
const view = window.visualViewport;
if (view) {
  const keyboard = () => {
    const covered = Math.max(0, html.clientHeight - view.height - view.offsetTop);
    html.style.setProperty('--kb', `${Math.round(covered)}px`);
    html.classList.toggle('kb', covered > 80);
  };
  view.addEventListener('resize', keyboard);
  view.addEventListener('scroll', keyboard);
}
addEventListener('focusout', () => setTimeout(() => {
  if (!(document.activeElement instanceof HTMLInputElement)) window.scrollTo(0, 0);
}, 50));

// A tap of feedback in the hand, on a touch screen that can (Android phones;
// Safari can't): the buttons, and things picked up
export const buzz = (ms) => isTouch() && navigator.vibrate?.(ms);

const STICK_RADIUS = 46; // px the knob travels from the middle
const DEAD_ZONE = 0.18;

// (on the page, as a key on a keyboard is, and the controller's are:
// src/gamepad.js. A window a key opens listens for its closing key in the
// capture phase, which only comes first for a key sent to the page; sent to
// the window itself, the one press that opened it closed it again)
function key(type, code) {
  document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
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
    buzz(8);
    key('keydown', code);
  });
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('lostpointercapture', up);
  // (and no click when the finger comes up from a quick tap: a phone sends one
  // to whatever is under the finger by then, and that can be a window the
  // press just opened, a neighbour's, with its Bye button right there. A long
  // press sends none: why holding Use kept it open)
  node.addEventListener('touchend', (e) => e.cancelable && e.preventDefault(), { passive: false });
  return node;
}

export class TouchControls {
  // parent: where its buttons go (the first farmer's part of the screen, src/main.js)
  constructor({ parent = document.body } = {}) {
    this.stick = { x: 0, y: 0 }; // where the thumbstick points: -1..1, y down the screen
    const root = (this.root = el('div', 'tc', parent));

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
    // ...and top right, under the coin counter (wherever the HUD has put it)
    const side = (this.side = el('div', 'tc-side', root));
    holdButton(el('button', 'tc-btn tc-small tc-bag', side, 'Bag'), 'KeyI');
    this.buildBtn = holdButton(el('button', 'tc-btn tc-small tc-build', side, 'Build'), 'KeyB');
    // (on click, not as the finger lands: iOS only brings up the keyboard for the chat line then)
    this.chatBtn = el('button', 'tc-btn tc-small tc-chat', side, 'Chat');
    this.chatBtn.addEventListener('click', () => {
      key('keydown', 'Enter');
      key('keyup', 'Enter');
    });
    for (const b of [...pad.children, ...side.children]) b.type = 'button';
    addEventListener('resize', () => this.placeSide());

    // ---- hold the clock: fast-forward (T) ----
    const clock = document.querySelector('.dn-clock');
    if (clock) holdButton(clock, 'KeyT');

    this.setPlace(null);
  }

  // 'home' | 'lobby' | 'farm' (a farm with helpers: chat, as in a lobby) | null (the title screen: no controls)
  setPlace(place) {
    this.root.hidden = !place;
    this.chatBtn.hidden = place !== 'lobby' && place !== 'farm';
    this.buildBtn.hidden = place !== 'home' && place !== 'farm'; // (building is for farms)
    requestAnimationFrame(() => this.placeSide());
  }

  // The column of small buttons just under the coin counter
  placeSide() {
    const funds = document.querySelector('.inv-funds')?.getBoundingClientRect();
    if (funds?.height) this.side.style.top = `${Math.round(funds.bottom + 10)}px`;
  }

  // Something to use within reach (the HUD's prompt): the Use button lights up
  setReady(on) {
    this.useBtn.classList.toggle('ready', on);
  }

  // A fish on the line: the Use button pulses till it is tapped (or it gets away)
  setBite(on) {
    this.useBtn.classList.toggle('bite', on);
  }

  // The stick as the world's x and z (the camera looks north, so up the screen is -z)
  direction() {
    return { x: this.stick.x, z: this.stick.y };
  }
}
