import * as THREE from 'three';
import { createFarmer, damp } from './character.js';
import { NPCS, NPC_IDS, MISSIONS, freshNpcState, currentMission, isOpen, progress, heartsFor, messagesFor } from '../shared/npcs.js';
import { chatTopics, momentsDue, hubOptions, hear as hearNode, rewardFor, cleanState } from '../shared/talk.js';
import { NPC_HOMES, npcDoor } from '../shared/farmland.js';
import { FRIENDSHIP } from '../shared/balance.js';
import { npcHomes, roomAt } from './npchomes.js';

// ---------- The neighbours ----------
// The folk of the valley (shared/npcs.js), in and about their homes
// (src/npchomes.js), by the farm's clock: up and pottering about indoors
// first thing, behind their counter through the day, out in their yard of an
// evening, and asleep in bed at night. They turn to watch you come over, and
// E (or a tap) talks to them (src/dialog.js): a chat, their shop, and what
// they would like you to do for them (missions), which is how their shop
// opens to you. Over the head of one with something for you there is a
// little sign: a "!" (a request to hear), a tick (one to hand over), a
// speech bubble (a message you carry to them) or a heart (a moment of
// theirs to share).
//
// Where you stand with each (met, their missions asked and done, how much
// they like you, what they have told you and what you answered) is yours,
// saved with your backpack (serialize()), and so are your deeds: how many
// times you have petted an animal (the first time each day), landed a fish,
// picked a crop, felled a tree, broken a rock or cooked a dish, for the
// missions that count them.

const TALK_REACH = 1.9; // to someone stood beside you
const COUNTER_REACH = 2.5; // to someone behind their counter, across it
const DOOR_REACH = 1.3;
const WATCH_RANGE = 6; // they turn to look at you inside this
const WALK_SPEED = 1.5;
const STAND_Y = 0.8; // (a farmer's middle, standing on the ground)
// Where each potters about in their yard of an evening, from their home's
// middle: [x, z, how high the ground is]
const YARD = {
  rosa: [[-3.6, 4.2], [2.4, 4], [0.4, 5.2], [-3.8, 1.6]],
  basil: [[-3.4, 2.4], [3.6, 3.2], [0.2, 4.4], [-3.6, 4.6]],
  finn: [[-2.4, 3.4], [2.2, 3.6], [0, 6.5, 0.3], [0, 9, 0.3]],
  mabel: [[-2.6, 4.6], [1.4, 4.2], [3.4, 3.2], [-0.6, 5]],
  bram: [[-2.2, 4.4], [1.6, 4.0], [3.4, 3.0], [0.4, 5.0]],
};

// Where a neighbour is at `hour` (of the farm's clock): 'sleep', 'home'
// (indoors, up), 'shop' (behind the counter) or 'yard'
export function routine(id, hour) {
  const [up, open, out, bed] = NPCS[id].hours;
  if (hour < up || hour >= bed) return 'sleep';
  if (hour < open) return 'home';
  if (hour < out) return 'shop';
  return 'yard';
}

// "z Z z", over someone asleep
function zzzSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 6;
  ctx.font = 'bold 30px "Trebuchet MS", system-ui, sans-serif';
  for (const [ch, x, y, size] of [['z', 14, 52, 24], ['Z', 46, 40, 34], ['z', 90, 24, 26]]) {
    ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
    ctx.strokeText(ch, x, y);
    ctx.fillText(ch, x, y);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

// The little signs over their heads, drawn in strokes (no font to depend on)
const SIGNS = {
  new: { back: '#f2b630', draw(c) { c.fillStyle = '#5b2b0a'; c.beginPath(); c.roundRect(28, 12, 8, 26, 4); c.fill(); c.beginPath(); c.arc(32, 47, 5, 0, Math.PI * 2); c.fill(); } },
  ready: { back: '#5fb84a', draw(c) { c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(17, 33); c.lineTo(28, 44); c.lineTo(48, 20); c.stroke(); } },
  message: { back: '#4f9fd8', draw(c) { c.fillStyle = '#fff'; for (const x of [18, 32, 46]) { c.beginPath(); c.arc(x, 33, 5, 0, Math.PI * 2); c.fill(); } } },
  moment: { back: '#e8668a', draw(c) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 46); c.bezierCurveTo(12, 32, 18, 16, 32, 26); c.bezierCurveTo(46, 16, 52, 32, 32, 46); c.fill(); } },
};
const signTextures = {};
function signSprite(kind) {
  if (!signTextures[kind]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d');
    c.fillStyle = '#3d1a04';
    c.beginPath();
    c.arc(32, 32, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SIGNS[kind].back;
    c.beginPath();
    c.arc(32, 32, 26, 0, Math.PI * 2);
    c.fill();
    SIGNS[kind].draw(c);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    signTextures[kind] = tex;
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTextures[kind], transparent: true, depthWrite: false }));
  sprite.scale.set(0.7, 0.7, 1);
  return sprite;
}
const SIGN_RANGE = 22; // they show from this far off

// parent: the farm's world root (they are only on the farm). Where a farmer
// stands with them is standing()'s: each farmer at the screen has their own
// (src/main.js seats), from their save; the signs over the neighbours' heads
// are each one's own (showSigns: in their own view of a split screen).
export function createNpcs({ parent }) {
  // ---------- The people ----------
  const people = {};
  for (const id of NPC_IDS) {
    const model = createFarmer({ shirt: NPCS[id].shirt, look: NPCS[id].look }); // (shared/looks.js, in colors of their own)
    model.hoe.visible = false;
    model.root.userData.noSnow = true; // (src/seasons.js)
    model.root.name = `npc-${id}`;
    parent.add(model.root);
    const zzz = zzzSprite();
    zzz.visible = false;
    parent.add(zzz);
    const signs = Object.fromEntries(Object.keys(SIGNS).map((kind) => {
      const sprite = signSprite(kind);
      sprite.visible = false;
      parent.add(sprite);
      return [kind, sprite];
    }));
    people[id] = { id, model, doing: null, at: new THREE.Vector3(), y: 0, yaw: 0, goal: null, wait: 0, zzz, greeted: false, signs, sign: null };
  }

  const roomOf = (id) => npcHomes.rooms[id];
  function stand(p, x, z, y = 0, yaw = 0) {
    p.at.set(x, y, z);
    p.yaw = yaw;
    p.goal = null;
  }
  // into what they do now (at the hour's turn, or when the farm is first shown)
  function begin(p, doing) {
    p.doing = doing;
    p.model.root.rotation.x = 0;
    const room = roomOf(p.id);
    if (!room) return;
    if (doing === 'sleep') stand(p, room.bed.x, room.bed.z, 0.15);
    else if (doing === 'home') stand(p, room.table.x, room.table.z, 0, room.table.yaw);
    else if (doing === 'shop') stand(p, room.counter.x, room.counter.z, 0, 0);
    else {
      const home = NPC_HOMES[p.id];
      const door = npcDoor(home);
      stand(p, door.x, door.z + 0.9, 0, 0);
      p.wait = 1 + Math.random() * 2;
    }
  }

  // pottering about the yard: from one spot to the next, a rest at each
  function wander(p, dt) {
    if (p.goal) {
      const dx = p.goal[0] - p.at.x;
      const dz = p.goal[1] - p.at.z;
      const d = Math.hypot(dx, dz);
      const step = WALK_SPEED * dt;
      if (d <= step) {
        p.at.set(p.goal[0], p.goal[2] ?? 0, p.goal[1]);
        p.goal = null;
        p.wait = 3 + Math.random() * 5;
      } else {
        p.at.x += (dx / d) * step;
        p.at.z += (dz / d) * step;
        p.at.y += ((p.goal[2] ?? 0) - p.at.y) * damp(6, dt);
        p.yaw = Math.atan2(dx, dz);
      }
      return true;
    }
    if ((p.wait -= dt) > 0) return false;
    const home = NPC_HOMES[p.id];
    const spots = YARD[p.id];
    const [x, z, y] = spots[Math.floor(Math.random() * spots.length)];
    p.goal = [home.x + x, home.z + z, y];
    return true;
  }

  // dt, t: game time; you: the farmers' positions (they watch the nearest);
  // hour: the farm's clock; signs: which sign each shows (a standing's signs())
  function update(dt, t, you, hour, signs = {}) {
    npcHomes.setHour(hour);
    const farmers = [you].flat();
    for (const p of Object.values(people)) {
      const doing = routine(p.id, hour);
      if (doing !== p.doing) begin(p, doing);
      const moving = p.doing === 'yard' && wander(p, dt);
      const asleep = p.doing === 'sleep';
      // they watch you come over (behind the counter, without turning their back on it)
      const you = farmers.reduce((a, b) => (Math.hypot(b.x - p.at.x, b.z - p.at.z) < Math.hypot(a.x - p.at.x, a.z - p.at.z) ? b : a));
      const dx = you.x - p.at.x;
      const dz = you.z - p.at.z;
      const near = !moving && !asleep && Math.hypot(dx, dz) < WATCH_RANGE && Math.abs(you.y - STAND_Y - p.at.y) < 2;
      let yaw = p.yaw;
      if (near) yaw = p.doing === 'shop' ? THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.1, 1.1) : Math.atan2(dx, dz);
      if (near && Math.hypot(dx, dz) < TALK_REACH + 0.6 && !p.greeted) {
        p.greeted = true;
        p.model.anim.squash = -0.25; // a little hop hello
      } else if (!near) p.greeted = false;
      p.model.root.position.set(p.at.x, STAND_Y + p.at.y, p.at.z);
      p.model.animate(dt, { moving, onGround: true, targetYaw: asleep ? 0 : yaw, time: t });
      if (asleep) {
        p.model.anim.facing = 0;
        p.model.root.rotation.set(-Math.PI / 2, 0, 0); // (on their back, head to the wall)
        p.model.root.position.y = 0.82;
      }
      p.zzz.visible = asleep;
      if (asleep) p.zzz.position.set(p.at.x + 0.4, 1.5 + Math.sin(t * 1.5) * 0.12, p.at.z - 0.5);
      p.bob = Math.sin(t * 2.2 + p.at.x) * 0.07;
    }
    showSigns(signs, farmers[0]);
  }
  // The sign over each one's head, if they have something for you (signs: a
  // standing's signs(); you: where you are)
  function showSigns(signs, you) {
    for (const p of Object.values(people)) {
      for (const [kind, sprite] of Object.entries(p.signs)) {
        sprite.visible = p.doing !== 'sleep' && signs[p.id] === kind && Math.hypot(you.x - p.at.x, you.z - p.at.z) < SIGN_RANGE;
        if (sprite.visible) sprite.position.set(p.at.x, p.at.y + 2.5 + (p.bob ?? 0), p.at.z);
      }
    }
  }

  // ---------- Reaching them ----------
  // The one you can talk to from `pos` (id), or null
  function talkable(pos) {
    let best = null;
    let bestD = Infinity;
    for (const p of Object.values(people)) {
      const reach = p.doing === 'shop' ? COUNTER_REACH : TALK_REACH;
      const d = Math.hypot(pos.x - p.at.x, pos.z - p.at.z);
      if (d < reach && d < bestD && Math.abs(pos.y - STAND_Y - p.at.y) < 1.2) {
        best = p.id;
        bestD = d;
      }
    }
    return best;
  }
  // Whose door you are at, outside (id), or null
  function doorInReach(pos) {
    if (pos.y > 2.2) return null;
    for (const [id, home] of Object.entries(NPC_HOMES)) {
      const door = npcDoor(home);
      if (Math.hypot(pos.x - door.x, pos.z - (door.z + 0.6)) < DOOR_REACH) return id;
    }
    return null;
  }
  // Whose room you are at the door of, inside (id), or null
  function exitInReach(pos) {
    const id = roomAt(pos.x, pos.z);
    const room = id && roomOf(id);
    return room && Math.hypot(pos.x - room.exit.x, pos.z - room.exit.z) < DOOR_REACH ? id : null;
  }
  // Where to put the farmer going in (inside the door) or out (before it)
  const entry = (id) => roomOf(id).entry;
  const outside = (id) => {
    const door = npcDoor(NPC_HOMES[id]);
    return { x: door.x, z: door.z + 0.9 };
  };

  return {
    update,
    showSigns,
    talkable,
    doorInReach,
    exitInReach,
    entry,
    outside,
    inside: (pos) => roomAt(pos.x, pos.z),
    doing: (id) => people[id].doing,
    asleep: (id) => people[id].doing === 'sleep',
    roots: () => Object.values(people).map((p) => [p.id, p.model.root]),
    standing,
  };
}

// ---------- Where a farmer stands with them ----------
// inventory: the farmer's backpack (count, remove, add, earn, canAdd). ctx():
// what their missions are checked against ({ have(item), built(piece) },
// main.js). onMends(mended): Finn's dock as they see it (the farm shows it
// mended if it is for anyone at the screen). story: what shows of the
// neighbours' homes and yards is theirs (the farm's own farmer's).
function standing({ inventory, ctx, onMends = (on) => npcHomes.dock.mend(on), story = true }) {
  let states = Object.fromEntries(NPC_IDS.map((id) => [id, freshNpcState()]));
  let deeds = {};

  // The farm as you see it: Finn's dock mended once you have done that for him
  const mended = () => Object.values(MISSIONS).some((m) => m.gives.mends === 'dock' && states[m.npc].done.includes(m.id));
  const showMends = () => onMends(mended());

  const state = (id) => states[id];
  const hearts = (id) => heartsFor(states[id].points, FRIENDSHIP);
  const like = (id, points) => {
    states[id].points = Math.min(states[id].points + points, FRIENDSHIP.perHeart * FRIENDSHIP.hearts);
    showStory(id);
  };
  // Where you stand with id, as what they say is checked against (shared/talk.js `holds`)
  const view = (id) => ({
    hearts: hearts(id),
    done: (m) => !!MISSIONS[m] && states[MISSIONS[m].npc].done.includes(m),
    heard: (m) => !!MISSIONS[m] && states[MISSIONS[m].npc].heard.includes(m),
    met: (other) => !!states[other]?.met,
    chose: (key) => states[id].chose[key],
  });
  // What shows of their home and yard, for how you stand with them (src/npchomes.js)
  const showStory = (id) => story && npcHomes.show(id, view(id));
  const showAll = () => NPC_IDS.forEach(showStory);

  // Give what a reward has in it (gold, items): false, and nothing given, if
  // the backpack hasn't room for the items
  const fits = (items) => items.every(([item, n]) => inventory.canAdd(item, n));
  const give = ({ gold, items }) => {
    if (gold) inventory.earn(gold);
    for (const [item, n] of items ?? []) inventory.add(item, n);
  };

  // What there is to tell (ctx: { have(item), built(piece) } for the
  // missions): their mission now, asked or not, and how far it has come
  function status(id, ctx) {
    const s = states[id];
    const mission = currentMission(id, s);
    if (!mission) return { mission: null };
    const heard = s.heard.includes(mission.id);
    const needs = progress(mission, s, { have: ctx.have, deeds, built: ctx.built });
    return { mission, heard, needs, ready: heard && needs.every((n) => n.ok) };
  }

  // which sign each of them shows you: the most pressing thing they have
  // for you (a request to hand over, then a message to tell, a moment to
  // share, a request to hear)
  const signs = {};
  let signCheck = 0;
  function updateSigns(dt) {
    if ((signCheck -= dt) > 0) return;
    signCheck = 0.5;
    const here = ctx();
    for (const id of NPC_IDS) {
      const st = status(id, here);
      let sign = null;
      if (st.mission && st.heard && st.ready) sign = 'ready';
      else if (messagesFor(id, states, deeds).length) sign = 'message';
      else if (momentsDue(id, states[id], view(id)).length) sign = 'moment';
      else if (st.mission && !st.heard) sign = 'new';
      signs[id] = sign;
    }
  }

  showAll(); // (a new farmer has no save to read: what shows with nothing done yet, shows)

  return {
    // Each frame (dt: game time): the signs over their heads, as they are for you now
    updateSigns,
    signs: () => signs,

    state,
    hearts,
    status,
    view,
    // What there is to say to them: the window's first list (src/dialog.js),
    // their Chat menu, and what you carry to tell them
    hub: (id, here) => hubOptions({ npc: id, state: states[id], c: view(id), status: status(id, here), messages: messagesFor(id, states, deeds) }),
    topics: (id) => chatTopics(id, states[id], view(id)),
    shopOpen: (id, shelf) => isOpen(id, states[id], shelf),
    // what their shop takes off its prices, for how much they like you (0 to 1)
    discount: (id) => hearts(id) * FRIENDSHIP.discount,

    // Saying hello: true the first time (their introduction is due)
    meet(id) {
      const first = !states[id].met;
      states[id].met = true;
      return first;
    },
    // A chat: true if it is the first today (they like you a little more for it)
    chat(id, day) {
      if (states[id].chatDay === day) return false;
      states[id].chatDay = day;
      like(id, FRIENDSHIP.chat);
      return true;
    },
    // Hear a node of what they say (shared/talk.js): what it gave ({ points,
    // gives }, or null: nothing, or not the first time), or { full: true } if
    // the backpack has no room for what it gives (and nothing happened)
    hear(id, node) {
      const reward = rewardFor(node, states[id]);
      if (reward?.gives?.items && !fits(reward.gives.items)) return { full: true };
      hearNode(node, states[id]);
      if (reward) {
        like(id, reward.points);
        if (reward.gives) give(reward.gives);
      }
      if (node.keep) showStory(id); // (what you said, remembered where they live)
      return reward;
    },
    // You tell `to` what you carry for them from `from`: what you told, and
    // what they answer ({ say, reply }), or null (nothing for them)
    tell(to, from) {
      const mission = messagesFor(to, states, deeds).find((m) => m.from === from)?.mission;
      if (!mission) return null;
      deeds[`tell:${to}`] = (deeds[`tell:${to}`] ?? 0) + 1;
      return mission.message;
    },
    // They ask you their mission now (counting deeds from here)
    listen(id) {
      const s = states[id];
      const mission = currentMission(id, s);
      if (!mission || s.heard.includes(mission.id)) return mission;
      s.heard.push(mission.id);
      s.since[mission.id] = { ...deeds };
      return mission;
    },
    // Hand over what their mission needs: what it gave ({ mission, gold,
    // items }), or null (not ready, or no choice of the reward you were to
    // pick: `pick` is the place of your choice in what the mission lets you
    // choose from), or { full: true } (no room in the backpack for what it gives)
    handOver(id, ctx, pick = 0) {
      const st = status(id, ctx);
      if (!st.ready) return null;
      const { mission } = st;
      const choice = mission.gives.choose ? mission.gives.choose[pick] : null;
      if (mission.gives.choose && !choice) return null;
      const gives = [...(mission.gives.items ?? []), ...(choice?.items ?? [])];
      const gold = (mission.gives.gold ?? 0) + (choice?.gold ?? 0);
      if (!fits(gives)) return { full: true };
      for (const { need } of st.needs) {
        if (need.item) inventory.remove(need.item, need.count);
        else if (need.items) {
          let left = need.count;
          for (const item of need.items) {
            const n = Math.min(left, inventory.count(item));
            if (n) inventory.remove(item, n);
            left -= n;
          }
        }
      }
      const s = states[id];
      s.done.push(mission.id);
      delete s.since[mission.id];
      like(id, FRIENDSHIP.mission); // (and what it changes where they live)
      give({ gold, items: gives });
      if (mission.gives.mends) showMends();
      return { mission, gold, items: gives, choice };
    },

    // ---------- Deeds ----------
    did(deed, n = 1) {
      deeds[deed] = (deeds[deed] ?? 0) + n;
    },
    deeds: () => ({ ...deeds }),

    // ---------- Saving ----------
    serialize: () => ({ deeds: { ...deeds }, people: structuredClone(states) }),
    // (a save from before the neighbours: everyone not met yet)
    restore(saved) {
      states = Object.fromEntries(NPC_IDS.map((id) => [id, cleanState(id, saved?.people?.[id])]));
      deeds = Object.fromEntries(Object.entries(saved?.deeds && typeof saved.deeds === 'object' ? saved.deeds : {}).filter(([, n]) => Number.isInteger(n) && n >= 0));
      showMends();
      showAll();
    },
    showMends,
    mended,
    showAll,
    // (the developer tools: their mission now, done, as if handed over, and
    // what it gives given (the first of a choice of rewards); nothing taken.
    // The mission, or null: none left)
    finish(id) {
      const s = states[id];
      const mission = currentMission(id, s);
      if (!mission) return null;
      s.met = true;
      if (!s.heard.includes(mission.id)) s.heard.push(mission.id);
      s.done.push(mission.id);
      delete s.since[mission.id];
      like(id, FRIENDSHIP.mission);
      const choice = mission.gives.choose?.[0];
      give({ gold: (mission.gives.gold ?? 0) + (choice?.gold ?? 0), items: [...(mission.gives.items ?? []), ...(choice?.items ?? [])] });
      if (mission.gives.mends) showMends();
      return mission;
    },
    // (and some hearts, to see what they are good for)
    befriend(id, hearts = FRIENDSHIP.hearts) {
      states[id].met = true;
      states[id].points = Math.min(FRIENDSHIP.perHeart * FRIENDSHIP.hearts, Math.max(states[id].points, hearts * FRIENDSHIP.perHeart));
      showStory(id);
    },
    // (and everyone forgotten)
    reset() {
      states = Object.fromEntries(NPC_IDS.map((id) => [id, freshNpcState()]));
      deeds = {};
      showMends();
      showAll();
    },
  };
}
