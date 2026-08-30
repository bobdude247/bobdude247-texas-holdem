import { chips } from '../domain/game/types'
import { createMatch } from '../domain/holdem/engine'
import { cpuProfiles, type CpuPersonalityId } from '../domain/holdem/cpu'
import type { MatchPlayer, MatchState } from '../domain/holdem/types'

export const humanSeat = 3
export const tableCpuPersonalities: Readonly<Record<number, CpuPersonalityId>> = { 0: 'rock', 1: 'shark', 2: 'maniac', 4: 'grinder', 5: 'caller' }
export function personalityForPlayer(id: string) { return id in cpuProfiles ? cpuProfiles[id as CpuPersonalityId] : undefined }

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
