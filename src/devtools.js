import { el, button } from './ui/dom.js';
import { isTouch } from './ui/touch.js';
import { devToolsOn } from '../shared/constants.js';

// ---------- Developer tools ----------
// On a desktop, ` opens a little panel of things for trying the game out:
// for now, growing a giant (shared/giants.js) out of the tree or rock nearest
// you, on the farm or in a lobby. Who gets them is DEV_TOOLS in
// shared/constants.js (for now everyone; later only a game run locally).
//
// onGiant(kind): grow a giant 'tree' or 'rock' (main.js)
export function createDevTools({ onGiant }) {
  if (!devToolsOn(import.meta.env.DEV)) return;
  const panel = el('div', 'inv-frame', document.body);
  Object.assign(panel.style, {
    // (at the left, half way down: clear of the farm's name and tips at the top)
    position: 'fixed', top: '50%', left: '12px', transform: 'translateY(-50%)', zIndex: 30, padding: '10px 12px',
    display: 'none', flexDirection: 'column', gap: '6px', font: '13px system-ui, sans-serif',
  });
  el('b', '', panel, 'Developer tools');
  el('div', 'ui-muted ui-small', panel, 'Grows the nearest one into a giant');
  button('ui-btn ui-btn-small', panel, 'Giant tree', () => onGiant('tree'));
  button('ui-btn ui-btn-small', panel, 'Giant rock', () => onGiant('rock'));
  el('div', 'ui-muted ui-small', panel, '` to close');

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.repeat || isTouch() || e.target.closest?.('input, textarea, select')) return;
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; // (not `hidden`: the display above would win)
  });
}
