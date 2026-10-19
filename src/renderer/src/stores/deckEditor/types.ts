import type { DeckEditingSlice } from './deckEditingSlice'
import type { DeckLibrarySlice } from './deckLibrarySlice'
import type { TestHandSlice } from './testHandSlice'

export type DeckEditorStore = DeckLibrarySlice & DeckEditingSlice & TestHandSlice
