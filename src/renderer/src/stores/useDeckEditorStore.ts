import { create } from 'zustand'
import { createDeckEditingSlice } from './deckEditor/deckEditingSlice'
import { createDeckLibrarySlice } from './deckEditor/deckLibrarySlice'
import { createTestHandSlice } from './deckEditor/testHandSlice'
import type { DeckEditorStore } from './deckEditor/types'

export const useDeckEditorStore = create<DeckEditorStore>()((...a) => ({
  ...createDeckLibrarySlice(...a),
  ...createDeckEditingSlice(...a),
  ...createTestHandSlice(...a)
}))

export type { DeckEditorStore } from './deckEditor/types'
