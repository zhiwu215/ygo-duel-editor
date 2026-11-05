import { cardLocationLabel } from './cardLocationLabel'

export function buildPileCardLabels(
  cards: readonly { instanceId: string }[],
  location: number
): Map<string, string> {
  return new Map(
    cards.map((card, index) => [
      card.instanceId,
      cardLocationLabel(location, cards.length - index - 1)
    ])
  )
}
