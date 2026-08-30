import type { Card } from '../cards'
import type { Deck } from '../deck'
import type { ChipAmount, PlayerKind, SeatNumber } from '../game/types'

export type HandPhase = 'awaiting-start' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete'
export type PlayerActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'

export interface MatchPlayer {
  readonly id: string
  readonly name: string
  readonly kind: PlayerKind
  readonly seat: SeatNumber
  readonly bankroll: ChipAmount
  readonly isEliminated: boolean
}

export interface HandPlayer extends MatchPlayer {
  readonly stack: ChipAmount
  readonly startingStack: ChipAmount
  readonly holeCards: readonly Card[]
  readonly streetContribution: ChipAmount
  readonly totalContribution: ChipAmount
  readonly folded: boolean
  readonly allIn: boolean
}

export interface ActionEvent {
  readonly type: 'blind' | 'action' | 'street' | 'payout' | 'return' | 'message'
  readonly text: string
  readonly seat?: SeatNumber
}

export interface LegalActions {
  readonly seat: SeatNumber
  readonly amountToCall: ChipAmount
  readonly cappedCallAmount: ChipAmount
  readonly canFold: boolean
  readonly canCheck: boolean
  readonly canCall: boolean
  readonly canBet: boolean
  readonly canRaise: boolean
  readonly canAllIn: boolean
  readonly minimumBetTo?: ChipAmount
  readonly minimumRaiseTo?: ChipAmount
  readonly maximumTo: ChipAmount
}

export interface PlayerAction {
  readonly type: PlayerActionKind
  /** Bet and raise values are total contributions for the current street, never increments. */
  readonly to?: ChipAmount
}

export interface Pot {
  readonly amount: ChipAmount
  readonly cap: ChipAmount
  readonly eligibleSeats: readonly SeatNumber[]
}

export interface Payout {
  readonly seat: SeatNumber
  readonly amount: ChipAmount
  readonly potIndex: number
}

export interface HandState {
  readonly id: number
  readonly phase: HandPhase
  readonly button: SeatNumber
  readonly smallBlindSeat: SeatNumber
  readonly bigBlindSeat: SeatNumber
  readonly players: readonly HandPlayer[]
  readonly deck: Deck
  /** Burned cards are retained for auditability but never exposed to the public UI. */
  readonly burnedCards: readonly Card[]
  readonly board: readonly Card[]
  readonly showdown: boolean
  readonly actingSeat?: SeatNumber
  readonly currentBet: ChipAmount
  readonly lastFullRaise: ChipAmount
  readonly pendingSeats: readonly SeatNumber[]
  /**
   * The lowest street contribution that reopens each player's right to raise.
   * A zero value means the player has not yet used their raising right this street.
   */
  readonly raiseReopenAt: Readonly<Record<SeatNumber, ChipAmount>>
  readonly lastAggressor?: SeatNumber
  readonly history: readonly ActionEvent[]
  readonly pots: readonly Pot[]
  readonly payouts: readonly Payout[]
  readonly winners: readonly SeatNumber[]
}

export interface MatchState {
  readonly config: import('./config').HoldemConfig
  readonly handNumber: number
  readonly button: SeatNumber
  readonly players: readonly MatchPlayer[]
  readonly hand?: HandState
  readonly matchWinnerSeat?: SeatNumber
}

export interface CpuDecisionContext {
  readonly seat: SeatNumber
  readonly holeCards: readonly Card[]
  readonly board: readonly Card[]
  readonly legalActions: LegalActions
  readonly publicHistory: readonly ActionEvent[]
  readonly players: readonly Pick<HandPlayer, 'seat' | 'stack' | 'streetContribution' | 'totalContribution' | 'folded' | 'allIn'>[]
  readonly pots: readonly Pot[]
  readonly button: SeatNumber
  readonly tendencies?: Readonly<Record<number, import('./tendencies').PublicTendencySnapshot>>
}

export type CpuController = (context: CpuDecisionContext) => PlayerAction
