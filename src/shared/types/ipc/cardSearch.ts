import { CdbCard } from '../card'

export interface CardSearchParams {
  keyword?: string

  searchDesc?: boolean

  showUnofficial?: boolean

  type?: number

  subType?: number

  includeTokens?: boolean

  effectCategoryMask?: number

  cardPool?: CardPoolFilter

  race?: number
  attribute?: number
  level?: number
  scale?: number
  scaleOp?: NumericCompareOp
  atk?: number
  def?: number

  atkOp?: NumericCompareOp

  defOp?: NumericCompareOp

  levelOp?: NumericCompareOp

  markers?: number

  limitFilter?: LimitFilter

  sortField?: 'atk' | 'def' | 'level' | 'name'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
  onlyFavorites?: boolean

  favoriteCategoryId?: string
}

export type LimitFilter = 0 | 1 | 2 | 3

export type NumericCompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'unknown'

export type CardPoolSchema = 'kcg' | 'classic'

export type CardPoolFilter =
  | 'any'
  | 'ocg'
  | 'tcg'
  | 'ocgTcg'
  | 'sc'
  | 'custom'
  | 'ocgOnly'
  | 'tcgOnly'
  | 'common'
  | 'prerelease'
  | 'skill'
  | 'rush'
  | 'legend'
  | 'anime'
  | 'zcg'
  | 'illegal'
  | 'tf'

export type CdbLibraryRole = 'data' | 'text'

export interface CardSearchFilterOptions {
  effectCategories: Array<{ mask: number; label: string }>
  setnames: Array<{ code: number; name: string }>
  poolSchema: CardPoolSchema
  banlists: string[]
  banlist: string | null
}

export interface CardSearchResult {
  cards: CdbCard[]
  total: number
}

export interface GameLanguageOption {
  id: string

  detail?: string
}

export interface CdbSelectResult {
  success: boolean
  path?: string
  error?: string
  languageOptions?: GameLanguageOption[]

  artOnlyImages?: boolean
}

export interface CardImageDirResult {
  success: boolean
  canceled?: boolean
  path?: string
  error?: string
}

export type CdbLibrarySource = 'primary' | 'bundled' | 'extra' | 'language'

export interface CdbLibraryInfo {
  path: string
  source: CdbLibrarySource
}

export interface CdbStatusResult {
  ready: boolean
  path: string | null
  loadedPaths: string[]
  customCdbPath: string
  libraries: CdbLibraryInfo[]
  customSyncCdb?: CustomSyncCdbInfo | null
}

export interface CustomSyncCdbInfo {
  path: string
  exists: boolean
}
