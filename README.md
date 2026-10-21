# Island Platformer

A cozy 3D farming game built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/): tend your own little farm on an island, then drop into online lobbies to gather berries, mushrooms and rare finds with other farmers.

## What's included
- A stylized farmer with walk, jump, landing and tool-swing animations, a hoe, an axe and a pickaxe, and a camera that follows from an angled overhead view
- A tiled island (grass, dirt paths, stone plaza, sand shore) surrounded by water, with trees, bushes, rocks, wind-swayed grass and flowers, and grass-topped platforms to jump between; trees fade out when they block the view of the player
- Farming: till, plant and harvest turnips, carrots, flax and sunflowers, in a backpack-and-toolbar inventory
- A day/night cycle with a sun and moon, fireflies and a clock
- A merchant at a market stall on the farm who sells seeds and animals and buys what you grow and find
- Animals: hens in a fenced yard by their coop (an egg a day), and cows (milk once a day) and sheep (wool every two days) in a pasture; they wander, graze, can be petted and sleep at night
- Building on the farm with wood and stone: fences, gates, walls, paths, crates and stone blocks to climb on, and a workbench, which makes lamp posts, benches, flower planters, sturdier tools, and a sword and a mallet for bopping other farmers in lobbies
- A saved home farm, and drop-in online lobbies (up to 8 farmers) where resources regrow and rare finds turn up (see below)
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
- `Space` — jump (only works while grounded)
- `E` — at home: till / plant / harvest, trade at the merchant's stall, pet an animal (or milk the cow, shear the sheep), let out the animal in hand in her pen, chop a tree with the axe, or mine a rock with the pickaxe; in a lobby: gather (berries, mushrooms), chop a tree with the axe in hand, or mine a rock with the pickaxe (hold to keep swinging)
- `I` — backpack
- `B` — build (the backpack's Build tab): fences, walls, paths, the workbench and what it makes
- `L` — the menu, on **Play online** (from home)
- `Enter` — chat (in a lobby)
- `Esc` — the menu: the same one as the title screen, with **Resume** (and **Go home** when away), and pages for **Play online**, **Friends** (farms you help on, your helpers) and **Controls**. `Esc` on a page goes back.
- `T` (hold) — fast-forward time (30×, at home only: in a lobby the time of day is shared)
- Click the ground — walk there (in build mode: build there)
- Mouse wheel — zoom in and out (over the hotbar it picks an item)

On a touch screen the game shows its own controls: a thumbstick (bottom left) to walk, and **Use** (`E`), **Jump**, **Bag** (the backpack) and, in a lobby, **Chat** (bottom right). Tap the ground to walk there (at home, a ripe crop is harvested, and a tile next to you is tilled or planted with what you hold), tap the stall to trade, a bush or mushrooms to gather, or a tree to chop it with the axe in hand. Pinch with two fingers to zoom in and out. Hold the clock to fast-forward time at home. **Menu** (the `Esc` menu) is in the place panel. To build, open **Bag** and its **Build** tab; then **Use** builds in front of you, a tap builds on the tile tapped, and **Done** ends it. With a sword or a mallet in hand in a lobby, tap another farmer to go and bop them.

## Playing on a phone
Open the address Vite prints for your network (`npm run dev`) on the phone. The built game (`npm run build`, `npm start`) can also be installed as an app ("Add to Home Screen"): it opens full screen, and the farm opens without a connection (only the lobbies need the game server). The app's files are in `public/` (`manifest.webmanifest`, the icons, and `sw.js`, the service worker, which runs in built pages only so Vite's dev server always shows your changes). Browsers only install apps from `https://` or `localhost`.

## Your farm and online lobbies
**Your farm** is yours alone: the backpack, gold, tilled soil, crops and the time of day are saved as you play. While you're away (in a lobby, or with the page closed) the clock keeps turning and your crops keep growing. The page plays from a copy in your browser and keeps the game server's copy up to date (every 15 seconds, before you set off for a lobby, and when you close the page). There are no accounts yet, so a farm belongs to the browser that made it; playing it on another device, or getting it back after clearing the browser, will come with accounts. (The server still has the pairing code and the farm name & PIN routes, `/api/farms/me/pair` and `/recovery`, but the menu no longer offers them.)

- The device that opened the farm last is the one playing it. A tab left open on another device is told so the next time it saves, and stops saving: reload it to carry on there.
- A farm played before the server kept farms is taken up as it is the first time the page reaches the server.

Without the game server (`npm run dev:client`) the farm stays in the browser until the page next reaches it. A save the page can't read is kept aside as `tp.save.broken`, an older one is kept as `tp.save.v<N>` when it's brought up to date, and a save from a newer version of the game is left alone (nothing is saved until you reload with that version).

**The merchant** keeps a stall just east of the plaza on your farm. Walk up to the counter and press `E` to trade: buy turnip, carrot, flax and sunflower seeds (click: one, `Shift`+click: five), and sell your crops, forage, gems and spare seeds from your backpack (click: the whole stack, right click: one). Tools and the old key aren't for sale. Prices are `price` (buy) and `sell` on each item in `src/items.js`; the item tooltips show what the merchant pays.

**The animals** live in two pens on the farm: the hens in a fenced yard west of the plaza, with a coop, a nest and a trough; the cows and sheep in a pasture south of it, off the path to the shore, with hay bales and a water trough. A new farm comes with two hens, a cow and a sheep (so does a farm saved before there were any), and the merchant sells more: a hen 150g (up to 8), a sheep 350g (up to 6), a cow 500g (up to 4). One sits in the backpack until you stand in her pen with her in hand and press `E`. By day they wander and graze (the hens peck); the hens and sheep scurry off if you run at them, and a cow nudges you aside. Walk up to one and press `E` (or tap her) to pet her, or, when a little picture floats over her, to milk the cow or shear the sheep. A little before dark the hens go up the ramp to roost and the cows and sheep lie down in the grass; they're up again after sunrise.

What they give comes on the farm's clock, so it keeps coming while you're away:
- **Eggs** (25g): each hen lays one a day, between mid-morning and the afternoon, where she stands, or in the nest beside the coop if it fell due while she slept or you were off the farm (up to 3 lying about per hen). Walk over an egg to pick it up.
- **Milk** (60g): a cow has milk once a day, from the morning after you last milked her.
- **Wool** (120g): a sheep's fleece grows back two days after shearing, and you can see it fill out.

The animals and eggs are saved with the farm (`src/animals.js`).

**Building.** Wood and stone from the lobbies build things on your farm. Open the backpack's **Build** tab (`B`) and pick a piece: a see-through one shows where it goes (red where it can't), on the tile you point at with the mouse or the one in front of you. `E` puts it down (hold `E` and walk to lay a path), and so does a click or a tap on a tile (the farmer walks over first if it's far). **Done** or `Esc` ends build mode.

- **Wood fence** (2 wood) and **stone wall** (3 stone) join up with the fences and walls beside them. A fence can be hopped over; a wall can't.
- **Wood path** (1 wood) and **stone path** (1 stone) are walked on.
- A **wood gate** (3 wood) joins up with the fences beside it, like a fence, but is walked through.
- Blocks to climb on: a **stone step** (2 stone) is walked up onto, a **wood crate** (3 wood) or a **stone block** (4 stone) takes a hop (or a step in front of it). Put them side by side for a platform, or step, crate, block for a stair.
- A **workbench** (10 wood, 5 stone). `E` next to it (or a tap) opens it, to make:
  - decorations, put down from the Build tab like the rest: a **lamp post** (3 wood, 2 stone) that lights up at night, a **garden bench** (6 wood) and a **flower planter** (4 stone, 1 wood);
  - sturdier tools, made from your old one: a **sturdy axe** and a **sturdy pickaxe** take two swings instead of four and three, and a **wide hoe** tills three tiles side by side;
  - a **wooden sword** (8 wood) and a **mallet** (4 wood, 6 stone), for bopping (see the lobbies, below).
- **Take down** (in the Build tab) takes a piece away and gives back what it cost.
- Nothing goes on tilled soil, in the animals' pens, by the stall's counter, where farmers arrive on the plaza, or on someone standing there. What's built is saved with the farm, and on a farm with helpers everyone can build (each pays from their own backpack) and the farm's room keeps it, like the soil (`PIECES` in `shared/level.js`, `src/build.js`).

**Helpers: farming together.** Friends can help on your farm, any time, even while you're away. Open the menu (`Esc`), pick **Helpers** and **Invite a helper**: you get a code like `K7P4-QM2X` and a link (good once, for a day). Your friend opens the link (or types the code under **Farms you help on** on the title screen) and is one of your helpers from then on: the farm is on their title screen, to **Visit** whenever they like. The same menu lists your helpers, with **Remove** to take someone off (they're sent home if they're there).

- Everyone tills, plants and harvests as at home, with their own tools and seeds. What anyone harvests goes in the **farm chest**, which stands on the grass by the plaza on a farm with helpers: everyone can see what's in it and put things in from their backpack, and only you take things out (`E` at the chest, or tap it).
- Backpacks and gold stay each farmer's own, and so does the merchant: helpers can trade at your stall.
- The animals are yours: helpers can pet them, but the eggs, milk and wool are for you when you're there.
- The farm keeps its own clock, the same for everyone on it. It doesn't stop for the menu, and `T` fast-forwards it only while you're alone on it.
- Once a farm has helpers it's played through the game server whenever the server is there, also when you're alone, so it's the same farm whoever comes. Without the server you can still play it in your browser, but if your helpers changed it meanwhile, their farm is the one you get back (your backpack stays as you left it).

**Online lobbies** are drop-in places to gather with other farmers, each out on a wild island of its own: bigger and wilder than a farm, with a ragged coast, a mossy forest with giant toadstools to hop across, a shallow pond to wade into (there may be something on the bottom), a flower meadow, rocky terraces climbing to the north, and a ring of standing stones where you arrive. Press `L` at home (or pick one on the title screen): **Quick join** (the fullest public lobby with room, or a new one), **Browse lobbies**, **Open a lobby** (name, size, island seed, public or invite-only), or **Join with a code**.

- There's no farming in a lobby and there are no rounds: wander in, gather, head home whenever you like with what you found.
- Every tree can be chopped down for **wood**: with the axe in hand, press (or hold) `E` next to a tree. Four swings fell it for everyone and give wood to whoever finished it: 2–4 from an ordinary tree, up to 6 from the big old trees in the woods, fewer from a little one; a stump is left behind and the tree grows back 1–2 minutes later. The merchant buys wood.
- Every rock can be broken up for **stone**: with the pickaxe in hand, press (or hold) `E` next to a rock. Three swings break it for everyone and give stone to whoever finished it: one or two from an ordinary rock, one from a pebble, up to 6 from the boulders at the foot of the terraces; a new rock surfaces 1½–2½ minutes later. The merchant buys stone. The farm's own trees and rocks are chopped and mined the same way, and grow back the same way too (even while you're out; with helpers on the farm, the wood or stone goes to whoever got it). A farm from before the pickaxe gets one the first time it loads.
- Berry bushes and mushrooms are picked with `E`; treasures out in the meadow and up on the ledges are collected by walking into them. Whoever gets there first takes it. Each spot grows back 25–60 seconds later with a fresh roll of what's on it.
- Now and then something rare turns up (golden seeds, an old key) with a golden glint over it, and the whole lobby hears about it in chat. Golden seeds grow a golden turnip at home.
- **Bopping**: with a wooden sword or a mallet (made at a workbench) in hand, `E` bops the nearest farmer in reach (or tap them to go and bop them). They stumble back and drop a little of what they gathered on this visit, one thing with the sword, two with the mallet, for anyone to walk into: never a rare find or gold. Nobody gets hurt. A farmer just bopped can't be again for a few seconds, and nobody bops or is bopped in the stone circle where you arrive (`WEAPONS` in `shared/level.js`).
- The player list shows how much everyone has found (and chopped) this visit; the lobby list shows how many rare finds are lying about.
- Every lobby has a code: 6 characters for a public lobby, 10 for an invite-only one (unlisted, so only its link gets you in). While you're there the address bar carries `?lobby=CODE`, so the address is the invite link; **Copy invite** puts it on the clipboard.
- Reloading or losing the connection keeps your place in the lobby (and your finds) for 20 seconds: the page reconnects by itself, or join again from the invite card after a reload.
- An empty lobby goes dormant after 90 seconds: it stops running, but its link keeps working for a week, and it stays on the lobby list as a quiet lobby (nobody there right now), below the busy ones (the 20 left most recently; invite-only ones stay unlisted). Whoever comes back finds the island as it was left, with whatever grew back in the meantime.

### Island seeds
Every lobby's island is grown from a **seed**, a short phrase like `dewy-glade-31`: the seed decides the coastline, where the pond, meadow, woods, terraces and toadstools are, the trails between them, where the berry bushes, mushrooms and treasures are, and the island's season (spring, autumn or cherry blossom). The same seed always grows the same island, so a new lobby on a seed you liked is that island again.

- A new lobby gets a fresh seed. To pick one, type it in **Island seed** when you open a lobby (any words; case and punctuation don't matter). `classic` is the original hand-made island.
- The lobby panel shows the island's seed, and so do the lobby list and invite cards.
- `npm run island -- <seed> [<seed>…]` draws seeds' islands in the terminal (no seed: a random one), to look for good ones without starting the game.
- Under `npm run dev` a lobby the server opens for an unknown code uses the code as its seed.

### How it works
- `shared/room.js` is one lobby: its players, its island and its resource spots. The server runs one per code. What the spots can hold, how fast they regrow and what counts as rare is in `shared/level.js`.
- A lobby is saved as what has happened on its island (what's on each spot, which trees are down, who was there); the island itself grows again from the seed. A saved spot the island no longer has in the same place, or an item that no longer turns up there, starts out fresh, so saves survive changes to `shared/worldgen.js` and `shared/level.js`. The server writes `data/lobbies.json` a couple of seconds after something changes and when it stops (`server/lobby.js`, `server/store.js`).
- `shared/worldgen.js` grows an island from a seed (coastline, pond, terraces, toadstools, woods, meadow, trails, spot positions). It runs on the server and in the page, and only the seed goes over the wire, so everyone in a lobby agrees on the island. Each part of an island has its own random stream, and a layout that fails the checks (every spot on land and reachable, every step within a jump of the last) is grown again from a variant of the seed; `npm test` checks hundreds of seeds.
- The islands are built by `src/world.js` from a map definition in `src/maps.js`: per-tile ground types, platforms, what grows where, and each map's own set pieces. The farm is built once; a lobby's island when you arrive on it (the last one is kept for going back).
- Each client moves its own farmer and reports its position 20 times a second. Who gets a spot is settled by the lobby: it only counts if something is still there and the lobby last saw you next to it.
- Trees are grown on each page from the seed (the same on every page), so the lobby only keeps which ones are down, by their number. The page says which tree it felled and where it stands; the lobby checks you are next to that spot, that the tree is still up and that you aren't felling trees faster than an axe can (`TREE` in `shared/level.js` has the swings, wood and regrow times). Rocks work the same way (`ROCK`): the lobby keeps which ones are broken, by their number.
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
│   ├── workbench.js     # the workbench's window: decorations, sturdy tools, the sword and the mallet
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
│   ├── level.js         # resource spots' loot, rare finds, crop grow times
│   └── worldgen.js      # islands from seeds (and the classic island)
├── server/
│   ├── index.js         # HTTP API + WebSocket + built client, one port
│   ├── lobby.js         # lobbies by code, quick join, dormant lobbies, saving them
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
- Accounts, which can point at the farm ids the server already keeps
- More crops, tools and things to find in the lobbies
- Replace the simple AABB resolver with a physics engine (e.g. `cannon-es` or `rapier3d`) once you need more complex shapes
- Make movement server-authoritative (run the physics on the server too) if cheating ever matters

## Tests
```bash
npm test
```
Checks the islands (the classic one and hundreds of seeds: every spot reachable, the same seed always the same island), the lobby's rules (taking spots, regrowth, rare finds, rejoin, chat limits) and the server end to end over real sockets.

## Build for production
```bash
npm run build
npm start        # serves the built client, the API and the game sockets on PORT (default 3001)
```

`HOST=127.0.0.1` keeps it to the machine itself (behind a proxy), and `TRUST_PROXY=1` takes visitors' addresses from the proxy's `X-Forwarded-For` (for the limits on opening lobbies and farms and guessing PINs).

## Online
The game runs on a DigitalOcean droplet, behind [Caddy](https://caddyserver.com/) for HTTPS. Every push and pull request is tested and built by GitHub Actions (`.github/workflows/deploy.yml`), and a push to `main` is then copied to the droplet and the game restarted: players in a lobby drop for a moment and are reconnected, and the lobbies and farms (in `/var/lib/island`, apart from the game) stay as they were.

A new droplet (Ubuntu 24.04) is set up once with `deploy/setup-droplet.sh`; the comment at its top says how and what it puts where. The workflow needs the repository variable `DEPLOY_HOST` (the droplet's domain) and the secrets `DEPLOY_SSH_KEY` (the deploy key) and `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <DEPLOY_HOST>`). On the droplet, `journalctl -u island` shows the server's log.
