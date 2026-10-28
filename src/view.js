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
// (The camera itself is src/main.js: updateCamera, and looking round.)

const STORE = 'tp.view';

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
