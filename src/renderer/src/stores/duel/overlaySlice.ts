import type { StateCreator } from 'zustand'
import { CdbCard, CardLocation, CardPosition, CardUtils, FieldCard } from '@shared/index'
import type { DuelStore } from './types'

export interface OverlaySlice {
  addOverlayMaterial: (targetInstanceId: string, matCode: number) => void
  removeOverlayMaterial: (targetInstanceId: string, matIndex: number) => void

  overlayOnTop: (
    targetInstanceId: string,
    newCardData: CdbCard,
    sourceCardInstanceId?: string
  ) => void

  overlayDropOnto: (hostInstanceId: string, incoming: CdbCard, sourceId?: string | null) => void

  swapHostWithMaterial: (targetInstanceId: string, matIndex: number) => void

  detachMaterialToLocation: (
    targetInstanceId: string,
    matIndex: number,
    targetLocation: number
  ) => void
}

export const createOverlaySlice: StateCreator<DuelStore, [], [], OverlaySlice> = (set, get) => ({
  addOverlayMaterial: (targetInstanceId, matCode) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            return {
              ...c,
              overlayMaterials: [...c.overlayMaterials, matCode]
            }
          }
          return c
        })
      }
    })),

  removeOverlayMaterial: (targetInstanceId, matIndex) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            const newMats = [...c.overlayMaterials]
            newMats.splice(matIndex, 1)
            return { ...c, overlayMaterials: newMats }
          }
          return c
        })
      }
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
        state: {
          ...prev.state,
          cards: finalCards
        },

        selectedCardId:
          prev.selectedCardId === sourceCardInstanceId ? targetInstanceId : prev.selectedCardId
      }
    }),

  overlayDropOnto: (hostInstanceId, incoming, sourceId) => {
    const host = get().state.cards.find((c) => c.instanceId === hostInstanceId)
    if (!host) return
    const isIncomingXyz = CardUtils.isXyz(incoming.type)
    const isExistingXyz =
      (host.card ? CardUtils.isXyz(host.card.type) : false) ||
      (host.overlayMaterials && host.overlayMaterials.length > 0)
    if (isIncomingXyz || !isExistingXyz) {
      get().overlayOnTop(hostInstanceId, incoming, sourceId || undefined)
      return
    }
    if (sourceId) {
      get().removeCard(sourceId)
    }
    get().addOverlayMaterial(hostInstanceId, incoming.id)
  },

  swapHostWithMaterial: (targetInstanceId, matIndex) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            if (matIndex < 0 || matIndex >= c.overlayMaterials.length) return c
            const oldHostCode = c.code
            const newHostCode = c.overlayMaterials[matIndex]
            const newMats = [...c.overlayMaterials]

            newMats[matIndex] = oldHostCode
            return {
              ...c,
              code: newHostCode,

              card: undefined,
              overlayMaterials: newMats
            }
          }
          return c
        })
      }
    })),

  detachMaterialToLocation: (targetInstanceId, matIndex, targetLocation) =>
    set((prev) => {
      const host = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
      if (!host || matIndex < 0 || matIndex >= host.overlayMaterials.length) return prev
      const matCode = host.overlayMaterials[matIndex]
      const newMats = [...host.overlayMaterials]

      newMats.splice(matIndex, 1)

      const existingPile = prev.state.cards
        .filter((c) => c.controller === host.controller && c.location === targetLocation)
        .sort((a, b) => a.sequence - b.sequence)
      const targetSeq = existingPile.length

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
        state: {
          ...prev.state,
          cards: finalResultCards
        }
      }
    })
})
