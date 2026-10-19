import { CdbCard, CardUtils } from './card'
import { DeckData, DeckStats } from './deck'

export function calculateDeckStats(
  deck: DeckData,
  cardsMap?: Map<number, CdbCard> | Record<number, CdbCard>
): DeckStats {
  const getCard = (code: number): CdbCard | undefined => {
    if (!cardsMap) return undefined
    if (cardsMap instanceof Map) return cardsMap.get(code)
    return cardsMap[code]
  }

  let monsterCount = 0
  let spellCount = 0
  let trapCount = 0

  for (const code of deck.main) {
    const card = getCard(code)
    if (card) {
      if (CardUtils.isMonster(card.type)) monsterCount++
      else if (CardUtils.isSpell(card.type)) spellCount++
      else if (CardUtils.isTrap(card.type)) trapCount++
    }
  }

  let fusionCount = 0
  let synchroCount = 0
  let xyzCount = 0
  let linkCount = 0

  for (const code of deck.extra) {
    const card = getCard(code)
    if (card) {
      if (CardUtils.isFusion(card.type)) fusionCount++
      else if (CardUtils.isSynchro(card.type)) synchroCount++
      else if (CardUtils.isXyz(card.type)) xyzCount++
      else if (CardUtils.isLink(card.type)) linkCount++
    }
  }

  let sideMonsterCount = 0
  let sideSpellCount = 0
  let sideTrapCount = 0

  for (const code of deck.side) {
    const card = getCard(code)
    if (card) {
      if (CardUtils.isMonster(card.type)) sideMonsterCount++
      else if (CardUtils.isSpell(card.type)) sideSpellCount++
      else if (CardUtils.isTrap(card.type)) sideTrapCount++
    }
  }

  return {
    mainCount: deck.main.length,
    extraCount: deck.extra.length,
    sideCount: deck.side.length,
    monsterCount,
    spellCount,
    trapCount,
    fusionCount,
    synchroCount,
    xyzCount,
    linkCount,
    sideMonsterCount,
    sideSpellCount,
    sideTrapCount
  }
}
