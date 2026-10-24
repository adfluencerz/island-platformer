// The lobbies' HTTP API (server/index.js) and invite links.
//
// A lobby is known by its code. An invite link is the page's address with
// ?lobby=CODE: opening one shows that lobby's invitation on the title screen.
// While visiting a lobby the address bar carries its link, so a reload goes
// back into the same lobby and the address itself can be shared.

const CODE = /^[A-Z2-9]{6,10}$/;

async function call(path, init) {
  const res = await fetch(path, { ...init, signal: AbortSignal.timeout(6000) });
  // (a page served without the game server behind it answers /api with itself)
  if (!res.headers.get('content-type')?.startsWith('application/json')) throw new Error('no game server');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  return body;
}

export function devMode() {
  return new URLSearchParams(location.search).has('dev');
}

// [{ code, name, seed, players, max, full, inviteOnly, rare }]
export const listLobbies = () => call('/api/lobbies').then((b) => b.list);

// The lobby games' leaderboards (server/leaderboards.js): { games: { kind:
// [{ rank, name, best, wins, played }] }, you: { kind: entry } } (you: where
// farmer `name` is on each, if given)
export const leaderboards = (name = '') => call(`/api/leaderboards${name ? `?name=${encodeURIComponent(name)}` : ''}`);

// one lobby by its code, invite-only ones too; rejects with err.status 404 when there is none
// in dev mode, returns mock data for non-existent lobbies
export const lobbyInfo = (code) => {
  if (devMode()) {
    return call(`/api/lobbies/${encodeURIComponent(code)}`).catch((e) => {
      if (e.status === 404) return { code, name: `Dev lobby ${code}`, seed: code.toLowerCase(), players: 0, max: 8, full: false, inviteOnly: false };
      throw e;
    });
  }
  return call(`/api/lobbies/${encodeURIComponent(code)}`);
};

// { name, seed, inviteOnly, maxPlayers } -> the new lobby's info, code included (no seed: a new island)
export const openLobby = (opts) =>
  call('/api/lobbies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(opts) });

export function normalizeCode(s) {
  const code = String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CODE.test(code) ? code : '';
}

// the code of the lobby this page was opened for, or ''
export function linkedCode() {
  return normalizeCode(new URLSearchParams(location.search).get('lobby'));
}

export function inviteLink(code) {
  return `${location.origin}${location.pathname}?lobby=${encodeURIComponent(code)}`;
}

// An invitation to help on a farm: the page's address with ?help=CODE (server/farms.js)
export function helpLink(code) {
  return `${location.origin}${location.pathname}?help=${encodeURIComponent(code)}`;
}

// the helper's invite code this page was opened with, or ''
export function linkedHelpCode() {
  const code = String(new URLSearchParams(location.search).get('help') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 8 ? code : '';
}

// takes ?help=CODE out of the address bar (the invitation was answered)
export function forgetHelpCode() {
  const url = new URL(location.href);
  url.searchParams.delete('help');
  history.replaceState(history.state, '', url);
}

// puts the lobby's link in the address bar ('' takes it out), without a reload or a history entry
export function showCodeInAddress(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('lobby', code);
  else url.searchParams.delete('lobby');
  history.replaceState(history.state, '', url);
}
