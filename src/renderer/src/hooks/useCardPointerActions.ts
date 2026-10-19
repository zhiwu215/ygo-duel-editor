import React from 'react'
import { CardLocation, FieldCard, isCustomCardCode } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useCardCommandMenuStore } from '../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useStagingStore } from '../stores/useStagingStore'
import { useDropHintStore } from '../stores/useDropHintStore'
import { useSelectionStore } from '../stores/useSelectionStore'
import {
  submitSelection,
  type CardSelectionMatch,
  type CardSelectionRole
} from '../utils/duelSelection'
import { hasCardEngineActions, hasCardEngineActivate } from '../utils/engineActions'

interface CardPointerActionsInput {
  card: FieldCard
  role: CardSelectionRole
  selectionMatch: CardSelectionMatch | null
}

export function useCardPointerActions({
  card,
  role,
  selectionMatch
}: CardPointerActionsInput): (e: React.MouseEvent<HTMLDivElement>) => void {
  const setSelectedCardId = useDuelStore((s) => s.setSelectedCardId)
  const setHoveredCard = useDuelStore((s) => s.setHoveredCard)
  const openStatPopover = useDuelStore((s) => s.openStatPopover)
  const closeStatPopover = useDuelStore((s) => s.closeStatPopover)
  const activeStatPopoverCardId = useDuelStore((s) => s.activeStatPopoverCardId)
  const statPopoverPosition = useDuelStore((s) => s.statPopoverPosition)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
  const hintZone = useDropHintStore((s) => s.zone)
  const showHint = useDropHintStore((s) => s.show)
  const closeHint = useDropHintStore((s) => s.close)
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
    } else if (hasCardEngineActions(pendingRequest, card)) {
      if (menuCard?.instanceId === card.instanceId) {
        closeCommandMenu()
      } else {
        openCommandMenu(card, e.currentTarget.getBoundingClientRect())
      }
    } else if (
      isEngineActive &&
      !stagingActive &&
      isCustomCardCode(card.code) &&
      !hasCardEngineActivate(pendingRequest, card)
    ) {
      if (menuCard?.instanceId === card.instanceId) {
        closeCommandMenu()
      } else {
        openCommandMenu(card, e.currentTarget.getBoundingClientRect())
      }
    } else {
      closeCommandMenu()
      if (isEngineActive && !stagingActive) {
        closeHint()
        return
      }
      const loc = card.location
      const canHint =
        loc === CardLocation.MZONE ||
        loc === CardLocation.SZONE ||
        loc === CardLocation.EXTRA ||
        loc === CardLocation.DECK ||
        loc === CardLocation.HAND
      if (!canHint) {
        closeHint()
        return
      }
      const zone = {
        controller: card.controller,
        location: loc,
        sequence: loc === CardLocation.DECK || loc === CardLocation.EXTRA ? 0 : card.sequence
      }
      if (
        hintZone &&
        hintZone.controller === zone.controller &&
        hintZone.location === zone.location &&
        hintZone.sequence === zone.sequence
      ) {
        closeHint()
      } else {
        showHint(zone)
      }
    }
  }
}
