// Where the lobbies are kept between runs of the server: one JSON file
// (data/lobbies.json unless GAME_DATA says otherwise), written whole.
//
// A write goes to a .tmp file first; then the last good file becomes the .bak
// and the .tmp takes its place, so a crash halfway never leaves half a file
// (at worst the .bak is read). A file that can't be read, or that a newer
// server wrote, is set aside (lobbies.broken-<time>.json), never written over.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname } from 'node:path';

export const STORE_VERSION = 1;

export class Store {
  constructor(path, { log = console.log } = {}) {
    this.path = path;
    this.log = log;
    this.failing = false; // (a write that fails is said once, not every few seconds)
  }

  // the saved lobbies, or null for none
  load() {
    for (const file of [this.path, `${this.path}.bak`]) {
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {}
      if (data?.v === STORE_VERSION) return data;
      this.setAside(file, data?.v > STORE_VERSION ? 'written by a newer server' : 'unreadable');
    }
    return null;
  }

  save(data) {
    const tmp = `${this.path}.tmp`;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(tmp, JSON.stringify({ v: STORE_VERSION, ...data }));
      if (existsSync(this.path)) renameSync(this.path, `${this.path}.bak`);
      renameSync(tmp, this.path);
      this.failing = false;
    } catch (e) {
      if (!this.failing) this.log(`could not save the lobbies to ${this.path}: ${e.message}`);
      this.failing = true;
    }
  }

  setAside(file, why) {
    const ext = extname(this.path);
    const stem = `${this.path.slice(0, -ext.length || undefined)}.broken-${Date.now()}${file.endsWith('.bak') ? '-bak' : ''}`;
    let to = `${stem}${ext}`;
    for (let n = 2; existsSync(to); n++) to = `${stem}-${n}${ext}`; // (never over an earlier one)
    try {
      renameSync(file, to);
      this.log(`lobby save ${file} is ${why}: set aside as ${to}`);
    } catch {}
  }
}
