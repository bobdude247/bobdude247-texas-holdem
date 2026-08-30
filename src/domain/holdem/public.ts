import type { Card } from '../cards'
import type { SeatNumber } from '../game/types'
import type { ActionEvent, HandPlayer, HandState, MatchPlayer, MatchState, Payout, Pot } from './types'

/** A UI-safe player view: it deliberately has no private cards or hand-start accounting. */
export interface PublicHandPlayer extends Omit<HandPlayer, 'holeCards' | 'startingStack'> {
  readonly revealedHoleCards?: readonly Card[]
}

export type PublicMatchPlayer = Pick<MatchPlayer, 'id' | 'name' | 'kind' | 'seat' | 'bankroll' | 'isEliminated'>

export interface PublicHandState extends Omit<HandState, 'deck' | 'burnedCards' | 'players' | 'raiseReopenAt'> {
  readonly players: readonly PublicHandPlayer[]
}

export interface PublicMatchState extends Omit<MatchState, 'hand' | 'players'> {
  readonly players: readonly PublicMatchPlayer[]
  readonly hand?: PublicHandState
}

function copyCard(card: Card): Card { return { ...card } }
function copyEvent(item: ActionEvent): ActionEvent { return { ...item } }
function copyPot(pot: Pot): Pot { return { ...pot, eligibleSeats: [...pot.eligibleSeats] } }
function copyPayout(payout: Payout): Payout { return { ...payout } }

function revealed(player: HandPlayer, hand: HandState, viewerSeat: SeatNumber): readonly Card[] | undefined {
  if (player.seat === viewerSeat) return player.holeCards
  if (!hand.showdown) return undefined
  return hand.pots.some((pot: Pot) => pot.eligibleSeats.includes(player.seat)) ? player.holeCards : undefined
}

/**
 * Projection intended for UI consumers. It intentionally contains no deck, burns,
 * reopening bookkeeping, or unrevealed opponent cards. All nested values are copied
 * so a UI consumer cannot mutate the internal match through a retained reference.
 */
export function projectPublicMatch(match: MatchState, viewerSeat: SeatNumber): PublicMatchState {
  const publicMatch = { ...match, config: { ...match.config }, players: match.players.map((player) => ({ ...player })) }
  if (match.hand === undefined) return publicMatch
  const { deck: _deck, burnedCards: _burnedCards, players, raiseReopenAt: _raiseReopenAt, ...rest } = match.hand
  void _deck
  void _burnedCards
  void _raiseReopenAt
  return {
    ...publicMatch,
    hand: {
      ...rest,
      board: match.hand.board.map(copyCard),
      history: match.hand.history.map(copyEvent),
      pots: match.hand.pots.map(copyPot),
      payouts: match.hand.payouts.map(copyPayout),
      winners: [...match.hand.winners],
      players: players.map((handPlayer) => {
        const { holeCards: _holeCards, startingStack: _startingStack, ...player } = handPlayer
        void _holeCards
        void _startingStack
        const cards = revealed(handPlayer, match.hand!, viewerSeat)
        return cards === undefined ? player : { ...player, revealedHoleCards: cards.map(copyCard) }
      }),
    },
  }
}
