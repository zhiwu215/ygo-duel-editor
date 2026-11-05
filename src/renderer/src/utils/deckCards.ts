import { CdbCard, DeckData } from '@shared/index'

export function collectDeckCardCodes(deck: DeckData): number[] {
  return Array.from(
    new Set([
      ...deck.main,
      ...deck.extra,
      ...deck.side,
      ...(deck.coverCard ? [deck.coverCard] : [])
    ])
  )
}

export function findMissingDeckCodes(
  deck: DeckData,
  cardDetails: Record<number, CdbCard>
): number[] {
  const codes = [...deck.main, ...deck.extra, ...deck.side]
  return Array.from(new Set(codes.filter((code) => !cardDetails[code])))
}
