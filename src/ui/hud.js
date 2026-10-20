// Everything on screen while playing, apart from the inventory:
// - the place panel (top left): where you are; in a lobby, its code and
//   invite link, who is here and what they have found
// - the prompt over the toolbar (E  Pick berries)
// - a big word for a rare find
// - chat (bottom right, lobbies only): Enter to talk
// - the pause menu (Esc), with the way out to the lobbies (also L), and three
//   folding sections, one open at a time: the farm's helpers (friends who can
//   come and farm on it, invited with a code), Other devices (a pairing code
//   to play the farm on another device, and the farm's name and PIN to get it
//   back without one), and the controls
// On a farm with helpers on it (yours, or one you help on) the place panel
// lists who is there and chat is open, as in a lobby.
import { MAX_FARM_NAME, PIN_LENGTH } from '../../shared/constants.js';
import { pinProblem } from '../../shared/protocol.js';
import { inviteLink, helpLink } from '../net/lobby.js';
import { el, button, hexColor, copyText } from './dom.js';
import { isTouch } from './touch.js';

// The controls: [keys, what they do]
const CONTROLS = [
  ['WASD', 'Walk (or click the ground)'],
  ['Space', 'Jump'],
  ['E', 'Till, plant, harvest, gather, chop, mine, or trade at the stall'],
  ['1 – =', 'Pick an item (or scroll over the bar)'],
  ['Scroll', 'Zoom'],
  ['I', 'Backpack'],
  ['L', 'Visit a lobby'],
  ['Enter', 'Chat'],
  ['Hold T', 'Speed up time at home'],
  ['Esc', 'Menu'],
];
const TOUCH_CONTROLS = [
  ['Stick', 'Walk (or tap the ground)'],
  ['Tap', 'Till, plant, harvest, gather, chop, mine, or trade at the stall'],
  ['Use', 'The same, where you stand'],
  ['Bag', 'Backpack'],
  ['Pinch', 'Zoom'],
  ['Hold clock', 'Speed up time at home'],
];

function keyList(parent, className, rows) {
  const list = el('div', `ui-help ui-keys ${className}`, parent);
  for (const [keys, what] of rows) {
    el('kbd', 'ui-key', list, keys);
    el('span', '', list, what);
  }
}

// The controls, for the keyboard or for a touch screen (touch.js shows the one in use)
export function addHelp(parent) {
  keyList(parent, 'mouse-only', CONTROLS);
  keyList(parent, 'touch-only', TOUCH_CONTROLS);
}

const CHAT_FADE_MS = 10_000;
const CHAT_LINES = 40;

export class Hud {
  // onTravel(): open the lobby board. onHome(): leave the lobby for the farm.
  // onPair(): a pairing code for another device, { code, expiresIn } (src/net/farm.js).
  // onRecovery({ name, pin }): name the farm and set its PIN; resolves to the name.
  // isBlocked(): another screen (the backpack, the lobby board) has the keyboard.
  // onPrompt(text): the prompt changed ('' : nothing to do here).
  // onInvite(): an invite code for a helper, { code, expiresIn }. onHelpers():
  // the farm's helpers, [{ id, name }]. onRemoveHelper(id): resolves to the rest.
  constructor({ onTravel, onHome, onChat, onPair, onRecovery, isBlocked, onPrompt, onInvite, onHelpers, onRemoveHelper }) {
    Object.assign(this, { onTravel, onHome, onChat, onPair, onRecovery, isBlocked, onPrompt, onInvite, onHelpers, onRemoveHelper });
    this.place = null; // 'home' | 'lobby' | 'farm' (a farm with helpers) | null (the title screen)
    this.visit = null; // on a farm with helpers: { name, mine }
    this.farmName = '';
    this.session = null;
    this.myId = 0;

    const root = (this.root = el('div', 'ui-hud', document.body));
    root.hidden = true;

    // ---- the place panel ----
    // (on a small screen in a lobby, folded up to its name and a Menu button: tap the name for the rest)
    this.panel = el('div', 'ui-players inv-frame', root);
    const head = el('div', 'ui-players-head', this.panel);
    this.foldBtn = button('ui-players-title', head, null, () => this.setFolded(!this.folded));
    this.placeName = el('b', '', this.foldBtn);
    this.pingEl = el('span', 'ui-muted ui-ping', this.foldBtn);
    button('ui-btn ui-btn-small ui-btn-ghost compact-only', head, 'Menu', () => this.setPaused(true));
    const body = el('div', 'ui-players-body', this.panel);
    this.blurb = el('div', 'ui-muted', body);
    this.codeRow = el('div', 'ui-code', body);
    this.codeText = el('span', '', this.codeRow);
    this.copyBtn = button('ui-btn ui-btn-small', this.codeRow, 'Copy invite', () => this.copyInvite());
    this.islandText = el('div', 'ui-muted ui-small', body);
    this.list = el('div', 'ui-player-list', body);
    this.homeBtn = button('ui-btn ui-btn-small ui-btn-ghost', body, 'Go home', () => this.onHome());
    el('div', 'ui-muted ui-small', body, 'Esc: menu & controls');
    this.setFolded(true);

    this.prompt = el('div', 'ui-prompt', root);
    this.prompt.hidden = true;
    this.big = el('div', 'ui-big', root);
    this.big.hidden = true;
    this.status = el('div', 'ui-conn', root);
    this.status.hidden = true;

    // ---- chat ----
    this.chatBox = el('div', 'ui-chat', root);
    this.chatLog = el('div', 'ui-chat-log', this.chatBox);
    this.chatForm = el('form', 'ui-chat-form', this.chatBox);
    this.chatInput = el('input', 'ui-input', this.chatForm);
    this.chatInput.maxLength = 160;
    this.chatInput.placeholder = 'Say something… (Enter to send, Esc to close)';
    this.chatInput.autocomplete = 'off';
    this.chatForm.hidden = true;
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (text) this.onChat(text);
      this.closeChat();
    });

    // ---- pause menu ----
    this.pause = el('div', 'ui-pause', root);
    this.pause.hidden = true;
    const card = el('div', 'ui-card inv-frame', this.pause);
    el('h2', '', card, 'Paused');
    this.pauseNote = el('div', 'ui-muted', card);
    button('ui-btn ui-btn-big', card, 'Resume', () => this.setPaused(false));
    this.pauseTravel = button('ui-btn', card, 'Visit a lobby', () => {
      this.setPaused(false);
      this.onTravel();
    });
    this.pauseCopy = button('ui-btn', card, 'Invite a friend', () => this.copyInvite());
    this.pauseHome = button('ui-btn ui-btn-ghost', card, 'Go home', () => {
      this.setPaused(false);
      this.onHome();
    });

    // the folding sections
    this.sections = [];
    const helpers = this.section(card, 'Helpers', () => this.showHelpers());
    this.helpersBtn = helpers.btn;
    this.helpersBox = helpers.box;

    // other devices: a pairing code, and the farm's name and PIN
    const devices = this.section(card, 'Other devices');
    this.devicesBtn = devices.btn;
    el('div', 'ui-sub', devices.box, 'Play on another device');
    el('div', 'ui-muted', devices.box, 'Get a code, then type it on the other device under “Move my farm”.');
    button('ui-btn ui-btn-small', devices.box, 'Get a code', () => this.showPairCode());
    this.pairBox = el('div', 'ui-pair', devices.box);
    this.pairBox.hidden = true;
    this.recoveryTitle = el('div', 'ui-sub', devices.box);
    this.recovery = el('form', 'ui-recovery', devices.box);
    el('div', 'ui-muted', this.recovery,
      'With these you can get your farm back on any device, even with no other device to ask. Keep the PIN to yourself.');
    const nameField = el('label', 'ui-field', this.recovery);
    el('span', '', nameField, 'Farm name');
    this.recoveryName = el('input', 'ui-input', nameField);
    this.recoveryName.maxLength = MAX_FARM_NAME;
    this.recoveryName.placeholder = 'Sunny Acres';
    this.recoveryName.autocomplete = 'off';
    const pinField = el('label', 'ui-field', this.recovery);
    el('span', '', pinField, `PIN (${PIN_LENGTH} digits)`);
    this.recoveryPin = el('input', 'ui-input', pinField);
    Object.assign(this.recoveryPin, { type: 'password', inputMode: 'numeric', maxLength: PIN_LENGTH, autocomplete: 'off' });
    button('ui-btn', this.recovery, 'Save', null).type = 'submit';
    this.recoveryStatus = el('div', 'ui-status', this.recovery);
    this.recovery.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecovery();
    });
    this.setFarmName('');

    addHelp(this.section(card, 'Controls').box);

    // Capture phase: runs before the inventory's and the game's own key handlers
    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  // ---------- Places ----------
  showHome() {
    this.enter('home');
    this.session = null;
    this.placeName.textContent = this.farmName || 'My farm';
    this.blurb.textContent = 'Till, plant and harvest. When you fancy company, visit a lobby to gather and hunt for rare finds.';
    this.pauseNote.textContent = 'Your farm waits for you.';
  }

  // A farm with helpers, ours or a friend's. visit: { name, mine }
  showFarm(visit, myId) {
    this.enter('farm', visit);
    this.session = null;
    this.myId = myId;
    this.placeName.textContent = visit.mine ? this.farmName || 'My farm' : visit.name;
    this.blurb.textContent = visit.mine
      ? 'Your helpers can farm here any time, you here or not. What anyone harvests goes in the chest by the plaza.'
      : 'Till, plant and harvest with what you brought: the harvest goes in the farm\'s chest, for the farmer.';
    this.pauseNote.textContent = 'The farm keeps going for everyone on it.';
    this.chatLog.textContent = '';
    this.setConnStatus('');
  }

  // session: { code, seed, room: { name, inviteOnly, maxPlayers } }
  showLobby(session, myId) {
    this.enter('lobby');
    this.session = session;
    this.myId = myId;
    this.placeName.textContent = session.room.name;
    this.codeText.textContent = `Code ${session.code}`;
    this.islandText.textContent = `Island seed: ${session.seed}`;
    this.blurb.textContent = 'Whoever gets there first takes it. Things grow back, and now and then something rare turns up.';
    this.pauseNote.textContent = 'Everyone else keeps playing.';
    this.chatLog.textContent = '';
    this.setConnStatus('');
  }

  // Small screens in a lobby only: the panel down to its first line, or all of it
  setFolded(on) {
    this.folded = on;
    this.panel.classList.toggle('folded', on);
    this.foldBtn.setAttribute('aria-expanded', String(!on));
  }

  enter(place, visit = null) {
    this.place = place;
    this.visit = visit;
    this.root.hidden = false;
    document.body.classList.add('in-game');
    const lobby = place === 'lobby';
    const online = lobby || place === 'farm'; // (others about: who is here, and chat)
    const away = lobby || (place === 'farm' && !visit?.mine); // (not on our own farm: the way home)
    this.panel.classList.toggle('foldable', online);
    this.codeRow.hidden = !lobby;
    this.islandText.hidden = !lobby;
    this.list.hidden = !online;
    this.pingEl.hidden = !online;
    this.homeBtn.hidden = !away;
    this.pauseTravel.hidden = lobby;
    this.pauseCopy.hidden = !lobby;
    this.pauseHome.hidden = !away;
    const friends = place === 'farm' && !visit?.mine; // (a friend's farm: these are about ours)
    this.helpersBtn.hidden = friends;
    this.devicesBtn.hidden = friends;
    this.chatBox.hidden = !online;
    this.setPrompt('');
    this.closeChat();
    this.setPaused(false);
  }

  // ---------- State from the lobby ----------
  // list: [{ id, name, color, finds, rares, wood, away }]
  setRoster(list) {
    this.list.textContent = '';
    for (const p of list) {
      const row = el('div', 'ui-player' + (p.id === this.myId ? ' me' : '') + (p.away ? ' away' : ''), this.list);
      el('i', 'ui-dot', row).style.background = hexColor(p.color);
      el('span', 'ui-player-name', row, p.name);
      if (p.away) el('span', 'ui-muted', row, 'away');
      else if (this.place === 'farm') el('span', 'ui-found', row, p.owner ? 'the farmer' : 'helping');
      else el('span', 'ui-found', row, `${p.finds} found${p.rares ? ` · ${p.rares} rare` : ''}${p.wood ? ` · ${p.wood} wood` : ''}${p.stone ? ` · ${p.stone} stone` : ''}`);
    }
  }

  setPing(ms) {
    this.pingEl.textContent = `${ms} ms`;
  }

  setConnStatus(text) {
    this.status.hidden = !text;
    this.status.textContent = text;
  }

  // text: 'E  Pick berries' (on a touch screen, the Use button is the E)
  setPrompt(text) {
    if (isTouch()) text = text.replace(/^E {2}/, '');
    if (this.prompt.textContent === text) return;
    this.prompt.textContent = text;
    this.prompt.hidden = !text;
    this.onPrompt?.(text);
  }

  // a big word in the middle of the screen that drifts up and fades
  flash(text) {
    this.big.textContent = text;
    this.big.hidden = false;
    this.big.classList.remove('pop');
    void this.big.offsetWidth; // restart the animation
    this.big.classList.add('pop');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => (this.big.hidden = true), 1800);
  }

  // ---------- Chat ----------
  chat({ from, name, color, text }) {
    const line = el('div', 'ui-chat-line' + (from ? '' : ' system'), this.chatLog);
    if (from) {
      const who = el('b', '', line, `${name}: `);
      who.style.color = hexColor(color);
    }
    line.append(text);
    while (this.chatLog.children.length > CHAT_LINES) this.chatLog.firstChild.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
    setTimeout(() => line.classList.add('old'), CHAT_FADE_MS);
  }

  isTyping() {
    return !this.chatForm.hidden;
  }

  openChat() {
    this.chatForm.hidden = false;
    this.chatBox.classList.add('open');
    this.chatInput.value = '';
    this.chatInput.focus();
  }

  closeChat() {
    this.chatForm.hidden = true;
    this.chatBox.classList.remove('open');
    this.chatInput.blur();
  }

  // ---------- Menus ----------
  isPaused() {
    return !this.pause.hidden;
  }

  setPaused(on) {
    this.pause.hidden = !on;
    if (!on) this.closeSections();
  }

  // A button in the pause menu that opens a box under it, and closes the
  // others. onOpen(): fill the box in.
  section(parent, label, onOpen) {
    const btn = button('ui-btn ui-btn-ghost ui-fold', parent, label, () => {
      const open = box.hidden;
      this.closeSections();
      box.hidden = !open;
      btn.classList.toggle('open', open);
      if (open) onOpen?.();
    });
    const box = el('div', 'ui-fold-box', parent);
    box.hidden = true;
    this.sections.push({ btn, box });
    return { btn, box };
  }

  closeSections() {
    for (const { btn, box } of this.sections) {
      box.hidden = true;
      btn.classList.remove('open');
    }
    this.pairBox.hidden = true;
  }

  // ---------- The farm's helpers ----------
  async showHelpers() {
    const box = this.helpersBox;
    box.textContent = 'Asking the server…';
    let helpers;
    try {
      helpers = await this.onHelpers();
    } catch (e) {
      box.textContent = e.message;
      return;
    }
    box.textContent = '';
    el('div', 'ui-muted', box,
      'Friends you invite can farm here any time, even while you’re away. What they harvest goes in the chest by the plaza, and only you can take it out.');
    const list = el('div', 'ui-helper-list', box);
    if (!helpers.length) el('div', 'ui-muted', list, 'No helpers yet.');
    for (const h of helpers) {
      const row = el('div', 'ui-helper', list);
      el('span', 'ui-player-name', row, h.name);
      const remove = button('ui-btn ui-btn-small ui-btn-ghost', row, 'Remove', async () => {
        if (!confirm(`Take ${h.name} off your helpers? They can't come to your farm any more.`)) return;
        remove.disabled = true;
        try {
          await this.onRemoveHelper(h.id);
          this.showHelpers();
        } catch (e) {
          remove.disabled = false;
          this.chat({ from: 0, text: e.message });
        }
      });
    }
    const inviteBox = el('div', 'ui-pair', box);
    button('ui-btn', box, 'Invite a helper', async () => {
      inviteBox.textContent = 'Asking the server for a code…';
      try {
        const { code, expiresIn } = await this.onInvite();
        inviteBox.textContent = '';
        el('div', 'ui-pair-code', inviteBox, `${code.slice(0, 4)}-${code.slice(4)}`);
        el('div', 'ui-muted', inviteBox,
          `Send your friend the link, or have them type the code on the title screen. ` +
          `It works once, within ${Math.round(expiresIn / 3600)} hours.`);
        const copy = button('ui-btn ui-btn-small', inviteBox, 'Copy invite link', async () => {
          const ok = await copyText(helpLink(code));
          copy.textContent = ok ? 'Copied!' : helpLink(code);
        });
      } catch (e) {
        inviteBox.textContent = e.message;
      }
    });
  }

  // ---------- The farm's name and PIN ----------
  setFarmName(name) {
    this.farmName = name;
    this.recoveryTitle.textContent = name ? 'Farm name & PIN' : 'Farm name & PIN (not set yet)';
    this.recoveryName.value = name;
    this.recoveryPin.placeholder = name ? 'leave empty to keep it' : '';
    if (this.place === 'home') this.placeName.textContent = name || 'My farm';
  }

  async saveRecovery() {
    const name = this.recoveryName.value.trim();
    const pin = this.recoveryPin.value.trim();
    const problem = (pin || !this.farmName) && pinProblem(pin);
    const say = (text, isError) => {
      this.recoveryStatus.textContent = text;
      this.recoveryStatus.classList.toggle('error', isError);
    };
    if (problem) return say(problem, true);
    say('Saving…', false);
    try {
      this.setFarmName(await this.onRecovery({ name, pin }));
      this.recoveryPin.value = '';
      say('Saved. Remember the PIN: nobody can look it up for you.', false);
    } catch (e) {
      say(e.message, true);
    }
  }

  async showPairCode() {
    this.pairBox.hidden = false;
    this.pairBox.textContent = 'Asking the server for a code…';
    try {
      const { code, expiresIn } = await this.onPair();
      this.pairBox.textContent = '';
      el('div', 'ui-pair-code', this.pairBox, `${code.slice(0, 3)}-${code.slice(3)}`);
      el('div', 'ui-muted', this.pairBox,
        `On your other device, pick Move my farm on the title screen and type this code. ` +
        `It works once, for ${Math.round(expiresIn / 60)} minutes. The farm plays on whichever device opened it last.`);
    } catch (e) {
      this.pairBox.textContent = e.message;
    }
  }

  async copyInvite() {
    if (!this.session) return;
    const link = inviteLink(this.session.code);
    const ok = await copyText(link);
    this.chat({ from: 0, text: ok ? 'Invite link copied. Send it to a friend!' : `Invite link: ${link}` });
    this.copyBtn.textContent = ok ? 'Copied!' : 'Copy invite';
    this.pauseCopy.textContent = ok ? 'Link copied!' : 'Invite a friend';
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copyBtn.textContent = 'Copy invite';
      this.pauseCopy.textContent = 'Invite a friend';
    }, 1500);
  }

  onKey(e) {
    if (!this.place) return;
    if (this.isTyping()) {
      if (e.code === 'Escape') {
        e.stopPropagation();
        this.closeChat();
      }
      return; // the input has the keys; the game ignores them (see isTyping)
    }
    if (e.target.closest?.('input, textarea, select')) {
      if (e.code === 'Escape' && this.pause.contains(e.target)) this.setPaused(false);
      return;
    }
    if (this.isBlocked()) return;
    if (e.code === 'Escape') {
      e.stopPropagation();
      this.setPaused(!this.isPaused());
      return;
    }
    if (this.isPaused()) {
      e.stopPropagation(); // (no backpack or toolbar keys behind the menu)
      return;
    }
    if (e.code === 'Enter' && (this.place === 'lobby' || this.place === 'farm')) {
      e.preventDefault();
      e.stopPropagation();
      this.openChat();
    } else if (e.code === 'KeyL' && (this.place === 'home' || this.place === 'farm') && !e.repeat) {
      this.onTravel();
    }
  }
}
