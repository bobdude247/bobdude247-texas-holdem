import { chips, type ChipAmount, type SeatNumber } from '../game/types'

export interface HoldemConfig {
  readonly seatCount: number
  readonly startingStack: ChipAmount
  readonly smallBlind: ChipAmount
  readonly bigBlind: ChipAmount
  readonly ante: ChipAmount
  readonly initialButton: SeatNumber
}

export const defaultHoldemConfig: HoldemConfig = {
  seatCount: 6,
  startingStack: chips(10_000_000),
  smallBlind: chips(25_000),
  bigBlind: chips(50_000),
  ante: chips(0),
  initialButton: 0,
}

export function createHoldemConfig(overrides: Partial<HoldemConfig> = {}): HoldemConfig {
  const config = { ...defaultHoldemConfig, ...overrides }
  if (!Number.isSafeInteger(config.seatCount) || config.seatCount < 2) {
    throw new Error('Hold’em requires at least two seats.')
  }
  if (config.smallBlind <= 0 || config.bigBlind < config.smallBlind) {
    throw new Error('Blind configuration is invalid.')
  }
  return config
}
