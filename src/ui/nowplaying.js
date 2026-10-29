// "Now playing" and the song's name, at the top of the screen for a few
// seconds whenever the music starts it (src/sound.js, onSong)

import { el } from './dom.js';
import './nowplaying.css';

const SHOW_FOR = 4000; // ms

export function createNowPlaying(parent = document.body) {
  const node = el('div', 'now-playing inv-frame', parent);
  node.hidden = true;
  node.setAttribute('role', 'status');
  el('span', 'now-playing-label', node, 'Now playing');
  const title = el('b', 'now-playing-title', node);
  let timer = 0;
  return function show(name) {
    title.textContent = name;
    node.hidden = false;
    node.classList.remove('in');
    void node.offsetWidth; // (restart the animation)
    node.classList.add('in');
    clearTimeout(timer);
    timer = setTimeout(() => (node.hidden = true), SHOW_FOR);
  };
}
