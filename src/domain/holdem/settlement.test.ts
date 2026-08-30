import { describe, expect, it } from 'vitest'
import { assertChipConservation } from './engine'
import { settleFixture } from './settlement.test-fixtures'

function payouts(state: ReturnType<typeof settleFixture>) {
  return state.hand!.payouts.map(({ seat, amount, potIndex }) => ({ seat, amount, potIndex }))
}

describe('deterministic payout settlement', () => {
  it('awards three all-in depths to three different winners', () => {
    const state = settleFixture({
      board: ['4h', '5s', '6c', '9s', 'Kc'],
      players: [
        { seat: 0, contribution: 100, cards: ['7c', '8d'] },
        { seat: 1, contribution: 200, cards: ['2c', '3d'] },
        { seat: 2, contribution: 300, cards: ['Kh', 'Kd'] },
        { seat: 3, contribution: 300, cards: ['9h', '9d'] },
      ],
      settlingSeat: 3,
    })

    expect(state.hand!.pots.map((pot) => pot.amount)).toEqual([400, 300, 200])
    expect(payouts(state)).toEqual([
      { seat: 0, amount: 400, potIndex: 0 },
      { seat: 1, amount: 300, potIndex: 1 },
      { seat: 2, amount: 200, potIndex: 2 },
    ])
    assertChipConservation(state)
  })

  it('keeps folded contributions in the pot but excludes the folded player', () => {
    const state = settleFixture({
      board: ['2c', '3d', '4h', '9s', 'Kc'],
      players: [
        { seat: 0, contribution: 100, cards: ['As', 'Ad'], folded: true },
        { seat: 1, contribution: 100, cards: ['5s', '6h'] },
        { seat: 2, contribution: 100, cards: ['Kh', 'Kd'] },
      ],
      settlingSeat: 2,
    })

    expect(state.hand!.pots).toEqual([{ amount: 300, cap: 100, eligibleSeats: [1, 2] }])
    expect(payouts(state)).toEqual([{ seat: 1, amount: 300, potIndex: 0 }])
    assertChipConservation(state)
  })

  it('assigns an odd main-pot chip left of the button among tied winners', () => {
    const state = settleFixture({
      button: 0,
      board: ['2c', '3d', '4h', 'Ks', 'Ah'],
      players: [
        { seat: 0, contribution: 101, cards: ['9c', '8c'] },
        { seat: 1, contribution: 101, cards: ['Qc', 'Jc'] },
        { seat: 2, contribution: 101, cards: ['Qd', 'Jd'] },
      ],
      settlingSeat: 0,
    })

    expect(payouts(state)).toEqual([
      { seat: 1, amount: 152, potIndex: 0 },
      { seat: 2, amount: 151, potIndex: 0 },
    ])
    assertChipConservation(state)
  })

  it('splits a tied side pot while awarding the main pot independently', () => {
    const state = settleFixture({
      board: ['2c', '3d', '4h', 'Ks', 'Ah'],
      players: [
        { seat: 0, contribution: 100, cards: ['5c', '6d'] },
        { seat: 1, contribution: 200, cards: ['Qc', 'Jc'] },
        { seat: 2, contribution: 200, cards: ['Qd', 'Jd'] },
        { seat: 3, contribution: 200, cards: ['9c', '8c'] },
      ],
      settlingSeat: 3,
    })

    expect(payouts(state)).toEqual([
      { seat: 0, amount: 400, potIndex: 0 },
      { seat: 1, amount: 150, potIndex: 1 },
      { seat: 2, amount: 150, potIndex: 1 },
    ])
    assertChipConservation(state)
  })

  it('splits a board-only tie', () => {
    const state = settleFixture({
      board: ['2c', '3d', '4h', '5s', '6c'],
      players: [
        { seat: 0, contribution: 101, cards: ['9c', '8c'] },
        { seat: 1, contribution: 101, cards: ['Qd', 'Jd'] },
      ],
      settlingSeat: 0,
    })

    expect(payouts(state)).toEqual([
      { seat: 1, amount: 101, potIndex: 0 },
      { seat: 0, amount: 101, potIndex: 0 },
    ])
    assertChipConservation(state)
  })

  it('returns unmatched excess before paying the contested pots', () => {
    const state = settleFixture({
      board: ['2c', '3d', '4h', '9s', 'Kc'],
      players: [
        { seat: 0, contribution: 100, cards: ['5s', '6h'] },
        { seat: 1, contribution: 200, cards: ['Kh', 'Kd'] },
        { seat: 2, contribution: 300, cards: ['9h', '9d'] },
      ],
      settlingSeat: 2,
    })

    expect(payouts(state)).toEqual([
      { seat: 0, amount: 300, potIndex: 0 },
      { seat: 1, amount: 200, potIndex: 1 },
    ])
    expect(state.hand!.players.find((player) => player.seat === 2)?.stack).toBe(101)
    expect(state.hand!.history).toContainEqual(expect.objectContaining({ type: 'return', seat: 2 }))
    assertChipConservation(state)
  })

  it('awards every committed chip to the last live player after folds', () => {
    const state = settleFixture({
      board: ['2c', '3d', '4h', '9s', 'Kc'],
      players: [
        { seat: 0, contribution: 100, cards: ['As', 'Ad'], folded: true },
        { seat: 1, contribution: 100, cards: ['Qd', 'Jd'], folded: true },
        { seat: 2, contribution: 100, cards: ['5s', '6h'] },
      ],
      settlingSeat: 2,
    })

    expect(state.hand!.showdown).toBe(false)
    expect(state.hand!.winners).toEqual([2])
    expect(payouts(state)).toEqual([{ seat: 2, amount: 300, potIndex: 0 }])
    assertChipConservation(state)
  })
})
