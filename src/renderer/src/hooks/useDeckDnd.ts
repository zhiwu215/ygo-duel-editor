import { useState } from 'react'
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { CdbCard, DeckSection } from '@shared/index'
import {
  DeckDragSourceData,
  DeckDropTargetData,
  deckDragGuard
} from '../components/DeckEditor/deckDnd'
import type { DeckFlashTarget } from '../components/DeckEditor/DeckGrid'
import { useDeckEditorStore } from '../stores/useDeckEditorStore'

interface DeckActiveDrag {
  code: number
  width: number
  height: number
  source: 'search' | 'deck'
}

interface DeckDndActions {
  addCard: (card: CdbCard, section?: DeckSection, index?: number) => boolean
  removeCard: (section: DeckSection, index: number) => void
  moveCard: (section: DeckSection, index: number, targetIndex: number) => void
  moveCardBetweenSections: (
    fromSection: DeckSection,
    fromIndex: number,
    toSection: DeckSection,
    toIndex?: number
  ) => boolean
  showRejectToast: (section: DeckSection) => void
  triggerFlash: (target: DeckFlashTarget) => void
}

export function useDeckDnd(actions: DeckDndActions): {
  activeDrag: DeckActiveDrag | null
  sensors: ReturnType<typeof useSensors>
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
} {
  const [activeDrag, setActiveDrag] = useState<DeckActiveDrag | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragStart = (event: DragStartEvent): void => {
    const source = event.active.data.current as DeckDragSourceData | undefined
    if (!source) return
    const rect = event.active.rect.current.initial
    const width = rect?.width ?? 68
    setActiveDrag({
      code: source.source === 'search' ? source.card.id : source.code,
      width,
      height: rect?.height ?? (width * 86) / 59,
      source: source.source
    })
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDrag(null)
    deckDragGuard.lastDragEndAt = Date.now()

    const source = event.active.data.current as DeckDragSourceData | undefined
    const target = event.over?.data.current as DeckDropTargetData | undefined
    if (!source || !target) return

    if (source.source === 'search') {
      if (target.kind === 'search-panel') return
      if (target.kind === 'deck-item') {
        actions.addCard(source.card, target.section, target.index)
      } else {
        actions.addCard(source.card, target.section)
      }
      return
    }

    if (target.kind === 'search-panel') {
      actions.removeCard(source.section, source.index)
      return
    }

    if (target.kind === 'zone') {
      if (target.section === source.section) return
      if (!actions.moveCardBetweenSections(source.section, source.index, target.section)) {
        actions.showRejectToast(target.section)
        return
      }
      const list = useDeckEditorStore.getState().deck[target.section]
      actions.triggerFlash({ section: target.section, index: list.length - 1 })
      return
    }

    if (target.section === source.section) {
      if (target.index !== source.index)
        actions.moveCard(source.section, source.index, target.index)
      return
    }

    if (
      !actions.moveCardBetweenSections(source.section, source.index, target.section, target.index)
    ) {
      actions.showRejectToast(target.section)
      return
    }
    const list = useDeckEditorStore.getState().deck[target.section]
    actions.triggerFlash({
      section: target.section,
      index: Math.min(target.index, list.length - 1)
    })
  }

  const handleDragCancel = (): void => {
    setActiveDrag(null)
    deckDragGuard.lastDragEndAt = Date.now()
  }

  return { activeDrag, sensors, handleDragStart, handleDragEnd, handleDragCancel }
}
