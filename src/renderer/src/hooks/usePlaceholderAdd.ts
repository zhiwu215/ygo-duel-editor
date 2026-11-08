import { CardLocation, PLACEHOLDER_CARD_CODE } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { PLACEHOLDER_CDB_CARD } from '../utils/placeholderCard'

export type PlaceholderDestination = 'hand' | 'deck-top' | 'deck-bottom'

export function usePlaceholderAdd(
  controller: 0 | 1,
  duelistId?: string
): {
  canAdd: boolean
  reason: string | null
  addPlaceholder: (destination: PlaceholderDestination) => Promise<boolean>
} {
  const addCardToZone = useDuelStore((s) => s.addCardToZone)
  const cards = useDuelStore((s) => s.state.cards)
  const activeDuelistId = useDuelStore((s) => s.activeDuelistIds?.[controller])
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const engineLoading = useDuelEngineStore((s) => s.loading)
  const inject = useDuelEngineStore((s) => s.inject)

  const seatActive = !isEngine || !activeDuelistId || !duelistId || activeDuelistId === duelistId
  const canAdd = !isReplay && !engineLoading && seatActive
  const reason = isReplay
    ? '回放模式只读。'
    : engineLoading
      ? '引擎正在处理，请稍候。'
      : !seatActive
        ? '只能给当前行动座位添加占位卡。'
        : null

  const scopedCards = cards.filter(
    (card) =>
      card.controller === controller &&
      (card.duelistId === undefined || !duelistId || card.duelistId === duelistId)
  )
  const handCount = scopedCards.filter((card) => card.location === CardLocation.HAND).length
  const deckCount = scopedCards.filter((card) => card.location === CardLocation.DECK).length

  const addPlaceholder = async (destination: PlaceholderDestination): Promise<boolean> => {
    if (!canAdd) return false
    if (isEngine) {
      return await inject({
        op: 'add-card',
        player: controller,
        code: PLACEHOLDER_CARD_CODE,
        to: destination
      })
    }
    const location = destination === 'hand' ? CardLocation.HAND : CardLocation.DECK
    const sequence = destination === 'hand' ? handCount : destination === 'deck-top' ? 0 : deckCount
    addCardToZone(PLACEHOLDER_CDB_CARD, controller, location, sequence, undefined, duelistId)
    return true
  }

  return { canAdd, reason, addPlaceholder }
}
