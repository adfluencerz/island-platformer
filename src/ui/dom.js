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

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
