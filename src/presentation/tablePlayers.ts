import { chips } from '../domain/game/types'
import { createMatch } from '../domain/holdem/engine'
import type { MatchPlayer, MatchState } from '../domain/holdem/types'

export const humanSeat = 3

const players: readonly MatchPlayer[] = [
  { id: 'rock', name: 'The Rock', kind: 'cpu', seat: 0, bankroll: chips(10_000_000), isEliminated: false },
  { id: 'shark', name: 'The Shark', kind: 'cpu', seat: 1, bankroll: chips(10_000_000), isEliminated: false },
  { id: 'maniac', name: 'The Maniac', kind: 'cpu', seat: 2, bankroll: chips(10_000_000), isEliminated: false },
  { id: 'hero', name: 'bobdude247', kind: 'human', seat: humanSeat, bankroll: chips(10_000_000), isEliminated: false },
  { id: 'grinder', name: 'The Grinder', kind: 'cpu', seat: 4, bankroll: chips(10_000_000), isEliminated: false },
  { id: 'caller', name: 'The Caller', kind: 'cpu', seat: 5, bankroll: chips(10_000_000), isEliminated: false },
]

export function createTableMatch(): MatchState {
  return createMatch(players)
}
