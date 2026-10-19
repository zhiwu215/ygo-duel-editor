import type { StateCreator } from 'zustand'
import {
  CdbCard,
  DeckData,
  DeckSection,
  DeckStats,
  CardUtils,
  calculateDeckStats,
  canPlaceInSection
} from '@shared/index'
import { compareCards, shuffle } from '../../utils/deckSort'
import type { DeckEditorStore } from './types'

export interface DeckEditingSlice {
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  selectedCard: CdbCard | null

  setSelectedCard: (card: CdbCard | null) => void
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
  saveDeckFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>
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

export const createDeckEditingSlice: StateCreator<DeckEditorStore, [], [], DeckEditingSlice> = (
  set,
  get
) => ({
  deck: { ...INITIAL_DECK },
  cardDetails: {},
  selectedCard: null,

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

    const section: DeckSection = targetSection || (isExtra ? 'extra' : 'main')
    if (!canPlaceInSection(card.type, section)) return false

    const list = [...deck[section]]
    const insertAt =
      atIndex === undefined ? list.length : Math.min(Math.max(atIndex, 0), list.length)
    list.splice(insertAt, 0, card.id)

    set({
      deck: { ...deck, [section]: list },
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
      testHandCards: null
    }))
  },

  sortDeck: (): void => {
    const { deck, cardDetails } = get()

    const comparator = compareCards(cardDetails)

    set({
      deck: {
        ...deck,
        main: [...deck.main].sort(comparator),
        extra: [...deck.extra].sort(comparator),
        side: [...deck.side].sort(comparator)
      }
    })
  },

  shuffleDeck: (): void => {
    const { deck } = get()
    set({ deck: { ...deck, main: shuffle(deck.main) } })
  },

  saveDeckFile: async (): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    const { deck } = get()
    return window.api.saveDeckFile(deck)
  },

  getStats: (): DeckStats => {
    const { deck, cardDetails } = get()
    return calculateDeckStats(deck, cardDetails)
  }
})
