# Game Concepts & Ideas

> The early brainstorm, from when this was a platformer. What is planned now is
> in [BACKLOG.md](BACKLOG.md); the ideas here that are still open are on it.

Brainstorm built on what the prototype already has: a jumping capsule, AABB
platforms, a fixed diorama-style camera, collectibles (coins / gems / keys), an
inventory, and a hoe that tills soil — but only on bare ground.

That last rule is the most interesting thing in the codebase: **the ground is
where you farm, the platforms are where you explore.** Every idea below tries to
make those two halves feed each other instead of being separate toys.

---

## Pitch candidates

### 1. Beanstalk (recommended)
*You grow the level you climb.*

The ground is your farm. Seeds you plant grow into plants that **are
platforms**: vines, mushrooms, giant leaves. Higher platforms hold rarer seeds,
which grow taller or stranger plants, which reach even higher places.

- Core loop: **find seed → climb down → till & plant → wait / tend → climb what grew → find better seed**
- The fixed camera works as a "diorama": each island is one screen you shape over time
- Win state: grow a path to the island in the clouds

### 2. Night Harvest
*Farm by day, platform by night.*

A day/night cycle. Daytime is calm farming on the ground. At night, glowing
platforms phase in for a limited time and gems appear on them — grab what you
can before dawn. Gems buy upgrades that make the next night's run easier.

- Strong rhythm and tension; easy to tune difficulty per night
- Risk: two modes that don't touch each other much unless crops affect the night run

### 3. Key Rooms
*One-screen puzzle dioramas.*

Each level is a single fixed-camera room. Keys open gates and chests; coins are
currency; gems are the 100%-completion collectible. Farming is the puzzle tool:
plant a bounce-mushroom here to reach that ledge, a pumpkin there to hold down a
switch.

- Very scoped and shippable; leans into the fixed camera
- Less long-term progression than Beanstalk

---

## Core concepts

### Plants are platforms
The heart of Beanstalk, but useful for any pitch. A grown plant is just another
entry in `platforms` (via `addBox`), so it plugs straight into the existing
collision code.

| Crop | Grows into | Traversal effect |
|---|---|---|
| Vine bean | Tall stalk with ledges | Climb in steps, the "staircase" crop |
| Bounce shroom | Squishy cap | Launches you ~2x jump height |
| Lily leaf | Wide flat leaf | Big safe landing pad, wilts after a few landings |
| Stone pumpkin | Heavy block | Pushable; holds down switches |
| Cloud cotton | Puffy block | Only solid from above (one-way platform) |

Growth stages (seed → sprout → grown) give visual feedback and a reason to come
back. Grown plants could also wither if not watered, so the level slowly
changes if neglected.

### Three item tiers, three jobs
The existing coins / gems / keys already map to a clean economy:

- **Coins** — common, spent on seeds and water
- **Gems** — rare, spent on permanent upgrades (tools, abilities)
- **Keys** — unique, open gates, chests and new zones

### Tools as progression
The hoe is the first tool. More tools = more verbs, unlocked over time:

- **Hoe** — till soil (exists)
- **Watering can** — speeds growth; upgrade to water a 3×3 area
- **Seed pouch** — select which seed to plant (number keys / scroll)
- **Glider leaf** — slow fall, unlocked from a high platform
- **Boots** — double jump, bought with gems

### Vertical zones
Height is progress. Each band has its own look, seeds and hazards:

1. **Meadow** (ground) — the farm, safe, tillable
2. **Canopy** — branches and leaves, first rare seeds, wind gusts
3. **Cliffs** — narrow ledges, crows that steal items
4. **Clouds** — one-way platforms, the final garden

The camera stays fixed per zone and eases to a new anchor when you cross a zone
boundary, keeping the diorama feel without losing the player off-screen.

### Things that push back
Light pressure so the farm isn't static:

- **Weeds** spread onto untilled ground and block planting until hoed
- **Crows** land on crops and eat them unless you shoo them (jump near them)
- **Falling** drops some carried coins where you land, so you can recover them

---

## Game feel quick wins
Cheap changes to the current controller that make jumping feel much better:

- **Coyote time** — allow jumping ~0.1 s after walking off a ledge
- **Jump buffering** — a Space press shortly before landing still jumps
- **Variable jump height** — releasing Space early cuts upward velocity
- **Air control** — slightly less steering in the air than on the ground
- **Squash & stretch** — scale the capsule on jump and landing
- **Drop shadow blob** under the player so landings are readable from the fixed camera
- **Pickup pop** — scale-up + fade on collect, plus a sound

---

## Suggested first slice
Smallest build that proves the Beanstalk loop is fun:

1. Seed item type + pickup on a high platform
2. Press E on tilled soil with a seed → plant it
3. Plant grows over ~20 s through 3 stages, then becomes a climbable platform
4. A coin or gem placed only reachable by the grown plant

If climbing your own crop to grab that gem feels good, the concept works.

---

## Open questions
- Real-time growth, or growth tied to a day counter / sleeping?
- Does the world reset per level, or is it one persistent island?
- Fixed camera only, or allow a free-orbit camera in the farm hub?
- How punishing should falling be?
