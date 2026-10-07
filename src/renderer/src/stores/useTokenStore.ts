import { create } from 'zustand'
import { CdbCard, CardType } from '@shared/index'

/** Token 名过于通用，直接做子串匹配会命中大量无关效果文本，需排除 */
const TOKEN_NAME_BLOCKLIST = new Set(['不明', '衍生物', 'token'])

interface TokenState {
  /** 全库 Token 名单（按卡名去重，同名取首个卡密），null 表示尚未载入 */
  catalog: CdbCard[] | null
  isCatalogLoading: boolean
  /** 当前等待放入棋盘的 Token，null 表示不在待放置状态 */
  pendingToken: CdbCard | null

  loadCatalog: () => Promise<void>
  suggestFor: (sourceCard: CdbCard | undefined) => CdbCard[]
  armToken: (token: CdbCard) => void
  cancelPending: () => void
}

/** 全库 Token 名单缓存，跨面板共享，避免每次开面板都查一遍 */
let catalogPromise: Promise<CdbCard[]> | null = null

async function fetchCatalog(): Promise<CdbCard[]> {
  const res = await window.api.searchCards({
    type: 0,
    subType: CardType.TOKEN,
    sortField: 'name',
    sortOrder: 'ASC',
    limit: 2000
  })
  const byName = new Map<string, CdbCard>()
  for (const card of res.cards) {
    const name = String(card.name ?? '').trim()
    if (!name || TOKEN_NAME_BLOCKLIST.has(name)) continue
    if (!byName.has(name)) byName.set(name, card)
  }
  return Array.from(byName.values())
}

/**
 * 依据本体卡效果文本推断其能召唤的衍生物。
 * 命中方式为「Token 卡名是效果文本的子串」，实测主库 179 张提及衍生物的怪兽中 152 张可命中，
 * 未命中的 27 张均为「衍生物以外的怪兽2只」这类排除型表述，本就不该推荐。
 */
export function matchTokensByDesc(catalog: CdbCard[], sourceCard: CdbCard): CdbCard[] {
  const desc = String(sourceCard.desc ?? '')
  if (!desc) return []
  const hits: CdbCard[] = []
  for (const token of catalog) {
    const name = String(token.name ?? '')
    if (name.length >= 2 && desc.includes(name)) hits.push(token)
  }
  return hits.sort((a, b) => a.id - b.id)
}

/**
 * 衍生物布置状态：负责缓存全库 Token 名单、按本体卡文本推断推荐项，并持有待放置的 Token。
 * 待放置期间棋盘空怪兽区高亮，点击即落子，Esc 取消。
 */
export const useTokenStore = create<TokenState>((set, get) => ({
  catalog: null,
  isCatalogLoading: false,
  pendingToken: null,

  loadCatalog: async () => {
    if (get().catalog || get().isCatalogLoading) return
    set({ isCatalogLoading: true })
    if (!catalogPromise) {
      catalogPromise = fetchCatalog().catch((err) => {
        console.error('[useTokenStore]加载 Token 名单失败:', err)
        catalogPromise = null
        return []
      })
    }
    const catalog = await catalogPromise
    set({ catalog, isCatalogLoading: false })
  },

  suggestFor: (sourceCard) => {
    const catalog = get().catalog
    if (!catalog || !sourceCard) return []
    return matchTokensByDesc(catalog, sourceCard)
  },

  armToken: (token) => set({ pendingToken: token }),
  cancelPending: () => set({ pendingToken: null })
}))

if (typeof window !== 'undefined' && window.api?.onCdbUpdated) {
  window.api.onCdbUpdated(() => {
    catalogPromise = null
    useTokenStore.setState({ catalog: null })
    void useTokenStore.getState().loadCatalog()
  })
}
