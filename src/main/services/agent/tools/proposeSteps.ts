import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { AgentStepProposal, normalizeAgentStepProposal } from '@shared/index'
import { Type } from '../toolSchema'
import type { AgentToolDeps } from './toolDeps'

export function createProposeStepsTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent, getProposals, appendProposals } = deps
  return {
    name: 'propose_duel_steps',
    label: '提交决斗推演步骤与角色台词',
    description:
      '当战术构思完毕时，必须调用此工具提交结构化的决斗步骤序列，以便用户一键导入决斗盘面与剧本',
    parameters: Type.Object({
      summary: Type.String({ description: '战术意图与局面总结' }),
      steps: Type.Array(
        Type.Object({
          turn: Type.Number({ description: '回合数，如 1, 2' }),
          phase: Type.String({ description: '阶段标识: DP, SP, M1, BP, M2, EP' }),
          actionPlayer: Type.Number({ description: '0代表我方/主角，1代表对方' }),
          actionType: Type.String({
            description:
              '动作类型: NORMAL_SUMMON, SPECIAL_SUMMON, ACTIVATE, ATTACK, TO_GRAVE, SET_MONSTER, SET_SPELL_TRAP, DAMAGE, DIALOGUE'
          }),
          cardCode: Type.Optional(Type.Number({ description: '卡片8位密码' })),
          cardName: Type.Optional(Type.String({ description: '卡片名称' })),
          speaker: Type.Optional(Type.String({ description: '台词发言者姓名' })),
          dialogue: Type.Optional(Type.String({ description: '角色热血对白台词' })),
          innerThoughts: Type.Optional(Type.String({ description: '角色内心独白/博弈思考' })),
          description: Type.Optional(Type.String({ description: '战术动作操作说明' })),
          chainIndex: Type.Optional(Type.Number({ description: '连锁序号' })),
          fromLocation: Type.Optional(
            Type.String({
              description:
                '涉及卡片在动作前的区域: MZONE / SZONE / HAND / GRAVE / DECK / EXTRA / REMOVED。同一卡密有多张时用于消歧'
            })
          ),
          toLocation: Type.Optional(
            Type.String({
              description:
                '动作后卡片移动到的区域（同上枚举）。缺省时编辑器按动作类型推断：召唤→怪兽区、盖放→魔陷区、破坏/送墓→墓地、除外→除外区'
            })
          ),
          toSequence: Type.Optional(
            Type.Number({
              description: '目标格子序号 0~4，仅在移动到怪兽区/魔陷区等离散格时填写'
            })
          ),
          sourceQuote: Type.Optional(
            Type.String({
              description:
                '该步对应的原文短句（40 字内），供创作者核对转写顺序；凭空推演的步骤不要编造原文'
            })
          ),
          lpChange: Type.Optional(
            Type.Object({
              player: Type.Number({ description: '受到LP变动的玩家: 0我方, 1对方' }),
              oldLp: Type.Number(),
              newLp: Type.Number()
            })
          )
        })
      )
    }),
    execute: async (
      _toolCallId,
      p: {
        summary: string
        steps: unknown[]
      }
    ) => {
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'propose_duel_steps',
        params: { stepCount: p.steps.length, summary: p.summary }
      })

      const notes: string[] = []
      const rejected: string[] = []
      const mappedSteps: AgentStepProposal[] = []
      p.steps.forEach((s, idx) => {
        const res = normalizeAgentStepProposal(s)
        if (res.ok) {
          if (res.note) notes.push(`第 ${idx + 1} 步：${res.note}`)
          mappedSteps.push(res.step)
        } else {
          rejected.push(`第 ${idx + 1} 步：${res.error}`)
        }
      })

      appendProposals(mappedSteps)

      emitEvent({
        type: 'proposals_ready',
        proposals: [...getProposals()]
      })

      emitEvent({
        type: 'tool_call_end',
        id: _toolCallId,
        toolName: 'propose_duel_steps',
        resultSummary: `累计接收 ${getProposals().length} 步（本批 +${mappedSteps.length}）${
          rejected.length > 0 ? `，剔除 ${rejected.length} 步` : ''
        }`
      })

      const lines: string[] = []
      if (mappedSteps.length === 0) {
        lines.push(
          '本批没有可用的步骤提案，全部被剔除。请按下列原因修正字段后重新提交整批，不要缩小范围重试。'
        )
      } else {
        lines.push(
          `已接收 ${mappedSteps.length} 个步骤提案（本轮累计 ${getProposals().length} 个）。转写未完成时继续按回合分批提交；已全部完成则不必再调用。`
        )
      }
      if (notes.length > 0) lines.push('已自动修正：', ...notes.map((n) => `- ${n}`))
      if (rejected.length > 0) {
        lines.push('被剔除的步骤（下一批提交前请先修正）：', ...rejected.map((r) => `- ${r}`))
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: {
          accepted: mappedSteps.length,
          rejected: rejected.length,
          total: getProposals().length
        }
      }
    }
  }
}
