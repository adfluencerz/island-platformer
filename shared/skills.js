// ---------- Skills ----------
// Five skills that level up by doing: farming (planting, harvesting), animals
// (petting, milking, eggs, shearing), fishing (once there is fishing),
// woodcutting and mining. Each is kept as the XP earned in it; its level
// comes from that (SKILLS.next, shared/balance.js), from 1 to SKILLS.max.
// Every level past 1 gives a small bonus (SKILLS.bonus), and the overall
// level, all of them added up, unlocks the double jump at DOUBLE_JUMP.level.
//
// Pure JS: the page keeps the XP with the save (src/skills.js).
import { SKILLS, DOUBLE_JUMP } from './balance.js';

// In the order the Skills tab shows them. soon: not in the game yet
export const SKILL_LIST = [
  { id: 'farming', name: 'Farming', does: 'Planting and harvesting' },
  { id: 'animals', name: 'Animals', does: 'Petting, milking, eggs and shearing' },
  { id: 'woodcutting', name: 'Woodcutting', does: 'Felling trees' },
  { id: 'mining', name: 'Mining', does: 'Breaking rocks' },
  { id: 'fishing', name: 'Fishing', does: 'Catching fish', soon: true },
];
export const SKILL_IDS = SKILL_LIST.map((s) => s.id);

const MOST_XP = SKILLS.next.reduce((a, b) => a + b, 0); // (all the way to the top level)

// The level xp makes, and how far it is on to the next: { level, into, need } (need 0: the top)
export function levelOf(xp) {
  let left = Math.max(0, Math.min(MOST_XP, Number(xp) || 0));
  let level = 1;
  while (level < SKILLS.max && left >= SKILLS.next[level - 1]) left -= SKILLS.next[level++ - 1];
  return { level, into: level < SKILLS.max ? left : 0, need: level < SKILLS.max ? SKILLS.next[level - 1] : 0 };
}

// A saved { skill: xp } as one with every skill, keeping only sensible numbers
export function cleanSkills(saved) {
  const out = {};
  for (const id of SKILL_IDS) {
    const xp = Number(saved?.[id]);
    out[id] = Number.isFinite(xp) && xp > 0 ? Math.min(MOST_XP, Math.floor(xp)) : 0;
  }
  return out;
}

// All the levels added up
export const overallLevel = (xps) => SKILL_IDS.reduce((sum, id) => sum + levelOf(xps[id]).level, 0);

export const canDoubleJump = (xps) => overallLevel(xps) >= DOUBLE_JUMP.level;

// The chance at this level of one more of what the skill gives
export const bonusChance = (id, level) => (SKILLS.bonus[id] ?? 0) * (level - 1);

// Swings for a tree or rock that takes `base` (the tool's own count), at this level
export const swingsAt = (base, level) =>
  level >= SKILLS.fewerSwings ? Math.max(Math.min(base, SKILLS.leastSwings), base - 1) : base;

// What a level gives, for the Skills tab
export function perksAt(id, level) {
  const pct = Math.round(bonusChance(id, level) * 100);
  const extra = { farming: 'an extra crop', animals: 'an extra egg, milk or wool', woodcutting: 'an extra log', mining: 'an extra stone' }[id];
  const perks = [];
  if (id === 'fishing') perks.push(pct ? `Bites come ${pct}% sooner` : 'Bites come sooner as you level up');
  else perks.push(pct ? `${pct}% chance of ${extra}` : `Each level: more chance of ${extra}`);
  if (id === 'woodcutting' || id === 'mining') {
    perks.push(level >= SKILLS.fewerSwings ? `One swing less for each ${id === 'mining' ? 'rock' : 'tree'}` : `Level ${SKILLS.fewerSwings}: one swing less for each ${id === 'mining' ? 'rock' : 'tree'}`);
  }
  return perks;
}
