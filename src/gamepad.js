import './gamepad.css';

// ---------- Game controllers ----------
// A controller (the Gamepad API, in its standard layout: an Xbox or
// PlayStation pad, or a Switch Pro, by where the buttons are) plays the game
// the way the keyboard does. main.js calls poll() every frame:
//
// Playing, the left stick walks (direction(), as the touch stick does) and
// the right stick zooms; the buttons press the keys they stand for, a keydown
// and a keyup on letting go, just as the touch buttons do (ui/touch.js), so
// whatever a key does, the button does too:
//   A                 Space  jump (hold: higher; on the way down, glide)
//   X, B, RT          E      use (hold: keep chopping, mining, building)
//   Y                 I      the backpack
//   View              B      build
//   Menu              Esc    the menu (or out of building)
//   LT                T      hold to speed up time at home
//   LB, RB / D-pad ← →       the item before or after on the toolbar
//   D-pad ↑                  the buttons on the screen (an invitation, a
//                            trade asked for, the party game's card)
//
// In a menu or a window (the title screen, the backpack, the shop, the
// chest...), a highlight goes from one button or slot to the nearest that
// way with the D-pad or the left stick; A clicks it (a slot: as the left
// mouse button does), X as the right one does (one of a stack), B steps back
// (Esc), LB and RB go through the tabs, the right stick scrolls.

const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// Playing: the keys the buttons hold down
const KEYS = [
  [BTN.A, 'Space'],
  [BTN.X, 'KeyE'],
  [BTN.B, 'KeyE'],
  [BTN.RT, 'KeyE'],
  [BTN.Y, 'KeyI'],
  [BTN.VIEW, 'KeyB'],
  [BTN.MENU, 'Escape'],
  [BTN.LT, 'KeyT'],
];
const KEY_NAMES = { Space: ' ', KeyE: 'e', KeyI: 'i', KeyB: 'b', KeyT: 't', Escape: 'Escape' };
const DEAD_ZONE = 0.2; // of a stick's travel
const NAV_AT = 0.55; // a stick pushed this far moves the highlight
const REPEAT_FIRST = 0.38; // s: held, the highlight moves on after this...
const REPEAT_EVERY = 0.11; // ...and then this often
const ZOOM_RATE = 1.6; // the right stick all the way: e^this times nearer or further a second
const SCROLL_RATE = 900; // px a second, the right stick all the way

// What the highlight can land on: buttons and fields, and the slots of the
// backpack, the shop, the chest and the trade (their data- attributes)
const FOCUSABLE = 'button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, a[href], [data-index], [data-sell], [data-put], [data-take], [data-offer], [data-back], [data-see], .inv-trash';
// On the screen while playing (D-pad ↑)
const OVERLAYS = '.ui-invites, .trade-ask, .ui-party, .ui-build';

let usingPad = false; // the last thing pressed was on a controller (prompts say X, not E)
export const padInUse = () => usingPad;
for (const type of ['keydown', 'mousedown', 'touchstart']) addEventListener(type, (e) => e.isTrusted && (usingPad = false), { capture: true, passive: true });

// A farmer at a split screen of their own (src/main.js seats) plays with a
// controller of their own: each one's GamepadInput reads the controller
// main.js picks for it (pick), and moves its highlight about the menus and
// windows in its farmer's part of the screen (root) only.

// (from the page, as a real key's comes, not at the window: so the listeners
// that catch keys on their way down, the HUD's, have them first)
const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_NAMES[code] ?? code, bubbles: true, cancelable: true }));
const shown = (node) => !!node && node.isConnected && node.getClientRects().length > 0 && !node.closest('[hidden]') && getComputedStyle(node).visibility !== 'hidden';
const middle = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
// past the dead zone, 0..1 of the way (and its direction kept)
function stick(x, y) {
  const d = Math.hypot(x, y);
  if (d < DEAD_ZONE) return { x: 0, y: 0 };
  const k = Math.min(1, (d - DEAD_ZONE) / (1 - DEAD_ZONE)) / d;
  return { x: x * k, y: y * k };
}

// The way the D-pad or the left stick points: 'up', 'down', 'left', 'right' or null
function heading(down, left) {
  if (down[BTN.UP]) return 'up';
  if (down[BTN.DOWN]) return 'down';
  if (down[BTN.LEFT]) return 'left';
  if (down[BTN.RIGHT]) return 'right';
  if (Math.max(Math.abs(left.x), Math.abs(left.y)) <= NAV_AT) return null;
  if (Math.abs(left.x) > Math.abs(left.y)) return left.x > 0 ? 'right' : 'left';
  return left.y > 0 ? 'down' : 'up';
}

export class GamepadInput {
  // inMenu(): a menu, a window or the chat line has the keys (not the farmer).
  // onCycle(dir): the toolbar's next item (1) or the one before (-1).
  // onZoom(factor): the camera nearer (< 1) or further. onConnect(name).
  // pick(pads): the controller to read, of navigator.getGamepads() (default:
  // the first connected). root: where its menus and windows are. keyboard:
  // its farmer has the keyboard and the mouse too (the first one does), so
  // which was used last says what the prompts show.
  constructor({ inMenu, onCycle, onZoom, onConnect, pick = (pads) => pads.find((p) => p?.connected) ?? null, root = document, keyboard = true }) {
    Object.assign(this, { inMenu, onCycle, onZoom, onConnect, pick, root, keyboard });
    this.index = null; // the controller last read with something pressed on it (its index)
    this.was = []; // the buttons down last frame
    this.held = new Map(); // key code -> the buttons holding it down
    this.walk = { x: 0, y: 0 };
    this.focus = null; // the highlighted button or slot
    this.overlay = false; // playing, with the highlight on the buttons on the screen
    this.nav = { dir: null, next: 0 }; // the way the highlight is being pushed, and when it moves on
    addEventListener('gamepadconnected', (e) => this.onConnect?.(e.gamepad.id));
  }

  // The last thing pressed was on a controller (the keyboard's farmer); a
  // farmer without the keyboard always plays with one
  using() {
    return !this.keyboard || usingPad;
  }

  // The stick as the world's x and z (as the touch stick's: up the screen is -z)
  direction() {
    return { x: this.walk.x, z: this.walk.y };
  }

  poll(dt) {
    const pad = this.pick([...(navigator.getGamepads?.() ?? [])]);
    if (!pad) {
      this.letGo();
      this.walk.x = this.walk.y = 0;
      return;
    }
    const down = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const pressed = (i) => down[i] && !this.was[i];
    const left = stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const right = stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    const woke = !this.using(); // (the controller picked up again: in a menu, this press only shows the highlight)
    if (down.some(Boolean) || left.x || left.y || right.x || right.y) {
      if (this.keyboard) usingPad = true;
      this.index = pad.index;
    }

    const menu = this.inMenu();
    if (menu || this.overlay) {
      this.letGo();
      this.walk.x = this.walk.y = 0;
      this.menu(down, woke ? () => false : pressed, left, right, dt, menu, woke);
    } else {
      this.blur();
      this.play(down, pressed, left, right, dt);
    }
    this.was = down;
  }

  // ---------- Playing ----------
  play(down, pressed, left, right, dt) {
    for (const [button, code] of KEYS) {
      const by = this.held.get(code) ?? new Set();
      // (a fresh press: not one still down from a menu, which would open it again, or jump)
      if (pressed(button) && !by.has(button)) {
        if (!by.size) key('keydown', code);
        by.add(button);
      } else if (!down[button] && by.has(button)) {
        by.delete(button);
        if (!by.size) key('keyup', code);
      }
      this.held.set(code, by);
    }
    this.walk.x = left.x;
    this.walk.y = left.y;
    if (right.y) this.onZoom?.(Math.exp(right.y * ZOOM_RATE * dt));
    if (pressed(BTN.LB) || pressed(BTN.LEFT)) this.onCycle?.(-1);
    if (pressed(BTN.RB) || pressed(BTN.RIGHT)) this.onCycle?.(1);
    if (pressed(BTN.UP) && this.targets(null).length) {
      this.overlay = true;
      this.nav = { dir: 'up', next: Infinity }; // (not on up from where it lands, till ↑ is let go)
      this.letGo();
      this.walk.x = this.walk.y = 0;
    }
  }

  // Every key the controller holds down, let go (into a menu, or it went)
  letGo() {
    for (const [code, by] of this.held) if (by.size) key('keyup', code);
    this.held.clear();
  }

  // ---------- Menus and windows ----------
  // The menu or window on top (the title screen's, or a window like the
  // backpack's), or null: playing (the buttons on the screen, then)
  layer() {
    const open = [...this.root.querySelectorAll('.ui-splash, .inv-menu')].filter(shown);
    return open.at(-1) ?? null;
  }

  // What the highlight can go to: the layer's buttons and slots, and an
  // invitation's (over everything)
  targets(layer) {
    const roots = layer ? [layer, ...this.root.querySelectorAll('.ui-invites')] : [...this.root.querySelectorAll(OVERLAYS)];
    return roots.flatMap((root) => [...root.querySelectorAll(FOCUSABLE)]).filter(shown);
  }

  menu(down, pressed, left, right, dt, menu, woke) {
    const layer = menu ? this.layer() : null;
    if (menu && !layer) {
      // (the chat line, being typed in: B or Menu closes it)
      if (pressed(BTN.B) || pressed(BTN.MENU)) this.tap('Escape');
      return;
    }
    if (!this.using()) return this.blur(); // (the mouse or the keys have it: no highlight in their way)
    // (what it can go to, looked for only when it has to go somewhere)
    let found = null;
    const list = () => (found ??= this.targets(layer));
    const here = this.focus && shown(this.focus) && (layer ? layer.contains(this.focus) || this.focus.closest('.ui-invites') : this.focus.closest(OVERLAYS));
    if (!here) {
      if (!list().length) {
        this.overlay = false;
        return this.blur();
      }
      this.setFocus(this.pick(list()));
    }
    if (woke) return void (this.nav = { dir: heading(down, left), next: Infinity }); // (nor does the way it is pushed, till let go)

    // the way the D-pad or the stick points (held: again, after a moment)
    const dir = heading(down, left);
    const now = performance.now() / 1000;
    if (dir && (dir !== this.nav.dir || now >= this.nav.next)) {
      this.nav.next = now + (dir === this.nav.dir ? REPEAT_EVERY : REPEAT_FIRST);
      const next = this.toward(list(), dir);
      if (next) this.setFocus(next);
      else if (!layer && dir === 'down') this.leaveOverlay(); // (off the buttons on the screen, back to playing)
    }
    this.nav.dir = dir;

    if (pressed(BTN.A)) this.activate(this.focus, 0);
    if (pressed(BTN.X)) this.activate(this.focus, 2);
    if (pressed(BTN.B)) (layer ? this.back(layer) : this.leaveOverlay());
    if (pressed(BTN.MENU)) (layer ? this.tap('Escape') : this.leaveOverlay());
    if (pressed(BTN.Y) && layer?.querySelector('.bag-window')) this.tap('KeyI'); // (the backpack: Y closes it, as it opened it)
    if (layer && (pressed(BTN.LB) || pressed(BTN.RB))) this.tab(layer, pressed(BTN.RB) ? 1 : -1);
    if (right.y) this.scroll(this.focus ?? layer, right.y * SCROLL_RATE * dt, layer);
  }

  leaveOverlay() {
    this.overlay = false;
    this.blur();
  }

  // Where the highlight starts: the card that is on, else a big button, else
  // the first that isn't a tab or a close button (the backpack: its first slot)
  pick(list) {
    return list.find((n) => n.matches('.on:not(.inv-tab)')) ?? list.find((n) => n.matches('.ui-btn-big')) ?? list.find((n) => !n.matches('.inv-tab, .inv-close')) ?? list[0];
  }

  // The nearest of `list` from the highlight, `dir` of it (straight that way first)
  toward(list, dir) {
    if (!this.focus) return list[0];
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const from = middle(this.focus);
    let best = null;
    let bestScore = Infinity;
    for (const node of list) {
      if (node === this.focus) continue;
      const to = middle(node);
      const along = (to.x - from.x) * dx + (to.y - from.y) * dy;
      if (along < 4) continue;
      const across = Math.abs((to.x - from.x) * dy - (to.y - from.y) * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  setFocus(node) {
    if (node === this.focus) return;
    this.focus?.classList.remove('pad-focus');
    this.focus = node;
    if (!node) return;
    node.classList.add('pad-focus');
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // (as the mouse would be: over it, for its tooltip, and to carry a stack along)
    const { x, y } = middle(node);
    for (const type of ['mouseover', 'mousemove']) node.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  }

  blur() {
    this.focus?.classList.remove('pad-focus');
    this.focus = null;
  }

  // A click (button 0) or a right click (2) on it, where it is
  activate(node, button) {
    if (!node) return;
    if (node.matches('input:not([type=checkbox]):not([type=radio]), select, textarea')) return node.focus(); // (typing: on a keyboard)
    const { x, y } = middle(node);
    const at = { bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons: button ? 2 : 1 };
    node.dispatchEvent(new MouseEvent('mousedown', at));
    node.dispatchEvent(new MouseEvent('mouseup', at));
    if (button) node.dispatchEvent(new MouseEvent('contextmenu', at));
    else node.click();
    // (what it opened or closed: the highlight moves to what is there now)
    if (!shown(node)) this.blur();
  }

  // B: the page's Back, or Esc
  back(layer) {
    const backBtn = [...layer.querySelectorAll('.ui-page:not([hidden]) .ui-page-head .ui-btn')].find((b) => shown(b) && b.textContent.includes('Back'));
    if (backBtn) {
      backBtn.click();
      this.blur();
    } else this.tap('Escape');
  }

  // LB / RB: the tab before or after the one that is on
  tab(layer, dir) {
    const tabs = [...layer.querySelectorAll('.inv-tabs .inv-tab')].filter(shown);
    const at = tabs.findIndex((t) => t.classList.contains('on'));
    if (at < 0) return;
    tabs[(at + dir + tabs.length) % tabs.length].click();
    this.blur();
  }

  // The right stick: what the highlight is in scrolls, or with nothing round
  // it to scroll (a tab, say, over the Skills or Quests tab's list), the
  // window's own list
  scroll(node, by, layer) {
    const scrolls = (n) => {
      const { overflowY } = getComputedStyle(n);
      return (overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight;
    };
    for (let n = node; n && n !== document.body; n = n.parentElement) {
      if (scrolls(n)) {
        n.scrollTop += by;
        return;
      }
    }
    const list = layer && [...layer.querySelectorAll('*')].find((n) => shown(n) && scrolls(n));
    if (list) list.scrollTop += by;
  }

  tap(code) {
    key('keydown', code);
    key('keyup', code);
  }
}
