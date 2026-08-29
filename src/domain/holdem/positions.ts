import type { SeatNumber } from '../game/types'

export function fundedSeats<T extends { readonly seat: SeatNumber; readonly bankroll?: number; readonly stack?: number; readonly isEliminated?: boolean }>(players: readonly T[]): SeatNumber[] {
  return players.filter((player) => !player.isEliminated && (player.bankroll ?? player.stack ?? 0) > 0).map((player) => player.seat)
}

export function nextSeat(seats: readonly SeatNumber[], from: SeatNumber): SeatNumber {
  const sorted = [...seats].sort((left, right) => left - right)
  const next = sorted.find((seat) => seat > from)
  if (next === undefined && sorted[0] === undefined) throw new Error('No eligible seat exists.')
  return next ?? sorted[0]
}

export function orderedFromLeftOf(seats: readonly SeatNumber[], button: SeatNumber): SeatNumber[] {
  const result: SeatNumber[] = []
  let current = button
  for (let index = 0; index < seats.length; index += 1) {
    current = nextSeat(seats, current)
    result.push(current)
  }
  return result
}
