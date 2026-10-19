import type { StateCreator } from 'zustand'
import { DeckData, groupChildPath, parseYdk } from '@shared/index'
import type { DeckEditorStore } from './types'

export interface DeckLibrarySlice {
  viewMode: 'library' | 'editor'
  deckList: DeckData[]
  deckGroups: string[]
  selectedGroup: string | null
  searchKeyword: string
  isLoadingLibrary: boolean

  setViewMode: (mode: 'library' | 'editor') => void
  fetchDeckList: () => Promise<void>
  createGroup: (name: string, parent?: string | null) => Promise<boolean>
  renameGroup: (oldName: string, newName: string) => Promise<boolean>
  deleteGroup: (name: string) => Promise<boolean>
  assignDeckGroup: (deckId: string, group: string) => Promise<boolean>
  setSelectedGroup: (group: string | null) => void
  setSearchKeyword: (keyword: string) => void
  openDeck: (targetDeck: DeckData) => Promise<void>
  createNewDeck: () => void
  backToLibrary: () => Promise<void>
  saveCurrentDeckToLibrary: () => Promise<boolean>
  saveDeckAsToLibrary: (group: string) => Promise<boolean>
  deleteDeckFromLibrary: (id: string) => Promise<boolean>
  duplicateDeckInLibrary: (id: string) => Promise<DeckData | null>
  importDeckFileToLibrary: () => Promise<boolean>
  importDeckTextToLibrary: (text: string, deckName: string) => Promise<boolean>
}

export const createDeckLibrarySlice: StateCreator<DeckEditorStore, [], [], DeckLibrarySlice> = (
  set,
  get
) => ({
  viewMode: 'library',
  deckList: [],
  deckGroups: [],
  selectedGroup: null,
  searchKeyword: '',
  isLoadingLibrary: false,

  setViewMode: (mode): void => {
    set({ viewMode: mode })
  },

  fetchDeckList: async (): Promise<void> => {
    set({ isLoadingLibrary: true })
    try {
      if (window.api?.getDeckLibrary) {
        const library = await window.api.getDeckLibrary()
        set({ deckList: library.decks, deckGroups: library.groups })

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
  }
})
