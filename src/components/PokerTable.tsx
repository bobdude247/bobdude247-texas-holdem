import { chips, type Player } from '../domain/game/types'
import { PlayingCard } from './PlayingCard'
import { Seat } from './Seat'

const startingBankroll = chips(10_000_000)

const players: readonly Player[] = [
  { id: 'rock', name: 'The Rock', kind: 'cpu', seat: 0, bankroll: startingBankroll, isEliminated: false },
  { id: 'shark', name: 'The Shark', kind: 'cpu', seat: 1, bankroll: startingBankroll, isEliminated: false },
  { id: 'maniac', name: 'The Maniac', kind: 'cpu', seat: 2, bankroll: startingBankroll, isEliminated: false },
  { id: 'hero', name: 'bobdude247', kind: 'human', seat: 3, bankroll: startingBankroll, isEliminated: false },
  { id: 'grinder', name: 'The Grinder', kind: 'cpu', seat: 4, bankroll: startingBankroll, isEliminated: false },
  { id: 'caller', name: 'The Caller', kind: 'cpu', seat: 5, bankroll: startingBankroll, isEliminated: false },
]

export function PokerTable() {
  return (
    <section aria-label="Texas Hold'em table" className="table-stage">
      <div className="table-felt">
        <div className="table-felt__texture" />
        <div className="table-center">
          <p className="table-center__eyebrow">Current pot</p>
          <strong className="table-center__pot">$0</strong>
          <div aria-label="Community cards have not been dealt" className="community-cards">
            {Array.from({ length: 5 }, (_, index) => (
              <PlayingCard key={index} label={`Community card ${index + 1} placeholder`} />
            ))}
          </div>
        </div>
        {players.map((player) => (
          <Seat isDealer={player.id === 'caller'} key={player.id} player={player} />
        ))}
      </div>
    </section>
  )
}
