# Backlog

What's in flight, what's next, and what's waiting. Keep it short: when
something ships, move it to **Done** in one line (the README has the details);
when an idea comes up, add it under its theme. Ideas and the thinking behind
them live in [CONCEPTS.md](CONCEPTS.md).

Last updated: 2026-10-25

---

## In progress
Open pull requests, each from the backlog below:

- Split screen: up to four farmers at one screen on your farm, each on a
  controller of their own, with their own account's farmer (or a guest)

---

## Next up
1. [ ] **Weeds and crows**: first answer the open question below (do they fit
   a cozy game?), then build them as light as that answer says.

---

## Backlog by theme

### Farming
- [ ] Weeds that spread onto untilled ground and have to be hoed away
- [ ] Crows that land on crops and eat them unless you shoo them (a
      scarecrow keeps them off)
- [ ] The seed packets say the wrong times (turnip seeds: "about 20
      seconds"; a turnip takes 100, `CROP_GROW_TIME` in `shared/balance.js`)

### Beanstalk: plants as platforms
- [ ] A stone pumpkin to push, that holds down switches. It needs two things
      first: switches (or something else for it to do), and the pushed
      pumpkin kept in step on a farm with helpers (new messages, and saving
      where it was pushed to)
- [ ] Things up high on the farm that only plants reach (the concept's "a gem
      only the grown plant reaches")

### World
- [ ] Weather in lobbies too (the farm has it: #70)
- [ ] Forage in the valley on a farm with helpers too (now only while the farm is played alone)

### The neighbours
- [ ] Gifts: something each of them loves, once a day, for a heart
- [ ] More neighbours, each with a trade of their own (a carpenter for the workbench's upgrades? a blacksmith for tools?)
- [ ] Things at five hearts: a letter, a recipe, a visit to your farm (at 2 and 4 hearts they now share a moment: `shared/talk.js`)
- [ ] A festival in the valley once a season, every neighbour there (Mabel's feast, Rosa's fair and the bunting are for it)
- [ ] Errands once all seven requests are done, so there is always something to ask them
- [ ] Neighbours that walk the roads to each other's doors, and say so when you meet them
- [ ] Their homes in the seasons: a wreath, pumpkins on the porch, a snowman

### Together at one screen
- [ ] A split screen on a farm with online helpers (each farmer at the
      screen on a connection of their own to its room), and in lobbies
- [ ] A guest changing clothes at the wardrobe (an account's are changed
      in its own game)
- [ ] One view for everyone while they stand close together, splitting as
      they wander apart
- [ ] A dungeon's chests drawn as each farmer's own in their view (now as
      the first farmer in there has them; each one's prompt is their own)
- [ ] A farmer who gets up lets go of what they had: their windows' key
      listeners and their farmer's meshes stay till the page goes

### Tech
- [ ] Replace the simple AABB resolver with a physics engine (`cannon-es` or
      `rapier3d`) once shapes get more complex
- [ ] Make movement server-authoritative if cheating ever matters (a trade,
      #73, trusts each page with its own backpack, as dropping things does)

---

## Open questions
- How hard should falling be? (Now: no cost.)
- Do crows and weeds fit a cozy game, or should pressure stay very light?
- Should the Beanstalk climbing be on the home farm, or in its own zone? (Now: on the home farm.)

---

## Done
The big pieces so far, newest first:

- The neighbours' homes: a room of their own each, lived-in yards (a
  lighthouse, a porch, a terrace...), and what you do for them shows where
  they live (#99)
- Choosing what to say to the neighbours: numbered answers, a chat menu,
  moments they remember; seven requests each (a message that goes round the
  valley, a pick of reward), and signs over their heads (#99)
- A better farmer model, and a wardrobe to dress them: hats, hair, faces,
  tops, bottoms, aprons, shoes and scarves, kept with the account and seen
  by everyone; a wardrobe in the house too (#98)
- The workbench keeps its Make button for arrows (and anything that isn't a
  tool) after you have some (#95)
- Dungeons on the way to every boss: winding rooms with side rooms and loot
  chests, each boss's arena the last room (#91, #92, #93, #94)
- Steel, steel and silver swords, and a bow with arrows (#90, #89)
- Fixes for phones: a tap on Use keeps a window open, and windows fit a
  short screen (#87, #88)
- The farm grows into a valley five times its size, with biomes and forage,
  and four neighbours (Rosa, Basil, Finn, Mabel) with homes, a day of their
  own, shops and requests; the merchant keeps the basics (#86)
- Leaderboards for every lobby game (#85)
- Friends menu shows how long ago an offline friend was online (#84)
- Play with a controller (#83)
- Workbench crafting, a longer pickup reach, no page zoom on double tap (#82)
- The merchant's shop on shelves (#81)
- No flickering water and soil on phones (#80)
- Phones held upright: no overlapping HUD or backpack tabs (#79)
- The flower planter built from the Build tab (#78)
- Pick a party game when starting a lobby, and a loot run on the lobby's own island (#77)
- Seasons that look like seasons (#76)
- Visit a friend's farm to look round (#74)
- Trading between farmers in a lobby (#73)
- More Beanstalk plants: a bounce shroom, a lily leaf, cloud cotton (#72)
- More crops: tomatoes, pumpkins and berry bushes; the hoe digs a plant up (#71)
- Weather on the farm: rain that waters the crops, storms, snow in winter (#70)
- Generation 11 islands: a strawberry bank (#69)
- A fifth boss, the bog toad, with its arena and mount (#68)
- The hop race, a fourth party game: hop across the water to the flag (#67)
- Seasons on the farm (#66)
- Faster mounts, and riding one in a lobby (#65)
- The merchant's request of the day (#64)
- A vine bean that grows into a beanstalk to climb (#63)
- A collection book (#62)
- A glider leaf (#61)
- A watering can, and a big one that waters 3×3 (#60)
- A first-day guide for a new farmer (#59)
- Farms linked to accounts: log in on a new device and the farm comes with you
- Sound and music, made on the spot (no sound files), with M and the menu
  to turn them off; jump buffering and a lower jump when Jump is let go early
- Party games: king of the hill and last one standing, next to the coin
  rush and the fishing contest
- More fishing: weighed fish, a journal, bait, a contest, fish shadows, an
  aquarium
- Four bosses (evil parsnip, super lion, bee queen, giant crow), each with
  its arena and a mount
- An arcade on the farm: coinflip, blackjack, Lucky Hand
- Machines, cooking on a campfire and in the kitchen, a recipe book, dishes
  that give boosts, a shared feast
- Party games in lobbies: a coin rush
- Skills that level up by doing, and a double jump they unlock
- Pen upgrades and workbench levels
- Fishing: rods, a fish pond, catches rolled by the lobby
- Developer tools panel
- Building on the farm with wood and stone (fences, walls, paths, props,
  climbable blocks), a workbench, a house with a room and a kitchen
- Chopping and mining, on the farm and in lobbies; giant trees and rocks
- World generations: heath, wider islands, reed marsh, sky isles with relics
- Accounts with usernames, a friends list, starting a lobby with friends
- Helpers: friends farming on your farm, a shared farm chest
- Online lobbies, island seeds, chat, bopping other farmers
- The home farm: crops, animals, the merchant, day and night, saving
- Phone and tablet play, installable as an app
- Coyote time, squash & stretch, real-time shadows
