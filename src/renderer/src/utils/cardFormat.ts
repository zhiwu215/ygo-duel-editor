import { CdbCard, CardType, CardUtils, RACE_NAMES, ATTRIBUTE_NAMES } from '@shared/index'

export function formatCardTypeLine(card: CdbCard): string {
  if (CardUtils.isMonster(card.type)) {
    const parts: string[] = ['怪兽']
    if (card.type & CardType.NORMAL) parts.push('通常')
    if (card.type & CardType.FUSION) parts.push('融合')
    if (card.type & CardType.RITUAL) parts.push('仪式')
    if (card.type & CardType.SYNCHRO) parts.push('同调')
    if (card.type & CardType.XYZ) parts.push('超量')
    if (card.type & CardType.PENDULUM) parts.push('灵摆')
    if (card.type & CardType.LINK) parts.push('连接')
    if (card.type & CardType.TUNER) parts.push('调整')
    if (card.type & CardType.FLIP) parts.push('反转')
    if (card.type & CardType.EFFECT) parts.push('效果')
    if (card.type & CardType.SPIRIT) parts.push('灵魂')
    if (card.type & CardType.UNION) parts.push('同盟')
    if (card.type & CardType.GEMINI) parts.push('二重')
    if (card.type & CardType.TOON) parts.push('卡通')
    if (card.type & CardType.SPECIAL_SUMMON) parts.push('特殊召唤')
    if (card.type & CardType.TOKEN) parts.push('衍生物')

    const raceName = RACE_NAMES[card.race] || '未知'
    const attrName = ATTRIBUTE_NAMES[card.attribute] || '无'
    return `[${parts.join('|')}] ${raceName}/${attrName}`
  }

  if (CardUtils.isSpell(card.type)) {
    const parts: string[] = ['魔法']
    if (card.type & CardType.QUICKPLAY) parts.push('速攻')
    else if (card.type & CardType.CONTINUOUS) parts.push('永续')
    else if (card.type & CardType.EQUIP) parts.push('装备')
    else if (card.type & CardType.FIELD) parts.push('场地')
    else if (card.type & CardType.RITUAL) parts.push('仪式')
    else parts.push('通常')
    return `[${parts.join('|')}]`
  }

  if (CardUtils.isTrap(card.type)) {
    const parts: string[] = ['陷阱']
    if (card.type & CardType.COUNTER) parts.push('反击')
    else if (card.type & CardType.CONTINUOUS) parts.push('永续')
    else parts.push('通常')
    return `[${parts.join('|')}]`
  }

  return '[未知]'
}

export function formatCardStatsLine(card: CdbCard): string | null {
  if (!CardUtils.isMonster(card.type)) return null

  const star = CardUtils.getStarLevel(card.level)
  const isLink = CardUtils.isLink(card.type)
  const isXyz = CardUtils.isXyz(card.type)

  let starStr = ''
  if (isLink) {
    starStr = `[LINK-${star}]`
  } else if (isXyz) {
    starStr = `[★${star}]`
  } else {
    starStr = `[★${star}]`
  }

  const atkStr = card.atk === -2 ? '?' : String(card.atk)
  const defStr = isLink ? '-' : card.def === -2 ? '?' : String(card.def)

  let line = `${starStr} ${atkStr}/${defStr}`

  if (CardUtils.isPendulum(card.type)) {
    const scale = CardUtils.getPendulumScales(card.level)
    line += ` [刻度 ${scale.lscale}/${scale.rscale}]`
  }

  return line
}

export function formatCardSeriesLine(card: CdbCard): string | null {
  if (card.setnames && card.setnames.length > 0) {
    return `系列: ${card.setnames.join(' / ')}`
  }
  return null
}

export function getLinkMarkerMask(card: CdbCard): number {
  if (!CardUtils.isMonster(card.type) || !CardUtils.isLink(card.type)) return 0
  return card.markers ?? card.def ?? 0
}

export function formatSearchItemLine2(card: CdbCard): string {
  if (CardUtils.isMonster(card.type)) {
    const attr = ATTRIBUTE_NAMES[card.attribute] || '无'
    const race = RACE_NAMES[card.race] || '未知'
    const star = CardUtils.getStarLevel(card.level)
    if (CardUtils.isLink(card.type)) return `${attr}/${race}`
    const starStr = CardUtils.isXyz(card.type) ? `☆${star}` : `★${star}`
    return `${attr}/${race} ${starStr}`
  }

  if (CardUtils.isSpell(card.type)) {
    if (card.type & CardType.QUICKPLAY) return '魔法|速攻'
    if (card.type & CardType.CONTINUOUS) return '魔法|永续'
    if (card.type & CardType.EQUIP) return '魔法|装备'
    if (card.type & CardType.FIELD) return '魔法|场地'
    if (card.type & CardType.RITUAL) return '魔法|仪式'
    return '魔法'
  }

  if (CardUtils.isTrap(card.type)) {
    if (card.type & CardType.COUNTER) return '陷阱|反击'
    if (card.type & CardType.CONTINUOUS) return '陷阱|永续'
    return '陷阱'
  }

  if (CardUtils.isSkill(card.type)) return '技能卡'

  return '???'
}

export function formatSearchItemLine3(card: CdbCard): string | null {
  if (!CardUtils.isMonster(card.type)) {
    return null
  }

  const isLink = CardUtils.isLink(card.type)
  const atkStr = card.atk === -2 || card.atk < 0 ? '?' : String(card.atk)
  const defStr = card.def === -2 || card.def < 0 ? '?' : String(card.def)

  let line = isLink ? `${atkStr}/LINK ${CardUtils.getStarLevel(card.level)}` : `${atkStr}/${defStr}`

  if (CardUtils.isPendulum(card.type)) {
    const scale = CardUtils.getPendulumScales(card.level)
    line += ` ${scale.lscale}/${scale.rscale}`
  }

  return line
}
