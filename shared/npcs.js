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
// when it is done.
//
// More deeds, for the later requests: 'make' (a thing made at the workbench),
// 'loot' (a lobby spot or sky chest emptied), 'boss' (a boss beaten),
// 'dungeon' (a dungeon chest opened), 'game' (a lobby party game played).
//
// A shelf of their shop opens with the shop, or `after` a request of theirs
// (the one that `opens` it), and some wait too for `hearts` (FRIENDSHIP).
//
// Once their requests are all done, they have an errand for you each game
// day (`errands`, one picked by the day: errandFor), shaped as a request but
// giving only gold, and every ERRANDS.every-th one, their `bonus` with it. A `message` ({ to, say, reply }) is what you tell `to`, and
// what they answer.
//
// How much a neighbour likes you (hearts, FRIENDSHIP in shared/balance.js)
// grows with a chat once a day, every mission done and what you hear from them
// (shared/talk.js), and takes a little off what their shop asks.

import { FRIENDSHIP } from './balance.js';

export const NPC_IDS = ['rosa', 'basil', 'finn', 'mabel', 'bram'];

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
        { title: 'Animals', items: ['hen', 'cow'] },
        { title: 'Sheep', items: ['sheep'], after: 'rosa_breakfast' },
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
        gives: { gold: 250, items: [['hen', 1]], opens: 'Sheep' },
        intro: 'The farmhands are coming for breakfast and my hens have gone broody on me, the lot of them. Could you bring me four eggs and a bottle of milk?',
        waiting: 'Four eggs and a milk, love. Your hens lay one a day each, and your cow has milk every morning.',
        thanks: 'You\'re a lifesaver! Here: take Clementine\'s sister home with you. She lays like clockwork. And I\'ll let you have one of my sheep now, if you\'d like.',
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
      {
        id: 'rosa_dovecote',
        title: 'Doves for the ranch',
        ask: 'Put up a birdhouse, and bring Rosa 6 large eggs',
        needs: [{ built: 'birdhouse', count: 1 }, { item: 'large_egg', count: 6 }],
        gives: { gold: 400 },
        intro: 'My doves have been nesting in the hay loft, and the cows don\'t care for it one bit. Put a birdhouse up on your farm, so I know they\'d have somewhere to go, and bring me six of the big eggs for the farmhands?',
        waiting: 'A birdhouse on your farm (the Build tab), and six large eggs. A bigger hen yard at the workbench lays more of them.',
        thanks: 'They\'ll love it. Here: my old plans for a proper dovecote. Bram drew them up for me years ago, and I never got round to it.',
      },
      {
        id: 'rosa_shearing',
        title: 'Shearing day',
        ask: 'Pet 15 animals, and bring Rosa 4 wool',
        needs: [{ deed: 'pet', count: 15 }, { item: 'wool', count: 4 }],
        gives: { gold: 600, items: [['mane_tuft', 1]] },
        intro: 'It\'s shearing day, and the flock won\'t sit still for anyone they don\'t know. Spend some time with your own: fifteen good pets, over a few days. And four lots of wool, for the market.',
        waiting: 'Fifteen pets (each animal once a day) and four lots of wool. A sheep\'s fleece grows back two days after she\'s sheared.',
        thanks: 'Calm as anything, the lot of them. Here, I found this caught on the fence after that terrible storm. A tuft of something\'s mane. Big something. Finn says there\'s a lion out past the sea!',
      },
      {
        id: 'rosa_bram',
        title: 'A word with Bram',
        ask: 'Tell Bram that the coop door is sticking again',
        needs: [{ deed: 'tell', who: 'bram', count: 1 }],
        gives: { gold: 250, items: [['large_egg', 3]] },
        message: {
          to: 'bram',
          say: 'Rosa says the coop door\'s sticking again, and there\'s a pie in it for you.',
          reply: 'Again. I told her not to slam it. Tell her Tuesday. And it had better be a big pie.',
        },
        intro: 'The coop door\'s sticking again, and the hens are sleeping in the porch. Would you tell Bram, at his joinery by the wood? There\'s a pie in it for him, tell him that. He never says no to a pie.',
        waiting: 'Bram\'s joinery is north-west, at the edge of the wood. Tell him the coop door\'s sticking, and there\'s a pie in it.',
        thanks: 'Tuesday! And he\'ll grumble the whole time, bless him. Here, a few eggs for your trouble.',
      },
      {
        id: 'rosa_lion',
        title: 'Trouble past the sea',
        ask: 'Beat one of the big grumps out past the sea',
        needs: [{ deed: 'boss', count: 1 }],
        gives: { gold: 800, items: [['cheese', 2]] },
        intro: 'There\'s something out past the sea that frightens my herd half to death on stormy nights. They say there\'s a whole row of grumps out there, each behind its portal. Would you go and calm one down, love? Just one. For the cows.',
        waiting: 'A boss beaten, any of them. A full set of a boss\'s key pieces builds its portal on your farm, and the parsnip has to be first.',
        thanks: 'Not a peep from the herd last night! You\'re braver than me, love. Here: cheese from the cellar, the good stuff.',
      },
      {
        id: 'rosa_show',
        title: 'Best in show',
        ask: 'Pet 20 animals, and bring Rosa 2 cheese, 2 cloth and 4 large eggs',
        needs: [{ deed: 'pet', count: 20 }, { item: 'cheese', count: 2 }, { item: 'cloth', count: 2 }, { item: 'large_egg', count: 4 }],
        gives: {
          gold: 500,
          choose: [
            { label: 'A cow and a sheep', items: [['cow', 1], ['sheep', 1]] },
            { label: 'Two gems', items: [['gem', 2]] },
            { label: '1500 gold', gold: 1500 },
          ],
        },
        intro: 'The valley show\'s coming, and I\'ve put your name down. Don\'t look at me like that! Show me the happiest herd in the valley, twenty good pets of it, and bring me cheese, cloth and the big eggs for the stall. We\'ll win the lot.',
        waiting: 'Twenty pets (each animal once a day), two cheeses, two bolts of cloth and four large eggs.',
        thanks: 'Best in show! I knew it. The judges had never seen a cow smile. Take your pick, love: you\'ve earned it twice over.',
      },
    ],
    // once she has asked all she had to: one of these a day (errandFor)
    errands: [
      { id: 'rosa_e_eggs', title: 'Eggs for the farmhands', ask: 'Bring Rosa 6 eggs', needs: [{ items: ['egg', 'large_egg'], count: 6, label: 'Eggs' }], gives: { gold: 150 },
        intro: 'The farmhands are hungry again. Six eggs, love?', waiting: 'Six eggs, large or small.', thanks: 'Breakfast is saved!' },
      { id: 'rosa_e_milk', title: 'Milk for the calves', ask: 'Bring Rosa 3 milk', needs: [{ item: 'milk', count: 3 }], gives: { gold: 180 },
        intro: 'Two new calves, and their mums are being stubborn about it. Three bottles of milk would tide them over.', waiting: 'Three bottles of milk.', thanks: 'Listen to them slurp!' },
      { id: 'rosa_e_wool', title: 'The knitting circle', ask: 'Bring Rosa 2 wool', needs: [{ item: 'wool', count: 2 }], gives: { gold: 200 },
        intro: 'The knitting circle meets tonight, and we\'re short. Two lots of wool?', waiting: 'Two lots of wool.', thanks: 'Lovely! More scarves for the animals.' },
      { id: 'rosa_e_pet', title: 'A round of pets', ask: 'Pet 5 animals', needs: [{ deed: 'pet', count: 5 }], gives: { gold: 120 },
        intro: 'Go and give five of your animals a good pet today. Happy animals, happy farm.', waiting: 'Five pets, each animal once a day.', thanks: 'I can tell. You smell of hay and kindness.' },
      { id: 'rosa_e_cheese', title: 'Cheese for the cellar', ask: 'Bring Rosa 2 cheese', needs: [{ item: 'cheese', count: 2 }], gives: { gold: 260 },
        intro: 'Someone has been at my cheese cellar. I suspect Finn. Two cheeses to fill the gap?', waiting: 'Two cheeses, from your cheese press.', thanks: 'Lovely. And I\'m putting a lock on that cellar.' },
      { id: 'rosa_e_mayo', title: 'Mayonnaise for the picnic', ask: 'Bring Rosa 3 mayonnaise', needs: [{ item: 'mayonnaise', count: 3 }], gives: { gold: 220 },
        intro: 'Picnic for the farmhands, and you can\'t have egg sandwiches without mayonnaise. Three jars?', waiting: 'Three jars of mayonnaise, from your mayonnaise machine.', thanks: 'Sandwiches for everyone!' },
    ],
    bonus: ['large_egg', 4],
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
      done: 'You\'ve been a true friend to the ranch. Nothing more today, love: come by tomorrow!',
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
        { title: 'Treasures', items: ['golden_seeds'], after: 'basil_crows', hearts: 3 },
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
      {
        id: 'basil_beans',
        title: 'Up the beanstalk',
        ask: 'Bring Basil 4 beans',
        needs: [{ item: 'beans', count: 4 }],
        gives: { gold: 450, items: [['golden_seeds', 1]] },
        intro: 'I\'d like to taste a bean from the top of a beanstalk once more before my knees give out altogether. Four, young one. Up you go, and don\'t look down.',
        waiting: 'Four beans, picked from the very top of a beanstalk. Bean seeds are on my rare shelf.',
        thanks: 'Sweet as summer! Here: a golden seed, and Marigold\'s drawings for a birdbath and a sundial. She\'d want them built somewhere they\'d be loved.',
      },
      {
        id: 'basil_golden',
        title: 'Marigold\'s turnip',
        ask: 'Grow Basil a golden turnip',
        needs: [{ item: 'golden_turnip', count: 1 }],
        gives: { gold: 600, items: [['parsnip_seal', 1]] },
        intro: 'Marigold grew a golden turnip once, the year we married. I never managed it. Would you grow me one, from a golden seed? Just to see it again.',
        waiting: 'A golden turnip. Golden seeds grow them: I sell a few, and they turn up out on the wild islands.',
        thanks: 'Oh, it glows! Just like hers. Here, this was in the root cellar, under her old seed boxes. A seal of some kind, shaped like a parsnip. I\'ve never known what it\'s for.',
      },
      {
        id: 'basil_market',
        title: 'Market day',
        ask: 'Bring Basil 6 tomatoes and 4 pumpkins',
        needs: [{ item: 'tomato', count: 6 }, { item: 'pumpkin', count: 4 }],
        gives: { gold: 500 },
        intro: 'Market day, and my tomatoes have come up green and my pumpkins have come up small. Six tomatoes and four pumpkins, young one, so I don\'t embarrass myself?',
        waiting: 'Six tomatoes and four pumpkins. Tomato plants give again and again once they\'re grown.',
        thanks: 'The best stall in the square! Here: how to build a planter, and a box hedge to go round it. A garden wants edges.',
      },
      {
        id: 'basil_far',
        title: 'Seeds from far shores',
        ask: 'Gather from 20 spots out on the wild islands',
        needs: [{ deed: 'loot', count: 20 }],
        gives: { gold: 600, items: [['golden_seeds', 2]] },
        intro: 'The wild islands out past the plaza grow things I\'ve only read about. I\'m too old for the boat. Go and gather for me, twenty spots\' worth, and tell me everything.',
        waiting: 'Twenty spots picked on the wild islands: bushes, mushrooms, meadows, anything that has something on it.',
        thanks: 'Strawberries on a bank, ferns in a glen... Marigold would have gone in a heartbeat. Here, two golden seeds, for the seeds you\'ve seen.',
      },
      {
        id: 'basil_garden',
        title: 'Marigold\'s garden',
        ask: 'Harvest 40 crops, and build 2 planters and 4 box hedges',
        needs: [{ deed: 'harvest', count: 40 }, { built: 'planter', count: 2 }, { built: 'box_hedge', count: 4 }],
        gives: {
          gold: 400,
          choose: [
            { label: '5 golden seeds', items: [['golden_seeds', 5]] },
            { label: '2000 gold', gold: 2000 },
          ],
        },
        intro: 'I\'ve one more thing to ask, and then I\'ll stop pestering you. Make a garden on your farm the way Marigold would: planters, a hedge round them, and forty crops picked from it. Then I\'ll know her garden goes on.',
        waiting: 'Forty crops harvested, and two planters and four box hedges built on your farm.',
        thanks: 'It\'s her garden. It\'s exactly her garden. Thank you, young one. Take whichever you like.',
      },
    ],
    errands: [
      { id: 'basil_e_turnips', title: 'Turnips for the pot', ask: 'Bring Basil 8 turnips', needs: [{ item: 'turnip', count: 8 }], gives: { gold: 160 },
        intro: 'Turnip stew tonight, and my turnips are all leaf and no turnip. Eight?', waiting: 'Eight turnips.', thanks: 'Splendid. Stew for a week.' },
      { id: 'basil_e_carrots', title: 'Carrots for Rosa\'s pony', ask: 'Bring Basil 5 carrots', needs: [{ item: 'carrot', count: 5 }], gives: { gold: 160 },
        intro: 'I promised Rosa carrots for her pony, and then I ate them. Five, young one?', waiting: 'Five carrots.', thanks: 'Not a word to Rosa.' },
      { id: 'basil_e_tomatoes', title: 'Tomatoes for chutney', ask: 'Bring Basil 4 tomatoes', needs: [{ item: 'tomato', count: 4 }], gives: { gold: 180 },
        intro: 'Chutney season! Four tomatoes, nice and red?', waiting: 'Four tomatoes.', thanks: 'Red as a robin. Lovely.' },
      { id: 'basil_e_harvest', title: 'A busy day in the beds', ask: 'Harvest 10 crops', needs: [{ deed: 'harvest', count: 10 }], gives: { gold: 150 },
        intro: 'Pick ten crops from your own fields today. Keeps the hands green.', waiting: 'Ten crops harvested, any kind.', thanks: 'A gardener\'s day well spent.' },
      { id: 'basil_e_pumpkins', title: 'Pumpkins for the porch', ask: 'Bring Basil 3 pumpkins', needs: [{ item: 'pumpkin', count: 3 }], gives: { gold: 200 },
        intro: 'Three pumpkins for the porch. The crows won\'t dare.', waiting: 'Three pumpkins.', thanks: 'Fine and round. Thank you.' },
      { id: 'basil_e_sunflowers', title: 'Sunflowers for Marigold', ask: 'Bring Basil 4 sunflowers', needs: [{ item: 'sunflower', count: 4 }], gives: { gold: 180 },
        intro: 'Four sunflowers, for the vase by Marigold\'s picture?', waiting: 'Four sunflowers.', thanks: 'She\'d have loved these.' },
    ],
    bonus: ['golden_seeds', 1],
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
      done: 'You\'ve a gardener\'s heart. Marigold would have liked you. Come back tomorrow, young one.',
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
        { title: 'Tackle', items: ['bait', 'fishing_rod'] },
        { title: 'Lures', items: ['lure'], hearts: 2 },
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
        thanks: 'Ye\'ve a feel for it! Here, a couple of lures, and I\'ll sell ye a sturdy rod now. Ye\'ve earned it. And if ye want a pond of yer own to fish, I\'ll show ye how to dig one.',
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
      {
        id: 'finn_pond',
        title: 'A pond of yer own',
        ask: 'Dig a fish pond on your farm, and land 10 fish',
        needs: [{ built: 'pond', count: 1 }, { deed: 'fish', count: 10 }],
        gives: { gold: 500 },
        intro: 'A fisher with no water of their own is like a baker with no oven. Dig yerself a pond, matey, and land ten fish, anywhere ye like, while it fills.',
        waiting: 'A fish pond on your farm (the Build tab), and ten fish landed.',
        thanks: 'A fine bit o\' water! Here, how to build a glass tank for the house. Keep yer best catches where ye can see \'em.',
      },
      {
        id: 'finn_tuna',
        title: 'Big game',
        ask: 'Bring Finn a tuna and a pufferfish',
        needs: [{ item: 'tuna', count: 1 }, { item: 'pufferfish', count: 1 }],
        gives: { gold: 700, items: [['lure', 5]] },
        intro: 'Time ye went after the big ones. A tuna, in the morning when they come in close, and a pufferfish. Mind the spikes.',
        waiting: 'A tuna (in the sea, from five in the morning till noon, with a sturdy rod) and a pufferfish (the sea, sturdy rod).',
        thanks: 'Ha! Look at the size o\' that! Here, a fistful o\' lures.',
      },
      {
        id: 'finn_contest',
        title: 'Show the lobbies',
        ask: 'Play 3 party games out in the lobbies',
        needs: [{ deed: 'game', count: 3 }],
        gives: { gold: 400, items: [['bait', 30]] },
        intro: 'Ye spend all day with yer line in the water, matey. Get out and meet folk! Play three o\' those party games out in the lobbies. Win or lose, I don\'t mind.',
        waiting: 'Three party games played, in any lobby.',
        thanks: 'Made some friends, did ye? Good. A fisher needs someone to tell the stories to. Here, a barrel o\' bait.',
      },
      {
        id: 'finn_bog',
        title: 'Pearls in the bog',
        ask: 'Open 3 chests in the dungeons past the portals',
        needs: [{ deed: 'dungeon', count: 3 }],
        gives: { gold: 800, items: [['bog_pearl', 1]] },
        intro: 'Me grandad swore there\'s chests hidden in the halls behind them portals, in little side rooms. Go and open three, and I\'ll tell ye what me grandad left me.',
        waiting: 'Three chests opened in the side rooms of the dungeons, behind a boss\'s portal.',
        thanks: 'Grandad was right! Here, he left me this pearl, from the bog past the sea. Said it opens a door. Never found which.',
      },
      {
        id: 'finn_whopper',
        title: 'The one that got away',
        ask: 'Bring Finn a swordfish and a golden carp',
        needs: [{ item: 'swordfish', count: 1 }, { item: 'golden_carp', count: 1 }],
        gives: {
          gold: 500,
          choose: [
            { label: 'Two gems', items: [['gem', 2]] },
            { label: 'Two bog pearls', items: [['bog_pearl', 2]] },
            { label: '2500 gold', gold: 2500 },
          ],
        },
        intro: 'Forty years I\'ve been after a swordfish and a golden carp, and forty years they\'ve got away. Land me one of each, matey, and I can hang up me rod a happy man. Well. I won\'t. But I could.',
        waiting: 'A swordfish (the sea, with a golden rod) and a golden carp (the ponds on the wild islands, sturdy rod or better).',
        thanks: 'I\'ve no words. Well, I\'ve a few. Most o\' them aren\'t fit for company. Take yer pick, matey!',
      },
    ],
    errands: [
      { id: 'finn_e_fish', title: 'Fish for the smokehouse', ask: 'Land 5 fish', needs: [{ deed: 'fish', count: 5 }], gives: { gold: 150 },
        intro: 'The smokehouse is empty. Land five fish today, any kind.', waiting: 'Five fish landed.', thanks: 'Smoke\'s rising!' },
      { id: 'finn_e_mackerel', title: 'Mackerel for supper', ask: 'Bring Finn 3 mackerel', needs: [{ item: 'mackerel', count: 3 }], gives: { gold: 150 },
        intro: 'Three mackerel for supper, matey?', waiting: 'Three mackerel, from the sea.', thanks: 'Supper\'s sorted!' },
      { id: 'finn_e_bass', title: 'Bass for the market', ask: 'Bring Finn 2 sea bass', needs: [{ item: 'sea_bass', count: 2 }], gives: { gold: 220 },
        intro: 'Market\'s wanting sea bass, and the tide\'s against me. Two?', waiting: 'Two sea bass, from the sea.', thanks: 'Fine fish!' },
      { id: 'finn_e_shells', title: 'Shells for the missus', ask: 'Bring Finn 4 seashells', needs: [{ item: 'seashell', count: 4 }], gives: { gold: 120 },
        intro: 'The missus wants more shells for the window. Four?', waiting: 'Four seashells, off the dunes.', thanks: 'She\'ll be pleased as punch.' },
      { id: 'finn_e_trout', title: 'A taste of the wild', ask: 'Bring Finn 3 trout', needs: [{ item: 'trout', count: 3 }], gives: { gold: 200 },
        intro: 'I\'ve a hankering for river trout, the kind in the wild islands\' ponds. Three?', waiting: 'Three trout, from the ponds out on the wild islands.', thanks: 'Tastes of somewhere else entirely!' },
      { id: 'finn_e_seaweed', title: 'Seaweed for Basil', ask: 'Bring Finn 5 seaweed', needs: [{ item: 'seaweed', count: 5 }], gives: { gold: 120 },
        intro: 'Basil\'s wanting seaweed for his compost again. Five strands?', waiting: 'Five seaweed. It comes up on the line in the sea.', thanks: 'The old goat\'ll be thrilled.' },
    ],
    bonus: ['key', 1],
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
      done: 'Ye\'ve the sea in yer blood now, matey. Nothing more today: fair winds!',
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
        { title: 'Recipes', items: ['recipe_pumpkin_soup', 'recipe_sushi_rolls', 'recipe_honey_carrots'] },
        { title: 'Pies & feasts', items: ['recipe_mushroom_pie', 'recipe_farm_feast'], after: 'mabel_cook' },
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
        gives: { gold: 400, items: [['honey', 2]], opens: 'Pies & feasts' },
        intro: 'You can\'t learn to cook by reading, dear, you learn by burning things. Cook three meals of your own, on a campfire or in your kitchen, and then we\'ll talk proper baking.',
        waiting: 'Three meals cooked, on a campfire on your farm or in the kitchen in your house. A whole batch counts as one, and anything will do, even a fried egg!',
        thanks: 'And nobody got hurt? Wonderful! Here, a little honey for the next batch, and now I\'ll sell you my pie and feast recipes. You\'re ready.',
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
            { label: 'A recipe box from Mabel (3 cards)', items: [['recipe_card', 3]] },
            { label: '1600 gold', gold: 1600 },
          ],
        },
        intro: 'Thirty years I\'ve fed this valley, and I\'d love, just once, to sit down and be fed. Cook me a farm feast, dear. The recipe\'s on my shelf, and the whole valley will thank you.',
        waiting: 'A farm feast. The recipe is on my shelf. It takes pumpkins, carrots, cheese, honey and fish, and you cook it in the kitchen in your house.',
        thanks: 'Oh, my dear! I shall sit down for the first time in years. Thank you.',
      },
      {
        id: 'mabel_soup',
        title: 'Soup for the poorly',
        ask: 'Bring Mabel 2 pumpkin soups and a fish stew',
        needs: [{ item: 'pumpkin_soup', count: 2 }, { item: 'fish_stew', count: 1 }],
        gives: { gold: 600 },
        intro: 'Half the valley\'s down with a sniffle, and I can\'t cook fast enough. Two pumpkin soups and a fish stew, dear, from your kitchen?',
        waiting: 'Two pumpkin soups and a fish stew. Cook them in the kitchen in your house.',
        thanks: 'They\'ll be right as rain by morning. Here: Bram made me a lovely bench and a lamp for the garden, years ago. These are his plans. Sit down now and then, dear!',
      },
      {
        id: 'mabel_cooking',
        title: 'A proper cook',
        ask: 'Cook 10 meals',
        needs: [{ deed: 'cook', count: 10 }],
        gives: { gold: 500, items: [['honey_drop', 1]] },
        intro: 'Three meals was practice. Ten makes a cook. Off you go, dear, and don\'t skimp on the butter.',
        waiting: 'Ten meals cooked, on a campfire or in your kitchen. A whole batch counts once.',
        thanks: 'A proper cook! Here, this was stuck to the bottom of a honey jar from that wild hive past the sea. A drop of honey, hard as glass. Strange thing.',
      },
      {
        id: 'mabel_picnic',
        title: 'A picnic for two',
        ask: 'Bring Mabel 3 sushi rolls and 3 honey carrots',
        needs: [{ item: 'sushi_rolls', count: 3 }, { item: 'honey_carrots', count: 3 }],
        gives: { gold: 700, items: [['recipe_card', 1]] },
        intro: 'Now, don\'t tell a soul, but someone has asked me on a picnic. I\'m far too nervous to cook! Three sushi rolls and three honey carrots, dear, and not a word.',
        waiting: 'Three sushi rolls and three honey carrots, from your kitchen. And not a word!',
        thanks: 'Perfect. And no, I won\'t tell you who. Here, one of Gran\'s old cards, for keeping my secret.',
      },
      {
        id: 'mabel_hive',
        title: 'Bees, bees, bees',
        ask: 'Keep 3 beehives, and bring Mabel 6 honey',
        needs: [{ built: 'beehive', count: 3 }, { item: 'honey', count: 6 }],
        gives: { gold: 600, items: [['gem', 1]] },
        intro: 'Honey cake for the whole valley this winter, dear, and that takes honey. Three hives on your farm, and six jars to start me off?',
        waiting: 'Three beehives on your farm, and six jars of honey. Each hive fills a jar a day.',
        thanks: 'Golden! Here: a little gem I found in the flour sack, of all places, and Bram\'s plans for a well and a lantern. A busy garden needs both.',
      },
      {
        id: 'mabel_festival',
        title: 'The valley festival',
        ask: 'Bring Mabel 2 farm feasts, 2 cheese omelettes and 3 pancakes',
        needs: [{ item: 'farm_feast', count: 2 }, { item: 'cheese_omelette', count: 2 }, { item: 'pancakes', count: 3 }],
        gives: {
          gold: 500,
          choose: [
            { label: 'Three gems', items: [['gem', 3]] },
            { label: '2500 gold', gold: 2500 },
          ],
        },
        intro: 'The valley festival! Everyone brings a dish, and this year, dear, I\'d like you to bring the lot. Two farm feasts, two cheese omelettes and three stacks of pancakes. The whole valley will be talking about you.',
        waiting: 'Two farm feasts, two cheese omelettes and three pancakes, all from your kitchen.',
        thanks: 'Everyone\'s talking about you, dear! I told you they would. Take your pick, and take a slice of cake on your way.',
      },
    ],
    errands: [
      { id: 'mabel_e_cook', title: 'Two pans on', ask: 'Cook 2 meals', needs: [{ deed: 'cook', count: 2 }], gives: { gold: 150 },
        intro: 'Keep your hand in, dear: cook two meals today.', waiting: 'Two meals cooked.', thanks: 'Smells lovely from here!' },
      { id: 'mabel_e_berries', title: 'Berries for jam', ask: 'Bring Mabel 6 berries', needs: [{ items: ['berries', 'strawberry'], count: 6, label: 'Berries' }], gives: { gold: 130 },
        intro: 'Jam day! Six berries, dear, any kind.', waiting: 'Six berries or strawberries.', thanks: 'Jam for everyone!' },
      { id: 'mabel_e_mushrooms', title: 'Mushrooms for tarts', ask: 'Bring Mabel 5 mushrooms', needs: [{ item: 'mushroom', count: 5 }], gives: { gold: 150 },
        intro: 'Mushroom tarts are selling like hot cakes. Five mushrooms?', waiting: 'Five mushrooms.', thanks: 'Lovely and earthy!' },
      { id: 'mabel_e_honey', title: 'Honey for the cake', ask: 'Bring Mabel 2 honey', needs: [{ item: 'honey', count: 2 }], gives: { gold: 200 },
        intro: 'Honey cake, dear. Always honey cake. Two jars?', waiting: 'Two jars of honey.', thanks: 'Golden!' },
      { id: 'mabel_e_pancakes', title: 'Pancakes for the bake sale', ask: 'Bring Mabel 2 pancakes', needs: [{ item: 'pancakes', count: 2 }], gives: { gold: 220 },
        intro: 'The bake sale wants pancakes, and I\'ve two hands. Two stacks from your kitchen?', waiting: 'Two pancakes, from your kitchen.', thanks: 'Fluffy as clouds!' },
      { id: 'mabel_e_stew', title: 'Stew for Finn', ask: 'Bring Mabel a fish stew', needs: [{ item: 'fish_stew', count: 1 }], gives: { gold: 200 },
        intro: 'Finn\'s poorly and he won\'t eat anything but stew. One fish stew, dear?', waiting: 'A fish stew, from your kitchen.', thanks: 'He\'ll be back on the dock tomorrow.' },
    ],
    bonus: ['recipe_card', 1],
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
      done: 'You\'re like family now, dear. Nothing more today: take a biscuit on your way out!',
      shop: ['Every one of them tried and tested.', 'Cook with love, dear!'],
      bought: ['You\'ll be the talk of the valley!', 'Don\'t burn it, now!', 'Lovely choice, dear.'],
    },
  },

  bram: {
    name: 'Bram',
    title: 'Bram\'s Joinery',
    trade: 'Carpentry',
    where: 'north-west, at the edge of the wood',
    shirt: 0xc8962a,
    look: { hat: 'beanie', hatColor: 0x3f8a46, hair: 'short', hairColor: 0x5a3a22, whiskers: 'mustache', top: 'plaid', bottoms: 'trousers', bottomsColor: 0x6b4a2b, apron: 'apron', apronColor: 0x8a5a33, shoes: 'boots' },
    portrait: { hat: '#3f8a46', hair: '#5a3a22', shirt: '#c8962a' },
    hours: [6, 8, 16, 21],
    shop: {
      opensWith: 'bram_quarry',
      shelves: [
        { title: 'Timber', items: ['wood', 'stone'] },
        { title: 'Ironmongery', items: ['steel', 'arrow'], after: 'bram_steel' },
        { title: 'Locksmith', items: ['key'], after: 'bram_fair', hearts: 4 },
      ],
    },
    missions: [
      {
        id: 'bram_quarry',
        title: 'Good stone',
        ask: 'Break 8 rocks',
        needs: [{ deed: 'mine', count: 8 }],
        gives: { gold: 150, opens: 'shop' },
        intro: 'Hm. Another one wanting things built. Everyone wants things built. Nobody wants to break their back for the stone. Go and break eight rocks, and then we\'ll talk.',
        waiting: 'Eight rocks, broken with a pickaxe. On your farm, out in the valley, on the wild islands. Stone is stone.',
        thanks: 'Blisters. Good. You\'ll do. I\'ll sell you timber and stone, when you\'re short, and I\'ll not rob you for it.',
      },
      {
        id: 'bram_bench',
        title: 'A bench of your own',
        ask: 'Put a workbench up on your farm, and make 3 things at it',
        needs: [{ built: 'workbench', count: 1 }, { deed: 'make', count: 3 }],
        gives: { gold: 300 },
        intro: 'A farmer with no workbench is a farmer who borrows mine. Build your own, and make three things at it. Anything. A sword, an arrow. I want to see sawdust.',
        waiting: 'A workbench on your farm (the Build tab), and three things made at it.',
        thanks: 'Not bad. Not good, either, but not bad. Here: plans for a picket fence, a cobbled path, an arch and an arbor. Proper joinery. Mind the corners.',
      },
      {
        id: 'bram_steel',
        title: 'Iron in the stone',
        ask: 'Bring Bram 6 steel',
        needs: [{ item: 'steel', count: 6 }],
        gives: { gold: 400, opens: 'Ironmongery' },
        intro: 'My good chisels are worn to nothing, and the forge in town wants paying in steel. Six lumps of it. It turns up in the rocks, now and then, if you break enough.',
        waiting: 'Six steel. Rocks give a lump of it now and then when they break.',
        thanks: 'That\'ll make a fine set of chisels. Now: your workbench. I\'ll help you build it up a level, when you\'ve the gold and the timber. And I\'ll sell you steel from now on, and arrows.',
      },
      {
        id: 'bram_fence',
        title: 'Mind the gap',
        ask: 'Build 10 picket fences and a stone arch',
        needs: [{ built: 'picket_fence', count: 10 }, { built: 'stone_arch', count: 1 }],
        gives: { gold: 500 },
        intro: 'Plans are just paper till they\'re wood. Build ten lengths of picket fence and an arch on your land, and I\'ll know you can follow a drawing.',
        waiting: 'Ten picket fences and a stone arch, on your farm.',
        thanks: 'Straight lines. Mostly. Right: your hen yard and your pasture can go out a bit now, when you\'ve the means. Ask the workbench.',
      },
      {
        id: 'bram_note',
        title: 'A word with Finn',
        ask: 'Tell Finn that his new oars are done',
        needs: [{ deed: 'tell', who: 'finn', count: 1 }],
        gives: { gold: 250, items: [['arrow', 10]] },
        message: {
          to: 'finn',
          say: 'Bram says your new oars are done, and stop using the old ones as fence posts.',
          reply: 'Fence posts! They were holdin\' up me nets. Tell him thanks, and I\'ll be round with a mackerel.',
        },
        intro: 'Finn\'s oars are done. Go and tell him, would you. And tell him to stop using the old ones as fence posts. I saw. I always see.',
        waiting: 'Finn\'s on the dunes, south of the farm. His oars are done, and no more fence posts.',
        thanks: 'A mackerel. That man pays in fish. Here, arrows. Don\'t shoot anything that\'s mine.',
      },
      {
        id: 'bram_tower',
        title: 'A view from the top',
        ask: 'Build a log tower and a stone pillar, and bring Bram a gem',
        needs: [{ built: 'log_tower', count: 1 }, { built: 'stone_pillar', count: 1 }, { item: 'gem', count: 1 }],
        gives: { gold: 800, items: [['crow_feather', 1]] },
        intro: 'Anybody can build low. Build tall: a log tower and a stone pillar. And bring me a gem, for the level. A proper level has a gem in it. Don\'t ask.',
        waiting: 'A log tower and a stone pillar on your farm, and a gem.',
        thanks: 'Plumb. Both of them. Here, I found this up my own tower after a storm. A feather the size of an oar. Something big nests out past the sea.',
      },
      {
        id: 'bram_barn',
        title: 'Raising the barn',
        ask: 'Bring Bram 200 wood, 120 stone and 2 cloth',
        needs: [{ item: 'wood', count: 200 }, { item: 'stone', count: 120 }, { item: 'cloth', count: 2 }],
        gives: { gold: 600 },
        intro: 'Rosa wants a new barn. Rosa always wants a new barn. Two hundred wood, a hundred and twenty stone, and two bolts of cloth for the loft curtains, which is her idea, not mine.',
        waiting: '200 wood, 120 stone and 2 cloth. A loom at the workbench weaves wool into cloth.',
        thanks: 'Up it goes. You can build your own pens out as far as they go, now, if your animals are ready for it. And here, plans for bunting and a market awning, for Rosa\'s barn dance.',
      },
      {
        id: 'bram_fair',
        title: 'A stage for the fair',
        ask: 'Build 4 bunting and a market awning, and bring Bram 4 steel and a gem',
        needs: [{ built: 'bunting', count: 4 }, { built: 'market_awning', count: 1 }, { item: 'steel', count: 4 }, { item: 'gem', count: 1 }],
        gives: {
          gold: 500,
          opens: 'Locksmith',
          choose: [
            { label: 'Two gems and a crow feather', items: [['gem', 2], ['crow_feather', 1]] },
            { label: '3000 gold', gold: 3000 },
          ],
        },
        intro: 'The fair wants a stage, and the stage wants a builder who isn\'t me, because I\'m tired. Show me you can dress a farm for a party: four lengths of bunting and an awning. And steel and a gem, for the stage. I\'ll do the rest.',
        waiting: 'Four bunting and a market awning on your farm, four steel and a gem.',
        thanks: 'That\'s a stage. That\'s a proper stage. You\'re a joiner now, whatever you call yourself. Your workbench can go to the top, too, once your hands are good enough. And when we\'re better friends, I\'ll cut you a key or two. Take your pick.',
      },
    ],
    errands: [
      { id: 'bram_e_chop', title: 'Timber for the yard', ask: 'Fell 6 trees', needs: [{ deed: 'chop', count: 6 }], gives: { gold: 150 },
        intro: 'The timber yard\'s low. Fell six trees.', waiting: 'Six trees felled.', thanks: 'Good. Stack them straight.' },
      { id: 'bram_e_mine', title: 'Stone for the wall', ask: 'Break 6 rocks', needs: [{ deed: 'mine', count: 6 }], gives: { gold: 150 },
        intro: 'Wall\'s fallen down again. Break six rocks.', waiting: 'Six rocks broken.', thanks: 'That\'ll hold. For now.' },
      { id: 'bram_e_wood', title: 'A load of wood', ask: 'Bring Bram 40 wood', needs: [{ item: 'wood', count: 40 }], gives: { gold: 200 },
        intro: 'Forty wood. Don\'t ask what for.', waiting: 'Forty wood.', thanks: 'Hm. Seasoned. Good.' },
      { id: 'bram_e_stone', title: 'A load of stone', ask: 'Bring Bram 30 stone', needs: [{ item: 'stone', count: 30 }], gives: { gold: 200 },
        intro: 'Thirty stone, for Basil\'s new steps. His knees.', waiting: 'Thirty stone.', thanks: 'He\'ll pretend he didn\'t need them.' },
      { id: 'bram_e_steel', title: 'Nails and hinges', ask: 'Bring Bram 3 steel', needs: [{ item: 'steel', count: 3 }], gives: { gold: 260 },
        intro: 'Out of nails. Out of hinges. Three steel.', waiting: 'Three steel, from the rocks.', thanks: 'Nails. Hinges. Order is restored.' },
      { id: 'bram_e_make', title: 'Keep your hand in', ask: 'Make 2 things at your workbench', needs: [{ deed: 'make', count: 2 }], gives: { gold: 180 },
        intro: 'Hands forget. Make two things at your bench today.', waiting: 'Two things made at your workbench.', thanks: 'Sawdust on your sleeves. Good.' },
    ],
    bonus: ['gem', 1],
    lines: {
      accepted: ['Right.', 'Good. Off you go, then.'],
      later: ['Fine. The wood\'ll wait. It\'s good at that.', 'Suit yourself.'],
      reward: ['There\'s %s in it.', 'I\'d pay %s. Fair price.'],
      choose: 'Pick one. Don\'t dither.',
      open: ['Hm. Go on, then.', 'I\'ve a minute. One.'],
      intro: 'Mind the shavings. Bram. I built every house in this valley, and most of the fences, and Finn\'s first dock, before the sea had it. You\'ll be the new farmer. You\'ll be wanting things built.',
      morning: ['Morning. Measure twice, cut once.', 'Early. Good. Wood likes the cool.'],
      day: ['You again.', 'Hm. Afternoon.'],
      evening: ['Evening. Sweeping up.', 'Light\'s going. Can\'t cut straight in the dark.'],
      chat: [
        'Measure twice, cut once. Then measure again, because you\'ll have moved it.',
        'Wood doesn\'t lie. People do. Wood just warps.',
        'Rosa slams the coop door. Every day. I fix it. Every week.',
        'Basil\'s greenhouse is the best thing I ever built. Don\'t tell him. He\'ll want another.',
        'Mabel\'s shelves have held thirty years of flour. That\'s oak, that is.',
        'A bigger workbench makes better tools. Silver, gold. Takes steel, takes gems, takes patience.',
        'Break enough rocks and you find steel. Break enough steel and you find out why I drink tea.',
        'My apprentice went to the city. Said the valley was too quiet. It is. That\'s the point.',
      ],
      asleep: 'Bram is asleep in his chair, a pencil behind his ear.',
      locked: 'I don\'t sell to anyone who\'s never broken a rock. Go and break some.',
      done: 'You\'re a joiner now. Nothing more today: come back tomorrow.',
      shop: ['Fair prices. Don\'t haggle.', 'Seasoned, all of it.'],
      bought: ['Use it well.', 'Mind your thumbs.', 'Don\'t waste it.'],
    },
  },
};

// The merchant at the stall sells only the basics now: the neighbours keep
// the rest. (MERCHANT_STOCK in shared/balance.js)

// (each mission knows whose it is, and its place in their list)
for (const npc of NPC_IDS) NPCS[npc].missions.forEach((m, i) => Object.assign(m, { npc, i }));
// Every mission, by id
export const MISSIONS = Object.fromEntries(NPC_IDS.flatMap((npc) => NPCS[npc].missions.map((m) => [m.id, m])));
// (each errand too knows whose it is) Every errand, by id
for (const npc of NPC_IDS) NPCS[npc].errands.forEach((e) => Object.assign(e, { npc, errand: true }));
export const ERRANDS_BY_ID = Object.fromEntries(NPC_IDS.flatMap((npc) => NPCS[npc].errands.map((e) => [e.id, e])));

// ---------- Where you stand with a neighbour ----------
// state, per neighbour: { met, done: [mission ids], since: { mission id:
// { deed: count when it was asked } }, heard: [mission ids they've asked],
// points (friendship), chatDay (the game day you last chatted), seen: [what
// they have told you that counts once: shared/talk.js], chose: { what you
// answered when asked: shared/talk.js } }. deeds: how many times each deed
// has been done, all told.

// errand: the errand they asked of you, { day, id, since: { deed: count } }, or
// null; errandDay: the game day you last ran one for them; errands: how many
// you have run for them, all told.
export const freshNpcState = () => ({ met: false, done: [], heard: [], since: {}, points: 0, chatDay: -1, seen: [], chose: {}, errand: null, errandDay: -1, errands: 0 });

// What a deed is counted under: 'pet', or 'tell:mabel' (telling Mabel)
export const deedKey = (need) => (need.who ? `${need.deed}:${need.who}` : need.deed);

// Their mission now (the first not done), or null: all done
export function currentMission(npc, state) {
  return NPCS[npc].missions.find((m) => !state.done.includes(m.id)) ?? null;
}

// Is shelf (a shelf's title, or 'shop') open to you at their shop?
export const isOpen = (npc, state, shelf = 'shop') => !shelfLock(npc, state, shelf);

// Why shelf (a title, or 'shop') isn't open to you yet, in words ('': it is)
export function shelfLock(npc, state, shelf = 'shop') {
  const { shop, missions } = NPCS[npc];
  if (!state.done.includes(shop.opensWith)) return 'Not open to you yet';
  if (shelf === 'shop') return '';
  const { after, hearts } = shop.shelves.find((s) => s.title === shelf) ?? {};
  if (after && !state.done.includes(after)) return `After “${missions.find((m) => m.id === after)?.title}”`;
  if (hearts && heartsFor(state.points, FRIENDSHIP) < hearts) return `At ${'♥'.repeat(hearts)}`;
  return '';
}

// ---------- Errands ----------
// Their requests all done?
export const chainDone = (npc, state) => !currentMission(npc, state);

// The errand they have for you on game day `day` (the same for everyone, all
// day, and another the next): one of their `errands`
export function errandFor(npc, day) {
  const { errands } = NPCS[npc];
  return errands[(((Math.floor(day) + NPC_IDS.indexOf(npc) * 3) % errands.length) + errands.length) % errands.length];
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
    const picks = g.choose.map((c) => c.label[0].toLowerCase() + c.label.slice(1)); // ("A cow" -> "a cow")
    parts.push(`your pick of ${picks.length > 1 ? `${picks.slice(0, -1).join(', ')} or ${picks.at(-1)}` : picks[0]}`);
  }
  return speech && parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join(', ');
}

// The hearts for so many points (FRIENDSHIP: points a heart, the most hearts)
export const heartsFor = (points, { perHeart, hearts }) => Math.min(hearts, Math.floor(points / perHeart));
