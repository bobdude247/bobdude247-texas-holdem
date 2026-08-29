import { formatChips } from '../presentation/format'
import type { Player } from '../domain/game/types'
import { PlayingCard } from './PlayingCard'

interface SeatProps {
  readonly player: Player
  readonly isDealer?: boolean
}

export function Seat({ player, isDealer = false }: SeatProps) {
  const isHuman = player.kind === 'human'

  return (
    <article className={`seat seat--${player.seat}${isHuman ? ' seat--human' : ''}`}>
      <div className="seat__cards" aria-label={isHuman ? 'Your hole cards are not dealt yet' : `${player.name}'s hidden hole cards`}>
        <PlayingCard faceDown={!isHuman} label={isHuman ? 'Your first hole-card placeholder' : 'Hidden hole card'} />
        <PlayingCard faceDown={!isHuman} label={isHuman ? 'Your second hole-card placeholder' : 'Hidden hole card'} />
      </div>
      <div className="seat__identity">
        <span className="seat__name">{player.name}</span>
        <span className="seat__role">{isHuman ? 'You · Player' : 'CPU opponent'}</span>
        <strong className="seat__bankroll">{formatChips(player.bankroll)}</strong>
      </div>
      {isDealer ? <span aria-label="Dealer button" className="dealer-button">D</span> : null}
    </article>
  )
}
