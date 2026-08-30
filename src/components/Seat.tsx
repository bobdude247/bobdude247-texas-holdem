import { formatChips } from '../presentation/format'
import { formatCardShort, isRedSuit } from '../domain/cards'
import type { PublicHandPlayer, PublicMatchPlayer } from '../domain/holdem/public'
import { PlayingCard } from './PlayingCard'
import { personalityForPlayer } from '../presentation/tablePlayers'

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
  const bankrollLabel = formatChips(bankroll)
  const cards = visibleCards.length === 2 ? visibleCards : undefined
  const personality = personalityForPlayer(player.id)

  return (
    <article className={`seat seat--${player.seat}${isHuman ? ' seat--human' : ''}${isActing ? ' seat--acting' : ''}${handPlayer?.folded ? ' seat--folded' : ''}`}>
      <div className="seat__cards" aria-label={isHuman ? 'Your hole cards are not dealt yet' : `${player.name}'s hidden hole cards`}>
        {[0, 1].map((index) => cards === undefined ? <PlayingCard faceDown={!isHuman} key={index} label={isHuman ? 'Your hole-card placeholder' : 'Hidden hole card'} /> : <PlayingCard key={index} label={formatCardShort(cards[index])}><span className={isRedSuit(cards[index].suit) ? 'card-face card-face--red' : 'card-face'}>{formatCardShort(cards[index])}</span></PlayingCard>)}
      </div>
      <div className="seat__identity">
        <span className="seat__name">{player.name}</span>
        {personality === undefined ? null : <span className={`seat__personality seat__personality--${personality.id}`} title={personality.description}>{personality.id}</span>}
        <span className="seat__role">{handPlayer?.folded ? 'Folded' : handPlayer?.allIn ? 'All-in' : player.isEliminated ? 'Eliminated' : isHuman ? 'You · Player' : 'CPU opponent'}</span>
        <strong aria-label={`Stack ${bankrollLabel}`} className="seat__bankroll"><span className="seat__bankroll-full">{bankrollLabel}</span><span aria-hidden="true" className="seat__bankroll-compact">{formatCompactChips(bankroll)}</span></strong>
        {handPlayer !== undefined && handPlayer.streetContribution > 0 ? <span className="seat__commitment">In pot {formatChips(handPlayer.streetContribution)}</span> : null}
      </div>
      {isDealer ? <span aria-label="Dealer button" className="dealer-button">D</span> : null}
      {isSmallBlind ? <span className="blind-marker">SB</span> : null}
      {isBigBlind ? <span className="blind-marker blind-marker--big">BB</span> : null}
    </article>
  )
}

function formatCompactChips(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`
  return formatChips(amount as import('../domain/game/types').ChipAmount)
}
