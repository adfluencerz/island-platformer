// The farms kept on the server, so a farmer can carry on from another device.
// There are no accounts (yet): a farm is known by its id, and a device proves
// it is the farm's by a token of its own, which only that device has. The
// server keeps the tokens' hashes, never the tokens. (Accounts, later, will
// point at a farm id, so the farms stay where they are.)
//
// The first device gets its token when it makes the farm. Another device gets
// one with a pairing code: a device that has the farm asks for a code, and
// the code, typed on the new device, is good once, for PAIR_MS.
//
// A farm can also be given a name and a PIN, to get it back on a device that
// has no token and no other device to pair with (a cleared browser, a lost
// phone). The name is one of a kind on the server (shared/protocol.js
// farmNameKey) and so is no secret; the PIN is, and is kept as a scrypt hash.
// A farm name is guessable, and six digits are only a million, so wrong PINs
// lock that farm's recovery for a while (longer each time), whichever address
// they come from, on top of a limit per address.
//
// The save itself is the page's (src/main.js) and is kept as it is sent. The
// device that opened the farm last holds it: a save from any other is turned
// down, so a tab left open somewhere can't write over what was played since.
//
// One file per farm, data/farms/<id>.json (server/store.js); with no folder
// (GAME_DATA=off) the farms are kept in memory only.
import { randomBytes, createHash, timingSafeEqual, randomInt, scrypt } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Store } from './store.js';
import { MAX_FARM_NAME } from '../shared/constants.js';
import { cleanText, farmNameKey, pinProblem } from '../shared/protocol.js';

export const MAX_SAVE = 64 * 1024; // bytes of JSON (a farm's save is a few KB)
const ID_RE = /^[a-f0-9]{16}$/;
const MAX_DEVICES = 10; // tokens per farm; past this the oldest device is let go
const PAIR_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // (no 0 / O, 1 / I)
const PAIR_LENGTH = 6;
const PAIR_MS = 10 * 60_000;
const PIN_TRIES = 5; // wrong PINs in a row before a farm's recovery locks
const LOCK_MS = 15 * 60_000; // the first lock; each one after lasts twice as long...
const MAX_LOCK_MS = 24 * 3600_000; // ...up to this
const NO_MATCH = "That farm name and PIN don't match.";

const scryptAsync = promisify(scrypt);
const pinHash = async (pin, salt) => (await scryptAsync(pin, Buffer.from(salt, 'hex'), 32)).toString('hex');

const hash = (token) => createHash('sha256').update(token).digest('hex');

// "k7p-4qm " -> "K7P4QM" (or '' for something that can't be a pairing code)
export function normalizePairCode(text) {
  const code = String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === PAIR_LENGTH && [...code].every((c) => PAIR_CHARS.includes(c)) ? code : '';
}

// A few in a row, then one per `every` seconds, per key (an address)
function limiter(burst, every) {
  const seen = new Map(); // key -> { tokens, at }
  return (key) => {
    const now = Date.now();
    if (seen.size > 5000) {
      for (const [k, a] of seen) if (now - a.at > burst * every * 1000) seen.delete(k);
    }
    const a = seen.get(key) ?? { tokens: burst, at: now };
    a.tokens = Math.min(burst, a.tokens + (now - a.at) / 1000 / every);
    a.at = now;
    seen.set(key, a);
    if (a.tokens < 1) return false;
    a.tokens--;
    return true;
  };
}

export class Farms {
  constructor({ dir = null, log = console.log } = {}) {
    this.dir = dir;
    this.log = log;
    this.farms = new Map(); // id -> farm, as read (or made)
    this.pairs = new Map(); // pairing code -> { id, until }
    this.allowCreate = limiter(3, 60);
    this.allowClaim = limiter(5, 10);
    this.allowPut = limiter(5, 1); // per farm (a page saves every 15 s, and when it is left)
    this.allowRecover = limiter(10, 30);
    this.names = new Map(); // farm name key -> farm id
    // (the names are in the farms' own files; the index is gathered when the server starts)
    let files = [];
    try {
      files = dir ? readdirSync(dir).filter((f) => /^[a-f0-9]{16}\.json$/.test(f)) : [];
    } catch {}
    for (const f of files) {
      const farm = this.get(f.slice(0, -5));
      if (farm?.nameKey) this.names.set(farm.nameKey, farm.id);
      this.farms.delete(farm?.id); // (read again when it is wanted)
    }
  }

  store(id) {
    return this.dir ? new Store(join(this.dir, `${id}.json`), { log: this.log }) : null;
  }

  // the farm with this id, or null
  get(id) {
    if (!ID_RE.test(id)) return null;
    if (this.farms.has(id)) return this.farms.get(id);
    const farm = this.store(id)?.load() ?? null;
    if (farm?.id !== id) return null;
    this.farms.set(id, farm);
    return farm;
  }

  write(farm) {
    farm.updatedAt = Date.now();
    const store = this.store(farm.id);
    return store ? store.save(farm) : true;
  }

  // A device's token, for a farm
  newDevice(farm) {
    const token = randomBytes(16).toString('base64url');
    farm.tokens.push(hash(token));
    if (farm.tokens.length > MAX_DEVICES) farm.tokens.splice(0, farm.tokens.length - MAX_DEVICES);
    return token;
  }

  // "Bearer <id>.<token>" -> the farm, or null
  auth(header) {
    const m = /^Bearer ([a-f0-9]{16})\.([A-Za-z0-9_-]{10,64})$/.exec(header ?? '');
    const farm = m && this.get(m[1]);
    if (!farm) return null;
    const mine = Buffer.from(hash(m[2]), 'hex');
    return farm.tokens.some((t) => timingSafeEqual(Buffer.from(t, 'hex'), mine)) ? farm : null;
  }

  // ---------- What the API does (server/index.js) ----------
  // A new farm, from the save the page has (a farm played before there was a
  // server copy comes along). session: the page that holds it now.
  create(save, session, address) {
    if (!validSave(save)) return { error: 'That is not a farm save.', status: 400 };
    if (address && !this.allowCreate(address)) return { error: 'Too many new farms from here. Try again in a minute.', status: 429 };
    let id;
    do id = randomBytes(8).toString('hex');
    while (this.get(id));
    const farm = { id, tokens: [], rev: 1, holder: session, createdAt: Date.now(), updatedAt: 0, save };
    const token = this.newDevice(farm);
    if (!this.write(farm)) return { error: 'The server could not keep your farm.', status: 500 };
    this.farms.set(id, farm);
    this.log(`farm ${id} made`);
    return { id, token, rev: farm.rev };
  }

  // A page opens the farm: it holds it from now on
  open(farm, session) {
    farm.holder = session;
    this.write(farm);
    return { save: farm.save, rev: farm.rev, name: farm.name ?? '' };
  }

  put(farm, session, save) {
    if (farm.holder !== session) return { error: 'Your farm is open on another device.', status: 409 };
    if (!validSave(save)) return { error: 'That is not a farm save.', status: 400 };
    if (!this.allowPut(farm.id)) return { error: 'Saving too often.', status: 429 };
    farm.save = save;
    farm.rev++;
    if (!this.write(farm)) return { error: 'The server could not keep your farm.', status: 500 };
    return { rev: farm.rev };
  }

  // A pairing code for another device (a new one undoes the last)
  pair(farm) {
    const now = Date.now();
    for (const [code, p] of this.pairs) if (p.id === farm.id || now > p.until) this.pairs.delete(code);
    let code;
    do {
      code = '';
      for (let i = 0; i < PAIR_LENGTH; i++) code += PAIR_CHARS[randomInt(PAIR_CHARS.length)];
    } while (this.pairs.has(code));
    this.pairs.set(code, { id: farm.id, until: now + PAIR_MS });
    return { code, expiresIn: PAIR_MS / 1000 };
  }

  // A pairing code typed on the new device: a token of its own for the farm
  claim(text, address) {
    if (address && !this.allowClaim(address)) return { error: 'Too many tries. Wait a little and try again.', status: 429 };
    const code = normalizePairCode(text);
    const p = code && this.pairs.get(code);
    const farm = p && Date.now() <= p.until && this.get(p.id);
    if (!farm) return { error: 'That code does not work (any more). Ask your other device for a new one.', status: 404 };
    this.pairs.delete(code);
    const token = this.newDevice(farm);
    if (!this.write(farm)) return { error: 'The server could not keep your farm.', status: 500 };
    this.log(`farm ${farm.id}: a device was paired (${farm.tokens.length} now)`);
    return { id: farm.id, token };
  }

  // ---------- Getting a farm back by its name and PIN ----------
  // Name the farm and set its PIN (pin '': keep the PIN it has)
  async setRecovery(farm, { name, pin } = {}) {
    name = cleanText(name, MAX_FARM_NAME);
    const key = farmNameKey(name);
    if (!key) return { error: 'A farm name needs at least 3 letters or digits.', status: 400 };
    const newPin = !!pin || !farm.pin;
    const problem = newPin && pinProblem(pin);
    if (problem) return { error: problem, status: 400 };
    const salt = randomBytes(16).toString('hex');
    const hashed = newPin && (await pinHash(String(pin), salt));
    // (from here on nothing waits, so two farms can't both take a name)
    const other = this.names.get(key);
    if (other && other !== farm.id && this.get(other)?.nameKey === key) return { error: 'That farm name is taken. Try another.', status: 409 };
    if (newPin) Object.assign(farm, { salt, pin: hashed, pinFails: 0, pinLocks: 0, lockedUntil: 0 });
    if (farm.nameKey && farm.nameKey !== key) this.names.delete(farm.nameKey);
    Object.assign(farm, { name, nameKey: key });
    this.names.set(key, farm.id);
    if (!this.write(farm)) return { error: 'The server could not keep your farm.', status: 500 };
    return { name };
  }

  // A device with neither token nor pairing code: a token of its own, given
  // the farm's name and PIN
  async recover({ name, pin } = {}, address) {
    if (address && !this.allowRecover(address)) return { error: 'Too many tries. Wait a little and try again.', status: 429 };
    const key = farmNameKey(name);
    const id = key && this.names.get(key);
    const farm = id && this.get(id);
    if (!farm?.pin || farm.nameKey !== key || pinProblem(pin)) return { error: NO_MATCH, status: 403 };
    const now = Date.now();
    if (now < (farm.lockedUntil ?? 0)) {
      const minutes = Math.ceil((farm.lockedUntil - now) / 60_000);
      return { error: `Too many wrong PINs for this farm. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, status: 429 };
    }
    // Every try counts as a wrong one until the PIN is seen to match, so tries
    // sent all at once can't slip in while the first are still being checked
    farm.pinFails = (farm.pinFails ?? 0) + 1;
    if (farm.pinFails % PIN_TRIES === 0) {
      farm.pinLocks = (farm.pinLocks ?? 0) + 1;
      farm.lockedUntil = now + Math.min(MAX_LOCK_MS, LOCK_MS * 2 ** (farm.pinLocks - 1));
    }
    const tried = Buffer.from(await pinHash(String(pin), farm.salt), 'hex');
    if (!timingSafeEqual(tried, Buffer.from(farm.pin, 'hex'))) {
      if (farm.pinFails % PIN_TRIES === 0) this.log(`farm ${farm.id}: recovery locked after ${farm.pinFails} wrong PINs`);
      this.write(farm);
      return { error: NO_MATCH, status: 403 };
    }
    Object.assign(farm, { pinFails: 0, pinLocks: 0, lockedUntil: 0 });
    const token = this.newDevice(farm);
    if (!this.write(farm)) return { error: 'The server could not keep your farm.', status: 500 };
    this.log(`farm ${farm.id}: got back with its name and PIN (${farm.tokens.length} devices)`);
    return { id: farm.id, token, name: farm.name };
  }
}

// What the page saves (src/main.js): { v, farm, backpack }. The server goes no
// further than the shape; what is in it is the page's business.
const validSave = (save) => !!save && typeof save === 'object' && !Array.isArray(save) && Number.isInteger(save.v) && save.v >= 1;
