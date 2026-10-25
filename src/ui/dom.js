// Small DOM helpers for the game's menus and HUD

export function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function button(className, parent, text, onClick) {
  const b = el('button', className, parent, text);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export const hexColor = (c) => `#${c.toString(16).padStart(6, '0')}`;

// The frame a node's fixed boxes sit in, on the screen: its farmer's own part
// of a split screen (a .seat, src/main.js), else the whole page. { x, y, w, h }
export function frameOf(node) {
  const seat = node.closest?.('.seat');
  if (!seat) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const r = seat.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

// A tooltip below-right of the point x, y (on the screen), flipping when it
// would leave its frame
export function placeTip(tip, x, y) {
  const f = frameOf(tip);
  const r = tip.getBoundingClientRect();
  const [px, py] = [x - f.x, y - f.y];
  const left = px + 20 + r.width > f.w ? px - r.width - 12 : px + 20;
  const top = py + 20 + r.height > f.h ? py - r.height - 12 : py + 20;
  tip.style.transform = `translate(${Math.max(4, left)}px, ${Math.max(4, top)}px)`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
