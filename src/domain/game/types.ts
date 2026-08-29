export type ChipAmount = number & { readonly __brand: 'ChipAmount' }

export function chips(amount: number): ChipAmount {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`Chip amounts must be non-negative safe integers; received ${amount}.`)
  }

  return amount as ChipAmount
}

export type SeatNumber = 0 | 1 | 2 | 3 | 4 | 5

export type PlayerKind = 'human' | 'cpu'

export interface Player {
  readonly id: string
  readonly name: string
  readonly kind: PlayerKind
  readonly seat: SeatNumber
  readonly bankroll: ChipAmount
  readonly isEliminated: boolean
}
