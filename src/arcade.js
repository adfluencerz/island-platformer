import './arcade.css';
import { ITEMS, spriteURL } from './items.js';
import { el, button } from './ui/dom.js';
import { cardLabel, RED_SUITS } from '../shared/cards.js';
import { LUCKY, LUCKY_JOKERS } from '../shared/balance.js';
import {
  coinflip, handTotal, canDouble, blackjackDeal, blackjackHit, blackjackStand, blackjackDouble,
  luckyStart, luckyPick, luckyPlay, luckyDiscard, luckyScore, luckyPays, jokerText,
} from '../shared/arcade.js';

// ---------- The arcade ----------
// Built on the farm in build mode (src/build.js), and E next to it (or a tap)
// opens this: games against the house for gold out of the backpack (the
// rules: shared/arcade.js). A coinflip, blackjack, and Lucky Hand, a short
// card game after Balatro. The stake has no limit but what is in the
// backpack. Gold is the page's own, like the backpack, so it works on a
// friend's farm too. A game left half played carries on when the arcade is
// opened again (not after a reload: its stake is gone then).
//
//   Tabs          the three games
//   E / Esc / ×   close

const TABS = [['coin', 'Coinflip'], ['blackjack', 'Blackjack'], ['lucky', 'Lucky Hand']];
const FLIP_MS = 1100;
const RESULT_WORDS = {
  blackjack: 'Blackjack!',
  win: 'You win!',
  'dealer bust': 'The dealer went bust: you win!',
  push: 'A push: your stake comes back.',
  lose: 'The dealer wins this one.',
  bust: 'Bust! Over 21.',
  'dealer blackjack': 'The dealer has blackjack.',
};
// the coin's two faces: a sunflower for heads, a turnip for tails
const COIN_FACES = { heads: ITEMS.sunflower, tails: ITEMS.turnip };
const times = (p) => (p === 0.5 ? '½' : String(p)) + '×';

// inventory: from createInventory. onOpenChange(open): the game pauses input.
// onChange(): gold was won or lost (the page saves).
export function createArcade({ inventory, onOpenChange, onChange }) {
  let open = false;
  let tab = 'coin';
  let stake = 50;
  let flipping = false; // (the coin is in the air)
  let coinSide = 'heads';
  let coinSay = 'Call it: heads or tails. Guess right and your stake comes back doubled.';
  let bj = null; // blackjack: the hand being played (or the last one)
  let lucky = null; // Lucky Hand: the game being played (or the last one)
  let picks = new Set(); // Lucky Hand: the places in the hand picked

  const menuEl = el('div', 'inv-menu arcade-menu', document.body);
  menuEl.hidden = true;
  const windowEl = el('div', 'inv-window inv-frame arcade-window', menuEl);
  const tabsEl = el('div', 'inv-tabs', windowEl);
  const tabEls = Object.fromEntries(TABS.map(([id, name]) => {
    const b = button('inv-tab inv-frame', tabsEl, name, () => {
      tab = id;
      render();
    });
    return [id, b];
  }));
  const closeBtn = button('inv-close', windowEl, '×', () => setOpen(false));
  closeBtn.title = 'Close (E / Esc)';

  // the stake, the same for every game
  const stakeEl = el('div', 'arc-stake', windowEl);
  el('span', 'arc-stake-label', stakeEl, 'Stake');
  const halfBtn = button('ui-btn ui-btn-small ui-btn-ghost', stakeEl, '½', () => setStake(Math.floor(stake / 2)));
  const stakeIn = el('input', 'arc-stake-in', stakeEl);
  Object.assign(stakeIn, { type: 'number', min: 1, step: 1, inputMode: 'numeric' });
  stakeIn.addEventListener('input', () => {
    stake = Math.max(0, Math.floor(Number(stakeIn.value) || 0));
    render();
  });
  const coinImg = el('img', 'inv-icon arc-coin-icon', stakeEl);
  coinImg.src = spriteURL(ITEMS.coin);
  const doubleBtn = button('ui-btn ui-btn-small ui-btn-ghost', stakeEl, '×2', () => setStake(stake * 2));
  const allBtn = button('ui-btn ui-btn-small ui-btn-ghost', stakeEl, 'All', () => setStake(inventory.gold()));
  const fundsEl = el('span', 'arc-funds', stakeEl);
  const bodyEl = el('div', 'arc-body', windowEl);

  function setStake(n) {
    stake = Math.max(1, Math.floor(n));
    render();
  }

  // Why the stake can't be played ('': it can)
  function stakeProblem(n = stake) {
    if (!(n >= 1)) return 'Stake at least 1g';
    if (n > inventory.gold()) return 'Not enough gold';
    return '';
  }

  // Take the stake out of the backpack (false: there isn't enough)
  function pay(n) {
    if (stakeProblem(n) || !inventory.spend(n)) return false;
    onChange?.();
    return true;
  }

  function payOut(n) {
    if (n > 0) inventory.earn(n);
    onChange?.();
  }

  const busy = () => flipping || (bj && !bj.over) || (lucky && !lucky.over);

  function render() {
    for (const [id, b] of Object.entries(tabEls)) b.classList.toggle('on', id === tab);
    if (document.activeElement !== stakeIn) stakeIn.value = String(stake);
    const locked = busy();
    for (const b of [halfBtn, doubleBtn, allBtn]) b.disabled = locked;
    stakeIn.disabled = locked;
    fundsEl.textContent = `You have ${inventory.gold().toLocaleString()}g`;
    stakeEl.classList.toggle('short', !locked && !!stakeProblem());
    bodyEl.textContent = '';
    bodyEl.className = `arc-body arc-on-${tab}`;
    if (tab === 'coin') renderCoin();
    else if (tab === 'blackjack') renderBlackjack();
    else renderLucky();
  }

  // ---------- Coinflip ----------
  function renderCoin() {
    el('div', 'arc-print', bodyEl, 'Double or nothing');
    const stage = el('div', `arc-coin-stage${flipping ? ' flipping' : ''}`, bodyEl);
    const coin = el('div', `arc-coin ${coinSide}${flipping ? ' flipping' : ''}`, stage);
    for (const side of ['heads', 'tails']) {
      const face = el('div', `arc-coin-face ${side}`, coin);
      el('img', 'arc-coin-art', face).src = spriteURL(COIN_FACES[side]);
    }
    el('div', 'arc-coin-shadow', stage);
    el('div', 'arc-say', bodyEl, coinSay);
    const row = el('div', 'arc-buttons', bodyEl);
    const why = stakeProblem();
    for (const call of ['heads', 'tails']) {
      const b = button('ui-btn arc-call', row, '', () => flip(call));
      el('img', 'arc-call-art', b).src = spriteURL(COIN_FACES[call]);
      b.append(call === 'heads' ? 'Heads' : 'Tails');
      b.disabled = flipping || !!why;
      if (why) b.title = why;
    }
  }

  function flip(call) {
    if (flipping || !pay(stake)) return;
    const bet = stake;
    const { side, won, payout } = coinflip(bet, call);
    flipping = true;
    coinSide = side;
    coinSay = 'Flipping...';
    render();
    setTimeout(() => {
      flipping = false;
      coinSay = won ? `${side === 'heads' ? 'Heads' : 'Tails'}! You win ${payout.toLocaleString()}g.` : `${side === 'heads' ? 'Heads' : 'Tails'}. The coin keeps your ${bet.toLocaleString()}g this time.`;
      payOut(payout);
      if (open) render();
    }, FLIP_MS);
  }

  // ---------- Blackjack ----------
  function cardEl(parent, card, extra = '') {
    if (!card) return el('div', 'arc-card back' + extra, parent);
    const c = el('div', `arc-card${RED_SUITS.has(card[1]) ? ' red' : ''}${extra}`, parent);
    el('span', 'arc-card-corner', c, cardLabel(card));
    el('span', 'arc-card-pip', c, cardLabel(card).slice(-1));
    el('span', 'arc-card-corner low', c, cardLabel(card));
    return c;
  }

  function renderBlackjack() {
    const table = el('div', 'arc-table', bodyEl);
    if (!bj) {
      handRow(table, 'Dealer', [], 2);
      tableRules(table);
      handRow(table, 'You', [], 2);
      el('div', 'arc-hint', table, 'Get closer to 21 than the dealer without going over.');
    } else {
      const hidden = !bj.over;
      const dealer = hidden ? [bj.dealer[0], null] : bj.dealer;
      const dealerTotal = hidden ? handTotal([bj.dealer[0]]).total : handTotal(bj.dealer).total;
      handRow(table, `Dealer · ${dealerTotal}${hidden ? ' + ?' : ''}`, dealer);
      tableRules(table);
      const me = handTotal(bj.player);
      handRow(table, `You · ${me.soft && me.total < 21 ? 'soft ' : ''}${me.total}${bj.doubled ? ' (doubled)' : ''}`, bj.player);
      if (bj.over) {
        const won = bj.payout - bj.stake;
        el('div', `arc-say${won > 0 ? ' good' : ''}`, table, `${RESULT_WORDS[bj.result]} ${won > 0 ? `+${won.toLocaleString()}g` : won < 0 ? `−${bj.stake.toLocaleString()}g` : ''}`);
      }
    }
    const row = el('div', 'arc-buttons', bodyEl);
    if (!bj || bj.over) {
      const why = stakeProblem();
      const deal = button('ui-btn', row, bj ? 'Deal again' : 'Deal', dealBlackjack);
      deal.disabled = !!why;
      if (why) deal.title = why;
      return;
    }
    button('ui-btn', row, 'Hit', () => playBlackjack(blackjackHit));
    button('ui-btn', row, 'Stand', () => playBlackjack(blackjackStand));
    const dbl = button('ui-btn', row, 'Double', () => {
      if (pay(bj.stake)) playBlackjack(blackjackDouble);
    });
    dbl.disabled = !canDouble(bj) || inventory.gold() < bj.stake;
    dbl.title = 'Double the stake, take one more card, and stand';
  }

  // a hand with its label (spaces: empty places for cards, before a deal)
  function handRow(parent, label, cards, spaces = 0) {
    const row = el('div', 'arc-hand-row', parent);
    el('div', 'arc-hand-label', row, label);
    const hand = el('div', 'arc-hand', row);
    for (const c of cards) cardEl(hand, c);
    for (let i = 0; i < spaces; i++) el('div', 'arc-card space', hand);
  }

  // printed on the felt between the hands, as on a real table
  function tableRules(parent) {
    const print = el('div', 'arc-print arc-print-rules', parent);
    el('span', '', print, 'Blackjack pays 3 to 2');
    el('small', '', print, 'Dealer stands on 17');
  }

  function dealBlackjack() {
    if (busy() || !pay(stake)) return;
    bj = blackjackDeal(stake);
    if (bj.over) payOut(bj.payout);
    render();
  }

  function playBlackjack(move) {
    move(bj);
    if (bj.over) payOut(bj.payout);
    render();
  }

  // ---------- Lucky Hand ----------
  function renderLucky() {
    if (!lucky) {
      el('div', 'arc-title', bodyEl, 'Lucky Hand');
      const intro = el('div', 'arc-lucky-intro', bodyEl);
      const fan = el('div', 'arc-fan', intro);
      for (let i = 0; i < 5; i++) cardEl(fan, null).style.setProperty('--i', i - 2);
      ladder(intro, -1);
      el('div', 'arc-hint', bodyEl, `Play ${LUCKY.plays} poker hands from ${LUCKY.hand} cards. Each scores chips × mult; jokers boost it, and you can swap cards ${LUCKY.discards} times.`);
      startButton();
      return;
    }
    const top = el('div', 'arc-lucky-top', bodyEl);
    const jokers = el('div', 'arc-jokers', top);
    if (!lucky.jokers.length) el('div', 'arc-muted', jokers, 'No jokers yet');
    for (const id of lucky.jokers) jokerEl(jokers, id);
    ladder(top, lucky.score);

    const stats = el('div', 'arc-lucky-stats', bodyEl);
    el('span', '', stats, `Score ${lucky.score.toLocaleString()}`);
    el('span', '', stats, `Hands ${lucky.plays}`);
    el('span', '', stats, `Swaps ${lucky.discards}`);

    if (lucky.offer.length) {
      el('div', 'arc-say', bodyEl, lucky.picked ? 'Well played! Pick one more joker:' : 'Pick a joker to play with:');
      const offer = el('div', 'arc-jokers arc-offer', bodyEl);
      for (const id of lucky.offer) jokerEl(offer, id, () => {
        luckyPick(lucky, id);
        render();
      });
      const hand = el('div', 'arc-hand arc-lucky-hand', bodyEl);
      for (const c of lucky.hand) cardEl(hand, c);
      return;
    }

    const chosen = [...picks].map((i) => lucky.hand[i]).filter(Boolean);
    const scoring = chosen.length ? luckyScore(chosen, lucky.jokers) : null;
    const counted = new Set(scoring?.scoring ?? []);
    let say;
    if (lucky.over) {
      const won = lucky.payout - lucky.stake;
      say = `All played: ${lucky.score.toLocaleString()} points. ${lucky.payout ? `It pays ${lucky.payout.toLocaleString()}g${won > 0 ? ` (+${won.toLocaleString()}g)` : ''}.` : 'Not enough for a prize this time.'}`;
    } else if (scoring) say = `${scoring.name}: ${scoring.chips} chips × ${scoring.mult} mult = ${scoring.total.toLocaleString()}`;
    else if (lucky.last) say = `Last hand: ${lucky.last.name}, ${lucky.last.total.toLocaleString()} points. Pick up to 5 cards.`;
    else say = 'Pick up to 5 cards to play, or to swap for new ones.';
    el('div', `arc-say${lucky.over && lucky.payout > lucky.stake ? ' good' : ''}`, bodyEl, say);

    const hand = el('div', 'arc-hand arc-lucky-hand', bodyEl);
    lucky.hand.forEach((c, i) => {
      const card = cardEl(hand, c, `${picks.has(i) ? ' picked' : ''}${counted.has(c) ? ' scoring' : ''}`);
      if (lucky.over) return;
      card.classList.add('pickable');
      card.addEventListener('click', () => {
        if (picks.has(i)) picks.delete(i);
        else if (picks.size < 5) picks.add(i);
        render();
      });
    });

    if (lucky.over) return startButton('Play again');
    const row = el('div', 'arc-buttons', bodyEl);
    const play = button('ui-btn', row, 'Play hand', () => {
      luckyPlay(lucky, [...picks]);
      picks = new Set();
      if (lucky.over) payOut(lucky.payout);
      render();
    });
    play.disabled = !picks.size;
    const swap = button('ui-btn ui-btn-ghost', row, `Swap (${lucky.discards})`, () => {
      luckyDiscard(lucky, [...picks]);
      picks = new Set();
      render();
    });
    swap.disabled = !picks.size || !lucky.discards;
  }

  function startButton(text = 'Deal') {
    const row = el('div', 'arc-buttons', bodyEl);
    const why = stakeProblem();
    const b = button('ui-btn', row, text, () => {
      if (busy() || !pay(stake)) return;
      lucky = luckyStart(stake);
      picks = new Set();
      render();
    });
    b.disabled = !!why;
    if (why) b.title = why;
  }

  function jokerEl(parent, id, onPick) {
    const j = el(onPick ? 'button' : 'div', `arc-joker${onPick ? ' pick' : ''}`, parent);
    el('b', '', j, LUCKY_JOKERS[id].name);
    el('span', '', j, jokerText(id));
    if (onPick) {
      j.type = 'button';
      j.addEventListener('click', onPick);
    }
    return j;
  }

  // The payouts, the one reached so far lit up (score -1: none yet)
  function ladder(parent, score) {
    const list = el('div', 'arc-ladder', parent);
    el('div', 'arc-ladder-head', list, 'Prizes');
    const pays = luckyPays(Math.max(score, 0));
    for (const [at, p] of LUCKY.tiers) {
      const row = el('div', 'arc-tier' + (score >= at && p === pays ? ' on' : score >= at ? ' past' : ''), list);
      el('span', '', row, at.toLocaleString());
      el('b', '', row, `${times(p)} · ${Math.floor(p * (lucky && !lucky.over ? lucky.stake : stake)).toLocaleString()}g`);
    }
  }

  menuEl.addEventListener('mousedown', (e) => e.target === menuEl && setOpen(false)); // click outside the window
  menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  // Capture phase, like the workbench's: while the arcade is open it has the
  // keyboard (E closes it, except while typing a stake)
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    e.stopPropagation();
    const typing = e.target === stakeIn;
    if ((e.code === 'Escape' || (e.code === 'KeyE' && !typing)) && !e.repeat) setOpen(false);
  }, true);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menuEl.hidden = !open;
    if (open) render();
    else stakeIn.blur();
    onOpenChange?.(open);
  }

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
