import './skills.css';
import { DOUBLE_JUMP, SKILLS } from '../shared/balance.js';
import { SKILL_LIST, levelOf, xpAt, cleanSkills, overallLevel, canDoubleJump, bonusChance, swingsAt, perksAt } from '../shared/skills.js';

// ---------- Skills ----------
// The XP you have earned in each skill (shared/skills.js), saved with the
// backpack (it is yours, wherever you farm), and the Skills tab in the bag.
// gain() adds XP for something done and says when a level comes up; extra()
// rolls a skill's bonus (one more of what was got).
//
// onLevelUp(title, detail): a skill went up a level (title: for the big
// notice, detail: what it gives now)
export function createSkills({ onLevelUp } = {}) {
  let xps = cleanSkills(null);

  const level = (id) => levelOf(xps[id]).level;

  function gain(id, xp) {
    if (!(id in xps) || !(xp > 0)) return;
    const before = level(id);
    const jumpBefore = canDoubleJump(xps);
    xps[id] = cleanSkills({ ...xps, [id]: xps[id] + xp })[id];
    const now = level(id);
    if (now === before) return;
    const name = SKILL_LIST.find((s) => s.id === id).name;
    const perks = perksAt(id, now); // (the swing less, the level it comes)
    const detail = !jumpBefore && canDoubleJump(xps)
      ? 'You can double jump now: press Jump again in the air!'
      : `${now === SKILLS.fewerSwings && perks[1] ? perks[1] : perks[0]} · Overall level ${overallLevel(xps)}`;
    onLevelUp?.(`${name} level ${now}!`, detail);
  }

  // 1 (one more) or 0, by the skill's bonus at its level
  const extra = (id) => (Math.random() < bonusChance(id, level(id)) ? 1 : 0);

  // ---------- The Skills tab ----------
  function el(tag, className, parent, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    parent?.appendChild(node);
    return node;
  }

  function render(root) {
    root.textContent = '';
    const overall = overallLevel(xps);
    const head = el('div', 'sk-head', root);
    el('b', 'sk-overall', head, `Overall level ${overall}`);
    const left = DOUBLE_JUMP.level - overall;
    el('span', 'sk-goal' + (left <= 0 ? ' done' : ''), head, left <= 0
      ? 'Double jump unlocked: press Jump again in the air'
      : `Double jump at overall level ${DOUBLE_JUMP.level}: ${left} level${left === 1 ? '' : 's'} to go`);
    const list = el('div', 'sk-list', root);
    for (const skill of SKILL_LIST) {
      const { level: lv, into, need } = levelOf(xps[skill.id]);
      const card = el('div', 'sk-card' + (skill.soon ? ' soon' : ''), list);
      const top = el('div', 'sk-top', card);
      el('b', 'sk-name', top, skill.name);
      el('span', 'sk-level', top, `Level ${lv}`);
      const bar = el('div', 'sk-bar', card);
      el('div', 'sk-fill', bar).style.width = need ? `${(into / need) * 100}%` : '100%';
      el('div', 'sk-xp', card, skill.soon ? 'Coming later' : need ? `${into} / ${need} XP · ${skill.does}` : `Top level · ${skill.does}`);
      for (const perk of perksAt(skill.id, lv)) el('div', 'sk-perk', card, perk);
    }
  }

  return {
    gain,
    extra,
    level,
    overall: () => overallLevel(xps),
    canDoubleJump: () => canDoubleJump(xps),
    // swings for a tree or rock: the tool's count, one fewer at a high enough level
    swings: (base, id) => swingsAt(base, level(id)),
    render,
    serialize: () => ({ ...xps }),
    // (the developer tools) every skill at the start of `by` levels up or down
    shift(by) {
      xps = cleanSkills(Object.fromEntries(Object.keys(xps).map((id) => [id, xpAt(level(id) + by)])));
    },
    restore(saved) {
      xps = cleanSkills(saved);
    },
  };
}
