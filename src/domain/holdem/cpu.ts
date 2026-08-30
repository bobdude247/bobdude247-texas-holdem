import { HandCategory, evaluateBestHand } from '../evaluator'
import { systemRandom, type RandomSource } from '../random'
import type { Card, Rank } from '../cards'
import type { ChipAmount } from '../game/types'
import type { CpuController, CpuDecisionContext, PlayerAction } from './types'

export type CpuPersonalityId = 'rock' | 'shark' | 'maniac' | 'grinder' | 'caller'

export interface CpuProfile {
  readonly id: CpuPersonalityId
  readonly name: string
  readonly description: string
  readonly enterThreshold: number
  readonly callTolerance: number
  readonly aggression: number
  readonly bluff: number
  readonly semiBluff: number
  readonly potFraction: number
  readonly positionWeight: number
}

export const cpuProfiles: Record<CpuPersonalityId, CpuProfile> = {
  rock: { id: 'rock', name: 'The Rock', description: 'Tight, patient, and value-first.', enterThreshold: .62, callTolerance: .07, aggression: .34, bluff: .015, semiBluff: .08, potFraction: .62, positionWeight: .05 },
  shark: { id: 'shark', name: 'The Shark', description: 'Balanced, position-aware pressure.', enterThreshold: .43, callTolerance: .18, aggression: .62, bluff: .14, semiBluff: .42, potFraction: .72, positionWeight: .16 },
  maniac: { id: 'maniac', name: 'The Maniac', description: 'Loose, volatile, relentless pressure.', enterThreshold: .18, callTolerance: .35, aggression: .88, bluff: .38, semiBluff: .72, potFraction: 1, positionWeight: .04 },
  grinder: { id: 'grinder', name: 'The Grinder', description: 'Disciplined, controlled-pot poker.', enterThreshold: .48, callTolerance: .06, aggression: .48, bluff: .05, semiBluff: .28, potFraction: .55, positionWeight: .11 },
  caller: { id: 'caller', name: 'The Caller', description: 'Loose, sticky, and rarely raises.', enterThreshold: .26, callTolerance: .31, aggression: .12, bluff: .005, semiBluff: .06, potFraction: .42, positionWeight: .025 },
}

const values: Record<Rank, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 }

export type PreflopTier = 'premium' | 'strong' | 'playable' | 'marginal' | 'weak'

export interface HandAssessment { readonly strength: number; readonly tier: PreflopTier; readonly drawStrength: number; readonly madeCategory?: HandCategory }

/** A bounded heuristic deliberately uses only the actor cards and public board, never equity samples. */
export function assessPreflop(cards: readonly Card[], opponents: number, latePosition: number): HandAssessment {
  const [first, second] = cards.map((card) => values[card.rank]).sort((a, b) => b - a)
  const suited = cards[0].suit === cards[1].suit
  const gap = first - second
  const pair = first === second
  const broadway = first >= 10 && second >= 10
  let strength = pair ? .42 + first / 20 : (first + second) / 32
  if (suited) strength += .06
  if (gap <= 2) strength += .05
  if (broadway) strength += .08
  if ((first === 14 || first === 13) && second < 9 && !suited) strength -= .13 // weak aces/kings are dominated often
  strength += latePosition * .08 - Math.max(0, opponents - 1) * .025
  strength = Math.max(.02, Math.min(1, strength))
  const tier: PreflopTier = strength >= .82 ? 'premium' : strength >= .65 ? 'strong' : strength >= .45 ? 'playable' : strength >= .28 ? 'marginal' : 'weak'
  return { strength, tier, drawStrength: 0 }
}

export function assessPostflop(holeCards: readonly Card[], board: readonly Card[]): HandAssessment {
  const all = [...holeCards, ...board]
  const made = evaluateBestHand(all)
  const suitCounts = new Map<string, number>()
  const rankSet = new Set(all.map((card) => values[card.rank]))
  for (const card of all) suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1)
  const flushDraw = board.length < 5 && [...suitCounts.values()].some((count) => count === 4)
  let openEnded = false
  let gutshot = false
  if (board.length < 5) for (let low = 2; low <= 10; low += 1) {
    const hits = [low, low + 1, low + 2, low + 3, low + 4].filter((rank) => rankSet.has(rank)).length
    if (hits === 4) {
      if (!rankSet.has(low) && !rankSet.has(low + 4)) openEnded = true
      else gutshot = true
    }
  }
  const overcards = holeCards.every((card) => values[card.rank] > Math.max(...board.map((card) => values[card.rank])))
  const drawStrength = (flushDraw ? .22 : 0) + (openEnded ? .18 : gutshot ? .1 : 0) + (overcards ? .05 : 0)
  const strength = Math.min(1, .16 + made.category / 10 + (made.category === HandCategory.OnePair ? made.tiebreak[0] / 70 : 0) + drawStrength)
  return { strength, tier: strength > .7 ? 'strong' : strength > .48 ? 'playable' : strength > .3 ? 'marginal' : 'weak', drawStrength, madeCategory: made.category }
}

export function classifyPosition(context: CpuDecisionContext): number {
  const live = context.players.filter((player) => !player.folded && !player.allIn)
  if (live.length <= 2) return context.seat === context.button ? 1 : 0
  const order = [...live.map((player) => player.seat)].sort((a, b) => a - b)
  const buttonIndex = order.indexOf(context.button)
  const seatIndex = order.indexOf(context.seat)
  return ((seatIndex - buttonIndex + order.length) % order.length) / Math.max(1, order.length - 1)
}

function pot(context: CpuDecisionContext): number { return context.pots.reduce((total, item) => total + item.amount, 0) + context.players.reduce((total, player) => total + player.streetContribution, 0) }
function own(context: CpuDecisionContext) { return context.players.find((player) => player.seat === context.seat)! }
function legalPassive(context: CpuDecisionContext): PlayerAction { return context.legalActions.canCheck ? { type: 'check' } : context.legalActions.canCall ? { type: 'call' } : { type: 'fold' } }

function sizedAggression(context: CpuDecisionContext, fraction: number): PlayerAction | undefined {
  const legal = context.legalActions
  const minimum = legal.canBet ? legal.minimumBetTo : legal.canRaise ? legal.minimumRaiseTo : undefined
  if (minimum === undefined) return undefined
  const target = Math.round(own(context).streetContribution + Math.max(pot(context) * fraction, legal.amountToCall * 2))
  const to = Math.max(minimum, Math.min(legal.maximumTo, target)) as ChipAmount
  if (!Number.isSafeInteger(to) || to < minimum) return undefined
  return { type: legal.canBet ? 'bet' : 'raise', to }
}

export interface CpuStrategy { readonly id: CpuPersonalityId; decide(context: CpuDecisionContext, random: RandomSource): PlayerAction }

function decide(profile: CpuProfile, context: CpuDecisionContext, random: RandomSource): PlayerAction {
  const position = classifyPosition(context)
  const opponents = context.players.filter((player) => player.seat !== context.seat && !player.folded).length
  const assessment = context.board.length === 0 ? assessPreflop(context.holeCards, opponents, position) : assessPostflop(context.holeCards, context.board)
  const price = context.legalActions.amountToCall === 0 ? 0 : context.legalActions.amountToCall / Math.max(1, pot(context) + context.legalActions.amountToCall)
  const stackPressure = own(context).stack / Math.max(1, context.legalActions.maximumTo)
  const shortBoost = stackPressure < .35 ? .12 : 0
  const opponentsMemory = Object.entries(context.tendencies ?? {}).filter(([seat]) => Number(seat) !== context.seat).map(([, tendency]) => tendency)
  const credible = opponentsMemory.filter((tendency) => tendency.confidence >= .25)
  const averageFold = credible.reduce((total, tendency) => total + tendency.foldToPressure, 0) / Math.max(1, credible.length)
  const averageCalling = credible.reduce((total, tendency) => total + tendency.calling, 0) / Math.max(1, credible.length)
  const exploit = profile.id === 'shark' ? (averageFold - .5) * .22 - (averageCalling - .5) * .16 : profile.id === 'grinder' ? (averageFold - .5) * .06 - (averageCalling - .5) * .05 : profile.id === 'rock' ? -(averageCalling - .5) * .03 : profile.id === 'maniac' ? (averageFold - .5) * .05 : 0
  const score = assessment.strength + position * profile.positionWeight + shortBoost + exploit
  const canPressure = context.legalActions.canBet || context.legalActions.canRaise
  const randomValue = random()
  const valueRaise = score >= .7 && randomValue < profile.aggression
  const semiBluff = assessment.drawStrength >= .1 && randomValue < profile.semiBluff
  const bluff = assessment.strength < .35 && context.legalActions.amountToCall === 0 && randomValue < Math.max(0, profile.bluff + exploit)
  if (canPressure && (valueRaise || semiBluff || bluff)) return sizedAggression(context, profile.potFraction) ?? legalPassive(context)
  if (context.legalActions.amountToCall === 0) return legalPassive(context)
  if (score + profile.callTolerance + assessment.drawStrength < price + profile.enterThreshold * .28) return context.legalActions.canFold ? { type: 'fold' } : legalPassive(context)
  if (context.legalActions.canAllIn && stackPressure < .12 && score > .52) return { type: 'all-in' }
  return legalPassive(context)
}

export const cpuStrategies: Record<CpuPersonalityId, CpuStrategy> = Object.fromEntries(Object.values(cpuProfiles).map((profile) => [profile.id, { id: profile.id, decide: (context: CpuDecisionContext, random: RandomSource) => decide(profile, context, random) }])) as Record<CpuPersonalityId, CpuStrategy>

/** Maps table seats to profiles while keeping the engine-facing controller context-only. */
export function createPersonalityController(bySeat: Readonly<Record<number, CpuPersonalityId>>, random: RandomSource = systemRandom): CpuController {
  return (context) => {
    const strategy = cpuStrategies[bySeat[context.seat] ?? 'grinder']
    try { return strategy.decide(context, random) } catch { return legalPassive(context) }
  }
}

/** Retained as a deterministic test baseline only. */
export const callingStationCpu: CpuController = (context) => legalPassive(context)
