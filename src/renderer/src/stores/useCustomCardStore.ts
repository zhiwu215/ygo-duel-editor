import { create } from 'zustand'
import { CustomCard, CustomCardInput, CustomCardSaveResult } from '@shared/index'

interface CustomCardStoreState {
  cards: CustomCard[]
  editorOpen: boolean
  editingId: number | null
  prefillName: string

  load: () => Promise<void>
  openCreate: (prefillName?: string) => void
  openEdit: (id: number) => void
  closeEditor: () => void
  save: (input: CustomCardInput) => Promise<CustomCardSaveResult>
  remove: (id: number) => Promise<boolean>
}

export const useCustomCardStore = create<CustomCardStoreState>((set, get) => ({
  cards: [],
  editorOpen: false,
  editingId: null,
  prefillName: '',

  load: async () => {
    try {
      const cards = await window.api.listCustomCards()
      set({ cards })
    } catch (err) {
      console.error('[useCustomCardStore] load failed:', err)
    }
  },

  openCreate: (prefillName = '') =>
    set({ editorOpen: true, editingId: null, prefillName: prefillName }),

  openEdit: (id) => {
    if (!get().cards.some((card) => card.id === id)) return
    set({ editorOpen: true, editingId: id, prefillName: '' })
  },

  closeEditor: () => set({ editorOpen: false, editingId: null, prefillName: '' }),

  save: async (input) => {
    try {
      const result = await window.api.saveCustomCard(input)
      if (!result.success || !result.card) {
        console.error('[useCustomCardStore] save failed:', result.error)
        return { success: false, error: result.error || '保存失败' }
      }
      const card = result.card
      set((state) => {
        const cards = state.cards.some((item) => item.id === card.id)
          ? state.cards.map((item) => (item.id === card.id ? card : item))
          : [...state.cards, card]
        return { cards }
      })
      return result
    } catch (err) {
      console.error('[useCustomCardStore] save failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '保存失败' }
    }
  },

  remove: async (id) => {
    try {
      const result = await window.api.deleteCustomCard(id)
      if (!result.success) {
        console.error('[useCustomCardStore] delete failed:', result.error)
        return false
      }
      set((state) => ({ cards: state.cards.filter((card) => card.id !== id) }))
      return true
    } catch (err) {
      console.error('[useCustomCardStore] delete failed:', err)
      return false
    }
  }
}))

if (typeof window !== 'undefined' && window.api?.onCustomCardsUpdated) {
  const store = useCustomCardStore
  void store.getState().load()
  window.api.onCustomCardsUpdated(() => {
    void store.getState().load()
  })
}
