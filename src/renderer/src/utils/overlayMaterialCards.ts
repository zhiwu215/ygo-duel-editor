import { CardPosition, CdbCard, FieldCard } from '@shared/index'
import { getCodeOccurrences } from './cardOccurrences'

export function buildOverlayMaterialCards(
  materials: number[],
  cardDataMap: Record<number, CdbCard>,
  host: Pick<FieldCard, 'controller' | 'owner' | 'location'>
): FieldCard[] {
  const occurrences = getCodeOccurrences(materials)
  return materials.map((code, index) => ({
    instanceId: `mat_${code}_${occurrences[index]}`,
    code,
    card: cardDataMap[code],
    controller: host.controller,
    owner: host.owner,
    location: host.location,
    sequence: index,
    position: CardPosition.FACEUP,
    overlayMaterials: []
  }))
}
