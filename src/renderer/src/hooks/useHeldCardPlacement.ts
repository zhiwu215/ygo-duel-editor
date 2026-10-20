import React from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useStagingStore } from '../stores/useStagingStore'
import { useHeldCardStore } from '../stores/useHeldCardStore'
import { getDropPosOverride } from '../utils/zoneDrop'

export interface HeldCardDropTarget {
  controller: 0 | 1
  location: number
  sequence: number
  duelistId?: string
}

export interface HeldCardPlacement {
  heldCardInstanceId: string | null
  placeHeldCard: (e: React.MouseEvent, target: HeldCardDropTarget) => boolean
}

export function useHeldCardPlacement(): HeldCardPlacement {
  const heldCardInstanceId = useHeldCardStore((s) => s.instanceId)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
  const canEditLocally = !isEngineActive || stagingActive

  const placeHeldCard = (e: React.MouseEvent, target: HeldCardDropTarget): boolean => {
    const instanceId = useHeldCardStore.getState().instanceId
    if (!instanceId) return false
    e.preventDefault()
    e.stopPropagation()
    useHeldCardStore.getState().release()
    if (!canEditLocally) return true
    const heldCard = useDuelStore.getState().state.cards.find((c) => c.instanceId === instanceId)
    if (!heldCard) return true
    useDuelStore
      .getState()
      .moveCard(
        instanceId,
        target.location,
        target.sequence,
        target.controller,
        getDropPosOverride(target.location, e.ctrlKey),
        target.duelistId ?? heldCard.duelistId
      )
    return true
  }

  return { heldCardInstanceId, placeHeldCard }
}
