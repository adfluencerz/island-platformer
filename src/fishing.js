import * as THREE from 'three';
import { ITEMS } from './items.js';
import { RARE } from '../shared/level.js';
import { C } from '../shared/protocol.js';
import { CAST_EVERY, castLine } from '../shared/fishing.js';

// ---------- Fishing, on the page ----------
// With a rod in hand, E facing water casts (the rules: shared/fishing.js).
// The bobber floats a while, then dips with a splash and a "!": E then (the
// Use button on a phone, which pulses, and the phone buzzes) lands it. Too
// slow and it gets away; E before anything bites just reels in, and walking
// off or putting the rod away does too.
//
// On a farm the page rolls the catch itself; in a lobby the room does: CAST
// goes off, BITE comes back when something bites, REEL goes off and CAUGHT
// says what it was (main.js hands those two here).
//
//   E   cast / reel in / land it

const WALK_OFF = 0.7; // stepping this far from where we cast reels the line in
const LEEWAY = 150; // ms more than the window, on the page (a tap just as it closes)
const round2 = (v) => Math.round(v * 100) / 100;

// ---------- The line and the bobber ----------
// Drawn from a rod's tip to the water: ours, and everyone else's (src/remotes.js)
const SEGMENTS = 14;
const lineMat = new THREE.LineBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.8 });
const redMat = new THREE.MeshStandardMaterial({ color: 0xe0475b, roughness: 0.5 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
const halfBall = (material, flip) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), material);
  if (flip) mesh.rotation.x = Math.PI;
  return mesh;
};
let bangTexture = null; // the "!" over a bobber that dips (made once)
function bang() {
  if (bangTexture) return bangTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 110px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#3b2412';
  ctx.strokeText('!', 32, 66);
  ctx.fillStyle = '#ffd84a';
  ctx.fillText('!', 32, 66);
  bangTexture = new THREE.CanvasTexture(canvas);
  bangTexture.colorSpace = THREE.SRGBColorSpace;
  return bangTexture;
}

export function createTackle(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const points = new Float32Array((SEGMENTS + 1) * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const line = new THREE.Line(geo, lineMat);
  line.frustumCulled = false;
  const bobber = new THREE.Group();
  bobber.add(halfBall(redMat, false), halfBall(whiteMat, true));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 20).rotateX(-Math.PI / 2), ringMat.clone());
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: bang(), depthTest: false }));
  mark.scale.set(0.35, 0.7, 1);
  group.add(line, bobber, ring, mark);
  const top = new THREE.Vector3();

  return {
    // tip: where the rod's tip is; at: where the bobber floats ({ x, y, z },
    // y the water's surface); bite: it is dipping; t: seconds
    show(tip, at, bite, t) {
      group.visible = true;
      const bob = bite ? -0.07 + Math.sin(t * 20) * 0.05 : Math.sin(t * 2.3) * 0.015;
      bobber.position.set(at.x, at.y + 0.03 + bob, at.z);
      top.set(at.x, at.y + 0.1 + bob, at.z);
      // the line, sagging a little between the two
      const sag = 0.12 * tip.distanceTo(top);
      for (let i = 0; i <= SEGMENTS; i++) {
        const k = i / SEGMENTS;
        points[i * 3] = tip.x + (top.x - tip.x) * k;
        points[i * 3 + 1] = tip.y + (top.y - tip.y) * k - sag * 4 * k * (1 - k);
        points[i * 3 + 2] = tip.z + (top.z - tip.z) * k;
      }
      geo.attributes.position.needsUpdate = true;
      // a ripple going out, and the "!" over it, while it dips
      ring.visible = bite;
      mark.visible = bite;
      if (bite) {
        const k = (t * 1.8) % 1;
        ring.position.set(at.x, at.y + 0.02, at.z);
        ring.scale.setScalar(1 + k * 2.5);
        ring.material.opacity = 0.7 * (1 - k);
        mark.position.set(at.x, at.y + 0.75 + Math.abs(Math.sin(t * 8)) * 0.12, at.z);
      }
    },
    hide() {
      group.visible = false;
    },
    dispose() {
      scene.remove(group);
      geo.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
      mark.material.dispose();
      for (const half of bobber.children) half.geometry.dispose();
    },
  };
}

// ---------- Our own line ----------
// farmer: ours (src/character.js). player: { position, onGround }.
// waterAhead(): the water in front of us to cast into, { x, y, z, water } or
// null. hour(): the time of day, in game hours. lobby(): the lobby's
// connection while we are in one (null: on a farm, where the page rolls).
// rodInHand(): the rod's item id, or null. skill(): our fishing level
// (src/skills.js). landed(): something came up on the line (for the XP).
// sooner(): a lucky meal's factor on the wait for a bite (1: none).
export function createFishing({ scene, farmer, player, inventory, hud, touch, waterAhead, hour, lobby, rodInHand, skill, landed, sooner = () => 1 }) {
  const tackle = createTackle(scene);
  const tip = new THREE.Vector3();
  let line = null; // { n, rod, at, from, phase: 'out' | 'bite' | 'wait', conn, local, biteAt, closeAt }
  let castAt = -Infinity;
  let casts = 0;

  function cast(at) {
    const now = performance.now();
    if (now - castAt < CAST_EVERY) return;
    if (inventory.serialize().slots.every(Boolean)) {
      inventory.notify('Make some room in your backpack first');
      return;
    }
    castAt = now;
    const rod = rodInHand();
    const conn = lobby();
    line = { n: ++casts, rod, at, from: { x: player.position.x, z: player.position.z }, phase: 'out', conn, local: null };
    if (conn) {
      conn.send({ t: C.CAST, n: line.n, x: round2(at.x), z: round2(at.z), rod, level: skill(), ...(sooner() < 1 && { sooner: sooner() }) });
    } else {
      line.local = castLine(at.water, rod, hour(), skill(), Math.random, sooner());
      line.biteAt = now + line.local.bite * 1000;
    }
    farmer.swing(); // (a flick of the rod)
  }

  // Something bit: E within window ms
  function bite(window) {
    line.phase = 'bite';
    line.closeAt = performance.now() + window + LEEWAY;
    touch.setBite(true);
    try {
      navigator.vibrate?.(70);
    } catch {}
  }

  function end() {
    line = null;
    touch.setBite(false);
  }

  // What came up on the line: { item, count, items? } (item null: it got away)
  function land({ item, count, items }) {
    end();
    farmer.swing();
    if (!item) {
      inventory.notify('It got away…');
      return;
    }
    landed();
    if (items) {
      for (const [it, n] of items) inventory.add(it, n);
      const rare = items.find(([it]) => RARE[it]);
      hud.flash(rare ? `${RARE[rare[0]]}!` : 'A little chest!');
      return;
    }
    inventory.add(item, count);
    hud.flash(RARE[item] ? `${RARE[item]}!` : item === 'old_boot' ? 'An old boot…' : item === 'wood' ? 'Driftwood!' : `${ITEMS[item].name}!`);
  }

  // Reel in, nothing on it (walked off, put the rod away, left)
  function reelIn() {
    if (!line) return;
    if (line.conn && line.phase !== 'wait') line.conn.send({ t: C.REEL });
    end();
  }

  return {
    // E: cast, reel in or land it. False: nothing to do with fishing here.
    use() {
      if (line?.phase === 'bite') {
        if (line.conn) {
          line.conn.send({ t: C.REEL });
          line.phase = 'wait'; // (for CAUGHT)
          touch.setBite(false);
        } else {
          land(line.local);
        }
        return true;
      }
      if (line?.phase === 'out') {
        reelIn();
        inventory.notify('Reeled in');
        return true;
      }
      if (line) return true; // (waiting to hear what it was)
      if (!rodInHand()) return false;
      const at = waterAhead();
      if (!at) return false;
      cast(at);
      return true;
    },

    // from the lobby: BITE and CAUGHT ({ n, ... })
    bit(m) {
      if (line?.conn && m.n === line.n && line.phase === 'out') bite(m.window);
    },
    caught(m) {
      if (!line?.conn || m.n !== line.n) return;
      if (!m.item && line.phase === 'out') {
        end();
        inventory.notify('Your line came back: try another spot');
        return;
      }
      land(m);
    },

    // What E does now, for the prompt ('' : nothing fishy)
    prompt() {
      if (line) return line.phase === 'bite' ? 'E  Now!' : line.phase === 'out' ? 'E  Reel in' : '';
      return rodInHand() && waterAhead() ? 'E  Cast' : '';
    },
    // 'out', 'bite' or null, for the farmer's pose and what everyone else sees (STATEF)
    state: () => (line ? (line.phase === 'bite' ? 'bite' : 'out') : null),

    update(t) {
      if (line && line.phase !== 'wait' && (!rodInHand() || rodInHand() !== line.rod || Math.hypot(player.position.x - line.from.x, player.position.z - line.from.z) > WALK_OFF)) reelIn();
      const now = performance.now();
      if (line?.local && line.phase === 'out' && now >= line.biteAt) bite(line.local.window);
      if (line?.phase === 'bite' && now > line.closeAt) {
        if (line.conn) {
          end(); // (the lobby lets it go too; a CAUGHT for it finds no line)
          farmer.swing();
          inventory.notify('It got away…');
        } else {
          land({ item: null });
        }
      }
      farmer.anim.line = line ? (line.phase === 'bite' ? 'bite' : 'out') : null;
      if (!line) return tackle.hide();
      farmer.rodTip.getWorldPosition(tip);
      tackle.show(tip, line.at, line.phase === 'bite', t);
    },

    // Off somewhere else (a lobby, home, the title screen): the line comes in
    reset() {
      end();
      tackle.hide();
      farmer.anim.line = null;
    },
  };
}
