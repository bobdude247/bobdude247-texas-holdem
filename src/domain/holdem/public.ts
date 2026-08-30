import type { Card } from '../cards'
import type { SeatNumber } from '../game/types'
import type { HandPlayer, HandState, MatchState, Pot } from './types'

export interface PublicHandPlayer extends Omit<HandPlayer, 'holeCards'> {
  readonly revealedHoleCards?: readonly Card[]
}

export interface PublicHandState extends Omit<HandState, 'deck' | 'burnedCards' | 'players' | 'raiseReopenAt'> {
  readonly players: readonly PublicHandPlayer[]
}

export interface PublicMatchState extends Omit<MatchState, 'hand'> {
  readonly hand?: PublicHandState
}

function revealed(player: HandPlayer, hand: HandState, viewerSeat: SeatNumber): readonly Card[] | undefined {
  if (player.seat === viewerSeat) return player.holeCards
  if (!hand.showdown) return undefined
  return hand.pots.some((pot: Pot) => pot.eligibleSeats.includes(player.seat)) ? player.holeCards : undefined
}

/** Projection intended for UI consumers. It intentionally contains no deck, burns, or unrevealed opponent cards. */
export function projectPublicMatch(match: MatchState, viewerSeat: SeatNumber): PublicMatchState {
  if (match.hand === undefined) return { ...match }
  const { deck: _deck, burnedCards: _burnedCards, players, raiseReopenAt: _raiseReopenAt, ...rest } = match.hand
  void _deck
  void _burnedCards
  void _raiseReopenAt
  return {
    ...match,
    hand: {
      ...rest,
      players: players.map((handPlayer) => {
        const { holeCards: _holeCards, ...player } = handPlayer
        void _holeCards
        const cards = revealed(handPlayer, match.hand!, viewerSeat)
        return cards === undefined ? player : { ...player, revealedHoleCards: cards }
      }),
    },
  }
}
