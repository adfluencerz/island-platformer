// The health bar over a giant tree or rock (shared/giants.js) while anyone is
// swinging at it (and over a boss, src/bosses.js, all through its fight): it shows on every page each time a swing lands, and fades
// GIANT.barSeconds after the last. Drawn like the name tags over farmers
// (src/remotes.js): a sprite over the scenery, never hidden behind it.
import * as THREE from 'three';
import { GIANT } from '../shared/level.js';

const FADE = 0.5; // seconds to fade out

function makeBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.renderOrder = 10;
  return { sprite, canvas, texture, drawn: '', shownAt: -Infinity };
}

function paint(bar, label, hp, max) {
  const ctx = bar.canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(30, 14, 2, 0.6)';
  ctx.beginPath();
  ctx.roundRect(8, 4, 240, 56, 12);
  ctx.fill();
  ctx.font = '600 24px "Jersey 10", "Trebuchet MS", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, 22, 20, 150);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(hp)}/${max}`, 234, 20, 80);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.roundRect(22, 36, 212, 14, 7);
  ctx.fill();
  const part = Math.max(0, Math.min(1, hp / max));
  if (part > 0) {
    ctx.fillStyle = part > 0.5 ? '#7ed957' : part > 0.2 ? '#ffd23f' : '#ff8a3d';
    ctx.beginPath();
    ctx.roundRect(22, 36, Math.max(14, 212 * part), 14, 7);
    ctx.fill();
  }
  bar.texture.needsUpdate = true;
}

export function createGiantBars(scene) {
  const bars = new Map(); // "kind:id" -> bar

  return {
    // a swing landed: show how it is doing, over `top` (a Vector3; null: not
    // here). label: what it is called (a giant's, by its kind; a boss's, its name)
    show(kind, id, hp, max, top, now, label = kind === 'tree' ? 'Giant tree' : 'Giant rock') {
      if (!top) return;
      const key = `${kind}:${id}`;
      let bar = bars.get(key);
      if (!bar) {
        bar = makeBar();
        bars.set(key, bar);
        scene.add(bar.sprite);
      }
      const drawn = `${Math.ceil(hp)}/${max}`;
      if (bar.drawn !== drawn) {
        paint(bar, label, hp, max);
        bar.drawn = drawn;
      }
      bar.sprite.position.copy(top);
      bar.shownAt = now;
    },

    // it came down (or we went somewhere else)
    remove(kind, id) {
      const key = `${kind}:${id}`;
      const bar = bars.get(key);
      if (!bar) return;
      scene.remove(bar.sprite);
      bar.texture.dispose();
      bar.sprite.material.dispose();
      bars.delete(key);
    },

    clear() {
      for (const key of [...bars.keys()]) {
        const [kind, id] = key.split(':');
        this.remove(kind, kind === 'boss' ? id : Number(id)); // (a giant's id is its tree or rock's number; a boss's, its name)
      }
    },

    // now: the same clock show() was given
    update(now) {
      for (const bar of bars.values()) {
        const left = GIANT.barSeconds + FADE - (now - bar.shownAt);
        bar.sprite.visible = left > 0;
        bar.sprite.material.opacity = Math.min(1, left / FADE);
      }
    },
  };
}
