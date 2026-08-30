import type { SeatNumber } from '../game/types'

export interface PublicTendencySnapshot {
  readonly hands: number; readonly vpipOpportunities: number; readonly vpip: number; readonly preflopRaises: number
  readonly calls: number; readonly checks: number; readonly bets: number; readonly raises: number; readonly folds: number; readonly allIns: number
  readonly foldOpportunities: number; readonly showdowns: number; readonly showdownWins: number; readonly uncontestedWins: number
  readonly aggression: number; readonly calling: number; readonly foldToPressure: number; readonly confidence: number
}
export type PublicTendencyEvent =
  | { readonly type: 'hand'; readonly seat: SeatNumber }
  | { readonly type: 'action'; readonly seat: SeatNumber; readonly action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'; readonly preflop: boolean; readonly facingWager: boolean; readonly voluntaryEntry?: boolean; readonly allInKind?: 'call' | 'bet' | 'raise' }
  | { readonly type: 'showdown'; readonly seat: SeatNumber; readonly won: boolean }
  | { readonly type: 'uncontested-win'; readonly seat: SeatNumber }

interface Counts { hands: number; vpipOpportunities: number; vpipEntries: number; preflopRaises: number; calls: number; checks: number; bets: number; raises: number; folds: number; allIns: number; foldOpportunities: number; foldAtPressure: number; showdowns: number; showdownWins: number; uncontestedWins: number }
const zero = (): Counts => ({ hands: 0, vpipOpportunities: 0, vpipEntries: 0, preflopRaises: 0, calls: 0, checks: 0, bets: 0, raises: 0, folds: 0, allIns: 0, foldOpportunities: 0, foldAtPressure: 0, showdowns: 0, showdownWins: 0, uncontestedWins: 0 })
const rate = (value: number, samples: number) => (value + 1) / (samples + 2)

/** Immutable, plain-data public memory. Events intentionally contain no cards or engine objects. */
export class PublicTendencyTracker {
  private constructor(private readonly counts: Readonly<Record<number, Counts>>) {}
  static create(): PublicTendencyTracker { return new PublicTendencyTracker({}) }
  observe(event: PublicTendencyEvent): PublicTendencyTracker {
    const current = this.counts[event.seat] ?? zero()
    const next = { ...current }
    if (event.type === 'hand') { next.hands += 1; next.vpipOpportunities += 1 }
    if (event.type === 'action') {
      if (event.facingWager) next.foldOpportunities += 1
      if (event.action === 'fold') { next.folds += 1; if (event.facingWager) next.foldAtPressure += 1 }
      if (event.action === 'check') next.checks += 1
      if (event.action === 'call') next.calls += 1
      if (event.action === 'bet') next.bets += 1
      if (event.action === 'raise') next.raises += 1
      if (event.action === 'all-in') { next.allIns += 1; if (event.allInKind === 'call') next.calls += 1; else if (event.allInKind === 'bet') next.bets += 1; else next.raises += 1 }
      if (event.preflop && event.voluntaryEntry) next.vpipEntries += 1
      if (event.preflop && (event.action === 'raise' || event.allInKind === 'raise')) next.preflopRaises += 1
    }
    if (event.type === 'showdown') { next.showdowns += 1; if (event.won) next.showdownWins += 1 }
    if (event.type === 'uncontested-win') next.uncontestedWins += 1
    return new PublicTendencyTracker({ ...this.counts, [event.seat]: next })
  }
  snapshot(seats: readonly SeatNumber[]): Readonly<Record<number, PublicTendencySnapshot>> {
    return Object.fromEntries(seats.map((seat) => {
      const c = this.counts[seat] ?? zero(); const actions = c.calls + c.checks + c.bets + c.raises + c.folds + c.allIns
      return [seat, { hands: c.hands, vpipOpportunities: c.vpipOpportunities, vpip: rate(c.vpipEntries, c.vpipOpportunities), preflopRaises: c.preflopRaises, calls: c.calls, checks: c.checks, bets: c.bets, raises: c.raises, folds: c.folds, allIns: c.allIns, foldOpportunities: c.foldOpportunities, showdowns: c.showdowns, showdownWins: c.showdownWins, uncontestedWins: c.uncontestedWins, aggression: rate(c.bets + c.raises, c.calls + c.bets + c.raises), calling: rate(c.calls, actions), foldToPressure: rate(c.foldAtPressure, c.foldOpportunities), confidence: Math.min(1, c.hands / 20) }] as const
    }))
  }
}
