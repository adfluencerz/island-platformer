// ---------- Trading, in a lobby ----------
// Two farmers swap things out of their backpacks, and gold. One asks
// (TRADE_ASK, standing near the other), and the other hears it (TRADE_ASKED);
// when they ask back, the trade is open. Each puts up what they will give
// (TRADE_OFFER), and both see both offers (TRADE); changing an offer takes
// back both "ready"s. Once both are ready with the offers as they last saw
// them (TRADE_READY, with the trade's `v`), it's done: each page hears what it
// gives and what it gets (TRADE_DONE) and swaps them over in its backpack.
// The pages keep the backpacks, as they do for THROW. Walking off, going
// away, a party game or TRADE_CANCEL ends it (TRADE_END).
import { C, S } from './protocol.js';
import { SHOP } from './balance.js';

export const TRADE = {
  reach: 5, // m: how near to ask
  far: 9, // m: walking further off than this from each other ends it
  kinds: 8, // different things in one offer
  most: 999, // of one thing
  gold: 1_000_000,
  askEvery: 800, // ms: the fewest between one farmer's asks
  askFor: 30_000, // ms: an ask stands this long
};

// What can be traded: what can be dropped (anything with a price), not coins
export const tradeable = (item) => typeof item === 'string' && Object.hasOwn(SHOP, item) && item !== 'coin';

// An offer as it came: { items: { item: count }, gold }, or null when it isn't one
export function cleanOffer(msg) {
  const given = msg?.items && typeof msg.items === 'object' && !Array.isArray(msg.items) ? Object.entries(msg.items) : [];
  const gold = msg?.gold ?? 0;
  if (given.length > TRADE.kinds || !Number.isInteger(gold) || gold < 0 || gold > TRADE.gold) return null;
  const items = {};
  for (const [item, n] of given) {
    if (!tradeable(item) || !Number.isInteger(n) || n < 1 || n > TRADE.most) return null;
    items[item] = n;
  }
  return { items, gold };
}

const empty = () => ({ items: {}, gold: 0 });

export class Trades {
  // place: the lobby (shared/room.js): its players, send()
  constructor(place) {
    this.place = place;
    this.asks = new Map(); // player id -> { to, at }: who they asked, when
    this.open = new Map(); // player id -> their trade: { ids, offers, ready (by id), v }
  }

  act(p, msg) {
    const t = this.open.get(p.id);
    switch (msg.t) {
      case C.TRADE_ASK:
        return this.ask(p, this.place.players.get(msg.id));
      case C.TRADE_OFFER: {
        const offer = cleanOffer(msg);
        if (!t || !offer) return;
        t.offers[p.id] = offer;
        t.seen[p.id] = Number.isInteger(msg.n) ? msg.n : 0; // (the page's count of its offers: it knows which TRADE has its last)
        for (const id of t.ids) t.ready[id] = false;
        t.v++;
        return this.show(t);
      }
      case C.TRADE_READY: {
        if (!t || msg.v !== t.v) return; // (they were ready with offers that have changed since)
        t.ready[p.id] = !!msg.ready;
        return t.ids.every((id) => t.ready[id]) ? this.done(t) : this.show(t);
      }
      case C.TRADE_CANCEL:
        this.asks.delete(p.id);
        return this.end(p.id, 'cancelled', p.id);
    }
  }

  ask(p, q) {
    const now = Date.now();
    const said = (text) => this.place.send(p, { t: S.CHAT, from: 0, text });
    if (!q || q === p || this.open.has(p.id) || p.game || now - (this.asks.get(p.id)?.at ?? 0) < TRADE.askEvery) return;
    if (!q.conn || this.open.has(q.id) || q.game) return said(`${q.name} can't trade right now.`);
    if (!near(p, q, TRADE.reach)) return said(`Walk up to ${q.name} to trade.`);
    const theirs = this.asks.get(q.id);
    if (theirs?.to === p.id && now - theirs.at < TRADE.askFor) {
      // (they asked us: it's on)
      this.asks.delete(p.id);
      this.asks.delete(q.id);
      const t = { ids: [q.id, p.id], offers: { [q.id]: empty(), [p.id]: empty() }, ready: { [q.id]: false, [p.id]: false }, seen: { [q.id]: 0, [p.id]: 0 }, v: 1 };
      this.open.set(q.id, t);
      this.open.set(p.id, t);
      return this.show(t);
    }
    this.asks.set(p.id, { to: q.id, at: now });
    this.place.send(q, { t: S.TRADE_ASKED, from: p.id, name: p.name });
    said(`You asked ${q.name} to trade.`);
  }

  // Both hear how it stands
  show(t) {
    for (const [me, them] of [t.ids, [...t.ids].reverse()]) {
      const p = this.place.players.get(me);
      if (p) this.place.send(p, { t: S.TRADE, with: them, v: t.v, n: t.seen[me], mine: t.offers[me], theirs: t.offers[them], ready: t.ready[me], theirsReady: t.ready[them] });
    }
  }

  done(t) {
    for (const [me, them] of [t.ids, [...t.ids].reverse()]) {
      this.open.delete(me);
      const p = this.place.players.get(me);
      if (!p) continue;
      // (what they gave is no longer theirs for a bop to knock loose)
      for (const [item, n] of Object.entries(t.offers[me].items)) if (p.bag?.[item]) p.bag[item] = Math.max(0, p.bag[item] - n);
      this.place.send(p, { t: S.TRADE_DONE, with: them, give: t.offers[me], get: t.offers[them] });
    }
  }

  // The trade player `id` is in ends (why: 'cancelled', 'gone', 'far', 'game'; by: whose doing)
  end(id, why, by = id) {
    const t = this.open.get(id);
    if (!t) return;
    for (const me of t.ids) {
      this.open.delete(me);
      const p = this.place.players.get(me);
      if (p) this.place.send(p, { t: S.TRADE_END, why, by });
    }
  }

  // Every tick: trades whose farmers have gone, walked apart or gone off to a
  // party game end, and old asks are forgotten
  tick(now) {
    for (const [id, t] of this.open) {
      const [p, q] = t.ids.map((i) => this.place.players.get(i));
      const away = t.ids.find((i) => !this.place.players.get(i)?.conn);
      if (away !== undefined) this.end(id, 'gone', away);
      else if (p.game || q.game) this.end(id, 'game', p.game ? p.id : q.id);
      else if (!near(p, q, TRADE.far)) this.end(id, 'far', 0);
    }
    for (const [id, ask] of this.asks) if (now - ask.at > TRADE.askFor) this.asks.delete(id);
  }
}

const near = (p, q, d) => Math.hypot(p.x - q.x, p.z - q.z) <= d && Math.abs(p.y - q.y) < 4;
