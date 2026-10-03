import { DuelPuzzleState, COUNTER_DEFINITIONS, CounterDefinition } from '@shared/index'

/**
 * 基于全场决斗态 (双方场上、手牌、墓地、额外所有卡片的效果文本与已存在指示物)
 * 智能推断出本场对局最相关的指示物列表
 */
export function deduceSuggestedCounters(state: DuelPuzzleState): CounterDefinition[] {
  const suggestedMap = new Map<number, CounterDefinition>()

  // 1. 扫描全场所有卡片上已经存在的任何指示物
  for (const card of state.cards) {
    if (card.counters) {
      for (const [idStr, count] of Object.entries(card.counters)) {
        if (count > 0) {
          const id = Number(idStr)
          const def = COUNTER_DEFINITIONS.find((c) => c.id === id)
          if (def) suggestedMap.set(id, def)
        }
      }
    }
  }

  // 2. 收集全场所有卡片文本 (卡名 + 效果描述)
  const allTextParts: string[] = []
  for (const card of state.cards) {
    if (card.card) {
      allTextParts.push(card.card.name)
      allTextParts.push(card.card.desc)
    }
  }
  const fullText = allTextParts.join(' ')

  // 3. 匹配所有已知指示物名称 (例如 "捕食指示物"、"魔力指示物"、"武士道指示物" 等)
  for (const def of COUNTER_DEFINITIONS) {
    if (fullText.includes(def.name)) {
      suggestedMap.set(def.id, def)
    }
  }

  return Array.from(suggestedMap.values())
}
