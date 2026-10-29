# 52 The title screen

Goal: The first thing a player sees (the title screen, untouched since phase
0 but for round 29's palette) is a proper first impression, in the spirit of
Breath of the Wild's: the live farm behind it, framed by a slow cinematic
camera at a golden late afternoon, a handsome hand-lettered logo, a parchment
card of a few clear warm buttons, nothing cluttered; and the in-game menu
(Esc, or the Menu button) matches it.

- Shots (`scripts/shots.mjs`): `title` (desktop, 960x600) and `title-phone`
  (390x844, touch): the page as it first opens, logged in, before Go to my
  farm; `menu`: the in-game menu open over the plaza (Esc). On the contact
  sheet, not in the `--check` budget list.
- The title camera (`src/main.js`, `TITLE_CAM`): a slow drift on the south
  side of the old farm, looking north over the plaza, the platforms and the
  forest to the horizon, at the wide camera's lens and angle (the horizon high
  in the frame, the sky behind the logo), always well above the ground, the
  platforms and the trees. On a wide screen the farm sits right of the card;
  upright, between the logo and the card. Its fog and shadows round what it
  sees.
- The title's hour (`src/daynight.js` `showHour`, additive): the light, sky
  and lamps as at a golden late afternoon while the title is up, the farm's
  own clock untouched (it still waits behind the menu); back to the clock's
  hour on the farm.
- The logo (`src/ui/splash.js`, `src/ui/ui.css`): out of the card and over the
  world, in a playful rounded hand-lettered face (Google Fonts, with a
  fallback), a warm gold-to-amber gradient fill, a dark brown outline and a
  soft drop shadow, its two words tilted a little each way.
- The card: round 29's parchment, a touch see-through with a soft blur behind
  it only; the big warm Go to my farm (Resume in game) on top, the pages as a
  two-column grid of light buttons, Sound, Music, Graphics, Camera and View
  grouped small at the bottom. A vignette darkens the edges and the card's
  side only, so the world stays clear.
- Layouts: a wide screen has the logo and the card in a column on the left,
  the world open on the right; a phone held upright the logo at the top and
  the card in the bottom part, the world between; the welcome (logging in,
  making an account) the same; the in-game menu the card centred with a small
  logo over it, the world dimmed softly round it.
- Every button, id, label and flow as before (log in, make an account,
  invitations, add a farmer, settings): markup only added to (the logo's
  words, a class or two, a wrapper round the settings rows).
- No new draw calls in the game; the title camera only.
- Done when: `title` and `title-phone` read as a handsome first impression,
  the farm in golden light clearly visible behind a hand-lettered logo and a
  tidy warm card; `menu` matches it over the plaza; `plaza-noon` and the other
  shots are as before; the browser flow (Go to my farm, Esc, Resume, the
  pages) works; within the budgets.
  Proof: `title`, `title-phone`, `menu`, `plaza-noon`.
