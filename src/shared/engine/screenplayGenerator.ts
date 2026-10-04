/**
 * 同人剧情决斗台本 Markdown 剧本文档生成器
 * 平台无关 (@shared)，两进程共享纯函数
 * 将可视化的决斗编排与推演步骤一键导出为标准的同人小说 / 决斗台本 Markdown 文档
 */
import { DuelPuzzleState } from '../types/duel'
import { PHASE_SHORT_NAMES, ACTION_TYPE_NAMES } from '../types/story'

export interface ScreenplayOptions {
  includeInnerThoughts?: boolean
  includeTechnicalNotes?: boolean
  player0Name?: string
  player1Name?: string
}

export function generateScreenplayMarkdown(
  state: DuelPuzzleState,
  options?: ScreenplayOptions
): string {
  const p0Name = options?.player0Name || state.duelists?.find((d) => d.team === 0)?.name || '我方'
  const p1Name = options?.player1Name || state.duelists?.find((d) => d.team === 1)?.name || '对方'

  const lines: string[] = []

  // 1. 大标题与元信息
  const title = state.title?.trim() || '未命名决斗剧情'
  lines.push(`# 《${title}》—— 决斗剧本台本`)
  lines.push('')

  if (state.hint?.trim()) {
    lines.push(`> **剧情背景 / 前情提要**：${state.hint.trim()}`)
    lines.push('')
  }

  // 2. 决斗对阵概览
  lines.push('### 【对局设定】')
  lines.push(`- **先攻方**：${state.turnPlayer === 0 ? p0Name : p1Name}`)
  lines.push(`- **${p0Name}**：初始生命值 ${state.players[0]?.lp || 8000} 点`)
  lines.push(`- **${p1Name}**：初始生命值 ${state.players[1]?.lp || 8000} 点`)
  lines.push(`- **规则体系**：大师规则 MR${state.masterRule}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // 3. 步骤与回合章节推演
  const steps = state.steps || []
  if (steps.length === 0) {
    lines.push('*（暂未记录推演步骤，可在决斗编排器中添加回合与战术动作）*')
    lines.push('')
    return lines.join('\n')
  }

  let currentTurn = -1
  let currentPhase = ''

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]

    // 检查是否换回合
    if (step.turn !== currentTurn) {
      currentTurn = step.turn
      currentPhase = ''
      const turnHolder = step.turnPlayer === 0 ? p0Name : p1Name
      lines.push(`## 第 ${currentTurn} 回合 —— ${turnHolder} 的回合`)
      lines.push('')
    }

    // 检查是否换阶段
    if (step.phase !== currentPhase) {
      currentPhase = step.phase
      const phaseName = PHASE_SHORT_NAMES[step.phase] || step.phase
      lines.push(`### 【${phaseName}】`)
      lines.push('')
    }

    const actionActor = step.actionPlayer === 0 ? p0Name : p1Name
    const actionName = ACTION_TYPE_NAMES[step.actionType] || step.actionType

    // 角色对白 (若是剧情台词)
    if (step.speaker && step.dialogue) {
      lines.push(`> **${step.speaker}**：「${step.dialogue}」`)
      lines.push('')
    } else if (step.dialogue) {
      lines.push(`> **${actionActor}**：「${step.dialogue}」`)
      lines.push('')
    }

    // 内心独白 (可选)
    if (step.innerThoughts && options?.includeInnerThoughts !== false) {
      lines.push(`*（${step.innerThoughts}）*`)
      lines.push('')
    }

    // 动作记录与卡片操作
    if (step.actionType !== 'DIALOGUE') {
      const cardStr = step.cardName
        ? `【${step.cardName}】${step.cardCode ? `(${step.cardCode})` : ''}`
        : ''
      const chainStr = step.chainIndex ? ` [C${step.chainIndex}]` : ''
      lines.push(
        `- **[步骤 ${i + 1}]** ${actionActor} 执行**【${actionName}】**${chainStr} ${cardStr}`
      )

      if (step.description) {
        lines.push(`  - *战术说明*：${step.description}`)
      }
    }

    // 生命值变动广播
    if (step.lpChange) {
      const targetName = step.lpChange.player === 0 ? p0Name : p1Name
      const diff = step.lpChange.newLp - step.lpChange.oldLp
      const sign = diff >= 0 ? `+${diff}` : `${diff}`
      lines.push(
        `  - **生命值变动**：${targetName} LP ${step.lpChange.oldLp} ➔ **${step.lpChange.newLp}** (${sign})`
      )
    }

    lines.push('')
  }

  lines.push('---')
  lines.push('*（本同人决斗剧本由 YGO Duel Editor 导出）*')
  lines.push('')

  return lines.join('\n')
}
