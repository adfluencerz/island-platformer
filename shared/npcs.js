// The neighbours: the folk who live round the farm's valley, each in a home
// of their own (shared/farmland.js NPC_HOMES and NPC_ROOMS, drawn by
// src/npchomes.js), each with a shop (src/shop.js) that opens once you have
// done them a good turn, and a string of things they ask of you, one at a
// time (missions). Plain data, and the rules for it, so a test can check
// them; the page has the people (src/npcs.js) and the talking (src/dialog.js).
//
// A mission's `needs`, each one of:
//   { item, count }          that many of item, handed over from the backpack
//   { items: [...], count }  that many of any of them (eggs, large or not)
//   { deed, count }          done that many times since the mission was given:
//                            'pet' (an animal, the first time each day),
//                            'fish' (a fish landed: not junk)
//   { built, count }         that many of a piece built on the farm, to see
// `gives`: { gold, items: [[item, count]], opens: a shelf or 'shop' (the
// shop itself), mends: something on the farm put right ('dock') }
// `intro` is what they say when they ask, `waiting` while they wait, `thanks`
// when it is done.
//
// How much a neighbour likes you (hearts, FRIENDSHIP in shared/balance.js)
// grows with a chat once a day and every mission done, and takes a little
// off what their shop asks.

export const NPC_IDS = ['rosa', 'basil', 'finn', 'mabel'];

export const NPCS = {
  rosa: {
    name: 'Rosa',
    title: 'Meadow Ranch',
    trade: 'Animals',
    where: 'west, over the meadow',
    shirt: 0xc0392b,
    look: { hat: 'straw', hatColor: 0x7a2a1a, hair: 'ponytail', hairColor: 0x7a3f1c, bottomsColor: 0x6b4a2b },
    portrait: { hat: '#e2b860', band: '#7a2a1a', hair: '#7a3f1c', shirt: '#c0392b' },
    // [hour she gets up, opens the shop, goes out in the yard, goes to bed]
    hours: [5, 8, 17, 21],
    shop: {
      opensWith: 'rosa_pet',
      shelves: [
        { title: 'Animals', items: ['hen', 'sheep', 'cow'] },
      ],
    },
    missions: [
      {
        id: 'rosa_pet',
        title: 'A kind hand',
        ask: 'Pet three of your animals',
        needs: [{ deed: 'pet', count: 3 }],
        gives: { gold: 50, opens: 'shop' },
        intro: 'Before any of my animals go to a new home, I like to see how a farmer treats them. Go and give three of your own a good pet, and come back and tell me.',
        waiting: 'Three of your animals, a good pet each. Hens, cows, sheep: they all like a scratch behind the ears.',
        thanks: 'I can see it on you: happy animals! My shop\'s open to you any time, neighbour.',
      },
      {
        id: 'rosa_breakfast',
        title: 'Breakfast at the ranch',
        ask: 'Bring Rosa 4 eggs and a milk',
        needs: [{ items: ['egg', 'large_egg'], count: 4 }, { item: 'milk', count: 1 }],
        gives: { gold: 250, items: [['hen', 1]] },
        intro: 'The farmhands are coming for breakfast and my hens have gone broody on me, the lot of them. Could you bring me four eggs and a bottle of milk?',
        waiting: 'Four eggs and a milk, love. Your hens lay one a day each, and your cow has milk every morning.',
        thanks: 'You\'re a lifesaver! Here: take Clementine\'s sister home with you. She lays like clockwork.',
      },
      {
        id: 'rosa_wool',
        title: 'Winter woollies',
        ask: 'Bring Rosa 2 wool',
        needs: [{ item: 'wool', count: 2 }],
        gives: { gold: 300, items: [['mayo_machine', 1]] },
        intro: 'The nights are drawing in, and I\'ve promised every animal on the ranch a scarf. Don\'t laugh! Two lots of wool would do it.',
        waiting: 'Two lots of wool for the scarves. A sheep\'s fleece grows back two days after she\'s sheared.',
        thanks: 'Lovely and soft! Here, I\'ve a mayonnaise machine I never use. An egg in, a jar of mayonnaise out.',
      },
      {
        id: 'rosa_fair',
        title: 'Cheese for the fair',
        ask: 'Bring Rosa 2 cheese',
        needs: [{ item: 'cheese', count: 2 }],
        gives: { gold: 800 },
        intro: 'The valley fair\'s coming up, and I\'ve said I\'ll bring a cheese board. Two cheeses from your own press would win it, I just know it.',
        waiting: 'Two cheeses. A cheese press at your workbench turns milk into cheese.',
        thanks: 'First prize, I can feel it! You\'ve been a true friend to the ranch. This is for you.',
      },
    ],
    lines: {
      intro: 'Well hello there! You must be the new farmer up the lane. I\'m Rosa, and this is Meadow Ranch. Hens, sheep, cows: if it moos or clucks, I\'ve raised it.',
      morning: ['Morning! The girls have been up since dawn, and so have I.', 'Up early? Good. Animals don\'t wait for anyone.'],
      day: ['Hello again, neighbour!', 'Afternoon! Mind the hens, they\'re nosy.'],
      evening: ['Evening! Just settling the herd for the night.', 'Lovely sunset over the meadow, isn\'t it?'],
      chat: [
        'Clementine laid a double yolker this morning. Proudest hen in the valley.',
        'A happy animal gives more. Pet them every day, and they\'ll love you for it.',
        'Basil gives me his old sunflower heads for the hens. Lovely man. Forgets his own hat, mind.',
        'Finn swears he once caught a fish bigger than my cow. I\'ve met my cow. I don\'t believe him.',
        'Mabel\'s honey cake is the only thing that gets me out of bed on a cold morning.',
        'The meadow flowers come up thickest in spring. The bees go mad for them.',
        'If your pens get crowded, the workbench can make them bigger. Animals need room to be happy!',
        'Sheep look fluffy and daft, but they\'re clever. Daisy can open the gate latch.',
      ],
      asleep: 'Rosa is fast asleep. Something about counting sheep...',
      locked: 'My animals only go to farmers I trust. Help me out first, love.',
      done: 'You\'ve been a true friend to the ranch. Come by any time!',
      shop: ['Have a look at my beauties!', 'Every one of them hand raised.'],
      bought: ['Look after her, now!', 'She\'ll be ever so happy on your farm.', 'Off to her new home!'],
    },
  },

  basil: {
    name: 'Basil',
    title: 'Basil\'s Seeds',
    trade: 'Seeds',
    where: 'east, past the fields',
    shirt: 0xe8dcc0,
    look: { hat: 'flatcap', hatColor: 0x6b5a3a, hairColor: 0xe8e4dc, whiskers: 'beard', bottomsColor: 0x5a4632, apron: 'apron', apronColor: 0x4f7a3a },
    portrait: { hat: '#6b5a3a', beard: '#e8e4dc', shirt: '#4f7a3a' },
    hours: [6, 9, 17, 21],
    shop: {
      opensWith: 'basil_turnips',
      shelves: [
        { title: 'Seeds', items: ['sunflower_seeds', 'tomato_seeds', 'pumpkin_seeds', 'lily_seeds', 'shroom_spores'] },
        { title: 'Rare seeds', items: ['bean_seeds', 'berry_cutting', 'cotton_seeds'], after: 'basil_soup' },
        { title: 'Treasures', items: ['golden_seeds'], after: 'basil_crows' },
      ],
    },
    missions: [
      {
        id: 'basil_turnips',
        title: 'A green thumb',
        ask: 'Grow Basil 5 turnips',
        needs: [{ item: 'turnip', count: 5 }],
        gives: { items: [['sunflower_seeds', 5]], opens: 'shop' },
        intro: 'Seeds are precious things, young one. Grow me five turnips, and I\'ll know mine are going to a good home.',
        waiting: 'Five turnips. Till the ground, plant the seeds, and a little water makes them grow twice as fast.',
        thanks: 'Fine turnips! Firm and round. My seeds are yours to buy now, and have a few sunflower seeds on me.',
      },
      {
        id: 'basil_soup',
        title: 'Sunshine soup',
        ask: 'Bring Basil 3 sunflowers and 3 carrots',
        needs: [{ item: 'sunflower', count: 3 }, { item: 'carrot', count: 3 }],
        gives: { gold: 200, opens: 'Rare seeds' },
        intro: 'My old sunflowers have all gone to seed. Bring me three of yours, would you, and three carrots for my soup?',
        waiting: 'Three sunflowers and three carrots. They\'re slow to grow, but worth it.',
        thanks: 'Sunshine in a bowl! Here: I\'ll open my cupboard of rare seeds to you. Beans that climb to the clouds, and more.',
      },
      {
        id: 'basil_bluebells',
        title: 'Bluebells for Marigold',
        ask: 'Pick Basil 4 bluebells',
        needs: [{ item: 'bluebell', count: 4 }],
        gives: { gold: 250, items: [['golden_seeds', 2]] },
        intro: 'My Marigold loved the bluebells up in the glade, in the wood to the north-east. Would you pick me four? I\'d like to put them by her picture.',
        waiting: 'Four bluebells, from the glade in the north-east wood. They turn up in the grass there, now and then.',
        thanks: 'Just as blue as I remember. Thank you, truly. Here: two golden seeds. Marigold always said they were for special people.',
      },
      {
        id: 'basil_crows',
        title: 'Keep the crows off',
        ask: 'Put up a scarecrow, and bring Basil 2 pumpkins',
        needs: [{ built: 'scarecrow', count: 1 }, { item: 'pumpkin', count: 2 }],
        gives: { gold: 600, opens: 'Treasures' },
        intro: 'The crows have been at my pumpkins again. Put a scarecrow up on your farm, so they learn their lesson, and bring me two pumpkins to make up for theirs?',
        waiting: 'A scarecrow on your farm (from the Build tab), and two pumpkins.',
        thanks: 'Not a crow in sight! You\'ve a gardener\'s heart. I\'ll even sell you golden seeds now, the few I have.',
      },
    ],
    lines: {
      intro: 'Oh! A visitor. Hello, hello. I\'m Basil. I grow seeds. Well, the plants grow seeds; I just help them along. Have a look around, but mind the seedlings.',
      morning: ['Good morning. The dew\'s still on the leaves. Best time of day.', 'Morning! I\'ve been talking to the tomatoes. They say hello.'],
      day: ['Ah, hello again.', 'Warm one today. The sunflowers are loving it.'],
      evening: ['Evening, young one. Time to water the beds before dark.', 'The moths come out to the flowers about now.'],
      chat: [
        'Water your crops and they grow twice as fast. Even an old man can\'t wait forever.',
        'Marigold planted that sunflower field forty years ago. Every summer it comes back brighter.',
        'Pumpkins like room to sprawl. Give them space and they\'ll give you pumpkins.',
        'Rosa brings me manure for the beds. Best present a gardener can get, believe it or not.',
        'The bluebells up in the glade are older than I am. Pick, never dig.',
        'A vine bean grows so tall you can climb it. I tried, once. Once.',
        'Mabel makes a pumpkin soup that would bring a scarecrow to tears.',
        'Golden seeds... I\'ve only seen a handful in my life. They grow golden turnips, you know.',
      ],
      asleep: 'Basil is asleep, his cap over his eyes. Shh.',
      locked: 'Seeds are precious things. Show me you can grow something first.',
      done: 'You\'ve a gardener\'s heart. Marigold would have liked you.',
      shop: ['Every packet picked by hand.', 'Plant them somewhere sunny!'],
      bought: ['They\'ll do well for you.', 'Happy growing!', 'Talk to them now and then. It helps.'],
    },
  },

  finn: {
    name: 'Finn',
    title: 'Finn\'s Tackle',
    trade: 'Fishing gear',
    where: 'south, on the dunes',
    shirt: 0x2f4f7a,
    look: { hat: 'souwester', hatColor: 0xf2c230, hairColor: 0x9a9a9a, whiskers: 'beard', top: 'sweater', bottomsColor: 0x3a3a3a, shoes: 'wellies', shoesColor: 0x2a2420 },
    portrait: { hat: '#f2c230', beard: '#9a9a9a', shirt: '#2f4f7a' },
    hours: [4, 7, 16, 20],
    shop: {
      opensWith: 'finn_dock',
      shelves: [
        { title: 'Tackle', items: ['bait', 'lure', 'fishing_rod'] },
        { title: 'Better rods', items: ['sturdy_rod'], after: 'finn_catch' },
      ],
    },
    missions: [
      {
        id: 'finn_dock',
        title: 'Mend the dock',
        ask: 'Bring Finn 10 wood for his dock',
        needs: [{ item: 'wood', count: 10 }],
        gives: { items: [['bait', 10]], opens: 'shop', mends: 'dock' },
        intro: 'The storm took half me dock, and I can\'t sell tackle with nowhere to fish from. Bring me ten wood and I\'ll have her mended in no time.',
        waiting: 'Ten wood for the dock. Chop a tree with the axe, if ye\'ve none.',
        thanks: 'There she is, good as new! Walk out to the end and cast a line. Shop\'s open, and here\'s some bait to start ye off.',
      },
      {
        id: 'finn_catch',
        title: 'First catch',
        ask: 'Land three fish',
        needs: [{ deed: 'fish', count: 3 }],
        gives: { gold: 150, items: [['lure', 2]], opens: 'Better rods' },
        intro: 'Let\'s see ye land some fish, then. Any three, I\'m not fussy. Off the dock, in the lake, in a pond, wherever.',
        waiting: 'Three fish, any kind. Face the water with a rod in hand, cast, and strike when the bobber dips!',
        thanks: 'Ye\'ve a feel for it! Here, a couple of lures, and I\'ll sell ye a sturdy rod now. Ye\'ve earned it.',
      },
      {
        id: 'finn_bass',
        title: 'The big one',
        ask: 'Bring Finn a sea bass and 2 mackerel',
        needs: [{ item: 'sea_bass', count: 1 }, { item: 'mackerel', count: 2 }],
        gives: { gold: 400, items: [['lure', 3]] },
        intro: 'There\'s a sea bass off the end of me dock as big as a dog. Bring me one, and two mackerel for me supper.',
        waiting: 'A sea bass and two mackerel. Both bite in the sea, off the dock or the shore.',
        thanks: 'Now THAT\'S a fish! Ye\'re a proper fisher now, matey.',
      },
      {
        id: 'finn_shells',
        title: 'Shells for the missus',
        ask: 'Bring Finn 5 seashells',
        needs: [{ item: 'seashell', count: 5 }],
        gives: { gold: 500, items: [['fish_stew', 2]] },
        intro: 'Me wife collects shells, and her birthday\'s coming. Five seashells off the dunes and she\'ll love me forever. Well, longer.',
        waiting: 'Five seashells. They wash up on the dunes, along the south shore.',
        thanks: 'She\'ll be over the moon! Here, she made ye some fish stew. Best in the valley, after Mabel\'s.',
      },
    ],
    lines: {
      intro: 'Ahoy! Name\'s Finn. Fished these waters man and boy, and me father before me. If it swims, I\'ve caught it. Or it\'s caught me.',
      morning: ['Mornin\'! Fish bite best at dawn, when the sea\'s still sleepy.', 'Up with the tide, are ye?'],
      day: ['Ahoy again!', 'Fair wind today. Good for the boats, bad for the bobbers.'],
      evening: ['Evenin\'. Moonfish come up after dark, if ye\'ve the patience.', 'Red sky at night, fisher\'s delight.'],
      chat: [
        'When the bobber dips, strike quick! The rare ones don\'t hang about.',
        'A better rod gets ye bites sooner, and rarer fish. Can\'t catch a pufferfish with a twig.',
        'I once wrestled a swordfish for three days. Lost me hat. Kept me dignity. Mostly.',
        'The lake to the east has perch and catfish. Freshwater types. Bit soft, if ye ask me.',
        'Rosa\'s always on at me to eat more vegetables. I eat seaweed. That\'s a vegetable.',
        'Bait in the bag means a fish on the line sooner. Simple as that.',
        'Mabel\'s fish stew. Now there\'s a reason to come ashore.',
        'Old boots, driftwood... the sea gives ye what she likes. Even a chest of treasure, now and then.',
      ],
      asleep: 'Finn is asleep in his hammock, snoring like a foghorn.',
      locked: 'Can\'t sell tackle with me dock in pieces. Lend a hand first, eh?',
      done: 'Ye\'ve the sea in yer blood now, matey. Fair winds!',
      shop: ['Finest tackle on the coast.', 'What\'ll it be, matey?'],
      bought: ['Tight lines!', 'May they bite like sharks.', 'Don\'t lose it to a pike, now.'],
    },
  },

  mabel: {
    name: 'Mabel',
    title: 'Mabel\'s Bakery',
    trade: 'Recipes',
    where: 'north-east, at the forest\'s edge',
    shirt: 0xe88aa8,
    look: { hat: 'bandana', hatColor: 0xf4f0e8, hair: 'bun', hairColor: 0xb8662a, bottomsColor: 0x8a5a7a, apron: 'apron', apronColor: 0xfffaf0 },
    portrait: { scarf: '#f4f0e8', hair: '#b8662a', shirt: '#e88aa8' },
    hours: [5, 7, 17, 22],
    shop: {
      opensWith: 'mabel_mushrooms',
      shelves: [
        { title: 'Recipes', items: ['recipe_pumpkin_soup', 'recipe_sushi_rolls', 'recipe_honey_carrots', 'recipe_mushroom_pie', 'recipe_farm_feast'] },
      ],
    },
    missions: [
      {
        id: 'mabel_mushrooms',
        title: 'Mushroom hunt',
        ask: 'Find Mabel 3 mushrooms',
        needs: [{ item: 'mushroom', count: 3 }],
        gives: { gold: 100, opens: 'shop' },
        intro: 'I\'m making my famous mushroom tarts, and I\'m all out! The woods north of your farm are full of them. Bring me three, dear?',
        waiting: 'Three mushrooms, love. They turn up on the moss in the woods to the north.',
        thanks: 'Perfect little things! Now, since you asked so nicely... my recipes are yours to buy. Family secrets, mind!',
      },
      {
        id: 'mabel_honey',
        title: 'Sweet as honey',
        ask: 'Bring Mabel 2 jars of honey',
        needs: [{ item: 'honey', count: 2 }],
        gives: { gold: 300, items: [['pancakes', 2]] },
        intro: 'Honey cake needs honey, and I\'m clean out. Two jars, dear? A beehive on your farm fills one a day.',
        waiting: 'Two jars of honey. Build a beehive from the Build tab: it fills a jar once a day.',
        thanks: 'Golden as the sun! Here, have some pancakes, fresh off the griddle.',
      },
      {
        id: 'mabel_omelette',
        title: 'A taste of your cooking',
        ask: 'Cook Mabel a cheese omelette',
        needs: [{ item: 'cheese_omelette', count: 1 }],
        gives: { gold: 500, items: [['recipe_card', 1]] },
        intro: 'I\'ve fed the whole valley for thirty years, and nobody ever cooks for me! Make me a cheese omelette in your own kitchen?',
        waiting: 'A cheese omelette, dear. It\'s in your recipe book: cook it in the kitchen in your house.',
        thanks: 'Oh, it\'s lovely! Better than mine, and don\'t you dare tell anyone I said so. Here, an old recipe card of my gran\'s.',
      },
    ],
    lines: {
      intro: 'Oh, hello dear! Come in, come in, mind the flour. I\'m Mabel. I bake, I cook, and I know everybody\'s business. You must be the new farmer! Everyone\'s talking about you.',
      morning: ['Morning, dear! The first loaves are just out of the oven. Smell that!', 'Up early! You and me both. Dough doesn\'t knead itself.'],
      day: ['Hello again, love!', 'Afternoon, dear. Kettle\'s on, if you fancy a cuppa.'],
      evening: ['Evening, love! Just tidying up the kitchen.', 'Long day? Nothing a warm pie won\'t fix.'],
      chat: [
        'A good meal gives you a good boost. Eat a hearty dish and you\'ll swing that axe like a lumberjack!',
        'The secret to a good pie is cold butter and a warm heart. Mostly the butter.',
        'Don\'t tell Finn, but I put extra pepper in his stew. He thinks it\'s the sea air.',
        'Basil brought me courgettes the size of a cow. I\'m still finding ways to use them.',
        'Rosa\'s eggs make the fluffiest pancakes in the valley. It\'s the happy hens.',
        'There are old recipe cards out on the wild islands, you know. Some of the best recipes ever written!',
        'The farm feast is for sharing. Eat it with friends on your farm and everyone gets a lift.',
        'Mushrooms grow thick in the woods north of the farm. Just mind which ones you pick!',
      ],
      asleep: 'Mabel is asleep. You can hear her mumbling something about soufflés.',
      locked: 'My recipes are family secrets, dear! Help me out, and maybe I\'ll share.',
      done: 'You\'re like family now, dear. Take a biscuit on your way out!',
      shop: ['Every one of them tried and tested.', 'Cook with love, dear!'],
      bought: ['You\'ll be the talk of the valley!', 'Don\'t burn it, now!', 'Lovely choice, dear.'],
    },
  },
};

// The merchant at the stall sells only the basics now: the neighbours keep
// the rest. (MERCHANT_STOCK in shared/balance.js)

// (each mission knows whose it is, and its place in their list)
for (const npc of NPC_IDS) NPCS[npc].missions.forEach((m, i) => Object.assign(m, { npc, i }));
// Every mission, by id
export const MISSIONS = Object.fromEntries(NPC_IDS.flatMap((npc) => NPCS[npc].missions.map((m) => [m.id, m])));

// ---------- Where you stand with a neighbour ----------
// state, per neighbour: { met, done: [mission ids], since: { mission id:
// { deed: count when it was asked } }, heard: [mission ids they've asked],
// points (friendship), chatDay (the game day you last chatted) }. deeds:
// how many times each deed has been done, all told.

export const freshNpcState = () => ({ met: false, done: [], heard: [], since: {}, points: 0, chatDay: -1 });

// Their mission now (the first not done), or null: all done
export function currentMission(npc, state) {
  return NPCS[npc].missions.find((m) => !state.done.includes(m.id)) ?? null;
}

// Is shelf (a shelf's title, or 'shop') open to you at their shop?
export function isOpen(npc, state, shelf = 'shop') {
  const { shop } = NPCS[npc];
  if (!state.done.includes(shop.opensWith)) return false;
  if (shelf === 'shop') return true;
  const after = shop.shelves.find((s) => s.title === shelf)?.after;
  return !after || state.done.includes(after);
}

// How far each of a mission's needs has come: [{ need, have, count, ok }]
// have(item): how many of item the backpack holds; deeds: { deed: count };
// built(piece): how many are built on the farm
export function progress(mission, state, { have, deeds, built }) {
  return mission.needs.map((need) => {
    let n = 0;
    if (need.item) n = have(need.item);
    else if (need.items) n = need.items.reduce((sum, item) => sum + have(item), 0);
    else if (need.deed) n = (deeds[need.deed] ?? 0) - (state.since[mission.id]?.[need.deed] ?? 0);
    else if (need.built) n = built(need.built);
    return { need, have: Math.max(0, n), count: need.count, ok: n >= need.count };
  });
}

// The hearts for so many points (FRIENDSHIP: points a heart, the most hearts)
export const heartsFor = (points, { perHeart, hearts }) => Math.min(hearts, Math.floor(points / perHeart));
