import { describe, expect, it } from 'vitest'
import { chips } from '../game/types'
import { assertChipConservation, createMatch, runCpuTurns, startNextHand } from './engine'
import type { CpuController, MatchPlayer } from './types'

function seeded(seed: number): () => number {
  let value = seed >>> 0
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x1_0000_0000 }
}

describe('seeded legal-action stress', () => {
  it('preserves safe non-negative chips through 25 reproducible CPU hands', () => {
    const roster: MatchPlayer[] = Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, name: `P${seat}`, kind: 'cpu', seat, bankroll: chips(500_000), isEliminated: false }))
    const random = seeded(0xC0FFEE)
    let counter = 0
    const controller: CpuController = ({ legalActions }) => {
      counter += 1
      if (legalActions.canAllIn && counter % 19 === 0) return { type: 'all-in' }
      if (legalActions.canRaise && legalActions.minimumRaiseTo !== undefined && counter % 11 === 0) return { type: 'raise', to: legalActions.minimumRaiseTo }
      if (legalActions.canFold && !legalActions.canCheck && counter % 7 === 0) return { type: 'fold' }
      return legalActions.canCheck ? { type: 'check' } : { type: 'call' }
    }
    let match = createMatch(roster)
    for (let hand = 0; hand < 25 && match.matchWinnerSeat === undefined; hand += 1) {
      match = startNextHand(match, random)
      assertChipConservation(match)
      match = runCpuTurns(match, controller, 200)
      assertChipConservation(match)
      for (const player of match.hand!.players) {
        expect(Number.isSafeInteger(player.stack)).toBe(true)
        expect(player.stack).toBeGreaterThanOrEqual(0)
        expect(player.totalContribution).toBeGreaterThanOrEqual(0)
      }
      const cards = [...match.hand!.players.flatMap((player) => player.holeCards), ...match.hand!.board, ...match.hand!.burnedCards, ...match.hand!.deck.cards]
      expect(new Set(cards.map((card) => `${card.rank}-${card.suit}`)).size).toBe(52)
    }
  })
})
