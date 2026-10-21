// The game's one menu: the title screen when the page opens, and the menu in
// game (Esc, or L for Play online). Its main page is the same everywhere but
// for one part, which says where you are and what the big button does: Go to
// my farm on the title screen, Resume in game, and Go home when away from
// home. The rest is on pages:
// - Play online: Quick join (the fullest public lobby with room, or a new
//   one), Browse, New lobby, or a code from a friend: a lobby's, or an
//   invitation to help on their farm (8 long, so the two can't be mixed up).
//   In a lobby, its code and invite link too.
// - Friends: the farms you help on (server/farms.js), to visit, and your
//   farm's helpers, friends who can come and farm on it, invited with a code.
// - Controls.
// A page opened from an invite link (?lobby=CODE or ?help=CODE) shows that
// invitation first. (It began as the title screen, hence its name.)
import { MAX_PLAYERS, MAX_NAME } from '../../shared/constants.js';
import { MAX_SEED, normalizeSeed } from '../../shared/worldgen.js';
import { listLobbies, lobbyInfo, openLobby, linkedCode, normalizeCode, showCodeInAddress, devMode, linkedHelpCode, forgetHelpCode, inviteLink, helpLink } from '../net/lobby.js';
import { el, button, copyText } from './dom.js';
import { addHelp } from './hud.js';

const NAME_STORE = 'tp.name';
const NO_SERVER = 'Could not reach the game server. Start it with `npm run dev`; your farm works without it.';

function storedName() {
  try {
    return localStorage.getItem(NAME_STORE) || '';
  } catch {
    return '';
  }
}

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
  constructor(options) {
    Object.assign(this, options);
    this.pages = {};
    this.codeInputs = [];
    const root = (this.root = el('div', 'ui-splash', document.body));
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

    // ---- who you are: "Playing as niels", tap to change it ----
    const who = el('div', 'ui-who', card);
    this.whoBtn = button('ui-link ui-who-btn', who, '', () => this.editName(true));
    this.nameInput = el('input', 'ui-input', who);
    Object.assign(this.nameInput, { maxLength: MAX_NAME, placeholder: 'Your name', value: storedName(), autocomplete: 'off' });
    this.nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && this.nameInput.blur());
    this.nameInput.addEventListener('blur', () => this.nameInput.value.trim() && this.editName(false));
    this.editName(!storedName());

    // ---- the main page: where you are and the way on, then the pages ----
    const main = this.page('main');
    const context = el('div', 'ui-context', main);
    this.contextText = el('div', 'ui-context-text', context);
    this.mainBtn = button('ui-btn ui-btn-big', context, '', () => (this.from === 'title' ? this.goHome() : this.hide()));
    this.homeBtn = button('ui-btn ui-btn-ghost', context, 'Go home', () => this.goHome());
    const nav = (label, page) => button('ui-btn ui-btn-ghost ui-nav', main, label, () => this.open(page));
    nav('Play online', 'online');
    nav('Friends', 'friends');
    nav('Controls', 'controls');

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
    this.lobbyCopy = button('ui-btn ui-btn-small', this.lobbyCard, 'Invite a friend', () => this.copyLobbyLink());
    button('ui-btn', online, 'Quick join', () => this.play(''));
    const row = el('div', 'ui-row', online);
    button('ui-btn', row, 'Browse lobbies', () => this.showBrowse());
    button('ui-btn', row, 'New lobby', () => this.showPage('create'));
    this.codeForm(online, 'Code from a friend');

    // ---- Browse ----
    const browse = this.page('browse', 'Lobbies', 'online');
    this.list = el('div', 'ui-list', browse);
    button('ui-btn ui-btn-ghost', browse, 'Refresh', () => this.showBrowse());

    // ---- New lobby ----
    this.create = this.page('create', 'New lobby', 'online', 'form');
    const lobbyName = el('label', 'ui-field', this.create);
    el('span', '', lobbyName, 'Lobby name');
    this.lobbyName = el('input', 'ui-input', lobbyName);
    this.lobbyName.maxLength = 32;
    this.lobbyName.placeholder = 'Berry hill';
    // the island's seed: the same seed, the same island (shared/worldgen.js)
    const seed = el('label', 'ui-field', this.create);
    el('span', '', seed, 'Island seed');
    this.seed = el('input', 'ui-input', seed);
    this.seed.maxLength = MAX_SEED;
    this.seed.placeholder = 'a new island (or try “classic”)';
    this.seed.autocomplete = 'off';
    const seats = el('label', 'ui-field', this.create);
    el('span', '', seats, 'Farmers');
    this.seats = el('select', 'ui-input', seats);
    for (let n = 2; n <= MAX_PLAYERS; n++) el('option', '', this.seats, String(n)).value = n;
    this.seats.value = String(MAX_PLAYERS);
    const priv = el('label', 'ui-check', this.create);
    this.inviteOnly = el('input', '', priv);
    this.inviteOnly.type = 'checkbox';
    el('span', '', priv, 'Invite only (hidden from Browse)');
    button('ui-btn', this.create, 'Create', null).type = 'submit';
    this.create.addEventListener('submit', (e) => {
      e.preventDefault();
      this.makeLobby();
    });

    // ---- Friends ----
    const friends = this.page('friends', 'Friends');
    el('div', 'ui-sub', friends, 'Farms you help on');
    this.helpingList = el('div', 'ui-helper-list', friends);
    el('div', 'ui-sub', friends, 'Your helpers');
    this.helpersBox = el('div', 'ui-menu', friends);
    el('div', 'ui-sub', friends, 'Got an invite code?');
    this.codeForm(friends, 'Invite code');

    // ---- Controls ----
    addHelp(this.page('controls', 'Controls'));

    this.status = el('div', 'ui-status', card);
    this.hidden = true;
    root.hidden = true;
  }

  // A page of the menu; with a title, it has a Back button to its parent page
  page(name, title = '', parent = 'main', tag = 'div') {
    const node = el(tag, 'ui-page', this.card);
    if (title) {
      const head = el('div', 'ui-page-head', node);
      button('ui-btn ui-btn-small ui-btn-ghost', head, '‹ Back', () => this.showPage(parent));
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

  // from: 'title' (the page just opened), or anything else for in game.
  // page: the page to open on. message: why we are here, when it was not the player's choice.
  show({ from = 'game', page = 'main', message = '' } = {}) {
    this.from = from === 'title' ? 'title' : 'game';
    this.hidden = false;
    this.root.hidden = false;
    this.root.classList.toggle('in-game', this.from === 'game');
    document.body.classList.toggle('in-menu', this.from === 'title');
    this.showContext();
    const help = linkedHelpCode();
    const code = this.where().place !== 'lobby' && linkedCode(); // (in a lobby, the address has its own code)
    if (page === 'main' && help) this.showHelpInvite(help);
    else if (page === 'main' && code) this.showInvite(code);
    else this.open(page);
    this.setStatus(message, !!message);
  }

  hide() {
    this.hidden = true;
    this.root.hidden = true;
    document.body.classList.remove('in-menu');
  }

  // Esc: out of a box being typed in, back a page, or (in game) out of the menu
  escape() {
    if (this.root.contains(document.activeElement) && document.activeElement.matches('input, select')) document.activeElement.blur();
    else if (this.current !== 'main') this.showPage(this.pages[this.current].parent);
    else if (this.from === 'game') this.hide();
  }

  showPage(name) {
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
    else if (visit) text.append('On your farm. It keeps going for everyone on it.');
    else text.append('On your farm. Time waits while the menu is open.');
    this.mainBtn.textContent = title ? 'Go to my farm' : 'Resume';
    this.homeBtn.hidden = title || !(place === 'lobby' || (visit && !visit.mine));
  }

  setStatus(text, isError = false) {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
  }

  // ---------- Your name ----------
  editName(on) {
    this.whoBtn.hidden = on;
    this.nameInput.hidden = !on;
    if (on) {
      if (this.hidden === false) this.nameInput.focus(); // (not as the page opens: no keyboard popping up)
      return;
    }
    this.whoBtn.textContent = `Playing as ${this.name()} ✎`;
  }

  name() {
    const name = this.nameInput.value.trim();
    try {
      localStorage.setItem(NAME_STORE, name);
    } catch {}
    return name || 'Farmer';
  }

  goHome() {
    this.name(); // (remember it)
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
    this.lobbyText.append('You’re in ', el('b', '', null, session.room.name), ` · code ${session.code}`);
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
      if (!lobbies.length) el('div', 'ui-muted', this.list, 'No lobbies open right now. Start a new one, or try Quick join.');
      // the busy ones first, the fullest on top; then the quiet ones (nobody there), as the server has them
      const order = (l) => (l.quiet ? -1 : l.players);
      for (const l of lobbies.sort((a, b) => order(b) - order(a))) {
        const row = el('div', 'ui-game' + (l.quiet ? ' quiet' : ''), this.list);
        const info = el('div', 'ui-game-info', row);
        el('b', '', info, l.name);
        const rare = l.rare ? ` · ${l.rare} rare find${l.rare === 1 ? '' : 's'} about` : '';
        const who = l.quiet ? 'nobody there right now' : `${l.players}/${l.max} farmers`;
        el('span', 'ui-muted', info, `${who} · island ${l.seed}${rare}`);
        const join = button('ui-btn ui-btn-small', row, l.full ? 'Full' : 'Join', () => this.play(l.code));
        join.disabled = l.full;
      }
    } catch {
      this.list.textContent = NO_SERVER;
    }
  }

  async makeLobby() {
    this.setStatus('Opening your lobby…');
    try {
      const l = await openLobby({
        name: this.lobbyName.value.trim() || `${this.name()}'s meadow`,
        seed: normalizeSeed(this.seed.value) || undefined,
        maxPlayers: Number(this.seats.value),
        inviteOnly: this.inviteOnly.checked,
      });
      this.setStatus('');
      this.play(l.code);
    } catch (e) {
      this.setStatus(e.status ? e.message : NO_SERVER, true);
    }
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
      el('div', 'ui-muted', this.inviteText, `${l.players}/${l.max} farmers · code ${l.code}${l.seed ? ` · island ${l.seed}` : ''}`);
      if (l.full) {
        this.inviteJoin.disabled = true;
        this.setStatus('That lobby is full right now.', true);
      }
    } catch (e) {
      this.inviteText.textContent = e.status === 404 ? `Lobby ${code} has closed (or never opened).` : NO_SERVER;
      this.inviteJoin.disabled = true;
    }
  }

  // ---------- Friends ----------
  showFriends() {
    this.showHelping();
    this.showHelpers();
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
    this.name(); // (remember it)
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
