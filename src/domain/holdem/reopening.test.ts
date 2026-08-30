import { describe, expect, it } from 'vitest'
import { chips } from '../game/types'
import { applyAction, createMatch, legalActions, startNextHand } from './engine'
import type { MatchPlayer, MatchState } from './types'

function match(stacks: readonly number[]): MatchState {
  const players: MatchPlayer[] = stacks.map((stack, seat) => ({
    id: `p${seat}`,
    name: `Player ${seat}`,
    kind: seat === 3 ? 'human' : 'cpu',
    seat,
    bankroll: chips(stack),
    isEliminated: stack === 0,
  }))
  return createMatch(players, { seatCount: stacks.length, initialButton: 0 })
}

function start(stacks: readonly number[]): MatchState {
  return startNextHand(match(stacks), () => 0.42)
}

function openToOneHundred(stacks: readonly number[]): MatchState {
  return applyAction(start(stacks), 3, { type: 'raise', to: chips(100_000) })
}

function callThroughBigBlind(state: MatchState, amount: number, seats: readonly number[] = [5, 0, 1, 2]): MatchState {
  let next = state
  for (const seat of seats) next = applyAction(next, seat, { type: 'call' })
  expect(next.hand!.actingSeat).toBe(3)
  expect(next.hand!.currentBet).toBe(chips(amount))
  return next
}

describe('per-player cumulative short-all-in reopening', () => {
  it('1. records an individual reopen threshold after a full raise', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000])
    expect(state.hand!.raiseReopenAt[3]).toBe(chips(150_000))
    expect(state.hand!.raiseReopenAt[4]).toBe(chips(0))

    state = applyAction(state, 4, { type: 'all-in' })
    expect(state.hand!.currentBet).toBe(chips(125_000))
    expect(state.hand!.raiseReopenAt[3]).toBe(chips(150_000))
    expect(state.hand!.raiseReopenAt[4]).toBe(chips(175_000))
  })

  it('2. keeps a prior raiser closed after one short all-in', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = callThroughBigBlind(state, 125_000)

    const legal = legalActions(state, 3)
    expect(legal.amountToCall).toBe(chips(25_000))
    expect(legal.canRaise).toBe(false)
    expect(legal.minimumRaiseTo).toBeUndefined()
  })

  it('3. reopens a prior raiser when two short all-ins cumulatively equal a full raise', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 150_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = applyAction(state, 5, { type: 'all-in' })
    state = callThroughBigBlind(state, 150_000, [0, 1, 2])

    const legal = legalActions(state, 3)
    expect(state.hand!.raiseReopenAt[3]).toBe(chips(150_000))
    expect(legal.canRaise).toBe(true)
    expect(legal.minimumRaiseTo).toBe(chips(200_000))
  })

  it('4. keeps a prior raiser closed when cumulative short all-ins remain below a full raise', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 149_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = applyAction(state, 5, { type: 'all-in' })
    state = callThroughBigBlind(state, 149_000, [0, 1, 2])

    expect(legalActions(state, 3).canRaise).toBe(false)
  })

  it('5. reopens a prior raiser when cumulative short all-ins exceed a full raise', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 151_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = applyAction(state, 5, { type: 'all-in' })
    state = callThroughBigBlind(state, 151_000, [0, 1, 2])

    expect(legalActions(state, 3).canRaise).toBe(true)
  })

  it('6. preserves normal raising rights for a player who has not acted', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000])
    state = applyAction(state, 4, { type: 'all-in' })

    expect(state.hand!.actingSeat).toBe(5)
    expect(legalActions(state, 5).minimumRaiseTo).toBe(chips(175_000))
    state = applyAction(state, 5, { type: 'raise', to: chips(175_000) })
    expect(state.hand!.currentBet).toBe(chips(175_000))
  })

  it('7. rejects an all-in raise by a player whose raising right remains closed', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = callThroughBigBlind(state, 125_000)

    expect(legalActions(state, 3).canAllIn).toBe(false)
    expect(() => applyAction(state, 3, { type: 'all-in' })).toThrow('All-in is not legal')
    expect(state.hand!.currentBet).toBe(chips(125_000))
  })

  it('8. lets a full raise reopen a player who previously called', () => {
    let state = start([1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000])
    state = applyAction(state, 3, { type: 'call' })
    state = applyAction(state, 4, { type: 'raise', to: chips(100_000) })
    for (const seat of [5, 0, 1, 2]) state = applyAction(state, seat, { type: 'call' })

    expect(state.hand!.actingSeat).toBe(3)
    expect(state.hand!.raiseReopenAt[3]).toBe(chips(0))
    expect(legalActions(state, 3).canRaise).toBe(true)
  })

  it('9. lets a full raise after a short all-in reset reopening rights', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = applyAction(state, 5, { type: 'raise', to: chips(175_000) })
    for (const seat of [0, 1, 2]) state = applyAction(state, seat, { type: 'call' })

    expect(state.hand!.actingSeat).toBe(3)
    expect(state.hand!.raiseReopenAt[3]).toBe(chips(0))
    expect(legalActions(state, 3).canRaise).toBe(true)
  })

  it('10. resets all reopen thresholds on the next street', () => {
    let state = openToOneHundred([1_000_000, 1_000_000, 1_000_000, 1_000_000, 125_000, 1_000_000])
    state = applyAction(state, 4, { type: 'all-in' })
    state = callThroughBigBlind(state, 125_000)
    state = applyAction(state, 3, { type: 'call' })

    expect(state.hand!.phase).toBe('flop')
    expect(Object.values(state.hand!.raiseReopenAt)).toEqual(Array(6).fill(chips(0)))
    expect(state.hand!.actingSeat).toBe(1)
    expect(legalActions(state, 1).canBet).toBe(true)
  })
})
