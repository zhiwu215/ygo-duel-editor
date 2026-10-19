import { CardUtils } from './card'

export interface DeckData {
  id?: string
  name: string
  description?: string
  coverCard?: number
  tags?: string[]
  group?: string
  main: number[]
  extra: number[]
  side: number[]
  updatedAt?: number
}
export interface DeckLibrary {
  groups: string[]
  decks: DeckData[]
}

export type DeckSection = 'main' | 'extra' | 'side'

export function canPlaceInSection(type: number, section: DeckSection): boolean {
  if (section === 'extra') return CardUtils.isExtraDeck(type)
  if (section === 'main') return !CardUtils.isExtraDeck(type)
  return true
}

export interface DeckStats {
  mainCount: number
  extraCount: number
  sideCount: number
  monsterCount: number
  spellCount: number
  trapCount: number
  fusionCount: number
  synchroCount: number
  xyzCount: number
  linkCount: number
  sideMonsterCount: number
  sideSpellCount: number
  sideTrapCount: number
}
