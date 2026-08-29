import { describe, expect, it } from 'vitest'
import { cardKey, createCard, formatCard, formatCardShort, isRedSuit } from './cards'
import { createStandardDeck, drawCards, hasUniqueCards, shuffleDeck } from './deck'

describe('card primitives', () => {
  it('creates and formats validated cards', () => {
    const card = createCard('A', 'hearts')

    expect(card).toEqual({ rank: 'A', suit: 'hearts' })
    expect(formatCard(card)).toBe('Ace of hearts')
    expect(formatCardShort(card)).toBe('A♥')
    expect(isRedSuit(card.suit)).toBe(true)
    expect(cardKey(card)).toBe('A-hearts')
  })

  it('rejects invalid card ranks and suits', () => {
    expect(() => createCard('1', 'spades')).toThrow('Invalid card')
    expect(() => createCard('A', 'stars')).toThrow('Invalid card')
  })
})

describe('standard deck', () => {
  it('contains all 52 unique cards', () => {
    const deck = createStandardDeck()

    expect(deck.cards).toHaveLength(52)
    expect(hasUniqueCards(deck.cards)).toBe(true)
  })

  it('uses Fisher-Yates shuffling with an injectable random source', () => {
    const deck = createStandardDeck()
    const shuffled = shuffleDeck(deck, () => 0)

    expect(shuffled.cards).toHaveLength(52)
    expect(hasUniqueCards(shuffled.cards)).toBe(true)
    expect(shuffled.cards.map(cardKey)).not.toEqual(deck.cards.map(cardKey))
    expect(deck.cards[0]).toEqual(createCard('2', 'clubs'))
  })

  it('draws without replacing cards or mutating the source deck', () => {
    const deck = createStandardDeck()
    const firstDraw = drawCards(deck, 2)
    const secondDraw = drawCards(firstDraw.deck, 3)

    expect(firstDraw.drawn).toHaveLength(2)
    expect(secondDraw.drawn).toHaveLength(3)
    expect(firstDraw.deck.cards).toHaveLength(50)
    expect(secondDraw.deck.cards).toHaveLength(47)
    expect(hasUniqueCards([...firstDraw.drawn, ...secondDraw.drawn])).toBe(true)
    expect(deck.cards).toHaveLength(52)
  })

  it('rejects invalid draw counts and random values', () => {
    const deck = createStandardDeck()

    expect(() => drawCards(deck, 53)).toThrow('Cannot draw')
    expect(() => shuffleDeck(deck, () => 1)).toThrow('Random source')
  })
})
