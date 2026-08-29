export type RandomSource = () => number

export const systemRandom: RandomSource = () => Math.random()

export function randomIndex(length: number, random: RandomSource): number {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error(`Cannot choose an index from length ${length}.`)
  }

  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`Random source must return a finite value in [0, 1); received ${value}.`)
  }

  return Math.floor(value * length)
}
