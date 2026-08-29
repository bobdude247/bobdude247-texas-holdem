import type { ChipAmount } from '../domain/game/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatChips(amount: ChipAmount): string {
  return currencyFormatter.format(amount)
}
