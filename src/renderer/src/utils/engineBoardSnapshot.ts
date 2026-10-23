import { CardLocation } from '@shared/index'
import type { EngineBoardState, LightweightCardSnapshot } from '@shared/index'
import { normalizeEngineCardPosition } from './engineCardPosition'

export function snapshotEngineBoard(
  board: EngineBoardState,
  masterRule: number
): LightweightCardSnapshot[] {
  return board.allCards
    .filter((card) => card.location !== CardLocation.OVERLAY)
    .map((card) => {
      const position = normalizeEngineCardPosition(masterRule, card.location, card.sequence)
      return {
        instanceId: card.instanceId,
        code: card.code,
        controller: card.controller,
        owner: card.owner,
        location: position.location,
        sequence: position.sequence,
        position: card.position,
        overlayMaterials: [...card.overlayMaterials],
        duelistId: card.duelistId
      }
    })
}
