import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { CardLocation, DuelPuzzleState } from '@shared/index'
import { Type } from '../toolSchema'
import type { AgentToolDeps } from './toolDeps'

const formatBoardText = (state: DuelPuzzleState): { lines: string[]; cardCount: number } => {
  const p0 = state.players[0] || { lp: 8000 }
  const p1 = state.players[1] || { lp: 8000 }

  const lines: string[] = []
  lines.push(`决斗规则: 大师规则 MR${state.masterRule}`)
  lines.push(`双方生命值: 我方(P0) LP ${p0.lp} vs 对方(P1) LP ${p1.lp}`)
  lines.push(`先攻回合方: ${state.turnPlayer === 0 ? '我方(P0)' : '对方(P1)'}`)

  const duelists = state.duelists || []
  if (duelists.length > 0) {
    lines.push(
      `决斗者名单: ${duelists
        .map((d) => `${d.name}(${d.team === 0 ? '我方' : '对方'} LP ${d.lp})`)
        .join('、')}`
    )
  }

  const cards = state.cards || []
  lines.push(`场上及手牌卡片总计: ${cards.length} 张`)

  for (const c of cards) {
    const owner = c.controller === 0 ? '我方' : '对方'
    let locName = '未知区域'
    if (c.location === CardLocation.HAND) locName = '手牌'
    else if (c.location === CardLocation.MZONE) locName = `怪兽区[${c.sequence}]`
    else if (c.location === CardLocation.SZONE) locName = `魔陷区[${c.sequence}]`
    else if (c.location === CardLocation.GRAVE) locName = '墓地'
    else if (c.location === CardLocation.REMOVED) locName = '除外区'
    else if (c.location === CardLocation.EXTRA) locName = '额外卡组'
    else if (c.location === CardLocation.DECK) locName = '主卡组'

    const name = c.card?.name || (c.code > 0 ? `卡密:${c.code}` : '未知盖卡')
    lines.push(`- [${owner}] ${name} 位于 ${locName}`)
  }

  return { lines, cardCount: cards.length }
}

export function createGetCurrentBoardTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent, getBoardState } = deps
  return {
    name: 'get_current_board',
    label: '读取当前决斗盘面与手牌',
    description: '获取创作者当前在编辑器中排布的双方怪兽、魔陷、手牌、墓地与生命值状态',
    parameters: Type.Object({}),
    execute: async (_toolCallId) => {
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'get_current_board',
        params: {}
      })

      const state = getBoardState()
      if (!state) {
        const text = '当前决斗盘未加载任何局面数据。'
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'get_current_board',
          resultSummary: '盘面为空'
        })
        const details: Record<string, unknown> = { cardCount: 0 }
        return { content: [{ type: 'text', text }], details }
      }

      const { lines, cardCount } = formatBoardText(state)

      emitEvent({
        type: 'tool_call_end',
        id: _toolCallId,
        toolName: 'get_current_board',
        resultSummary: `已读取双方场面，共 ${cardCount} 张卡`
      })

      const details: Record<string, unknown> = { cardCount }
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details
      }
    }
  }
}
