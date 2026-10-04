import { create } from 'zustand'
import { DeckData, DeckStats, CdbCard, CardUtils, calculateDeckStats } from '@shared/index'

interface DeckEditorState {
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  selectedCard: CdbCard | null
  testHandCards: number[] | null // 试抽手牌 (null 表示未开启试抽)

  // 动作
  setSelectedCard: (card: CdbCard | null) => void
  setDeckName: (name: string) => void
  addCard: (card: CdbCard, targetSection?: 'main' | 'extra' | 'side') => boolean
  removeCard: (section: 'main' | 'extra' | 'side', index: number) => void
  clearDeck: () => void
  loadDeck: (deck: DeckData) => Promise<void>
  sortDeck: () => void
  drawTestHand: () => number[]
  closeTestHand: () => void
  saveDeckFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  importDeckFile: () => Promise<boolean>
  applyToDuel: (player: 0 | 1, drawCount?: number) => Promise<boolean>
  getStats: () => DeckStats
}

const INITIAL_DECK: DeckData = {
  name: '新建卡组',
  main: [],
  extra: [],
  side: []
}

export const useDeckEditorStore = create<DeckEditorState>((set, get) => ({
  deck: { ...INITIAL_DECK },
  cardDetails: {},
  selectedCard: null,
  testHandCards: null,

  setSelectedCard: (card): void => {
    set({ selectedCard: card })
  },

  setDeckName: (name): void => {
    set((prev) => ({ deck: { ...prev.deck, name } }))
  },

  addCard: (card, targetSection): boolean => {
    const { deck, cardDetails } = get()
    const isExtra = CardUtils.isExtraDeck(card.type)

    // 默认区域判定：额外怪兽默认进入 extra，其余进入 main
    const section: 'main' | 'extra' | 'side' = targetSection || (isExtra ? 'extra' : 'main')

    // 基础容量校验
    if (section === 'main' && deck.main.length >= 60) return false
    if (section === 'extra' && (!isExtra || deck.extra.length >= 15)) return false
    if (section === 'side' && deck.side.length >= 15) return false

    // 全卡组（主+额外+副）同名卡不超过 3 张限制
    const totalCount =
      deck.main.filter((c) => c === card.id).length +
      deck.extra.filter((c) => c === card.id).length +
      deck.side.filter((c) => c === card.id).length

    if (totalCount >= 3) {
      return false
    }

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
    set({
      deck: {
        name: '新建卡组',
        main: [],
        extra: [],
        side: []
      },
      testHandCards: null
    })
  },

  loadDeck: async (newDeck): Promise<void> => {
    const allCodes = Array.from(new Set([...newDeck.main, ...newDeck.extra, ...newDeck.side]))
    let fetchedDetails: Record<number, CdbCard> = {}

    if (allCodes.length > 0 && window.api?.getCardsByIds) {
      try {
        fetchedDetails = await window.api.getCardsByIds(allCodes)
      } catch (err) {
        console.error('[DeckEditorStore] loadDeck details error:', err)
      }
    }

    set({
      deck: newDeck,
      cardDetails: fetchedDetails,
      selectedCard: allCodes.length > 0 ? fetchedDetails[allCodes[0]] || null : null,
      testHandCards: null
    })
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

  applyToDuel: async (player, drawCount): Promise<boolean> => {
    const { deck } = get()
    return window.api.applyDeckToDuel({
      player,
      deck,
      drawCount
    })
  },

  getStats: (): DeckStats => {
    const { deck, cardDetails } = get()
    return calculateDeckStats(deck, cardDetails)
  }
}))
