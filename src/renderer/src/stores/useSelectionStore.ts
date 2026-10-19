import { create } from 'zustand'
import type { EngineRequest, RequestCard } from '@shared/engine/protocol'
import { useDuelEngineStore } from './useDuelEngineStore'
import {
  deriveSelection,
  isSameRequestCard,
  requestCardKey,
  type DuelSelectionKind
} from '../utils/duelSelection'

interface SelectionStoreState {
  pendingKind: DuelSelectionKind | null
  selectedKeys: string[]
  toggle: (card: RequestCard) => void
}

export const useSelectionStore = create<SelectionStoreState>((set, get) => ({
  pendingKind: null,
  selectedKeys: [],

  toggle: (card) => {
    const derived = deriveSelection(useDuelEngineStore.getState().pendingRequest)
    if (!derived || derived.kind === 'unselect') return
    const candidate = derived.candidates.find((c) => isSameRequestCard(c, card))
    if (!candidate) return

    const key = requestCardKey(candidate)
    const current = get().selectedKeys
    if (current.includes(key)) {
      set({ selectedKeys: current.filter((value) => value !== key) })
      return
    }

    const max = derived.max > 0 ? derived.max : Number.POSITIVE_INFINITY
    if (current.length >= max) {
      if (max === 1) set({ selectedKeys: [key] })
      return
    }
    set({ selectedKeys: [...current, key] })
  }
}))

function syncFromRequest(request: EngineRequest | null | undefined): void {
  useSelectionStore.setState({
    pendingKind: deriveSelection(request)?.kind ?? null,
    selectedKeys: []
  })
}

useDuelEngineStore.subscribe((state, prevState) => {
  const nextId = state.pendingRequest?.id ?? null
  const prevId = prevState.pendingRequest?.id ?? null
  if (nextId === prevId) return
  syncFromRequest(state.pendingRequest)
})
