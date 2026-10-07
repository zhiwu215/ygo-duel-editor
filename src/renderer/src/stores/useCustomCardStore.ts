import { create } from 'zustand'
import { CardType, CustomCard, CustomCardInput } from '@shared/index'

export interface CustomCardEditorForm {
  name: string
  desc: string
  type: number
  attribute: number
  race: number
  level: string
  scaleLeft: string
  scaleRight: string
  atk: string
  def: string
  markers: number
}

interface CustomCardStoreState {
  cards: CustomCard[]
  loaded: boolean
  editorOpen: boolean
  editingId: number | null
  prefillName: string

  load: () => Promise<void>
  openCreate: (prefillName?: string) => void
  openEdit: (id: number) => void
  closeEditor: () => void
  save: (input: CustomCardInput) => Promise<boolean>
  remove: (id: number) => Promise<boolean>
}

const BLANK_FORM: CustomCardEditorForm = {
  name: '',
  desc: '',
  type: CardType.MONSTER | CardType.EFFECT,
  attribute: 1,
  race: 1,
  level: '4',
  scaleLeft: '',
  scaleRight: '',
  atk: '1000',
  def: '1000',
  markers: 0
}

export function editorFormFromCard(
  card: CustomCard | undefined,
  prefillName: string
): CustomCardEditorForm {
  if (!card) {
    return { ...BLANK_FORM, name: prefillName }
  }
  const isLink = (card.type & CardType.LINK) !== 0
  const isPendulum = (card.type & CardType.PENDULUM) !== 0
  return {
    name: card.name,
    desc: card.desc,
    type: card.type,
    attribute: card.attribute,
    race: card.race,
    level: String(card.level & 255),
    scaleLeft: isPendulum ? String((card.level >>> 24) & 255) : '',
    scaleRight: isPendulum ? String((card.level >>> 16) & 255) : '',
    atk: String(card.atk),
    def: isLink ? '' : String(card.def),
    markers: isLink ? card.def : 0
  }
}

export const useCustomCardStore = create<CustomCardStoreState>((set, get) => ({
  cards: [],
  loaded: false,
  editorOpen: false,
  editingId: null,
  prefillName: '',

  load: async () => {
    try {
      const cards = await window.api.listCustomCards()
      set({ cards, loaded: true })
    } catch (err) {
      console.error('[useCustomCardStore] load failed:', err)
    }
  },

  openCreate: (prefillName = '') =>
    set({ editorOpen: true, editingId: null, prefillName: prefillName }),

  openEdit: (id) => {
    if (!get().cards.some((c) => c.id === id)) return
    set({ editorOpen: true, editingId: id, prefillName: '' })
  },

  closeEditor: () => set({ editorOpen: false, editingId: null, prefillName: '' }),

  save: async (input) => {
    try {
      const res = await window.api.saveCustomCard(input)
      if (!res.success || !res.card) {
        console.error('[useCustomCardStore] save failed:', res.error)
        return false
      }
      const card = res.card
      set((state) => {
        const cards = state.cards.some((c) => c.id === card.id)
          ? state.cards.map((c) => (c.id === card.id ? card : c))
          : [...state.cards, card]
        return { cards }
      })
      return true
    } catch (err) {
      console.error('[useCustomCardStore] save failed:', err)
      return false
    }
  },

  remove: async (id) => {
    try {
      const res = await window.api.deleteCustomCard(id)
      if (!res.success) {
        console.error('[useCustomCardStore] delete failed:', res.error)
        return false
      }
      set((state) => ({ cards: state.cards.filter((c) => c.id !== id) }))
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
