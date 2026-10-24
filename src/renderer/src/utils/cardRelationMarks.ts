import type { EngineCard } from '@shared/index'
import { getEditorId } from '../stores/duelEngine/identityMap'

export type HoverRelationMark = 'equip' | 'target'

export function resolveHoverRelationMark(
  engineCards: EngineCard[],
  cardEditorId: string,
  hoveredEditorId: string | null
): HoverRelationMark | null {
  if (!hoveredEditorId || hoveredEditorId === cardEditorId) return null

  let self: EngineCard | undefined
  let hovered: EngineCard | undefined
  for (const card of engineCards) {
    const editorId = getEditorId(card.instanceId) ?? card.instanceId
    if (editorId === cardEditorId) self = card
    else if (editorId === hoveredEditorId) hovered = card
  }
  if (!self || !hovered) return null

  if (
    self.equipTargetInstanceId === hovered.instanceId ||
    hovered.equipTargetInstanceId === self.instanceId
  ) {
    return 'equip'
  }
  if (
    self.targetInstanceIds?.includes(hovered.instanceId) ||
    hovered.targetInstanceIds?.includes(self.instanceId)
  ) {
    return 'target'
  }
  return null
}
