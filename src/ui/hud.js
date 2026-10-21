// Everything on screen while playing, apart from the inventory:
// - the place panel (top left): where you are; in a lobby, its code and
//   invite link, who is here and what they have found
// - the prompt over the toolbar (E  Pick berries)
// - in build mode, what is being built, and a Done button
// - a big word for a rare find
// - chat (bottom right, lobbies only): Enter to talk
// - the controls list, for the menu's Controls page (splash.js: the menu,
//   which Esc opens, and L on Play online)
// On a farm with helpers on it (yours, or one you help on) the place panel
// lists who is there and chat is open, as in a lobby.
import { inviteLink } from '../net/lobby.js';
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
  ['B', 'Build on your farm'],
  ['L', 'Visit a lobby'],
  ['Enter', 'Chat'],
  ['Hold T', 'Speed up time at home'],
  ['Right click', 'Cancel: stop building or walking, put down what you carry in the backpack, or close it'],
  ['Esc', 'Menu'],
  ['E', 'With a sword or mallet in a lobby: bop the farmer next to you'],
];
const TOUCH_CONTROLS = [
  ['Stick', 'Walk (or tap the ground)'],
  ['Tap', 'Till, plant, harvest, gather, chop, mine, or trade at the stall'],
  ['Use', 'The same, where you stand'],
  ['Bag', 'Backpack, and its Build tab'],
  ['Pinch', 'Zoom'],
  ['Hold clock', 'Speed up time at home'],
  ['Tap farmer', 'With a sword or mallet in a lobby: bop them'],
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
  // onTravel(): the menu on Play online (L). onHome(): leave the lobby for the farm.
  // onMenu(): open the menu (Esc). isMenuOpen(). onMenuEscape(): Esc in the menu.
  // isBlocked(): another screen (the backpack, the menu) has the keyboard.
  // onPrompt(text): the prompt changed ('' : nothing to do here).
  // onStopBuilding(): out of build mode (Done, or Esc while building; main.js has the right click).
  constructor({ onTravel, onHome, onChat, onMenu, isMenuOpen, onMenuEscape, isBlocked, onPrompt, onStopBuilding }) {
    Object.assign(this, { onTravel, onHome, onChat, onMenu, isMenuOpen, onMenuEscape, isBlocked, onPrompt, onStopBuilding });
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
    button('ui-btn ui-btn-small ui-btn-ghost compact-only', head, 'Menu', () => this.onMenu());
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

    // ---- build mode ----
    this.buildBar = el('div', 'ui-build inv-frame', root);
    const buildText = el('div', 'ui-build-text', this.buildBar);
    this.buildWhat = el('b', '', buildText);
    this.buildNote = el('span', 'ui-muted', buildText);
    button('ui-btn ui-btn-small', this.buildBar, 'Done', () => this.onStopBuilding()).title = 'Done building (Esc, or right click)';
    this.buildBar.hidden = true;
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

    // Capture phase: runs before the inventory's and the game's own key handlers
    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  // ---------- Places ----------
  showHome() {
    this.enter('home');
    this.session = null;
    this.placeName.textContent = this.farmName || 'My farm';
    this.blurb.textContent = 'Till, plant and harvest. When you fancy company, visit a lobby to gather and hunt for rare finds.';
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
    this.chatBox.hidden = !online;
    this.setPrompt('');
    this.closeChat();
  }

  // Where we are, for the menu: { place, visit, session }
  here() {
    return { place: this.place, visit: this.visit, session: this.session };
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

  // Build mode: what is being built (null: not building), and a note (what
  // it costs, or why not here)
  setBuilding(what, note = '') {
    this.buildBar.hidden = !what;
    this.buildWhat.textContent = what ?? '';
    this.buildNote.textContent = note;
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

  // The farm's name, for the place panel
  setFarmName(name) {
    this.farmName = name;
    if (this.place === 'home') this.placeName.textContent = name || 'My farm';
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
    if (this.isMenuOpen()) {
      // The menu has the keys: Esc steps back in it, and nothing reaches the
      // backpack or the toolbar behind it (but its own boxes get what is typed)
      if (e.code === 'Escape') this.onMenuEscape();
      if (!e.target.closest?.('input, textarea, select')) e.stopPropagation();
      return;
    }
    if (e.target.closest?.('input, textarea, select')) return;
    if (this.isBlocked()) return;
    if (e.code === 'Escape') {
      e.stopPropagation();
      if (!this.buildBar.hidden) this.onStopBuilding();
      else this.onMenu();
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
