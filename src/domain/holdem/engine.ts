import { type Card } from '../cards'
import { createStandardDeck, drawCards, shuffleDeck } from '../deck'
import { compareHands, evaluateBestHand } from '../evaluator'
import { chips, type ChipAmount, type SeatNumber } from '../game/types'
import { systemRandom, type RandomSource } from '../random'
import { createHoldemConfig, type HoldemConfig } from './config'
import { buildPots, committedChips } from './pots'
import { fundedSeats, nextSeat, orderedFromLeftOf } from './positions'
import type { ActionEvent, CpuController, HandPlayer, HandState, LegalActions, MatchPlayer, MatchState, PlayerAction, Payout } from './types'

const zero = chips(0)

function asChips(value: number): ChipAmount { return chips(value) }
function isLive(player: HandPlayer): boolean { return !player.folded }
function canAct(player: HandPlayer): boolean { return isLive(player) && !player.allIn && player.stack > 0 }
function findPlayer(players: readonly HandPlayer[], seat: SeatNumber): HandPlayer {
  const player = players.find((candidate) => candidate.seat === seat)
  if (player === undefined) throw new Error(`No player occupies seat ${seat}.`)
  return player
}

function replacePlayer(players: readonly HandPlayer[], player: HandPlayer): HandPlayer[] {
  return players.map((candidate) => candidate.seat === player.seat ? player : candidate)
}

function event(type: ActionEvent['type'], text: string, seat?: SeatNumber): ActionEvent { return { type, text, seat } }

export function createMatch(players: readonly MatchPlayer[], configOverrides: Partial<HoldemConfig> = {}): MatchState {
  const config = createHoldemConfig(configOverrides)
  if (players.length < 2 || players.length > config.seatCount || new Set(players.map((player) => player.seat)).size !== players.length) {
    throw new Error('Match players must occupy unique seats and include at least two players.')
  }
  const normalized = players.map((player) => ({ ...player, bankroll: asChips(player.bankroll), isEliminated: player.bankroll === 0 || player.isEliminated }))
  return { config, handNumber: 0, button: config.initialButton, players: normalized }
}

function post(handPlayers: readonly HandPlayer[], seat: SeatNumber, requested: ChipAmount): { players: HandPlayer[]; amount: ChipAmount } {
  const player = findPlayer(handPlayers, seat)
  const amount = asChips(Math.min(player.stack, requested))
  const updated: HandPlayer = {
    ...player,
    stack: asChips(player.stack - amount),
    streetContribution: asChips(player.streetContribution + amount),
    totalContribution: asChips(player.totalContribution + amount),
    allIn: player.stack === amount,
  }
  return { players: replacePlayer(handPlayers, updated), amount }
}

function dealHoleCards(players: readonly HandPlayer[], button: SeatNumber, deckCards: readonly Card[]): { players: HandPlayer[]; deckCards: readonly Card[] } {
  let deck = { cards: deckCards }
  let result = [...players]
  const recipients = orderedFromLeftOf(players.map((player) => player.seat), button)
  for (let round = 0; round < 2; round += 1) {
    for (const seat of recipients) {
      const draw = drawCards(deck)
      deck = draw.deck
      const player = findPlayer(result, seat)
      result = replacePlayer(result, { ...player, holeCards: [...player.holeCards, draw.drawn[0]] })
    }
  }
  return { players: result, deckCards: deck.cards }
}

function activeSeats(hand: HandState): SeatNumber[] { return hand.players.filter(canAct).map((player) => player.seat) }
function liveSeats(hand: HandState): SeatNumber[] { return hand.players.filter(isLive).map((player) => player.seat) }

function nextPending(hand: HandState, from: SeatNumber): SeatNumber | undefined {
  const candidates = hand.pendingSeats.filter((seat) => canAct(findPlayer(hand.players, seat)))
  return candidates.length === 0 ? undefined : nextSeat(candidates, from)
}

export function startNextHand(match: MatchState, random: RandomSource = systemRandom): MatchState {
  if (match.hand !== undefined && match.hand.phase !== 'complete') throw new Error('The current hand must complete before another can start.')
  const funded = fundedSeats(match.players)
  if (funded.length < 2) {
    return { ...match, matchWinnerSeat: funded[0] }
  }
  const button = match.handNumber === 0 && funded.includes(match.button) ? match.button : nextSeat(funded, match.button)
  const smallBlindSeat = funded.length === 2 ? button : nextSeat(funded, button)
  const bigBlindSeat = nextSeat(funded, smallBlindSeat)
  const initialPlayers: HandPlayer[] = match.players.map((player) => ({
    ...player,
    stack: player.bankroll,
    startingStack: player.bankroll,
    holeCards: [], streetContribution: zero, totalContribution: zero, folded: false, allIn: false,
  }))
  const shuffled = shuffleDeck(createStandardDeck(), random)
  const dealt = dealHoleCards(initialPlayers, button, shuffled.cards)
  const smallBlind = post(dealt.players, smallBlindSeat, match.config.smallBlind)
  const bigBlind = post(smallBlind.players, bigBlindSeat, match.config.bigBlind)
  const preflopSeats = bigBlind.players.filter(canAct).map((player) => player.seat)
  const firstActor = funded.length === 2 ? button : nextSeat(preflopSeats, bigBlindSeat)
  const currentBet = asChips(Math.max(smallBlind.amount, bigBlind.amount))
  const hand: HandState = {
    id: match.handNumber + 1, phase: 'preflop', button, smallBlindSeat, bigBlindSeat,
    players: bigBlind.players, deck: { cards: dealt.deckCards }, burnedCards: [], board: [], showdown: false, actingSeat: firstActor,
    currentBet, lastFullRaise: match.config.bigBlind, pendingSeats: preflopSeats,
    raiseAllowedSeats: preflopSeats, history: [
      event('blind', `${findPlayer(bigBlind.players, smallBlindSeat).name} posts small blind $${smallBlind.amount.toLocaleString()}`, smallBlindSeat),
      event('blind', `${findPlayer(bigBlind.players, bigBlindSeat).name} posts big blind $${bigBlind.amount.toLocaleString()}`, bigBlindSeat),
    ], pots: [], payouts: [], winners: [],
  }
  return { ...match, handNumber: hand.id, button, hand }
}

function opponentsCanRespond(hand: HandState, seat: SeatNumber): boolean {
  return hand.players.some((player) => player.seat !== seat && canAct(player))
}

export function legalActions(match: MatchState, seat: SeatNumber): LegalActions {
  const hand = match.hand
  if (hand === undefined || hand.phase === 'complete' || hand.actingSeat !== seat) throw new Error('It is not this player’s turn.')
  const player = findPlayer(hand.players, seat)
  const amountToCall = asChips(Math.max(0, hand.currentBet - player.streetContribution))
  const cappedCallAmount = asChips(Math.min(amountToCall, player.stack))
  const maximumTo = asChips(player.streetContribution + player.stack)
  const opponents = opponentsCanRespond(hand, seat)
  const canRaise = hand.currentBet > 0 && opponents && hand.raiseAllowedSeats.includes(seat) && maximumTo > hand.currentBet
  return {
    seat, amountToCall, cappedCallAmount,
    canFold: true,
    canCheck: amountToCall === 0,
    canCall: amountToCall > 0 && player.stack > 0,
    canBet: hand.currentBet === 0 && opponents && maximumTo >= match.config.bigBlind,
    canRaise,
    canAllIn: player.stack > 0 && opponents,
    minimumBetTo: hand.currentBet === 0 ? match.config.bigBlind : undefined,
    minimumRaiseTo: canRaise ? asChips(hand.currentBet + hand.lastFullRaise) : undefined,
    maximumTo,
  }
}

function contribution(hand: HandState, seat: SeatNumber, to: ChipAmount): HandState {
  const player = findPlayer(hand.players, seat)
  if (to < player.streetContribution || to > player.streetContribution + player.stack) throw new Error('Contribution exceeds the available stack.')
  const added = asChips(to - player.streetContribution)
  const updated: HandPlayer = { ...player, stack: asChips(player.stack - added), streetContribution: to, totalContribution: asChips(player.totalContribution + added), allIn: player.stack === added }
  return { ...hand, players: replacePlayer(hand.players, updated) }
}

function dealStreet(hand: HandState): HandState {
  const draw = drawCards(hand.deck)
  const burn = draw.drawn[0]
  const boardCount = hand.phase === 'preflop' ? 3 : 1
  const boardDraw = drawCards(draw.deck, boardCount)
  const phase = hand.phase === 'preflop' ? 'flop' : hand.phase === 'flop' ? 'turn' : 'river'
  const resetPlayers = hand.players.map((player) => ({ ...player, streetContribution: zero }))
  const reset: HandState = { ...hand, phase, players: resetPlayers, deck: boardDraw.deck, burnedCards: [...hand.burnedCards, burn], board: [...hand.board, ...boardDraw.drawn], currentBet: zero, lastFullRaise: zero, pendingSeats: resetPlayers.filter(canAct).map((player) => player.seat), raiseAllowedSeats: resetPlayers.filter(canAct).map((player) => player.seat), history: [...hand.history, event('street', phase === 'flop' ? 'Flop dealt' : phase === 'turn' ? 'Turn dealt' : 'River dealt')] }
  const candidates = reset.pendingSeats
  return { ...reset, actingSeat: candidates.length === 0 ? undefined : nextSeat(candidates, hand.button) }
}

function payoutPlayers(hand: HandState, payouts: readonly Payout[], returns: readonly { readonly seat: SeatNumber; readonly amount: ChipAmount }[]): HandPlayer[] {
  let players = [...hand.players]
  for (const returned of returns) {
    const player = findPlayer(players, returned.seat)
    players = replacePlayer(players, { ...player, stack: asChips(player.stack + returned.amount) })
  }
  for (const payout of payouts) {
    const player = findPlayer(players, payout.seat)
    players = replacePlayer(players, { ...player, stack: asChips(player.stack + payout.amount) })
  }
  return players
}

function completeHand(match: MatchState, hand: HandState, payouts: readonly Payout[], returns: readonly { readonly seat: SeatNumber; readonly amount: ChipAmount }[], winners: readonly SeatNumber[]): MatchState {
  const potsResult = buildPots(hand.players)
  const players = payoutPlayers(hand, payouts, returns)
  const history = [...hand.history, ...returns.map((item) => event('return', `$${item.amount.toLocaleString()} unmatched chips returned`, item.seat)), ...payouts.map((item) => event('payout', `${findPlayer(players, item.seat).name} wins $${item.amount.toLocaleString()}`, item.seat))]
  const completed: HandState = { ...hand, players, phase: 'complete', actingSeat: undefined, pendingSeats: [], pots: potsResult.pots, payouts, winners, history }
  const matchPlayers = match.players.map((player) => {
    const updated = findPlayer(players, player.seat)
    return { ...player, bankroll: updated.stack, isEliminated: updated.stack === 0 }
  })
  const funded = fundedSeats(matchPlayers)
  return { ...match, players: matchPlayers, hand: completed, matchWinnerSeat: funded.length === 1 ? funded[0] : undefined }
}

function resolveUncontested(match: MatchState, hand: HandState): MatchState {
  const winner = liveSeats(hand)[0]
  const built = buildPots(hand.players)
  const payouts = built.pots.map((pot, potIndex) => ({ seat: winner, amount: pot.amount, potIndex }))
  return completeHand(match, hand, payouts, built.returned, [winner])
}

function winnerOrder(seats: readonly SeatNumber[], button: SeatNumber): SeatNumber[] {
  return orderedFromLeftOf(seats, button).filter((seat) => seats.includes(seat))
}

function resolveShowdown(match: MatchState, hand: HandState): MatchState {
  const built = buildPots(hand.players)
  const payouts: Payout[] = []
  const winnerSeats = new Set<SeatNumber>()
  built.pots.forEach((pot, potIndex) => {
    const evaluated = pot.eligibleSeats.map((seat) => ({ seat, hand: evaluateBestHand([...findPlayer(hand.players, seat).holeCards, ...hand.board]) }))
    const best = evaluated.reduce((current, candidate) => compareHands(candidate.hand, current.hand) > 0 ? candidate : current)
    const winners = evaluated.filter((candidate) => compareHands(candidate.hand, best.hand) === 0).map((candidate) => candidate.seat)
    const share = Math.floor(pot.amount / winners.length)
    const odd = pot.amount % winners.length
    const ordered = winnerOrder(winners, hand.button)
    ordered.forEach((seat, index) => { payouts.push({ seat, amount: asChips(share + (index < odd ? 1 : 0)), potIndex }); winnerSeats.add(seat) })
  })
  return completeHand(match, hand, payouts, built.returned, [...winnerSeats])
}

function runout(match: MatchState, hand: HandState): MatchState {
  let next = hand
  while (next.board.length < 5) next = dealStreet(next)
  return resolveShowdown(match, { ...next, phase: 'showdown', showdown: true, history: [...next.history, event('street', 'All players are all-in. Running out the board.')] })
}

function settleOrAdvance(match: MatchState, hand: HandState, from: SeatNumber): MatchState {
  const live = liveSeats(hand)
  if (live.length === 1) return resolveUncontested(match, hand)
  const pending = hand.pendingSeats.filter((seat) => canAct(findPlayer(hand.players, seat)))
  if (pending.length > 0) return { ...match, hand: { ...hand, pendingSeats: pending, actingSeat: nextPending({ ...hand, pendingSeats: pending }, from) } }
  if (activeSeats(hand).length < 2) return runout(match, hand)
  if (hand.phase === 'river') return resolveShowdown(match, { ...hand, phase: 'showdown', showdown: true })
  const next = dealStreet(hand)
  if (next.pendingSeats.length === 0) return runout(match, next)
  return { ...match, hand: next }
}

export function applyAction(match: MatchState, seat: SeatNumber, action: PlayerAction): MatchState {
  const hand = match.hand
  if (hand === undefined || hand.phase === 'complete' || hand.actingSeat !== seat) throw new Error('Action is out of turn or the hand is complete.')
  const legal = legalActions(match, seat)
  const player = findPlayer(hand.players, seat)
  let next = hand
  let fullRaise = false
  let description = ''
  if (action.type === 'fold') {
    if (!legal.canFold) throw new Error('Folding is not legal.')
    next = { ...hand, players: replacePlayer(hand.players, { ...player, folded: true }), pendingSeats: hand.pendingSeats.filter((candidate) => candidate !== seat), raiseAllowedSeats: hand.raiseAllowedSeats.filter((candidate) => candidate !== seat) }
    description = `${player.name} folds`
  } else if (action.type === 'check') {
    if (!legal.canCheck) throw new Error('Checking is not legal while facing a wager.')
    next = { ...hand, pendingSeats: hand.pendingSeats.filter((candidate) => candidate !== seat), raiseAllowedSeats: hand.raiseAllowedSeats.filter((candidate) => candidate !== seat) }
    description = `${player.name} checks`
  } else if (action.type === 'call') {
    if (!legal.canCall) throw new Error('Calling is not legal.')
    next = contribution(hand, seat, asChips(player.streetContribution + legal.cappedCallAmount))
    next = { ...next, pendingSeats: next.pendingSeats.filter((candidate) => candidate !== seat), raiseAllowedSeats: next.raiseAllowedSeats.filter((candidate) => candidate !== seat) }
    description = `${player.name} calls $${legal.cappedCallAmount.toLocaleString()}`
  } else if (action.type === 'all-in' && legal.maximumTo <= hand.currentBet) {
    if (!legal.canAllIn) throw new Error('All-in is not legal.')
    next = contribution(hand, seat, legal.maximumTo)
    next = { ...next, pendingSeats: next.pendingSeats.filter((candidate) => candidate !== seat), raiseAllowedSeats: next.raiseAllowedSeats.filter((candidate) => candidate !== seat) }
    description = `${player.name} calls all-in for $${legal.maximumTo.toLocaleString()}`
  } else {
    const to = action.type === 'all-in' ? legal.maximumTo : action.to
    if (to === undefined) throw new Error('Bet and raise actions require a total raise-to amount.')
    if (!Number.isSafeInteger(to) || to < 0) throw new Error('Wagers must be non-negative safe integer chip amounts.')
    if (to <= player.streetContribution || to > legal.maximumTo) throw new Error('Wager amount is outside the legal stack range.')
    if (action.type === 'bet' && !legal.canBet) throw new Error('Betting is not legal.')
    if (action.type === 'raise' && !legal.canRaise) throw new Error('Raising is not legal.')
    if (action.type === 'all-in' && !legal.canAllIn) throw new Error('All-in is not legal.')
    const wagerType = hand.currentBet === 0 ? 'bet' : 'raise'
    const minimum = wagerType === 'bet' ? match.config.bigBlind : asChips(hand.currentBet + hand.lastFullRaise)
    if (action.type !== 'all-in' && to < minimum) throw new Error(`Minimum ${wagerType} is $${minimum.toLocaleString()}.`)
    if (to <= hand.currentBet && action.type !== 'all-in') throw new Error('A bet or raise must exceed the current wager.')
    next = contribution(hand, seat, to)
    const raiseSize = asChips(to - hand.currentBet)
    fullRaise = hand.currentBet === 0 ? to >= match.config.bigBlind : raiseSize >= hand.lastFullRaise
    const activeOpponents = next.players.filter((candidate) => candidate.seat !== seat && canAct(candidate)).map((candidate) => candidate.seat)
    const owes = activeOpponents.filter((candidate) => findPlayer(next.players, candidate).streetContribution < to)
    next = { ...next, currentBet: to, lastFullRaise: fullRaise ? raiseSize : hand.lastFullRaise, lastAggressor: seat, pendingSeats: owes, raiseAllowedSeats: fullRaise ? activeOpponents : next.raiseAllowedSeats.filter((candidate) => candidate !== seat) }
    description = action.type === 'all-in' ? `${player.name} is all-in for $${to.toLocaleString()}` : `${player.name} ${wagerType}s to $${to.toLocaleString()}`
  }
  next = { ...next, history: [...next.history, event('action', description, seat)] }
  return settleOrAdvance(match, next, seat)
}

export function assertChipConservation(match: MatchState): void {
  const baseline = match.players.reduce((total, player) => total + (match.hand?.players.find((candidate) => candidate.seat === player.seat)?.startingStack ?? player.bankroll), 0)
  if (match.hand === undefined || match.hand.phase === 'complete') {
    const actual = match.players.reduce((total, player) => total + player.bankroll, 0)
    if (actual !== baseline) throw new Error(`Chip conservation failed: expected ${baseline}, received ${actual}.`)
    return
  }
  const stackTotal = match.hand.players.reduce((total, player) => total + player.stack, 0)
  const committed = committedChips(match.hand.players)
  if (stackTotal + committed !== baseline) throw new Error(`Chip conservation failed: expected ${baseline}, received ${stackTotal + committed}.`)
}

export function runCpuTurns(match: MatchState, controller: CpuController, limit = 100): MatchState {
  let next = match
  for (let count = 0; count < limit; count += 1) {
    const hand = next.hand
    if (hand === undefined || hand.phase === 'complete' || hand.actingSeat === undefined) return next
    const player = findPlayer(hand.players, hand.actingSeat)
    if (player.kind !== 'cpu') return next
    const legal = legalActions(next, player.seat)
    const action = controller({ seat: player.seat, holeCards: player.holeCards, board: hand.board, legalActions: legal, publicHistory: hand.history, players: hand.players.map(({ seat, stack, streetContribution, totalContribution, folded, allIn }) => ({ seat, stack, streetContribution, totalContribution, folded, allIn })), pots: buildPots(hand.players).pots, button: hand.button })
    next = applyAction(next, player.seat, action)
  }
  // The caller may deliberately process a single CPU action for presentation pacing.
  // Returning after the bound prevents a faulty controller from monopolizing the UI thread.
  return next
}

export function visibleHoleCards(hand: HandState, viewerSeat: SeatNumber): ReadonlyMap<SeatNumber, readonly Card[]> {
  const result = new Map<SeatNumber, readonly Card[]>()
  for (const player of hand.players) {
    const revealedAtShowdown = hand.showdown && (hand.phase === 'showdown' || (hand.phase === 'complete' && hand.pots.some((pot) => pot.eligibleSeats.includes(player.seat))))
    result.set(player.seat, player.seat === viewerSeat || revealedAtShowdown ? player.holeCards : [])
  }
  return result
}
