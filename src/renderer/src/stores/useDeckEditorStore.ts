import { create } from 'zustand'
import {
  DeckData,
  DeckSection,
  DeckStats,
  CdbCard,
  CardUtils,
  calculateDeckStats,
  canPlaceInSection,
  parseYdk,
  groupChildPath
} from '@shared/index'

interface DeckEditorState {
  // 视图模式：'library' (总览卡组资产库) 或 'editor' (卡组三栏编辑台)
  viewMode: 'library' | 'editor'

  // 卡组库管理
  deckList: DeckData[]
  /** 分组完整路径列表（独立实体，可为空分组；嵌套形如 '剧情/暗之游戏'） */
  deckGroups: string[]
  selectedGroup: string | null
  searchKeyword: string
  isLoadingLibrary: boolean

  // 当前正在编辑的卡组
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  selectedCard: CdbCard | null
  /** 悬停预览的卡密；非空时详情面板优先展示它，不影响 selectedCard */
  hoveredCardId: number | null
  testHandCards: number[] | null // 试抽手牌 (null 表示未开启试抽)

  // 动作：卡组库
  setViewMode: (mode: 'library' | 'editor') => void
  fetchDeckList: () => Promise<void>
  createGroup: (name: string, parent?: string | null) => Promise<boolean>
  /** 重命名分组（同步组内卡组）；重名时返回 false */
  renameGroup: (oldName: string, newName: string) => Promise<boolean>
  /** 删除分组，组内卡组退回未分组 */
  deleteGroup: (name: string) => Promise<boolean>
  /** 把卡组移动到分组，空串表示移回未分组 */
  assignDeckGroup: (deckId: string, group: string) => Promise<boolean>
  setSelectedGroup: (group: string | null) => void
  setSearchKeyword: (keyword: string) => void
  openDeck: (targetDeck: DeckData) => Promise<void>
  createNewDeck: () => void
  backToLibrary: () => Promise<void>
  saveCurrentDeckToLibrary: () => Promise<boolean>
  /** 另存：以当前名称存入指定分组，同分组同名时覆盖那份 */
  saveDeckAsToLibrary: (group: string) => Promise<boolean>
  deleteDeckFromLibrary: (id: string) => Promise<boolean>
  duplicateDeckInLibrary: (id: string) => Promise<DeckData | null>
  importDeckFileToLibrary: () => Promise<boolean>
  importDeckTextToLibrary: (text: string, deckName: string) => Promise<boolean>

  // 动作：卡组单体编辑
  setSelectedCard: (card: CdbCard | null) => void
  /** 悬停预览，不改写 selectedCard；传 null 恢复展示选中卡 */
  setHoveredCardId: (code: number | null) => void
  setDeckName: (name: string) => void
  setDeckDescription: (desc: string) => void
  setDeckTags: (tags: string[]) => void
  setDeckGroup: (group: string) => void
  addDeckTag: (tag: string) => void
  removeDeckTag: (tag: string) => void
  setDeckCover: (cardId: number | undefined) => void
  addCard: (card: CdbCard, targetSection?: DeckSection, atIndex?: number) => boolean
  removeCard: (section: DeckSection, index: number) => void
  moveCard: (section: DeckSection, fromIndex: number, toIndex: number) => void
  moveCardBetweenSections: (
    fromSection: DeckSection,
    fromIndex: number,
    toSection: DeckSection,
    toIndex?: number
  ) => boolean
  clearDeck: () => void
  loadDeck: (deck: DeckData) => Promise<void>
  sortDeck: () => void
  shuffleDeck: () => void
  drawTestHand: () => number[]
  closeTestHand: () => void
  saveDeckFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>
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
  deckGroups: [],
  selectedGroup: null,
  searchKeyword: '',
  isLoadingLibrary: false,

  deck: { ...INITIAL_DECK },
  cardDetails: {},
  selectedCard: null,
  hoveredCardId: null,
  testHandCards: null,

  setViewMode: (mode): void => {
    set({ viewMode: mode })
  },

  fetchDeckList: async (): Promise<void> => {
    set({ isLoadingLibrary: true })
    try {
      if (window.api?.getDeckLibrary) {
        const library = await window.api.getDeckLibrary()
        set({ deckList: library.decks, deckGroups: library.groups })

        // 收集所有卡组封面卡密，批量获取详情以显示封面卡图
        const coverCodes = new Set<number>()
        for (const d of library.decks) {
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
      } else if (window.api?.getDeckList) {
        set({ deckList: await window.api.getDeckList() })
      }
    } catch (err) {
      console.error('[DeckEditorStore] fetchDeckList error:', err)
    } finally {
      set({ isLoadingLibrary: false })
    }
  },

  createGroup: async (name, parent) => {
    const ok = await window.api.createDeckGroup(name, parent ?? null)
    await get().fetchDeckList()
    if (ok) set({ selectedGroup: parent ? parent : groupChildPath(null, name) })
    return ok
  },

  renameGroup: async (oldName, newName) => {
    const ok = await window.api.renameDeckGroup(oldName, newName)
    await get().fetchDeckList()
    // 正看着这个分组时，选中项要跟着改名，否则筛选会突然失效
    if (get().selectedGroup === oldName) set({ selectedGroup: newName.trim() })
    return ok
  },

  deleteGroup: async (name) => {
    const ok = await window.api.deleteDeckGroup(name)
    await get().fetchDeckList()
    if (get().selectedGroup === name) set({ selectedGroup: null })
    return ok
  },

  assignDeckGroup: async (deckId, group) => {
    const ok = await window.api.assignDeckGroup(deckId, group)
    if (ok) {
      // 只改本地 state，不整库重拉：拖拽归组是高频操作，走一趟磁盘 + 重新取卡图太重
      set((prev) => ({
        deckList: prev.deckList.map((d) => (d.id === deckId ? { ...d, group } : d))
      }))
    }
    return ok
  },

  setSelectedGroup: (group): void => {
    set({ selectedGroup: group })
  },

  setSearchKeyword: (keyword): void => {
    set({ searchKeyword: keyword })
  },

  openDeck: async (targetDeck): Promise<void> => {
    await get().loadDeck(targetDeck)
    set({ viewMode: 'editor' })
  },

  createNewDeck: (): void => {
    const { selectedGroup } = get()
    set({
      deck: {
        id: `deck_${Date.now()}`,
        name: '新建卡组',
        description: '',
        tags: [],
        group: selectedGroup || undefined,
        main: [],
        extra: [],
        side: []
      },
      selectedCard: null,
      hoveredCardId: null,
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

  saveDeckAsToLibrary: async (group): Promise<boolean> => {
    const { deck, deckList } = get()
    const name = deck.name.trim()
    if (!name || !window.api?.saveDeckToLibrary) return false
    const twin = deckList.find((d) => (d.group ?? '') === group && d.name === name)
    const copy: DeckData = { ...deck, id: twin?.id, name, group: group || undefined }
    try {
      const res = await window.api.saveDeckToLibrary(copy)
      if (res.success && res.deck) {
        set({ deck: res.deck })
        await get().fetchDeckList()
        return true
      }
    } catch (err) {
      console.error('[DeckEditorStore] saveDeckAsToLibrary error:', err)
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

  importDeckTextToLibrary: async (text: string, deckName: string): Promise<boolean> => {
    if (!window.api?.saveDeckToLibrary) return false
    try {
      const deck = parseYdk(text, deckName)
      if (deck.main.length + deck.extra.length + deck.side.length === 0) return false
      await window.api.saveDeckToLibrary(deck)
      await get().fetchDeckList()
      return true
    } catch (err) {
      console.error('[DeckEditorStore] importDeckTextToLibrary error:', err)
    }
    return false
  },

  setSelectedCard: (card): void => {
    set({ selectedCard: card })
  },

  setHoveredCardId: (code): void => {
    set({ hoveredCardId: code })
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

  setDeckGroup: (group): void => {
    const trimmed = group.trim()
    set((prev) => ({ deck: { ...prev.deck, group: trimmed || undefined } }))
  },

  setDeckCover: (cardId): void => {
    set((prev) => ({ deck: { ...prev.deck, coverCard: cardId } }))
  },

  addCard: (card, targetSection, atIndex): boolean => {
    const { deck, cardDetails } = get()
    const isExtra = CardUtils.isExtraDeck(card.type)

    // 默认区域判定：额外怪兽默认进入 extra，其余进入 main
    const section: DeckSection = targetSection || (isExtra ? 'extra' : 'main')
    if (!canPlaceInSection(card.type, section)) return false

    const list = [...deck[section]]
    const insertAt =
      atIndex === undefined ? list.length : Math.min(Math.max(atIndex, 0), list.length)
    list.splice(insertAt, 0, card.id)

    set({
      deck: { ...deck, [section]: list },
      cardDetails: { ...cardDetails, [card.id]: card },
      selectedCard: card,
      hoveredCardId: null
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

  moveCard: (section, fromIndex, toIndex): void => {
    const { deck } = get()
    const cards = deck[section]
    if (
      fromIndex < 0 ||
      fromIndex >= cards.length ||
      toIndex < 0 ||
      toIndex >= cards.length ||
      fromIndex === toIndex
    ) {
      return
    }

    const movedCard = cards[fromIndex]
    if (movedCard === undefined) return
    const nextCards = [...cards]
    nextCards.splice(fromIndex, 1)
    nextCards.splice(toIndex, 0, movedCard)
    set({ deck: { ...deck, [section]: nextCards } })
  },

  moveCardBetweenSections: (fromSection, fromIndex, toSection, toIndex): boolean => {
    const { deck, cardDetails } = get()

    if (fromSection === toSection) {
      get().moveCard(fromSection, fromIndex, toIndex ?? fromIndex)
      return true
    }

    const code = deck[fromSection][fromIndex]
    if (code === undefined) return false

    const type = cardDetails[code]?.type
    if (type !== undefined && !canPlaceInSection(type, toSection)) return false

    const from = [...deck[fromSection]]
    from.splice(fromIndex, 1)
    const to = [...deck[toSection]]
    const insertAt = toIndex === undefined ? to.length : Math.min(Math.max(toIndex, 0), to.length)
    to.splice(insertAt, 0, code)

    set({ deck: { ...deck, [fromSection]: from, [toSection]: to } })
    return true
  },

  clearDeck: (): void => {
    set((prev) => ({
      deck: {
        id: prev.deck.id,
        name: '新建卡组',
        description: '',
        tags: [],
        group: prev.deck.group,
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
      hoveredCardId: null,
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

  shuffleDeck: (): void => {
    const { deck } = get()
    const pool = [...deck.main]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    set({ deck: { ...deck, main: pool } })
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
