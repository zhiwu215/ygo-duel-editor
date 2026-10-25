import type { EngineRequest, RequestCard } from '@shared/engine/protocol'
import { deriveCardEngineActions, type CardEngineActions } from './engineActions'

export interface PileActionEntry {
  card: RequestCard
  actions: CardEngineActions
}

function requestCards(request: EngineRequest): RequestCard[] {
  const data = request.data
  if (data.kind === 'idle') return [...data.spSummonable, ...data.activatable]
  if (data.kind === 'battle') return data.activatable
  if (data.kind === 'chain') return data.chains
  return []
}

function hasAction(actions: CardEngineActions): boolean {
  return Boolean(
    actions.summon ||
    actions.spSummon ||
    actions.mset ||
    actions.sset ||
    actions.repos ||
    actions.attack ||
    actions.chain ||
    actions.activate.length > 0
  )
}

export function resolvePileActions(
  request: EngineRequest | null,
  controller: 0 | 1,
  location: number
): PileActionEntry[] {
  if (!request) return []
  const seen = new Set<string>()
  const entries: PileActionEntry[] = []
  for (const card of requestCards(request)) {
    if (card.controller !== controller || card.location !== location) continue
    const key = `${card.code}:${card.sequence}`
    if (seen.has(key)) continue
    seen.add(key)
    const actions = deriveCardEngineActions(request, card)
    if (!actions || !hasAction(actions)) continue
    entries.push({ card, actions })
  }
  return entries
}
