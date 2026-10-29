import './view.css';

// ---------- The camera view ----------
// How the game is seen: from above, the angled follow camera (the default), or
// in first person, out of the farmer's own eyes. Kept in this browser, and
// the same for every farmer at the screen.
//
//   firstPerson()        true in first person
//   setFirstPerson(on)
//   toggle()             V in game, and the menu's switch: returns the new setting
//
// From above, at which angle: wide (the default: low and further back, the
// sky and the horizon in view) or classic (steeply down from above, as it
// was). Kept as tp.cam; ?cam=wide|classic in the address wins (for testing:
// scripts/shots.mjs), and is not kept. Underground and indoors the camera is
// classic whatever this says (they have ceilings: src/main.js).
//
//   wide()               true at the wide angle
//   setWide(on)
//   toggleWide()         the menu's switch: returns the new setting
//
// (The camera itself is src/main.js: updateCamera, and looking round.)

const STORE = 'tp.view';
const CAM_STORE = 'tp.cam';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE))?.firstPerson === true;
  } catch {
    return false;
  }
}

let on = load();

export const firstPerson = () => on;

export function setFirstPerson(value) {
  on = !!value;
  try {
    localStorage.setItem(STORE, JSON.stringify({ firstPerson: on }));
  } catch {}
}

export function toggle() {
  setFirstPerson(!on);
  return on;
}

const ANGLES = ['wide', 'classic'];
function loadAngle() {
  const asked = new URLSearchParams(location.search).get('cam');
  if (ANGLES.includes(asked)) return asked;
  try {
    const kept = JSON.parse(localStorage.getItem(CAM_STORE))?.angle;
    return ANGLES.includes(kept) ? kept : 'wide';
  } catch {
    return 'wide';
  }
}

let angle = loadAngle();

export const wide = () => angle === 'wide';

export function setWide(value) {
  angle = value ? 'wide' : 'classic';
  try {
    localStorage.setItem(CAM_STORE, JSON.stringify({ angle }));
  } catch {}
}

export function toggleWide() {
  setWide(!wide());
  return wide();
}
