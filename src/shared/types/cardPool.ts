import { CardPoolFilter } from './ipc/cardSearch'

export const LINK_MARKERS: Array<{ mask: number; label: string }> = [
  { mask: 0x01, label: '↖' },
  { mask: 0x02, label: '↑' },
  { mask: 0x04, label: '↗' },
  { mask: 0x08, label: '←' },
  { mask: 0x10, label: '→' },
  { mask: 0x20, label: '↙' },
  { mask: 0x40, label: '↓' },
  { mask: 0x80, label: '↘' }
]

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

const AVAIL_OCG = 0x1
const AVAIL_TCG = 0x2
const AVAIL_ANIME = 0x4
const AVAIL_ILLEGAL = 0x8
const AVAIL_VG = 0x10
const AVAIL_CUSTOM = 0x20
const AVAIL_SPEED = 0x40
const AVAIL_PRERELEASE = 0x100
const AVAIL_RUSH = 0x200
const AVAIL_LEGEND = 0x400
const AVAIL_ZCG = 0x2000
export const AVAIL_HIDDEN = 0x1000

export const CARD_POOLS: CardPoolOption[] = [
  { id: 'none', label: '无', spriteY: null },
  { id: 'anime', label: '动漫/漫画', spriteY: 192, otMask: AVAIL_ANIME },
  { id: 'rush', label: '超速（Rush）', spriteY: 576, otMask: AVAIL_RUSH },
  { id: 'tf', label: '卡片力量（TF）', spriteY: 320, otMask: AVAIL_VG },
  { id: 'speed', label: '速决（Speed Duel）', spriteY: 512, otMask: AVAIL_SPEED },
  { id: 'prerelease', label: '先行（Beta）', spriteY: 448, otMask: AVAIL_PRERELEASE },
  { id: 'custom', label: '自定义', spriteY: 384, otMask: AVAIL_CUSTOM }
]

export const OT_POOLS: CardPoolOption[] = [
  { id: 'ocg', label: 'OCG 独有', spriteY: 0 },
  { id: 'tcg', label: 'TCG 独有', spriteY: 64 }
]

export interface SearchPoolOption {
  id: Exclude<CardPoolFilter, 'any'>

  label: string

  mask: number

  exact?: boolean
}

export const SEARCH_POOLS: SearchPoolOption[] = [
  { id: 'ocg', label: 'OCG', mask: AVAIL_OCG, exact: true },
  { id: 'tcg', label: 'TCG', mask: AVAIL_TCG, exact: true },
  { id: 'ocgTcg', label: 'OCG/TCG', mask: AVAIL_OCG | AVAIL_TCG, exact: true },
  { id: 'prerelease', label: '先行卡', mask: AVAIL_PRERELEASE },
  { id: 'skill', label: 'DL技能卡', mask: AVAIL_SPEED },
  { id: 'rush', label: '超速(Rush)', mask: AVAIL_RUSH },
  { id: 'legend', label: '传奇', mask: AVAIL_LEGEND },
  { id: 'anime', label: '动漫/漫画', mask: AVAIL_ANIME, exact: true },
  { id: 'zcg', label: 'ZCG', mask: AVAIL_ZCG },
  { id: 'illegal', label: '观赏/非正式', mask: AVAIL_ILLEGAL, exact: true },
  { id: 'tf', label: '卡片力量(TF)', mask: AVAIL_VG, exact: true },
  { id: 'custom', label: '自定义卡', mask: AVAIL_CUSTOM }
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
