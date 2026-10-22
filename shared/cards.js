// ---------- Playing cards ----------
// A deck of 52, and what poker hand some of them make: the arcade's
// blackjack and Lucky Hand (shared/arcade.js) and, in lobbies, the poker
// table play with these.
//
// A card is two characters, its rank and its suit: 'As' is the ace of
// spades, 'Th' the ten of hearts.

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc'; // spades, hearts, diamonds, clubs
export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const RED_SUITS = new Set(['h', 'd']);

// 2 to 14 (the ace is high, 14; straights may also count it as 1)
export const rankOf = (card) => RANKS.indexOf(card[0]) + 2;
export const suitOf = (card) => card[1];
// '10♥', 'A♠': how a card is written on screen
export const cardLabel = (card) => `${card[0] === 'T' ? '10' : card[0]}${SUIT_SYMBOLS[card[1]]}`;

// A fresh deck (decks: how many shuffled together, as in a blackjack shoe)
export function newDeck(decks = 1) {
  const deck = [];
  for (let i = 0; i < decks; i++) for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return deck;
}

// Shuffled in place, fairly (Fisher-Yates); rand: () => [0, 1)
export function shuffle(deck, rand = Math.random) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ---------- Poker hands ----------
// From worst to best; a hand's `cat` is its index here
export const HANDS = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
export const HAND = Object.fromEntries(['high', 'pair', 'twoPair', 'three', 'straight', 'flush', 'fullHouse', 'four', 'straightFlush'].map((k, i) => [k, i]));

// What hand 1 to 5 cards make: { cat, name, value, scoring }. A straight or
// a flush takes all five; fewer cards make pairs and the like (as in Lucky
// Hand, where a pair can be played on its own). scoring: the cards that
// make the hand (all five of a straight, a flush or a full house; the four
// of four of a kind; the highest card of a high card). value: higher beats
// lower, ties are split pots.
export function evaluate(cards) {
  const ranks = cards.map(rankOf);
  const byRank = new Map();
  for (const r of ranks) byRank.set(r, (byRank.get(r) ?? 0) + 1);
  // the ranks, most of a kind first, then highest first
  const groups = [...byRank].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const five = cards.length === 5;
  const flush = five && cards.every((c) => c[1] === cards[0][1]);
  let straightHigh = 0;
  if (five && byRank.size === 5) {
    const sorted = [...byRank.keys()].sort((a, b) => b - a);
    if (sorted[0] - sorted[4] === 4) straightHigh = sorted[0];
    else if (sorted.join() === '14,5,4,3,2') straightHigh = 5; // the wheel: the ace counts as 1
  }
  const [[topRank, top], [, second] = []] = groups;
  let cat;
  if (straightHigh && flush) cat = HAND.straightFlush;
  else if (top === 4) cat = HAND.four;
  else if (top === 3 && second >= 2) cat = HAND.fullHouse;
  else if (flush) cat = HAND.flush;
  else if (straightHigh) cat = HAND.straight;
  else if (top === 3) cat = HAND.three;
  else if (top === 2 && second === 2) cat = HAND.twoPair;
  else if (top === 2) cat = HAND.pair;
  else cat = HAND.high;

  // which cards count
  let scoring;
  if (cat === HAND.straightFlush || cat === HAND.fullHouse || cat === HAND.flush || cat === HAND.straight) scoring = [...cards];
  else if (cat === HAND.high) scoring = [cards[ranks.indexOf(topRank)]];
  else {
    const counted = new Set(groups.filter(([, n]) => n >= 2).map(([r]) => r));
    scoring = cards.filter((c) => counted.has(rankOf(c)));
  }

  // the tie-break: the ranks that matter, in order, after the hand itself
  const order = straightHigh ? [straightHigh] : groups.map(([r]) => r);
  let value = cat;
  for (let i = 0; i < 5; i++) value = value * 15 + (order[i] ?? 0);
  return { cat, name: HANDS[cat], value, scoring };
}

// The best five-card hand among 5 to 7 cards (Texas Hold'em: two in hand and
// five on the table): evaluate()'s, with `cards`, the five
export function bestHand(cards) {
  let best = null;
  const n = cards.length;
  const pick = (from, chosen) => {
    if (chosen.length === 5) {
      const hand = evaluate(chosen);
      if (!best || hand.value > best.value) best = { ...hand, cards: [...chosen] };
      return;
    }
    for (let i = from; i <= n - (5 - chosen.length); i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  return best;
}
