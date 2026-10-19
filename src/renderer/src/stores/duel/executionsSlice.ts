import type { StateCreator } from 'zustand'
import { CardLocation, CardPosition } from '@shared/index'
import type { DuelStore } from './types'

export interface ExecutionsSlice {
  executeDrawCard: (controller: 0 | 1) => void
}

export const createExecutionsSlice: StateCreator<DuelStore, [], [], ExecutionsSlice> = (
  _set,
  get
) => ({
  executeDrawCard: (controller) => {
    const { state, moveCard, activeDuelistId } = get()

    const activeDuelist = (state.duelists || []).find(
      (d) => d.id === activeDuelistId && d.team === controller
    )
    const ownerScope = activeDuelist?.id ?? null

    const deckCards = state.cards
      .filter(
        (c) =>
          c.controller === controller &&
          c.location === CardLocation.DECK &&
          (ownerScope ? c.duelistId === ownerScope : true)
      )
      .sort((a, b) => a.sequence - b.sequence)
    if (deckCards.length === 0) return

    const topCard = deckCards[0]
    const handCards = state.cards
      .filter((c) => c.controller === controller && c.location === CardLocation.HAND)
      .sort((a, b) => a.sequence - b.sequence)
    const lastHand = handCards[handCards.length - 1]
    moveCard(
      topCard.instanceId,
      CardLocation.HAND,
      handCards.length,
      controller,
      CardPosition.FACEDOWN,
      lastHand?.duelistId ?? ownerScope ?? undefined
    )
  }
})
