// The farmers who join this browser's at a split screen (src/main.js seats),
// each playing a farmer of their own. Theirs is an account's (their farm on
// the game server: logging in gives this browser a token of its own for it,
// as it would another device, kept here beside this browser's own farm), or
// a guest's, kept in this browser only. They play on this browser's farm:
// their own farm stays where it is, and only what they carry (the backpack,
// skills and the rest: src/main.js character) is played here and saved back.
//
// An account's save goes to the server as their page's would, with the farm
// left as the server has it (roomRev -1: server/farms.js keeps its own then).
// While they play here this page holds their farm, so a tab of theirs open
// elsewhere is told it is open on another device (and stops saving), as when
// they log in somewhere else: what they carry is in one place at a time.
//
// Remembered here (tp.players), to pick at the next split screen without
// logging in again: [{ id, kind: 'account' | 'guest', name, color, look, farm }]
// (look: what they wear, shared/looks.js; farm: an account's { id, token });
// a guest's save is tp.player.<id>.
import { call, NO_SERVER } from './farm.js';
import { randomLook } from '../../shared/looks.js';

const STORE = 'tp.players';
const GUEST_STORE = (id) => `tp.player.${id}`;
const PUSH_EVERY = 15_000;
const MOST = 12; // remembered at once (the last used first)

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(STORE));
    return Array.isArray(list) ? list.filter((p) => p?.id && p.name && (p.kind === 'guest' || p.farm?.token)) : [];
  } catch {
    return [];
  }
}

function keep(list) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.slice(0, MOST)));
  } catch {}
}

// The farmers remembered here, the last played first
export const remembered = () => load();

// Remember (or bring to the top) a farmer
function remember(profile) {
  keep([profile, ...load().filter((p) => p.id !== profile.id)]);
}

// Forget one (an account's token goes from this browser; a guest's save too)
export function forget(id) {
  const gone = load().find((p) => p.id === id);
  keep(load().filter((p) => p.id !== id));
  if (gone?.kind === 'guest') {
    try {
      localStorage.removeItem(GUEST_STORE(id));
    } catch {}
  }
}

// Log in to an account: its farmer, remembered here. Throws with why not.
export async function logIn(username, password) {
  const out = await call('POST', '/api/account/login', { body: { username, password } }).catch((e) => {
    throw e.status ? e : new Error(NO_SERVER);
  });
  const profile = { id: out.id, kind: 'account', name: out.username, color: out.color, look: out.look, farm: { id: out.id, token: out.token } };
  remember(profile);
  return profile;
}

// A new guest: a farmer of this browser's own, starting out (in clothes of their own)
export function newGuest(name, color) {
  const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const profile = { id, kind: 'guest', name, color, look: randomLook() };
  remember(profile);
  return profile;
}

// A farmer's save, while they play here: open() it (their save, or null: a
// new guest), push() each new one, flush() to send it now (leaving: the page
// is going). onLost(why): it can't be saved any more (their farm was opened
// on another device since, or the account is gone).
export class PlayerSync {
  constructor(profile, { onLost = () => {} } = {}) {
    this.profile = profile;
    this.onLost = onLost;
    this.pending = null;
    this.ready = false;
    this.timer = 0;
  }

  async open() {
    const { profile } = this;
    remember(profile);
    if (profile.kind === 'guest') {
      this.ready = true;
      try {
        return JSON.parse(localStorage.getItem(GUEST_STORE(profile.id)));
      } catch {
        return null;
      }
    }
    try {
      const out = await call('POST', '/api/farms/me/open', { farm: profile.farm });
      // (their account's name and clothes, as the server has them now)
      Object.assign(profile, { name: out.username ?? profile.name, color: out.color ?? profile.color, look: out.look ?? profile.look });
      remember(profile);
      this.ready = true;
      this.timer = setInterval(() => this.flush(), PUSH_EVERY);
      return out.save ?? null;
    } catch (e) {
      if (e.status === 401) {
        forget(profile.id);
        throw new Error(`${profile.name} has to log in again on this device.`);
      }
      throw e.status ? e : new Error(NO_SERVER);
    }
  }

  // The latest save (a guest's is kept at once)
  push(save) {
    if (!this.ready) return;
    if (this.profile.kind === 'guest') {
      try {
        localStorage.setItem(GUEST_STORE(this.profile.id), JSON.stringify(save));
      } catch {}
      return;
    }
    this.pending = save;
  }

  async flush({ leaving = false } = {}) {
    if (!this.ready || !this.pending) return;
    const save = this.pending;
    this.pending = null;
    try {
      // (roomRev -1: their farm stays as the server has it, server/farms.js)
      await call('PUT', '/api/farms/me', { body: { save, roomRev: -1 }, farm: this.profile.farm, leaving });
    } catch (e) {
      if (e.status === 409 || e.status === 401) {
        this.ready = false;
        clearInterval(this.timer);
        this.onLost(e.status === 409 ? `${this.profile.name}'s farmer was opened on another device: what they do here isn't saved any more.` : `${this.profile.name} has to log in again: what they do here isn't saved.`);
      } else {
        this.pending ??= save; // (try again next time)
      }
    }
  }

  // They get up from the screen: saved one last time (save: none, if they
  // never got as far as playing), and no more
  async close(save = null) {
    if (save) this.push(save);
    clearInterval(this.timer);
    await this.flush({ leaving: true });
    this.ready = false;
  }
}
