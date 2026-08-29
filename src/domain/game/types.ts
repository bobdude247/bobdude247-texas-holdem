export type ChipAmount = number & { readonly __brand: 'ChipAmount' }

export function chips(amount: number): ChipAmount {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`Chip amounts must be non-negative safe integers; received ${amount}.`)
  }

  return amount as ChipAmount
}

export type SeatNumber = number

export type PlayerKind = 'human' | 'cpu'

export interface Player {
  readonly id: string
  readonly name: string
  readonly kind: PlayerKind
  readonly seat: SeatNumber
  readonly bankroll: ChipAmount
  readonly isEliminated: boolean
}

export function addChips(...amounts: readonly ChipAmount[]): ChipAmount {
  return chips(amounts.reduce((total, amount) => total + amount, 0))
}

export function subtractChips(amount: ChipAmount, deduction: ChipAmount): ChipAmount {
  if (deduction > amount) {
    throw new Error('Chip deduction exceeds the available stack.')
  }

  return chips(amount - deduction)
}
