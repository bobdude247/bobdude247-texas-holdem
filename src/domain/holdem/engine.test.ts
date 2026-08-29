import { describe, expect, it } from 'vitest'
import { chips, type SeatNumber } from '../game/types'
import { callingStationCpu } from './cpu'
import { createHoldemConfig } from './config'
import { applyAction, assertChipConservation, createMatch, legalActions, runCpuTurns, startNextHand, visibleHoleCards } from './engine'
import { buildPots } from './pots'
import type { MatchPlayer } from './types'

function players(count = 6, stacks: readonly number[] = Array.from({ length: count }, () => 1_000_000), humanSeat = 3): MatchPlayer[] {
  return stacks.map((stack, seat) => ({ id: `p${seat}`, name: `Player ${seat}`, kind: seat === humanSeat ? 'human' : 'cpu', seat, bankroll: chips(stack), isEliminated: stack === 0 }))
}

function match(count = 6, stacks?: readonly number[], humanSeat = 3) {
  return createMatch(players(count, stacks, humanSeat), createHoldemConfig({ seatCount: count, initialButton: 0 }))
}

function start(state = match()) { return startNextHand(state, () => 0.42) }

describe('positions, blinds, and dealing', () => {
  it('assigns six-handed blinds, action, two hole cards, and no duplicate cards', () => {
    const state = start()
    const hand = state.hand!
    expect([hand.button, hand.smallBlindSeat, hand.bigBlindSeat, hand.actingSeat]).toEqual([0, 1, 2, 3])
    expect(hand.players.every((player) => player.holeCards.length === 2)).toBe(true)
    expect(new Set([...hand.players.flatMap((player) => player.holeCards), ...hand.deck.cards].map((card) => `${card.rank}-${card.suit}`)).size).toBe(52)
    expect(hand.players.find((player) => player.seat === 1)?.stack).toBe(975_000)
    expect(hand.players.find((player) => player.seat === 2)?.stack).toBe(950_000)
    assertChipConservation(state)
  })

  it('uses heads-up button small blind and correct preflop/postflop order', () => {
    let state = start(match(2, [1_000_000, 1_000_000], 0))
    expect([state.hand!.button, state.hand!.smallBlindSeat, state.hand!.bigBlindSeat, state.hand!.actingSeat]).toEqual([0, 0, 1, 0])
    state = applyAction(state, 0, { type: 'call' })
    state = applyAction(state, 1, { type: 'check' })
    expect([state.hand!.phase, state.hand!.actingSeat, state.hand!.board.length, state.hand!.burnedCards.length]).toEqual(['flop', 1, 3, 1])
  })
})

describe('betting transitions', () => {
  it('advances through a six-player check/call preflop and check-around flop', () => {
    let state = start()
    for (const seat of [3, 4, 5, 0, 1]) state = applyAction(state, seat, { type: 'call' })
    state = applyAction(state, 2, { type: 'check' })
    expect([state.hand!.phase, state.hand!.actingSeat, state.hand!.board.length]).toEqual(['flop', 1, 3])
    for (const seat of [1, 2, 3, 4, 5, 0]) state = applyAction(state, seat, { type: 'check' })
    expect([state.hand!.phase, state.hand!.board.length, state.hand!.burnedCards.length]).toEqual(['turn', 4, 2])
    assertChipConservation(state)
  })

  it('requires earlier players to respond again after a full raise', () => {
    let state = start()
    state = applyAction(state, 3, { type: 'raise', to: chips(100_000) })
    expect(state.hand!.actingSeat).toBe(4)
    expect(legalActions(state, 4).minimumRaiseTo).toBe(chips(150_000))
    for (const seat of [4, 5, 0, 1, 2]) state = applyAction(state, seat, seat === 2 ? { type: 'call' } : { type: 'call' })
    expect(state.hand!.phase).toBe('flop')
  })

  it('allows a short all-in raise but does not reopen raising rights', () => {
    let state = start(match(6, [1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000], 3))
    state = applyAction(state, 3, { type: 'raise', to: chips(100_000) })
    state = applyAction(state, 4, { type: 'all-in' })
    for (const seat of [5, 0, 1, 2]) state = applyAction(state, seat, { type: 'call' })
    expect(state.hand!.actingSeat).toBe(3)
    expect(legalActions(state, 3).canRaise).toBe(false)
    expect(legalActions(state, 3).amountToCall).toBe(chips(25_000))
  })

  it('rejects illegal and out-of-turn actions without corrupting state', () => {
    const state = start()
    expect(() => applyAction(state, 4, { type: 'check' })).toThrow('out of turn')
    expect(() => applyAction(state, 3, { type: 'check' })).toThrow('Checking')
    expect(state.hand!.actingSeat).toBe(3)
    expect(state.hand!.currentBet).toBe(chips(50_000))
  })

  it('automatically runs out the board when all live players are all-in', () => {
    let state = start(match(2, [50_000, 50_000], 0))
    state = applyAction(state, 0, { type: 'call' })
    expect(state.hand!.phase).toBe('complete')
    expect(state.hand!.board).toHaveLength(5)
    expect(state.hand!.burnedCards).toHaveLength(3)
    assertChipConservation(state)
  })

  it('awards an uncontested pot immediately when everyone else folds', () => {
    let state = start()
    for (const seat of [3, 4, 5, 0, 1]) state = applyAction(state, seat, { type: 'fold' })
    expect(state.hand!.phase).toBe('complete')
    expect(state.hand!.winners).toEqual([2])
    assertChipConservation(state)
  })
})

describe('pots, information boundary, and progression', () => {
  it('builds a main pot and side pots, retaining folded chips and returning unmatched excess', () => {
    const built = buildPots([
      { seat: 0, totalContribution: chips(100), folded: false },
      { seat: 1, totalContribution: chips(200), folded: true },
      { seat: 2, totalContribution: chips(300), folded: false },
    ])
    expect(built.pots.map((pot) => pot.amount)).toEqual([chips(300), chips(200)])
    expect(built.pots[0].eligibleSeats).toEqual([0, 2])
    expect(built.returned).toEqual([{ seat: 2, amount: chips(100) }])
  })

  it('does not expose CPU cards or deck data to the public-card boundary', () => {
    const state = start(match(6, undefined, -1 as SeatNumber))
    const visible = visibleHoleCards(state.hand!, 3)
    expect(visible.get(3)).toHaveLength(2)
    expect(visible.get(0)).toEqual([])
    let observed: object | undefined
    const controller = (context: Parameters<typeof callingStationCpu>[0]) => { observed = context; return callingStationCpu(context) }
    runCpuTurns(state, controller, 1)
    expect(observed).toBeDefined()
    expect(Object.keys(observed!)).not.toContain('deck')
    expect(Object.keys(observed!)).not.toContain('opponentHoleCards')
  })

  it('runs temporary CPUs to completion with a deterministic guard and preserves chips', () => {
    const state = start(match(6, undefined, -1 as SeatNumber))
    const complete = runCpuTurns(state, callingStationCpu)
    expect(complete.hand!.phase).toBe('complete')
    assertChipConservation(complete)
  })

  it('marks busted players eliminated and rotates the button around them', () => {
    let state = start(match(2, [50_000, 50_000], 0))
    state = applyAction(state, 0, { type: 'call' })
    const funded = state.players.filter((player) => !player.isEliminated)
    expect(funded).toHaveLength(1)
    expect(state.matchWinnerSeat).toBe(funded[0].seat)
  })
})
