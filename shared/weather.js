// ---------- Weather on the farm ----------
// Some days a shower of rain comes over the farm, and now and then a storm:
// harder rain, a wind that pushes a glider along, lightning and thunder. In
// winter (src/seasons.js) it comes down as snow. Rain waters every crop
// growing out in it, as the watering can does (WATERED_GROWTH in
// shared/balance.js), and every one planted while it falls.
//
// The weather comes from the farm's clock alone (its game hours since it
// began), so the page and the farm's room (server/farmroom.js) agree on it
// without a word between them, and a farm nobody is on still has its rain:
// when it opens again, what was growing when the rain came was watered.
import { mulberry32, hashSeed } from './worldgen.js';

export const WEATHER = {
  rain: 0.3, // of the days that have a shower
  storm: 0.08, // of the days that have a storm (instead)
  calm: 3, // the farm's first days have no storm (a shower instead)
  shower: { from: [6, 17], lasts: [1.5, 3.5] }, // it starts between these game hours, and lasts so long
  gale: { from: [13, 19], lasts: [2, 3.5] }, // likewise a storm
  ramp: 0.25, // game hours it takes to get going, and to stop
  wind: 1.6, // how fast a storm's wind pushes a glider along (units a second)
};

const pick = ([lo, hi], r) => lo + r * (hi - lo);

// The rain on the farm's day `day` (0 is its first, from midnight): null on a
// dry day, or { kind: 'rain' or 'storm', from, to (game hours), wind (the way
// a storm's wind blows, radians) }. Never on the first day (there's enough to
// learn then), and no storm in the first few. It ends by 22:30, before the
// next day's.
export function spellOn(day) {
  if (!(day >= 1)) return null;
  const rng = mulberry32(hashSeed(`weather/${day}`));
  const roll = rng();
  const kind = roll < WEATHER.storm && day >= WEATHER.calm ? 'storm' : roll < WEATHER.storm + WEATHER.rain ? 'rain' : null;
  if (!kind) return null;
  const { from, lasts } = kind === 'storm' ? WEATHER.gale : WEATHER.shower;
  const start = day * 24 + pick(from, rng());
  return { kind, from: start, to: start + pick(lasts, rng()), wind: rng() * Math.PI * 2 };
}

// The weather at `hours`: null when it's dry, or the day's rain (spellOn)
// with `amount`, how hard it's coming down (0 to 1: up from 0 as it starts,
// and back down as it stops)
export function weatherAt(hours) {
  const spell = spellOn(Math.floor(hours / 24));
  if (!spell || hours < spell.from || hours >= spell.to) return null;
  return { ...spell, amount: Math.min(1, (hours - spell.from) / WEATHER.ramp, (spell.to - hours) / WEATHER.ramp) };
}

// When rain first fell from `from` to `to` (game hours): the hour it did (or
// `from`, when it was raining already), or null if it stayed dry
export function rainSince(from, to) {
  if (!(to >= from)) return null;
  for (let day = Math.max(0, Math.floor(from / 24)); day <= Math.floor(to / 24); day++) {
    const spell = spellOn(day);
    if (spell && spell.to > from && spell.from <= to) return Math.max(spell.from, from);
  }
  return null;
}
