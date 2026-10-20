import type { Answer, EngineRequest } from '@shared/engine/protocol'
import { DuelPhase } from '@shared/index'

export function canBp(request: EngineRequest | null): boolean {
  return request !== null && request.data.kind === 'idle' && request.data.canBp
}

export function canM2(request: EngineRequest | null): boolean {
  return request !== null && request.data.kind === 'battle' && request.data.canM2
}

export function canEp(request: EngineRequest | null): boolean {
  return (
    request !== null &&
    ((request.data.kind === 'idle' && request.data.canEp) ||
      (request.data.kind === 'battle' && request.data.canEp))
  )
}

export function turnEndCommand(request: EngineRequest | null): Answer | null {
  if (!request || !canEp(request)) return null
  return request.kind === 'battle'
    ? { kind: 'battle', cmd: 'TO_EP' }
    : { kind: 'idle', cmd: 'TO_EP' }
}

export function phaseAdvanceCommand(request: EngineRequest | null): Answer | null {
  if (canBp(request)) return { kind: 'idle', cmd: 'TO_BP' }
  if (canM2(request)) return { kind: 'battle', cmd: 'TO_M2' }
  return turnEndCommand(request)
}

export function phaseJumpCommand(target: DuelPhase, request: EngineRequest | null): Answer | null {
  if (target === 'BP' && canBp(request)) return { kind: 'idle', cmd: 'TO_BP' }
  if (target === 'M2' && canM2(request)) return { kind: 'battle', cmd: 'TO_M2' }
  if (target === 'EP') return turnEndCommand(request)
  return null
}
