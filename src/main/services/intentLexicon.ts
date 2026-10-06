export interface IntentExpansion {
  match: string[]

  phrases: string[]
}

export const INTENT_EXPANSIONS: IntentExpansion[] = [
  { match: ['破坏', '炸', '除去场', '清场'], phrases: ['破坏'] },
  { match: ['无效'], phrases: ['无效'] },
  { match: ['检索', '找卡', '搜索卡', '调卡'], phrases: ['检索', '加入手牌', '卡组特殊召唤'] },
  { match: ['堆墓', '送墓'], phrases: ['送去墓地', '墓地'] },
  { match: ['复活', '苏生', '墓地特殊召唤'], phrases: ['墓地', '特殊召唤'] },
  {
    match: ['回血', '回复', '治疗', '恢复', '回复生命'],
    phrases: ['基本分回复', '回复', 'LP回复']
  },
  { match: ['烧血', '削血', '削减生命'], phrases: ['基本分', '伤害'] },
  { match: ['弹回', '回手', '返回手牌'], phrases: ['回到手牌', '回到持有者'] },
  { match: ['除外', '放逐'], phrases: ['除外'] },
  { match: ['盖卡', '盖放', '覆盖'], phrases: ['盖放', '恒久魔法'] },
  { match: ['贯通', '穿防', '贯穿'], phrases: ['贯通'] },
  { match: ['抽卡', '补充手牌', '摸牌'], phrases: ['抽卡', '抽一张卡'] },
  { match: ['两次攻击', '多次攻击'], phrases: ['能否攻击两次', '连续攻击'] },
  { match: ['特招', '特殊召唤'], phrases: ['特殊召唤'] },
  { match: ['站场', '打点', '站住'], phrases: ['特殊召唤', '召唤成功'] },
  { match: ['反制', '反击'], phrases: ['反制陷阱', '对方发动时'] },
  { match: ['手坑'], phrases: ['手牌', '效果发动'] },
  { match: ['翻转', '反转'], phrases: ['反转'] },
  { match: ['装备', '强化'], phrases: ['装备'] },
  { match: ['陷阱破坏', '破魔陷'], phrases: ['破坏'] },
  { match: ['电子界', 'link', '链接'], phrases: ['连接'] }
]

const normToken = (token: string): string => token.trim().toLowerCase()

export function expandIntentPhrases(query: string): string[] {
  const rawTokens = String(query ?? '')
    .split(/[\s,，、;；。.!?？!?]+/)
    .map(normToken)
    .filter((t) => t.length > 0)

  const phrases = new Set<string>()
  const hasCjk = /[\u4e00-\u9fff]/.test(query)
  const push = (value: string): void => {
    const cleaned = value.trim()
    if (cleaned.length > 0) phrases.add(cleaned)
  }

  rawTokens.forEach((token) => {
    push(token)
    for (const expansion of INTENT_EXPANSIONS) {
      if (expansion.match.includes(token)) {
        expansion.phrases.forEach(push)
      } else if (expansion.match.some((m) => m.length > 1 && token.includes(m))) {
        expansion.phrases.forEach(push)
      }
    }
  })

  if (hasCjk && phrases.size === 0) {
    push(String(query ?? '').trim())
  }
  return [...phrases]
}
