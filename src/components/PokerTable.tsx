import { formatCardShort, isRedSuit } from '../domain/cards'
import { chips } from '../domain/game/types'
import { buildPots } from '../domain/holdem/pots'
import { visibleHoleCards } from '../domain/holdem/engine'
import type { MatchState } from '../domain/holdem/types'
import { formatChips } from '../presentation/format'
import { PlayingCard } from './PlayingCard'
import { Seat } from './Seat'

interface PokerTableProps { readonly match: MatchState; readonly viewerSeat: number }

export function PokerTable({ match, viewerSeat }: PokerTableProps) {
  const hand = match.hand
  const players = hand?.players ?? match.players
  const visible = hand === undefined ? new Map() : visibleHoleCards(hand, viewerSeat)
  const pots = hand === undefined ? [] : buildPots(hand.players).pots
  const potTotal = chips(pots.reduce((total, pot) => total + pot.amount, 0))
  return (
    <section aria-label="Texas Hold'em table" className="table-stage">
      <div className="table-felt">
        <div className="table-felt__texture" />
        <div className="table-center">
          <p className="table-center__eyebrow">Current pot</p>
          <strong className="table-center__pot">{formatChips(potTotal)}</strong>
          <div aria-label="Community cards" className="community-cards">
            {Array.from({ length: 5 }, (_, index) => (
              hand?.board[index] === undefined ? <PlayingCard key={index} label={`Community card ${index + 1} placeholder`} /> : <PlayingCard key={index} label={formatCardShort(hand.board[index])}><span className={isRedSuit(hand.board[index].suit) ? 'card-face card-face--red' : 'card-face'}>{formatCardShort(hand.board[index])}</span></PlayingCard>
            ))}
          </div>
          {pots.length > 1 ? <p className="side-pot-label">{pots.length - 1} side pot{pots.length === 2 ? '' : 's'}</p> : null}
        </div>
        {players.map((player) => (
          <Seat isActing={hand?.actingSeat === player.seat} isBigBlind={hand?.bigBlindSeat === player.seat} isDealer={hand?.button === player.seat} isSmallBlind={hand?.smallBlindSeat === player.seat} key={player.id} player={player} visibleCards={visible.get(player.seat)} />
        ))}
      </div>
    </section>
  )
}
