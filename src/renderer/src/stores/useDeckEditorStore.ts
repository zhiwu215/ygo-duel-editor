import { create } from 'zustand'
import { DeckData, DeckStats, CdbCard, CardUtils, calculateDeckStats } from '@shared/index'

interface DeckEditorState {
  // 视图模式：'library' (总览卡组资产库) 或 'editor' (卡组三栏编辑台)
  viewMode: 'library' | 'editor'

  // 卡组库管理
  deckList: DeckData[]
  selectedTag: string | null
  searchKeyword: string
  isLoadingLibrary: boolean

  // 当前正在编辑的卡组
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  selectedCard: CdbCard | null
  testHandCards: number[] | null // 试抽手牌 (null 表示未开启试抽)

  // 动作：卡组库
  setViewMode: (mode: 'library' | 'editor') => void
  fetchDeckList: () => Promise<void>
  setSelectedTag: (tag: string | null) => void
  setSearchKeyword: (keyword: string) => void
  openDeck: (targetDeck: DeckData) => Promise<void>
  createNewDeck: () => void
  backToLibrary: () => Promise<void>
  saveCurrentDeckToLibrary: () => Promise<boolean>
  deleteDeckFromLibrary: (id: string) => Promise<boolean>
  duplicateDeckInLibrary: (id: string) => Promise<DeckData | null>
  importDeckFileToLibrary: () => Promise<boolean>

  // 动作：卡组单体编辑
  setSelectedCard: (card: CdbCard | null) => void
  setDeckName: (name: string) => void
  setDeckDescription: (desc: string) => void
  setDeckTags: (tags: string[]) => void
  addDeckTag: (tag: string) => void
  removeDeckTag: (tag: string) => void
  setDeckCover: (cardId: number | undefined) => void
  addCard: (card: CdbCard, targetSection?: 'main' | 'extra' | 'side') => boolean
  removeCard: (section: 'main' | 'extra' | 'side', index: number) => void
  clearDeck: () => void
  loadDeck: (deck: DeckData) => Promise<void>
  sortDeck: () => void
  drawTestHand: () => number[]
  closeTestHand: () => void
  saveDeckFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  importDeckFile: () => Promise<boolean>
  applyToDuel: (player: 0 | 1, drawCount?: number, targetDeck?: DeckData) => Promise<boolean>
  getStats: () => DeckStats
}

const INITIAL_DECK: DeckData = {
  name: '新建卡组',
  description: '',
  tags: [],
  main: [],
  extra: [],
  side: []
}

export const useDeckEditorStore = create<DeckEditorState>((set, get) => ({
  viewMode: 'library',
  deckList: [],
  selectedTag: null,
  searchKeyword: '',
  isLoadingLibrary: false,

  deck: { ...INITIAL_DECK },
  cardDetails: {},
  selectedCard: null,
  testHandCards: null,

  setViewMode: (mode): void => {
    set({ viewMode: mode })
  },

  fetchDeckList: async (): Promise<void> => {
    set({ isLoadingLibrary: true })
    try {
      if (window.api?.getDeckList) {
        const list = await window.api.getDeckList()
        set({ deckList: list })

        // 收集所有卡组封面卡密，批量获取详情以显示封面卡图
        const coverCodes = new Set<number>()
        for (const d of list) {
          if (d.coverCard) {
            coverCodes.add(d.coverCard)
          } else if (d.extra.length > 0) {
            coverCodes.add(d.extra[0])
          } else if (d.main.length > 0) {
            coverCodes.add(d.main[0])
          }
        }

        if (coverCodes.size > 0 && window.api.getCardsByIds) {
          const cardsMap = await window.api.getCardsByIds(Array.from(coverCodes))
          set((prev) => ({
            cardDetails: { ...prev.cardDetails, ...cardsMap }
          }))
        }
      }
    } catch (err) {
      console.error('[DeckEditorStore] fetchDeckList error:', err)
    } finally {
      set({ isLoadingLibrary: false })
    }
  },

  setSelectedTag: (tag): void => {
    set({ selectedTag: tag })
  },

  setSearchKeyword: (keyword): void => {
    set({ searchKeyword: keyword })
  },

  openDeck: async (targetDeck): Promise<void> => {
    await get().loadDeck(targetDeck)
    set({ viewMode: 'editor' })
  },

  createNewDeck: (): void => {
    set({
      deck: {
        id: `deck_${Date.now()}`,
        name: '新建卡组',
        description: '',
        tags: [],
        main: [],
        extra: [],
        side: []
      },
      selectedCard: null,
      testHandCards: null,
      viewMode: 'editor'
    })
  },

  backToLibrary: async (): Promise<void> => {
    set({ viewMode: 'library' })
    await get().fetchDeckList()
  },

  saveCurrentDeckToLibrary: async (): Promise<boolean> => {
    const { deck } = get()
    if (!window.api?.saveDeckToLibrary) return false
    try {
      const res = await window.api.saveDeckToLibrary(deck)
      if (res.success && res.deck) {
        set({ deck: res.deck })
        await get().fetchDeckList()
        return true
      }
    } catch (err) {
      console.error('[DeckEditorStore] saveCurrentDeckToLibrary error:', err)
    }
    return false
  },

  deleteDeckFromLibrary: async (id): Promise<boolean> => {
    if (!window.api?.deleteDeckFromLibrary) return false
    try {
      const ok = await window.api.deleteDeckFromLibrary(id)
      if (ok) {
        await get().fetchDeckList()
        return true
      }
    } catch (err) {
      console.error('[DeckEditorStore] deleteDeckFromLibrary error:', err)
    }
    return false
  },

  duplicateDeckInLibrary: async (id): Promise<DeckData | null> => {
    if (!window.api?.duplicateDeckInLibrary) return null
    try {
      const cloned = await window.api.duplicateDeckInLibrary(id)
      if (cloned) {
        await get().fetchDeckList()
        return cloned
      }
    } catch (err) {
      console.error('[DeckEditorStore] duplicateDeckInLibrary error:', err)
    }
    return null
  },

  importDeckFileToLibrary: async (): Promise<boolean> => {
    if (!window.api?.loadDeckFile || !window.api.saveDeckToLibrary) return false
    try {
      const res = await window.api.loadDeckFile()
      if (res.success && res.deck) {
        await window.api.saveDeckToLibrary(res.deck)
        await get().fetchDeckList()
        return true
      }
    } catch (err) {
      console.error('[DeckEditorStore] importDeckFileToLibrary error:', err)
    }
    return false
  },

  setSelectedCard: (card): void => {
    set({ selectedCard: card })
  },

  setDeckName: (name): void => {
    set((prev) => ({ deck: { ...prev.deck, name } }))
  },

  setDeckDescription: (desc): void => {
    set((prev) => ({ deck: { ...prev.deck, description: desc } }))
  },

  setDeckTags: (tags): void => {
    set((prev) => ({ deck: { ...prev.deck, tags } }))
  },

  addDeckTag: (tag): void => {
    const trimmed = tag.trim()
    if (!trimmed) return
    const { deck } = get()
    const currentTags = deck.tags || []
    if (!currentTags.includes(trimmed)) {
      set({ deck: { ...deck, tags: [...currentTags, trimmed] } })
    }
  },

  removeDeckTag: (tagToRemove): void => {
    const { deck } = get()
    const currentTags = deck.tags || []
    set({ deck: { ...deck, tags: currentTags.filter((t) => t !== tagToRemove) } })
  },

  setDeckCover: (cardId): void => {
    set((prev) => ({ deck: { ...prev.deck, coverCard: cardId } }))
  },

  addCard: (card, targetSection): boolean => {
    const { deck, cardDetails } = get()
    const isExtra = CardUtils.isExtraDeck(card.type)

    // 默认区域判定：额外怪兽默认进入 extra，其余进入 main
    const section: 'main' | 'extra' | 'side' = targetSection || (isExtra ? 'extra' : 'main')

    // 自由创作模式：解除数量与同名卡死锁限制，允许同人剧情突破 20 额外等创作特权
    const nextDeck = { ...deck }
    nextDeck[section] = [...nextDeck[section], card.id]

    set({
      deck: nextDeck,
      cardDetails: { ...cardDetails, [card.id]: card },
      selectedCard: card
    })

    return true
  },

  removeCard: (section, index): void => {
    const { deck } = get()
    const list = [...deck[section]]
    if (index >= 0 && index < list.length) {
      list.splice(index, 1)
      set({
        deck: {
          ...deck,
          [section]: list
        }
      })
    }
  },

  clearDeck: (): void => {
    set((prev) => ({
      deck: {
        id: prev.deck.id,
        name: '新建卡组',
        description: '',
        tags: [],
        main: [],
        extra: [],
        side: []
      },
      testHandCards: null
    }))
  },

  loadDeck: async (newDeck): Promise<void> => {
    const allCodes = Array.from(
      new Set([
        ...newDeck.main,
        ...newDeck.extra,
        ...newDeck.side,
        ...(newDeck.coverCard ? [newDeck.coverCard] : [])
      ])
    )
    let fetchedDetails: Record<number, CdbCard> = {}

    if (allCodes.length > 0 && window.api?.getCardsByIds) {
      try {
        fetchedDetails = await window.api.getCardsByIds(allCodes)
      } catch (err) {
        console.error('[DeckEditorStore] loadDeck details error:', err)
      }
    }

    set((prev) => ({
      deck: newDeck,
      cardDetails: { ...prev.cardDetails, ...fetchedDetails },
      selectedCard: allCodes.length > 0 ? fetchedDetails[allCodes[0]] || null : null,
      testHandCards: null
    }))
  },

  sortDeck: (): void => {
    const { deck, cardDetails } = get()

    const compareCards = (aId: number, bId: number): number => {
      const a = cardDetails[aId]
      const b = cardDetails[bId]
      if (!a || !b) return aId - bId

      // 1. 种类权重 (怪兽 -> 魔法 -> 陷阱)
      const getKindOrder = (type: number): number => {
        if (CardUtils.isMonster(type)) return 1
        if (CardUtils.isSpell(type)) return 2
        if (CardUtils.isTrap(type)) return 3
        return 4
      }

      const kindA = getKindOrder(a.type)
      const kindB = getKindOrder(b.type)
      if (kindA !== kindB) return kindA - kindB

      // 2. 星级从高到低
      if (a.level !== b.level) return b.level - a.level
      // 3. 攻击力从高到低
      if (a.atk !== b.atk) return b.atk - a.atk
      // 4. 卡密
      return a.id - b.id
    }

    set({
      deck: {
        ...deck,
        main: [...deck.main].sort(compareCards),
        extra: [...deck.extra].sort(compareCards),
        side: [...deck.side].sort(compareCards)
      }
    })
  },

  drawTestHand: (): number[] => {
    const { deck } = get()
    if (deck.main.length === 0) return []

    // 随机洗牌
    const pool = [...deck.main]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    const hand = pool.slice(0, Math.min(5, pool.length))
    set({ testHandCards: hand })
    return hand
  },

  closeTestHand: (): void => {
    set({ testHandCards: null })
  },

  saveDeckFile: async (): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    const { deck } = get()
    return window.api.saveDeckFile(deck)
  },

  importDeckFile: async (): Promise<boolean> => {
    const res = await window.api.loadDeckFile()
    if (res.success && res.deck) {
      await get().loadDeck(res.deck)
      return true
    }
    return false
  },

  applyToDuel: async (player, drawCount, targetDeck): Promise<boolean> => {
    const deckToApply = targetDeck || get().deck
    return window.api.applyDeckToDuel({
      player,
      deck: deckToApply,
      drawCount
    })
  },

  getStats: (): DeckStats => {
    const { deck, cardDetails } = get()
    return calculateDeckStats(deck, cardDetails)
  }
}))
