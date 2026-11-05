import { CardLocation, CardPosition, CdbCard, FieldCard } from '@shared/index'
import { getCodeOccurrences } from './cardOccurrences'

export function buildOverlayMaterialCards(
  materials: number[],
  cardDataMap: Record<number, CdbCard>,
  host: Pick<FieldCard, 'controller' | 'owner'>
): FieldCard[] {
  const occurrences = getCodeOccurrences(materials)
  return materials.map((code, index) => ({
    instanceId: `mat_${code}_${occurrences[index]}`,
    code,
    card: cardDataMap[code],
    controller: host.controller,
    owner: host.owner,
    location: CardLocation.OVERLAY,
    sequence: index,
    position: CardPosition.FACEUP,
    overlayMaterials: []
  }))
}
