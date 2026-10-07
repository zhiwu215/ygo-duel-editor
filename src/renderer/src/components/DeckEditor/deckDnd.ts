import { CdbCard, DeckSection } from '@shared/index'

export type DeckDragSourceData =
  | { source: 'search'; card: CdbCard }
  | { source: 'deck'; section: DeckSection; index: number; code: number }

export type DeckDropTargetData =
  | { kind: 'zone'; section: DeckSection }
  | { kind: 'deck-item'; section: DeckSection; index: number }
  | { kind: 'search-panel' }

export const DECK_SECTION_NAMES: Record<DeckSection, string> = {
  main: '主卡组',
  extra: '额外卡组',
  side: '副卡组'
}

export const deckDragGuard = { lastDragEndAt: 0 }
