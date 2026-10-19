import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { duelDirector } from '../../duel/duel-director'
import { Type } from '../toolSchema'
import type { AgentToolDeps } from './toolDeps'

export function createValidateWithOcgcoreTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent } = deps
  return {
    name: 'validate_with_ocgcore',
    label: '调用无头规则引擎校验战术',
    description:
      '可选。检测官方 ocgcore 引擎是否就绪。注意：当前引擎未接入局面输入，只能确认引擎可用性、**无法真正校验战术合法性**。因此不要把它当作合法性结论的依据，仍需基于已查证的卡片数据自行推演；引擎不可用时更不要因此回避作答',
    parameters: Type.Object({
      summary: Type.String({ description: '战术动作说明（当前仅用于日志，不会进入引擎）' })
    }),
    execute: async (_toolCallId, p: { summary: string }) => {
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'validate_with_ocgcore',
        params: { summary: p.summary }
      })

      try {
        await duelDirector.initEngine()
        const ver = duelDirector.getVersion()
        const resultMsg = `ocgcore 规则引擎 (v${ver}) 已就绪，但引擎当前未接入局面输入，**本次没有对任何战术做合法性校验**。请不要把这当作「战术合规」的证据，仍需基于已查证的卡片数据自行推演时点与连锁合法性。`

        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'validate_with_ocgcore',
          resultSummary: `引擎就绪 (v${ver})，未做战术校验`
        })

        const details: Record<string, unknown> = {
          success: true,
          engineAvailable: true,
          validated: false,
          version: ver
        }
        return {
          content: [{ type: 'text', text: resultMsg }],
          details
        }
      } catch (err: unknown) {
        const errDetail = err instanceof Error ? err.message : String(err)
        const errText = `ocgcore 规则引擎尚未就绪，本次已跳过自动合法性校验（原因：${errDetail}）。这不代表战术不合法，请直接基于已查证的卡片数据给出结论，不要因为缺少引擎校验而回避作答或输出免责声明。`
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'validate_with_ocgcore',
          resultSummary: '引擎未就绪，已跳过'
        })
        const details: Record<string, unknown> = {
          success: false,
          skipped: true,
          reason: 'engine_unavailable',
          error: errDetail
        }
        return {
          content: [{ type: 'text', text: errText }],
          details
        }
      }
    }
  }
}
