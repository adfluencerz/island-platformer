// ---------- Graphics tiers ----------
// How much the game draws: 'low', 'medium' or 'high'. Each tier is a row of
// knobs (TIERS below) that the drawing code reads instead of asking "is this a
// phone?" itself, so a slow device can be helped from one setting.
//
//   tier()          the tier now
//   knobs()         its knobs: { pixelRatio, shadowMap, post, grassDensity,
//                   grassBlades, treeSway, cloudShadows, msaa, particles }
//                   (pixelRatio is the one to draw at here: the tier's cap,
//                   or the screen's own if lower)
//   setTier(t)      pick one (kept in this browser), and apply it at once
//   cycle()         high -> medium -> low -> high (the menu's Graphics button)
//   onApply(fn)     fn(knobs, tier) on each applyTier()
//   applyTier()     tell everything registered with onApply what the tier is now
//
// Which tier: ?gfx=low|medium|high in the address, for testing (scripts/shots.mjs);
// ?lowgfx is low (the headless browser's, scripts/browser.mjs); else the one
// picked in the menu; else a touch screen is medium (it looks the same on a
// small screen, and runs cooler) and anything else high.
import { isTouch } from '../ui/touch.js';

const STORE = 'tp.gfx';
export const TIER_NAMES = ['low', 'medium', 'high'];

// pixelRatio: a cap on the screen's own; shadowMap: its size (0: no shadows);
// post: 'off' | 'half' (half-res bloom) | 'full'; grassDensity: the share of the
// grass tufts drawn; grassBlades: how many of each tuft's seven blades
// (src/world.js); msaa: samples in the post chain; particles: rain and snow
export const TIERS = {
  low: { pixelRatio: 0.5, shadowMap: 0, post: 'off', grassDensity: 0.35, grassBlades: 3, treeSway: false, cloudShadows: false, msaa: 0, particles: 300 },
  medium: { pixelRatio: 1.5, shadowMap: 1024, post: 'half', grassDensity: 0.6, grassBlades: 5, treeSway: true, cloudShadows: true, msaa: 0, particles: 600 },
  high: { pixelRatio: 2, shadowMap: 2048, post: 'full', grassDensity: 1.0, grassBlades: 7, treeSway: true, cloudShadows: true, msaa: 4, particles: 900 },
};
export const MAX_PARTICLES = Math.max(...Object.values(TIERS).map((k) => k.particles));

const valid = (t) => (TIER_NAMES.includes(t) ? t : null);

function load() {
  try {
    return valid(JSON.parse(localStorage.getItem(STORE))?.tier);
  } catch {
    return null;
  }
}

function save(tier) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ tier }));
  } catch {}
}

function fromAddress() {
  const query = new URLSearchParams(location.search);
  return valid(query.get('gfx')) ?? (query.has('lowgfx') ? 'low' : null);
}

let current = null; // (decided on first asking: the page knows by then whether it is on a touch screen)
const appliers = [];

export function tier() {
  return (current ??= fromAddress() ?? load() ?? (isTouch() ? 'medium' : 'high'));
}

export function knobs() {
  const k = TIERS[tier()];
  return { ...k, pixelRatio: Math.min(window.devicePixelRatio || 1, k.pixelRatio) };
}

export function onApply(fn) {
  appliers.push(fn);
}

export function applyTier() {
  const k = knobs();
  for (const fn of appliers) fn(k, current);
}

export function setTier(t) {
  if (!valid(t)) return;
  current = t;
  save(t);
  applyTier();
}

export function cycle() {
  setTier(TIER_NAMES[(TIER_NAMES.indexOf(tier()) + 2) % 3]); // (high -> medium -> low -> high)
}
