import { CardPoolFilter } from './ipc/cardSearch'

export const LINK_MARKERS: Array<{ mask: number; label: string }> = [
  { mask: 0x40, label: '↖' },
  { mask: 0x80, label: '↑' },
  { mask: 0x100, label: '↗' },
  { mask: 0x08, label: '←' },
  { mask: 0x20, label: '→' },
  { mask: 0x01, label: '↙' },
  { mask: 0x02, label: '↓' },
  { mask: 0x04, label: '↘' }
]

export function linkMarkerCount(markers: number): number {
  let count = 0
  for (const marker of LINK_MARKERS) {
    if ((markers & marker.mask) !== 0) count += 1
  }
  return count
}

interface LimitMark {
  id: 1 | 2 | 3
  label: string
  spriteX: number
  spriteY: number
}

export const LIMIT_MARKS: LimitMark[] = [
  { id: 1, label: '禁止', spriteX: 0, spriteY: 0 },
  { id: 2, label: '限制', spriteX: 64, spriteY: 0 },
  { id: 3, label: '准限制', spriteX: 0, spriteY: 64 }
]

interface CardPoolOption {
  id: string
  label: string
  spriteY: number | null
  otMask?: number
}

export const AVAIL_OCG = 0x1
export const AVAIL_TCG = 0x2
export const AVAIL_CUSTOM = 0x4
export const AVAIL_SC = 0x8
export const AVAIL_HIDDEN = 0x1000

export const CARD_POOLS: CardPoolOption[] = [
  { id: 'none', label: '无', spriteY: null },
  { id: 'custom', label: '自定义', spriteY: 384, otMask: AVAIL_CUSTOM }
]

export const OT_POOLS: CardPoolOption[] = [
  { id: 'ocg', label: 'OCG 独有', spriteY: 0 },
  { id: 'tcg', label: 'TCG 独有', spriteY: 64 }
]

export type PoolMatchMode = 'any' | 'all' | 'only'

export interface SearchPoolOption {
  id: Exclude<CardPoolFilter, 'any'>

  label: string

  mask: number

  match: PoolMatchMode

  excludeMask?: number
}

export const SEARCH_POOLS: SearchPoolOption[] = [
  { id: 'ocg', label: 'OCG', mask: AVAIL_OCG, match: 'any' },
  { id: 'tcg', label: 'TCG', mask: AVAIL_TCG, match: 'any' },
  { id: 'sc', label: '简体中文', mask: AVAIL_SC, match: 'any' },
  { id: 'custom', label: '自定义卡片', mask: AVAIL_CUSTOM, match: 'any' },
  { id: 'ocgOnly', label: 'OCG 独有', mask: AVAIL_OCG, match: 'only', excludeMask: AVAIL_TCG },
  { id: 'tcgOnly', label: 'TCG 独有', mask: AVAIL_TCG, match: 'only', excludeMask: AVAIL_OCG },
  { id: 'ocgTcg', label: '无独有卡', mask: AVAIL_OCG | AVAIL_TCG, match: 'all' }
]

export function searchPoolOption(id: CardPoolFilter | undefined): SearchPoolOption | null {
  return SEARCH_POOLS.find((pool) => pool.id === id) ?? null
}

const ALL_POOL_OPTIONS: CardPoolOption[] = [...CARD_POOLS, ...OT_POOLS]

export const CARD_POOL_SPRITE_WIDTH = 128
export const CARD_POOL_SPRITE_HEIGHT = 64

export const CARD_POOL_OT_MASKS: Array<{ id: string; mask: number }> = CARD_POOLS.filter(
  (pool): pool is CardPoolOption & { otMask: number } => pool.otMask !== undefined
).map((pool) => ({ id: pool.id, mask: pool.otMask }))

export function cardPoolOtMask(id: string | undefined): number | undefined {
  return CARD_POOL_OT_MASKS.find((pool) => pool.id === id)?.mask
}

export function cardPoolLabel(id: string): string {
  return ALL_POOL_OPTIONS.find((p) => p.id === id)?.label ?? ''
}

export function cardPoolSpriteY(id: string): number | null {
  return ALL_POOL_OPTIONS.find((p) => p.id === id)?.spriteY ?? null
}

export function otBadgeIds(ot: number): string[] {
  const hasOcg = (ot & AVAIL_OCG) !== 0
  const hasTcg = (ot & AVAIL_TCG) !== 0
  if (hasOcg && !hasTcg) return ['ocg']
  if (hasTcg && !hasOcg) return ['tcg']
  return []
}

export function cardPoolIdsFromOt(ot: number): string[] {
  return CARD_POOL_OT_MASKS.filter((pool) => (ot & pool.mask) !== 0).map((pool) => pool.id)
}
