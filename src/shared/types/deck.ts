/**
 * 卡组数据结构与标准 .ydk 格式解析/生成器
 * 平台无关 (@shared)，两进程共享纯函数
 */
import { CdbCard } from './card'
import { CardUtils } from './card'

export interface DeckData {
  name: string
  main: number[] // 主卡组卡密数组 (0~60)
  extra: number[] // 额外卡组卡密数组 (0~15)
  side: number[] // 副卡组卡密数组 (0~15)
}

export interface DeckStats {
  mainCount: number
  extraCount: number
  sideCount: number
  // 主卡组细分
  monsterCount: number
  spellCount: number
  trapCount: number
  // 额外卡组细分
  fusionCount: number
  synchroCount: number
  xyzCount: number
  linkCount: number
}

/**
 * 解析标准 .ydk 纯文本为卡组数据
 */
export function parseYdk(content: string, defaultName = '新建卡组'): DeckData {
  const lines = content.split(/\r?\n/)
  const deck: DeckData = {
    name: defaultName,
    main: [],
    extra: [],
    side: []
  }

  let section: 'main' | 'extra' | 'side' | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#name:')) {
      deck.name = line.replace('#name:', '').trim() || defaultName
      continue
    }

    if (line === '#main') {
      section = 'main'
      continue
    }
    if (line === '#extra') {
      section = 'extra'
      continue
    }
    if (line === '!side' || line === '#side') {
      section = 'side'
      continue
    }

    // 忽略其他注释行 (如 #created by ...)
    if (line.startsWith('#') || line.startsWith('!')) {
      continue
    }

    const code = parseInt(line, 10)
    if (!isNaN(code) && code > 0) {
      if (section === 'main' && deck.main.length < 60) {
        deck.main.push(code)
      } else if (section === 'extra' && deck.extra.length < 15) {
        deck.extra.push(code)
      } else if (section === 'side' && deck.side.length < 15) {
        deck.side.push(code)
      }
    }
  }

  return deck
}

/**
 * 将卡组数据序列化为标准 .ydk 格式
 */
export function generateYdk(deck: DeckData): string {
  const lines: string[] = [
    `#created by YGO Duel Editor`,
    `#name:${deck.name || '未命名卡组'}`,
    `#main`
  ]

  for (const code of deck.main) {
    lines.push(String(code))
  }

  lines.push(`#extra`)
  for (const code of deck.extra) {
    lines.push(String(code))
  }

  lines.push(`!side`)
  for (const code of deck.side) {
    lines.push(String(code))
  }

  return lines.join('\n') + '\n'
}

/**
 * 依据卡片信息计算卡组的分类统计
 */
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
    linkCount
  }
}
