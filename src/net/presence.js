// This page online, for its friends (server/presence.js): one more socket,
// kept open wherever the page is (at home, in a lobby, on a farm), so a friend
// can invite it to a lobby any time. Only for a farm with an account; it
// comes back by itself after a drop.
import { PROTOCOL_VERSION } from '../../shared/constants.js';
import { PC } from '../../shared/protocol.js';

const RETRY = [1000, 3000, 6000, 15000, 30000]; // ms before each try again (the last one over and over)

export class PresenceLink {
  // auth(): "<farm id>.<token>" of an account's farm, or null. onMessage(msg): what the server says.
  constructor({ auth, onMessage }) {
    this.auth = auth;
    this.onMessage = onMessage;
    this.ws = null;
    this.place = 'home';
    this.tries = 0;
    this.timer = 0;
    this.stopped = true;
    this.ready = false;
  }

  // (again, once logged in: harmless if it is on already)
  start() {
    if (!this.stopped || !this.auth()) return;
    this.stopped = false;
    this.connect();
  }

  connect() {
    const auth = this.auth();
    if (this.stopped || !auth) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = (this.ws = new WebSocket(`${proto}//${location.host}/ws?presence`));
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: PC.HELLO, v: PROTOCOL_VERSION, auth }));
      ws.send(JSON.stringify({ t: PC.WHERE, place: this.place }));
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.tries = 0;
      this.ready = true;
      this.onMessage(msg);
    };
    ws.onclose = (e) => {
      if (ws !== this.ws) return;
      this.ready = false;
      if (this.stopped || e.code >= 4000) return; // (a newer server, or no account: no use trying again)
      this.timer = setTimeout(() => this.connect(), RETRY[Math.min(this.tries++, RETRY.length - 1)]);
    };
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // 'home', 'lobby' or 'farm'
  where(place) {
    if (place === this.place) return;
    this.place = place;
    this.send({ t: PC.WHERE, place });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.ws?.close(1000);
    this.ws = null;
  }
}
