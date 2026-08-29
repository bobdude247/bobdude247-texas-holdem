import { describe, expect, it } from 'vitest'
import { createCard, type Card, type Suit } from './cards'
import {
  areExactTies,
  compareHands,
  evaluateBestHand,
  evaluateFiveCardHand,
  HandCategory,
} from './evaluator'

function cards(...values: string[]): Card[] {
  return values.map((value) => {
    const [rank, suit] = value.split('-')
    return createCard(rank, suit as Suit)
  })
}

describe('five-card hand categories', () => {
  it.each([
    ['high card', ['A-spades', 'J-hearts', '8-clubs', '5-diamonds', '2-spades'], HandCategory.HighCard, [14, 11, 8, 5, 2]],
    ['one pair', ['A-spades', 'A-hearts', 'J-clubs', '8-diamonds', '2-spades'], HandCategory.OnePair, [14, 11, 8, 2]],
    ['two pair', ['K-spades', 'K-hearts', '9-clubs', '9-diamonds', 'A-spades'], HandCategory.TwoPair, [13, 9, 14]],
    ['three of a kind', ['Q-spades', 'Q-hearts', 'Q-clubs', '9-diamonds', '2-spades'], HandCategory.ThreeOfAKind, [12, 9, 2]],
    ['straight', ['9-spades', '8-hearts', '7-clubs', '6-diamonds', '5-spades'], HandCategory.Straight, [9]],
    ['flush', ['A-hearts', 'J-hearts', '8-hearts', '5-hearts', '2-hearts'], HandCategory.Flush, [14, 11, 8, 5, 2]],
    ['full house', ['T-spades', 'T-hearts', 'T-clubs', '4-diamonds', '4-spades'], HandCategory.FullHouse, [10, 4]],
    ['four of a kind', ['J-spades', 'J-hearts', 'J-clubs', 'J-diamonds', '2-spades'], HandCategory.FourOfAKind, [11, 2]],
    ['straight flush', ['9-hearts', '8-hearts', '7-hearts', '6-hearts', '5-hearts'], HandCategory.StraightFlush, [9]],
    ['royal flush', ['A-spades', 'K-spades', 'Q-spades', 'J-spades', 'T-spades'], HandCategory.RoyalFlush, [14]],
  ])('evaluates %s', (_label, values, category, tiebreak) => {
    const hand = evaluateFiveCardHand(cards(...values))

    expect(hand.category).toBe(category)
    expect(hand.tiebreak).toEqual(tiebreak)
  })
})

describe('Texas Hold’em best-hand evaluation', () => {
  it('handles a wheel as a five-high straight', () => {
    const hand = evaluateBestHand(cards('A-spades', '2-hearts', '3-clubs', '4-diamonds', '5-spades', 'K-hearts', '9-clubs'))

    expect(hand.category).toBe(HandCategory.Straight)
    expect(hand.tiebreak).toEqual([5])
  })

  it('selects an ace-high straight from seven cards', () => {
    const hand = evaluateBestHand(cards('A-spades', 'K-hearts', 'Q-clubs', 'J-diamonds', 'T-spades', '9-hearts', '2-clubs'))

    expect(hand.category).toBe(HandCategory.Straight)
    expect(hand.tiebreak).toEqual([14])
  })

  it('uses the best five suited cards when six are available', () => {
    const hand = evaluateBestHand(cards('A-hearts', 'K-hearts', 'J-hearts', '8-hearts', '5-hearts', '2-hearts', 'Q-clubs'))

    expect(hand.category).toBe(HandCategory.Flush)
    expect(hand.tiebreak).toEqual([14, 13, 11, 8, 5])
  })

  it('chooses the best full house among multiple trips and pairs', () => {
    const hand = evaluateBestHand(cards('K-spades', 'K-hearts', 'K-clubs', 'Q-spades', 'Q-hearts', 'Q-clubs', '2-diamonds'))

    expect(hand.category).toBe(HandCategory.FullHouse)
    expect(hand.tiebreak).toEqual([13, 12])
  })

  it('compares two-pair kickers correctly', () => {
    const stronger = evaluateBestHand(cards('A-spades', 'A-hearts', 'K-clubs', 'K-diamonds', 'Q-spades'))
    const weaker = evaluateBestHand(cards('A-clubs', 'A-diamonds', 'K-spades', 'K-hearts', 'J-clubs'))

    expect(compareHands(stronger, weaker)).toBeGreaterThan(0)
  })

  it('detects a board-only tie for split-pot handling', () => {
    const board = cards('A-spades', 'K-hearts', 'Q-clubs', 'J-diamonds', 'T-spades')
    const first = evaluateBestHand([...board, ...cards('2-hearts', '3-clubs')])
    const second = evaluateBestHand([...board, ...cards('9-hearts', '9-clubs')])

    expect(areExactTies(first, second)).toBe(true)
  })

  it('finds a straight flush rather than an available lower category', () => {
    const hand = evaluateBestHand(cards('9-clubs', '8-clubs', '7-clubs', '6-clubs', '5-clubs', 'A-hearts', 'A-diamonds'))

    expect(hand.category).toBe(HandCategory.StraightFlush)
    expect(hand.tiebreak).toEqual([9])
  })

  it('rejects invalid evaluation inputs', () => {
    expect(() => evaluateBestHand(cards('A-spades', 'K-hearts', 'Q-clubs', 'J-diamonds'))).toThrow('five to seven')
    expect(() => evaluateBestHand(cards('A-spades', 'A-spades', 'Q-clubs', 'J-diamonds', 'T-spades'))).toThrow('unique')
  })
})
