import { DuelPuzzleState } from '@shared/index'
import { cdbService } from '../db/cdbService'

export function completeCardDetails(state: DuelPuzzleState): void {
  const missingCardCodes = state.cards.filter((c) => !c.card).map((c) => c.code)
  if (missingCardCodes.length > 0 && cdbService.isReady()) {
    const cardMap = cdbService.getCardsByIds(missingCardCodes)
    for (const c of state.cards) {
      if (!c.card && cardMap[c.code]) {
        c.card = cardMap[c.code]
      }
    }
  }
}
