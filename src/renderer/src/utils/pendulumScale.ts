import {
  CardLocation,
  CardPosition,
  CardUtils,
  FieldCard,
  getPzoneSzoneSequence
} from '@shared/index'

export type PendulumScaleSide = 'left' | 'right'

export interface PendulumScaleDisplay {
  side: PendulumScaleSide
  value: number
}

const FACEUP_MASK = CardPosition.FACEUP_ATTACK | CardPosition.FACEUP_DEFENSE

function resolveZoneSide(card: FieldCard, masterRule: number): PendulumScaleSide | null {
  if (card.location === CardLocation.PZONE) {
    if (card.sequence === 0) return 'left'
    if (card.sequence === 1) return 'right'
    return null
  }
  if (card.location !== CardLocation.SZONE) return null

  const [left, right] = getPzoneSzoneSequence(masterRule)
  if (card.sequence === left) return 'left'
  if (card.sequence === right) return 'right'
  return null
}

export function resolvePendulumScale(
  card: FieldCard,
  masterRule: number
): PendulumScaleDisplay | null {
  const cdb = card.card
  if (!cdb || !CardUtils.isPendulum(cdb.type)) return null
  if ((card.position & FACEUP_MASK) === 0) return null

  const side = resolveZoneSide(card, masterRule)
  if (!side) return null

  const base = CardUtils.getPendulumScales(cdb.level)
  const value =
    side === 'left' ? (card.customLScale ?? base.lscale) : (card.customRScale ?? base.rscale)

  return { side, value }
}
