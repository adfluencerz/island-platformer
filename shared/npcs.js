// The neighbours: the folk who live round the farm's valley, each in a home
// of their own (shared/farmland.js NPC_HOMES and NPC_ROOMS, drawn by
// src/npchomes.js), each with a shop (src/shop.js) that opens once you have
// done them a good turn, and a string of things they ask of you, one at a
// time (missions). Plain data, and the rules for it, so a test can check
// them; the page has the people (src/npcs.js) and the talking (src/dialog.js).
//
// A mission's `needs`, each one of:
//   { item, count }          that many of item, handed over from the backpack
//   { items: [...], count, label }
//                            that many of any of them (eggs, large or not),
//                            called `label` in the window
//   { deed, count }          done that many times since the mission was given:
//                            'pet' (an animal, the first time each day),
//                            'fish' (a fish landed: not junk),
//                            'harvest' (a crop picked), 'chop' (a tree felled),
//                            'mine' (a rock broken), 'cook' (a meal made, in the
//                            kitchen or on a campfire: a whole batch counts once)
//   { deed: 'tell', who, count: 1 }
//                            the mission's `message` told to who (another
//                            neighbour) when you talk to them
//   { built, count }         that many of a piece built on the farm, to see
// `gives`: { gold, items: [[item, count]], opens: a shelf or 'shop' (the
// shop itself), mends: something on the farm put right ('dock'), choose: [{
// label, gold, items }] one more reward to take your pick of }
// `intro` is what they say when they ask, `waiting` while they wait, `thanks`
// when it is done. A `message` ({ to, say, reply }) is what you tell `to`, and
// what they answer.
//
// How much a neighbour likes you (hearts, FRIENDSHIP in shared/balance.js)
// grows with a chat once a day, every mission done and what you hear from them
// (shared/talk.js), and takes a little off what their shop asks.

export const NPC_IDS = ['rosa', 'basil', 'finn', 'mabel'];

export const NPCS = {
  rosa: {
    name: 'Rosa',
    title: 'Meadow Ranch',
    trade: 'Animals',
    where: 'west, over the meadow',
    look: { shirt: 0xc0392b, overalls: 0x6b4a2b, hat: 0xe2b860, band: 0x7a2a1a, hair: 0x7a3f1c, ponytail: true },
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
        needs: [{ items: ['egg', 'large_egg'], count: 4, label: 'Eggs' }, { item: 'milk', count: 1 }],
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
      {
        id: 'rosa_note',
        title: 'A word with Mabel',
        ask: 'Tell Mabel that Rosa wants her honey cake on Friday',
        needs: [{ deed: 'tell', who: 'mabel', count: 1 }],
        gives: { gold: 200, items: [['large_egg', 3]] },
        message: {
          to: 'mabel',
          say: 'Rosa says Friday, and the usual honey cake, and the cheese is in her cellar.',
          reply: 'Friday, is it? Tell her I\'ll save her the crispy end. She always did love the crust.',
        },
        intro: 'I promised Mabel a word about Friday\'s honey cake, and I haven\'t a minute to walk over! Could you pop by her bakery and tell her I\'ll want the usual, and that the cheese is in my cellar?',
        waiting: 'Mabel\'s at the bakery, north-east, at the forest\'s edge. Just tell her Rosa says Friday, the usual, and the cheese is in the cellar.',
        thanks: 'The crispy end, bless her! You\'ve saved my legs a long walk. Here, a few of the big eggs for your trouble.',
      },
      {
        id: 'rosa_trough',
        title: 'Water for the herd',
        ask: 'Build a water trough and a hay cart on your farm',
        needs: [{ built: 'water_trough', count: 1 }, { built: 'hay_cart', count: 1 }],
        gives: { gold: 600 },
        intro: 'A farm is only a ranch once the animals have a trough to drink from and a cart to eat off. Build both on your land, and I\'ll know you\'re ready for the big stuff.',
        waiting: 'A water trough and a hay cart, from the Build tab (the Decor group). Both go on your own land.',
        thanks: 'Now that\'s a proper ranch! Look at them. Here: you\'ve earned a little something.',
      },
      {
        id: 'rosa_herd',
        title: 'The pick of the herd',
        ask: 'Pet 10 animals, and bring Rosa a bolt of cloth',
        needs: [{ deed: 'pet', count: 10 }, { item: 'cloth', count: 1 }],
        gives: {
          gold: 300,
          choose: [
            { label: 'A cow', items: [['cow', 1]] },
            { label: 'A sheep', items: [['sheep', 1]] },
            { label: 'Three hens', items: [['hen', 3]] },
          ],
        },
        intro: 'You\'ve been good for this ranch, and it\'s been good for me. Show me you love a whole herd: ten good pets, and a bolt of cloth for the guest quilt. Then take your pick of my animals. Any one. I mean it.',
        waiting: 'Ten pets (an animal counts once a day), and a bolt of cloth. A loom at the workbench weaves wool into cloth.',
        thanks: 'There! A friend of the herd, and the cloth is lovely. Look after them well, love.',
      },
    ],
    lines: {
      accepted: ['Wonderful! I knew I could count on you, love.', 'Marvellous. Off you go, then!'],
      later: ['Of course, love. No rush at all.', 'Whenever you\'re ready. The animals aren\'t going anywhere.'],
      reward: ['Well, there\'d be %s for you.', 'I\'d make it worth your while: %s.'],
      choose: 'Go on, take your pick!',
      open: ['Of course, love. What\'s on your mind?', 'Pull up a stool! What shall we talk about?'],
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
    look: { shirt: 0xe8dcc0, overalls: 0x5a4632, hatStyle: 'cap', hat: 0x6b5a3a, beard: 0xe8e4dc, apron: 0x4f7a3a },
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
      {
        id: 'basil_harvest',
        title: 'A good harvest',
        ask: 'Harvest 15 crops from your fields',
        needs: [{ deed: 'harvest', count: 15 }],
        gives: { gold: 450, items: [['tomato_seeds', 5]] },
        intro: 'Marigold used to say a gardener is measured in harvests, not words. Pick fifteen crops from your own fields, young one, and I\'ll know you\'re one of us.',
        waiting: 'Fifteen crops, picked ripe. Any kind counts, and a tomato plant or a berry bush counts every time it\'s picked again.',
        thanks: 'Fifteen! My knees ache just thinking of it. Here, tomato seeds. They\'ll give and give.',
      },
      {
        id: 'basil_note',
        title: 'A word for Finn',
        ask: 'Tell Finn that his sea lavender seeds are ready',
        needs: [{ deed: 'tell', who: 'finn', count: 1 }],
        gives: { gold: 250, items: [['carrot_seeds', 6]] },
        message: {
          to: 'finn',
          say: 'Basil says your sea lavender seeds are ready, and your compost was splendid.',
          reply: 'Ha! The old goat kept them all winter. Tell him I\'ll row him some more seaweed on Thursday.',
        },
        intro: 'Finn left me some sea lavender seeds last spring, and I never gave them back. I\'m not one for the dunes, not with my knees. Would you tell him they\'re ready, and that his seaweed compost did wonders?',
        waiting: 'Finn\'s on the dunes, south of the farm, at the end of the road. Tell him his sea lavender seeds are ready.',
        thanks: 'Seaweed on Thursday! Well, well. Here, carrot seeds: a thank you from an old gardener to a young one.',
      },
      {
        id: 'basil_cotton',
        title: 'Cotton for the clouds',
        ask: 'Bring Basil 2 cloud cotton',
        needs: [{ item: 'cloud_cotton', count: 2 }],
        gives: {
          choose: [
            { label: '3 golden seeds', items: [['golden_seeds', 3]] },
            { label: '900 gold', gold: 900 },
          ],
        },
        intro: 'There\'s one thing I never managed: cloud cotton, from the beanstalk plants. Grow me two, and bring them down, and I\'ll know you\'ve truly mastered the garden. Marigold would have wept.',
        waiting: 'Two cloud cotton. The seeds are on my rare shelf, and the plant climbs: you pick it up among the leaves.',
        thanks: 'Soft as a cloud. Marigold would have wept, and then made a quilt. Thank you, young one.',
      },
    ],
    lines: {
      accepted: ['Thank you. That\'s very kind, very kind indeed.', 'Splendid, splendid. Take your time. Plants do.'],
      later: ['Of course, of course. Another day.', 'No hurry. The garden will keep, and so will I.'],
      reward: ['Hm. I\'d find you %s, I think.', 'Oh, I\'d give you %s, somewhere in all this.'],
      choose: 'Hm, which? Whichever you like, young one.',
      open: ['Hm? Oh, yes. A chat. What about?', 'Ah, conversation. Rare as rain. Go on.'],
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
    look: { shirt: 0x2f4f7a, overalls: 0x3a3a3a, hatStyle: 'souwester', hat: 0xf2c230, beard: 0x9a9a9a },
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
      {
        id: 'finn_driftwood',
        title: 'Planks for the boat',
        ask: 'Chop 6 trees for Finn',
        needs: [{ deed: 'chop', count: 6 }],
        gives: { gold: 300, items: [['bait', 20]] },
        intro: 'That storm took more than the dock, matey. Me old rowboat\'s in pieces, and me back\'s not what it was. Fell six trees for me, anywhere ye like, and I\'ll know there\'s planks to be had.',
        waiting: 'Six trees felled with the axe, on yer farm or anywhere else. Chop till they\'re down.',
        thanks: 'That\'s a lot o\' planks! Me boat\'ll float again. Here, a barrel of bait for yer trouble.',
      },
      {
        id: 'finn_note',
        title: 'Not a word about the seaweed',
        ask: 'Tell Rosa that Finn ate a whole carrot',
        needs: [{ deed: 'tell', who: 'rosa', count: 1 }],
        gives: { gold: 250, items: [['grilled_fish', 2]] },
        message: {
          to: 'rosa',
          say: 'Finn says he ate a whole carrot. Raw. And not a word about the seaweed.',
          reply: 'A carrot! Well I never. Tell him there\'s a pie in it if he has another.',
        },
        intro: 'Rosa\'s always on at me to eat me vegetables. Go and tell her I ate a whole carrot. Raw! And not a word about the seaweed, mind.',
        waiting: 'Rosa\'s at Meadow Ranch, west over the meadow. Tell her I ate a whole carrot, raw, and keep quiet about the seaweed.',
        thanks: 'A pie! She\'s a hard woman to please. Here, a couple o\' fish off the grill.',
      },
      {
        id: 'finn_legend',
        title: 'After dark',
        ask: 'Bring Finn a lanternfish and a moonfish',
        needs: [{ item: 'lanternfish', count: 1 }, { item: 'moonfish', count: 1 }],
        gives: {
          choose: [
            { label: 'A golden rod', items: [['golden_rod', 1]] },
            { label: '1000 gold', gold: 1000 },
          ],
        },
        intro: 'There\'s fish that only bite after dark, matey. Lanternfish at dusk, and the moonfish when the night\'s deep. Land me one of each, from the sea off me dock, and I\'ll give ye something I\'ve been keeping.',
        waiting: 'A lanternfish (they bite from six till eleven at night) and a moonfish (from eight at night till five). Both in the sea, off the dock.',
        thanks: 'Moonlight on scales, there\'s nothing like it. Ye\'ve earned every bit, matey.',
      },
    ],
    lines: {
      accepted: ['Good on ye, matey!', 'That\'s the spirit! Fair winds, then.'],
      later: ['Aye, no bother. The tide\'ll wait.', 'Another day, then. The fish aren\'t going anywhere.'],
      reward: ['Ye\'d get %s for it, and me thanks.', 'There\'d be %s in it for ye, matey.'],
      choose: 'Choose, matey! Both are good.',
      open: ['Aye, matey, I\'ve time. What\'ll it be?', 'Pull up a barrel! What d\'ye want to know?'],
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
    look: { shirt: 0xe88aa8, overalls: 0x8a5a7a, hatStyle: 'scarf', band: 0xf4f0e8, hair: 0xb8662a, bun: true, apron: 0xfffaf0 },
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
      {
        id: 'mabel_berries',
        title: 'Berries for the tarts',
        ask: 'Bring Mabel 8 berries',
        needs: [{ items: ['berries', 'strawberry'], count: 8, label: 'Berries' }],
        gives: { gold: 350, items: [['berry_skewer', 3]] },
        intro: 'There\'s a bake sale on Saturday, and I\'m clean out of berries! Eight, dear, wild ones from the meadow or the bank, and I\'ll make a tart for everyone in the valley.',
        waiting: 'Eight berries, wild berries or wild strawberries. They turn up in the meadow, on the strawberry bank, and in the forest.',
        thanks: 'Look at the colour of them! Tarts for everyone. Here, a few skewers for the road.',
      },
      {
        id: 'mabel_cook',
        title: 'Practice makes pie',
        ask: 'Cook 3 meals of your own',
        needs: [{ deed: 'cook', count: 3 }],
        gives: { gold: 400, items: [['honey', 2]] },
        intro: 'You can\'t learn to cook by reading, dear, you learn by burning things. Cook three meals of your own, on a campfire or in your kitchen, and then we\'ll talk proper baking.',
        waiting: 'Three meals cooked, on a campfire on your farm or in the kitchen in your house. A whole batch counts as one, and anything will do, even a fried egg!',
        thanks: 'And nobody got hurt? Wonderful! Here, a little honey for the next batch.',
      },
      {
        id: 'mabel_note',
        title: 'Courgettes on the doorstep',
        ask: 'Tell Basil to stop leaving courgettes on her step',
        needs: [{ deed: 'tell', who: 'basil', count: 1 }],
        gives: { gold: 250, items: [['mushroom_pie', 1]] },
        message: {
          to: 'basil',
          say: 'Mabel says thank you, but please, no more courgettes on her doorstep.',
          reply: 'No more? But they\'re her favourites! Tell her... tell her I\'ll leave marrows instead.',
        },
        intro: 'Basil leaves courgettes on my doorstep every week, each the size of a cow, and I can\'t say a word because he means so well. Would you tell him, ever so gently, that I\'m fresh out of ideas?',
        waiting: 'Basil\'s cottage is east, past the fields. Tell him, gently: thank you, but no more courgettes.',
        thanks: 'Marrows! Oh, that man. Well, I\'ll think of something. Here, have a pie for the trouble.',
      },
      {
        id: 'mabel_feast',
        title: 'A feast for the valley',
        ask: 'Bring Mabel a farm feast',
        needs: [{ item: 'farm_feast', count: 1 }],
        gives: {
          choose: [
            { label: 'Mabel\'s recipe box (3 cards)', items: [['recipe_card', 3]] },
            { label: '1600 gold', gold: 1600 },
          ],
        },
        intro: 'Thirty years I\'ve fed this valley, and I\'d love, just once, to sit down and be fed. Cook me a farm feast, dear. The recipe\'s on my shelf, and the whole valley will thank you.',
        waiting: 'A farm feast. The recipe is on my shelf. It takes pumpkins, carrots, cheese, honey and fish, and you cook it in the kitchen in your house.',
        thanks: 'Oh, my dear! I shall sit down for the first time in years. Thank you.',
      },
    ],
    lines: {
      accepted: ['Oh, lovely! I knew you would, dear.', 'You\'re a treasure. Off you pop!'],
      later: ['Of course, dear. When you\'re ready.', 'No rush, love. The kettle\'s always on.'],
      reward: ['I\'d make it worth your while, dear: %s.', 'Well, there\'s %s for you, love.'],
      choose: 'Now, which would you like, dear?',
      open: ['Of course, dear! Sit, sit. What shall we talk about?', 'Oh, I do love a chat. Go on, dear.'],
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
// points (friendship), chatDay (the game day you last chatted), seen: [what
// they have told you that counts once: shared/talk.js], chose: { what you
// answered when asked: shared/talk.js } }. deeds: how many times each deed
// has been done, all told.

export const freshNpcState = () => ({ met: false, done: [], heard: [], since: {}, points: 0, chatDay: -1, seen: [], chose: {} });

// What a deed is counted under: 'pet', or 'tell:mabel' (telling Mabel)
export const deedKey = (need) => (need.who ? `${need.deed}:${need.who}` : need.deed);

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
    else if (need.deed) n = (deeds[deedKey(need)] ?? 0) - (state.since[mission.id]?.[deedKey(need)] ?? 0);
    else if (need.built) n = built(need.built);
    return { need, have: Math.max(0, n), count: need.count, ok: n >= need.count };
  });
}

// The messages you are carrying to `to` (a neighbour's id): [{ from, mission }]
// for every neighbour whose request now is to tell `to` something, that you
// have heard and haven't told yet. states: id -> state; deeds: as for progress
export function messagesFor(to, states, deeds) {
  const out = [];
  for (const from of NPC_IDS) {
    if (from === to) continue;
    const mission = currentMission(from, states[from]);
    if (mission?.message?.to !== to || !states[from].heard.includes(mission.id)) continue;
    if (progress(mission, states[from], { have: () => 0, deeds, built: () => 0 }).every((n) => n.ok)) continue;
    out.push({ from, mission });
  }
  return out;
}

// What a mission gives, in words: "250g, a hen, their shop opens" (for the
// window), or as they would say it, `speech`: "250 gold, a hen and the keys to
// my shop"
export function rewardText(mission, itemName, speech = false) {
  const g = mission.gives;
  const parts = [];
  if (g.gold) parts.push(speech ? `${g.gold} gold` : `${g.gold}g`);
  for (const [item, n] of g.items ?? []) parts.push(`${n > 1 ? `${n} × ` : ''}${itemName(item).toLowerCase()}`);
  if (g.opens === 'shop') parts.push(speech ? 'the keys to my shop' : 'their shop opens');
  else if (g.opens) parts.push(speech ? `a look at my ${g.opens.toLowerCase()} shelf` : `the ${g.opens.toLowerCase()} shelf`);
  if (g.mends === 'dock') parts.push('the dock mended');
  if (g.choose) {
    const picks = g.choose.map((c) => c.label.toLowerCase());
    parts.push(`your pick of ${picks.length > 1 ? `${picks.slice(0, -1).join(', ')} or ${picks.at(-1)}` : picks[0]}`);
  }
  return speech && parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join(', ');
}

// The hearts for so many points (FRIENDSHIP: points a heart, the most hearts)
export const heartsFor = (points, { perHeart, hearts }) => Math.min(hearts, Math.floor(points / perHeart));
