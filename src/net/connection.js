// The page's line to the online place it is in: a WebSocket to a lobby's Room
// on the game server, or to a farm with helpers (server/farmroom.js). Game
// code sees the messages of shared/protocol.js through on()/send(). (A farm
// nobody helps on needs no connection: it is all in the page.)
//
// A socket that drops after joining reconnects by itself, a few times, saying it
// is coming back (JOIN.back): the room has held the seat, so the player picks
// up where they were. A reload does the same through the ?lobby= link and the
// browser key.
import { PROTOCOL_VERSION, CLOSE_TEXT } from '../../shared/constants.js';
import { C, S } from '../../shared/protocol.js';

const KEY_STORE = 'tp.key';
const RETRIES = 5;
const PING_EVERY = 2000;

// who this browser is to a lobby: the same in every tab, kept across reloads
let pageKey = '';
function browserKey() {
  if (pageKey) return pageKey;
  const fresh = () => (crypto.randomUUID?.() ?? `${Math.random()}`.slice(2) + Date.now().toString(36));
  try {
    pageKey = localStorage.getItem(KEY_STORE) || fresh();
    localStorage.setItem(KEY_STORE, pageKey);
  } catch {
    pageKey = fresh();
  }
  return pageKey;
}

export class Connection {
  // code: the lobby to join ('' quick joins). Or farm: the farm to be on.
  // auth: "<id>.<token>" of this browser's own farm (src/net/farm.js): who we are
  // color: our shirt's; look: what else we wear (shared/looks.js)
  constructor({ name, color, look = null, code = '', farm = null, auth = null }) {
    this.name = name;
    this.color = color;
    this.look = look;
    this.code = code;
    this.farm = farm;
    this.auth = auth;
    this.handlers = new Map();
    this.welcomed = false;
    this.left = false;
    this.retries = 0;
    this.ping = 0; // round trip in ms
    this.ws = null;
    this.connect();
    this.pingTimer = setInterval(() => this.send({ t: C.PING, c: performance.now() }), PING_EVERY);
    this.on(S.PONG, ({ c }) => {
      this.ping = Math.round(performance.now() - c);
      this.emit('ping', this.ping);
    });
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
    return this;
  }

  emit(type, msg) {
    for (const fn of this.handlers.get(type) ?? []) fn(msg);
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = this.farm ? `?farm=${encodeURIComponent(this.farm)}` : this.code ? `?lobby=${encodeURIComponent(this.code)}` : '';
    const ws = (this.ws = new WebSocket(`${proto}//${location.host}/ws${query}`));
    ws.onopen = () => {
      const join = { t: C.JOIN, v: PROTOCOL_VERSION, name: this.name, color: this.color, look: this.look, key: browserKey(), back: this.welcomed };
      if (this.auth) join.auth = this.auth;
      ws.send(JSON.stringify(join));
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (this.left) return;
      if (msg.t === S.WELCOME || msg.t === S.FARM) {
        this.welcomed = true;
        if (msg.code) this.code = msg.code;
        this.retries = 0;
      }
      this.emit(msg.t, msg);
    };
    ws.onclose = (e) => {
      if (this.left || ws !== this.ws) return;
      if (e.code >= 4000) return this.end((this.farm && e.reason) || CLOSE_TEXT[e.code] || e.reason || 'Disconnected.');
      if (this.welcomed && this.retries < RETRIES) {
        this.emit('reconnecting', ++this.retries);
        setTimeout(() => !this.left && this.connect(), 600 * this.retries);
        return;
      }
      const where = this.farm ? 'the farm' : 'the lobby';
      this.end(this.welcomed ? `Lost the connection to ${where}.` : 'Could not reach the game server. Is it running (npm run dev)?');
    };
  }

  send(msg) {
    if (!this.left && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // We changed clothes: everyone here sees them (and a reconnect comes back in them)
  dress(color, look) {
    this.color = color;
    this.look = look;
    this.send({ t: C.DRESS, color, look });
  }

  // the visit is over against the player's will: the lobby closed, or we could not get back in
  end(reason) {
    if (this.left) return;
    this.shutdown();
    this.emit('closed', { reason });
  }

  // the player headed home
  leave() {
    if (this.left) return;
    this.ws?.close(1000);
    this.shutdown();
  }

  shutdown() {
    this.left = true;
    clearInterval(this.pingTimer);
  }
}
