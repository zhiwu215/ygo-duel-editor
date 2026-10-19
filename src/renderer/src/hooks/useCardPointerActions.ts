import React from 'react'
import { FieldCard } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useCardCommandMenuStore } from '../stores/useCardCommandMenuStore'
import { useSelectionStore } from '../stores/useSelectionStore'
import {
  submitSelection,
  type CardSelectionMatch,
  type CardSelectionRole
} from '../utils/duelSelection'
import type { CardActionOptions } from '../utils/ruleCheck'

interface CardPointerActionsInput {
  card: FieldCard
  role: CardSelectionRole
  selectionMatch: CardSelectionMatch | null
  isPlacementSource: boolean
  isPlacementDisplaceTarget: boolean
  availableActions: CardActionOptions
}

export function useCardPointerActions({
  card,
  role,
  selectionMatch,
  isPlacementSource,
  isPlacementDisplaceTarget,
  availableActions
}: CardPointerActionsInput): (e: React.MouseEvent<HTMLDivElement>) => void {
  const setSelectedCardId = useDuelStore((s) => s.setSelectedCardId)
  const setHoveredCard = useDuelStore((s) => s.setHoveredCard)
  const openStatPopover = useDuelStore((s) => s.openStatPopover)
  const closeStatPopover = useDuelStore((s) => s.closeStatPopover)
  const activeStatPopoverCardId = useDuelStore((s) => s.activeStatPopoverCardId)
  const statPopoverPosition = useDuelStore((s) => s.statPopoverPosition)
  const {
    card: menuCard,
    openMenu: openCommandMenu,
    closeMenu: closeCommandMenu
  } = useCardCommandMenuStore()

  return (e) => {
    e.stopPropagation()
    if (role === 'dim') return
    if (selectionMatch) {
      closeCommandMenu()
      const derived = selectionMatch.derived
      if (derived.kind === 'unselect') {
        submitSelection(derived, [selectionMatch.requestCard])
        return
      }
      if (derived.min === 1 && derived.max === 1) {
        submitSelection(derived, [selectionMatch.requestCard])
        return
      }
      useSelectionStore.getState().toggle(selectionMatch.requestCard)
      return
    }
    if (isPlacementSource) {
      useDuelStore.getState().cancelPlacement()
      return
    }
    if (isPlacementDisplaceTarget) {
      useDuelStore.getState().commitPlacement({
        location: card.location,
        sequence: card.sequence,
        controller: card.controller
      })
      return
    }
    setSelectedCardId(card.instanceId)
    if (card.card) setHoveredCard(card.card)
    if (e.shiftKey) {
      closeCommandMenu()
      if (activeStatPopoverCardId === card.instanceId) {
        closeStatPopover()
      } else {
        const rect = e.currentTarget.getBoundingClientRect()
        const isRight = rect.right > window.innerWidth - 270
        const defaultX = isRight ? Math.max(16, rect.left - 248 - 12) : rect.right + 12
        const defaultY = Math.max(16, Math.min(rect.top - 20, window.innerHeight - 380))
        openStatPopover(card.instanceId, statPopoverPosition || { x: defaultX, y: defaultY })
      }
    } else if (availableActions.hasAnyAction) {
      if (menuCard?.instanceId === card.instanceId) {
        closeCommandMenu()
      } else {
        openCommandMenu(card, availableActions, e.currentTarget.getBoundingClientRect())
      }
    } else {
      closeCommandMenu()
    }
  }
}
