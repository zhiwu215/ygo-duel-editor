import type { FieldCard } from '@shared/index'

export const resolvePileInsertIndex = (
  pileCards: FieldCard[],
  visibleCards: FieldCard[],
  visibleIndex: number
): number => {
  if (visibleCards.length === 0) return pileCards.length

  const anchor = visibleCards[Math.min(visibleIndex, visibleCards.length - 1)]
  const anchorIndex = pileCards.findIndex((card) => card.instanceId === anchor.instanceId)
  if (anchorIndex < 0) return pileCards.length

  return visibleIndex < visibleCards.length ? anchorIndex : anchorIndex + 1
}
