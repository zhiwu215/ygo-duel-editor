import { CardLocation, PILE_LOCATIONS } from '@shared/index'
import type { EngineRequest, RequestCard } from '@shared/index'

export function resolveActionablePiles(
  request: EngineRequest | null,
  controller: 0 | 1
): Set<number> {
  const piles = new Set<number>()
  if (!request) return piles

  const add = (card: RequestCard, allowDeck: boolean): void => {
    if (card.controller !== controller) return
    if (!PILE_LOCATIONS.has(card.location)) return
    if (!allowDeck && card.location === CardLocation.DECK) return
    piles.add(card.location)
  }

  const data = request.data
  if (data.kind === 'idle') {
    for (const card of data.spSummonable) add(card, true)
    for (const card of data.activatable) add(card, false)
  } else if (data.kind === 'battle') {
    for (const card of data.activatable) add(card, false)
  } else if (data.kind === 'chain') {
    for (const card of data.chains) add(card, true)
  }
  return piles
}
