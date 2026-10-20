// Everything on screen while playing, apart from the inventory:
// - the place panel (top left): at home, the way out to the lobbies; in a
//   lobby, its code and invite link, who is here and what they have found
// - the prompt over the toolbar (E  Pick berries)
// - a big word for a rare find
// - chat (bottom right, lobbies only): Enter to talk
// - the pause menu (Esc), with a pairing code to play the farm on another
//   device, and the farm's name and PIN to get it back without one
import { MAX_FARM_NAME, PIN_LENGTH } from '../../shared/constants.js';
import { pinProblem } from '../../shared/protocol.js';
import { inviteLink } from '../net/lobby.js';
import { el, button, hexColor, copyText } from './dom.js';
import { isTouch } from './touch.js';

const CONTROLS =
  'WASD move · Space jump · 1–= or scroll pick an item · E till / plant / harvest or trade at the stall at home, gather or chop trees (axe) in lobbies · ' +
  'I backpack · L visit a lobby · Enter chat · Esc menu · hold T to fast-forward time at home · click the ground to walk there';
const TOUCH_CONTROLS =
  'Stick: walk · Tap the ground to walk there and till, plant or harvest it with what you hold · ' +
  'Tap the stall to trade, a bush or mushrooms to gather, a tree to chop it (axe) · Use: the same where you stand · ' +
  'Bag: backpack · hold the clock to fast-forward time at home';

// The controls, for the keyboard or for a touch screen (touch.js shows the one in use)
export function addHelp(parent) {
  el('div', 'ui-help mouse-only', parent, CONTROLS);
  el('div', 'ui-help touch-only', parent, TOUCH_CONTROLS);
}

const CHAT_FADE_MS = 10_000;
const CHAT_LINES = 40;

export class Hud {
  // onTravel(): open the lobby board. onHome(): leave the lobby for the farm.
  // onPair(): a pairing code for another device, { code, expiresIn } (src/net/farm.js).
  // onRecovery({ name, pin }): name the farm and set its PIN; resolves to the name.
  // isBlocked(): another screen (the backpack, the lobby board) has the keyboard.
  // onPrompt(text): the prompt changed ('' : nothing to do here).
  constructor({ onTravel, onHome, onChat, onPair, onRecovery, isBlocked, onPrompt }) {
    Object.assign(this, { onTravel, onHome, onChat, onPair, onRecovery, isBlocked, onPrompt });
    this.place = null; // 'home' | 'lobby' | null (the title screen)
    this.farmName = '';
    this.session = null;
    this.myId = 0;

    const root = (this.root = el('div', 'ui-hud', document.body));
    root.hidden = true;

    // ---- the place panel ----
    const panel = el('div', 'ui-players inv-frame', root);
    const head = el('div', 'ui-players-head', panel);
    this.placeName = el('b', '', head);
    this.pingEl = el('span', 'ui-muted ui-ping', head);
    this.blurb = el('div', 'ui-muted', panel);
    this.codeRow = el('div', 'ui-code', panel);
    this.codeText = el('span', '', this.codeRow);
    this.copyBtn = button('ui-btn ui-btn-small', this.codeRow, 'Copy invite', () => this.copyInvite());
    this.islandText = el('div', 'ui-muted ui-small', panel);
    this.list = el('div', 'ui-player-list', panel);
    this.travelBtn = button('ui-btn ui-btn-small', panel, 'Visit a lobby (L)', () => this.onTravel());
    this.homeBtn = button('ui-btn ui-btn-small ui-btn-ghost', panel, 'Head home', () => this.onHome());
    el('div', 'ui-muted ui-small mouse-only', panel, 'Esc: menu & controls');
    button('ui-btn ui-btn-small ui-btn-ghost touch-only', panel, 'Menu', () => this.setPaused(true));

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
    this.pauseCopy = button('ui-btn', card, 'Copy invite link', () => this.copyInvite());
    this.pauseHome = button('ui-btn ui-btn-ghost', card, 'Head home', () => {
      this.setPaused(false);
      this.onHome();
    });
    button('ui-btn', card, 'Play on another device', () => this.showPairCode());
    this.pairBox = el('div', 'ui-pair', card);
    this.pairBox.hidden = true;

    // the farm's name and PIN
    this.recoveryBtn = button('ui-btn', card, '', () => {
      this.recovery.hidden = !this.recovery.hidden;
      if (!this.recovery.hidden) this.recoveryName.focus();
    });
    this.recovery = el('form', 'ui-recovery', card);
    this.recovery.hidden = true;
    el('div', 'ui-muted', this.recovery,
      'With its name and PIN you can get your farm back on any device, even with no other device to ask. Keep the PIN to yourself.');
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
    addHelp(card);

    // Capture phase: runs before the inventory's and the game's own key handlers
    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  // ---------- Places ----------
  showHome() {
    this.enter('home');
    this.session = null;
    this.placeName.textContent = this.farmName || 'My farm';
    this.blurb.textContent = 'Till, plant and harvest. When you fancy company, visit a lobby to gather and hunt for rare finds.';
    this.pauseNote.textContent = 'Time on your farm stands still while paused.';
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
    this.pauseNote.textContent = 'The lobby keeps going for everyone else.';
    this.chatLog.textContent = '';
    this.setConnStatus('');
  }

  enter(place) {
    this.place = place;
    this.root.hidden = false;
    document.body.classList.add('in-game');
    const lobby = place === 'lobby';
    this.codeRow.hidden = !lobby;
    this.islandText.hidden = !lobby;
    this.list.hidden = !lobby;
    this.pingEl.hidden = !lobby;
    this.homeBtn.hidden = !lobby;
    this.travelBtn.hidden = lobby;
    this.pauseTravel.hidden = lobby;
    this.pauseCopy.hidden = !lobby;
    this.pauseHome.hidden = !lobby;
    this.chatBox.hidden = !lobby;
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
      else el('span', 'ui-found', row, `${p.finds} found${p.rares ? ` · ${p.rares} rare` : ''}${p.wood ? ` · ${p.wood} wood` : ''}`);
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
    if (!on) this.pairBox.hidden = this.recovery.hidden = true;
  }

  // ---------- The farm's name and PIN ----------
  setFarmName(name) {
    this.farmName = name;
    this.recoveryBtn.textContent = name ? `Farm name & PIN: ${name}` : 'Farm name & PIN (not set up yet)';
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
        `On your other device, open the game and type this code under “Your farm from another device”. ` +
        `It works once, for ${Math.round(expiresIn / 60)} minutes. Whichever device opened the farm last is the one that plays it.`);
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
    setTimeout(() => (this.copyBtn.textContent = 'Copy invite'), 1500);
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
    if (e.code === 'Enter' && this.place === 'lobby') {
      e.preventDefault();
      e.stopPropagation();
      this.openChat();
    } else if (e.code === 'KeyL' && this.place === 'home' && !e.repeat) {
      this.onTravel();
    }
  }
}
