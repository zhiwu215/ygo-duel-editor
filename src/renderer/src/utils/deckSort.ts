import { CdbCard, CardUtils } from '@shared/index'

export function compareCards(
  cardDetails: Record<number, CdbCard>
): (aId: number, bId: number) => number {
  return (aId: number, bId: number): number => {
    const a = cardDetails[aId]
    const b = cardDetails[bId]
    if (!a || !b) return aId - bId

    const getKindOrder = (type: number): number => {
      if (CardUtils.isMonster(type)) return 1
      if (CardUtils.isSpell(type)) return 2
      if (CardUtils.isTrap(type)) return 3
      return 4
    }

    const kindA = getKindOrder(a.type)
    const kindB = getKindOrder(b.type)
    if (kindA !== kindB) return kindA - kindB

    if (a.level !== b.level) return b.level - a.level
    if (a.atk !== b.atk) return b.atk - a.atk
    return a.id - b.id
  }
}

export function shuffle<T>(list: T[]): T[] {
  const pool = [...list]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}
