import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { CdbCard } from '@shared/index'
import { cdbService } from '../../../db/cdbService'
import { Type } from '../toolSchema'
import type { AgentToolDeps } from './toolDeps'

export function createGetCardInfoTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent } = deps
  return {
    name: 'get_card_info',
    label: '获取卡片详细规则信息',
    description:
      '根据 8 位卡密精确查询卡片的完整效果文本与卡牌属性。codes 支持一次传多个卡密批量查询——盘面上出现多张卡时务必一次性传入，不要逐张调用',
    parameters: Type.Object({
      codes: Type.Array(Type.Number(), {
        description:
          '8 位卡密的数组 (例如 [89631139, 13955608])。已从 search_cards 结果中拿到卡密时优先直接用本工具，不要再重复 search_cards'
      })
    }),
    execute: async (_toolCallId, p: { codes: number[] }) => {
      const codes = p.codes ?? []
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'get_card_info',
        params: { codes }
      })

      if (codes.length === 0) {
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'get_card_info',
          resultSummary: '未提供卡密'
        })
        return {
          content: [{ type: 'text', text: '未提供任何卡密，无法查询。' }],
          details: { found: 0 }
        }
      }

      const dict = cdbService.getCardsByIds(codes)
      const found = codes.map((code) => dict[code]).filter((c): c is CdbCard => Boolean(c))
      const missing = codes.filter((code) => !dict[code])

      if (found.length === 0) {
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'get_card_info',
          resultSummary: `未在数据库中找到卡密 ${missing.join(', ')}`
        })
        const details: Record<string, unknown> = { found: 0, missing }
        return {
          content: [{ type: 'text', text: `数据库中未找到卡密 ${missing.join(', ')}` }],
          details
        }
      }

      const fullText = found
        .map(
          (card) =>
            `【${card.name}】\n卡密: ${card.id}\n类型掩码: 0x${card.type.toString(16)}\n等级: ${card.level & 0xff} | 属性: ${card.attribute} | 种族: ${card.race}\n攻击力: ${card.atk} | 守备力: ${card.def}\n效果描述:\n${card.desc}`
        )
        .join('\n\n---\n\n')
      const suffix = missing.length > 0 ? `\n\n（未找到卡密：${missing.join(', ')}）` : ''

      emitEvent({
        type: 'tool_call_end',
        id: _toolCallId,
        toolName: 'get_card_info',
        resultSummary:
          found.length === 1
            ? `已获取【${found[0].name}】的详细效果`
            : `已获取${found.length} 张卡片的详细效果`
      })

      const details: Record<string, unknown> = {
        found: found.length,
        names: found.map((c) => c.name),
        missing
      }
      return {
        content: [{ type: 'text', text: fullText + suffix }],
        details
      }
    }
  }
}
