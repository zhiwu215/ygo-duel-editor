import type { DuelStep } from '@shared/index'
import { fetchCardDataByCodes } from './cardData'

export async function withReplayStepNames(steps: DuelStep[]): Promise<DuelStep[]> {
  if (typeof window === 'undefined' || !window.api?.getCardsByIds) return steps
  const codes = Array.from(
    new Set(
      steps
        .map((step) => step.cardCode)
        .filter((code): code is number => code !== undefined && code > 0)
    )
  )
  if (codes.length === 0) return steps
  const cardMap = await fetchCardDataByCodes(codes)
  return steps.map((step) => {
    if (!step.cardCode) return step
    const name = cardMap[step.cardCode]?.name
    if (!name) return step
    if (step.cardName && step.cardName !== String(step.cardCode)) return step
    return { ...step, cardName: name }
  })
}
