import { describe, expect, it } from 'vitest'
import { createCard, type Card } from '../cards'
import { chips } from '../game/types'
import { cpuProfiles, cpuStrategies, assessPostflop, assessPreflop } from './cpu'
import type { CpuDecisionContext, LegalActions } from './types'

const card = (value: string): Card => createCard(value[0] === '1' ? 'T' : value[0] as Card['rank'], ({ c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const)[value.at(-1)! as 'c'])
const random = (value: number) => () => value

function legal(overrides: Partial<LegalActions> = {}): LegalActions {
  return { seat: 1, amountToCall: chips(0), cappedCallAmount: chips(0), canFold: true, canCheck: true, canCall: false, canBet: true, canRaise: false, canAllIn: true, minimumBetTo: chips(10), maximumTo: chips(100), ...overrides }
}
function context(holeCards: readonly Card[], board: readonly Card[] = [], actions = legal()): CpuDecisionContext {
  return { seat: 1, holeCards, board, legalActions: actions, publicHistory: [], players: [
    { seat: 0, stack: chips(100), streetContribution: chips(0), totalContribution: chips(0), folded: false, allIn: false },
    { seat: 1, stack: chips(100), streetContribution: chips(0), totalContribution: chips(0), folded: false, allIn: false },
  ], pots: [{ amount: chips(10), cap: chips(5), eligibleSeats: [0, 1] }], button: 1 }
}
function assertLegal(decision: ReturnType<typeof cpuStrategies.rock.decide>, actions: LegalActions) {
  expect(['fold', 'check', 'call', 'bet', 'raise', 'all-in']).toContain(decision.type)
  if (decision.type === 'bet') expect(decision.to).toBeGreaterThanOrEqual(actions.minimumBetTo!)
  if (decision.type === 'raise') expect(decision.to).toBeGreaterThanOrEqual(actions.minimumRaiseTo!)
}

describe('CPU assessments and deterministic personalities', () => {
  it('rates pairs, suited connectors, and dominated weak aces distinctly', () => {
    expect(assessPreflop([card('As'), card('Ah')], 2, 1).tier).toBe('premium')
    expect(assessPreflop([card('9s'), card('8s')], 2, 1).strength).toBeGreaterThan(assessPreflop([card('Ad'), card('3c')], 2, 1).strength)
  })
  it('detects made hands and combination draw pressure from legal cards only', () => {
    const assessment = assessPostflop([card('Ah'), card('Kh')], [card('Qh'), card('Jh'), card('2c')])
    expect(assessment.drawStrength).toBeGreaterThan(.2)
    expect(assessment.madeCategory).toBeDefined()
  })
  it('keeps pocket aces and folds weak early trash according to profile separation', () => {
    const premium = context([card('As'), card('Ah')])
    const trash = context([card('7c'), card('2d')], [], legal({ amountToCall: chips(7), cappedCallAmount: chips(7), canCheck: false, canCall: true, canBet: false, minimumBetTo: undefined }))
    for (const strategy of Object.values(cpuStrategies)) expect(strategy.decide(premium, random(.1)).type).not.toBe('fold')
    expect(cpuStrategies.rock.decide(trash, random(.9)).type).toBe('fold')
    expect(cpuStrategies.grinder.decide(trash, random(.9)).type).toBe('fold')
    expect(cpuStrategies.maniac.decide(trash, random(.1)).type).not.toBe('fold')
  })
  it('returns only legal actions across profiles and representative streets', () => {
    const scenarios = [context([card('Qs'), card('Js')]), context([card('8h'), card('7h')], [card('Th'), card('9c'), card('2h')]), context([card('7c'), card('2d')], [card('As'), card('Kd'), card('9h'), card('4c'), card('3s')])]
    for (const strategy of Object.values(cpuStrategies)) for (const scenario of scenarios) assertLegal(strategy.decide(scenario, random(.2)), scenario.legalActions)
  })
  it('is hidden-information invariant and does not mutate its context for every personality', () => {
    const known = context([card('As'), card('Qs')], [card('Jh'), card('7d'), card('2c')])
    const snapshot = structuredClone(known)
    for (const strategy of Object.values(cpuStrategies)) {
      expect(strategy.decide(known, random(.37))).toEqual(strategy.decide(structuredClone(known), random(.37)))
      expect(known).toEqual(snapshot)
    }
  })
  it('profiles retain materially distinct documented parameters', () => {
    expect(cpuProfiles.maniac.aggression).toBeGreaterThan(cpuProfiles.rock.aggression)
    expect(cpuProfiles.caller.callTolerance).toBeGreaterThan(cpuProfiles.grinder.callTolerance)
    expect(cpuProfiles.shark.positionWeight).toBeGreaterThan(cpuProfiles.caller.positionWeight)
  })
})
