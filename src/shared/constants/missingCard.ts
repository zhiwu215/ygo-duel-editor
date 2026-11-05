import { CdbCard } from '../types/card'

export const MISSING_CARD_NAME = '未知卡片'

export function missingCardData(code: number): CdbCard {
  return {
    id: code,
    ot: 0,
    alias: 0,
    setcode: 0,
    type: 0,
    atk: 0,
    def: 0,
    level: 0,
    race: 0,
    attribute: 0,
    category: 0,
    name: MISSING_CARD_NAME,
    desc: '该卡片不在当前卡库中，无法显示具体效果。',
    isMissing: true
  }
}
