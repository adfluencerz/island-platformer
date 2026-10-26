import * as THREE from 'three';
import { createFarmer } from './character.js';
import { TICK_DT, INTERP_DELAY } from '../shared/constants.js';
import { STATEF } from '../shared/protocol.js';
import { SWORDS } from '../shared/level.js';
import { ITEMS } from './items.js';
import { BOSS_IDS } from '../shared/bosses.js';
import { createMount } from './mounts.js';
import { cleanLook, sameLook } from '../shared/looks.js';
import { createTackle } from './fishing.js';

// ---------- Other players ----------
// Everyone else in the game, drawn from the room's snapshots. Snapshots come
// TICK_RATE times a second, so each remote keeps a short ring of timestamped
// samples and is drawn INTERP_DELAY behind the newest one, between the two
// samples around that moment. That costs a tenth of a second of lag and buys
// smooth movement through network jitter and the gaps between ticks.

const RING = 12;
const NAME_TAG_Y = 1.3; // above the collision center

class Samples {
  constructor() {
    this.list = []; // { t, x, y, z, yaw, f }, oldest first
  }

  push(t, x, y, z, yaw, f) {
    const last = this.list[this.list.length - 1];
    if (last && t <= last.t) return;
    this.list.push({ t, x, y, z, yaw, f });
    if (this.list.length > RING) this.list.shift();
  }

  // the state at time t (held at the ends: no guessing past the newest sample)
  sample(t, out) {
    const s = this.list;
    if (!s.length) return false;
    let a = s[0];
    let b = s[0];
    if (t >= s[s.length - 1].t) {
      a = b = s[s.length - 1];
    } else {
      for (let i = 1; i < s.length; i++) {
        if (s[i].t >= t) {
          a = s[i - 1];
          b = s[i];
          break;
        }
      }
    }
    const k = b.t > a.t ? THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1) : 1;
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.z = a.z + (b.z - a.z) * k;
    let d = b.yaw - a.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    out.yaw = a.yaw + d * k;
    out.f = (k < 0.5 ? a : b).f;
    return true;
  }
}

// (and src/main.js's, over each farmer at a split screen)
export function makeNameTag(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 42px "Jersey 10", "Trebuchet MS", sans-serif';
  const w = Math.min(248, ctx.measureText(name).width + 48);
  const x0 = (256 - w) / 2;
  ctx.fillStyle = 'rgba(30, 14, 2, 0.6)';
  ctx.beginPath();
  ctx.roundRect(x0, 10, w, 44, 12);
  ctx.fill();
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.arc(x0 + 20, 32, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x0 + 36, 33, w - 44);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = NAME_TAG_Y;
  sprite.renderOrder = 10; // drawn over the scenery so names are never hidden
  return sprite;
}

export class Remotes {
  // waterFrom(x, z, yaw): where the bobber of a farmer there, facing yaw,
  // floats ({ x, y, z }, or null), as for our own (src/fishing.js)
  constructor(scene, { waterFrom = () => null } = {}) {
    this.scene = scene;
    this.waterFrom = waterFrom;
    this._tip = new THREE.Vector3();
    this.players = new Map(); // id -> remote
    this.myId = 0;
    this.clock = -1; // our estimate of the room's time (s), -1 before the first snapshot
    this._s = {};
  }

  // the room's player list: add the new, drop the gone, restyle the changed
  setRoster(list, myId) {
    this.myId = myId;
    const seen = new Set();
    for (const p of list) {
      if (p.id === myId) continue;
      seen.add(p.id);
      let r = this.players.get(p.id);
      if (!r) {
        const farmer = createFarmer({ shirt: p.color, look: cleanLook(p.look) });
        farmer.root.visible = false; // until it has a position
        this.scene.add(farmer.root);
        r = { id: p.id, farmer, samples: new Samples(), tag: null, name: '', color: -1, look: cleanLook(p.look), away: false,
          last: new THREE.Vector3(), wasGround: true, wasSwinging: false };
        this.players.set(p.id, r);
      }
      if (r.name !== p.name || r.color !== p.color) {
        r.name = p.name;
        r.color = p.color;
        r.farmer.setShirt(p.color);
        if (r.tag) {
          r.farmer.root.remove(r.tag);
          r.tag.material.map.dispose();
          r.tag.material.dispose();
        }
        r.tag = makeNameTag(p.name, p.color);
        r.farmer.root.add(r.tag);
      }
      // (new clothes: dressed again)
      const look = cleanLook(p.look);
      if (!sameLook(look, r.look)) {
        r.look = look;
        r.farmer.setLook(look);
      }
      r.away = p.away;
      r.tag.material.opacity = p.away ? 0.4 : 1;
    }
    for (const id of [...this.players.keys()]) if (!seen.has(id)) this.remove(id);
  }

  snapshot(tick, list) {
    const t = tick * TICK_DT;
    // Follow the room's clock: jump when far off (the first snapshot, a stall),
    // otherwise ease toward it so the render time never lurches
    if (this.clock < 0 || Math.abs(t - this.clock) > 0.5) this.clock = t;
    else this.clock += (t - this.clock) * 0.1;
    for (const [id, x, y, z, yaw, f] of list) {
      this.players.get(id)?.samples.push(t, x, y, z, yaw, f);
    }
  }

  update(dt, time) {
    if (this.clock < 0) return;
    this.clock += dt;
    const renderTime = this.clock - INTERP_DELAY;
    const s = this._s;
    for (const r of this.players.values()) {
      if (!r.samples.sample(renderTime, s)) continue;
      const root = r.farmer.root;
      if (!root.visible) {
        root.visible = true;
        r.last.set(s.x, s.y, s.z);
      }
      // Walking or not, read off how far it moved since the last frame
      const speed = dt > 0 ? Math.hypot(s.x - r.last.x, s.z - r.last.z) / dt : 0;
      const rising = s.y > r.last.y + 1e-3;
      r.last.set(s.x, s.y, s.z);
      root.position.set(s.x, s.y, s.z);

      const onGround = (s.f & STATEF.GROUND) !== 0;
      if (onGround && !r.wasGround) r.farmer.anim.squash = 0.15; // landed
      else if (!onGround && r.wasGround && rising) r.farmer.anim.squash = -0.2; // jumped
      r.wasGround = onGround;

      r.farmer.hoe.visible = (s.f & STATEF.HOE) !== 0;
      r.farmer.axe.visible = (s.f & STATEF.AXE) !== 0;
      r.farmer.pick.visible = (s.f & STATEF.PICK) !== 0;
      r.farmer.sword.visible = (s.f & STATEF.SWORD) !== 0;
      if (r.farmer.sword.visible) r.farmer.setSword(ITEMS[SWORDS[Math.floor(s.f / STATEF.BLADE) & 3]]?.color ?? ITEMS.wooden_sword.color);
      r.farmer.mallet.visible = (s.f & STATEF.MALLET) !== 0;
      r.farmer.bow.visible = (s.f & STATEF.BOW) !== 0;
      r.farmer.rod.visible = (s.f & STATEF.ROD) !== 0;
      r.farmer.anim.line = r.farmer.rod.visible && (s.f & STATEF.CAST) ? ((s.f & STATEF.BITE) ? 'bite' : 'out') : null;
      const mount = Math.floor(s.f / STATEF.MOUNT) & 7; // (riding: src/mounts.js)
      if (mount !== (r.mount ?? 0)) {
        r.mount = mount;
        r.farmer.ride(mount ? createMount(BOSS_IDS[mount - 1]) : null);
      }
      const swinging = (s.f & STATEF.SWING) !== 0;
      if (swinging && !r.wasSwinging) r.farmer.swing();
      r.wasSwinging = swinging;
      r.farmer.anim.facing = s.yaw; // the owner already eased it
      r.farmer.animate(dt, { moving: speed > 0.8, onGround, targetYaw: s.yaw, time });
      this.showLine(r, s, time);
    }
  }

  // A farmer's fishing line, out over the water in front of them while they have one out
  showLine(r, s, time) {
    if (r.farmer.anim.line && !r.lineAt) r.lineAt = this.waterFrom(s.x, s.z, s.yaw); // (where it landed, kept till it is in)
    if (!r.farmer.anim.line) r.lineAt = null;
    if (!r.lineAt) return r.tackle?.hide();
    r.tackle ??= createTackle(this.scene);
    r.farmer.rodTip.getWorldPosition(this._tip);
    r.tackle.show(this._tip, r.lineAt, r.farmer.anim.line === 'bite', time);
  }

  swing(id) {
    this.players.get(id)?.farmer.swing();
  }

  // where player id is drawn right now (null: not here, or not drawn yet)
  positionOf(id) {
    const r = this.players.get(id);
    return r?.farmer.root.visible ? r.farmer.root.position : null;
  }

  remove(id) {
    const r = this.players.get(id);
    if (!r) return;
    this.scene.remove(r.farmer.root);
    r.farmer.dispose();
    r.tackle?.dispose();
    r.tag?.material.map.dispose();
    r.tag?.material.dispose();
    this.players.delete(id);
  }

  clear() {
    for (const id of [...this.players.keys()]) this.remove(id);
    this.clock = -1;
  }
}
