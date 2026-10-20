// The title screen, and the travel board you open from home: your name, the
// way to your farm, and the online lobbies - Quick join (the fullest public
// lobby with room, or a new one), Browse, Open a lobby, or Join with a code. A
// page opened from an invite link (?lobby=CODE) shows that lobby's
// invitation first. And the way to bring your farm over from another device,
// with a pairing code from that device's menu, or with the farm's name and
// PIN when there is no other device to ask (src/net/farm.js).
import { MAX_PLAYERS, MAX_NAME, MAX_FARM_NAME, PIN_LENGTH } from '../../shared/constants.js';
import { MAX_SEED, normalizeSeed } from '../../shared/worldgen.js';
import { listLobbies, lobbyInfo, openLobby, linkedCode, normalizeCode, showCodeInAddress, devMode } from '../net/lobby.js';
import { el, button } from './dom.js';
import { CONTROLS } from './hud.js';

const NAME_STORE = 'tp.name';
const NO_SERVER = 'Could not reach the game server. Start it with `npm run dev`; your farm works without it.';

function storedName() {
  try {
    return localStorage.getItem(NAME_STORE) || '';
  } catch {
    return '';
  }
}

export class Splash {
  // onPlay({ name, code }): visit a lobby ('' code: quick join). onHome(): go to the farm.
  // onFarmCode(code): play the farm of another device here (a promise; it fails with why).
  // onRecover(name, pin): the same, with the farm's name and PIN.
  constructor({ onPlay, onHome, onFarmCode, onRecover }) {
    this.onPlay = onPlay;
    this.onHome = onHome;
    this.onFarmCode = onFarmCode;
    this.onRecover = onRecover;
    const root = (this.root = el('div', 'ui-splash', document.body));
    const card = el('div', 'ui-card inv-frame', root);
    const titleRow = el('div', 'ui-title-row', card);
    el('h1', 'ui-logo', titleRow, 'Island Platformer');
    if (devMode()) el('div', 'ui-dev-badge', titleRow, 'DEV');
    el('div', 'ui-tagline', card, 'Tend your own little farm, then drop into online lobbies to gather berries, mushrooms and rare finds with other farmers.');

    const nameRow = el('label', 'ui-field', card);
    el('span', '', nameRow, 'Your name');
    this.nameInput = el('input', 'ui-input', nameRow);
    this.nameInput.maxLength = MAX_NAME;
    this.nameInput.placeholder = 'Farmer';
    this.nameInput.value = storedName();
    this.nameInput.autocomplete = 'off';

    // ---- an invitation (?lobby=CODE) ----
    this.invite = el('div', 'ui-invite', card);
    this.inviteText = el('div', '', this.invite);
    const inviteRow = el('div', 'ui-row', this.invite);
    this.inviteJoin = button('ui-btn ui-btn-big', inviteRow, 'Join lobby', () => this.play(this.inviteCode));
    button('ui-btn ui-btn-ghost', inviteRow, 'Not now', () => {
      showCodeInAddress('');
      this.showPanel('menu');
    });

    // ---- the menu ----
    this.menu = el('div', 'ui-menu', card);
    this.homeBtn = button('ui-btn ui-btn-big', this.menu, '', () => this.goHome());
    el('h2', 'ui-section', this.menu, 'Online lobbies');
    button('ui-btn', this.menu, 'Quick join', () => this.play(''));
    const row = el('div', 'ui-row', this.menu);
    button('ui-btn', row, 'Browse lobbies', () => this.showBrowse());
    button('ui-btn', row, 'Open a lobby', () => this.showPanel('create'));
    const codeRow = el('form', 'ui-row ui-code-row', this.menu);
    this.codeInput = el('input', 'ui-input', codeRow);
    this.codeInput.placeholder = 'Lobby code';
    this.codeInput.maxLength = 12;
    this.codeInput.autocomplete = 'off';
    button('ui-btn', codeRow, 'Join', null).type = 'submit';
    codeRow.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = normalizeCode(this.codeInput.value);
      if (!code) return this.setStatus('A lobby code is 6 or 10 letters and digits.', true);
      this.play(code);
    });

    // ---- your farm, from another device ----
    el('h2', 'ui-section', this.menu, 'Your farm from another device');
    el('div', 'ui-muted', this.menu, 'Get a code from the menu (Esc) on the device that has your farm.');
    const pairRow = el('form', 'ui-row ui-code-row', this.menu);
    this.pairInput = el('input', 'ui-input', pairRow);
    this.pairInput.placeholder = 'Farm code';
    this.pairInput.maxLength = 8;
    this.pairInput.autocomplete = 'off';
    button('ui-btn', pairRow, 'Bring it here', null).type = 'submit';
    pairRow.addEventListener('submit', (e) => {
      e.preventDefault();
      this.bringFarm();
    });
    button('ui-btn ui-btn-ghost ui-btn-small', this.menu, 'No other device? Use your farm’s name and PIN', () => this.showPanel('recover'));

    // ---- Browse ----
    this.browse = el('div', 'ui-browse', card);
    el('h2', '', this.browse, 'Public lobbies');
    this.list = el('div', 'ui-list', this.browse);
    const browseRow = el('div', 'ui-row', this.browse);
    button('ui-btn ui-btn-ghost', browseRow, 'Back', () => this.showPanel('menu'));
    button('ui-btn', browseRow, 'Refresh', () => this.showBrowse());

    // ---- Open a lobby ----
    this.create = el('form', 'ui-create', card);
    el('h2', '', this.create, 'Open a lobby');
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
    el('span', '', priv, 'Invite only (not listed; join by link)');
    const createRow = el('div', 'ui-row', this.create);
    button('ui-btn ui-btn-ghost', createRow, 'Back', () => this.showPanel('menu'));
    button('ui-btn', createRow, 'Open & join', null).type = 'submit';
    this.create.addEventListener('submit', (e) => {
      e.preventDefault();
      this.makeLobby();
    });

    // ---- your farm back, by its name and PIN ----
    this.recover = el('form', 'ui-create', card);
    el('h2', '', this.recover, 'Get your farm back');
    el('div', 'ui-muted', this.recover, 'Type the name and PIN you gave your farm (in the menu, Esc, on a device that had it).');
    const farmName = el('label', 'ui-field', this.recover);
    el('span', '', farmName, 'Farm name');
    this.farmName = el('input', 'ui-input', farmName);
    this.farmName.maxLength = MAX_FARM_NAME;
    this.farmName.autocomplete = 'off';
    const pin = el('label', 'ui-field', this.recover);
    el('span', '', pin, 'PIN');
    this.pin = el('input', 'ui-input', pin);
    Object.assign(this.pin, { type: 'password', inputMode: 'numeric', maxLength: PIN_LENGTH, autocomplete: 'off' });
    const recoverRow = el('div', 'ui-row', this.recover);
    button('ui-btn ui-btn-ghost', recoverRow, 'Back', () => this.showPanel('menu'));
    button('ui-btn', recoverRow, 'Get it back', null).type = 'submit';
    this.recover.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.farmName.value.trim();
      const digits = this.pin.value.trim();
      if (!name || !new RegExp(`^\\d{${PIN_LENGTH}}$`).test(digits)) return this.setStatus(`Type the farm's name and its ${PIN_LENGTH}-digit PIN.`, true);
      this.bring(() => this.onRecover(name, digits));
    });

    this.status = el('div', 'ui-status', card);
    el('div', 'ui-help', card, CONTROLS);
    this.hidden = true;
    root.hidden = true;

    // Esc on the travel board: back to the farm
    window.addEventListener('keydown', (e) => {
      if (!this.hidden && this.from === 'home' && e.code === 'Escape') this.goHome();
    });
  }

  // from: 'title' (the page just opened) or 'home' (travelling from the farm).
  // message: why we are here, when it was not the player's choice.
  show({ from = 'title', message = '' } = {}) {
    this.from = from;
    this.hidden = false;
    this.root.hidden = false;
    document.body.classList.toggle('in-menu', from === 'title');
    this.homeBtn.textContent = from === 'title' ? 'Go to my farm' : 'Back to my farm (Esc)';
    this.setStatus(message, !!message);
    const code = linkedCode();
    if (code) this.showInvite(code);
    else this.showPanel('menu');
  }

  hide() {
    this.hidden = true;
    this.root.hidden = true;
    document.body.classList.remove('in-menu');
  }

  showPanel(which) {
    this.invite.hidden = which !== 'invite';
    this.menu.hidden = which !== 'menu';
    this.browse.hidden = which !== 'browse';
    this.create.hidden = which !== 'create';
    this.recover.hidden = which !== 'recover';
  }

  setStatus(text, isError = false) {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
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

  bringFarm() {
    const code = this.pairInput.value.trim();
    if (!code) return this.setStatus('Open the menu (Esc) on your other device and pick “Play on another device” for a code.', true);
    this.bring(() => this.onFarmCode(code));
  }

  // fetchFarm: the farm's way here (it reloads the page, or fails with why)
  async bring(fetchFarm) {
    if (!confirm('Play that farm here? The farm in this browser is put aside.')) return;
    this.setStatus('Fetching your farm…');
    try {
      await fetchFarm();
    } catch (e) {
      this.setStatus(e.message, true);
    }
  }

  async showInvite(code) {
    this.inviteCode = code;
    this.showPanel('invite');
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

  async showBrowse() {
    this.showPanel('browse');
    this.list.textContent = 'Looking for lobbies…';
    try {
      const lobbies = await listLobbies();
      this.list.textContent = '';
      if (!lobbies.length) el('div', 'ui-muted', this.list, 'No public lobbies right now. Open one, or Quick join.');
      for (const l of lobbies.sort((a, b) => b.players - a.players)) {
        const row = el('div', 'ui-game', this.list);
        const info = el('div', 'ui-game-info', row);
        el('b', '', info, l.name);
        const rare = l.rare ? ` · ${l.rare} rare find${l.rare === 1 ? '' : 's'} about` : '';
        el('span', 'ui-muted', info, `${l.players}/${l.max} farmers · island ${l.seed}${rare}`);
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
}
