import { ACTION_TYPE_NAMES, DuelPuzzleState, DuelStep, PHASE_SHORT_NAMES } from '@shared/index'
import { stepCardName } from './cardNames'

export function generateFullScriptText(state: DuelPuzzleState, steps: DuelStep[]): string {
  const lines: string[] = []
  lines.push(`## 决斗台本：《${state.title || '未命名对局'}》`)
  if (state.hint) lines.push(`> 剧情提示: ${state.hint}`)
  lines.push('')

  let lastTurn = -1
  let lastPhase = ''

  steps.forEach((s, idx) => {
    if (s.turn !== lastTurn) {
      lines.push(`\n### 【第 ${s.turn} 回合 · ${s.turnPlayer === 0 ? '我方' : '对方'}回合】`)
      lastTurn = s.turn
      lastPhase = ''
    }
    if (s.phase !== lastPhase) {
      lines.push(`\n**>> ${PHASE_SHORT_NAMES[s.phase] || s.phase} <<**`)
      lastPhase = s.phase
    }

    const actName = ACTION_TYPE_NAMES[s.actionType] || s.actionType
    const name = stepCardName(s)
    const cardDesc = name ? `【${name}】` : ''
    const pName = s.actionPlayer === 0 ? '我方' : '对方'
    const chainStr = s.chainIndex ? ` (Chain ${s.chainIndex})` : ''

    lines.push(`${idx + 1}. [操作] ${pName}：${actName} ${cardDesc}${chainStr}`)

    if (s.speaker || s.dialogue) {
      const spk = s.speaker ? `【${s.speaker}】` : ''
      lines.push(`   ${spk}：“${s.dialogue || ''}”`)
    }
    if (s.innerThoughts) {
      lines.push(`   （心理戏）：${s.innerThoughts}`)
    }
    if (s.description) {
      lines.push(`   *战术解说*：${s.description}`)
    }
  })

  return lines.join('\n')
}
