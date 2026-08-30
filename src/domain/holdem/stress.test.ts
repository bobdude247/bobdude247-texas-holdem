import { describe, expect, it } from 'vitest'
import { cardKey } from '../cards'
import { chips } from '../game/types'
import { applyAction, assertChipConservation, createCpuDecisionContext, createMatch, legalActions, startNextHand } from './engine'
import { buildPots } from './pots'
import { projectPublicMatch } from './public'
import type { HandState, MatchPlayer, MatchState, PlayerAction } from './types'

const seeds = [0xC0FFEE, 0xB0BD247, 0xDEADBEEF, 0x12345678, 0x51DECAFE] as const
const phases = { preflop: [0, 0], flop: [3, 1], turn: [4, 2], river: [5, 3] } as const

function seeded(seed: number): () => number {
  let value = seed >>> 0
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x1_0000_0000 }
}

function roster(stacks: readonly number[]): MatchPlayer[] {
  return stacks.map((bankroll, seat) => ({ id: `p${seat}`, name: `P${seat}`, kind: 'cpu', seat, bankroll: chips(bankroll), isEliminated: bankroll === 0 }))
}

function diagnostic(seed: number, matchNumber: number, transition: number, state: MatchState, action?: PlayerAction): string {
  const hand = state.hand
  return JSON.stringify({ seed: `0x${seed.toString(16)}`, matchNumber, handNumber: state.handNumber, transition, phase: hand?.phase, actingSeat: hand?.actingSeat, legalActions: hand?.actingSeat === undefined || hand.phase === 'complete' ? undefined : legalActions(state, hand.actingSeat), selectedAction: action, stacks: hand?.players.map(({ seat, stack, streetContribution, totalContribution }) => ({ seat, stack, streetContribution, totalContribution })), currentWager: hand?.currentBet, reopening: hand?.raiseReopenAt, pots: hand?.pots, history: hand?.history.slice(-8) })
}

function assertCards(hand: HandState): void {
  const expected = hand.phase === 'complete' && !hand.showdown ? undefined : phases[hand.phase as keyof typeof phases]
  if (expected !== undefined) {
    expect([hand.board.length, hand.burnedCards.length]).toEqual(expected)
  }
  const cards = [...hand.players.flatMap((player) => player.holeCards), ...hand.board, ...hand.burnedCards, ...hand.deck.cards]
  expect(cards).toHaveLength(52)
  expect(new Set(cards.map(cardKey)).size).toBe(52)
  for (const card of cards) expect(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']).toContain(card.rank)
  expect(hand.players.filter((player) => !player.isEliminated && player.startingStack > 0).every((player) => player.holeCards.length === 2)).toBe(true)
  expect(hand.players.filter((player) => player.isEliminated).every((player) => player.holeCards.length === 0)).toBe(true)
}

function assertTransition(state: MatchState, seed: number, matchNumber: number, transition: number, action?: PlayerAction): void {
  const hand = state.hand
  try {
    assertChipConservation(state)
    for (const player of state.players) {
      expect(Number.isSafeInteger(player.bankroll)).toBe(true)
      expect(player.bankroll).toBeGreaterThanOrEqual(0)
    }
    if (hand === undefined) return
    for (const player of hand.players) for (const amount of [player.stack, player.streetContribution, player.totalContribution]) {
      expect(Number.isSafeInteger(amount)).toBe(true)
      expect(amount).toBeGreaterThanOrEqual(0)
    }
    assertCards(hand)
    if (hand.phase === 'complete') {
      expect(hand.actingSeat).toBeUndefined()
      expect(hand.pendingSeats).toEqual([])
      expect(hand.players.reduce((total, player) => total + player.stack, 0)).toBe(state.players.reduce((total, player) => total + player.bankroll, 0))
      if (state.matchWinnerSeat !== undefined) expect(state.players.filter((player) => !player.isEliminated)).toHaveLength(1)
      return
    }
    const actor = hand.players.find((player) => player.seat === hand.actingSeat)
    expect(actor).toBeDefined()
    expect(actor!.folded || actor!.allIn || actor!.isEliminated).toBe(false)
    const legal = legalActions(state, actor!.seat)
    expect(Object.values(legal).some((value) => value === true)).toBe(true)
    expect(hand.currentBet).toBe(Math.max(...hand.players.filter((player) => !player.folded).map((player) => player.streetContribution)))
    for (const value of Object.values(hand.raiseReopenAt)) expect(value).toBeGreaterThanOrEqual(0)
    for (const pot of buildPots(hand.players).pots) expect(pot.eligibleSeats.length).toBeGreaterThan(1)
    const publicView = projectPublicMatch(state, 0)
    expect(JSON.stringify(publicView)).not.toContain('raiseReopenAt')
    expect(JSON.stringify(publicView)).not.toContain('burnedCards')
    expect(JSON.stringify(publicView)).not.toContain('"deck"')
    if (actor!.kind === 'cpu') {
      const context = createCpuDecisionContext(state, actor!.seat)
      const serialized = JSON.stringify(context)
      for (const opponent of hand.players.filter((player) => player.seat !== actor!.seat)) for (const card of opponent.holeCards) expect(serialized).not.toContain(JSON.stringify(card))
    }
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\n${diagnostic(seed, matchNumber, transition, state, action)}`)
  }
}

function selectAction(state: MatchState, transition: number): PlayerAction {
  const legal = legalActions(state, state.hand!.actingSeat!)
  if (legal.canAllIn && transition % 17 === 0) return { type: 'all-in' }
  if (legal.canRaise && legal.minimumRaiseTo !== undefined && transition % 7 === 0) return { type: 'raise', to: legal.minimumRaiseTo }
  if (legal.canBet && legal.minimumBetTo !== undefined && transition % 11 === 0) return { type: 'bet', to: legal.minimumBetTo }
  if (legal.canFold && !legal.canCheck && transition % 5 === 0) return { type: 'fold' }
  return legal.canCheck ? { type: 'check' } : { type: 'call' }
}

describe('multi-seed deterministic correctness gate', () => {
  it('runs five reproducible seeds through multiple hands with legal actions and per-transition invariants', () => {
    let completedHands = 0
    let completedMatches = 0
    let multiHandMatches = 0
    let transitions = 0
    let threeToHeadsUp = 0
    const observed = { folds: 0, checks: 0, calls: 0, bets: 0, fullRaises: 0, shortAllInRaises: 0, allInCallsForLess: 0, fullAllIns: 0, sidePotHands: 0, tiedPots: 0, uncontestedWins: 0, showdowns: 0, eliminations: 0 }
    for (const seed of seeds) {
      const random = seeded(seed)
      let state = createMatch(roster([30, 20, 12]), { seatCount: 3, initialButton: 0, smallBlind: chips(1), bigBlind: chips(2) })
      let priorFunded = 3
      let handsInMatch = 0
      for (let hand = 0; hand < 12 && state.matchWinnerSeat === undefined; hand += 1) {
        state = startNextHand(state, random)
        assertTransition(state, seed, 1, transitions++)
        while (state.hand!.phase !== 'complete') {
          const before = state.hand!
          const action = selectAction(state, transitions)
          if (action.type === 'fold') observed.folds += 1
          if (action.type === 'check') observed.checks += 1
          if (action.type === 'call') observed.calls += 1
          if (action.type === 'bet') observed.bets += 1
          if (action.type === 'raise') observed.fullRaises += 1
          if (action.type === 'all-in') {
            const legal = legalActions(state, before.actingSeat!)
            if (legal.maximumTo <= before.currentBet) observed.allInCallsForLess += 1
            else if (before.currentBet > 0 && legal.maximumTo - before.currentBet < before.lastFullRaise) observed.shortAllInRaises += 1
            else observed.fullAllIns += 1
          }
          state = applyAction(state, state.hand!.actingSeat!, action)
          assertTransition(state, seed, 1, transitions++, action)
        }
        completedHands += 1
        handsInMatch += 1
        if (state.hand!.pots.length > 1) observed.sidePotHands += 1
        if (state.hand!.showdown) observed.showdowns += 1
        else observed.uncontestedWins += 1
        if (state.hand!.payouts.some((payout) => state.hand!.payouts.filter((candidate) => candidate.potIndex === payout.potIndex).length > 1)) observed.tiedPots += 1
        const funded = state.players.filter((player) => !player.isEliminated).length
        if (priorFunded === 3 && funded === 2) threeToHeadsUp += 1
        observed.eliminations += priorFunded - funded
        priorFunded = funded
      }
      if (state.matchWinnerSeat !== undefined) {
        completedMatches += 1
        if (handsInMatch > 1) multiHandMatches += 1
      }
    }
    for (let repetition = 0; repetition < 3; repetition += 1) {
      let shortRaise = startNextHand(createMatch(roster([1_000, 1_000, 1_000, 1_000, 125, 1_000]), { seatCount: 6, initialButton: 0, smallBlind: chips(1), bigBlind: chips(2) }), seeded(seeds[repetition]))
      shortRaise = applyAction(shortRaise, 3, { type: 'raise', to: chips(100) })
      assertTransition(shortRaise, seeds[repetition], 2, transitions++, { type: 'raise', to: chips(100) })
      shortRaise = applyAction(shortRaise, 4, { type: 'all-in' })
      observed.shortAllInRaises += 1
      assertTransition(shortRaise, seeds[repetition], 2, transitions++, { type: 'all-in' })

      let shortCall = startNextHand(createMatch(roster([1_000, 1_000, 1_000, 1_000, 75, 1_000]), { seatCount: 6, initialButton: 0, smallBlind: chips(1), bigBlind: chips(2) }), seeded(seeds[repetition]))
      shortCall = applyAction(shortCall, 3, { type: 'raise', to: chips(100) })
      assertTransition(shortCall, seeds[repetition], 3, transitions++, { type: 'raise', to: chips(100) })
      shortCall = applyAction(shortCall, 4, { type: 'all-in' })
      observed.allInCallsForLess += 1
      assertTransition(shortCall, seeds[repetition], 3, transitions++, { type: 'all-in' })
    }
    expect(completedHands).toBeGreaterThanOrEqual(25)
    expect(completedMatches).toBeGreaterThanOrEqual(5)
    expect(multiHandMatches).toBeGreaterThanOrEqual(5)
    expect(threeToHeadsUp).toBeGreaterThanOrEqual(1)
    expect({ completedHands, completedMatches, multiHandMatches, transitions, threeToHeadsUp, observed }).toEqual({
      completedHands: 37, completedMatches: 5, multiHandMatches: 5, transitions: 337, threeToHeadsUp: 5,
      observed: {
        folds: 21, checks: 151, calls: 77, bets: 10, fullRaises: 12, shortAllInRaises: 3,
        allInCallsForLess: 3, fullAllIns: 17, sidePotHands: 12, tiedPots: 0, uncontestedWins: 7,
        showdowns: 30, eliminations: 10,
      },
    })
  })
})
