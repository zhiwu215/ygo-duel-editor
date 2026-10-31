import { CardData } from 'ygopro-msg-encode'
import { CardType, CdbCard, placeholderEngineData } from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { splitSetcode } from '../../db/setcode'

const CARD_ARTWORK_VERSIONS_OFFSET = 20
const RULE_CODE_EXCEPTION = 5405695

function isAlternative(code: number, alias: number): boolean {
  return (
    alias !== 0 &&
    alias < code + CARD_ARTWORK_VERSIONS_OFFSET &&
    code < alias + CARD_ARTWORK_VERSIONS_OFFSET
  )
}

function splitAlias(card: CdbCard): { alias: number; ruleCode: number } {
  const code = Number(card.id)
  const alias = Number(card.alias ?? 0)
  const type = Number(card.type ?? 0)
  if (!alias) return { alias: 0, ruleCode: 0 }
  if (code === RULE_CODE_EXCEPTION) return { alias: 0, ruleCode: alias }
  if ((type & CardType.TOKEN) !== 0 || isAlternative(code, alias)) {
    return { alias, ruleCode: 0 }
  }
  return { alias: 0, ruleCode: alias }
}

export function engineCardDataFromCdbCard(card: CdbCard): Partial<CardData> {
  const type = Number(card.type ?? 0)
  const isLink = (type & CardType.LINK) !== 0
  const level = Number(card.level ?? 0) >>> 0
  const { alias, ruleCode } = splitAlias(card)
  let resolvedRuleCode = ruleCode
  if (!resolvedRuleCode && alias && (type & CardType.TOKEN) === 0) {
    const original = cdbService.getCardById(alias)
    if (original) resolvedRuleCode = splitAlias(original).ruleCode
  }
  return {
    code: Number(card.id),
    alias,
    setcode: splitSetcode(card.setcode ?? 0),
    type,
    level: level & 0xff,
    lscale: (level >>> 24) & 0xff,
    rscale: (level >>> 16) & 0xff,
    attribute: Number(card.attribute ?? 0),
    race: Number(card.race ?? 0),
    attack: Number(card.atk ?? 0),
    defense: isLink ? 0 : Number(card.def ?? 0),
    linkMarker: isLink ? Number(card.markers ?? card.def ?? 0) : 0,
    ruleCode: resolvedRuleCode
  }
}

export function readEngineCardData(code: number): Partial<CardData> | null {
  const placeholder = placeholderEngineData(code)
  if (placeholder) {
    return {
      code,
      alias: 0,
      setcode: [],
      ...placeholder,
      lscale: 0,
      rscale: 0,
      attack: 0,
      defense: 0,
      linkMarker: 0,
      ruleCode: 0
    }
  }
  const card = cdbService.getCardById(code)
  if (!card) return null
  return engineCardDataFromCdbCard(card)
}
