import { describe, expect, it } from 'vitest'
import { chips } from '../game/types'
import { createMatch, startNextHand } from './engine'
import { projectPublicMatch } from './public'
import type { MatchPlayer } from './types'

function players(): MatchPlayer[] {
  return Array.from({ length: 6 }, (_, seat) => ({ id: `p${seat}`, name: `P${seat}`, kind: seat === 3 ? 'human' : 'cpu', seat, bankroll: chips(1_000_000), isEliminated: false }))
}

describe('public hand projection', () => {
  it('omits deck, burned cards, and unrevealed CPU hole-card properties', () => {
    const internal = startNextHand(createMatch(players()), () => 0.31)
    const projected = projectPublicMatch(internal, 3)
    const serialized = JSON.stringify(projected)

    expect('deck' in projected.hand!).toBe(false)
    expect('burnedCards' in projected.hand!).toBe(false)
    expect(projected.hand!.players.find((player) => player.seat === 3)?.revealedHoleCards).toHaveLength(2)
    expect(Object.hasOwn(projected.hand!.players.find((player) => player.seat === 0)!, 'revealedHoleCards')).toBe(false)
    expect(serialized).not.toContain('holeCards')
  })
})
