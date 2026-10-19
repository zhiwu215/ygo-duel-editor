import type { EngineRequest } from '@shared/engine/protocol'

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
