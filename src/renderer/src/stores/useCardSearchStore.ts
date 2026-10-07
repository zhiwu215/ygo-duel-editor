import { create } from 'zustand'
import {
  CdbCard,
  CardPoolFilter,
  CardSearchParams,
  LimitFilter,
  NumericCompareOp
} from '@shared/index'
import { bumpCardImageVersion } from '../utils/cardImage'

const PAGE_SIZE = 40

export interface CardSearchFilters {
  keyword: string
  searchDesc: boolean
  type: number // 0: 全部, 或 CardType.MONSTER / SPELL / TRAP
  subType: number // 细分种类
  attribute: number // 属性掩码
  race: number // 种族掩码
  level: number // 等级 / Rank / Link
  levelOp: NumericCompareOp // 星级比较符
  scale: number | undefined // 左侧灵摆刻度
  scaleOp: NumericCompareOp // 灵摆刻度比较符
  effectCategoryMask: number // 效果分类位掩码
  cardPool: CardPoolFilter // OCG / TCG 卡池
  markers: number // 连接标记（箭头）位掩码，0=不限
  limitFilter: LimitFilter // 禁限等级，0=不限
  atk: number | undefined // 攻击力
  atkOp: NumericCompareOp // 攻击力比较符
  def: number | undefined // 守备力
  defOp: NumericCompareOp // 守备力比较符
  code: number | undefined // 精确卡密
  sortField: 'id' | 'atk' | 'def' | 'level' | 'name'
  sortOrder: 'ASC' | 'DESC'
}

export const DEFAULT_FILTERS: CardSearchFilters = {
  keyword: '',
  searchDesc: true,
  type: 0,
  subType: 0,
  attribute: 0,
  race: 0,
  level: 0,
  levelOp: 'eq',
  scale: undefined,
  scaleOp: 'eq',
  effectCategoryMask: 0,
  cardPool: 'any',
  markers: 0,
  limitFilter: 0,
  atk: undefined,
  atkOp: 'eq',
  def: undefined,
  defOp: 'eq',
  code: undefined,
  sortField: 'id',
  sortOrder: 'DESC'
}

export interface CardSearchStoreState extends CardSearchFilters {
  results: CdbCard[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  hasSearched: boolean
  /** 高级筛选抽屉是否展开 */
  isFilterOpen: boolean

  /** 设置高级筛选抽屉的展开/收起状态 */
  setIsFilterOpen: (open: boolean) => void
  /** 切换高级筛选抽屉的展开/收起状态 */
  toggleFilterOpen: () => void
  /** 设置搜索关键词并自动触发检索 */
  setKeyword: (keyword: string) => void
  /** 批量更新多维筛选条件（种类、属性、种族、星级等）并触发自动检索 */
  setFilters: (partial: Partial<CardSearchFilters>) => void
  /** 重置所有多维筛选条件为默认初始值 */
  resetFilters: () => void
  /** 执行卡片搜索（支持传入临时覆盖参数） */
  search: (customParams?: Partial<CardSearchParams>) => Promise<void>
  /** 加载下一页卡片数据（分页加载） */
  loadMore: () => Promise<void>
  /** 清空搜索结果与状态 */
  clear: () => void
}

export const useCardSearchStore = create<CardSearchStoreState>((set, get) => ({
  ...DEFAULT_FILTERS,
  results: [],
  total: 0,
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  hasSearched: false,
  isFilterOpen: false,

  setIsFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
  toggleFilterOpen: () => set((state) => ({ isFilterOpen: !state.isFilterOpen })),

  setKeyword: (keyword) => set({ keyword }),

  setFilters: (partial) => {
    set((state) => ({ ...state, ...partial }))
    get().search()
  },

  resetFilters: () => {
    set({
      ...DEFAULT_FILTERS,
      keyword: get().keyword // 保留搜索框已输入的关键字
    })
    get().search()
  },

  search: async (customParams = {}) => {
    const state = get()
    const mergedParams: CardSearchParams = {
      keyword: customParams.keyword !== undefined ? customParams.keyword : state.keyword,
      searchDesc:
        customParams.searchDesc !== undefined ? customParams.searchDesc : state.searchDesc,
      type: customParams.type !== undefined ? customParams.type : state.type,
      subType: customParams.subType !== undefined ? customParams.subType : state.subType,
      attribute: customParams.attribute !== undefined ? customParams.attribute : state.attribute,
      race: customParams.race !== undefined ? customParams.race : state.race,
      level: customParams.level !== undefined ? customParams.level : state.level,
      levelOp: customParams.levelOp !== undefined ? customParams.levelOp : state.levelOp,
      scale: customParams.scale !== undefined ? customParams.scale : state.scale,
      scaleOp: customParams.scaleOp !== undefined ? customParams.scaleOp : state.scaleOp,
      effectCategoryMask:
        customParams.effectCategoryMask !== undefined
          ? customParams.effectCategoryMask
          : state.effectCategoryMask,
      cardPool: customParams.cardPool !== undefined ? customParams.cardPool : state.cardPool,
      markers: customParams.markers !== undefined ? customParams.markers : state.markers,
      limitFilter:
        customParams.limitFilter !== undefined ? customParams.limitFilter : state.limitFilter,
      atk: customParams.atk !== undefined ? customParams.atk : state.atk,
      atkOp: customParams.atkOp !== undefined ? customParams.atkOp : state.atkOp,
      def: customParams.def !== undefined ? customParams.def : state.def,
      defOp: customParams.defOp !== undefined ? customParams.defOp : state.defOp,
      code: customParams.code !== undefined ? customParams.code : state.code,
      sortField: customParams.sortField !== undefined ? customParams.sortField : state.sortField,
      sortOrder: customParams.sortOrder !== undefined ? customParams.sortOrder : state.sortOrder,
      limit: customParams.limit || PAGE_SIZE,
      offset: 0,
      ...customParams
    }

    set({
      isLoading: true,
      hasMore: true
    })

    try {
      const res = await window.api.searchCards(mergedParams)
      set({
        results: res.cards,
        total: res.total,
        isLoading: false,
        hasSearched: true,
        hasMore: res.cards.length >= (mergedParams.limit || PAGE_SIZE)
      })
    } catch (err) {
      console.error('[useCardSearchStore] search failed:', err)
      set({ results: [], total: 0, isLoading: false, hasSearched: true, hasMore: false })
    }
  },

  loadMore: async () => {
    const state = get()
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return

    set({ isLoadingMore: true })
    try {
      const params: CardSearchParams = {
        keyword: state.keyword,
        searchDesc: state.searchDesc,
        type: state.type,
        subType: state.subType,
        attribute: state.attribute,
        race: state.race,
        level: state.level,
        levelOp: state.levelOp,
        scale: state.scale,
        scaleOp: state.scaleOp,
        effectCategoryMask: state.effectCategoryMask,
        cardPool: state.cardPool,
        markers: state.markers,
        limitFilter: state.limitFilter,
        atk: state.atk,
        atkOp: state.atkOp,
        def: state.def,
        defOp: state.defOp,
        code: state.code,
        sortField: state.sortField,
        sortOrder: state.sortOrder,
        limit: PAGE_SIZE,
        offset: state.results.length
      }

      const res = await window.api.searchCards(params)
      if (res.cards.length === 0) {
        set({ isLoadingMore: false, hasMore: false })
        return
      }

      const existingIds = new Set(state.results.map((c) => c.id))
      const uniqueNewCards = res.cards.filter((c) => !existingIds.has(c.id))

      set({
        results: [...state.results, ...uniqueNewCards],
        total: res.total,
        isLoadingMore: false,
        hasMore: res.cards.length >= PAGE_SIZE
      })
    } catch (err) {
      console.error('[useCardSearchStore] loadMore failed:', err)
      set({ isLoadingMore: false, hasMore: false })
    }
  },

  clear: () =>
    set({
      ...DEFAULT_FILTERS,
      results: [],
      total: 0,
      hasSearched: false,
      hasMore: true
    })
}))

// 主窗口 / 设置窗口 / 卡组编辑器窗口是独立渲染进程，各有一份本 store。
// 卡库在设置窗口里改动后必须由主进程广播，否则只有设置窗口那份 store 会刷新。
if (typeof window !== 'undefined' && window.api?.onCdbUpdated) {
  window.api.onCdbUpdated(() => {
    bumpCardImageVersion()
    const state = useCardSearchStore.getState()
    if (!state.hasSearched) return
    void state.search()
  })
}
