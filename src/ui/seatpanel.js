// A farmer's own window at a split screen (src/main.js seats): when they
// join, who they are (a farmer played here before, logging in to their
// account, or a guest), and after that their menu (Esc, or Menu on their
// controller): back to the game, or getting up from the screen. A controller
// moves about it as it does the game's menu (src/gamepad.js: it is a
// .ui-splash in their part of the screen). A box is typed in on the keyboard,
// or with the controller on the keys that open under it (A on the box: the
// keyboard stays the first farmer's meanwhile).
import { MAX_NAME, PLAYER_COLORS } from '../../shared/constants.js';
import { PASSWORD_LENGTH } from '../../shared/protocol.js';
import { el, button, hexColor } from './dom.js';

// The on-screen keys, row by row (Shift: the letters as capitals)
const KEY_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '-_.@!?#$%&*+=/'];

export class SeatPanel {
  // n: which farmer at the screen (2, 3 or 4). onPick(profile): play a
  // farmer listed (src/net/players.js). onLogin({ username, password }),
  // onGuest({ name, color }): resolve once they are in (or throw, with why).
  // onForget(profile). onLeave(): they get up (or never sat down).
  constructor({ parent, n, onPick, onLogin, onGuest, onForget, onLeave }) {
    Object.assign(this, { n, onPick, onLogin, onGuest, onForget, onLeave });
    this.pages = {};
    this.root = el('div', 'ui-splash in-game seat-panel', parent);
    this.root.hidden = true;
    const card = (this.card = el('div', 'ui-card inv-frame', this.root));
    this.title = el('h2', 'seat-panel-title', card, `Player ${n}`);

    // ---- who is playing ----
    const who = this.page('who');
    el('div', 'ui-context-text', who, 'Who is playing? Your farmer comes along: your backpack, gold and skills, saved back to you.');
    this.list = el('div', 'seat-farmers', who);
    button('ui-btn ui-btn-big', who, 'Log in to your account', () => this.show('login'));
    button('ui-btn', who, 'Play as a guest', () => this.show('guest'));
    button('ui-btn ui-btn-ghost', who, 'Not now', () => this.onLeave());

    // ---- logging in ----
    const login = this.page('login', 'Log in', 'form');
    el('div', 'ui-muted', login, 'Your account\'s farm stays yours: you help out here with what you carry. Click a box to type on the keyboard, or A on it for keys to type with the controller.');
    this.userInput = this.field(login, 'Username', { maxLength: MAX_NAME, autocomplete: 'off' });
    this.passInput = this.field(login, 'Password', { type: 'password', maxLength: PASSWORD_LENGTH[1], autocomplete: 'off' });
    this.loginBtn = button('ui-btn ui-btn-big', login, 'Log in', null);
    this.loginBtn.type = 'submit';
    login.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = this.userInput.value.trim();
      const password = this.passInput.value;
      if (!username || !password) return this.status('Type your username and password.', true);
      this.busy(this.onLogin({ username, password }), 'Logging in…', this.loginBtn).then((ok) => ok && (this.passInput.value = ''));
    });

    // ---- a guest ----
    const guest = this.page('guest', 'A guest', 'form');
    el('div', 'ui-muted', guest, 'A farmer of this device\'s own, starting out. Kept here, to play again next time.');
    this.nameInput = this.field(guest, 'Name', { maxLength: MAX_NAME, autocomplete: 'off' });
    el('span', 'ui-sub', guest, 'Shirt color');
    const swatches = el('div', 'ui-swatches', guest);
    this.color = PLAYER_COLORS[(n * 3) % PLAYER_COLORS.length];
    const marks = PLAYER_COLORS.map((color) => {
      const b = button('ui-swatch', swatches, '', () => {
        this.color = color;
        for (const other of marks) other.classList.toggle('on', other === b);
      });
      b.style.background = hexColor(color);
      b.classList.toggle('on', color === this.color);
      return b;
    });
    this.guestBtn = button('ui-btn ui-btn-big', guest, 'Play', null);
    this.guestBtn.type = 'submit';
    guest.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.nameInput.value.trim().slice(0, MAX_NAME);
      if (!name) return this.status('Type a name for your farmer.', true);
      this.busy(this.onGuest({ name, color: this.color }), 'Getting ready…', this.guestBtn);
    });

    // ---- their menu, once playing ----
    const menu = this.page('menu');
    this.menuText = el('div', 'ui-context-text', menu);
    button('ui-btn ui-btn-big', menu, 'Resume', () => this.hide());
    button('ui-btn ui-btn-ghost', menu, 'Get up from the screen', () => this.onLeave());

    this.statusEl = el('div', 'ui-status', card);

    // ---- keys to type with a controller, under the box being typed in ----
    this.keys = el('div', 'seat-keys');
    this.target = null; // the box they type into
    this.shift = false;
    this.letters = [];
    for (const row of KEY_ROWS) {
      const line = el('div', 'seat-keys-row', this.keys);
      for (const ch of row) this.letters.push(button('ui-btn ui-btn-small seat-key', line, ch, () => this.type(this.shift ? ch.toUpperCase() : ch)));
    }
    const last = el('div', 'seat-keys-row', this.keys);
    this.shiftBtn = button('ui-btn ui-btn-small seat-key seat-key-wide', last, 'Shift', () => this.setShift(!this.shift));
    button('ui-btn ui-btn-small seat-key seat-key-space', last, 'Space', () => this.type(' '));
    button('ui-btn ui-btn-small seat-key seat-key-wide', last, '⌫', () => this.type(null)).title = 'Rub out the last one';
    button('ui-btn ui-btn-small seat-key seat-key-wide', last, 'Done', () => this.closeKeys());
    // (a box chosen, with A on a controller or a click: the keys open under it.
    // A controller's A doesn't give it the keyboard, which stays the first farmer's: src/gamepad.js)
    for (const input of this.root.querySelectorAll('input')) {
      input.addEventListener('focus', () => this.openKeys(input));
      input.addEventListener('click', () => this.openKeys(input));
    }
  }

  // ---------- The on-screen keys ----------
  openKeys(input) {
    if (this.target === input) return;
    this.target?.classList.remove('typing');
    this.target = input;
    input.classList.add('typing');
    input.closest('label').after(this.keys);
    this.setShift(false);
  }

  closeKeys() {
    this.target?.classList.remove('typing');
    this.target = null;
    this.keys.remove();
  }

  setShift(on) {
    this.shift = on;
    this.shiftBtn.classList.toggle('on', on);
    for (const key of this.letters) key.textContent = on ? key.textContent.toUpperCase() : key.textContent.toLowerCase();
  }

  // One more letter in the box (null: one less), up to as many as it takes
  type(ch) {
    const box = this.target;
    if (!box) return;
    const most = box.maxLength > 0 ? box.maxLength : Infinity;
    box.value = ch === null ? box.value.slice(0, -1) : (box.value + ch).slice(0, most);
    if (this.shift && ch) this.setShift(false); // (a capital, then small letters again)
  }

  // A page; with a title, it has a Back button to the first page
  page(name, title = '', tag = 'div') {
    const node = el(tag, 'ui-page', this.card);
    if (title) {
      const head = el('div', 'ui-page-head', node);
      button('ui-btn ui-btn-small ui-btn-ghost', head, '‹ Back', () => this.show('who'));
      el('h2', '', head, title);
    }
    this.pages[name] = node;
    return node;
  }

  field(parent, label, props) {
    const box = el('label', 'ui-field', parent);
    el('span', '', box, label);
    return Object.assign(el('input', 'ui-input', box), props);
  }

  show(name) {
    this.closeKeys();
    for (const [key, node] of Object.entries(this.pages)) node.hidden = key !== name;
    this.current = name;
    this.root.hidden = false;
    this.status('');
  }

  // Who is playing: the farmers played here before (profiles), to pick from
  choose(profiles) {
    this.list.textContent = '';
    for (const profile of profiles) {
      const row = el('div', 'seat-farmer', this.list);
      const pick = button('ui-btn seat-farmer-pick', row, '', () => this.busy(this.onPick(profile), `Fetching ${profile.name}'s farmer…`, pick));
      el('i', 'ui-dot', pick).style.background = hexColor(profile.color ?? 0xffffff);
      el('span', '', pick, profile.name);
      el('span', 'ui-muted', pick, profile.kind === 'guest' ? 'guest' : '');
      // (twice: the first time it asks, as a controller can't answer a confirm())
      const drop = button('ui-btn ui-btn-small ui-btn-ghost', row, '×', () => {
        if (!row.classList.contains('asking')) {
          row.classList.add('asking');
          drop.textContent = 'Forget?';
          return this.status(profile.kind === 'guest' ? `A guest is only kept here: forgotten, ${profile.name} is gone for good.` : `${profile.name}'s account and farm stay: log in again to play here.`);
        }
        this.onForget(profile);
        row.remove();
        this.status('');
      });
      drop.title = `Forget ${profile.name} here`;
    }
    this.list.hidden = !profiles.length;
    this.show('who');
  }

  // Their menu (name: who they are)
  openMenu(name) {
    this.menuText.textContent = `${name} at the screen. The farm keeps going while you are in here.`;
    this.show('menu');
  }

  hide() {
    this.closeKeys();
    this.root.hidden = true;
  }

  isOpen() {
    return !this.root.hidden;
  }

  // Esc (or B): out of the keys or a box, back a page, out of the menu;
  // choosing, it stays (Not now, to leave)
  escape() {
    if (this.target) this.closeKeys();
    else if (document.activeElement && this.root.contains(document.activeElement) && document.activeElement.matches('input')) document.activeElement.blur();
    else if (this.current === 'login' || this.current === 'guest') this.show('who');
    else if (this.current === 'menu') this.hide();
  }

  status(text, isError = false) {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('error', isError);
  }

  // While what was asked is under way: a word, the button held down; its
  // trouble said if it fails. Resolves to whether it went.
  async busy(asked, text, btn) {
    btn.disabled = true;
    this.status(text);
    try {
      await asked;
      this.status('');
      return true;
    } catch (e) {
      this.status(e.message, true);
      return false;
    } finally {
      btn.disabled = false;
    }
  }
}
