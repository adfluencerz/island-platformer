// What has to happen before something opens up: a blueprint for a piece
// (BLUEPRINTS), a level of an upgrade (BENCH_LEVELS, PEN_LEVELS `needs`), a
// boss's portal (BOSSES `after`). One shape for all of them, each part of
// which has to hold:
//   { done: a neighbour's request id (or a list of them),
//     skills: { skill: level }, beaten: a boss id (or a list),
//     hearts: { neighbour: hearts } }
// Plain rules, so a test can check them; the page says what it knows of you
// (c below: src/main.js unlockView).
import { BLUEPRINTS, BOSSES, BENCH_LEVELS, PEN_LEVELS } from './balance.js';
import { MISSIONS, NPCS } from './npcs.js';
import { SKILL_LIST } from './skills.js';

const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const skillName = (id) => SKILL_LIST.find((s) => s.id === id)?.name ?? id;

// '' when cond holds (or there is none), else what is still to do, in words:
// "Help Bram with “Raising the barn” first". c: { done(mission) -> bool,
// skill(id) -> level, beaten(boss) -> bool, hearts(npc) -> hearts }
export function unlockProblem(cond, c) {
  if (!cond) return '';
  for (const id of list(cond.done)) {
    if (c.done(id)) continue;
    const m = MISSIONS[id];
    return m ? `Help ${NPCS[m.npc].name} with “${m.title}” first` : 'Not yet';
  }
  for (const [id, level] of Object.entries(cond.skills ?? {})) {
    if (c.skill(id) < level) return `Takes ${skillName(id)} level ${level}`;
  }
  for (const boss of list(cond.beaten)) {
    if (!c.beaten(boss)) return `Beat the ${BOSSES[boss]?.name ?? boss} first`;
  }
  for (const [npc, hearts] of Object.entries(cond.hearts ?? {})) {
    if (c.hearts(npc) < hearts) return `Takes ${hearts} hearts with ${NPCS[npc]?.name ?? npc}`;
  }
  return '';
}

// What it takes before piece can be built, or null: nothing
export function blueprintCond(piece) {
  if (BLUEPRINTS[piece]) return BLUEPRINTS[piece];
  const boss = Object.keys(BOSSES).find((id) => piece === `${id}_portal`);
  return boss && BOSSES[boss].after ? { beaten: BOSSES[boss].after } : null;
}

// Why piece can't be built yet ('': it can). kept: the pieces this farmer had
// built before they needed a blueprint (theirs to build again)
export const blueprintProblem = (piece, c, kept = new Set()) => (kept.has(piece) ? '' : unlockProblem(blueprintCond(piece), c));

// The upgrades, by id, each its list of levels (as src/main.js has them)
export const UPGRADE_LEVELS = { workbench: BENCH_LEVELS, yard: PEN_LEVELS.yard, pasture: PEN_LEVELS.pasture };

// What doing a request opens up, besides what it gives: { blueprints: [piece
// ids], upgrades: [[upgrade id, level]] } (for the window, and a test)
export function unlocksOf(missionId) {
  const blueprints = Object.keys(BLUEPRINTS).filter((piece) => list(BLUEPRINTS[piece].done).includes(missionId));
  const upgrades = [];
  for (const [id, levels] of Object.entries(UPGRADE_LEVELS)) {
    levels.forEach((level, i) => list(level.needs?.done).includes(missionId) && upgrades.push([id, i + 1]));
  }
  return { blueprints, upgrades };
}
