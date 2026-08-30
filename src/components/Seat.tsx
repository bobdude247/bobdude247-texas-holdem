import { formatChips } from '../presentation/format'
import { formatCardShort, isRedSuit } from '../domain/cards'
import type { PublicHandPlayer, PublicMatchPlayer } from '../domain/holdem/public'
import { PlayingCard } from './PlayingCard'

interface SeatProps {
  readonly player: PublicMatchPlayer | PublicHandPlayer
  readonly isDealer?: boolean
  readonly isSmallBlind?: boolean
  readonly isBigBlind?: boolean
  readonly isActing?: boolean
  readonly visibleCards?: readonly import('../domain/cards').Card[]
}

export function Seat({ player, isDealer = false, isSmallBlind = false, isBigBlind = false, isActing = false, visibleCards = [] }: SeatProps) {
  const isHuman = player.kind === 'human'
  const handPlayer = 'stack' in player ? player : undefined
  const bankroll = handPlayer?.stack ?? player.bankroll
  const cards = visibleCards.length === 2 ? visibleCards : undefined

  return (
    <article className={`seat seat--${player.seat}${isHuman ? ' seat--human' : ''}${isActing ? ' seat--acting' : ''}${handPlayer?.folded ? ' seat--folded' : ''}`}>
      <div className="seat__cards" aria-label={isHuman ? 'Your hole cards are not dealt yet' : `${player.name}'s hidden hole cards`}>
        {[0, 1].map((index) => cards === undefined ? <PlayingCard faceDown={!isHuman} key={index} label={isHuman ? 'Your hole-card placeholder' : 'Hidden hole card'} /> : <PlayingCard key={index} label={formatCardShort(cards[index])}><span className={isRedSuit(cards[index].suit) ? 'card-face card-face--red' : 'card-face'}>{formatCardShort(cards[index])}</span></PlayingCard>)}
      </div>
      <div className="seat__identity">
        <span className="seat__name">{player.name}</span>
        <span className="seat__role">{handPlayer?.folded ? 'Folded' : handPlayer?.allIn ? 'All-in' : player.isEliminated ? 'Eliminated' : isHuman ? 'You · Player' : 'CPU opponent'}</span>
        <strong className="seat__bankroll">{formatChips(bankroll)}</strong>
        {handPlayer !== undefined && handPlayer.streetContribution > 0 ? <span className="seat__commitment">In pot {formatChips(handPlayer.streetContribution)}</span> : null}
      </div>
      {isDealer ? <span aria-label="Dealer button" className="dealer-button">D</span> : null}
      {isSmallBlind ? <span className="blind-marker">SB</span> : null}
      {isBigBlind ? <span className="blind-marker blind-marker--big">BB</span> : null}
    </article>
  )
}
