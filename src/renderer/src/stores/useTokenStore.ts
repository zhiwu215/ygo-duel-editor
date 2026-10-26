import { create } from 'zustand'
import { CdbCard, CardType } from '@shared/index'
import { useDuelStore } from './useDuelStore'

const TOKEN_NAME_BLOCKLIST = new Set(['不明', '衍生物', 'token'])

export interface PendingTokenPlacement {
  card: CdbCard
  position: number
  total: number | null
  placed: number
}

interface TokenState {
  catalog: CdbCard[] | null
  isCatalogLoading: boolean
  pending: PendingTokenPlacement | null

  loadCatalog: () => Promise<void>
  armToken: (token: CdbCard, position: number, total: number | null) => void
  cancelPending: () => void
  placePending: (zone: {
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  }) => void
}

let catalogPromise: Promise<CdbCard[]> | null = null

async function fetchCatalog(): Promise<CdbCard[]> {
  const res = await window.api.searchCards({
    type: 0,
    subType: CardType.TOKEN,
    includeTokens: true,
    sortField: 'name',
    sortOrder: 'ASC',
    limit: 2000
  })
  return res.cards.filter((card) => {
    const name = String(card.name ?? '').trim()
    return name.length > 0 && !TOKEN_NAME_BLOCKLIST.has(name)
  })
}

export const useTokenStore = create<TokenState>((set, get) => ({
  catalog: null,
  isCatalogLoading: false,
  pending: null,

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

  armToken: (token, position, total) =>
    set({ pending: { card: token, position, total, placed: 0 } }),

  cancelPending: () => set({ pending: null }),

  placePending: (zone) => {
    const pending = get().pending
    if (!pending) return
    useDuelStore
      .getState()
      .summonToken(
        pending.card,
        zone.controller,
        zone.location,
        zone.sequence,
        pending.position,
        zone.duelistId
      )
    const placed = pending.placed + 1
    if (pending.total !== null && placed >= pending.total) {
      set({ pending: null })
    } else {
      set({ pending: { ...pending, placed } })
    }
  }
}))

if (typeof window !== 'undefined' && window.api?.onCdbUpdated) {
  window.api.onCdbUpdated(() => {
    catalogPromise = null
    useTokenStore.setState({ catalog: null })
    void useTokenStore.getState().loadCatalog()
  })
}
