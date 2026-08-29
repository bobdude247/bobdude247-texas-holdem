import { PokerTable } from './components/PokerTable'

export default function App() {
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

      <PokerTable />

      <section aria-label="Hand status and player actions" className="control-deck">
        <div className="table-message" role="status">
          <span className="table-message__label">Milestone one</span>
          <p>The table is set. Hand flow, blinds, and betting arrive in the next deal.</p>
        </div>
        <form className="action-panel">
          <div className="raise-control">
            <label htmlFor="raise-amount">Raise amount <span>(inactive)</span></label>
            <div className="raise-control__input">
              <span>$</span>
              <input disabled id="raise-amount" min="0" type="number" value="0" readOnly />
            </div>
          </div>
          <div aria-label="Inactive player actions" className="action-buttons">
            <button disabled type="button">Fold</button>
            <button disabled type="button">Check / Call</button>
            <button className="action-buttons__raise" disabled type="button">Raise</button>
          </div>
        </form>
      </section>
    </main>
  )
}
