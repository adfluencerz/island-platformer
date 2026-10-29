# 29 The HUD

Goal: The HUD reads like the thin, warm HUD of the sunny-coast reference:
light, see-through parchment panels that sit quietly over the painterly
world, not flat orange boards with hard dark borders crowding the corners.

- One frame for everything (`.inv-frame`, `src/inventory.css`): a cream
  parchment fill with a soft inner shadow, a thin warm-brown border with
  slightly uneven, hand-drawn-feeling corners and a soft drop shadow,
  instead of the dark outline and the stacked orange bevels. The palette's
  tokens (`--inv-*`) move from saturated orange to cream, sand and a muted
  terracotta, so the menus, the backpack, the shop, dialogs and the touch
  controls match it for free.
- The in-game panels (the place panel, the first-day guide, the clock, the
  gold, the toolbar, build mode, a lobby's party card) are see-through
  (`--hud-bg`), smaller and quieter: the clock (`src/daynight.css`) uses the
  same frame, the gold's digits are light slots with ink numbers, the
  toolbar's slots soft cream wells with a terracotta ring for the one in hand.
- The place panel (`src/ui/hud.js`, `src/ui/ui.css`): its hint on one
  line, cut short, next to the farm's name at home ("My farm  Hint: Till,
  plant…"), the rest (the whole hint, Esc: menu) on hover or a tap; the
  first-day guide (`src/ui/guide.css`) as wide as it, in smaller type.
- Chat and the pickup notices: no box, light text with a soft dark shadow,
  readable on bright grass and at night; the prompt over the toolbar a
  light pill.
- Pure CSS plus a class and a click on the place panel: no DOM ids or
  classes the tests or the browser harness use change, no gameplay, no GPU
  cost (stats unchanged).
- Done when: on every proof shot the HUD panels are light, see-through and
  warm with soft borders; the place panel at home is one line and the guide
  card compact, so the top left no longer crowds the scene; chat and notices
  read on grass and at night without a box; the phone (390x844) and both
  split seats keep every control and all text readable; the lobby panel,
  party card and menus match.
  Proof: `plaza-noon`, `phone`, `lobby`, `split-2`, `night-lamps`.
