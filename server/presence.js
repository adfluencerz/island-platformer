// Who is online, and lobbies started with friends. Every page logged in to an
// account keeps a socket here (/ws?presence), wherever it is: at home, in a
// lobby or on a farm, so a friend can reach it any time.
//
// A party: a farmer starts a lobby, inviting friends who are online (PARTY).
// Each gets an invitation right away (INVITED) and has INVITE_MS to say yes
// or no (ANSWER); unanswered, it lapses. The starter sees who is coming
// (PARTY, after every change), and PARTY_MS after it began, or as soon as
// everyone has answered, the lobby opens: the starter and everyone who said
// yes are sent to it (GO) and join it by its code, the way any lobby is
// joined. The starter can call it off (CANCEL), and going offline does too.
//
// From inside a running lobby anyone can invite friends to it (INVITE): the
// same invitation, and a yes goes straight there.
//
// A Presence never touches a socket: a connection is anything with
// send(string) and close(code, reason) (server/index.js); tick() runs the clock.
import { randomBytes } from 'node:crypto';
import { PROTOCOL_VERSION, CLOSE, CLOSE_TEXT, MAX_PLAYERS, PARTY_MS, INVITE_MS } from '../shared/constants.js';
import { PC, PS } from '../shared/protocol.js';

const PLACES = new Set(['home', 'lobby', 'farm']);

export class Presence {
  // farms: server/farms.js. lobby: server/lobby.js
  constructor({ farms, lobby, log = console.log }) {
    this.farms = farms;
    this.lobby = lobby;
    this.log = log;
    this.online = new Map(); // farm id -> Set of connections
    this.parties = new Map(); // party id -> { id, host, conn, name, color, invited: farm id -> 'waiting' | 'yes' | 'no', answered: farm id -> conn, startsAt, until, code }
  }

  isOnline(id) {
    return this.online.has(id);
  }

  // where they are ('home', 'lobby', 'farm'), or null when offline
  whereIs(id) {
    for (const conn of this.online.get(id) ?? []) return conn.place;
    return null;
  }

  send(conn, msg) {
    conn.send(JSON.stringify(msg));
  }

  sendTo(id, msg) {
    for (const conn of this.online.get(id) ?? []) this.send(conn, msg);
  }

  // The first message on a connection: a farm with an account, or it is closed. True: online now.
  hello(conn, msg) {
    if (msg?.t !== PC.HELLO || msg.v !== PROTOCOL_VERSION) {
      conn.close(CLOSE.VERSION, CLOSE_TEXT[CLOSE.VERSION]);
      return false;
    }
    const farm = this.farms.auth(`Bearer ${typeof msg.auth === 'string' ? msg.auth : ''}`);
    if (!farm?.account) {
      conn.close(CLOSE.NO_ACCOUNT, CLOSE_TEXT[CLOSE.NO_ACCOUNT]);
      return false;
    }
    conn.farmId = farm.id;
    conn.place = 'home';
    if (!this.online.has(farm.id)) this.online.set(farm.id, new Set());
    this.online.get(farm.id).add(conn);
    this.send(conn, { t: PS.READY, id: farm.id, name: farm.account.name });
    return true;
  }

  message(conn, msg, now = Date.now()) {
    switch (msg?.t) {
      case PC.WHERE:
        if (PLACES.has(msg.place)) conn.place = msg.place;
        break;
      case PC.PARTY:
        this.startParty(conn, msg.invite, now);
        break;
      case PC.CANCEL:
        for (const party of this.parties.values()) if (party.conn === conn && !party.code) this.callOff(party, 'They called it off.');
        break;
      case PC.ANSWER:
        this.answer(conn, msg.party, !!msg.yes, now);
        break;
      case PC.INVITE: {
        const room = typeof msg.code === 'string' ? this.lobby.find(msg.code) : null;
        if (room) this.invite(conn, msg.invite, { code: room.code, name: room.name }, now);
        break;
      }
    }
  }

  // The connection went: a party it was starting is off
  leave(conn) {
    const set = this.online.get(conn.farmId);
    if (!set) return;
    set.delete(conn);
    if (!set.size) this.online.delete(conn.farmId);
    for (const party of this.parties.values()) if (party.conn === conn && !party.code) this.callOff(party, 'They went offline.');
  }

  // ---------- Parties ----------
  // Of the farm ids a page asked to invite: friends of theirs who are online,
  // as many as the lobby has seats for
  inviteable(farm, ids, seats) {
    const out = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      if (out.length >= seats) break;
      if (typeof id !== 'string' || id === farm.id || out.includes(id) || !this.isOnline(id)) continue;
      if (this.farms.areFriends(farm, this.farms.get(id))) out.push(id);
    }
    return out;
  }

  startParty(conn, ids, now) {
    const farm = this.farms.get(conn.farmId);
    if (!farm?.account) return;
    for (const party of this.parties.values()) if (party.conn === conn && !party.code) this.callOff(party, 'They started another lobby.');
    const party = this.newParty(conn, farm, this.inviteable(farm, ids, MAX_PLAYERS - 1), now, null);
    if (!party.invited.size) return this.open(party); // (nobody to wait for)
    this.log(`party ${party.id}: ${party.name} invites ${party.invited.size}`);
    this.status(party, now);
  }

  // Invitations to a lobby already running (room: { code, name })
  invite(conn, ids, room, now) {
    const farm = this.farms.get(conn.farmId);
    if (!farm?.account) return;
    const party = this.newParty(conn, farm, this.inviteable(farm, ids, MAX_PLAYERS), now, room.code);
    if (!party.invited.size) this.parties.delete(party.id);
  }

  newParty(conn, farm, invite, now, code) {
    const party = {
      id: randomBytes(6).toString('hex'), host: farm.id, conn, name: farm.account.name, color: farm.color,
      invited: new Map(invite.map((id) => [id, 'waiting'])), answered: new Map(),
      startsAt: now + PARTY_MS, until: now + INVITE_MS, code,
    };
    this.parties.set(party.id, party);
    for (const id of invite) this.sendTo(id, { t: PS.INVITED, party: party.id, from: party.name, color: party.color, ms: INVITE_MS, late: !!code });
    return party;
  }

  answer(conn, id, yes, now) {
    const party = this.parties.get(id);
    if (!party || party.invited.get(conn.farmId) !== 'waiting' || now > party.until) return;
    party.invited.set(conn.farmId, yes ? 'yes' : 'no');
    if (yes) party.answered.set(conn.farmId, conn);
    for (const other of this.online.get(conn.farmId) ?? []) if (other !== conn) this.send(other, { t: PS.GONE, party: id });
    if (party.code) {
      // (to a lobby already running: straight there)
      if (yes) this.go(party, conn);
      return;
    }
    this.status(party, now);
    if ([...party.invited.values()].every((state) => state !== 'waiting')) this.open(party);
  }

  // How the party stands, for whoever started it
  status(party, now) {
    const friends = [...party.invited].map(([id, state]) => [id, this.farms.get(id)?.account?.name ?? 'Farmer', state]);
    this.send(party.conn, { t: PS.PARTY, party: party.id, ms: Math.max(0, party.startsAt - now), friends });
  }

  // Time's up (or everyone answered): the lobby opens, and off they go
  open(party) {
    this.parties.delete(party.id);
    const room = this.lobby.make({ name: `${party.name}'s lobby` });
    if (room.error) {
      this.send(party.conn, { t: PS.CALLED_OFF, party: party.id, why: room.error });
      for (const conn of party.answered.values()) this.send(conn, { t: PS.CALLED_OFF, party: party.id, why: room.error });
      return;
    }
    party.code = room.code;
    this.go(party, party.conn);
    for (const conn of party.answered.values()) this.go(party, conn);
    this.log(`party ${party.id}: lobby ${room.code} opens (${party.answered.size + 1} farmers)`);
  }

  go(party, conn) {
    if (!this.lobby.find(party.code)) return this.send(conn, { t: PS.CALLED_OFF, party: party.id, why: 'That lobby is over.' });
    this.send(conn, { t: PS.GO, party: party.id, code: party.code });
  }

  callOff(party, why) {
    this.parties.delete(party.id);
    for (const [id, state] of party.invited) {
      if (state === 'no') continue;
      this.sendTo(id, { t: PS.CALLED_OFF, party: party.id, why: `${party.name}: ${why}` });
    }
  }

  // Every so often: invitations lapse, parties open
  tick(now = Date.now()) {
    for (const party of [...this.parties.values()]) {
      if (now > party.until) {
        let lapsed = false;
        for (const [id, state] of party.invited) {
          if (state !== 'waiting') continue;
          party.invited.set(id, 'no');
          this.sendTo(id, { t: PS.GONE, party: party.id });
          lapsed = true;
        }
        if (party.code) {
          this.parties.delete(party.id); // (a late one is done once its invitations are)
          continue;
        }
        if (lapsed) this.status(party, now);
      }
      if (!party.code && now >= party.startsAt) this.open(party);
    }
  }
}
