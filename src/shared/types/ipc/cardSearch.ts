import { CdbCard } from '../card'

export interface CardSearchParams {
  keyword?: string

  searchDesc?: boolean

  type?: number

  subType?: number

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

  code?: number

  markers?: number

  limitFilter?: LimitFilter

  sortField?: 'atk' | 'def' | 'level' | 'name'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export type LimitFilter = 0 | 1 | 2 | 3

export type NumericCompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'unknown'

export type CardPoolFilter = 'any' | 'ocg' | 'tcg' | 'ocgOnly' | 'tcgOnly' | 'anime' | 'rush' | 'tf'

export type CdbLibraryRole = 'data' | 'text'

export interface CardSearchFilterOptions {
  effectCategories: Array<{ mask: number; label: string }>
  availablePools: string[]
}

export interface CardSearchResult {
  cards: CdbCard[]
  total: number
}

export interface CdbSelectResult {
  success: boolean
  path?: string
  error?: string
}

export interface CdbStatusResult {
  ready: boolean
  path: string | null
  loadedPaths: string[]
  customCdbPath: string
}
