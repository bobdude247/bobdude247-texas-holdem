import { chips, type ChipAmount, type SeatNumber } from '../game/types'
import type { HandPlayer, Pot } from './types'

export interface PotBuildResult {
  readonly pots: readonly Pot[]
  readonly returned: readonly { readonly seat: SeatNumber; readonly amount: ChipAmount }[]
}

export function buildPots(players: readonly Pick<HandPlayer, 'seat' | 'totalContribution' | 'folded'>[]): PotBuildResult {
  const levels = [...new Set(players.map((player) => player.totalContribution).filter((amount) => amount > 0))].sort((a, b) => a - b)
  const pots: Pot[] = []
  const returned: { seat: SeatNumber; amount: ChipAmount }[] = []
  let previous = 0

  for (const level of levels) {
    const contributors = players.filter((player) => player.totalContribution >= level)
    const amount = chips((level - previous) * contributors.length)
    if (contributors.length < 2) {
      returned.push({ seat: contributors[0].seat, amount })
    } else {
      pots.push({ amount, cap: chips(level), eligibleSeats: contributors.filter((player) => !player.folded).map((player) => player.seat) })
    }
    previous = level
  }
  return { pots, returned }
}

export function committedChips(players: readonly Pick<HandPlayer, 'totalContribution'>[]): ChipAmount {
  return chips(players.reduce((sum, player) => sum + player.totalContribution, 0))
}
