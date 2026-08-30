import { createCard, type Card } from '../cards'
import { chips, type ChipAmount, type SeatNumber } from '../game/types'
import { createHoldemConfig } from './config'
import { applyAction } from './engine'
import type { HandPlayer, MatchState } from './types'

export interface SettlementFixturePlayer {
  readonly seat: SeatNumber
  readonly contribution: number
  readonly cards: readonly [string, string]
  readonly folded?: boolean
}

export interface SettlementFixture {
  readonly players: readonly SettlementFixturePlayer[]
  readonly board: readonly [string, string, string, string, string]
  readonly button?: SeatNumber
  readonly settlingSeat: SeatNumber
}

function card(notation: string): Card {
  const rank = notation.slice(0, -1)
  const suit = ({ c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const)[notation.slice(-1) as 'c' | 'd' | 'h' | 's']
  if (suit === undefined) throw new Error(`Invalid fixture card: ${notation}.`)
  return createCard(rank, suit)
}

function fixturePlayer(player: SettlementFixturePlayer, settlingSeat: SeatNumber): HandPlayer {
  const stack = chips(player.seat === settlingSeat ? 1 : 0)
  const folded = player.folded ?? false
  const bankroll = chips(player.contribution + stack)
  return {
    id: `p${player.seat}`,
    name: `Player ${player.seat}`,
    kind: 'cpu',
    seat: player.seat,
    bankroll,
    isEliminated: false,
    stack,
    startingStack: bankroll,
    holeCards: player.cards.map(card),
    streetContribution: chips(0),
    totalContribution: chips(player.contribution),
    folded,
    allIn: player.seat !== settlingSeat,
  }
}

/** Creates a river state whose final check reaches the normal engine settlement path. */
export function settleFixture(fixture: SettlementFixture): MatchState {
  const button = fixture.button ?? 0
  const handPlayers = fixture.players.map((player) => fixturePlayer(player, fixture.settlingSeat))
  const matchPlayers = handPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    kind: player.kind,
    seat: player.seat,
    bankroll: player.bankroll,
    isEliminated: player.isEliminated,
  }))
  const config = createHoldemConfig({ seatCount: fixture.players.length, initialButton: button, smallBlind: chips(1), bigBlind: chips(2) })
  const zero: ChipAmount = chips(0)
  const state: MatchState = {
    config,
    handNumber: 1,
    button,
    players: matchPlayers,
    hand: {
      id: 1,
      phase: 'river',
      button,
      smallBlindSeat: 0,
      bigBlindSeat: 1,
      players: handPlayers,
      deck: { cards: [] },
      burnedCards: [],
      board: fixture.board.map(card),
      showdown: false,
      actingSeat: fixture.settlingSeat,
      currentBet: zero,
      lastFullRaise: zero,
      pendingSeats: [fixture.settlingSeat],
      raiseAllowedSeats: [fixture.settlingSeat],
      history: [],
      pots: [],
      payouts: [],
      winners: [],
    },
  }
  return applyAction(state, fixture.settlingSeat, { type: 'check' })
}
