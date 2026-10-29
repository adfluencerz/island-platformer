// What you can say to a neighbour, and what they say back (src/dialog.js has
// the window; shared/npcs.js their requests, shops and small talk). Plain
// data, and the rules for it, so a test can check them.
//
// A conversation is a tree of nodes. Each neighbour has a list of `topics`,
// the things you can ask them about in their Chat menu; a topic's `then` is
// what you can say next, and so on down:
//
//   { id, text, say, then, if, event, points, gives, keep }
//
//   id      only the top ones need one (the others are named by where they
//           are in the tree): it is what is saved
//   text    what you say, on the button
//   say     what they answer: a line, a few to pick from, or a function of the
//           view (see `holds`) for one that remembers what you said before
//   then    what you can say next (nothing: they are done, and you are back
//           at the list)
//   if      when it is there at all (`holds`)
//   event   a moment of theirs rather than something to ask about: it waits
//           in the window's list, starred, until you have shared it by
//           answering (a `then` with a `keep`). It then counts once: hearts
//           (FRIENDSHIP.moment), and `gives`
//   points  hearts for hearing it the first time (a topic: FRIENDSHIP.topic)
//   gives   { gold, items: [[item, count]] }, the first time
//   keep    [key, answer]: they remember you answering that (`chose` in `if`
//           and in a view)
//
// The window's first list (`hubOptions`) is made of what is on between you
// and them just now: a message to tell them, their request, a moment of
// theirs waiting, and the Chat menu.
import { NPC_IDS, NPCS, freshNpcState } from './npcs.js';
import { FRIENDSHIP } from './balance.js';

// ---------- When something is there ----------
// A view `c` of where you stand with this neighbour: { hearts, done(mission),
// heard(mission), met(neighbour), chose(key) }. A condition, all of:
//   hearts: n         they like you this much
//   done / heard: m   (one or a list) those requests are done / asked
//   met: id           (one or a list) you have met them
//   chose: [key, a]   you answered a that time
//   any: [cond, ...]  one of those
//   no: cond          not that
export function holds(cond, c) {
  if (!cond) return true;
  if (cond.hearts != null && c.hearts < cond.hearts) return false;
  if ([].concat(cond.done ?? []).some((m) => !c.done(m))) return false;
  if ([].concat(cond.heard ?? []).some((m) => !c.heard(m))) return false;
  if ([].concat(cond.met ?? []).some((n) => !c.met(n))) return false;
  if (cond.chose && c.chose(cond.chose[0]) !== cond.chose[1]) return false;
  if (cond.any && !cond.any.some((one) => holds(one, c))) return false;
  if (cond.no && holds(cond.no, c)) return false;
  return true;
}

// What they say for a node (pick(list): which of a few lines, for a test to say)
export function textOf(node, c, pick = (list) => list[Math.floor(Math.random() * list.length)]) {
  const say = typeof node.say === 'function' ? node.say(c) : node.say;
  return Array.isArray(say) ? pick(say) : say;
}

// ---------- Rosa ----------
const CALVES = { buttercup: 'Buttercup', clementine: 'Little Clementine', beefcake: 'Beefcake' };
const ROSA = [
  {
    id: 'ranch',
    text: 'How\'s the ranch?',
    say: (c) => (c.chose('rosa_calf')
      ? `Busy, busy! Hens to feed, cows to milk, and every one of them with opinions. And ${CALVES[c.chose('rosa_calf')]} is growing like a weed. I wouldn't swap it for the world.`
      : 'Busy, busy! Hens to feed, cows to milk, and every one of them with opinions. I wouldn\'t swap it for the world.'),
    then: [
      { text: 'What\'s the hardest part?', say: 'Mornings! The cows don\'t care that it\'s still dark. They want milking when they want milking, and not a minute later.' },
      { text: 'Can I help?', say: 'You already do, love. Pet your animals every day and they\'ll repay you in eggs, milk and wool. Happy animals give more.' },
    ],
  },
  {
    id: 'animals',
    text: 'Any tips for looking after animals?',
    say: 'Pet them once a day: it keeps them happy, and happy ones give more. And when a little picture floats over a cow or a sheep, she\'s ready to be milked or sheared.',
    then: [
      { text: 'How do I get more eggs and milk?', say: 'Bigger pens! The workbench can upgrade them. A better coop means big eggs, and a barn in the pasture means a cow or a sheep gives two at once, every time.' },
      { text: 'Do they ever get bored?', say: 'Hens? Never. Cows? Constantly. Sheep? Too busy being clever. Give them room and some company, and they\'re happy.' },
    ],
  },
  {
    id: 'clementine',
    text: 'Tell me about Clementine.',
    if: { hearts: 1 },
    say: 'Clementine! Proudest hen in the valley. She hatched from the very first egg I ever set, and she\'s run the place ever since. Don\'t tell the cows.',
    then: [
      { text: 'Does she really run the place?', say: 'She\'s never missed a morning inspection! Struts up and down the yard, checking every nest. The other hens would follow her off a cliff.' },
      { text: 'Is she here?', say: 'In the house, in her basket by the fire. She won\'t sleep anywhere else. Have a look when you pop in.' },
    ],
  },
  {
    id: 'others',
    text: 'What are the others like?',
    if: { any: [{ met: 'basil' }, { met: 'finn' }, { met: 'mabel' }, { met: 'bram' }] },
    say: 'Oh, I could talk all day. Who do you want to hear about?',
    then: [
      { text: 'Basil?', if: { met: 'basil' }, say: 'Dear man. Forgets his own hat, mind. Marigold kept him in order, and now I send him eggs and he sends me sunflower heads for the hens. It works.' },
      { text: 'Finn?', if: { met: 'finn' }, say: 'A big child with a beard. His stories get taller, but the fish don\'t. Still, there\'s no one I\'d rather have on the end of a rope in a storm.' },
      { text: 'Mabel?', if: { met: 'mabel' }, say: 'Mabel! My oldest friend in the valley. Her honey cake could end wars. She knows everything about everyone, so mind what you say.' },
      { text: 'Bram?', if: { met: 'bram' }, say: 'Grumbles like a gate in the wind, and fixes my coop every single week without being asked. Don\'t let him fool you, love. Soft as butter.' },
    ],
  },
  {
    id: 'fair',
    text: 'How did the fair go?',
    if: { done: 'rosa_fair' },
    say: 'Joint first prize! My cheese and Mabel\'s honey cake, and we agreed that was only fair. Fair! Ha!',
    then: [
      { text: 'Will there be another?', say: 'Every year, love. And next time you\'ll be on a stall with us.' },
    ],
  },
  {
    id: 'rosa_first',
    event: true,
    text: 'You look lost in thought, Rosa.',
    if: { hearts: 2 },
    gives: { gold: 80 },
    say: 'Oh! Sorry, love. I was remembering my first day at the ranch. The roof leaked, a cow kicked the bucket, and the hens all flew the coop. I thought: what have I done? Do you ever feel like that, on your farm?',
    then: [
      { text: 'All the time!', keep: ['rosa_first', 'honest'], say: 'Ha! Then you\'re doing it right. Everyone\'s scared that first year. It passes, I promise.' },
      { text: 'Never. It\'s perfect.', keep: ['rosa_first', 'proud'], say: 'Good for you! Hold on to that feeling. It slips away sometimes, but it always comes back.' },
      { text: 'I\'m still working out where to put things.', keep: ['rosa_first', 'practical'], say: 'A sensible answer! Put the water near the pens and the hay near the water. And everything else near the kettle.' },
    ],
  },
  {
    id: 'rosa_calf',
    event: true,
    text: 'What are you writing, Rosa?',
    if: { hearts: 4 },
    gives: { items: [['cheese', 1]] },
    say: 'A name! My best cow is due a calf, and I can\'t decide what to call her. Everyone in the valley has an opinion. What would you pick?',
    then: [
      { text: 'Buttercup.', keep: ['rosa_calf', 'buttercup'], say: 'Buttercup! Classic, and she\'ll look just like one. Done.' },
      { text: 'Clementine the Second.', keep: ['rosa_calf', 'clementine'], say: 'Little Clementine? The hen will be insufferable. Done!' },
      { text: 'Beefcake.', keep: ['rosa_calf', 'beefcake'], say: 'Beefcake! She\'s a girl, but she\'ll grow into it. Done!' },
    ],
  },
];

// ---------- Basil ----------
const BASIL = [
  {
    id: 'garden',
    text: 'How\'s the garden?',
    say: 'Slow, but steady. Gardens don\'t care for hurrying. I talk to the tomatoes in the morning. They\'re the shyest.',
    then: [
      { text: 'Do plants really listen?', say: 'Of course not. But I do, and that\'s what matters. A gardener who talks to his plants notices when they\'re thirsty.' },
      { text: 'What grows best?', say: 'Whatever you give your attention. Turnips forgive anything, tomatoes forgive nothing, and pumpkins just want room.' },
    ],
  },
  {
    id: 'growing',
    text: 'Any tips for growing things?',
    say: 'Water them. A watered crop grows twice as fast, and rain does the same job for free. And plant a little every day, so there\'s always something coming up.',
    then: [
      { text: 'And the weather?', say: 'The weather\'s part of the garden. On a wet day I put my feet up: the rain does the watering. Winter\'s for planning and for tea.' },
      { text: 'What\'s a golden seed?', say: 'A seed from the old days. Plant one and you grow a golden turnip. Don\'t eat it, and don\'t sell it for less than it\'s worth.' },
    ],
  },
  {
    id: 'marigold',
    text: 'Tell me about Marigold.',
    if: { hearts: 1 },
    say: (c) => (c.chose('basil_plant') === 'sunflower'
      ? 'My Marigold. She planted the sunflower field forty years ago. And now there are sunflowers by her picture, too, facing the window. She\'d have liked you.'
      : 'My Marigold. She planted the sunflower field forty years ago, and every summer it comes back brighter. She\'d have liked you.'),
    then: [
      { text: 'How did you meet?', say: 'She threw a turnip at me. I was standing in the wrong place at a village fair. Forty-one years we were married. She never did say sorry.' },
      { text: 'Do you miss her?', say: 'Every day, young one. But the garden keeps her close. I see her in the sunflowers, and I hear her laugh in the bluebells.' },
    ],
  },
  {
    id: 'others',
    text: 'What are the others like?',
    if: { any: [{ met: 'rosa' }, { met: 'finn' }, { met: 'mabel' }, { met: 'bram' }] },
    say: 'Oh, I don\'t like to gossip. Well. A little. Who?',
    then: [
      { text: 'Rosa?', if: { met: 'rosa' }, say: 'A force of nature. She brings me manure for the beds: the best present a gardener can get, believe it or not.' },
      { text: 'Finn?', if: { met: 'finn' }, say: 'Finn brings me seaweed for the compost. Smells of the sea, and the beds adore it. He never stays for tea, mind. Says the land makes him dizzy.' },
      { text: 'Mabel?', if: { met: 'mabel' }, say: 'Mabel makes a pumpkin soup that would bring a scarecrow to tears. I leave her courgettes, to say thank you. She never says a word.' },
      { text: 'Bram?', if: { met: 'bram' }, say: 'Bram built my greenhouse, for Marigold, the spring we married. He pretends he doesn\'t remember. He remembers.' },
    ],
  },
  {
    id: 'bluebells',
    text: 'About those bluebells...',
    if: { done: 'basil_bluebells' },
    say: 'I put them by Marigold\'s picture. They lasted a week, and for that week the whole cottage smelled of the glade. Thank you.',
    then: [
      { text: 'May I see the picture?', say: 'Come inside: it\'s on the wall by the window. She\'s laughing in it. She was always laughing, even when I told her not to.' },
    ],
  },
  {
    id: 'basil_picture',
    event: true,
    text: 'That\'s a lovely picture, Basil.',
    if: { hearts: 2 },
    gives: { items: [['sunflower_seeds', 3]] },
    say: 'Ah. Marigold. It was taken on our wedding day, in the glade. Would you like to hear about it?',
    then: [
      { text: 'I\'d love to.', keep: ['basil_picture', 'listen'], say: 'We were late. Her hat blew into the stream and I waded in after it, in my wedding boots. She laughed so much the photographer gave up. I still have the hat.' },
      { text: 'Only if you want to tell it.', keep: ['basil_picture', 'gentle'], say: 'That\'s kind of you, young one. Some days I tell it and some days I don\'t. Today, a little: she laughed so much that day. That\'s all, and it\'s enough.' },
    ],
  },
  {
    id: 'basil_plant',
    event: true,
    text: 'You look like you\'re planning something, Basil.',
    if: { hearts: 4 },
    gives: { items: [['sunflower_seeds', 5]] },
    say: 'I\'ve a bare corner by the window, and I can\'t think what to put in it. Something for Marigold. What would you plant?',
    then: [
      { text: 'Sunflowers.', keep: ['basil_plant', 'sunflower'], say: 'Sunflowers! Of course. Her favourites. They\'ll face the sun, and her picture will always have light.' },
      { text: 'Bluebells.', keep: ['basil_plant', 'bluebell'], say: 'Bluebells, for the glade. Yes. A little piece of it, by the window.' },
      { text: 'Something new.', keep: ['basil_plant', 'new'], say: 'Something new... yes. She always said a garden that stops growing stops living. I\'ll find a seed.' },
    ],
  },
];

// ---------- Finn ----------
const FINN = [
  {
    id: 'sea',
    text: 'How\'s the sea today?',
    say: 'Moody, matey. She\'s always moody. That\'s why I love her. Flat as a plate at dawn, and by supper she\'s throwing a tantrum.',
    then: [
      { text: 'Is it dangerous?', say: 'Only if ye\'re daft. Respect her, stay near the dock, and never fish a storm. Well. Not twice.' },
      { text: 'What\'s out there?', say: 'Sardines, herring, mackerel, sea bass... and past the bass, things with teeth. Pufferfish, moonfish, tuna. A good rod gets ye the big ones.' },
    ],
  },
  {
    id: 'fishing',
    text: 'Any fishing tips?',
    say: 'Face the water with a rod in hand and cast. When the bobber dips, strike quick! The rare ones don\'t hang about. And bait gets ye a bite sooner.',
    then: [
      { text: 'What bites at night?', say: 'Lanternfish at dusk, and moonfish when the night\'s deep. Both off me dock, and both worth the lost sleep.' },
      { text: 'What about a better rod?', say: 'A sturdy rod gets ye the rarer fish. I sell one, once I\'ve seen ye land a few. And a golden rod is a sturdy one, made better, at yer workbench.' },
    ],
  },
  {
    id: 'swordfish',
    text: 'Tell me about the swordfish.',
    if: { hearts: 1 },
    say: (c) => (c.chose('finn_tale') === 'believe'
      ? 'Ha! Ye know the one! Three days I wrestled that swordfish. Bigger than me boat. Lost me hat, kept me dignity. And ye\'re the only soul who believes me.'
      : 'Ha! Three days I wrestled that swordfish. Bigger than me boat, it was. Lost me hat. Kept me dignity. Mostly.'),
    then: [
      { text: 'Is that really true?', say: 'True as the tide! Well. It might have been a mackerel. A big one. A very big mackerel.' },
      { text: 'What happened to the hat?', say: 'Still down there, matey. Some crab\'s wearing it by now. Suits him.' },
    ],
  },
  {
    id: 'others',
    text: 'What are the others like?',
    if: { any: [{ met: 'rosa' }, { met: 'basil' }, { met: 'mabel' }, { met: 'bram' }] },
    say: 'The valley folk? Landlubbers, the lot, but good ones. Who d\'ye want to hear about?',
    then: [
      { text: 'Rosa?', if: { met: 'rosa' }, say: 'Salt of the earth. Always on at me to eat vegetables. I eat seaweed. That\'s a vegetable. She disagrees.' },
      { text: 'Basil?', if: { met: 'basil' }, say: 'Gentle as a lamb. Me seaweed makes his beds grow like mad, and he thinks it\'s magic. I let him.' },
      { text: 'Mabel?', if: { met: 'mabel' }, say: 'Her fish stew is the reason I come ashore. Don\'t tell her, but I tell everyone it\'s the sea air that makes it so good.' },
      { text: 'Bram?', if: { met: 'bram' }, say: 'Built me first dock, and me boat, and he\'s never once been out on the water. Says wood belongs on land. Daft as a brush, and the best hands in the valley.' },
    ],
  },
  {
    id: 'missus',
    text: 'How did you meet your wife?',
    if: { done: 'finn_shells' },
    say: 'She came down to the dunes one morning, collecting shells, while I was mending a net. She asked if I\'d caught anything. I said, "Only you." Terrible line. She married me anyway.',
    then: [
      { text: 'What does she do with the shells?', say: 'Wind chimes, mostly. She\'s hung one on every door in the valley. Listen next time the wind blows.' },
    ],
  },
  {
    id: 'finn_tale',
    event: true,
    text: 'You\'ve a look in your eye, Finn.',
    if: { hearts: 2 },
    gives: { items: [['lure', 2]] },
    say: 'Did I tell ye about the swordfish? Three days, matey! And it was this big. No, bigger. Do ye believe me?',
    then: [
      { text: 'Every word!', keep: ['finn_tale', 'believe'], say: 'A true friend! Nobody believes me. Not even the missus. Here, a lure for yer faith.' },
      { text: 'Maybe it was a big mackerel...', keep: ['finn_tale', 'tease'], say: 'Ha! Cheeky! That\'s what Rosa says. Ye\'ve a sharp tongue, matey, and I like it.' },
      { text: 'Be honest, Finn.', keep: ['finn_tale', 'honest'], say: 'Hm. Maybe it was a very big tuna. And maybe it was two days. Don\'t tell a soul.' },
    ],
  },
  {
    id: 'finn_map',
    event: true,
    text: 'What\'s that you\'re holding, Finn?',
    if: { hearts: 4 },
    gives: { items: [['lure', 3]] },
    say: 'An old chart. Me father drew it. There\'s a cross past the dock, and he always swore there was a chest down there. I never found it, and I\'m too old to keep on trying. Would ye?',
    then: [
      { text: 'I\'ll look for it.', keep: ['finn_map', 'seek'], say: 'That\'s the spirit! Keep fishing the sea off me dock. She gives up a chest now and then, to those who stay patient.' },
      { text: 'Maybe it\'s better left lost.', keep: ['finn_map', 'leave'], say: 'Ha! Wise, matey. A treasure ye never find is a treasure ye never lose.' },
    ],
  },
];

// ---------- Mabel ----------
const MABEL = [
  {
    id: 'bakery',
    text: 'What are you baking today?',
    say: (c) => (c.chose('mabel_taste') === 'sugar'
      ? 'Honey cake, bread, a few tarts. And my berry tart has a touch more sugar now, thanks to you, dear. The kitchen decides: I only do what it says.'
      : 'Honey cake, bread, a few tarts, and whatever else wanders in. The kitchen decides, dear. I only do what it says.'),
    then: [
      { text: 'What\'s your best seller?', say: 'Honey cake! It\'s Rosa\'s fault. She told the whole valley, and now they queue at dawn.' },
      { text: 'Can I smell the bread?', say: 'Of course, love. That\'s the whole point of leaving the door open.' },
    ],
  },
  {
    id: 'cooking',
    text: 'Any cooking tips?',
    say: 'A good meal gives you a good boost. A campfire dish is quick, but the kitchen in your house does it better, and for longer.',
    then: [
      { text: 'What should I cook first?', say: 'Pancakes, dear. An egg, some milk and a spoon of honey. Even a burnt pancake gives you a spring in your step.' },
      { text: 'How do I learn more recipes?', say: 'Buy them from my shelf, dear, or find old recipe cards. They turn up on the wild islands, out in the lobbies. Some of the best recipes ever written!' },
    ],
  },
  {
    id: 'gran',
    text: 'Tell me about your gran.',
    if: { hearts: 1 },
    say: 'My gran! She taught me everything. Flour to her elbows, and a wooden spoon for every occasion. Her recipe cards are scattered all over the wild islands, I\'m told.',
    then: [
      { text: 'Scattered?', say: 'She wrote them down and gave them to friends. Her friends gave them to sailors. The sailors... well. Some turn up in the oddest places.' },
      { text: 'Which was her best?', say: 'Her mushroom pie! Cold butter and a warm heart, she\'d say. Mostly the butter.' },
    ],
  },
  {
    id: 'others',
    text: 'What are the others like?',
    if: { any: [{ met: 'rosa' }, { met: 'basil' }, { met: 'finn' }, { met: 'bram' }] },
    say: 'Oh, I know everybody\'s business, dear, it comes with the ovens. Who shall it be?',
    then: [
      { text: 'Rosa?', if: { met: 'rosa' }, say: 'My oldest friend! We\'ve shared a stall at the fair for twenty years. She brings the cheese, I bring the cake, and we eat half of it before we sell it.' },
      { text: 'Basil?', if: { met: 'basil' }, say: 'Basil leaves courgettes on my doorstep. Every week! I can\'t tell him I\'m drowning in courgettes, he\'d be heartbroken. Sweet man.' },
      { text: 'Finn?', if: { met: 'finn' }, say: 'I put extra pepper in his stew. He thinks it\'s the sea air. I\'ve never had the heart to tell him.' },
      { text: 'Bram?', if: { met: 'bram' }, say: 'Bram made every shelf in this bakery, dear, and he won\'t take a penny. So I leave a pie on his bench every Friday, and he pretends he doesn\'t know who.' },
    ],
  },
  {
    id: 'secrets',
    text: 'Why are your recipes so secret?',
    if: { done: 'mabel_mushrooms' },
    say: 'Secret? Oh, dear, they\'re not secret, just precious. And a tiny bit secret. But I\'d rather they were cooked than kept, so here we are.',
  },
  {
    id: 'mabel_why',
    event: true,
    text: 'You look happy today, Mabel.',
    if: { hearts: 2 },
    gives: { items: [['honey', 1]] },
    say: 'Do you know, dear, I was just wondering why I bake. Thirty years, every single day, and I never tire of it. Why do you think that is?',
    then: [
      { text: 'Because you love it.', keep: ['mabel_why', 'love'], say: 'Oh, you\'re sweet. Yes, I do. Though some mornings I love my bed a little more.' },
      { text: 'For the gossip!', keep: ['mabel_why', 'gossip'], say: 'Ha! Guilty! Where else would I hear everyone\'s business? Don\'t tell a soul I said so.' },
      { text: 'To feed people.', keep: ['mabel_why', 'feed'], say: 'That\'s it, dear. That\'s all of it. A full belly and a warm kitchen: nothing\'s wrong that a pie can\'t ease.' },
    ],
  },
  {
    id: 'mabel_taste',
    event: true,
    text: 'Is that a new tart, Mabel?',
    if: { hearts: 4 },
    gives: { items: [['pancakes', 2]] },
    say: 'It is! Berry and honey, and a pinch of something. Taste it and tell me what you think, dear. Honestly!',
    then: [
      { text: 'Perfect. Don\'t change a thing.', keep: ['mabel_taste', 'perfect'], say: 'Oh, you\'re a kind liar! But I\'ll take it.' },
      { text: 'A touch more sugar?', keep: ['mabel_taste', 'sugar'], say: 'More sugar! My gran said that, and she was right. You have a baker\'s tongue.' },
      { text: 'Is it meant to be on fire?', keep: ['mabel_taste', 'fire'], say: 'On... oh! Quick, the oven! Thank you, dear! Another minute and... well. You saved the batch.' },
    ],
  },
];

// ---------- Bram ----------
const BRAM = [
  {
    id: 'workshop',
    text: 'What are you working on?',
    say: (c) => (c.chose('bram_sign') === 'joinery'
      ? 'A chair. It\'s always a chair. And a sign for over the door, now, the plain one you said. Bram\'s Joinery. No fuss.'
      : 'A chair. It\'s always a chair. Everybody in this valley sits on something I made and none of them notice. That\'s how you know it\'s good.'),
    then: [
      { text: 'Why chairs?', say: 'A chair is honest. Four legs, a seat, a back. Get one wrong and you\'re on the floor. Wood doesn\'t lie.' },
      { text: 'Can I watch?', say: 'You can sweep. Watching\'s for people who don\'t sweep.' },
    ],
  },
  {
    id: 'wood',
    text: 'Any tips for building?',
    say: 'Upgrade your workbench. A bigger bench makes better tools: silver, then gold. Better tools fell trees and break rocks quicker. Quicker means more timber. More timber means bigger pens. It all goes round.',
    then: [
      { text: 'What does the bench need?', say: 'Gold, timber and stone. And for the top, gems, and hands that know an axe and a pickaxe. I don\'t put a top bench in for anybody.' },
      { text: 'And the pens?', say: 'Rosa will tell you animals need room. She\'s right, don\'t tell her I said so. I\'ll put your fences out when you\'re ready for it.' },
    ],
  },
  {
    id: 'houses',
    text: 'You built all the houses?',
    if: { done: 'bram_bench' },
    say: 'Every one. Rosa\'s porch, Basil\'s greenhouse, Mabel\'s shelves, Finn\'s first dock. The sea had the dock. I don\'t talk about the dock.',
    then: [
      { text: 'Which is your favourite?', say: 'Basil\'s greenhouse. Built it for Marigold. Every pane by hand. He still keeps it spotless. That\'s the best thanks there is.' },
      { text: 'And your own?', say: 'Mine leaks. A joiner\'s roof always leaks. No time to fix your own.' },
    ],
  },
  {
    id: 'apprentice',
    text: 'Did you ever have an apprentice?',
    if: { hearts: 1 },
    say: 'One. Good hands. Went to the city. Said the valley was too quiet. It is too quiet. That\'s the point of it.',
    then: [
      { text: 'Do you miss them?', say: 'Hm. I kept their stool. Don\'t read anything into it.' },
      { text: 'Am I your apprentice now?', say: 'You\'re a farmer who borrows my plans. Ask me again when you\'ve built a barn.' },
    ],
  },
  {
    id: 'others',
    text: 'What are the others like?',
    if: { any: [{ met: 'rosa' }, { met: 'basil' }, { met: 'finn' }, { met: 'mabel' }] },
    say: 'I\'ve fixed all their doors. You learn a lot about people from how they shut a door.',
    then: [
      { text: 'Rosa?', if: { met: 'rosa' }, say: 'Slams it. Every time. Big heart, strong arms, no patience for hinges.' },
      { text: 'Basil?', if: { met: 'basil' }, say: 'Leaves it open, for the bees. Never shuts it. Never will.' },
      { text: 'Finn?', if: { met: 'finn' }, say: 'Hasn\'t got one. Hangs a sail over the gap. Says doors are for landlubbers.' },
      { text: 'Mabel?', if: { met: 'mabel' }, say: 'Props it with a loaf so the smell gets out. Clever. Annoying. Clever.' },
    ],
  },
  {
    id: 'bram_chair',
    event: true,
    text: 'Two chairs, Bram?',
    if: { hearts: 2 },
    gives: { items: [['steel', 3]] },
    say: 'Same wood, same plans, two chairs. One of them\'s better. I can\'t tell which. Sit in both and tell me. Honestly, mind.',
    then: [
      { text: 'The left one.', keep: ['bram_chair', 'left'], say: 'The left. I thought so. I shaved the back a hair thinner. Nobody else would ever notice. You did.' },
      { text: 'The right one.', keep: ['bram_chair', 'right'], say: 'The right. Hm. That\'s the one I made first, before I got clever. Maybe I shouldn\'t get clever.' },
      { text: 'They\'re the same.', keep: ['bram_chair', 'same'], say: 'They are not. But you\'re honest about it, and that\'s worth more than an eye for chairs.' },
    ],
  },
  {
    id: 'bram_sign',
    event: true,
    text: 'Carving something, Bram?',
    if: { hearts: 4 },
    gives: { items: [['arrow', 10]] },
    say: 'A new sign, for over the door. Forty years with no sign. Everybody knows where I am. But Mabel says a proper business has a sign. What should it say?',
    then: [
      { text: '"Bram\'s Joinery". Keep it plain.', keep: ['bram_sign', 'joinery'], say: 'Plain. Good. Plain lasts.' },
      { text: '"Measure twice".', keep: ['bram_sign', 'measure'], say: 'Ha. Yes. And underneath, smaller: "then again". I\'ll carve it tonight.' },
      { text: '"Mind the shavings".', keep: ['bram_sign', 'shavings'], say: 'That\'s all I ever say, isn\'t it. Fine. Fine. It\'s true.' },
    ],
  },
];

export const TALK = {
  rosa: { topics: ROSA },
  basil: { topics: BASIL },
  finn: { topics: FINN },
  mabel: { topics: MABEL },
  bram: { topics: BRAM },
};

// Each node knows whose it is, where it hangs (`parent`, and the `root` topic
// above it) and its name
for (const npc of NPC_IDS) {
  const walk = (nodes, parent, root) => nodes.forEach((node, i) => {
    node.npc = npc;
    node.parent = parent;
    node.root = root ?? node;
    node.id ??= `${parent.id}.${i + 1}`;
    // what counts once: a topic of theirs, or anything that says so
    node.track = !parent || node.points != null || !!node.gives;
    walk(node.then ?? [], node, node.root);
  });
  walk(TALK[npc].topics, null, null);
}

// Every node of a neighbour's, by id
export function nodesOf(npc) {
  const all = {};
  const walk = (nodes) => nodes.forEach((node) => ((all[node.id] = node), walk(node.then ?? [])));
  walk(TALK[npc].topics);
  return all;
}

// A neighbour's state as it comes from a save (anything at all, maybe from a
// version before there was so much to say): only what this game knows, or
// nothing met yet
export function cleanState(id, saved) {
  const fresh = freshNpcState();
  if (!saved || typeof saved !== 'object') return fresh;
  const missions = new Set(NPCS[id].missions.map((m) => m.id));
  const list = (v) => (Array.isArray(v) ? v.filter((m) => missions.has(m)) : []);
  const nodes = nodesOf(id);
  const answers = new Set(Object.values(nodes).filter((n) => n.keep).map((n) => n.keep.join(':')));
  const plain = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : []);
  return {
    met: !!saved.met,
    done: list(saved.done),
    heard: list(saved.heard),
    since: Object.fromEntries(plain(saved.since).filter(([m, d]) => missions.has(m) && d && typeof d === 'object')),
    points: Number.isFinite(saved.points) ? Math.max(0, saved.points) : 0,
    chatDay: Number.isFinite(saved.chatDay) ? saved.chatDay : -1,
    seen: Array.isArray(saved.seen) ? [...new Set(saved.seen.filter((n) => typeof n === 'string' && nodes[n]))] : [],
    chose: Object.fromEntries(plain(saved.chose).filter(([key, answer]) => answers.has(`${key}:${answer}`))),
    errand: cleanErrand(id, saved.errand),
    errandDay: Number.isFinite(saved.errandDay) ? saved.errandDay : -1,
    errands: Number.isInteger(saved.errands) && saved.errands > 0 ? saved.errands : 0,
  };
}

// The errand they asked of you as saved, or null: one of theirs, on a day
const cleanErrand = (id, e) => (e && typeof e === 'object' && NPCS[id].errands.some((x) => x.id === e.id) && Number.isFinite(e.day)
  ? { day: e.day, id: e.id, since: e.since && typeof e.since === 'object' && !Array.isArray(e.since) ? e.since : {} }
  : null);

// ---------- What there is to say ----------
// The topics of their Chat menu that are open to you: [{ node, isNew }], the
// ones you haven't heard first. (A moment of theirs you haven't shared is
// waiting in the window's first list, not here.)
export function chatTopics(npc, state, c) {
  const open = TALK[npc].topics.filter((t) => holds(t.if, c) && (!t.event || state.seen.includes(t.id)));
  const topics = open.map((node) => ({ node, isNew: !state.seen.includes(node.id) }));
  return [...topics.filter((t) => t.isNew), ...topics.filter((t) => !t.isNew)];
}

// Their moments you can share now and haven't
export const momentsDue = (npc, state, c) => TALK[npc].topics.filter((t) => t.event && !state.seen.includes(t.id) && holds(t.if, c));

// What you can say next after node
export const followUps = (node, c) => (node.then ?? []).filter((n) => holds(n.if, c));

// What hearing node first gives: { points, gives } or null (nothing, or not
// the first time), without changing anything
export function rewardFor(node, state) {
  if (node.root.event) {
    // a moment counts once, when you answer it
    return node.keep && !state.seen.includes(node.root.id) ? { points: FRIENDSHIP.moment, gives: node.root.gives } : null;
  }
  if (!node.track || state.seen.includes(node.id)) return null;
  return { points: node.points ?? (node.parent ? 0 : FRIENDSHIP.topic), gives: node.gives };
}

// Hear node: remembered, and the reward (rewardFor) counted as had
export function hear(node, state) {
  const reward = rewardFor(node, state);
  if (node.keep) state.chose[node.keep[0]] = node.keep[1];
  if (reward) state.seen.push(node.root.event ? node.root.id : node.id);
  return reward;
}

// ---------- The window's first list ----------
// What is on between you and them, most pressing first: [{ kind, text, hot,
// ...}] (`hot`: they're waiting on you). `view`: { npc, state, c, status
// (src/npcs.js: their request now), messages (shared/npcs.js: what you carry
// to them) }
export function hubOptions({ npc, state, c, status, messages }) {
  const options = [];
  for (const { from, mission } of messages) {
    options.push({ kind: 'deliver', from, mission, text: `Tell ${NPCS[npc].name}: "${mission.message.say}"`, hot: true });
  }
  if (status.mission) {
    // (once their requests are all done, an errand a day)
    const [ask, ready, progress] = status.errand
      ? ['Anything you need doing today?', 'I\'ve done your errand.', 'What was today\'s errand again?']
      : ['Is there anything I can do for you?', 'I\'ve brought what you asked for.', 'How are things with your request?'];
    if (!status.heard) options.push({ kind: 'ask', text: ask, hot: true });
    else if (status.ready) options.push({ kind: 'handover', text: ready, hot: true });
    else options.push({ kind: 'progress', text: progress });
  }
  for (const node of momentsDue(npc, state, c)) options.push({ kind: 'moment', node, text: node.text, hot: true });
  options.push({ kind: 'chat', text: 'Can we chat?' });
  return options;
}
