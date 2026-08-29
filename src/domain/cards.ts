export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const
export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]

export interface Card {
  readonly rank: Rank
  readonly suit: Suit
}

const suitSymbols: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

const rankNames: Record<Rank, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  T: '10',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value)
}

export function isSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value)
}

export function createCard(rank: string, suit: string): Card {
  if (!isRank(rank) || !isSuit(suit)) {
    throw new Error(`Invalid card: ${rank} of ${suit}.`)
  }

  return { rank, suit }
}

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`
}

export function formatCard(card: Card): string {
  return `${rankNames[card.rank]} of ${card.suit}`
}

export function formatCardShort(card: Card): string {
  const rank = card.rank === 'T' ? '10' : card.rank
  return `${rank}${suitSymbols[card.suit]}`
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'diamonds' || suit === 'hearts'
}
