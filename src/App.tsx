import { useEffect, useState } from 'react'
import { PokerTable } from './components/PokerTable'
import { createPersonalityController } from './domain/holdem/cpu'
import { applyAction, legalActions, runCpuTurns, startNextHand } from './domain/holdem/engine'
import { projectPublicMatch } from './domain/holdem/public'
import type { PlayerAction } from './domain/holdem/types'
import { formatChips } from './presentation/format'
import { createTableMatch, humanSeat, tableCpuPersonalities } from './presentation/tablePlayers'

const tableCpu = createPersonalityController(tableCpuPersonalities)

export default function App() {
  const [match, setMatch] = useState(createTableMatch)
  const [raiseTo, setRaiseTo] = useState('')
  const [error, setError] = useState<string>()
  const hand = match.hand
  const publicMatch = projectPublicMatch(match, humanSeat)
  const publicHand = publicMatch.hand
  const isHumanTurn = hand?.actingSeat === humanSeat
  const legal = isHumanTurn ? legalActions(match, humanSeat) : undefined

  useEffect(() => {
    if (hand?.actingSeat === undefined || hand.phase === 'complete' || hand.players.find((player) => player.seat === hand.actingSeat)?.kind !== 'cpu') return
    const timer = window.setTimeout(() => setMatch((current) => runCpuTurns(current, tableCpu, 1)), 300)
    return () => window.clearTimeout(timer)
  }, [hand])

  function act(action: PlayerAction) {
    try {
      setMatch((current) => applyAction(current, humanSeat, action))
      setError(undefined)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action could not be applied.') }
  }

  function deal() {
    try { setMatch((current) => startNextHand(current)); setError(undefined) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to deal a hand.') }
  }

  return (
    <main className="app-shell">
      <header className="brand-bar">
        <div>
          <p className="brand-bar__kicker">Private table · No-limit</p>
          <h1>bobdude247 <span>Texas Hold&apos;em</span></h1>
        </div>
        <div aria-label="Game status" className="game-status">
          <span className="game-status__dot" />
          <span>Table preview</span>
        </div>
      </header>

      <PokerTable match={publicMatch} />

      <section aria-label="Hand status and player actions" className="control-deck">
        <div className="table-message" role="status">
          <span className="table-message__label">{publicHand === undefined ? 'Ready to play' : publicHand.phase === 'complete' ? 'Hand complete' : `${publicHand.phase} · ${publicHand.actingSeat === humanSeat ? 'Your turn' : 'Computer thinking'}`}</span>
          <p>{publicMatch.matchWinnerSeat === undefined ? publicHand?.history.at(-1)?.text ?? 'Deal a hand to begin.' : `${publicMatch.players.find((player) => player.seat === publicMatch.matchWinnerSeat)?.name} wins the match.`}</p>
          {error === undefined ? null : <p className="validation-message" role="alert">{error}</p>}
        </div>
        <form className="action-panel">
          <div className="raise-control">
            <label htmlFor="raise-amount">Raise to <span>{legal?.minimumRaiseTo === undefined ? '(unavailable)' : `min. ${formatChips(legal.minimumRaiseTo)}`}</span></label>
            <div className="raise-control__input">
              <span>$</span>
              <input disabled={!legal?.canRaise && !legal?.canBet} id="raise-amount" min={legal?.minimumRaiseTo ?? legal?.minimumBetTo ?? 0} max={legal?.maximumTo ?? 0} onChange={(event) => setRaiseTo(event.target.value)} step="1" type="number" value={raiseTo} />
            </div>
          </div>
          <div aria-label="Player actions" className="action-buttons">
            <button disabled={!legal?.canFold} onClick={() => act({ type: 'fold' })} type="button">Fold</button>
            <button disabled={legal === undefined || (!legal.canCheck && !legal.canCall)} onClick={() => act(legal?.canCheck ? { type: 'check' } : { type: 'call' })} type="button">{legal?.canCheck ? 'Check' : legal?.canCall ? `Call ${formatChips(legal.cappedCallAmount)}` : 'Check / Call'}</button>
            <button className="action-buttons__raise" disabled={legal === undefined || (!legal.canRaise && !legal.canBet) || Number(raiseTo) <= 0} onClick={() => act({ type: legal?.canBet ? 'bet' : 'raise', to: Number(raiseTo) as import('./domain/game/types').ChipAmount })} type="button">{legal?.canBet ? 'Bet to' : 'Raise to'}</button>
            <button disabled={!legal?.canAllIn} onClick={() => act({ type: 'all-in' })} type="button">All-in</button>
          </div>
        </form>
        <button className="deal-button" disabled={hand !== undefined && hand.phase !== 'complete' || match.matchWinnerSeat !== undefined} onClick={deal} type="button">{hand?.phase === 'complete' ? 'Next Hand' : 'Deal Hand'}</button>
      </section>
      {publicHand === undefined ? null : <section aria-label="Hand history" className="history-panel"><h2>Table history</h2><ol>{publicHand.history.slice(-8).map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ol></section>}
    </main>
  )
}
