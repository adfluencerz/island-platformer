// The game's one menu: the title screen when the page opens, and the menu in
// game (Esc, or L for Play online). Its main page is the same everywhere but
// for one part, which says where you are and what the big button does: Go to
// my farm on the title screen, Resume in game, and Go home when away from
// home. The rest is on pages:
// - Play online: Start a lobby (picking its party game, shared/minigame.js,
//   and ticking the friends to invite: they get an invitation right away,
//   and PARTY_MS later the lobby opens for everyone who said yes;
//   server/presence.js), Quick join (the fullest lobby with room whose game
//   hasn't started, or a new loot run), Browse, or a code from a friend: a lobby's, or an invitation
//   to help on their farm (8 long, so the two can't be mixed up). In a lobby,
//   its code and invite link, and friends to invite to it now.
// - Friends: your friends (who is online, asking for new ones by username,
//   and saying yes to theirs), the farms you help on (server/farms.js), to
//   visit, and your farm's helpers, friends who can come and farm on it,
//   invited with a code.
// - Controls.
// - Your farmer: the wardrobe (what they wear, the shirt's color among it:
//   ui/wardrobe.js), and logging out.
// Without an account (src/net/farm.js), a welcome of its own comes first,
// apart from the menu: logging in, or making an account (a username, a
// password and a shirt color). Once in, it isn't seen again. (No server, no
// accounts: the farm can be played in this browser meanwhile.)
// A page opened from an invite link (?lobby=CODE or ?help=CODE) shows that
// invitation first. (It began as the title screen, hence its name.)
import { MAX_NAME, PLAYER_COLORS, PARTY_MS } from '../../shared/constants.js';
import { PASSWORD_LENGTH, usernameProblem, passwordProblem } from '../../shared/protocol.js';
import { listLobbies, leaderboards, lobbyInfo, linkedCode, normalizeCode, showCodeInAddress, devMode, linkedHelpCode, forgetHelpCode, inviteLink, helpLink } from '../net/lobby.js';
import { el, button, copyText, hexColor } from './dom.js';
import { addHelp } from './hud.js';
import { LOBBY_GAMES } from '../../shared/arenas.js';
import * as sound from '../sound.js';
import * as view from '../view.js';
import * as quality from '../gfx/quality.js';
import { Wardrobe } from './wardrobe.js';

const NO_SERVER = 'Could not reach the game server. Start it with `npm run dev`; your farm works without it.';
// ", a loot run": what a lobby is for, after its name ('' for none)
const gameText = (kind) => (LOBBY_GAMES[kind] ? `, a ${LOBBY_GAMES[kind].name.toLowerCase()}` : '');

const HOME_TIP_STORE = 'tp.homeTip';

// Safari on an iPhone or iPad (an iPad says it's a Mac, with a touch screen),
// not opened from the home screen already, and the tip not put away before
function homeScreenTip() {
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (!apple || navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return false;
  try {
    return !localStorage.getItem(HOME_TIP_STORE);
  } catch {
    return true;
  }
}

export class Splash {
  // onPlay({ name, code }): visit a lobby ('' code: quick join). onHome(): go to the farm.
  // onHelping(): the farms we help on, [{ id, name, here }]. onVisitFarm(id, name): go and help there.
  // onInvited(code): the farm an invitation is for, { id, name }. onHelp(code, name): say yes to it.
  // onHelpers(): our farm's helpers, [{ id, name }]. onRemoveHelper(id). onInvite(): an invite
  // code for a helper, { code, expiresIn }.
  // where(): where we are, { place, visit, session } (Hud.here).
  // account(): { username, color, look }, or null. onRegister({ username, password, color }),
  // onLogin({ username, password }): resolve once done (or throw, with why).
  // onLogout(). onTryOn(look, color): wear this now (the wardrobe's pick).
  // onDress(look, color): keep it with the account (resolves to the account, or throws).
  // onFriends(): { friends: [{ id, name, color, online, where, lastOnline }], asks: [{ id, name }] }.
  // onAddFriend(username): { name, friends }. onAnswerFriend(id, yes). onRemoveFriend(id).
  // onStartParty(ids, game): start a lobby for that game (LOBBY_GAMES), inviting those friends (partyStatus() and
  // partyOver() say how it goes). onCancelParty(). onInviteToLobby(ids): to the one we are in.
  // parent: where it goes (the first farmer's part of the screen, src/main.js).
  // onAddPlayer(): another farmer joins at this screen, on a controller of
  // their own (a split screen): '' once it waits for them, else why not.
  // players(): how many farmers are at this screen.
  constructor(options) {
    Object.assign(this, options);
    const parent = options.parent ?? document.body;
    this.pages = {};
    this.codeInputs = [];
    const root = (this.root = el('div', 'ui-splash', parent));
    const card = (this.card = el('div', 'ui-card inv-frame', root));
    const titleRow = el('div', 'ui-title-row', card);
    el('h1', 'ui-logo', titleRow, 'Island Platformer');
    if (devMode()) el('div', 'ui-dev-badge', titleRow, 'DEV');

    // On an iPhone or iPad, the game from the home screen has the whole screen,
    // with none of the browser's bars: say how, once
    if (homeScreenTip()) {
      const tip = el('div', 'ui-invite', card);
      el('div', '', tip, 'For the whole screen: in the Share menu, choose Add to Home Screen, and play from there.');
      button('ui-btn ui-btn-small ui-btn-ghost', tip, 'Got it', () => {
        tip.remove();
        try {
          localStorage.setItem(HOME_TIP_STORE, '1');
        } catch {}
      });
    }

    // ---- who you are: "Playing as niels", tap for your farmer ----
    const who = el('div', 'ui-who', card);
    this.whoBtn = button('ui-link ui-who-btn', who, '', () => this.open('farmer'));

    // ---- the main page: where you are and the way on, then the pages ----
    const main = this.page('main');
    const context = el('div', 'ui-context', main);
    this.contextText = el('div', 'ui-context-text', context);
    this.mainBtn = button('ui-btn ui-btn-big', context, '', () => (this.from === 'title' ? this.goHome() : this.hide()));
    this.homeBtn = button('ui-btn ui-btn-ghost', context, 'Go home', () => this.goHome());
    const nav = (label, page) => button('ui-btn ui-btn-ghost ui-nav', main, label, () => this.open(page));
    nav('Play online', 'online');
    nav('Friends', 'friends');
    this.farmerNav = nav('Your farmer', 'farmer'); // (with an account)
    this.addBtn = button('ui-btn ui-btn-ghost ui-nav', main, 'Add a player (split screen)', () => {
      const problem = this.onAddPlayer?.() ?? 'Not here';
      if (problem) this.setStatus(problem, true);
      else this.hide();
    });
    this.addBtn.title = 'Another farmer joins you at this screen, on a controller of their own';
    nav('Controls', 'controls');
    // sound effects and music, on or off (M in game does both), and the graphics
    const soundRow = el('div', 'ui-row', main);
    const toggle = (label, key, set) => {
      const b = button('ui-btn ui-btn-small ui-btn-ghost', soundRow, '', () => {
        set(!sound.settings()[key]);
        show();
      });
      const show = () => (b.textContent = `${label}: ${sound.settings()[key] ? 'on' : 'off'}`);
      show();
      return show;
    };
    const shows = [toggle('Sound', 'effects', sound.setEffects), toggle('Music', 'music', sound.setMusic)];
    // ...and how much is drawn: high, medium or low (src/gfx/quality.js), at once
    const gfx = button('ui-btn ui-btn-small ui-btn-ghost', soundRow, '', () => {
      quality.cycle();
      showGfx();
    });
    gfx.title = 'Lower draws less: smoother on a slow phone or computer';
    const showGfx = () => (gfx.textContent = `Graphics: ${quality.tier()}`);
    shows.push(showGfx);
    showGfx();
    this.showSound = () => shows.forEach((show) => show());
    // the camera: from above, or in first person (V in game does the same)
    const viewRow = el('div', 'ui-row', main);
    const showView = () => (viewBtn.textContent = `Camera: ${view.firstPerson() ? 'first person' : 'overhead'}`);
    const viewBtn = button('ui-btn ui-btn-small ui-btn-ghost', viewRow, '', () => {
      view.toggle();
      showView();
    });
    this.showView = showView;
    showView();

    // ---- an invitation (?lobby=CODE) ----
    this.invite = this.page('invite');
    this.inviteText = el('div', 'ui-invite', this.invite);
    const inviteRow = el('div', 'ui-row', this.invite);
    this.inviteJoin = button('ui-btn ui-btn-big', inviteRow, 'Join lobby', () => this.play(this.inviteCode));
    button('ui-btn ui-btn-ghost', inviteRow, 'Not now', () => {
      showCodeInAddress('');
      this.showPage('main');
    });

    // ---- an invitation to help on a farm (?help=CODE) ----
    this.helpInvite = this.page('help');
    this.helpText = el('div', 'ui-invite', this.helpInvite);
    const helpRow = el('div', 'ui-row', this.helpInvite);
    this.helpJoin = button('ui-btn ui-btn-big', helpRow, 'Help out', () => this.help(this.helpCode));
    button('ui-btn ui-btn-ghost', helpRow, 'Not now', () => {
      forgetHelpCode();
      this.showPage('main');
    });

    // ---- Play online ----
    const online = this.page('online', 'Play online');
    this.lobbyCard = el('div', 'ui-invite', online);
    this.lobbyText = el('div', '', this.lobbyCard);
    this.lobbyCopy = button('ui-btn ui-btn-small', this.lobbyCard, 'Copy invite link', () => this.copyLobbyLink());
    this.lobbyFriends = el('div', 'ui-helper-list', this.lobbyCard);
    this.startBtn = button('ui-btn ui-btn-big', online, 'Start a lobby', () => this.showStart());
    const row = el('div', 'ui-row', online);
    button('ui-btn', row, 'Quick join', () => this.play(''));
    button('ui-btn', row, 'Browse lobbies', () => this.showBrowse());
    button('ui-btn ui-btn-ghost', online, 'Leaderboards', () => this.showBoards());
    this.codeForm(online, 'Code from a friend');
    el('div', 'ui-muted', online, 'A lobby is one party game: everyone in it plays, and then heads home. Nothing on its island grows back.');

    // ---- Browse ----
    const browse = this.page('browse', 'Lobbies', 'online');
    this.list = el('div', 'ui-list', browse);
    button('ui-btn ui-btn-ghost', browse, 'Refresh', () => this.showBrowse());

    // ---- Leaderboards: every lobby game's top ten (server/leaderboards.js) ----
    const boards = this.page('boards', 'Leaderboards', 'online');
    this.boardButtons = el('div', 'ui-game-pick', boards);
    this.boardList = el('div', 'ui-list ui-board', boards);
    el('div', 'ui-muted', boards, 'Every farmer’s best in each game, and how many times they won it.');

    // ---- Start a lobby: its game, and the friends to invite ----
    const startPage = this.page('start', 'Start a lobby', 'online');
    el('div', 'ui-sub', startPage, 'Which game?');
    this.gameButtons = el('div', 'ui-game-pick', startPage);
    this.gameBlurb = el('div', 'ui-muted', startPage);
    this.pickGame('loot_run');
    el('div', 'ui-sub', startPage, 'Who’s coming?');
    el('div', 'ui-muted', startPage, `Tick the friends to invite: they get an invitation right away. The lobby opens in ${PARTY_MS / 1000} seconds, for everyone who said yes; then the game starts, and afterwards everyone heads back to their farm.`);
    this.startList = el('div', 'ui-helper-list', startPage);
    button('ui-btn ui-btn-big', startPage, 'Start', () => this.startParty());

    // ---- the party: who is coming, till the lobby opens ----
    const partyPage = this.page('party', '', 'online');
    el('h2', '', partyPage, 'Your lobby');
    this.partyClock = el('div', 'ui-party-clock', partyPage);
    this.partyList = el('div', 'ui-helper-list', partyPage);
    button('ui-btn ui-btn-ghost', partyPage, 'Call it off', () => this.cancelParty());

    // ---- Friends ----
    const friends = this.page('friends', 'Friends');
    this.friendsList = el('div', 'ui-helper-list', friends);
    const add = el('form', 'ui-row ui-code-row', friends);
    this.friendInput = el('input', 'ui-input', add);
    Object.assign(this.friendInput, { placeholder: 'Add a friend by username', maxLength: MAX_NAME, autocomplete: 'off' });
    button('ui-btn', add, 'Add', null).type = 'submit';
    add.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addFriend();
    });
    el('div', 'ui-sub', friends, 'Farms you help on');
    this.helpingList = el('div', 'ui-helper-list', friends);
    el('div', 'ui-sub', friends, 'Your helpers');
    this.helpersBox = el('div', 'ui-menu', friends);
    el('div', 'ui-sub', friends, 'Got an invite code?');
    this.codeForm(friends, 'Invite code');

    // ---- Controls ----
    addHelp(this.page('controls', 'Controls'));

    // ---- The welcome: logging in, or making an account (a window of its own) ----
    this.welcome = el('div', 'ui-splash', parent);
    this.welcome.hidden = true;
    const welcomeCard = el('div', 'ui-card inv-frame', this.welcome);
    el('h1', 'ui-logo', el('div', 'ui-title-row', welcomeCard), 'Island Platformer');
    el('div', 'ui-context-text', welcomeCard, 'Welcome, farmer! Grow a little farm, then hop online to forage with other farmers.');
    this.accountPage = el('form', 'ui-page', welcomeCard);
    const tabs = el('div', 'ui-row', this.accountPage);
    this.loginTab = button('ui-btn ui-btn-small', tabs, 'Log in', () => this.accountMode('login'));
    this.signupTab = button('ui-btn ui-btn-small', tabs, 'Create account', () => this.accountMode('signup'));
    this.accountNote = el('div', 'ui-muted', this.accountPage);
    const user = el('label', 'ui-field', this.accountPage);
    el('span', '', user, 'Username');
    this.userInput = el('input', 'ui-input', user);
    Object.assign(this.userInput, { maxLength: MAX_NAME, autocomplete: 'username', placeholder: 'What farmers call you' });
    const pass = el('label', 'ui-field', this.accountPage);
    el('span', '', pass, 'Password');
    this.passInput = el('input', 'ui-input', pass);
    Object.assign(this.passInput, { type: 'password', maxLength: PASSWORD_LENGTH[1], autocomplete: 'current-password' });
    this.shirtField = el('div', 'ui-field', this.accountPage);
    el('span', '', this.shirtField, 'Shirt color');
    this.signupSwatches = this.swatches(this.shirtField, (color) => (this.pickedColor = color));
    this.accountBtn = button('ui-btn ui-btn-big', this.accountPage, '', null);
    this.accountBtn.type = 'submit';
    this.offlineBtn = button('ui-btn ui-btn-ghost', this.accountPage, 'Play in this browser for now', () => {
      this.showWelcome(false);
      this.goHome();
    });
    this.offlineBtn.hidden = true;
    this.accountStatus = el('div', 'ui-status', welcomeCard);
    this.accountPage.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitAccount();
    });
    this.accountMode('login'); // (Create account is a tap away)

    // ---- Your farmer ----
    const farmer = this.page('farmer', 'Your farmer');
    this.wardrobe = new Wardrobe(farmer, {
      onTryOn: (look, color) => this.onTryOn(look, color),
      onSave: (look, color) => this.onDress(look, color),
      onStatus: (text, isError) => this.setStatus(text, isError),
    });
    el('div', 'ui-muted', farmer, 'Other farmers see you in it in lobbies and on farms.');
    button('ui-btn ui-btn-ghost', farmer, 'Log out', () => {
      if (confirm('Log out? Your farm stays on the server: log in again to play it, here or anywhere.')) this.onLogout();
    });

    this.status = el('div', 'ui-status', card);
    this.hidden = true;
    root.hidden = true;
  }

  // A page of the menu; with a title, it has a Back button to its parent page
  page(name, title = '', parent = 'main', tag = 'div') {
    const node = el(tag, 'ui-page', this.card);
    if (title) {
      const head = el('div', 'ui-page-head', node);
      button('ui-btn ui-btn-small ui-btn-ghost', head, '‹ Back', () => this.back());
      el('h2', '', head, title);
    }
    this.pages[name] = { node, parent };
    return node;
  }

  // A code box: a lobby's code, or an invitation to help on a farm
  codeForm(parent, placeholder) {
    const form = el('form', 'ui-row ui-code-row', parent);
    const input = el('input', 'ui-input', form);
    Object.assign(input, { placeholder, maxLength: 12, autocomplete: 'off' });
    button('ui-btn', form, 'Join', null).type = 'submit';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const typed = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (typed.length === 8) return this.help(typed); // (an invitation to help on a farm)
      const code = normalizeCode(typed);
      if (!code) return this.setStatus('That code doesn’t look right. Codes are 6, 8 or 10 letters and digits.', true);
      this.play(code);
    });
    this.codeInputs.push(input);
  }

  // A row of shirt colors to pick from; pick(color) when one is picked
  swatches(parent, pick) {
    const row = el('div', 'ui-swatches', parent);
    const list = PLAYER_COLORS.map((color) => {
      const b = button('ui-swatch', row, '', () => {
        for (const other of list) other.classList.toggle('on', other === b);
        pick(color);
      });
      b.style.background = hexColor(color);
      b.dataset.color = color;
      b.title = 'This one';
      return b;
    });
    return { mark: (color) => list.forEach((b) => b.classList.toggle('on', Number(b.dataset.color) === color)) };
  }

  // ---------- The account ----------
  // mode: 'login' or 'signup'
  accountMode(mode) {
    this.mode = mode;
    this.loginTab.classList.toggle('ui-btn-ghost', mode !== 'login');
    this.signupTab.classList.toggle('ui-btn-ghost', mode !== 'signup');
    this.shirtField.hidden = mode !== 'signup';
    this.passInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    this.accountBtn.textContent = mode === 'signup' ? 'Create account' : 'Log in';
    this.accountNote.textContent = mode === 'signup'
      ? `Pick a username (other farmers see it) and a password of at least ${PASSWORD_LENGTH[0]} characters. There is no getting a forgotten password back, so keep it somewhere safe.`
      : 'Log in to play your farm, on this device or any other.';
    if (mode === 'signup' && !this.pickedColor) {
      this.pickedColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
      this.signupSwatches.mark(this.pickedColor);
    }
    this.welcomeStatus('');
  }

  welcomeStatus(text, isError = false) {
    this.accountStatus.textContent = text;
    this.accountStatus.classList.toggle('error', isError);
  }

  // The welcome, instead of the menu (on: false, away for good: we're in)
  showWelcome(on) {
    this.welcome.hidden = !on;
    if (on) {
      this.root.hidden = true;
      this.hidden = false; // (the game waits behind it, as behind the menu)
      document.body.classList.add('in-menu');
    } else if (this.root.hidden) {
      this.hidden = true;
      document.body.classList.remove('in-menu');
    }
  }

  async submitAccount() {
    const username = this.userInput.value.trim();
    const password = this.passInput.value;
    const problem = this.mode === 'signup' ? usernameProblem(username) || passwordProblem(password) : !username || !password ? 'Type your username and password.' : '';
    if (problem) return this.welcomeStatus(problem, true);
    this.accountBtn.disabled = true;
    this.welcomeStatus(this.mode === 'signup' ? 'Making your account…' : 'Logging in…');
    try {
      if (this.mode === 'signup') await this.onRegister({ username, password, color: this.pickedColor });
      else await this.onLogin({ username, password });
      this.passInput.value = '';
      this.welcomeStatus('');
      this.showWelcome(false);
      this.show({ from: 'title' }); // (the menu, as the page would have opened on it)
    } catch (e) {
      this.welcomeStatus(e.message, true);
      this.offlineBtn.hidden = !!e.status; // (no server: the farm can be played here meanwhile)
    } finally {
      this.accountBtn.disabled = false;
    }
  }

  // The account as the server has it now: on the title screen, the way in
  // (logging in) or out of it
  accountChanged() {
    this.showWho();
    if (this.hidden || this.from !== 'title') return;
    if (!this.account() && this.welcome.hidden) this.show({ from: 'title' });
    else if (this.account() && !this.welcome.hidden) {
      this.showWelcome(false);
      this.show({ from: 'title' });
    }
  }

  showWho() {
    const account = this.account();
    this.whoBtn.parentNode.hidden = !account;
    this.farmerNav.hidden = !account;
    if (account) this.whoBtn.textContent = `Playing as ${account.username} ✎`;
  }

  // from: 'title' (the page just opened), or anything else for in game.
  // page: the page to open on. message: why we are here, when it was not the player's choice.
  // direct: opened on that page from the game (the house's wardrobe): Back goes back to the game.
  show({ from = 'game', page = 'main', message = '', direct = false } = {}) {
    this.from = from === 'title' ? 'title' : 'game';
    this.direct = direct && this.from === 'game' ? page : null;
    this.hidden = false;
    this.showSound(); // (M may have changed it)
    this.showView(); // (and V)
    this.root.hidden = false;
    this.root.classList.toggle('in-game', this.from === 'game');
    document.body.classList.toggle('in-menu', this.from === 'title');
    this.showContext();
    this.showWho();
    if (this.from === 'title' && !this.account()) {
      this.showWelcome(true);
      this.welcomeStatus(message, !!message);
      return;
    }
    const help = linkedHelpCode();
    const code = this.where().place !== 'lobby' && linkedCode(); // (in a lobby, the address has its own code)
    if (page === 'main' && help) this.showHelpInvite(help);
    else if (page === 'main' && code) this.showInvite(code);
    else this.open(page);
    this.setStatus(message, !!message);
  }

  hide() {
    if (this.current === 'farmer') this.wardrobe.hide();
    this.hidden = true;
    this.root.hidden = true;
    document.body.classList.remove('in-menu');
  }

  // Esc: out of a box being typed in, back a page, or (in game) out of the menu
  escape() {
    if (this.root.contains(document.activeElement) && document.activeElement.matches('input, select')) document.activeElement.blur();
    else if (this.current !== 'main') this.back();
    else if (this.from === 'game') this.hide();
  }

  // Back a page (or, from a page opened straight from the game, back to the game)
  back() {
    if (this.direct === this.current) this.hide();
    else this.showPage(this.pages[this.current].parent);
  }

  showPage(name) {
    if (this.current === 'party' && name !== 'party' && this.party) this.cancelParty(); // (Back, or Esc)
    if (this.current === 'farmer' && name !== 'farmer') this.wardrobe.hide(); // (what was picked is kept)
    for (const [key, { node }] of Object.entries(this.pages)) node.hidden = key !== name;
    this.current = name;
    this.card.scrollTop = 0;
    this.setStatus('');
  }

  // A page, filled in as it opens
  open(name) {
    this.showPage(name);
    if (name === 'online') this.showLobbyCard();
    else if (name === 'friends') this.showFriends();
    else if (name === 'farmer') {
      const account = this.account();
      if (account) this.wardrobe.show(account.look, account.color);
    }
  }

  // The one part of the main page that changes: where we are, and the way on
  showContext() {
    const { place, visit, session } = this.where();
    const title = this.from === 'title';
    const text = this.contextText;
    text.textContent = '';
    if (title) text.append('Grow a little farm, then hop online to forage with other farmers.');
    else if (place === 'lobby') text.append('In ', el('b', '', null, session.room.name), '. Everyone else keeps playing.');
    else if (visit && !visit.mine) text.append('Helping on ', el('b', '', null, visit.name), '.');
    else if (visit && (this.players?.() ?? 1) > 1) text.append(`On your farm, ${this.players()} farmers at this screen. It keeps going for everyone on it.`);
    else if (visit) text.append('On your farm. It keeps going for everyone on it.');
    else if ((this.players?.() ?? 1) > 1) text.append(`On your farm, ${this.players()} farmers at this screen. It keeps going while they play.`);
    else text.append('On your farm. Time waits while the menu is open.');
    this.mainBtn.textContent = title ? 'Go to my farm' : 'Resume';
    this.addBtn.hidden = title || place !== 'home' || !!(visit && !visit.mine); // (our own farm, with its helpers or not; not a friend's)
    this.homeBtn.hidden = title || !(place === 'lobby' || (visit && !visit.mine));
  }

  setStatus(text, isError = false) {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
  }

  // ---------- Your name: the account's ----------
  name() {
    return this.account()?.username || 'Farmer';
  }

  goHome() {
    this.onHome();
  }

  play(code) {
    this.onPlay({ name: this.name(), code });
  }

  // ---------- Play online ----------
  showLobbyCard() {
    const { place, session } = this.where();
    this.lobbyCard.hidden = place !== 'lobby';
    if (place !== 'lobby') return;
    this.lobbyText.textContent = '';
    this.lobbyText.append('You’re in ', el('b', '', null, session.room.name), `${gameText(session.room.game)} · code ${session.code}`);
    this.showLobbyFriends();
  }

  // Friends online, to invite to the lobby we are in
  async showLobbyFriends() {
    const box = this.lobbyFriends;
    let friends = [];
    try {
      ({ friends } = await this.onFriends());
    } catch {}
    box.textContent = '';
    friends = friends.filter((f) => f.online);
    box.hidden = !friends.length;
    for (const f of friends) {
      const row = this.friendRow(box, f);
      const invite = button('ui-btn ui-btn-small', row, 'Invite', () => {
        this.onInviteToLobby([f.id]);
        invite.textContent = 'Invited!';
        invite.disabled = true;
      });
    }
  }

  async copyLobbyLink() {
    const { session } = this.where();
    if (!session) return;
    const link = inviteLink(session.code);
    const ok = await copyText(link);
    if (!ok) return this.setStatus(`Invite link: ${link}`);
    this.lobbyCopy.textContent = 'Link copied!';
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => (this.lobbyCopy.textContent = 'Invite a friend'), 1500);
  }

  async showBrowse() {
    this.showPage('browse');
    this.list.textContent = 'Looking for lobbies…';
    try {
      const lobbies = await listLobbies();
      this.list.textContent = '';
      if (!lobbies.length) el('div', 'ui-muted', this.list, 'No lobbies running right now. Start one, or try Quick join.');
      // the fullest on top
      for (const l of lobbies.sort((a, b) => b.players - a.players)) {
        const row = el('div', 'ui-game', this.list);
        const info = el('div', 'ui-game-info', row);
        el('b', '', info, l.name);
        const rare = l.rare ? ` · ${l.rare} rare find${l.rare === 1 ? '' : 's'} about` : '';
        el('span', 'ui-muted', info, `${LOBBY_GAMES[l.game]?.name ?? 'Lobby'} · ${l.players}/${l.max} farmers${rare}`);
        const closed = l.open === false; // (its game is under way)
        const join = button('ui-btn ui-btn-small', row, l.full ? 'Full' : closed ? 'Playing' : 'Join', () => this.play(l.code));
        join.disabled = l.full || closed;
      }
    } catch {
      this.list.textContent = NO_SERVER;
    }
  }

  // Our friends changed (server/presence.js): the list open now, afresh
  friendsChanged() {
    if (this.hidden) return;
    if (this.current === 'friends') this.showFriendList(true);
    else if (this.current === 'online' && !this.lobbyCard.hidden) this.showLobbyFriends();
    else if (this.current === 'start') this.showStart(true);
  }

  // ---------- Starting a lobby with friends ----------
  // (again: the list redrawn, the friends ticked staying ticked)
  async showStart(again = false) {
    this.showPage('start');
    const list = this.startList;
    if (!again) list.textContent = 'Asking the server…';
    const ticked = again ? this.picked : new Set();
    this.picked = new Set();
    let friends = [];
    try {
      ({ friends } = await this.onFriends());
    } catch (e) {
      list.textContent = e.message;
      return;
    }
    list.textContent = '';
    if (!friends.length) el('div', 'ui-muted', list, 'No friends yet: add some under Friends. You can start one on your own meanwhile.');
    for (const f of friends.sort((a, b) => b.online - a.online)) {
      const row = el('label', 'ui-helper ui-check', list);
      const box = el('input', '', row);
      box.type = 'checkbox';
      box.disabled = !f.online;
      box.checked = f.online && ticked.has(f.id);
      if (box.checked) this.picked.add(f.id);
      box.addEventListener('change', () => (box.checked ? this.picked.add(f.id) : this.picked.delete(f.id)));
      this.friendBits(row, f);
    }
  }

  // ---------- Leaderboards ----------
  // A game's board (LOBBY_GAMES): its top ten, and where we are on it if lower down
  async showBoards(kind = this.boardKind ?? 'loot_run') {
    if (this.current !== 'boards') this.showPage('boards');
    this.boardKind = kind;
    this.boardButtons.textContent = '';
    for (const [k, { name }] of Object.entries(LOBBY_GAMES)) {
      const b = button(`ui-btn ui-btn-small${k === kind ? '' : ' ui-btn-ghost'}`, this.boardButtons, name, () => this.showBoards(k));
      b.setAttribute('aria-pressed', String(k === kind));
    }
    const list = this.boardList;
    list.textContent = 'Asking the server…';
    const me = this.account()?.username ?? '';
    let boards;
    try {
      boards = await leaderboards(me);
    } catch {
      list.textContent = NO_SERVER;
      return;
    }
    if (this.boardKind !== kind) return; // (another game picked meanwhile)
    list.textContent = '';
    const rows = boards.games?.[kind] ?? [];
    if (!rows.length) el('div', 'ui-muted', list, 'Nobody on this board yet: play a lobby of it and be the first!');
    for (const entry of rows) this.boardRow(entry, kind, entry.name.toLowerCase() === me.toLowerCase());
    const mine = boards.you?.[kind];
    if (mine && mine.rank > rows.length) {
      el('div', 'ui-muted ui-board-gap', list, '⋯');
      this.boardRow(mine, kind, true);
    }
  }

  boardRow({ rank, name, best, wins, played }, kind, mine) {
    const row = el('div', `ui-game ui-board-row${mine ? ' mine' : ''}`, this.boardList);
    el('b', `ui-board-rank${rank <= 3 ? ` top${rank}` : ''}`, row, String(rank));
    const info = el('div', 'ui-game-info', row);
    el('b', '', info, name);
    el('span', 'ui-muted', info, `${wins} win${wins === 1 ? '' : 's'} in ${played} game${played === 1 ? '' : 's'}`);
    el('span', 'ui-board-best', row, best ? LOBBY_GAMES[kind].scored(best) : '–');
  }

  // The game the lobby will be for (LOBBY_GAMES): its button lit, and what it is
  pickGame(kind) {
    this.game = kind;
    this.gameButtons.textContent = '';
    for (const [k, { name }] of Object.entries(LOBBY_GAMES)) {
      const b = button(`ui-btn ui-btn-small${k === kind ? '' : ' ui-btn-ghost'}`, this.gameButtons, name, () => this.pickGame(k));
      b.setAttribute('aria-pressed', String(k === kind));
    }
    this.gameBlurb.textContent = `${LOBBY_GAMES[kind].blurb}.`;
  }

  startParty() {
    if (!this.onStartParty([...this.picked], this.game)) return this.setStatus('Not connected to the server right now. Try again in a moment.', true);
    this.party = { ms: PARTY_MS, friends: [] };
    this.showPage('party');
    this.partyClock.textContent = this.picked.size ? `${PARTY_MS / 1000}` : 'Opening your lobby…';
    this.partyList.textContent = '';
    this.partyList.hidden = !this.picked.size;
  }

  // How our party stands (server/presence.js PARTY): { ms, friends: [[id, name, state]] }
  partyStatus({ ms, friends }) {
    if (!this.party) return;
    this.party = { ms, friends, at: performance.now() };
    const list = this.partyList;
    list.textContent = '';
    const SAYS = { waiting: 'invited…', yes: 'coming!', no: 'not this time' };
    for (const [, name, state] of friends) {
      const row = el('div', 'ui-helper', list);
      el('span', 'ui-player-name', row, name);
      el('span', state === 'yes' ? '' : 'ui-muted', row, SAYS[state] ?? '');
    }
    clearInterval(this.partyTimer);
    const tick = () => {
      const left = Math.max(0, Math.ceil((this.party.ms - (performance.now() - this.party.at)) / 1000));
      this.partyClock.textContent = left ? `${left}` : 'Opening…';
    };
    tick();
    this.partyTimer = setInterval(tick, 250);
  }

  // The party is over: off to the lobby (why: none), or called off (why: what happened)
  partyOver(why = '') {
    clearInterval(this.partyTimer);
    this.party = null;
    if (why && this.current === 'party') {
      this.showPage('online');
      this.setStatus(why, true);
    }
  }

  cancelParty() {
    if (!this.party) return;
    this.onCancelParty();
    this.partyOver();
    this.showPage('online');
  }

  async showInvite(code) {
    this.inviteCode = code;
    this.showPage('invite');
    this.inviteText.textContent = `You are invited to lobby ${code}…`;
    this.inviteJoin.disabled = false;
    try {
      const l = await lobbyInfo(code);
      this.inviteText.textContent = '';
      el('div', 'ui-invite-title', this.inviteText, `You are invited to “${l.name}”`);
      el('div', 'ui-muted', this.inviteText, `${LOBBY_GAMES[l.game]?.name ?? 'Lobby'} · ${l.players}/${l.max} farmers · code ${l.code}${l.seed ? ` · island ${l.seed}` : ''}`);
      if (l.full || l.open === false) {
        this.inviteJoin.disabled = true;
        this.setStatus(l.full ? 'That lobby is full right now.' : 'That lobby’s game has started: too late to join.', true);
      }
    } catch (e) {
      this.inviteText.textContent = e.status === 404 ? `Lobby ${code} has closed (or never opened).` : NO_SERVER;
      this.inviteJoin.disabled = true;
    }
  }

  // ---------- Friends ----------
  showFriends() {
    this.showFriendList();
    this.showHelping();
    this.showHelpers();
  }

  // A friend's dot (green: online) and name, in a row
  friendBits(row, f) {
    const dot = el('span', 'ui-dot', row);
    dot.style.background = f.online ? '#7ed957' : '#b8a48a';
    el('span', 'ui-player-name', row, f.name);
    const WHERE = { home: 'at home', lobby: 'in a lobby', farm: 'on a farm' };
    el('span', 'ui-muted', row, f.online ? WHERE[f.where] ?? 'online' : offlineFor(f.lastOnline));
  }

  friendRow(parent, f) {
    const row = el('div', 'ui-helper', parent);
    this.friendBits(row, f);
    return row;
  }

  // Our friends, and who asked to be one (the Friends page)
  // (again: redrawn when it comes, without "Asking the server" meanwhile)
  async showFriendList(again = false) {
    const list = this.friendsList;
    if (!again) list.textContent = 'Asking the server…';
    let friends;
    let asks;
    try {
      ({ friends, asks } = await this.onFriends());
    } catch (e) {
      list.textContent = e.message;
      return;
    }
    list.textContent = '';
    for (const a of asks) {
      const row = el('div', 'ui-helper', list);
      el('span', 'ui-player-name', row, a.name);
      el('span', 'ui-muted', row, 'wants to be friends');
      const answer = (yes) => async () => {
        try {
          await this.onAnswerFriend(a.id, yes);
          this.showFriendList();
        } catch (e) {
          this.setStatus(e.message, true);
        }
      };
      button('ui-btn ui-btn-small', row, 'Yes', answer(true));
      button('ui-btn ui-btn-small ui-btn-ghost', row, 'No', answer(false));
    }
    if (!friends.length && !asks.length) el('div', 'ui-muted', list, 'No friends yet. Add one by their username: once they say yes you can invite each other to lobbies.');
    const here = this.where().visit?.id;
    for (const f of friends.sort((a, b) => b.online - a.online)) {
      const row = this.friendRow(list, f);
      // (their farm, to look round: server/farmroom.js lets a friend in as a visitor)
      if (f.id !== here) button('ui-btn ui-btn-small', row, 'Visit', () => this.visit(f.id, f.name)).title = `Look round ${f.name}'s farm`;
      button('ui-btn ui-btn-small ui-btn-ghost', row, '✕', async () => {
        if (!confirm(`Take ${f.name} off your friends?`)) return;
        try {
          await this.onRemoveFriend(f.id);
          this.showFriendList();
        } catch (e) {
          this.setStatus(e.message, true);
        }
      }).title = 'Not friends any more';
    }
  }

  async addFriend() {
    const username = this.friendInput.value.trim();
    if (!username) return;
    try {
      const { name, friends } = await this.onAddFriend(username);
      this.friendInput.value = '';
      this.setStatus(friends ? `You and ${name} are friends now!` : `Asked ${name}. Once they say yes, you're friends.`);
      this.showFriendList();
    } catch (e) {
      this.setStatus(e.message, true);
    }
  }

  // The farms we help on (the Friends page, when it is open)
  async showHelping() {
    if (this.hidden || this.current !== 'friends') return;
    const list = this.helpingList;
    let farms = [];
    try {
      farms = await this.onHelping();
    } catch {}
    list.textContent = '';
    if (!farms.length) el('div', 'ui-muted', list, 'None yet. When a friend invites you, their farm shows up here.');
    const here = this.where().visit?.id;
    for (const f of farms) {
      const row = el('div', 'ui-helper', list);
      el('span', 'ui-player-name', row, f.name);
      if (f.id === here) {
        el('span', 'ui-muted', row, 'You’re here');
        continue;
      }
      if (f.here) el('span', 'ui-muted', row, `${f.here} there now`);
      button('ui-btn ui-btn-small', row, 'Visit', () => this.visit(f.id, f.name));
    }
  }

  visit(id, name) {
    this.setStatus(`Walking over to ${name}…`);
    this.onVisitFarm(id, name);
  }

  async showHelpInvite(code) {
    this.helpCode = code;
    this.showPage('help');
    this.helpText.textContent = 'You are invited to help on a farm…';
    this.helpJoin.disabled = false;
    try {
      const f = await this.onInvited(code);
      this.helpText.textContent = '';
      el('div', 'ui-invite-title', this.helpText, `You are invited to help on “${f.name}”`);
      el('div', 'ui-muted', this.helpText, 'Come and farm there any time, even while they are away. What you harvest goes in their farm\'s chest.');
    } catch (e) {
      this.helpText.textContent = e.status ? e.message : NO_SERVER;
      this.helpJoin.disabled = true;
    }
  }

  // Say yes to an invitation, then off to that farm
  async help(code) {
    this.setStatus('Saying yes…');
    try {
      const f = await this.onHelp(code, this.name());
      forgetHelpCode();
      for (const input of this.codeInputs) input.value = '';
      this.visit(f.id, f.name);
    } catch (e) {
      this.setStatus(e.message, true);
    }
  }

  // Our farm's helpers
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
          this.setStatus(e.message, true);
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
          `Send your friend the link, or have them type the code under Friends in their menu. ` +
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
}

// How long ago a friend was last online: 'offline 5 min', ... 'offline > 7 days'
function offlineFor(lastOnline, now = Date.now()) {
  if (!lastOnline) return 'offline';
  const min = Math.floor((now - lastOnline) / 60_000);
  if (min < 1) return 'offline just now';
  if (min < 60) return `offline ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `offline ${hours} h`;
  const days = Math.floor(hours / 24);
  return days > 7 ? 'offline > 7 days' : `offline ${days} day${days === 1 ? '' : 's'}`;
}
