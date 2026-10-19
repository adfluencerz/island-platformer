# Three.js Platformer — Starter

A minimal 3D platformer scaffold built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).

## What's included
- A player capsule with gravity, jumping, and WASD/arrow-key movement
- Simple AABB collision so you can land on and jump between platforms
- A staggered set of grass-topped platforms to test jumping
- A tiled island (grass, dirt paths, stone plaza, sand shore) surrounded by water, with trees, bushes, rocks, and wind-swayed grass and flowers; trees fade out when they block the view of the player
- A camera that smoothly follows the player from an angled overhead view
- A stylized farmer character with walk, jump, landing and hoe-swing animations
- Shadows and basic lighting (hemisphere + directional "sun")
- A saved home farm, and drop-in online lobbies (up to 8 farmers) where resources regrow and rare finds turn up (see below)

## Setup

```bash
npm install
npm run dev
```

`npm run dev` starts two things side by side: the game server (`server/index.js`, port 3001, restarted when `server/` or `shared/` change) and Vite, which proxies `/api` and `/ws` to it. Open the URL Vite prints (usually `http://localhost:5173`). Vite also listens on your network address, so friends on the same network can join with that URL.

If port 5173 is already taken (often an old `vite` still running in another terminal), `npm run dev` stops with "Port 5173 is already in use" instead of moving to another port: stop the other one and run it again. Under `npm run dev` the server also opens a lobby for any code you join that does not exist yet, so a `?lobby=CODE` link keeps working after the server restarts.

Without the game server you can still play on your farm (`npm run dev:client` runs only Vite).

## Controls
- `W`/`A`/`S`/`D` or arrow keys — move
- `Space` — jump (only works while grounded)
- `E` — at home: till / plant / harvest; in a lobby: gather (berries, mushrooms)
- `I` — backpack
- `L` — visit a lobby (from home)
- `Enter` — chat (in a lobby)
- `Esc` — menu (copy the invite link, head home, controls)
- `T` (hold) — fast-forward time (30×, at home only: in a lobby the time of day is shared)

## Your farm and online lobbies
**Your farm** is yours alone and lives in your browser: the backpack, gold, tilled soil, crops and the time of day are saved as you play. While you're away (in a lobby, or with the page closed) the clock keeps turning and your crops keep growing.

**Online lobbies** are drop-in places to gather with other farmers, each out on a wild island of its own: bigger and wilder than a farm, with a ragged coast, a mossy forest with giant toadstools to hop across, a shallow pond to wade into (there may be something on the bottom), a flower meadow, rocky terraces climbing to the north, and a ring of standing stones where you arrive. Press `L` at home (or pick one on the title screen): **Quick join** (the fullest public lobby with room, or a new one), **Browse lobbies**, **Open a lobby** (name, size, island seed, public or invite-only), or **Join with a code**.

- There's no farming in a lobby and there are no rounds: wander in, gather, head home whenever you like with what you found.
- Berry bushes and mushrooms are picked with `E`; treasures out in the meadow and up on the ledges are collected by walking into them. Whoever gets there first takes it. Each spot grows back 25–60 seconds later with a fresh roll of what's on it.
- Now and then something rare turns up (golden seeds, an old key) with a golden glint over it, and the whole lobby hears about it in chat. Golden seeds grow a golden turnip at home.
- The player list shows how much everyone has found this visit; the lobby list shows how many rare finds are lying about.
- Every lobby has a code: 6 characters for a public lobby, 10 for an invite-only one (unlisted, so only its link gets you in). While you're there the address bar carries `?lobby=CODE`, so the address is the invite link; **Copy invite** puts it on the clipboard.
- Reloading or losing the connection keeps your place in the lobby (and your finds) for 20 seconds: the page reconnects by itself, or join again from the invite card after a reload.
- An empty lobby closes after 90 seconds.

### Island seeds
Every lobby's island is grown from a **seed**, a short phrase like `dewy-glade-31`: the seed decides the coastline, where the pond, meadow, woods, terraces and toadstools are, the trails between them, where the berry bushes, mushrooms and treasures are, and the island's season (spring, autumn or cherry blossom). The same seed always grows the same island, so a new lobby on a seed you liked is that island again.

- A new lobby gets a fresh seed. To pick one, type it in **Island seed** when you open a lobby (any words; case and punctuation don't matter). `classic` is the original hand-made island.
- The lobby panel shows the island's seed, and so do the lobby list and invite cards.
- `npm run island -- <seed> [<seed>…]` draws seeds' islands in the terminal (no seed: a random one), to look for good ones without starting the game.
- Under `npm run dev` a lobby the server opens for an unknown code uses the code as its seed, so the island stays the same across server restarts.

### How it works
- `shared/room.js` is one lobby: its players, its island and its resource spots. The server runs one per code. What the spots can hold, how fast they regrow and what counts as rare is in `shared/level.js`.
- `shared/worldgen.js` grows an island from a seed (coastline, pond, terraces, toadstools, woods, meadow, trails, spot positions). It runs on the server and in the page, and only the seed goes over the wire, so everyone in a lobby agrees on the island. Each part of an island has its own random stream, and a layout that fails the checks (every spot on land and reachable, every step within a jump of the last) is grown again from a variant of the seed; `npm test` checks hundreds of seeds.
- The islands are built by `src/world.js` from a map definition in `src/maps.js`: per-tile ground types, platforms, what grows where, and each map's own set pieces. The farm is built once; a lobby's island when you arrive on it (the last one is kept for going back).
- Each client moves its own farmer and reports its position 20 times a second. Who gets a spot is settled by the lobby: it only counts if something is still there and the lobby last saw you next to it.
- Other players are drawn from the lobby's 20 Hz snapshots, 100 ms in the past and interpolated between them, so they move smoothly through network jitter (`src/remotes.js`).
- Messages are small JSON objects; `shared/protocol.js` lists them all.
- The home farm needs no server: `npm run dev:client` (Vite alone) is enough to farm.

The lobby system follows [Survive the Night](https://github.com/webdevcody/survive-the-night-fps)'s (codes, quick join, invite links, held seats on rejoin, idle shutdown), without the survival.

## Day/night cycle
A full day lasts 6 real minutes (`DAY_LENGTH_SECONDS` in `src/daynight.js`). The clock in the top-right shows the day, the time in 10-minute steps, and the sun/moon on a dial. At home, time pauses while the backpack or the menu is open; in a lobby everyone shares the lobby's clock. To start at a given hour while testing, add `?hour=21` to the URL.

## Project structure
```
threejs-platformer/
├── index.html          # entry point, mounts the canvas
├── src/
│   ├── main.js          # scene, player physics, farming, lobby spots, saving, travel, game loop
│   ├── world.js         # builds an island from a map: tiles, colliders, foliage, trees, rocks
│   ├── maps.js          # the maps: your farm's island, and a lobby's wild island from its seed
│   ├── character.js     # the farmer model and its animations (you and everyone else)
│   ├── remotes.js       # other players: interpolation, name tags
│   ├── net/
│   │   ├── connection.js  # WebSocket to a lobby
│   │   └── lobby.js       # the lobbies' HTTP API, invite links
│   └── ui/              # title screen (splash.js), in-game HUD (hud.js), styles
├── shared/              # runs on both the server and the client
│   ├── room.js          # one lobby: players, resource spots
│   ├── protocol.js      # message types
│   ├── constants.js     # tick rate, limits
│   ├── level.js         # resource spots' loot, rare finds, crop grow times
│   └── worldgen.js      # islands from seeds (and the classic island)
├── server/
│   ├── index.js         # HTTP API + WebSocket + built client, one port
│   └── lobby.js         # lobbies by code, quick join, idle cleanup
├── scripts/
│   ├── dev.js           # npm run dev: game server + Vite
│   ├── island.js        # npm run island: draw a seed's island in the terminal
│   └── test-multiplayer.js  # npm test
├── package.json
```

## Where to go next
- Swap the capsule/boxes for real models (glTF via `GLTFLoader`)
- Add collectibles, moving platforms, or hazards
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
