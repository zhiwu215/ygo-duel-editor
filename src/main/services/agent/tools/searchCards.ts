import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { cdbService } from '../../../db/cdbService'
import { Type } from '../toolSchema'
import type { AgentToolDeps } from './toolDeps'

export function createSearchCardsTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent } = deps
  return {
    name: 'search_cards',
    label: '搜索游戏王卡片',
    description:
      '从本地卡库数据库检索卡片，返回卡名、卡密、类型、攻防与效果摘要。只在不知道卡名或卡密时使用；一旦拿到卡密就改用 get_card_info（支持一次传多个卡密）。同一个关键词不要重复调用，多张卡请分别用各自的关键词查或合并成一次 get_card_info',
    parameters: Type.Object({
      keyword: Type.String({ description: '卡名关键词、效果描述关键词或8位卡密' }),
      limit: Type.Optional(Type.Number({ description: '返回结果数量上限，默认 15 条' }))
    }),
    execute: async (_toolCallId, p: { keyword: string; limit?: number }) => {
      const keyword = p.keyword
      const limit = p.limit || 15
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'search_cards',
        params: { keyword, limit }
      })

      const res = cdbService.search({ keyword, limit })
      const summary = res.cards
        .map((c) => {
          return `【${c.name}】(卡密: ${c.id}) | 种类: 0x${c.type.toString(16)} | 攻/守: ${c.atk}/${c.def} | 描述: ${c.desc.slice(0, 120)}...`
        })
        .join('\n')

      emitEvent({
        type: 'tool_call_end',
        id: _toolCallId,
        toolName: 'search_cards',
        resultSummary: `找到 ${res.total} 张匹配卡片`
      })

      const details: Record<string, unknown> = { total: res.total }
      return {
        content: [{ type: 'text', text: summary || '未检索到符合条件的卡片' }],
        details
      }
    }
  }
}
