import type { CpuController } from './types'

/** Temporary shared CPU baseline. Personality strategy belongs in Milestone 3. */
export const callingStationCpu: CpuController = (context) => {
  if (context.legalActions.canCheck) return { type: 'check' }
  if (context.legalActions.canCall) return { type: 'call' }
  if (context.legalActions.canFold) return { type: 'fold' }
  return { type: 'all-in' }
}
