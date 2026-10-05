/**
 * 卡组数据结构与标准 .ydk 格式解析/生成器
 * 平台无关 (@shared)，两进程共享纯函数
 * 面向决斗内容创作与推演：不设任何死锁卡数限制，支持剧情特化/超模额外与教学做场
 */
import { CdbCard } from './card'
import { CardUtils } from './card'

export interface DeckData {
  id?: string // 唯一标识 ID
  name: string // 卡组名称
  description?: string // 卡组描述 / 剧情背景 / 展开思路说明
  coverCard?: number // 封面王牌怪兽卡密 (若未指定则自动取额外第一张或主卡组第一张)
  tags?: string[] // 分类 / Tag 标签 (如 '同人剧情', 'Combo教学', '残局特化')
  group?: string // 所属剧情分组 (对应 DeckLibrary.groups 中的某一项；空字符串表示未分组)
  main: number[] // 主卡组卡密数组 (自由容量，无强制限制)
  extra: number[] // 额外卡组卡密数组 (自由容量，无强制限制，允许 >15 张剧情特权额外)
  side: number[] // 副卡组卡密数组 (自由容量，无强制限制)
  updatedAt?: number // 更新时间戳
}

/**
 * 本地卡组库的完整持久化结构
 *
 * 分组在这里是**独立实体**而不是从卡组反推出来的——否则「一个卡都没有的分组」
 * 在数据上根本不存在，用户永远无法预建分类（原先的分组栏是遍历deckList 收集
 * `group` 字段去重得来的，只能看到已有的）。
 */
export interface DeckLibrary {
  /** 分组名列表，顺序即分组栏展示顺序；允许为空数组（此时全部分组都归「未分组」） */
  groups: string[]
  /** 全部已保存卡组 */
  decks: DeckData[]
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
 * 解析标准 .ydk 纯文本为卡组数据 (兼顾读取创作者元数据)
 */
export function parseYdk(content: string, defaultName = '新建卡组'): DeckData {
  const lines = content.split(/\r?\n/)
  const deck: DeckData = {
    name: defaultName,
    description: '',
    tags: [],
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

    if (line.startsWith('#desc:')) {
      deck.description = decodeURIComponent(line.replace('#desc:', '').trim())
      continue
    }

    if (line.startsWith('#cover:')) {
      const cover = parseInt(line.replace('#cover:', '').trim(), 10)
      if (!isNaN(cover) && cover > 0) deck.coverCard = cover
      continue
    }

    if (line.startsWith('#tags:')) {
      const rawTags = line.replace('#tags:', '').trim()
      deck.tags = rawTags
        ? rawTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []
      continue
    }

    if (line.startsWith('#group:')) {
      const group = line.replace('#group:', '').trim()
      if (group) deck.group = group
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
      // 自由创作模式：不设任何人为数量死锁限制
      if (section === 'main') {
        deck.main.push(code)
      } else if (section === 'extra') {
        deck.extra.push(code)
      } else if (section === 'side') {
        deck.side.push(code)
      }
    }
  }

  return deck
}

/**
 * 将卡组数据序列化为标准 .ydk 格式 (元数据以安全注释形式附带)
 */
export function generateYdk(deck: DeckData): string {
  const lines: string[] = [`#created by YGO Duel Editor`, `#name:${deck.name || '未命名卡组'}`]

  if (deck.description) {
    lines.push(`#desc:${encodeURIComponent(deck.description)}`)
  }
  if (deck.coverCard) {
    lines.push(`#cover:${deck.coverCard}`)
  }
  if (deck.tags && deck.tags.length > 0) {
    lines.push(`#tags:${deck.tags.join(',')}`)
  }
  if (deck.group) {
    lines.push(`#group:${deck.group}`)
  }

  lines.push(`#main`)
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
