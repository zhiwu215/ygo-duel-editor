import React from 'react'
import { CardLocation, CardPosition, FieldCard, isPlaceholderCard } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useCardCommandMenuStore } from '../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useDropHintStore } from '../stores/useDropHintStore'
import { useSelectionStore } from '../stores/useSelectionStore'
import { useAttackTargetingStore } from '../stores/useAttackTargetingStore'
import { executeEditorAttack } from '../utils/editorBattle'
import { isFaceupMonster } from '../utils/battleDamage'
import {
  submitSelection,
  type CardSelectionMatch,
  type CardSelectionRole
} from '../utils/duelSelection'
import { hasCardEngineActions } from '../utils/engineActions'
import { canShowPositionHint } from '../utils/zoneDrop'

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
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
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
    const isHandPlaceholder =
      isEngineActive && card.location === CardLocation.HAND && isPlaceholderCard(card.code)
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
    if (!isEngineActive) {
      const targeting = useAttackTargetingStore.getState()
      if (targeting.attacker) {
        if (
          card.controller !== targeting.attacker.controller &&
          isFaceupMonster(card) &&
          !e.shiftKey
        ) {
          executeEditorAttack(targeting.attacker, card)
        } else {
          targeting.cancel()
        }
        return
      }
      if (
        currentPhase === 'BP' &&
        card.location === CardLocation.MZONE &&
        card.position === CardPosition.FACEUP_ATTACK
      ) {
        if (menuCard?.instanceId === card.instanceId) {
          closeCommandMenu()
        } else {
          openCommandMenu(card, e.currentTarget.getBoundingClientRect())
        }
        return
      }
    }
    if (e.shiftKey) {
      closeCommandMenu()
      if (isEngineActive) {
        closeStatPopover()
      } else if (activeStatPopoverCardId === card.instanceId) {
        closeStatPopover()
      } else {
        const rect = e.currentTarget.getBoundingClientRect()
        const isRight = rect.right > window.innerWidth - 270
        const defaultX = isRight ? Math.max(16, rect.left - 248 - 12) : rect.right + 12
        const defaultY = Math.max(16, Math.min(rect.top - 20, window.innerHeight - 380))
        openStatPopover(card.instanceId, statPopoverPosition || { x: defaultX, y: defaultY })
      }
    } else if (hasCardEngineActions(pendingRequest, card) || isHandPlaceholder) {
      if (menuCard?.instanceId === card.instanceId) {
        closeCommandMenu()
      } else {
        openCommandMenu(card, e.currentTarget.getBoundingClientRect())
      }
    } else {
      closeCommandMenu()
      if (isEngineActive) {
        closeHint()
        return
      }
      const loc = card.location
      const canHint =
        e.detail < 2 &&
        (loc === CardLocation.MZONE || loc === CardLocation.SZONE) &&
        canShowPositionHint(loc, currentPhase)
      if (!canHint) {
        closeHint()
        return
      }
      const zone = {
        controller: card.controller,
        location: loc,
        sequence: card.sequence
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
