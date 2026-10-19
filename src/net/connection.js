// The page's line to the lobby it is visiting: a WebSocket to its Room on the
// game server. Game code sees the messages of shared/protocol.js through
// on()/send(). (The home farm needs no connection: it is all in the page.)
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
  // code: the lobby to join ('' quick joins)
  constructor({ name, code = '' }) {
    this.name = name;
    this.code = code;
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
    const query = this.code ? `?lobby=${encodeURIComponent(this.code)}` : '';
    const ws = (this.ws = new WebSocket(`${proto}//${location.host}/ws${query}`));
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: C.JOIN, v: PROTOCOL_VERSION, name: this.name, key: browserKey(), back: this.welcomed }));
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (this.left) return;
      if (msg.t === S.WELCOME) {
        this.welcomed = true;
        this.code = msg.code;
        this.retries = 0;
      }
      this.emit(msg.t, msg);
    };
    ws.onclose = (e) => {
      if (this.left || ws !== this.ws) return;
      if (e.code >= 4000) return this.end(CLOSE_TEXT[e.code] || e.reason || 'Disconnected.');
      if (this.welcomed && this.retries < RETRIES) {
        this.emit('reconnecting', ++this.retries);
        setTimeout(() => !this.left && this.connect(), 600 * this.retries);
        return;
      }
      this.end(this.welcomed ? 'Lost the connection to the lobby.' : 'Could not reach the game server. Is it running (npm run dev)?');
    };
  }

  send(msg) {
    if (!this.left && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
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
