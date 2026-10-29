# 46 Characters at the low camera

Goal: At the low wide camera (phase 32) the farmer, the neighbours, the
merchant, the animals and the dungeon's foes read at a glance at their now
small size on screen and sit in the grass instead of floating over it, as
the figures in the Breath of the Wild references do: a soft dark outline, a
warm rim from the sun, a lit top and a shaded underside, a grounded contact
shadow; instead of small, flat figures with no edge that hover over the
carpet at dusk and on the low tier.

- A contact shadow (`src/character.js` `contactShadow()`): a soft dark blob
  on the ground under each farmer (the player, the others, the neighbours,
  the merchant; not the wardrobe's, whose stage has its own), each hen, cow
  and sheep (`src/animals.js`) and each dungeon foe (`src/dungeonfoes.js`,
  in place of its hard black disc). One plane and one material for all of
  them (one new program), one draw each; kept on the ground under a jump,
  smaller the higher, longer under a mount, hidden for a neighbour in bed.
- The rim keyed to the sun and the moon (the `rim` hook every farmer,
  animal and mount material shares): besides the sky's narrow band all
  round, the edges facing the sun catch its light, most when it is behind
  them (a warm edge walking into a low sun, a cool one from the moon); what
  faces well down is darker (under a brim, a belly); metal (a blade, brass,
  a bell, a gold animal) gets a small glint of the sun. Same programs.
- The outline on medium too (`src/gfx/quality.js` `outline`), pushed out
  across the view in the vertex shader, a little more the further off, so
  it stays about a pixel wide at the low camera and as thin as before up
  close (the wardrobe). One draw a farmer, as on high.
- Cloth with more contrast (`src/character.js` cloth pictures): the plain
  weave's threads further apart in shade with a soft mottle, the denim's
  twill, the knit's ridges and the plaid's check deeper.
- Name tags, the wardrobe's stage, the world, the sky and the buildings
  unchanged; within the budgets; the low tier sane (the blob, no outline).
- Done when: on `plaza-noon` and `phone` the farmer has a dark edge, sits
  on a soft shadow and reads against the grass and stone; on `night-lamps`
  Mabel and the farmer stand on their shadows by the lamp and read; on
  `phone-forest-dusk` the farmer has a warm rim and an edge against the
  dark grass; everything else as before; within the budgets.
  Proof: `plaza-noon`, `phone`, `night-lamps`, `phone-forest-dusk`.

## Notes (round 46)
- Before -> after (calls / triangles / programs): plaza-noon (high) 656 / 759k / 48 -> 695 / 764k / 48;
  phone (medium) 578 / 515k / 44 -> 586 / 537k / 45 (the outline's program and hull, now on medium);
  phone-forest-dusk (medium) 360 / 508k / 45 -> 364 / 518k / 46. Calls drift ±20 between runs.
- The contact blob sits 0.06 over the feet, so it shows between the carpet's blades; where the carpet
  is thick and tall (the forest at dusk) it is mostly hidden by the blades in front, and the outline
  and the rim do the work there. A world round could darken the carpet's own blades round `uPlayers`.
- `lightFarmers()` (main.js) still sets the sky's part of the rim; the sun's part reads `uSunDir` and
  `uSunColor` (src/gfx/uniforms.js) directly, so a lighting round that retunes the sun changes it too
  (`RIM.sun` in src/character.js scales it).
- Not done: boots and brims kept their colors (the look's swatches in the wardrobe stay true); the
  underside darkening shades the brim's underside instead.
