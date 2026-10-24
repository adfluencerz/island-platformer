# Island Platformer

A cozy 3D farming game built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/): tend your own little farm on an island, then drop into online lobbies to gather berries, mushrooms and rare finds with other farmers.

## What's included
- A stylized farmer with walk, jump, landing and tool-swing animations, a hoe, an axe and a pickaxe, and a camera that follows from an angled overhead view
- A tiled island (grass, dirt paths, stone plaza, sand shore) surrounded by water, with trees, bushes, rocks, wind-swayed grass and flowers, and grass-topped platforms to jump between; trees fade out when they block the view of the player
- Farming: till, plant and harvest turnips, carrots, flax and sunflowers, in a backpack-and-toolbar inventory; a watering can makes a crop grow the rest of the way twice as fast (a big one from the workbench waters three by three)
- A vine bean that grows into a beanstalk: climb its leaves to pick the beans at the top (plants that are platforms: the Beanstalk idea in `docs/CONCEPTS.md`)
- A first-day guide for a new farmer (till, plant, harvest, sell, then off to a lobby), shown once and easy to skip
- Seasons on the farm: spring, summer, autumn and winter, a week each, turn its trees, grass and ground (`src/seasons.js`)
- A glider leaf from the workbench: hold Jump on the way down to float
- A day/night cycle with a sun and moon, fireflies and a clock
- Sound effects and a gentle tune that changes at night, all made on the spot with the Web Audio API (`src/sound.js`, no sound files); `M` or the menu turns them off
- A merchant at a market stall on the farm who sells seeds and animals and buys what you grow and find, and asks for something each day, for good gold (`src/requests.js`)
- A collection book (`O`): the crops, wild finds, rare finds, dishes, fish and relics you've had, and the bosses you've beaten
- Five bosses (the evil parsnip, the super lion, the bee queen, the giant crow and the bog toad), each in an arena through a portal on the farm, with a mount to win: riding one is faster and jumps higher
- Party games in lobbies: a coin rush, a fishing contest, king of the hill, last one standing and a hop race across the water
- Animals: hens in a fenced yard by their coop (an egg a day), and cows (milk once a day) and sheep (wool every two days) in a pasture; they wander, graze, can be petted and sleep at night
- Building on the farm with wood and stone: fences, rail fences, picket fences, wattle fences, log fences, box hedges, gates, stone arches, wood arbors, walls, low walls, palisades, paths, stepping stones, a stone well, stone lanterns, scarecrows, hay carts, beehives, birdbaths, signposts, water troughs, stone benches, sundials, wheelbarrows, torches, mailboxes, birdhouses, flagpoles, stone cairns, clotheslines, lamp posts, garden benches, rope fences, log benches, compost bins, milk churns, dovecotes, and steps, tree stumps, crates, crate stacks, grain sacks, log piles, barrels, barrel stacks, straw steps and bales, boulders, scaffolds, straw stacks, log towers, stone blocks (mossy too) and pillars to climb on, and a workbench, which makes sturdier tools, a sword and a mallet for bopping other farmers in lobbies, and machines
- Fishing with a rod from the workbench: in the sea round any island, in a fish pond built on the farm, and in a lobby's water, where the rarer fish are
- Machines that turn what your animals give into something worth more (a cheese press, a mayonnaise machine, a loom, and beehives that fill with honey), cooking on a campfire and in the house's kitchen, a recipe book to fill, and dishes that give a little boost when eaten
- A saved home farm, and online lobbies (up to 8 farmers) you start with friends, where rare finds turn up (see below)
- Keyboard, mouse (click to walk) and touch controls, and it installs as an app on a phone or tablet

## Setup

```bash
npm install
npm run dev
```

`npm run dev` starts two things side by side: the game server (`server/index.js`, port 3001, restarted when `server/` or `shared/` change) and Vite, which proxies `/api` and `/ws` to it. Open the URL Vite prints (usually `http://localhost:5173`). Vite also listens on your network address, so friends on the same network can join with that URL.

If port 5173 is already taken (often an old `vite` still running in another terminal), `npm run dev` stops with "Port 5173 is already in use" instead of moving to another port: stop the other one and run it again. Under `npm run dev` the server also opens a lobby for any code you join that does not exist yet (on the island the code grows, as a seed).

The server keeps its lobbies in `data/lobbies.json` (not in git), so they outlive a restart: everyone in a lobby drops for a moment and the page reconnects them to the same island, with what was taken still gone, the trees still down and their finds counted, and seats are held a minute for it. `GAME_DATA=<file>` keeps them somewhere else, `GAME_DATA=off` not at all. A file the server can't read is set aside as `lobbies.broken-<time>.json`, never written over.

Without the game server you can still play on your farm (`npm run dev:client` runs only Vite).

## Controls
- `W`/`A`/`S`/`D` or arrow keys — move
- `Space` — jump (let go early for a lower jump; pressed just before landing it still jumps; only from the ground; once your overall skill level reaches 15, once more in the air: a double jump)
- `E` — at home: till / plant / harvest, trade at the merchant's stall, pet an animal (or milk the cow, shear the sheep), let out the animal in hand in her pen, chop a tree with the axe, or mine a rock with the pickaxe; in a lobby: gather (berries, mushrooms), chop a tree with the axe in hand, or mine a rock with the pickaxe (hold to keep swinging)
- `I` — backpack. In it: click picks up, places, swaps or merges a stack; right click or `Ctrl`+click (`Cmd` on a Mac) takes one (`Shift`+right click: half); `Shift`+click moves a stack to or from the toolbar; the bin destroys what you carry (not tools); and a click outside the window drops what you carry on the ground at your feet (below)
- `B` — build (the backpack's Build tab), in groups: fences & walls, paths, blocks to climb, buildings (the workbench, the farm chest, the house, the well), decor, and relics once you have one to show (`BUILD_GROUPS` in `shared/level.js`)
- `K` — your skills (the backpack's Skills tab)
- `J` — your fishing journal; `O` — your collection book (the backpack's tabs)
- `M` — sound and music on or off (the menu has a switch for each)
- `L` — the menu, on **Play online** (from home)
- `Enter` — chat (in a lobby)
- `Esc` — the menu: the same one as the title screen, with **Resume** (and **Go home** when away), and pages for **Play online**, **Friends** (farms you help on, your helpers) and **Controls**. `Esc` on a page goes back.
- `T` (hold) — fast-forward time (30×, at home only: in a lobby the time of day is shared)
- Click the ground — walk there (in build mode: build there)
- Mouse wheel — zoom in and out (over the hotbar it picks an item)

On a touch screen the game shows its own controls: a thumbstick (bottom left) to walk, and **Use** (`E`), **Jump**, **Bag** (the backpack) and, in a lobby, **Chat** (bottom right). Tap the ground to walk there (at home, a ripe crop is harvested, and a tile next to you is tilled or planted with what you hold), tap the stall to trade, a bush or mushrooms to gather, or a tree to chop it with the axe in hand. Pinch with two fingers to zoom in and out. In the backpack, a tap picks up or places a stack, holding a finger on a slot takes one, and a tap outside the window drops what you carry. Hold the clock to fast-forward time at home. **Menu** (the `Esc` menu) is in the place panel. To build, open **Bag** and its **Build** tab; then **Use** builds in front of you, a tap builds on the tile tapped, and **Done** ends it. With a sword or a mallet in hand in a lobby, tap another farmer to go and bop them.

**With a controller** (an Xbox or PlayStation pad, or any the browser knows in the standard layout; plug it in and press a button): the left stick walks, **A** jumps (hold to glide), **X**, **B** or **RT** does whatever `E` does (hold to keep chopping), **Y** opens the backpack, **LB**/**RB** (or the D-pad left and right) pick the item before or after on the toolbar, the right stick zooms, **View** builds, **Menu** opens the menu, and holding **LT** speeds up time at home. **D-pad up** reaches the buttons on the screen, like an invitation. In the menu and every window, the D-pad (or the left stick) moves a gold highlight between the buttons and slots: **A** clicks, **X** right-clicks (one of a stack), **B** goes back or closes, **LB**/**RB** switch tabs, and the right stick scrolls. The prompts say **X** instead of `E` while you play with one.

## Playing on a phone
Open the address Vite prints for your network (`npm run dev`) on the phone. The built game (`npm run build`, `npm start`) can also be installed as an app ("Add to Home Screen"): it opens full screen, and the farm opens without a connection (only the lobbies need the game server). The app's files are in `public/` (`manifest.webmanifest`, the icons, and `sw.js`, the service worker, which runs in built pages only so Vite's dev server always shows your changes). Browsers only install apps from `https://` or `localhost`.

**Dropping things.** Carry something in the backpack and click (or tap) outside the window: it lands at your feet, bobbing, for walking into. You don't pick it straight back up, not till you have stepped off it. In a lobby anyone can walk into it (a way to give a friend something), and it fades after a while like what a bop knocks loose; for the first few seconds it's for anyone but you. On a farm it stays where it is, kept with the farm: on a farm with helpers its room keeps it, and anyone on the farm can walk into it (after the first few seconds, you too). Only things the merchant has a price for can be dropped (never a tool or a key piece).

## Your farm and online lobbies
**Your farm** is yours alone: the backpack, gold, tilled soil, crops and the time of day are saved as you play. While you're away (in a lobby, or with the page closed) the clock keeps turning and your crops keep growing. The page plays from a copy in your browser and keeps the game server's copy up to date (every 15 seconds, before you set off for a lobby, and when you close the page). There are no accounts yet, so a farm belongs to the browser that made it; playing it on another device, or getting it back after clearing the browser, will come with accounts. (The server still has the pairing code and the farm name & PIN routes, `/api/farms/me/pair` and `/recovery`, but the menu no longer offers them.)

- The device that opened the farm last is the one playing it. A tab left open on another device is told so the next time it saves, and stops saving: reload it to carry on there.
- A farm played before the server kept farms is taken up as it is the first time the page reaches the server.

Without the game server (`npm run dev:client`) the farm stays in the browser until the page next reaches it. A save the page can't read is kept aside as `tp.save.broken`, an older one is kept as `tp.save.v<N>` when it's brought up to date, and a save from a newer version of the game is left alone (nothing is saved until you reload with that version).

**The merchant** keeps a stall just east of the plaza on your farm. Walk up to the counter and press `E` to trade: buy turnip, carrot, flax and sunflower seeds (click: one, `Shift`+click: five), and sell your crops, forage, gems and spare seeds from your backpack (click: the whole stack, right click: one). Tools and the old key aren't for sale. Prices are `price` (buy) and `sell` on each item in `src/items.js`; the item tooltips show what the merchant pays.

**The animals** live in two pens on the farm: the hens in a fenced yard west of the plaza, with a coop, a nest and a trough; the cows and sheep in a pasture south of it, off the path to the shore, with hay bales and a water trough. A new farm comes with two hens, a cow and a sheep (so does a farm saved before there were any), and the merchant sells more: a hen 150g, a sheep 350g, a cow 500g. A pen has room for 8 hens, or 4 cows and 6 sheep; upgraded at the workbench (twice) its fence goes out a little and there is room for 12 and then 16 hens, 6 and 8 cows, 9 and 12 sheep. The yard's coop gets bigger and some eggs are **large eggs** (35%, then 70%); the pasture gets a hay rack and then a barn, and a cow or sheep gives two milk or wool half the time, then every time. Something built or farmed where the bigger fence goes has to go first. One sits in the backpack until you stand in her pen with her in hand and press `E`. By day they wander and graze (the hens peck); the hens and sheep scurry off if you run at them, and a cow nudges you aside. Walk up to one and press `E` (or tap her) to pet her, or, when a little picture floats over her, to milk the cow or shear the sheep. A little before dark the hens go up the ramp to roost and the cows and sheep lie down in the grass; they're up again after sunrise.

What they give comes on the farm's clock, so it keeps coming while you're away:
- **Eggs** (25g): each hen lays one a day, between mid-morning and the afternoon, where she stands, or in the nest beside the coop if it fell due while she slept or you were off the farm (up to 3 lying about per hen). Walk over an egg to pick it up.
- **Milk** (60g): a cow has milk once a day, from the morning after you last milked her.
- **Wool** (120g): a sheep's fleece grows back two days after shearing, and you can see it fill out.

The animals and eggs are saved with the farm (`src/animals.js`).

**Building.** Wood and stone from the lobbies build things on your farm. Open the backpack's **Build** tab (`B`) and pick a piece: a see-through one shows where it goes (red where it can't), on the tile you point at with the mouse or the one in front of you. `E` puts it down (hold `E` and walk to lay a path), and so does a click or a tap on a tile (the farmer walks over first if it's far). **Done** or `Esc` ends build mode.

- **Wood fence** (2 wood), **rail fence** (3 wood, split rails on squat posts), **picket fence** (3 wood, pale pointed pickets), **wattle fence** (3 wood, withies woven between stakes), **log fence** (3 wood, whole logs laid two high between stumps), **rope fence** (2 wood, 1 flax, a rope slung between posts), **box hedge** (1 wood, 2 flax, clipped bushes), **low stone wall** (2 stone), **stone wall** (3 stone) and **wood palisade** (4 wood, a row of pointed logs) join up with the fences, hedges and walls beside them. A fence, a rail, picket, wattle, log or rope fence, a hedge or a low wall can be hopped over; a stone wall or a palisade can't.
- **Wood path** (1 wood), **stone path** (1 stone), **gravel path** (1 stone), **stepping stones** (1 stone, three flat stones across the grass) and **cobble path** (2 stone) are walked on.
- A **wood gate** (3 wood) joins up with the fences beside it, like a fence, but is walked through.
- A **stone arch** (5 stone) or a **wood arbor** (5 wood, posts and rafters with a flowering vine) joins up with the walls and fences beside it the same way, and is walked through too.
- Blocks to climb on, in heights a step apart:
  - a **wood step** (2 wood), a **tree stump** (2 wood), a **straw step** (2 flax) or a **stone step** (2 stone) is walked up onto;
  - a **wood crate** (3 wood), a **straw bale** (3 flax), a pile of **grain sacks** (4 flax), a **wood barrel** (4 wood), a **boulder** (3 stone, worn flat on top), a **log pile** (4 wood), a **stone block** or a **mossy stone block** (4 stone) takes a hop, or a step in front of it;
  - a **wood scaffold** (5 wood, a plank deck on posts), a **crate stack** (6 wood, a low crate on a big one), a **straw stack** (6 flax, bales three high) or a **tall stone block** (6 stone) is a step up from a crate or a block;
  - a **log tower** (8 wood, logs laid crosswise), a **barrel stack** (8 wood, one barrel stood on another) or a **stone pillar** (8 stone) is a step up from those, the tallest things to stand on.

  Put them side by side for a platform, or step, crate, scaffold, pillar for a stair that is walked all the way up.
- A **stone well** (6 stone, 3 wood), a ring of stones round dark water under a little roof, with a bucket on the crank.
- A **stone lantern** (5 stone), a garden lantern with a little firebox that lights up at night like the lamp posts.
- A **lamp post** (3 wood, 2 stone) that lights up at night, and a **garden bench** (6 wood). (Ones made at the workbench before turn back into the wood and stone they cost.)
- A **scarecrow** (3 wood, 2 flax), in an old red shirt and a straw hat; a crow sits on the arm of some.
- A **hay cart** (6 wood, 3 flax), a two-wheeled cart heaped with hay.
- A **beehive** (2 wood, 3 flax), a straw skep on a stand, with bees about its door.
- A **birdbath** (3 stone), a bowl of water on a stone pillar; a bird comes to drink at some.
- A **signpost** (2 wood), two arrow boards on a post, pointing off a different way on every tile.
- A **water trough** (4 wood), a plank trough of water on splayed legs; a dipper hangs on the rim of some.
- A **stone bench** (4 stone), a slab on two blocks; moss grows on some.
- A **sundial** (4 stone), a brass dial on a stone pedestal, its gnomon pointing north.
- A **wheelbarrow** (3 wood, 1 stone), set down at a slant, with stones, logs or earth in it.
- A **log bench** (3 wood), a split log on two short stumps.
- A **compost bin** (4 wood), a slatted bin of earth with peelings and greens heaped on top.
- **Milk churns** (1 wood, 3 stone), two tall tin churns and a short one on a plank; the short one's lid is off on some.
- A **dovecote** (5 wood, 1 stone), a little house for doves on a post, with doves on its perch and roof.
- A **flower planter** (4 stone, 1 wood), a stone box of flowers that never need watering.
- A **torch** (1 wood, 1 flax), a flame on a stick: it burns day and night and lights up what is around it after dark, flickering.
- A **mailbox** (2 wood), a wooden box with a rounded lid on a post; its red flag is up on some, and a letter pokes out of a few.
- A **birdhouse** (2 wood), a little house with a round door on a tall pole; a bird sits on the perch of some.
- A **flagpole** (3 wood, 2 flax), a tall pole on a stone footing with a red, blue or yellow pennant rippling from it.
- A **stone cairn** (3 stone), flat stones piled one on another, each a little off the one below; moss at the foot of some.
- A **clothesline** (2 wood, 2 flax), a line between two T-posts with a shirt, a sheet and trousers pegged out on it.
- A **workbench** (10 wood, 5 stone). `E` next to it (or a tap) opens it, to make:
  - better tools, each made from the one before: a **sturdy axe** and a **sturdy pickaxe** take three and two swings instead of four and three, and a **wide hoe** tills three tiles side by side; at level 2, **silver** ones (two swings, one swing, five tiles in a row), at level 3 **golden** ones (one swing and an extra log or stone, a patch three by three), for gold, wood, stone and gems;
  - a **wooden sword** (8 wood) and a **mallet** (4 wood, 6 stone), for bopping (see the lobbies, below);
  - a **fishing rod** (5 wood, 2 flax), and from it a **sturdy rod** (15 wood, 10 stone, 4 flax), and at level 2 a **golden rod** (500 gold, 20 wood, 2 sky gems): see Fishing, below;
  - the machines: a **cheese press** (20 wood, 10 stone), a **mayonnaise machine** (15 wood, 15 stone) and a **loom** (25 wood, 10 flax), put down from the Build tab (see **Machines and cooking**, below).

  Up top it has the farm's **upgrades**, bought by its farmer with gold, wood and stone (and gems): the workbench itself (three levels, each making more, and drawn fancier: a pegboard and a lantern, then a little roof, an anvil and a grindstone), and the hen yard and the pasture (three levels each: below). A recipe's `level` says which workbench it takes (`RECIPES`, `BENCH_LEVELS`, `PEN_LEVELS` in `shared/balance.js`).
- A **fish pond** (30 stone), 3 tiles by 3, built from the middle of its front row: still water in a ring of stones, to fish in.
- A **campfire** (6 wood, 6 stone), to cook on, flickering and lighting the ground round it at night.
- **Bunting** (2 wood, 1 cloth), a string of little flags between two poles, and a **market awning** (4 wood, 2 cloth), a counter under a striped roof: built with the cloth from the loom.
- A **farm chest** (8 wood, 2 stone), one to a farm: somewhere to keep things. What your backpack is short of comes out of it when you build, and when you make things or buy upgrades at the workbench (on a farm with helpers, only for you).
- A **house** (500 wood, 200 stone), one to a farm and one more for each helper, 5 tiles across and 4 deep, built from the middle of its front where the door is. `E` at the door (or a tap on the house) goes inside (every house on the farm opens into the same room): a room of 200 tiles (20 by 10) with a bed, a table, a fireplace, a shelf of books and a kitchen to cook in, and a field of earth (8 by 6) to till and plant like the farm's. `E` at the door inside goes back out. Its windows light up at night (`HOUSE_ROOM` in `shared/level.js`, `src/house.js`).
- **Take down** (in the Build tab) takes a piece away and gives back what it cost.
- Nothing goes on tilled soil, in the animals' pens, by the stall's counter, where farmers arrive on the plaza, or on someone standing there. What's built is saved with the farm, and on a farm with helpers everyone can build (each pays from their own backpack) and the farm's room keeps it, like the soil (`PIECES` in `shared/level.js`, `src/build.js`).

**Fishing.** With a rod in hand, face the water (the sea past the sand, or a fish pond) and press `E` (**Use** on a phone): the line goes out and the bobber floats. When it dips with a splash and a **!** (on a phone the Use button pulses and the phone buzzes), press `E` again, quickly: the rarer the fish, the less time you have. Too slow and it gets away; `E` before anything bites, or walking off, just reels in.
- The sea round the farm has sardines, mackerel and sea bass, seaweed, and a moonfish late at night; a pufferfish takes a sturdy rod. A fish pond has minnows and perch, sunfish around midday, catfish in the evening, and a koi for a sturdy rod. A lobby's water has the rarer ones (see the lobbies, below).
- Now and then it's an old boot, some driftwood, an old key or a little chest of loot.
- A better rod gets bites sooner and rarer fish on the line. The merchant buys every fish (`FISHING` and `RODS` in `shared/balance.js`, `shared/fishing.js`, `src/fishing.js`).

**Machines and cooking.** Put a machine down on the farm, walk up to it and press `E` (or tap it) to put in what it takes, out of your backpack; a few game hours later (a game hour is a real minute) it is done, and `E` collects what it made. A faint picture over a machine shows what it is making; it bobs, bright, once it is ready. What they make sells for well over what went in:
- **Cheese press**: milk → **cheese** (4 hours, 150g).
- **Mayonnaise machine**: an egg → **mayonnaise** (3 hours, 65g).
- **Loom**: wool → **cloth** (6 hours, 260g), which also builds bunting and market awnings.
- **Beehive** (the one in the Build tab's decor): takes nothing, and fills a jar of **honey** once a game day (100g); one jar waits for you at most.

Machines keep working while you're away, like the crops. Taking one down gives back what was in it (what it made, if it was done, or else what went in).

**Cooking**, two ways, and a dish sells for more than what went into it. Eat one (`E` with it in hand, at home or in a lobby, or double-click it in the backpack) and you get a little boost for a few minutes of play: **Quick feet** (walk faster), **Strong arms** (one swing fewer to fell a tree or break up a rock), **Bouncy** (jump a little higher) or **Lucky rod** (fish bite sooner). One meal at a time; the boost and how long it has left show over the toolbar.
- On a **campfire**: `E` at it picks a simple dish (a fried egg, roasted mushrooms, a baked turnip, a berry skewer, a roast carrot, a grilled fish), up to three of it at once (`×3`), and an hour later it's ready to collect from the fire. A puff of steam goes up as it goes on and comes off.
- **Any fish** in a recipe takes the cheapest common fish you have (minnow, sardine, perch, mackerel, trout; `ANY` in `shared/balance.js`), so the rare ones are kept for selling.
- In the **kitchen** in your house (a stove and a counter on the back wall), straight away, from the recipes in your **recipe book**; `E` at the kitchen, or at the bookshelf, opens it. Kitchen dishes need more (cheese, honey, milk, eggs, crops, forage) and give stronger, longer boosts. Pancakes, a cheese omelette and fish stew are in the book from the start; the merchant sells the recipes for pumpkin soup, honey-glazed carrots, mushroom pie, sushi rolls and the **farm feast**; and the best (carrot cake, berry tart, golden turnip pie) are on **old recipe cards**, rare finds in the lobbies (the whole lobby hears). A recipe card goes into the book as soon as it's in your backpack. What you can cook right now is listed first, and `×5` cooks up to five at once (the pot's lid rattles). Your recipe book and your meal are yours, kept with your backpack.
- The **farm feast** is for sharing: eaten on your farm with helpers there, everyone on the farm gets its boost too.

On a farm with helpers the farm's room keeps what is in each machine: anyone can put things in from their own backpack, and whoever collects what a machine made gets it in their own backpack (`MACHINES`, `DISHES` and `BOOSTS` in `shared/balance.js`; `shared/machines.js`, `src/machines.js`, `src/cooking.js`).

**Helpers: farming together.** Friends can help on your farm, any time, even while you're away. Open the menu (`Esc`), pick **Helpers** and **Invite a helper**: you get a code like `K7P4-QM2X` and a link (good once, for a day). Your friend opens the link (or types the code under **Farms you help on** on the title screen) and is one of your helpers from then on: the farm is on their title screen, to **Visit** whenever they like. The same menu lists your helpers, with **Remove** to take someone off (they're sent home if they're there).

- Everyone tills, plants and harvests as at home, with their own tools and seeds. What anyone harvests goes in the **farm chest**, which stands on the grass by the plaza on a farm with helpers: everyone can see what's in it and put things in from their backpack, and only you take things out (`E` at the chest, or tap it).
- Backpacks and gold stay each farmer's own, and so does the merchant: helpers can trade at your stall.
- The animals are yours: helpers can pet them, but the eggs, milk and wool are for you when you're there.
- The farm keeps its own clock, the same for everyone on it. It doesn't stop for the menu, and `T` fast-forwards it only while you're alone on it.
- Once a farm has helpers it's played through the game server whenever the server is there, also when you're alone, so it's the same farm whoever comes. Without the server you can still play it in your browser, but if your helpers changed it meanwhile, their farm is the one you get back (your backpack stays as you left it).

**Online lobbies** are drop-in places to gather with other farmers, each out on a wild island of its own: bigger and wilder than a farm, with a ragged coast, a mossy forest with giant toadstools to hop across, a shallow pond to wade into (there may be something on the bottom), a flower meadow, (on newer islands) a heather heath, rocky terraces climbing to the north, and a ring of standing stones where you arrive. The newest islands are twice as wide, with several climbs of terraces, rings of toadstools in red, brown, violet or gold, more woods, and trails out to all of them. Press `L` at home (or pick one on the title screen): **Start a lobby**, **Quick join** (the fullest lobby with room, or a new one), **Browse lobbies**, or **Join with a code**.

- **Starting a lobby with friends**: tick the friends to invite (friends who are online; add friends by username under **Friends**, and once they say yes you're friends). Each gets an invitation that pops up right away, wherever they are in the game, with **Join** and **Decline**; it goes away after 25 seconds. You see a 30-second countdown and who's coming; then everyone who said yes lands on a fresh island together (sooner, once everyone has answered). From inside a lobby you can invite more friends, and a yes goes straight there.
- **Every lobby is one party game**, picked by whoever starts it (**Start a lobby** → **Which game?**): a **loot run** (the island itself, against the clock: five minutes to gather the most, a point a find and more for a rare one), a **coin rush**, **king of the hill**, **last one standing**, a **hop race** or a **fishing contest** (each in an arena of its own). Everyone in the lobby plays: it starts 15 seconds after the first farmer gets there (time for the friends you invited to arrive), a 3-second countdown, and then it's on. The winner gets a prize (coins and a roll of seeds, a gem or golden seeds), everyone else who played a few coins, and after a few seconds of results everyone heads back to the farm they came from (their own, or the friend's they were helping on). Quick join starts a loot run when there's no lobby to join.
- **Leaderboards** (Play online → **Leaderboards**): every lobby game has one, its top ten farmers by their best score (the most coins, points, seconds on the hill or still up, seconds to spare, weight of fish), with how many times each won and played; level bests go to the most wins. Your own place shows too, if you're further down, and when a game beats your best the results say where it puts you. The server keeps them in `data/leaderboards.json`.
- A lobby is a match: anyone can drop in till its game is under way (a loot run, while it runs; it's listed under Browse and Quick join), **nothing on its island grows back**, and once its game is over (or the last farmer has left) it's thrown away.
- There's no farming in a lobby: gather, chop, mine and fish, and whatever you find is yours to take home.
- Every tree can be chopped down for **wood**: with the axe in hand, press (or hold) `E` next to a tree. Four swings fell it for everyone and give wood to whoever finished it: 2–4 from an ordinary tree, up to 6 from the big old trees in the woods, fewer from a little one; a stump is left behind (in a lobby for good; on a farm the tree grows back 10 minutes later). The merchant buys wood.
- Every rock can be broken up for **stone**: with the pickaxe in hand, press (or hold) `E` next to a rock. Three swings break it for everyone and give stone to whoever finished it: one or two from an ordinary rock, one from a pebble, up to 6 from the boulders at the foot of the terraces; in a lobby it stays broken. The merchant buys stone. The farm's own trees and rocks are chopped and mined the same way, and grow back (even while you're out; with helpers on the farm, the wood or stone goes to whoever got it). A farm from before the pickaxe gets one the first time it loads.
- Berry bushes and mushrooms are picked with `E`; treasures out in the meadow and up on the ledges are collected by walking into them. Whoever gets there first takes it, and it stays empty.
- Now and then something rare turns up (golden seeds, an old key) with a golden glint over it, and the whole lobby hears about it in chat. Golden seeds grow a golden turnip at home.
- **Bopping**: with a wooden sword or a mallet (made at a workbench) in hand, `E` bops the nearest farmer in reach (or tap them to go and bop them). They stumble back and drop a little of what they gathered on this visit, one thing with the sword, two with the mallet, for anyone to walk into (anyone else, for the first few seconds: the farmer it came out of can't grab it straight back): never a rare find or gold. Nobody gets hurt. A farmer just bopped can't be again for a few seconds, and nobody bops or is bopped in the stone circle where you arrive (`WEAPONS`, `DROP_OWN_MS` in `shared/balance.js`).
- **Fishing** works in a lobby too: its sea and its pond have the rarer fish (a rainbow trout, a glowfish late at night, now and then a golden carp), the lobby rolls what bites, and the whole lobby hears about a rare one.
- The player list shows how much everyone has found (and chopped) this visit; the lobby list shows how many rare finds are lying about.
- Every lobby has a code: 6 characters for a public lobby, 10 for an invite-only one (unlisted, so only its link gets you in). While you're there the address bar carries `?lobby=CODE`, so the address is the invite link; **Copy invite** puts it on the clipboard.
- Reloading or losing the connection keeps your place in the lobby (and your finds) for 20 seconds: the page reconnects by itself, or join again from the invite card after a reload.
- An empty lobby is thrown away 30 seconds after the last farmer leaves.

### Island seeds
Every lobby's island is grown from a **seed**, a short phrase like `dewy-glade-31`: the seed decides the coastline, where the pond, meadow, woods, terraces and toadstools are, the trails between them, where the berry bushes, mushrooms and treasures are, and the island's season (spring, autumn or cherry blossom). The same seed always grows the same island, so a new lobby on a seed you liked is that island again.

- A new lobby gets a fresh seed. To pick one, type it in **Island seed** when you open a lobby (any words; case and punctuation don't matter). `classic` is the original hand-made island.
- **The world keeps growing, old seeds don't change.** A seed ending in `-v2` is a generation 2 island and also has what that generation added: a heather **heath** (a purple moor with cairns, rocks and heather to pick). A seed ending in `-v3` is twice as wide as that, with 2–4 climbs of terraces (3–7 steps each, of their own sizes and heights), 2–4 rings of giant toadstools (3–6 caps, each ring its own size and color), more woods and trails out to every climb, ring and wood, and about twice the spots. A seed ending in `-v4` is that too, plus a **reed marsh**: a soggy patch thick with reeds and a few rocks, with cattails to cut for the merchant. A seed ending in `-v5` is that too, plus a **bluebell glade**: a blue-green clearing nodding with bluebells, with bluebells to pick for the merchant. A seed ending in `-v6` is that too, plus a **sunflower field**: a golden clearing of tall sunflowers, with sunflowers to pick for the merchant. A seed ending in `-v7` is that too, plus a **pumpkin patch**: a round plot of vines and fat orange pumpkins, with pumpkins to pick for the merchant. A seed ending in `-v8` is that too, plus a **fern glen**: a shady hollow thick with tall ferns and a few rocks, with fern fronds to pick. A seed ending in `-v9` (what new random seeds get) is that too, plus **shell dunes**: a pale sandy rise out toward the shore with dune grass, driftwood and seashells to collect for the merchant. Any other seed, `classic` included, is generation 1 and grows exactly the island it always has, saved lobbies and shared seeds alike. `npm test` pins old seeds' islands (generations 1 to 8) with fingerprints, so a change that moves one fails.
- To grow the world further: raise `CURRENT_GEN` in `shared/worldgen.js`, put the new biomes, plants, items and props behind `genOf(seed) >= N` with random streams of their own, and add them after what exists (spot ids, tree and rock numbers) so nothing earlier shifts.
- The lobby panel shows the island's seed, and so do the lobby list and invite cards.
- `npm run island -- <seed> [<seed>…]` draws seeds' islands in the terminal (no seed: a random one), to look for good ones without starting the game.
- Under `npm run dev` a lobby the server opens for an unknown code uses the code as its seed.

### How it works
- `shared/room.js` is one lobby: its players, its island and its resource spots. The server runs one per code. What the spots can hold is in `shared/balance.js`, what counts as rare in `shared/level.js`.
- A lobby is saved as what has happened on its island (what's on each spot, which trees are down, who was there); the island itself grows again from the seed. A saved spot the island no longer has in the same place, or an item that no longer turns up there, starts out fresh, so saves survive changes to `shared/worldgen.js` and `shared/level.js`. The server writes `data/lobbies.json` a couple of seconds after something changes and when it stops (`server/lobby.js`, `server/store.js`).
- `shared/worldgen.js` grows an island from a seed (coastline, pond, terraces, toadstools, woods, meadow, trails, spot positions). It runs on the server and in the page, and only the seed goes over the wire, so everyone in a lobby agrees on the island. Each part of an island has its own random stream, and a layout that fails the checks (every spot on land and reachable, every step within a jump of the last) is grown again from a variant of the seed; `npm test` checks hundreds of seeds.
- The islands are built by `src/world.js` from a map definition in `src/maps.js`: per-tile ground types, platforms, what grows where, and each map's own set pieces. The farm is built once; a lobby's island when you arrive on it (the last one is kept for going back).
- Each client moves its own farmer and reports its position 20 times a second. Who gets a spot is settled by the lobby: it only counts if something is still there and the lobby last saw you next to it.
- The server places every tree and rock (`shared/wilds.js`): a lobby works out where its island's trees and rocks stand, and the other places each can grow back in, and sends them to every page when it joins, so everyone has the same ones in the same places and the lobby knows each by its number. Nothing is placed outside the island or in the air: each stands on dry land all round, at ground level, clear of the pond, the terraces, the toadstool caps, the sky isles and the stone circle (`npm test` checks every generation). The farm's are the same on every farm, kept in `shared/homewilds.js` (`npm run wilds` writes it again; the test says when it is out of date). The page says which tree it felled and where it stands; the lobby checks that is where that tree is, that you are next to it, that it is still up and that you aren't felling trees faster than an axe can, and gives wood by the tree's own size (`TREE_BALANCE` in `shared/balance.js` has the swings, wood and regrow times). Rocks work the same way (`ROCK`). Anything knocked loose in a bop lands on the ground under the farmer (a terrace or a toadstool cap if they were over one), never in the air, and nothing drops over the sea.
- Other players are drawn from the lobby's 20 Hz snapshots, 100 ms in the past and interpolated between them, so they move smoothly through network jitter (`src/remotes.js`).
- Messages are small JSON objects; `shared/protocol.js` lists them all.
- The home farm needs no server: `npm run dev:client` (Vite alone) is enough to farm. With one, the server keeps a copy of each farm in `data/farms/<id>.json` (`server/farms.js`, `src/net/farm.js`). A farm is known by its id, and each device has a token of its own for it (the server keeps only their hashes, and the PIN only as a scrypt hash); the save is the page's, kept as it's sent. The farm-name index is gathered from the farm files when the server starts. Accounts, later, can point at a farm id, so farms stay where they are.
- A farm with helpers runs as a room on the server (`server/farmroom.js`) whenever anyone is on it, its owner or a helper, and is put away 30 seconds after the last one leaves. A helper is known by their own farm's id (their device's token for it proves it), so it needs no accounts either. The room has the soil, the crops, the chest and the clock: pages ask (till, plant, harvest) and draw what it says, as in a lobby. It writes the farm back into the owner's save (`data/farms/<id>.json`, the chest beside it) every few seconds, in the page's own save format, so the owner's page can always play it alone. A page's save carries the farm only when the page had the farm as the room last left it (`roomRev`), so a page that played offline can't write over what the helpers did. The animals stay the owner's page's to run: it sends their state to the room, and everyone else's page draws them from that. Lobbies and farm rooms share their players, seats, chat and snapshots (`shared/place.js`).

The lobby system follows [Survive the Night](https://github.com/webdevcody/survive-the-night-fps)'s (codes, quick join, invite links, held seats on rejoin, idle shutdown), without the survival.

## Day/night cycle
A full day lasts 6 real minutes (`DAY_LENGTH_SECONDS` in `src/daynight.js`). The clock in the top-right shows the day, the time in 10-minute steps, and the sun/moon on a dial. At home, time pauses while the backpack or the menu is open; in a lobby everyone shares the lobby's clock. To start at a given hour while testing, add `?hour=21` to the URL.

## Project structure
```
island-platformer/
├── index.html          # entry point, mounts the canvas
├── public/             # the installable app: manifest, icons, service worker (sw.js)
├── src/
│   ├── main.js          # scene, player physics, farming, lobby spots, tap to walk, saving, travel, game loop
│   ├── world.js         # builds an island from a map: tiles, colliders, foliage, trees, rocks
│   ├── maps.js          # the maps: your farm's island, and a lobby's wild island from its seed
│   ├── character.js     # the farmer model and its animations (you, everyone else, the merchant)
│   ├── items.js         # the item catalog: names, prices, pixel-art sprites
│   ├── inventory.js     # the backpack and toolbar
│   ├── crops.js         # what each seed grows into, and the growing plants
│   ├── daynight.js      # the clock, sun, moon, sky and fireflies
│   ├── merchant.js      # the merchant's stall on the farm, and the merchant behind it
│   ├── shop.js          # the merchant's shop window: buy seeds and animals, sell from the backpack
│   ├── chest.js         # the farm chest on a farm with helpers, and its window
│   ├── build.js         # what is built on the farm: fences, gates, walls, paths, blocks, the workbench, decorations
│   ├── house.js         # inside the house: its room, with a field to farm
│   ├── workbench.js     # the workbench's window: the farm's upgrades, decorations, better tools, the sword, the mallet, the rods and the machines
│   ├── fishing.js       # casting, the bobber and the line (ours and everyone else's), landing what bit
│   ├── machines.js      # what is in the farm's machines, and the bubbles over them
│   ├── cooking.js       # the campfire's and the kitchen's window (the recipe book), and what eating does
│   ├── foods.js         # the item catalog's machines, what they make, the dishes and the recipe cards
│   ├── animals.js       # the hen yard and the pasture, the hens, cows and sheep, eggs
│   ├── remotes.js       # other players: interpolation, name tags
│   ├── net/
│   │   ├── connection.js  # WebSocket to a lobby
│   │   ├── lobby.js       # the lobbies' HTTP API, invite links
│   │   └── farm.js        # the farm's copy on the server, pairing codes
│   └── ui/              # title screen (splash.js), in-game HUD (hud.js), touch controls (touch.js), styles
├── shared/              # runs on both the server and the client
│   ├── place.js         # what every online place has: players, seats, chat, snapshots
│   ├── room.js          # one lobby: resource spots, trees
│   ├── protocol.js      # message types
│   ├── constants.js     # tick rate, limits
│   ├── balance.js       # every balancing number: regrow times, prices, costs, loot, recipes
│   ├── level.js         # resource spots, rare finds, building pieces
│   ├── fishing.js       # what bites where, with which rod, at what hour; casting a line
│   ├── machines.js      # what goes into a machine, when it is done, and what comes back out
│   └── worldgen.js      # islands from seeds (and the classic island)
├── server/
│   ├── index.js         # HTTP API + WebSocket + built client, one port
│   ├── lobby.js         # lobbies by code, quick join, throwing empty ones away, saving them
│   ├── presence.js      # who is online, and starting lobbies with friends (invitations)
│   ├── farms.js         # farms kept for their devices, pairing codes, helpers
│   ├── farmroom.js      # a farm with helpers, played together
│   └── store.js         # a save file written safely (the lobbies, each farm)
├── scripts/
│   ├── dev.js           # npm run dev: game server + Vite
│   ├── island.js        # npm run island: draw a seed's island in the terminal
│   └── test-multiplayer.js  # npm test
├── docs/CONCEPTS.md     # an early brainstorm of game ideas
├── package.json
```

## Where to go next
See [docs/BACKLOG.md](docs/BACKLOG.md): what is in progress, what is next, and the ideas waiting by theme.

## Tests
```bash
npm test
```
Checks the islands (the classic one and hundreds of seeds: every spot reachable, the same seed always the same island), the lobby's rules (taking spots, regrowth, rare finds, rejoin, chat limits) and the server end to end over real sockets.

```bash
npm run browser -- -e 'g.hold("Space", 0.3); return g.player.position' --shot shot.png
```
Plays the game in a headless Chromium (`scripts/browser.mjs`): it logs a test account in, walks onto the farm and freezes it, then runs a test that moves the game on by game time (`window.__game.step`), however slowly the page draws. See `.claude/skills/browser-test/SKILL.md`.

## Build for production
```bash
npm run build
npm start        # serves the built client, the API and the game sockets on PORT (default 3001)
```

`HOST=127.0.0.1` keeps it to the machine itself (behind a proxy), and `TRUST_PROXY=1` takes visitors' addresses from the proxy's `X-Forwarded-For` (for the limits on opening lobbies and farms and guessing PINs).

## Online
The game runs on a DigitalOcean droplet, behind [Caddy](https://caddyserver.com/) for HTTPS. Every push and pull request is tested and built by GitHub Actions (`.github/workflows/deploy.yml`), and a push to `main` is then copied to the droplet and the game restarted: players in a lobby drop for a moment and are reconnected, and the lobbies and farms (in `/var/lib/island`, apart from the game) stay as they were.

A new droplet (Ubuntu 24.04) is set up once with `deploy/setup-droplet.sh`; the comment at its top says how and what it puts where. The workflow needs the repository variable `DEPLOY_HOST` (the droplet's domain) and the secrets `DEPLOY_SSH_KEY` (the deploy key) and `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <DEPLOY_HOST>`). On the droplet, `journalctl -u island` shows the server's log.
