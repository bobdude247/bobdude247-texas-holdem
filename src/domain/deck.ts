import { cardKey, type Card, RANKS, SUITS } from './cards'
import { randomIndex, systemRandom, type RandomSource } from './random'

export interface Deck {
  readonly cards: readonly Card[]
}

export function createStandardDeck(): Deck {
  return {
    cards: SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))),
  }
}

export function shuffleDeck(deck: Deck, random: RandomSource = systemRandom): Deck {
  const cards = [...deck.cards]

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random)
    ;[cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]]
  }

  return { cards }
}

export interface DrawResult {
  readonly drawn: readonly Card[]
  readonly deck: Deck
}

export function drawCards(deck: Deck, count = 1): DrawResult {
  if (!Number.isSafeInteger(count) || count < 0 || count > deck.cards.length) {
    throw new Error(`Cannot draw ${count} cards from a ${deck.cards.length}-card deck.`)
  }

  return {
    drawn: deck.cards.slice(0, count),
    deck: { cards: deck.cards.slice(count) },
  }
}

export function hasUniqueCards(cards: readonly Card[]): boolean {
  return new Set(cards.map(cardKey)).size === cards.length
}
