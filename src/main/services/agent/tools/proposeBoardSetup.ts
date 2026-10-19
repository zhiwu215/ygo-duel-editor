import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import {
  AgentBoardCardPlacement,
  AgentBoardLpTarget,
  AgentBoardSetupProposal,
  normalizeAgentBoardPlacement
} from '@shared/index'
import { cdbService } from '../../../db/cdbService'
import { Type } from '../toolSchema'
import type { AgentToolDeps } from './toolDeps'

export function createProposeBoardSetupTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent, setBoardSetup } = deps
  return {
    name: 'propose_board_setup',
    label: '复盘场面布局',
    description:
      '当用户口述了一个完整局面并要求把它摆到决斗场上时调用，提交一份待确认的布局（双方 LP + 每张牌的区域/格子/表示形式）。只提交提案，不会直接改动盘面，创作者确认后才会生效。复盘全新局面时 clearExisting 必须为 true。',
    parameters: Type.Object({
      summary: Type.String({ description: '这个局面的摘要，说明是什么场合、双方各剩什么' }),
      clearExisting: Type.Boolean({
        description:
          '是否先清空现有盘面再摆。复盘一个全新局面必须为 true，否则会在原有卡片上叠加摆放'
      }),
      lp: Type.Array(
        Type.Object({
          side: Type.Number({ description: '阵营：0 = 我方，1 = 对方' }),
          lp: Type.Number({ description: '目标生命值' }),
          duelistName: Type.Optional({
            description: '多人模式下指定决斗者名（如「韩诺」）；手牌与 LP 都属于具体决斗者'
          })
        }),
        { description: '生命值设定；不需要改动的一方可以不传' }
      ),
      cards: Type.Array(
        Type.Object({
          code: Type.Number({ description: '8 位卡密' }),
          cardName: Type.Optional({ description: '卡名，仅用于人工核对' }),
          side: Type.Number({ description: '阵营：0 = 我方，1 = 对方' }),
          location: Type.String({
            description:
              '区域: MZONE 怪兽区 / SZONE 魔陷区 / HAND 手牌 / GRAVE 墓地 / DECK 主卡组 / EXTRA 额外卡组 / REMOVED 除外区'
          }),
          sequence: Type.Number({
            description:
              '格子序号 0~4，恒定按**该方自己视角的左边起数**：seq0 = 该方最左格。对方的格子在屏幕上左右镜像（对方的 seq0 显示在屏幕最右边），但序号本身不变。手牌等堆叠区统一传 0，按顺序追加'
          }),
          position: Type.Optional({
            description:
              '表示形式: FACEUP_ATTACK 表侧攻击 / FACEUP_DEFENSE 表侧守备 / FACEDOWN 里侧盖放 / FACEUP 表侧表示。缺省时怪兽区按表攻、魔陷区与手牌按盖放'
          }),
          duelistName: Type.Optional({
            description:
              '目标决斗者名（如「韩诺」）；手牌必填，否则多人模式下会挂错人。可先用 get_current_board 查当前决斗者名单'
          }),
          isUnknown: Type.Optional({
            description:
              '仅当用户描述了一张「不知道是什么的盖卡」时为 true（如「魔陷区有一张盖卡」）。此时 code 传 0，格子会显示为无卡名的卡背。不要给已知卡设 true'
          }),
          customAtk: Type.Optional({
            description:
              '覆盖显示攻击力。动态攻防必须填（如「特拉戈迪亚攻击力上升手牌数量 X600，手牌 6 张 → 3600」），因为卡库里该卡atk 是 ?，不填显示不出真实数值'
          }),
          customDef: Type.Optional({ description: '覆盖显示守备力' })
        }),
        { description: '卡片落位列表' }
      )
    }),
    execute: async (
      _toolCallId,
      p: {
        summary: string
        clearExisting: boolean
        lp?: Array<{ side: number; lp: number; duelistName?: string }>
        cards?: Array<{
          code: number
          cardName?: string
          side: number
          location: string
          sequence: number
          position?: string
          duelistName?: string
          isUnknown?: boolean
          customAtk?: number
          customDef?: number
        }>
      }
    ) => {
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'propose_board_setup',
        params: { cardCount: p.cards?.length ?? 0, clearExisting: p.clearExisting }
      })

      const warnings: string[] = []
      const rawCards = p.cards ?? []
      const codes = rawCards
        .filter((c) => !c.isUnknown)
        .map((c) => c.code)
        .filter((c) => Number.isFinite(c) && c > 0)
      const dict = codes.length > 0 ? cdbService.getCardsByIds(codes) : {}

      const placements: AgentBoardCardPlacement[] = []
      rawCards.forEach((c, idx) => {
        if (c.isUnknown) {
          const norm = normalizeAgentBoardPlacement({
            location: c.location,
            sequence: c.sequence,
            position: c.position
          })
          if (!norm.ok || !norm.zone) {
            warnings.push(`第 ${idx + 1} 张未知盖卡：${norm.reason ?? '落位参数无效'}，已跳过`)
            return
          }
          placements.push({
            code: 0,
            cardName: c.cardName?.trim() || '未知盖卡',
            side: c.side === 1 ? 1 : 0,
            location: norm.zone,
            sequence: norm.sequence ?? 0,
            position: norm.facing ?? 'FACEDOWN',
            isUnknown: true,
            duelistName: c.duelistName?.trim() || undefined,
            customAtk: Number.isFinite(c.customAtk as number) ? c.customAtk : undefined,
            customDef: Number.isFinite(c.customDef as number) ? c.customDef : undefined
          })
          return
        }

        const label = c.cardName || dict[c.code]?.name || `卡密 ${c.code}`
        if (!Number.isFinite(c.code) || c.code <= 0 || !dict[c.code]) {
          warnings.push(`第 ${idx + 1} 张【${label}】的卡密 ${c.code} 在卡库中不存在，已跳过`)
          return
        }
        const norm = normalizeAgentBoardPlacement({
          location: c.location,
          sequence: c.sequence,
          position: c.position
        })
        if (!norm.ok || !norm.zone) {
          warnings.push(`第 ${idx + 1} 张【${label}】：${norm.reason ?? '落位参数无效'}，已跳过`)
          return
        }
        placements.push({
          code: c.code,
          cardName: dict[c.code].name,
          side: c.side === 1 ? 1 : 0,
          location: norm.zone,
          sequence: norm.sequence ?? 0,
          position: norm.facing,
          duelistName: c.duelistName?.trim() || undefined,
          customAtk: Number.isFinite(c.customAtk as number) ? c.customAtk : undefined,
          customDef: Number.isFinite(c.customDef as number) ? c.customDef : undefined
        })
      })

      const lpTargets: AgentBoardLpTarget[] = (p.lp ?? [])
        .filter((t) => Number.isFinite(t.lp))
        .map((t) => ({
          side: t.side === 1 ? 1 : 0,
          lp: Math.max(0, Math.trunc(t.lp)),
          duelistName: t.duelistName?.trim() || undefined
        }))

      const setup: AgentBoardSetupProposal = {
        summary: p.summary || '（未提供局面摘要）',
        clearExisting: Boolean(p.clearExisting),
        lp: lpTargets,
        cards: placements,
        warnings
      }

      setBoardSetup(setup)
      emitEvent({ type: 'board_setup_ready', setup })
      emitEvent({
        type: 'tool_call_end',
        id: _toolCallId,
        toolName: 'propose_board_setup',
        resultSummary: `待确认布局：${lpTargets.length} 项 LP、${placements.length} 张卡${
          warnings.length > 0 ? `，${warnings.length} 条警告` : ''
        }`
      })

      const lines: string[] = [
        `布局提案已提交，等待创作者在预览卡中确认：${placements.length} 张卡、${lpTargets.length} 项生命值。`,
        '此时盘面尚未改动。请在正文中用一两句话说明这个布局要怎么用，不要重复罗列每张卡。'
      ]
      if (warnings.length > 0) {
        lines.push(`已自动剔除 ${warnings.length} 处无效落位：`)
        lines.push(...warnings.map((w) => `- ${w}`))
      }
      const details: Record<string, unknown> = {
        cards: placements.length,
        lp: lpTargets.length,
        warnings: warnings.length
      }
      return { content: [{ type: 'text', text: lines.join('\n') }], details }
    }
  }
}
