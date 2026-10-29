# Island Platformer

A cozy 3D farming game built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/): tend your own little farm on an island, then drop into online lobbies to gather berries, mushrooms and rare finds with other farmers.

## What's included
- A stylized farmer you dress as you like (a wardrobe of hats, hairstyles, faces, tops, bottoms, aprons, shoes and scarves), with walk, jump, landing, blinking and tool-swing animations, a hoe, an axe and a pickaxe, and a camera that follows from an angled overhead view
- A tiled island (grass, dirt paths, stone plaza, sand shore) surrounded by water, with trees, bushes, rocks, wind-swayed grass and flowers, and grass-topped platforms to jump between; trees fade out when they block the view of the player
- A valley round the farm, five times its size: a forest with a fern glen and a bluebell glade, a flower meadow, a heather heath, a lake with a reed marsh, a sunflower field, a pumpkin patch, a strawberry bank and shell dunes, each with wild things to find, and roads out to four neighbours (below)
- Four neighbours, each in a home of their own with a room inside, a day of their own, and a shop: Rosa sells animals, Basil seeds, Finn fishing tackle and Mabel recipes. Each shop opens once you have done its keeper a good turn, and each has seven requests to ask of you in all, from pets and eggs to a message to carry to another neighbour (`shared/npcs.js`). You choose what to say to them: ask about their request and take it or leave it, chat about this and that, share their moments, and pick your reward at the end (`shared/talk.js`). Their homes show what you have done for them
- Farming: till, plant and harvest turnips, carrots, flax and sunflowers, in a backpack-and-toolbar inventory; a watering can makes a crop grow the rest of the way twice as fast (a big one from the workbench waters three by three)
- A vine bean that grows into a beanstalk: climb its leaves to pick the beans at the top (plants that are platforms: the Beanstalk idea in `docs/CONCEPTS.md`)
- A first-day guide for a new farmer (till, plant, harvest, sell, then off to a lobby), shown once and easy to skip
- Seasons on the farm: spring, summer, autumn and winter, a week each, turn its trees, grass and ground (`src/seasons.js`)
- A glider leaf from the workbench: hold Jump on the way down to float
- A day/night cycle with a sun and moon, fireflies and a clock
- Sound effects made on the spot with the Web Audio API, and music: the song *Whispers In The Greenwood* (`src/music/`), played round and round, with "Now playing" at the top of the screen each time it starts (`src/sound.js`, `src/ui/nowplaying.js`); `M` or the menu turns them off
- A merchant at a market stall on the farm who sells the basics (turnip, carrot and flax seeds, a watering can, bait) and buys what you grow and find, and asks for something each day, for good gold (`src/requests.js`)
- A collection book (`O`): the crops, wild finds, rare finds, dishes, fish and relics you've had, and the bosses you've beaten
- Five bosses (the evil parsnip, the super lion, the bee queen, the giant crow and the bog toad), each through a portal on the farm, at the end of a dungeon of its own little foes, with a mount to win: riding one is faster and jumps higher
- Party games in lobbies: a coin rush, a fishing contest, king of the hill, last one standing and a hop race across the water
- Animals: hens in a fenced yard by their coop (an egg a day), and cows (milk once a day) and sheep (wool every two days) in a pasture; they wander, graze, can be petted and sleep at night
- Building on the farm with wood and stone: fences, rail fences, picket fences, wattle fences, log fences, box hedges, gates, stone arches, wood arbors, walls, low walls, palisades, paths, stepping stones, a stone well, stone lanterns, scarecrows, hay carts, beehives, birdbaths, signposts, water troughs, stone benches, sundials, wheelbarrows, torches, mailboxes, birdhouses, flagpoles, stone cairns, clotheslines, lamp posts, garden benches, rope fences, log benches, compost bins, milk churns, dovecotes, and steps, tree stumps, crates, crate stacks, grain sacks, log piles, barrels, barrel stacks, straw steps and bales, boulders, scaffolds, straw stacks, log towers, stone blocks (mossy too) and pillars to climb on, and a workbench, which makes sturdier tools, swords (wood, steel and silver), a mallet and a bow for bopping other farmers in lobbies (and the bosses), and machines
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
- `E` — at home: till / plant / harvest, trade at the merchant's stall, talk to a neighbour (or go in at their door, and out again), pet an animal (or milk the cow, shear the sheep), let out the animal in hand in her pen, chop a tree with the axe, or mine a rock with the pickaxe; in a lobby: gather (berries, mushrooms), chop a tree with the axe in hand, or mine a rock with the pickaxe (hold to keep swinging)
- `I` — backpack. In it: click picks up, places, swaps or merges a stack; right click or `Ctrl`+click (`Cmd` on a Mac) takes one (`Shift`+right click: half); `Shift`+click moves a stack to or from the toolbar; the bin destroys what you carry (not tools); and a click outside the window drops what you carry on the ground at your feet (below)
- `B` — build (the backpack's Build tab), in groups: fences & walls, paths, blocks to climb, buildings (the workbench, the farm chest, the house, the well), decor, and relics once you have one to show (`BUILD_GROUPS` in `shared/level.js`)
- `K` — your skills (the backpack's Skills tab)
- `J` — your fishing journal; `O` — your collection book; `Q` — your quests (what the neighbours have asked of you); `N` — a map of the valley (the backpack's tabs)
- `M` — sound and music on or off (the menu has a switch for each)
- `V` — the camera: from above (the default), or **first person**, out of the farmer's own eyes (the menu has a **Camera** switch too, and it is kept in this browser). Click the game to look round with the mouse (`Esc` gives the mouse back, and opens the menu); `W` is then the way you look, not north. Click is `E` (hold to keep on), the wheel picks the item on the toolbar, and nothing is walked to by clicking the ground. On a touch screen drag to look round; with a controller, the right stick does (`src/view.js`, `updateCamera` in `src/main.js`)
- `L` — the menu, on **Play online** (from home)
- `Enter` — chat (in a lobby)
- `Esc` — the menu: the same one as the title screen, with **Resume** (and **Go home** when away), and pages for **Play online**, **Friends** (farms you help on, your helpers), **Your farmer** (the wardrobe) and **Controls**. `Esc` on a page goes back.
- `T` (hold) — fast-forward time (30×, at home only: in a lobby the time of day is shared)
- Click the ground — walk there (in build mode: build there)
- Mouse wheel — zoom in and out (over the hotbar it picks an item)

On a touch screen the game shows its own controls: a thumbstick (bottom left) to walk, and **Use** (`E`), **Jump**, **Bag** (the backpack) and, in a lobby, **Chat** (bottom right). Tap the ground to walk there (at home, a ripe crop is harvested, and a tile next to you is tilled or planted with what you hold), tap the stall to trade, a bush or mushrooms to gather, or a tree to chop it with the axe in hand. Pinch with two fingers to zoom in and out. In the backpack, a tap picks up or places a stack, holding a finger on a slot takes one, and a tap outside the window drops what you carry. Hold the clock to fast-forward time at home. **Menu** (the `Esc` menu) is in the place panel. To build, open **Bag** and its **Build** tab; then **Use** builds in front of you, a tap builds on the tile tapped, and **Done** ends it. With a sword, a mallet or a bow in hand in a lobby, tap another farmer to go and bop them.

**With a controller** (an Xbox or PlayStation pad, or any the browser knows in the standard layout; plug it in and press a button): the left stick walks, **A** jumps (hold to glide), **X**, **B** or **RT** does whatever `E` does (hold to keep chopping), **Y** opens the backpack, **LB**/**RB** (or the D-pad left and right) pick the item before or after on the toolbar, the right stick zooms (or, in first person, looks round), **View** builds, **Menu** opens the menu, and holding **LT** speeds up time at home. **D-pad up** reaches the buttons on the screen, like an invitation. In the menu and every window, the D-pad (or the left stick) moves a gold highlight between the buttons and slots: **A** clicks, **X** right-clicks (one of a stack), **B** goes back or closes, **LB**/**RB** switch tabs, and the right stick scrolls. The prompts say **X** instead of `E` while you play with one. More controllers: more farmers at the screen (below, **Together at one screen**).

**Graphics.** The menu's **Graphics** button (next to Sound and Music) picks how much the game draws: **high** (the screen's full sharpness up to twice, shadows at 2048, full-size bloom and the color grade with 4x anti-aliasing, all the grass, round tree canopies, a thin outline round the farmers), **medium** (up to 1.5 times, shadows at 1024, half-size bloom, about half the grass with five blades a tuft, the default on a touch screen) or **low** (half the pixels each way, no shadows, no bloom or grade, a third of the grass, still trees, no cloud shadows, fewer raindrops) for a slow phone or computer. Every tier draws only the grass and ground in view, and stays within the budgets in `docs/visuals/README.md`. It changes at once and is kept in this browser (`tp.gfx`). For testing, `?gfx=low`, `?gfx=medium` or `?gfx=high` in the address picks one for that page, and `?lowgfx` is low (`src/gfx/quality.js`).

## Playing on a phone
Open the address Vite prints for your network (`npm run dev`) on the phone. The built game (`npm run build`, `npm start`) can also be installed as an app ("Add to Home Screen"): it opens full screen, and the farm opens without a connection (only the lobbies need the game server). The app's files are in `public/` (`manifest.webmanifest`, the icons, and `sw.js`, the service worker, which runs in built pages only so Vite's dev server always shows your changes). Browsers only install apps from `https://` or `localhost`.

**Dropping things.** Carry something in the backpack and click (or tap) outside the window: it lands at your feet, bobbing, for walking into. You don't pick it straight back up, not till you have stepped off it. In a lobby anyone can walk into it (a way to give a friend something), and it fades after a while like what a bop knocks loose; for the first few seconds it's for anyone but you. On a farm it stays where it is, kept with the farm: on a farm with helpers its room keeps it, and anyone on the farm can walk into it (after the first few seconds, you too). Only things the merchant has a price for can be dropped (never a tool or a key piece).

## Your farm and online lobbies
**Your farm** is yours alone: the backpack, gold, tilled soil, crops and the time of day are saved as you play. While you're away (in a lobby, or with the page closed) the clock keeps turning and your crops keep growing. The page plays from a copy in your browser and keeps the game server's copy up to date (every 15 seconds, before you set off for a lobby, and when you close the page). There are no accounts yet, so a farm belongs to the browser that made it; playing it on another device, or getting it back after clearing the browser, will come with accounts. (The server still has the pairing code and the farm name & PIN routes, `/api/farms/me/pair` and `/recovery`, but the menu no longer offers them.)

- The device that opened the farm last is the one playing it. A tab left open on another device is told so the next time it saves, and stops saving: reload it to carry on there.
- A farm played before the server kept farms is taken up as it is the first time the page reaches the server.

Without the game server (`npm run dev:client`) the farm stays in the browser until the page next reaches it. A save the page can't read is kept aside as `tp.save.broken`, an older one is kept as `tp.save.v<N>` when it's brought up to date, and a save from a newer version of the game is left alone (nothing is saved until you reload with that version).

**Your farmer** is dressed in the menu's **Your farmer** page (or at the wardrobe in your house: `E` there, or tap it). Pick a hat (a straw hat, a sun hat, a cap, a flat cap, a beanie, a cowboy hat, a sou'wester, a bandana or a flower crown, each in a color of its own), a hairstyle (a ponytail, braids, a bun...) and its color, skin, freckles, glasses or shades, a mustache or a beard, a top (a shirt, a T-shirt, a flannel, stripes or a sweater) in your shirt color, overalls, short overalls, trousers or a skirt, an apron over them, boots, wellies or sneakers, and a neckerchief or a scarf. The merchant and the neighbours dress from the same wardrobe, in colors of their own. The farmer turns on a little stage while you choose (drag to turn them yourself) and wears it in the game straight away; **Surprise me** picks an outfit at random. What you wear is kept with your account, so it is the same on every device, and other farmers see it in lobbies and on farms the moment you change. Your shirt's color is your color online too: on your name tag, in chat and in the player list (`LOOK_PARTS` in `shared/looks.js`, `src/ui/wardrobe.js`).

**The merchant** keeps a stall just east of the plaza on your farm. Walk up to the counter and press `E` to trade: buy the basics, turnip, carrot and flax seeds, a watering can and bait (click: one, `Shift`+click: five; `MERCHANT_STOCK` in `shared/balance.js`), and sell your crops, forage, gems and spare seeds from your backpack (click: the whole stack, right click: one). Tools and the old key aren't for sale. Prices are `price` (buy) and `sell` on each item in `src/items.js`; the item tooltips show what the merchant pays. Everything else is sold by the neighbours, below.

**The valley.** The farm sits in the middle of a valley five times its size (`HOME_HALF` in `shared/farmland.js`, 141 by 141 tiles); the old farm is as it was, its trees and rocks where they always stood. Round it: a forest across the north, thick with pines and big old trees, with a fern glen to the west and a bluebell glade to the east; a flower meadow to the west; a heather heath to the south-west; a lake with a reed marsh round it to the east (fish in it as in a pond); a sunflower field and a pumpkin patch to the south-east, a strawberry bank, and shell dunes along the south shore. Roads go out from the old farm's paths to each neighbour's door, with signposts where they leave it; the Map tab (`N`) shows where everything is. While you play your farm alone, wild things turn up in the biomes now and then, to walk into: mushrooms and berries on the forest's moss, ferns in the glen, bluebells in the glade, berries in the meadow, heather on the heath, cattails on the marsh, sunflowers, pumpkins, strawberries, and seashells on the dunes and the beach (`FARM_FORAGE` in `shared/balance.js`). The valley is yours to farm and build on, all but the lake and the neighbours' places.

**The neighbours** (`shared/npcs.js`, `shared/talk.js`, `src/npcs.js`, `src/dialog.js`; their homes: `src/npchomes.js`, `src/npcyards.js`, `src/nporooms.js`, `src/homekit.js`):
- **Rosa**, at Meadow Ranch to the west over the meadow: a red ranch house with a porch, a weathervane, a paddock of animals, a coop and a well; inside, a stone fireplace with Clementine the hen in a basket by it, a spinning wheel and her rosettes. She sells hens, sheep and cows.
- **Basil**, at Basil's Seeds to the east past the fields: a thatched cottage with a greenhouse, an arbor, vegetable beds and a beehive, by the sunflower field; inside, a cabinet of seed drawers, a potting bench and an armchair under his wife Marigold's portrait. He sells every seed the merchant doesn't, his rare seeds (vine beans, berry cuttings, cotton) once you have done more for him, and at the last a few golden seeds.
- **Finn**, at Finn's Tackle on the dunes to the south: a fishing hut with a lighthouse whose beam sweeps the dunes at night, and a dock out over the sea (broken till you bring him the wood to mend it; then walk out to the end and cast); inside, a hammock, a chart with a cross on it and Barnacle the parrot. He sells bait, lures and a fishing rod, and later a sturdy rod.
- **Mabel**, at Mabel's Bakery at the forest's edge to the north-east, smoke curling from its chimney, with a terrace of tables under a parasol and an oven for bread out the side; inside, a chalkboard of the day's bakes, bunting and Biscuit the kitten asleep by the oven. She sells the kitchen's recipes.

Walk up to one and press `E` (or tap them) to talk: their face, how much they like you (hearts), what they say, and a list of what you can say back, numbered (click, tap, or press its number; `Up` and `Down` and `Enter` work too, and so does a controller). What is on the list depends on what is on between you:
- **A message** to tell them, from another neighbour, comes first. Four of the requests are messages, and they go round the valley: Rosa to Mabel to Basil to Finn and back to Rosa.
- **Their request**, starred while they wait on you. Ask what you can do, and they tell it: take it, ask what you would get for it, or put it off. Once it is taken the window shows how far it has come; ask how it is going to hear what they said while they wait; say you have brought it and they hand over what it gives (gold, things, a shelf of their shop opened). The last of each neighbour's lets you pick your reward from two or three.
- **A moment of theirs**, starred, at 2 and at 4 hearts: something on their mind that they ask what you think about. What you answer is remembered, and they bring it up later, and it shows where they live (the name of Rosa's calf on the paddock fence, what grows on Basil's windowsill). Each counts once, for hearts and a gift.
- **A chat**, a menu of what you can ask about: how they are, tips for the game, the others (the ones you have met), and more that opens as they like you and as you do things for them; what you have not heard is marked new. Each answer can lead to more.

Their requests come one at a time, seven each. The first opens their shop: pet three of your animals for Rosa, grow Basil five turnips, bring Finn ten wood for his dock, find Mabel three mushrooms in the woods. After that they ask for eggs and milk, wool, cheese, sunflowers and carrots, bluebells from the glade, a scarecrow on your farm, fish you landed yourself, a sea bass, seashells, honey, a dish from your kitchen, berries, a water trough and a hay cart, a bolt of cloth, fifteen crops picked, six trees felled, three meals cooked, cloud cotton, a lanternfish and a moonfish caught after dark, a farm feast... A little sign floats over a neighbour with something for you: a "!" (a request to hear), a tick (one to hand in), a speech bubble (a message you carry to them) or a heart (a moment to share). The Quests tab (`Q`) lists them all, and a word in the corner says when one is ready. A chat once a day, what they tell you, and every request done make them like you more: each heart takes 2% off their prices, up to five (`FRIENDSHIP` in `shared/balance.js`). Every shop buys what the merchant does.

Each keeps to a day of their own, by the farm's clock: up early and pottering about indoors, behind their counter through the day, out in their yard of an evening, and asleep in bed at night (no shop then). `E` at their door goes in: their room is out past the sea on the farm's world, as the house's is; `E` at the door inside comes back out. Each room is laid out its own way, has a clock that tells the farm's hour, and glows warm at night. What you do for them shows where they live: Rosa pins a prize rosette to her door after the fair, Basil's windowsill grows what you told him to plant, Finn hangs the bass he asked you for and ties a rowboat up at his dock, Mabel lays a feast out in front of the bakery; and at 2 hearts there is a place laid for you at their table, at 4 flowers on it. Where you stand with each, their requests, and what you have said, are yours, kept with your backpack, wherever you play; on a friend's farm they are there too.

**The animals** live in two pens on the farm: the hens in a fenced yard west of the plaza, with a coop, a nest and a trough; the cows and sheep in a pasture south of it, off the path to the shore, with hay bales and a water trough. A new farm comes with two hens, a cow and a sheep (so does a farm saved before there were any), and Rosa at her ranch sells more, once her shop is open to you: a hen 150g, a sheep 350g, a cow 500g. A pen has room for 8 hens, or 4 cows and 6 sheep; upgraded at the workbench (twice) its fence goes out a little and there is room for 12 and then 16 hens, 6 and 8 cows, 9 and 12 sheep. The yard's coop gets bigger and some eggs are **large eggs** (35%, then 70%); the pasture gets a hay rack and then a barn, and a cow or sheep gives two milk or wool half the time, then every time. Something built or farmed where the bigger fence goes has to go first. One sits in the backpack until you stand in her pen with her in hand and press `E`. By day they wander and graze (the hens peck); the hens and sheep scurry off if you run at them, and a cow nudges you aside. Walk up to one and press `E` (or tap her) to pet her, or, when a little picture floats over her, to milk the cow or shear the sheep. A little before dark the hens go up the ramp to roost and the cows and sheep lie down in the grass; they're up again after sunrise.

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
  - better tools, each made from the one before: a **sturdy axe** and a **sturdy pickaxe** take three and two swings instead of four and three, and a **wide hoe** tills three tiles side by side; at level 2, **silver** ones (two swings, one swing, five tiles in a row), at level 3 **golden** ones (one swing and an extra log or stone, a patch three by three), for gold, wood, stone and gems. A tool you have made better already comes off the list, and so does the one you have: only the next one up its line is there, and at the top of its line the one you have stays, done (as fine as it gets);
  - a **wooden sword** (8 wood), and from it a **steel sword** (5 steel, 4 wood) and at level 2 a **silver sword** (400 gold, 8 steel, a sky gem), each bopping harder than the one before (the silver one swings faster too); a **mallet** (4 wood, 6 stone); and a **bow** (10 wood, 3 wool) with **arrows**, five at a go (2 wood, 1 steel): for bopping (see the lobbies, below) and the bosses;
  - a **fishing rod** (5 wood, 2 flax), and from it a **sturdy rod** (15 wood, 10 stone, 4 flax), and at level 2 a **golden rod** (500 gold, 20 wood, 2 sky gems): see Fishing, below;
  - the machines: a **cheese press** (20 wood, 10 stone), a **mayonnaise machine** (15 wood, 15 stone) and a **loom** (25 wood, 10 flax), put down from the Build tab (see **Machines and cooking**, below).

  Up top it has the farm's **upgrades**, bought by its farmer with gold, wood and stone (and gems): the workbench itself (three levels, each making more, and drawn fancier: a pegboard and a lantern, then a little roof, an anvil and a grindstone), and the hen yard and the pasture (three levels each: below). A recipe's `level` says which workbench it takes (`RECIPES`, `BENCH_LEVELS`, `PEN_LEVELS` in `shared/balance.js`).
- A **fish pond** (30 stone), 3 tiles by 3, built from the middle of its front row: still water in a ring of stones, to fish in.
- A **campfire** (6 wood, 6 stone), to cook on, flickering and lighting the ground round it at night.
- **Bunting** (2 wood, 1 cloth), a string of little flags between two poles, and a **market awning** (4 wood, 2 cloth), a counter under a striped roof: built with the cloth from the loom.
- A **farm chest** (8 wood, 2 stone), one to a farm: somewhere to keep things. What your backpack is short of comes out of it when you build, and when you make things or buy upgrades at the workbench (on a farm with helpers, only for you).
- A **house** (500 wood, 200 stone), one to a farm and one more for each helper, 5 tiles across and 4 deep, built from the middle of its front where the door is. `E` at the door (or a tap on the house) goes inside (every house on the farm opens into the same room): a room of 200 tiles (20 by 10) with a bed, a table, a fireplace, a shelf of books, a wardrobe to change clothes at and a kitchen to cook in, and a field of earth (8 by 6) to till and plant like the farm's. `E` at the door inside goes back out. Its windows light up at night (`HOUSE_ROOM` in `shared/level.js`, `src/house.js`).
- **Take down** (in the Build tab) takes a piece away and gives back what it cost.
- Nothing goes on tilled soil, in the animals' pens, by the stall's counter, where farmers arrive on the plaza, in the lake, on a neighbour's place, or on someone standing there. What's built is saved with the farm, and on a farm with helpers everyone can build (each pays from their own backpack) and the farm's room keeps it, like the soil (`PIECES` in `shared/level.js`, `src/build.js`).

**Fishing.** With a rod in hand, face the water (the sea past the sand, the end of Finn's dock, the lake in the valley, or a fish pond) and press `E` (**Use** on a phone): the line goes out and the bobber floats. When it dips with a splash and a **!** (on a phone the Use button pulses and the phone buzzes), press `E` again, quickly: the rarer the fish, the less time you have. Too slow and it gets away; `E` before anything bites, or walking off, just reels in.
- The sea round the farm has sardines, mackerel and sea bass, seaweed, and a moonfish late at night; a pufferfish takes a sturdy rod. A fish pond, and the valley's lake, have minnows and perch, sunfish around midday, catfish in the evening, and a koi for a sturdy rod. A lobby's water has the rarer ones (see the lobbies, below).
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
- In the **kitchen** in your house (a stove and a counter on the back wall), straight away, from the recipes in your **recipe book**; `E` at the kitchen, or at the bookshelf, opens it. Kitchen dishes need more (cheese, honey, milk, eggs, crops, forage) and give stronger, longer boosts. Pancakes, a cheese omelette and fish stew are in the book from the start; Mabel at her bakery sells the recipes for pumpkin soup, honey-glazed carrots, mushroom pie, sushi rolls and the **farm feast** (a recipe already in your book is not for sale again); and the best (carrot cake, berry tart, golden turnip pie) are on **old recipe cards**, rare finds in the lobbies (the whole lobby hears). A recipe card goes into the book as soon as it's in your backpack. What you can cook right now is listed first, and `×5` cooks up to five at once (the pot's lid rattles). Your recipe book and your meal are yours, kept with your backpack.
- The **farm feast** is for sharing: eaten on your farm with helpers there, everyone on the farm gets its boost too.

On a farm with helpers the farm's room keeps what is in each machine: anyone can put things in from their own backpack, and whoever collects what a machine made gets it in their own backpack (`MACHINES`, `DISHES` and `BOOSTS` in `shared/balance.js`; `shared/machines.js`, `src/machines.js`, `src/cooking.js`).

**Bosses and their dungeons.** A boss's portal, built on the farm from a full set of its key pieces, leads down into its **dungeon**: four rooms one after another, each a little to one side of the last (each dungeon its own way), with a gate at the far end of each that opens once that room's foes are all bopped down, and the last onto a bridge into the boss's **hall**, where you fight it: the dungeon's last room, round, built like the rest of it (its floor, its walls and lamps, two of its set pieces), with the boss's own things at the back and a way home off to one side. Off two of the rooms a door opens (with that room's gate) into a **side room**, where a few more foes guard a **chest**: bop them and `E` at it opens it, for a handful of random loot (coins, steel, arrows, seeds, now and then a sky gem, golden seeds, an old recipe card or the boss's own key piece; each dungeon has a few things of its own too: `DUNGEON.chest` and `DUNGEONS` `loot` in `shared/balance.js`). A chest is yours once a game day (a helper's too, each their own); with a full backpack what doesn't fit waits till there's room. Side rooms are on no one's way: skip them if you like. Past a shut gate or door it's dark: you can't see the next room (nor the hall) till you've beaten every foe in yours; then the gate sinks into the floor and the dark over what it opens onto lifts. Down there, the hall too, it's underground: no sky and no sea, just dark rock rising all round (spires, boulders, glowing crystals), a dim light of the dungeon's own color and a lamp's glow round you, pools of light under the lamps, flames that flicker, and dust, embers, pollen or spores drifting in the air. Each dungeon is the boss's own, and so are its foes (`DUNGEONS` in `shared/balance.js`, `shared/dungeons.js`, `src/dungeon.js`, `src/dungeonfoes.js`):
- the evil parsnip's **Root Cellar** (earth walls on a stone footing in a timber frame, roots and strings of garlic hanging down, shelves of jars, a boardwalk, crates, sacks and barrels, hanging lanterns; a heap of parsnips by a cart, a great root through the floor, a glowing pickling vat; in its hall, its own patch of parsnips between lantern posts): **sproutlings**, little angry parsnips that hop at you;
- the super lion's **Sunbaked Ruins** (sandstone blocks under a carved frieze, columns, red banners, a red runner over the flagstones, sand drifting in, braziers; a broken lion statue, a sunken pool, a golden lion on an altar; in its hall, a golden sun set in the floor and a lion's head on a dais between braziers): **lion cubs** that crouch and dash at you;
- the bee queen's **Honeycomb Halls** (walls and floor of wax cells, some full of honey and some glowing, wax dripping, honey lamps; a honey pool, a nursery of glowing cells, a giant flower; in its hall, a great comb, honey glowing in its cells): **worker bees** that fly and dart at you;
- the giant crow's **Rookery** (log walls, wicker, nests along the top, rooks on perches, bird cages of cold blue light, shafts of moonlight; a broken cart of pumpkins, a giant nest, a hoard of shiny things; in its hall, a dead tree full of rooks over their hoard): **rooks** that fly up and swoop down through where you stand;
- the bog toad's **Sunken Bog** (mossy stones hung with vines, shelf fungi, murky water with lily pads and stepping stones, reeds, glowing toadstools and fireflies; a toadstool ring, a pond with a plank bridge, a sunken rowboat; in its hall, a lily pond and a stone toad): **bog frogs** with big heavy hops.

A room's foes wake when you come in. Bop them with a sword or the mallet, or shoot them with the bow: a better weapon takes more off each time (two bops of a wooden sword down a sproutling, one of the silver sword). They only go for whoever is in their room, and a foe going at you knocks you back and leaves you dizzy for a moment, as the boss does; three of those and you're back at the start of the room. A way home stands by where you come in, and the boss's hall has its own. Left empty a while (nobody in the dungeon or its hall), a dungeon is as it was again, its foes back and its gates shut. On a farm with helpers the farm's room runs the dungeons, so friends clear them together.

**Together at one screen: split screen.** Up to four farmers can play on your farm at one screen, each on a controller of their own. Open the menu (`Esc`), pick **Add a player (split screen)**, and the new farmer presses **A** on their controller: the screen splits (side by side for two, one above the other on a screen taller than it is wide, in quarters for three or four), and their part of it asks who they are:

- **A farmer played here before**: picked off the list (an account logged in here before, or a guest kept here). **×** (twice) forgets one on this device.
- **Log in to your account**: your own farmer comes along: your backpack, gold, skills, fishing journal, collection book, recipes, standing with the neighbours, the bosses you have beaten and your clothes. What you do here is saved back to your account (every 15 seconds, and when you get up); your own farm stays as it is. While you play here this device holds your farmer, so a tab of yours open somewhere else stops saving, as it does when you log in on another device.
- **Play as a guest**: a new farmer of this device's own, in clothes of their own, with a starter kit, kept here to play again next time.

A box (a username, a password, a name) is typed in on the keyboard (click it), or, with a controller alone, on the keys that open under it (**A** on the box; **Shift** for a capital, **Space**, **⌫** to rub one out, **Done**, or **B**), and the keyboard stays the first farmer's meanwhile. Once two play, **Start** on another controller joins straight away; a farmer whose controller comes unplugged gets it back with **Start** on it again (or on another). Each farmer has their own camera, toolbar, backpack and windows in their part of the screen (a small part laid out as a phone's screen is), a name over their head in everyone else's view, and their own prompts (**X** for use). The farm is the first farmer's: what anyone grows, builds or puts in the chest stays on it, the neighbours each know each farmer for themselves, the merchant has a request of the day for each, anyone can pick up the eggs and finds they walk into (whoever has room), each farmer who swings at a giant gets their share of it, and the dungeons and bosses go for everyone in them (not for a farmer still saying who they are). The clock keeps going while anyone is playing (it waits only while everyone is in a menu), and anyone holding **T** (or **LT**) speeds it up. **Start** opens a joined farmer's own menu, with **Get up from the screen**, which saves them. The first farmer keeps the keyboard and the mouse (and a controller, if they play with one); heading online is theirs to do. **A lobby** takes the farmers at the screen along: each one logged in to their account goes too, on a connection of their own as their account's farmer (they gather, chop, mine, trade, bop, fish and play the party game, each for themselves, and keep what they find), and comes home with the first farmer after; a guest, or one still saying who they are, gets up first, saved (a lobby is for farmers with an account). **A friend's farm** is the first farmer's alone: everyone else gets up first, saved. On a farm with online helpers it works the same: each farmer at the screen is on the farm's room with a connection of their own (as the owner's guest, with the owner's say: not a helper of the farm, and gone when the owner's connection is), so the helpers see them walk about and farm, and they see the helpers.

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
- Every rock can be broken up for **stone**: with the pickaxe in hand, press (or hold) `E` next to a rock. Three swings break it for everyone and give stone to whoever finished it: one or two from an ordinary rock, one from a pebble, up to 6 from the boulders at the foot of the terraces; in a lobby it stays broken. The merchant buys stone. Now and then there is a lump of **steel** in a rock as well (one rock in four of the ordinary ones, two in three of the big boulders; three for each farmer who helped break up a giant rock), for the steel sword and arrows (`ROCK_BALANCE` in `shared/balance.js`). The farm's own trees and rocks are chopped and mined the same way, and grow back (even while you're out; with helpers on the farm, the wood or stone goes to whoever got it). A farm from before the pickaxe gets one the first time it loads.
- Berry bushes and mushrooms are picked with `E`; treasures out in the meadow and up on the ledges are collected by walking into them. Whoever gets there first takes it, and it stays empty.
- Now and then something rare turns up (golden seeds, an old key) with a golden glint over it, and the whole lobby hears about it in chat. Golden seeds grow a golden turnip at home.
- **Bopping**: with a sword or a mallet (made at a workbench) in hand, `E` bops the nearest farmer in reach (or tap them to go and bop them). They stumble back and drop a little of what they gathered on this visit, one thing with the wooden sword, two with the steel sword or the mallet, three with the silver sword, for anyone to walk into (anyone else, for the first few seconds: the farmer it came out of can't grab it straight back): never a rare find or gold. Nobody gets hurt. A farmer just bopped can't be again for a few seconds, and nobody bops or is bopped in the stone circle where you arrive (`WEAPONS`, `DROP_OWN_MS` in `shared/balance.js`). The **bow** bops from further off (up to 12 m, and up or down a ledge): `E` shoots an arrow from your backpack at the nearest farmer you are more or less facing, turning to them, and everyone sees it fly. The swords, the mallet and the bow work on the bosses too, the better swords taking off more each bop, the bow from a distance.
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
- What a farmer wears (their look, `shared/looks.js`: every part one of a few choices, so the server can check it) is kept with their account (`farm.look`, `PUT /api/account/look`). A place reads it off the account when they join, and again when their page says they changed (`DRESS`), so a page can't wear what its account doesn't; the roster carries everyone's look. The farmer (`src/character.js`) is built from simple shapes and drawn in cloth with a little pattern to it (a check, stripes, a knit, denim, woven straw), with a soft light on its edges that follows the time of day; the pieces of each part that moves on its own are merged into one mesh per material, so a farmer is a couple of dozen draw calls whatever they wear.
- Messages are small JSON objects; `shared/protocol.js` lists them all.
- The home farm needs no server: `npm run dev:client` (Vite alone) is enough to farm. With one, the server keeps a copy of each farm in `data/farms/<id>.json` (`server/farms.js`, `src/net/farm.js`). A farm is known by its id, and each device has a token of its own for it (the server keeps only their hashes, and the PIN only as a scrypt hash); the save is the page's, kept as it's sent. The farm-name index is gathered from the farm files when the server starts. Accounts, later, can point at a farm id, so farms stay where they are.
- A split screen (`src/main.js`, "The farmers at this screen") is seats: one for each farmer at the screen, each with its own camera, body, input, backpack and windows, tool and build state. The code is written for one farmer (`player`, `inventory`, `camera`...): `become(seat)` puts a seat's own in those, each frame for each seat in turn and whenever a seat's windows call back (`seated`, `forSeat`). The farm, its animals, the neighbours (`createNpcs` and each seat's `standing`), the bosses and dungeons (`createBosses` and each seat's `seat()`) are one, for everyone. Each seat's view is drawn in its part of the canvas, with its own fog, shadows, light (a dungeon's), rain and leaves round it (`lookFrom`). Its HUD and windows sit in a `.seat` box of its own, and their CSS measures it with container units (`cqw`, `cqh`) instead of the screen's. On a farm played in its room (with helpers), each seat also has a connection of its own to the room (`connectSeat`, `roomLine`: the line a seat's actions go over, `idOf`/`seatBy`: who the room means), admitted as `local` (`server/farmroom.js`). In a lobby the same: each seat with an account has a line of its own to it, as that account (`connectLobbySeat`, `lobbyLine`; `line()` is whichever of the two a seat's actions go over). What the room says to everyone is heard once, on the page's own line, and handed to the seat it is about (`seatBy`); what it says to one farmer alone (`farmPrivate`, `lobbyPrivate`) is heard on that seat's own. A joined farmer's farmer is theirs (`src/net/players.js`): an account's is opened on the server like another device's and saved with the farm left as the server has it; a guest's is kept in this browser.
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
│   ├── character.js     # the farmer model, dressed in their look, and its animations (you, everyone else, the merchant)
│   ├── items.js         # the item catalog: names, prices, pixel-art sprites
│   ├── inventory.js     # the backpack and toolbar
│   ├── crops.js         # what each seed grows into, and the growing plants
│   ├── daynight.js      # the clock, sun, moon, sky and fireflies
│   ├── merchant.js      # the merchant's stall on the farm, and the merchant behind it
│   ├── shop.js          # a shop's window (the merchant's or a neighbour's): buy, sell from the backpack
│   ├── npcs.js          # the neighbours: their day, where you stand with them, the signs over their heads
│   ├── npchomes.js      # the neighbours' homes on the farm: the room shell, Finn's dock, the signposts, what shows as you do things
│   ├── npcyards.js      # each home's house and yard: Rosa's ranch, Basil's cottage, Finn's lighthouse, Mabel's terrace
│   ├── nporooms.js      # what is inside each: the fireplace, the potting bench, the hammock, the work table
│   ├── homekit.js       # what the homes are built from, and the baking of their parts into a few meshes
│   ├── dialog.js        # talking to a neighbour: what you can say, their requests, chat, their shop
│   ├── quests.js        # the backpack's Quests and Map tabs
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
│   ├── seats.css        # a split screen: each farmer's part of it
│   ├── net/
│   │   ├── connection.js  # WebSocket to a lobby
│   │   ├── lobby.js       # the lobbies' HTTP API, invite links
│   │   ├── farm.js        # the farm's copy on the server, pairing codes
│   │   └── players.js     # the farmers who join at a split screen: their accounts or guests, saved back
│   ├── gfx/             # graphics: the tiers (quality.js: the Graphics setting), what the renderer drew (stats.js)
│   └── ui/              # title screen (splash.js), the wardrobe (wardrobe.js), in-game HUD (hud.js), touch controls (touch.js), a joined farmer's panel (seatpanel.js), styles
├── shared/              # runs on both the server and the client
│   ├── place.js         # what every online place has: players, seats, chat, snapshots
│   ├── room.js          # one lobby: resource spots, trees
│   ├── protocol.js      # message types
│   ├── looks.js         # what a farmer can wear: the choices, the default, checking a look
│   ├── constants.js     # tick rate, limits
│   ├── balance.js       # every balancing number: regrow times, prices, costs, loot, recipes
│   ├── farmland.js      # the farm's valley: its ground, biomes, roads, the neighbours' homes
│   ├── npcs.js          # the neighbours: who they are, what they sell, what they ask of you
│   ├── talk.js          # what you can say to them and what they answer, and the rules for it
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
│   ├── browser.mjs      # npm run browser: the game in a headless Chromium, for a test
│   ├── shots.mjs        # npm run shots: eleven fixed screenshots, their stats and a contact sheet
│   ├── lib/page.mjs     # the headless launcher both share (dev server, login, onto the farm, frozen)
│   └── test-multiplayer.js  # npm test
├── docs/CONCEPTS.md     # an early brainstorm of game ideas
├── docs/visuals/        # the visual overhaul: art direction, tiers, budgets (README.md), where it stands (STATUS.md), one doc per phase
├── package.json
```

## Where to go next
See [docs/BACKLOG.md](docs/BACKLOG.md): what is in progress, what is next, and the ideas waiting by theme.

## Tests
```bash
npm test
```
Checks the islands (the classic one and hundreds of seeds: every spot reachable, the same seed always the same island), the farm's valley (five times the old farm, the old farm's trees and rocks pinned where they stood), the neighbours' requests, shops and conversations (what opens with hearts, what they remember, a save from before still loading), the lobby's rules (taking spots, regrowth, rare finds, rejoin, chat limits) and the server end to end over real sockets.

```bash
npm run browser -- -e 'g.hold("Space", 0.3); return g.player.position' --shot shot.png
```
Plays the game in a headless Chromium (`scripts/browser.mjs`): it logs a test account in, walks onto the farm and freezes it, then runs a test that moves the game on by game time (`window.__game.step`), however slowly the page draws. See `.claude/skills/browser-test/SKILL.md`.

```bash
npm run shots                 # or: npm run shots -- --tier medium --check
```
Eleven fixed screenshots of the game at full graphics (`scripts/shots.mjs`), into `shots/` (not in git): the plaza in the morning and at noon, the forest, the shore and the sea, the lake at sunset, lamps at night, rain, a dungeon, a split screen, a lobby and a phone. Each comes with what the renderer drew (`shots/stats.json`: draw calls, triangles, shaders), and `shots/contact.png` has them all on one page. `--tier` draws at that graphics tier; `--check` fails when the plaza at noon or the phone is over its tier's budgets in `docs/visuals/README.md`.

```bash
npm run gates
```
Runs every check a change must pass, in order (`npm test`, the build, the headless browser at low and full graphics, `npm run shots -- --check` on the low tier and on the default ones), one line each, with the end of the output of any that fail (`scripts/gates.mjs`).

## Build for production
```bash
npm run build
npm start        # serves the built client, the API and the game sockets on PORT (default 3001)
```

`HOST=127.0.0.1` keeps it to the machine itself (behind a proxy), and `TRUST_PROXY=1` takes visitors' addresses from the proxy's `X-Forwarded-For` (for the limits on opening lobbies and farms and guessing PINs).

## Online
The game runs on a DigitalOcean droplet, behind [Caddy](https://caddyserver.com/) for HTTPS. Every push and pull request is tested and built by GitHub Actions (`.github/workflows/deploy.yml`), and a push to `main` is then copied to the droplet and the game restarted: players in a lobby drop for a moment and are reconnected, and the lobbies and farms (in `/var/lib/island`, apart from the game) stay as they were.

A new droplet (Ubuntu 24.04) is set up once with `deploy/setup-droplet.sh`; the comment at its top says how and what it puts where. The workflow needs the repository variable `DEPLOY_HOST` (the droplet's domain) and the secrets `DEPLOY_SSH_KEY` (the deploy key) and `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <DEPLOY_HOST>`). On the droplet, `journalctl -u island` shows the server's log.
