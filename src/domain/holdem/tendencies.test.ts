import { describe, expect, it } from 'vitest'
import { PublicTendencyTracker } from './tendencies'

describe('public tendency tracker', () => {
  it('counts dealt hands and voluntary actions without blind events', () => {
    const tracker = PublicTendencyTracker.create().observe({ type: 'hand', seat: 1 }).observe({ type: 'action', seat: 1, action: 'call', preflop: true, facingWager: true, voluntaryEntry: true })
    expect(tracker.snapshot([1])[1]).toMatchObject({ hands: 1, vpipOpportunities: 1, calls: 1 })
  })
  it('smooths finite ratios and owns snapshots', () => {
    const tracker = PublicTendencyTracker.create(); const empty = tracker.snapshot([1])[1]
    expect(Object.values(empty).filter((value) => typeof value === 'number').every(Number.isFinite)).toBe(true)
    const copy = tracker.snapshot([1]) as Record<number, { hands: number }>; copy[1].hands = 99
    expect(tracker.snapshot([1])[1].hands).toBe(0)
  })
  it('classifies all-in calls as passive and all-in raises as aggressive', () => {
    let tracker = PublicTendencyTracker.create().observe({ type: 'hand', seat: 1 })
    tracker = tracker.observe({ type: 'action', seat: 1, action: 'all-in', allInKind: 'call', preflop: true, facingWager: true, voluntaryEntry: true })
    tracker = tracker.observe({ type: 'action', seat: 1, action: 'all-in', allInKind: 'raise', preflop: true, facingWager: true, voluntaryEntry: true })
    expect(tracker.snapshot([1])[1]).toMatchObject({ calls: 1, raises: 1, allIns: 2 })
  })
})
