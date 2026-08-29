import { cardKey, type Card, type Rank } from './cards'

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export interface EvaluatedHand {
  readonly category: HandCategory
  readonly tiebreak: readonly number[]
  readonly cards: readonly Card[]
}

const rankValue: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

function descendingValues(cards: readonly Card[]): number[] {
  return cards.map((card) => rankValue[card.rank]).sort((left, right) => right - left)
}

function rankGroups(cards: readonly Card[]): readonly [number, number][] {
  const counts = new Map<number, number>()
  for (const value of descendingValues(cards)) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()].sort(([leftValue, leftCount], [rightValue, rightCount]) =>
    rightCount - leftCount || rightValue - leftValue,
  )
}

function straightHighCard(cards: readonly Card[]): number | undefined {
  const values = [...new Set(descendingValues(cards))]
  if (values.length !== 5) {
    return undefined
  }

  if (values.join(',') === '14,5,4,3,2') {
    return 5
  }

  return values[0] - values[4] === 4 ? values[0] : undefined
}

export function evaluateFiveCardHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length !== 5 || new Set(cards.map(cardKey)).size !== 5) {
    throw new Error('A five-card hand must contain exactly five unique cards.')
  }

  const values = descendingValues(cards)
  const groups = rankGroups(cards)
  const isFlush = cards.every((card) => card.suit === cards[0].suit)
  const straightHigh = straightHighCard(cards)

  if (isFlush && straightHigh !== undefined) {
    return {
      category: straightHigh === 14 ? HandCategory.RoyalFlush : HandCategory.StraightFlush,
      tiebreak: [straightHigh],
      cards,
    }
  }

  if (groups[0][1] === 4) {
    return { category: HandCategory.FourOfAKind, tiebreak: [groups[0][0], groups[1][0]], cards }
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { category: HandCategory.FullHouse, tiebreak: [groups[0][0], groups[1][0]], cards }
  }

  if (isFlush) {
    return { category: HandCategory.Flush, tiebreak: values, cards }
  }

  if (straightHigh !== undefined) {
    return { category: HandCategory.Straight, tiebreak: [straightHigh], cards }
  }

  if (groups[0][1] === 3) {
    return {
      category: HandCategory.ThreeOfAKind,
      tiebreak: [groups[0][0], groups[1][0], groups[2][0]],
      cards,
    }
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return { category: HandCategory.TwoPair, tiebreak: [groups[0][0], groups[1][0], groups[2][0]], cards }
  }

  if (groups[0][1] === 2) {
    return {
      category: HandCategory.OnePair,
      tiebreak: [groups[0][0], groups[1][0], groups[2][0], groups[3][0]],
      cards,
    }
  }

  return { category: HandCategory.HighCard, tiebreak: values, cards }
}

function fiveCardCombinations(cards: readonly Card[]): Card[][] {
  const combinations: Card[][] = []
  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            combinations.push([cards[first], cards[second], cards[third], cards[fourth], cards[fifth]])
          }
        }
      }
    }
  }
  return combinations
}

export function compareHands(left: EvaluatedHand, right: EvaluatedHand): number {
  if (left.category !== right.category) {
    return left.category - right.category
  }

  const length = Math.max(left.tiebreak.length, right.tiebreak.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left.tiebreak[index] ?? 0) - (right.tiebreak[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

export function evaluateBestHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7 || new Set(cards.map(cardKey)).size !== cards.length) {
    throw new Error('A Texas Hold’em evaluation requires five to seven unique cards.')
  }

  const hands = fiveCardCombinations(cards).map(evaluateFiveCardHand)
  return hands.reduce((best, hand) => (compareHands(hand, best) > 0 ? hand : best))
}

export function areExactTies(left: EvaluatedHand, right: EvaluatedHand): boolean {
  return compareHands(left, right) === 0
}
