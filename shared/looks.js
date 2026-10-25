// What a farmer looks like and wears, past their shirt's color: picked in the
// menu's wardrobe (src/ui/wardrobe.js), kept with their account
// (server/farms.js farm.look), and drawn by src/character.js. The shirt's
// color stays the account's `color` (PLAYER_COLORS), which name tags, chat and
// the player list go by; the rest is here.
//
// Every part is one of a few choices: a style by its id, or a color from the
// part's own palette. That keeps a look small on the wire, lets the server
// check it (cleanLook), and lets a save outlive a choice that is taken away
// (it falls back to the default). Pure JS: runs in the page and on the server.

// The parts of a look, in the wardrobe's order. A style part lists its
// choices as [id, name]; a color part, its palette. `label` names a color
// part in the wardrobe (a hat's own word for it: hatColorLabel).
export const LOOK_PARTS = {
  hat: {
    styles: [
      ['straw', 'Straw hat'],
      ['sunhat', 'Sun hat'],
      ['cap', 'Cap'],
      ['flatcap', 'Flat cap'],
      ['beanie', 'Beanie'],
      ['cowboy', 'Cowboy hat'],
      ['souwester', 'Sou’wester'],
      ['bandana', 'Bandana'],
      ['flowers', 'Flower crown'],
      ['none', 'No hat'],
    ],
  },
  hatColor: { colors: [0xc0392b, 0xe0a422, 0x3f8a46, 0x2f6fb5, 0x7b4fa0, 0xff8fb8, 0xf2ede2, 0x6b4a2b, 0x2e2e36] },
  hair: {
    styles: [
      ['short', 'Short'],
      ['tousled', 'Tousled'],
      ['bob', 'Bob'],
      ['long', 'Long'],
      ['bun', 'Bun'],
      ['ponytail', 'Ponytail'],
      ['braids', 'Braids'],
      ['bald', 'Bald'],
    ],
  },
  hairColor: { colors: [0x2b2118, 0x5a3a22, 0x8a5a33, 0xdcb661, 0xc4622d, 0xbdb8b0, 0x5b7fd6, 0xe68fb6] },
  skin: { colors: [0xffdcbd, 0xffcc99, 0xe9b288, 0xc98e62, 0x9c6844, 0x6e4529] },
  face: {
    styles: [
      ['none', 'Plain'],
      ['freckles', 'Freckles'],
      ['glasses', 'Glasses'],
      ['shades', 'Shades'],
    ],
  },
  whiskers: {
    styles: [
      ['none', 'None'],
      ['mustache', 'Mustache'],
      ['beard', 'Beard'],
    ],
  },
  top: {
    styles: [
      ['shirt', 'Shirt'],
      ['tee', 'T-shirt'],
      ['plaid', 'Flannel'],
      ['stripes', 'Stripes'],
      ['sweater', 'Sweater'],
    ],
  },
  bottoms: {
    styles: [
      ['overalls', 'Overalls'],
      ['shortalls', 'Short overalls'],
      ['trousers', 'Trousers'],
      ['skirt', 'Skirt'],
    ],
  },
  bottomsColor: { colors: [0x3b5b92, 0x6f93c8, 0xb59a6a, 0x6b4a2b, 0x3f6b3a, 0x9c3a2e, 0x8a6fb8, 0x2e2e36] },
  apron: {
    styles: [
      ['none', 'No apron'],
      ['apron', 'Apron'],
    ],
  },
  apronColor: { colors: [0xf4efe4, 0x4f7a3a, 0xc0392b, 0x2f6fb5, 0xe0a422, 0xff8fb8, 0x6b4a2b, 0x2e2e36] },
  shoes: {
    styles: [
      ['boots', 'Boots'],
      ['wellies', 'Wellies'],
      ['sneakers', 'Sneakers'],
    ],
  },
  shoesColor: { colors: [0x4a2f1b, 0x8a5a2e, 0x2a2420, 0x3f6b3a, 0xe0b020, 0xc0392b, 0x2f6fb5, 0xf2ede2] },
  neck: {
    styles: [
      ['none', 'Nothing'],
      ['neckerchief', 'Neckerchief'],
      ['scarf', 'Scarf'],
    ],
  },
  neckColor: { colors: [0xc0392b, 0xe0a422, 0x3f8a46, 0x2f6fb5, 0x7b4fa0, 0xff8fb8, 0xf2ede2, 0x2e2e36] },
};

// The look every farmer had before there was a wardrobe (and has until they
// pick another): a straw hat with a red band, short brown hair, a plain
// shirt under denim overalls, and brown boots
export const DEFAULT_LOOK = Object.freeze({
  hat: 'straw',
  hatColor: 0xc0392b,
  hair: 'short',
  hairColor: 0x5a3a22,
  skin: 0xffcc99,
  face: 'none',
  whiskers: 'none',
  top: 'shirt',
  bottoms: 'overalls',
  bottomsColor: 0x3b5b92,
  apron: 'none',
  apronColor: 0xf4efe4,
  shoes: 'boots',
  shoesColor: 0x4a2f1b,
  neck: 'none',
  neckColor: 0xc0392b,
});

const isStyle = (part, v) => LOOK_PARTS[part].styles.some(([id]) => id === v);
const isColor = (part, v) => LOOK_PARTS[part].colors.includes(v);
const ok = (part, v) => (LOOK_PARTS[part].styles ? isStyle(part, v) : isColor(part, v));

// A look as it can be worn: every part one of its choices, whatever came in
// (nothing, a look from an older or newer page, or nonsense)
export function cleanLook(look) {
  const out = {};
  for (const part of Object.keys(LOOK_PARTS)) {
    const v = look && typeof look === 'object' ? look[part] : undefined;
    out[part] = ok(part, v) ? v : DEFAULT_LOOK[part];
  }
  return out;
}

export const sameLook = (a, b) => Object.keys(LOOK_PARTS).every((part) => a?.[part] === b?.[part]);

// What a hat's color colors: a straw hat's or a sun hat's band, a flower
// crown's flowers, the rest the hat itself
export const hatColorLabel = (hat) => (hat === 'straw' || hat === 'sunhat' ? 'Band' : hat === 'flowers' ? 'Flowers' : 'Color');

// Something new to wear: every part picked at random (rand: 0..1), the skin
// kept (that is who they are, not what they wear)
export function randomLook(rand = Math.random, keep = DEFAULT_LOOK) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const out = {};
  for (const [part, def] of Object.entries(LOOK_PARTS)) {
    out[part] = part === 'skin' ? keep.skin : def.styles ? pick(def.styles)[0] : pick(def.colors);
  }
  // (mostly clean-shaven, mostly without an apron, and mostly without glasses: they stand out more that way)
  if (rand() < 0.6) out.whiskers = 'none';
  if (rand() < 0.6) out.apron = 'none';
  if (rand() < 0.5) out.face = rand() < 0.5 ? 'none' : 'freckles';
  return cleanLook(out);
}
