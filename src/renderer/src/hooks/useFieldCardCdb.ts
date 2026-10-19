import { useEffect } from 'react'
import { FieldCard } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'

export function useFieldCardCdb(card: FieldCard): void {
  useEffect(() => {
    if (!card.card && card.code) {
      window.api
        .getCardsByIds([card.code])
        .then((map) => {
          const cardData = map[card.code]
          if (cardData) {
            useDuelStore.getState().setCardData(card.instanceId, cardData)
          }
        })
        .catch((err) => {
          void err
        })
    }
  }, [card.instanceId, card.code, card.card])
}
