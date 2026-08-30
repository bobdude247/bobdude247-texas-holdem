import { describe, expect, it } from 'vitest'
import { cardKey, type Card } from '../cards'
import { chips, type SeatNumber } from '../game/types'
import { applyAction, createCpuDecisionContext, createMatch, legalActions, runCpuTurns, startNextHand } from './engine'
import { projectPublicMatch } from './public'
import type { CpuController, MatchPlayer, MatchState, PlayerAction } from './types'

function roster(count = 6, stacks: readonly number[] = Array.from({ length: count }, () => 100)): MatchPlayer[] {
  return stacks.map((bankroll, seat) => ({ id: `p${seat}`, name: `P${seat}`, kind: seat === 0 ? 'human' : 'cpu', seat, bankroll: chips(bankroll), isEliminated: bankroll === 0 }))
}

function begin(count = 6, stacks?: readonly number[]): MatchState {
  return startNextHand(createMatch(roster(count, stacks), { seatCount: count, initialButton: 0, smallBlind: chips(1), bigBlind: chips(2) }), () => 0.42)
}

function passiveAction(state: MatchState): PlayerAction {
  const legal = legalActions(state, state.hand!.actingSeat!)
  return legal.canCheck ? { type: 'check' } : { type: 'call' }
}

function advanceTo(state: MatchState, phase: 'flop' | 'turn' | 'river'): MatchState {
  let next = state
  while (next.hand!.phase !== phase) next = applyAction(next, next.hand!.actingSeat!, passiveAction(next))
  return next
}

function cardJson(card: Card): string { return JSON.stringify(card) }

function expectNoPrivateCards(state: MatchState, viewer: SeatNumber, forbidden: readonly Card[]) {
  const publicMatch = projectPublicMatch(state, viewer)
  const serialized = JSON.stringify(publicMatch)
  expect(publicMatch.players).not.toBe(state.players)
  if (state.hand !== undefined) {
    expect('deck' in publicMatch.hand!).toBe(false)
    expect('burnedCards' in publicMatch.hand!).toBe(false)
    expect('raiseReopenAt' in publicMatch.hand!).toBe(false)
    expect(publicMatch.hand!.players).not.toBe(state.hand.players)
    expect(publicMatch.hand!.board).not.toBe(state.hand.board)
  }
  for (const card of forbidden) expect(serialized).not.toContain(cardJson(card))
  return publicMatch
}

describe('public match lifecycle privacy', () => {
  it('A. before a hand exposes identities and bankrolls without card state', () => {
    const state = createMatch(roster())
    const publicMatch = expectNoPrivateCards(state, 0, [])
    expect(publicMatch.hand).toBeUndefined()
    expect(publicMatch.players).toHaveLength(6)
    expect(JSON.stringify(publicMatch)).not.toContain('holeCards')
  })

  it('B. active preflop exposes only the human hole cards', () => {
    const state = begin()
    const cpuCards = state.hand!.players.filter((player) => player.kind === 'cpu').flatMap((player) => player.holeCards)
    const publicMatch = expectNoPrivateCards(state, 0, [...cpuCards, ...state.hand!.deck.cards])
    expect(publicMatch.hand!.board).toEqual([])
    expect(publicMatch.hand!.players.find((player) => player.seat === 0)?.revealedHoleCards).toHaveLength(2)
    expect(publicMatch.hand!.players.filter((player) => player.kind === 'cpu').every((player) => !Object.hasOwn(player, 'revealedHoleCards'))).toBe(true)
  })

  it('C. flop exposes exactly three board cards and no future cards', () => {
    const state = advanceTo(begin(), 'flop')
    const publicMatch = expectNoPrivateCards(state, 0, [...state.hand!.deck.cards, ...state.hand!.burnedCards, ...state.hand!.players.filter((player) => player.kind === 'cpu').flatMap((player) => player.holeCards)])
    expect(publicMatch.hand!.board).toHaveLength(3)
  })

  it('D. turn exposes exactly four board cards and no river card', () => {
    const state = advanceTo(begin(), 'turn')
    const publicMatch = expectNoPrivateCards(state, 0, [...state.hand!.deck.cards, ...state.hand!.burnedCards])
    expect(publicMatch.hand!.board).toHaveLength(4)
  })

  it('E. river exposes exactly five board cards without unrevealed CPU cards', () => {
    const state = advanceTo(begin(), 'river')
    const publicMatch = expectNoPrivateCards(state, 0, [...state.hand!.deck.cards, ...state.hand!.burnedCards, ...state.hand!.players.filter((player) => player.kind === 'cpu').flatMap((player) => player.holeCards)])
    expect(publicMatch.hand!.board).toHaveLength(5)
  })

  it('F. folding never exposes a CPU hand under another property', () => {
    const state = applyAction(begin(), 3, { type: 'fold' })
    const folded = state.hand!.players.find((player) => player.seat === 3)!
    const publicMatch = expectNoPrivateCards(state, 0, folded.holeCards)
    expect(publicMatch.hand!.players.find((player) => player.seat === 3)).not.toHaveProperty('revealedHoleCards')
  })

  it('G. an all-in CPU remains hidden before showdown runout', () => {
    const state = applyAction(begin(4, [100, 100, 100, 3]), 3, { type: 'all-in' })
    const allIn = state.hand!.players.find((player) => player.seat === 3)!
    const publicMatch = expectNoPrivateCards(state, 0, [...allIn.holeCards, ...state.hand!.deck.cards, ...state.hand!.burnedCards])
    expect(allIn.allIn).toBe(true)
    expect(publicMatch.hand!.showdown).toBe(false)
  })

  it('H. showdown reveals only eligible non-folded hands', () => {
    let state = begin()
    state = applyAction(state, 3, { type: 'fold' })
    while (state.hand!.phase !== 'complete') state = applyAction(state, state.hand!.actingSeat!, passiveAction(state))
    const folded = state.hand!.players.find((player) => player.seat === 3)!
    const publicMatch = expectNoPrivateCards(state, 0, [...folded.holeCards, ...state.hand!.deck.cards, ...state.hand!.burnedCards])
    expect(publicMatch.hand!.showdown).toBe(true)
    expect(publicMatch.hand!.players.filter((player) => player.seat !== 3 && player.kind === 'cpu').every((player) => player.revealedHoleCards?.length === 2)).toBe(true)
  })

  it('I. uncontested completion never reveals the winner or folded opponent cards', () => {
    const state = applyAction(begin(2), 0, { type: 'fold' })
    const cpu = state.hand!.players.find((player) => player.seat === 1)!
    const publicMatch = expectNoPrivateCards(state, 0, [...cpu.holeCards, ...state.hand!.deck.cards, ...state.hand!.burnedCards])
    expect(publicMatch.hand!.showdown).toBe(false)
    expect(publicMatch.hand!.payouts).toHaveLength(1)
  })

  it('J. a next hand excludes eliminated seats and all prior public card state', () => {
    let state = begin(4, [10, 10, 1, 10])
    state = applyAction(state, 3, { type: 'fold' })
    state = applyAction(state, 0, { type: 'fold' })
    state = applyAction(state, 1, { type: 'check' })
    expect(state.players.find((player) => player.seat === 2)?.isEliminated).toBe(true)
    state = startNextHand(state, () => 0.42)
    const publicMatch = expectNoPrivateCards(state, 0, state.hand!.players.filter((player) => player.kind === 'cpu').flatMap((player) => player.holeCards))
    expect(publicMatch.hand!.board).toEqual([])
    expect(publicMatch.hand!.players.find((player) => player.seat === 2)?.revealedHoleCards).toBeUndefined()
  })

  it('K. terminal match projection contains final public stacks and a repeat start clears stale cards', () => {
    const complete = begin(2, [1, 2])
    expect(complete.matchWinnerSeat).toBeDefined()
    expectNoPrivateCards(complete, 0, [...complete.hand!.deck.cards, ...complete.hand!.burnedCards])
    const terminal = startNextHand(complete)
    const publicMatch = expectNoPrivateCards(terminal, 0, [])
    expect(publicMatch.hand).toBeUndefined()
    expect(publicMatch.matchWinnerSeat).toBeDefined()
  })

  it('uses owned public copies rather than retaining mutable internal references', () => {
    const state = begin()
    const publicMatch = projectPublicMatch(state, 0)
    const mutable = publicMatch as unknown as { players: Array<{ name: string }>; hand: { board: Card[]; players: Array<{ name: string; revealedHoleCards?: Card[] }> } }
    mutable.players[0].name = 'mutated viewer'
    mutable.hand.players[0].name = 'mutated hand viewer'
    mutable.hand.players[0].revealedHoleCards![0] = { rank: 'A', suit: 'spades' }
    expect(state.players[0].name).toBe('P0')
    expect(state.hand!.players[0].name).toBe('P0')
    expect(cardKey(state.hand!.players[0].holeCards[0])).not.toBe('A-spades')
  })
})

describe('CPU decision-context boundary', () => {
  function expectCpuContext(state: MatchState, seat: SeatNumber) {
    const context = createCpuDecisionContext(state, seat)
    const hand = state.hand!
    const actor = hand.players.find((player) => player.seat === seat)!
    expect(context.holeCards).toEqual(actor.holeCards)
    expect(context.holeCards).not.toBe(actor.holeCards)
    expect(context.board).toEqual(hand.board)
    expect(context.board).not.toBe(hand.board)
    expect(Object.keys(context)).not.toContain('deck')
    expect(Object.keys(context)).not.toContain('burnedCards')
    expect(Object.keys(context)).not.toContain('raiseReopenAt')
    const serialized = JSON.stringify(context)
    for (const player of hand.players.filter((player) => player.seat !== seat)) for (const card of player.holeCards) expect(serialized).not.toContain(cardJson(card))
    expect(context.players).not.toBe(hand.players)
    return context
  }

  it('allows only the acting CPU private cards across preflop, streets, all-ins, and next hands', () => {
    let state = begin()
    expectCpuContext(state, 3)
    state = advanceTo(state, 'flop')
    expectCpuContext(state, 1)
    state = advanceTo(state, 'turn')
    expectCpuContext(state, 1)
    state = advanceTo(state, 'river')
    expectCpuContext(state, 1)

    state = applyAction(begin(4, [100, 100, 100, 3]), 3, { type: 'all-in' })
    state = applyAction(state, 0, { type: 'call' })
    expectCpuContext(state, 1)

    let next = begin(4, [10, 10, 1, 10])
    next = applyAction(next, 3, { type: 'fold' })
    next = applyAction(next, 0, { type: 'fold' })
    next = applyAction(next, 1, { type: 'check' })
    next = startNextHand(next, () => 0.42)
    expectCpuContext(next, 1)
  })

  it('changes private cards with the acting CPU and owns every mutable context value', () => {
    const preflop = begin()
    const first = expectCpuContext(preflop, 3)
    const flop = advanceTo(preflop, 'flop')
    const second = expectCpuContext(flop, 1)
    expect(second.holeCards).not.toEqual(first.holeCards)

    const snapshot = structuredClone(flop)
    const mutable = second as unknown as {
      holeCards: Card[]; board: Card[]; legalActions: { maximumTo: number }; publicHistory: Array<{ text: string }>;
      players: Array<{ stack: number }>; pots: Array<{ eligibleSeats: number[] }>
    }
    mutable.holeCards[0] = { rank: 'A', suit: 'spades' }
    mutable.board[0] = { rank: 'K', suit: 'hearts' }
    mutable.legalActions.maximumTo = 0
    mutable.publicHistory[0].text = 'mutated'
    mutable.players[0].stack = 0
    if (mutable.pots[0] !== undefined) mutable.pots[0].eligibleSeats[0] = 99
    expect(flop).toEqual(snapshot)
  })

  it('does not call a CPU controller after showdown has completed', () => {
    const complete = begin(2, [1, 2])
    let invoked = false
    const controller: CpuController = () => { invoked = true; return { type: 'fold' } }
    expect(runCpuTurns(complete, controller)).toBe(complete)
    expect(invoked).toBe(false)
  })
})
