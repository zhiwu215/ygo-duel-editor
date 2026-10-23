import type { StateCreator } from 'zustand'
import { CardLocation, CardPosition, Duelist } from '@shared/index'
import { resolveOwnerScope, turnOrderOf } from '../../utils/duelistNames'
import type { DuelStore } from './types'

const OPENING_HAND_SIZE = 5

function openingDrawOrder(duelists: Duelist[] | undefined): Duelist[] {
  return [...(duelists || [])].sort((a, b) =>
    a.team !== b.team ? a.team - b.team : turnOrderOf(a) - turnOrderOf(b)
  )
}

export interface ExecutionsSlice {
  executeDrawCard: (controller: 0 | 1, duelistId?: string) => void
  executeOpeningDraw: () => void
}

export const createExecutionsSlice: StateCreator<DuelStore, [], [], ExecutionsSlice> = (
  _set,
  get
) => ({
  executeDrawCard: (controller, duelistId) => {
    const { state, moveCard, activeDuelistIds, currentTurn } = get()
    const explicitDuelist = duelistId
      ? (state.duelists || []).find((d) => d.id === duelistId && d.team === controller)
      : undefined
    const ownerScope =
      explicitDuelist?.id ??
      resolveOwnerScope(state.duelists, controller, activeDuelistIds[controller], currentTurn)

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
    const handCount = state.cards.filter(
      (c) =>
        c.controller === controller &&
        c.location === CardLocation.HAND &&
        (ownerScope ? c.duelistId === ownerScope : true)
    ).length
    moveCard(
      topCard.instanceId,
      CardLocation.HAND,
      handCount,
      controller,
      CardPosition.FACEDOWN,
      ownerScope ?? undefined,
      {
        actionType: 'DRAW',
        description: topCard.card?.name ? `抽到【${topCard.card.name}】` : '抽卡'
      }
    )
  },

  executeOpeningDraw: () => {
    const { state, executeDrawCard, setDuelStarted } = get()
    const duelists = openingDrawOrder(state.duelists)
    get().withSingleUndoStep(() => {
      for (const duelist of duelists) {
        for (let i = 0; i < OPENING_HAND_SIZE; i++) {
          executeDrawCard(duelist.team, duelist.id)
        }
      }
      setDuelStarted(true)
    })
  }
})
