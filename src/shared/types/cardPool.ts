import { CardPoolFilter, CardPoolSchema } from './ipc/cardSearch'

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

const SCOPE_OCG = 0x1
const SCOPE_TCG = 0x2
const SCOPE_ANIME = 0x4
const SCOPE_ILLEGAL = 0x8
const SCOPE_VIDEO_GAME = 0x10
const SCOPE_CUSTOM = 0x20
const SCOPE_SPEED = 0x40
const SCOPE_PRERELEASE = 0x100
const SCOPE_RUSH = 0x200
const SCOPE_LEGEND = 0x400
export const AVAIL_HIDDEN = 0x1000
const SCOPE_ZCG = 0x2000

const CLASSIC_CUSTOM = 0x4
const CLASSIC_SC = 0x8

export function officialOtMask(schema: CardPoolSchema): number {
  return schema === 'kcg'
    ? SCOPE_OCG | SCOPE_TCG | SCOPE_PRERELEASE
    : SCOPE_OCG | SCOPE_TCG | CLASSIC_SC | CLASSIC_CUSTOM
}

export const CARD_POOLS: CardPoolOption[] = [
  { id: 'none', label: '无', spriteY: null },
  { id: 'anime', label: '动漫/漫画', spriteY: 192, otMask: SCOPE_ANIME },
  { id: 'illegal', label: '观赏/非正式', spriteY: 128, otMask: SCOPE_ILLEGAL },
  { id: 'rush', label: '超速（Rush）', spriteY: 576, otMask: SCOPE_RUSH },
  { id: 'tf', label: '卡片力量（TF）', spriteY: 320, otMask: SCOPE_VIDEO_GAME },
  { id: 'speed', label: '速决（Speed Duel）', spriteY: 512, otMask: SCOPE_SPEED },
  { id: 'prerelease', label: '先行（Beta）', spriteY: 448, otMask: SCOPE_PRERELEASE },
  { id: 'custom', label: '自定义', spriteY: 384, otMask: SCOPE_CUSTOM }
]

export const OT_POOLS: CardPoolOption[] = [
  { id: 'ocg', label: 'OCG 独有', spriteY: 0, otMask: SCOPE_OCG },
  { id: 'tcg', label: 'TCG 独有', spriteY: 64, otMask: SCOPE_TCG }
]

export type PoolMatchMode = 'exact' | 'any' | 'all' | 'only'

export interface SearchPoolOption {
  id: Exclude<CardPoolFilter, 'any'>

  label: string

  mask: number

  match: PoolMatchMode

  excludeMask?: number
}

const KCG_POOLS: SearchPoolOption[] = [
  { id: 'ocg', label: 'OCG', mask: SCOPE_OCG, match: 'exact' },
  { id: 'tcg', label: 'TCG', mask: SCOPE_TCG, match: 'exact' },
  { id: 'ocgTcg', label: 'OCG/TCG', mask: SCOPE_OCG | SCOPE_TCG, match: 'exact' },
  { id: 'prerelease', label: '先行卡', mask: SCOPE_PRERELEASE, match: 'any' },
  { id: 'skill', label: 'DL技能卡', mask: SCOPE_SPEED, match: 'any' },
  { id: 'rush', label: '超速(Rush)', mask: SCOPE_RUSH, match: 'any' },
  { id: 'legend', label: '传奇', mask: SCOPE_LEGEND, match: 'any' },
  { id: 'anime', label: '动漫/漫画', mask: SCOPE_ANIME, match: 'exact' },
  { id: 'zcg', label: 'ZCG', mask: SCOPE_ZCG, match: 'exact' },
  { id: 'illegal', label: '观赏/非正式', mask: SCOPE_ILLEGAL, match: 'exact' },
  { id: 'tf', label: '卡片力量(TF)', mask: SCOPE_VIDEO_GAME, match: 'exact' },
  { id: 'custom', label: '自定义卡', mask: SCOPE_CUSTOM, match: 'any' }
]

const CLASSIC_POOLS: SearchPoolOption[] = [
  { id: 'ocg', label: 'OCG', mask: SCOPE_OCG, match: 'any' },
  { id: 'tcg', label: 'TCG', mask: SCOPE_TCG, match: 'any' },
  { id: 'sc', label: '简体中文', mask: CLASSIC_SC, match: 'any' },
  { id: 'custom', label: '自定义卡片', mask: CLASSIC_CUSTOM, match: 'any' },
  { id: 'ocgOnly', label: 'OCG 独有', mask: SCOPE_OCG, match: 'only', excludeMask: SCOPE_TCG },
  { id: 'tcgOnly', label: 'TCG 独有', mask: SCOPE_TCG, match: 'only', excludeMask: SCOPE_OCG },
  { id: 'common', label: '无独有卡', mask: SCOPE_OCG | SCOPE_TCG, match: 'all' }
]

const SCHEMA_POOLS: Record<CardPoolSchema, SearchPoolOption[]> = {
  kcg: KCG_POOLS,
  classic: CLASSIC_POOLS
}

const CLASSIC_CARD_POOLS: CardPoolOption[] = [
  { id: 'none', label: '无', spriteY: null },
  { id: 'custom', label: '自定义', spriteY: 384, otMask: CLASSIC_CUSTOM }
]

export function poolOptions(schema: CardPoolSchema): SearchPoolOption[] {
  return SCHEMA_POOLS[schema]
}

export function searchPoolOption(
  id: CardPoolFilter | undefined,
  schema: CardPoolSchema
): SearchPoolOption | null {
  return SCHEMA_POOLS[schema].find((pool) => pool.id === id) ?? null
}

const ALL_POOL_OPTIONS: CardPoolOption[] = [...CARD_POOLS, ...OT_POOLS]

export const CARD_POOL_SPRITE_HEIGHT = 64
export const CARD_POOL_SPRITE_ROWS = 10

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

const SCOPE_LABEL_MASK = ~(SCOPE_PRERELEASE | SCOPE_LEGEND)
const SCOPE_LABEL_OPTIONS: CardPoolOption[] = [...CARD_POOLS, ...OT_POOLS]

const KCG_SCOPE_TEXT: Array<{ mask: number; label: string }> = [
  { mask: SCOPE_OCG, label: 'OCG' },
  { mask: SCOPE_TCG, label: 'TCG' },
  { mask: SCOPE_ANIME, label: '动漫/漫画' },
  { mask: SCOPE_ILLEGAL, label: '观赏/非正式' },
  { mask: SCOPE_VIDEO_GAME, label: '卡片力量(TF)' },
  { mask: SCOPE_CUSTOM, label: '自定义卡' },
  { mask: SCOPE_SPEED, label: 'DL技能卡' },
  { mask: SCOPE_PRERELEASE, label: '先行卡' },
  { mask: SCOPE_RUSH, label: '超速(Rush)' },
  { mask: SCOPE_ZCG, label: 'ZCG' },
  { mask: SCOPE_LEGEND, label: '传奇' }
]

const CLASSIC_SCOPE_TEXT: Array<{ mask: number; label: string }> = [
  { mask: SCOPE_OCG, label: 'OCG' },
  { mask: SCOPE_TCG, label: 'TCG' },
  { mask: CLASSIC_CUSTOM, label: '自定义' },
  { mask: CLASSIC_SC, label: '简体中文' }
]

export function isLegendCard(ot: number): boolean {
  return (ot & SCOPE_LEGEND) !== 0
}

export function cardScopeText(ot: number, schema: CardPoolSchema): string {
  if (ot === (SCOPE_OCG | SCOPE_TCG)) return ''
  const labels = schema === 'classic' ? CLASSIC_SCOPE_TEXT : KCG_SCOPE_TEXT
  return labels
    .filter(({ mask }) => (ot & mask) !== 0)
    .map(({ label }) => label)
    .join('/')
}

export function cardScopeBadge(ot: number, schema: CardPoolSchema): string | null {
  if (schema === 'classic') {
    const hasOcg = (ot & SCOPE_OCG) !== 0
    const hasTcg = (ot & SCOPE_TCG) !== 0
    if (hasOcg !== hasTcg) return hasOcg ? 'ocg' : 'tcg'
    return (ot & CLASSIC_CUSTOM) !== 0 ? 'custom' : null
  }
  const labelMask = ot & SCOPE_LABEL_MASK
  const matched = SCOPE_LABEL_OPTIONS.find((option) => option.otMask === labelMask)
  return matched?.id ?? null
}

export function cardPoolIdsFromOt(ot: number, schema: CardPoolSchema = 'kcg'): string[] {
  const pools = schema === 'classic' ? CLASSIC_CARD_POOLS : CARD_POOLS
  return pools
    .filter((pool) => pool.otMask !== undefined && (ot & pool.otMask) !== 0)
    .map((pool) => pool.id)
}
