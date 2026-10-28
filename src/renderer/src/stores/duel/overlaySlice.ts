import type { StateCreator } from 'zustand'
import {
  CdbCard,
  CardLocation,
  CardPosition,
  DuelPuzzleState,
  FieldCard,
  createLightweightSnapshot
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import { insertCardAtPlayhead, rederiveBoardSteps } from './stepsSlice'
import type { DuelStore } from './types'

export interface OverlaySlice {
  addOverlayMaterial: (
    targetInstanceId: string,
    matCode: number,
    consumedInstanceId?: string
  ) => void
  removeOverlayMaterial: (targetInstanceId: string, matIndex: number) => void
  reorderOverlayMaterials: (targetInstanceId: string, fromIndex: number, toIndex: number) => void

  overlayOnTop: (
    targetInstanceId: string,
    newCardData: CdbCard,
    sourceCardInstanceId?: string
  ) => void

  overlayDropOnto: (hostInstanceId: string, incoming: CdbCard, sourceId?: string | null) => void

  detachMaterialToLocation: (
    targetInstanceId: string,
    matIndex: number,
    targetLocation: number,
    targetSequence?: number
  ) => void
}

interface OverlayBoardChanges {
  consumedInstanceId?: string
  insertedCard?: FieldCard
}

function withOverlayBoard(
  prev: DuelStore,
  cards: FieldCard[],
  changes?: OverlayBoardChanges
): DuelPuzzleState {
  const initialBoardSnapshot = prev.state.initialBoardSnapshot
  const canSync =
    Boolean(initialBoardSnapshot && initialBoardSnapshot.length > 0) &&
    !prev.sceneEditing &&
    !useDuelEngineStore.getState().isInitialized

  let state: DuelPuzzleState = { ...prev.state, cards }
  if (initialBoardSnapshot && canSync) {
    const live = new Map(cards.map((card) => [card.instanceId, card]))
    state = {
      ...state,
      initialBoardSnapshot: initialBoardSnapshot
        .filter((entry) => entry.instanceId !== changes?.consumedInstanceId)
        .map((entry) => {
          const card = live.get(entry.instanceId)
          if (!card) return entry
          return { ...entry, code: card.code, overlayMaterials: [...card.overlayMaterials] }
        })
    }
  }

  if (changes?.insertedCard && !prev.sceneEditing && !useDuelEngineStore.getState().isInitialized) {
    state = insertCardAtPlayhead(
      state,
      createLightweightSnapshot([changes.insertedCard])[0],
      prev.currentStepIndex
    )
  }
  return rederiveBoardSteps(prev, state)
}

export const createOverlaySlice: StateCreator<DuelStore, [], [], OverlaySlice> = (set, get) => ({
  addOverlayMaterial: (targetInstanceId, matCode, consumedInstanceId) =>
    set((prev) => ({
      state: withOverlayBoard(
        prev,
        prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            return {
              ...c,
              overlayMaterials: [...c.overlayMaterials, matCode]
            }
          }
          return c
        }),
        { consumedInstanceId }
      )
    })),

  removeOverlayMaterial: (targetInstanceId, matIndex) =>
    set((prev) => ({
      state: withOverlayBoard(
        prev,
        prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            const newMats = [...c.overlayMaterials]
            newMats.splice(matIndex, 1)
            return { ...c, overlayMaterials: newMats }
          }
          return c
        })
      )
    })),

  reorderOverlayMaterials: (targetInstanceId, fromIndex, toIndex) =>
    set((prev) => ({
      state: withOverlayBoard(
        prev,
        prev.state.cards.map((c) => {
          if (c.instanceId !== targetInstanceId) return c
          const total = c.overlayMaterials.length
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= total ||
            toIndex >= total ||
            fromIndex === toIndex
          ) {
            return c
          }
          const mats = [...c.overlayMaterials]
          const [moved] = mats.splice(fromIndex, 1)
          mats.splice(toIndex, 0, moved)
          return { ...c, overlayMaterials: mats }
        })
      )
    })),

  overlayOnTop: (targetInstanceId, newCardData, sourceCardInstanceId) =>
    set((prev) => {
      let sourceMats: number[] = []
      if (sourceCardInstanceId) {
        const src = prev.state.cards.find((c) => c.instanceId === sourceCardInstanceId)
        if (src && src.overlayMaterials) {
          sourceMats = src.overlayMaterials
        }
      }

      let updatedCards = prev.state.cards
      if (sourceCardInstanceId) {
        updatedCards = updatedCards.filter((c) => c.instanceId !== sourceCardInstanceId)
      }

      const finalCards = updatedCards.map((c) => {
        if (c.instanceId === targetInstanceId) {
          return {
            ...c,
            code: newCardData.id,
            card: newCardData,
            overlayMaterials: [...c.overlayMaterials, c.code, ...sourceMats]
          }
        }
        return c
      })

      return {
        state: withOverlayBoard(prev, finalCards, {
          consumedInstanceId: sourceCardInstanceId
        }),
        selectedCardId:
          prev.selectedCardId === sourceCardInstanceId ? targetInstanceId : prev.selectedCardId
      }
    }),

  overlayDropOnto: (hostInstanceId, incoming, sourceId) => {
    const host = get().state.cards.find((c) => c.instanceId === hostInstanceId)
    if (!host) return
    get().overlayOnTop(hostInstanceId, incoming, sourceId || undefined)
  },

  detachMaterialToLocation: (targetInstanceId, matIndex, targetLocation, targetSequence) =>
    set((prev) => {
      const host = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
      if (!host || matIndex < 0 || matIndex >= host.overlayMaterials.length) return prev
      const matCode = host.overlayMaterials[matIndex]
      const newMats = [...host.overlayMaterials]

      newMats.splice(matIndex, 1)

      const existingPile = prev.state.cards
        .filter((c) => c.controller === host.controller && c.location === targetLocation)
        .sort((a, b) => a.sequence - b.sequence)
      const isFieldZone =
        targetLocation === CardLocation.MZONE ||
        targetLocation === CardLocation.SZONE ||
        targetLocation === CardLocation.FZONE ||
        targetLocation === CardLocation.PZONE
      const targetSeq =
        isFieldZone && targetSequence !== undefined ? targetSequence : existingPile.length

      if (
        isFieldZone &&
        prev.state.cards.some(
          (c) =>
            c.controller === host.controller &&
            c.location === targetLocation &&
            c.sequence === targetSeq
        )
      ) {
        return prev
      }

      const newCard: FieldCard = {
        instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code: matCode,
        controller: host.controller,
        owner: host.controller,
        location: targetLocation,
        sequence: targetSeq,
        position:
          targetLocation === CardLocation.HAND ? CardPosition.FACEDOWN : CardPosition.FACEUP,
        overlayMaterials: []
      }

      const finalResultCards = [
        ...prev.state.cards.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, overlayMaterials: newMats } : c
        ),

        newCard
      ]

      return {
        state: withOverlayBoard(prev, finalResultCards, { insertedCard: newCard })
      }
    })
})
