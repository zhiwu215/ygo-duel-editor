import { CdbCard, CardType, CardUtils, RACE_NAMES, ATTRIBUTE_NAMES } from '@shared/index'

/**
 * 格式化 YGOPro 风格的卡片类别与种族属性信息
 * 例如:
 * - 怪兽: "[怪兽|效果] 恐龙/炎" 或 "[怪兽|同调|调整|效果] 龙/光"
 * - 魔法: "[魔法|速攻]" 或 "[魔法|通常]"
 * - 陷阱: "[陷阱|永续]" 或 "[陷阱|反击]"
 */
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

/**
 * 格式化怪兽数值行 (星级/阶级/连接值与攻防)
 * 例如:
 * - "[★4] 1700/400"
 * - "[LINK-3] 2500/-"
 * - "[★4] 1700/400 [刻度 1/1]"
 */
export function formatCardStatsLine(card: CdbCard): string | null {
  if (!CardUtils.isMonster(card.type)) return null

  const star = CardUtils.getStarLevel(card.level, card.type)
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

/**
 * 格式化系列行
 * 例如: "系列: 朱罗纪" 或 "系列: 禁忌的"
 */
export function formatCardSeriesLine(card: CdbCard): string | null {
  if (card.setnames && card.setnames.length > 0) {
    return `系列: ${card.setnames.join(' / ')}`
  }
  return null
}
