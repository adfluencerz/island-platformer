// ---------- The arcade's games ----------
// The rules of the games at the arcade on the farm (src/arcade.js draws
// them): a coinflip, blackjack against the dealer, and Lucky Hand, a short
// card game after Balatro. All against the house, for gold out of the
// backpack; the numbers are shared/balance.js's. The page plays them on its
// own, the way it keeps its backpack, so this is plain JS that npm test can
// play too.
//
// Each game is a plain object the functions here move along; `payout` is
// the gold that comes back at the end, the stake included (0: lost).
import { COINFLIP, BLACKJACK, LUCKY, LUCKY_HANDS, LUCKY_CARD_CHIPS, LUCKY_JOKERS } from './balance.js';
import { newDeck, shuffle, rankOf, evaluate, HAND } from './cards.js';

// ---------- Coinflip ----------
// call: 'heads' or 'tails' -> { side, won, payout }
export function coinflip(stake, call, rand = Math.random) {
  const side = rand() < 0.5 ? 'heads' : 'tails';
  const won = side === call;
  return { side, won, payout: won ? Math.floor(stake * COINFLIP.pays) : 0 };
}

// ---------- Blackjack ----------
// { total, soft }: what cards count to, an ace as 11 while that doesn't go
// over 21 (soft: one does)
export function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (r === 14) aces++;
    total += r === 14 ? 11 : Math.min(r, 10);
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

const natural = (cards) => cards.length === 2 && handTotal(cards).total === 21;

// A new hand: two cards each, the dealer's second face down (the page
// shows dealer[0] only until it is over). If either has a blackjack it is
// over at once.
export function blackjackDeal(stake, rand = Math.random) {
  const shoe = shuffle(newDeck(BLACKJACK.decks), rand);
  const game = { stake, shoe, player: [], dealer: [], doubled: false, over: false, result: '', payout: 0 };
  game.player.push(shoe.pop());
  game.dealer.push(shoe.pop());
  game.player.push(shoe.pop());
  game.dealer.push(shoe.pop());
  if (natural(game.player) || natural(game.dealer)) settle(game);
  return game;
}

// May the hand still be doubled (two cards, nothing drawn yet)
export const canDouble = (game) => !game.over && game.player.length === 2;

export function blackjackHit(game) {
  if (game.over) return game;
  game.player.push(game.shoe.pop());
  const { total } = handTotal(game.player);
  if (total > 21) settle(game);
  else if (total === 21) blackjackStand(game);
  return game;
}

// The stake doubled (the page has taken as much again from the backpack),
// one card more, and the dealer plays
export function blackjackDouble(game) {
  if (!canDouble(game)) return game;
  game.doubled = true;
  game.stake *= 2;
  game.player.push(game.shoe.pop());
  if (handTotal(game.player).total > 21) return settle(game);
  return blackjackStand(game);
}

// The dealer draws to 17, and the hand is settled
export function blackjackStand(game) {
  if (game.over) return game;
  while (handTotal(game.dealer).total < 17) game.dealer.push(game.shoe.pop());
  return settle(game);
}

function settle(game) {
  const me = handTotal(game.player).total;
  const them = handTotal(game.dealer).total;
  let result;
  if (natural(game.player) && natural(game.dealer)) result = 'push';
  else if (natural(game.player)) result = 'blackjack';
  else if (natural(game.dealer)) result = 'dealer blackjack';
  else if (me > 21) result = 'bust';
  else if (them > 21) result = 'dealer bust';
  else result = me > them ? 'win' : me < them ? 'lose' : 'push';
  const pays = { blackjack: BLACKJACK.natural, win: BLACKJACK.win, 'dealer bust': BLACKJACK.win, push: BLACKJACK.push }[result] ?? 0;
  game.over = true;
  game.result = result;
  game.payout = Math.floor(game.stake * pays);
  return game;
}

// ---------- Lucky Hand ----------
// A game: { stake, deck, hand, jokers, offer, plays, discards, score, last, over, payout }
// offer: joker ids to pick one of (empty: play on). last: what the last play scored, luckyScore()'s.
export function luckyStart(stake, rand = Math.random) {
  const deck = shuffle(newDeck(), rand);
  const game = {
    stake, deck, hand: [], jokers: [], offer: [], picked: 0,
    plays: LUCKY.plays, discards: LUCKY.discards, score: 0, last: null, over: false, payout: 0,
  };
  draw(game);
  offerJokers(game, rand);
  return game;
}

function draw(game) {
  while (game.hand.length < LUCKY.hand && game.deck.length) game.hand.push(game.deck.pop());
  game.hand.sort((a, b) => rankOf(b) - rankOf(a) || a[1].localeCompare(b[1]));
}

function offerJokers(game, rand) {
  const left = Object.keys(LUCKY_JOKERS).filter((id) => !game.jokers.includes(id));
  game.offer = shuffle(left, rand).slice(0, LUCKY.offer);
}

export function luckyPick(game, id) {
  if (!game.offer.includes(id)) return game;
  game.jokers.push(id);
  game.offer = [];
  game.picked++;
  return game;
}

// What a joker does, in words
export function jokerText(id) {
  const j = LUCKY_JOKERS[id];
  const adds = [j.chips && `+${j.chips} chips`, j.mult && `+${j.mult} mult`, j.times && `×${j.times} mult`].filter(Boolean).join(', ');
  if (j.suit) return `${adds} for each scoring ${{ h: 'heart', d: 'diamond', c: 'club', s: 'spade' }[j.suit]}`;
  if (j.face) return `${adds} for each scoring jack, queen or king`;
  if (j.needs === 2) return `${adds} if the hand has a pair`;
  if (j.needs === 3) return `${adds} if the hand has three of a kind`;
  if (j.needs) return `${adds} if the hand is a ${j.needs}`;
  return `${adds} on every hand`;
}

const cardChips = (card) => LUCKY_CARD_CHIPS[card[0]] ?? rankOf(card);

// What cards would score with these jokers: { cat, name, chips, mult, total, scoring }
export function luckyScore(cards, jokers = []) {
  const hand = evaluate(cards);
  let [chips, mult] = LUCKY_HANDS[hand.cat];
  for (const c of hand.scoring) chips += cardChips(c);
  const most = Math.max(...[...new Set(cards.map(rankOf))].map((r) => cards.filter((c) => rankOf(c) === r).length));
  const straight = hand.cat === HAND.straight || hand.cat === HAND.straightFlush;
  const flush = hand.cat === HAND.flush || hand.cat === HAND.straightFlush;
  let times = 1;
  for (const id of jokers) {
    const j = LUCKY_JOKERS[id];
    let n = 1;
    if (j.suit) n = hand.scoring.filter((c) => c[1] === j.suit).length;
    else if (j.face) n = hand.scoring.filter((c) => 'JQK'.includes(c[0])).length;
    else if (j.needs === 'straight') n = straight ? 1 : 0;
    else if (j.needs === 'flush') n = flush ? 1 : 0;
    else if (j.needs) n = most >= j.needs ? 1 : 0;
    chips += (j.chips ?? 0) * n;
    mult += (j.mult ?? 0) * n;
    if (j.times && n) times *= j.times ** n;
  }
  mult *= times;
  return { cat: hand.cat, name: hand.name, chips, mult: Math.round(mult * 10) / 10, total: Math.round(chips * mult), scoring: hand.scoring };
}

const chosen = (game, picks) => {
  const cards = [...new Set(picks)].filter((i) => Number.isInteger(i) && game.hand[i]).map((i) => game.hand[i]);
  return cards.length >= 1 && cards.length <= 5 ? cards : null;
};

// Play the cards at these places in the hand
export function luckyPlay(game, picks, rand = Math.random) {
  const cards = !game.over && !game.offer.length && game.plays > 0 && chosen(game, picks);
  if (!cards) return game;
  game.last = luckyScore(cards, game.jokers);
  game.score += game.last.total;
  game.plays--;
  game.hand = game.hand.filter((c) => !cards.includes(c));
  draw(game);
  if (!game.plays) {
    game.over = true;
    game.payout = Math.floor(game.stake * luckyPays(game.score));
  } else if (game.picked < LUCKY.picks) {
    offerJokers(game, rand);
  }
  return game;
}

// Swap the cards at these places for new ones
export function luckyDiscard(game, picks) {
  const cards = !game.over && !game.offer.length && game.discards > 0 && chosen(game, picks);
  if (!cards) return game;
  game.discards--;
  game.hand = game.hand.filter((c) => !cards.includes(c));
  draw(game);
  return game;
}

// What a total score pays, for each 1g staked
export function luckyPays(score) {
  let pays = 0;
  for (const [at, p] of LUCKY.tiers) if (score >= at) pays = p;
  return pays;
}
