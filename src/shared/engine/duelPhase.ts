import type { DuelPhase } from '../types/story'

const BATTLE_PHASE_MASKS = new Set([8, 16, 32, 64, 128])

export function duelPhaseFromMask(phase: number): DuelPhase {
  if (phase === 1) return 'DP'
  if (phase === 2) return 'SP'
  if (phase === 4) return 'M1'
  if (BATTLE_PHASE_MASKS.has(phase)) return 'BP'
  if (phase === 256) return 'M2'
  if (phase === 512) return 'EP'
  return 'M1'
}
