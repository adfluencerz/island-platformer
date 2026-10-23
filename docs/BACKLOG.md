# Backlog

What's in flight, what's next, and what's waiting. Keep it short: when
something ships, move it to **Done** in one line (the README has the details);
when an idea comes up, add it under its theme. Ideas and the thinking behind
them live in [CONCEPTS.md](CONCEPTS.md).

Last updated: 2026-10-23

---

## In progress
Nothing open right now.

---

## Next up
Picked to go first, roughly in this order:

1. [ ] **Sound and music.** The game is silent: footsteps, jumps, tool swings,
   pickups, the merchant's till, animals, a boss fight, and a calm tune for the
   farm that changes at night. A mute switch in the menu.
2. [ ] **Better jumping.** Jump buffering (a Jump pressed just before landing
   still jumps) and a variable jump height (letting go early jumps lower).
   Coyote time, the double jump and squash & stretch are already in.
3. [ ] **A first-day guide.** A few hints for a new farmer: till, plant,
   harvest, sell, then go to a lobby. Shown once, can be skipped.
4. [ ] **Watering can.** Watered crops grow faster; an upgrade at the
   workbench waters 3×3.

---

## Backlog by theme

### Farming
- [ ] Watering can (see **Next up**)
- [ ] More crops with seeds from the merchant (tomatoes, pumpkins to grow
      rather than only cook, berries on bushes on the farm)
- [ ] Weeds that spread onto untilled ground and have to be hoed away
- [ ] Crows that land on crops and eat them unless you shoo them (a
      scarecrow keeps them off)

### Beanstalk: plants as platforms
The original big idea (CONCEPTS.md), not started. A grown plant is one more
entry in the world's platforms.
- [ ] A first slice: a vine bean you plant, which grows into a stalk you can
      climb to reach something you couldn't before
- [ ] More of them: a bounce shroom, a lily leaf, a stone pumpkin to push, a
      cloud cotton that is solid only from above

### Getting around
- [ ] Jump buffering and variable jump height (see **Next up**)
- [ ] A glider leaf for falling slowly
- [ ] Faster mounts, or a mount you can ride in a lobby (mounts are just for
      show now)

### World
- [ ] Weather: rain that waters the crops, wind, a storm now and then
- [ ] Seasons on the farm (maps can already dress trees in a season's colors)
- [ ] A new world generation (`CURRENT_GEN` in `shared/worldgen.js`): a new
      biome for the lobby islands

### Things to do
- [ ] Quests or requests: the merchant or a neighbour asks for something,
      for a reward
- [ ] Achievements or a collection book (fish, relics, recipes, bosses)
- [ ] A fifth boss
- [ ] More party games

### Playing together
- [ ] Trading between farmers in a lobby
- [ ] Visiting a friend's farm without being a helper (to look round)

### Tech
- [ ] Link farms to accounts, so a farm follows you to a new device
- [ ] Replace the simple AABB resolver with a physics engine (`cannon-es` or
      `rapier3d`) once shapes get more complex
- [ ] Make movement server-authoritative if cheating ever matters

---

## Open questions
- How hard should falling be? (Now: no cost.)
- Do crows and weeds fit a cozy game, or should pressure stay very light?
- Should the Beanstalk climbing be on the home farm, or in its own zone?

---

## Done
The big pieces so far, newest first:

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
