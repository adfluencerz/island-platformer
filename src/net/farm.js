// The farm's copy on the game server (server/farms.js), so a farmer can carry
// on from another device. The page plays from its own copy in localStorage
// (src/main.js) and sends it along every PUSH_EVERY and when it is left; the
// server's copy is the one a page starts from.
//
// This browser's farm is { id, token, rev, name } in localStorage (tp.farm): rev is
// the server's revision of the farm this browser last saw. At start the page
// opens the farm, and holds it from then on:
// - no farm on the server yet: one is made from the save this browser has
//   (so a farm played before there was a server copy comes along)
// - the server is at the rev we last saw: ours is as new or newer; it is sent
// - another rev: another device has played since; the page starts from that
// A page that no longer holds the farm (it was opened somewhere else since) is
// told by onTakenOver and stops sending.
//
// Another device gets the farm with a pairing code from one that has it, or,
// with no device left to ask, with the farm's name and PIN (set in the menu).
//
// Without the game server (npm run dev:client) the farm just stays in this browser.

const FARM_STORE = 'tp.farm';
const PUSH_EVERY = 15_000;
const NO_SERVER = 'Could not reach the game server.';

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

async function call(method, path, { body = {}, farm = null, leaving = false } = {}) {
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
  // onTakenOver(): the farm was opened on another device since; this page's saves no longer count
  constructor({ onTakenOver }) {
    this.onTakenOver = onTakenOver;
    this.farm = stored();
    this.ready = false; // the farm is open on the server, and this page holds it
    this.pending = null; // the latest save, not sent yet
    this.sending = false;
    setInterval(() => this.flush(), PUSH_EVERY);
  }

  // At start, with the save this browser has. Resolves to the server's save
  // when that is the one to play (another device has played since), else null.
  async open(local) {
    try {
      if (this.farm) {
        try {
          const { save, rev, name } = await call('POST', '/api/farms/me/open', { farm: this.farm });
          const elsewhere = rev !== this.farm.rev;
          Object.assign(this.farm, { rev, name });
          keep(this.farm);
          this.ready = true;
          if (elsewhere) {
            this.pending = null; // (what this page saved before now is the older farm)
            return save;
          }
          this.pending ??= local;
          this.flush();
          return null;
        } catch (e) {
          if (e.status !== 401) throw e;
          // the server doesn't know this farm (it was started over): make it again from ours
        }
      }
      const { id, token, rev } = await call('POST', '/api/farms', { body: { save: local } });
      this.farm = { id, token, rev, name: '' };
      keep(this.farm);
      this.ready = true;
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
      const { rev } = await call('PUT', '/api/farms/me', { body: { save }, farm: this.farm, leaving });
      this.farm.rev = rev;
      keep(this.farm);
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
    this.farm = { id: got.id, token: got.token, rev: null, name: got.name ?? '' };
    keep(this.farm);
  }
}
