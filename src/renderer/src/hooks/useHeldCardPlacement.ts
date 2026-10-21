import React from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useStagingStore } from '../stores/useStagingStore'
import { useHeldCardStore, type HeldMaterialRef } from '../stores/useHeldCardStore'
import { getDropPosOverride } from '../utils/zoneDrop'

export interface HeldCardDropTarget {
  controller: 0 | 1
  location: number
  sequence: number
  duelistId?: string
}

export interface HeldCardPlacement {
  heldCardInstanceId: string | null
  heldMaterialRef: HeldMaterialRef | null
  hasHeldCard: boolean
  placeHeldCard: (e: React.MouseEvent, target: HeldCardDropTarget) => boolean
}

export function useHeldCardPlacement(): HeldCardPlacement {
  const heldCardInstanceId = useHeldCardStore((s) => s.instanceId)
  const heldMaterialRef = useHeldCardStore((s) => s.materialRef)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
  const canEditLocally = !isEngineActive || stagingActive

  const placeHeldCard = (e: React.MouseEvent, target: HeldCardDropTarget): boolean => {
    const { instanceId, materialRef } = useHeldCardStore.getState()
    if (!instanceId && !materialRef) return false
    e.preventDefault()
    e.stopPropagation()
    useHeldCardStore.getState().release()
    if (!canEditLocally) return true
    if (materialRef) {
      useDuelStore
        .getState()
        .detachMaterialToLocation(
          materialRef.hostInstanceId,
          materialRef.index,
          target.location,
          target.sequence
        )
      return true
    }
    if (!instanceId) return true
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

  return {
    heldCardInstanceId,
    heldMaterialRef,
    hasHeldCard: heldCardInstanceId !== null || heldMaterialRef !== null,
    placeHeldCard
  }
}
