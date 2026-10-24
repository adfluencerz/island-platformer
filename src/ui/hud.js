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
import { padInUse } from '../gamepad.js';

// The controls: [keys, what they do]
const CONTROLS = [
  ['WASD', 'Walk (or the arrow keys; or click the ground, or hold the mouse button to steer)'],
  ['Space', 'Jump (let go early for a lower jump), and again in the air for a double jump (from overall skill level 15). Hold it on the way down to glide, with a glider leaf'],
  ['E', 'Till, plant and harvest; gather, chop or mine (hold to keep at it)'],
  ['E', 'Use what is in front of you: the stall, the workbench, the chest, a machine, the arcade, the kitchen, a door, a portal'],
  ['E', 'With a rod: cast at the water, then again when it bites. With a dish: eat it. With a mount: get on or off'],
  ['E', 'With a sword or mallet in a lobby: bop the farmer next to you'],
  ['1 – =', 'Pick an item (or scroll over the bar)'],
  ['Scroll', 'Zoom'],
  ['I', 'Backpack'],
  ['B', 'Build on your farm'],
  ['K', 'Skills'],
  ['O', 'Your collection book'],
  ['L', 'Play online'],
  ['Enter', 'Chat (in a lobby, or on a farm with helpers)'],
  ['Hold T', 'Speed up time at home'],
  ['M', 'Sound and music on or off'],
  ['Right click', 'Cancel: stop building or walking'],
  ['Esc', 'Menu, or close what is open'],
  ['`', 'Developer tools: grow a giant tree or rock'],
];
// In the backpack (inventory.js)
const BAG_CONTROLS = [
  ['Click', 'Pick up, put down, swap or stack'],
  ['Right click', 'Take one (Shift: half); or put one down'],
  ['Ctrl+click', 'Take one'],
  ['Shift+click', 'Move a stack to or from the toolbar'],
  ['Click outside', 'Drop what you carry on the ground'],
  ['Bin', 'Throw away what you carry (not tools)'],
];
const TOUCH_CONTROLS = [
  ['Stick', 'Walk (or tap the ground)'],
  ['Tap', 'Till, plant, harvest, gather, chop, mine, or trade at the stall'],
  ['Use', 'Whatever E does: the workbench, the chest, a machine, a door; cast a rod, eat a dish, get on a mount'],
  ['Jump', 'Jump, and again in the air for a double jump (from overall skill level 15). Hold it on the way down to glide, with a glider leaf'],
  ['Bag', 'Backpack, and its Skills tab'],
  ['Build', 'Build on your farm'],
  ['Chat', 'Chat (in a lobby, or on a farm with helpers)'],
  ['Pinch', 'Zoom'],
  ['Hold clock', 'Speed up time at home'],
  ['Tap farmer', 'With a sword or mallet in a lobby: bop them'],
  ['Menu', 'In the panel at the top left'],
];
// With a controller (gamepad.js), playing and in a menu
const PAD_CONTROLS = [
  ['Left stick', 'Walk'],
  ['A', 'Jump (hold: higher; on the way down, glide)'],
  ['X  B  RT', 'Use: whatever E does (hold to keep chopping or mining)'],
  ['Y', 'Backpack'],
  ['LB  RB', 'The toolbar: the item before or after (or the D-pad, left and right)'],
  ['Right stick', 'Zoom'],
  ['View', 'Build on your farm'],
  ['Menu', 'Menu, or stop building'],
  ['Hold LT', 'Speed up time at home'],
  ['D-pad up', 'The buttons on the screen: an invitation, a trade'],
];
const PAD_MENU_CONTROLS = [
  ['D-pad', 'Move between buttons and slots (or the left stick)'],
  ['A', 'Pick it: a click'],
  ['X', 'A right click: one of a stack'],
  ['B', 'Back, or close'],
  ['LB  RB', 'The tabs'],
  ['Right stick', 'Scroll'],
];
const TOUCH_BAG_CONTROLS = [
  ['Tap', 'Pick up, put down, swap or stack'],
  ['Hold', 'Take one'],
  ['Tap outside', 'Drop what you carry on the ground'],
  ['Bin', 'Throw away what you carry (not tools)'],
];

// The hints the place panel goes round under its name, a new one every
// TIP_EVERY ms. keys: it is about the keyboard (not shown on a touch screen).
// place: only there ('home', 'lobby', 'farm' for our own farm with helpers,
// 'visit' for a friend's); arriving somewhere starts on its own first.
const TIPS = [
  { text: 'Till, plant and harvest. When you fancy company, visit a lobby to gather and hunt for rare finds.', place: 'home' },
  { text: 'Your helpers can farm here any time, you here or not. What anyone harvests goes in the chest by the plaza.', place: 'farm' },
  { text: 'Till, plant and harvest with what you brought: the harvest goes in the farm\'s chest, for the farmer.', place: 'visit' },
  { text: 'You\'re looking round a friend\'s farm: only they and their helpers farm here. Fish, go in the house, or trade with the merchant.', place: 'look' },
  { text: 'Whoever gets there first takes it. Nothing here grows back, and now and then something rare turns up.', place: 'lobby' },
  { text: 'Hold E to keep chopping or mining.', keys: true },
  { text: 'B opens the Build tab in your backpack.', keys: true },
  { text: 'A right click cancels building, or walking somewhere.', keys: true },
  { text: 'Hold T at home to hurry the day along.', keys: true },
  { text: 'Press L to visit a lobby and meet other farmers.', keys: true },
  { text: 'Shift+click at the stall to buy five at once.', keys: true },
  { text: 'On your farm a felled tree grows back somewhere new after a while. So does a rock.', place: 'home' },
  { text: 'A giant tree takes everyone\'s swings, and everyone who helped shares the wood.' },
  { text: 'Golden seeds grow golden turnips, worth a small fortune at the stall.' },
  { text: 'Tilled soil left empty goes back to grass, so plant it soon.' },
  { text: 'Hens lay an egg a day. Have a look around the hen yard.' },
  { text: 'Cows have milk every morning. Sheep grow their wool back in two days.' },
  { text: 'Build a workbench to make sturdy tools: an axe that fells a tree in two swings.' },
  { text: 'Build an arcade on your farm to try your luck: a coinflip, blackjack and Lucky Hand.', place: 'home' },
  { text: 'The stone circle where you arrive in a lobby is for resting: no bopping there.' },
  { text: 'Keep an eye on the ledges in a lobby: something rare may sparkle there.' },
  { text: 'Wood and stone build fences, paths and steps on your farm.' },
];
const TIP_EVERY = 20_000;

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
  el('div', 'ui-help-head mouse-only', parent, 'In the backpack');
  keyList(parent, 'mouse-only', BAG_CONTROLS);
  keyList(parent, 'touch-only', TOUCH_CONTROLS);
  el('div', 'ui-help-head touch-only', parent, 'In the backpack');
  keyList(parent, 'touch-only', TOUCH_BAG_CONTROLS);
  el('div', 'ui-help-head', parent, 'With a controller');
  keyList(parent, '', PAD_CONTROLS);
  el('div', 'ui-help-head', parent, 'In a menu or window');
  keyList(parent, '', PAD_MENU_CONTROLS);
}

const CHAT_FADE_MS = 10_000;
const CHAT_LINES = 40;

export class Hud {
  // onTravel(): the menu on Play online (L). onHome(): leave the lobby for the farm.
  // onMenu(): open the menu (Esc). isMenuOpen(). onMenuEscape(): Esc in the menu.
  // isBlocked(): another screen (the backpack, the menu) has the keyboard.
  // onPrompt(text): the prompt changed ('' : nothing to do here).
  // onStopBuilding(): out of build mode (Done, or Esc while building; main.js has the right click).
  // onTrade(id): ask farmer id in the lobby to trade (src/ui/trade.js).
  constructor({ onTravel, onHome, onChat, onMenu, isMenuOpen, onMenuEscape, isBlocked, onPrompt, onStopBuilding, onTrade }) {
    Object.assign(this, { onTravel, onHome, onChat, onMenu, isMenuOpen, onMenuEscape, isBlocked, onPrompt, onStopBuilding, onTrade });
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
    this.blurb = el('div', 'ui-muted ui-tip', body); // (the hints: TIPS)
    this.codeRow = el('div', 'ui-code', body);
    this.codeText = el('span', '', this.codeRow);
    this.copyBtn = button('ui-btn ui-btn-small', this.codeRow, 'Copy invite', () => this.copyInvite());
    this.islandText = el('div', 'ui-muted ui-small', body);
    this.list = el('div', 'ui-player-list', body);
    this.homeBtn = button('ui-btn ui-btn-small ui-btn-ghost', body, 'Go home', () => this.onHome());
    el('div', 'ui-muted ui-small', body, 'Esc: menu & controls');
    this.tipPlace = 'home';
    this.tipAt = 0;
    this.setFolded(true);

    this.prompt = el('div', 'ui-prompt', root);
    this.prompt.hidden = true;
    // a meal's boost while it lasts (setBoost)
    this.boost = el('div', 'ui-boost', root);
    this.boost.hidden = true;
    this.boostIcon = el('img', 'inv-icon', this.boost);
    this.boostIcon.alt = '';
    this.boostText = el('span', '', this.boost);

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
    this.startTips('home');
  }

  // A farm with helpers, ours or a friend's. visit: { name, mine }
  showFarm(visit, myId) {
    this.enter('farm', visit);
    this.session = null;
    this.myId = myId;
    this.placeName.textContent = visit.mine ? this.farmName || 'My farm' : visit.name;
    this.startTips(visit.mine ? 'farm' : visit.visitor ? 'look' : 'visit');
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
    this.startTips('lobby');
    this.chatLog.textContent = '';
    this.setConnStatus('');
  }

  // The hints for here, starting with the place's own (then round them all
  // from a random one, every TIP_EVERY ms)
  startTips(place) {
    this.tipPlace = place;
    const tips = this.tipsHere();
    this.tipAt = Math.max(0, tips.findIndex((tip) => tip.place === place));
    this.showTip(tips[this.tipAt].text, false);
    this.tipFrom = Math.floor(Math.random() * tips.length);
    clearInterval(this.tipTimer);
    this.tipTimer = setInterval(() => this.nextTip(), TIP_EVERY);
  }

  tipsHere() {
    return TIPS.filter((tip) => (!tip.keys || !isTouch()) && (!tip.place || tip.place === this.tipPlace));
  }

  nextTip() {
    const tips = this.tipsHere();
    if (this.tipFrom !== null) [this.tipAt, this.tipFrom] = [this.tipFrom, null];
    else this.tipAt = (this.tipAt + 1) % tips.length;
    this.showTip(tips[this.tipAt].text);
  }

  // (fading out, then in with the new one)
  showTip(text, fade = true) {
    const set = () => {
      this.blurb.textContent = `Hint: ${text}`;
      this.blurb.classList.remove('fading');
    };
    clearTimeout(this.tipFade);
    if (!fade) return set();
    this.blurb.classList.add('fading');
    this.tipFade = setTimeout(set, 400);
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
      else if (this.place === 'farm') el('span', 'ui-found', row, p.owner ? 'the farmer' : p.visitor ? 'looking round' : 'helping');
      else if (p.game) el('span', 'ui-found', row, 'at a party game');
      else el('span', 'ui-found', row, `${p.finds} found${p.rares ? ` · ${p.rares} rare` : ''}${p.wood ? ` · ${p.wood} wood` : ''}${p.stone ? ` · ${p.stone} stone` : ''}`);
      if (this.place === 'lobby' && p.id !== this.myId && !p.away && !p.game) {
        button('ui-btn ui-btn-small ui-trade-btn', row, 'Trade', () => this.onTrade?.(p.id)).title = `Ask ${p.name} to trade (walk up to them first)`;
      }
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
    if (padInUse()) text = text.replace(/^E {2}/, 'X  '); // (a controller's Use)
    else if (isTouch()) text = text.replace(/^E {2}/, '');
    if (this.prompt.textContent === text) return;
    this.prompt.textContent = text;
    this.prompt.hidden = !text;
    this.onPrompt?.(text);
  }

  // The boost from the last meal: its dish's picture and what it does
  // (icon: an image URL; text: '' when there is none)
  setBoost(icon, text) {
    this.boost.hidden = !text;
    if (!text) return;
    if (this.boostIcon.src !== icon) this.boostIcon.src = icon;
    if (this.boostText.textContent !== text) this.boostText.textContent = text;
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
