import { CardLocation, EngineBoardState, FieldCard } from '@shared/index'
import { getEditorId } from './identityMap'

export function orderEditorCardsByEngineHand(
  controller: 0 | 1,
  editorCards: FieldCard[],
  boardState: EngineBoardState | null
): FieldCard[] | null {
  if (!boardState) return null
  const engineHand = boardState.players[controller]?.hand
  if (!engineHand) return null

  const editorById = new Map(editorCards.map((c) => [c.instanceId, c]))
  const used = new Set<string>()
  const ordered: FieldCard[] = []

  for (const engineCard of engineHand) {
    const mappedId = getEditorId(engineCard.instanceId)
    const mapped = mappedId ? editorById.get(mappedId) : undefined
    const card =
      mapped ??
      editorCards.find(
        (c) =>
          !used.has(c.instanceId) &&
          c.controller === engineCard.controller &&
          c.location === CardLocation.HAND &&
          c.sequence === engineCard.sequence
      )
    if (!card || used.has(card.instanceId)) continue
    used.add(card.instanceId)
    ordered.push(card)
  }

  for (const card of editorCards) {
    if (!used.has(card.instanceId)) ordered.push(card)
  }
  return ordered
}
