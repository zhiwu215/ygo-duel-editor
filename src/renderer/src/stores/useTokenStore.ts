import { create } from 'zustand'
import { CdbCard, CardType } from '@shared/index'

const TOKEN_NAME_BLOCKLIST = new Set(['不明', '衍生物', 'token'])

interface TokenState {
  catalog: CdbCard[] | null
  isCatalogLoading: boolean
  pendingToken: CdbCard | null

  loadCatalog: () => Promise<void>
  armToken: (token: CdbCard) => void
  cancelPending: () => void
}

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
