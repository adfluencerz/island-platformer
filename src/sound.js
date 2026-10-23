// ---------- Sound ----------
// Every sound in the game is made on the spot with the Web Audio API, so there
// are no sound files to load (and the app works offline as before).
//
//   play(name)       a sound effect, from SOUNDS below (a few of the same at
//                    once at most, so holding E doesn't pile them up)
//   music(mood)      the tune that plays: 'day', 'night' or null (none). It
//                    changes at the next bar.
//   settings()       { effects, music }: on or off, kept in this browser
//   setEffects(on), setMusic(on), toggle(): M mutes and unmutes both
//
// Browsers only let a page make sound after a click, tap or key press: the
// first one starts it (unlock, below). A hidden tab goes quiet.

const STORE = 'tp.sound';
const VOLUME = { effects: 0.5, music: 0.16 };

let ctx = null;
let effectsBus = null;
let musicBus = null;
let noiseBuffer = null;
let prefs = load();
let mood = null; // the tune asked for
const playing = new Map(); // sound name -> how many are sounding

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    return { effects: saved?.effects !== false, music: saved?.music !== false };
  } catch {
    return { effects: true, music: true };
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(prefs));
  } catch {}
}

// The first click, tap or key press: make the audio context (or wake it)
function unlock() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    effectsBus = ctx.createGain();
    effectsBus.gain.value = prefs.effects ? VOLUME.effects : 0;
    effectsBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = prefs.music ? VOLUME.music : 0;
    musicBus.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    setInterval(scheduleMusic, 100);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
}
for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

// ---------- The building blocks ----------
// A note: wave `type` from `freq` (sliding to `to`), `len` seconds, at `at`
// seconds from now, its loudness `gain` with a quick attack and a fade
function tone(bus, { freq, to = freq, len = 0.15, type = 'sine', gain = 0.3, at = 0, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + len);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(amp).connect(bus);
  osc.start(t);
  osc.stop(t + len + 0.02);
  return osc;
}

// A burst of noise through a filter (`filter`: lowpass, bandpass or highpass
// at `freq`, sliding to `to`): thuds, swishes, splashes and crunches
function noise(bus, { len = 0.1, filter = 'lowpass', freq = 1000, to = freq, q = 1, gain = 0.3, at = 0, attack = 0.003 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to !== freq) f.frequency.exponentialRampToValueAtTime(to, t + len);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(amp).connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.02);
  return src;
}

// ---------- The sound effects ----------
// Each makes its sound on `bus` and returns the source that ends last.
// (`r`: a little random spread, so a sound heard often isn't always the same)
const r = (spread) => 1 + (Math.random() * 2 - 1) * spread;
const SOUNDS = {
  // the farmer
  jump: (b) => tone(b, { freq: 260 * r(0.05), to: 520, len: 0.14, type: 'triangle', gain: 0.18 }),
  airJump: (b) => (noise(b, { len: 0.18, filter: 'bandpass', freq: 600, to: 2400, q: 0.8, gain: 0.25 }), tone(b, { freq: 520, to: 900, len: 0.16, type: 'triangle', gain: 0.14 })),
  land: (b) => noise(b, { len: 0.09, freq: 380, gain: 0.35 }),
  step: (b) => noise(b, { len: 0.05, freq: 700 * r(0.25), gain: 0.07 }),
  glide: (b) => noise(b, { len: 0.45, filter: 'bandpass', freq: 500, to: 1100, q: 0.7, gain: 0.22, attack: 0.08 }),
  // farming
  till: (b) => (noise(b, { len: 0.14, filter: 'bandpass', freq: 500, q: 0.7, gain: 0.45 }), tone(b, { freq: 110, to: 70, len: 0.12, gain: 0.25 })),
  plant: (b) => (noise(b, { len: 0.08, freq: 900, gain: 0.18 }), tone(b, { freq: 660 * r(0.04), len: 0.09, gain: 0.12, at: 0.04 })),
  harvest: (b) => (noise(b, { len: 0.06, filter: 'highpass', freq: 1500, gain: 0.15 }), tone(b, { freq: 440 * r(0.03), to: 660, len: 0.12, type: 'triangle', gain: 0.2 })),
  // chopping and mining
  chop: (b) => (noise(b, { len: 0.08, filter: 'bandpass', freq: 1400 * r(0.1), q: 1.5, gain: 0.45 }), tone(b, { freq: 180 * r(0.08), to: 120, len: 0.1, type: 'triangle', gain: 0.35 })),
  mine: (b) => (tone(b, { freq: 1400 * r(0.1), to: 1250, len: 0.14, type: 'square', gain: 0.07 }), noise(b, { len: 0.07, filter: 'highpass', freq: 2500, gain: 0.3 })),
  fell: (b) => (noise(b, { len: 0.7, freq: 600, to: 120, gain: 0.5, attack: 0.03 }), tone(b, { freq: 90, to: 45, len: 0.5, gain: 0.35, at: 0.15 })),
  // things to have
  pickup: (b) => (tone(b, { freq: 880, len: 0.07, type: 'triangle', gain: 0.14 }), tone(b, { freq: 1320, len: 0.12, type: 'triangle', gain: 0.14, at: 0.06 })),
  coin: (b) => (tone(b, { freq: 988, len: 0.08, type: 'square', gain: 0.06 }), tone(b, { freq: 1319, len: 0.22, type: 'square', gain: 0.06, at: 0.07 })),
  spend: (b) => (tone(b, { freq: 1319, len: 0.07, type: 'square', gain: 0.05 }), tone(b, { freq: 880, len: 0.14, type: 'square', gain: 0.05, at: 0.06 })),
  full: (b) => tone(b, { freq: 220, to: 180, len: 0.16, type: 'square', gain: 0.06 }),
  // in a lobby
  bop: (b) => (tone(b, { freq: 320, to: 90, len: 0.16, type: 'triangle', gain: 0.4 }), noise(b, { len: 0.06, freq: 1800, gain: 0.25 })),
  // fishing
  cast: (b) => (noise(b, { len: 0.22, filter: 'bandpass', freq: 800, to: 3000, q: 1, gain: 0.18 }), noise(b, { len: 0.15, freq: 900, gain: 0.25, at: 0.25 })),
  bite: (b) => (tone(b, { freq: 1046, len: 0.08, gain: 0.2 }), tone(b, { freq: 1046, len: 0.12, gain: 0.2, at: 0.11 })),
  splash: (b) => noise(b, { len: 0.45, freq: 2600, to: 300, gain: 0.4, attack: 0.01 }),
  // food and machines
  eat: (b) => (noise(b, { len: 0.06, filter: 'bandpass', freq: 1200, q: 2, gain: 0.3 }), noise(b, { len: 0.06, filter: 'bandpass', freq: 1000, q: 2, gain: 0.3, at: 0.14 })),
  // something to cheer: a catch, a win, a level, a find
  cheer: (b) => [523, 659, 784, 1046].map((freq, i) => tone(b, { freq, len: 0.22, type: 'triangle', gain: 0.16, at: i * 0.08 })).at(-1),
};

// A sound effect (nothing if the sound is off, not started yet, or the
// same sound is already sounding a few times over)
export function play(name) {
  if (!ctx || !prefs.effects || ctx.state !== 'running' || !SOUNDS[name]) return;
  const n = playing.get(name) ?? 0;
  if (n >= 3) return;
  playing.set(name, n + 1);
  const last = SOUNDS[name](effectsBus);
  last.onended = () => playing.set(name, (playing.get(name) ?? 1) - 1);
}

// ---------- The music ----------
// A gentle tune made up as it goes: a chord a bar from a loop of four, a
// low note on each, and a plucked melody wandering over the chord's notes
// (by day: brighter and busier; at night: lower, slower, sparser).
const MOODS = {
  // chords as semitones over the key's root, a bar each
  day: { root: 60, bpm: 92, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], notes: 0.7, wave: 'triangle', octave: 12 },
  night: { root: 57, bpm: 66, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -2, 2]], notes: 0.35, wave: 'sine', octave: 12 },
};
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const tune = { mood: null, bar: 0, beat: 0, nextAt: 0, last: 0 };

// Every 100 ms: the notes due in the next half second
function scheduleMusic() {
  if (!ctx || ctx.state !== 'running') return;
  if (!tune.mood || tune.beat === 0) tune.mood = mood; // (a new mood waits for the bar)
  const m = MOODS[tune.mood];
  if (!m) {
    tune.nextAt = 0;
    return;
  }
  const beatLen = 60 / m.bpm / 2; // (eighth notes)
  if (tune.nextAt < ctx.currentTime) tune.nextAt = ctx.currentTime + 0.1;
  while (tune.nextAt < ctx.currentTime + 0.5) {
    const at = tune.nextAt - ctx.currentTime;
    const chord = m.chords[tune.bar % m.chords.length];
    if (tune.beat === 0) {
      tone(musicBus, { freq: hz(m.root - 24 + chord[0]), len: beatLen * 7, gain: 0.5, at, attack: 0.05 }); // the bass
      for (const n of chord) tone(musicBus, { freq: hz(m.root + n), len: beatLen * 8, gain: 0.08, at, attack: 0.3 }); // a soft pad
    }
    if (tune.beat > 0 && Math.random() < m.notes) {
      // the melody: a step or two from the last note, over the chord's notes
      const pool = [...chord, ...chord.map((n) => n + 12)].sort((a, b) => a - b);
      const near = pool.filter((n) => Math.abs(n - tune.last) <= 7);
      tune.last = (near.length ? near : pool)[Math.floor(Math.random() * (near.length || pool.length))];
      tone(musicBus, { freq: hz(m.root + m.octave + tune.last), len: beatLen * 1.8, type: m.wave, gain: 0.22, at });
    }
    tune.nextAt += beatLen;
    tune.beat = (tune.beat + 1) % 8;
    if (tune.beat === 0) tune.bar++;
  }
}

// The tune to play: 'day', 'night' or null
export function music(next) {
  mood = next;
}

// ---------- Settings ----------
export const settings = () => ({ ...prefs });

function apply() {
  save();
  if (!ctx) return;
  const t = ctx.currentTime;
  effectsBus.gain.setTargetAtTime(prefs.effects ? VOLUME.effects : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(prefs.music ? VOLUME.music : 0, t, 0.2);
}

export function setEffects(on) {
  prefs.effects = on;
  apply();
}

export function setMusic(on) {
  prefs.music = on;
  apply();
}

// M: everything off, or (when anything is off) everything on. True: on now.
export function toggle() {
  const on = !(prefs.effects && prefs.music);
  prefs = { effects: on, music: on };
  apply();
  return on;
}
