// The farm's copy on the game server (server/farms.js), so a farmer can carry
// on from another device. The page plays from its own copy in localStorage
// (src/main.js) and sends it along every PUSH_EVERY and when it is left; the
// server's copy is the one a page starts from.
//
// This browser's farm is { id, token, rev, name, username, color, look } in
// localStorage (tp.farm): rev is the server's revision of the farm this
// browser last saw; username, color and look (what the farmer wears,
// shared/looks.js), its account's (none: no account yet).
// A browser gets its farm by making an account (register: on a new farm made
// from the save this browser has, so a farm played before comes along) or by
// logging in (login: the account's farm, which the page then reloads to play).
// At start the page opens the farm, and holds it from then on:
// - the server is at the rev we last saw: ours is as new or newer; it is sent
// - another rev: another device has played since; the page starts from that
// A page that no longer holds the farm (it was opened somewhere else since) is
// told by onTakenOver and stops sending.
//
// Another device gets the farm with a pairing code from one that has it, or,
// with no device left to ask, with the farm's name and PIN (set in the menu).
//
// A farm can have helpers (friends who farm on it, server/farms.js): it is
// then played through its room on the server whenever the server is there
// (src/main.js joinFarm), and the room keeps the farm's copy up to date. This
// page's saves then only carry the backpack, unless the page played the farm
// alone (offline) and nobody changed it on the server since: roomRev is how
// many times the room had written the farm when this page last had it, and -1
// once the page has handed the farm to the room and doesn't know any more.
// The server keeps the farm it has when the two don't match.
//
// Without the game server (npm run dev:client) the farm just stays in this browser.
import { cleanLook } from '../../shared/looks.js';

const FARM_STORE = 'tp.farm';
const PUSH_EVERY = 15_000;
export const NO_SERVER = 'Could not reach the game server.';

// this page, to the server: who holds the farm
const session = crypto.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

function stored() {
  try {
    const farm = JSON.parse(localStorage.getItem(FARM_STORE));
    return farm?.id && farm.token ? farm : null;
  } catch {
    return null;
  }
}

function keep(farm) {
  try {
    localStorage.setItem(FARM_STORE, JSON.stringify(farm));
  } catch {}
}

// (and src/net/players.js's: a farmer who joined at a split screen)
export async function call(method, path, { body = {}, farm = null, leaving = false } = {}) {
  const headers = { 'content-type': 'application/json', 'x-farm-session': session };
  if (farm) headers.authorization = `Bearer ${farm.id}.${farm.token}`;
  // (keepalive: the page may be gone before the answer comes)
  const res = await fetch(path, { method, headers, body: JSON.stringify(body), keepalive: leaving, signal: leaving ? undefined : AbortSignal.timeout(8000) });
  // (a page served without the game server behind it answers /api with itself)
  if (!res.headers.get('content-type')?.startsWith('application/json')) throw new Error(NO_SERVER);
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `HTTP ${res.status}`), { status: res.status });
  return out;
}

export class FarmSync {
  // onTakenOver(): the farm was opened on another device since; this page's saves no longer count.
  // onShared(): the farm has helpers now (it was played alone until then)
  constructor({ onTakenOver, onShared }) {
    this.onTakenOver = onTakenOver;
    this.onShared = onShared;
    this.farm = stored();
    this.ready = false; // the farm is open on the server, and this page holds it
    this.pending = null; // the latest save, not sent yet
    this.sending = false;
    setInterval(() => this.flush(), PUSH_EVERY);
  }

  // At start, with the save this browser has. Resolves to the server's save
  // when that is the one to play (another device has played since; or, with
  // this backpack, its helpers have changed the farm since), else null.
  async open(local) {
    try {
      if (this.farm) {
        try {
          const { save, rev, roomRev = 0, helpers = 0, name, username = null, color = null, look = null } = await call('POST', '/api/farms/me/open', { farm: this.farm });
          const elsewhere = rev !== this.farm.rev;
          const tended = roomRev !== (this.farm.roomRev ?? 0);
          Object.assign(this.farm, { rev, roomRev, helpers, name, username, color, look });
          keep(this.farm);
          this.ready = true;
          if (elsewhere || tended) {
            this.pending = null; // (what this page saved before now is the older farm)
            return elsewhere ? save : { ...local, farm: save.farm };
          }
          this.pending ??= local;
          this.flush();
          return null;
        } catch (e) {
          if (e.status !== 401) throw e;
          // the server doesn't know this farm (it was started over): log in or make an account again
          this.forget();
        }
      }
    } catch {
      // no server: the farm stays in this browser for now
    }
    return null;
  }

  // The latest save, sent with the next flush
  push(save) {
    this.pending = save;
  }

  // leaving: the page is going away (send it now, and don't wait for the answer)
  async flush({ leaving = false } = {}) {
    if (!this.ready || !this.pending || (this.sending && !leaving)) return;
    const save = this.pending;
    this.pending = null;
    this.sending = true;
    try {
      const { rev, helpers = 0 } = await call('PUT', '/api/farms/me', { body: { save, roomRev: this.farm.roomRev ?? 0 }, farm: this.farm, leaving });
      const shared = helpers > 0 && !this.shared();
      Object.assign(this.farm, { rev, helpers });
      keep(this.farm);
      if (shared) this.onShared?.();
    } catch (e) {
      if (e.status === 409 || e.status === 401) {
        this.ready = false;
        this.onTakenOver();
      } else {
        this.pending ??= save; // (try again next time)
      }
    } finally {
      this.sending = false;
    }
  }

  // ---------- The account ----------
  // { username, color, look }, or null with none (or no farm on the server yet)
  account() {
    return this.farm?.username ? { username: this.farm.username, color: this.farm.color, look: cleanLook(this.farm.look) } : null;
  }

  // Make an account: on this browser's farm, or on a new one made from local (the save)
  async register(username, password, color, local) {
    const farm = this.ready ? this.farm : null;
    const out = await call('POST', '/api/account/register', { body: { username, password, color, save: local }, farm }).catch((e) => {
      throw e.status ? e : new Error(NO_SERVER);
    });
    if (out.token) {
      this.farm = { id: out.id, token: out.token, rev: out.rev, roomRev: 0, helpers: 0, name: '' };
      this.ready = true;
    }
    Object.assign(this.farm, { username: out.username, color: out.color, look: out.look });
    keep(this.farm);
    return this.account();
  }

  // Log in: this browser plays the account's farm from now on (the page reloads to open it)
  async login(username, password) {
    await this.adopt(call('POST', '/api/account/login', { body: { username, password } }));
  }

  // New clothes (and the shirt's color with them)
  async setLook(look, color) {
    const out = await this.me('/api/account/look', { look, color }, 'PUT');
    Object.assign(this.farm, { color: out.color, look: out.look });
    keep(this.farm);
    return this.account();
  }

  // Log out: this browser forgets the farm (its save goes too: src/main.js)
  forget() {
    this.ready = false;
    this.pending = null;
    this.farm = null;
    try {
      localStorage.removeItem(FARM_STORE);
    } catch {}
  }

  // A pairing code for another device: { code, expiresIn }
  pairCode() {
    if (!this.ready) return Promise.reject(new Error(`${NO_SERVER} Your farm is only in this browser for now.`));
    return call('POST', '/api/farms/me/pair', { farm: this.farm }).catch((e) => {
      throw e.status ? e : new Error(NO_SERVER);
    });
  }

  // The farm's name ('' for none yet)
  name() {
    return this.farm?.name ?? '';
  }

  // ---------- Helpers ----------
  // This browser's farm: its id, and "<id>.<token>" to show it is ours (on
  // our farm, or one we help on)
  id() {
    return this.farm?.id ?? null;
  }

  auth() {
    return this.farm ? `${this.farm.id}.${this.farm.token}` : null;
  }

  // Does the farm have helpers? (it is played through the server then)
  shared() {
    return (this.farm?.helpers ?? 0) > 0;
  }

  // The farm went to its room on the server: what this page has of it is
  // not the latest any more (see roomRev above)
  handedToRoom() {
    if (!this.farm) return;
    this.farm.roomRev = -1;
    keep(this.farm);
  }

  // An invite code for a helper: { code, expiresIn }. name: ours, for the farm's name till it has one
  inviteHelper(name) {
    return this.me('/api/farms/me/helpers/invite', { name });
  }

  // [{ id, name, since }]
  async helpers() {
    const { helpers } = await this.me('/api/farms/me/helpers');
    this.farm.helpers = helpers.length;
    keep(this.farm);
    return helpers;
  }

  async removeHelper(id) {
    const { helpers } = await this.me('/api/farms/me/helpers/remove', { id });
    this.farm.helpers = helpers.length;
    keep(this.farm);
    return helpers;
  }

  // The farm an invitation (its code) is for: { id, name }
  invited(code) {
    return call('POST', '/api/farms/invite', { body: { code } }).catch((e) => {
      throw e.status ? e : new Error(NO_SERVER);
    });
  }

  // Say yes to an invitation: we are one of that farm's helpers now. { id, name }
  help(code, name) {
    return this.me('/api/farms/me/help', { code, name });
  }

  // The farms we help on: [{ id, name, here }]
  async helping() {
    return (await this.me('/api/farms/me/helping')).farms;
  }

  // Friends (an account's): { friends: [{ id, name, color, online, where }], asks: [{ id, name }] }
  friends() {
    return this.me('/api/friends');
  }

  // Ask the farmer with this username to be friends: { name, friends } (friends: they had asked us, so now we are)
  addFriend(username) {
    return this.me('/api/friends/add', { username });
  }

  answerFriend(id, yes) {
    return this.me('/api/friends/answer', { id, yes });
  }

  removeFriend(id) {
    return this.me('/api/friends/remove', { id });
  }

  // A call about this browser's farm (it needs one on the server)
  me(path, body = {}, method = 'POST') {
    if (!this.ready) return Promise.reject(new Error(`${NO_SERVER} Your farm is only in this browser for now.`));
    return call(method, path, { body, farm: this.farm }).catch((e) => {
      throw e.status ? e : new Error(NO_SERVER);
    });
  }

  // Name the farm and set its PIN, to get it back without another device
  // (pin '': keep the one it has). Resolves to the name as the server keeps it.
  async setRecovery(name, pin) {
    if (!this.ready) throw new Error(`${NO_SERVER} Your farm is only in this browser for now.`);
    const out = await call('PUT', '/api/farms/me/recovery', { body: { name, pin }, farm: this.farm }).catch((e) => {
      throw e.status ? e : new Error(NO_SERVER);
    });
    this.farm.name = out.name;
    keep(this.farm);
    return out.name;
  }

  // A pairing code from another device: this browser plays that farm from now
  // on (the page reloads to open it)
  claim(code) {
    return this.adopt(call('POST', '/api/farms/pair', { body: { code } }));
  }

  // The same, with the farm's name and PIN
  recover(name, pin) {
    return this.adopt(call('POST', '/api/farms/recover', { body: { name, pin } }));
  }

  async adopt(asked) {
    let got;
    try {
      got = await asked;
    } catch (e) {
      throw e.status ? e : new Error(NO_SERVER);
    }
    this.ready = false;
    this.pending = null;
    this.farm = { id: got.id, token: got.token, rev: null, name: got.name ?? '', username: got.username, color: got.color, look: got.look };
    keep(this.farm);
  }
}
