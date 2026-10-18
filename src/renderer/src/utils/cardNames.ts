import { DuelStep } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useCustomCardStore } from '../stores/useCustomCardStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export function findCardName(code: number): string | undefined {
  if (!code) return undefined
  return (
    useDuelStore.getState().state.cards.find((c) => c.code === code)?.card?.name ||
    useCustomCardStore.getState().cards.find((c) => c.id === code)?.name ||
    useDuelEngineStore.getState().boardState?.allCards.find((c) => c.code === code)?.card?.name
  )
}

export function resolveCardName(code: number): string {
  return findCardName(code) ?? String(code)
}

export function stepCardName(step: DuelStep): string {
  return step.cardName || (step.cardCode ? resolveCardName(step.cardCode) : '')
}
